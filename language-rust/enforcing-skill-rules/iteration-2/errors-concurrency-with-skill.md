# Refactored Code

```rust
use tokio::sync::mpsc;
use tokio::fs;
use tracing::info;

// -- Application-level error with thiserror (not manual Display impl) --

#[derive(Debug, thiserror::Error)]
enum AppError {
    #[error("database connection: {0}")]
    Connection(String),
    #[error("database query: {0}")]
    Query(String),
    #[error("not found")]
    NotFound,
    #[error("config: {0}")]
    Config(#[from] std::io::Error),
    #[error("parse: {0}")]
    Parse(#[from] ParseError), // assuming ParseError exists
}

// -- load_user: .context() for why, not what; remove unused binding --

async fn load_user(db: &Database, id: u64) -> Result<User, AppError> {
    let user = db.query_user(id)?;
    // Cancellation-safe: if cancelled here, no owned resources leak.
    let config = fs::read_to_string("config.toml")
        .await
        .context("reading config for user settings")?;
    let _settings = parse_config(&config)?; // was unused — prefixed with _
    Ok(user)
}

// -- process_batch: channels over Arc<Mutex<Vec>>, spawn_blocking for CPU work --

async fn process_batch(items: Vec<Item>) -> Result<(), AppError> {
    let (tx, mut rx) = mpsc::channel(items.len());

    for item in items {
        let tx = tx.clone();
        // Offload CPU-bound work off the async runtime
        tokio::task::spawn_blocking(move || {
            let computed = heavy_computation(&item);
            // send is sync inside spawn_blocking; blocking_send is fine
            let _ = tx.blocking_send(computed);
        });
    }
    // Drop original sender so rx completes when all tasks finish
    drop(tx);

    // Collect results via channel — no mutex, no guard across .await
    let mut results = Vec::with_capacity(items.len());
    while let Some(result) = rx.recv().await {
        results.push(result);
    }

    // Cancellation note: if cancelled during recv(), spawned tasks
    // will finish independently; channel drops cleanly. No resource leak.
    some_async_operation().await?;
    info!(count = results.len(), "processed batch"); // tracing, not println!
    Ok(())
}

// -- maybe_fail: propagate errors, don't silently discard with `let _ =` --

fn maybe_fail() -> Result<(), AppError> {
    do_something_important()?; // propagate instead of silently ignoring
    Ok(())
}
```

## Changes applied

| Issue | Before | After | Rule |
|---|---|---|---|
| Manual `Display`/`Error` impls | Hand-rolled boilerplate | `thiserror` derive | `thiserror` for libs, `anyhow` for apps |
| `Box<dyn Error>` return types | Erased, unrecoverable | Concrete `AppError` enum | Errors are values |
| Unused `settings` binding | Assigned, never used | `_settings` (explicit ignore) | No orphans |
| `Arc<Mutex<Vec>>` for results | Shared mutable state | `mpsc::channel` collect pattern | Channels over shared state |
| CPU work on async runtime | `heavy_computation` blocks executor | `spawn_blocking` | Never block async runtime |
| `MutexGuard` held across `.await` | Deadlock risk | Eliminated — no mutex at all | Drop guard before `.await` |
| `println!` in async code | Unstructured output | `tracing::info!` | Structured logging, no `println!` |
| `let _ = do_something_important()` | Silently discards error | Propagated with `?` | Ignore only with explicit intent |
| No cancellation documentation | Silent resource leak risk | Comments at `.await` points | Cancellation safety |
