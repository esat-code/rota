# Rota — iPhone

Bu, kendi simgesi ve uygulama penceresi olan SwiftUI + WKWebView uygulama projesidir. Rota'nın özel hesabına bağlanır. Günlük kullanımda adres çubuğu veya ayrı tarayıcı açılmaz. İlk açılışta aynı hesabınla giriş gerekir; oturum uygulamanın özel veri alanında saklanır.

**Durum:** Kaynak proje hazır. Bu Mac'te Xcode ve iOS SDK bulunmadığından henüz derlenmedi, imzalanmadı veya iPhone'a yüklenmedi. Gerçek iPhone'da hesap girişi, kapatıp açma ve arka plandan dönüş ayrıca doğrulanmalı. iOS arka planda çalışmayı durdurabileceğinden eşitleme uygulama açıkken/yeniden açılınca tamamlanır. İlk açılış için internet gerekir; açık ekrandaki çevrimdışı değişiklikler cihazda saklanır. Çevrimdışı soğuk açılış desteklenmez.

Kurulum:
1. Bu Mac'te macOS 15.7 var. Apple'ın geliştirici indirmelerinde Apple hesabınla giriş yapıp Xcode 26.3'ü indir. İndirilen .xip dosyasını aç, Xcode'u Uygulamalar'a taşı ve `Rota.xcodeproj` dosyasını aç.
2. Xcode → Settings → Accounts bölümüne Apple hesabını ekle. Projenin Signing & Capabilities ekranında kendi takımını seç. Gerekirse bundle identifier'ı benzersiz yap.
3. iPhone'u Mac'e bağla; cihazın güven ve Developer Mode adımlarını tamamla.
4. Çalıştırma hedefi olarak iPhone'u seç ve Run'a bas.
5. Uygulama içinden Rota'nın özel hesabına giriş yap. Mac'teki bir tiki telefonda, telefondaki bir tiki Mac'te kontrol et.

Kaynakta özel kayıt veya servis anahtarı yoktur. ZIP, doğrudan kurulabilir bir IPA değildir. Kendi cihazında Xcode ile denemek için ücretsiz Apple hesabı (Personal Team) kullanılabilir. Bu kurulumun imzası 7 gün sonra sona erer ve uygulamayı tekrar yüklemek gerekir. TestFlight üzerinden dağıtım için Apple Developer Program üyeliği ve imzalı derleme gerekir.

[Xcode 26.3 indirmeleri](https://developer.apple.com/download/all/?q=Xcode%2026.3) · [Uyumlu macOS sürümleri](https://developer.apple.com/xcode/system-requirements/) · [Apple hesabıyla cihazda test](https://developer.apple.com/help/account/basics/about-your-developer-account)

Apple kurulum belgesi: https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices

QR kurulumu:
- TestFlight sürümü gerçekten yüklenip test bağlantısı açılmadan QR oluşturulmaz.
- Gerçek `https://testflight.apple.com/join/...` bağlantısı masaüstü Rota kaynak klasöründeki `phone-install.json` dosyasının `testFlightURL` alanına yazılır.
- Masaüstü uygulama kaynakları yeniden paketlendiğinde Ayarlar → Telefon bağla ekranı bu bağlantının QR kodunu üretir. Kod servis anahtarı veya kişisel kayıt içermez.
- iPhone kamerayla okutur; TestFlight içinde kullanıcı yüklemeyi onaylar. QR sessiz veya imzasız yükleme yapamaz.
