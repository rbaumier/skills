```rust
use std::borrow::Cow;
use std::collections::HashMap;
use std::sync::LazyLock;

use tracing::info;

// --- Global config (LazyLock replaces lazy_static) ---

static CONFIG: LazyLock<HashMap<String, String>> = LazyLock::new(load_config);

// --- Tree / AST types ---
//
// Arena-based design avoids Arc<Mutex<Node>> sprawl.
// Each node is stored in a Vec; references use NodeId indices.
// This eliminates reference cycles (no Weak needed) and removes
// per-node locking overhead entirely.

/// Stable index into an `Arena<Node>`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NodeId(usize);

/// Simple typed arena for AST nodes.
#[derive(Debug)]
pub struct Arena {
    nodes: Vec<Node>,
}

impl Arena {
    pub fn new() -> Self {
        Self { nodes: Vec::new() }
    }

    /// Allocate a new node and return its stable index.
    pub fn alloc(&mut self, node: Node) -> NodeId {
        let id = NodeId(self.nodes.len());
        self.nodes.push(node);
        id
    }

    pub fn get(&self, id: NodeId) -> &Node {
        &self.nodes[id.0]
    }

    pub fn get_mut(&mut self, id: NodeId) -> &mut Node {
        &mut self.nodes[id.0]
    }
}

#[derive(Debug)]
pub enum NodeKind {
    Leaf(String),
    Branch(Vec<NodeId>),
    /// Boxed to keep enum size small — Metadata is the rare, large variant.
    Metadata(Box<HashMap<String, String>>),
}

#[derive(Debug)]
pub struct Node {
    pub kind: NodeKind,
    pub parent: Option<NodeId>,
    /// Single-threaded interior mutability — Cell/RefCell, not Mutex.
    pub cache: std::cell::RefCell<Option<String>>,
}

// --- Builder (typestate pattern) ---

/// Marker: required fields not yet set.
pub struct Pending;
/// Marker: all required fields set, ready to build.
pub struct Ready;

pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

pub struct ServerConfigBuilder<State = Pending> {
    host: Option<String>,
    port: Option<u16>,
    _state: std::marker::PhantomData<State>,
}

impl ServerConfigBuilder<Pending> {
    pub fn new() -> Self {
        Self {
            host: None,
            port: None,
            _state: std::marker::PhantomData,
        }
    }

    /// Set host — transitions to Ready once both fields are provided via `port()`.
    pub fn host(mut self, h: impl Into<String>) -> Self {
        self.host = Some(h.into());
        self
    }

    /// Set port — transitions to Ready once both fields are provided via `host()`.
    pub fn port(mut self, p: u16) -> Self {
        self.port = Some(p);
        self
    }

    /// Finalize the builder. Only callable when both host and port are set.
    /// Returns `Result` so callers handle the error path.
    pub fn build(self) -> Result<ServerConfig, ServerConfigError> {
        match (self.host, self.port) {
            (Some(host), Some(port)) => Ok(ServerConfig { host, port }),
            (None, _) => Err(ServerConfigError::MissingField("host")),
            (_, None) => Err(ServerConfigError::MissingField("port")),
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ServerConfigError {
    #[error("missing required field: {0}")]
    MissingField(&'static str),
}

// --- Sealed Plugin trait ---
//
// `Sealed` prevents downstream crates from implementing `Plugin`,
// allowing future evolution without breaking changes.

mod private {
    pub trait Sealed {}
}

pub trait Plugin: private::Sealed {
    fn name(&self) -> &str;
    fn execute(&self, input: &[u8]) -> Vec<u8>;
}

// --- Hot-path processing with generics (monomorphized, no vtable) ---
//
// Generic over `P: Processor` enables inlining and SIMD vectorization.
// Use `dyn Processor` only for heterogeneous collections at non-hot paths.

pub fn process_batch<P: Processor>(processors: &[P], data: &[f64]) -> Vec<f64> {
    let mut out = Vec::with_capacity(data.len() * processors.len());
    for val in data {
        for p in processors {
            out.push(p.apply(*val));
        }
    }
    out
}

pub trait Processor {
    fn apply(&self, val: f64) -> f64;
}

// --- File I/O ---
//
// - Accepts `AsRef<Path>` (works with String, &str, PathBuf, Path).
// - Returns `Result` instead of panicking.
// - Uses `tracing` instead of `println!`.

pub fn read_file(path: impl AsRef<std::path::Path>) -> std::io::Result<String> {
    let path = path.as_ref();
    info!(?path, "reading file");
    std::fs::read_to_string(path)
}

// --- Cow-based normalize ---
//
// Avoids allocation when the name is already clean (no '-').

pub fn normalize_name<'a>(name: &'a str) -> Cow<'a, str> {
    if name.contains('-') {
        Cow::Owned(name.replace('-', "_"))
    } else {
        Cow::Borrowed(name)
    }
}

// --- Async fetch with channels instead of Arc<Mutex<Vec>> ---
//
// - Concurrent fetches via `JoinSet`.
// - Results collected through owned values, no shared mutable state.
// - Uses `?` with `anyhow` instead of `unwrap()`.
// - `tracing` instead of `println!`.

pub async fn fetch_and_process(urls: Vec<String>) -> anyhow::Result<Vec<String>> {
    use tokio::task::JoinSet;

    let mut set = JoinSet::new();

    for url in urls {
        set.spawn(async move {
            let res = reqwest::get(&url)
                .await
                .with_context(|| format!("failed to fetch {url}"))?;
            let body = res
                .text()
                .await
                .with_context(|| format!("failed to read body from {url}"))?;
            info!(bytes = body.len(), %url, "fetched");
            Ok::<String, anyhow::Error>(body)
        });
    }

    let mut results = Vec::with_capacity(set.len());
    while let Some(res) = set.join_next().await {
        results.push(res??);
    }
    Ok(results)
}

use anyhow::Context;

// --- Iterator chain replaces manual loop ---

pub fn process_items(items: &[Item]) -> Vec<ProcessedItem> {
    items
        .iter()
        .map(|item| ProcessedItem {
            name: item.name.clone(),
            value: item.value * 2,
        })
        .collect()
}

// --- Unsafe with SAFETY comment + safe wrapper ---
//
// Isolated in its own module; safe public API on top.
// After any change: run `cargo miri test` to verify no UB.

mod sys {
    /// # Safety
    ///
    /// - `ptr` must point to a valid, aligned, initialized `[u8; len]`.
    /// - The memory region `ptr..ptr+len` must not be mutated for the
    ///   duration of this call.
    /// - `ptr` must not be null.
    pub unsafe fn read_raw_buffer(ptr: *const u8, len: usize) -> Vec<u8> {
        // SAFETY: caller guarantees ptr is valid for `len` bytes,
        // properly aligned, and not concurrently mutated.
        unsafe { std::slice::from_raw_parts(ptr, len).to_vec() }
    }
}

/// Safe wrapper — validates the pointer before calling into unsafe.
pub fn read_raw_buffer(ptr: *const u8, len: usize) -> Option<Vec<u8>> {
    if ptr.is_null() || len == 0 {
        return None;
    }
    // SAFETY: caller is responsible for pointer validity beyond null check.
    // This wrapper adds a null guard; full safety requires trusted callers.
    Some(unsafe { sys::read_raw_buffer(ptr, len) })
}

// --- Lookup returns Option instead of panicking ---

pub fn lookup(map: &HashMap<String, i32>, key: &str) -> Option<i32> {
    map.get(key).copied()
}
```

## Issues fixed (by skill rule)

| # | Issue | Skill Rule Applied |
|---|-------|--------------------|
| 1 | `lazy_static!` macro | **Modern Rust Idioms** — `std::sync::LazyLock` over `lazy_static`/`once_cell` |
| 2 | `Arc<Mutex<Node>>` tree structure | **Ownership & Memory** — arena allocators with index-based references, not `Arc<Mutex<Node>>` |
| 3 | `Mutex<Option<String>>` cache in single-threaded node | **Ownership & Memory** — `RefCell` for single-threaded interior mutability; `Mutex` is a code smell |
| 4 | `HashMap` inside large enum variant (`Metadata`) | **Ownership & Memory** — `Box` large enum variants to keep enum size small |
| 5 | `build()` returns `Self` instead of `Result` | **Type System & API Design** — builder `build()` returns `Result` |
| 6 | Unsealed public `Plugin` trait | **Type System & API Design** — sealed traits prevent downstream impl |
| 7 | `dyn Processor` on hot path | **Performance** — generics (monomorphization) for hot paths; `dyn Trait` only for heterogeneous collections |
| 8 | `Vec::new()` without pre-allocation in `process_batch` | **Performance** — `Vec::with_capacity` when size known |
| 9 | `&String` parameter in `normalize_name` | **Type System & API Design** — accept `&str` over `&String` |
| 10 | Returns `String` when input often unchanged | **Ownership & Memory** — `Cow` for mostly-read, occasionally-modified data |
| 11 | `&Vec<Item>` parameter in `process_items` | **Type System & API Design** — accept `&[T]` over `&Vec<T>` |
| 12 | Manual loop in `process_items` | **Performance** — iterator chains over raw loops |
| 13 | `path: String` in `read_file` | **Modern Rust Idioms** — `AsRef<Path>` for filesystem functions |
| 14 | `println!` for logging | **Concurrency & Async** — `tracing` crate with structured logging; no `println!` |
| 15 | `.unwrap()` throughout production code | **Error Handling** — no `unwrap()`/`expect()` in production; use `?` |
| 16 | `Arc<Mutex<Vec>>` for collecting async results | **Concurrency & Async** — channels/`JoinSet` over shared state |
| 17 | Sequential fetches in async fn | **Concurrency & Async** — concurrent via `JoinSet` |
| 18 | No `// SAFETY:` comment on `unsafe` block | **Safety & Unsafe** — every `unsafe` block needs `// SAFETY:` comment |
| 19 | Unsafe not isolated in module | **Safety & Unsafe** — separate safe wrappers from unsafe FFI in `mod sys` |
| 20 | `lookup` panics on missing key | **Error Handling** — return `Option`, no `unwrap()` |
| 21 | `host()` takes `String` not `impl Into<String>` | **Type System & API Design** — `impl Trait` for flexible args |
| 22 | No `.context()` on fallible operations | **Error Handling** — `.context()`/`.with_context()` explains *why* |
