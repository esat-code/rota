import Foundation
import UserNotifications

enum PofiReminders {
    static let identifiers = ["pofi-phase", "pofi-advance"] + (0..<32).map { "pofi-auto-\($0)" }
    static func test() async {
        let content = UNMutableNotificationContent()
        content.title = "Pofi · Deneme hatırlatması"
        content.body = "Telefon sesi ve titreşim ayarlarınla gönderildi."
        let preferences = PofiReminderPreferences()
        if preferences.sound { content.sound = UNNotificationSound(named: UNNotificationSoundName("pofi-alert.wav")) }
        else if preferences.haptics { content.sound = UNNotificationSound(named: UNNotificationSoundName("pofi-silent.wav")) }
        try? await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "pofi-test", content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 20, repeats: false)))
    }
    static func registerActions() {
        let stop = UNNotificationAction(identifier: "POFI_STOP", title: "Durdur", options: [])
        let walk = UNNotificationAction(identifier: "POFI_NEXT", title: "Yürüyüşü başlat", options: [])
        let work = UNNotificationAction(identifier: "POFI_NEXT", title: "Çalışmaya dön", options: [])
        UNUserNotificationCenter.current().setNotificationCategories([
            UNNotificationCategory(identifier: "POFI_AUTO", actions: [stop], intentIdentifiers: []),
            UNNotificationCategory(identifier: "POFI_WORK", actions: [walk, stop], intentIdentifiers: []),
            UNNotificationCategory(identifier: "POFI_WALK", actions: [work, stop], intentIdentifiers: [])
        ])
    }
    static func schedule(_ state: [String: Any]) async {
        guard !Task.isCancelled else { return }
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: identifiers)
        center.removeDeliveredNotifications(withIdentifiers: identifiers)
        let preferences = PofiReminderPreferences()
        let plans = PofiAutomatic.future(state)
        for (index, plan) in plans.enumerated() {
            let content = content(plan)
            if state["rotaAuto"] as? Bool == true {
                content.categoryIdentifier = "POFI_AUTO"
                content.body = plan.walking ? "Çalışma oturumun otomatik başladı." : "Yürüyüş molan otomatik başladı."
                if index == plans.count - 1 && plan.walking { content.title = "Pofi · Seans tamamlandı"; content.body = "Bugünkü oturumlar bitti." }
            }
            if preferences.sound { content.sound = UNNotificationSound(named: UNNotificationSoundName("pofi-alert.wav")) }
            else if preferences.haptics { content.sound = UNNotificationSound(named: UNNotificationSoundName("pofi-silent.wav")) }
            guard !Task.isCancelled else { return }
            let identifier = state["rotaAuto"] as? Bool == true ? "pofi-auto-\(index)" : "pofi-phase"
            do { try await center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: max(1, plan.deadline.timeIntervalSinceNow), repeats: false))) }
            catch { UserDefaults.standard.set(error.localizedDescription, forKey: "rota-pofi-alert-error") }
        }
    }

    private static func content(_ plan: PofiReminderPlan) -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        content.title = plan.walking ? "Pofi · Yürüyüş tamamlandı" : "Pofi · Ayağa kalkma zamanı"
        content.body = plan.walking ? "Hazır olduğunda çalışmaya dön." : "Kısa bir yürüyüş için ayağa kalk."
        content.categoryIdentifier = plan.walking ? "POFI_WALK" : "POFI_WORK"
        if let source = Bundle.main.url(forResource: "pofi-notice", withExtension: "png") {
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent("pofi-" + UUID().uuidString)
            do {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                let file = directory.appendingPathComponent("Pofi.png")
                try FileManager.default.copyItem(at: source, to: file)
                content.attachments = [try UNNotificationAttachment(identifier: "pofi", url: file)]
            } catch {}
        }
        return content
    }
}
