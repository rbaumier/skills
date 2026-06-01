# Fix Report — language-swift / eval e1 (Haiku, weak executor)

Baseline iter1: 24/32 PASS. 8 FAIL. All 8 classified **R (reinforce)** — the rules
existed in SKILL.md but were soft one-liners buried in sub-bullet lists with no LOUD
trigger and no embodied example, so the weak executor either skipped them or actively
chose the legacy path ("kept ObservableObject for compatibility", "simplified token to
plain struct"). No assertion descriptions were wrong (no A), none were vague-but-valid
needing a value statement only (no V), none were untestable/mis-targeted (no F).

## Per-failure classification

| id | class | root cause | fix |
|----|-------|-----------|-----|
| task-cancellation | R | rule was a sub-bullet "check Task.isCancelled in loops"; model wrapped loop in `Task.detached` and thought that was enough | Body: explicit "moving work into a Task is NOT enough" + `try Task.checkCancellation()` example inside a 10M loop. Added to ALWAYS/NEVER table. |
| typed-throws | R | verbose soft rule, model kept bare `throws` | Body: concrete `throws(NetworkError)` signature + trigger "public/library fn that throws". Added to table. |
| observable-macro | R | one-liner; model explicitly kept `ObservableObject` "for compatibility" | Body: "NEVER ObservableObject + @Published", `@Published works fine is NOT a reason", `@Observable`+`@State` example. Table row + closing line calling out the exact excuse. |
| environment-dependency-injection | R | terse "@Environment for DI", no example; model used `@StateObject` + init param | Body: concrete `@Environment(VM.self)` injection example contrasting with hand-wired init. Added to table. |
| noncopyable-token | R | rule existed but model "simplified" token into a plain copyable struct | Body: trigger on `copy()` smell, `struct SessionToken: ~Copyable` + `consuming` example, "don't simplify into plain struct". Added to table. |
| protocol-conformance-extension | R | "extension MyType: MyProtocol" with no example; model declared Codable inline | Body: contrast example (declaration vs `extension UserProfile: Codable`), explicit "inline fails this rule". Added to table. |
| no-blanket-mainactor | R | rule in checklist + philosophy but no per-function remedy; model left blanket `@MainActor class` | Checklist step 4: `nonisolated func heavyComputation()` example, "does NOT belong on the main actor". Added to table + closing line. |
| preview-mock-data | R | "provide #Preview with mock data" one-liner; model added none | Body: "every view file MUST end with a #Preview", `#Preview { ... .environment(mock) }` example. Added to table. |

## counts
R=8, V=0, A=0, F=0

## Changes made (all via Edit on SKILL.md)
1. New top-of-file **ALWAYS / NEVER** trigger table (7 rows) covering all 8 traps, placed
   right after Core Philosophy so a weak executor hits it before writing code. Closing
   line names the two exact excuses the model used.
2. Strengthened 7 in-body rules with LOUD wording + embodied code snippets:
   Task cancellation, typed throws, @Observable, @Environment DI, ~Copyable token,
   protocol-conformance extension, #Preview.
3. Strengthened concurrency checklist step 4 (no-blanket-@MainActor) with a
   `nonisolated` per-method example.

## Generality / regression guard
- The 24 passing rules' wording was left untouched (sendable, unchecked-sendable,
  structured-concurrency, continuations, AsyncStream, navigation, sheet, dismiss,
  .task, accessibility, view extraction, SwiftData, Codable snake_case, Swift Testing,
  property-wrapper-simple, let-over-var, arg labels, single-source-of-truth, etc.).
- New examples are generic idioms, not eval-specific hacks. They reference realistic
  symbol names (ProfileViewModel/SessionToken) only because those are the canonical
  Swift patterns, not to pattern-match the eval.
- No rule contradicts another; the ALWAYS/NEVER table only restates rules already in
  the body, now front-loaded.

## assertion_changes
None — descriptions in evals/evals.json and haiku-run/assertions-e1.json already match
the SKILL rules accurately. No A/F reclassification needed.
