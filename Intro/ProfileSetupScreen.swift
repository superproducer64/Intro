//
//  ProfileSetupScreen.swift
//  Intro
//
//  Created by Sean Connolly on 4/4/26.
//

import PhotosUI
import SwiftUI

struct ProfileSetupScreen: View {
    @ObservedObject private var api = APIService.shared
    @State private var selectedPrompts: [(prompt: String, answer: String)] = []
    @State private var currentPromptIndex = 0
    @State private var currentAnswer = ""
    @State private var setupStep: SetupStep = .photo
    @State private var selectedAvatar = PROFILE_AVATAR_OPTIONS[0]
    @State private var selectedActivities: Set<String> = []
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var selectedPhotoData: Data?
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            AppColors.bg.ignoresSafeArea()

            VStack(spacing: AppSpacing.xl) {
                progressHeader

                switch setupStep {
                case .photo:
                    photoStepView
                case .activities:
                    activitiesStepView
                case .prompts:
                    promptsStepView
                }
            }
        }
        .navigationBarBackButtonHidden()
        .onChange(of: selectedPhotoItem) { _, newItem in
            guard let newItem else { return }

            Task {
                if let data = try? await newItem.loadTransferable(type: Data.self) {
                    await MainActor.run {
                        selectedPhotoData = data
                    }
                }
            }
        }
    }

    private var progressHeader: some View {
        VStack(spacing: AppSpacing.sm) {
            Text("Build Your Profile")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundStyle(AppColors.text)

            Text(stepSubtitle)
                .font(.subheadline)
                .foregroundStyle(AppColors.textSecondary)

            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(AppColors.border)
                        .frame(height: 4)

                    Rectangle()
                        .fill(AppColors.primary)
                        .frame(width: geometry.size.width * progressValue, height: 4)
                }
            }
            .frame(height: 4)
        }
        .padding(.top, AppSpacing.xxl)
        .padding(.horizontal, AppSpacing.lg)
    }

    private var photoStepView: some View {
        VStack(spacing: AppSpacing.lg) {
            VStack(spacing: AppSpacing.md) {
                profilePreview

                Text("Choose an avatar or add a photo")
                    .font(.title3)
                    .fontWeight(.semibold)
                    .foregroundStyle(AppColors.text)

                Text("You can start with a simple avatar now and upload a better photo later.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(AppColors.textSecondary)
                    .padding(.horizontal, AppSpacing.lg)
            }

            PhotosPicker(selection: $selectedPhotoItem, matching: .images) {
                Label("Add Photo", systemImage: "photo.badge.plus")
                    .font(.headline)
                    .foregroundStyle(AppColors.text)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(AppColors.bgCard)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: AppRadius.md)
                            .stroke(AppColors.border, lineWidth: 1)
                    )
            }
            .padding(.horizontal, AppSpacing.lg)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: AppSpacing.md) {
                ForEach(PROFILE_AVATAR_OPTIONS) { avatar in
                    Button {
                        selectedAvatar = avatar
                    } label: {
                        AvatarChoiceCard(
                            avatar: avatar,
                            isSelected: selectedAvatar.id == avatar.id
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, AppSpacing.lg)

            Spacer()

            footerButton(title: "Continue to Activities", action: {
                withAnimation(.easeInOut) {
                    setupStep = .activities
                }
            })
        }
    }

    private var activitiesStepView: some View {
        VStack(spacing: AppSpacing.lg) {
            VStack(spacing: AppSpacing.md) {
                Text("Pick a few activities")
                    .font(.title3)
                    .fontWeight(.semibold)
                    .foregroundStyle(AppColors.text)

                Text("These help shape your vibe before anyone reads your prompts.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(AppColors.textSecondary)
                    .padding(.horizontal, AppSpacing.lg)
            }

            ScrollView {
                FlowTagLayout(spacing: AppSpacing.sm) {
                    ForEach(activityOptions, id: \.self) { activity in
                        Button {
                            toggleActivity(activity)
                        } label: {
                            Text(activity)
                                .font(.subheadline)
                                .foregroundStyle(selectedActivities.contains(activity) ? AppColors.bg : AppColors.text)
                                .padding(.horizontal, AppSpacing.md)
                                .padding(.vertical, 12)
                                .background(selectedActivities.contains(activity) ? AppColors.accent : AppColors.bgCard)
                                .clipShape(Capsule())
                                .overlay(
                                    Capsule()
                                        .stroke(selectedActivities.contains(activity) ? AppColors.accent : AppColors.border, lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, AppSpacing.lg)
            }

            Text("Choose at least 3")
                .font(.caption)
                .foregroundStyle(AppColors.textMuted)

            Spacer()

            VStack(spacing: AppSpacing.sm) {
                footerButton(title: "Continue to Prompts", isDisabled: selectedActivities.count < 3, action: {
                    withAnimation(.easeInOut) {
                        setupStep = .prompts
                    }
                })

                Button("Back") {
                    withAnimation(.easeInOut) {
                        setupStep = .photo
                    }
                }
                .foregroundStyle(AppColors.textSecondary)
            }
        }
    }

    private var promptsStepView: some View {
        VStack(spacing: AppSpacing.lg) {
            Text(PROMPTS[currentPromptIndex])
                .font(.title3)
                .fontWeight(.semibold)
                .foregroundStyle(AppColors.text)
                .multilineTextAlignment(.center)
                .padding(.horizontal, AppSpacing.lg)

            TextEditor(text: $currentAnswer)
                .frame(height: 150)
                .padding(AppSpacing.md)
                .scrollContentBackground(.hidden)
                .background(AppColors.inputBg)
                .foregroundStyle(AppColors.text)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .overlay(
                    RoundedRectangle(cornerRadius: AppRadius.lg)
                        .stroke(AppColors.border, lineWidth: 1)
                )
                .padding(.horizontal, AppSpacing.lg)

            if currentAnswer.isEmpty {
                Text("Share what makes you unique...")
                    .font(.caption)
                    .foregroundStyle(AppColors.textMuted)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(AppColors.danger)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, AppSpacing.lg)
            }

            Spacer()

            VStack(spacing: AppSpacing.sm) {
                footerButton(title: currentPromptIndex == 2 ? (isSaving ? "Saving..." : "Finish") : "Next", isDisabled: currentAnswer.isEmpty || isSaving, action: {
                    nextPrompt()
                })

                Button("Back") {
                    withAnimation(.easeInOut) {
                        setupStep = .activities
                    }
                }
                .foregroundStyle(AppColors.textSecondary)
            }
        }
    }

    private var profilePreview: some View {
        Group {
            if let selectedPhotoData, let image = UIImage(data: selectedPhotoData) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                ZStack {
                    LinearGradient(
                        colors: selectedAvatar.colors,
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )

                    Image(systemName: selectedAvatar.symbol)
                        .font(.system(size: 52, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.9))
                }
            }
        }
        .frame(width: 140, height: 140)
        .clipShape(Circle())
        .overlay(
            Circle()
                .stroke(AppColors.border, lineWidth: 2)
        )
    }

    private var progressValue: CGFloat {
        switch setupStep {
        case .photo:
            return 1.0 / 3.0
        case .activities:
            return 2.0 / 3.0
        case .prompts:
            let promptProgress = CGFloat(currentPromptIndex) / 3.0
            return min(1.0, (2.0 / 3.0) + (promptProgress / 3.0))
        }
    }

    private var stepSubtitle: String {
        switch setupStep {
        case .photo:
            return "Step 1 of 3: Avatar or photo"
        case .activities:
            return "Step 2 of 3: Activities"
        case .prompts:
            return "Step 3 of 3: Prompt \(currentPromptIndex + 1) of 3"
        }
    }

    private func toggleActivity(_ activity: String) {
        if selectedActivities.contains(activity) {
            selectedActivities.remove(activity)
        } else {
            selectedActivities.insert(activity)
        }
    }

    private func nextPrompt() {
        let trimmedAnswer = currentAnswer.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedAnswer.isEmpty else { return }
        errorMessage = nil

        if currentPromptIndex < 2 {
            storePromptAnswer(trimmedAnswer, for: currentPromptIndex)
            withAnimation(.easeInOut) {
                currentPromptIndex += 1
                currentAnswer = answerForPrompt(at: currentPromptIndex)
            }
        } else {
            savePrompts(finalAnswer: trimmedAnswer)
        }
    }

    private func savePrompts(finalAnswer: String) {
        storePromptAnswer(finalAnswer, for: currentPromptIndex)
        let promptAnswers = selectedPrompts.map { PromptAnswer(prompt: $0.prompt, answer: $0.answer) }
        errorMessage = nil
        isSaving = true

        Task {
            do {
                if let selectedPhotoData {
                    try? api.saveLocalProfilePhoto(selectedPhotoData)
                }
                api.saveLocalAvatarSelection(selectedAvatar.id)
                if let selectedPhotoData {
                    do {
                        _ = try await api.uploadProfilePhoto(selectedPhotoData)
                    } catch {
                        await MainActor.run {
                            isSaving = false
                            errorMessage = photoUploadFailureMessage(for: error)
                        }
                        return
                    }
                }
                _ = try await api.savePrompts(prompts: promptAnswers)
                await MainActor.run {
                    isSaving = false
                }
            } catch {
                await MainActor.run {
                    isSaving = false
                    errorMessage = error.localizedDescription
                }
            }
        }
    }

    private func photoUploadFailureMessage(for error: Error) -> String {
        "Upload failed: \(String(describing: error))"
    }

    private func storePromptAnswer(_ answer: String, for index: Int) {
        let prompt = PROMPTS[index]
        let promptEntry = (prompt: prompt, answer: answer)

        if let existingIndex = selectedPrompts.firstIndex(where: { $0.prompt == prompt }) {
            selectedPrompts[existingIndex] = promptEntry
        } else {
            selectedPrompts.append(promptEntry)
        }

        selectedPrompts.sort { lhs, rhs in
            guard let lhsIndex = PROMPTS.firstIndex(of: lhs.prompt),
                  let rhsIndex = PROMPTS.firstIndex(of: rhs.prompt) else {
                return false
            }
            return lhsIndex < rhsIndex
        }
    }

    private func answerForPrompt(at index: Int) -> String {
        let prompt = PROMPTS[index]
        return selectedPrompts.first(where: { $0.prompt == prompt })?.answer ?? ""
    }

    @ViewBuilder
    private func footerButton(title: String, isDisabled: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding()
                .background(isDisabled ? AppColors.border : AppColors.primary)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
        }
        .disabled(isDisabled)
        .padding(.horizontal, AppSpacing.lg)
        .padding(.bottom, AppSpacing.xl)
    }
}

private enum SetupStep {
    case photo
    case activities
    case prompts
}

private let activityOptions = [
    "Bookstores",
    "Museums",
    "Coffee Walks",
    "Cooking",
    "Indie Films",
    "Live Music",
    "Gaming",
    "Hiking",
    "Journaling",
    "Yoga",
    "Board Games",
    "Photography"
]

private struct AvatarChoiceCard: View {
    let avatar: ProfileAvatarOption
    let isSelected: Bool

    var body: some View {
        VStack(spacing: AppSpacing.md) {
            ZStack {
                RoundedRectangle(cornerRadius: AppRadius.lg)
                    .fill(
                        LinearGradient(
                            colors: avatar.colors,
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(height: 110)

                Image(systemName: avatar.symbol)
                    .font(.system(size: 34, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.9))
            }

            Text(avatar.title)
                .font(.subheadline)
                .foregroundStyle(AppColors.text)
        }
        .padding(AppSpacing.sm)
        .background(AppColors.bgCard)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.lg)
                .stroke(isSelected ? AppColors.primary : AppColors.border, lineWidth: isSelected ? 2 : 1)
        )
    }
}

private struct FlowTagLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(
            in: proposal.replacingUnspecifiedDimensions().width,
            subviews: subviews,
            spacing: spacing
        )
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(
            in: bounds.width,
            subviews: subviews,
            spacing: spacing
        )
        for (index, subview) in subviews.enumerated() {
            subview.place(
                at: CGPoint(x: bounds.minX + result.positions[index].x, y: bounds.minY + result.positions[index].y),
                proposal: .unspecified
            )
        }
    }

    private struct FlowResult {
        var size: CGSize = .zero
        var positions: [CGPoint] = []

        init(in maxWidth: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var currentX: CGFloat = 0
            var currentY: CGFloat = 0
            var lineHeight: CGFloat = 0

            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)

                if currentX + size.width > maxWidth && currentX > 0 {
                    currentX = 0
                    currentY += lineHeight + spacing
                    lineHeight = 0
                }

                positions.append(CGPoint(x: currentX, y: currentY))
                currentX += size.width + spacing
                lineHeight = max(lineHeight, size.height)
            }

            self.size = CGSize(width: maxWidth, height: currentY + lineHeight)
        }
    }
}

#Preview {
    ProfileSetupScreen()
}
