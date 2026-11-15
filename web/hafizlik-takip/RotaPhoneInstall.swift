import AppKit
import CoreImage

// Only a real signed-app distribution URL can produce an installation QR.
enum RotaPhoneInstall {
    static func result(id: String) -> [String: Any] {
        var result: [String: Any] = ["id": id, "ready": false]
        guard let file = Bundle.main.url(forResource: "phone-install", withExtension: "json"),
              let data = try? Data(contentsOf: file),
              let config = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let address = config["testFlightURL"] as? String,
              let url = URL(string: address), url.scheme == "https", url.host == "testflight.apple.com",
              url.path.range(of: "^/join/[A-Za-z0-9]+$", options: .regularExpression) != nil,
              let generator = CIFilter(name: "CIQRCodeGenerator") else { return result }
        generator.setValue(Data(address.utf8), forKey: "inputMessage")
        generator.setValue("M", forKey: "inputCorrectionLevel")
        guard let output = generator.outputImage?.transformed(by: CGAffineTransform(scaleX: 8, y: 8)),
              let cg = CIContext().createCGImage(output, from: output.extent),
              let png = NSBitmapImageRep(cgImage: cg).representation(using: .png, properties: [:]) else { return result }
        result["ready"] = true
        result["qr"] = "data:image/png;base64," + png.base64EncodedString()
        return result
    }
}
