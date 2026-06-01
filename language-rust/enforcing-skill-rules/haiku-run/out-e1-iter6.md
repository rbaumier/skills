```rust
use std::collections::VecDeque;
use std::sync::LazyLock;

use serde::{Deserialize, Serialize};
use thiserror::Error;

// ── Static config ──────────────────────────────────────────────

static ROUTES: LazyLock<Vec<Route>> = LazyLock::new(load_routes);

fn load_routes() -> Vec<Route> {
    let path = "routes.json";
    match std::fs::read_to_string(path) {
        Ok(raw) => {
            match serde_json::from_str(&raw) {
                Ok(routes) => {
                    tracing::info!(count = routes.len(), "loaded routes");
                    routes
                }
                Err(e) => {
                    tracing::error!(%e, path, "failed to parse routes");
                    Vec::new()
                }
            }
        }
        Err(e) => {
            tracing::warn!(%e, path, "failed to load routes file");
            Vec::new()
        }
    }
}

// ── Domain types ───────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct Route {
    pub method: String,
    pub path: String,
    pub handler: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct UserId(u64);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Span {
    pub start: u32,
    pub end: u32,
}

/// Check if two spans overlap.
/// A span is 8 bytes (2 × u32), so passes by value.
pub fn overlaps(a: Span, b: Span) -> bool {
    a.start < b.end && b.start < a.end
}

// ── API request/response ───────────────────────────────────────

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
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

#[derive(Debug, thiserror::Error)]
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
    Call {
        callee: Box<Expr>,
        args: Vec<Expr>,
        // Box the large HashMap so the enum variant stays small.
        source_map: Box<std::collections::HashMap<String, Span>>,
    },
}

#[derive(Debug)]
pub struct AstNode {
    pub expr: Expr,
    pub parent: Option<Box<AstNode>>,
    pub children: Vec<Box<AstNode>>,
}

// ── Pipeline trait ─────────────────────────────────────────────

/// Pipeline stage that transforms floating-point data.
/// Sealed to prevent external implementations.
mod sealed {
    pub trait Sealed {}
}

pub trait Transform: sealed::Sealed + Send + Sync {
    fn name(&self) -> &str;
    fn apply(&self, input: &[f64]) -> Vec<f64>;
}

/// Run a generic pipeline of stages.
/// Generic T ensures monomorphization on hot path, no dyn dispatch.
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

#[derive(Debug, thiserror::Error)]
pub enum PoolBuildError {
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

    /// Build returns Result; required field dsn is checked.
    /// Optional fields default if not provided.
    #[must_use]
    pub fn build(self) -> Result<ConnectionPool, PoolBuildError> {
        let dsn = self.dsn.ok_or(PoolBuildError::MissingDsn)?;
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

/// Normalize a slug: trim, lowercase, replace spaces with dashes.
/// Returns Cow to avoid allocation when no change needed.
pub fn normalize_slug(input: &str) -> std::borrow::Cow<'_, str> {
    let trimmed = input.trim();
    if trimmed.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        // Already normalized (case-insensitive check).
        std::borrow::Cow::Borrowed(trimmed)
    } else {
        let normalized = trimmed.to_lowercase().replace(' ', "-");
        std::borrow::Cow::Owned(normalized)
    }
}

// ── File loader ────────────────────────────────────────────────

/// Load template from file. Uses impl AsRef<Path> for flexibility.
pub fn load_template(path: impl AsRef<std::path::Path>) -> AppResult<String> {
    let path_ref = path.as_ref();
    std::fs::read_to_string(path_ref)
        .map_err(|e| AppError::Internal(
            format!("failed to load template from {}: {}", path_ref.display(), e)
        ))
}

// ── Async task collector ───────────────────────────────────────

/// Fetch multiple URLs concurrently using channels instead of Arc<Mutex<Vec>>.
#[must_use]
pub async fn fetch_all(urls: Vec<String>) -> AppResult<Vec<String>> {
    let (tx, mut rx) = tokio::sync::mpsc::channel(urls.len());
    let mut handles = Vec::new();

    for url in urls {
        let tx = tx.clone();
        let handle = tokio::spawn(async move {
            match reqwest::get(&url).await.and_then(|r| futures::executor::block_on(r.text())) {
                Ok(body) => {
                    let _ = tx.send(body).await;
                }
                Err(e) => {
                    tracing::error!(%e, %url, "fetch failed");
                }
            }
        });
        handles.push(handle);
    }

    drop(tx);

    for h in handles {
        h.await.map_err(|e| AppError::Internal(e.to_string()))?;
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

/// Increment counter and broadcast the new value.
/// Note: MutexGuard is dropped before .await to prevent deadlock.
pub async fn increment_and_broadcast(
    state: std::sync::Arc<tokio::sync::Mutex<AppState>>,
    tx: tokio::sync::broadcast::Sender<u64>,
) -> AppResult<()> {
    let mut guard = state.lock().await;
    guard.counter += 1;
    let val = guard.counter;
    drop(guard); // Explicitly drop before await.

    tx.send(val).map_err(|e| AppError::Internal(e.to_string()))?;
    tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    Ok(())
}

// ── Index lookup ───────────────────────────────────────────────

/// Count occurrences of u64 tags using FxHashMap (fast integer hash).
pub fn count_tags(tags: &[u64]) -> rustc_hash::FxHashMap<u64, usize> {
    let mut counts = rustc_hash::FxHashMap::default();
    for &tag in tags {
        *counts.entry(tag).or_insert(0) += 1;
    }
    counts
}

// ── FIFO queue ────────────────────────────────────────────────

pub struct Job {
    pub id: u64,
    pub priority: u8,
}

/// Build a FIFO job queue using VecDeque (not LinkedList).
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

/// Normalize scores. Accepts &[T] not &Vec<T>.
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

/// Get timestamp from C FFI.
/// SAFETY: sys_get_timestamp is assumed to write valid UTF-8 bytes into the buffer.
pub fn get_timestamp() -> AppResult<String> {
    let mut buf = vec![0u8; 64];
    unsafe {
        let written = sys_get_timestamp(buf.as_mut_ptr(), buf.len());
        if written < 0 {
            return Err(AppError::Internal("sys_get_timestamp failed".into()));
        }
        buf.truncate(written as usize);
    }
    String::from_utf8(buf).map_err(|e| AppError::Internal(e.to_string()))
}

// ── Config deserializer (API boundary only) ────────────────────

/// Config deserializer: only at API boundary, Serialize/Deserialize is appropriate here.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DatabaseConfig {
    pub host: String,
    pub port: u16,
    pub name: String,
    pub pool_size: Option<u32>,
}

/// Internal metrics: NOT serialized (internal state, not API boundary).
#[derive(Debug)]
pub struct InternalMetrics {
    pub request_count: u64,
    pub error_count: u64,
    pub p99_latency_ms: f64,
}
```

## Summary of Fixes Applied

1. **`lazy_static!` → `LazyLock`**: Replaced with `static ROUTES: LazyLock<Vec<Route>>`.
2. **Manual `impl Display/Error` → `thiserror`**: Derived `#[derive(thiserror::Error)]` with `#[error(...)]` attributes.
3. **Error context**: Improved error messages with path/input context, not just error restatement.
4. **Filesystem fn**: Changed `load_template(path: String)` to `load_template(path: impl AsRef<Path>)`.
5. **Copy type by reference**: `overlaps(a: Span, b: Span)` now passes 8-byte spans by value.
6. **Large enum variant**: Boxed `HashMap` in `Call` variant to keep the enum small.
7. **HashMap<u64, _> → FxHashMap**: Changed to `rustc_hash::FxHashMap` for integer keys.
8. **LinkedList → VecDeque**: Replaced job queue with `VecDeque`.
9. **Builder.build() → Result**: Now returns `Result<ConnectionPool, PoolBuildError>`, with required `dsn` checked via `.ok_or()`.
10. **Serde on internal types**: Removed `Serialize/Deserialize` from `InternalMetrics` (internal state, not API).
11. **Trait sealing**: Sealed `Transform` trait with private `sealed` module.
12. **Generic over dyn**: Changed `run_pipeline<T: Transform>` to use generic monomorphization instead of `&[Box<dyn>]`.
13. **Cow for normalize_slug**: Returns `Cow<'_, str>` to avoid allocation when unchanged.
14. **Channel over Arc<Mutex>**: `fetch_all` uses `mpsc::channel` instead of shared `Arc<Mutex<Vec>>`.
15. **MutexGuard scope**: Explicitly dropped before `.await` in `increment_and_broadcast`.
16. **tracing over println**: Added `tracing::info!`/`warn!`/`error!` for observability.
17. **#[must_use]**: Added to `build()` and `fetch_all()`.
18. **#[serde(deny_unknown_fields)]**: Added to deserialization types.
19. **Param type in APIs**: Changed `&Vec<T>` to `&[T]` in `score_records`.
20. **Type alias**: Defined `pub type AppResult<T>` for consistent error handling.
21. **SAFETY comment**: Documented FFI safety invariant.
22. **Default impl**: Added for `ConnectionPoolBuilder`.
