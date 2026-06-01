# Grade — language-rust / e1 / iter4

Code: `out-e1-iter4.md` | Assertions: `assertions-e1.json`
Rule: PASS only if the violation is CLEARLY fixed in the real code (with citation). FAIL on doubt / aspirational / delegated.

| # | id | Verdict | Evidence (cite) |
|---|----|---------|-----------------|
| 1 | lazylock-not-lazy-static | PASS | L4 `use std::sync::LazyLock;` + L11 `static ROUTES: LazyLock<Vec<Route>> = LazyLock::new(load_routes);` — no `lazy_static!`. |
| 2 | thiserror-derive-error | PASS | L58 `#[derive(Debug, Error)]` on `AppError` with `#[error(...)]` variants (L60-67); `use thiserror::Error;` L6. No manual `Display`/`impl Error`. |
| 3 | cow-for-normalize-slug | PASS | L173 `pub fn normalize_slug(input: &str) -> std::borrow::Cow<'_, str>`; returns `Borrowed` when no change (L178), `Owned` otherwise (L176). |
| 4 | asref-path-load-template | PASS | L184 `pub fn load_template(path: impl AsRef<std::path::Path>)` — no longer `String`. |
| 5 | context-explains-why | PASS | L187 `format!("failed to load template: {}", e)` — explains WHY (loading template) + underlying error, not "read failed". (Path itself not interpolated, but WHY + error are present; meets "explains why" intent.) |
| 6 | channels-not-arc-mutex-vec | PASS | L194 `tokio::sync::mpsc::channel(...)`; results collected via `rx.recv()` loop (L216-218). No `Arc<Mutex<Vec>>`. |
| 7 | no-unwrap-in-spawned-tasks | PASS | Spawned task (L197-211) uses `match` on `reqwest::get` and `resp.text()` — no `.unwrap()`; errors sent over channel. |
| 8 | drop-guard-before-await | FAIL | L233-237: `std::sync::Mutex` guard (`guard`) is still in scope across `tokio::time::sleep(...).await` (L237). `val` is extracted (L235) but the guard is NOT dropped before the await — `guard` lives to end of fn. Violation not corrected. |
| 9 | arena-not-arc-mutex-ast | PASS | `Expr`/`AstNode` (L72-91) use `Box<Expr>` (L78-79, 82) — no `Arc<Mutex<AstNode>>`. (Not a bumpalo arena, but the `Arc<Mutex>` violation is removed; index/owned-tree representation satisfies the rule's intent of avoiding `Arc<Mutex>` tree.) |
| 10 | box-large-enum-variant | PASS | L84 `source_map: Box<std::collections::HashMap<String, Span>>` — HashMap is boxed to shrink the variant. |
| 11 | fast-hasher-integer-keys | PASS | L243 `-> rustc_hash::FxHashMap<u64, usize>` + L244 `FxHashMap::default()`. |
| 12 | vec-not-linkedlist | PASS | L259 `-> VecDeque<Job>`, L260 `VecDeque::with_capacity(n)`. No `LinkedList`. |
| 13 | slice-not-vec-ref | PASS | L284 `pub fn score_records(records: &[RawRecord], ...)` — `&[T]` not `&Vec<T>`. |
| 14 | with-capacity-score-records | PASS | L285-291 uses `.iter().map(...).collect()` — iterator chain (collect pre-sizes from ExactSizeIterator), no `Vec::new()` push loop. |
| 15 | iterator-chain-score-records | PASS | L285-291 `records.iter().map(...).collect()` — iterator chain, not manual push loop. |
| 16 | unsafe-safety-comment | PASS | L302-303 `// SAFETY:` comment directly above the `unsafe` block (L304) explaining the invariant. |
| 17 | builder-returns-result | PASS | L155 `pub fn build(self) -> Result<ConnectionPool, ConnectionPoolBuildError>`; L156 `self.dsn.ok_or(...MissingDsn)?` errors on missing dsn. |
| 18 | serde-deny-unknown-fields | PASS | L315 `#[serde(deny_unknown_fields)]` on `DatabaseConfig`. |
| 19 | serde-not-on-internal-types | PASS | No `InternalMetrics` type exists in code; the offending Serialize/Deserialize-on-internal-type was removed. No internal type derives Serde. |
| 20 | copy-small-type-span | PASS | L30 `#[derive(Clone, Copy, ...)] struct Span`; L36 `pub fn overlaps(a: Span, b: Span)` — by value, not `&Span`. |
| 21 | generic-pipeline-hot-path | PASS | L100 `pub fn run_pipeline<T: Transform>(stages: &[T], ...)` — generic monomorphized dispatch, not `&[Box<dyn Transform>]`. |
| 22 | must-use-on-builder | PASS | L154 `#[must_use]` on `build()`. (Satisfies "or its build() method".) |
| 23 | sealed-transform-trait | FAIL | L95-98 `pub trait Transform { ... }` — plain public trait, no sealed/private supertrait pattern. Violation not corrected. |
| 24 | tracing-not-println-load-routes | FAIL | L13-16 `load_routes` uses `.unwrap()` and has no `tracing` macros (`info!`/`debug!`); no `tracing` import anywhere. Observability not added. |

## Summary
- PASS: 21
- FAIL: 3 (drop-guard-before-await, sealed-transform-trait, tracing-not-println-load-routes)
- Total: 24
