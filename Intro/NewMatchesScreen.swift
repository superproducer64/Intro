//
//  NewMatchesScreen.swift
//  Intro
//
//  Created by Sean Connolly on 4/4/26.
//

import SwiftUI

struct NewMatchesScreen: View {
    @ObservedObject private var api = APIService.shared
    @State private var matches: [UserMatch] = []
    @State private var isLoading = true
    @State private var isRefreshing = false
    @State private var errorMessage: String?
    @State private var selectedMatch: UserMatch?
    
    var body: some View {
        NavigationStack {
            ZStack {
                AppColors.bg.ignoresSafeArea()
                
                VStack {
                    // Header
                    HStack {
                        Text("Matches")
                            .font(.title)
                            .fontWeight(.bold)
                            .foregroundStyle(AppColors.text)
                        
                        Spacer()
                    }
                    .padding(.horizontal, AppSpacing.lg)
                    .padding(.top, AppSpacing.md)
                    
                    if isLoading {
                        Spacer()
                        ProgressView()
                            .tint(AppColors.primary)
                        Spacer()
                    } else if matches.isEmpty {
                        Spacer()
                        VStack(spacing: AppSpacing.md) {
                            Text("💜")
                                .font(.system(size: 60))
                            Text(errorMessage == nil ? "No Matches Yet" : "Matches Unavailable")
                                .font(.title2)
                                .fontWeight(.semibold)
                                .foregroundStyle(AppColors.text)
                            Text(errorMessage ?? "Start swiping to find your matches!")
                                .foregroundStyle(AppColors.textSecondary)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, AppSpacing.lg)

                            Button {
                                refreshMatches()
                            } label: {
                                if isRefreshing {
                                    ProgressView()
                                        .tint(AppColors.primary)
                                } else {
                                    Text("Refresh Matches")
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
                        ScrollView {
                            LazyVGrid(columns: [
                                GridItem(.flexible()),
                                GridItem(.flexible())
                            ], spacing: AppSpacing.md) {
                                ForEach(matches) { match in
                                    MatchCardView(match: match)
                                        .onTapGesture {
                                            selectedMatch = match
                                        }
                                }
                            }
                            .padding(AppSpacing.lg)
                        }
                    }
                }
            }
            .navigationDestination(item: $selectedMatch) { match in
                NewChatScreen(match: match)
            }
            .onAppear {
                loadMatches()
            }
            .refreshable {
                await refreshMatches()
            }
        }
    }
    
    private func loadMatches() {
        errorMessage = nil
        isLoading = true

        Task {
            do {
                let fetchedMatches = try await api.getMatches()
                await MainActor.run {
                    matches = fetchedMatches
                    errorMessage = nil
                    isLoading = false
                    isRefreshing = false
                }
            } catch {
                await MainActor.run {
                    if matches.isEmpty {
                        matches = []
                    }
                    errorMessage = error.localizedDescription
                    isLoading = false
                    isRefreshing = false
                }
            }
        }
    }

    @MainActor
    private func refreshMatches() async {
        guard !isRefreshing else { return }
        isRefreshing = true

        do {
            let fetchedMatches = try await api.getMatches()
            matches = fetchedMatches
            errorMessage = nil
        } catch {
            if matches.isEmpty {
                matches = []
            }
            errorMessage = error.localizedDescription
        }

        isRefreshing = false
    }

    private func refreshMatches() {
        Task {
            await refreshMatches()
        }
    }
}

struct MatchCardView: View {
    @ObservedObject private var api = APIService.shared
    let match: UserMatch
    
    var body: some View {
        VStack(spacing: AppSpacing.sm) {
            matchImageView
            .frame(height: 180)
            .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
            
            // Name
            Text("\(match.user.name), \(match.user.age)")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(AppColors.text)
                .lineLimit(1)
            
            // Last message preview
            if let lastMessage = match.lastMessage {
                Text(lastMessage.text)
                    .font(.caption)
                    .foregroundStyle(AppColors.textMuted)
                    .lineLimit(1)
            } else {
                Text("Say hi! 👋")
                    .font(.caption)
                    .foregroundStyle(AppColors.primary)
            }
        }
    }

    @ViewBuilder
    private var matchImageView: some View {
        if let remotePhotoURL {
            AsyncImage(url: remotePhotoURL) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                default:
                    fallbackImageView
                }
            }
        } else {
            fallbackImageView
        }
    }

    private var remotePhotoURL: URL? {
        guard let photoString = match.user.photos?.first else { return nil }
        return api.resolveMediaURL(from: photoString)
    }

    private var fallbackImageView: some View {
        ZStack {
            LinearGradient(
                colors: [AppColors.accent, AppColors.primary],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            Image(systemName: "person.fill")
                .font(.system(size: 40))
                .foregroundStyle(.white.opacity(0.5))
        }
    }
}

#Preview {
    NewMatchesScreen()
}
