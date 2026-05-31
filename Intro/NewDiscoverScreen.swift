//
//  NewDiscoverScreen.swift
//  Intro
//
//  Created by Sean Connolly on 4/4/26.
//

import SwiftUI

struct NewDiscoverScreen: View {
    @ObservedObject private var api = APIService.shared
    private let previewProfiles: [User]?
    @State private var profiles: [User] = []
    @State private var currentIndex = 0
    @State private var offset: CGSize = .zero
    @State private var isLoading = true
    @State private var showMatchAnimation = false
    @State private var matchedUser: User?
    @State private var isRefreshing = false
    @State private var isSubmittingAction = false
    @State private var moderationTarget: User?
    @State private var errorMessage: String?

    init(previewProfiles: [User]? = nil) {
        self.previewProfiles = previewProfiles
    }
    
    var body: some View {
        ZStack {
            AppColors.bg.ignoresSafeArea()
            
            VStack {
                // Header
                HStack {
                    Text("Discover")
                        .font(.title)
                        .fontWeight(.bold)
                        .foregroundStyle(AppColors.text)
                    
                    Spacer()

                    if currentProfile != nil {
                        Button {
                            moderationTarget = currentProfile
                        } label: {
                            Image(systemName: "exclamationmark.shield")
                                .font(.title3)
                                .foregroundStyle(AppColors.textSecondary)
                        }
                    }
                }
                .padding(.horizontal, AppSpacing.lg)
                .padding(.top, AppSpacing.md)
                
                if isLoading {
                    Spacer()
                    ProgressView()
                        .tint(AppColors.primary)
                    Spacer()
                } else if profiles.isEmpty || currentIndex >= profiles.count {
                    Spacer()
                    VStack(spacing: AppSpacing.md) {
                        Text(errorMessage == nil ? "👋" : "⚠️")
                            .font(.system(size: 60))
                        Text(errorMessage == nil ? "No More Profiles" : "Discover Unavailable")
                            .font(.title2)
                            .fontWeight(.semibold)
                            .foregroundStyle(AppColors.text)
                        Text(errorMessage ?? "Check back later for new matches!")
                            .foregroundStyle(AppColors.textSecondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, AppSpacing.lg)

                        Button {
                            refreshProfiles()
                        } label: {
                            if isRefreshing {
                                ProgressView()
                                    .tint(AppColors.primary)
                            } else {
                                Text("Refresh Profiles")
                                    .fontWeight(.semibold)
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, AppSpacing.lg)
                                    .padding(.vertical, AppSpacing.md)
                                    .background(AppColors.primary)
                                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                            }
                        }
                        .disabled(isRefreshing)
                    }
                    Spacer()
                } else {
                    // Card stack
                    ZStack {
                        ForEach(profiles.indices, id: \.self) { index in
                            if index >= currentIndex && index < currentIndex + 3 {
                                ProfileCardView(user: profiles[index])
                                    .scaleEffect(index == currentIndex ? 1.0 : 0.95)
                                    .offset(y: CGFloat((index - currentIndex) * 10))
                                    .zIndex(Double(profiles.count - index))
                                    .opacity(index == currentIndex ? 1.0 : 0.5)
                                    .offset(index == currentIndex ? offset : .zero)
                                    .rotationEffect(.degrees(index == currentIndex ? Double(offset.width / 20) : 0))
                                    .gesture(
                                        index == currentIndex ?
                                        DragGesture()
                                            .onChanged { gesture in
                                                offset = gesture.translation
                                            }
                                            .onEnded { gesture in
                                                handleSwipe(gesture.translation)
                                            }
                                        : nil
                                    )
                            }
                        }
                    }
                    .padding(AppSpacing.lg)
                    
                    // Action buttons
                    HStack(spacing: 40) {
                        // Pass button
                        Button {
                            swipeLeft()
                        } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 24))
                                .foregroundStyle(.white)
                                .frame(width: 60, height: 60)
                                .background(AppColors.danger)
                                .clipShape(Circle())
                        }
                        .disabled(isSubmittingAction)
                        
                        // Like button
                        Button {
                            swipeRight()
                        } label: {
                            Image(systemName: "heart.fill")
                                .font(.system(size: 24))
                                .foregroundStyle(.white)
                                .frame(width: 60, height: 60)
                                .background(AppColors.primary)
                                .clipShape(Circle())
                        }
                        .disabled(isSubmittingAction)
                    }
                    .padding(.bottom, AppSpacing.xl)
                }
            }
            
            // Match animation
            if showMatchAnimation, let user = matchedUser {
                MatchAnimationOverlay(user: user) {
                    withAnimation {
                        showMatchAnimation = false
                    }
                }
                    .transition(.scale.combined(with: .opacity))
                    .onTapGesture {
                        withAnimation {
                            showMatchAnimation = false
                        }
                    }
            }
        }
        .onAppear {
            loadProfiles()
        }
        .refreshable {
            await refreshProfiles()
        }
        .sheet(item: $moderationTarget) { user in
            ModerationActionSheet(user: user) {
                handleBlockedUser(user)
            }
        }
    }

    private var currentProfile: User? {
        guard profiles.indices.contains(currentIndex) else { return nil }
        return profiles[currentIndex]
    }
    
    private func loadProfiles() {
        if let previewProfiles {
            applyProfiles(previewProfiles)
            isLoading = false
            return
        }

        Task {
            do {
                let fetchedProfiles = try await api.getProfiles()
                await MainActor.run {
                    errorMessage = nil
                    applyProfiles(fetchedProfiles)
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    profiles = []
                    currentIndex = 0
                    isLoading = false
                }
            }
        }
    }

    @MainActor
    private func refreshProfiles() async {
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }

        do {
            let refreshedProfiles = try await api.getProfiles()
            errorMessage = nil
            applyProfiles(refreshedProfiles)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func refreshProfiles() {
        Task {
            await refreshProfiles()
        }
    }
    
    private func handleSwipe(_ translation: CGSize) {
        if translation.width < -100 {
            swipeLeft()
        } else if translation.width > 100 {
            swipeRight()
        } else {
            withAnimation(.spring()) {
                offset = .zero
            }
        }
    }
    
    private func swipeLeft() {
        guard currentIndex < profiles.count, !isSubmittingAction else { return }
        let profile = profiles[currentIndex]
        errorMessage = nil
        isSubmittingAction = true

        withAnimation(.spring()) {
            offset = CGSize(width: -500, height: 0)
        }

        advanceAfterSwipe()

        Task {
            do {
                _ = try await api.passUser(passedUserId: profile.id)
                await MainActor.run {
                    isSubmittingAction = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isSubmittingAction = false
                    refreshProfiles()
                }
            }
        }
    }
    
    private func swipeRight() {
        guard currentIndex < profiles.count, !isSubmittingAction else { return }
        
        let profile = profiles[currentIndex]
        errorMessage = nil
        isSubmittingAction = true
        
        withAnimation(.spring()) {
            offset = CGSize(width: 500, height: 0)
        }

        advanceAfterSwipe()
        
        // Like the user
        Task {
            do {
                let response = try await api.likeUser(likedUserId: profile.id)
                await MainActor.run {
                    isSubmittingAction = false
                }
                await MainActor.run {
                    if response.match, let matchedUser = response.matchedUser {
                        self.matchedUser = matchedUser
                        withAnimation {
                            showMatchAnimation = true
                        }
                    }
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isSubmittingAction = false
                    refreshProfiles()
                }
            }
        }
    }

    private func advanceAfterSwipe() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) {
            offset = .zero
            currentIndex += 1
            if currentIndex >= profiles.count {
                refreshProfiles()
            }
        }
    }

    private func handleBlockedUser(_ user: User) {
        guard let blockedIndex = profiles.firstIndex(where: { $0.id == user.id }) else { return }
        profiles.remove(at: blockedIndex)

        if blockedIndex < currentIndex {
            currentIndex -= 1
        }

        if currentIndex >= profiles.count {
            currentIndex = max(0, profiles.count - 1)
        }
    }

    private func applyProfiles(_ incomingProfiles: [User]) {
        profiles = incomingProfiles
        currentIndex = 0
        offset = .zero
        isSubmittingAction = false
        moderationTarget = nil
    }
}

struct ProfileCardView: View {
    @ObservedObject private var api = APIService.shared
    let user: User
    
    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .bottom) {
                backgroundView
                
                // Info overlay
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    Text("\(user.name), \(user.age)")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundStyle(.white)
                    
                    if !user.bio.isEmpty {
                        Text(user.bio)
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.9))
                            .lineLimit(2)
                    }
                    
                    // Prompts
                    if let prompts = user.prompts, !prompts.isEmpty {
                        VStack(alignment: .leading, spacing: AppSpacing.xs) {
                            ForEach(prompts.prefix(2), id: \.prompt) { prompt in
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(prompt.prompt)
                                        .font(.caption)
                                        .foregroundStyle(.white.opacity(0.7))
                                    Text(prompt.answer)
                                        .font(.caption)
                                        .foregroundStyle(.white)
                                        .lineLimit(1)
                                }
                            }
                        }
                        .padding(.top, AppSpacing.xs)
                    }
                }
                .padding(AppSpacing.lg)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    LinearGradient(
                        colors: [.clear, .black.opacity(0.8)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
            .clipShape(RoundedRectangle(cornerRadius: AppRadius.xl))
        }
        .frame(height: 550)
    }

    @ViewBuilder
    private var backgroundView: some View {
        if let photoURLString = user.photos?.first, let photoURL = api.resolveMediaURL(from: photoURLString) {
            AsyncImage(url: photoURL) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                default:
                    fallbackBackground
                }
            }
        } else {
            fallbackBackground
        }
    }

    private var fallbackBackground: some View {
        ZStack {
            LinearGradient(
                colors: [AppColors.accent, AppColors.primary],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            Image(systemName: "person.fill")
                .font(.system(size: 100))
                .foregroundStyle(.white.opacity(0.3))
        }
    }
}

struct MatchAnimationOverlay: View {
    let user: User
    let onDismiss: () -> Void
    @State private var animateHeart = false
    
    var body: some View {
        ZStack {
            Color.black.opacity(0.9).ignoresSafeArea()
            
            VStack(spacing: AppSpacing.xl) {
                if #available(iOS 18.0, *) {
                    Image(systemName: "heart.fill")
                        .font(.system(size: 80))
                        .foregroundStyle(AppColors.primary)
                        .symbolEffect(.bounce)
                } else {
                    Image(systemName: "heart.fill")
                        .font(.system(size: 80))
                        .foregroundStyle(AppColors.primary)
                        .scaleEffect(animateHeart ? 1.2 : 1.0)
                        .animation(.spring(response: 0.5, dampingFraction: 0.5).repeatCount(3), value: animateHeart)
                        .onAppear {
                            animateHeart = true
                        }
                }
                
                Text("It's a Match!")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundStyle(.white)
                
                Text("You and \(user.name) liked each other")
                    .foregroundStyle(AppColors.textSecondary)
                
                Button {
                    onDismiss()
                } label: {
                    Text("Send Message")
                        .font(.headline)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(AppColors.primary)
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                }
                .padding(.horizontal, AppSpacing.xxl)
            }
        }
    }
}

#Preview {
    NewDiscoverScreen(previewProfiles: [
        User(
            id: 9001,
            name: "Maya",
            email: "maya@example.com",
            age: 27,
            bio: "Bookstore dates, rainy walks, and cooking something ambitious on a Sunday.",
            photos: nil,
            prompts: [
                PromptAnswer(prompt: "I recharge by...", answer: "Turning my phone off and reading for an hour."),
                PromptAnswer(prompt: "My ideal quiet evening looks like...", answer: "Tea, a film, and no small talk.")
            ]
        )
    ])
}
