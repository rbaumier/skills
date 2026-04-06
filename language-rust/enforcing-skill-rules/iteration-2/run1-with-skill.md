# Run 1 — With Skill (v2 eval)

```rust
use std::borrow::Cow;
use std::collections::VecDeque;
use std::path::Path;
use std::sync::LazyLock;

use rustc_hash::FxHashMap;
use thiserror::Error;
use tokio::sync::mpsc;
use tracing::info;

// ── Static config ──────────────────────────────────────────────

static ROUTES: LazyLock<Vec<Route>> = LazyLock::new(|| {
    let raw = std::fs::read_to_string("routes.json")
        .expect("routes.json must be present at startup");
    info!(path = "routes.json", "loading route table");
    serde_json::from_str(&raw).expect("routes.json must contain valid JSON")
});

// ── Domain types ───────────────────────────────────────────────

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Route {
    pub method: String,
    pub path: String,
    pub handler: String,
}

/// Validated user identifier — parse, don't validate.
#[derive(Debug, Clone)]
pub struct UserId(String);

impl UserId {
    pub fn new(raw: impl Into<String>) -> Result<Self, AppError> {
        let s = raw.into();
        if s.is_empty() {
            return Err(AppError::Validation(vec![
                "user_id must not be empty".into(),
            ]));
        }
        Ok(Self(s))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, Copy)]
pub struct Span {
    pub start: u32,
    pub end: u32,
}

pub fn overlaps(a: Span, b: Span) -> bool {
    a.start < b.end && b.start < a.end
}

// ── API request/response ───────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateOrderRequest {
    pub user_id: String,
    pub item_ids: Vec<String>,
    pub coupon_code: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, serde::Serialize)]
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
    pub callee: Expr,
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

// ── Pipeline trait (sealed, generic hot path) ──────────────────

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

#[must_use]
pub struct ConnectionPoolBuilder {
    dsn: Option<String>,
    max_conns: Option<u32>,
    idle_timeout_secs: Option<u64>,
}

pub struct ConnectionPool {
    pub dsn: String,
    pub max_conns: u32,
    pub idle_timeout_secs: u64,
}

impl ConnectionPoolBuilder {
    pub fn new() -> Self {
        Self {
            dsn: None,
            max_conns: None,
            idle_timeout_secs: None,
        }
    }

    pub fn dsn(mut self, dsn: impl Into<String>) -> Self {
        self.dsn = Some(dsn.into());
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

    #[must_use]
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
    let needs_lowercase = trimmed.chars().any(|c| c.is_uppercase());
    let needs_dash = trimmed.contains(' ');

    if !needs_lowercase && !needs_dash {
        return Cow::Borrowed(trimmed);
    }

    let mut s = trimmed.to_lowercase();
    if needs_dash {
        s = s.replace(' ', "-");
    }
    Cow::Owned(s)
}

// ── File loader ────────────────────────────────────────────────

pub fn load_template(path: impl AsRef<Path>) -> Result<String, AppError> {
    let path = path.as_ref();
    std::fs::read_to_string(path).map_err(|e| {
        AppError::Internal(format!(
            "failed to load template from '{}': {}",
            path.display(),
            e
        ))
    })
}

// ── Async task collector (channel-based) ───────────────────────

pub async fn fetch_all(urls: Vec<String>) -> Result<Vec<String>, AppError> {
    let (tx, mut rx) = mpsc::channel(urls.len().max(1));
    let mut handles = Vec::with_capacity(urls.len());

    for url in urls {
        let tx = tx.clone();
        let handle = tokio::spawn(async move {
            let resp = reqwest::get(&url)
                .await
                .map_err(|e| AppError::Internal(format!("request failed for {url}: {e}")))?;
            let body = resp
                .text()
                .await
                .map_err(|e| AppError::Internal(format!("body read failed for {url}: {e}")))?;
            // Ignoring send error: receiver dropped means caller cancelled.
            let _ = tx.send(Ok::<_, AppError>(body)).await;
            Ok::<_, AppError>(())
        });
        handles.push(handle);
    }
    // Drop the original sender so rx completes when all tasks finish.
    drop(tx);

    for h in handles {
        h.await.map_err(|e| AppError::Internal(e.to_string()))??;
    }

    let mut results = Vec::new();
    while let Some(item) = rx.recv().await {
        results.push(item?);
    }
    Ok(results)
}

// ── Async state update ─────────────────────────────────────────

pub struct AppState {
    pub counter: u64,
    pub label: String,
}

pub async fn increment_and_broadcast(
    state: std::sync::Arc<tokio::sync::Mutex<AppState>>,
    tx: tokio::sync::broadcast::Sender<u64>,
) -> Result<(), AppError> {
    let val = {
        let mut guard = state.lock().await;
        guard.counter += 1;
        guard.counter
        // guard dropped here, before the .await below
    };
    tx.send(val)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    Ok(())
}

// ── Index lookup (fast hasher for integer keys) ────────────────

pub fn count_tags(tags: &[u64]) -> FxHashMap<u64, usize> {
    let mut counts = FxHashMap::default();
    counts.reserve(tags.len());
    for &tag in tags {
        *counts.entry(tag).or_insert(0) += 1;
    }
    counts
}

// ── Job queue (VecDeque, not LinkedList) ───────────────────────

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

// ── Batch item transform (iterator chain, slice param) ─────────

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

// ── FFI wrapper (isolated unsafe with SAFETY comment) ──────────

mod sys {
    extern "C" {
        pub fn sys_get_timestamp(buf: *mut u8, len: usize) -> i32;
    }
}

pub fn get_timestamp() -> Result<String, AppError> {
    let mut buf = vec![0u8; 64];
    // SAFETY: `buf` is a valid, owned Vec<u8> of length 64.
    // `as_mut_ptr()` yields a valid pointer for `buf.len()` bytes.
    // `sys_get_timestamp` writes at most `len` bytes and returns
    // the number of bytes written (or negative on error).
    // We truncate `buf` to `written` bytes before reading, so all
    // accessed bytes have been initialized by the FFI call.
    unsafe {
        let written = sys::sys_get_timestamp(buf.as_mut_ptr(), buf.len());
        if written < 0 {
            return Err(AppError::Internal("sys_get_timestamp failed".into()));
        }
        buf.truncate(written as usize);
    }
    String::from_utf8(buf).map_err(|e| AppError::Internal(e.to_string()))
}

// ── Config deserializer ────────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DatabaseConfig {
    pub host: String,
    pub port: u16,
    pub name: String,
    #[serde(default = "default_pool_size")]
    pub pool_size: u32,
}

fn default_pool_size() -> u32 {
    8
}

// InternalMetrics is internal — no Serialize/Deserialize.
#[derive(Debug)]
pub struct InternalMetrics {
    pub request_count: u64,
    pub error_count: u64,
    pub p99_latency_ms: f64,
}
```
