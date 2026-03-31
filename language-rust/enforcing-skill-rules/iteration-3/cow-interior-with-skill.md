```rust
use std::borrow::Cow;
use std::cell::Cell;
use std::cell::RefCell;
use std::collections::HashMap;

/// Normalizes a username: trims whitespace, lowercases.
/// Returns Cow::Borrowed when already normalized (zero-alloc fast path).
fn normalize_username(name: &str) -> Cow<'_, str> {
    let trimmed = name.trim();
    if trimmed.chars().all(|c| c.is_lowercase() && !c.is_whitespace()) {
        Cow::Borrowed(trimmed) // no allocation when already normalized
    } else {
        Cow::Owned(trimmed.to_lowercase())
    }
}

/// Builds a greeting. Returns Cow::Borrowed when template has no placeholder.
fn greet<'a>(name: &str, template: Option<&'a str>) -> Cow<'a, str> {
    let tpl = template.unwrap_or("Hello, {}!");
    if tpl.contains("{}") {
        Cow::Owned(tpl.replace("{}", name))
    } else {
        Cow::Borrowed(tpl) // no allocation when template is static
    }
}

/// Single-threaded template renderer with a compile cache.
/// Uses RefCell instead of Mutex — correct tool for single-threaded interior mutability.
struct Renderer {
    cache: RefCell<HashMap<String, CompiledTemplate>>,
}

impl Renderer {
    fn new() -> Self {
        Renderer { cache: RefCell::new(HashMap::new()) }
    }

    fn render(&self, name: &str, ctx: &Context) -> String {
        // Entry API avoids double lookup (contains_key + insert).
        let mut cache = self.cache.borrow_mut();
        let compiled = cache
            .entry(name.to_owned())
            .or_insert_with(|| compile_template(name));
        compiled.render(ctx)
    }
}

/// Render-call statistics. Cell for Copy types, RefCell for String.
/// No Mutex overhead in single-threaded code.
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
