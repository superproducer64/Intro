//
//  EULAView.swift
//  Intro
//
//  Created by Sean Connolly on 4/4/26.
//

import SwiftUI

struct EULAView: View {
    @Binding var isPresented: Bool
    @State private var hasScrolledToBottom = false
    @State private var hasAccepted = false
    
    var body: some View {
        ZStack {
            // Background
            Color.black.opacity(0.85)
                .ignoresSafeArea()
            
            // Card
            VStack(spacing: AppSpacing.md) {
                // Header
                VStack(spacing: AppSpacing.sm) {
                    Text("✦ Intro")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(.white)
                    
                    Text("Before you begin")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundStyle(.white)
                    
                    Text("Please read and accept our Terms of Use")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.5))
                }
                .padding(.top, AppSpacing.lg)
                
                // Scrollable terms
                GeometryReader { outerGeometry in
                    ScrollView {
                        VStack {
                            Text(eulaText)
                                .font(.system(size: 11))
                                .foregroundStyle(.white.opacity(0.65))
                                .lineSpacing(6)
                                .padding(AppSpacing.md)

                            GeometryReader { markerGeometry in
                                Color.clear
                                    .frame(height: 1)
                                    .preference(
                                        key: BottomMarkerOffsetKey.self,
                                        value: markerGeometry.frame(in: .global).maxY
                                    )
                            }
                            .frame(height: 1)
                        }
                    }
                    .frame(maxHeight: 240)
                    .background(Color.white.opacity(0.03))
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: AppRadius.md)
                            .stroke(Color.white.opacity(0.07), lineWidth: 1)
                    )
                    .onPreferenceChange(BottomMarkerOffsetKey.self) { markerMaxY in
                        let visibleBottom = outerGeometry.frame(in: .global).maxY
                        if markerMaxY <= visibleBottom + 8 {
                            hasScrolledToBottom = true
                        }
                    }
                }
                .frame(maxHeight: 240)
                
                // Scroll hint
                if !hasScrolledToBottom {
                    Text("↓ Scroll to read the full terms")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.3))
                }
                
                // Checkbox
                HStack(alignment: .top, spacing: 10) {
                    Button {
                        if hasScrolledToBottom {
                            hasAccepted.toggle()
                        }
                    } label: {
                        Image(systemName: hasAccepted ? "checkmark.square.fill" : "square")
                            .foregroundStyle(hasScrolledToBottom ? AppColors.danger : .white.opacity(0.4))
                    }
                    .disabled(!hasScrolledToBottom)
                    
                    Text("I have read and agree to the Terms of Use & Zero-Tolerance Policy")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(hasScrolledToBottom ? 0.7 : 0.4))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, AppSpacing.xs)
                
                // Accept button
                Button {
                    isPresented = false
                    UserDefaults.standard.set(true, forKey: "hasAcceptedEULA")
                } label: {
                    Text("I Agree — Continue to Intro")
                        .font(.headline)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(
                            LinearGradient(
                                colors: [Color(hex: "#e63946"), Color(hex: "#c1121f")],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                        .opacity(hasAccepted ? 1 : 0.4)
                }
                .disabled(!hasAccepted)
                
                // Notice
                Text("We have zero tolerance for objectionable content or abusive behavior. Violations result in immediate account removal.")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.3))
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
                    .padding(.bottom, AppSpacing.md)
            }
            .padding(AppSpacing.lg)
            .background(Color(hex: "#111122"))
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.7), radius: 32)
            .padding(AppSpacing.md)
        }
    }
    
    private let eulaText = """
TERMS OF USE & END USER LICENSE AGREEMENT

Last Updated: April 3, 2026

Welcome to Intro. By creating an account or accessing our platform, you agree to these Terms in full. Please read them carefully.

1. ZERO TOLERANCE POLICY
Intro has an absolute zero-tolerance policy for objectionable content and abusive behavior. This includes but is not limited to: harassment, hate speech, explicit or non-consensual sexual content, threats, spam, and any content that violates applicable law. Violations will result in immediate account removal.

2. USER CONDUCT
You agree to interact with other users with respect and dignity. You may not post content that is offensive, harmful, defamatory, or otherwise objectionable. Intro reserves the right to determine what constitutes a violation at its sole discretion.

3. CONTENT MODERATION
Intro employs automated and manual content review. All reported content will be reviewed within 24 hours. Content found to be in violation will be immediately removed and the responsible user will be permanently banned.

4. REPORTING & BLOCKING
You are encouraged to report objectionable content or abusive users using the in-app tools. Blocking a user removes them from your feed immediately and notifies our Trust & Safety team. We will act on all reports within 24 hours.

5. ENFORCEMENT
Users who violate these Terms will have their content removed and accounts permanently terminated. We cooperate with law enforcement where required by law.

6. YOUR RIGHTS
You may delete your account at any time. Upon deletion, your personal data will be removed in accordance with our Privacy Policy within 30 days.

7. CHANGES TO TERMS
We may update these Terms periodically. Continued use of Intro after changes constitutes acceptance.

By tapping "I Agree," you acknowledge that you have read, understood, and agree to be bound by these Terms of Use.
"""
}

private struct BottomMarkerOffsetKey: PreferenceKey {
    static var defaultValue: CGFloat = .greatestFiniteMagnitude

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

#Preview {
    EULAView(isPresented: .constant(true))
}
