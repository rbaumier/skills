---
name: swift
description: Modern Swift 6+ & SwiftUI — strict concurrency, Observation, migration strategies
---

## When to use
- Writing/reviewing Swift (iOS, macOS, server-side)
- Concurrency issues — data races, Actor isolation, `Sendable` warnings
- SwiftUI views, navigation, state management
- Migrating legacy code to Swift 6 strict concurrency

## When not to use
- Objective-C (unless bridging)
- UIKit/AppKit layout (unless wrapping in SwiftUI)
- C++ interop — use specific C++ skills

## Core Philosophy
- Safety first — `Sendable` is a contract, not a suggestion
- Main thread = UI only; heavy work on background actors/tasks
- Single source of truth — state in one place, flows down
- Declarative over imperative — describe *what*, not *how*
- Composition over complexity — small reusable views; massive Views = anti-pattern

## ALWAYS / NEVER (read before writing Swift)

These are the rules most often skipped. When you see the LEFT, you MUST do the RIGHT — no exceptions, no "kept for compatibility".

| When you write… | You MUST… |
|---|---|
| A view model / observable state object | use `@Observable` (macro) — **NEVER** `ObservableObject` + `@Published` |
| A long loop or CPU-bound op inside a `Task` | call `try Task.checkCancellation()` (or check `Task.isCancelled`) inside the loop |
| `@MainActor` on a whole `class` | move CPU-bound / non-UI methods OFF it (`nonisolated`) — **NEVER** blanket `@MainActor` to silence errors |
| A library API that throws | use **typed throws**: `throws(MyError)`, not bare `throws` |
| A single-use resource (token, file handle, one-shot) | model it as `struct Token: ~Copyable` — **NEVER** a class with a `copy()` |
| A type conforming to a protocol (`Codable`, `Equatable`, …) | put the conformance in `extension MyType: Proto { }` and **remove** `: Proto` from the declaration — **NEVER** inline on the declaration, and **NEVER** both inline *and* an extension (that double-declares conformance) |
| A SwiftUI view that needs a shared service / view model | receive it with `@Environment(Type.self)` — **NEVER** own it via `@State private var vm = VM()`, and **NEVER** wire it through an `init(client:)` / `@StateObject` |
| A child view that edits state owned elsewhere (e.g. an `EditProfileView`) | take a `@Binding` to the real value (or commit through the owning model) — **NEVER** copy the value into a local `@State` and edit the copy |
| Any SwiftUI view | add a `#Preview` with mock data |

If you "keep ObservableObject for compatibility" or "leave blanket @MainActor", you have FAILED the rule. Apply the modern idiom. Note: `@Environment(\.dismiss)` is NOT dependency injection — injecting a service/view model means `@Environment(MyService.self)`, with the value provided once at the root via `.environment(value)`.

## Critical Rules

### Concurrency & Isolation (Swift 6+)
- Actor Isolation: identify boundary — `@MainActor` (UI) or `actor` (shared mutable state)
- Sendable Compliance:
  - Mark types `Sendable` explicitly (`final class`, `struct`, `actor`)
  - Prefer value types for cross-boundary data
  - `@unchecked Sendable` — last resort only; document safety invariant
- Task Management:
  - Prefer structured concurrency (`async let`, `TaskGroup`) over `Task { }`
  - **Cancellation in loops/heavy ops** — moving work into a `Task` is NOT enough; a cancelled `Task` keeps running unless you check. Inside any long loop call `try Task.checkCancellation()` (throws `CancellationError`) or test `Task.isCancelled` and bail. A 10M-iteration loop with no check is unresponsive to cancellation:
    ```swift
    for i in 0..<10_000_000 {
        try Task.checkCancellation()   // REQUIRED — without this the loop ignores cancellation
        result += i
    }
    ```
  - Avoid `Task.detached` unless explicitly breaking actor inheritance
- Async Properties: if isolation blocks sync access, make property `async` or isolate caller
- **Continuations for bridging callback APIs** — use `withCheckedThrowingContinuation` (debug checks) or `withUnsafeContinuation` (perf-critical). MUST resume exactly once — double-resume = crash, never-resume = leaked task. Wrap Delegate-based APIs in `AsyncStream`, not raw continuations
- **AsyncSequence/AsyncStream for event streams** — prefer `AsyncStream` over Combine publishers for new code. Use `AsyncStream.makeStream()` factory (cleaner than continuation-based init). Support cancellation via `onTermination` handler. For multi-consumer, use `AsyncBroadcastSequence` or shared actor
- **Typed throws (Swift 6)** — for a **library/API surface** that throws, declare the error type: `func fetchNotifications() async throws(NetworkError) -> [String]`, NOT bare `throws`. Typed throws constrains errors at compile time so callers get exhaustive `catch` matching. Trigger: a public/library function that throws → reach for `throws(SpecificError)`. Bare untyped `throws` is only for app-level glue code where `any Error` is genuinely fine

### Modern SwiftUI Architecture
- State Management:
  - **`@Observable` macro — NEVER `ObservableObject` + `@Published`** for new view models. `@Published` "works fine" is NOT a reason to keep legacy `ObservableObject`; `@Observable` gives finer-grained view updates and is the modern default. In the view, observe with `@State` (not `@StateObject`/`@ObservedObject`):
    ```swift
    @Observable final class ProfileViewModel { var profile: UserProfile? }   // not ObservableObject
    struct ProfileScreen: View { @State private var model = ProfileViewModel() }
    ```
  - `@State` for view-local private state (always `private`)
  - **Single source of truth — one owner per piece of state, edits flow back to it.** A child view that edits a value it does not own must bind to the owner with `@Binding` (two-way), so the edit lands on the real state. Copying the owner's value into a local `@State` creates a SECOND source of truth: the edit lives in the copy, never reaches the owner, and is silently lost. A throwaway `let updated = Model(...)` that goes nowhere, or a Save button that just calls `dismiss()` with a "// update via viewModel" comment, both FAIL this — the change must actually reach the owner.
    ```swift
    // ❌ EditProfileView OWNS a copy — edits to `name` never reach the real profile
    struct EditProfileView: View {
        let profile: UserProfile           // a copy
        @State private var name = ""       // a second copy — the duplicate source of truth
        // Save { profile.name = name }  won't compile / won't persist; the edit is dropped
    }
    // ✅ Bind to the owner — the edit writes straight through to the single source
    struct EditProfileView: View {
        @Binding var profile: UserProfile  // same value the parent owns
    }
    // parent: EditProfileView(profile: $viewModel.profile)   // owner stays the model
    ```
  - **`@Environment` for dependency injection** — a view that depends on a shared service or view model must RECEIVE it from the environment, not CREATE or own it. Provide the value once at the root with `.environment(value)`; every consuming view reads it with `@Environment(Type.self)`. Adding `@Environment(\.dismiss)` does NOT satisfy this — that is a built-in key, not your injected dependency.
    ```swift
    @Observable final class Services { let api = APIClient() }
    // inject ONCE at the root:  WindowGroup { ContentView().environment(viewModel) }
    struct ContentView: View {
        @Environment(ProfileViewModel.self) private var viewModel   // received, not owned
    }
    ```
    These all FAIL the rule because the view OWNS / WIRES the dependency itself:
    ```swift
    @State private var viewModel = ProfileViewModel(client: APIClient(...))   // ❌ view owns it
    init(client: APIClient) { _viewModel = State(initialValue: .init(client: client)) }  // ❌ hand-wired
    @StateObject private var viewModel: ProfileViewModel                       // ❌ legacy + owned
    ```
- View Composition:
  - If `body` needs scrolling to read — extract subviews
  - `@ViewBuilder` for UI-constructing functions
- Navigation:
  - `NavigationStack` + typed `.navigationDestination(for:)` — avoid `NavigationLink` with direct views
  - Deep linking via `NavigationPath` in a Router/Coordinator

### UI Patterns & Best Practices
- Sheets: `.sheet(item:)` over `.sheet(isPresented:)` — ensures data availability
  - Dismissal via `@Environment(\.dismiss)` owned by sheet
- Side Effects:
  - `.task` over `.onAppear` for async work — auto-cancels on disappear
  - `.onChange(of:)` for state reactions; prefer derived state in model
- Previews: **every view file MUST end with a `#Preview` that injects mock data** — a view without a preview is incomplete. Keep it instant & reliable (no network):
  ```swift
  #Preview { ProfileScreen().environment(ProfileViewModel(mock: .sample)) }
  ```
- **Accessibility as a first-class requirement** — every interactive element needs `.accessibilityLabel()`. Group related elements with `.accessibilityElement(children: .combine)`. Test with VoiceOver in Simulator. Use `.accessibilityAction()` for custom interactions. Missing accessibility = incomplete feature

### Data & Persistence
- **SwiftData over Core Data for new projects** — use `@Model` macro for persistence. `ModelContainer` in App, `ModelContext` from Environment. Prefer `#Predicate` macros over NSPredicate strings. Use `@Query` in views for automatic fetching. Migration via `SchemaMigrationPlan`
- **Codable best practices** — use `CodingKeys` enum to decouple JSON keys from property names. Custom `init(from:)` only when shape differs significantly. `JSONDecoder.keyDecodingStrategy = .convertFromSnakeCase` for snake_case APIs. Use `@CodableIgnored` property wrapper for computed/transient fields

### Migration & Refactoring
- Blast radius: fix one module/type at a time
- Read exact diagnostics:
  - "Non-Sendable type..." — passing class/closure across boundary; make struct or actor
  - "Main actor-isolated..." — calling UI func from background; use `await MainActor.run` or mark caller `@MainActor`
- Legacy interop: `@preconcurrency import` for pre-Swift 6 libraries

### Testing & Performance
- **Swift Testing framework over XCTest** — use `@Test` functions with `#expect()` and `#require()` macros. Use `@Suite` for grouping. Parameterized tests via `@Test(arguments:)`. Traits for tagging (`.enabled(if:)`, `.timeLimit()`). Async tests: `await` directly, no `XCTestExpectation` needed
- Don't guess perf — use Time Profiler & Hangs instrument

### Type System & Patterns
- **Property Wrappers for reusable patterns** — `@propertyWrapper` for validated inputs (clamped ranges, trimmed strings), dependency injection, or UserDefaults access. Keep wrappers simple — complex logic belongs in the type, not the wrapper. Test wrappedValue and projectedValue separately
- **~Copyable (noncopyable types, Swift 5.9+)** — Trigger: a type representing a **single-use resource** (session token, file handle, one-shot operation), ESPECIALLY one with a `copy()` method — that `copy()` is the smell. Model it as `struct Token: ~Copyable` so the compiler forbids duplication. Don't "simplify" it into a plain copyable struct — that loses the single-use guarantee. `consuming` methods transfer ownership; `borrowing` methods borrow without consuming:
  ```swift
  struct SessionToken: ~Copyable {                 // not a class, not plain-copyable
      let value: String
      consuming func redeem() -> String { value }  // single use, enforced at compile time
  }
  ```

### Naming & Style
- Clarity: `remove(at: index)` over `remove(index)` — Swift is verbose by design
- Protocol conformance lives in a **separate extension**, NOT inline on the type declaration — this groups conformance code (including `CodingKeys`, custom `init(from:)`) per protocol. To move conformance to an extension you must do BOTH: (a) delete `: Proto` from the declaration, and (b) move the conformance members (`CodingKeys`, `init(from:)`, `encode(to:)`, `==`, …) INTO the extension. Adding `extension MyType: Proto { }` while leaving `: Proto` on the declaration does NOT satisfy this — it declares the conformance twice (a compile error in Swift), and the conformance code is still inline:
  ```swift
  // ❌ WRONG — conformance declared on BOTH the struct and an extension; CodingKeys still inline
  struct UserProfile: Codable {                            // ← still inline; must be removed
      let id: Int; let name: String
      enum CodingKeys: String, CodingKey { case id, name } // ← still inline; must move down
  }
  extension UserProfile: Codable { }                        // redundant empty extension; duplicate conformance
  // ✅ RIGHT — declaration has stored properties only; the extension carries conformance + CodingKeys
  struct UserProfile { let id: Int; let name: String }      // declaration: stored properties only
  extension UserProfile: Codable {                          // the ONE place conformance is declared
      enum CodingKeys: String, CodingKey { case id, name }
  }
  ```
  Both `struct UserProfile: Codable { … CodingKeys … }` (inline) and the WRONG block above (inline + empty extension) fail this rule.
- Immutability: `let` by default; `var` only when mutation required

## Checklist for Concurrency Errors
1. Identify actor — where is code running? (MainActor, custom actor, global pool)
2. Check payload — is data crossing boundary `Sendable`?
3. Check call — is function `async`? Should it be `nonisolated`?
4. Fix strategy:
   - Make it a `struct`? (best)
   - Wrap in `actor`?
   - Run on target actor?
   - **Do NOT blanket `@MainActor` on a whole type to silence errors.** If a `@MainActor class` holds a CPU-bound / non-UI method (e.g. `heavyComputation`), that method does NOT belong on the main actor. Mark it `nonisolated` (and run heavy work off-main) instead of letting the blanket annotation drag it onto the main thread:
     ```swift
     @MainActor final class ProfileViewModel {
         var profile: Profile?                    // UI state — MainActor is correct
         nonisolated func heavyComputation() async { … }   // CPU-bound — explicitly OFF MainActor
     }
     ```

## Checklist for SwiftUI Views (audit every view before you finish)
1. **Dependency injection** — does this view CREATE or own a service / view model (`@State private var vm = VM()`, an `init(client:)`, or `@StateObject`)? If yes, change it to `@Environment(Type.self)` and provide the value once at the root with `.environment(...)`. (`@Environment(\.dismiss)` does not count as injecting your dependency.)
2. **Single source of truth** — does this view copy a value it does not own into a local `@State` and then edit that copy? If yes, the edit is lost. Use `@Binding` to the owner (or commit the change through the owning model) so the edit reaches the one real source.
3. **Observation** — view models use `@Observable`, observed with `@State` (never `ObservableObject`/`@StateObject`).
4. **Every view file ends in a `#Preview`** that injects mock data.

## Checklist for Type Declarations (audit every type before you finish)
1. **Protocol conformance → dedicated extension** — for each conformance (`Codable`, `Equatable`, `Hashable`, …): is it declared in an `extension MyType: Proto { … }`, with `: Proto` REMOVED from the `struct`/`class`/`enum` declaration and the conformance members (`CodingKeys`, `init(from:)`, `==`, …) moved INTO that extension? Never leave the conformance inline; never declare it both inline AND in an extension (that double-declares it — a compile error).
