# Rust Performance Review

## 1. `process_ids` — Missing pre-allocation hint and iterator chain

**Issue**: `Vec::new()` starts with 0 capacity. With 10k+ elements, this triggers ~14 reallocations (each doubling). The manual loop also prevents LLVM from optimizing the iterator pipeline.

**Fix**: Use `Vec::with_capacity` or, better, collect from an iterator:

```rust
fn process_ids(ids: &[u64]) -> Vec<String> {
    ids.iter().map(|id| format!("id-{}", id)).collect()
}
```

`collect()` on `ExactSizeIterator` calls `with_capacity` internally. Single allocation, zero reallocations.

---

## 2. `build_index` — Missing capacity hint, unnecessary cloning

**Issue A**: `HashMap::new()` starts at capacity 0. With 100k+ entries, this causes repeated rehashing (expensive: re-bucket every entry).

**Issue B**: `key.clone()` allocates a new `String` for every entry. If the caller doesn't need `entries` afterward, accept owned data instead.

**Fix (minimal — keep signature)**:

```rust
fn build_index(entries: &[(String, u64)]) -> HashMap<String, u64> {
    entries.iter().map(|(k, v)| (k.clone(), *v)).collect()
}
```

`collect()` into `HashMap` uses the size hint for initial capacity.

**Fix (zero-copy — change signature)**:

```rust
fn build_index(entries: Vec<(String, u64)>) -> HashMap<String, u64> {
    let mut map = HashMap::with_capacity(entries.len());
    for (key, val) in entries {
        map.insert(key, val); // moves, no clone
    }
    map
}
```

At 100k entries, eliminating clones saves ~100k heap allocations.

---

## 3. `EventQueue` — `LinkedList` is almost always wrong

**Issue**: `LinkedList` has per-node heap allocation and terrible cache locality. Every `push_back` allocates. Every `pop_front` deallocates. The nodes are scattered across the heap, causing cache misses on every traversal.

**Fix**: Use `VecDeque`, which is a ring buffer — contiguous memory, amortized O(1) push/pop on both ends, cache-friendly:

```rust
use std::collections::VecDeque;

struct EventQueue {
    events: VecDeque<Event>,
}

impl EventQueue {
    fn push(&mut self, event: Event) {
        self.events.push_back(event);
    }
    fn pop(&mut self) -> Option<Event> {
        self.events.pop_front()
    }
}
```

Drop-in replacement. Strictly better in every dimension for FIFO queues.

---

## 4. `run_pipeline` — Dynamic dispatch overhead on hot path

**Issue**: `Box<dyn Processor>` forces a vtable lookup on every call. When called millions of times, the indirect call prevents inlining and branch prediction suffers. Each `p.process()` also allocates a new `Vec<u8>` that the next iteration immediately discards.

**Fix A — Eliminate per-iteration allocation** by reusing buffers:

```rust
fn run_pipeline(processors: &[Box<dyn Processor>], data: &[u8]) -> Vec<u8> {
    let mut current = data.to_vec();
    let mut scratch = Vec::new();
    for p in processors {
        p.process_into(&current, &mut scratch); // write into scratch
        std::mem::swap(&mut current, &mut scratch);
        scratch.clear(); // clear but keep allocation
    }
    current
}
```

This requires changing the trait to support buffer reuse:

```rust
trait Processor {
    fn process_into(&self, input: &[u8], output: &mut Vec<u8>);
}
```

**Fix B — Eliminate dynamic dispatch** via enum dispatch or generics:

```rust
enum AnyProcessor {
    TypeA(ProcessorA),
    TypeB(ProcessorB),
}

impl AnyProcessor {
    fn process_into(&self, input: &[u8], output: &mut Vec<u8>) {
        match self {
            Self::TypeA(p) => p.process_into(input, output),
            Self::TypeB(p) => p.process_into(input, output),
        }
    }
}
```

Enum dispatch eliminates the vtable indirection entirely. The compiler can inline each branch.

---

## 5. `Cargo.toml` — Missing LTO and codegen-units

**Issue**: `opt-level = 3` alone leaves performance on the table. The linker doesn't optimize across crate boundaries, and parallel codegen units prevent some optimizations.

**Fix**:

```toml
[profile.release]
opt-level = 3
lto = "fat"          # cross-crate inlining
codegen-units = 1    # maximizes optimization scope
panic = "abort"      # smaller binary, no unwind tables
```

`lto = "fat"` is especially impactful for the `dyn Processor` case — it can devirtualize calls when the concrete types are visible at link time.

---

## Summary (by impact)

| Issue | Estimated Impact | Effort |
|---|---|---|
| `LinkedList` to `VecDeque` | 2-10x for queue ops | Trivial |
| Buffer reuse in `run_pipeline` | Major — eliminates millions of allocations | Moderate |
| Enum dispatch over `dyn` | 2-5x on hot path (enables inlining) | Moderate |
| `HashMap` capacity + no clone | ~2x for `build_index` | Trivial |
| `collect()` in `process_ids` | Minor but free | Trivial |
| LTO + codegen-units | 5-20% whole-program | Trivial |
