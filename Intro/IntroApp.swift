//
//  IntroApp.swift
//  Intro
//
//  Created by Sean Connolly on 4/4/26.
//

import SwiftUI
import UIKit
import UserNotifications

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        APIService.shared.updatePushDeviceToken(token)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        #if DEBUG
        print("APNs registration failed: \(error.localizedDescription)")
        #endif
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .badge]
    }
}

@MainActor
private enum PushNotificationManager {
    static func requestAuthorizationIfNeeded() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            guard settings.authorizationStatus == .notDetermined else {
                if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
                    DispatchQueue.main.async {
                        UIApplication.shared.registerForRemoteNotifications()
                    }
                }
                return
            }

            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
                if let error {
                    #if DEBUG
                    print("Notification permission request failed: \(error.localizedDescription)")
                    #endif
                }

                guard granted else {
                    return
                }

                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }
    }
}

@main
struct IntroApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject private var api = APIService.shared
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .onAppear {
                    if api.isAuthenticated {
                        PushNotificationManager.requestAuthorizationIfNeeded()
                    }
                }
        }
        .onChange(of: scenePhase) { _, newPhase in
            switch newPhase {
            case .active:
                if api.isAuthenticated {
                    api.connectWS()
                    PushNotificationManager.requestAuthorizationIfNeeded()
                }
            case .background:
                api.disconnectWS()
            case .inactive:
                break
            @unknown default:
                break
            }
        }
        .onChange(of: api.isAuthenticated) { _, isAuthenticated in
            if isAuthenticated {
                api.connectWS()
                PushNotificationManager.requestAuthorizationIfNeeded()
            } else {
                api.disconnectWS()
            }
        }
    }
}
