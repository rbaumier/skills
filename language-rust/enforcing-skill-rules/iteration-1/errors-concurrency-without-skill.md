# Refactored Rust: Error Handling & Async Patterns

```rust
use std::sync::Arc;
use tokio::sync::Mutex; // Changed: tokio::sync::Mutex is .await-safe
use tokio::fs;
use tracing; // Changed: structured logging instead of println

// Library error type — unchanged, this is fine
#[derive(Debug)]
enum DbError {
    Connection(String),
    Query(String),
    NotFound,
}

impl std::fmt::Display for DbError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            DbError::Connection(s) => write!(f, "connection: {}", s),
            DbError::Query(s) => write!(f, "query: {}", s),
            DbError::NotFound => write!(f, "not found"),
        }
    }
}

impl std::error::Error for DbError {}

// Changed: Application-level error with thiserror for context propagation.
// Box<dyn Error> erases type info — callers can't match on variants.
// thiserror gives typed, contextual errors at zero cost.
#[derive(Debug, thiserror::Error)]
enum AppError {
    #[error("failed to load user {user_id}")]
    LoadUser {
        user_id: u64,
        #[source]
        source: DbError,
    },

    #[error("failed to read config")]
    ConfigRead(#[from] std::io::Error),

    #[error("failed to parse config")]
    ConfigParse(#[from] ConfigParseError), // whatever parse_config returns

    #[error("batch processing failed")]
    BatchProcessing(#[source] Box<dyn std::error::Error + Send + Sync>),
}

// Changed: Returns typed AppError with context instead of Box<dyn Error>
async fn load_user(db: &Database, id: u64) -> Result<User, AppError> {
    // Changed: .map_err adds context — "what were we doing when this failed?"
    let user = db
        .query_user(id)
        .map_err(|e| AppError::LoadUser { user_id: id, source: e })?;

    let config = fs::read_to_string("config.toml").await?; // auto-converted via #[from]
    let _settings = parse_config(&config)?;
    Ok(user)
}

// Changed: tokio::sync::Mutex + spawn_blocking for CPU work + no guard held across .await
async fn process_batch(items: Vec<Item>) -> Result<(), AppError> {
    let results = Arc::new(Mutex::new(Vec::new())); // Changed: tokio Mutex, safe across .await

    for item in &items {
        // Changed: Offload CPU-bound work to blocking threadpool.
        // spawn_blocking prevents starving the async runtime.
        let computed = tokio::task::spawn_blocking(move || heavy_computation(item))
            .await
            .map_err(|e| AppError::BatchProcessing(e.into()))?;

        // Changed: .lock().await (tokio Mutex) — no unwrap, no panic.
        // tokio::sync::Mutex::lock is infallible (returns MutexGuard, not Result),
        // so no error handling needed here — it simply awaits until the lock is acquired.
        results.lock().await.push(computed);
    }

    // Changed: Drop the guard BEFORE the .await point.
    // Holding a MutexGuard across .await causes the future to be !Send,
    // which breaks tokio::spawn and can deadlock.
    let count = {
        let guard = results.lock().await;
        guard.len()
    }; // guard dropped here, before the .await below

    some_async_operation().await;

    // Changed: tracing instead of println — structured, filterable, async-friendly
    tracing::info!(count, "batch processing complete");

    Ok(())
}

// Changed: Explicitly handle the Result instead of silently discarding it with `let _ =`
fn maybe_fail() -> Result<(), DbError> {
    // Changed: Propagate the error. `let _ =` silently swallows failures —
    // if do_something_important() fails, the caller never knows.
    // If you truly want to ignore it, use an explicit comment:
    //   let _ = do_something_important(); // intentionally ignored: <reason>
    do_something_important()?;
    Ok(())
}
```

## Summary of changes

| Problem | Fix | Why |
|---|---|---|
| `Box<dyn Error>` return types | `thiserror` enum with `#[source]` | Typed errors let callers match; `#[source]` chains cause |
| No context on `?` | `.map_err` with domain variant | Error messages answer "what were we doing?" |
| `std::sync::Mutex` in async | `tokio::sync::Mutex` | `.await`-safe, no `Send` bound issues |
| `MutexGuard` held across `.await` | Scoped block drops guard before `.await` | Prevents `!Send` futures and potential deadlocks |
| `.lock().unwrap()` | `tokio::sync::Mutex::lock().await` (infallible) | No panic path in production |
| CPU work on async thread | `spawn_blocking` | Prevents starving the tokio executor |
| `println!` in async | `tracing::info!` | Structured, non-blocking, filterable |
| `let _ = do_something_important()` | Propagate with `?` | Silent swallowing hides failures |
