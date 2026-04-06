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

## Critical Rules

### Concurrency & Isolation (Swift 6+)
- Actor Isolation: identify boundary — `@MainActor` (UI) or `actor` (shared mutable state)
- Sendable Compliance:
  - Mark types `Sendable` explicitly (`final class`, `struct`, `actor`)
  - Prefer value types for cross-boundary data
  - `@unchecked Sendable` — last resort only; document safety invariant
- Task Management:
  - Prefer structured concurrency (`async let`, `TaskGroup`) over `Task { }`
  - Support cancellation — check `Task.isCancelled` in loops/heavy ops
  - Avoid `Task.detached` unless explicitly breaking actor inheritance
- Async Properties: if isolation blocks sync access, make property `async` or isolate caller
- **Continuations for bridging callback APIs** — use `withCheckedThrowingContinuation` (debug checks) or `withUnsafeContinuation` (perf-critical). MUST resume exactly once — double-resume = crash, never-resume = leaked task. Wrap Delegate-based APIs in `AsyncStream`, not raw continuations
- **AsyncSequence/AsyncStream for event streams** — prefer `AsyncStream` over Combine publishers for new code. Use `AsyncStream.makeStream()` factory (cleaner than continuation-based init). Support cancellation via `onTermination` handler. For multi-consumer, use `AsyncBroadcastSequence` or shared actor
- **Typed throws (Swift 6)** — `func load() throws(DatabaseError)` constrains error types at compile time. Callers get exhaustive `catch` matching. Use for library APIs where callers need structured error handling. Use untyped `throws` for app-level code where `any Error` is fine

### Modern SwiftUI Architecture
- State Management:
  - `@Observable` macro over legacy `ObservableObject`
  - `@State` for view-local private state
  - `@Environment` for dependency injection
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
- Previews: provide `#Preview` with mock data; keep instant & reliable
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
- **~Copyable (noncopyable types, Swift 5.9+)** — use `struct Token: ~Copyable` for resources that must not be duplicated (file handles, tokens, one-shot operations). `consuming` methods transfer ownership. `borrowing` methods borrow without consuming. Enforces single-use at compile time

### Naming & Style
- Clarity: `remove(at: index)` over `remove(index)` — Swift is verbose by design
- Protocol conformance: `extension MyType: MyProtocol` to group methods separately
- Immutability: `let` by default; `var` only when mutation required

## Checklist for Concurrency Errors
1. Identify actor — where is code running? (MainActor, custom actor, global pool)
2. Check payload — is data crossing boundary `Sendable`?
3. Check call — is function `async`? Should it be `nonisolated`?
4. Fix strategy:
   - Make it a `struct`? (best)
   - Wrap in `actor`?
   - Run on target actor?
   - Do NOT blanket `@MainActor` to silence errors
