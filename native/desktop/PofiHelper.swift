import AppKit
import WebKit
import UserNotifications

final class PofiDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKScriptMessageHandler, UNUserNotificationCenterDelegate {
    private var panel: NSPanel!
    private var web: WKWebView!
    private var status: NSStatusItem!
    private var errorLabel: NSTextField!
    private var compact = true
    private var wantsSettings = false
    private var lastEvent = ""
    private var latest: [String: Any] = [:]
    private var fallbackSound = false
    private var lastSoundEvent = ""
    private var lastPreviewEvent = ""
    private var alertSound: NSSound?
    private var autoItem: NSMenuItem!
    private var alertItem: NSMenuItem!
    private var previewItem: NSMenuItem!

    func applicationDidFinishLaunching(_ notification: Notification) {
        let notifications = UNUserNotificationCenter.current()
        notifications.delegate = self
        notifications.requestAuthorization(options: [.alert, .sound]) { [weak self] _, _ in
            notifications.getNotificationSettings { settings in
                DispatchQueue.main.async { self?.fallbackSound = settings.soundSetting != .enabled || settings.authorizationStatus == .denied }
            }
        }
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.userContentController.add(self, name: "pofiState")
        configuration.userContentController.add(self, name: "pofiWindow")
        if let path = Bundle.main.url(forResource: "pofi-native", withExtension: "js"), let js = try? String(contentsOf: path, encoding: .utf8) {
            configuration.userContentController.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self
        web.autoresizingMask = [.width, .height]
        panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 280, height: 330), styleMask: [.titled, .closable, .resizable, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.title = "Pofi · Rota"
        panel.minSize = NSSize(width: 240, height: 300)
        panel.isReleasedWhenClosed = false
        panel.hidesOnDeactivate = false
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.delegate = self
        panel.setFrameAutosaveName("RotaPofiCorner")
        web.frame = panel.contentView!.bounds
        panel.contentView!.addSubview(web)
        errorLabel = NSTextField(wrappingLabelWithString: "Pofi yükleniyor…")
        errorLabel.frame = NSRect(x: 18, y: 90, width: 244, height: 120)
        errorLabel.autoresizingMask = [.width, .minYMargin, .maxYMargin]
        panel.contentView!.addSubview(errorLabel)
        if !panel.setFrameUsingName("RotaPofiCorner"), let screen = NSScreen.main {
            panel.setFrameOrigin(NSPoint(x: screen.visibleFrame.maxX - 300, y: screen.visibleFrame.minY + 24))
        }
        status = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        status.button?.title = "Pofi"
        let menu = NSMenu()
        for (title, action) in [("Köşede göster", #selector(showCorner)), ("Pofi ayarları", #selector(showSettings)), ("Yeniden bağlan", #selector(reload)), ("Pofi’den çık", #selector(quit))] {
            let item = menu.addItem(withTitle: title, action: action, keyEquivalent: ""); item.target = self
        }
        menu.addItem(withTitle: "Pofi’yi gizle", action: #selector(hideCorner), keyEquivalent: "").target = self
        autoItem = menu.addItem(withTitle: "Çalışma ↔ yürüyüş otomatik", action: #selector(toggleAutomatic), keyEquivalent: ""); autoItem.target = self
        alertItem = menu.addItem(withTitle: "Uyarıda Pofi’yi göster", action: #selector(toggleAlert), keyEquivalent: ""); alertItem.target = self
        previewItem = menu.addItem(withTitle: "Son 30 saniyede göster", action: #selector(togglePreview), keyEquivalent: ""); previewItem.target = self
        refreshMenu()
        if let tone = Bundle.main.url(forResource: "pofi-alert", withExtension: "wav") { alertSound = NSSound(contentsOf: tone, byReference: false) }
        menu.addItem(withTitle: "Çalışmayı başlat", action: #selector(startTimer), keyEquivalent: "").target = self
        menu.addItem(withTitle: "Sayacı durdur", action: #selector(stopTimer), keyEquivalent: "").target = self
        status.menu = menu
        DistributedNotificationCenter.default().addObserver(self, selector: #selector(command(_:)), name: Notification.Name("local.rota.pofi.command"), object: nil)
        Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in self?.updateClock() }
        wantsSettings = CommandLine.arguments.contains("--settings")
        reload()
        if wantsSettings { showSettings() } else { panel.orderOut(nil) }
    }

    @objc private func command(_ note: Notification) {
        switch note.object as? String {
        case "settings": showSettings()
        case "show": showCorner()
        case "hide": hideCorner()
        case "start": startTimer()
        case "stop": stopTimer()
        default: break
        }
    }
    @objc private func reload() {
        guard let page = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "pofi-web") else { return }
        web.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
    }
    @objc private func startTimer() {
        guard latest["mod"] as? String == "bos" else { return }
        latest = PofiReducer.transition(latest, stop: false); apply(latest); panel.orderOut(nil)
    }
    @objc private func stopTimer() {
        latest = PofiReducer.transition(latest, stop: true); apply(latest)
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["pofi-phase"])
        panel.orderOut(nil)
    }
    @objc private func hideCorner() { panel.orderOut(nil) }
    private func refreshMenu() {
        autoItem.state = latest["rotaAuto"] as? Bool == true ? .on : .off
        alertItem.state = (UserDefaults.standard.object(forKey: "pofi-show-on-alert") as? Bool ?? true) ? .on : .off
        previewItem.state = UserDefaults.standard.bool(forKey: "pofi-show-before") ? .on : .off
        let values: [String:Bool] = ["automatic":autoItem.state == .on,"showAlert":alertItem.state == .on,"showBefore":previewItem.state == .on]
        if let data = try? JSONSerialization.data(withJSONObject: values), let json = String(data:data,encoding:.utf8) { web.evaluateJavaScript("window.rotaPofiSetOptions?.(\(json));",completionHandler:nil) }
    }
    @objc private func toggleAlert() {
        UserDefaults.standard.set(!(UserDefaults.standard.object(forKey: "pofi-show-on-alert") as? Bool ?? true), forKey: "pofi-show-on-alert"); refreshMenu()
    }
    @objc private func togglePreview() {
        UserDefaults.standard.set(!UserDefaults.standard.bool(forKey: "pofi-show-before"), forKey: "pofi-show-before"); refreshMenu()
    }
    @objc private func toggleAutomatic() {
        latest["rotaAuto"] = !(latest["rotaAuto"] as? Bool ?? false)
        latest["surum"] = Date().timeIntervalSince1970 * 1000
        apply(latest); refreshMenu()
    }
    private func apply(_ state: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: state), let json = String(data: data, encoding: .utf8) else { return }
        UserDefaults.standard.set(data, forKey: "pofi-native-state")
        web.evaluateJavaScript("window.rotaPofiBoot?.(\(json));", completionHandler: nil)
    }
    @objc private func showCorner() {
        compact = true; wantsSettings = false
        web.evaluateJavaScript("document.getElementById('panel')?.classList.remove('acik');", completionHandler: nil)
        resize(width: 280, height: 330)
        panel.orderFrontRegardless()
    }
    @objc private func showSettings() {
        compact = false; wantsSettings = true
        resize(width: 420, height: 690)
        panel.orderFrontRegardless()
        panel.makeKey()
        NSApplication.shared.activate(ignoringOtherApps: true)
        web.evaluateJavaScript("if(!document.getElementById('panel')?.classList.contains('acik'))window.rotaPofiOpenSettings?.();", completionHandler: nil)
    }
    private func resize(width: CGFloat, height: CGFloat) {
        var frame = panel.frame
        let screen = panel.screen ?? NSScreen.main
        frame.size = NSSize(width: width, height: height)
        if let visible = screen?.visibleFrame {
            frame.origin.x = min(max(visible.minX, frame.minX), visible.maxX - width)
            frame.origin.y = min(max(visible.minY, frame.minY), visible.maxY - height)
        }
        panel.setFrame(frame, display: true, animate: true)
    }
    @objc private func quit() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        NSApplication.shared.terminate(nil)
    }
    func windowShouldClose(_ sender: NSWindow) -> Bool { panel.orderOut(nil); return false }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        errorLabel.isHidden = true
        var saved: [String: Any] = [:]
        if let data = UserDefaults.standard.data(forKey: "pofi-native-state") { saved = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:] }
        if !UserDefaults.standard.bool(forKey: "pofi-independent-v1") {
            saved["mod"] = "bos"; saved["rotaAuto"] = false; saved["deneme"] = false
            UserDefaults.standard.set(true, forKey: "pofi-independent-v1")
        }
        latest = PofiAutomatic.settled(saved); apply(latest)
        if wantsSettings { showSettings() }
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code == NSURLErrorCancelled { return }
        errorLabel.stringValue = "Pofi’ye bağlanılamadı. İnternet bağlantını kontrol et. Menü çubuğundaki Pofi’den Yeniden bağlan’ı seç."
        errorLabel.isHidden = false
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if navigationAction.targetFrame?.isMainFrame == true && !(url.isFileURL && url.path.hasSuffix("/pofi-web/index.html")) {
            if url.scheme == "https" { NSWorkspace.shared.open(url) }
            decisionHandler(.cancel); return
        }
        decisionHandler(.allow)
    }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.isFileURL == true else { return }
        if message.name == "pofiWindow", let option = message.body as? [String:Any], let key = option["option"] as? String, let enabled = option["enabled"] as? Bool {
            if key == "automatic" { latest["rotaAuto"] = enabled; latest["surum"] = Date().timeIntervalSince1970 * 1000; apply(latest) }
            if key == "showAlert" { UserDefaults.standard.set(enabled,forKey:"pofi-show-on-alert") }
            if key == "showBefore" { UserDefaults.standard.set(enabled,forKey:"pofi-show-before") }
            refreshMenu(); return
        }
        if message.name == "pofiWindow", let action = message.body as? String {
            if action == "settings" { showSettings() } else if action == "corner" { showCorner() }
            return
        }
        guard let state = message.body as? [String: Any] else { return }
        let wasReady = latest["mod"] as? String == "bos"
        latest = state
        if wasReady && state["mod"] as? String == "oturuyor" { panel.orderOut(nil) }
        if let data = try? JSONSerialization.data(withJSONObject: state) { UserDefaults.standard.set(data, forKey: "pofi-native-state") }
        refreshMenu()
        updateClock()
        let mode = state["mod"] as? String ?? "bos"
        let settings = state["ayar"] as? [String: Any] ?? [:]
        let start = (state[mode == "mola" ? "molaBasla" : "basla"] as? Double ?? 0) / 1000
        let duration = mode == "mola" ? (state["molaSure"] as? Double ?? 5) : (settings["calis"] as? Double ?? 25) + (state["ek"] as? Double ?? 0)
        let speed = (state["deneme"] as? Bool == true) ? 60.0 : 1.0
        let deadline = start + duration * 60 / speed
        let event = "\(mode):\(deadline)"
        guard event != lastEvent else { return }; lastEvent = event
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ["pofi-phase"])
        guard ["oturuyor", "mola"].contains(mode), deadline > Date().timeIntervalSince1970 else { return }
        let content = UNMutableNotificationContent()
        content.title = mode == "mola" ? "Pofi · Yürüyüş tamamlandı" : "Pofi · Ayağa kalkma zamanı"
        content.body = mode == "mola" ? "Hazır olduğunda yeni çalışma oturumunu başlat." : "\(Int(settings["mola"] as? Double ?? 5)) dakika yürü. Pofi’de Kalk’a basarak yürüyüşü başlat."
        content.sound = nil
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, deadline - Date().timeIntervalSince1970), repeats: false)
        center.add(UNNotificationRequest(identifier: "pofi-phase", content: content, trigger: trigger))
    }
    private func updateClock() {
        let mode = latest["mod"] as? String ?? "bos"
        guard ["oturuyor", "mola"].contains(mode) else { status?.button?.title = "Pofi"; return }
        let a = latest["ayar"] as? [String: Any] ?? [:]
        let start = (latest[mode == "mola" ? "molaBasla" : "basla"] as? Double ?? 0) / 1000
        let minutes = mode == "mola" ? (latest["molaSure"] as? Double ?? 5) : (a["calis"] as? Double ?? 25) + (latest["ek"] as? Double ?? 0)
        let speed = latest["deneme"] as? Bool == true ? 60.0 : 1.0
        let remaining = max(0, Int(ceil(start + minutes * 60 / speed - Date().timeIntervalSince1970)))
        let deadline = start + minutes * 60 / speed
        let event = "\(mode):\(deadline)"
        if remaining == 0 && lastSoundEvent != event {
            lastSoundEvent = event
            if (latest["toplanti"] as? Double ?? 0) / 1000 < Date().timeIntervalSince1970 { alertSound?.play() }
            if UserDefaults.standard.object(forKey: "pofi-show-on-alert") as? Bool ?? true { showCorner() }
        }
        if remaining > 0 && remaining <= 30 && UserDefaults.standard.bool(forKey: "pofi-show-before") && lastPreviewEvent != event {
            lastPreviewEvent = event; showCorner()
        }
        let advanced = PofiAutomatic.settled(latest)
        if PofiReducer.number(advanced, "surum") != PofiReducer.number(latest, "surum") { latest = advanced; apply(advanced) }
        status?.button?.title = remaining == 0 ? (mode == "mola" ? "Pofi · Hazır" : "Pofi · Kalk") : String(format: "Pofi %@ %02d:%02d", mode == "mola" ? "↗" : "◷", remaining / 60, remaining % 60)
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) { completionHandler([.banner, .sound]) }
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) { showCorner(); completionHandler() }
}

@main
struct PofiHelper {
    static func main() {
        let app = NSApplication.shared
        let delegate = PofiDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.accessory)
        withExtendedLifetime(delegate) { app.run() }
    }
}
