//
//  ModerationReportsScreen.swift
//  Intro
//
//  Created by Sean Connolly on 4/4/26.
//

import SwiftUI

struct ModerationReportsScreen: View {
    @ObservedObject private var api = APIService.shared
    @State private var reports: [ModerationReport] = []
    @State private var adminPassword = ""
    @State private var isLoading = true
    @State private var errorMessage: String?

    private var hasReportAccess: Bool {
        api.hasModerationAccess || api.adminToken != nil
    }

    private var requiresLegacyAdminLogin: Bool {
        !api.isUsingSupabaseBackend && api.adminToken == nil
    }

    var body: some View {
        ZStack {
            AppColors.bg.ignoresSafeArea()

            if isLoading {
                ProgressView()
                    .tint(AppColors.primary)
            } else if requiresLegacyAdminLogin {
                adminLoginView
            } else if !hasReportAccess {
                ContentUnavailableView(
                    "Moderation Access Required",
                    systemImage: "lock.shield",
                    description: Text("Your account does not currently have moderator or admin access.")
                )
            } else if let errorMessage {
                ContentUnavailableView(
                    "Reports Unavailable",
                    systemImage: "exclamationmark.bubble",
                    description: Text(errorMessage)
                )
            } else if reports.isEmpty {
                ContentUnavailableView(
                    "No Reports Yet",
                    systemImage: "checkmark.shield",
                    description: Text("When the backend returns moderation reports, they will appear here.")
                )
            } else {
                List(reports) { report in
                    VStack(alignment: .leading, spacing: AppSpacing.sm) {
                        HStack {
                            Text(report.reason.replacingOccurrences(of: "_", with: " ").capitalized)
                                .font(.headline)
                                .foregroundStyle(AppColors.text)

                            Spacer()

                            if let status = report.status, !status.isEmpty {
                                Text(status.capitalized)
                                    .font(.caption)
                                    .foregroundStyle(AppColors.textSecondary)
                                    .padding(.horizontal, AppSpacing.sm)
                                    .padding(.vertical, 6)
                                    .background(AppColors.bgLight)
                                    .clipShape(Capsule())
                            }
                        }

                        if let reportedUserName = report.reportedUserName ?? report.reportedUserId.map({ "User \($0)" }) {
                            Text("Reported: \(reportedUserName)")
                                .font(.subheadline)
                                .foregroundStyle(AppColors.textSecondary)
                        }

                        if let reporterUserName = report.reporterUserName ?? report.reporterUserId.map({ "User \($0)" }) {
                            Text("Reporter: \(reporterUserName)")
                                .font(.caption)
                                .foregroundStyle(AppColors.textMuted)
                        }

                        if let details = report.details, !details.isEmpty {
                            Text(details)
                                .font(.subheadline)
                                .foregroundStyle(AppColors.text)
                        }

                        if let createdAt = report.createdAt, !createdAt.isEmpty {
                            Text(createdAt)
                                .font(.caption2)
                                .foregroundStyle(AppColors.textMuted)
                        }
                    }
                    .padding(.vertical, AppSpacing.xs)
                    .listRowBackground(AppColors.bgCard)
                }
                .scrollContentBackground(.hidden)
            }
        }
        .navigationTitle("Reports")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Group {
                    if api.adminToken != nil {
                        Menu {
                            Button("Refresh") {
                                loadReports()
                            }
                            Button("Log Out Admin", role: .destructive) {
                                api.clearAdminAuth()
                                reports = []
                                errorMessage = nil
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                                .foregroundStyle(AppColors.primary)
                        }
                    } else if hasReportAccess {
                        Button {
                            loadReports()
                        } label: {
                            Image(systemName: "arrow.clockwise")
                                .foregroundStyle(AppColors.primary)
                        }
                        .disabled(isLoading)
                    }
                }
            }
        }
        .onAppear {
            loadReports()
        }
    }

    private func loadReports() {
        isLoading = true
        errorMessage = nil

        guard hasReportAccess else {
            reports = []
            isLoading = false
            return
        }

        Task {
            do {
                let fetchedReports = try await api.getReports()
                await MainActor.run {
                    reports = fetchedReports
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    reports = []
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }

    private var adminLoginView: some View {
        VStack(spacing: AppSpacing.lg) {
            Image(systemName: "lock.shield")
                .font(.system(size: 44))
                .foregroundStyle(AppColors.primary)

            Text("Admin Login Required")
                .font(.title3)
                .fontWeight(.bold)
                .foregroundStyle(AppColors.text)

            Text("Enter the moderation admin password to retrieve reports from the legacy backend.")
                .multilineTextAlignment(.center)
                .foregroundStyle(AppColors.textSecondary)
                .padding(.horizontal, AppSpacing.lg)

            SecureField("Admin Password", text: $adminPassword)
                .textContentType(.password)
                .padding()
                .background(AppColors.inputBg)
                .foregroundStyle(AppColors.text)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                .padding(.horizontal, AppSpacing.lg)

            if let errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(AppColors.danger)
            }

            Button {
                loginAsAdmin()
            } label: {
                Text("Log In")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(adminPassword.isEmpty ? AppColors.border : AppColors.primary)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
            }
            .disabled(adminPassword.isEmpty)
            .padding(.horizontal, AppSpacing.lg)
        }
    }

    private func loginAsAdmin() {
        isLoading = true
        errorMessage = nil

        Task {
            do {
                try await api.adminLogin(password: adminPassword)
                await MainActor.run {
                    adminPassword = ""
                    loadReports()
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

#Preview {
    NavigationStack {
        ModerationReportsScreen()
    }
}
