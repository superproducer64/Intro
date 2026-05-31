//
//  HyperbeamExperienceScreen.swift
//  Intro
//

import SwiftUI
import WebKit

// MARK: - WebView Wrapper

struct HyperbeamWebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = UIColor(AppColors.bg)
        webView.scrollView.backgroundColor = UIColor(AppColors.bg)
        webView.navigationDelegate = context.coordinator
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        if webView.url != url {
            webView.load(URLRequest(url: url))
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    class Coordinator: NSObject, WKNavigationDelegate {
        private let allowedHostSuffixes = [
            "hyperbeam.com"
        ]

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            #if DEBUG
            print("WebView navigation failed: \(error.localizedDescription)")
            #endif
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            #if DEBUG
            print("WebView provisional navigation failed: \(error.localizedDescription)")
            #endif
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url, isAllowed(url: url) else {
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
        }

        private func isAllowed(url: URL) -> Bool {
            guard url.scheme == "https", let host = url.host?.lowercased() else {
                return false
            }

            return allowedHostSuffixes.contains { host == $0 || host.hasSuffix(".\($0)") }
        }
    }
}

// MARK: - Fullscreen Experience View

struct HyperbeamExperienceScreen: View {
    let experienceTitle: String
    let embedUrl: String
    let onClose: () -> Void

    var body: some View {
        ZStack {
            AppColors.bg.ignoresSafeArea()

            VStack(spacing: 0) {
                // Title bar
                HStack {
                    Button(action: onClose) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title2)
                            .foregroundStyle(AppColors.textMuted)
                    }

                    Spacer()

                    Text(experienceTitle)
                        .font(.headline)
                        .foregroundStyle(AppColors.text)

                    Spacer()

                    // Invisible balance element for centering
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .hidden()
                }
                .padding(.horizontal, AppSpacing.md)
                .padding(.vertical, AppSpacing.sm)
                .background(AppColors.bgLight)

                // WebView
                if let url = validatedEmbedURL {
                    HyperbeamWebView(url: url)
                        .ignoresSafeArea(edges: .bottom)
                } else {
                    VStack(spacing: AppSpacing.md) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 48))
                            .foregroundStyle(AppColors.warning)
                        Text("Unable to load experience")
                            .foregroundStyle(AppColors.textSecondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
        }
    }

    private var validatedEmbedURL: URL? {
        guard let url = URL(string: embedUrl), url.scheme == "https" else {
            return nil
        }

        guard let host = url.host?.lowercased(),
              host == "hyperbeam.com" || host.hasSuffix(".hyperbeam.com") else {
            return nil
        }

        return url
    }
}

#Preview {
    HyperbeamExperienceScreen(
        experienceTitle: "Movie Night",
        embedUrl: "https://example.com",
        onClose: {}
    )
}
