# Grade: language-rust / e1 / iter3

Code graded: `out-e1-iter3.md` against `assertions-e1.json`. STRICT — PASS only if violation is clearly corrected in real code (cited).

| # | id | verdict | evidence (line) |
|---|-----|---------|-----------------|
| 1 | lazylock-not-lazy-static | PASS | L10-11 `static ROUTES: std::sync::LazyLock<Vec<Route>> = std::sync::LazyLock::new(load_routes);` — no `lazy_static!`. |
| 2 | thiserror-derive-error | PASS | L60 `#[derive(Debug, thiserror::Error)]` with `#[error(...)]` attrs L62-68; no manual Display/Error impl on AppError. |
| 3 | cow-for-normalize-slug | PASS | L186 `pub fn normalize_slug(input: &str) -> Cow<'_, str>`; borrows when unchanged (L191 `Cow::Borrowed`), owns when modified (L189 `Cow::Owned`). |
| 4 | asref-path-load-template | PASS | L197 `pub fn load_template(path: impl AsRef<std::path::Path>) -> AppResult<String>`. |
| 5 | context-explains-why | PASS | L199-203 error msg `"failed to load template from {}: {}"` includes WHY + path via `path.as_ref().display()`. |
| 6 | channels-not-arc-mutex-vec | PASS | L210 `tokio::sync::mpsc::channel(urls.len())`; results collected via `rx.recv()` L236; no Arc<Mutex<Vec>>. |
| 7 | no-unwrap-in-spawned-tasks | PASS | Spawned task L214-228 uses `match` on `reqwest::get` and `resp.text()`, logs errors, no `.unwrap()`. |
| 8 | drop-guard-before-await | PASS | L253-257 guard scoped in block, `val` extracted, guard dropped before `tx.send` (L258) and `sleep().await` (L259). |
| 9 | arena-not-arc-mutex-ast | FAIL | L92-97 `AstNode` still uses `Option<Arc<Mutex<AstNode>>>` parent and `Vec<Arc<Mutex<AstNode>>>` children — no arena/index-based refs. |
| 10 | box-large-enum-variant | PASS | L88 `source_map: Box<std::collections::HashMap<String, Span>>` — HashMap boxed in Call variant. |
| 11 | fast-hasher-integer-keys | PASS | L265 returns `rustc_hash::FxHashMap<u64, usize>`, built with `FxHashMap::default()` L266. |
| 12 | vec-not-linkedlist | PASS | L280 `build_job_queue(n: usize) -> VecDeque<Job>`; uses `VecDeque::with_capacity` — no LinkedList. |
| 13 | slice-not-vec-ref | PASS | L303 `score_records(records: &[RawRecord], ...)` — slice, not `&Vec`. |
| 14 | with-capacity-score-records | PASS | L304-310 iterator chain `.iter().map().collect()` — collect pre-sizes from slice; no `Vec::new()` push loop. |
| 15 | iterator-chain-score-records | PASS | L304-310 `records.iter().map(...).collect()` — iterator chain, no manual push loop. |
| 16 | unsafe-safety-comment | PASS | L321-323 `// SAFETY:` comment explaining buffer write bounds + return-value truncation above `unsafe` block L324. |
| 17 | builder-returns-result | PASS | L166 `pub fn build(self) -> Result<ConnectionPool, BuildError>`; L167 `dsn.ok_or(BuildError { missing: "dsn" })?`. |
| 18 | serde-deny-unknown-fields | PASS | L337 `#[serde(deny_unknown_fields)]` on DatabaseConfig L338. |
| 19 | serde-not-on-internal-types | PASS | L345-346 `InternalMetrics` derives only `#[derive(Debug)]` — no Serialize/Deserialize. |
| 20 | copy-small-type-span | PASS | L30 `#[derive(... Copy ...)] Span`; L37 `pub fn overlaps(a: Span, b: Span) -> bool` — by value. |
| 21 | generic-pipeline-hot-path | PASS | L106 `pub fn run_pipeline<T: Transform>(stages: &[T], ...)` — generic, not `&[Box<dyn Transform>]`. |
| 22 | must-use-on-builder | PASS | L165 `#[must_use]` on `build()`. |
| 23 | sealed-transform-trait | FAIL | L101 `pub trait Transform: Send + Sync` — no private/sealed supertrait; anyone can impl. |
| 24 | tracing-not-println-load-routes | FAIL | No `tracing` macros anywhere. `load_routes` (L13-16) is silent + `.unwrap()`; spawned-task errors use `eprintln!` (L221, L224), not tracing. |

## Summary

- Passed: 21
- Failed: 3 — `arena-not-arc-mutex-ast`, `sealed-transform-trait`, `tracing-not-println-load-routes`
- Total: 24
