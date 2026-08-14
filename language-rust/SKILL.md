---
name: language-rust
description: Use when writing, reviewing, or refactoring Rust — ownership, lifetimes, type-driven design, async, error handling, FFI, and performance.
---

Make invalid states unrepresentable — bugs must not compile. Panics are for bugs; `Result` is for runtime conditions. Rule IDs (`num-1`, `rev-2`…) are stable — cite them in review findings.

## Types & Public API

- **api-1 — Parse, don't validate.** Newtypes (`struct Email(String)`) guarantee validity post-construction. Prefer stdlib invariant types over hand-rolled ones: `NonZeroU32` for counts and divisors (`Option<NonZeroU32>` stays 4 bytes).
- **api-2 — Typestate for compile-time state machines** — `Builder<Pending>` → `Builder<Ready>`; invalid transitions don't compile.
- **api-3 — Builder `build()` returns `Result`.** Required fields are `Option` internally; `build()` errors when one is missing. Never `unwrap_or_default()` a required field — that silently ships a broken value:
  ```rust
  // WRONG: pub fn build(self) -> Pool { Pool { dsn: self.dsn.unwrap_or_default(), .. } }
  // RIGHT: pub fn build(self) -> Result<Pool, BuildError> {
  //            let dsn = self.dsn.ok_or(BuildError::MissingDsn)?;
  //            Ok(Pool { dsn, max_conns: self.max_conns.unwrap_or(10), .. }) }
  ```
- **api-4 — Seal `pub` traits you control.** Any library trait that is not an explicit user extension point gets a *private* supertrait, so adding methods later breaks nobody. Adding `Send + Sync` supertraits is NOT sealing:
  ```rust
  mod sealed { pub trait Sealed {} }
  pub trait Transform: sealed::Sealed + Send + Sync { fn apply(&self, x: &[f64]) -> Vec<f64>; }
  impl sealed::Sealed for MyStage {}   // only this crate can
  ```
- **api-5 — `#[must_use]`** on public fns returning `Result`/`Option`, on builders, and on RAII guard types.
- **api-6 — Serde only at boundaries.** `deny_unknown_fields` on deserialized configs; `rename_all = "camelCase"` at API edges; `#[serde(default)]` for forward-compatible schemas. Internal types (metrics, in-memory state) must NOT derive `Serialize`/`Deserialize` — strip it.
- **api-7 — Newtypes derive `Clone, Debug, PartialEq, Eq, Hash`**; add `Display` for user-facing types, `FromStr` for parseable ones. Validate at construction, trust downstream.
- **api-8 — Encode invariants deeper** — `PhantomData` to split structurally identical types; zero-sized proof types; `compile_error!` for invalid feature combinations.
- **api-9 — Const-assert auto-traits** on concurrency-facing types:
  ```rust
  const _: () = { fn ok<T: Send + Sync + Sized + Unpin>() {} ok::<MyType>(); };
  ```
- **api-10 — Naming contract**: `as_` borrows (cheap), `to_` allocates (expensive), `into_` consumes. No `get_` prefix on getters.
- **api-11 — Two-variant enum over `bool` params** in public APIs — `Mode::Recursive` reads at the call site; `true` doesn't.
- **api-12 — `#[non_exhaustive]`** on public enums and error types meant to grow — adding a variant stays non-breaking.
- **api-13 — No `Deref` inheritance.** `impl Deref` to expose an inner domain type's methods fakes inheritance; write delegation methods or a trait.

## Numeric Safety

- **num-1 — Checked arithmetic on external input.** Overflow panics in debug but wraps silently in release. Arithmetic on parsed, user, or wire integers uses `checked_`/`saturating_` (choose deliberately), never bare `+`/`*`:
  ```rust
  // WRONG: let total = qty * unit_price;                    // qty came from the request
  // RIGHT: let total = qty.checked_mul(unit_price).ok_or(PriceError::Overflow)?;
  ```
- **num-2 — `TryFrom`, never `as`, to narrow integers.** `as` truncates silently:
  ```rust
  // WRONG: let idx = offset as u32;
  // RIGHT: let idx = u32::try_from(offset)?;   // widening: use From, it's lossless
  ```
- **num-3 — `total_cmp` for float ordering.** `.sort_by(|a, b| a.partial_cmp(b).unwrap())` panics on NaN → `a.total_cmp(b)`. (Float `==` is already caught by pedantic `float_cmp`, ci-2.)

## Ownership & Memory

- **own-1 — Copy small types (≤ 24 bytes) by value.** Deriving `Copy` is not enough — the parameters must pass by value too:
  ```rust
  #[derive(Clone, Copy)] struct Span { start: u32, end: u32 } // 8 bytes
  // WRONG: fn overlaps(a: &Span, b: &Span) -> bool   (pointer-chasing a Copy type)
  // RIGHT: fn overlaps(a: Span, b: Span) -> bool
  ```
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

- **err-1 — `thiserror` for libraries and domain code; `anyhow`/`miette` for application shells — never `anyhow` in domain code.** Never hand-write `impl Display` + `impl Error`:
  ```rust
  // WRONG: impl fmt::Display for AppError { /* match per variant */ } + impl Error for AppError {}
  // RIGHT:
  #[derive(Debug, thiserror::Error)]
  pub enum AppError {
      #[error("not found: {0}")] NotFound(String),
      #[error("unauthorized")]    Unauthorized,
  }
  ```
- **err-2 — Context explains WHY and carries the inputs.** "read failed: {e}" restates the error; name the operation and the path:
  ```rust
  // WRONG: .map_err(|e| AppError::Internal(format!("read failed: {e}")))
  // RIGHT: .with_context(|| format!("failed to load template from {}", path.display()))
  ```
- **err-3 — No `unwrap()`/`expect()` on production paths** — `?`, `unwrap_or_else`, or a typed error. Ignore an error only with explicit `let _ =`.
- **err-4 — One `pub type AppResult<T>` alias per crate** — don't repeat `Result<T, AppError>` in every signature.
- **err-5 — Variants name the business problem and carry typed context.** `SchemaMismatch { expected, got }`; never `Other(String)`, never a stringly `InvalidRange(String)`.
- **err-6 — Tools degrade, never crash.** Parsers/linters turn errors into structured diagnostics (code, message, position), resynchronize, and continue. Invalid config → defaults + warning.

## Concurrency & Async

- **con-1 — Never block the async runtime** — CPU work goes to `spawn_blocking` or Rayon.
- **con-2 — Drop `MutexGuard` before `.await`.** With several locks, document one acquisition order — deadlocks are silent.
- **con-3 — Channels over `Arc<Mutex<Vec>>`** when collecting from tasks:
  ```rust
  // WRONG: Arc<Mutex<Vec>> for task results
  // RIGHT: let (tx, rx) = mpsc::channel(items.len()); ... rx.collect().await
  ```
- **con-4 — Bounded channels only.** `unbounded_channel` is an OOM waiting for a slow consumer — pick a capacity and handle send backpressure.
- **con-5 — `select!` loses data by default.** In a loop, every non-winning branch's future is dropped with its partial progress. Pin long-lived futures outside the loop, add `biased;` when priority matters, keep non-cancel-safe ops out of branches:
  ```rust
  // WRONG: loop { select! { r = read_frame(&mut conn) => .., _ = tick.tick() => .. } }  // frame lost mid-read
  // RIGHT: let read = read_frame(&mut conn); tokio::pin!(read);
  //        loop { select! { r = &mut read => .., _ = tick.tick() => .. } }
  ```
- **con-6 — `JoinSet` over loose `tokio::spawn`.** A dropped `JoinHandle` swallows the task's panic; `JoinSet` joins every task and surfaces panics as `JoinError`.
- **con-7 — Cancellation is Drop.** Cancelling a task = dropping its future at an `.await`; every `.await` holding resources is an exit point — implement `Drop` or document the contract. Writing any `select!`, timeout, or shutdown path → load `references/async.md` (cancel-safety table) first.
- **con-8 — Public async APIs return `Send` futures.** Bound them (`-> impl Future<Output = T> + Send`) or callers can't `tokio::spawn` them — and only you, the library author, can fix it.
- **con-9 — Atomics over `Mutex<bool>`/`Mutex<usize>`.** Using any `Ordering::` beyond a Relaxed counter, or touching lock-free code → load `references/concurrency.md` first.
- **con-10 — `thread::scope` for borrow-only threads** — no `Arc` cloning just to let short-lived threads read local data.
- **con-11 — `tracing`, never `println!`/`eprintln!`.** Structured fields, not format interpolation. Startup and I/O paths must not be silent — record what was loaded, warn on failure:
  ```rust
  tracing::info!(count = routes.len(), "loaded routes");
  tracing::warn!(%url, error = %e, "fetch failed");
  ```
- **con-12 — Libraries emit, binaries subscribe.** Never init `tracing_subscriber` in library code. `#[instrument]` gets `skip()` for large or sensitive args — credentials/PII never enter spans.

## Performance

- **perf-1 — `Vec::with_capacity`/`String::with_capacity`** when the size is known.
- **perf-2 — `VecDeque`, never `LinkedList`.** FIFO = `VecDeque` (`push_back`/`pop_front`); stack = `Vec`. Rewrite the usage — don't delete the function.
- **perf-3 — Generics for hot-path dispatch; `dyn Trait` only for binary size or heterogeneous collections**:
  ```rust
  // WRONG: fn run_pipeline(stages: &[Box<dyn Transform>], data: &[f64]) -> Vec<f64>
  // RIGHT: fn run_pipeline<T: Transform>(stages: &[T], data: &[f64]) -> Vec<f64>
  ```
- **perf-4 — `FxHashMap`/`AHashMap` for integer keys** — default `HashMap` pays SipHash. Change the type and constructor, not a comment:
  ```rust
  // WRONG: fn count_tags(t: &[u64]) -> HashMap<u64, usize>
  // RIGHT: use rustc_hash::FxHashMap;  fn count_tags(t: &[u64]) -> FxHashMap<u64, usize>
  ```
- **perf-5 — Buffer all file I/O.** Looped `File` reads/writes go through `BufReader`/`BufWriter` — a syscall per line is a 100x tax.
- **perf-6 — Deterministic iteration for output.** `HashMap` order changes per run: anything user-visible (reports, codegen, serialized output) iterates a `BTreeMap`/`IndexMap` or sorts first.
- **perf-7 — Measure before optimizing**: `criterion`/`divan` benchmarks against baselines; `cargo flamegraph` (CPU), `cargo-llvm-lines` (monomorphization bloat), `cargo bloat` (size); profile release builds with `debug = true`.
- **perf-8 — `#[inline]` only on benchmark-proven hot paths**; LTO + `codegen-units = 1` handle the rest.
- **perf-9 — Release profile: `lto = "fat"`, `codegen-units = 1`.** `panic = "abort"` also skips `Drop` on panic — drop guards and trace flushing die with it; opt in knowingly.
- **perf-10 — Parallelize at file/module grain** (`par_iter`, work stealing); share config as immutable `Arc<Config>`; cap the thread pool.

## Unsafe & FFI

- **saf-1 — Every `unsafe` block carries `// SAFETY:`** justifying its invariants; cheap preconditions also get a `debug_assert!`.
- **saf-2 — After ANY unsafe change, run `cargo miri test`.** Not optional.
- **saf-3 — Isolate FFI in a `mod sys`/`-sys` crate** with a safe wrapper on top. `#[repr(C)]` on every type crossing `extern "C"`; `#[repr(transparent)]` for FFI newtypes.
- **saf-4 — No unwinding across `extern "C"`.** A panic escaping a callback aborts the process — wrap callback bodies in `catch_unwind` and return an error code.
- **saf-5 — Guards bind to names.** `let _ = guard` drops it immediately (lock released, span closed, tempdir deleted) — write `let _guard = ...`.
- **saf-6 — Fuzz untrusted-input parsers** with `cargo-fuzz`; targets in `fuzz/`, time-boxed in CI.
- **saf-7 — Secrets never leak**: mask in `Debug`/`Display` (`ApiKey(****)`), zero buffers with `zeroize`, keep them out of logs and spans.
- **saf-8 — Graceful shutdown**: `CancellationToken` → join all tasks → flush traces.
- **saf-9 — Ban dangerous APIs in `clippy.toml`** (`disallowed-methods`/`disallowed-types`): `println!`, default `HashMap` on hot paths, raw `Instant::now()` where a clock should be injected.

## Modern Rust (edition 2024)

- **mod-1 — `LazyLock` replaces `lazy_static!`/`once_cell::Lazy`** (prefer it over `OnceLock` for lazy globals):
  ```rust
  // WRONG: lazy_static! { static ref ROUTES: Vec<Route> = load_routes(); }
  // RIGHT: static ROUTES: LazyLock<Vec<Route>> = LazyLock::new(load_routes);
  ```
- **mod-2 — `impl AsRef<Path>` for filesystem params** — not `String`, and not `&str` either:
  ```rust
  // WRONG: fn load_template(path: String)      // equally wrong: path: &str
  // RIGHT: fn load_template(path: impl AsRef<Path>) -> AppResult<String>
  ```
- **mod-3 — Edition 2024 RPIT captures all in-scope lifetimes.** A `-> impl Trait` return that must not borrow its inputs needs `+ use<>` (or list captures: `+ use<'a>`).
- **mod-4 — Edition 2024 drops `if let` temporaries early.** A `MutexGuard` created in the scrutinee no longer lives through the `else` — bind guards explicitly instead of relying on drop timing.

## Testing

- **test-1 — proptest for parsers/serializers/transforms** — round-trip, idempotence, no-panic invariants; complements unit tests.
- **test-2 — `#[should_panic(expected = "...")]`.** Without `expected`, any panic passes and the test lies.
- **test-3 — `insta` snapshots for structured output** (CLI output, diagnostics, codegen) — review diffs instead of hand-maintaining assertions.
- **test-4 — `cargo mutants` once the suite is green** — surviving mutants on critical paths are missing tests.
- **test-5 — `cargo nextest run` over `cargo test`** — parallel, per-test timeouts, JUnit output.

## Workspace, CI & Hygiene

- **ci-1 — Workspace discipline**: `[workspace.dependencies]` for versions; fine-grained crates compile in parallel and make boundaries visible; keep `-sys` crates separate.
- **ci-2 — Workspace lints**: `[workspace.lints.clippy]` with `pedantic = "warn"`, `todo = "deny"`, `dbg_macro = "deny"`; crates inherit via `[lints] workspace = true`; `-D warnings` in CI.
- **ci-3 — Supply chain**: `cargo audit` + `cargo deny check` in CI; `cargo-vet` for new deps; pin `=version` in security-critical crates.
- **ci-4 — `cargo-semver-checks` in CI for libraries.** Cutting a release or changing a `pub` API → load `references/semver.md` (breaking-change table, MSRV policy).
- **ci-5 — Features are additive, never mutually exclusive** — feature unification across the dep graph enables them all at once.
- **ci-6 — `#![deny(missing_docs)]` on public crates**; public rustdoc carries `# Errors`, `# Panics`, and `# Safety` sections where they apply.
- **ci-7 — `#[expect(lint, reason = "...")]` over `#[allow]`** — it fails the build when the warning disappears.
- **ci-8 — `cargo xtask` over Makefiles**; generated code is CI-checked with `xtask codegen && git diff --exit-code`.

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

1. `lazy_static!` / `once_cell::Lazy` / `static ref` → `LazyLock` (mod-1)
2. Manual `impl Display` + `impl Error` on an error enum → `thiserror` (err-1)
3. `.map_err(|e| format!("X failed: {e}"))` → context with WHY + input (err-2)
4. Path param typed `String`/`&str` → `impl AsRef<Path>` (mod-2)
5. `as` narrowing an integer → `TryFrom` (num-2)
6. Bare `+`/`*` on externally-supplied integers → `checked_`/`saturating_` (num-1)
7. `.partial_cmp(..).unwrap()` in a sort → `total_cmp` (num-3)
8. `unbounded_channel` → bounded + backpressure (con-4)
9. `tokio::spawn` with the `JoinHandle` dropped → `JoinSet` / await it (con-6)
10. `select!` in a loop → pin long-lived futures, check `biased`, cancel-safety (con-5)
11. `Mutex<bool>` / `Mutex<usize>` → `AtomicBool` / `AtomicUsize` (con-9)
12. `tracing_subscriber` init inside a library → emit only; binaries subscribe (con-12)
13. `println!` / `eprintln!` → `tracing` macros; silent startup/I/O fns get an `info!` (con-11)
14. `.clone()` added to satisfy the borrow checker → `mem::take` / restructure (own-6)
15. `Copy` type passed as `&T` → pass by value (own-1)
16. Tree/graph node with `Arc<Mutex<Node>>`/`Rc<RefCell<Node>>` links → arena + `NodeId` (own-5)
17. Unbuffered `File` read/write in a loop → `BufReader`/`BufWriter` (perf-5)
18. `HashMap<integer, _>` → `FxHashMap`/`AHashMap` — change the type, not a comment (perf-4)
19. `LinkedList` → `VecDeque` — rewrite the usage, don't delete (perf-2)
20. Hot loop over `&[Box<dyn Trait>]` → generic `<T: Trait>` (perf-3)
21. `Builder::build()` returning the struct bare → `Result`; required fields `.ok_or(..)?` (api-3)
22. Serde derive on an internal type → strip it (api-6)
23. Unsealed library `pub trait` you control → private-supertrait seal (api-4)
24. `let _ =` binding a guard (lock, span, tempfile) → `let _guard =` (saf-5)
25. `#[should_panic]` without `expected = ".."` → add it (test-2)

## Post-Modification Audit

MANDATORY after ANY change to Rust files — run before considering the work done, no exceptions:

```bash
cargo clippy --all --all-features --all-targets -- -D warnings
```

Fix every warning. Suppress only with `#[expect(.., reason = "...")]` when the lint is provably wrong there (ci-7).
