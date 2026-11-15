import AppKit
import WebKit

final class RotaPofiBridge: NSObject, WKScriptMessageHandler {
    static let command = Notification.Name("local.rota.pofi.command")
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let url = message.frameInfo.request.url, url.isFileURL,
              let root = Bundle.main.resourceURL,
              url.standardizedFileURL.path.hasPrefix(root.standardizedFileURL.path + "/"),
              let body = message.body as? [String: String], body["action"] == "settings",
              let helper = Bundle.main.bundleURL.appendingPathComponent("Contents/Helpers/RotaPofi.app") as URL? else { return }
        let config = NSWorkspace.OpenConfiguration()
        config.activates = false
        config.arguments = ["--settings"]
        NSWorkspace.shared.openApplication(at: helper, configuration: config) { _, error in
            if error == nil {
                DistributedNotificationCenter.default().postNotificationName(Self.command, object: "settings", userInfo: nil, deliverImmediately: true)
            }
        }
    }
}
