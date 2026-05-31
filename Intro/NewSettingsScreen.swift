//
//  NewSettingsScreen.swift
//  Intro
//
//  Created by Sean Connolly on 4/4/26.
//

import SwiftUI

struct NewSettingsScreen: View {
    @ObservedObject private var api = APIService.shared
    @State private var showDeleteConfirmation = false
    @State private var showEditProfile = false
    @State private var showModerationReports = false
    @State private var showSafetyCenter = false
    @State private var showPrivacyPolicy = false
    @State private var showTermsOfService = false
    @State private var errorMessage: String?
    
    var body: some View {
        ZStack {
            AppColors.bg.ignoresSafeArea()
            
            List {
                // Account section
                Section {
                    Button {
                        showEditProfile = true
                    } label: {
                        HStack {
                            Image(systemName: "person.circle.fill")
                                .foregroundStyle(AppColors.primary)
                            Text("Edit Profile")
                                .foregroundStyle(AppColors.text)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(AppColors.textMuted)
                        }
                    }
                } header: {
                    Text("Account")
                        .foregroundStyle(AppColors.textSecondary)
                }
                .listRowBackground(AppColors.bgCard)

                Section {
                    Button {
                        showSafetyCenter = true
                    } label: {
                        HStack {
                            Image(systemName: "exclamationmark.shield.fill")
                                .foregroundStyle(AppColors.primary)
                            Text("Safety Center")
                                .foregroundStyle(AppColors.text)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(AppColors.textMuted)
                        }
                    }

                    if api.adminToken != nil || api.hasModerationAccess {
                        Button {
                            showModerationReports = true
                        } label: {
                            HStack {
                                Image(systemName: "shield.lefthalf.filled")
                                    .foregroundStyle(AppColors.primary)
                                Text("Moderation Reports")
                                    .foregroundStyle(AppColors.text)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundStyle(AppColors.textMuted)
                            }
                        }
                    }
                } header: {
                    Text("Safety")
                        .foregroundStyle(AppColors.textSecondary)
                }
                .listRowBackground(AppColors.bgCard)
                
                // Privacy section
                Section {
                    Button {
                        showPrivacyPolicy = true
                    } label: {
                        HStack {
                            Image(systemName: "lock.shield.fill")
                                .foregroundStyle(AppColors.primary)
                            Text("Privacy Policy")
                                .foregroundStyle(AppColors.text)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(AppColors.textMuted)
                        }
                    }
                    
                    Button {
                        showTermsOfService = true
                    } label: {
                        HStack {
                            Image(systemName: "doc.text.fill")
                                .foregroundStyle(AppColors.primary)
                            Text("Terms of Service")
                                .foregroundStyle(AppColors.text)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(AppColors.textMuted)
                        }
                    }
                } header: {
                    Text("Legal")
                        .foregroundStyle(AppColors.textSecondary)
                }
                .listRowBackground(AppColors.bgCard)
                
                // Danger zone
                Section {
                    Button(role: .destructive) {
                        showDeleteConfirmation = true
                    } label: {
                        HStack {
                            Image(systemName: "trash.fill")
                            Text("Delete Account")
                            Spacer()
                        }
                    }
                } header: {
                    Text("Danger Zone")
                        .foregroundStyle(AppColors.danger)
                }
                .listRowBackground(AppColors.bgCard)
                
                // App version
                Section {
                    HStack {
                        Text("Version")
                            .foregroundStyle(AppColors.textSecondary)
                        Spacer()
                        Text(appVersion)
                            .foregroundStyle(AppColors.textMuted)
                    }
                }
                .listRowBackground(AppColors.bgCard)
            }
            .scrollContentBackground(.hidden)
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showEditProfile) {
            EditProfileSheet()
        }
        .navigationDestination(isPresented: $showSafetyCenter) {
            SafetyCenterView()
        }
        .navigationDestination(isPresented: $showModerationReports) {
            ModerationReportsScreen()
        }
        .confirmationDialog("Delete Account", isPresented: $showDeleteConfirmation, titleVisibility: .visible) {
            Button("Delete Account", role: .destructive) {
                deleteAccount()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Are you sure? This action cannot be undone.")
        }
        .sheet(isPresented: $showPrivacyPolicy) {
            LegalDocumentView(title: "Privacy Policy", content: privacyPolicyContent)
        }
        .sheet(isPresented: $showTermsOfService) {
            LegalDocumentView(title: "Terms of Service", content: termsOfServiceContent)
        }
        .alert("Settings Error", isPresented: Binding(
            get: { errorMessage != nil },
            set: { isPresented in
                if !isPresented {
                    errorMessage = nil
                }
            }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var appVersion: String {
        let shortVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        let buildNumber = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
        return "\(shortVersion) (\(buildNumber))"
    }
    
    private func deleteAccount() {
        Task {
            do {
                _ = try await api.deleteAccount()
                // API will clear auth and user will be logged out
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                }
            }
        }
    }
    
    private let privacyPolicyContent = """
    Privacy Policy for Intro - Dating for Introverts
    
    Last updated: April 4, 2026
    
    Your privacy is important to us. This privacy policy explains how we collect, use, and protect your personal information.
    
    Information We Collect:
    • Profile information (name, age, bio)
    • Usage data and preferences
    • Messages and interactions
    
    How We Use Your Information:
    • To provide and improve our services
    • To match you with compatible users
    • To communicate with you
    
    Data Security:
    We implement appropriate security measures to protect your personal information.
    
    Your Rights:
    You have the right to access, modify, or delete your personal data at any time.
    
    Contact Us:
    If you have questions about this privacy policy, please contact us.
    """
    
    private let termsOfServiceContent = """
    Terms of Service for Intro - Dating for Introverts
    
    Last updated: April 4, 2026
    
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

private struct SafetyCenterView: View {
    @ObservedObject private var api = APIService.shared

    var body: some View {
        List {
            Section {
                safetyRow(
                    title: "Report a Profile",
                    detail: "From Discover, tap the shield menu on a profile to submit a report for harassment, impersonation, spam, explicit content, or other unsafe behavior.",
                    systemImage: "exclamationmark.bubble.fill"
                )

                safetyRow(
                    title: "Block a User",
                    detail: "Blocking removes the person from your feed and conversations immediately and sends the action to backend moderation tooling.",
                    systemImage: "hand.raised.fill"
                )

                safetyRow(
                    title: "Review Commitment",
                    detail: "Intro uses automated and manual review. Reports are queued for moderator review and unsafe users can be restricted or removed.",
                    systemImage: "checkmark.shield.fill"
                )
            } header: {
                Text("In-App Safety")
                    .foregroundStyle(AppColors.textSecondary)
            }
            .listRowBackground(AppColors.bgCard)

            if api.adminToken != nil || api.hasModerationAccess {
                Section {
                    NavigationLink {
                        ModerationReportsScreen()
                    } label: {
                        HStack {
                            Image(systemName: "shield.lefthalf.filled")
                                .foregroundStyle(AppColors.primary)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Moderation Reports")
                                    .foregroundStyle(AppColors.text)
                                Text("Open the reviewer queue available to moderator or admin accounts.")
                                    .font(.caption)
                                    .foregroundStyle(AppColors.textMuted)
                            }
                        }
                    }
                } header: {
                    Text("Moderator Tools")
                        .foregroundStyle(AppColors.textSecondary)
                }
                .listRowBackground(AppColors.bgCard)
            }
        }
        .scrollContentBackground(.hidden)
        .background(AppColors.bg)
        .navigationTitle("Safety Center")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func safetyRow(title: String, detail: String, systemImage: String) -> some View {
        HStack(alignment: .top, spacing: AppSpacing.md) {
            Image(systemName: systemImage)
                .foregroundStyle(AppColors.primary)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .foregroundStyle(AppColors.text)
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(AppColors.textSecondary)
            }
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

struct EditProfileSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var api = APIService.shared
    @State private var name = ""
    @State private var age = ""
    @State private var bio = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ZStack {
                AppColors.bg.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: AppSpacing.lg) {
                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            Text("Name")
                                .font(.subheadline)
                                .foregroundStyle(AppColors.textSecondary)

                            TextField("", text: $name)
                                .textContentType(.name)
                                .autocapitalization(.words)
                                .padding()
                                .background(AppColors.inputBg)
                                .foregroundStyle(AppColors.text)
                                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                        }

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
                        }

                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            Text("Bio")
                                .font(.subheadline)
                                .foregroundStyle(AppColors.textSecondary)

                            TextEditor(text: $bio)
                                .frame(height: 160)
                                .padding(AppSpacing.sm)
                                .scrollContentBackground(.hidden)
                                .background(AppColors.inputBg)
                                .foregroundStyle(AppColors.text)
                                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                        }

                        if let errorMessage {
                            Text(errorMessage)
                                .font(.caption)
                                .foregroundStyle(AppColors.danger)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding(AppSpacing.lg)
                }
            }
            .navigationTitle("Edit Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundStyle(AppColors.textSecondary)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        saveProfile()
                    } label: {
                        if isLoading {
                            ProgressView()
                                .tint(AppColors.primary)
                        } else {
                            Text("Save")
                        }
                    }
                    .disabled(isLoading || !isFormValid)
                    .foregroundStyle(isFormValid ? AppColors.primary : AppColors.textMuted)
                }
            }
            .onAppear {
                if let currentUser = api.currentUser {
                    name = currentUser.name
                    age = String(currentUser.age)
                    bio = currentUser.bio
                }
            }
        }
    }

    private var isFormValid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !bio.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        (Int(age) ?? 0) >= 18
    }

    private func saveProfile() {
        guard let ageValue = Int(age), ageValue >= 18 else {
            errorMessage = "Please enter a valid age"
            return
        }

        errorMessage = nil
        isLoading = true

        Task {
            do {
                _ = try await api.updateProfile(data: UpdateProfileRequest(
                    name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                    bio: bio.trimmingCharacters(in: .whitespacesAndNewlines),
                    age: ageValue
                ))
                await MainActor.run {
                    isLoading = false
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
}

struct LegalDocumentView: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    let content: String
    
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
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundStyle(AppColors.primary)
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        NewSettingsScreen()
    }
}
