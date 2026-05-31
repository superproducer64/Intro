//
//  IntroMainTabView.swift
//  Intro
//
//  Created by Sean Connolly on 4/4/26.
//

import SwiftUI

struct IntroMainTabView: View {
    @State private var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            NewDiscoverScreen()
                .tabItem {
                    Label("Discover", systemImage: "sparkle.magnifyingglass")
                }
                .tag(0)
            
            NewMatchesScreen()
                .tabItem {
                    Label("Matches", systemImage: "heart.fill")
                }
                .tag(1)

            NewProfileScreen()
                .tabItem {
                    Label("Profile", systemImage: "person.fill")
                }
                .tag(2)
        }
        .tint(AppColors.primary)
        .onAppear {
            // Customize tab bar appearance
            let appearance = UITabBarAppearance()
            appearance.backgroundColor = UIColor(AppColors.bgLight)
            appearance.shadowColor = UIColor(AppColors.border)
            
            UITabBar.appearance().standardAppearance = appearance
            UITabBar.appearance().scrollEdgeAppearance = appearance
        }
    }
}

#Preview {
    IntroMainTabView()
}
