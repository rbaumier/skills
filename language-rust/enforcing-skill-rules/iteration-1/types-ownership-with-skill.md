# Refactored Rust Code

```rust
use std::sync::{Arc, Weak, Mutex};

// Parse, don't validate — newtype guarantees validity post-construction.
// Callers cannot create an invalid Email.
pub struct Email(String);

impl Email {
    pub fn new(raw: &str) -> Result<Self, &'static str> {
        if raw.contains('@') && raw.len() > 3 {
            Ok(Self(raw.to_owned()))
        } else {
            Err("invalid email address")
        }
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

// Accept &str over &String — more flexible, avoids unnecessary allocation.
fn send_email(email: &Email, body: &str) {
    println!("Sending to {}: {}", email.as_str(), body);
}

// Typestate pattern — generics enforce compile-time state transitions.
// Builder<Pending> cannot call build(); only Builder<Ready> can.
pub struct Pending;
pub struct Ready;

pub struct ConfigBuilder<State = Pending> {
    host: String,
    port: u16,
    debug: bool,
    _state: std::marker::PhantomData<State>,
}

pub struct Config {
    pub host: String,
    pub port: u16,
    pub debug: bool,
}

impl ConfigBuilder<Pending> {
    pub fn new() -> Self {
        Self {
            host: String::new(),
            port: 0,
            debug: false,
            _state: std::marker::PhantomData,
        }
    }

    // Setters return Self for chaining (builder pattern).
    // set_host transitions Pending -> Ready since host is required.
    pub fn host(self, host: impl Into<String>) -> ConfigBuilder<Ready> {
        ConfigBuilder {
            host: host.into(),
            port: self.port,
            debug: self.debug,
            _state: std::marker::PhantomData,
        }
    }
}

impl ConfigBuilder<Ready> {
    // Optional setters stay in Ready state.
    pub fn port(mut self, port: u16) -> Self {
        self.port = port;
        self
    }

    pub fn debug(mut self, debug: bool) -> Self {
        self.debug = debug;
        self
    }

    // build() only available on Ready — missing host won't compile.
    pub fn build(self) -> Config {
        Config {
            host: self.host,
            port: self.port,
            debug: self.debug,
        }
    }
}

// Typestate pattern for connection — authenticate() only callable on Connected.
// Invalid transitions are compile errors, not runtime bugs.
pub struct Disconnected;
pub struct Connected;
pub struct Authenticated;

pub struct Connection<State = Disconnected> {
    token: Option<String>,
    _state: std::marker::PhantomData<State>,
}

impl Connection<Disconnected> {
    pub fn new() -> Self {
        Self { token: None, _state: std::marker::PhantomData }
    }

    pub fn connect(self) -> Connection<Connected> {
        Connection { token: None, _state: std::marker::PhantomData }
    }
}

impl Connection<Connected> {
    // Can only authenticate from Connected state — enforced at compile time.
    pub fn authenticate(self, token: String) -> Connection<Authenticated> {
        Connection {
            token: Some(token),
            _state: std::marker::PhantomData,
        }
    }
}

impl Connection<Authenticated> {
    pub fn token(&self) -> &str {
        // Safe: token is always Some in Authenticated state by construction.
        self.token.as_deref().unwrap_or_default()
    }
}

// Weak<T> back-reference prevents reference-cycle leaks.
pub struct TreeNode {
    pub value: i32,
    pub children: Vec<Arc<Mutex<TreeNode>>>,
    pub parent: Option<Weak<Mutex<TreeNode>>>, // Weak breaks the cycle
}

// Copy small types (<= 24 bytes) by value — Point is 16 bytes, derives Copy.
#[derive(Debug, Clone, Copy)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

// Takes Point by value since it's Copy — no reference needed.
pub fn distance(p1: Point, p2: Point) -> f64 {
    ((p1.x - p2.x).powi(2) + (p1.y - p2.y).powi(2)).sqrt()
}

// Box large enum variants to keep enum size small.
// Without Box, every Expr is as large as the largest variant (BinaryOp with two recursive Exprs).
pub enum Expr {
    Literal(i64),
    BinaryOp {
        op: Box<str>,        // Box<str> over String — immutable, one fewer pointer indirection
        left: Box<Expr>,     // Box the recursive variants
        right: Box<Expr>,
    },
    Block(Vec<Expr>),
}

// Sealed trait — prevents downstream crates from implementing Plugin,
// allowing future evolution without breaking changes.
mod private {
    pub trait Sealed {}
}

pub trait Plugin: private::Sealed {
    fn name(&self) -> &str;
    fn execute(&self);
}
```

## Summary of Changes

| Rule Applied | Before | After |
|---|---|---|
| **Parse, don't validate** | Bare `&String` email param | `Email` newtype with validated construction |
| **Accept `&str` over `&String`** | `fn send_email(email: &String, body: &String)` | `fn send_email(email: &Email, body: &str)` |
| **Typestate pattern** | `Config` with mutable setters, no build step | `ConfigBuilder<Pending>` / `ConfigBuilder<Ready>` with `build()` |
| **Typestate pattern** | `Connection::authenticate` callable in any state | Only callable on `Connection<Connected>` |
| **Weak back-references** | `parent: Option<Arc<Mutex<TreeNode>>>` (cycle!) | `parent: Option<Weak<Mutex<TreeNode>>>` |
| **Copy small types** | `Point` passed by reference (16 bytes) | `#[derive(Copy, Clone)]`, passed by value |
| **Box large enum variants** | `Expr` with inline recursive variants | `Box<Expr>` for `left`/`right`; `Box<str>` for `op` |
| **Sealed traits** | `pub trait Plugin` open to all | Sealed via `private::Sealed` supertrait |
| **Builder pattern** | Mutable setters returning `()` | Chained setters returning `Self`, `build()` returns value |
