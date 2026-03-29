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

### Ownership & Memory Management
- Copy small types (<= 24 bytes) by value; large types by reference
- Cow<'_, T> for mostly-read, occasionally-modified data
- Cell/RefCell for single-threaded interior mutability; Mutex/RwLock for shared state
- Weak<T> back-references prevent reference-cycle leaks
- Arena allocators (bumpalo) over Rc<RefCell<T>> sprawl for graphs/ASTs
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
- Channels (mpsc/broadcast) over Arc<Mutex<T>> for task coordination
- Cancellation safety — clean up resources if dropped at any await
- tracing crate with structured logging; no println! in async code

### Performance & Optimization
- Pre-allocate — Vec::with_capacity/String::with_capacity when size known
- Iterator chains over raw loops — better compiler vectorization (SIMD)
- Vec<T> over LinkedList — cache locality dominates for small N
- Generics (monomorphization) for hot paths; dyn Trait only for binary size/heterogeneous collections
- Release profile: lto = "fat", codegen-units = 1
- Fast hashers (ahash/fxhash) for integer-key HashMaps instead of default SipHash

### Safety & Unsafe
- Every unsafe block needs // SAFETY: comment justifying invariants
- NonNull<T> for covariance; MaybeUninit<T> for uninitialized memory
- All unsafe must pass cargo miri test
- Separate safe wrappers from unsafe FFI (sys crates)

### Modern Rust Idioms (2024+)
- std::sync::OnceLock/LazyLock over lazy_static/once_cell
- Const generics for matrix/array ops
- Let chains — if let Some(x) = a && let Some(y) = b (if MSRV supports)
- AsRef<Path> for filesystem functions — accepts String, &str, PathBuf, Path
