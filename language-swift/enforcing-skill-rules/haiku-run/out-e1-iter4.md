```swift
import SwiftUI
import Observation
import CoreData

// MARK: - Models

struct UserProfile: Codable {
    let id: Int
    let userName: String
    let email: String
    let avatarURL: String
    let syncToken: String
    
    enum CodingKeys: String, CodingKey {
        case id
        case userName = "user_name"
        case email
        case avatarURL
        case syncToken
    }
}

extension UserProfile: Codable { }

// MARK: - Session Token (Noncopyable Resource)

struct SessionToken: ~Copyable {
    let value: String
    let expiresAt: Date
    
    consuming func redeem() -> String {
        value
    }
}

// MARK: - Data Layer

class UserEntity: NSManagedObject {
    @NSManaged var id: Int64
    @NSManaged var name: String
}

// MARK: - Errors

enum NetworkError: Error {
    case invalidURL
    case decodingFailed
    case requestFailed(String)
}

// MARK: - Networking

final class APIClient: @unchecked Sendable {
    let baseURL: String
    let session: URLSession
    
    init(baseURL: String) {
        self.baseURL = baseURL
        self.session = .shared
    }
    
    func fetchUser(id: Int) async throws(NetworkError) -> UserProfile {
        guard let url = URL(string: "\(baseURL)/users/\(id)") else {
            throw NetworkError.invalidURL
        }
        do {
            let (data, _) = try await session.data(from: url)
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            return try decoder.decode(UserProfile.self, from: data)
        } catch {
            throw NetworkError.decodingFailed
        }
    }
    
    func fetchNotifications() async throws(NetworkError) -> [String] {
        return []
    }
    
    func streamEvents() -> AsyncStream<String> {
        let (stream, continuation) = AsyncStream<String>.makeStream()
        let source = EventSource(url: URL(string: "\(baseURL)/events")!)
        source.onMessage { event in
            continuation.yield(event)
        }
        continuation.onTermination = { @Sendable _ in
            source.close()
        }
        return stream
    }
    
    func bridgeCallback() async throws -> Data {
        return try await withCheckedThrowingContinuation { continuation in
            var resumed = false
            legacyFetch { result in
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
    
    private func legacyFetch(completion: @escaping (Result<Data, Error>) -> Void) {
        // legacy callback API
    }
}

// MARK: - Event Stream (Mock)

class EventSource {
    let url: URL
    private var onMessageHandler: ((String) -> Void)?
    
    init(url: URL) {
        self.url = url
    }
    
    func onMessage(handler: @escaping (String) -> Void) {
        self.onMessageHandler = handler
    }
    
    func close() { }
}

// MARK: - Notification Center

@Observable
final class NotificationCenter {
    var notifications: [String] = []
    private let streamTask: Task<Void, Never>?
    
    init(apiClient: APIClient? = nil) {
        self.streamTask = nil
    }
}

// MARK: - ViewModel

@Observable
final class ProfileViewModel {
    var profile: UserProfile?
    var isLoading = false
    var errorMessage: String?
    
    private let client: APIClient
    
    init(client: APIClient) {
        self.client = client
    }
    
    func loadProfile() async {
        isLoading = true
        do {
            let user = try await client.fetchUser(id: 1)
            self.profile = user
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }
    
    // CPU-bound work runs off MainActor
    nonisolated func heavyComputation() -> String {
        var result = 0
        for i in 0..<10_000_000 {
            result += i
        }
        return "\(result)"
    }
}

// MARK: - Views

struct ContentView: View {
    @State private var viewModel = ProfileViewModel(client: APIClient(baseURL: "https://api.example.com"))
    @State private var sheetItem: UserProfile?
    
    var body: some View {
        NavigationStack {
            ZStack {
                if viewModel.isLoading {
                    ProgressView()
                } else if let profile = viewModel.profile {
                    profileContent(profile)
                } else if let error = viewModel.errorMessage {
                    Text(error)
                        .foregroundColor(.red)
                }
            }
            .navigationTitle("Profile")
            .task {
                await viewModel.loadProfile()
            }
        }
    }
    
    @ViewBuilder
    private func profileContent(_ profile: UserProfile) -> some View {
        List {
            Section("Avatar & Info") {
                VStack(spacing: 16) {
                    AsyncImage(url: URL(string: profile.avatarURL)) { image in
                        image.resizable()
                            .frame(width: 80, height: 80)
                            .clipShape(Circle())
                    } placeholder: {
                        Circle().fill(.gray).frame(width: 80, height: 80)
                    }
                    Text(profile.userName)
                        .font(.title)
                        .accessibilityLabel("User name")
                    Text(profile.email)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .accessibilityLabel("Email address")
                }
            }
            
            Section("Actions") {
                Button("Edit Profile") {
                    sheetItem = profile
                }
                .accessibilityLabel("Edit profile button")
                
                NavigationLink("Settings", destination: SettingsView())
                    .accessibilityLabel("Navigate to settings")
                
                Button("Refresh") {
                    Task {
                        await viewModel.loadProfile()
                    }
                }
                .accessibilityLabel("Refresh profile button")
                
                Button("Compute") {
                    let result = viewModel.heavyComputation()
                    // Use result as needed
                }
                .accessibilityLabel("Run heavy computation button")
            }
            
            Section("Friends") {
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
        .sheet(item: $sheetItem) { item in
            EditProfileView(profile: item)
        }
    }
}

#Preview {
    let mockClient = APIClient(baseURL: "https://api.example.com")
    let mockViewModel = ProfileViewModel(client: mockClient)
    mockViewModel.profile = UserProfile(
        id: 1,
        userName: "John Doe",
        email: "john@example.com",
        avatarURL: "https://example.com/avatar.jpg",
        syncToken: "token123"
    )
    return ContentView()
        .environment(mockViewModel)
}

struct EditProfileView: View {
    let profile: UserProfile
    @State private var name: String = ""
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        Form {
            Section("Edit Name") {
                TextField("Name", text: $name)
                    .accessibilityLabel("Name input field")
            }
            
            Button("Save") {
                // In real app, would update profile and persist
                dismiss()
            }
            .accessibilityLabel("Save changes button")
        }
        .navigationTitle("Edit Profile")
        .onAppear {
            name = profile.userName
        }
    }
}

#Preview {
    let mockProfile = UserProfile(
        id: 1,
        userName: "Jane Doe",
        email: "jane@example.com",
        avatarURL: "https://example.com/avatar.jpg",
        syncToken: "token456"
    )
    return NavigationStack {
        EditProfileView(profile: mockProfile)
    }
}

struct SettingsView: View {
    @State private var darkModeEnabled = false
    @State private var notificationsEnabled = true
    
    var body: some View {
        List {
            Toggle("Dark Mode", isOn: $darkModeEnabled)
                .accessibilityLabel("Toggle dark mode")
            Toggle("Notifications", isOn: $notificationsEnabled)
                .accessibilityLabel("Toggle notifications")
        }
        .navigationTitle("Settings")
    }
}

#Preview {
    NavigationStack {
        SettingsView()
    }
}

// MARK: - Testing (Swift Testing Framework)

import Testing

@Suite("ProfileViewModel Tests")
struct ProfileViewModelTests {
    @Test("Load profile succeeds")
    async func testLoadProfile() async {
        let client = APIClient(baseURL: "https://api.example.com")
        let vm = ProfileViewModel(client: client)
        
        await vm.loadProfile()
        // Assert profile state changed (mock client returns empty data in this example)
    }
}

// MARK: - Validated Property Wrapper

@propertyWrapper
struct Clamped {
    private(set) var wrappedValue: Int
    private let minimum: Int
    private let maximum: Int
    
    var projectedValue: Bool {
        wrappedValue == maximum || wrappedValue == minimum
    }
    
    init(wrappedValue: Int, min minimum: Int, max maximum: Int) {
        self.minimum = minimum
        self.maximum = maximum
        self.wrappedValue = Swift.max(Swift.min(wrappedValue, maximum), minimum)
    }
    
    mutating func clamp(_ value: Int) {
        wrappedValue = Swift.max(Swift.min(value, maximum), minimum)
    }
}

// MARK: - App Entry Point

@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```
