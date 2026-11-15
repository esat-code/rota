import Foundation

struct PofiReminderPreferences {
    var sound: Bool
    var haptics: Bool
    init(defaults: UserDefaults = .standard) {
        sound = defaults.object(forKey: "rota-pofi-phone-sound") as? Bool ?? false
        haptics = defaults.object(forKey: "rota-pofi-phone-haptics") as? Bool ?? true
    }
}

struct PofiReminderPlan {
    var walking: Bool
    var start: Date
    var deadline: Date
    var minutes: Int
    init?(_ state: [String: Any]) {
        guard let mode = state["mod"] as? String, ["oturuyor", "mola"].contains(mode) else { return nil }
        walking = mode == "mola"
        let a = state["ayar"] as? [String: Any] ?? [:]
        start = Date(timeIntervalSince1970: PofiReducer.number(state, walking ? "molaBasla" : "basla") / 1000)
        let duration = walking ? PofiReducer.number(state, "molaSure", 5) : PofiReducer.number(a, "calis", 25) + PofiReducer.number(state, "ek")
        minutes = Int(duration)
        deadline = start.addingTimeInterval(duration * 60 / (state["deneme"] as? Bool == true ? 60 : 1))
    }
}
