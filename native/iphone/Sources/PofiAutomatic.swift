import Foundation

enum PofiAutomatic {
    static func settled(_ original: [String: Any], at now: Date = Date()) -> [String: Any] {
        guard original["rotaAuto"] as? Bool == true else { return original }
        var state = original
        for _ in 0..<32 {
            guard let plan = PofiReminderPlan(state), plan.deadline <= now, plan.deadline > plan.start else { break }
            state = PofiReducer.transition(state, stop: false, now: plan.deadline)
        }
        return state
    }
    static func future(_ original: [String: Any], at now: Date = Date()) -> [PofiReminderPlan] {
        var state = settled(original, at: now), result: [PofiReminderPlan] = []
        for _ in 0..<32 {
            guard let plan = PofiReminderPlan(state), plan.deadline > now, plan.deadline > plan.start else { break }
            result.append(plan)
            guard state["rotaAuto"] as? Bool == true else { break }
            state = PofiReducer.transition(state, stop: false, now: plan.deadline)
        }
        return result
    }
}
