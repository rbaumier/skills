# rustc errors → design questions

Load when the same borrow-checker or trait error keeps coming back — in your code or in review. Each error is a design signal; the reflex fix (`.clone()`, `Arc<Mutex<_>>`) usually papers over it.

| Error | It is really asking | Design moves, in order |
|---|---|---|
| E0382 use of moved value | Who owns this value? | Give it one owner and lend `&`/`&mut`; reorder calls; `Clone` only if cheap AND cold |
| E0499 two `&mut` at once | Why do two writers overlap? | Split borrows per field (methods on the field's type); `mem::take` one out; shrink a borrow's scope with a block |
| E0502 `&mut` while borrowed | Are the read and write phases tangled? | Separate phases: collect keys/indices first, mutate after; entry API on maps |
| E0507 cannot move out of borrow | Take it, copy it, or leave it? | `mem::take`/`replace`; derive `Copy` on small types (own-1); `into_iter()` when done with the container |
| E0106 missing lifetime | Whose data outlives whom? | A struct holding `&'a T` usually should own the data — or hold an arena index (own-5) |
| E0277 trait bound not satisfied | What crosses which boundary? | For `Send`/`Sync`: a non-Send type (`Rc`, `RefCell`, a held guard) is crossing threads — swap the type, never `unsafe impl` |
| E0308 mismatched types (async / impl Trait) | Are two branches returning "the same" opaque type? | They never are: unify via `Box<dyn Trait>` or `Either`, or restructure into one expression |
| E0038 trait not dyn-compatible | Is this trait meant for `dyn` at all? | Prefer generics (perf-3) or enum dispatch; else extract a dyn-safe sub-trait (no generic methods, no `Self` returns) |

Escalation rule: the second time the same error appears in the same function, stop patching — the ownership design is wrong (see own-5, own-6).
