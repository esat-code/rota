import AppKit
import WebKit

/// An isolated, OS-provided YouTube player. It has no planner/storage/native
/// bridge privileges, and identifies the installed app using its real bundle ID.
/// See developers.google.com/youtube/terms/required-minimum-functionality.
final class SportVideoPlayer: NSObject, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private static var active: SportVideoPlayer?
    private var window: NSWindow!
    private var web: WKWebView!
    private var status: NSTextField!
    private var heading: NSTextField!
    private var errorView: NSStackView!
    private var errorTitle: NSTextField!
    private var errorDetail: NSTextField!
    private var videoID = ""
    private var token = ""
    private var identity: URL
    private var timeout: DispatchWorkItem?
    private enum Lifecycle { case playing, closing, closed }
    private var lifecycle = Lifecycle.playing
    private weak var parentWindow: NSWindow?
    private weak var parentResponder: NSResponder?
    private var fullscreenTransition = false
    private var mediaPresentationsClosed = false
    private var mediaPresentationCloseRequested = false
    private var closeRetry: DispatchWorkItem?

    static func isValidVideoID(_ value: String) -> Bool {
        value.range(of: "^[A-Za-z0-9_-]{11}$", options: .regularExpression) != nil
    }

    /// The documented HTTPS app-ID form, not an unrelated website's referrer.
    static func identityURL(bundleIdentifier: String?) -> URL? {
        guard let identifier = bundleIdentifier?.lowercased(), identifier.count <= 253,
              identifier.range(of: "^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$", options: .regularExpression) != nil,
              !identifier.contains(".."), let url = URL(string: "https://\(identifier)/"),
              url.host == identifier else { return nil }
        return url
    }

    /// Caller must invoke on the main thread after an explicit play action.
    @discardableResult static func present(videoID: String, title: String, parentWindow: NSWindow) -> Bool {
        guard Thread.isMainThread, isValidVideoID(videoID),
              let origin = identityURL(bundleIdentifier: Bundle.main.bundleIdentifier) else { return false }
        if let existing = active, existing.lifecycle == .playing {
            existing.open(videoID: videoID, title: title)
            existing.window.makeKeyAndOrderFront(nil)
            return true
        }
        let controller = SportVideoPlayer(identity: origin)
        active = controller
        controller.buildWindow(parentWindow: parentWindow)
        controller.window.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)
        controller.open(videoID: videoID, title: title)
        return true
    }

    private init(identity: URL) { self.identity = identity; super.init() }

    private func buildWindow(parentWindow: NSWindow) {
        self.parentWindow = parentWindow
        parentResponder = parentWindow.firstResponder
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.mediaTypesRequiringUserActionForPlayback = []
        if #available(macOS 12.3, *) { configuration.preferences.isElementFullscreenEnabled = true }
        configuration.userContentController.add(self, name: "sportPlayer")
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.setValue(false, forKey: "drawsBackground")
        web.underPageBackgroundColor = .black

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1060, height: 690),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Rota · Video"
        window.minSize = NSSize(width: 640, height: 430)
        window.collectionBehavior = [.fullScreenPrimary]
        window.backgroundColor = NSColor(calibratedRed: 0.055, green: 0.065, blue: 0.085, alpha: 1)
        window.appearance = NSAppearance(named: .darkAqua)
        window.isReleasedWhenClosed = false
        window.delegate = self
        let root = NSView(); window.contentView = root
        heading = NSTextField(labelWithString: "Video")
        heading.font = .systemFont(ofSize: 14, weight: .semibold)
        heading.lineBreakMode = .byTruncatingTail
        let close = NSButton(title: "Kapat", target: self, action: #selector(closePlayer))
        close.bezelStyle = .rounded
        let fullscreen = NSButton(title: "Tam ekran", target: self, action: #selector(fullscreenPlayer))
        fullscreen.bezelStyle = .rounded
        let header = NSStackView(views: [heading, fullscreen, close]); header.orientation = .horizontal; header.spacing = 12
        heading.setContentHuggingPriority(.defaultLow, for: .horizontal)
        heading.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        status = NSTextField(labelWithString: "YouTube oynatıcı hazırlanıyor…")
        status.font = .systemFont(ofSize: 11); status.textColor = .secondaryLabelColor; status.lineBreakMode = .byTruncatingTail
        let fallback = NSButton(title: "YouTube sayfasını içeride aç", target: self, action: #selector(openWatchPage))
        fallback.bezelStyle = .rounded
        let footer = NSStackView(views: [status, fallback]); footer.orientation = .horizontal; footer.spacing = 12
        status.setContentHuggingPriority(.defaultLow, for: .horizontal)
        status.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        errorTitle = NSTextField(labelWithString: "Video açılamadı")
        errorTitle.font = .systemFont(ofSize: 22, weight: .semibold)
        errorDetail = NSTextField(wrappingLabelWithString: "")
        errorDetail.font = .systemFont(ofSize: 14); errorDetail.textColor = .secondaryLabelColor
        errorDetail.alignment = .center
        let retry = NSButton(title: "Yeniden dene", target: self, action: #selector(retryPlayer)); retry.bezelStyle = .rounded
        let watch = NSButton(title: "Uygulama içinde YouTube’da izle", target: self, action: #selector(openWatchPage)); watch.bezelStyle = .rounded
        let actions = NSStackView(views: [retry, watch]); actions.orientation = .horizontal; actions.spacing = 12
        errorView = NSStackView(views: [errorTitle, errorDetail, actions]); errorView.orientation = .vertical; errorView.spacing = 18; errorView.alignment = .centerX
        errorView.isHidden = true
        for view in [header, web!, footer, errorView!] { view.translatesAutoresizingMaskIntoConstraints = false; root.addSubview(view) }
        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: root.topAnchor, constant: 12), header.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 18), header.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -18), header.heightAnchor.constraint(equalToConstant: 32),
            footer.bottomAnchor.constraint(equalTo: root.bottomAnchor, constant: -10), footer.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 18), footer.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -18), footer.heightAnchor.constraint(equalToConstant: 30),
            web.topAnchor.constraint(equalTo: header.bottomAnchor, constant: 12), web.leadingAnchor.constraint(equalTo: root.leadingAnchor), web.trailingAnchor.constraint(equalTo: root.trailingAnchor), web.bottomAnchor.constraint(equalTo: footer.topAnchor, constant: -10),
            errorView.centerXAnchor.constraint(equalTo: root.centerXAnchor), errorView.centerYAnchor.constraint(equalTo: web.centerYAnchor), errorView.widthAnchor.constraint(lessThanOrEqualToConstant: 540), errorView.leadingAnchor.constraint(greaterThanOrEqualTo: root.leadingAnchor, constant: 36), errorView.trailingAnchor.constraint(lessThanOrEqualTo: root.trailingAnchor, constant: -36)
        ])
        let frame = parentWindow.frame
        window.setFrameOrigin(NSPoint(x: frame.midX - window.frame.width / 2, y: frame.midY - window.frame.height / 2))
        // Do not attach a fullScreenPrimary player as an AppKit child window.
        // WebKit temporarily moves its view into another window for element
        // fullscreen. An attached parent/child pair can then strand the Rota
        // window behind a black fullscreen placeholder when the player closes.
        // A normal, independently owned app window leaves the planner untouched.
    }

    private func open(videoID: String, title: String) {
        guard lifecycle == .playing else { return }
        timeout?.cancel(); web.stopLoading()
        self.videoID = videoID; token = UUID().uuidString
        heading.stringValue = String(title.trimmingCharacters(in: .whitespacesAndNewlines).prefix(180)).isEmpty ? "Antrenman videosu" : String(title.prefix(180))
        window.title = "Rota · \(heading.stringValue)"
        status.stringValue = "YouTube oynatıcı hazırlanıyor…"; web.isHidden = false; errorView.isHidden = true
        let options: [String: Any] = ["videoID": videoID, "origin": identity.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")), "token": token]
        guard let data = try? JSONSerialization.data(withJSONObject: options), let json = String(data: data, encoding: .utf8) else { return }
        let html = """
        <!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><style>html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden}#player{display:block;width:100%;height:100%;border:0}</style></head><body><div id="player"></div><script>
        const config=\(json);
        function report(event,value){window.webkit?.messageHandlers?.sportPlayer?.postMessage({token:config.token,event,value});}
        let player;
        window.onYouTubeIframeAPIReady=function(){player=new YT.Player('player',{width:'100%',height:'100%',videoId:config.videoID,playerVars:{origin:config.origin,playsinline:1,controls:1,fs:1,hl:'tr',rel:0},events:{onReady:function(e){report('ready',true);e.target.playVideo();},onStateChange:function(e){report('state',e.data);},onAutoplayBlocked:function(){report('autoplay-blocked',true);},onError:function(e){report('error',e.data);}}});};
        const api=document.createElement('script');api.src='https://www.youtube.com/iframe_api';api.onerror=function(){report('network',true);};document.head.appendChild(api);
        </script></body></html>
        """
        // YouTube explicitly documents baseURL as the WKWebView app-ID Referer
        // mechanism for a bundled/local HTML container. No DNS fetch of this
        // app-ID origin is performed; only the official YouTube API is loaded.
        web.loadHTMLString(html, baseURL: identity)
        let expectedToken = token
        let deadline = DispatchWorkItem { [weak self] in
            guard let self, self.lifecycle == .playing, self.token == expectedToken, !self.web.isHidden else { return }
            self.status.stringValue = "Bağlantı yavaş. Oynat tuşunu veya YouTube sayfasını deneyebilirsin."
        }
        timeout = deadline; DispatchQueue.main.asyncAfter(deadline: .now() + 25, execute: deadline)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard lifecycle == .playing, message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.host == identity.host,
              let body = message.body as? [String: Any], body["token"] as? String == token,
              let event = body["event"] as? String else { return }
        switch event {
        case "ready": timeout?.cancel(); status.stringValue = "Video hazır · YouTube"
        case "state":
            if let value = body["value"] as? Int {
                if value == 1 { status.stringValue = "Oynatılıyor · YouTube" }
                else if value == 2 { status.stringValue = "Duraklatıldı · YouTube" }
                else if value == 0 { status.stringValue = "Video tamamlandı · YouTube" }
            }
        case "autoplay-blocked": status.stringValue = "Videodaki oynat tuşuna basarak başlatabilirsin."
        case "error": showPlayerError(code: body["value"] as? Int)
        case "network": showError(title: "Bağlantı kurulamadı", detail: "YouTube’a erişilemiyor. İnternet bağlantını kontrol edip yeniden deneyebilirsin.")
        default: break
        }
    }

    private func showPlayerError(code: Int?) {
        switch code {
        case 100: showError(title: "Bu videoya erişilemiyor", detail: "Video kaldırılmış, gizli yapılmış veya hesabına özel olabilir. İstersen uygulama içinde YouTube sayfasını deneyebilirsin.")
        case 101, 150: showError(title: "Video sahibi oynatmayı sınırlandırmış", detail: "Bu video gömülü oynatıcıda izlenemiyor. Uygulamadan çıkmadan YouTube sayfasında izlemeyi deneyebilirsin.")
        case 153: showError(title: "YouTube oynatıcıyı doğrulayamadı", detail: "Uygulama kimliğiyle bağlantı kurulamadı. Yeniden deneyebilir veya uygulama içindeki YouTube sayfasına geçebilirsin.")
        default: showError(title: "Video şu anda oynatılamıyor", detail: "YouTube bu videoyu oynatamadı. Yeniden deneyebilir veya uygulama içindeki YouTube sayfasını açabilirsin.")
        }
    }

    private func showError(title: String, detail: String) {
        guard lifecycle == .playing else { return }
        timeout?.cancel(); status.stringValue = "Video açılmadı"
        // Replace a failed player; never overlay or conceal functioning controls.
        web.evaluateJavaScript("try{player?.stopVideo();}catch(_){}", completionHandler: nil)
        web.isHidden = true; errorTitle.stringValue = title; errorDetail.stringValue = detail; errorView.isHidden = false
    }

    @objc private func retryPlayer() { open(videoID: videoID, title: heading.stringValue) }
    @objc private func closePlayer() { requestClose() }
    @objc private func fullscreenPlayer() {
        guard lifecycle == .playing, !fullscreenTransition else { return }
        window.toggleFullScreen(nil)
    }
    @objc private func openWatchPage() {
        guard lifecycle == .playing else { return }
        timeout?.cancel(); token = UUID().uuidString
        guard var components = URLComponents(string: "https://www.youtube.com/watch") else { return }
        components.queryItems = [URLQueryItem(name: "v", value: videoID)]
        guard let url = components.url else { return }
        var request = URLRequest(url: url); request.setValue(identity.absoluteString, forHTTPHeaderField: "Referer")
        web.isHidden = false; errorView.isHidden = true; status.stringValue = "YouTube sayfası uygulama içinde açılıyor…"
        web.load(request)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard lifecycle == .playing, let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        // Remote YouTube/consent/ad navigation stays isolated inside this window.
        // Do not hand arbitrary file/custom-scheme requests to the OS.
        decisionHandler(["https", "about"].contains(url.scheme?.lowercased() ?? "") ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard lifecycle == .playing, let url = navigationAction.request.url, url.scheme == "https" else { return nil }
        var request = navigationAction.request
        request.setValue(identity.absoluteString, forHTTPHeaderField: "Referer")
        webView.load(request)
        return nil
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { navigationFailed(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { navigationFailed(error) }
    private func navigationFailed(_ error: Error) {
        guard lifecycle == .playing, (error as NSError).code != NSURLErrorCancelled else { return }
        showError(title: "YouTube’a bağlanılamadı", detail: "İnternet bağlantını kontrol edip yeniden deneyebilirsin.")
    }

    private func requestClose() {
        guard lifecycle == .playing else { return }
        lifecycle = .closing
        timeout?.cancel(); timeout = nil
        // Invalidate callbacks immediately, but retain the controller and web view
        // until WebKit has put any fullscreen/PiP presentation back in its window.
        token = UUID().uuidString
        status.stringValue = "Video kapatılıyor…"
        window.standardWindowButton(.closeButton)?.isEnabled = false
        finishClosingWhenReady()
    }

    private func closeMediaPresentations() {
        guard !mediaPresentationCloseRequested else { return }
        mediaPresentationCloseRequested = true
        // AppKit's Space transition must finish first. Calling WebKit's media
        // presentation teardown during native fullscreen entry can swallow the
        // transition completion and leave both APIs waiting indefinitely.
        if #available(macOS 12.0, *) {
            web.pauseAllMediaPlayback(completionHandler: nil)
            web.closeAllMediaPresentations { [weak self] in
                guard let self, self.lifecycle == .closing else { return }
                self.mediaPresentationsClosed = true
                self.finishClosingWhenReady()
            }
        } else {
            web.evaluateJavaScript("try{player?.stopVideo();document.webkitExitFullscreen?.();}catch(_){}") { [weak self] _, _ in
                guard let self else { return }
                self.mediaPresentationsClosed = true
                self.finishClosingWhenReady()
            }
        }
    }

    private func finishClosingWhenReady() {
        guard lifecycle == .closing else { return }
        closeRetry?.cancel(); closeRetry = nil
        if !fullscreenTransition {
            if window.styleMask.contains(.fullScreen) {
                fullscreenTransition = true
                window.toggleFullScreen(nil)
            } else if mediaPresentationsClosed {
                completeClose()
                return
            } else {
                closeMediaPresentations()
            }
        }
        let retry = DispatchWorkItem { [weak self] in self?.finishClosingWhenReady() }
        closeRetry = retry
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1, execute: retry)
    }

    private func completeClose() {
        guard lifecycle == .closing else { return }
        lifecycle = .closed
        timeout?.cancel(); closeRetry?.cancel(); closeRetry = nil
        // Only now is it safe to release WebKit's placeholder/presentation owner.
        web.stopLoading()
        web.navigationDelegate = nil; web.uiDelegate = nil
        web.configuration.userContentController.removeScriptMessageHandler(forName: "sportPlayer")
        web.removeFromSuperview()
        if let parent = window.parent { parent.removeChildWindow(window) }
        window.close()
        if Self.active === self { Self.active = nil }
        // Keep self alive until after AppKit's close delegate stack unwinds.
        DispatchQueue.main.async { [self] in
            guard Self.active == nil, let parent = parentWindow else { return }
            if parent.isMiniaturized { parent.deminiaturize(nil) }
            parent.makeKeyAndOrderFront(nil)
            if let responder = parentResponder { parent.makeFirstResponder(responder) }
            parent.contentView?.needsDisplay = true
            NSApplication.shared.activate(ignoringOtherApps: true)
        }
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        requestClose()
        return false
    }

    func windowWillClose(_ notification: Notification) {
        // Also handle a programmatic close that bypasses windowShouldClose.
        if lifecycle == .playing { requestClose() }
    }

    func windowWillEnterFullScreen(_ notification: Notification) { fullscreenTransition = true }
    func windowDidEnterFullScreen(_ notification: Notification) {
        fullscreenTransition = false
        finishClosingAfterTransition()
    }
    func windowWillExitFullScreen(_ notification: Notification) { fullscreenTransition = true }
    func windowDidExitFullScreen(_ notification: Notification) {
        fullscreenTransition = false
        finishClosingAfterTransition()
    }
    func windowDidFailToEnterFullScreen(_ window: NSWindow) {
        fullscreenTransition = false
        finishClosingAfterTransition()
    }
    func windowDidFailToExitFullScreen(_ window: NSWindow) {
        // Media presentations have already finished. A refused Space transition
        // must not trap the user in the player; close it and restore Rota.
        fullscreenTransition = false
        if lifecycle == .closing, mediaPresentationsClosed { completeClose() }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        if lifecycle == .closing {
            mediaPresentationsClosed = true
            finishClosingWhenReady()
        } else if lifecycle == .playing {
            showError(title: "Video oynatıcı durdu", detail: "Yeniden deneyebilirsin. Rota'daki kayıtların ve ekranın korunuyor.")
        }
    }

    private func finishClosingAfterTransition() {
        guard lifecycle == .closing else { return }
        // AppKit still considers itself in the transition while delivering the
        // didEnter/didExit delegate callback. A synchronous second toggle here
        // is ignored, which would otherwise leave the close state waiting for
        // a willExit/didExit notification that can never arrive.
        DispatchQueue.main.async { [weak self] in self?.finishClosingWhenReady() }
    }
}
