//
//  NewExperiencesScreen.swift
//  Intro
//
//  Created by Sean Connolly on 4/4/26.
//

import SwiftUI

// MARK: - Data Model
struct Experience: Identifiable {
    let id: String
    let title: String
    let icon: String
    let desc: String
    let status: String
    let url: String?
}

let experiences: [Experience] = [
    Experience(id: "cafe",   title: "Virtual Cafe",  icon: "☕", desc: "Share a quiet coffee date from home",        status: "coming_soon", url: nil),
    Experience(id: "movie",  title: "Movie Night",   icon: "🎬", desc: "Watch together in a shared virtual theater", status: "available",   url: "https://www.youtube.com"),
    Experience(id: "gaming", title: "Gaming",        icon: "🎮", desc: "Play casual games together online",          status: "available",   url: "https://www.crazygames.com"),
    Experience(id: "book",   title: "Book Club",     icon: "📚", desc: "Discuss your favorite reads together",       status: "coming_soon", url: nil),
]

// MARK: - Main Screen
struct NewExperiencesScreen: View {
    @ObservedObject private var api = APIService.shared
    @State private var selected: Experience? = nil
    @State private var notifyName = ""
    @State private var notifyEmail = ""
    @State private var alertMessage = ""
    @State private var showAlert = false
    @State private var activeSession: HyperbeamResponse?
    @State private var activeExperienceTitle = ""

    let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text("Experiences")
                    .font(.title).bold()
                    .foregroundColor(AppColors.text)

                Text("Virtual activities to enjoy together")
                    .font(.subheadline)
                    .foregroundColor(AppColors.textSecondary)
                    .padding(.bottom, 16)

                LazyVGrid(columns: columns, spacing: 16) {
                    ForEach(experiences) { exp in
                        ExperienceCard(exp: exp)
                            .onTapGesture { selected = exp }
                    }
                }
            }
            .padding()
        }
        .background(AppColors.bg.ignoresSafeArea())
        .sheet(item: $selected) { exp in
            ExperienceDetailSheet(
                exp: exp,
                notifyName: $notifyName,
                notifyEmail: $notifyEmail,
                onLaunch: { handleLaunch(exp) },
                onNotify: { handleNotify() },
                onClose: { selected = nil }
            )
        }
        .alert(alertMessage, isPresented: $showAlert) {
            Button("OK", role: .cancel) {}
        }
        .fullScreenCover(item: $activeSession) { session in
            HyperbeamExperienceScreen(
                experienceTitle: activeExperienceTitle,
                embedUrl: session.embedUrl,
                onClose: { activeSession = nil }
            )
        }
    }

    // MARK: - Launch Hyperbeam Session
    func handleLaunch(_ exp: Experience) {
        guard let url = exp.url else { return }
        
        Task {
            do {
                let response = try await api.createHyperbeamSession(url: url)
                selected = nil
                activeExperienceTitle = exp.title
                activeSession = response
            } catch {
                alertMessage = error.localizedDescription
                showAlert = true
            }
        }
    }

    // MARK: - Notify Me
    func handleNotify() {
        guard !notifyName.isEmpty, !notifyEmail.isEmpty else {
            alertMessage = "Please fill in your name and email"
            showAlert = true
            return
        }
        alertMessage = "We'll notify you when this experience launches!"
        showAlert = true
        selected = nil
        notifyName = ""
        notifyEmail = ""
    }
}

// MARK: - Experience Card
struct ExperienceCard: View {
    let exp: Experience

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(exp.icon).font(.system(size: 36))
            Text(exp.title).font(.headline).foregroundColor(AppColors.text)
            Text(exp.desc).font(.caption).foregroundColor(AppColors.textMuted).lineLimit(3)
            if exp.status == "coming_soon" {
                Text("Coming Soon")
                    .font(.caption2).bold()
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(AppColors.secondary.opacity(0.4))
                    .foregroundColor(AppColors.text)
                    .cornerRadius(6)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppColors.bgCard)
        .cornerRadius(14)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(AppColors.border))
    }
}

// MARK: - Detail Sheet
struct ExperienceDetailSheet: View {
    let exp: Experience
    @Binding var notifyName: String
    @Binding var notifyEmail: String
    let onLaunch: () -> Void
    let onNotify: () -> Void
    let onClose: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            Text(exp.icon).font(.system(size: 56))
            Text(exp.title).font(.title).bold().foregroundColor(AppColors.text)
            Text(exp.desc).foregroundColor(AppColors.textSecondary).multilineTextAlignment(.center)

            if exp.status == "available" {
                Button("Launch Experience", action: onLaunch)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(AppColors.primary)
                    .foregroundColor(.white)
                    .cornerRadius(12)
            } else {
                VStack(spacing: 12) {
                    Text("Get notified when it's ready").foregroundColor(AppColors.textMuted)
                    TextField("Name", text: $notifyName)
                        .padding()
                        .background(AppColors.inputBg)
                        .foregroundColor(AppColors.text)
                        .cornerRadius(8)
                    TextField("Email", text: $notifyEmail)
                        .padding()
                        .background(AppColors.inputBg)
                        .foregroundColor(AppColors.text)
                        .cornerRadius(8)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                    Button("Notify Me", action: onNotify)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(AppColors.secondary)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                }
            }

            Button("Close", action: onClose)
                .foregroundColor(AppColors.textMuted)
        }
        .padding(24)
        .background(AppColors.bg)
    }
}

#Preview {
    NewExperiencesScreen()
}
