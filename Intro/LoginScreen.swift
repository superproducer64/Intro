//
//  LoginScreen.swift
//  Intro
//
//  Created by Sean Connolly on 4/4/26.
//

import SwiftUI
import AuthenticationServices
import CryptoKit

struct LoginScreen: View {
    @ObservedObject private var api = APIService.shared
    @State private var email = ""
    @State private var password = ""
    @State private var showRegister = false
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var currentAppleNonce: String?

    private var isAppleSignInAvailable: Bool {
        true
    }

    private var canSubmit: Bool {
        !isLoading &&
        !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !password.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
    
    var body: some View {
        NavigationStack {
            ZStack {
                AppColors.bg.ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: AppSpacing.xl) {
                        Spacer().frame(height: 60)
                        
                        // Logo
                        VStack(spacing: AppSpacing.md) {
                            Text("INTRO")
                                .font(.system(size: 48, weight: .bold))
                                .foregroundStyle(AppColors.primary)
                                .kerning(8)
                            
                            Text("Dating for Introverts")
                                .font(.system(size: 16))
                                .foregroundStyle(AppColors.textSecondary)
                        }
                        
                        Spacer().frame(height: 40)
                        
                        // Login form
                        VStack(spacing: AppSpacing.md) {
                            // Email field
                            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                                Text("Email")
                                    .font(.subheadline)
                                    .foregroundStyle(AppColors.textSecondary)
                                
                                TextField("", text: $email)
                                    .textContentType(.emailAddress)
                                    .textInputAutocapitalization(.never)
                                    .keyboardType(.emailAddress)
                                    .padding()
                                    .background(AppColors.inputBg)
                                    .foregroundStyle(AppColors.text)
                                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: AppRadius.md)
                                            .stroke(AppColors.border, lineWidth: 1)
                                    )
                            }
                            
                            // Password field
                            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                                Text("Password")
                                    .font(.subheadline)
                                    .foregroundStyle(AppColors.textSecondary)
                                
                                SecureField("", text: $password)
                                    .textContentType(.password)
                                    .padding()
                                    .background(AppColors.inputBg)
                                    .foregroundStyle(AppColors.text)
                                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: AppRadius.md)
                                            .stroke(AppColors.border, lineWidth: 1)
                                    )
                            }
                            
                            // Error message
                            if let error = errorMessage {
                                Text(error)
                                    .font(.caption)
                                    .foregroundStyle(AppColors.danger)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            
                            // Login button
                            Button {
                                loginTapped()
                            } label: {
                                if isLoading {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Text("Log In")
                                        .font(.headline)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(AppColors.primary)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                            .disabled(!canSubmit)
                            .opacity(canSubmit ? 1 : 0.6)
                            
                            if isAppleSignInAvailable {
                                HStack {
                                    Rectangle()
                                        .fill(AppColors.border)
                                        .frame(height: 1)

                                    Text("or")
                                        .font(.caption)
                                        .foregroundStyle(AppColors.textMuted)
                                        .padding(.horizontal, AppSpacing.sm)

                                    Rectangle()
                                        .fill(AppColors.border)
                                        .frame(height: 1)
                                }

                                SignInWithAppleButton(.signIn) { request in
                                    request.requestedScopes = [.fullName, .email]
                                    let nonce = randomNonceString()
                                    currentAppleNonce = nonce
                                    request.nonce = sha256(nonce)
                                } onCompletion: { result in
                                    handleAppleSignIn(result)
                                }
                                .signInWithAppleButtonStyle(.white)
                                .frame(height: 50)
                                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                            }
                            
                            // Register link
                            Button {
                                showRegister = true
                            } label: {
                                HStack(spacing: 4) {
                                    Text("Don't have an account?")
                                        .foregroundStyle(AppColors.textSecondary)
                                    Text("Sign Up")
                                        .foregroundStyle(AppColors.primary)
                                        .fontWeight(.semibold)
                                }
                                .font(.subheadline)
                            }
                            .padding(.top, AppSpacing.md)
                        }
                        .padding(.horizontal, AppSpacing.lg)
                        
                        Spacer()
                    }
                }
            }
            .navigationDestination(isPresented: $showRegister) {
                RegisterScreen()
            }
        }
    }
    
    private func loginTapped() {
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let normalizedPassword = password.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedEmail.isEmpty, !normalizedPassword.isEmpty else {
            errorMessage = "Enter both email and password."
            return
        }

        errorMessage = nil
        isLoading = true
        
        Task {
            do {
                _ = try await api.login(email: normalizedEmail, password: normalizedPassword)
                await MainActor.run {
                    email = normalizedEmail
                    api.connectWS()
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = userFacingAuthError(for: error, action: "log in")
                    isLoading = false
                }
            }
        }
    }
    
    private func handleAppleSignIn(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            guard let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential else {
                return
            }
            
            let appleId = appleIDCredential.user
            let name = appleIDCredential.fullName?.givenName
            let email = appleIDCredential.email
            let identityToken = appleIDCredential.identityToken.flatMap { String(data: $0, encoding: .utf8) }
            let nonce = currentAppleNonce
            
            Task {
                do {
                    _ = try await api.appleSignIn(
                        appleId: appleId,
                        name: name,
                        email: email,
                        identityToken: identityToken,
                        nonce: nonce
                    )
                    api.connectWS()
                } catch {
                    await MainActor.run {
                        errorMessage = userFacingAuthError(for: error, action: "sign in with Apple")
                    }
                }
            }
            
        case .failure(let error):
            errorMessage = userFacingAuthError(for: error, action: "sign in with Apple")
        }
    }

    private func userFacingAuthError(for error: Error, action: String) -> String {
        let message = error.localizedDescription.lowercased()
        let underlyingMessage = error.localizedDescription

        if message.contains("invalid login credentials") || message.contains("invalid email or password") {
            return debugError("The email or password is incorrect.", underlying: underlyingMessage)
        }

        if message.contains("email not confirmed") || message.contains("pending confirmation") {
            return debugError("Check your email and confirm your account before trying again.", underlying: underlyingMessage)
        }

        if message.contains("network") || message.contains("internet") || message.contains("offline") {
            return debugError("A network error prevented Intro from trying to \(action).", underlying: underlyingMessage)
        }

        return debugError("Intro could not \(action) right now.", underlying: underlyingMessage)
    }

    private func debugError(_ friendlyMessage: String, underlying: String) -> String {
        #if DEBUG
        return "\(friendlyMessage)\n\nDebug: \(underlying)"
        #else
        return friendlyMessage
        #endif
    }

    private func sha256(_ input: String) -> String {
        let inputData = Data(input.utf8)
        let hashedData = SHA256.hash(data: inputData)
        return hashedData.compactMap { String(format: "%02x", $0) }.joined()
    }

    private func randomNonceString(length: Int = 32) -> String {
        precondition(length > 0)
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        result.reserveCapacity(length)

        while result.count < length {
            var randomByte: UInt8 = 0
            let status = SecRandomCopyBytes(kSecRandomDefault, 1, &randomByte)
            if status != errSecSuccess {
                continue
            }

            if randomByte < charset.count {
                result.append(charset[Int(randomByte)])
            }
        }

        return result
    }
}

#Preview {
    LoginScreen()
}
