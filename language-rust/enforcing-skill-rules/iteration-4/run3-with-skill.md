```rust
use std::borrow::Cow;
use std::collections::HashMap;
use std::sync::LazyLock;

use tracing::info;

// --- Global Config ---
// LazyLock replaces lazy_static (Modern Rust 2024+, std::sync::LazyLock over lazy_static)
static CONFIG: LazyLock<HashMap<String, String>> = LazyLock::new(load_config);

// --- Tree / AST types ---
// Arena-based AST avoids Arc<Mutex<Node>> sprawl (bumpalo arenas with index references).
// Box large enum variants to keep enum size small.

pub type NodeId = usize;

#[derive(Debug)]
pub enum NodeKind {
    Leaf(String),
    Branch(Vec<NodeId>),
    Metadata(Box<HashMap<String, String>>), // Boxed: rarely used, keeps enum small
}

#[derive(Debug)]
pub struct Node {
    pub kind: NodeKind,
    pub parent: Option<NodeId>,
    // Cache uses RefCell for single-threaded interior mutability (not Mutex).
    pub cache: std::cell::RefCell<Option<String>>,
}

/// Arena allocator for tree nodes — avoids Rc/Arc cycles entirely.
#[derive(Debug, Default)]
pub struct Arena {
    nodes: Vec<Node>,
}

impl Arena {
    pub fn new() -> Self {
        Self { nodes: Vec::new() }
    }

    pub fn alloc(&mut self, node: Node) -> NodeId {
        let id = self.nodes.len();
        self.nodes.push(node);
        id
    }

    pub fn get(&self, id: NodeId) -> Option<&Node> {
        self.nodes.get(id)
    }
}

// --- Builder (typestate pattern) ---
// Builder<Pending> -> Builder<Ready> enforces compile-time state transitions.
// build() returns Result, not Self.

pub struct Pending;
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

    pub fn host(mut self, h: impl Into<String>) -> Self {
        self.host = Some(h.into());
        self
    }

    pub fn port(mut self, p: u16) -> ServerConfigBuilder<Ready> {
        self.port = Some(p);
        ServerConfigBuilder {
            host: self.host,
            port: self.port,
            _state: std::marker::PhantomData,
        }
    }
}

impl Default for ServerConfigBuilder<Pending> {
    fn default() -> Self {
        Self::new()
    }
}

impl ServerConfigBuilder<Ready> {
    /// Build returns Result — never Self.
    pub fn build(self) -> Result<ServerConfig, &'static str> {
        Ok(ServerConfig {
            host: self.host.ok_or("host is required")?,
            port: self.port.ok_or("port is required")?,
        })
    }
}

// --- Public trait (sealed) ---
// Sealed trait prevents downstream impl; allows future evolution.

mod private {
    pub trait Sealed {}
}

pub trait Plugin: private::Sealed {
    fn name(&self) -> &str;
    fn execute(&self, input: &[u8]) -> Vec<u8>;
}

// --- Hot-path processing with generics ---
// Generics (monomorphization) for hot paths; dyn Trait only for heterogeneous collections.
// Iterator chains over raw loops — better compiler vectorization.

pub trait Processor {
    fn apply(&self, val: f64) -> f64;
}

pub fn process_batch<P: Processor>(processor: &P, data: &[f64]) -> Vec<f64> {
    data.iter().map(|&val| processor.apply(val)).collect()
}

/// Heterogeneous variant — only when multiple distinct processor types are needed.
pub fn process_batch_dyn(processors: &[Box<dyn Processor>], data: &[f64]) -> Vec<f64> {
    let mut out = Vec::with_capacity(data.len() * processors.len());
    for &val in data {
        for p in processors {
            out.push(p.apply(val));
        }
    }
    out
}

// --- File I/O ---
// Accept AsRef<Path> for filesystem functions — accepts String, &str, PathBuf, Path.
// Return Result, not panic. No println! — use tracing.

pub fn read_file(path: impl AsRef<std::path::Path>) -> Result<String, std::io::Error> {
    let path = path.as_ref();
    info!(?path, "reading file");
    std::fs::read_to_string(path)
}

// --- Original functions ---
// Cow for mostly-read, occasionally-modified data.
// Accept &str over &String.

pub fn normalize_name(name: &str) -> Cow<'_, str> {
    if name.contains('-') {
        Cow::Owned(name.replace('-', "_"))
    } else {
        Cow::Borrowed(name)
    }
}

/// Fetch URLs concurrently with proper async patterns.
/// Uses channels over Arc<Mutex<Vec>> for collecting results.
/// Uses tracing instead of println!.
/// Propagates errors via Result instead of unwrap().
pub async fn fetch_and_process(
    urls: &[String],
) -> Result<Vec<String>, reqwest::Error> {
    let (tx, mut rx) = tokio::sync::mpsc::channel(urls.len());

    for url in urls {
        let tx = tx.clone();
        let url = url.clone();
        tokio::spawn(async move {
            let result = reqwest::get(&url).await?.text().await;
            match result {
                Ok(body) => {
                    info!(bytes = body.len(), %url, "fetched");
                    let _ = tx.send(Ok(body)).await;
                }
                Err(e) => {
                    let _ = tx.send(Err(e)).await;
                }
            }
            Ok::<(), reqwest::Error>(())
        });
    }

    drop(tx); // Close sender so rx terminates

    let mut results = Vec::with_capacity(urls.len());
    while let Some(item) = rx.recv().await {
        results.push(item?);
    }
    Ok(results)
}

// Accept &[Item] over &Vec<Item>.
// Iterator chain over raw loop.
// Pre-allocate with known size.

pub fn process_items(items: &[Item]) -> Vec<ProcessedItem> {
    items
        .iter()
        .map(|item| ProcessedItem {
            name: item.name.clone(),
            value: item.value * 2,
        })
        .collect()
}

/// # Safety
///
/// - `ptr` must be non-null and point to a valid allocation of at least `len` bytes.
/// - The memory region `[ptr, ptr + len)` must be initialized and properly aligned.
/// - The caller must ensure the data is not concurrently mutated.
///
/// After ANY unsafe block → run `cargo miri test` to verify undefined behavior.
pub unsafe fn read_raw_buffer(ptr: *const u8, len: usize) -> Vec<u8> {
    assert!(!ptr.is_null(), "read_raw_buffer: null pointer");
    // SAFETY: Caller guarantees ptr is valid for `len` bytes, properly aligned,
    // and not concurrently mutated. We assert non-null above.
    unsafe { std::slice::from_raw_parts(ptr, len).to_vec() }
}

/// Returns None if key is missing instead of panicking.
/// No unwrap() in production — use Option/Result.
pub fn lookup(map: &HashMap<String, i32>, key: &str) -> Option<i32> {
    map.get(key).copied()
}
```

## Issues Fixed (mapped to SKILL.md rules)

| # | Original Issue | Rule Applied | Fix |
|---|---------------|-------------|-----|
| 1 | `lazy_static!` macro | **Modern Rust Idioms**: `std::sync::LazyLock` over `lazy_static` | Replaced with `static .. LazyLock::new()` |
| 2 | `Arc<Mutex<Node>>` tree/AST | **Ownership**: Arena allocators over `Rc<RefCell<T>>` sprawl for graphs/ASTs | Arena with `NodeId = usize` index references |
| 3 | `Mutex<Option<String>>` cache in single-threaded Node | **Ownership**: `Cell/RefCell` for single-threaded interior mutability, Mutex is a code smell | Changed to `RefCell<Option<String>>` |
| 4 | `HashMap` variant same size as `Vec` in enum | **Ownership**: Box large enum variants to keep enum size small | `Metadata(Box<HashMap<..>>)` |
| 5 | `build()` returns `Self` | **API Design**: Builder `build()` returns `Result` | Returns `Result<ServerConfig, &'static str>` |
| 6 | No typestate on builder | **API Design**: Typestate pattern for compile-time state transitions | `ServerConfigBuilder<Pending>` / `<Ready>` |
| 7 | `host(h: String)` | **API Design**: `impl Into<String>` for flexible args | `host(h: impl Into<String>)` |
| 8 | Missing `Default` on builder | Clippy: `new()` without `Default` impl | Added `impl Default` |
| 9 | Unsealed public `Plugin` trait | **API Design**: Sealed traits prevent downstream impl | Added `mod private` seal |
| 10 | `dyn Processor` on hot path | **Performance**: Generics (monomorphization) for hot paths | Generic `process_batch<P: Processor>`, kept dyn variant separate |
| 11 | Raw loop in `process_batch` | **Performance**: Iterator chains over raw loops | `.iter().map().collect()` |
| 12 | No `Vec::with_capacity` | **Performance**: Pre-allocate when size known | Added `with_capacity` where applicable |
| 13 | `read_file(path: String)` | **Modern Idioms**: `AsRef<Path>` for filesystem functions | `impl AsRef<std::path::Path>` |
| 14 | `read_file` panics with `.unwrap()` | **Error Handling**: No `unwrap()` in production | Returns `Result<String, std::io::Error>` |
| 15 | `println!` in async/production code | **Concurrency**: `tracing` crate, no `println!` in async code | Replaced with `tracing::info!` |
| 16 | `normalize_name(name: &String)` | **API Design**: Accept `&str` over `&String` | Changed to `&str` |
| 17 | `normalize_name` returns `String` (allocates on no-op path) | **Ownership**: `Cow` for mostly-read, occasionally-modified data | Returns `Cow<'_, str>` |
| 18 | `fetch_and_process` uses `Arc<Mutex<Vec>>` | **Concurrency**: Channels over shared state | `tokio::sync::mpsc::channel` |
| 19 | `fetch_and_process` sequential fetches | **Concurrency**: Spawned concurrent tasks | `tokio::spawn` for parallelism |
| 20 | `fetch_and_process(urls: Vec<String>)` takes ownership | **API Design**: Accept `&[T]` over `&Vec<T>` | Changed to `&[String]` |
| 21 | `.unwrap()` on reqwest calls | **Error Handling**: No `unwrap()` in production | Propagates `Result` with `?` |
| 22 | `process_items(&Vec<Item>)` | **API Design**: `&[T]` over `&Vec<T>` | Changed to `&[Item]` |
| 23 | `unsafe fn` missing `// SAFETY:` comment | **Safety**: Every unsafe block needs SAFETY comment | Added `// SAFETY:` + doc comment |
| 24 | No null check in `read_raw_buffer` | **Safety**: Justify invariants | Added `assert!(!ptr.is_null())` |
| 25 | `lookup` panics with `.unwrap()` | **Error Handling**: No `unwrap()` in production | Returns `Option<i32>` with `.copied()` |
| 26 | Unused `PathBuf` import | **Code Quality**: No orphan imports | Removed |
