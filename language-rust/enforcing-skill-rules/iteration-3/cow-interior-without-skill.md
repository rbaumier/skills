# Refactored Code (without skill)

```rust
use std::borrow::Cow;
use std::cell::{Cell, RefCell};

/// Normalizes a username: trims whitespace, lowercases.
/// Returns Cow::Borrowed when input is already normalized (zero-alloc fast path).
fn normalize_username(name: &str) -> Cow<'_, str> {
    let trimmed = name.trim();
    if trimmed.chars().all(|c| c.is_lowercase() && !c.is_whitespace()) {
        Cow::Borrowed(trimmed) // already normalized — no allocation
    } else {
        Cow::Owned(trimmed.to_lowercase())
    }
}

/// Builds a greeting. Returns Cow to avoid allocation when template has no placeholder.
fn greet<'a>(name: &str, template: Option<&'a str>) -> Cow<'a, str> {
    let tpl = template.unwrap_or("Hello, {}!");
    if tpl.contains("{}") {
        Cow::Owned(tpl.replace("{}", name))
    } else {
        Cow::Borrowed(tpl) // no substitution needed — borrow as-is
    }
}

/// Single-threaded template renderer with a compile cache.
/// Uses RefCell instead of Mutex — cheaper, correct for single-threaded use.
struct Renderer {
    cache: RefCell<HashMap<String, CompiledTemplate>>,
}

impl Renderer {
    fn new() -> Self {
        Renderer { cache: RefCell::new(HashMap::new()) }
    }

    fn render(&self, name: &str, ctx: &Context) -> String {
        // entry API avoids double lookup (contains_key + get)
        let mut cache = self.cache.borrow_mut();
        let compiled = cache
            .entry(name.to_owned())
            .or_insert_with(|| compile_template(name));
        compiled.render(ctx)
    }
}

/// Single-threaded stats tracker.
/// Cell for Copy types, RefCell for String — no Mutex overhead.
struct Stats {
    render_count: Cell<u64>,
    last_template: RefCell<String>,
}

impl Stats {
    fn record(&self, template_name: &str) {
        self.render_count.set(self.render_count.get() + 1);
        *self.last_template.borrow_mut() = template_name.to_owned();
    }

    fn count(&self) -> u64 {
        self.render_count.get()
    }
}
```

## Key changes

| Original | Refactored | Why |
|---|---|---|
| `String` return + `.to_owned()` | `Cow<'_, str>` | Zero-alloc when input already normalized or no substitution needed |
| `Mutex` on single-threaded structs | `RefCell` / `Cell` | No atomic overhead; panics on misuse instead of silently deadlocking |
| `contains_key` + `get` + `insert` | `entry().or_insert_with()` | Single hash lookup instead of two/three |
| `Cell<u64>` for counter | `Cell` instead of `Mutex` | Copy types use `Cell` — no borrow tracking, no lock |
