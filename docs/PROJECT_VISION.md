# KaymakTV Proje Vizyonu ve Çıkış Noktası

Bu dosya, uygulamanın ruhunu, tasarım felsefesini ve neden geliştirildiğini hatırlatmak amacıyla yapay zeka (Antigravity) tarafından oluşturulmuştur. Geliştirme sürecindeki tüm kararlar bu vizyona sadık kalınarak alınacaktır.

## Arka Plan Hikayesi
- Dünyanın en popüler dizi/film takip platformlarından biri olan **TV Time**'ın kapanma kararı alması üzerine, yılların alışkanlığı ve devasa veri arşivi tehlikeye girmiştir.
- Kullanıcı verilerini (zip) dışa aktararak API desteği olan tek makul alternatif **Trakt.tv**'ye taşımıştır.
- Ancak Trakt'ın arayüzünün karmaşık, hantal ve kullanıcı deneyimi açısından TV Time'ın çok gerisinde olması yeni bir ihtiyacı doğurmuştur.

## Projenin Amacı
Trakt'ın o devasa ve güvenilir veritabanı (API) altyapısını kullanarak, **TV Time'ın kusursuz, karanlık ve akıcı arayüzünü (UI/UX) yeniden yaratmak.** Uygulama sadece geliştirici için değil, aynı durumdaki arkadaş çevresi için de bir "kaçış noktası" olacaktır.

## Temel Tasarım ve Mimari Felsefesi
1. **Merkezi Kimlik Doğrulama (OAuth 2.0 & Sunucu Taraflı Proxy):** Google Play standartlarında kullanıcı deneyimi sunabilmek için eski sistem terk edilmiştir. Uygulama In-App Browser üzerinden "Tek Tıkla Giriş" yapmayı sağlayan sektör standardı bir yetkilendirme (Authorization Code) mimarisi kullanır. Sunucu tarafı gizli anahtarlar bir proxy (örn. Netlify Functions) üzerinde saklanmalıdır — *(2026-07-18 denetim notu: bu proxy şu anki kod tabanında mevcut değil, Client Secret geçici olarak istemciye gömülü durumda; bkz. `docs/ARCHITECTURE.md` Bölüm 4)*.
2. **TV Time Nostaljisi:** Siyah ağırlıklı tema, dizilerin yatay kaydırmalı (Horizontal) olarak sunulması, izlendi (Check) butonunun hissiyatı, profil sayfasının akıllı kategorizasyonu gibi UI detayları doğrudan TV Time deneyimini yansıtmalıdır.
3. **Modülerlik:** Yapılan her değişiklik adım adım, test edilerek ve temiz (modüler) bileşenler halinde projeye entegre edilir.
4. **Offline ve Hızlı:** API istekleri önbelleklenerek (cache) ve chunking (gruplama) yöntemleriyle API sınırlarını zorlamayacak/boğmayacak şekilde tasarlanır.

## Eski Sistem Tarihçesi (Hata Tespiti İçin Saklanmaktadır)
**BYOK (Bring Your Own Key) Dönemi:**
- **Nasıl Çalışıyordu?:** Uygulama hiçbir merkezi sunucu kullanmadan çalışıyordu. Kullanıcı, Ayarlar sayfasında kendi "Trakt Client ID" ve "Client Secret" kodlarını manuel giriyordu. Trakt yetkisi almak için "Device Code" (cihaz kodu) adı verilen 8 haneli bir kod ekrana yansıtılıyor, kullanıcı bunu tarayıcıya manuel girerek yetki alıyordu.
- **Neden Terk Edildi?:** UX açısından (özellikle mobil uygulama standartlarında) çok ilkel bir deneyimdi ve Google Play'de yayınlanacak bir kalite hissiyatını zedeliyordu. Arayüzün sadeleşmesi ve "Tek Tıkla" girişin sağlanması için bu eski "manuel kod girme" yapısı Netlify ve `expo-auth-session` ile değiştirildi.
- **Kalıntılar:** Eğer kodun herhangi bir yerinde `clientId`'nin `AuthContext`'ten alınarak giriş doğrulaması yapıldığını veya `pollDeviceToken` / `generateDeviceCode` fonksiyonlarını görürseniz, bunlar BYOK döneminin spagetti kalıntılarıdır ve silinmelidir.

*Not: "Eğer bir karar aşamasında kalırsan, TV Time olsaydı nasıl yapardı diye düşün."*
