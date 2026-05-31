//
//  IntroView.swift
//  Intro
//
//  Created by Sean Connolly on 4/4/26.
//

import SwiftUI

struct IntroView: View {
    @Binding var hasSeenIntro: Bool
    @State private var currentPage = 0

    private let pages: [IntroPage] = [
        IntroPage(
            systemImage: "person.2.crop.square.stack.fill",
            title: "Dating that starts quietly",
            description: "Intro is built for people who want slower, more intentional first steps."
        ),
        IntroPage(
            systemImage: "shield.checkered",
            title: "Safety comes first",
            description: "Clear terms, reporting tools, and zero tolerance for abusive behavior are part of signup from the start."
        ),
        IntroPage(
            systemImage: "text.bubble.fill",
            title: "Show who you are",
            description: "Create your account, answer a few prompts, and let your profile do more of the talking."
        )
    ]

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: "#110f1f"), Color(hex: "#261633"), Color(hex: "#3c1f3c")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: AppSpacing.xl) {
                Spacer()

                TabView(selection: $currentPage) {
                    ForEach(Array(pages.enumerated()), id: \.offset) { index, page in
                        IntroPageView(page: page)
                            .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .always))
                .indexViewStyle(.page(backgroundDisplayMode: .interactive))

                VStack(spacing: AppSpacing.md) {
                    Button {
                        advance()
                    } label: {
                        Text(currentPage == pages.count - 1 ? "Continue to Sign Up" : "Next")
                            .font(.headline)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(AppColors.primary)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                    }

                    if currentPage < pages.count - 1 {
                        Button("Skip") {
                            completeIntro()
                        }
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.7))
                    }
                }
                .padding(.horizontal, AppSpacing.lg)
                .padding(.bottom, AppSpacing.xl)
            }
        }
    }

    private func advance() {
        if currentPage < pages.count - 1 {
            withAnimation(.easeInOut) {
                currentPage += 1
            }
        } else {
            completeIntro()
        }
    }

    private func completeIntro() {
        UserDefaults.standard.set(true, forKey: "hasSeenSignupIntro")
        withAnimation(.easeInOut) {
            hasSeenIntro = true
        }
    }
}

private struct IntroPageView: View {
    let page: IntroPage

    var body: some View {
        VStack(spacing: AppSpacing.lg) {
            Spacer()

            ZStack {
                Circle()
                    .fill(Color.white.opacity(0.08))
                    .frame(width: 180, height: 180)

                Image(systemName: page.systemImage)
                    .font(.system(size: 72, weight: .semibold))
                    .foregroundStyle(.white)
            }

            VStack(spacing: AppSpacing.md) {
                Text(page.title)
                    .font(.system(size: 32, weight: .bold))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white)

                Text(page.description)
                    .font(.body)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white.opacity(0.75))
                    .padding(.horizontal, AppSpacing.xl)
            }

            Spacer()
        }
        .padding(.vertical, AppSpacing.xl)
    }
}

private struct IntroPage {
    let systemImage: String
    let title: String
    let description: String
}

#Preview {
    IntroView(hasSeenIntro: .constant(false))
}
