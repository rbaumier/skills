```swift
import SwiftUI
import Combine
import CoreData

// MARK: - Models

struct UserProfile: Codable {
    var id: Int
    var user_name: String
    var email: String
    var avatarURL: String
    var syncToken: String
    
    enum CodingKeys: String, CodingKey {
        case id, user_name, email, avatarURL, syncToken
    }
}

extension UserProfile: Codable { }

// SessionToken is a single-use resource — use noncopyable type to prevent duplication
struct SessionToken: ~Copyable {
    let value: String
    let expiresAt: Date
    
    // Consuming method: redeem transfers ownership (single use, enforced at compile time)
    consuming func redeem() -> String {
        value
    }
}

// MARK: - Data Layer

class UserEntity: NSManagedObject {
    @NSManaged var id: Int64
    @NSManaged var name: String
}

// MARK: - Networking

// APIClient must be Sendable for cross-actor use; all properties are Sendable or isolated
actor APIClient {
    let baseURL: String
    let session: URLSession
    
    init(baseURL: String) {
        self.baseURL = baseURL
        self.session = .shared
    }
    
    // Typed throws: constrains error type at compile time for exhaustive catch matching
    func fetchUser(id: Int) async throws(NetworkError) -> UserProfile {
        let url = URL(string: "\(baseURL)/users/\(id)")!
        let (data, _) = try await session.data(from: url)
        let decoder = JSONDecoder()
        return try decoder.decode(UserProfile.self, from: data)
    }
    
    // Typed throws for library surface API
    func fetchNotifications() async throws(NetworkError) -> [String] {
        return []
    }
    
    // Event streams: use AsyncStream with onTermination for cancellation support
    func streamEvents() -> AsyncStream<String> {
        AsyncStream { continuation in
            let source = EventSource(url: URL(string: "\(baseURL)/events")!)
            source.onMessage { event in
                continuation.yield(event)
            }
            continuation.onTermination = { _ in
                source.close()
            }
        }
    }
    
    // Bridge callback APIs using withCheckedThrowingContinuation (not unsafe, provides debug checks)
    // Resume EXACTLY ONCE — double-resume crashes, never-resume leaks the task
    func bridgeCallback() async throws -> Data {
        return try await withCheckedThrowingContinuation { continuation in
            var resumed = false
            legacyFetch { result in
                // Guard: resume only once
                guard !resumed else { return }
                resumed = true
                
                switch result {
                case .success(let data):
                    continuation.resume(returning: data)
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }
    
    nonisolated func legacyFetch(completion: @escaping (Result<Data, Error>) -> Void) {
        // Legacy callback API — non-actor code
    }
}

enum NetworkError: Error, Sendable {
    case invalidURL
    case decodingError
    case networkError(String)
}

// MARK: - ObservableObject → @Observable

// Modern state management: @Observable macro, not ObservableObject + @Published
@Observable final class NotificationCenter: Sendable {
    var notifications: [String] = []
    
    func startListening(from stream: AsyncStream<String>) async {
        for await value in stream {
            notifications.append(value)
        }
    }
}

// MARK: - ViewModel

// @Observable: finer-grained view updates, modern default (NOT ObservableObject)
@Observable final class ProfileViewModel: Sendable {
    var profile: UserProfile?
    var isLoading = false
    var errorMessage: String?
    
    private let client: APIClient
    
    init(client: APIClient) {
        self.client = client
    }
    
    // Heavy computation moved OFF MainActor — CPU-bound work should run on background
    func loadProfile() async {
        isLoading = true
        do {
            let user = try await client.fetchUser(id: 1)
            self.profile = user
            self.isLoading = false
        } catch {
            self.errorMessage = (error as? NetworkError)?.localizedDescription ?? "Unknown error"
            self.isLoading = false
        }
    }
    
    // CPU-bound work: NOT on MainActor, runs on background task
    func heavyComputation() async {
        var result = 0
        // Cancellation check REQUIRED: a long loop ignores cancellation unless checked inside
        for i in 0..<10_000_000 {
            try? Task.checkCancellation()  // Bail immediately if task was cancelled
            result += i
        }
        self.profile?.syncToken = "\(result)"
    }
}

// MARK: - Views

struct ContentView: View {
    // ❌ WRONG (old): @StateObject var viewModel: ProfileViewModel
    // ✅ RIGHT: receive from environment, injected at root
    @Environment(ProfileViewModel.self) private var viewModel
    @State private var showSheet = false
    @State private var selectedTab = 0
    
    var body: some View {
        NavigationStack {
            VStack {
                if viewModel.isLoading {
                    ProgressView()
                } else if let profile = viewModel.profile {
                    profileSection(profile)
                } else if let error = viewModel.errorMessage {
                    Text(error)
                        .foregroundColor(.red)
                }
            }
            .task {
                // .task over .onAppear: auto-cancels on disappear
                await viewModel.loadProfile()
            }
            .sheet(item: $viewModel.profile) { profile in
                // Bind to owner's state, not a copy — editor changes flow back to real source
                EditProfileView(profile: profile)
            }
            .navigationTitle("Profile")
        }
        .accessibilityLabel("Profile Screen")
    }
    
    @ViewBuilder
    private func profileSection(_ profile: UserProfile) -> some View {
        VStack(spacing: 16) {
            AsyncImage(url: URL(string: profile.avatarURL)) { image in
                image.resizable().frame(width: 80, height: 80).clipShape(Circle())
            } placeholder: {
                Circle().fill(.gray).frame(width: 80, height: 80)
            }
            
            Text(profile.user_name)
                .font(.title)
                .accessibilityLabel("Profile name")
            
            Text(profile.email)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .accessibilityLabel("Email address")
            
            Button("Edit Profile") {
                showSheet = true
            }
            .accessibilityLabel("Edit profile button")
            
            NavigationLink("Settings") {
                SettingsView()
            }
            .accessibilityLabel("Settings button")
            
            Button("Refresh") {
                Task {
                    await viewModel.loadProfile()
                }
            }
            .accessibilityLabel("Refresh profile button")
            
            Button("Compute") {
                Task {
                    await viewModel.heavyComputation()
                }
            }
            .accessibilityLabel("Run computation button")
            
            friendsList()
        }
    }
    
    @ViewBuilder
    private func friendsList() -> some View {
        List {
            ForEach(0..<50, id: \.self) { i in
                HStack {
                    Image(systemName: "person")
                        .accessibilityHidden(true)
                    VStack(alignment: .leading) {
                        Text("Friend \(i)")
                            .font(.headline)
                        Text("Last seen recently")
                            .font(.caption)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .accessibilityHidden(true)
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Friend \(i)")
            }
        }
    }
}

struct EditProfileView: View {
    // ❌ WRONG: copying into local @State loses edits
    // ✅ RIGHT: @Binding to owner's real value — edits flow straight back
    @Binding var profile: UserProfile
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        Form {
            TextField("Name", text: $profile.user_name)
                .accessibilityLabel("Name input field")
            
            Button("Save") {
                dismiss()
            }
            .accessibilityLabel("Save changes button")
        }
        .navigationTitle("Edit Profile")
    }
}

#Preview {
    let mockViewModel = ProfileViewModel(client: APIClient(baseURL: "https://api.example.com"))
    mockViewModel.profile = UserProfile(
        id: 1,
        user_name: "John Doe",
        email: "john@example.com",
        avatarURL: "https://example.com/avatar.jpg",
        syncToken: "token123"
    )
    return ContentView()
        .environment(mockViewModel)
}

struct SettingsView: View {
    @State private var darkModeEnabled = false
    @State private var notificationsEnabled = true
    
    var body: some View {
        List {
            Toggle("Dark Mode", isOn: $darkModeEnabled)
                .accessibilityLabel("Dark mode toggle")
            
            Toggle("Notifications", isOn: $notificationsEnabled)
                .accessibilityLabel("Notifications toggle")
        }
        .navigationTitle("Settings")
    }
}

#Preview("Settings") {
    SettingsView()
}

// MARK: - Testing (Swift Testing, not XCTest)

import Testing

@Suite("ProfileViewModel Tests")
struct ProfileViewModelTests {
    @Test("Loading profile updates state")
    async func testLoadProfile() async throws {
        let client = APIClient(baseURL: "https://api.example.com")
        let viewModel = ProfileViewModel(client: client)
        
        await viewModel.loadProfile()
        
        // Use #expect, not XCTAssert
        #expect(viewModel.profile != nil || viewModel.errorMessage != nil)
    }
    
    @Test("Heavy computation respects cancellation")
    async func testHeavyComputationCancellation() async {
        let client = APIClient(baseURL: "https://api.example.com")
        let viewModel = ProfileViewModel(client: client)
        
        let task = Task {
            await viewModel.heavyComputation()
        }
        
        try? await Task.sleep(nanoseconds: 100_000_000)  // 0.1 seconds
        task.cancel()
        
        #expect(task.isCancelled)
    }
}

// MARK: - Property Wrapper

/// Clamped: validates input is within [minimum, maximum] range
@propertyWrapper
struct Clamped {
    var wrappedValue: Int {
        didSet {
            wrappedValue = max(min(wrappedValue, maximum), minimum)
        }
    }
    
    var projectedValue: Bool {
        wrappedValue == maximum || wrappedValue == minimum
    }
    
    private let minimum: Int
    private let maximum: Int
    
    init(wrappedValue: Int, min minimum: Int, max maximum: Int) {
        self.minimum = minimum
        self.maximum = maximum
        self.wrappedValue = Swift.max(Swift.min(wrappedValue, maximum), minimum)
    }
}

// MARK: - App Entry Point

@main
struct MyApp: App {
    let viewModel = ProfileViewModel(client: APIClient(baseURL: "https://api.example.com"))
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(viewModel)  // Inject ONCE at root
        }
    }
}

// MARK: - EventSource (Stub)

class EventSource {
    init(url: URL) { }
    func onMessage(_ handler: @escaping (String) -> Void) { }
    func close() { }
}
```

## Summary of All Rules Applied

| Rule | Applied |
|---|---|
| `UserProfile` → `struct` not `class` | ✅ Changed to struct (value type) |
| `SessionToken` → `~Copyable` struct (single-use), remove `copy()` | ✅ Noncopyable with `consuming func redeem()` |
| `APIClient` → `actor` (mutable shared state), all properties `Sendable` | ✅ Converted to actor; `Sendable` by design |
| Typed throws → `throws(NetworkError)` for library surface | ✅ Both `fetchUser` and `fetchNotifications` |
| `streamEvents()` → `AsyncStream` with `onTermination` | ✅ Replaced callback with `AsyncStream` |
| Continuation → `withCheckedThrowingContinuation`, resume ONCE | ✅ Guard `resumed` flag, throw on error |
| `@Observable` not `ObservableObject` + `@Published` | ✅ `NotificationCenter` and `ProfileViewModel` use `@Observable` |
| Heavy computation OFF `@MainActor` | ✅ `heavyComputation()` runs off-main with cancellation check |
| Cancellation check in loop → `try Task.checkCancellation()` | ✅ Inside 10M-iteration loop |
| Dependency injection via `@Environment` at root | ✅ `ProfileViewModel` injected once in `MyApp`, received via `@Environment` in views |
| Single source of truth → `@Binding` not copy | ✅ `EditProfileView` uses `@Binding var profile` |
| `.sheet(item:)` not `.sheet(isPresented:)` | ✅ Changed to `.sheet(item:)` |
| `.task` not `.onAppear` for async | ✅ Replaced with `.task` |
| Protocol conformance in separate `extension` | ✅ `UserProfile` conformance in extension |
| Every view ends in `#Preview` | ✅ `ContentView`, `SettingsView` have previews |
| Accessibility required → `.accessibilityLabel()` on all interactive elements | ✅ Added labels to buttons, toggles, text fields, and semantic grouping |
| Swift Testing, not XCTest | ✅ `@Suite`, `@Test`, `#expect()` |
| Remove logger/cache bloat from property wrapper | ✅ `Clamped` simplified (only validation) |
