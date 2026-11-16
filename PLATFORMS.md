# Cihazlar ve kurulum

**Geliştirme sürümü.** Ortak arayüz `web/` içindedir. Her platforma ayrı bir Rota kopyası yazılmaz; aynı dosyalar `npm run app:prepare` ile `app-dist/` içine hazırlanır. Kişisel kayıtlar pakete eklenmez.

| Cihaz | Proje | Komut | Durum |
|---|---|---|---|
| Windows x64 / ARM64 | `platforms/desktop` (Electron) | `npm run package:windows` | Paket yapılandırması mevcut; Windows cihaz testi yapılmadı. Windows üzerinde derleyin. |
| Mac Intel / Apple Silicon | `platforms/desktop` (Electron) | `npm run package:mac` | Ortak masaüstü kabuğu; dağıtım imzası ayrıca gerekir. |
| Linux | `platforms/desktop` (Electron) | `npm run package:linux` | Yapılandırma mevcut; cihaz testi yapılmadı. Linux üzerinde derleyin. |
| Android telefon / tablet | `platforms/mobile/android` (Capacitor) | `npm run android` | Android Studio projesi mevcut; APK/cihaz testi ayrıca gerekir. |
| iPhone / iPad | `platforms/mobile/ios` (Capacitor) | `npm run ios` | Ortak proje iki cihaz ailesini destekler; fiziksel cihaz testi ayrıca gerekir. |
| Tarayıcı | `web/hafizlik-takip` | `npm start` | Mevcut yerel web sürümü. |

## Ortak başlangıç

Node.js 22 veya daha yeni sürümü, npm ve Git kurun. Depoyu indirdikten sonra:

```sh
npm ci
npm run app:prepare
```

Masaüstünde geliştirme için `npm run desktop` kullanın. Ayrı uygulama penceresi açar; ChatGPT hesabına veya tarayıcı sekmesine ihtiyaç duymaz. Arayüz dosyaları paketin içindedir. İnternetteki videolar ve ürün sayfaları yine internet gerektirir.

## Android

Android Studio ve uygun Android SDK/JDK kurun. `npm run android` projeyi açar. Studio içinden cihaz/emülatör seçerek çalıştırın. APK üretmek için Build menüsünü kullanın. `local.properties`, imza anahtarları ve kişisel cihaz ayarlarını Git'e eklemeyin.

## iPhone / iPad

Mac üzerinde Xcode kurun. `npm run ios` ile **yeni ortak projeyi** açın. Kendi Team hesabınızı ve benzersiz Bundle Identifier seçin. Bu proje iPhone ve iPad ailesini birlikte hedefler. Bu yol, `native/iphone` içindeki eski kişisel kabuktan farklıdır; uygulama arayüzünü yerel olarak paketler. Mevcut kişisel uygulamanın üstüne kurmayın: kayıtlar otomatik taşınmaz.

## Masaüstü dağıtımı

Windows paketini Windows'ta, Linux paketini Linux'ta, Mac paketini Mac'te üretin. Windows yapılandırmasında x64 ve ARM64, Mac'te universal hedefi bulunur. Paketler `release/` içinde üretilir. Bu komutların bulunması, bütün mimarilerin donanım üzerinde test edildiği anlamına gelmez. İmzalı mağaza sürümleri henüz yoktur.

## Yapılan kontroller

16 Kasım 2026: Ortak web derlemesi, Electron üzerinde ana sayfa stili/açılışı ve yerel kayıt yazımı, Capacitor eşitlemesi ve iPhone/iPad simülatör derlemesi geçti. Üretim npm bağımlılık denetiminde bilinen açık bulunmadı. Windows/Linux paket derlemesi ve Android APK derlemesi henüz doğrulanmadı.

## Özellik sınırları

- Kayıtlar bu cihazın uygulama depolamasındadır. **Cihazlar arası otomatik eşitleme bu sürümde yoktur.** Eski eşitleme betiği ortak pakette devre dışıdır.
- Eski Mac/iPhone Swift köprülerine özel OCR, yerel video oynatıcı, yardımcı karakter/widget, bağlantıdan ürün bilgisi alma ve benzeri işlemler yeni kabuklarda henüz aynı özellik düzeyine getirilmemiştir. Bunları tamamlanmış saymayın.
- Dosya/kamera seçimi, dışa aktarma, seslendirme, tam ekran ve klavye davranışı her cihazda ayrıca test edilmelidir. Bir platformda çalışması diğerinde doğrulama yerine geçmez.
- Uygulamayı kaldırmak kayıtları silebilir; kaldırmadan önce dışa aktarın. Gizli yedek kişisel veriler içerebilir; herkese açık pakete kopyalamayın.

Teknik dayanak: [Electron](https://www.electronjs.org/docs/latest/), [Capacitor kurulumu](https://capacitorjs.com/docs/getting-started), [iOS yapılandırması](https://capacitorjs.com/docs/ios/configuration).
