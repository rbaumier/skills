# Refactored Rust Code — Modern Idioms & Safety Fixes

```rust
// Replace lazy_static with std::sync::OnceLock (stable since Rust 1.70, no external crate needed)
use std::sync::{Mutex, OnceLock};
use std::path::Path;

fn global_config() -> &'static Mutex<Config> {
    static INSTANCE: OnceLock<Mutex<Config>> = OnceLock::new();
    INSTANCE.get_or_init(|| Mutex::new(Config::default()))
}

// Derive Default instead of manual impl — less boilerplate, same behavior
#[derive(Default)]
struct Config {
    name: String,
    values: Vec<i32>,
}

// Fixed-size matrix — flat Vec avoids nested allocation and improves cache locality
struct Matrix {
    data: Vec<f64>,
    rows: usize,
    cols: usize,
}

impl Matrix {
    fn new(rows: usize, cols: usize) -> Self {
        Matrix {
            data: vec![0.0; rows * cols],
            rows,
            cols,
        }
    }

    // Index helper: row-major access
    fn get(&self, row: usize, col: usize) -> f64 {
        self.data[row * self.cols + col]
    }

    fn set(&mut self, row: usize, col: usize, val: f64) {
        self.data[row * self.cols + col] = val;
    }
}

// Accept &Path instead of PathBuf — avoids forcing callers to allocate
fn read_config(path: &Path) -> std::io::Result<String> {
    std::fs::read_to_string(path)
}

// Replace nested match with Option::zip combinator — clearer intent
fn process_optional(a: Option<i32>, b: Option<i32>) -> Option<i32> {
    a.zip(b).map(|(x, y)| x + y)
}

// Mark FFI block as unsafe extern — Rust 2024 edition requires explicit unsafe on extern blocks.
// This makes the unsafety of calling foreign functions visible at the declaration site.
unsafe extern "C" {
    fn external_init(ptr: *mut u8, len: usize) -> i32;
    fn external_process(ptr: *const u8, len: usize) -> i32;
}

// Use a proper error type instead of String — enables ? operator and composability
#[derive(Debug)]
pub enum LibError {
    Init(i32),
    Process(i32),
}

impl std::fmt::Display for LibError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LibError::Init(code) => write!(f, "init failed: {code}"),
            LibError::Process(code) => write!(f, "process failed: {code}"),
        }
    }
}

impl std::error::Error for LibError {}

pub fn init_library(data: &mut [u8]) -> Result<(), LibError> {
    // SAFETY: external_init receives a valid mutable slice pointer and its exact length.
    // The caller guarantees `data` is live for the duration of the call.
    let ret = unsafe { external_init(data.as_mut_ptr(), data.len()) };
    if ret != 0 {
        return Err(LibError::Init(ret));
    }
    Ok(())
}

pub fn process_data(data: &[u8]) -> Result<(), LibError> {
    // SAFETY: external_process receives a valid shared slice pointer and its exact length.
    // The caller guarantees `data` is live for the duration of the call.
    let ret = unsafe { external_process(data.as_ptr(), data.len()) };
    if ret != 0 {
        return Err(LibError::Process(ret));
    }
    Ok(())
}
```

## Changes Summary

| Area | Before | After | Why |
|---|---|---|---|
| Global state | `lazy_static!` (external crate) | `std::sync::OnceLock` | Zero dependencies, stable since 1.70 |
| Config default | Manual `impl Default` | `#[derive(Default)]` | Less boilerplate, identical behavior |
| Matrix storage | `Vec<Vec<f64>>` | Flat `Vec<f64>` | Single allocation, cache-friendly |
| File path arg | `PathBuf` (owned) | `&Path` (borrowed) | Avoids forcing caller allocation |
| Option handling | Nested `match` | `zip` + `map` | Idiomatic combinator, clearer intent |
| FFI declaration | `extern "C"` | `unsafe extern "C"` | Rust 2024 edition compliance |
| FFI safety | No safety comments | `// SAFETY:` annotations | Documents invariants per Rust convention |
| Error handling | `String` errors | Custom `LibError` enum | Type-safe, composable, implements `Error` |
