# Refactored Rust Code (Without Skill)

```rust
use std::collections::HashMap;
use std::sync::{Arc, Mutex, Weak};

// Change: Accept &str instead of &String — more general, avoids unnecessary indirection.
fn send_email(email: &str, body: &str) {
    println!("Sending to {}: {}", email, body);
}

// Change: Use builder pattern with method chaining (self -> Self) for ergonomic construction.
// Added Default derive to replace manual new().
#[derive(Default)]
struct Config {
    host: String,
    port: u16,
    debug: bool,
}

impl Config {
    // Change: Builder methods take owned self, return Self for chaining.
    // Accept Into<String> to allow both &str and String without caller needing .to_string().
    fn host(mut self, host: impl Into<String>) -> Self {
        self.host = host.into();
        self
    }

    fn port(mut self, port: u16) -> Self {
        self.port = port;
        self
    }

    fn debug(mut self, debug: bool) -> Self {
        self.debug = debug;
        self
    }
}

// Change: Use typestate pattern to enforce valid state transitions at compile time.
// Invalid transitions (e.g., authenticate from Disconnected) become impossible.
struct Disconnected;
struct Connected;
struct Authenticated;

struct Connection<S> {
    _state: S,
    token: Option<String>,
}

impl Connection<Disconnected> {
    fn new() -> Self {
        Connection { _state: Disconnected, token: None }
    }

    fn connect(self) -> Connection<Connected> {
        Connection { _state: Connected, token: None }
    }
}

impl Connection<Connected> {
    // Change: authenticate() is only callable on a Connected connection — enforced by the type system.
    fn authenticate(self, token: String) -> Connection<Authenticated> {
        Connection { _state: Authenticated, token: Some(token) }
    }
}

// Change: Use Weak for parent back-reference to break the reference cycle.
// Arc<Mutex<TreeNode>> for children (owns), Weak<Mutex<TreeNode>> for parent (borrows).
struct TreeNode {
    value: i32,
    children: Vec<Arc<Mutex<TreeNode>>>,
    parent: Option<Weak<Mutex<TreeNode>>>, // Weak breaks the cycle
}

// Change: Derive Copy + Clone for small, stack-allocated types.
// This avoids unnecessary references and heap allocation for trivial data.
#[derive(Debug, Clone, Copy)]
struct Point {
    x: f64,
    y: f64,
}

// Change: Accept by value (Copy) instead of reference — simpler API, same performance.
fn distance(p1: Point, p2: Point) -> f64 {
    ((p1.x - p2.x).powi(2) + (p1.y - p2.y).powi(2)).sqrt()
}

// Change: Box recursive variants to give the enum a known size and avoid stack overflow.
// Use Box<str> instead of String for op — it's immutable after creation, saves a word of storage.
enum Expr {
    Literal(i64),
    BinaryOp { op: Box<str>, left: Box<Expr>, right: Box<Expr> }, // Box<Expr> for indirection
    Block(Vec<Expr>),
}

// Change: Mark trait as non_exhaustive so adding methods later is non-breaking.
// Use #[non_exhaustive] on the trait if it should not be implemented by external crates,
// or keep it open if external impls are desired. Here we keep it open but add Send + Sync
// bounds so plugins are safe to use across threads.
pub trait Plugin: Send + Sync {
    fn name(&self) -> &str;
    fn execute(&self);
}
```

## Summary of Changes

| Original Issue | Fix Applied |
|---|---|
| `&String` parameters | Changed to `&str` — more idiomatic, accepts both `&String` and `&str` |
| `Config` manual `new()` + `set_*` setters | `#[derive(Default)]` + consuming builder pattern with method chaining |
| `Connection` state machine with runtime bugs | Typestate pattern — invalid transitions are compile errors |
| `TreeNode` parent `Arc` reference cycle | `Weak<Mutex<TreeNode>>` for parent to break the cycle |
| `Point` passed by reference | `#[derive(Copy, Clone)]` — pass by value for small types |
| `Expr` recursive enum without indirection | `Box<Expr>` for recursive variants; `Box<str>` for immutable string |
| `Plugin` trait missing thread-safety bounds | Added `Send + Sync` supertraits |
