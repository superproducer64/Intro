//
//  RegisterScreen.swift
//  Intro
//
//  Created by Sean Connolly on 4/4/26.
//

import SwiftUI

struct RegisterScreen: View {
    @ObservedObject private var api = APIService.shared
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var age = ""
    @State private var bio = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showProfileSetup = false
    @State private var hasAcceptedTerms = false
    @State private var showTermsOfService = false

    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var trimmedEmail: String { email.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var trimmedPassword: String { password.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var trimmedBio: String { bio.trimmingCharacters(in: .whitespacesAndNewlines) }
    
    var body: some View {
        ZStack {
            AppColors.bg.ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: AppSpacing.lg) {
                    // Header
                    VStack(spacing: AppSpacing.sm) {
                        Text("Create Account")
                            .font(.title)
                            .fontWeight(.bold)
                            .foregroundStyle(AppColors.text)
                        
                        Text("Join Intro - Dating for Introverts")
                            .font(.subheadline)
                            .foregroundStyle(AppColors.textSecondary)
                    }
                    .padding(.top, AppSpacing.xl)
                    
                    // Form
                    VStack(spacing: AppSpacing.md) {
                        // Name
                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            Text("Name")
                                .font(.subheadline)
                                .foregroundStyle(AppColors.textSecondary)
                            
                            TextField("", text: $name)
                                .textContentType(.name)
                                .textInputAutocapitalization(.words)
                                .padding()
                                .background(AppColors.inputBg)
                                .foregroundStyle(AppColors.text)
                                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                                .overlay(
                                    RoundedRectangle(cornerRadius: AppRadius.md)
                                        .stroke(AppColors.border, lineWidth: 1)
                                )
                        }
                        
                        // Email
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
                        
                        // Password
                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            Text("Password")
                                .font(.subheadline)
                                .foregroundStyle(AppColors.textSecondary)
                            
                            SecureField("", text: $password)
                                .textContentType(.newPassword)
                                .padding()
                                .background(AppColors.inputBg)
                                .foregroundStyle(AppColors.text)
                                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                                .overlay(
                                    RoundedRectangle(cornerRadius: AppRadius.md)
                                        .stroke(AppColors.border, lineWidth: 1)
                                )
                        }
                        
                        // Age
                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            Text("Age")
                                .font(.subheadline)
                                .foregroundStyle(AppColors.textSecondary)
                            
                            TextField("", text: $age)
                                .keyboardType(.numberPad)
                                .padding()
                                .background(AppColors.inputBg)
                                .foregroundStyle(AppColors.text)
                                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                                .overlay(
                                    RoundedRectangle(cornerRadius: AppRadius.md)
                                        .stroke(AppColors.border, lineWidth: 1)
                                )
                        }
                        
                        // Bio
                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            Text("About You")
                                .font(.subheadline)
                                .foregroundStyle(AppColors.textSecondary)
                            
                            TextEditor(text: $bio)
                                .frame(height: 100)
                                .padding(AppSpacing.sm)
                                .scrollContentBackground(.hidden)
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

                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            Button {
                                hasAcceptedTerms.toggle()
                            } label: {
                                HStack(alignment: .top, spacing: AppSpacing.sm) {
                                    Image(systemName: hasAcceptedTerms ? "checkmark.square.fill" : "square")
                                        .foregroundStyle(hasAcceptedTerms ? AppColors.primary : AppColors.textMuted)

                                    Text("I agree to the Terms of Service")
                                        .font(.subheadline)
                                        .foregroundStyle(AppColors.text)

                                    Spacer()
                                }
                            }
                            .buttonStyle(.plain)

                            Button {
                                showTermsOfService = true
                            } label: {
                                Text(hasAcceptedTerms ? "Review Terms of Service" : "Read and Accept Terms of Service")
                                    .font(.caption)
                                    .foregroundStyle(AppColors.primary)
                                    .underline()
                            }
                        }
                        
                        // Sign Up button
                        Button {
                            signUpTapped()
                        } label: {
                            if isLoading {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text("Sign Up")
                                    .font(.headline)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(AppColors.primary)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                        .disabled(isLoading || !isFormValid)
                        .opacity((isLoading || !isFormValid) ? 0.6 : 1)
                        
                        // Back to login
                        Button {
                            dismiss()
                        } label: {
                            HStack(spacing: 4) {
                                Text("Already have an account?")
                                    .foregroundStyle(AppColors.textSecondary)
                                Text("Log In")
                                    .foregroundStyle(AppColors.primary)
                                    .fontWeight(.semibold)
                            }
                            .font(.subheadline)
                        }
                        .padding(.top, AppSpacing.sm)
                    }
                    .padding(.horizontal, AppSpacing.lg)
                }
            }
        }
        .navigationBarBackButtonHidden()
        .navigationDestination(isPresented: $showProfileSetup) {
            ProfileSetupScreen()
        }
        .sheet(isPresented: $showTermsOfService) {
            RegistrationTermsSheet(
                content: termsOfServiceContent,
                hasAcceptedTerms: $hasAcceptedTerms
            )
        }
    }
    
    private var isFormValid: Bool {
        !trimmedName.isEmpty &&
        !trimmedEmail.isEmpty &&
        !trimmedPassword.isEmpty &&
        !age.isEmpty &&
        !trimmedBio.isEmpty &&
        hasAcceptedTerms &&
        (Int(age) ?? 0) >= 18
    }
    
    private func signUpTapped() {
        let normalizedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let normalizedPassword = password.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedBio = bio.trimmingCharacters(in: .whitespacesAndNewlines)

        guard let ageInt = Int(age) else {
            errorMessage = "Please enter a valid age"
            return
        }

        guard !normalizedName.isEmpty,
              !normalizedEmail.isEmpty,
              !normalizedPassword.isEmpty,
              !normalizedBio.isEmpty else {
            errorMessage = "Complete all fields before signing up."
            return
        }
        
        errorMessage = nil
        isLoading = true
        
        Task {
            do {
                _ = try await api.register(
                    name: normalizedName,
                    email: normalizedEmail,
                    password: normalizedPassword,
                    age: ageInt,
                    bio: normalizedBio,
                    acceptedTerms: hasAcceptedTerms
                )
                await MainActor.run {
                    name = normalizedName
                    email = normalizedEmail
                    bio = normalizedBio
                    showProfileSetup = true
                }
            } catch {
                await MainActor.run {
                    errorMessage = userFacingRegistrationError(for: error)
                }
            }
            await MainActor.run {
                isLoading = false
            }
        }
    }

    private func userFacingRegistrationError(for error: Error) -> String {
        let message = error.localizedDescription.lowercased()
        let underlyingMessage = error.localizedDescription

        if message.contains("already registered") || message.contains("already been registered") || message.contains("user already registered") {
            return debugError("An account with this email already exists.", underlying: underlyingMessage)
        }

        if message.contains("password") && message.contains("weak") {
            return debugError("Choose a stronger password before signing up.", underlying: underlyingMessage)
        }

        if message.contains("email") && message.contains("invalid") {
            return debugError("Enter a valid email address.", underlying: underlyingMessage)
        }

        if message.contains("network") || message.contains("internet") || message.contains("offline") {
            return debugError("A network error prevented Intro from creating your account.", underlying: underlyingMessage)
        }

        if message.contains("pending confirmation") || message.contains("email confirmation") {
            return debugError("Check your email to finish confirming your new account.", underlying: underlyingMessage)
        }

        return debugError("Intro could not create your account right now.", underlying: underlyingMessage)
    }

    private func debugError(_ friendlyMessage: String, underlying: String) -> String {
        #if DEBUG
        return "\(friendlyMessage)\n\nDebug: \(underlying)"
        #else
        return friendlyMessage
        #endif
    }

    private let termsOfServiceContent = """
    Terms of Service for Intro - Dating for Introverts

    Last updated: April 8, 2026

    By using Intro, you agree to these terms.

    1. Eligibility
    You must be at least 18 years old to use this service.

    2. User Conduct
    You agree to use Intro respectfully and not engage in harassment or abusive behavior.

    3. Content
    You are responsible for the content you post and must not violate others' rights.

    4. Termination
    We reserve the right to terminate accounts that violate these terms.

    5. Disclaimer
    The service is provided "as is" without warranties of any kind.

    6. Changes
    We may update these terms from time to time.

    Contact Us:
    For questions about these terms, please contact us.
    """
}

private struct RegistrationTermsSheet: View {
    @Environment(\.dismiss) private var dismiss
    let content: String
    @Binding var hasAcceptedTerms: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                AppColors.bg.ignoresSafeArea()

                ScrollView {
                    Text(content)
                        .foregroundStyle(AppColors.text)
                        .padding(AppSpacing.lg)
                }
            }
            .navigationTitle("Terms of Service")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: AppSpacing.sm) {
                    Button {
                        hasAcceptedTerms = true
                        dismiss()
                    } label: {
                        Text("Agree and Continue")
                            .font(.headline)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(AppColors.primary)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                    }

                    Button("Close") {
                        dismiss()
                    }
                    .foregroundStyle(AppColors.textSecondary)
                }
                .padding(AppSpacing.lg)
                .background(AppColors.bgLight)
            }
        }
    }
}

#Preview {
    RegisterScreen()
}
