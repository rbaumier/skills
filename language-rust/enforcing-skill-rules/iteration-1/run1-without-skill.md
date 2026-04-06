# Run 1 — Without Skill

```rust
use std::borrow::Cow;
use std::cell::RefCell;
use std::collections::HashMap;
use std::path::Path;
use std::sync::{LazyLock, OnceLock};

use anyhow::{Context, Result};
use rustc_hash::FxHashMap;
use thiserror::Error;
use tokio::sync::Mutex as TokioMutex;
use tracing::{debug, info};

// --- Global config via LazyLock (replaces lazy_static) ---

static CONFIG: LazyLock<HashMap<String, String>> = LazyLock::new(|| load_config_global());

fn load_config_global() -> HashMap<String, String> {
    HashMap::new() // placeholder
}

// --- Newtypes: parse, don't validate ---

#[derive(Debug, Clone)]
pub struct Email(String);

#[derive(Debug, Error)]
#[error("invalid email address: {0}")]
pub struct InvalidEmail(String);

impl Email {
    pub fn parse(raw: impl Into<String>) -> Result<Self, InvalidEmail> {
        let s = raw.into();
        if s.contains('@') && s.contains('.') {
            Ok(Email(s))
        } else {
            Err(InvalidEmail(s))
        }
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

// --- Domain types ---

pub fn send_email(to: &Email) {
    mailer.send(to.as_str());
}

pub fn register_user(email: Email, age: u8) {
    db.insert(email, age);
}

// --- Tree / AST types (arena-based) ---

pub type NodeId = usize;

#[derive(Debug)]
pub enum NodeKind {
    Leaf(String),
    Branch(Vec<NodeId>),
    Metadata(Box<HashMap<String, String>>),
}

#[derive(Debug)]
pub struct Node {
    pub kind: NodeKind,
    pub parent: Option<NodeId>,
    pub cache: RefCell<Option<String>>,
}

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

    pub fn get_mut(&mut self, id: NodeId) -> Option<&mut Node> {
        self.nodes.get_mut(id)
    }
}

// --- Builder ---

#[derive(Debug, Error)]
pub enum BuilderError {
    #[error("missing required field: {0}")]
    MissingField(&'static str),
}

pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

pub struct ServerConfigBuilder {
    host: Option<String>,
    port: Option<u16>,
}

impl ServerConfigBuilder {
    pub fn new() -> Self {
        Self {
            host: None,
            port: None,
        }
    }

    pub fn host(mut self, h: impl Into<String>) -> Self {
        self.host = Some(h.into());
        self
    }

    pub fn port(mut self, p: u16) -> Self {
        self.port = Some(p);
        self
    }

    pub fn build(self) -> Result<ServerConfig, BuilderError> {
        Ok(ServerConfig {
            host: self.host.ok_or(BuilderError::MissingField("host"))?,
            port: self.port.ok_or(BuilderError::MissingField("port"))?,
        })
    }
}

// --- Public trait (sealed) ---

mod private {
    pub trait Sealed {}
}

pub trait Plugin: private::Sealed {
    fn name(&self) -> &str;
    fn execute(&self, input: &[u8]) -> Vec<u8>;
}

// --- Hot-path processing with generics (monomorphized) ---

pub trait Processor {
    fn apply(&self, val: f64) -> f64;
}

pub fn process_batch<P: Processor>(processors: &[P], data: &[f64]) -> Vec<f64> {
    let mut out = Vec::with_capacity(data.len() * processors.len());
    for val in data {
        for p in processors {
            out.push(p.apply(*val));
        }
    }
    out
}

// --- File I/O ---

pub fn read_file(path: impl AsRef<Path>) -> Result<String> {
    let path = path.as_ref();
    debug!("reading file {}", path.display());
    std::fs::read_to_string(path)
        .with_context(|| format!("failed to read file at '{}'", path.display()))
}

// --- Error context (why, not what) ---

pub fn load_config(path: &Path) -> Result<Config> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("failed to load config from '{}'", path.display()))?;
    let config: Config = serde_json::from_str(&content)
        .with_context(|| {
            format!(
                "config file '{}' contains invalid JSON",
                path.display()
            )
        })?;
    Ok(config)
}

// --- Small copy type passed by value ---

#[derive(Debug, Clone, Copy)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

pub fn distance(a: Point, b: Point) -> f64 {
    ((a.x - b.x).powi(2) + (a.y - b.y).powi(2)).sqrt()
}

// --- Async mutex: drop guard before .await ---

pub async fn update_and_notify(state: &TokioMutex<AppState>, notifier: &Notifier) -> Result<()> {
    let value = {
        let mut guard = state.lock().await;
        guard.counter += 1;
        guard.current_value
    }; // guard dropped here, before .await
    notifier.send(value).await;
    Ok(())
}

// --- Collection choices: VecDeque instead of LinkedList ---

pub fn build_queue() -> Vec<Task> {
    (0..100).map(Task::new).collect()
}

// --- Fast hasher for integer keys ---

pub fn count_ids(ids: &[u64]) -> FxHashMap<u64, usize> {
    let mut map = FxHashMap::default();
    for &id in ids {
        *map.entry(id).or_insert(0) += 1;
    }
    map
}

// --- Cow for conditional modification ---

pub fn normalize_name(name: &str) -> Cow<'_, str> {
    if name.contains('-') {
        Cow::Owned(name.replace('-', "_"))
    } else {
        Cow::Borrowed(name)
    }
}

// --- Concurrent fetch with channels ---

pub async fn fetch_and_process(urls: Vec<String>) -> Result<Vec<String>> {
    let (tx, mut rx) = tokio::sync::mpsc::channel(urls.len());

    let handles: Vec<_> = urls
        .into_iter()
        .map(|url| {
            let tx = tx.clone();
            tokio::spawn(async move {
                let res = reqwest::get(&url).await?;
                let body = res.text().await?;
                info!(bytes = body.len(), url = %url, "fetched");
                tx.send(body)
                    .await
                    .map_err(|e| anyhow::anyhow!("channel send failed: {e}"))?;
                Ok::<(), anyhow::Error>(())
            })
        })
        .collect();

    drop(tx); // close sender so rx terminates

    let mut results = Vec::new();
    while let Some(body) = rx.recv().await {
        results.push(body);
    }

    // Propagate any task errors
    for handle in handles {
        handle.await??;
    }

    Ok(results)
}

// --- Iterator chains, accept &[T] ---

pub fn process_items(items: &[Item]) -> Vec<ProcessedItem> {
    items
        .iter()
        .map(|item| ProcessedItem {
            name: item.name.clone(),
            value: item.value * 2,
        })
        .collect()
}

// --- Unsafe with SAFETY comment ---

/// Reads `len` bytes from a raw pointer into an owned Vec.
///
/// # Safety
/// - `ptr` must point to a valid, aligned, contiguous allocation of at least `len` bytes.
/// - The memory region `[ptr, ptr + len)` must not be concurrently mutated.
/// - The caller must ensure `ptr` remains valid for the duration of this call.
pub unsafe fn read_raw_buffer(ptr: *const u8, len: usize) -> Vec<u8> {
    // SAFETY: caller guarantees ptr is valid for `len` bytes, properly aligned,
    // and the memory is not concurrently mutated. The resulting slice is
    // immediately copied into an owned Vec, so no dangling reference is held.
    unsafe { std::slice::from_raw_parts(ptr, len) }.to_vec()
}

// --- Lookup with proper error handling ---

#[derive(Debug, Error)]
#[error("key not found: {key}")]
pub struct LookupError {
    key: String,
}

pub fn lookup(map: &HashMap<String, i32>, key: &str) -> Result<i32, LookupError> {
    map.get(key).copied().ok_or_else(|| LookupError {
        key: key.to_owned(),
    })
}
```
