import Foundation
import WebKit
import ImageIO
import UniformTypeIdentifiers
#if os(macOS)
import AppKit
#else
import UIKit
#endif

@MainActor
final class RotaShoppingEntry: NSObject, WKScriptMessageHandler {
    private let accepts: (URL) -> Bool
    private let open: () -> Void

    static func install(in configuration: WKWebViewConfiguration, accepts: @escaping (URL) -> Bool, open: @escaping () -> Void) {
        guard let url = Bundle.main.url(forResource: "rota-shopping-settings", withExtension: "js"),
              let script = try? String(contentsOf: url, encoding: .utf8) else { return }
        let controller = configuration.userContentController
        controller.add(RotaShoppingEntry(accepts: accepts, open: open), name: "rotaShoppingOpen")
        controller.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
    }

    private init(accepts: @escaping (URL) -> Bool, open: @escaping () -> Void) {
        self.accepts = accepts
        self.open = open
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.body as? String == "open",
              let url = message.frameInfo.request.url, accepts(url) else { return }
        open()
    }
}

private final class ShoppingRedirects: NSObject, URLSessionTaskDelegate, Sendable {
    static func product(_ url: URL) -> Bool {
        guard url.scheme == "https", url.user == nil, url.password == nil, url.port == nil,
              let host = url.host?.lowercased() else { return false }
        let labels = host.split(separator: ".", omittingEmptySubsequences: false)
        return labels.count >= 2 && labels.allSatisfy { label in
            !label.isEmpty && label.first != "-" && label.last != "-" &&
            label.allSatisfy { $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-") }
        } && labels.last!.contains(where: { $0.isLetter }) &&
        !["localhost", "local", "internal", "lan", "home", "test", "invalid"].contains(String(labels.last!))
    }

    static func image(_ url: URL) -> Bool {
        product(url)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping @Sendable (URLRequest?) -> Void) {
        guard let original = task.originalRequest?.url, let target = request.url else {
            completionHandler(nil)
            return
        }
        let allowed = Self.product(original) && Self.product(target)
        completionHandler(allowed ? request : nil)
    }
}

@MainActor
final class RotaShopping: NSObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    private let page = Bundle.main.url(forResource: "rota-shopping", withExtension: "html")
    private let maximumStateBytes = 24 * 1024 * 1024
    private let urlSession: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpShouldSetCookies = false
        configuration.timeoutIntervalForRequest = 14
        configuration.timeoutIntervalForResource = 20
        return URLSession(configuration: configuration, delegate: ShoppingRedirects(), delegateQueue: nil)
    }()

    private var stateFile: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("RotaShopping", isDirectory: true)
            .appendingPathComponent("plan.json")
    }

    lazy var webView: WKWebView = {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        let controller = configuration.userContentController
        controller.add(self, name: "rotaShopping")
        if let data = try? Data(contentsOf: stateFile), data.count <= maximumStateBytes,
           let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let safe = try? JSONSerialization.data(withJSONObject: object),
           let json = String(data: safe, encoding: .utf8) {
            let script = "window.rotaShoppingInitial = \(json);"
            controller.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = self
        view.uiDelegate = self
        if let page { view.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent()) }
        return view
    }()

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.request.url?.standardizedFileURL == page?.standardizedFileURL,
              let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        switch action {
        case "save":
            do {
                guard let snapshot = body["snapshot"] as? [String: Any] else { throw CocoaError(.fileWriteUnknown) }
                let data = try JSONSerialization.data(withJSONObject: snapshot)
                guard data.count <= maximumStateBytes else { throw CocoaError(.fileWriteOutOfSpace) }
                try FileManager.default.createDirectory(at: stateFile.deletingLastPathComponent(), withIntermediateDirectories: true)
                try backUpLegacyPlan(before: snapshot)
                try data.write(to: stateFile, options: .atomic)
                webView.evaluateJavaScript("window.rotaShoppingSaved?.(true)")
            } catch {
                webView.evaluateJavaScript("window.rotaShoppingSaved?.(false)")
            }
        case "product", "photo":
            guard let raw = body["url"] as? String, raw.count <= 4000, let url = URL(string: raw),
                  let id = body["id"] as? String, UUID(uuidString: id) != nil else { return }
            Task { await fetch(action: action, url: url, id: id) }
        case "openProduct":
            guard let raw = body["url"] as? String, let url = URL(string: raw), ShoppingRedirects.product(url) else { return }
            #if os(macOS)
            NSWorkspace.shared.open(url)
            #else
            UIApplication.shared.open(url)
            #endif
        default:
            break
        }
    }

    private func backUpLegacyPlan(before snapshot: [String: Any]) throws {
        guard let newModel = snapshot["modelContent"] as? [String: Any],
              newModel["version"] as? Int == 2 else { return }
        let backup = stateFile.deletingLastPathComponent().appendingPathComponent("plan-before-purchases-v2.json")
        guard !FileManager.default.fileExists(atPath: backup.path),
              let current = try? Data(contentsOf: stateFile),
              let root = try? JSONSerialization.jsonObject(with: current) as? [String: Any],
              let model = root["modelContent"] as? [String: Any],
              model["version"] as? Int == 1 else { return }
        try current.write(to: backup, options: .atomic)
    }

    private func fetch(action: String, url: URL, id: String) async {
        let photo = action == "photo"
        var result: [String: Any] = ["id": id]
        do {
            guard photo ? ShoppingRedirects.image(url) : ShoppingRedirects.product(url) else {
                throw URLError(.unsupportedURL)
            }
            var request = URLRequest(url: url)
            request.setValue("tr-TR,tr;q=0.9", forHTTPHeaderField: "Accept-Language")
            request.setValue(photo ? "image/*" : "text/html", forHTTPHeaderField: "Accept")
            let (bytes, response) = try await urlSession.bytes(for: request)
            guard let response = response as? HTTPURLResponse, (200...299).contains(response.statusCode),
                  let finalURL = response.url,
                  photo ? ShoppingRedirects.image(finalURL) : ShoppingRedirects.product(finalURL) else {
                throw URLError(.badServerResponse)
            }
            let limit = photo ? 4_000_000 : 8_000_000
            guard response.expectedContentLength <= Int64(limit) else { throw URLError(.dataLengthExceedsMaximum) }
            var data = Data()
            for try await byte in bytes {
                guard data.count < limit else { throw URLError(.dataLengthExceedsMaximum) }
                data.append(byte)
            }
            if photo {
                guard let source = CGImageSourceCreateWithData(data as CFData, nil),
                      let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                        kCGImageSourceCreateThumbnailFromImageAlways: true,
                        kCGImageSourceCreateThumbnailWithTransform: true,
                        kCGImageSourceThumbnailMaxPixelSize: 256
                      ] as CFDictionary) else { throw URLError(.cannotDecodeContentData) }
                let output = NSMutableData()
                guard let target = CGImageDestinationCreateWithData(output, UTType.jpeg.identifier as CFString, 1, nil) else {
                    throw URLError(.cannotDecodeContentData)
                }
                CGImageDestinationAddImage(target, image, [kCGImageDestinationLossyCompressionQuality: 0.86] as CFDictionary)
                guard CGImageDestinationFinalize(target) else { throw URLError(.cannotDecodeContentData) }
                result["photo"] = "data:image/jpeg;base64," + (output as Data).base64EncodedString()
            } else {
                guard let html = String(data: data, encoding: .utf8) else { throw URLError(.cannotDecodeContentData) }
                result["html"] = html
                result["url"] = finalURL.absoluteString
            }
        } catch {
            result["error"] = photo ? "Ürün fotoğrafı alınamadı." : "Mağazanın ürün sayfası okunamadı."
        }
        _ = try? await webView.callAsyncJavaScript("window.rotaShoppingResult?.(result)", arguments: ["result": result],
                                                  in: nil, contentWorld: .page)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let local = navigationAction.request.url?.standardizedFileURL == page?.standardizedFileURL
        decisionHandler(local ? .allow : .cancel)
    }

    #if os(macOS)
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        guard frame.isMainFrame, frame.request.url?.standardizedFileURL == page?.standardizedFileURL,
              let window = webView.window else { completionHandler(nil); return }
        let panel = NSOpenPanel()
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = [.jpeg, .png, .webP]
        panel.beginSheetModal(for: window) { response in completionHandler(response == .OK ? panel.urls : nil) }
    }
    #endif
}
