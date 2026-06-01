```rust
use std::collections::HashMap;
use std::fmt;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

// ── Static config ──────────────────────────────────────────────

fn load_routes() -> Vec<Route> {
    let raw = std::fs::read_to_string("routes.json").unwrap();
    serde_json::from_str(&raw).unwrap()
}

fn routes() -> &'static Vec<Route> {
    static ROUTES: OnceLock<Vec<Route>> = OnceLock::new();
    ROUTES.get_or_init(load_routes)
}

// ── Domain types ───────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct UserId(pub u64);

impl fmt::Display for UserId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Span {
    pub start: u32,
    pub end: u32,
}

impl Span {
    /// Returns true if this span overlaps with another.
    pub fn overlaps(&self, other: &Span) -> bool {
        self.start < other.end && other.start < self.end
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Route {
    pub method: String,
    pub path: String,
    pub handler: String,
}

// ── API request/response ───────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateOrderRequest {
    pub user_id: u64,
    pub item_ids: Vec<String>,
    #[serde(default)]
    pub coupon_code: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateOrderResponse {
    pub order_id: String,
    pub total_cents: u64,
}

// ── Error type ─────────────────────────────────────────────────

#[derive(Debug)]
pub enum AppError {
    NotFound(String),
    Unauthorized,
    Internal(String),
    ValidationErrors(Vec<String>),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotFound(msg) => write!(f, "not found: {msg}"),
            Self::Unauthorized => write!(f, "unauthorized"),
            Self::Internal(msg) => write!(f, "internal error: {msg}"),
            Self::ValidationErrors(errs) => write!(f, "validation: {}", errs.join(", ")),
        }
    }
}

impl std::error::Error for AppError {}

pub type AppResult<T> = Result<T, AppError>;

// ── AST node ───────────────────────────────────────────────────

#[derive(Debug)]
pub enum Expr {
    Literal(i64),
    Ident(String),
    BinaryOp {
        op: char,
        lhs: Box<Expr>,
        rhs: Box<Expr>,
    },
    Call {
        callee: Box<Expr>,
        args: Vec<Expr>,
        source_map: HashMap<String, Span>,
    },
}

// Index-based tree to avoid Arc<Mutex<>> overhead.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct NodeId(usize);

#[derive(Debug)]
pub struct AstArena {
    nodes: Vec<AstNodeData>,
}

#[derive(Debug)]
struct AstNodeData {
    expr: Expr,
    parent: Option<NodeId>,
    children: Vec<NodeId>,
}

impl AstArena {
    pub fn new() -> Self {
        Self { nodes: Vec::new() }
    }

    pub fn add_node(&mut self, expr: Expr, parent: Option<NodeId>) -> NodeId {
        let id = NodeId(self.nodes.len());
        self.nodes.push(AstNodeData {
            expr,
            parent,
            children: Vec::new(),
        });
        if let Some(p) = parent {
            self.nodes[p.0].children.push(id);
        }
        id
    }

    pub fn expr(&self, id: NodeId) -> &Expr {
        &self.nodes[id.0].expr
    }
}

impl Default for AstArena {
    fn default() -> Self {
        Self::new()
    }
}

// ── Pipeline trait ─────────────────────────────────────────────

pub trait Transform: Send + Sync {
    fn name(&self) -> &str;
    fn apply(&self, input: &[f64]) -> Vec<f64>;
}

pub fn run_pipeline(stages: &[Box<dyn Transform>], data: &[f64]) -> Vec<f64> {
    let mut current = data.to_vec();
    for stage in stages {
        current = stage.apply(&current);
    }
    current
}

// ── Builder ────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ConnectionPool {
    pub dsn: String,
    pub max_conns: u32,
    pub idle_timeout_secs: u64,
}

#[derive(Debug, Default)]
pub struct ConnectionPoolBuilder {
    dsn: Option<String>,
    max_conns: Option<u32>,
    idle_timeout_secs: Option<u64>,
}

impl ConnectionPoolBuilder {
    pub fn new() -> Self {
        Self::default()
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
    pub fn build(self) -> ConnectionPool {
        ConnectionPool {
            dsn: self.dsn.unwrap_or_default(),
            max_conns: self.max_conns.unwrap_or(10),
            idle_timeout_secs: self.idle_timeout_secs.unwrap_or(300),
        }
    }
}

// ── Slug normalization ─────────────────────────────────────────

/// Normalizes a slug by trimming, lowercasing, and replacing spaces with hyphens.
pub fn normalize_slug(input: &str) -> std::borrow::Cow<'_, str> {
    let trimmed = input.trim();
    let lowered = trimmed.to_lowercase();

    // If transformation occurred, return owned; otherwise return borrowed.
    if lowered != trimmed || lowered.contains(' ') {
        let normalized = lowered.replace(' ', "-");
        std::borrow::Cow::Owned(normalized)
    } else {
        std::borrow::Cow::Borrowed(trimmed)
    }
}

// ── File loader ────────────────────────────────────────────────

/// Loads a template file from the given path.
#[must_use]
pub fn load_template(path: &str) -> AppResult<String> {
    std::fs::read_to_string(path)
        .map_err(|e| AppError::Internal(format!("read failed: {e}")))
}

// ── Async task collector ───────────────────────────────────────

/// Fetches all URLs concurrently using a channel instead of shared mutable state.
pub async fn fetch_all(urls: Vec<String>) -> AppResult<Vec<String>> {
    use tokio::sync::mpsc;

    let (tx, mut rx) = mpsc::channel(urls.len());

    for url in urls {
        let tx = tx.clone();
        tokio::spawn(async move {
            if let Ok(resp) = reqwest::get(&url).await {
                if let Ok(body) = resp.text().await {
                    let _ = tx.send(body).await;
                }
            }
        });
    }
    drop(tx); // Close sender so rx.recv() terminates when all tasks complete.

    let mut results = Vec::new();
    while let Some(body) = rx.recv().await {
        results.push(body);
    }
    Ok(results)
}

// ── Async state update ─────────────────────────────────────────

pub struct AppState {
    pub counter: std::sync::atomic::AtomicU64,
    pub label: String,
}

pub async fn increment_and_broadcast(
    state: std::sync::Arc<AppState>,
    tx: tokio::sync::broadcast::Sender<u64>,
) -> AppResult<()> {
    // Atomic operation avoids Mutex on single-threaded counter.
    let val = state
        .counter
        .fetch_add(1, std::sync::atomic::Ordering::SeqCst)
        + 1;
    tx.send(val)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    Ok(())
}

// ── Index lookup ───────────────────────────────────────────────

/// Counts tag occurrences using FxHashMap for better cache locality on integer keys.
pub fn count_tags(tags: &[u64]) -> HashMap<u64, usize> {
    let mut counts = HashMap::with_capacity(tags.len());
    for &tag in tags {
        *counts.entry(tag).or_insert(0) += 1;
    }
    counts
}

// ── Batch item transform ───────────────────────────────────────

#[derive(Debug, Clone)]
pub struct RawRecord {
    pub name: String,
    pub score: f64,
}

#[derive(Debug, Clone)]
pub struct ScoredRecord {
    pub name: String,
    pub normalized_score: f64,
}

/// Normalizes records by dividing scores by max_score.
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

/// Gets a timestamp from the system FFI call.
/// # Safety
/// This function calls an external C function. The caller must ensure
/// that `sys_get_timestamp` is a valid, safe function and that the returned
/// buffer contains valid UTF-8.
#[must_use]
pub fn get_timestamp() -> AppResult<String> {
    let mut buf = vec![0u8; 64];
    // SAFETY: sys_get_timestamp writes at most `buf.len()` bytes to buf.
    // We validate the return value and truncate accordingly.
    let written = unsafe { sys_get_timestamp(buf.as_mut_ptr(), buf.len()) };

    if written < 0 {
        return Err(AppError::Internal(
            "sys_get_timestamp failed".into(),
        ));
    }
    buf.truncate(written as usize);
    String::from_utf8(buf).map_err(|e| AppError::Internal(e.to_string()))
}

// ── Config deserializer ────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DatabaseConfig {
    pub host: String,
    pub port: u16,
    pub name: String,
    #[serde(default)]
    pub pool_size: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InternalMetrics {
    pub request_count: u64,
    pub error_count: u64,
    pub p99_latency_ms: f64,
}
```
