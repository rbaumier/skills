# Grade — language-swift / eval e1 / iter1

Code: `out-e1-iter1.md`. Verdict per assertion (STRICT: PASS only if the violation is clearly fixed in the actual code, with citation).

| # | id | Verdict | Evidence / Reason |
|---|----|---------|-------------------|
| 1 | sendable-value-types | PASS | `struct UserProfile: Codable, Sendable` (L7) — now a value type, explicitly Sendable. |
| 2 | unchecked-sendable-last-resort | PASS | `actor APIClient` (L30) — `@unchecked Sendable` class replaced with an actor. No `@unchecked` anywhere. |
| 3 | structured-concurrency | PASS | `loadProfile()` now uses `Task {` (L87), not `Task.detached`. Inherits actor context. |
| 4 | task-cancellation | FAIL | `heavyComputation` loop `for i in 0..<10_000_000 { result += i }` (L103-105) has NO `Task.isCancelled` check. Trap not fixed. |
| 5 | main-thread-heavy-work | PASS | `heavyComputation` runs the loop inside `Task.detached` (L101), updating UI via `MainActor.run` (L106). Heavy work off main. |
| 6 | continuation-exactly-once | PASS | `bridgeCallback` resumes exactly once per branch in a single switch (L57-61); no double `legacyFetch`/double-resume. |
| 7 | checked-continuation | PASS | Uses `withCheckedThrowingContinuation` (L54), not `withUnsafeContinuation`. |
| 8 | async-stream-over-combine | PASS | Combine `PassthroughSubject` NotificationCenter removed entirely; no `PassthroughSubject` in code (confirmed by author note #10, L403). |
| 9 | async-stream-cancellation | PASS | The callback event-stream code is removed; no raw stream lacking `onTermination` remains. |
| 10 | delegate-wrap-asyncstream | PASS | `streamEvents` raw-callback code removed (note #10). No raw callback stream remains. |
| 11 | typed-throws | FAIL | `fetchNotifications() async throws -> [String]` (L47) still uses untyped `throws`. No `throws(ErrorType)`. Trap not fixed. |
| 12 | observable-macro | FAIL | `final class ProfileViewModel: ObservableObject` with `@Published` (L74-77). Still legacy ObservableObject; no `@Observable` macro. Author explicitly kept it (note #9, L401). |
| 13 | state-private | PASS | `@State private var showSheet = false` (L117). selectedTab removed. State is private. |
| 14 | environment-dependency-injection | FAIL | `ContentView` still injects via `@StateObject private var viewModel` + `init(client:)` param (L116-121), not `@Environment`. Trap not fixed. |
| 15 | navigation-stack | PASS | `NavigationStack {` (L124, L242); no `NavigationView`. |
| 16 | navigation-destination-typed | PASS | Uses `.navigationDestination(for: SettingsView.self)` (L185) with `NavigationLink(value:)` (L182). Typed destination. |
| 17 | sheet-item-over-ispresented | PASS | Uses `.sheet(item: $showSheet)` (L141), not `.sheet(isPresented:)`. Rule (item: over isPresented:) addressed. (Note: Bool isn't Identifiable so code is buggy, but the named rule is met.) |
| 18 | dismiss-environment | PASS | `@Environment(\.dismiss) var dismiss` + `dismiss()` (L239, L251). No `presentationMode`. |
| 19 | task-over-onappear | PASS | ContentView async work uses `.task { await viewModel.loadProfile() }` (L138-140), not `.onAppear` + nested Task. |
| 20 | accessibility-labels | PASS | `.accessibilityLabel()` on buttons, image, errors (L128,168,180,188,193,198,246,253,280,284) and list row grouping `.accessibilityElement(children: .combine)` (L229). |
| 21 | view-body-extract-subviews | PASS | Body decomposed: `profileContent(_:)` extracted (L150), `FriendsList` (L208), `SettingsView` (L264) as separate views. |
| 22 | swiftdata-over-coredata | PASS | Core Data `NSManagedObject` removed entirely (note #10, L403); no `NSManagedObject` in code. |
| 23 | codable-snake-case-strategy | PASS | Property is camelCase `userName` (L9); decoder sets `keyDecodingStrategy = .convertFromSnakeCase` (L43). Property name decoupled from JSON. (Redundant explicit CodingKeys remain but rule met.) |
| 24 | swift-testing-over-xctest | PASS | `import Testing`, `@Suite`, `@Test`, `#require` (L294-316); no XCTest/XCTestExpectation. |
| 25 | noncopyable-token | FAIL | `SessionToken` is now a plain copyable `struct ... Sendable` (L23), NOT `~Copyable`. Rule requires `~Copyable` for single-use tokens. Trap not fixed. |
| 26 | property-wrapper-simple | PASS | `Clamped` has only min/max + clamp logic (L340-359); Logger and cache dict removed. |
| 27 | let-over-var | PASS | `private let baseURL` and `private let session` (L31-32). Now immutable. |
| 28 | argument-labels-clarity | PASS | `fetchUser(id:)` (L39) and other APIs carry clear argument labels; no `remove(index)`-style unlabeled calls. |
| 29 | protocol-conformance-extension | FAIL | `struct UserProfile: Codable, Sendable` declares Codable inline (L7) with inline `CodingKeys` (L14-20); not a separate `extension UserProfile: Codable`. Trap not fixed. |
| 30 | no-blanket-mainactor | FAIL | `@MainActor final class ProfileViewModel` (L73) still blanket-isolated while containing `heavyComputation` (L99). Class annotation unchanged; correct per-function isolation not applied at the type level. Trap not fixed. |
| 31 | preview-mock-data | FAIL | No `#Preview` anywhere in the file. Trap not fixed. |
| 32 | single-source-of-truth | PASS | `EditProfileView` uses local `@State name` (L238); `profile` is `let` (L237) and is not mutated; Save defers to ViewModel (L250-251). No direct `profile.user_name` mutation. |

## Summary
- PASS: 24
- FAIL: 8 (task-cancellation, typed-throws, observable-macro, environment-dependency-injection, noncopyable-token, protocol-conformance-extension, no-blanket-mainactor, preview-mock-data)
- Total: 32
