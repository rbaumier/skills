# Run 1 — With Skill

```rust
use std::borrow::Cow;
use std::cell::RefCell;
use std::collections::HashMap;
use std::path::Path;
use std::sync::LazyLock;

use anyhow::{Context, Result};
use rustc_hash::FxHashMap;
use tracing::{debug, info};

// --- Global config (OnceLock/LazyLock, not lazy_static) ---

static CONFIG: LazyLock<HashMap<String, String>> = LazyLock::new(|| load_config_map());

fn load_config_map() -> HashMap<String, String> {
    // Placeholder — real implementation loads from env/file
    HashMap::new()
}

// --- Domain types: parse, don't validate ---

/// Newtype guaranteeing a validated email address post-construction.
#[derive(Debug, Clone)]
pub struct Email(String);

impl Email {
    /// Parse and validate an email string. Returns `Err` if invalid.
    #[must_use = "returns Result that must be checked"]
    pub fn parse(raw: &str) -> Result<Self> {
        anyhow::ensure!(raw.contains('@'), "invalid email: missing '@' in {raw}");
        Ok(Self(raw.to_owned()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

pub fn send_email(to: &Email) -> Result<()> {
    // mailer.send(to.as_str())?;
    Ok(())
}

pub fn register_user(email: &Email, age: u8) -> Result<()> {
    // db.insert(email.as_str(), age)?;
    Ok(())
}

// --- Tree / AST types: arena + indices, not Arc<Mutex<Node>> ---

pub type NodeId = usize;

#[derive(Debug)]
pub enum NodeKind {
    Leaf(String),
    Branch(Vec<NodeId>),
    Metadata(Box<HashMap<String, String>>), // Box large variant to keep enum size small
}

#[derive(Debug)]
pub struct Node {
    pub kind: NodeKind,
    pub parent: Option<NodeId>,             // index back-reference, not Arc
    pub cache: RefCell<Option<String>>,     // single-threaded interior mutability, not Mutex
}

/// Arena-based tree. All nodes owned contiguously; referenced by index.
#[derive(Debug, Default)]
pub struct Arena {
    nodes: Vec<Node>,
}

impl Arena {
    pub fn new_node(&mut self, kind: NodeKind, parent: Option<NodeId>) -> NodeId {
        let id = self.nodes.len();
        self.nodes.push(Node {
            kind,
            parent,
            cache: RefCell::new(None),
        });
        id
    }

    pub fn get(&self, id: NodeId) -> Option<&Node> {
        self.nodes.get(id)
    }
}

// --- Builder: build() returns Result<ServerConfig, _>, #[must_use] ---

#[derive(Debug)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

#[must_use]
pub struct ServerConfigBuilder {
    host: Option<String>,
    port: Option<u16>,
}

impl ServerConfigBuilder {
    pub fn new() -> Self {
        Self { host: None, port: None }
    }

    pub fn host(mut self, h: &str) -> Self {
        self.host = Some(h.to_owned());
        self
    }

    pub fn port(mut self, p: u16) -> Self {
        self.port = Some(p);
        self
    }

    /// Consumes the builder and produces a validated `ServerConfig`.
    #[must_use = "build returns a Result that must be checked"]
    pub fn build(self) -> Result<ServerConfig> {
        Ok(ServerConfig {
            host: self.host.context("host is required")?,
            port: self.port.context("port is required")?,
        })
    }
}

// --- Public trait: sealed to prevent downstream impl ---

mod private {
    pub trait Sealed {}
}

pub trait Plugin: private::Sealed {
    fn name(&self) -> &str;
    fn execute(&self, input: &[u8]) -> Vec<u8>;
}

// --- Hot-path processing: generics (monomorphization), not dyn Trait ---

pub trait Processor {
    fn apply(&self, val: f64) -> f64;
}

/// Generic processor for hot-path — monomorphized, enables SIMD vectorization.
/// Pre-allocates output with known capacity. Uses iterator chains.
pub fn process_batch<P: Processor>(processor: &P, data: &[f64]) -> Vec<f64> {
    data.iter().map(|&val| processor.apply(val)).collect()
}

// --- File I/O: AsRef<Path>, tracing, proper error handling ---

/// Reads a file at the given path. Accepts String, &str, PathBuf, Path.
#[must_use = "returns Result that must be checked"]
pub fn read_file(path: impl AsRef<Path>) -> Result<String> {
    let path = path.as_ref();
    debug!(?path, "reading file");
    std::fs::read_to_string(path)
        .with_context(|| format!("failed to read file at {}", path.display()))
}

// --- Error context: explains WHY, not just WHAT ---

pub struct Config;

pub fn load_config(path: &Path) -> Result<Config> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("failed to load config from {}", path.display()))?;
    let config: Config = serde_json::from_str(&content)
        .with_context(|| {
            format!(
                "config at {} contains invalid JSON — check syntax and required fields",
                path.display()
            )
        })?;
    Ok(config)
}

// --- Small copy type passed by value (<= 24 bytes) ---

#[derive(Debug, Clone, Copy)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

pub fn distance(a: Point, b: Point) -> f64 {
    ((a.x - b.x).powi(2) + (a.y - b.y).powi(2)).sqrt()
}

// --- Async: drop MutexGuard before .await, use tokio::sync::Mutex ---

pub struct AppState {
    pub current_value: i64,
    pub counter: u64,
}

pub struct Notifier;

impl Notifier {
    pub async fn send(&self, _value: i64) -> Result<()> {
        Ok(())
    }
}

pub async fn update_and_notify(
    state: &tokio::sync::Mutex<AppState>,
    notifier: &Notifier,
) -> Result<()> {
    let value = {
        let mut guard = state.lock().await;
        guard.counter += 1;
        guard.current_value
        // guard dropped here — before .await
    };
    notifier.send(value).await?;
    Ok(())
}

// --- Collection choices: Vec over LinkedList, fast hasher for integer keys ---

pub struct Task {
    id: usize,
}

impl Task {
    pub fn new(id: usize) -> Self {
        Self { id }
    }
}

/// Vec for cache locality, pre-allocated with known capacity.
pub fn build_queue() -> Vec<Task> {
    (0..100).map(Task::new).collect()
}

/// Fast hasher (FxHashMap) for integer keys — avoids SipHash overhead.
pub fn count_ids(ids: &[u64]) -> FxHashMap<u64, usize> {
    let mut map = FxHashMap::with_capacity_and_hasher(ids.len(), Default::default());
    for &id in ids {
        *map.entry(id).or_insert(0) += 1;
    }
    map
}

// --- Cow for sometimes-modify pattern, accept &str not &String ---

/// Returns `Cow::Borrowed` when no change needed — zero allocation on the common path.
pub fn normalize_name(name: &str) -> Cow<'_, str> {
    if name.contains('-') {
        Cow::Owned(name.replace('-', "_"))
    } else {
        Cow::Borrowed(name)
    }
}

// --- Async fetch: channels over Arc<Mutex<Vec>>, tracing, no unwrap, concurrent ---

pub async fn fetch_and_process(urls: Vec<String>) -> Result<Vec<String>> {
    let (tx, mut rx) = tokio::sync::mpsc::channel(urls.len().max(1));

    for url in urls {
        let tx = tx.clone();
        tokio::spawn(async move {
            let res = reqwest::get(&url)
                .await
                .with_context(|| format!("failed to fetch {url}"));
            match res {
                Ok(response) => {
                    let body = response
                        .text()
                        .await
                        .with_context(|| format!("failed to read body from {url}"));
                    match body {
                        Ok(text) => {
                            info!(url = %url, bytes = text.len(), "fetched");
                            let _ = tx.send(Ok(text)).await;
                        }
                        Err(e) => {
                            let _ = tx.send(Err(e)).await;
                        }
                    }
                }
                Err(e) => {
                    let _ = tx.send(Err(e)).await;
                }
            }
        });
    }

    drop(tx); // close sender so rx completes

    let mut results = Vec::new();
    while let Some(result) = rx.recv().await {
        results.push(result?);
    }
    Ok(results)
}

// --- Iterator chain, accept &[T] not &Vec<T>, pre-allocate ---

pub struct Item {
    pub name: String,
    pub value: i32,
}

pub struct ProcessedItem {
    pub name: String,
    pub value: i32,
}

pub fn process_items(items: &[Item]) -> Vec<ProcessedItem> {
    items
        .iter()
        .map(|item| ProcessedItem {
            name: item.name.clone(),
            value: item.value * 2,
        })
        .collect()
}

// --- Unsafe with SAFETY comment, isolated in sys module ---

mod sys {
    /// Reads `len` bytes from a raw pointer into a safe `Vec<u8>`.
    ///
    /// # Safety
    /// - `ptr` must be valid for reads of `len` bytes.
    /// - The memory range `[ptr, ptr + len)` must be within a single allocated object.
    /// - `ptr` must be properly aligned for `u8` (always satisfied).
    /// - The memory must not be concurrently mutated for the duration of this call.
    pub unsafe fn read_raw_buffer(ptr: *const u8, len: usize) -> Vec<u8> {
        // SAFETY: Caller guarantees `ptr` is valid for `len` bytes, properly aligned,
        // and not concurrently mutated. `u8` has no invalid bit patterns.
        unsafe { std::slice::from_raw_parts(ptr, len) }.to_vec()
    }
}

// Re-export the safe documentation; actual call requires unsafe at call site.
pub use sys::read_raw_buffer;

// --- Lookup: no unwrap, returns Result ---

#[must_use = "returns Result that must be checked"]
pub fn lookup(map: &HashMap<String, i32>, key: &str) -> Result<i32> {
    map.get(key)
        .copied()
        .with_context(|| format!("key {key:?} not found in map"))
}
```
