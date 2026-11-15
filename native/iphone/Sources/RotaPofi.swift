import SwiftUI
import WebKit
import ActivityKit
import UserNotifications
import AudioToolbox

@MainActor
final class RotaPofi: NSObject, ObservableObject, WKScriptMessageHandler, WKNavigationDelegate, UNUserNotificationCenterDelegate {
    @Published var showing = false
    @Published var error: String?
    @Published var notificationNote = ""
    @Published var liveEnabled = UserDefaults.standard.bool(forKey: "rota-pofi-show-card")
    @Published var phoneSound = PofiReminderPreferences().sound
    @Published var phoneHaptics = PofiReminderPreferences().haptics
    @Published var liveStatus = ""
    @Published var automatic = false
    private var automaticTimer: Timer?
    private var settling = false
    let web: WKWebView
    private var wantsSettings = false
    private var lastEvent = ""
    private var liveTask: Task<Void, Never>?
    private var sequence = 0
    private var controlObserver: NSObjectProtocol?

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.userContentController.addUserScript(WKUserScript(source: "window.ROTA_POFI_PHONE=true;", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        if let url = Bundle.main.url(forResource: "pofi-native", withExtension: "js"), let script = try? String(contentsOf: url, encoding: .utf8) {
            configuration.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        web = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        configuration.userContentController.add(self, name: "pofiState")
        web.navigationDelegate = self
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.96, green: 0.94, blue: 0.88, alpha: 1)
        UNUserNotificationCenter.current().delegate = self
        PofiReminders.registerActions()
        if !UserDefaults.standard.bool(forKey: "rota-pofi-independent-v1") {
            if let saved = UserDefaults.standard.data(forKey: "rota-pofi-native-state"), var old = try? JSONSerialization.jsonObject(with: saved) as? [String: Any] {
                old["seans"] = ["ilerleme":0,"oturum":0,"odak":0,"yuruyus":0]
                old["mod"] = "bos"; old["rotaAuto"] = false; old["deneme"] = false; old["surum"] = Date().timeIntervalSince1970 * 1000
                if var a = old["ayar"] as? [String: Any] { a["otoDevam"] = false; old["ayar"] = a }
                UserDefaults.standard.set(try? JSONSerialization.data(withJSONObject: old), forKey: "rota-pofi-native-state")
            }
            UserDefaults.standard.set(true, forKey: "rota-pofi-independent-v1")
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: PofiReminders.identifiers)
        }
        automaticTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.settleAutomatic() }
        }
        controlObserver = NotificationCenter.default.addObserver(forName: Notification.Name("rota-pofi-native-change"), object: nil, queue: .main) { [weak self] note in
            guard let state = note.object as? [String: Any] else { return }
            Task { @MainActor in
                self?.applyToPage(state)
                self?.receive(state)
            }
        }
        // Restore only this phone’s local session, including when its Pofi sheet is closed.
        if UserDefaults.standard.bool(forKey: "rota-pofi-used") { reload() }
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let url = message.frameInfo.request.url else { return }
        if message.name == "rotaPofi", url.host == URL(string: RotaSession.origin)?.host,
           let body = message.body as? [String: String], body["action"] == "settings" {
            open(settings: true)
        } else if message.name == "pofiState", url.isFileURL, url.path.hasSuffix("/pofi-web/index.html"),
                  let state = message.body as? [String: Any] {
            receive(state)
        }
    }

    func open(settings: Bool = false) {
        UserDefaults.standard.set(true, forKey: "rota-pofi-used")
        wantsSettings = settings
        showing = true
        if web.url == nil { reload() }
        else if settings { openSettings() }
        Task {
            let center = UNUserNotificationCenter.current()
            _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
            let settings = await center.notificationSettings()
            notificationNote = settings.authorizationStatus == .denied ? "Hatırlatmalar için iPhone Ayarlar → Bildirimler → Rota’dan izin ver." : ""
            if !ActivityAuthorizationInfo().areActivitiesEnabled {
                notificationNote += " Kilit ekranı sayacı için iPhone Ayarlar → Rota → Canlı Etkinlikler’i aç."
            }
            refreshNative()
        }
    }

    func reload() {
        error = nil
        guard let page = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "pofi-web") else { error = "Pofi dosyası bulunamadı."; return }
        web.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
    }

    func openSettings() {
        web.evaluateJavaScript("if(!document.getElementById('panel')?.classList.contains('acik'))window.rotaPofiOpenSettings?.();", completionHandler: nil)
    }
    func resume() {
        guard web.url != nil else { return }
        settleAutomatic()
        if let state = cachedState() { applyToPage(PofiAutomatic.settled(state)) }
        refreshNative()
        web.evaluateJavaScript("window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange'));", completionHandler: nil)
    }
    private func refreshNative() {
        guard let data = UserDefaults.standard.data(forKey: "rota-pofi-native-state"), let state = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        lastEvent = ""
        receive(state)
    }
    private func cachedState() -> [String: Any]? {
        guard let data = UserDefaults.standard.data(forKey: "rota-pofi-native-state") else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }
    private func applyToPage(_ state: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: state), let json = String(data: data, encoding: .utf8) else { return }
        web.evaluateJavaScript("window.rotaPofiBoot?.(\(json));", completionHandler: nil)
    }
    private func settleAutomatic() {
        guard !settling, let state = cachedState(), state["rotaAuto"] as? Bool == true, let plan = PofiReminderPlan(state), plan.deadline <= Date() else { return }
        settling = true
        Task { _ = try? await PofiControls.shared.change(stop: false, settleOnly: true); settling = false }
    }
    func setAutomatic(_ enabled: Bool) {
        Task {
            do { try await PofiControls.shared.change(stop: false, automatic: enabled) }
            catch { notificationNote = error.localizedDescription }
        }
    }
    func showLockScreen() { setLiveEnabled(true) }
    func setPhoneSound(_ enabled: Bool) {
        phoneSound = enabled
        UserDefaults.standard.set(enabled, forKey: "rota-pofi-phone-sound")
        refreshNative()
    }
    func setPhoneHaptics(_ enabled: Bool) {
        phoneHaptics = enabled
        UserDefaults.standard.set(enabled, forKey: "rota-pofi-phone-haptics")
        refreshNative()
    }
    func testReminder() {
        Task { await PofiReminders.test() }
        notificationNote = "20 saniye sonra deneme hatırlatması gelecek. Telefonunu kilitleyebilirsin."
    }
    func setLiveEnabled(_ enabled: Bool) {
        liveEnabled = enabled
        UserDefaults.standard.set(enabled, forKey: "rota-pofi-show-card")
        if enabled { refreshNative() }
        else {
            Task { for activity in Activity<PofiAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) } }
            liveStatus = "Kilit ekranı sayacı kapalı."
        }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        error = nil
        var state = cachedState() ?? ["mod":"bos"]
        state = PofiAutomatic.settled(state)
        applyToPage(state)
        #if DEBUG
        print("Pofi: independent page loaded")
        #endif
        if wantsSettings { wantsSettings = false; openSettings() }
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError failure: Error) {
        if (failure as NSError).code != NSURLErrorCancelled { error = "Pofi’ye bağlanılamadı. İnternet bağlantını kontrol edip yeniden dene." }
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if navigationAction.targetFrame?.isMainFrame == true, !(url.isFileURL && url.path.hasSuffix("/pofi-web/index.html")) {
            if url.scheme == "https" { UIApplication.shared.open(url) }
            decisionHandler(.cancel); return
        }
        decisionHandler(.allow)
    }

    private func receive(_ state: [String: Any]) {
        if let saved = UserDefaults.standard.data(forKey: "rota-pofi-native-state"), let cached = try? JSONSerialization.jsonObject(with: saved) as? [String: Any],
           PofiReducer.number(cached, "surum") > PofiReducer.number(state, "surum") { return }
        if let data = try? JSONSerialization.data(withJSONObject: state) { UserDefaults.standard.set(data, forKey: "rota-pofi-native-state") }
        automatic = state["rotaAuto"] as? Bool ?? false
        let mode = state["mod"] as? String ?? "bos"
        let settings = state["ayar"] as? [String: Any] ?? [:]
        let walking = mode == "mola"
        let start = Date(timeIntervalSince1970: (state[walking ? "molaBasla" : "basla"] as? Double ?? 0) / 1000)
        let minutes = walking ? (state["molaSure"] as? Double ?? 5) : (settings["calis"] as? Double ?? 25) + (state["ek"] as? Double ?? 0)
        let speed = state["deneme"] as? Bool == true ? 60.0 : 1.0
        let deadline = start.addingTimeInterval(minutes * 60 / speed)
        let event = "\(mode):\(deadline.timeIntervalSince1970):\(automatic)"
        guard lastEvent != event else { return }; lastEvent = event
        #if DEBUG
        print("Pofi: mode=\(mode), phaseRemaining=\(Int(deadline.timeIntervalSinceNow))s")
        #endif
        sequence += 1
        let version = sequence
        let active = ["oturuyor", "mola"].contains(mode)
        liveTask?.cancel()
        liveTask = Task {
            await PofiReminders.schedule(state)
            guard version == sequence, !Task.isCancelled else { return }
            let current = Activity<PofiAttributes>.activities
            if !liveEnabled {
                for activity in current { await activity.end(nil, dismissalPolicy: .immediate) }
                liveStatus = "Kart gizli; sayaç ve hatırlatmalar devam eder."
                return
            }
            let autoEnd = automatic ? PofiAutomatic.future(state).last?.deadline : nil
            let value = PofiAttributes.ContentState(walking: walking, start: active ? min(start, deadline) : Date(), deadline: active ? deadline : Date(), minutes: active ? Int(minutes) : 0, running: active, automaticEnd: autoEnd)
            let content = ActivityContent(state: value, staleDate: autoEnd ?? (active ? deadline : nil))
            if let activity = current.first {
                await activity.update(content)
                liveStatus = "Kilit ekranında gösteriliyor."
                for duplicate in current.dropFirst() { await duplicate.end(nil, dismissalPolicy: .immediate) }
            } else if ActivityAuthorizationInfo().areActivitiesEnabled && UIApplication.shared.applicationState == .active && version == sequence && !Task.isCancelled {
                do {
                    _ = try Activity.request(attributes: PofiAttributes(), content: content, pushType: nil)
                    liveStatus = "Kilit ekranında gösteriliyor."
                    #if DEBUG
                    print("Pofi: lock screen activity started")
                    #endif
                }
                catch { liveStatus = "Kart açılamadı. Pofi kartını göster anahtarını yeniden aç." }
            } else {
                liveStatus = ActivityAuthorizationInfo().areActivitiesEnabled ? "Pofi kartını göster anahtarını kapatıp yeniden aç." : "iPhone Ayarlar → Rota → Canlı Etkinlikler’den izin ver."
            }
            UserDefaults.standard.set(liveStatus, forKey: "rota-pofi-live-status")
        }
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        let preferences = PofiReminderPreferences()
        if preferences.haptics { AudioServicesPlaySystemSound(kSystemSoundID_Vibrate) }
        completionHandler(preferences.sound ? [.banner, .sound] : [.banner])
    }
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        Task { @MainActor in
            if ["POFI_NEXT", "POFI_STOP"].contains(response.actionIdentifier) {
                do { try await PofiControls.shared.change(stop: response.actionIdentifier == "POFI_STOP") }
                catch { notificationNote = error.localizedDescription }
            } else { self.open() }
            completionHandler()
        }
    }
}

struct RotaPofiHost: View {
    @ObservedObject var pofi: RotaPofi
    var body: some View {
        Color.clear.frame(width: 0, height: 0)
            .sheet(isPresented: $pofi.showing) {
                NavigationStack {
                    VStack(spacing: 0) {
                        if let error = pofi.error {
                            Text(error).padding()
                            Button("Yeniden dene") { pofi.reload() }.padding()
                            Spacer()
                        } else { PofiWeb(web: pofi.web) }
                        HStack {
                            Toggle("Pofi kartını göster", isOn: Binding(get: { pofi.liveEnabled }, set: { pofi.setLiveEnabled($0) }))
                        }.font(.footnote).padding(.horizontal, 12).padding(.top, 8)
                        HStack {
                            Toggle("Telefon sesi", isOn: Binding(get: { pofi.phoneSound }, set: { pofi.setPhoneSound($0) }))
                            Toggle("Titreşim", isOn: Binding(get: { pofi.phoneHaptics }, set: { pofi.setPhoneHaptics($0) }))
                        }.font(.footnote).padding(.horizontal, 12)
                        Toggle("Çalışma ↔ yürüyüş otomatik", isOn: Binding(get: { pofi.automatic }, set: { pofi.setAutomatic($0) }))
                            .font(.footnote).padding(.horizontal, 12)
                        Button("Ses / titreşim denemesi") { pofi.testReminder() }.font(.footnote)
                        if !pofi.liveStatus.isEmpty { Text(pofi.liveStatus).font(.caption).padding(.horizontal, 12) }
                        if !pofi.notificationNote.isEmpty { Text(pofi.notificationNote).font(.footnote).padding(10) }
                        Text("Bu sayaç yalnız bu telefonda çalışır. Otomatik geçiş açıksa kilit ekranında kalan toplam seans süresi gösterilir.")
                            .font(.caption).foregroundStyle(.secondary).padding(10)
                    }
                    .background(Color(red: 0.96, green: 0.94, blue: 0.88))
                    .foregroundStyle(.black)
                    .navigationTitle("Pofi · Rota").navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .navigationBarLeading) { Button("Bitti") { pofi.showing = false } }
                        ToolbarItem(placement: .navigationBarTrailing) { Button { pofi.openSettings() } label: { Image(systemName: "gearshape") } }
                    }
                }.preferredColorScheme(.light)
            }
    }
}

private struct PofiWeb: UIViewRepresentable {
    let web: WKWebView
    func makeUIView(context: Context) -> WKWebView { web }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
