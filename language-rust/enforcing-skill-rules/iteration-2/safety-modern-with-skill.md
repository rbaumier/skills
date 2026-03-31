# Refactored Rust Code

```rust
use std::path::Path;
use std::sync::{LazyLock, Mutex};

// LazyLock replaces lazy_static (std since 1.80)
static GLOBAL_CONFIG: LazyLock<Mutex<Config>> = LazyLock::new(|| Mutex::new(Config::default()));

// Derive Default — no manual impl needed for simple zero-values
#[derive(Default)]
struct Config {
    name: String,
    values: Vec<i32>,
}

// Const generics encode dimensions at compile time — no runtime rows/cols fields
struct Matrix<const ROWS: usize, const COLS: usize> {
    data: [[f64; COLS]; ROWS],
}

impl<const ROWS: usize, const COLS: usize> Matrix<ROWS, COLS> {
    fn new() -> Self {
        Matrix {
            data: [[0.0; COLS]; ROWS],
        }
    }
}

// Accept AsRef<Path> — works with &str, String, PathBuf, &Path
fn read_config(path: impl AsRef<Path>) -> std::io::Result<String> {
    std::fs::read_to_string(path)
}

// Option combinators replace nested match
fn process_optional(a: Option<i32>, b: Option<i32>) -> Option<i32> {
    a.zip(b).map(|(x, y)| x + y)
}

// Isolate unsafe FFI in a dedicated module with safe public API
mod sys {
    extern "C" {
        fn external_init(ptr: *mut u8, len: usize) -> i32;
        fn external_process(ptr: *const u8, len: usize) -> i32;
    }

    /// # Errors
    /// Returns error string if the C library reports a non-zero status.
    pub fn init_library(data: &mut [u8]) -> Result<(), String> {
        // SAFETY: data.as_mut_ptr() is valid for data.len() bytes,
        // the slice is exclusively borrowed (&mut), and external_init
        // only writes within [ptr, ptr+len).
        let ret = unsafe { external_init(data.as_mut_ptr(), data.len()) };
        if ret != 0 {
            return Err(format!("init failed: {ret}"));
        }
        Ok(())
    }

    /// # Errors
    /// Returns error string if the C library reports a non-zero status.
    pub fn process_data(data: &[u8]) -> Result<(), String> {
        // SAFETY: data.as_ptr() is valid for data.len() bytes,
        // the slice is immutably borrowed, and external_process
        // performs read-only access within [ptr, ptr+len).
        let ret = unsafe { external_process(data.as_ptr(), data.len()) };
        if ret != 0 {
            return Err(format!("process failed: {ret}"));
        }
        Ok(())
    }
}

// Re-export safe API
pub use sys::{init_library, process_data};
```

## Changes Applied

| Before | After | Rationale |
|---|---|---|
| `lazy_static!` | `std::sync::LazyLock` | Std since 1.80, no external crate |
| Manual `Default` impl | `#[derive(Default)]` | Less code, same result |
| `Vec<Vec<f64>>` + runtime dims | `[[f64; COLS]; ROWS]` const generics | Compile-time dimensions, stack-allocated, cache-friendly |
| `PathBuf` param | `impl AsRef<Path>` | Accepts &str, String, PathBuf, &Path |
| Nested `match` on Options | `a.zip(b).map(\|(x, y)\| x + y)` | Idiomatic combinator |
| Bare `unsafe` in public fns | `mod sys` with `// SAFETY:` comments | Isolates FFI; justifies each unsafe block |
| `format!("...: {}", ret)` | `format!("...: {ret}")` | Inline format args (Rust 2021+) |

## Verification

Run `cargo miri test` after adding tests to detect undefined behavior in the unsafe FFI wrappers. Miri cannot test actual FFI calls, but it will validate all safe Rust paths and catch misuse of raw pointers in test doubles.
