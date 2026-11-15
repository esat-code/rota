import Foundation
import AppIntents
import ActivityKit
import UserNotifications

@available(iOS 17.0, *)
struct PofiNextIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Pofi · Kalk / Çalış"
    static var openAppWhenRun = false
    func perform() async throws -> some IntentResult {
        try await PofiControls.shared.change(stop: false)
        return .result()
    }
}

@available(iOS 17.0, *)
struct PofiStopIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Pofi · Durdur"
    static var openAppWhenRun = false
    func perform() async throws -> some IntentResult {
        try await PofiControls.shared.change(stop: true)
        return .result()
    }
}

enum PofiControlError: LocalizedError {
    case connection
    var errorDescription: String? { "Pofi’ye bağlanılamadı. İnternet bağlantını kontrol edip tekrar dene." }
}

actor PofiControls {
    static let shared = PofiControls()
    func change(stop: Bool, automatic: Bool? = nil, settleOnly: Bool = false) async throws {
        let saved = UserDefaults.standard.data(forKey: "rota-pofi-native-state")
        let old = (saved.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }) ?? ["mod":"bos"]
        var state = PofiAutomatic.settled(old)
        if let automatic { state["rotaAuto"] = automatic }
        else if !settleOnly { state = PofiReducer.transition(state, stop: stop) }
        else if PofiReducer.number(state, "surum") == PofiReducer.number(old, "surum") { return }
        state["surum"] = Date().timeIntervalSince1970 * 1000
        UserDefaults.standard.set(try JSONSerialization.data(withJSONObject: state), forKey: "rota-pofi-native-state")
        await refresh(state)
        let updated = state
        await MainActor.run { NotificationCenter.default.post(name: Notification.Name("rota-pofi-native-change"), object: updated) }
    }

    private func refresh(_ state: [String: Any]) async {
        await PofiReminders.schedule(state)
        let current = Activity<PofiAttributes>.activities
        guard UserDefaults.standard.bool(forKey: "rota-pofi-show-card") else {
            for activity in current { await activity.end(nil, dismissalPolicy: .immediate) }; return
        }
        let plan = PofiReminderPlan(state)
        let end = state["rotaAuto"] as? Bool == true ? PofiAutomatic.future(state).last?.deadline : nil
        let value = PofiAttributes.ContentState(walking: plan?.walking ?? false, start: plan?.start ?? Date(), deadline: plan?.deadline ?? Date(), minutes: plan?.minutes ?? 0, running: plan != nil, automaticEnd: end)
        let content = ActivityContent(state: value, staleDate: end ?? plan?.deadline)
        for activity in current { await activity.update(content) }
        if current.isEmpty && ActivityAuthorizationInfo().areActivitiesEnabled { _ = try? Activity.request(attributes: PofiAttributes(), content: content, pushType: nil) }
    }
}
