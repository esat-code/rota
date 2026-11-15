import Foundation
import Vision
import WebKit

final class RotaTextRecognition: NSObject, WKScriptMessageHandler {
    private let allows: (URL) -> Bool

    init(allows: @escaping (URL) -> Bool) { self.allows = allows }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let url = message.frameInfo.request.url, allows(url),
              let body = message.body as? [String: Any], let id = body["id"] as? String,
              UUID(uuidString: id) != nil, let web = message.webView else { return }
        func reply(_ value: [String: String]) {
            var value = value
            value["id"] = id
            guard let data = try? JSONSerialization.data(withJSONObject: value),
                  let json = String(data: data, encoding: .utf8) else { return }
            DispatchQueue.main.async { web.evaluateJavaScript("window.rotaTextOCRResult?.(\(json));", completionHandler: nil) }
        }
        guard let image = body["image"] as? String, image.hasPrefix("data:image/jpeg;base64,"),
              image.utf8.count <= 12_000_000,
              let data = Data(base64Encoded: String(image.dropFirst("data:image/jpeg;base64,".count))) else {
            reply(["error":"Görsel okunamadı."]); return
        }
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let request = VNRecognizeTextRequest()
                request.recognitionLevel = .accurate
                let supported = try request.supportedRecognitionLanguages()
                request.recognitionLanguages = ["tr-TR", "en-US", "ru-RU"].filter { supported.contains($0) }
                request.usesLanguageCorrection = false
                try VNImageRequestHandler(data: data).perform([request])
                let text = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
                reply(["text":text])
            } catch { reply(["error":"Fotoğraftaki yazı okunamadı. Metni elle ekleyebilirsin."]) }
        }
    }
}
