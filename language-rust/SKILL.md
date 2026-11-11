---
name: language-rust
description: Use when writing, reviewing, or refactoring Rust — ownership, lifetimes, type-driven design, async, error handling, FFI, and performance.
---

Make invalid states unrepresentable — bugs must not compile. Panics are for bugs; `Result` is for runtime conditions. Rule IDs (`num-1`, `rev-2`…) are stable — cite them in review findings.

## Types & Public API

- **api-1 — Parse, don't validate.** Newtypes (`struct Email(String)`) guarantee validity post-construction: private field, no infallible `From<raw>`; `new`, `FromStr`, `TryFrom`, `Deserialize` (`#[serde(try_from = "String")]`) and `sqlx::Decode` all go through one validator. Prefer stdlib invariant types over hand-rolled ones: `NonZeroU32` for counts and divisors (`Option<NonZeroU32>` stays 4 bytes).
- **api-2 — Typestate for compile-time state machines** — `Builder<Pending>` → `Builder<Ready>`; invalid transitions don't compile.
- **api-3 — Builder `build()` returns `Result`.** Required fields are `Option` internally; `build()` errors when one is missing. Never `unwrap_or_default()` a required field — that silently ships a broken value:
  ```rust
  // WRONG: pub fn build(self) -> Pool { Pool { dsn: self.dsn.unwrap_or_default(), .. } }
  // RIGHT: pub fn build(self) -> Result<Pool, BuildError> {
  //            let dsn = self.dsn.ok_or(BuildError::MissingDsn)?;
  //            Ok(Pool { dsn, max_conns: self.max_conns.unwrap_or(10), .. }) }
  ```
- **api-4 — Seal `pub` traits of published crates.** Any library trait that is not an explicit user extension point gets a *private* supertrait, so adding methods later breaks nobody. Never inside an internal workspace: it blocks test fakes in sibling crates. Adding `Send + Sync` supertraits is NOT sealing:
  ```rust
  mod sealed { pub trait Sealed {} }
  pub trait Transform: sealed::Sealed + Send + Sync { fn apply(&self, x: &[f64]) -> Vec<f64>; }
  impl sealed::Sealed for MyStage {}   // only this crate can
  ```
- **api-5 — `#[must_use]`** on RAII guard types and on pure fns returning `Option` or a value whose drop is a bug — never on fns returning `Result` (already `must_use`).
- **api-6 — Serde only at boundaries.** Internal types (metrics, in-memory state) must NOT derive `Serialize`/`Deserialize` — strip it. Writing or reviewing serde attributes → load `references/serde.md` first.
- **api-7 — Newtypes derive `Clone, Debug, PartialEq, Eq, Hash`**; add `Display` for user-facing types, `FromStr` for parseable ones. Validate at construction, trust downstream.
- **api-8 — Encode invariants deeper** — `PhantomData` to split structurally identical types; zero-sized proof types; `compile_error!` for invalid feature combinations.
- **api-9 — Const-assert auto-traits** on concurrency-facing types:
  ```rust
  const _: () = { fn ok<T: Send + Sync + Sized + Unpin>() {} ok::<MyType>(); };
  ```
- **api-10 — Naming contract**: `as_` borrows (cheap), `to_` allocates (expensive), `into_` consumes. No `get_` prefix on getters.
- **api-11 — Two-variant enum over `bool` params** in public APIs — `Mode::Recursive` reads at the call site; `true` doesn't.
- **api-12 — `#[non_exhaustive]` only on enums and errors of published crates meant to grow** — inside a workspace it forces sibling crates into a `_` arm that silently absorbs new variants; match owned enums exhaustively.
- **api-13 — No `Deref` inheritance.** `impl Deref` to expose an inner domain type's methods fakes inheritance; write delegation methods or a trait.
- **api-14 — Enum↔string derived, never mirrored.** Two hand-written `match` arms mapping one enum to/from strings, or a hand-maintained `const ALL: [T; N]` of variants → strum (`Display`/`EnumString` + `serialize_all`, `VariantArray`), with a test pinning the literals to the wire/DB schema. Adopt strum ONLY where it deletes code — an `IntoStaticStr` + `as_str` façade loses `const` and exhaustiveness for nothing.
- **api-15 — 3rd copy of a newtype impl → one macro/derive.** Identical `FromStr`/`Display`/ctor blocks recopied across id newtypes collapse into a `macro_rules!`/derive — and trivial impls earn no round-trip test. A macro used by other crates writes `$crate::` paths and reaches its deps through a `#[doc(hidden)] pub mod __private` re-export.
- **api-16 — Orphan rule is per crate, not per module.** When domain and infrastructure live in one crate, foreign-trait impls (`sqlx::Type`/`Decode`/`Encode`) go directly on domain types — an `XRow` + `From` mirror per entity is boilerplate, not a boundary. Check the crate layout before claiming "hexagonal frontier".

## Numeric Safety

- **num-1 — Checked arithmetic on external input.** Overflow panics in debug but wraps silently in release. Arithmetic on parsed, user, or wire integers uses `checked_`/`saturating_` (choose deliberately), never bare `+`/`*`:
  ```rust
  // WRONG: let total = qty * unit_price;                    // qty came from the request
  // RIGHT: let total = qty.checked_mul(unit_price).ok_or(PriceError::Overflow)?;
  ```
- **num-2 — `TryFrom`, never `as`, to narrow integers** — `as` truncates silently; widening uses `From`.
- **num-3 — `total_cmp` for float ordering.** `.sort_by(|a, b| a.partial_cmp(b).unwrap())` panics on NaN → `a.total_cmp(b)`. (Float `==` is already caught by pedantic `float_cmp`, ci-2.)
- **num-4 — `clamp` panics in release** when `min > max` or a float bound is NaN — validate bounds from config or the wire first.

## Ownership & Memory

- **own-1 — Copy small types (≤ 24 bytes) by value.** Deriving `Copy` is not enough — the parameters must pass by value too: `fn overlaps(a: Span, b: Span)`, not `&Span`.
- **own-2 — `Cow<'_, str>` for borrow-or-modify.** A fn taking `&str`/`&[T]` that sometimes modifies (normalize, escape, default) returns `Cow`, not an always-allocated `String`:
  ```rust
  // WRONG: fn normalize(s: &str) -> String { if changed { modified } else { s.to_owned() } }
  // RIGHT: fn normalize(s: &str) -> Cow<'_, str> { if changed { Cow::Owned(modified) } else { Cow::Borrowed(s) } }
  ```
- **own-3 — `Cell`/`RefCell` for single-threaded interior mutability** (caches, counters behind `&self`). `Mutex` in single-threaded code is a smell.
- **own-4 — `Weak<T>` for back-references** — parent links via `Rc`/`Arc` leak on cycles.
- **own-5 — Arena + indices for graphs/trees/ASTs.** A pointer web (`Arc<Mutex<Node>>`, `Rc<RefCell<Node>>`) fights the borrow checker and leaks on cycles. Store nodes once in a `Vec` arena; reference by index newtype. Dropping the `Mutex` but keeping a pointer tree is NOT the fix:
  ```rust
  // WRONG: struct AstNode { parent: Option<Arc<Mutex<AstNode>>>, children: Vec<Arc<Mutex<AstNode>>> }
  // RIGHT:
  #[derive(Clone, Copy, PartialEq, Eq)] struct NodeId(usize);
  struct AstNode { expr: Expr, parent: Option<NodeId>, children: Vec<NodeId> }
  struct Ast { nodes: Vec<AstNode> }   // resolve with self.nodes[id.0]; bumpalo for true bump allocation
  ```
- **own-6 — `mem::take`/`replace`/`swap` to move out of `&mut`.** Cloning a field just to satisfy the borrow checker is the wrong fix — take it, transform it, put it back.

## Error Handling

- **err-1 — `thiserror` for libraries and domain code; `anyhow`/`miette` for application shells — never `anyhow` in domain code.** Never hand-write `impl Display` + `impl Error` — `#[derive(Debug, thiserror::Error)]` with `#[error("…")]` per variant.
- **err-2 — Context explains WHY and carries the inputs.** "read failed: {e}" restates the error; name the operation and the path:
  ```rust
  // WRONG: .map_err(|e| AppError::Internal(format!("read failed: {e}")))
  // RIGHT: .with_context(|| format!("failed to load template from {}", path.display()))
  ```
- **err-3 — No `unwrap()` on production paths** — `?`, `unwrap_or_else`, or a typed error; `expect("why it holds")` only for a proven invariant. Ignore an error only with explicit `let _ =` — never `.ok()`, `filter_map(Result::ok)` or `unwrap_or_default()` on an I/O or DB `Result`.
- **err-4 — One `pub type AppResult<T>` alias per crate** — don't repeat `Result<T, AppError>` in every signature.
- **err-5 — Variants name the business problem and carry typed context.** `SchemaMismatch { expected, got }`; never `Other(String)`, `Other(#[from] anyhow::Error)` or a stringly `InvalidRange(String)`. `#[from]` only when the source alone identifies the operation — else `map_err` to a business variant (`fetch_optional` + `.ok_or(NotFound)`, not `fetch_one`'s `RowNotFound` → 500). A `#[from]`/`#[source]` field never appears in its `#[error]` message — the chain already prints it.
- **err-6 — Tools degrade, never crash.** Parsers/linters turn errors into structured diagnostics (code, message, position), resynchronize, and continue. Invalid config → defaults + warning.

## Concurrency & Async

- **con-1 — Never block the async runtime** — CPU work (password hashing, large JSON, compression) goes to `spawn_blocking`; Rayon only inside it or via `rayon::spawn` + `oneshot`, never `par_iter` inline in async code.
- **con-2 — Locks.** `std::sync::Mutex` by default, guard dropped before `.await`; `tokio::sync::Mutex` only when a guard must cross `.await`. Poisoned `lock()` → `unwrap_or_else(PoisonError::into_inner)` when the state stays coherent. Never `read()` an `RwLock` the task already holds — deadlocks once a writer queues. Several locks → document one acquisition order.
- **con-3 — Channels or `JoinSet` results over `Arc<Mutex<Vec>>`** when collecting from tasks.
- **con-4 — Bound every fan-out.** Bounded channels; `join_all` over an unbounded collection → `stream::iter(..).buffer_unordered(n)`, `n` below the DB pool size. A `broadcast` receiver matches `Lagged(n)` → warn and continue; `while let Ok(..) = rx.recv()` dies silently on the first lag.
- **con-5 — `select!` loses data by default.** In a loop, every non-winning branch's future is dropped with its partial progress. Pin long-lived futures outside the loop, add `biased;` when priority matters, keep non-cancel-safe ops out of branches.
- **con-6 — `JoinSet` over loose `tokio::spawn`.** A dropped `JoinHandle` swallows the task's panic; `JoinSet` joins every task and surfaces panics as `JoinError`. Dropping a `JoinSet` aborts its tasks — keep it alive to the last `join_next`.
- **con-7 — Cancellation is Drop.** Cancelling a task = dropping its future at an `.await`; every `.await` holding resources is an exit point — implement `Drop` or document the contract. Writing any `select!`, timeout, or shutdown path → load `references/async.md` (cancel-safety table) first.
- **con-8 — Public async APIs return `Send` futures.** Bound them (`-> impl Future<Output = T> + Send`) or callers can't `tokio::spawn` them — and only you, the library author, can fix it.
- **con-9 — Atomics over `Mutex<bool>`/`Mutex<usize>`.** Using any `Ordering::` beyond a Relaxed counter, or touching lock-free code → load `references/concurrency.md` first.
- **con-10 — `thread::scope` for borrow-only threads** — no `Arc` cloning just to let short-lived threads read local data.
- **con-11 — `tracing`, never `println!`/`eprintln!`.** Structured fields, not format interpolation. Startup and I/O paths must not be silent — record what was loaded, warn on failure. Log an error once, where it is handled, with its whole chain; intermediate layers propagate with `?` + context:
  ```rust
  tracing::info!(count = routes.len(), "loaded routes");
  tracing::warn!(%url, error = &e as &dyn std::error::Error, "fetch failed");   // records the source chain; anyhow: error = format!("{e:#}")
  ```
- **con-12 — Libraries emit, binaries subscribe.** Never init `tracing_subscriber` in library code. `#[instrument]` gets `skip()` for large or sensitive args — credentials/PII never enter spans. Never hold `span.enter()` across `.await` (`.instrument(span)`); `tokio::spawn` doesn't inherit the span → `fut.in_current_span()`.

## Performance

- **perf-1 — `Vec::with_capacity`/`String::with_capacity`** when the size is known.
- **perf-2 — `VecDeque`, never `LinkedList`; membership in a loop → `HashSet`/`BTreeSet`**, not `Vec::contains` (quadratic).
- **perf-3 — Generics for hot-path dispatch; `dyn Trait` for heterogeneous collections or binary size.** `&[Box<dyn Trait>]` → `<T: Trait>(&[T])` only when every element has the same type — otherwise keep `dyn` or dispatch through an enum.
- **perf-4 — `FxHashMap`/`AHashMap` for internal integer keys** — default `HashMap` pays SipHash; attacker-controlled keys keep it (HashDoS; comply flags it anyway → report-fp). Change the type and constructor, not a comment.
- **perf-5 — Buffer all file I/O.** Looped `File` reads/writes go through `BufReader`/`BufWriter` — a syscall per line is a 100x tax. A `BufWriter` ends with `flush()?` (tokio: `.flush().await?`): std's drop swallows the error, tokio's drops the buffered data.
- **perf-6 — Deterministic iteration for output.** `HashMap` order changes per run: anything user-visible (reports, codegen, serialized output) iterates a `BTreeMap`/`IndexMap` or sorts first.
- **perf-7 — Measure before optimizing**: `criterion`/`divan` benchmarks against baselines; `cargo flamegraph` (CPU), `cargo-llvm-lines` (monomorphization bloat), `cargo bloat` (size); profile release builds with `debug = true`.
- **perf-8 — `#[inline]` only on benchmark-proven hot paths**; LTO + `codegen-units = 1` handle the rest.
- **perf-9 — Release profile: `lto = "thin"`, `codegen-units = 1`;** `"fat"` only when a benchmark pays for its link time. `panic = "abort"` also skips `Drop` on panic — drop guards and trace flushing die with it; opt in knowingly. A deployed binary keeps its symbols (no `strip = true`) and never builds with `target-cpu=native` (SIGILL on older nodes).

## Unsafe & FFI

- **saf-1 — Every `unsafe` block carries `// SAFETY:`** justifying its invariants; cheap preconditions also get a `debug_assert!`.
- **saf-2 — After ANY unsafe change, run `cargo miri test -p <crate> <filter>`** on the unit tests exercising it — not optional; never on DB, network or e2e tests.
- **saf-3 — Isolate FFI in a `mod sys`/`-sys` crate** with a safe wrapper on top. `#[repr(C)]` on every type crossing `extern "C"`; `#[repr(transparent)]` for FFI newtypes.
- **saf-4 — No unwinding across `extern "C"`.** A panic escaping a callback aborts the process — wrap callback bodies in `catch_unwind` and return an error code.
- **saf-5 — Guards bind to names.** `let _ = guard` drops it immediately (lock released, span closed, tempdir deleted) — write `let _guard = ...`.
- **saf-6 — Fuzz untrusted-input parsers** with `cargo-fuzz`; targets in `fuzz/`, time-boxed in CI.
- **saf-7 — Secrets never leak**: mask in `Debug`/`Display` (`ApiKey(****)`), zero buffers with `zeroize`, keep them out of logs and spans.
- **saf-8 — Graceful shutdown**: `CancellationToken` → join all tasks → flush traces; the orchestrator holds `let _guard = token.clone().drop_guard();` so an early `?` or a panic cancels the children too.
- **saf-9 — Ban dangerous APIs in `clippy.toml`** (`disallowed-methods`/`disallowed-types`): `println!`, default `HashMap` on hot paths, raw `Instant::now()` where a clock should be injected.

## Modern Rust (edition 2024)

- **mod-1 — `LazyLock` replaces `lazy_static!`/`once_cell::Lazy`**: `static ROUTES: LazyLock<Vec<Route>> = LazyLock::new(load_routes);`
- **mod-2 — `impl AsRef<Path>` for filesystem params** — not `String`, not `&str`.
- **mod-3 — Edition 2024 RPIT captures all in-scope lifetimes.** A `-> impl Trait` return that must not borrow its inputs needs `+ use<>` (or list captures: `+ use<'a>`).
- **mod-4 — Edition 2024 drops `if let` temporaries early.** A `MutexGuard` created in the scrutinee no longer lives through the `else` — bind guards explicitly instead of relying on drop timing.
- **mod-5 — `url::Url` for URLs.** A URL param/config typed `String` with `trim_end_matches('/')`/`format!` surgery → parse to `Url` at the boundary (boot/clap), fail fast there; mind `Url::join` (`"a/b"` and `"a/b/"` resolve differently).
- **mod-6 — Native `async fn` in traits and `AsyncFn` bounds over `#[async_trait]`/`F: Fn() -> Fut`**, unless the trait is used as `dyn` or the future gets spawned — then `fn f(&self) -> impl Future<Output = T> + Send` (con-8) or `F: Fn() -> Fut, Fut: Future + Send`.

## Testing

- **test-1 — proptest for parsers/serializers/transforms** — round-trip, idempotence, no-panic invariants; complements unit tests.
- **test-2 — `#[should_panic(expected = "...")]`.** Without `expected`, any panic passes and the test lies.
- **test-3 — `insta` snapshots for structured output** (CLI output, diagnostics, codegen) — review diffs instead of hand-maintaining assertions.
- **test-4 — `cargo mutants` once the suite is green** — surviving mutants on critical paths are missing tests.
- **test-6 — `#[tokio::test]` runs `current_thread`** — code relying on parallelism or `block_in_place` needs `flavor = "multi_thread"`. Time-dependent tests: `start_paused = true` (current_thread only) + `time::advance` or `tokio::time::sleep`, never `std::thread::sleep`, never around real I/O — the paused clock auto-advances and fires timeouts at once. No `set_var` in tests — pass config as a parameter.

## Workspace, CI & Hygiene

- **ci-1 — Workspace discipline**: `[workspace.dependencies]` for versions; a dep whose defaults a member must drop declares `default-features = false` in the workspace entry (a member can't turn them off: hard error in edition 2024); fine-grained crates compile in parallel and make boundaries visible; keep `-sys` crates separate.
- **ci-2 — Workspace lints**: `[workspace.lints.clippy]` with `pedantic = "warn"`, `todo = "deny"`, `dbg_macro = "deny"`; crates inherit via `[lints] workspace = true`; `-D warnings` in CI.
- **ci-3 — Supply chain**: `cargo audit` + `cargo deny check` in CI; `cargo-vet` for new deps; pin `=version` in security-critical crates.
- **ci-4 — `cargo-semver-checks` in CI for libraries.** Cutting a release or changing a `pub` API → load `references/semver.md` (breaking-change table, MSRV policy).
- **ci-5 — Features are additive, never mutually exclusive** — feature unification across the dep graph enables them all at once.
- **ci-6 — `#![deny(missing_docs)]` on public crates**; public rustdoc carries `# Errors`, `# Panics`, and `# Safety` sections where they apply.
- **ci-7 — `#[expect(lint, reason = "...")]` over `#[allow]`** — it fails the build when the warning disappears.

## Review Mode (reviewing Rust you didn't write)

- **rev-1 — Severity first**: Critical (UB, data loss, deadlock, injection) / Major (wrong behavior) / Minor (perf, idiom) / Info. Few high-conviction findings beat many nits.
- **rev-2 — Do not flag** — idioms, not findings:

  | Pattern | Why it's valid |
  |---|---|
  | `unwrap`/`expect` in tests, examples, `build.rs` | the panic IS the failure report |
  | `Arc::clone(&x)` | idiomatic explicit refcount |
  | `let _ = tx.send(..)` | receiver gone = normal shutdown |
  | `unsafe {}` blocks inside an `unsafe fn` | required style since edition 2024 |
  | `use super::*` in `#[cfg(test)]` modules | convention |
  | `Box<dyn Error>` in binaries | apps don't need typed errors |

- **rev-3 — Flag a `.clone()` only when ALL hold**: hot path + non-`Copy` + not in tests + not forced by `Send`/`'static` bounds.
- **rev-4 — Verify before flagging**: read the file:line in this session; check `Cargo.toml` edition/MSRV before idiom claims; grep call sites before claiming dead code. Every finding cites file:line.
- Diagnosing recurring borrow-checker or trait errors (E0382, E0499, E0502, E0507, E0277, E0038…) → load `references/rustc-errors.md`: each maps to a design question, and the reflex `.clone()`/`Arc<Mutex>` fix is usually wrong.

## Pre-Output Checklist (scan EVERY time before returning Rust)

Grep your own diff for each trigger and apply the fix. Applying half the pattern (e.g. deriving `Copy` but keeping `&Span` params) is not done — the whole pattern must change.

1. Manual `impl Display` + `impl Error` on an error enum → `thiserror` (err-1)
2. `.map_err(|e| format!("X failed: {e}"))` → context with WHY + input (err-2)
3. Bare `+`/`*` on externally-supplied integers → `checked_`/`saturating_` (num-1)
4. `.partial_cmp(..).unwrap()` in a sort → `total_cmp` (num-3)
5. `.clone()` added to satisfy the borrow checker → `mem::take` / restructure (own-6)
6. Tree/graph node with `Arc<Mutex<Node>>`/`Rc<RefCell<Node>>` links → arena + `NodeId` (own-5)
7. Hot loop over a homogeneous `&[Box<dyn Trait>]` → generic `<T: Trait>` (perf-3)
8. `Builder::build()` returning the struct bare → `Result`; required fields `.ok_or(..)?` (api-3)
9. Serde derive on an internal type → strip it (api-6)
10. Unsealed `pub trait` in a published crate → private-supertrait seal (api-4)
11. 2nd identical newtype impl block → macro/derive; delete trivial round-trip tests (api-15)

The rest of the family is mechanical and comply catches it on the diff — do not re-audit by hand, run comply (Post-Modification Audit): `lazy_static` (`rust-prefer-once-lock`), path params as `String` (`rust-asref-path-for-fs-fns`), `as` narrowing (`rust-no-as-numeric-cast`), `unbounded_channel` (`rust-unbounded-channel`), dropped `JoinHandle` (`rust-tokio-spawn-without-handle`), `select!` in a loop (`rust-select-in-loop-unpinned`), `Mutex<bool>` (`rust-mutex-over-atomic`), subscriber init in a lib (`rust-tracing-subscriber-in-library`), `println!`/`eprintln!` (`rust-no-print-macros`, `rust-eprintln-in-library`), `Copy` passed as `&T` (`rust-trivially-copy-pass-by-ref`), unbuffered `File` in a loop (`rust-unbuffered-file-io-in-loop`), `HashMap<integer, _>` (`rust-hashmap-integer-key`), `LinkedList` (`rust-no-linkedlist`), `let _ = guard` (`rust-let-underscore-guard`), `#[should_panic]` without `expected` (`rust-should-panic-without-expect`), mirrored enum↔string `match` (`rust-prefer-strum`), URL as `String` + surgery (`rust-url-as-string`).

## Post-Modification Audit

MANDATORY after ANY change to Rust files — run before considering the work done, no exceptions:

```bash
cargo clippy --all --all-features --all-targets -- -D warnings
comply <changed files>   # ~2000 rules incl. the Rust family above; comply also runs clippy with its own lint set
```

Fix every warning and every comply diagnostic (false positive → `comply report-fp <rule_id> <path:line> --reason "<why>" --model <your model>` AND open an issue on comply, don't suppress). Suppress only with `#[expect(.., reason = "...")]` when the lint is provably wrong there (ci-7).
