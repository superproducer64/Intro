//
//  ContentView.swift
//  Intro
//
//  Created by Sean Connolly on 4/4/26.
//

import SwiftUI

struct ContentView: View {
    @ObservedObject private var api = APIService.shared
    @State private var showSplash = true
    @State private var splashOpacity = 1.0
    @State private var showEULA = !UserDefaults.standard.bool(forKey: "hasAcceptedEULA")
    @State private var hasSeenIntro = UserDefaults.standard.bool(forKey: "hasSeenSignupIntro")
    
    var body: some View {
        ZStack {
            // Main content
            if api.isAuthenticated {
                if api.hasCompletedProfileSetup {
                    IntroMainTabView()
                } else {
                    ProfileSetupScreen()
                }
            } else {
                if hasSeenIntro {
                    LoginScreen()
                } else {
                    IntroView(hasSeenIntro: $hasSeenIntro)
                }
            }
            
            // Splash screen
            if showSplash {
                SplashScreen(opacity: splashOpacity)
                    .onTapGesture {
                        withAnimation {
                            showSplash = false
                        }
                    }
            }
            
            // EULA overlay
            if showEULA {
                EULAView(isPresented: $showEULA)
            }
        }
        .onAppear {
            // Auto-hide splash after 1.5 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                withAnimation(.easeOut(duration: 0.3)) {
                    showSplash = false
                }
            }
        }
    }
}

struct SplashScreen: View {
    let opacity: Double
    
    var body: some View {
        ZStack {
            AppColors.bg.ignoresSafeArea()
            
            VStack(spacing: 12) {
                Text("INTRO")
                    .font(.system(size: 56, weight: .bold))
                    .foregroundStyle(AppColors.primary)
                    .kerning(12)
                
                Text("Dating for Introverts")
                    .font(.system(size: 18))
                    .foregroundStyle(AppColors.textSecondary)
            }
        }
        .opacity(opacity)
    }
}

#Preview {
    ContentView()
}
