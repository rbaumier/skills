# Grade — language-rust / e1 / iter2

STRICT grading. PASS only if the violation is clearly corrected in the real code (with citation). FAIL on doubt, aspirational, or delegated.

| # | id | verdict | citation / reason |
|---|----|---------|-------------------|
| 1 | lazylock-not-lazy-static | PASS | L9 `static ROUTES: LazyLock<Vec<Route>> = LazyLock::new(load_routes);` — std::sync::LazyLock, no lazy_static! anywhere. |
| 2 | thiserror-derive-error | PASS | L57 `#[derive(Debug, thiserror::Error)]` on `AppError`; `#[error(...)]` on each variant (L59-66). No manual Display/Error impl. |
| 3 | cow-for-normalize-slug | PASS | L181 `pub fn normalize_slug(input: &str) -> std::borrow::Cow<'_, str>`; borrows when unchanged (L186), owns when modified (L184). |
| 4 | asref-path-load-template | PASS | L192 `pub fn load_template(path: impl AsRef<std::path::Path>)`. |
| 5 | context-explains-why | PASS | L196 `format!("failed to load template from {}: {}", path_display, e)` — WHY + path. |
| 6 | channels-not-arc-mutex-vec | PASS | L203 `tokio::sync::mpsc::channel(...)`; tasks send via `tx` (L211), collected via `rx.recv()` (L229). No Arc<Mutex<Vec>>. |
| 7 | no-unwrap-in-spawned-tasks | PASS | L207-221 spawned task uses `match` on both `reqwest::get` and `.text()`; errors handled with eprintln, no `.unwrap()`. |
| 8 | drop-guard-before-await | PASS | L246-249 lock, extract `val`, `drop(guard)` BEFORE `tx.send` and `sleep().await` (L251). |
| 9 | arena-not-arc-mutex-ast | FAIL | L88-92 `AstNode` still uses `Option<Arc<AstNode>>` (parent) and `Vec<Arc<AstNode>>` (children). No arena/index-based references. |
| 10 | box-large-enum-variant | PASS | L83 `source_map: Box<std::collections::HashMap<String, Span>>` — Boxed. |
| 11 | fast-hasher-integer-keys | PASS | L257 returns `rustc_hash::FxHashMap<u64, usize>`; L258 `FxHashMap::default()`. |
| 12 | vec-not-linkedlist | PASS | L272 `build_job_queue(n: usize) -> VecDeque<Job>`; no LinkedList. |
| 13 | slice-not-vec-ref | PASS | L295 `score_records(records: &[RawRecord], ...)`. |
| 14 | with-capacity-score-records | PASS | L296-302 iterator chain `.iter().map(...).collect()` (assertion accepts with_capacity OR iterator chain). |
| 15 | iterator-chain-score-records | PASS | L296-302 `records.iter().map(...).collect()` — no manual push loop. |
| 16 | unsafe-safety-comment | PASS | L314-316 `// SAFETY: ...` explains length/pointer invariant before the FFI call. |
| 17 | builder-returns-result | PASS | L163 `build(self) -> Result<ConnectionPool, ConnectionPoolBuildError>`; L164 `self.dsn.ok_or(MissingDsn)?` errors on missing required field. |
| 18 | serde-deny-unknown-fields | PASS | L329 `#[serde(deny_unknown_fields)]` on `DatabaseConfig`. |
| 19 | serde-not-on-internal-types | FAIL | `InternalMetrics` type is entirely absent from the code; nothing to cite as a corrected internal type. Cannot confirm correction (doubt → FAIL per strict rule). |
| 20 | copy-small-type-span | PASS | L28 `#[derive(Clone, Copy, Debug, ...)]` Span; L34 `overlaps(a: Span, b: Span)` by value. |
| 21 | generic-pipeline-hot-path | PASS | L101 `run_pipeline<T: Transform>(stages: &[T], data: &[f64])` — static dispatch, not `&[Box<dyn Transform>]`. |
| 22 | must-use-on-builder | PASS | L162 `#[must_use]` on `build()`. |
| 23 | sealed-transform-trait | FAIL | L96 `pub trait Transform: Send + Sync` has no private/sealed supertrait; any downstream crate can impl it. Not sealed. |
| 24 | tracing-not-println-load-routes | FAIL | No `tracing` macros anywhere; `load_routes` (L11-14) is silent and `unwrap()`s, `fetch_all` uses `eprintln!` (L214, L218). No structured logging. |

**Summary: 20 PASS / 24 — FAILS: arena-not-arc-mutex-ast, serde-not-on-internal-types, sealed-transform-trait, tracing-not-println-load-routes**
