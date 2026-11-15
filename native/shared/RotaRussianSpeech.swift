import AVFoundation
import WebKit

final class RotaRussianSpeech: NSObject, WKScriptMessageHandlerWithReply {
    private let synthesizer = AVSpeechSynthesizer()
    private let accepts: (URL) -> Bool

    init(accepts: @escaping (URL) -> Bool) {
        self.accepts = accepts
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage,
        replyHandler: @escaping (Any?, String?) -> Void
    ) {
        guard message.frameInfo.isMainFrame,
              let url = message.frameInfo.request.url, accepts(url),
              let body = message.body as? [String: Any] else {
            replyHandler(nil, "Seslendirme başlatılamadı.")
            return
        }
        if body["action"] as? String == "stop" {
            stop()
            replyHandler(true, nil)
            return
        }
        guard let parts = body["parts"] as? [String], !parts.isEmpty,
              parts.count <= 240, parts.allSatisfy({ !$0.isEmpty }),
              parts.reduce(0, { $0 + $1.utf16.count }) <= 480,
              let speed = body["speed"] as? Double, (0.6...1.2).contains(speed) else {
            replyHandler(nil, "Seslendirilecek metin okunamadı.")
            return
        }
        guard let voice = AVSpeechSynthesisVoice(language: "ru-RU") else {
            replyHandler(nil, "Cihazın ses ayarlarından bir Rusça ses indirip tekrar dene.")
            return
        }
        stop()
        for part in parts {
            let utterance = AVSpeechUtterance(string: part)
            utterance.voice = voice
            utterance.rate = AVSpeechUtteranceDefaultSpeechRate * Float(speed)
            utterance.postUtteranceDelay = 0.28
            synthesizer.speak(utterance)
        }
        replyHandler(true, nil)
    }
}
