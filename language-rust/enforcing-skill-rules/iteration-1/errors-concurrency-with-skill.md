# Refactored Rust: Error Handling & Async Patterns

```rust
use std::sync::Arc;
use tokio::sync::Mutex; // tokio::sync::Mutex instead of std::sync::Mutex — safe across .await
use tokio::fs;
use thiserror::Error;
use tracing::info; // structured logging replaces println! in async code

// --- Library layer: thiserror for precise, derivable error types ---

#[derive(Debug, Error)]
enum DbError {
    #[error("connection: {0}")]
    Connection(String),
    #[error("query: {0}")]
    Query(String),
    #[error("not found")]
    NotFound,
}

// --- Application layer: anyhow for contextual error propagation ---

use anyhow::{Context, Result};

/// .context() on every fallible call explains *why* it failed, not just *what*.
async fn load_user(db: &Database, id: u64) -> Result<User> {
    let user = db
        .query_user(id)
        .context(format!("failed to load user {id}"))?;

    let config = fs::read_to_string("config.toml")
        .await
        .context("failed to read config.toml")?;

    let _settings = parse_config(&config)
        .context("failed to parse config.toml")?;

    Ok(user)
}

/// Offload CPU work to spawn_blocking; use tokio::sync::Mutex with minimal guard scope.
async fn process_batch(items: Vec<Item>) -> Result<()> {
    let results = Arc::new(Mutex::new(Vec::with_capacity(items.len()))); // pre-allocate

    // Spawn blocking tasks for CPU-heavy work — never block the async runtime
    let mut handles = Vec::with_capacity(items.len());
    for item in items {
        let results = Arc::clone(&results);
        let handle = tokio::task::spawn_blocking(move || heavy_computation(&item))
            .then(|res| {
                let results = results.clone();
                async move {
                    let computed = res.context("blocking task panicked")?;
                    results.lock().await.push(computed); // tokio Mutex — no unwrap
                    Ok::<_, anyhow::Error>(())
                }
            });
        handles.push(handle);
    }

    // Await all tasks
    for handle in handles {
        handle.await?;
    }

    // Scope the MutexGuard tightly — drop it BEFORE any .await
    let count = {
        let guard = results.lock().await;
        guard.len()
        // guard dropped here
    };

    some_async_operation().await?;

    // tracing instead of println! — structured, filterable, async-safe
    info!(count, "batch processing complete");

    Ok(())
}

/// Never silently discard Results — propagate or handle explicitly.
fn maybe_fail() -> Result<(), DbError> {
    do_something_important()?; // propagate error instead of `let _ =`
    Ok(())
}
```

## Changes applied

1. **`thiserror` for library errors** — Replaces manual `Display`/`Error` impls with `#[derive(Error)]`. Less boilerplate, same zero-cost output.

2. **`anyhow::Result` for application code** — Replaces `Box<dyn std::error::Error>`. Every `?` call gets `.context()` explaining *why* it failed, producing a full causal chain on error.

3. **`tokio::task::spawn_blocking` for CPU work** — `heavy_computation` was blocking the async executor thread. Offloaded to the blocking threadpool where it belongs.

4. **`tokio::sync::Mutex` replaces `std::sync::Mutex`** — The std Mutex cannot be held across `.await` points (causes deadlocks). The tokio Mutex is designed for this. Guard scope is also minimized: the lock is dropped before the next `.await`.

5. **No `unwrap()` in production** — `Mutex::lock()` errors and task join errors are propagated with `?` and `.context()` instead of panicking.

6. **`tracing::info!` replaces `println!`** — Structured logging is filterable, includes span context, and integrates with async runtimes. `println!` blocks on stdout and loses context.

7. **`let _ = do_something_important()` fixed** — Silently discarding a `Result` hides failures. Now propagated with `?`.

8. **`Vec::with_capacity`** — Pre-allocates when the size is known, avoiding repeated reallocations.
