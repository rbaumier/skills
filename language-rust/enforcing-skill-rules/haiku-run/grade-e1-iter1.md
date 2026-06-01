# Grade — language-rust eval 1, iteration 1

Code graded: `out-e1-iter1.md` against `assertions-e1.json`. STRICT: PASS only if the violation is clearly corrected in the real code (with citation). FAIL on absence or doubt.

| # | Assertion ID | Verdict | Evidence (cite) |
|---|---|---|---|
| 1 | lazylock-not-lazy-static | FAIL | Requires `std::sync::LazyLock`. Code uses `OnceLock` (L4 `use std::sync::OnceLock;`, L16-17 `static ROUTES: OnceLock<Vec<Route>>` + `get_or_init`). Avoids `lazy_static!` but does NOT use the required `LazyLock`. |
| 2 | thiserror-derive-error | FAIL | Requires `#[derive(thiserror::Error)]`. Code keeps manual impls: L80-89 `impl fmt::Display for AppError`, L91 `impl std::error::Error for AppError {}`. The exact violation is uncorrected. |
| 3 | cow-for-normalize-slug | PASS | L222 `pub fn normalize_slug(input: &str) -> std::borrow::Cow<'_, str>`; returns `Cow::Borrowed`/`Cow::Owned` (L229, L231). |
| 4 | asref-path-load-template | FAIL | Requires `impl AsRef<Path>`. Code: L239 `pub fn load_template(path: &str) -> AppResult<String>`. Still `&str`. |
| 5 | context-explains-why | FAIL | Requires WHY + path. Code: L241 `AppError::Internal(format!("read failed: {e}"))` — describes WHAT, no path. |
| 6 | channels-not-arc-mutex-vec | PASS | L248-268: `mpsc::channel`, `tx.send(body)`, `rx.recv()` collect loop. No `Arc<Mutex<Vec>>`. |
| 7 | no-unwrap-in-spawned-tasks | PASS | L255-256 use `if let Ok(resp) = reqwest::get(...)` / `if let Ok(body) = resp.text()`. No `unwrap()` in the spawned task. |
| 8 | drop-guard-before-await | PASS | L283-289: atomic `fetch_add` instead of a Mutex; no `MutexGuard` is held across `tokio::time::sleep().await`. |
| 9 | arena-not-arc-mutex-ast | PASS | L113-150: `AstArena { nodes: Vec<AstNodeData> }`, `NodeId(usize)` index references; no `Arc<Mutex<AstNode>>`. |
| 10 | box-large-enum-variant | FAIL | Requires the HashMap variant Boxed. Code L106-110 `Call { callee: Box<Expr>, args: Vec<Expr>, source_map: HashMap<String, Span> }` — `source_map` HashMap is inlined, not boxed. |
| 11 | fast-hasher-integer-keys | FAIL | Requires FxHashMap/AHashMap. Code L296 `-> HashMap<u64, usize>` (std `HashMap` from L2, SipHash). Comment L295 claims "FxHashMap" but the type is the default `HashMap`. |
| 12 | vec-not-linkedlist | FAIL | Requires `build_job_queue` to use VecDeque/Vec. The function is entirely ABSENT from the output (present in prompt-e1.txt L245 returning `LinkedList<Job>`, dropped in the fix). No corrected function to cite. |
| 13 | slice-not-vec-ref | PASS | L319 `pub fn score_records(records: &[RawRecord], max_score: f64)` — `&[RawRecord]`, not `&Vec`. |
| 14 | with-capacity-score-records | PASS | L320-326 uses iterator chain `.iter().map(...).collect()` (allocation pre-sized via collect from sized iterator), satisfying the with_capacity-or-iterator-chain requirement. |
| 15 | iterator-chain-score-records | PASS | L320-326 `records.iter().map(|r| ScoredRecord {...}).collect()` — iterator chain, no manual push loop. |
| 16 | unsafe-safety-comment | PASS | L343-344 `// SAFETY: sys_get_timestamp writes at most buf.len() bytes...` directly above the `unsafe` block L345. |
| 17 | builder-returns-result | FAIL | Requires `build() -> Result`. Code L210-216 `pub fn build(self) -> ConnectionPool` with `self.dsn.unwrap_or_default()` — no Result, missing `dsn` silently defaults. |
| 18 | serde-deny-unknown-fields | PASS | L358-360: `DatabaseConfig` has `#[serde(deny_unknown_fields)]`. |
| 19 | serde-not-on-internal-types | FAIL | Requires InternalMetrics NOT to derive Serde. Code L368 `#[derive(Debug, Serialize, Deserialize)] pub struct InternalMetrics`. Still derives both. |
| 20 | copy-small-type-span | FAIL | Requires `overlaps()` to take `Span` by value. Code L39 `pub fn overlaps(&self, other: &Span) -> bool` — still `&Span` by reference. (Copy is derived L31, but the by-value param is not done.) |
| 21 | generic-pipeline-hot-path | FAIL | Requires generic `T: Transform`. Code L165 `pub fn run_pipeline(stages: &[Box<dyn Transform>], ...)` — dynamic dispatch retained. |
| 22 | must-use-on-builder | PASS | L209 `#[must_use]` on `build()`. |
| 23 | sealed-transform-trait | FAIL | Requires sealed trait. Code L160 `pub trait Transform: Send + Sync` — public, no private sealing supertrait. |

**Passed: 11 / 23**

Fails: lazylock-not-lazy-static, thiserror-derive-error, asref-path-load-template, context-explains-why, box-large-enum-variant, fast-hasher-integer-keys, vec-not-linkedlist, builder-returns-result, serde-not-on-internal-types, copy-small-type-span, generic-pipeline-hot-path, sealed-transform-trait.
