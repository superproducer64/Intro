//
//  APIService.swift
//  Intro
//
//  Created by Sean Connolly on 4/4/26.
//

import Foundation
import Combine
import Security
import Supabase

class APIService: ObservableObject {
    static let shared = APIService()
    private static let hasCompletedProfileSetupKey = "hasCompletedProfileSetup"
    private static let authUserKey = "intro_auth_user"
    private static let legacyAuthKey = "intro_auth"
    private static let authTokenService = "IntroAuthToken"
    private static let adminAuthTokenService = "IntroAdminAuthToken"
    private static let pushDeviceTokenKey = "intro_push_device_token"
    private static let localProfileMediaDirectoryName = "ProfileMedia"
    private static let localAvatarSelectionPrefix = "intro_profile_avatar_"

    private enum AppEnvironment: String {
        case production
        case staging
        case custom

        static var current: AppEnvironment {
            if let rawValue = Bundle.main.object(forInfoDictionaryKey: "APP_ENV") as? String,
               let environment = AppEnvironment(rawValue: rawValue.lowercased()) {
                return environment
            }
            return .production
        }

        var domain: String {
            switch self {
            case .production:
                return "intro-bgpstudioshou.replit.app"
            case .staging:
                return "intro-bgpstudioshou.replit.app"
            case .custom:
                if let domain = Bundle.main.object(forInfoDictionaryKey: "CUSTOM_API_DOMAIN") as? String,
                   !domain.isEmpty {
                    return domain
                }
                return "intro-bgpstudioshou.replit.app"
            }
        }
    }

    var isUsingSupabaseBackend: Bool {
        BackendMode.current == .supabaseAuthProfile
    }

    private var apiURL: String { "https://\(AppEnvironment.current.domain)" }
    private var wsURL: String { "wss://\(AppEnvironment.current.domain)" }
    
    @Published var authToken: String?
    @Published var adminToken: String?
    @Published var currentUser: User?
    @Published var isAuthenticated = false
    @Published var hasCompletedProfileSetup: Bool
    @Published var hasModerationAccess = false
    @Published private(set) var pushDeviceToken: String?
    @Published private(set) var isWebSocketConnected = false
    @Published private(set) var isConnectingWebSocket = false

    private var wsTask: URLSessionWebSocketTask?
    private var messageListeners: [UUID: (WebSocketMessage) -> Void] = [:]
    private var reconnectTask: Task<Void, Never>?
    private var shouldReconnectWebSocket = false
    private var legacyUserIDMap: [Int: UUID] = [:]

    private static let isDebugLoggingEnabled = false

    private enum BackendMode: String {
        case legacy
        case supabaseAuthProfile

        static var current: BackendMode {
            guard let rawValue = Bundle.main.object(forInfoDictionaryKey: "BACKEND_MODE") as? String,
                  let mode = BackendMode(rawValue: rawValue.trimmingCharacters(in: .whitespacesAndNewlines)) else {
                return .legacy
            }
            return mode
        }
    }

    init() {
        let storedProfileSetup = UserDefaults.standard.object(forKey: Self.hasCompletedProfileSetupKey) as? Bool
        self.hasCompletedProfileSetup = storedProfileSetup ?? true
        self.pushDeviceToken = UserDefaults.standard.string(forKey: Self.pushDeviceTokenKey)
        loadStoredAuth()
        loadStoredAdminAuth()
    }
    
    // MARK: - Auth Storage
    
    func loadStoredAuth() {
        if BackendMode.current == .supabaseAuthProfile {
            Task {
                await restoreSupabaseSessionIfNeeded()
            }
            return
        }

        if let token = KeychainHelper.read(service: Self.authTokenService, account: "currentUser"),
           let data = UserDefaults.standard.data(forKey: Self.authUserKey),
           let user = try? JSONDecoder().decode(User.self, from: data) {
            Task { @MainActor in
                self.authToken = token
                self.currentUser = user
                self.isAuthenticated = true
            }
            return
        }

        if let data = UserDefaults.standard.data(forKey: Self.legacyAuthKey),
           let authData = try? JSONDecoder().decode(AuthData.self, from: data) {
            persistStoredUser(authData.user)
            KeychainHelper.save(authData.token, service: Self.authTokenService, account: "currentUser")
            UserDefaults.standard.removeObject(forKey: Self.legacyAuthKey)

            Task { @MainActor in
                self.authToken = authData.token
                self.currentUser = authData.user
                self.isAuthenticated = true
            }
        }
    }

    func loadStoredAdminAuth() {
        if BackendMode.current == .supabaseAuthProfile {
            clearAdminAuth()
            return
        }

        if let token = KeychainHelper.read(service: Self.adminAuthTokenService, account: "adminUser") {
            Task { @MainActor in
                self.adminToken = token
            }
        }
    }
    
    private func saveAuth(token: String, user: User) {
        KeychainHelper.save(token, service: Self.authTokenService, account: "currentUser")
        persistStoredUser(user)

        Task { @MainActor in
            self.authToken = token
            self.currentUser = user
            self.isAuthenticated = true
        }
    }

    private func saveSupabaseAuth(session: Session, user: User) {
        saveAuth(token: session.accessToken, user: user)
    }

    private func saveAdminAuth(token: String) {
        KeychainHelper.save(token, service: Self.adminAuthTokenService, account: "adminUser")
        Task { @MainActor in
            self.adminToken = token
        }
    }

    private func persistStoredUser(_ user: User) {
        if let encoded = try? JSONEncoder().encode(user) {
            UserDefaults.standard.set(encoded, forKey: Self.authUserKey)
        }
    }

    private func readStoredUser() -> User? {
        guard let data = UserDefaults.standard.data(forKey: Self.authUserKey) else {
            return nil
        }
        return try? JSONDecoder().decode(User.self, from: data)
    }

    private func clearStoredAuthData(for userId: Int? = nil) {
        UserDefaults.standard.removeObject(forKey: Self.authUserKey)
        UserDefaults.standard.removeObject(forKey: Self.legacyAuthKey)
        UserDefaults.standard.removeObject(forKey: Self.hasCompletedProfileSetupKey)
        KeychainHelper.delete(service: Self.authTokenService, account: "currentUser")
        clearAdminAuth()
        clearLocalProfilePhoto(for: userId)
        clearLocalAvatarSelection(for: userId)
    }

    private func setProfileSetupCompleted(_ isCompleted: Bool) {
        Task { @MainActor in
            self.hasCompletedProfileSetup = isCompleted
        }
        UserDefaults.standard.set(isCompleted, forKey: Self.hasCompletedProfileSetupKey)
    }

    func markProfileSetupCompleted() {
        setProfileSetupCompleted(true)
    }

    func updateCurrentUser(_ user: User) {
        persistStoredUser(user)
        Task { @MainActor in
            self.currentUser = user
        }
    }

    func clearCurrentUserProfilePhoto() {
        guard let currentUser else { return }

        let updatedUser = User(
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
            age: currentUser.age,
            bio: currentUser.bio,
            photos: nil,
            prompts: currentUser.prompts
        )
        updateCurrentUser(updatedUser)
    }

    func saveLocalProfilePhoto(_ data: Data) throws {
        guard let currentUserId = currentUser?.id else { return }
        let photoURL = try localProfilePhotoURL(for: currentUserId, createDirectory: true)
        try data.write(to: photoURL, options: .atomic)
    }

    func saveLocalAvatarSelection(_ avatarId: String) {
        guard let currentUserId = currentUser?.id else { return }
        UserDefaults.standard.set(avatarId, forKey: Self.localAvatarSelectionPrefix + String(currentUserId))
    }

    func loadLocalAvatarSelection(for userId: Int?) -> String? {
        guard let userId else { return nil }
        return UserDefaults.standard.string(forKey: Self.localAvatarSelectionPrefix + String(userId))
    }

    func clearLocalAvatarSelection(for userId: Int?) {
        guard let userId else { return }
        UserDefaults.standard.removeObject(forKey: Self.localAvatarSelectionPrefix + String(userId))
    }

    func loadLocalProfilePhotoData(for userId: Int?) -> Data? {
        guard let userId else { return nil }
        guard let photoURL = try? localProfilePhotoURL(for: userId, createDirectory: false) else {
            return nil
        }
        return try? Data(contentsOf: photoURL)
    }

    func clearLocalProfilePhoto(for userId: Int?) {
        guard let userId else { return }
        guard let photoURL = try? localProfilePhotoURL(for: userId, createDirectory: false) else {
            return
        }
        try? FileManager.default.removeItem(at: photoURL)
    }
    
    func clearAuth() {
        let currentUserId = currentUser?.id
        Task { @MainActor in
            self.authToken = nil
            self.currentUser = nil
            self.isAuthenticated = false
            self.hasCompletedProfileSetup = true
            self.hasModerationAccess = false
        }
        clearStoredAuthData(for: currentUserId)
        disconnectWS()

        if BackendMode.current == .supabaseAuthProfile {
            Task {
                try? await SupabaseService.shared.client?.auth.signOut()
            }
        }
    }

    func clearAdminAuth() {
        Task { @MainActor in
            self.adminToken = nil
        }
        KeychainHelper.delete(service: Self.adminAuthTokenService, account: "adminUser")
    }

    func resolveMediaURL(from path: String?) -> URL? {
        guard let path, !path.isEmpty else { return nil }

        if let absoluteURL = URL(string: path), absoluteURL.scheme != nil {
            return absoluteURL
        }

        if BackendMode.current == .supabaseAuthProfile,
           let client = SupabaseService.shared.client {
            return try? client.storage
                .from(SupabaseConfig.storageBucket)
                .getPublicURL(path: path)
        }

        guard let relativeURL = URL(string: path),
              let baseURL = URL(string: apiURL) else {
            return nil
        }

        return URL(string: path, relativeTo: baseURL)?.absoluteURL ?? baseURL.appendingPathComponent(relativeURL.path)
    }

    private func localProfilePhotoURL(for userId: Int, createDirectory: Bool) throws -> URL {
        let baseDirectory = try localProfileMediaDirectoryURL(createIfNeeded: createDirectory)
        return baseDirectory.appendingPathComponent("user-\(userId)-profile-photo.dat")
    }

    private func storageObjectPath(from photoReference: String?) -> String? {
        guard let photoReference, !photoReference.isEmpty else { return nil }
        guard URL(string: photoReference)?.scheme == nil else { return nil }
        return photoReference
    }

    private func localProfileMediaDirectoryURL(createIfNeeded: Bool) throws -> URL {
        let baseURL = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: createIfNeeded
        )
        let mediaDirectory = baseURL.appendingPathComponent(Self.localProfileMediaDirectoryName, isDirectory: true)
        if createIfNeeded, !FileManager.default.fileExists(atPath: mediaDirectory.path) {
            try FileManager.default.createDirectory(at: mediaDirectory, withIntermediateDirectories: true)
        }
        return mediaDirectory
    }

    func updatePushDeviceToken(_ token: String) {
        UserDefaults.standard.set(token, forKey: Self.pushDeviceTokenKey)
        Task { @MainActor in
            self.pushDeviceToken = token
        }
        Self.debugLog("APNs token captured")
    }
    
    // MARK: - API Requests
    
    private func request<T: Decodable>(_ path: String, method: String = "GET", body: Encodable? = nil) async throws -> T {
        guard let url = URL(string: "\(apiURL)\(path)") else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        if let body = body {
            request.httpBody = try JSONEncoder().encode(body)
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                throw APIError.serverError(errorResponse.error)
            }
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            Self.debugLog("Response decoding failed: \(error.localizedDescription)")
            throw error
        }
    }

    private func performRequest(_ request: URLRequest) async throws -> Data {
        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                throw APIError.serverError(errorResponse.error)
            }
            throw APIError.httpError(httpResponse.statusCode)
        }

        return data
    }
    
    // MARK: - Auth APIs
    
    func register(
        name: String,
        email: String,
        password: String,
        age: Int,
        bio: String,
        acceptedTerms: Bool
    ) async throws -> AuthResponse {
        if BackendMode.current == .supabaseAuthProfile {
            return try await registerWithSupabase(
                name: name,
                email: email,
                password: password,
                age: age,
                bio: bio,
                acceptedTerms: acceptedTerms
            )
        }

        let body = RegisterRequest(
            name: name,
            email: email,
            password: password,
            age: age,
            bio: bio,
            acceptedTerms: acceptedTerms
        )
        let response: AuthResponse = try await request("/api/auth/register", method: "POST", body: body)
        setProfileSetupCompleted(false)
        saveAuth(token: response.token, user: response.user)
        return response
    }
    
    func login(email: String, password: String) async throws -> AuthResponse {
        if BackendMode.current == .supabaseAuthProfile {
            return try await loginWithSupabase(email: email, password: password)
        }

        let body = LoginRequest(email: email, password: password)
        let response: AuthResponse = try await request("/api/auth/login", method: "POST", body: body)
        saveAuth(token: response.token, user: response.user)
        return response
    }
    
    func appleSignIn(
        appleId: String,
        name: String?,
        email: String?,
        identityToken: String? = nil,
        nonce: String? = nil
    ) async throws -> AuthResponse {
        if BackendMode.current == .supabaseAuthProfile {
            guard let identityToken, let nonce else {
                throw APIError.serverError("Apple Sign In did not return the required identity token.")
            }

            return try await appleSignInWithSupabase(
                identityToken: identityToken,
                nonce: nonce,
                name: name,
                email: email
            )
        }

        let body = AppleSignInRequest(appleId: appleId, name: name, email: email)
        let response: AuthResponse = try await request("/api/auth/apple", method: "POST", body: body)
        if response.user.bio.isEmpty {
            setProfileSetupCompleted(false)
        }
        saveAuth(token: response.token, user: response.user)
        return response
    }

    private func appleSignInWithSupabase(
        identityToken: String,
        nonce: String,
        name: String?,
        email: String?
    ) async throws -> AuthResponse {
        let client = try SupabaseService.shared.requireClient()
        let session = try await client.auth.signInWithIdToken(
            credentials: OpenIDConnectCredentials(
                provider: .apple,
                idToken: identityToken,
                nonce: nonce
            )
        )

        let normalizedName = name?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let normalizedName, !normalizedName.isEmpty {
            try? await client.auth.update(
                user: UserAttributes(
                    data: [
                        "name": .string(normalizedName)
                    ]
                )
            )

            _ = try? await client
                .from("profiles")
                .update([
                    "name": normalizedName
                ])
                .eq("id", value: session.user.id.uuidString)
                .execute()
        }

        if let email, !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            _ = email
        }

        let user = try await fetchSupabaseUser(for: session.user.id)
        saveSupabaseAuth(session: session, user: user)
        try await refreshSupabaseModerationAccess()
        return AuthResponse(token: session.accessToken, user: user)
    }
    
    // MARK: - Profile APIs
    
    func getProfiles() async throws -> [User] {
        if BackendMode.current == .supabaseAuthProfile {
            return try await getProfilesFromSupabase()
        }
        return try await request("/api/profiles")
    }
    
    func likeUser(likedUserId: Int) async throws -> LikeResponse {
        if BackendMode.current == .supabaseAuthProfile {
            return try await likeUserInSupabase(likedUserId: likedUserId)
        }
        let body = LikeRequest(likedUserId: likedUserId)
        return try await request("/api/like", method: "POST", body: body)
    }

    func passUser(passedUserId: Int) async throws -> SuccessResponse {
        if BackendMode.current == .supabaseAuthProfile {
            return try await passUserInSupabase(passedUserId: passedUserId)
        }
        let body = PassRequest(passedUserId: passedUserId)
        return try await request("/api/pass", method: "POST", body: body)
    }
    
    func getMatches() async throws -> [UserMatch] {
        if BackendMode.current == .supabaseAuthProfile {
            return try await getMatchesFromSupabase()
        }
        return try await request("/api/matches")
    }
    
    func getMessages(matchUserId: Int) async throws -> [ChatMessage] {
        if BackendMode.current == .supabaseAuthProfile {
            return try await getMessagesFromSupabase(matchUserId: matchUserId)
        }
        return try await request("/api/messages/\(matchUserId)")
    }
    
    func getProfile() async throws -> User {
        if BackendMode.current == .supabaseAuthProfile {
            let user = try await getProfileFromSupabase()
            updateCurrentUser(user)
            return user
        }

        return try await request("/api/profile")
    }
    
    func updateProfile(data: UpdateProfileRequest) async throws -> User {
        if BackendMode.current == .supabaseAuthProfile {
            let user = try await updateProfileInSupabase(data: data)
            updateCurrentUser(user)
            return user
        }

        let user: User = try await request("/api/profile", method: "PUT", body: data)
        updateCurrentUser(user)
        return user
    }
    
    func savePrompts(prompts: [PromptAnswer]) async throws -> SuccessResponse {
        if BackendMode.current == .supabaseAuthProfile {
            return try await savePromptsInSupabase(prompts: prompts)
        }

        let body = SavePromptsRequest(prompts: prompts)
        let response: SuccessResponse = try await request("/api/prompts", method: "POST", body: body)
        setProfileSetupCompleted(true)
        return response
    }

    func uploadProfilePhoto(_ data: Data, filename: String = "profile-photo.jpg", mimeType: String = "image/jpeg") async throws -> PhotoUploadResponse {
        if BackendMode.current == .supabaseAuthProfile {
            return try await uploadProfilePhotoToSupabase(data, filename: filename, mimeType: mimeType)
        }

        guard let url = URL(string: "\(apiURL)/api/profile/photo") else {
            throw APIError.invalidURL
        }

        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        request.httpBody = multipartFormData(
            boundary: boundary,
            data: data,
            fieldName: "photo",
            filename: filename,
            mimeType: mimeType
        )

        let responseData = try await performRequest(request)
        let response = try JSONDecoder().decode(PhotoUploadResponse.self, from: responseData)

        if let user = response.user {
            updateCurrentUser(user)
        }

        return response
    }

    func removeProfilePhoto() async throws {
        if BackendMode.current == .supabaseAuthProfile {
            try await removeProfilePhotoFromSupabase()
            return
        }

        clearCurrentUserProfilePhoto()
    }

    func adminLogin(password: String) async throws {
        if BackendMode.current == .supabaseAuthProfile {
            throw APIError.featureNotMigrated("Moderator auth will be role-based in Supabase.")
        }
        let body = AdminLoginRequest(password: password)
        let response: AdminLoginResponse = try await request("/api/admin/login", method: "POST", body: body)
        saveAdminAuth(token: response.token)
    }
    
    func getPrompts(userId: Int) async throws -> [PromptAnswer] {
        if BackendMode.current == .supabaseAuthProfile {
            throw APIError.featureNotMigrated("Prompt lookup by legacy integer user id is not used in Supabase mode.")
        }
        return try await request("/api/prompts/\(userId)")
    }
    
    func reportUser(reportedUserId: Int, reason: String, details: String) async throws -> SuccessResponse {
        if BackendMode.current == .supabaseAuthProfile {
            return try await reportUserInSupabase(reportedUserId: reportedUserId, reason: reason, details: details)
        }
        let body = ReportRequest(reportedUserId: reportedUserId, reason: reason, details: details)
        return try await request("/api/report", method: "POST", body: body)
    }
    
    func blockUser(blockedUserId: Int) async throws -> SuccessResponse {
        if BackendMode.current == .supabaseAuthProfile {
            return try await blockUserInSupabase(blockedUserId: blockedUserId)
        }
        let body = BlockRequest(blockedUserId: blockedUserId)
        return try await request("/api/block", method: "POST", body: body)
    }

    func getReports() async throws -> [ModerationReport] {
        if BackendMode.current == .supabaseAuthProfile {
            return try await getReportsFromSupabase()
        }
        guard let adminToken else {
            throw APIError.adminAuthRequired
        }

        guard let url = URL(string: "\(apiURL)/api/reports") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(adminToken)", forHTTPHeaderField: "Authorization")

        let data = try await performRequest(request)
        return try JSONDecoder().decode([ModerationReport].self, from: data)
    }
    
    func deleteAccount() async throws -> SuccessResponse {
        if BackendMode.current == .supabaseAuthProfile {
            let client = try SupabaseService.shared.requireClient()
            try await client.auth.signOut()
            clearAuth()
            return SuccessResponse(message: "Account signed out. Supabase account deletion should be handled server-side.")
        }

        let response: SuccessResponse = try await request("/api/account", method: "DELETE")
        clearAuth()
        return response
    }
    
    func createHyperbeamSession(url: String) async throws -> HyperbeamResponse {
        if BackendMode.current == .supabaseAuthProfile {
            throw APIError.featureNotMigrated("Hyperbeam session creation has not been migrated to Supabase Edge Functions yet.")
        }
        let body = HyperbeamRequest(url: url)
        return try await request("/api/hyperbeam/create", method: "POST", body: body)
    }

    private func multipartFormData(
        boundary: String,
        data: Data,
        fieldName: String,
        filename: String,
        mimeType: String
    ) -> Data {
        var body = Data()
        let lineBreak = "\r\n"

        body.append(Data("--\(boundary)\(lineBreak)".utf8))
        body.append(Data("Content-Disposition: form-data; name=\"\(fieldName)\"; filename=\"\(filename)\"\(lineBreak)".utf8))
        body.append(Data("Content-Type: \(mimeType)\(lineBreak)\(lineBreak)".utf8))
        body.append(data)
        body.append(Data(lineBreak.utf8))
        body.append(Data("--\(boundary)--\(lineBreak)".utf8))

        return body
    }

    private func restoreSupabaseSessionIfNeeded() async {
        do {
            let client = try SupabaseService.shared.requireClient()
            let session = try await client.auth.session

            do {
                let user = try await getProfileFromSupabase()
                try await refreshSupabaseModerationAccess()
                await MainActor.run {
                    self.currentUser = user
                    self.isAuthenticated = true
                    self.authToken = session.accessToken
                }
            } catch {
                if let storedUser = readStoredUser() {
                    await MainActor.run {
                        self.currentUser = storedUser
                        self.isAuthenticated = true
                        self.authToken = session.accessToken
                    }
                    Self.debugLog("Using cached user during Supabase session restore after profile fetch failure: \(error.localizedDescription)")
                } else {
                    throw error
                }
            }
        } catch {
            clearStoredAuthData()
            await MainActor.run {
                self.currentUser = nil
                self.isAuthenticated = false
                self.authToken = nil
                self.hasCompletedProfileSetup = true
                self.hasModerationAccess = false
            }
        }
    }

    private func registerWithSupabase(
        name: String,
        email: String,
        password: String,
        age: Int,
        bio: String,
        acceptedTerms: Bool
    ) async throws -> AuthResponse {
        let client = try SupabaseService.shared.requireClient()
        let response = try await client.auth.signUp(
            email: email,
            password: password,
            data: [
                "name": .string(name)
            ]
        )

        guard let session = response.session else {
            throw APIError.supabaseAuthPendingConfirmation
        }

        let profile = SupabaseProfileUpdate(
            name: name,
            age: age,
            bio: bio,
            acceptedTerms: acceptedTerms
        )

        _ = try await client
            .from("profiles")
            .update(profile)
            .eq("id", value: session.user.id.uuidString)
            .execute()

        let user = try await fetchSupabaseUser(for: session.user.id)
        setProfileSetupCompleted(false)
        saveSupabaseAuth(session: session, user: user)
        try await refreshSupabaseModerationAccess()
        return AuthResponse(token: session.accessToken, user: user)
    }

    private func loginWithSupabase(email: String, password: String) async throws -> AuthResponse {
        let client = try SupabaseService.shared.requireClient()
        let session = try await client.auth.signIn(
            email: email,
            password: password
        )

        let user = try await fetchSupabaseUser(for: session.user.id)
        setProfileSetupCompleted(user.bio.isEmpty == false || !(user.prompts ?? []).isEmpty)
        saveSupabaseAuth(session: session, user: user)
        try await refreshSupabaseModerationAccess()
        return AuthResponse(token: session.accessToken, user: user)
    }

    private func getProfileFromSupabase() async throws -> User {
        let client = try SupabaseService.shared.requireClient()
        let authUser = try await client.auth.user()
        return try await fetchSupabaseUser(for: authUser.id)
    }

    private func updateProfileInSupabase(data: UpdateProfileRequest) async throws -> User {
        let client = try SupabaseService.shared.requireClient()
        let authUser = try await client.auth.user()

        let profile = SupabaseProfileUpdate(
            name: data.name,
            age: data.age,
            bio: data.bio,
            acceptedTerms: nil
        )

        _ = try await client
            .from("profiles")
            .update(profile)
            .eq("id", value: authUser.id.uuidString)
            .execute()

        if let name = data.name {
            try await client.auth.update(
                user: UserAttributes(
                    data: [
                        "name": .string(name)
                    ]
                )
            )
        }

        return try await fetchSupabaseUser(for: authUser.id)
    }

    private func savePromptsInSupabase(prompts: [PromptAnswer]) async throws -> SuccessResponse {
        let client = try SupabaseService.shared.requireClient()
        let authUser = try await client.auth.user()

        _ = try await client
            .from("profile_prompts")
            .delete()
            .eq("user_id", value: authUser.id.uuidString)
            .execute()

        let rows = prompts.enumerated().map { index, prompt in
            SupabasePromptInsert(
                userID: authUser.id.uuidString,
                prompt: prompt.prompt,
                answer: prompt.answer,
                sortOrder: index
            )
        }

        if !rows.isEmpty {
            _ = try await client
                .from("profile_prompts")
                .insert(rows)
                .execute()
        }

        _ = try await client
            .from("profiles")
            .update([
                "profile_setup_completed": true
            ])
            .eq("id", value: authUser.id.uuidString)
            .execute()

        setProfileSetupCompleted(true)
        let refreshedUser = try await fetchSupabaseUser(for: authUser.id)
        updateCurrentUser(refreshedUser)
        return SuccessResponse(message: "Prompts saved")
    }

    private func uploadProfilePhotoToSupabase(
        _ data: Data,
        filename: String,
        mimeType: String
    ) async throws -> PhotoUploadResponse {
        let client = try SupabaseService.shared.requireClient()
        let authUser = try await client.auth.user()
        let bucket = SupabaseConfig.storageBucket
        let objectPath = "\(authUser.id.uuidString.lowercased())/\(filename)"

        do {
            try await client.storage
                .from(bucket)
                .upload(
                    objectPath,
                    data: data,
                    options: FileOptions(
                        cacheControl: "3600",
                        contentType: mimeType,
                        upsert: true
                    )
                )
        } catch {
            throw APIError.serverError("Storage upload failed. bucket=\(bucket), path=\(objectPath), error=\(String(describing: error))")
        }

        _ = try await client
            .from("profiles")
            .update([
                "photo_path": objectPath
            ])
            .eq("id", value: authUser.id.uuidString)
            .execute()

        let updatedUser = try await fetchSupabaseUser(for: authUser.id)
        updateCurrentUser(updatedUser)
        let photoURL = resolveMediaURL(from: objectPath)?.absoluteString
        return PhotoUploadResponse(photoUrl: photoURL, user: updatedUser)
    }

    private func removeProfilePhotoFromSupabase() async throws {
        let client = try SupabaseService.shared.requireClient()
        let authUser = try await client.auth.user()
        let existingPhotoReference = currentUser?.photos?.first

        _ = try await client
            .from("profiles")
            .update(
                SupabaseProfilePhotoUpdate(
                    photoPath: nil
                )
            )
            .eq("id", value: authUser.id.uuidString)
            .execute()

        if let objectPath = storageObjectPath(from: existingPhotoReference) {
            _ = try? await client.storage
                .from(SupabaseConfig.storageBucket)
                .remove(paths: [objectPath])
        }

        clearCurrentUserProfilePhoto()
    }

    private func getProfilesFromSupabase() async throws -> [User] {
        let client = try SupabaseService.shared.requireClient()
        let authUser = try await client.auth.user()

        let swipedRows: [SupabaseSwipeRow] = try await client
            .from("swipes")
            .select()
            .eq("swiper_id", value: authUser.id.uuidString)
            .execute()
            .value

        let swipedUserIDs = Set(swipedRows.map(\.targetUserID))
        let blockedUserIDs = try await fetchBlockedUserIDs(for: authUser.id)

        let profiles: [SupabaseProfileRow] = try await client
            .from("profiles")
            .select()
            .neq("id", value: authUser.id.uuidString)
            .execute()
            .value

        var users: [User] = []
        for profile in profiles where !swipedUserIDs.contains(profile.id.uuidString) && !blockedUserIDs.contains(profile.id) {
            do {
                let user = try await fetchSupabaseUser(for: profile.id)
                users.append(user)
            } catch {
                Self.debugLog("Skipping discover profile \(profile.id): \(error.localizedDescription)")
            }
        }

        return users
    }

    private func likeUserInSupabase(likedUserId: Int) async throws -> LikeResponse {
        let client = try SupabaseService.shared.requireClient()
        let authUser = try await client.auth.user()
        let targetUserID = try await resolveSupabaseUUID(forLegacyID: likedUserId)

        try await replaceSwipe(
            swiperID: authUser.id,
            targetUserID: targetUserID,
            direction: "like"
        )

        let reciprocalLikes: [SupabaseSwipeRow] = try await client
            .from("swipes")
            .select()
            .eq("swiper_id", value: targetUserID.uuidString)
            .eq("target_user_id", value: authUser.id.uuidString)
            .eq("direction", value: "like")
            .execute()
            .value

        guard !reciprocalLikes.isEmpty else {
            return LikeResponse(match: false, matchedUser: nil)
        }

        let normalizedPair = normalizedMatchPair(authUser.id, targetUserID)
        let existingMatches: [SupabaseMatchRow] = try await client
            .from("matches")
            .select()
            .eq("user_a", value: normalizedPair.userA.uuidString)
            .eq("user_b", value: normalizedPair.userB.uuidString)
            .execute()
            .value

        if existingMatches.isEmpty {
            _ = try await client
                .from("matches")
                .insert(
                    SupabaseMatchInsert(
                        userA: normalizedPair.userA.uuidString,
                        userB: normalizedPair.userB.uuidString
                    )
                )
                .execute()
        }

        let matchedUser = try? await fetchSupabaseUser(for: targetUserID)
        return LikeResponse(match: true, matchedUser: matchedUser)
    }

    private func passUserInSupabase(passedUserId: Int) async throws -> SuccessResponse {
        let client = try SupabaseService.shared.requireClient()
        let authUser = try await client.auth.user()
        let targetUserID = try await resolveSupabaseUUID(forLegacyID: passedUserId)

        try await replaceSwipe(
            swiperID: authUser.id,
            targetUserID: targetUserID,
            direction: "pass"
        )

        _ = client
        return SuccessResponse(message: "Profile passed")
    }

    private func replaceSwipe(swiperID: UUID, targetUserID: UUID, direction: String) async throws {
        let client = try SupabaseService.shared.requireClient()

        _ = try await client
            .from("swipes")
            .delete()
            .eq("swiper_id", value: swiperID.uuidString)
            .eq("target_user_id", value: targetUserID.uuidString)
            .execute()

        _ = try await client
            .from("swipes")
            .insert(
                SupabaseSwipeInsert(
                    swiperID: swiperID.uuidString,
                    targetUserID: targetUserID.uuidString,
                    direction: direction
                )
            )
            .execute()
    }

    private func getMatchesFromSupabase() async throws -> [UserMatch] {
        let client = try SupabaseService.shared.requireClient()
        let authUser = try await client.auth.user()
        let blockedUserIDs = try await fetchBlockedUserIDs(for: authUser.id)

        let matchesAsUserA: [SupabaseMatchRow] = try await client
            .from("matches")
            .select()
            .eq("user_a", value: authUser.id.uuidString)
            .execute()
            .value

        let matchesAsUserB: [SupabaseMatchRow] = try await client
            .from("matches")
            .select()
            .eq("user_b", value: authUser.id.uuidString)
            .execute()
            .value

        let allMatches = (matchesAsUserA + matchesAsUserB)
            .sorted { $0.createdAt > $1.createdAt }

        var result: [UserMatch] = []
        for match in allMatches {
            let otherUserID = match.userA == authUser.id ? match.userB : match.userA
            guard !blockedUserIDs.contains(otherUserID) else { continue }

            let user: User
            do {
                user = try await fetchSupabaseUser(for: otherUserID)
            } catch {
                Self.debugLog("Skipping match \(match.id) due to profile load failure: \(error.localizedDescription)")
                continue
            }

            let lastMessage = try? await fetchLatestMessage(for: match.id)
            result.append(
                UserMatch(
                    id: Int(match.id),
                    user: user,
                    matchedAt: match.createdAt,
                    lastMessage: lastMessage
                )
            )
        }

        return result
    }

    private func getMessagesFromSupabase(matchUserId: Int) async throws -> [ChatMessage] {
        let targetUserID = try await resolveSupabaseUUID(forLegacyID: matchUserId)
        let match = try await fetchMatch(betweenCurrentUserAnd: targetUserID)
        let client = try SupabaseService.shared.requireClient()

        let rows: [SupabaseMessageRow] = try await client
            .from("messages")
            .select()
            .eq("match_id", value: String(match.id))
            .order("created_at")
            .execute()
            .value

        return rows.map { row in
            ChatMessage(
                id: Int(row.id),
                senderId: registerLegacyUserID(for: row.senderID),
                receiverId: registerLegacyUserID(for: row.receiverID),
                text: row.body,
                createdAt: row.createdAt
            )
        }
    }

    private func fetchLatestMessage(for matchID: Int64) async throws -> ChatMessage? {
        let client = try SupabaseService.shared.requireClient()
        let rows: [SupabaseMessageRow] = try await client
            .from("messages")
            .select()
            .eq("match_id", value: String(matchID))
            .order("created_at", ascending: false)
            .limit(1)
            .execute()
            .value

        guard let row = rows.first else { return nil }
        return ChatMessage(
            id: Int(row.id),
            senderId: registerLegacyUserID(for: row.senderID),
            receiverId: registerLegacyUserID(for: row.receiverID),
            text: row.body,
            createdAt: row.createdAt
        )
    }

    private func fetchMatch(betweenCurrentUserAnd otherUserID: UUID) async throws -> SupabaseMatchRow {
        let client = try SupabaseService.shared.requireClient()
        let authUser = try await client.auth.user()
        let pair = normalizedMatchPair(authUser.id, otherUserID)

        let rows: [SupabaseMatchRow] = try await client
            .from("matches")
            .select()
            .eq("user_a", value: pair.userA.uuidString)
            .eq("user_b", value: pair.userB.uuidString)
            .limit(1)
            .execute()
            .value

        guard let match = rows.first else {
            throw APIError.supabaseMatchNotFound
        }

        return match
    }

    private func fetchBlockedUserIDs(for currentUserID: UUID) async throws -> Set<UUID> {
        let client = try SupabaseService.shared.requireClient()

        let blockedByCurrentUser: [SupabaseBlockRow] = try await client
            .from("blocks")
            .select()
            .eq("blocker_id", value: currentUserID.uuidString)
            .execute()
            .value

        let usersBlockingCurrentUser: [SupabaseBlockRow] = try await client
            .from("blocks")
            .select()
            .eq("blocked_user_id", value: currentUserID.uuidString)
            .execute()
            .value

        let blockedIDs = blockedByCurrentUser.map(\.blockedUserID)
        let blockingIDs = usersBlockingCurrentUser.map(\.blockerID)
        return Set(blockedIDs + blockingIDs)
    }

    private func reportUserInSupabase(reportedUserId: Int, reason: String, details: String) async throws -> SuccessResponse {
        let client = try SupabaseService.shared.requireClient()
        let authUser = try await client.auth.user()
        let reportedUUID = try await resolveSupabaseUUID(forLegacyID: reportedUserId)

        _ = try await client
            .from("reports")
            .insert(
                SupabaseReportInsert(
                    reporterUserID: authUser.id.uuidString,
                    reportedUserID: reportedUUID.uuidString,
                    reason: reason,
                    details: details.isEmpty ? nil : details
                )
            )
            .execute()

        return SuccessResponse(message: "Report submitted")
    }

    private func blockUserInSupabase(blockedUserId: Int) async throws -> SuccessResponse {
        let client = try SupabaseService.shared.requireClient()
        let authUser = try await client.auth.user()
        let blockedUUID = try await resolveSupabaseUUID(forLegacyID: blockedUserId)

        _ = try await client
            .from("blocks")
            .insert(
                SupabaseBlockInsert(
                    blockerID: authUser.id.uuidString,
                    blockedUserID: blockedUUID.uuidString
                )
            )
            .execute()

        return SuccessResponse(message: "User blocked")
    }

    private func getReportsFromSupabase() async throws -> [ModerationReport] {
        try await refreshSupabaseModerationAccess()

        guard hasModerationAccess else {
            throw APIError.adminAuthRequired
        }

        let client = try SupabaseService.shared.requireClient()
        let rows: [SupabaseReportRow] = try await client
            .from("reports")
            .select()
            .order("created_at", ascending: false)
            .execute()
            .value

        var reports: [ModerationReport] = []
        for row in rows {
            let reportedName = try? await fetchSupabaseUserName(for: row.reportedUserID)
            let reporterName = try? await fetchSupabaseUserName(for: row.reporterUserID)
            reports.append(
                ModerationReport(
                    id: Int(row.id),
                    reportedUserId: row.reportedUserID.map(registerLegacyUserID(for:)),
                    reportedUserName: reportedName,
                    reporterUserId: row.reporterUserID.map(registerLegacyUserID(for:)),
                    reporterUserName: reporterName,
                    reason: row.reason,
                    details: row.details,
                    status: row.status,
                    createdAt: row.createdAt
                )
            )
        }

        return reports
    }

    private func refreshSupabaseModerationAccess() async throws {
        let client = try SupabaseService.shared.requireClient()
        let authUser = try await client.auth.user()
        let rows: [SupabaseUserRoleRow] = try await client
            .from("user_roles")
            .select()
            .eq("user_id", value: authUser.id.uuidString)
            .limit(1)
            .execute()
            .value

        let hasAccess = rows.first?.role == "moderator" || rows.first?.role == "admin"
        await MainActor.run {
            self.hasModerationAccess = hasAccess
        }
    }

    private func fetchSupabaseUserName(for userID: UUID?) async throws -> String? {
        guard let userID else { return nil }
        let client = try SupabaseService.shared.requireClient()
        let rows: [SupabaseProfileNameRow] = try await client
            .from("profiles")
            .select("name")
            .eq("id", value: userID.uuidString)
            .limit(1)
            .execute()
            .value

        return rows.first?.name
    }

    private func fetchSupabaseUser(for userID: UUID) async throws -> User {
        let client = try SupabaseService.shared.requireClient()

        let profileRows: [SupabaseProfileRow] = try await client
            .from("profiles")
            .select()
            .eq("id", value: userID.uuidString)
            .limit(1)
            .execute()
            .value

        let promptRows: [SupabasePromptRow] = try await client
            .from("profile_prompts")
            .select()
            .eq("user_id", value: userID.uuidString)
            .order("sort_order")
            .execute()
            .value

        let prompts = promptRows.map { PromptAnswer(prompt: $0.prompt, answer: $0.answer) }
        let profile: SupabaseProfileRow
        if let existingProfile = profileRows.first {
            profile = existingProfile
        } else if let authUser = try? await client.auth.user(), authUser.id == userID {
            profile = SupabaseProfileRow(
                id: userID,
                email: authUser.email,
                name: currentUser?.name ?? "New User",
                age: currentUser?.age ?? 18,
                bio: currentUser?.bio ?? "",
                photoPath: currentUser?.photos?.first,
                profileSetupCompleted: false
            )
            Self.debugLog("Using fallback profile data for authenticated Supabase user \(userID)")
        } else {
            throw APIError.supabaseProfileUnavailable
        }

        let user = profile.asLegacyUser(prompts: prompts)
        legacyUserIDMap[user.id] = userID
        if let authUser = try? await client.auth.user(), authUser.id == userID {
            setProfileSetupCompleted(profile.profileSetupCompleted)
        }
        return user
    }

    private func resolveSupabaseUUID(forLegacyID legacyID: Int) async throws -> UUID {
        if let mappedID = legacyUserIDMap[legacyID] {
            return mappedID
        }

        let client = try SupabaseService.shared.requireClient()
        let profileIDs: [SupabaseProfileIdentifierRow] = try await client
            .from("profiles")
            .select("id")
            .execute()
            .value

        for profileID in profileIDs {
            let resolvedLegacyID = registerLegacyUserID(for: profileID.id)
            if resolvedLegacyID == legacyID {
                return profileID.id
            }
        }

        throw APIError.supabaseIdentifierLookupFailed
    }

    private func normalizedMatchPair(_ first: UUID, _ second: UUID) -> (userA: UUID, userB: UUID) {
        if first.uuidString.lowercased() < second.uuidString.lowercased() {
            return (first, second)
        }

        return (second, first)
    }

    private func registerLegacyUserID(for uuid: UUID) -> Int {
        let legacyID = legacyNumericID(from: uuid)
        legacyUserIDMap[legacyID] = uuid
        return legacyID
    }
    
    // MARK: - WebSocket
    
    func connectWS() {
        if BackendMode.current == .supabaseAuthProfile {
            shouldReconnectWebSocket = false
            isConnectingWebSocket = false
            isWebSocketConnected = false
            return
        }

        guard let token = authToken else { return }
        guard !isWebSocketConnected, !isConnectingWebSocket else { return }
        guard let url = URL(string: wsURL) else { return }

        reconnectTask?.cancel()
        shouldReconnectWebSocket = true
        isConnectingWebSocket = true
        isWebSocketConnected = false

        wsTask?.cancel(with: .goingAway, reason: nil)
        wsTask = URLSession.shared.webSocketTask(with: url)
        wsTask?.resume()

        // Send auth message
        let authMessage = ["type": "auth", "token": token]
        if let data = try? JSONSerialization.data(withJSONObject: authMessage),
           let string = String(data: data, encoding: .utf8) {
            wsTask?.send(.string(string)) { error in
                if let error = error {
                    Self.debugLog("WebSocket auth send failed: \(error.localizedDescription)")
                    Task { @MainActor in
                        self.isConnectingWebSocket = false
                        self.isWebSocketConnected = false
                    }
                    self.scheduleReconnectIfNeeded()
                    return
                }

                Task { @MainActor in
                    self.isConnectingWebSocket = false
                    self.isWebSocketConnected = true
                }
            }
        }

        receiveMessage()
    }
    
    private func receiveMessage() {
        wsTask?.receive { [weak self] result in
            switch result {
            case .success(let message):
                let wsMessage = decodeWebSocketMessage(message)
                if let wsMessage {
                    Task { @MainActor [weak self] in
                        self?.messageListeners.values.forEach { $0(wsMessage) }
                    }
                }
                self?.receiveMessage()
                
            case .failure(let error):
                Self.debugLog("WebSocket receive failed: \(error.localizedDescription)")
                Task { @MainActor [weak self] in
                    self?.isConnectingWebSocket = false
                    self?.isWebSocketConnected = false
                }
                self?.scheduleReconnectIfNeeded()
            }
        }
    }

    func sendWSMessage(receiverId: Int, text: String) async throws {
        if BackendMode.current == .supabaseAuthProfile {
            try await sendSupabaseMessage(receiverId: receiverId, text: text)
            return
        }

        if wsTask == nil || (!isWebSocketConnected && !isConnectingWebSocket) {
            connectWS()
        }

        if isConnectingWebSocket {
            try await waitForWebSocketConnection()
        }

        if !isWebSocketConnected {
            throw APIError.webSocketUnavailable
        }

        guard let wsTask else {
            throw APIError.webSocketUnavailable
        }

        let message = ["type": "message", "receiverId": "\(receiverId)", "text": text]
        if let data = try? JSONSerialization.data(withJSONObject: message),
           let string = String(data: data, encoding: .utf8) {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                wsTask.send(.string(string)) { error in
                    if let error = error {
                        Self.debugLog("WebSocket send failed: \(error.localizedDescription)")
                        Task { @MainActor in
                            self.isWebSocketConnected = false
                        }
                        self.scheduleReconnectIfNeeded()
                        continuation.resume(throwing: APIError.webSocketSendFailed(error.localizedDescription))
                    } else {
                        continuation.resume()
                    }
                }
            }
            return
        }

        throw APIError.webSocketSendFailed("Failed to encode message")
    }

    private func sendSupabaseMessage(receiverId: Int, text: String) async throws {
        let client = try SupabaseService.shared.requireClient()
        let authUser = try await client.auth.user()
        let receiverUUID = try await resolveSupabaseUUID(forLegacyID: receiverId)
        let match = try await fetchMatch(betweenCurrentUserAnd: receiverUUID)

        _ = try await client
            .from("messages")
            .insert(
                SupabaseMessageInsert(
                    matchID: match.id,
                    senderID: authUser.id.uuidString,
                    receiverID: receiverUUID.uuidString,
                    body: text
                )
            )
            .execute()
    }
    
    func disconnectWS() {
        shouldReconnectWebSocket = false
        reconnectTask?.cancel()
        reconnectTask = nil
        wsTask?.cancel(with: .goingAway, reason: nil)
        wsTask = nil
        isConnectingWebSocket = false
        isWebSocketConnected = false
    }
    
    @discardableResult
    func addMessageListener(_ listener: @escaping (WebSocketMessage) -> Void) -> UUID {
        let id = UUID()
        messageListeners[id] = listener
        return id
    }

    func removeMessageListener(_ id: UUID) {
        messageListeners.removeValue(forKey: id)
    }

    private func scheduleReconnect() {
        reconnectTask?.cancel()
        reconnectTask = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled else { return }
            self?.connectWS()
        }
    }

    private func scheduleReconnectIfNeeded() {
        guard shouldReconnectWebSocket, authToken != nil, BackendMode.current != .supabaseAuthProfile else {
            return
        }

        scheduleReconnect()
    }

    private func waitForWebSocketConnection(timeout: Duration = .seconds(5)) async throws {
        let deadline = ContinuousClock.now + timeout
        while isConnectingWebSocket && ContinuousClock.now < deadline {
            try await Task.sleep(for: .milliseconds(100))
        }

        if !isWebSocketConnected {
            throw APIError.webSocketUnavailable
        }
    }

    private static func debugLog(_ message: String) {
        guard isDebugLoggingEnabled else { return }
        print("APIService: \(message)")
    }
}

// MARK: - Models

struct AuthData: Codable, Sendable {
    let token: String
    let user: User
}

struct User: Codable, Identifiable, Hashable, Sendable {
    let id: Int
    let name: String
    let email: String?
    let age: Int
    let bio: String
    let photos: [String]?
    let prompts: [PromptAnswer]?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case email
        case age
        case bio
        case photos
        case prompts
    }

    init(id: Int, name: String, email: String?, age: Int, bio: String, photos: [String]?, prompts: [PromptAnswer]?) {
        self.id = id
        self.name = name
        self.email = email
        self.age = age
        self.bio = bio
        self.photos = photos
        self.prompts = prompts
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try decodeLegacyInt(from: container, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        email = try container.decodeIfPresent(String.self, forKey: .email)
        age = try container.decodeIfPresent(Int.self, forKey: .age) ?? 18
        bio = try container.decodeIfPresent(String.self, forKey: .bio) ?? ""
        photos = try container.decodeIfPresent([String].self, forKey: .photos)
        prompts = try container.decodeIfPresent([PromptAnswer].self, forKey: .prompts)
    }
    
    // Hashable conformance
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
    
    static func == (lhs: User, rhs: User) -> Bool {
        lhs.id == rhs.id
    }
}

struct PromptAnswer: Codable, Hashable, Sendable {
    let prompt: String
    let answer: String
}

struct UserMatch: Codable, Identifiable, Hashable, Sendable {
    let id: Int
    let user: User
    let matchedAt: String
    let lastMessage: ChatMessage?
    
    // No custom CodingKeys - backend uses "id" directly
    
    // Hashable conformance
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
    
    static func == (lhs: UserMatch, rhs: UserMatch) -> Bool {
        lhs.id == rhs.id
    }
}

struct ChatMessage: Codable, Identifiable, Hashable, Sendable {
    let id: Int
    let senderId: Int
    let receiverId: Int
    let text: String
    let createdAt: String
    
    enum CodingKeys: String, CodingKey {
        case id
        case senderId
        case sender_id
        case receiverId
        case receiver_id
        case text
        case createdAt
        case created_at
    }

    init(id: Int, senderId: Int, receiverId: Int, text: String, createdAt: String) {
        self.id = id
        self.senderId = senderId
        self.receiverId = receiverId
        self.text = text
        self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try decodeLegacyInt(from: container, forKey: .id)
        senderId = try decodeLegacyInt(from: container, forKeys: [.senderId, .sender_id])
        receiverId = try decodeLegacyInt(from: container, forKeys: [.receiverId, .receiver_id])
        text = try container.decode(String.self, forKey: .text)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
            ?? container.decodeIfPresent(String.self, forKey: .created_at)
            ?? ""
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(senderId, forKey: .senderId)
        try container.encode(receiverId, forKey: .receiverId)
        try container.encode(text, forKey: .text)
        try container.encode(createdAt, forKey: .createdAt)
    }
    
    // Hashable conformance
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
    
    static func == (lhs: ChatMessage, rhs: ChatMessage) -> Bool {
        lhs.id == rhs.id
    }
}

struct WebSocketMessage: Decodable, Sendable {
    let type: String
    let senderId: Int?
    let receiverId: Int?
    let text: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case type
        case senderId
        case sender_id
        case receiverId
        case receiver_id
        case text
        case message
        case createdAt
        case created_at
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decodeIfPresent(String.self, forKey: .type) ?? "message"
        senderId = try decodeOptionalLegacyInt(from: container, forKeys: [.senderId, .sender_id])
        receiverId = try decodeOptionalLegacyInt(from: container, forKeys: [.receiverId, .receiver_id])
        text = try container.decodeIfPresent(String.self, forKey: .text)
            ?? container.decodeIfPresent(String.self, forKey: .message)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
            ?? container.decodeIfPresent(String.self, forKey: .created_at)
    }
}

// MARK: - Request/Response Models

struct RegisterRequest: Codable, Sendable {
    let name: String
    let email: String
    let password: String
    let age: Int
    let bio: String
    let acceptedTerms: Bool
}

struct LoginRequest: Codable, Sendable {
    let email: String
    let password: String
}

struct AppleSignInRequest: Codable, Sendable {
    let appleId: String
    let name: String?
    let email: String?
}

struct AuthResponse: Codable, Sendable {
    let token: String
    let user: User
}

struct LikeRequest: Codable, Sendable {
    let likedUserId: Int
}

struct PassRequest: Codable, Sendable {
    let passedUserId: Int
}

struct LikeResponse: Codable, Sendable {
    let match: Bool
    let matchedUser: User?
}

struct UpdateProfileRequest: Codable, Sendable {
    let name: String?
    let bio: String?
    let age: Int?
}

struct SavePromptsRequest: Codable, Sendable {
    let prompts: [PromptAnswer]
}

struct PhotoUploadResponse: Codable, Sendable {
    let photoUrl: String?
    let user: User?
}

struct AdminLoginRequest: Codable, Sendable {
    let password: String
}

struct AdminLoginResponse: Codable, Sendable {
    let token: String
}

struct ReportRequest: Codable, Sendable {
    let reportedUserId: Int
    let reason: String
    let details: String
}

struct BlockRequest: Codable, Sendable {
    let blockedUserId: Int
}

struct ModerationReport: Decodable, Identifiable, Hashable, Sendable {
    let id: Int
    let reportedUserId: Int?
    let reportedUserName: String?
    let reporterUserId: Int?
    let reporterUserName: String?
    let reason: String
    let details: String?
    let status: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case reportedUserId
        case reported_user_id
        case reportedUserName
        case reported_user_name
        case reporterUserId
        case reporter_user_id
        case reporterUserName
        case reporter_user_name
        case reason
        case details
        case status
        case createdAt
        case created_at
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try decodeLegacyInt(from: container, forKey: .id)
        reportedUserId = try decodeOptionalLegacyInt(from: container, forKeys: [.reportedUserId, .reported_user_id])
        reportedUserName = try container.decodeIfPresent(String.self, forKey: .reportedUserName)
            ?? container.decodeIfPresent(String.self, forKey: .reported_user_name)
        reporterUserId = try decodeOptionalLegacyInt(from: container, forKeys: [.reporterUserId, .reporter_user_id])
        reporterUserName = try container.decodeIfPresent(String.self, forKey: .reporterUserName)
            ?? container.decodeIfPresent(String.self, forKey: .reporter_user_name)
        reason = try container.decodeIfPresent(String.self, forKey: .reason) ?? "unknown"
        details = try container.decodeIfPresent(String.self, forKey: .details)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
            ?? container.decodeIfPresent(String.self, forKey: .created_at)
    }

    init(
        id: Int,
        reportedUserId: Int?,
        reportedUserName: String?,
        reporterUserId: Int?,
        reporterUserName: String?,
        reason: String,
        details: String?,
        status: String?,
        createdAt: String?
    ) {
        self.id = id
        self.reportedUserId = reportedUserId
        self.reportedUserName = reportedUserName
        self.reporterUserId = reporterUserId
        self.reporterUserName = reporterUserName
        self.reason = reason
        self.details = details
        self.status = status
        self.createdAt = createdAt
    }
}

struct HyperbeamRequest: Codable, Sendable {
    let url: String
}

struct HyperbeamResponse: Codable, Sendable, Identifiable {
    var id: String { sessionId }
    let sessionId: String
    let embedUrl: String

    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case embedUrl = "embed_url"
    }
}

struct SuccessResponse: Codable, Sendable {
    let message: String
}

struct ErrorResponse: Codable, Sendable {
    let error: String
}

// MARK: - Errors

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case serverError(String)
    case httpError(Int)
    case adminAuthRequired
    case webSocketUnavailable
    case webSocketSendFailed(String)
    case featureNotMigrated(String)
    case supabaseAuthPendingConfirmation
    case supabaseIdentifierLookupFailed
    case supabaseMatchNotFound
    case supabaseProfileUnavailable
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .serverError(let message):
            return message
        case .httpError(let code):
            return "HTTP Error: \(code)"
        case .adminAuthRequired:
            return "Admin login required"
        case .webSocketUnavailable:
            return "Chat is temporarily unavailable. Please try again."
        case .webSocketSendFailed(let message):
            return "Message failed to send. \(message)"
        case .featureNotMigrated(let message):
            return message
        case .supabaseAuthPendingConfirmation:
            return "Supabase sign up succeeded, but email confirmation is still required before a session is available."
        case .supabaseIdentifierLookupFailed:
            return "The app could not resolve the selected user against the current Supabase session data."
        case .supabaseMatchNotFound:
            return "No Supabase match exists for this conversation yet."
        case .supabaseProfileUnavailable:
            return "The Supabase profile is not ready yet. Please try again in a moment."
        }
    }
}

private struct SupabaseProfileRow: Decodable {
    let id: UUID
    let email: String?
    let name: String
    let age: Int
    let bio: String
    let photoPath: String?
    let profileSetupCompleted: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case name
        case age
        case bio
        case photoPath = "photo_path"
        case profileSetupCompleted = "profile_setup_completed"
    }

    init(
        id: UUID,
        email: String?,
        name: String,
        age: Int,
        bio: String,
        photoPath: String?,
        profileSetupCompleted: Bool
    ) {
        self.id = id
        self.email = email
        self.name = name
        self.age = age
        self.bio = bio
        self.photoPath = photoPath
        self.profileSetupCompleted = profileSetupCompleted
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        email = try container.decodeIfPresent(String.self, forKey: .email)
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? "New User"
        age = try container.decodeIfPresent(Int.self, forKey: .age) ?? 18
        bio = try container.decodeIfPresent(String.self, forKey: .bio) ?? ""
        photoPath = try container.decodeIfPresent(String.self, forKey: .photoPath)
        profileSetupCompleted = try container.decodeIfPresent(Bool.self, forKey: .profileSetupCompleted) ?? false
    }

    func asLegacyUser(prompts: [PromptAnswer]) -> User {
        User(
            id: legacyNumericID(from: id),
            name: name,
            email: email,
            age: age,
            bio: bio,
            photos: photoPath.map { [$0] },
            prompts: prompts.isEmpty ? nil : prompts
        )
    }
}

private struct SupabasePromptRow: Decodable {
    let prompt: String
    let answer: String
    let sortOrder: Int

    enum CodingKeys: String, CodingKey {
        case prompt
        case answer
        case sortOrder = "sort_order"
    }
}

private struct SupabaseProfileUpdate: Encodable {
    let name: String?
    let age: Int?
    let bio: String?
    let acceptedTerms: Bool?

    enum CodingKeys: String, CodingKey {
        case name
        case age
        case bio
        case acceptedTerms = "accepted_terms"
    }
}

private struct SupabaseProfilePhotoUpdate: Encodable {
    let photoPath: String?

    enum CodingKeys: String, CodingKey {
        case photoPath = "photo_path"
    }
}

private struct SupabasePromptInsert: Encodable {
    let userID: String
    let prompt: String
    let answer: String
    let sortOrder: Int

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case prompt
        case answer
        case sortOrder = "sort_order"
    }
}

private struct SupabaseSwipeInsert: Encodable {
    let swiperID: String
    let targetUserID: String
    let direction: String

    enum CodingKeys: String, CodingKey {
        case swiperID = "swiper_id"
        case targetUserID = "target_user_id"
        case direction
    }
}

private struct SupabaseSwipeRow: Decodable {
    let targetUserID: String

    enum CodingKeys: String, CodingKey {
        case targetUserID = "target_user_id"
    }
}

private struct SupabaseMatchInsert: Encodable {
    let userA: String
    let userB: String

    enum CodingKeys: String, CodingKey {
        case userA = "user_a"
        case userB = "user_b"
    }
}

private struct SupabaseMatchRow: Decodable {
    let id: Int64
    let userA: UUID
    let userB: UUID
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case userA = "user_a"
        case userB = "user_b"
        case createdAt = "created_at"
    }
}

private struct SupabaseMessageInsert: Encodable {
    let matchID: Int64
    let senderID: String
    let receiverID: String
    let body: String

    enum CodingKeys: String, CodingKey {
        case matchID = "match_id"
        case senderID = "sender_id"
        case receiverID = "receiver_id"
        case body
    }
}

private struct SupabaseMessageRow: Decodable {
    let id: Int64
    let matchID: Int64
    let senderID: UUID
    let receiverID: UUID
    let body: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case matchID = "match_id"
        case senderID = "sender_id"
        case receiverID = "receiver_id"
        case body
        case createdAt = "created_at"
    }
}

private struct SupabaseBlockInsert: Encodable {
    let blockerID: String
    let blockedUserID: String

    enum CodingKeys: String, CodingKey {
        case blockerID = "blocker_id"
        case blockedUserID = "blocked_user_id"
    }
}

private struct SupabaseBlockRow: Decodable {
    let blockerID: UUID
    let blockedUserID: UUID

    enum CodingKeys: String, CodingKey {
        case blockerID = "blocker_id"
        case blockedUserID = "blocked_user_id"
    }
}

private struct SupabaseReportInsert: Encodable {
    let reporterUserID: String
    let reportedUserID: String
    let reason: String
    let details: String?

    enum CodingKeys: String, CodingKey {
        case reporterUserID = "reporter_user_id"
        case reportedUserID = "reported_user_id"
        case reason
        case details
    }
}

private struct SupabaseReportRow: Decodable {
    let id: Int64
    let reporterUserID: UUID?
    let reportedUserID: UUID?
    let reason: String
    let details: String?
    let status: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case reporterUserID = "reporter_user_id"
        case reportedUserID = "reported_user_id"
        case reason
        case details
        case status
        case createdAt = "created_at"
    }
}

private struct SupabaseUserRoleRow: Decodable {
    let role: String
}

private struct SupabaseProfileNameRow: Decodable {
    let name: String
}

private struct SupabaseProfileIdentifierRow: Decodable {
    let id: UUID
}

private func decodeLegacyInt<Key: CodingKey>(
    from container: KeyedDecodingContainer<Key>,
    forKey key: Key
) throws -> Int {
    if let value = try decodeOptionalLegacyInt(from: container, forKeys: [key]) {
        return value
    }

    throw DecodingError.dataCorruptedError(forKey: key, in: container, debugDescription: "Expected an Int or UUID-compatible identifier.")
}

private func decodeLegacyInt<Key: CodingKey>(
    from container: KeyedDecodingContainer<Key>,
    forKeys keys: [Key]
) throws -> Int {
    if let value = try decodeOptionalLegacyInt(from: container, forKeys: keys) {
        return value
    }

    let fallbackKey = keys.first ?? Key(stringValue: "id")!
    throw DecodingError.dataCorruptedError(forKey: fallbackKey, in: container, debugDescription: "Expected an Int or UUID-compatible identifier.")
}

private func decodeOptionalLegacyInt<Key: CodingKey>(
    from container: KeyedDecodingContainer<Key>,
    forKeys keys: [Key]
) throws -> Int? {
    for key in keys {
        if let intValue = try container.decodeIfPresent(Int.self, forKey: key) {
            return intValue
        }

        if let stringValue = try container.decodeIfPresent(String.self, forKey: key) {
            let trimmedValue = stringValue.trimmingCharacters(in: .whitespacesAndNewlines)

            if let intValue = Int(trimmedValue) {
                return intValue
            }

            if let uuidValue = UUID(uuidString: trimmedValue) {
                return legacyNumericID(from: uuidValue)
            }
        }
    }

    return nil
}

private func legacyNumericID(from uuid: UUID) -> Int {
    let condensed = uuid.uuidString.replacingOccurrences(of: "-", with: "")
    let prefix = String(condensed.prefix(8))
    return Int(prefix, radix: 16) ?? abs(uuid.uuidString.hashValue)
}

private func decodeWebSocketMessage(_ message: URLSessionWebSocketTask.Message) -> WebSocketMessage? {
    let data: Data?
    switch message {
    case .string(let text):
        data = text.data(using: .utf8)
    case .data(let raw):
        data = raw
    @unknown default:
        data = nil
    }
    guard let data else { return nil }
    return try? JSONDecoder().decode(WebSocketMessage.self, from: data)
}

private enum KeychainHelper {
    static func save(_ value: String, service: String, account: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        let attributes: [String: Any] = [
            kSecValueData as String: data
        ]

        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var addQuery = query
            addQuery[kSecValueData as String] = data
            SecItemAdd(addQuery as CFDictionary, nil)
        }
    }

    static func read(service: String, account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess,
              let data = result as? Data,
              let string = String(data: data, encoding: .utf8) else {
            return nil
        }

        return string
    }

    static func delete(service: String, account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]

        SecItemDelete(query as CFDictionary)
    }
}
