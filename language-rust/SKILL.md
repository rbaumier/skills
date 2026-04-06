---
name: language-rust
description: Rust systems engineering — zero-cost abstractions, memory safety, type-driven design, idiomatic ownership.
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
- Builder pattern — setters return Self; build() returns Result
- Sealed traits — prevent downstream impl; allow future evolution
- #[must_use] on Result-returning functions and builders — annotate public functions returning Result, Option, or builder types with `#[must_use]` to catch silently ignored errors at compile time. Also use on types like `MutexGuard` wrappers.
- Serde best practices — `#[serde(deny_unknown_fields)]` on deserialization types to catch typos. `#[serde(rename_all = "camelCase")]` for API boundaries. `#[serde(default)]` with explicit Default impl for forward-compatible schemas. Never derive Serialize/Deserialize on internal types — only on API boundary types.

### Ownership & Memory Management
- Copy small types (<= 24 bytes) by value; large types by reference
- **Cow<'_, T>** for mostly-read, occasionally-modified data — **if a function takes `&str`/`&[T]` but sometimes needs to modify (normalize, escape, default), use `Cow` not `.to_owned()`**:
  ```rust
  // WRONG: fn normalize(s: &str) -> String { if needs_change { modified } else { s.to_owned() } }
  // RIGHT: fn normalize(s: &str) -> Cow<'_, str> { if needs_change { Cow::Owned(modified) } else { Cow::Borrowed(s) } }
  ```
- **Cell/RefCell for single-threaded interior mutability** — if a struct has `&self` methods but needs internal mutable state (caches, counters, lazy fields), use `Cell<T>`/`RefCell<T>`, not `Mutex`. **`Mutex` in single-threaded code is a code smell**
- Weak<T> back-references prevent reference-cycle leaks
- Arena allocators (bumpalo) over Rc<RefCell<T>> sprawl for graphs/ASTs — **if you see `Arc<Mutex<Node>>` for tree/graph structures, recommend bumpalo arenas with index-based references**
- Box large enum variants to keep enum size small

### Error Handling
- thiserror for libraries; anyhow/miette for applications
- .context()/.with_context() — explain why, not just what
- No unwrap()/expect() in production — use unwrap_or_else or ?
- Errors are values — ignore only with explicit let _ =

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
- tracing crate with structured logging; no println! in async code

### Performance & Optimization
- Pre-allocate — Vec::with_capacity/String::with_capacity when size known
- Iterator chains over raw loops — better compiler vectorization (SIMD)
- Vec<T> over LinkedList — cache locality dominates for small N
- Generics (monomorphization) for hot paths; dyn Trait only for binary size/heterogeneous collections
- Release profile: lto = "fat", codegen-units = 1
- Fast hashers (ahash/fxhash) for integer-key HashMaps instead of default SipHash
- Benchmarking with criterion/divan — before optimizing, measure with `criterion` (statistical, regression-detecting) or `divan` (simpler API). Compare against baselines. Never optimize without benchmarks proving the need.
- Profiling before optimizing — use `cargo flamegraph` for CPU profiling, `cargo-llvm-lines` to find monomorphization bloat, `cargo bloat` for binary size analysis. Profile in release mode with debug symbols (`[profile.release] debug = true`).

### Safety & Unsafe
- Every unsafe block needs // SAFETY: comment justifying invariants
- NonNull<T> for covariance; MaybeUninit<T> for uninitialized memory
- **After ANY unsafe block** → recommend running `cargo miri test` to verify undefined behavior. This is not optional
- Separate safe wrappers from unsafe FFI — **always isolate in a `mod sys` or `-sys` crate** with safe public API on top
- Fuzzing critical parsers — use `cargo-fuzz` (libFuzzer) for any code parsing untrusted input (network protocols, file formats, user strings). Add fuzz targets to `fuzz/` directory. Run in CI with time-limited sessions.

### Modern Rust Idioms (2024+)
- std::sync::OnceLock/LazyLock over lazy_static/once_cell
- Const generics for matrix/array ops
- Let chains — if let Some(x) = a && let Some(y) = b (if MSRV supports)
- AsRef<Path> for filesystem functions — accepts String, &str, PathBuf, Path

### Project Structure
- Cargo workspace organization — use `[workspace]` for multi-crate projects. `[workspace.dependencies]` to centralize versions. `[workspace.lints]` for shared clippy/rustc lint config. Keep `-sys` crates separate from safe wrapper crates.

### Testing
- Property-based testing with proptest — for parsers, serializers, and data transformations, use `proptest!` to generate random inputs and verify invariants (round-trip, idempotence, no-panic). Complement unit tests, don't replace them.
- Mutation testing with `cargo-mutants` — after test suite passes, run `cargo mutants` to find code where mutations survive (tests don't catch behavioral changes). Prioritize fixing surviving mutants in critical paths.
- Use `cargo nextest` over `cargo test` — parallel test execution, better output formatting, per-test timeout support, JUnit XML output for CI. Drop-in replacement: `cargo nextest run`.

### Supply Chain & CI
- Supply chain security — run `cargo audit` (known CVEs) and `cargo deny check` (licenses + advisories + banned crates) in CI. Pin dependencies with `=version` in security-critical crates. Use `cargo-vet` for first-party audit of new deps.

## Post-Modification Audit

<EXTREMELY-IMPORTANT>
MANDATORY: After ANY modification to Rust files, you MUST run clippy before considering your work done. This is not optional. Do not skip this step. Do not rationalize why "this change is too small" or "I'll run it later."
</EXTREMELY-IMPORTANT>

```bash
cargo clippy --all --all-features --all-targets -- -D warnings
```

Fix all warnings before committing. Clippy warnings are errors (`-D warnings`) — no `#[allow]` unless you can justify why the lint is wrong for that specific case.
