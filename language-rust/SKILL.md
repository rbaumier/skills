---
name: language-rust
description: Use when writing, reviewing, or refactoring Rust — ownership, lifetimes, type-driven design, async, error handling, FFI, and performance.
---

## When to use
- Writing, reviewing, refactoring Rust (systems, CLI, web, Wasm)
- Safe API wrappers around unsafe FFI
- Hot-path CPU/memory optimization
- Debugging lifetimes, borrow checker, data races

## When not to use
- Loose prototyping where types hinder speed (rare)
- Build scripts better suited to bash/python
- Graph-heavy architectures fighting the borrow checker — use arenas/indices

## Core Philosophy
- Make invalid states unrepresentable — bugs must not compile
- Ownership is the API — signatures encode lifetime + mutability
- Zero-cost abstractions — high-level code compiles to hand-written asm
- Panics for bugs; Results for runtime conditions
- Fearless concurrency — Send/Sync guarantee thread safety at compile time

## Critical Rules

### Type System & API Design
- Parse, don't validate — newtypes (struct Email(String)) guarantee validity post-construction
- Typestate pattern — generics enforce compile-time state transitions (Builder<Pending> -> Builder<Ready>)
- Accept &str over &String, &[T] over &Vec<T>
- impl Trait for flexible args/returns; avoid unnecessary monomorphization
- **Builder `build()` returns `Result`** — required fields are `Option` internally; `build()` errors when missing. **Never `unwrap_or_default()` a required field** — that silently produces a broken value:
  ```rust
  // WRONG: pub fn build(self) -> Pool { Pool { dsn: self.dsn.unwrap_or_default(), .. } }
  // RIGHT: pub fn build(self) -> Result<Pool, BuildError> {
  //            let dsn = self.dsn.ok_or(BuildError::MissingDsn)?;
  //            Ok(Pool { dsn, max_conns: self.max_conns.unwrap_or(10), .. }) }
  ```
- **Sealed traits** — any library `pub trait` whose impls you control (pipeline stages, visitor hooks, plugin interfaces) gets a private supertrait so downstream `impl` is impossible, letting you add methods later without breaking callers. Default to sealing a `pub trait` unless it is explicitly an extension point users are meant to implement. Adding only `Send + Sync` supertraits is NOT sealing — you need a *private* supertrait:
  ```rust
  mod sealed { pub trait Sealed {} }                              // private module
  pub trait Transform: sealed::Sealed + Send + Sync {             // sealed: + sealed::Sealed
      fn apply(&self, x: &[f64]) -> Vec<f64>;
  }
  impl sealed::Sealed for MyStage {}                              // only this crate can do this
  impl Transform for MyStage { fn apply(&self, x: &[f64]) -> Vec<f64> { x.to_vec() } }
  ```
- #[must_use] on Result-returning functions and builders — annotate public functions returning Result, Option, or builder types with `#[must_use]` to catch silently ignored errors at compile time. Also use on types like `MutexGuard` wrappers.
- Serde best practices — `#[serde(deny_unknown_fields)]` on deserialization types to catch typos. `#[serde(rename_all = "camelCase")]` for API boundaries. `#[serde(default)]` with explicit Default impl for forward-compatible schemas. **Serde derives belong ONLY on API/config boundary types. Internal types (metrics, in-memory state, domain structs that never cross a wire) must NOT derive Serialize/Deserialize** — strip the derive when a type is internal, even if it "could" be serialized.
- **Encode invariants deeper** — `PhantomData<T>` to distinguish structurally identical types. Zero-sized types as verification proofs. `compile_error!` for invalid feature flag combinations. `#[must_use]` on RAII guards and handles
- **Descriptive generic parameters** — when 2+ type params, use descriptive names: `fn transform<Source, Target>(input: Source) -> Target` not `fn transform<T, U>(input: T) -> U`. Single param `T` is fine
- **Newtypes derive standard traits** — systematically `#[derive(Clone, Debug, PartialEq, Eq, Hash)]` on newtypes. Validate at construction, trust downstream. Implement `Display` for user-facing types, `FromStr` for parseable ones
- **Const assertions for Send+Sync** — verify thread safety at compile time:
  ```rust
  const _: () = { fn assert_send_sync<T: Send + Sync>() {} assert_send_sync::<MyType>(); };
  ```

### Ownership & Memory Management
- **Copy small types (<= 24 bytes) by value; large types by reference** — deriving `Copy` is not enough: the *parameters* must pass by value too. A `Span { start: u32, end: u32 }` is 8 bytes — `fn overlaps(a: Span, b: Span)`, never `&Span`:
  ```rust
  #[derive(Clone, Copy)] struct Span { start: u32, end: u32 } // 8 bytes
  // WRONG: fn overlaps(a: &Span, b: &Span) -> bool   (pointer-chasing a Copy type)
  // RIGHT: fn overlaps(a: Span, b: Span) -> bool
  ```
- **Cow<'_, T>** for mostly-read, occasionally-modified data — **if a function takes `&str`/`&[T]` but sometimes needs to modify (normalize, escape, default), use `Cow` not `.to_owned()`**:
  ```rust
  // WRONG: fn normalize(s: &str) -> String { if needs_change { modified } else { s.to_owned() } }
  // RIGHT: fn normalize(s: &str) -> Cow<'_, str> { if needs_change { Cow::Owned(modified) } else { Cow::Borrowed(s) } }
  ```
- **Cell/RefCell for single-threaded interior mutability** — if a struct has `&self` methods but needs internal mutable state (caches, counters, lazy fields), use `Cell<T>`/`RefCell<T>`, not `Mutex`. **`Mutex` in single-threaded code is a code smell**
- Weak<T> back-references prevent reference-cycle leaks
- **Arena + index references over pointer trees** — for graphs/ASTs/trees, an `Arc<Mutex<Node>>` (or `Box<Node>`/`Rc<RefCell<Node>>`) field web fights the borrow checker and leaks on cycles. Store every node once in an arena `Vec` and reference others by an index newtype (`NodeId(usize)`), not by pointer. Removing the `Mutex`/`Arc` but keeping a pointer tree is NOT the fix — the references themselves must become indices.
  ```rust
  // WRONG: pointer tree — interior locking, cycle leaks, borrow-checker fights
  struct AstNode { expr: Expr, parent: Option<Arc<Mutex<AstNode>>>, children: Vec<Arc<Mutex<AstNode>>> }

  // RIGHT: arena owns the nodes; parent/children are indices into it
  #[derive(Clone, Copy, PartialEq, Eq)]
  struct NodeId(usize);
  struct AstNode { expr: Expr, parent: Option<NodeId>, children: Vec<NodeId> }
  struct Ast { nodes: Vec<AstNode> }   // the arena; resolve a NodeId with self.nodes[id.0]
  ```
  (`bumpalo` is the crate when you want true bump allocation; the `Vec` + `NodeId` shape above is the borrow-checker-friendly default.)
- **Box large enum variants** — an enum is as big as its largest variant. When one variant holds a big payload (`HashMap`, large struct, `[u8; N]`) and others are tiny (`Literal(i64)`), `Box` the big field so every value of the enum stays small:
  ```rust
  // WRONG: Call { callee: Box<Expr>, args: Vec<Expr>, source_map: HashMap<String, Span> }
  // RIGHT: Call { callee: Box<Expr>, args: Vec<Expr>, source_map: Box<HashMap<String, Span>> }
  ```
  Clippy's `large_enum_variant` flags this.

### Error Handling
- **thiserror for library error types** — derive it; never hand-write `impl Display` + `impl std::error::Error` for an error enum. If you see a manual `Display` match arm per variant plus `impl Error for E {}`, replace the whole thing with `#[derive(thiserror::Error)]` + `#[error("...")]` attributes:
  ```rust
  // WRONG: impl fmt::Display for AppError { match self { Self::NotFound(m) => write!(f, "not found: {m}"), .. } }
  //        impl std::error::Error for AppError {}
  // RIGHT:
  #[derive(Debug, thiserror::Error)]
  pub enum AppError {
      #[error("not found: {0}")] NotFound(String),
      #[error("unauthorized")]    Unauthorized,
  }
  ```
  anyhow/miette for applications.
- **`.context()`/`.with_context()` — explain WHY and include the inputs, not just WHAT failed.** "read failed: {e}" is wrong (restates the io error). Name the operation and the path:
  ```rust
  // WRONG: .map_err(|e| AppError::Internal(format!("read failed: {e}")))
  // RIGHT: .with_context(|| format!("failed to load template from {}", path.display()))
  ```
- No unwrap()/expect() in production — use unwrap_or_else or ?
- Errors are values — ignore only with explicit let _ =
- **Crate-wide Result alias** — define `pub type AppResult<T> = Result<T, AppError>;` centralized in each workspace. All functions use the alias, never repeat `Result<T, AppError>` everywhere
- **Error variants name the business problem** — `ColumnNotFound(String)`, `SchemaMismatch { expected, got }`, never `HashMapError(String)` or `Other(String)` catch-all. No catch-all `Other(String)` variant
- **Error structs carry structured context** — variants hold typed context data for diagnostics, never format to string: `InvalidRange { start: usize, end: usize, len: usize }` not `InvalidRange(String)` with `format!(...)`
- **Error strategy per layer** — domain: thiserror enums with specific variants. Infra/CLI: anyhow for rich user messages. Analysis tools: never Result, collect diagnostics. Never mix anyhow in domain code
- **Resilient error handling for tools** — parsers/linters never crash. Parse errors become structured diagnostics (code, category, message, position). Parser resynchronizes and continues to maximize feedback. Invalid configs use defaults with warnings

### Concurrency & Async (Tokio/Rayon)
- Never block async runtime — offload CPU work to spawn_blocking/Rayon
- Send moves ownership across threads; Sync shares references. Rc is !Send, RefCell is !Sync
- Minimize MutexGuard scope; drop before .await to prevent deadlocks
- **Channels over shared state** — if collecting results from `spawn_blocking`/spawned tasks, use `mpsc::channel` not `Arc<Mutex<Vec>>`:
  ```rust
  // WRONG: Arc<Mutex<Vec>> for collecting task results
  // RIGHT: let (tx, rx) = mpsc::channel(items.len());
  //        for item in items { let tx = tx.clone(); spawn(async move { tx.send(process(item)).await; }); }
  //        let results: Vec<_> = rx.collect().await;
  ```
- Cancellation safety — if code has `.await` with owned resources (files, connections, locks), **document cancellation behavior or implement Drop**. Silent resource leaks at `.await` points are bugs
- **`tracing` over `println!`/`eprintln!` everywhere — and instrument silent I/O paths.** Replace every `println!`/`eprintln!` with the matching `tracing` macro (`info!`/`warn!`/`error!`/`debug!`). Beyond replacing existing prints: a function that loads config, opens files, or runs at startup must not be *silent* — add a `tracing::info!`/`debug!` recording what it did (and `warn!`/`error!` on failure paths). Use structured fields, not interpolation:
  ```rust
  // WRONG: fn load_routes() -> Vec<Route> { let raw = read_to_string("routes.json").unwrap(); .. }  // silent
  // WRONG: eprintln!("fetch {url} failed: {e}");
  // RIGHT:
  fn load_routes() -> Vec<Route> {
      let routes = /* ... */;
      tracing::info!(count = routes.len(), "loaded routes");   // startup path is observable
      routes
  }
  tracing::warn!(%url, error = %e, "fetch failed");            // structured fields, not format args
  ```

### Performance & Optimization
- Pre-allocate — Vec::with_capacity/String::with_capacity when size known
- Iterator chains over raw loops — better compiler vectorization (SIMD)
- **`Vec`/`VecDeque` over `LinkedList`, always** — cache locality dominates; `LinkedList` is almost never the right choice even when the variable is named "queue". A FIFO queue is `VecDeque`, a stack/list is `Vec`. Rewrite any `LinkedList` to `VecDeque` (`push_back`/`pop_front`) — do not just delete the function.
- **Generics (monomorphization) for hot-path trait dispatch; `dyn Trait` only for binary size or heterogeneous collections.** A pipeline / per-element loop calling a trait method should be generic, not `&[Box<dyn Trait>]`:
  ```rust
  // WRONG: fn run_pipeline(stages: &[Box<dyn Transform>], data: &[f64]) -> Vec<f64>
  // RIGHT: fn run_pipeline<T: Transform>(stages: &[T], data: &[f64]) -> Vec<f64>
  ```
- Release profile: lto = "fat", codegen-units = 1
- **Fast hashers (FxHashMap / AHashMap) for integer-key maps — never default `HashMap<u64, _>`.** Default `HashMap` uses SipHash (DoS-resistant, slow); integer keys want `rustc_hash::FxHashMap` or `ahash::AHashMap`. Changing only a code *comment* to say "FxHashMap" is wrong — change the actual type and its `use`/`with_capacity_and_hasher` constructor:
  ```rust
  // WRONG: fn count_tags(t: &[u64]) -> HashMap<u64, usize>   (SipHash)
  // RIGHT: use rustc_hash::FxHashMap;  fn count_tags(t: &[u64]) -> FxHashMap<u64, usize>
  ```
- Benchmarking with criterion/divan — before optimizing, measure with `criterion` (statistical, regression-detecting) or `divan` (simpler API). Compare against baselines. Never optimize without benchmarks proving the need.
- Profiling before optimizing — use `cargo flamegraph` for CPU profiling, `cargo-llvm-lines` to find monomorphization bloat, `cargo bloat` for binary size analysis. Profile in release mode with debug symbols (`[profile.release] debug = true`).
- **Targeted inlining** — `#[inline]` only on hot paths proven by benchmarks. Never sprinkle "just in case". LTO + codegen-units=1 handles the rest. `#[inline(always)]` requires benchmark justification
- **File-level parallelism** — parallelize at file/module level via `par_iter()` or work-stealing, not intra-file. Share config via immutable `Arc<Config>` (never behind Mutex). Cap the thread pool. Directory scan once at startup with `HashSet` for O(1) lookups
- **Fine-grained crates for incremental compilation** — many small crates with explicit dependencies maximize incremental compilation and make architectural boundaries visible. Critical structs in internal crates (not external deps) for full control. Each crate compiles in parallel

### Safety & Unsafe
- Every unsafe block needs // SAFETY: comment justifying invariants
- NonNull<T> for covariance; MaybeUninit<T> for uninitialized memory
- **After ANY unsafe block** → recommend running `cargo miri test` to verify undefined behavior. This is not optional
- Separate safe wrappers from unsafe FFI — **always isolate in a `mod sys` or `-sys` crate** with safe public API on top
- Fuzzing critical parsers — use `cargo-fuzz` (libFuzzer) for any code parsing untrusted input (network protocols, file formats, user strings). Add fuzz targets to `fuzz/` directory. Run in CI with time-limited sessions.
- **Credential and secret safety** — types containing secrets implement `Debug`/`Display` with masking (`****`). Sensitive buffers zeroed with `Zeroizing<T>` (from `zeroize` crate) at Drop. Logs never contain secrets. `impl fmt::Debug for ApiKey { fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result { write!(f, "ApiKey(****)") } }`
- **Graceful degradation** — shutdown gracefully: `CancellationToken` + join all tasks + flush traces. When threading is unavailable, transparent sequential fallback. Adapt rendering for `TERM=dumb`. Interruption via `AtomicBool` + signal handler
- **Disallowed methods via clippy.toml** — ban dangerous or convention-breaking APIs at the linter level: `println!` (use tracing), `HashMap` on hot paths (use FxHashMap), `Instant::now()` (use injectable TimeProvider). Enforce with `clippy.toml` `disallowed-methods` and `disallowed-types`

### Modern Rust Idioms (2024+)
- **`std::sync::LazyLock` replaces `lazy_static!` / `once_cell::Lazy`.** A `lazy_static! { static ref X: T = init(); }` block maps directly to `static X: LazyLock<T> = LazyLock::new(init);` — prefer `LazyLock` over `OnceLock` for lazily-initialized globals (no `get_or_init` boilerplate):
  ```rust
  // WRONG: lazy_static! { static ref ROUTES: Vec<Route> = load_routes(); }
  // RIGHT: static ROUTES: LazyLock<Vec<Route>> = LazyLock::new(load_routes);
  ```
- Const generics for matrix/array ops
- Let chains — if let Some(x) = a && let Some(y) = b (if MSRV supports)
- **`impl AsRef<Path>` for filesystem functions, not `String`/`&str`** — accepts `String`, `&str`, `PathBuf`, `Path` interchangeably. Changing a `String` param to `&str` is NOT the fix; the target is `impl AsRef<Path>`:
  ```rust
  // WRONG: fn load_template(path: String)   // and equally wrong: path: &str
  // RIGHT: fn load_template(path: impl AsRef<Path>) -> AppResult<String> {
  //            let path = path.as_ref(); std::fs::read_to_string(path) .. }
  ```

### Project Structure
- Cargo workspace organization — use `[workspace]` for multi-crate projects. `[workspace.dependencies]` to centralize versions. `[workspace.lints]` for shared clippy/rustc lint config. Keep `-sys` crates separate from safe wrapper crates.

### Testing
- Property-based testing with proptest — for parsers, serializers, and data transformations, use `proptest!` to generate random inputs and verify invariants (round-trip, idempotence, no-panic). Complement unit tests, don't replace them.
- Mutation testing with `cargo-mutants` — after test suite passes, run `cargo mutants` to find code where mutations survive (tests don't catch behavioral changes). Prioritize fixing surviving mutants in critical paths.
- Use `cargo nextest` over `cargo test` — parallel test execution, better output formatting, per-test timeout support, JUnit XML output for CI. Drop-in replacement: `cargo nextest run`.

### Supply Chain & CI
- Supply chain security — run `cargo audit` (known CVEs) and `cargo deny check` (licenses + advisories + banned crates) in CI. Pin dependencies with `=version` in security-critical crates. Use `cargo-vet` for first-party audit of new deps.

### Tooling & Project Hygiene
- **Xtask over Makefile** — `cargo xtask codegen`, `cargo xtask release`, `cargo xtask bench`. Type-safe, cross-platform, with error handling. No Makefiles with complex shell variables
- **Deny missing docs on public APIs** — `#![deny(missing_docs)]` on public crates. Compiler forces documentation of every public item. `doc(hidden)` for generated code items
- **`#[expect]` over `#[allow]`** — `#[expect(clippy::too_many_arguments, reason = "FFI boundary")]` breaks compilation when the warning disappears, forcing cleanup. `#[allow]` hides forever. Every suppression requires a `reason`
- **CI verification of generated code** — generated files have a header with the regen command. CI runs `cargo xtask codegen && git diff --exit-code`. PR that modifies source but not generated output fails
- **Workspace-level lint configuration** — `[workspace.lints.clippy]` with `pedantic = "warn"`, `todo = "deny"`, `dbg_macro = "deny"`. All crates inherit via `[lints] workspace = true`. `-D warnings` in CI

## Pre-Output Checklist (scan EVERY time before returning Rust)

Before you output Rust, grep your own code for these triggers and apply the fix. These are the rules most often missed — applying one (e.g. `Copy`) is NOT enough, the whole pattern must change.

- `lazy_static!` or `once_cell::Lazy` or `static ref` → **`LazyLock`** (not `OnceLock`). Trigger: any lazily-initialized global.
- Manual `impl fmt::Display for <Error>` + `impl Error` → **`#[derive(thiserror::Error)]`** with `#[error("...")]`.
- `.map_err(|e| ...format!("X failed: {e}"))` / context that restates the error → **explain WHY + include the path/input**.
- Filesystem fn taking `String` or `&str` (path param) → **`impl AsRef<Path>`** (not `&str`).
- enum with one big variant (`HashMap`, big struct, big array) next to tiny ones → **`Box` the big payload**.
- tree/graph/AST node with `Arc<Mutex<Node>>` / `Box<Node>` / `Rc<RefCell<Node>>` in `parent`/`children` fields → **arena `Vec<Node>` + `NodeId(usize)` index references** (rewrite the reference fields to indices; dropping the `Mutex`/`Arc` while keeping a pointer tree is NOT the fix).
- `HashMap<u64, _>` / `HashMap<integer, _>` → **`FxHashMap` / `AHashMap`** (change the type, not a comment).
- `LinkedList<_>` → **`VecDeque`** (rewrite to `push_back`/`pop_front`; never drop the function).
- `Builder::build(self) -> T` returning the struct directly → **`-> Result<T, _>`**; required fields error via `.ok_or(...)?`, no `unwrap_or_default()`.
- Internal type (metrics, in-memory state) with `#[derive(Serialize, Deserialize)]` → **remove the serde derive**; keep it only on API/config boundary types.
- `Copy` type passed as `&T` (e.g. `&Span`, two `u32`s) → **pass by value** (`Span`, not `&Span`).
- Per-element / pipeline loop over `&[Box<dyn Trait>]` (hot path) → **generic `<T: Trait>` `&[T]`**.
- Library `pub trait` whose impls you control (pipeline/visitor/plugin), not an explicit user extension point → **seal it** with a *private* supertrait: `mod sealed { pub trait Sealed {} }` then `pub trait Foo: sealed::Sealed { .. }`. Adding `Send + Sync` is NOT sealing.
- `println!` / `eprintln!` anywhere → swap to **`tracing`** (`info!`/`warn!`/`error!`/`debug!`). Plus: any fn that loads config / reads files / runs at startup but logs *nothing* → add a `tracing::info!`/`debug!` (and `warn!`/`error!` on failure) so the path is observable. Use structured fields.

## Post-Modification Audit

**MANDATORY: After ANY modification to Rust files, run clippy before considering your work done.** No exceptions -- not for "small changes," not for "I'll run it later."

```bash
cargo clippy --all --all-features --all-targets -- -D warnings
```

Fix all warnings before committing. Clippy warnings are errors (`-D warnings`) — no `#[allow]` unless you can justify why the lint is wrong for that specific case.
