import SwiftUI
import WebKit

@main
struct RotaApp: App {
    @StateObject private var session = RotaSession()
    @Environment(\.scenePhase) private var phase
    var body: some Scene {
        WindowGroup {
            ZStack {
                Color(red: 8/255, green: 9/255, blue: 11/255).ignoresSafeArea()
                RotaWebView(session: session)
                    .ignoresSafeArea(.keyboard, edges: .bottom)
                    .accessibilityHidden(session.showingShopping)
                if let failure = session.failure {
                    VStack(spacing: 20) {
                        Text("Rota").font(.largeTitle.bold())
                        Text(failure).multilineTextAlignment(.center)
                        Button("Yeniden dene") { session.retry() }.buttonStyle(.borderedProminent)
                    }.padding(30).frame(maxWidth: .infinity, maxHeight: .infinity)
                     .background(Color(red: 8/255, green: 9/255, blue: 11/255))
                }
                if session.loading {
                    RotaLoadingView()
                        .transition(.opacity)
                }
                if session.showingShopping {
                    VStack(spacing: 0) {
                        HStack {
                            Button { session.showingShopping = false } label: {
                                Label("Ayarlar", systemImage: "chevron.left")
                            }
                            .frame(minHeight: 44)
                            Spacer()
                            Text("Alışveriş planı").font(.headline)
                            Spacer()
                        }
                        .padding(.horizontal, 14)
                        .background(.bar)
                        RotaWebViewContent(webView: session.shopping.webView)
                    }
                    .background(Color(uiColor: .systemBackground))
                }
                RotaPofiHost(pofi: session.pofi)
            }.preferredColorScheme(.dark)
             .onOpenURL { url in
                if url.scheme == "rota" && url.host == "pofi" {
                    session.pofi.open()
                    if URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.contains(where: { $0.name == "test" && $0.value == "alert" }) == true { session.pofi.testReminder() }
                }
             }
             .onChange(of: phase) { value in
                if value == .background { session.save() }
                if value == .active { session.resume() }
             }
        }
    }
}

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

@MainActor
private final class RotaBootHandler: NSObject, WKScriptMessageHandler {
    weak var session: RotaSession?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              let url = message.frameInfo.request.url,
              RotaSession.isBootstrap(url),
              let detail = message.body as? String else { return }
        session?.showStartupFailure(detail)
    }
}

@MainActor
final class RotaSession: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    static let origin = "https://YOUR-ROTA-SERVER.example"
    @Published var loading = true
    @Published var failure: String?
    let webView: WKWebView
    private var hasContent = false
    private var passwordEntry: RotaPasswordEntry!
    let pofi = RotaPofi()
    private let russianSpeech = RotaRussianSpeech { url in
        url.scheme == "https" && url.host == URL(string: RotaSession.origin)?.host &&
            url.path == "/rota/hafizlik-tik-denemesi.html"
    }
    let shopping = RotaShopping()
    @Published var showingShopping = false

    static func isBootstrap(_ url: URL) -> Bool {
        url.scheme == "https" && url.host == URL(string: origin)?.host
            && ["/rota/start", "/rota/start.html"].contains(url.path)
    }

    func showStartupFailure(_ detail: String) {
        loading = false
        failure = detail
    }

    override init() {
        let configuration = WKWebViewConfiguration()
        // App-private, persistent login and local storage. No service token in the app.
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = [.audio]
        let mobile = "if(location.origin==='\(Self.origin)'){window.ROTA_IOS_APP=true;}"
        configuration.userContentController.addUserScript(WKUserScript(source: mobile, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        configuration.userContentController.add(pofi, name: "rotaPofi")
        configuration.userContentController.addScriptMessageHandler(russianSpeech, contentWorld: .page, name: "rotaRussianSpeech")
        RotaShoppingEntry.install(in: configuration, accepts: { url in
            url.scheme == "https" && url.host == URL(string: Self.origin)?.host
        }, open: { [weak self] in self?.showingShopping = true })
        if let path = Bundle.main.url(forResource: "rota-pofi-settings", withExtension: "js"), let script = try? String(contentsOf: path, encoding: .utf8) {
            configuration.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        if let path = Bundle.main.url(forResource: "rota-russian", withExtension: "js"),
           let script = try? String(contentsOf: path, encoding: .utf8) {
            let guarded = "if(location.origin === '\(Self.origin)'){\(script)}"
            configuration.userContentController.addUserScript(WKUserScript(source: guarded, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        if let path = Bundle.main.url(forResource: "rota-weekly-table", withExtension: "js"),
           let script = try? String(contentsOf: path, encoding: .utf8) {
            let guarded = "if(location.origin === '\(Self.origin)'){\(script)}"
            configuration.userContentController.addUserScript(WKUserScript(source: guarded, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        let bootHandler = RotaBootHandler()
        bootHandler.session = self
        configuration.userContentController.add(bootHandler, name: "rotaBootBlocked")
        configuration.userContentController.add(RotaTextRecognition { url in
            url.scheme == "https" && url.host == URL(string: Self.origin)?.host
        }, name: "rotaTextOCR")
        webView.navigationDelegate = self
        webView.uiDelegate = self
        passwordEntry = RotaPasswordEntry(web:webView)
        configuration.userContentController.add(passwordEntry, name:"rotaPasswordEntry")
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.bounces = false
        webView.allowsBackForwardNavigationGestures = true
        retry()
    }
    func retry() {
        hasContent = false
        failure = nil
        loading = true
        webView.load(URLRequest(url: URL(string: Self.origin + "/rota/start.html")!, cachePolicy: .reloadIgnoringLocalCacheData))
    }
    private var isRota: Bool { webView.url?.host == URL(string: Self.origin)?.host }
    func save() {
        russianSpeech.stop()
        guard isRota else { return }
        webView.evaluateJavaScript("window.hafizlikSaveAll?.(); window.rotaCloudFlush?.();", completionHandler: nil)
    }
    func resume() {
        pofi.resume()
        guard isRota, hasContent else { return }
        webView.evaluateJavaScript("window.dispatchEvent(new Event('online'));", completionHandler: nil)
    }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { passwordEntry.hide(); loading = !hasContent }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Keep the same native scene during the initial state fetch and redirect.
        if let url = webView.url, Self.isBootstrap(url) { return }
        hasContent = true
        failure = nil
        withAnimation(.easeOut(duration: 0.18)) { loading = false }
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failed(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failed(error) }
    private func failed(_ error: Error) {
        if (error as NSError).code == NSURLErrorCancelled { return }
        loading = false
        if !hasContent { failure = "Rota’ya bağlanılamadı. İnternet bağlantını kontrol edip yeniden dene." }
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { hasContent = false; retry() }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if navigationAction.targetFrame?.isMainFrame == true, Self.isBootstrap(url) {
            hasContent = false
            failure = nil
            loading = true
        }
        // Login stays inside the app. Never downgrade HTTPS or launch a browser.
        decisionHandler(["https", "about", "blob"].contains(url.scheme ?? "") ? .allow : .cancel)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil, navigationAction.request.url?.scheme == "https" { webView.load(navigationAction.request) }
        return nil
    }
}
struct RotaWebView: UIViewRepresentable {
    @ObservedObject var session: RotaSession
    func makeUIView(context: Context) -> WKWebView { session.webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

private struct RotaWebViewContent: UIViewRepresentable {
    let webView: WKWebView
    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
