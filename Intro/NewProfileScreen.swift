//
//  NewProfileScreen.swift
//  Intro
//
//  Created by Sean Connolly on 4/4/26.
//

import PhotosUI
import SwiftUI
import UIKit

struct NewProfileScreen: View {
    @ObservedObject private var api = APIService.shared
    @State private var showSettings = false
    @State private var showModerationReports = false
    @State private var showAppearanceEditor = false
    @State private var userProfile: User?
    @State private var localPhotoData: Data?
    @State private var selectedAvatar = PROFILE_AVATAR_OPTIONS[0]
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var pendingPhotoData: Data?
    @State private var removePhotoOnSave = false
    @State private var isUpdatingAppearance = false
    @State private var isLoading = true
    @State private var errorMessage: String?
    
    var body: some View {
        NavigationStack {
            ZStack {
                AppColors.bg.ignoresSafeArea()
                
                if isLoading {
                    ProgressView()
                        .tint(AppColors.primary)
                } else if let user = userProfile {
                    ScrollView {
                        VStack(spacing: AppSpacing.lg) {
                            // Profile header
                            VStack(spacing: AppSpacing.md) {
                                ZStack(alignment: .bottomTrailing) {
                                    profileImageView

                                    Button {
                                        showAppearanceEditor = true
                                    } label: {
                                        Image(systemName: "camera.fill")
                                            .font(.system(size: 14, weight: .semibold))
                                            .foregroundStyle(.white)
                                            .frame(width: 34, height: 34)
                                            .background(AppColors.primary)
                                            .clipShape(Circle())
                                            .overlay(
                                                Circle()
                                                    .stroke(AppColors.bg, lineWidth: 2)
                                            )
                                    }
                                }
                                
                                Text(user.name)
                                    .font(.title)
                                    .fontWeight(.bold)
                                    .foregroundStyle(AppColors.text)
                                
                                Text("\(user.age) years old")
                                    .font(.subheadline)
                                    .foregroundStyle(AppColors.textSecondary)
                            }
                            .padding(.top, AppSpacing.xl)
                            
                            // Bio
                            if !user.bio.isEmpty {
                                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                                    Text("About Me")
                                        .font(.headline)
                                        .foregroundStyle(AppColors.textSecondary)
                                    
                                    Text(user.bio)
                                        .foregroundStyle(AppColors.text)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(AppSpacing.lg)
                                .background(AppColors.bgCard)
                                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                            }
                            
                            // Prompts
                            if let prompts = user.prompts, !prompts.isEmpty {
                                VStack(alignment: .leading, spacing: AppSpacing.md) {
                                    Text("My Prompts")
                                        .font(.headline)
                                        .foregroundStyle(AppColors.textSecondary)
                                    
                                    ForEach(prompts, id: \.prompt) { prompt in
                                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                                            Text(prompt.prompt)
                                                .font(.caption)
                                                .foregroundStyle(AppColors.textMuted)
                                            
                                            Text(prompt.answer)
                                                .foregroundStyle(AppColors.text)
                                        }
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding(AppSpacing.lg)
                                        .background(AppColors.bgCard)
                                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                                    }
                                }
                            }
                            
                            // Settings button
                            Button {
                                showSettings = true
                            } label: {
                                HStack {
                                    Image(systemName: "gearshape.fill")
                                    Text("Settings")
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .font(.caption)
                                }
                                .foregroundStyle(AppColors.text)
                                .padding(AppSpacing.lg)
                                .background(AppColors.bgCard)
                                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                            }

                            if api.adminToken != nil || api.hasModerationAccess {
                                Button {
                                    showModerationReports = true
                                } label: {
                                    HStack {
                                        Image(systemName: "shield.lefthalf.filled")
                                        Text("Moderation Reports")
                                        Spacer()
                                        Image(systemName: "chevron.right")
                                            .font(.caption)
                                    }
                                    .foregroundStyle(AppColors.text)
                                    .padding(AppSpacing.lg)
                                    .background(AppColors.bgCard)
                                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                                }
                            }
                            
                            // Logout button
                            Button {
                                api.clearAuth()
                            } label: {
                                Text("Log Out")
                                    .font(.headline)
                                    .foregroundStyle(.white)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(AppColors.danger)
                                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                            }
                            .padding(.top, AppSpacing.lg)
                        }
                        .padding(AppSpacing.lg)
                    }
                } else {
                    ContentUnavailableView(
                        "Profile Unavailable",
                        systemImage: "person.crop.circle.badge.exclamationmark",
                        description: Text(errorMessage ?? "We couldn't load your profile right now.")
                    )
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(isPresented: $showSettings) {
                NewSettingsScreen()
            }
            .navigationDestination(isPresented: $showModerationReports) {
                ModerationReportsScreen()
            }
            .sheet(isPresented: $showAppearanceEditor) {
                appearanceEditorSheet
            }
            .onAppear {
                loadProfile()
            }
            .onChange(of: showAppearanceEditor) { _, isPresented in
                guard isPresented else { return }
                pendingPhotoData = localPhotoData
                removePhotoOnSave = false
                selectedPhotoItem = nil
            }
            .onChange(of: selectedPhotoItem) { _, newItem in
                guard let newItem else { return }

                Task {
                    if let data = try? await newItem.loadTransferable(type: Data.self) {
                        await MainActor.run {
                            pendingPhotoData = data
                            removePhotoOnSave = false
                        }
                    }
                }
            }
            .alert("Profile Error", isPresented: Binding(
                get: { errorMessage != nil && userProfile != nil },
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
    }
    
    private func loadProfile() {
        // Use current user from API or fetch fresh
        if let currentUser = api.currentUser {
            errorMessage = nil
            userProfile = currentUser
            localPhotoData = api.loadLocalProfilePhotoData(for: currentUser.id)
            if let avatarId = api.loadLocalAvatarSelection(for: currentUser.id),
               let avatar = PROFILE_AVATAR_OPTIONS.first(where: { $0.id == avatarId }) {
                selectedAvatar = avatar
            }
            isLoading = false
        } else {
            Task {
                do {
                    let fetchedProfile = try await api.getProfile()
                    await MainActor.run {
                        errorMessage = nil
                        userProfile = fetchedProfile
                        localPhotoData = api.loadLocalProfilePhotoData(for: fetchedProfile.id)
                        if let avatarId = api.loadLocalAvatarSelection(for: fetchedProfile.id),
                           let avatar = PROFILE_AVATAR_OPTIONS.first(where: { $0.id == avatarId }) {
                            selectedAvatar = avatar
                        }
                        isLoading = false
                    }
                } catch {
                    await MainActor.run {
                        userProfile = nil
                        errorMessage = error.localizedDescription
                        isLoading = false
                    }
                }
            }
        }
    }

    private var profileImageView: some View {
        Group {
            if let remotePhotoURL {
                AsyncImage(url: remotePhotoURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    default:
                        localOrAvatarFallbackImage
                    }
                }
            } else {
                localOrAvatarFallbackImage
            }
        }
        .frame(width: 120, height: 120)
        .clipShape(Circle())
    }

    @ViewBuilder
    private var localOrAvatarFallbackImage: some View {
        if let localPhotoData, let image = UIImage(data: localPhotoData) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
        } else {
            fallbackProfileImage
        }
    }

    @ViewBuilder
    private var editorPreviewImage: some View {
        if let pendingPhotoData, let image = UIImage(data: pendingPhotoData) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
        } else if let remotePhotoURL {
            AsyncImage(url: remotePhotoURL) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                default:
                    localOrAvatarFallbackImage
                }
            }
        } else {
            localOrAvatarFallbackImage
        }
    }

    private var remotePhotoURL: URL? {
        guard let photoString = userProfile?.photos?.first else { return nil }
        return api.resolveMediaURL(from: photoString)
    }

    private var fallbackProfileImage: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: selectedAvatar.colors,
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            Image(systemName: selectedAvatar.symbol)
                .font(.system(size: 50))
                .foregroundStyle(.white.opacity(0.85))
        }
    }

    private var appearanceEditorSheet: some View {
        NavigationStack {
            ZStack {
                AppColors.bg.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: AppSpacing.lg) {
                        editorPreviewImage
                            .frame(width: 150, height: 150)
                            .clipShape(Circle())

                        PhotosPicker(selection: $selectedPhotoItem, matching: .images) {
                            Label("Choose New Photo", systemImage: "photo.badge.plus")
                                .font(.headline)
                                .foregroundStyle(AppColors.text)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(AppColors.bgCard)
                                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                        }

                        Button("Use Avatar Only") {
                            pendingPhotoData = nil
                            removePhotoOnSave = true
                        }
                        .foregroundStyle(AppColors.textSecondary)

                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: AppSpacing.md) {
                            ForEach(PROFILE_AVATAR_OPTIONS) { avatar in
                                Button {
                                    selectedAvatar = avatar
                                } label: {
                                    ProfileAvatarCard(
                                        avatar: avatar,
                                        isSelected: selectedAvatar.id == avatar.id
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        Button {
                            saveAppearance()
                        } label: {
                            Text(isUpdatingAppearance ? "Saving..." : "Save Appearance")
                                .font(.headline)
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(isUpdatingAppearance ? AppColors.border : AppColors.primary)
                                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                        }
                        .disabled(isUpdatingAppearance)
                    }
                    .padding(AppSpacing.lg)
                }
            }
            .navigationTitle("Edit Appearance")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.large])
    }

    private func saveAppearance() {
        guard let userId = userProfile?.id else { return }

        isUpdatingAppearance = true
        errorMessage = nil
        api.saveLocalAvatarSelection(selectedAvatar.id)

        Task {
            var appearanceSaveError: String?

            if let pendingPhotoData {
                do {
                    try api.saveLocalProfilePhoto(pendingPhotoData)
                    var uploadedUser: User?
                    do {
                        let response = try await api.uploadProfilePhoto(pendingPhotoData)
                        uploadedUser = response.user
                    } catch {
                        appearanceSaveError = photoUploadFailureMessage(for: error)
                    }
                    await MainActor.run {
                        localPhotoData = pendingPhotoData
                        if let uploadedUser {
                            userProfile = uploadedUser
                        }
                    }
                } catch {
                    appearanceSaveError = "Unable to save the selected photo on this device."
                }
            } else if removePhotoOnSave {
                var didRemoveRemotePhoto = false
                do {
                    try await api.removeProfilePhoto()
                    didRemoveRemotePhoto = true
                } catch {
                    appearanceSaveError = error.localizedDescription
                }

                if didRemoveRemotePhoto {
                    api.clearLocalProfilePhoto(for: userId)
                    await MainActor.run {
                        localPhotoData = nil
                        if let currentUser = api.currentUser {
                            userProfile = currentUser
                        }
                    }
                }
            }

            await MainActor.run {
                if let currentUser = api.currentUser {
                    userProfile = currentUser
                }
                isUpdatingAppearance = false
                if let appearanceSaveError {
                    errorMessage = appearanceSaveError
                } else {
                    showAppearanceEditor = false
                }
            }
        }
    }

    private func photoUploadFailureMessage(for error: Error) -> String {
        "Upload failed: \(String(describing: error))"
    }
}

private struct ProfileAvatarCard: View {
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

#Preview {
    NewProfileScreen()
}
