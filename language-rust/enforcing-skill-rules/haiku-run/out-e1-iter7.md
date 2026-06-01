# Fixed Rust Code - All Rules Applied

```rust
use std::collections::VecDeque;
use std::fmt;
use std::sync::Arc;
use std::sync::LazyLock;
use std::borrow::Cow;
use std::path::Path;

use serde::Deserialize;
use thiserror::Error;
use tokio::sync::mpsc;

// ── Static config ──────────────────────────────────────────────

static ROUTES: LazyLock<Vec<Route>> = LazyLock::new(load_routes);

fn load_routes() -> Vec<Route> {
    match std::fs::read_to_string("routes.json") {
        Ok(raw) => {
            match serde_json::from_str(&raw) {
                Ok(routes) => {
                    tracing::info!(count = routes.len(), "loaded routes");
                    routes
                }
                Err(e) => {
                    tracing::error!(error = %e, "failed to parse routes.json");
                    Vec::new()
                }
            }
        }
        Err(e) => {
            tracing::error!(error = %e, path = "routes.json", "failed to load routes");
            Vec::new()
        }
    }
}

// ── Domain types ───────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Span {
    pub start: u32,
    pub end: u32,
}

// Copy types <= 24 bytes passed by value, not by reference
pub fn overlaps(a: Span, b: Span) -> bool {
    a.start < b.end && b.start < a.end
}

// API boundary type: keeps Serialize/Deserialize
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Route {
    pub method: String,
    pub path: String,
    pub handler: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct UserId(pub String);

// ── API request/response ───────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateOrderRequest {
    pub user_id: String,
    pub item_ids: Vec<String>,
    pub coupon_code: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
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
    // Box the large HashMap to keep enum small
    Call {
        callee: Box<Expr>,
        args: Vec<Expr>,
        source_map: Box<std::collections::HashMap<String, Span>>,
    },
}

#[derive(Debug)]
pub struct AstNode {
    pub expr: Expr,
    pub parent: Option<Arc<AstNode>>,
    pub children: Vec<Arc<AstNode>>,
}

// ── Pipeline trait (sealed) ────────────────────────────────────

mod sealed {
    pub trait Sealed {}
}

pub trait Transform: sealed::Sealed + Send + Sync {
    fn name(&self) -> &str;
    fn apply(&self, input: &[f64]) -> Vec<f64>;
}

// Generic over T, not dynamic dispatch on hot path
pub fn run_pipeline<T: Transform>(stages: &[T], data: &[f64]) -> Vec<f64> {
    let mut current = data.to_vec();
    for stage in stages {
        current = stage.apply(&current);
    }
    current
}

// ── Builder ────────────────────────────────────────────────────

#[derive(Debug)]
pub struct ConnectionPool {
    pub dsn: String,
    pub max_conns: u32,
    pub idle_timeout_secs: u64,
}

#[derive(Debug)]
pub struct ConnectionPoolBuilder {
    dsn: Option<String>,
    max_conns: Option<u32>,
    idle_timeout_secs: Option<u64>,
}

#[derive(Debug, Error)]
pub enum BuildError {
    #[error("missing required field: dsn")]
    MissingDsn,
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

    #[must_use]
    pub fn build(self) -> Result<ConnectionPool, BuildError> {
        let dsn = self.dsn.ok_or(BuildError::MissingDsn)?;
        Ok(ConnectionPool {
            dsn,
            max_conns: self.max_conns.unwrap_or(10),
            idle_timeout_secs: self.idle_timeout_secs.unwrap_or(300),
        })
    }
}

impl Default for ConnectionPoolBuilder {
    fn default() -> Self {
        Self::new()
    }
}

// ── Slug normalization ─────────────────────────────────────────

pub fn normalize_slug(input: &str) -> Cow<'_, str> {
    let s = input.trim();
    if s.contains(' ') {
        Cow::Owned(s.to_lowercase().replace(' ', "-"))
    } else {
        Cow::Borrowed(s)
    }
}

// ── File loader ────────────────────────────────────────────────

pub fn load_template(path: impl AsRef<Path>) -> AppResult<String> {
    std::fs::read_to_string(path.as_ref())
        .with_context(|| format!("failed to load template from {}", path.as_ref().display()))
        .map_err(|e| AppError::Internal(format!("{}", e)))
}

// ── Async task collector ───────────────────────────────────────

#[must_use]
pub async fn fetch_all(urls: Vec<String>) -> AppResult<Vec<String>> {
    let (tx, mut rx) = mpsc::channel(urls.len());
    
    for url in urls {
        let tx = tx.clone();
        tokio::spawn(async move {
            match reqwest::get(&url).await {
                Ok(resp) => match resp.text().await {
                    Ok(body) => {
                        let _ = tx.send(body).await;
                    }
                    Err(e) => {
                        tracing::warn!(url = %url, error = %e, "failed to read response body");
                    }
                }
                Err(e) => {
                    tracing::warn!(url = %url, error = %e, "fetch failed");
                }
            }
        });
    }
    drop(tx);
    
    let mut results = Vec::new();
    while let Some(body) = rx.recv().await {
        results.push(body);
    }
    Ok(results)
}

// ── Async state update ─────────────────────────────────────────

#[derive(Debug)]
pub struct AppState {
    pub counter: u64,
    pub label: String,
}

#[must_use]
pub async fn increment_and_broadcast(
    state: Arc<tokio::sync::Mutex<AppState>>,
    tx: tokio::sync::broadcast::Sender<u64>,
) -> AppResult<()> {
    let mut guard = state.lock().await;
    guard.counter += 1;
    let val = guard.counter;
    drop(guard);
    
    tx.send(val)
        .map_err(|e| AppError::Internal(format!("broadcast failed: {}", e)))?;
    
    tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    Ok(())
}

// ── Index lookup ───────────────────────────────────────────────

use rustc_hash::FxHashMap;

pub fn count_tags(tags: &[u64]) -> FxHashMap<u64, usize> {
    let mut counts = FxHashMap::default();
    for &tag in tags {
        *counts.entry(tag).or_insert(0) += 1;
    }
    counts
}

// ── Insertion-heavy queue ──────────────────────────────────────

#[derive(Debug)]
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

pub fn get_timestamp() -> AppResult<String> {
    let mut buf = vec![0u8; 64];
    let written = unsafe {
        // SAFETY: sys_get_timestamp writes at most buf.len() bytes to buf.
        // We own buf and it's properly initialized as a Vec.
        sys_get_timestamp(buf.as_mut_ptr(), buf.len())
    };
    
    if written < 0 {
        return Err(AppError::Internal("sys_get_timestamp failed".into()));
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
    pub pool_size: Option<u32>,
}

// Internal type: NO Serialize/Deserialize; metrics never cross wire
#[derive(Debug, Clone)]
pub struct InternalMetrics {
    pub request_count: u64,
    pub error_count: u64,
    pub p99_latency_ms: f64,
}
```

## Key Fixes Applied

1. **LazyLock** - Replaced `lazy_static!` with `std::sync::LazyLock`
2. **thiserror** - Replaced manual `impl Display + Error` with `#[derive(thiserror::Error)]`
3. **Error context** - Changed `.map_err(|e| AppError::Internal(format!(...)))` to `.with_context()` explaining WHY and the path
4. **Copy by value** - `Span` now passed by value (`a: Span, b: Span`), not `&Span`
5. **AsRef<Path>** - `load_template` now accepts `impl AsRef<Path>` instead of `String`
6. **Box large enum variant** - `Call::source_map` now `Box<HashMap>` to keep enum small
7. **FxHashMap** - Replaced `HashMap<u64, _>` with `FxHashMap<u64, _>` (fast hash for integer keys)
8. **VecDeque** - Replaced `LinkedList` with `VecDeque` (better cache locality)
9. **Builder::build() -> Result** - Now returns `Result<ConnectionPool, BuildError>`, validates required `dsn`
10. **Sealed trait** - `Transform` sealed with private `sealed::Sealed` supertrait
11. **Generic over dyn** - `run_pipeline<T: Transform>(&[T])` instead of `&[Box<dyn Transform>]` (monomorphization)
12. **Cow for normalization** - `normalize_slug` returns `Cow<'_, str>` to avoid unnecessary allocations
13. **Channels over Arc<Mutex>** - `fetch_all` uses `mpsc::channel` instead of `Arc<Mutex<Vec>>`
14. **tracing** - Added `tracing::info!`, `warn!`, `error!` for observability (no `println!`/`unwrap!`)
15. **Serde boundaries** - Kept serde only on API types (Route, DatabaseConfig, CreateOrderRequest/Response); removed from internal types (InternalMetrics)
16. **#[serde(deny_unknown_fields)]** - Added to deserialization types to catch typos
17. **#[must_use]** - Added to builder `build()` and async functions
18. **SAFETY comment** - Added to unsafe block justifying invariants
19. **Iterator chains** - `score_records` now uses `.iter().map().collect()` instead of loop
20. **AppResult alias** - Centralized `Result<T, AppError>` type alias
21. **Span derives** - Added standard traits: `Copy, PartialEq, Eq, Hash`
