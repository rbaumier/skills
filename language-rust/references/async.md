# Async: cancellation and cancel-safety

Load when writing or reviewing `select!`, timeouts, shutdown paths, or task cancellation. Companion to con-5/con-7.

## The model: cancellation is Drop

A future does nothing until polled and dies when dropped. Cancelling a task means dropping its future at whatever `.await` it was parked on. Consequences:

- Every `.await` is a potential last line of the function.
- Side effects before the drop persist; code after it never runs — including cleanup, unless it lives in `Drop`.
- `select!` drops every non-winning branch's future, every iteration.
- `timeout(dur, fut)` that fires drops `fut` — a non-cancel-safe `fut` loses its partial progress.

## Cancel-safety: "dropping this future mid-flight loses nothing"

Cancel-safe — usable directly as a `select!` branch:

- `mpsc::Receiver::recv` / `mpsc::Sender::send` — the message stays in (or never left) the queue
- `watch::Receiver::changed`, `broadcast::Receiver::recv`
- `TcpListener::accept`
- `AsyncReadExt::read` (nothing consumed if cancelled), `Lines::next_line`
- `tokio::sync::Mutex::lock` — the lock is not taken
- `sleep` / `interval.tick`

NOT cancel-safe — partial state is lost on drop:

- `read_exact`, `read_to_end`, `read_line`, `read_until` — bytes already consumed vanish
- `write_all` — some bytes may already be written
- `Notify::notified()` recreated each loop iteration — a notify between iterations is missed
- Any hand-written future keeping partial progress in locals

Fixes when a non-cancel-safe op must coexist with `select!`:

- Pin the future ONCE outside the loop (`tokio::pin!`) and poll `&mut fut` in the branch — progress survives losing iterations.
- Move the op into its own task; `select!` on a channel from it instead.
- Keep partial state (buffers, counters) outside the future, e.g. in a struct field.

## select! discipline

- Polling order is random by default (fairness); `biased;` makes it top-down — use it when priority matters, shutdown branch first.
- A branch recreating its future each iteration restarts from scratch — see pinning above.
- A completed future must not be polled again: `.fuse()` or an `Option`-guarded branch.

## Shutdown pattern

`CancellationToken` (tokio-util) → tasks `select!` on `token.cancelled()` → orchestrator calls `token.cancel()`, joins the `JoinSet`, then flushes tracing. Tasks check the token BETWEEN units of work, never inside one.
