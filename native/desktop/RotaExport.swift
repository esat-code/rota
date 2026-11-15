import AppKit
import WebKit
import PDFKit
import UniformTypeIdentifiers

// Renders an isolated, script-free document; never photographs the editor controls.
final class RotaDocumentRenderer: NSObject, WKNavigationDelegate {
    private let web: WKWebView
    private let size: CGSize
    private let format: String
    private var completion: ((Result<Data, Error>) -> Void)?
    private var timeout: DispatchWorkItem?

    init(html: String, size: CGSize, format: String, completion: @escaping (Result<Data, Error>) -> Void) {
        self.size = size; self.format = format; self.completion = completion
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = false
        web = WKWebView(frame: NSRect(origin: .zero, size: size), configuration: configuration)
        super.init()
        web.navigationDelegate = self
        let deadline = DispatchWorkItem { [weak self] in self?.finish(.failure(Self.failure("Dosya hazırlanırken zaman aşımı oluştu. Daha küçük bir alan seçebilirsin."))) }
        timeout = deadline; DispatchQueue.main.asyncAfter(deadline: .now() + 30, execute: deadline)
        web.loadHTMLString(html, baseURL: nil)
    }
    static func failure(_ message: String) -> NSError { NSError(domain: "RotaExport", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
    private func finish(_ result: Result<Data, Error>) { timeout?.cancel(); let callback = completion; completion = nil; callback?(result) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { finish(.failure(error)) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { finish(.failure(error)) }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in
            guard let self, self.completion != nil else { return }
            let config = WKPDFConfiguration(); config.rect = CGRect(origin: .zero, size: self.size)
            self.web.createPDF(configuration: config) { [weak self] result in
                guard let self else { return }
                switch result {
                case .failure(let error): self.finish(.failure(error))
                case .success(let pdf):
                    if self.format == "pdf" { self.finish(.success(pdf)); return }
                    // PDFKit rasterization also captures offscreen content reliably.
                    guard let page = PDFDocument(data: pdf)?.page(at: 0) else { self.finish(.failure(Self.failure("Görsel hazırlanamadı."))); return }
                    let bounds = page.bounds(for: .mediaBox), scale: CGFloat = 1
                    let width = Int(ceil(bounds.width * scale)), height = Int(ceil(bounds.height * scale))
                    guard width > 0, height > 0, width * height <= 24_000_000,
                          let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { self.finish(.failure(Self.failure("Görsel çok büyük; daha küçük bir alan seç."))); return }
                    context.setFillColor(NSColor.white.cgColor); context.fill(CGRect(x: 0, y: 0, width: width, height: height))
                    context.scaleBy(x: scale, y: scale); context.translateBy(x: -bounds.minX, y: -bounds.minY)
                    page.draw(with: .mediaBox, to: context)
                    guard let image = context.makeImage(), let png = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) else { self.finish(.failure(Self.failure("Görsel kaydedilemedi."))); return }
                    self.finish(.success(png))
                }
            }
        }
    }
}

final class RotaExportCoordinator: NSObject, NSSharingServicePickerDelegate, NSSharingServiceDelegate {
    private(set) var activeSavePanel: NSSavePanel?
    private var renderer: RotaDocumentRenderer?
    private var picker: NSSharingServicePicker?
    private var sharedDirectory: URL?
    private var busy = false
    private func reply(_ body: [String: Any], to web: WKWebView) {
        guard let data = try? JSONSerialization.data(withJSONObject: body), let json = String(data: data, encoding: .utf8) else { return }
        web.evaluateJavaScript("window.hafizlikExportResult?.(\(json));", completionHandler: nil)
    }
    func receive(_ body: [String: Any], from web: WKWebView, in window: NSWindow) {
        guard let id = body["id"] as? String, UUID(uuidString: id) != nil else { return }
        guard !busy else { reply(["id": id, "error": "Önce açık olan indirme veya paylaşma işlemini tamamla."], to: web); return }
        guard let format = body["format"] as? String, ["pdf", "png", "json"].contains(format), let operation = body["operation"] as? String, ["download", "send"].contains(operation) else { reply(["id": id, "error": "Geçerli bir dosya türü seç."], to: web); return }
        let suggested = (body["name"] as? String ?? "Rota").components(separatedBy: CharacterSet(charactersIn: "/\\:")).joined(separator: " ")
        let filename = String(suggested.prefix(120))
        let deliver: (Result<Data, Error>) -> Void = { [weak self, weak web, weak window] result in
            guard let self, let web, let window else { return }
            self.renderer = nil
            switch result {
            case .failure(let error): self.busy = false; self.reply(["id": id, "error": error.localizedDescription], to: web)
            case .success(let data):
                if operation == "send" {
                    do {
                        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("Rota-Export-" + UUID().uuidString, isDirectory: true)
                        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
                        let file = folder.appendingPathComponent(filename); try data.write(to: file, options: .atomic)
                        self.sharedDirectory = folder
                        self.picker = NSSharingServicePicker(items: [file]); self.picker?.delegate = self
                        self.picker?.show(relativeTo: NSRect(x: max(0, web.bounds.width - 280), y: 50, width: 180, height: 35), of: web, preferredEdge: .maxY)
                        self.reply(["id": id, "shared": true], to: web)
                    } catch { self.busy = false; self.reply(["id": id, "error": error.localizedDescription], to: web) }
                } else {
                    let panel = NSSavePanel(); panel.nameFieldStringValue = filename; panel.canCreateDirectories = true
                    panel.title = "Planını indir"; panel.prompt = "Kaydet"; panel.allowedContentTypes = [format == "pdf" ? .pdf : format == "png" ? .png : .json]
                    self.activeSavePanel = panel
                    panel.beginSheetModal(for: window) { [weak self, weak web] response in
                        guard let self, let web else { return }; self.busy = false; self.activeSavePanel = nil
                        guard response == .OK, let url = panel.url else { self.reply(["id": id, "cancelled": true], to: web); return }
                        do { try data.write(to: url, options: .atomic); self.reply(["id": id, "saved": true], to: web) }
                        catch { self.reply(["id": id, "error": error.localizedDescription], to: web) }
                    }
                }
            }
        }
        busy = true
        if format == "json" {
            guard let text = body["data"] as? String, let data = text.data(using: .utf8), data.count <= 12 * 1024 * 1024,
                  let archive = try? JSONSerialization.jsonObject(with: data) as? [String: Any], archive["format"] as? String == "rota-hafizlik" else { deliver(.failure(RotaDocumentRenderer.failure("Plan dosyası geçersiz."))); return }
            deliver(.success(data)); return
        }
        guard let html = body["html"] as? String, html.utf8.count <= 20 * 1024 * 1024, let w = body["width"] as? Double, let h = body["height"] as? Double,
              w.isFinite, h.isFinite, w > 0, h > 0, w <= 12_000, h <= 12_000, w * h <= 24_000_000 else { deliver(.failure(RotaDocumentRenderer.failure("Aktarılacak alan çok büyük veya geçersiz."))); return }
        renderer = RotaDocumentRenderer(html: html, size: CGSize(width: w, height: h), format: format, completion: deliver)
    }
    private func removeSharedTemporaryFile() {
        // Only the exact temporary directory generated for this share operation.
        if let url = sharedDirectory, url.deletingLastPathComponent().standardizedFileURL.path == FileManager.default.temporaryDirectory.standardizedFileURL.path, url.lastPathComponent.hasPrefix("Rota-Export-") { try? FileManager.default.removeItem(at: url) }
        sharedDirectory = nil; picker = nil; busy = false
    }
    func sharingServicePicker(_ sharingServicePicker: NSSharingServicePicker, didChoose service: NSSharingService?) { if service == nil { removeSharedTemporaryFile() } }
    func sharingServicePicker(_ sharingServicePicker: NSSharingServicePicker, delegateFor sharingService: NSSharingService) -> NSSharingServiceDelegate? { self }
    func sharingService(_ sharingService: NSSharingService, didShareItems items: [Any]) { removeSharedTemporaryFile() }
    func sharingService(_ sharingService: NSSharingService, didFailToShareItems items: [Any], error: Error) { removeSharedTemporaryFile() }
}
