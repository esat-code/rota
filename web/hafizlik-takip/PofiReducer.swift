import Foundation

enum PofiReducer {
    static func number(_ object: [String: Any], _ key: String, _ fallback: Double = 0) -> Double { (object[key] as? NSNumber)?.doubleValue ?? fallback }
    static func transition(_ original: [String: Any], stop: Bool, now: Date = Date()) -> [String: Any] {
        var d = original
        let a = d["ayar"] as? [String: Any] ?? [:]
        let timestamp = now.timeIntervalSince1970 * 1000
        if stop { d["mod"] = "bos"; d["surum"] = timestamp; return d }
        let formatter = DateFormatter(); formatter.dateFormat = "yyyy-MM-dd"; formatter.locale = Locale(identifier: "en_US_POSIX")
        let today = formatter.string(from: now)
        var day = d["gun"] as? [String: Any] ?? [:]
        if day["tarih"] as? String != today { day = ["tarih": today, "oturum": 0, "odak": 0, "yuruyus": 0, "mola": 0] }
        var session = d["seans"] as? [String: Any] ?? ["ilerleme": 0, "oturum": 0, "odak": 0, "yuruyus": 0]
        let speed = d["deneme"] as? Bool == true ? 60.0 : 1.0
        let mode = d["mod"] as? String ?? "bos"
        if mode == "oturuyor" {
            let focus = max(0, timestamp - number(d, "basla", timestamp)) / 60000 * speed
            day["odak"] = number(day, "odak") + focus; session["odak"] = number(session, "odak") + focus
            let counted = focus >= number(a, "calis", 25) * 0.6
            if counted {
                day["oturum"] = number(day, "oturum") + 1; session["oturum"] = number(session, "oturum") + 1
                d["toplam"] = number(d, "toplam") + 1
                var streak = d["seri"] as? [String: Any] ?? [:]
                if streak["son"] as? String != today {
                    let yesterday = formatter.string(from: now.addingTimeInterval(-86400))
                    streak["gun"] = streak["son"] as? String == yesterday ? number(streak, "gun") + 1 : 1
                    streak["son"] = today; d["seri"] = streak
                }
            }
            let long = counted && Int(number(session, "oturum")) % max(1, Int(number(a, "uzunAralik", 4))) == 0
            d["mod"] = "mola"; d["molaBasla"] = timestamp
            d["molaSure"] = number(a, long ? "uzun" : "mola", 5)
            d["oto"] = false; d["esneme"] = false
        } else {
            var finished = false
            if mode == "mola" {
                let walked = max(0, min(number(d, "molaSure", 5), (timestamp - number(d, "molaBasla", timestamp)) / 60000 * speed))
                let progress = min(number(a, "hedef", 4), number(session, "ilerleme") + min(1, walked / max(1, number(a, "mola", 5))))
                session["ilerleme"] = progress
                day["yuruyus"] = number(day, "yuruyus") + walked; day["mola"] = number(day, "mola") + 1
                session["yuruyus"] = number(session, "yuruyus") + walked
                if progress >= number(a, "hedef", 4) - 0.000001 {
                    d["sonSeans"] = ["bitis": timestamp, "oturum": number(session, "oturum"), "odak": number(session, "odak").rounded(), "yuruyus": number(session, "yuruyus").rounded(), "seri": number(d["seri"] as? [String: Any] ?? [:], "gun")]
                    session = ["ilerleme": 0, "oturum": 0, "odak": 0, "yuruyus": 0]; finished = true
                }
            }
            d["mod"] = finished ? "bos" : "oturuyor"; d["basla"] = timestamp
            d["ek"] = 0; d["erteledi"] = false; d["oto"] = false; d["esneme"] = false
        }
        d["gun"] = day; d["seans"] = session; d["surum"] = timestamp
        return d
    }
}
