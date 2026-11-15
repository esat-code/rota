import AppKit
import SwiftUI
import WebKit

private struct RotaLoadingView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private func route(in size: CGSize) -> Path {
        Path { path in
            func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
                CGPoint(x: x * size.width, y: y * size.height)
            }
            path.move(to: point(0.18, 0.80))
            path.addCurve(to: point(0.58, 0.60), control1: point(0.26, 0.55), control2: point(0.43, 0.72))
            path.addCurve(to: point(0.48, 0.33), control1: point(0.77, 0.48), control2: point(0.37, 0.47))
            path.addCurve(to: point(0.82, 0.20), control1: point(0.56, 0.23), control2: point(0.72, 0.25))
        }
    }

    var body: some View {
        ZStack {
            LinearGradient(colors: [Color.black, Color.black], startPoint: .topTrailing, endPoint: .bottomLeading)
                .ignoresSafeArea()
            VStack(spacing: 24) {
                TimelineView(.animation(paused: reduceMotion)) { timeline in
                    Canvas { context, size in
                        let line = route(in: size)
                        let progress = reduceMotion ? 1.0 : timeline.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 1.8) / 1.8
                        let style = StrokeStyle(lineWidth: 5, lineCap: .round)
                        context.stroke(line, with: .color(.white.opacity(0.15)), style: style)
                        context.stroke(line.trimmedPath(from: reduceMotion ? 0 : max(0, progress - 0.32), to: progress),
                                       with: .color(Color(red: 0.76, green: 0.78, blue: 0.82)), style: style)
                    }
                }
                .frame(width: 124, height: 124)
                .accessibilityHidden(true)
                Text("Her gün, kaldığın yerden.")
                    .font(.title3.weight(.medium))
                    .foregroundStyle(.white)
            }
        }
        .accessibilityLabel("Rota yükleniyor")
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKScriptMessageHandler, WKUIDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var launchScene: NSView?
    private var quitting = false
    private let cloudBridge = RotaCloudBridge()
    private let pofiBridge = RotaPofiBridge()
    private let exporter = RotaExportCoordinator()
    private let sportExporter = SportFileExport()
    private let allowedKeys = Set(["hafizlik-takip-v1", "rota-hafizlik-before-import-v1", "hafizlik-takip-theme", "hafizlik-takip-timers-v1", "rota-home-local-password-v1", "rota-home-audio-v1", "rota-event-manager-preview-v1", "rota-event-manager-preview-v1-theme", "rota-event-manager-preview-v1-special-preferences", "rota-yks-v1", "rota-sport-preview-v1", "rota-cloud-sync-v1", "rota-cloud-recovery-v1"])
    private var stateURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("HafizlikTakip/state.json")
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.userContentController.add(pofiBridge, name: "rotaPofi")
        if let path = Bundle.main.url(forResource: "rota-pofi-settings", withExtension: "js"), let script = try? String(contentsOf: path, encoding: .utf8) {
            config.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        config.userContentController.add(self, name: "hafizlik")
        config.userContentController.add(cloudBridge, name: "rotaCloud")
        config.userContentController.add(RotaTextRecognition { url in
            guard url.isFileURL, let root = Bundle.main.resourceURL else { return false }
            return url.standardizedFileURL.path.hasPrefix(root.standardizedFileURL.path + "/")
        }, name: "rotaTextOCR")
        // Recover the last atomic disk backup only when browser storage is absent.
        if let data = try? Data(contentsOf: stateURL),
           let saved = try? JSONSerialization.jsonObject(with: data) as? [String: String],
           let safeData = try? JSONSerialization.data(withJSONObject: saved.filter { allowedKeys.contains($0.key) }),
           let json = String(data: safeData, encoding: .utf8) {
            let injection = """
            (() => { if (location.protocol !== "file:") return; const backup = \(json); Object.entries(backup).forEach(([key,value]) => {
              try { if (localStorage.getItem(key) === null) localStorage.setItem(key, value); } catch (_) {}
            }); })();
            """
            config.userContentController.addUserScript(WKUserScript(source: injection, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        webView = WKWebView(frame: .zero, configuration: config)
        webView.uiDelegate = self
        webView.setValue(false, forKey: "drawsBackground")
        webView.underPageBackgroundColor = .black
        webView.autoresizingMask = [.width, .height]
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1380, height: 880),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Rota"
        window.backgroundColor = .black
        window.minSize = NSSize(width: 900, height: 620)
        window.collectionBehavior = [.fullScreenPrimary]
        window.center()
        window.setFrameAutosaveName("HafizlikTakipWindow")
        let content = NSView(frame: window.contentLayoutRect)
        webView.frame = content.bounds
        content.addSubview(webView)
        let loading = NSHostingView(rootView: RotaLoadingView())
        loading.frame = content.bounds
        loading.autoresizingMask = [.width, .height]
        content.addSubview(loading)
        launchScene = loading
        window.contentView = content
        window.delegate = self
        window.makeKeyAndOrderFront(nil)
        // Keep the recovery page reachable even if the renderer never reports readiness.
        DispatchQueue.main.asyncAfter(deadline: .now() + 26) { [weak self] in
            self?.revealEntry()
        }
        if let page = Bundle.main.url(forResource: "start", withExtension: "html") {
            webView.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
        }
        let menu = NSMenu()
        let application = NSMenuItem(title: "Rota", action: nil, keyEquivalent: "")
        menu.addItem(application)
        let submenu = NSMenu()
        submenu.addItem(withTitle: "Rota'dan Çık", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        application.submenu = submenu
        let editItem = NSMenuItem()
        menu.addItem(editItem)
        let editMenu = NSMenu(title: "Düzenle")
        for (title, selector, key) in [("Geri Al", "undo:", "z"), ("Kes", "cut:", "x"), ("Kopyala", "copy:", "c"), ("Yapıştır", "paste:", "v"), ("Tümünü Seç", "selectAll:", "a")] {
            let item = editMenu.addItem(withTitle: title, action: selector == "undo:" ? #selector(designUndo(_:)) : Selector(selector), keyEquivalent: key)
            if selector == "undo:" { item.target = self }
        }
        let redoItem = editMenu.addItem(withTitle: "İleri Al", action: #selector(designRedo(_:)), keyEquivalent: "z")
        redoItem.keyEquivalentModifierMask = [.command, .shift]
        redoItem.target = self
        editItem.submenu = editMenu
        NSApplication.shared.mainMenu = menu
    }

    private func revealEntry() {
        guard let loading = launchScene else { return }
        launchScene = nil
        NSAnimationContext.runAnimationGroup { context in
            context.duration = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion ? 0 : 0.18
            loading.animator().alphaValue = 0
        } completionHandler: {
            loading.removeFromSuperview()
        }
        window.makeFirstResponder(webView)
    }

    @objc private func designUndo(_ sender: Any?) { designHistory(redo: false) }
    @objc private func designRedo(_ sender: Any?) { designHistory(redo: true) }
    private func designHistory(redo: Bool) {
        let script = """
        (() => { const root=document.getElementById('hafizlik-tik-denemesi');
        const typing=document.activeElement?.closest('input,textarea,select,[contenteditable="true"],dialog');
        if (!root || root.inert || !window.hafizlikBoard?.editing || typing) return false;
        window.hafizlikDesigner?.\(redo ? "redo" : "undo")(); return true; })();
        """
        webView.evaluateJavaScript(script) { [weak self] result, _ in
            guard let self else { return }
            if (result as? Bool) != true {
                if redo { self.webView.undoManager?.redo() }
                else { self.webView.undoManager?.undo() }
            }
        }
    }

    @discardableResult private func save(_ state: [String: String]) -> Bool {
        do {
            let safe = state.filter { allowedKeys.contains($0.key) }
            // Never replace a real planner backup with an empty startup snapshot.
            guard safe["hafizlik-takip-v1"] != nil else { return true }
            try FileManager.default.createDirectory(at: stateURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            let data = try JSONSerialization.data(withJSONObject: safe)
            try data.write(to: stateURL, options: .atomic)
            return true
        } catch { return false }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let body = message.body as? [String: Any] else { return }
        if body["action"] as? String == "save", let state = body["state"] as? [String: String] {
            let ok = save(state)
            webView.evaluateJavaScript("window.hafizlikNativeSaveResult?.(\(ok ? "true" : "false"));", completionHandler: nil)
        } else if body["action"] as? String == "export" {
            exporter.receive(body, from: webView, in: window)
        } else if body["action"] as? String == "phone-install", let id=body["id"] as? String, UUID(uuidString:id) != nil, message.frameInfo.request.url?.isFileURL == true {
            if let data=try? JSONSerialization.data(withJSONObject:RotaPhoneInstall.result(id:id)), let json=String(data:data,encoding:.utf8) {
                webView.evaluateJavaScript("window.rotaSportNativeResult?.(\(json));",completionHandler:nil)
            }
        } else if body["action"] as? String == "sport-export" {
            sportExporter.receive(body, from:webView, in:window)
        } else if body["action"] as? String == "sport-play-video", let id = body["id"] as? String, UUID(uuidString: id) != nil {
            var result: [String: Any] = ["id": id]
            if let videoID = body["videoID"] as? String, let title = body["title"] as? String,
               SportVideoPlayer.present(videoID: videoID, title: title, parentWindow: window) {
                result["opened"] = true
            } else {
                result["error"] = "Video bağlantısı doğrulanamadı. Bağlantını kontrol et."
            }
            if let data = try? JSONSerialization.data(withJSONObject: result), let json = String(data: data, encoding: .utf8) {
                webView.evaluateJavaScript("window.rotaSportNativeResult?.(\(json));", completionHandler: nil)
            }
        } else if body["action"] as? String == "sport-asset",let id=body["id"] as? String,UUID(uuidString:id) != nil,let filename=body["filename"] as? String {
            DispatchQueue.global(qos:.userInitiated).async { [weak self] in
                guard let self else{return}
                var result:[String:Any]=["id":id]
                do{let asset=try SportAssetBridge.data(for:filename);result["base64"]=asset.data.base64EncodedString();result["mimeType"]=asset.mimeType}catch{result["error"]="Yerel hareket modeli okunamadı: \(error.localizedDescription)"}
                if let data=try? JSONSerialization.data(withJSONObject:result),let json=String(data:data,encoding:.utf8){DispatchQueue.main.async{self.webView.evaluateJavaScript("window.rotaSportNativeResult?.(\(json));",completionHandler:nil)}}
            }
        } else if body["action"] as? String == "quit" {
            NSApplication.shared.terminate(nil)
        } else if body["action"] as? String == "ready" || body["action"] as? String == "boot-blocked" {
            revealEntry()
        }
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        guard frame.isMainFrame || frame.securityOrigin.protocol == "file" else { completionHandler(nil); return }
        let panel = NSOpenPanel(); panel.canChooseDirectories = false; panel.canChooseFiles = true
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.allowedContentTypes = frame.isMainFrame ? [.json] : [.json,.movie,.video,.pdf,.image,.plainText]
        panel.title = frame.isMainFrame ? "Rota plan dosyasını aç" : "Dosya seç"
        panel.beginSheetModal(for: window) { response in completionHandler(response == .OK ? panel.urls : nil) }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, ["https", "http"].contains(url.scheme?.lowercased() ?? "") {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if quitting { return .terminateNow }
        let script = """
        window.hafizlikSaveAll?.(); await window.rotaCloudFlush?.(); return (() => { const state = {};
          ['hafizlik-takip-v1','rota-hafizlik-before-import-v1','hafizlik-takip-theme','hafizlik-takip-timers-v1','rota-home-local-password-v1','rota-home-audio-v1', 'rota-event-manager-preview-v1', 'rota-event-manager-preview-v1-theme', 'rota-event-manager-preview-v1-special-preferences', 'rota-yks-v1', 'rota-sport-preview-v1','rota-cloud-sync-v1','rota-cloud-recovery-v1'].forEach(key => {
            const value = localStorage.getItem(key); if (value !== null) state[key] = value;
          }); return state; })();
        """
        webView.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { [weak self] result in
            guard let self else { sender.reply(toApplicationShouldTerminate: false); return }
            if case .success(let value) = result, let state = value as? [String: String], self.save(state) {
                self.quitting = true
                sender.reply(toApplicationShouldTerminate: true)
            } else {
                self.webView.evaluateJavaScript("window.rotaQuitFailed?.();", completionHandler: nil)
                let alert = NSAlert()
                alert.messageText = "Değişiklikler kaydedilemedi"
                alert.informativeText = "Uygulama açık bırakıldı. Kaydetmek için yeniden deneyebilirsin."
                alert.runModal()
                sender.reply(toApplicationShouldTerminate: false)
            }
        }
        return .terminateLater
    }
    func windowShouldClose(_ sender: NSWindow) -> Bool { NSApplication.shared.terminate(nil); return false }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

@main
struct RotaApplication {
    static func main() {
        if CommandLine.arguments.contains("--provision-cloud") {
            let ok = RotaCloudBridge.provision(); print(ok ? "Cloud connection stored in Keychain." : "Keychain setup failed."); exit(ok ? 0 : 1)
        }
        let application = NSApplication.shared
        let delegate = AppDelegate()
        application.delegate = delegate
        application.setActivationPolicy(.regular)
        application.activate(ignoringOtherApps: true)
        withExtendedLifetime(delegate) {
            application.run()
        }
    }
}
