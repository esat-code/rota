import ActivityKit
import Foundation

struct PofiAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var walking: Bool
        var start: Date
        var deadline: Date
        var minutes: Int
        var running: Bool? = nil
        var automaticEnd: Date? = nil
    }
    var name: String = "Pofi"
}
