//
//  ModerationActionSheet.swift
//  Intro
//
//  Created by Sean Connolly on 4/4/26.
//

import SwiftUI

struct ModerationActionSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var api = APIService.shared

    let user: User
    let onBlocked: () -> Void

    @State private var selectedReason: ReportReason = .harassment
    @State private var details = ""
    @State private var isSubmittingReport = false
    @State private var isBlocking = false
    @State private var showBlockConfirmation = false
    @State private var errorMessage: String?
    @State private var successMessage: String?

    private var isBusy: Bool {
        isSubmittingReport || isBlocking
    }

    private var trimmedDetails: String {
        details.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var requiresDetailedExplanation: Bool {
        selectedReason == .other || selectedReason == .impersonation || selectedReason == .underage
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AppColors.bg.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: AppSpacing.lg) {
                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            Text("Report or Block \(user.name)")
                                .font(.title3)
                                .fontWeight(.bold)
                                .foregroundStyle(AppColors.text)

                            Text("Use reporting for harassment, impersonation, spam, explicit content, underage concerns, or other unsafe behavior.")
                                .foregroundStyle(AppColors.textSecondary)
                        }

                        if let errorMessage {
                            Text(errorMessage)
                                .font(.caption)
                                .foregroundStyle(AppColors.danger)
                        }

                        if let successMessage {
                            Text(successMessage)
                                .font(.caption)
                                .foregroundStyle(AppColors.success)
                        }

                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            Text("Reason")
                                .font(.headline)
                                .foregroundStyle(AppColors.text)

                            Picker("Reason", selection: $selectedReason) {
                                ForEach(ReportReason.allCases) { reason in
                                    Text(reason.title).tag(reason)
                                }
                            }
                            .pickerStyle(.menu)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(AppColors.bgCard)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                        }

                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            Text("Details")
                                .font(.headline)
                                .foregroundStyle(AppColors.text)

                            TextEditor(text: $details)
                                .frame(minHeight: 120)
                                .padding(AppSpacing.sm)
                                .scrollContentBackground(.hidden)
                                .background(AppColors.inputBg)
                                .foregroundStyle(AppColors.text)
                                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                                .overlay(
                                    RoundedRectangle(cornerRadius: AppRadius.md)
                                        .stroke(AppColors.border, lineWidth: 1)
                                )

                            Text(requiresDetailedExplanation ? "Add a short explanation so the review team has enough context." : "Optional, but helpful for faster moderation review.")
                                .font(.caption)
                                .foregroundStyle(AppColors.textMuted)
                        }

                        Button {
                            submitReport()
                        } label: {
                            Text(isSubmittingReport ? "Sending Report..." : "Submit Safety Report")
                                .font(.headline)
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(isSubmittingReport ? AppColors.border : AppColors.primary)
                                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                        }
                        .disabled(isBusy)

                        Button {
                            showBlockConfirmation = true
                        } label: {
                            Text(isBlocking ? "Blocking..." : "Block User")
                                .font(.headline)
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(isBlocking ? AppColors.border : AppColors.danger)
                                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                        }
                        .disabled(isBusy)

                        Text("Blocking removes this user from your experience immediately. Reporting sends a separate safety report for moderator review.")
                            .font(.caption)
                            .foregroundStyle(AppColors.textMuted)
                    }
                    .padding(AppSpacing.lg)
                }
            }
            .navigationTitle("Safety")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundStyle(AppColors.textSecondary)
                    .disabled(isBusy)
                }
            }
        }
        .confirmationDialog("Block \(user.name)?", isPresented: $showBlockConfirmation, titleVisibility: .visible) {
            Button("Block User", role: .destructive) {
                blockUser()
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("This removes them from your experience immediately. You can also submit a report separately if needed.")
        }
    }

    private func submitReport() {
        if requiresDetailedExplanation && trimmedDetails.count < 10 {
            errorMessage = "Add a short explanation so moderation can review this report."
            successMessage = nil
            return
        }

        errorMessage = nil
        successMessage = nil
        isSubmittingReport = true

        Task {
            do {
                _ = try await api.reportUser(
                    reportedUserId: user.id,
                    reason: selectedReason.backendValue,
                    details: trimmedDetails
                )
                await MainActor.run {
                    isSubmittingReport = false
                    successMessage = "Report submitted for review."
                    details = ""
                }
            } catch {
                await MainActor.run {
                    isSubmittingReport = false
                    errorMessage = error.localizedDescription
                }
            }
        }
    }

    private func blockUser() {
        errorMessage = nil
        successMessage = nil
        isBlocking = true

        Task {
            do {
                _ = try await api.blockUser(blockedUserId: user.id)
                await MainActor.run {
                    isBlocking = false
                    dismiss()
                    onBlocked()
                }
            } catch {
                await MainActor.run {
                    isBlocking = false
                    errorMessage = error.localizedDescription
                }
            }
        }
    }
}

private enum ReportReason: String, CaseIterable, Identifiable {
    case harassment
    case spam
    case impersonation
    case explicitContent
    case underage
    case other

    var id: String { rawValue }

    var title: String {
        switch self {
        case .harassment:
            return "Harassment"
        case .spam:
            return "Spam"
        case .impersonation:
            return "Impersonation"
        case .explicitContent:
            return "Explicit Content"
        case .underage:
            return "Underage User"
        case .other:
            return "Other Safety Concern"
        }
    }

    var backendValue: String {
        switch self {
        case .explicitContent:
            return "explicit_content"
        case .underage:
            return "underage"
        default:
            return rawValue
        }
    }
}
