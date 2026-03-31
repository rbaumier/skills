# Performance Review

Six issues found, ordered by impact.

---

## 1. `LinkedList` — Replace with `VecDeque` (Critical)

`LinkedList` has terrible cache locality. Every node is a separate heap allocation with pointer indirection. For a FIFO queue, `VecDeque` is the direct replacement — O(1) push/pop at both ends, contiguous memory.

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

**Why it matters**: `VecDeque` stores elements in a ring buffer. Cache prefetching works. `LinkedList` defeats it entirely. For any realistic workload this is a measurable win.

---

## 2. `run_pipeline` — Monomorphize the hot path (Critical)

`&[Box<dyn Processor>]` on a hot path called millions of times pays vtable indirection + prevents inlining on every iteration. Two options depending on whether heterogeneous processors are truly needed:

**Option A: Homogeneous pipeline (best performance)**

```rust
fn run_pipeline<P: Processor>(processors: &[P], data: &[u8]) -> Vec<u8> {
    let mut result = data.to_vec();
    for p in processors {
        result = p.process(&result);
    }
    result
}
```

The compiler monomorphizes this, enabling inlining and SIMD vectorization.

**Option B: Heterogeneous processors required — reduce allocation churn**

If you genuinely need different processor types, at minimum avoid reallocating `result` every iteration by using double-buffering:

```rust
fn run_pipeline(processors: &[Box<dyn Processor>], data: &[u8]) -> Vec<u8> {
    let mut buf_a = data.to_vec();
    let mut buf_b = Vec::with_capacity(data.len());
    for (i, p) in processors.iter().enumerate() {
        let (input, output) = if i % 2 == 0 {
            (&buf_a, &mut buf_b)
        } else {
            (&buf_b, &mut buf_a)
        };
        *output = p.process(input);
    }
    if processors.len() % 2 == 0 { buf_a } else { buf_b }
}
```

Also consider: if the set of processor types is known at compile time, use an enum dispatch instead of `dyn Trait`. Enum dispatch inlines and avoids the vtable entirely:

```rust
enum AnyProcessor {
    Compress(CompressProcessor),
    Encrypt(EncryptProcessor),
}

impl Processor for AnyProcessor {
    fn process(&self, data: &[u8]) -> Vec<u8> {
        match self {
            Self::Compress(p) => p.process(data),
            Self::Encrypt(p) => p.process(data),
        }
    }
}
```

---

## 3. `process_ids` — Pre-allocate and use iterator chain (High)

The `Vec` grows via repeated reallocation. With 10k+ elements this means multiple allocations and copies. Use `with_capacity` or, better, an iterator chain which the compiler can optimize further:

```rust
fn process_ids(ids: &[u64]) -> Vec<String> {
    ids.iter().map(|id| format!("id-{id}")).collect()
}
```

`collect()` calls `size_hint()` on the iterator, so it allocates exactly once. The iterator chain also gives the compiler better optimization opportunities than the manual loop.

If this is truly performance-critical and the format is this simple, avoid `format!` overhead entirely:

```rust
fn process_ids(ids: &[u64]) -> Vec<String> {
    ids.iter()
        .map(|id| {
            let mut s = String::with_capacity(16); // "id-" + up to 20 digits
            s.push_str("id-");
            s.push_str(&itoa::Buffer::new().format(*id));
            s
        })
        .collect()
}
```

The `itoa` crate formats integers ~3x faster than `format!`.

---

## 4. `build_index` — Pre-allocate HashMap + use fast hasher (High)

Two problems: (a) no capacity hint causes repeated rehashing at 100k+ entries, (b) the default SipHash is overkill for non-adversarial string keys.

```rust
use rustc_hash::FxHashMap; // or ahash::AHashMap

fn build_index(entries: &[(String, u64)]) -> FxHashMap<String, u64> {
    let mut map = FxHashMap::with_capacity_and_hasher(
        entries.len(),
        Default::default(),
    );
    for (key, val) in entries {
        map.insert(key.clone(), *val);
    }
    map
}
```

If you can take ownership of the input (change signature to accept `Vec<(String, u64)>`), eliminate the `clone()` entirely:

```rust
fn build_index(entries: Vec<(String, u64)>) -> FxHashMap<String, u64> {
    entries.into_iter().collect()
}
```

This avoids 100k+ string allocations.

---

## 5. Release profile — Missing LTO and codegen-units (Medium)

The current profile only sets `opt-level = 3`. For maximum performance add:

```toml
[profile.release]
opt-level = 3
lto = "fat"
codegen-units = 1
```

- `lto = "fat"` enables cross-crate inlining — critical for generic/trait-heavy code.
- `codegen-units = 1` gives LLVM the full picture for optimization. Increases compile time but improves runtime performance.

---

## 6. `Processor` trait — signature forces allocation (Medium)

```rust
fn process(&self, data: &[u8]) -> Vec<u8>;
```

Returning `Vec<u8>` forces a heap allocation on every call in the hot loop. Consider an in-place API:

```rust
trait Processor {
    /// Process `input` and write results to `output`.
    /// `output` is cleared but retains its allocation.
    fn process(&self, input: &[u8], output: &mut Vec<u8>);
}
```

This lets callers reuse buffers across iterations, eliminating allocation churn in `run_pipeline`:

```rust
fn run_pipeline(processors: &[impl Processor], data: &[u8]) -> Vec<u8> {
    let mut input = data.to_vec();
    let mut output = Vec::with_capacity(data.len());
    for p in processors {
        output.clear();
        p.process(&input, &mut output);
        std::mem::swap(&mut input, &mut output);
    }
    input
}
```

Zero allocations after the first iteration.
