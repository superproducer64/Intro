//
//  NewChatScreen.swift
//  Intro
//
//  Created by Sean Connolly on 4/4/26.
//

import SwiftUI

struct NewChatScreen: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject private var api = APIService.shared
    let match: UserMatch
    @State private var messages: [ChatMessage] = []
    @State private var messageText = ""
    @State private var isLoading = true
    @State private var isSending = false
    @State private var messageListenerID: UUID?
    @State private var messagePollingTask: Task<Void, Never>?
    @State private var errorMessage: String?
    @State private var showModerationSheet = false
    @State private var isRefreshingMessages = false
    
    var body: some View {
        ZStack {
            AppColors.bg.ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Messages list
                if isLoading {
                    Spacer()
                    ProgressView()
                        .tint(AppColors.primary)
                    Spacer()
                } else if messages.isEmpty {
                    Spacer()
                    VStack(spacing: AppSpacing.md) {
                        Image(systemName: errorMessage == nil ? "bubble.left.and.bubble.right" : "exclamationmark.bubble")
                            .font(.system(size: 44))
                            .foregroundStyle(errorMessage == nil ? AppColors.textMuted : AppColors.danger)

                        Text(errorMessage == nil ? "No Messages Yet" : "Chat Unavailable")
                            .font(.title3)
                            .fontWeight(.semibold)
                            .foregroundStyle(AppColors.text)

                        Text(errorMessage == nil ? "Say hi to start the conversation." : errorMessage ?? "")
                            .foregroundStyle(AppColors.textSecondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, AppSpacing.lg)

                        if errorMessage != nil {
                            Button {
                                loadMessages()
                            } label: {
                                Text("Retry")
                                    .font(.headline)
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, AppSpacing.lg)
                                    .padding(.vertical, AppSpacing.md)
                                    .background(AppColors.primary)
                                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                            }
                        }
                    }
                    Spacer()
                } else {
                    ScrollViewReader { proxy in
                        ScrollView {
                            LazyVStack(spacing: AppSpacing.md) {
                                ForEach(messages) { message in
                                    MessageBubbleView(
                                        message: message,
                                        isFromCurrentUser: message.senderId == api.currentUser?.id
                                    )
                                    .id(message.id)
                                }
                            }
                            .padding(AppSpacing.lg)
                        }
                        .onChange(of: messages.count) { _, _ in
                            if let lastMessage = messages.last {
                                withAnimation {
                                    proxy.scrollTo(lastMessage.id, anchor: .bottom)
                                }
                            }
                        }
                    }
                }
                
                // Message input
                HStack(spacing: AppSpacing.md) {
                    VStack(alignment: .leading, spacing: AppSpacing.sm) {
                        if let errorMessage {
                            Text(errorMessage)
                                .font(.caption)
                                .foregroundStyle(AppColors.danger)
                        }

                        TextField("Type a message...", text: $messageText, axis: .vertical)
                            .padding(AppSpacing.md)
                            .background(AppColors.inputBg)
                            .foregroundStyle(AppColors.text)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.round))
                            .lineLimit(1...5)
                    }
                    
                    Button {
                        sendMessage()
                    } label: {
                        Group {
                            if isSending {
                                ProgressView()
                                    .tint(AppColors.primary)
                            } else {
                                Image(systemName: "arrow.up.circle.fill")
                                    .font(.system(size: 32))
                                    .foregroundStyle(messageText.isEmpty ? AppColors.textMuted : AppColors.primary)
                            }
                        }
                        .frame(width: 32, height: 32)
                    }
                    .disabled(isSending || messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                .padding(AppSpacing.lg)
                .background(AppColors.bgLight)
            }
        }
        .navigationTitle(match.user.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showModerationSheet = true
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .foregroundStyle(AppColors.textSecondary)
                }
            }
        }
        .onAppear {
            startChatSession()
        }
        .onDisappear {
            stopChatSession()
        }
        .onChange(of: scenePhase) { _, newPhase in
            switch newPhase {
            case .active:
                Task {
                    await refreshMessages()
                }
                if !api.isUsingSupabaseBackend {
                    api.connectWS()
                }
            case .background:
                break
            case .inactive:
                break
            @unknown default:
                break
            }
        }
        .sheet(isPresented: $showModerationSheet) {
            ModerationActionSheet(user: match.user) {
                dismiss()
            }
        }
    }
    
    private func loadMessages() {
        Task {
            await refreshMessages(showLoadingState: true)
        }
    }

    @MainActor
    private func refreshMessages(showLoadingState: Bool = false) async {
        guard !isRefreshingMessages else { return }
        isRefreshingMessages = true

        if showLoadingState {
            isLoading = true
        }

        defer {
            isRefreshingMessages = false
            if showLoadingState {
                isLoading = false
            }
        }

        do {
            let fetchedMessages = try await api.getMessages(matchUserId: match.user.id)
            messages = fetchedMessages
            errorMessage = nil
        } catch {
            if messages.isEmpty || showLoadingState {
                messages = []
            }
            errorMessage = error.localizedDescription
        }
    }

    private func startMessagePolling() {
        guard messagePollingTask == nil else { return }

        messagePollingTask = Task {
            while !Task.isCancelled {
                await refreshMessages()
                try? await Task.sleep(for: .seconds(3))
            }
        }
    }

    private func startChatSession() {
        loadMessages()
        if api.isUsingSupabaseBackend {
            startMessagePolling()
        } else {
            setupMessageListener()
            api.connectWS()
        }
    }

    private func stopChatSession() {
        if let messageListenerID {
            api.removeMessageListener(messageListenerID)
            self.messageListenerID = nil
        }
        messagePollingTask?.cancel()
        messagePollingTask = nil
    }
    
    private func setupMessageListener() {
        guard messageListenerID == nil else { return }

        messageListenerID = api.addMessageListener { wsMessage in
            if wsMessage.type == "message", let senderId = wsMessage.senderId, let text = wsMessage.text {
                guard senderId == match.user.id else { return }

                // Add new message to list
                let newMessage = ChatMessage(
                    id: Int.random(in: 100000...999999), // Temporary ID until server confirms
                    senderId: senderId,
                    receiverId: api.currentUser?.id ?? 0,
                    text: text,
                    createdAt: ISO8601DateFormatter().string(from: Date())
                )
                messages.append(newMessage)
            }
        }
    }
    
    private func sendMessage() {
        let trimmedText = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedText.isEmpty else { return }

        errorMessage = nil
        isSending = true

        Task {
            do {
                try await api.sendWSMessage(receiverId: match.user.id, text: trimmedText)

                await MainActor.run {
                    messageText = ""
                    isSending = false
                }

                if api.isUsingSupabaseBackend {
                    await refreshMessages()
                } else {
                    let sentMessage = ChatMessage(
                        id: Int.random(in: 100000...999999),
                        senderId: api.currentUser?.id ?? 0,
                        receiverId: match.user.id,
                        text: trimmedText,
                        createdAt: ISO8601DateFormatter().string(from: Date())
                    )

                    await MainActor.run {
                        messages.append(sentMessage)
                    }
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isSending = false
                }
            }
        }
    }
}

struct MessageBubbleView: View {
    let message: ChatMessage
    let isFromCurrentUser: Bool
    
    var body: some View {
        HStack {
            if isFromCurrentUser {
                Spacer()
            }
            
            VStack(alignment: isFromCurrentUser ? .trailing : .leading, spacing: 4) {
                Text(message.text)
                    .padding(AppSpacing.md)
                    .background(isFromCurrentUser ? AppColors.primary : AppColors.bgCard)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                
                Text(formatDate(message.createdAt))
                    .font(.caption2)
                    .foregroundStyle(AppColors.textMuted)
            }
            .frame(maxWidth: 250, alignment: isFromCurrentUser ? .trailing : .leading)
            
            if !isFromCurrentUser {
                Spacer()
            }
        }
    }
    
    private func formatDate(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: dateString) {
            let displayFormatter = DateFormatter()
            displayFormatter.timeStyle = .short
            return displayFormatter.string(from: date)
        }
        return ""
    }
}

#Preview {
    NavigationStack {
        NewChatScreen(match: UserMatch(
            id: 1,
            user: User(id: 1, name: "Alex", email: nil, age: 26, bio: "Test bio", photos: nil, prompts: nil),
            matchedAt: "",
            lastMessage: nil
        ))
    }
}
