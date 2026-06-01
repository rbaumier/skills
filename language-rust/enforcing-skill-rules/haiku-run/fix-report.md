# Fix report — language-rust, eval1 iter1 (Haiku / WEAK executor)

Result: 11/23. 12 fails. Trap is large (23 pointed Rust rules in one file) — partial-capacity
plausible for a weak model, but every failing rule was already present in the skill, just weak:
buried in dense prose, listed as an equal alternative, or stated without a concrete WRONG/RIGHT
example or a syntactic trigger. So all 12 classify as **R (reinforce in body)**. None are
description/triggering issues (A) — the skill fired and the eval ran. None are model-only
variance on already-strong rules (V). None warrant retarget/retire (F).

## Per-fail classification

| Assertion | Class | What was wrong in the skill | Fix |
|---|---|---|---|
| lazylock-not-lazy-static | R | L104 listed `OnceLock/LazyLock` as equal; model picked OnceLock | Made `LazyLock` the default for lazy globals; `lazy_static!`→`LazyLock` WRONG/RIGHT; "prefer over OnceLock" |
| thiserror-derive-error | R | L56 one-liner "thiserror for libraries", no example | WRONG (manual Display+Error) / RIGHT (`#[derive(thiserror::Error)]`) block |
| asref-path-load-template | R | L107 stated rule but model half-fixed (String→&str) | Explicit "&str is NOT the fix; target is `impl AsRef<Path>`" + example |
| context-explains-why | R | L57 abstract ("explain why not what") | WRONG `"read failed: {e}"` / RIGHT `with_context` incl. path |
| box-large-enum-variant | R | L53 bare one-liner | WRONG/RIGHT boxing `source_map` HashMap; cite clippy `large_enum_variant` |
| fast-hasher-integer-keys | R | L86 stated; model changed only a comment, not the type | "change the actual type not a comment" + FxHashMap WRONG/RIGHT |
| vec-not-linkedlist | R | L83 one-liner; model deleted the fn instead of converting | "rewrite to VecDeque, never drop the function"; FIFO=VecDeque guidance |
| builder-returns-result | R | L32 "build() returns Result" had no example; model used unwrap_or_default | "Never unwrap_or_default a required field" + ok_or WRONG/RIGHT |
| serde-not-on-internal-types | R | L34 buried at end of long serde bullet | Promoted: "ONLY on boundary types; strip derive on internal types" |
| copy-small-type-span | R | L44 "Copy by value"; model derived Copy but kept &Span param | "deriving Copy isn't enough — params must pass by value"; Span WRONG/RIGHT |
| generic-pipeline-hot-path | R | L84 stated; model kept `&[Box<dyn Transform>]` | generic `<T: Transform>` WRONG/RIGHT for pipeline/per-element loops |
| sealed-transform-trait | R | L30 one-liner, no HOW | Full `mod sealed { pub trait Sealed {} }` private-supertrait example |

## Cross-cutting change

Added a **Pre-Output Checklist** section (before Post-Modification Audit): a LOUD, trigger-keyed
self-scan listing exactly these 12 syntactic patterns and their fixes (`lazy_static!`→LazyLock,
`HashMap<u64,_>`→FxHashMap, `&Span`→by value, `LinkedList`→VecDeque, etc.), each emphasizing that
applying half the change (Copy without by-value, comment without type) does not count. A weak
executor benefits most from a final grep-your-own-output pass keyed on concrete tokens.

## Safety w.r.t. the 11 passing assertions

No passing rule's guidance was reversed. Edits only sharpened wording/added examples to the 12
failing rules and their immediate bullets. The serde edit kept `deny_unknown_fields`/`default`
(passing) intact and only strengthened the internal-types clause. `#[must_use]`, Cow, channels,
no-unwrap, drop-guard, arena, slice, with-capacity, iterator-chain, unsafe-comment guidance
untouched.

## Assertion changes

None. All fixes are in the skill body; assertions and descriptions are correct as written.
