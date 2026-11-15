import ActivityKit
import WidgetKit
import SwiftUI

@main
struct PofiWidgets: WidgetBundle {
    var body: some Widget { PofiLiveActivity() }
}

struct PofiLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PofiAttributes.self) { context in
            VStack(spacing: 12) {
              HStack(spacing: 16) {
                Image("Pofi").resizable().scaledToFit()
                    .frame(width: 112, height: 112).offset(y: -25)
                    .frame(width: 76, height: 76).clipped()
                VStack(alignment: .leading, spacing: 4) {
                    Text("Pofi · Rota").font(.caption).foregroundStyle(.secondary)
                    Text(context.state.automaticEnd != nil ? (context.isStale ? "Seans tamamlandı" : "Otomatik çalışma / yürüyüş") : context.state.running == false ? "Başlamaya hazır" : context.isStale ? (context.state.walking ? "Yürüyüş tamamlandı" : "Ayağa kalkma zamanı") : (context.state.walking ? "Yürüyoruz" : "Çalışma zamanı"))
                        .font(.headline)
                    Text(context.state.automaticEnd != nil ? "Kalan toplam seans süresi" : context.state.running == false ? "İstediğinde Başla’ya dokun" : context.isStale ? "Devam etmek için dokun" : "\(context.state.minutes) dakikalık \(context.state.walking ? "yürüyüş" : "odak")")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                if context.state.running != false && !context.isStale {
                    Text(timerInterval: context.state.start...(context.state.automaticEnd ?? context.state.deadline), countsDown: true)
                        .monospacedDigit().font(.title2.bold()).frame(width: 80)
                }
              }
              if #available(iOS 17.0, *) {
                  HStack(spacing: 12) {
                      Button(intent: PofiNextIntent()) { Label(context.state.automaticEnd != nil ? "Aşamayı atla" : context.state.running == false ? "Başla" : context.state.walking ? "Çalış" : "Yürü", systemImage: context.state.walking ? "play.fill" : "figure.walk") }
                          .tint(Color(red: 0.29, green: 0.45, blue: 0.36))
                      Button(intent: PofiStopIntent()) { Label("Durdur", systemImage: "stop.fill") }.tint(.secondary)
                  }.buttonStyle(.bordered)
              }
            }.padding(18).foregroundStyle(.black)
                .activityBackgroundTint(Color(red: 0.96, green: 0.94, blue: 0.88))
                .activitySystemActionForegroundColor(.black)
                .widgetURL(URL(string: "rota://pofi"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Image(systemName: context.state.walking ? "figure.walk" : "chair.fill") }
                DynamicIslandExpandedRegion(.trailing) { Text(timerInterval: context.state.start...(context.state.automaticEnd ?? context.state.deadline), countsDown: true).monospacedDigit() }
                DynamicIslandExpandedRegion(.bottom) { Text(context.isStale ? "Pofi seni bekliyor" : context.state.walking ? "Yürüyüş zamanı" : "Çalışma zamanı") }
            } compactLeading: {
                Image(systemName: context.state.walking ? "figure.walk" : "chair.fill")
            } compactTrailing: {
                Text(timerInterval: context.state.start...(context.state.automaticEnd ?? context.state.deadline), countsDown: true).monospacedDigit().frame(width: 48)
            } minimal: {
                Image(systemName: context.state.walking ? "figure.walk" : "chair.fill")
            }.widgetURL(URL(string: "rota://pofi"))
        }
    }
}
