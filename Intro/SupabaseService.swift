//
//  SupabaseService.swift
//  Intro
//
//  Created by Codex on 4/4/26.
//

import Foundation
import Supabase

enum SupabaseConfigurationError: LocalizedError {
    case missingProjectURL
    case missingAnonKey

    var errorDescription: String? {
        switch self {
        case .missingProjectURL:
            return "SUPABASE_URL is not configured for this build."
        case .missingAnonKey:
            return "SUPABASE_ANON_KEY is not configured for this build."
        }
    }
}

@MainActor
final class SupabaseService {
    static let shared = SupabaseService()

    let client: SupabaseClient?

    private init() {
        guard let projectURL = SupabaseConfig.projectURL,
              let anonKey = SupabaseConfig.anonKey else {
            client = nil
            return
        }

        client = SupabaseClient(
            supabaseURL: projectURL,
            supabaseKey: anonKey
        )
    }

    var isConfigured: Bool {
        client != nil
    }

    func requireClient() throws -> SupabaseClient {
        if let client {
            return client
        }

        if SupabaseConfig.projectURL == nil {
            throw SupabaseConfigurationError.missingProjectURL
        }

        throw SupabaseConfigurationError.missingAnonKey
    }
}
