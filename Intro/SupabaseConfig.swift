//
//  SupabaseConfig.swift
//  Intro
//
//  Created by Codex on 4/4/26.
//

import Foundation

enum SupabaseConfig {
    private static let urlInfoKey = "SUPABASE_URL"
    private static let anonKeyInfoKey = "SUPABASE_ANON_KEY"
    private static let storageBucketInfoKey = "SUPABASE_STORAGE_BUCKET"

    static var projectURL: URL? {
        guard let rawValue = Bundle.main.object(forInfoDictionaryKey: urlInfoKey) as? String else {
            return nil
        }

        let trimmedValue = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedValue.isEmpty else { return nil }

        return URL(string: trimmedValue)
    }

    static var anonKey: String? {
        guard let rawValue = Bundle.main.object(forInfoDictionaryKey: anonKeyInfoKey) as? String else {
            return nil
        }

        let trimmedValue = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmedValue.isEmpty ? nil : trimmedValue
    }

    static var storageBucket: String {
        guard let rawValue = Bundle.main.object(forInfoDictionaryKey: storageBucketInfoKey) as? String else {
            return "profile-photos"
        }

        let trimmedValue = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmedValue.isEmpty ? "profile-photos" : trimmedValue
    }

    static var isConfigured: Bool {
        projectURL != nil && anonKey != nil
    }
}
