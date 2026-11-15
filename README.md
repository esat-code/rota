# Rota

Kişisel çalışma alanı, YKS planlama, takvim, spor, Rusça sözlük ve alım planlama kaynakları.

## Başlat

Node.js 22+, npm ve Python 3 gerekir.

```sh
npm install
npm run build
npm start
```

http://localhost:8080 adresini açın. İlk açılışta parola istenmez. İsteğe bağlı yerel parola ayarlardan etkinleştirilir. Kayıtlar bu cihazın tarayıcı depolamasında tutulur; tarayıcı verilerini temizlemeden önce dışa aktarın.

## Dosyalar

- `web/hafizlik-takip`: serbest düzenlenen çalışma tahtası ve YKS.
- `web/home-atmosphere-preview/dist`: ana sayfa kaynakları.
- `web/event-manager-preview`: takvim.
- `web/rota-spor-preview`: spor.
- `native/desktop`: Mac Swift kaynakları.
- `native/iphone`: iPhone Xcode projesi.
- `native/shared`: ortak yerel özellikler.
- `native/shopping`: alım planı.

## Mac ve iPhone

Xcode gereklidir. iPhone projesini `native/iphone/Rota.xcodeproj` üzerinden açın, kendi Team hesabınızı ve benzersiz Bundle Identifier seçin. Fiziksel cihazda geliştirici modunu açıp Run kullanın. Apple imzalama ve dağıtım şartları hesabınıza bağlıdır.

**Önemli:** Yerel web sürümü çevrimdışı cihaz kaydıyla çalışır. iPhone kabuğu, kendi kuracağınız HTTPS Rota sunucusunu gerektirir. `YOUR-ROTA-SERVER.example` yerlerini kendi adresinizle değiştirin. Kişisel sunucumuz veya erişimi bu projeye dahil değildir. Cihazlar arası eşitleme bu açık sürümde henüz kullanıma hazır değildir; sunucu kimlik doğrulaması kurulmadan özel kayıtlarınızı internete açmayın.

## Gizlilik

Kişisel kayıtlar, ürün kataloğu, özel ders notları, kişisel hazır kamp planı, erişim anahtarları ve imzalama sertifikaları paylaşılmaz. Gizli yedek ayrı depodadır. Genel örnek çalışma alanını istediğiniz gibi düzenleyin.

## Güncelleme

`git pull` ardından `npm install` ve `npm run build`. Yerel kayıtlar kaynak koddan ayrıdır. Yerel uygulama kabuğu değişikliklerinde Xcode ile yeniden derleyin.
