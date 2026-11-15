import AppKit
import WebKit
import UniformTypeIdentifiers

final class SportFileExport {
    private var panel: NSSavePanel?
    func receive(_ body: [String: Any], from web: WKWebView, in window: NSWindow) {
        guard let id=body["id"] as? String, UUID(uuidString:id) != nil else { return }
        func reply(_ result: [String: Any]) {
            guard let data=try? JSONSerialization.data(withJSONObject:result.merging(["id":id]){a,_ in a}),let json=String(data:data,encoding:.utf8) else{return}
            web.evaluateJavaScript("window.rotaSportNativeResult?.(\(json));",completionHandler:nil)
        }
        guard panel == nil else{reply(["error":"Önce açık olan kayıt penceresini tamamla."]);return}
        guard let format=body["format"] as? String,["json","ics"].contains(format),let text=body["data"] as? String,let data=text.data(using:.utf8),data.count<=12*1024*1024 else{reply(["error":"Dosya içeriği geçersiz veya çok büyük."]);return}
        if format=="json" {
            guard let archive=try? JSONSerialization.jsonObject(with:data) as? [String:Any],archive["app"] as? String=="rota-sport",archive["state"] is [String:Any] else{reply(["error":"Bu bir Rota spor yedeği değil."]);return}
        }else if !text.hasPrefix("BEGIN:VCALENDAR\r\n") || !text.contains("END:VCALENDAR") {reply(["error":"Takvim dosyası geçersiz."]);return}
        let suggested=(body["name"] as? String ?? "Rota-Hareket.\(format)").components(separatedBy:CharacterSet(charactersIn:"/\\:")).joined(separator:" ")
        let save=NSSavePanel();save.title="Spor verilerini kaydet";save.prompt="Kaydet";save.canCreateDirectories=true
        save.nameFieldStringValue=String(suggested.prefix(150));save.allowedContentTypes=[format=="json" ? .json : (UTType(filenameExtension:"ics") ?? .plainText)]
        panel=save
        save.beginSheetModal(for:window){[weak self] response in
            self?.panel=nil
            guard response == .OK,let target=save.url else{reply(["cancelled":true]);return}
            do{try data.write(to:target,options:.atomic);reply(["saved":true])}catch{reply(["error":"Dosya kaydedilemedi: \(error.localizedDescription)"])}
        }
    }
}
