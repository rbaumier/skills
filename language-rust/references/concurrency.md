# Atomics and lock-free

Load when code touches `Ordering::`, hand-rolls a lock-free structure, or reviews one. Companion to con-9.

## First question: do you need an atomic at all?

Prefer, in order: a channel; a `Mutex`/`RwLock`; an existing structure (`std`, `crossbeam`, `dashmap`); only then raw atomics. Hand-rolled lock-free code is a last resort and pairs with loom (below).

## Ordering: pick by what the atomic guards

| You are... | Ordering |
|---|---|
| Counting (metrics, IDs) — no other memory is read based on the value | `Relaxed` |
| Publishing data guarded by a flag/pointer (writer side) | `Release` on the store |
| Consuming that data (reader side) | `Acquire` on the load |
| Read-modify-write that both consumes and publishes | `AcqRel` |
| Ordering across SEVERAL atomics must be globally consistent | `SeqCst` — justify it in a comment |

The classic silent bug: `Relaxed` on a "ready" flag that guards non-atomic data. The reader can observe `ready == true` and still read stale data. A flag that guards anything is Release/Acquire minimum.

`compare_exchange` takes two orderings (success, failure); failure can usually be `Relaxed`. Use `compare_exchange_weak` inside retry loops.

## loom

Any hand-rolled lock-free structure gets a loom test — it model-checks every interleaving of a small scenario, which normal tests cannot reach:

- Write the scenario with `loom::sync` / `loom::thread` mirrors under `#[cfg(loom)]`.
- Run `RUSTFLAGS="--cfg loom" cargo test --release`.
- No loom test = the structure is unverified; in review, that is a Major finding on its own.
