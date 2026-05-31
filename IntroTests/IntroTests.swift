//
//  IntroTests.swift
//  IntroTests
//
//  Created by Sean Connolly on 4/4/26.
//

import Testing
@testable import Intro

struct IntroTests {

    @Test func apiErrorDescriptionsMatchCases() async throws {
        #expect(APIError.invalidURL.errorDescription == "Invalid URL")
        #expect(APIError.invalidResponse.errorDescription == "Invalid response from server")
        #expect(APIError.serverError("Bad request").errorDescription == "Bad request")
        #expect(APIError.httpError(403).errorDescription == "HTTP Error: 403")
    }

    @Test func userEqualityAndHashUseIdentifier() async throws {
        let first = User(id: 42, name: "A", email: "a@example.com", age: 25, bio: "One", photos: nil, prompts: nil)
        let second = User(id: 42, name: "B", email: "b@example.com", age: 30, bio: "Two", photos: nil, prompts: nil)
        let third = User(id: 99, name: "C", email: "c@example.com", age: 27, bio: "Three", photos: nil, prompts: nil)

        #expect(first == second)
        #expect(first != third)
        #expect(Set([first, second, third]).count == 2)
    }

}
