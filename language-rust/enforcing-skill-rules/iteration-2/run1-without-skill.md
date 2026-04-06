# Run 1 — Without Skill (v2 eval)

```rust
use std::borrow::Cow;
use std::collections::VecDeque;
use std::path::Path;
use std::sync::{Arc, LazyLock};

use anyhow::Context;
use rustc_hash::FxHashMap;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tracing::info;

// ── Static config ──────────────────────────────────────────────

static ROUTES: LazyLock<Vec<Route>> = LazyLock::new(|| {
    let raw = std::fs::read_to_string("routes.json")
        .expect("failed to read routes.json at startup");
    info!(path = "routes.json", "loaded route configuration");
    serde_json::from_str(&raw).expect("routes.json contains invalid JSON")
});

// ── Domain types ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Route {
    pub method: String,
    pub path: String,
    pub handler: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserId(pub String);

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Span {
    pub start: u32,
    pub end: u32,
}

pub fn overlaps(a: Span, b: Span) -> bool {
    a.start < b.end && b.start < a.end
}

// ── API request/response ───────────────────────────────────────

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateOrderRequest {
    pub user_id: String,
    pub item_ids: Vec<String>,
    pub coupon_code: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateOrderResponse {
    pub order_id: String,
    pub total_cents: u64,
}

// ── Error type ─────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum AppError {
    #[error("not found: {0}")]
    NotFound(String),
    #[error("unauthorized")]
    Unauthorized,
    #[error("internal error: {0}")]
    Internal(String),
    #[error("validation: {}", .0.join(", "))]
    Validation(Vec<String>),
}

// ── AST node (arena-based) ─────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NodeId(usize);

#[derive(Debug)]
pub enum Expr {
    Literal(i64),
    Ident(String),
    BinaryOp {
        op: char,
        lhs: Box<Expr>,
        rhs: Box<Expr>,
    },
    Call(Box<CallExpr>),
}

#[derive(Debug)]
pub struct CallExpr {
    pub callee: Box<Expr>,
    pub args: Vec<Expr>,
    pub source_map: FxHashMap<String, Span>,
}

#[derive(Debug)]
pub struct AstNode {
    pub expr: Expr,
    pub parent: Option<NodeId>,
    pub children: Vec<NodeId>,
}

#[derive(Debug, Default)]
pub struct AstArena {
    nodes: Vec<AstNode>,
}

impl AstArena {
    pub fn alloc(&mut self, node: AstNode) -> NodeId {
        let id = NodeId(self.nodes.len());
        self.nodes.push(node);
        id
    }

    pub fn get(&self, id: NodeId) -> &AstNode {
        &self.nodes[id.0]
    }

    pub fn get_mut(&mut self, id: NodeId) -> &mut AstNode {
        &mut self.nodes[id.0]
    }
}

// ── Pipeline trait (sealed, generic) ───────────────────────────

mod private {
    pub trait Sealed {}
}

pub trait Transform: private::Sealed {
    fn name(&self) -> &str;
    fn apply(&self, input: &[f64]) -> Vec<f64>;
}

pub fn run_pipeline<T: Transform>(stages: &[T], data: &[f64]) -> Vec<f64> {
    let mut current = data.to_vec();
    for stage in stages {
        current = stage.apply(&current);
    }
    current
}

// ── Builder ────────────────────────────────────────────────────

pub struct ConnectionPool {
    pub dsn: String,
    pub max_conns: u32,
    pub idle_timeout_secs: u64,
}

#[must_use]
pub struct ConnectionPoolBuilder {
    dsn: Option<String>,
    max_conns: Option<u32>,
    idle_timeout_secs: Option<u64>,
}

impl ConnectionPoolBuilder {
    pub fn new() -> Self {
        Self {
            dsn: None,
            max_conns: None,
            idle_timeout_secs: None,
        }
    }

    pub fn dsn(mut self, dsn: String) -> Self {
        self.dsn = Some(dsn);
        self
    }

    pub fn max_conns(mut self, n: u32) -> Self {
        self.max_conns = Some(n);
        self
    }

    pub fn idle_timeout_secs(mut self, secs: u64) -> Self {
        self.idle_timeout_secs = Some(secs);
        self
    }

    pub fn build(self) -> Result<ConnectionPool, AppError> {
        let dsn = self
            .dsn
            .ok_or_else(|| AppError::Validation(vec!["dsn is required".into()]))?;
        Ok(ConnectionPool {
            dsn,
            max_conns: self.max_conns.unwrap_or(10),
            idle_timeout_secs: self.idle_timeout_secs.unwrap_or(300),
        })
    }
}

// ── Slug normalization ─────────────────────────────────────────

pub fn normalize_slug(input: &str) -> Cow<'_, str> {
    let trimmed = input.trim();
    if trimmed.contains(' ') || trimmed.chars().any(|c| c.is_ascii_uppercase()) {
        Cow::Owned(trimmed.to_lowercase().replace(' ', "-"))
    } else {
        Cow::Borrowed(trimmed)
    }
}

// ── File loader ────────────────────────────────────────────────

pub fn load_template(path: impl AsRef<Path>) -> Result<String, anyhow::Error> {
    let path = path.as_ref();
    std::fs::read_to_string(path)
        .with_context(|| format!("failed to load template from '{}'", path.display()))
}

// ── Async task collector ───────────────────────────────────────

pub async fn fetch_all(urls: Vec<String>) -> Result<Vec<String>, AppError> {
    let (tx, mut rx) = tokio::sync::mpsc::channel(urls.len().max(1));

    let mut handles = Vec::with_capacity(urls.len());
    for url in urls {
        let tx = tx.clone();
        let handle = tokio::spawn(async move {
            let resp = reqwest::get(&url)
                .await
                .map_err(|e| AppError::Internal(format!("request to {url} failed: {e}")))?;
            let body = resp
                .text()
                .await
                .map_err(|e| AppError::Internal(format!("reading body from {url} failed: {e}")))?;
            tx.send(body)
                .await
                .map_err(|e| AppError::Internal(e.to_string()))?;
            Ok::<(), AppError>(())
        });
        handles.push(handle);
    }
    // Drop the original sender so rx completes when all tasks finish.
    drop(tx);

    for h in handles {
        h.await
            .map_err(|e| AppError::Internal(e.to_string()))?
            .map_err(|e: AppError| e)?;
    }

    let mut results = Vec::new();
    while let Some(body) = rx.recv().await {
        results.push(body);
    }
    Ok(results)
}

// ── Async state update ─────────────────────────────────────────

pub struct AppState {
    pub counter: u64,
    pub label: String,
}

pub async fn increment_and_broadcast(
    state: Arc<tokio::sync::Mutex<AppState>>,
    tx: tokio::sync::broadcast::Sender<u64>,
) -> Result<(), AppError> {
    let val = {
        let mut guard = state.lock().await;
        guard.counter += 1;
        guard.counter
        // guard is dropped here before the .await below
    };
    tx.send(val).map_err(|e| AppError::Internal(e.to_string()))?;
    tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    Ok(())
}

// ── Index lookup ───────────────────────────────────────────────

pub fn count_tags(tags: &[u64]) -> FxHashMap<u64, usize> {
    let mut counts = FxHashMap::default();
    for &tag in tags {
        *counts.entry(tag).or_insert(0) += 1;
    }
    counts
}

// ── Job queue ──────────────────────────────────────────────────

pub struct Job {
    pub id: u64,
    pub priority: u8,
}

pub fn build_job_queue(n: usize) -> VecDeque<Job> {
    let mut queue = VecDeque::with_capacity(n);
    for i in 0..n {
        queue.push_back(Job {
            id: i as u64,
            priority: (i % 4) as u8,
        });
    }
    queue
}

// ── Batch item transform ───────────────────────────────────────

pub struct RawRecord {
    pub name: String,
    pub score: f64,
}

pub struct ScoredRecord {
    pub name: String,
    pub normalized_score: f64,
}

pub fn score_records(records: &[RawRecord], max_score: f64) -> Vec<ScoredRecord> {
    records
        .iter()
        .map(|r| ScoredRecord {
            name: r.name.clone(),
            normalized_score: r.score / max_score,
        })
        .collect()
}

// ── FFI wrapper ────────────────────────────────────────────────

extern "C" {
    fn sys_get_timestamp(buf: *mut u8, len: usize) -> i32;
}

pub fn get_timestamp() -> Result<String, AppError> {
    let mut buf = vec![0u8; 64];
    // SAFETY: `buf` is a valid, heap-allocated Vec of 64 bytes.
    // `buf.as_mut_ptr()` points to the start of this allocation and
    // `buf.len()` correctly reports its capacity. The FFI contract
    // guarantees writes stay within [ptr, ptr+len) and returns the
    // number of bytes written, or a negative value on failure.
    unsafe {
        let written = sys_get_timestamp(buf.as_mut_ptr(), buf.len());
        if written < 0 {
            return Err(AppError::Internal("sys_get_timestamp failed".into()));
        }
        buf.truncate(written as usize);
    }
    String::from_utf8(buf).map_err(|e| AppError::Internal(e.to_string()))
}

// ── Config deserializer ────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DatabaseConfig {
    pub host: String,
    pub port: u16,
    pub name: String,
    pub pool_size: Option<u32>,
}

#[derive(Debug)]
pub struct InternalMetrics {
    pub request_count: u64,
    pub error_count: u64,
    pub p99_latency_ms: f64,
}
```
