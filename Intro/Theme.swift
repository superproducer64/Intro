//
//  Theme.swift
//  Intro
//
//  Created by Sean Connolly on 4/4/26.
//

import SwiftUI

struct AppColors {
    // Nature-inspired palette - Sage to Teal gradient
    static let sageLightest = Color(hex: "#B8C6A3")      // Light sage - subtle backgrounds
    static let sageSoft = Color(hex: "#9FBE9A")          // Soft moss - secondary elements
    static let eucalyptus = Color(hex: "#7FAF97")        // Muted eucalyptus - accents
    static let tealDusty = Color(hex: "#5FA79A")         // Dusty teal - interactive elements
    static let tealDeep = Color(hex: "#2F918C")          // Deep teal - primary actions
    
    // Semantic color assignments
    static let bg = Color(hex: "#1a1d1a")                // Very dark green-tinted black
    static let bgLight = Color(hex: "#232b23")           // Slightly lighter dark green
    static let bgCard = Color(hex: "#2a342a")            // Card backgrounds - dark sage tint
    static let primary = tealDeep                        // Main brand color - deep teal
    static let primaryLight = tealDusty                  // Lighter primary - dusty teal
    static let secondary = eucalyptus                    // Secondary actions - eucalyptus
    static let accent = sageSoft                         // Subtle accents - soft moss
    static let text = Color(hex: "#f5f7f5")             // Off-white with sage hint
    static let textSecondary = sageLightest              // Light sage for secondary text
    static let textMuted = Color(hex: "#8a9a8a")        // Muted sage-gray
    static let border = Color(hex: "#3a4a3a")           // Dark sage border
    static let success = sageSoft                        // Success state - soft moss
    static let warning = Color(hex: "#C6B89A")          // Warm sage-beige for warnings
    static let danger = Color(hex: "#B89A9A")           // Muted rose-sage for danger
    static let inputBg = Color(hex: "#1e251e")          // Input field backgrounds
    static let cardShadow = Color.black.opacity(0.3)
}

struct AppSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48
}

struct AppRadius {
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
    static let round: CGFloat = 999
}

let PROMPTS = [
    "My ideal quiet evening looks like...",
    "I recharge by...",
    "My favorite comfort activity is...",
    "A perfect weekend for me involves...",
    "I feel most connected when...",
    "The book/show that changed my perspective...",
    "My go-to comfort food is...",
    "I'm secretly passionate about...",
]

struct ProfileAvatarOption: Identifiable, Equatable {
    let id: String
    let title: String
    let symbol: String
    let colors: [Color]
}

let PROFILE_AVATAR_OPTIONS: [ProfileAvatarOption] = [
    ProfileAvatarOption(id: "leaf", title: "Leaf", symbol: "leaf.fill", colors: [AppColors.primary, AppColors.secondary]),
    ProfileAvatarOption(id: "moon", title: "Moon", symbol: "moon.stars.fill", colors: [Color(hex: "#4a5d4f"), Color(hex: "#708d81")]),
    ProfileAvatarOption(id: "headphones", title: "Headphones", symbol: "headphones", colors: [Color(hex: "#355c5c"), Color(hex: "#6c9a8b")]),
    ProfileAvatarOption(id: "book", title: "Book", symbol: "book.fill", colors: [Color(hex: "#6b705c"), Color(hex: "#a5a58d")])
]

// Helper extension for hex colors
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
