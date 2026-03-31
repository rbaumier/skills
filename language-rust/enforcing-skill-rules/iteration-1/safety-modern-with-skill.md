```rust
use std::path::Path;
use std::sync::{LazyLock, Mutex};

// Replace lazy_static! with std::sync::LazyLock (stable since Rust 1.80)
static GLOBAL_CONFIG: LazyLock<Mutex<Config>> = LazyLock::new(|| Mutex::new(Config::default()));

// Derive Default instead of manual impl — less code, same behavior
#[derive(Default)]
struct Config {
    name: String,
    values: Vec<i32>,
}

// Use const generics for compile-time matrix dimensions — invalid sizes won't compile
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

// Accept AsRef<Path> — works with String, &str, PathBuf, Path
fn read_config(path: impl AsRef<Path>) -> std::io::Result<String> {
    std::fs::read_to_string(path)
}

// Replace nested match with Option combinators — zip + map
fn process_optional(a: Option<i32>, b: Option<i32>) -> Option<i32> {
    a.zip(b).map(|(x, y)| x + y)
}

// Separate unsafe FFI declarations into a sys module — clean boundary
mod sys {
    unsafe extern "C" {
        pub fn external_init(ptr: *mut u8, len: usize) -> i32;
        pub fn external_process(ptr: *const u8, len: usize) -> i32;
    }
}

// Use thiserror for structured errors instead of raw strings
#[derive(Debug, thiserror::Error)]
pub enum LibError {
    #[error("init failed with code {0}")]
    InitFailed(i32),
    #[error("process failed with code {0}")]
    ProcessFailed(i32),
}

// Safe wrapper with SAFETY comments on every unsafe block
pub fn init_library(data: &mut [u8]) -> Result<(), LibError> {
    // SAFETY: data is a valid mutable slice; pointer and length are consistent.
    // external_init is documented to only write within [ptr, ptr+len).
    let ret = unsafe { sys::external_init(data.as_mut_ptr(), data.len()) };
    if ret != 0 {
        return Err(LibError::InitFailed(ret));
    }
    Ok(())
}

pub fn process_data(data: &[u8]) -> Result<(), LibError> {
    // SAFETY: data is a valid shared slice; pointer and length are consistent.
    // external_process is documented to only read within [ptr, ptr+len).
    let ret = unsafe { sys::external_process(data.as_ptr(), data.len()) };
    if ret != 0 {
        return Err(LibError::ProcessFailed(ret));
    }
    Ok(())
}
```

### Changes applied

1. **`LazyLock` over `lazy_static!`** — std-only since Rust 1.80, removes the external dependency.
2. **`#[derive(Default)]`** — eliminates boilerplate manual `Default` impl.
3. **Const generics for `Matrix`** — dimensions checked at compile time; stack-allocated `[[f64; COLS]; ROWS]` replaces heap-allocated `Vec<Vec<f64>>`.
4. **`impl AsRef<Path>`** for `read_config` — accepts `&str`, `String`, `PathBuf`, and `&Path` without forcing callers to convert.
5. **`a.zip(b).map(…)`** — replaces nested `match` with idiomatic combinator chain.
6. **`mod sys` for FFI** — isolates unsafe extern declarations from safe wrappers.
7. **`// SAFETY:` comments** on every `unsafe` block, justifying invariants.
8. **`thiserror` enum** — structured `LibError` replaces ad-hoc `String` errors; enables pattern matching on error variants and `.context()` chaining in callers.
9. **`unsafe extern "C"`** — Rust 2024 edition syntax making the unsafety of extern blocks explicit.
