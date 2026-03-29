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

### Migration & Refactoring
- Blast radius: fix one module/type at a time
- Read exact diagnostics:
  - "Non-Sendable type..." — passing class/closure across boundary; make struct or actor
  - "Main actor-isolated..." — calling UI func from background; use `await MainActor.run` or mark caller `@MainActor`
- Legacy interop: `@preconcurrency import` for pre-Swift 6 libraries

### Testing & Performance
- Prefer macro-based `Testing` framework over `XCTest` for new code
- Async tests: `await` directly; avoid `XCTestExpectation` for async/await
- Don't guess perf — use Time Profiler & Hangs instrument

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
