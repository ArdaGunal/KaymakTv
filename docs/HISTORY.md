# Proje Geçmişi ve Alınan Kararlar

Bu dosya, projenin geliştirme sürecinde denenen, yanılan ve başarıyla uygulanan önemli dönüm noktalarını listeler. Hata alındığında nedenini anlamak için başvurulacak ilk kaynaktır.

## 1. Expo SDK ve DOMException Krizi
**Sorun:** Projenin başında UI bileşenleri React 19 ve Expo Router ile çakıştığı için sayfa geçişlerinde "DOMException" hatası alınıyordu.
**Çözüm:** Eski proje tamamen dondurulup `temp_app` adında **Expo SDK 54** kullanan tertemiz bir iskelet yaratıldı. Tüm dosyalar manuel olarak yeni iskelete taşındı ve paket sürümleri (React 18.x) ile stabilite sağlandı.

## 2. Trakt API OAuth (Kullanıcı Girişi) Yöntemi
**Deneme:** Normal web üzerinden OAuth ile (WebView) token almayı denemek.
**Sorun:** Expo Router'ın Deep Linking (Uygulamaya geri dönme) yapısının oldukça karmaşık ve hata vermeye müsait olması.
**Çözüm:** WebView'dan vazgeçilip, Trakt'ın TV cihazları için sunduğu **Device Code Flow (Cihaz Kodu)** yöntemi uygulandı. Kullanıcıya 8 haneli şık bir kod (Örn: `1B3F5D6C`) verildi, bunu kopyalayıp web'de girmesi istendi. Arka planda (`setInterval`) 5 saniyede bir token sorgulanarak pürüzsüz bir giriş yapıldı. *(Not: Bu sistem daha sonra 14. Madde ile değiştirilmiştir).*

## 3. Sayfa Yönlendirme (Router) Kilitlenmesi
**Sorun:** Kullanıcılar giriş yapmadığında veya çıkış yaptıklarında otomatik olarak "Ayarlar" sayfasına atılıyordu. Ancak giriş yaptıktan sonra da Ayarlar sayfasına manuel gitmek istediklerinde `_layout.tsx` onları zorla geri atıyordu.
**Çözüm:** `_layout.tsx` dosyasındaki "giriş yapılıysa zorla tabs'e yönlendir" engeli tamamen kaldırıldı. Kullanıcıya özgür dolaşım hakkı tanındı.

## 4. Sezon ve Bölüm (S01 | E01) Bilgilerinin Kaybolması
**Sorun:** Trakt API'nin `sync/watched/shows` adresi (İzlenen Diziler listesi) eskiden tüm sezonları verirken, performans optimizasyonu yüzünden bu detayları vermeyi kesti. Ekranda rastgele "Sezon 141" veya zorunlu "141 BÖLÜM İZLENDİ" gibi çirkin yazılar belirdi.
**Çözüm:** `watched/shows` endpoint'i tamamen iptal edilerek `sync/history/episodes` (Son İzlenen Geçmişi) adresine geçildi. Böylece SXX | EXX tasarımı korundu ve ek olarak bölümlerin gerçek İngilizce/Türkçe adları da tasarıma dahil edildi.

## 5. Binge-Watch ve Sayfalama (Pagination) Kaybı
**Sorun:** `history/episodes` varsayılan olarak son 10 işlemi çekiyordu. Kullanıcı bir diziyi peş peşe 8 bölüm izlediyse, ekrana sadece o dizi ve 2 eski dizi (Toplam 3 dizi) düşüyordu. Diğer diziler kayboluyordu.
**Çözüm:** Trakt servisine giden isteğe `?limit=1000` eklendi. API sınırları zorlanarak kullanıcının son 1000 bölümü tek hamlede çekildi. Aynı dizilerin kopyaları elendi (`Set` ve filtrelme kullanılarak) ve ekrana kalabalık bir dizi listesi sunuldu.

## 6. TMDB API ve Dizi Afişleri (Keyless / BYOK Tartışması)
**Sorun:** Trakt API'nin resim (afiş) sağlamaması üzerine TMDB API kullanılmak istendi. Ancak her son kullanıcının kendi TMDB anahtarını alması uygulamanın vizyonuna ve pratikliğine aykırıydı.
**Çözüm:** Kullanıcıların hiçbir API anahtarı girmemesi için "Tek bir Geliştirici TMDB Anahtarı" (Developer Key) kullanılması kararlaştırıldı. Anahtar `.env` dosyasına gömülüp GitHub'dan gizlendi (`.gitignore`). Afişleri sürekli TMDB'den çekip limiti doldurmamak için `services/tmdbApi.ts` içerisinde in-memory (hafıza içi) önbellek (cache) sistemi kuruldu.

## 7. "İzledim" Butonu ve Two-Way Sync (Çift Yönlü Senkronizasyon)
**Aksiyon:** Ana sayfa kartlarındaki "Check" (Tik) butonuna basıldığında o bölümün geçmişe eklenmesi istendi.
**Çözüm:** `POST /sync/history` uç noktasına dizinin ID, Sezon ve Bölüm numaralarıyla birlikte veri gönderen `addEpisodeToHistory` servisi yazıldı. Kullanıcı deneyimini güçlendirmek için butona tıklandığında dönen bir `ActivityIndicator` (yükleme çarkı) konuldu, işlem başarılı olunca kartın arka planı yeşil, buton ise canlı yeşile dönerek S01|E01 yazısı "BÖLÜM İZLENDİ" olarak güncellendi. İnternet veya API hatası olduğunda kullanıcıya Alert ile bildirim yapılması sağlandı.

## 8. Dinamik Kart ve Konfeti Kutlaması
**Sorun:** Kullanıcı bir bölümü işaretlediğinde Trakt güncelleniyor ancak arayüz eski (history) verisini göstermeye devam ediyordu.
**Çözüm:** `traktApi.ts` dosyasına `getShowProgress` servisi eklendi. Ana sayfa (`index.tsx`) ve kart (`EpisodeCard.js`) güncellenerek son izlenen değil, "Sıradaki (Up Next)" bölümün gösterilmesi sağlandı. Dizi bittiğinde ana sayfada patlayan bir konfeti (`react-native-confetti-cannon`) animasyonu eklendi. "BÖLÜM İZLENDİ" yazısının bekleme süresi daha akıcı bir deneyim için 1 saniyeye düşürüldü.

## 9. API Önbellek (Cache) ve Sonsuz Döngü Hatalarının Çözümü
**Sorun 1 (Trakt Caching):** Trakt'ın CDN önbelleğinden kaynaklı veri gecikmeleri yaşanıyordu.
**Çözüm 1:** Tüm GET isteklerine `cb=${Date.now()}` eklendi.
**Sorun 2 (Sonsuz Döngü):** Kullanıcının anahtarları kaydetmeden direkt Trakt giriş kodunu alması durumunda `_layout.tsx` tarafından anahtarlar bulunamadığı için geri fırlatılması engellenemedi.
**Çözüm 2:** `settings.tsx` içinde "Trakt'a Giriş Yap" butonuna otomatik `saveKeys` entegrasyonu yapıldı.

## 10. Ayarlar Sayfası Yardım Ekranı ve Uygulama İkonu Düzeltmesi
**Aksiyon 1 (Yardım Modalı):** Kullanıcıların API Client ID ve Secret almalarını kolaylaştırmak için `settings.tsx` içerisine "Anahtarlarımı nereden alabilirim?" isimli detaylı bir Modal (Açılır Pencere) eklendi. `expo-clipboard` ile eski proje adı ve `tvtaym://auth` scheme metnini kopyalama özelliği sağlandı *(not: proje daha sonra KaymakTV olarak yeniden adlandırıldı, bkz. Madde 21)*.
**Aksiyon 2 (Uygulama İkonu):** Eski projelerden kalan icon kalıntıları (ES101) düzeltilerek ana dizindeki doğru `logo.png`, `assets/icon.png` olarak kopyalandı ve `app.json` dosyasına işlendi.

## 11. Merkezi Beyin (LibraryContext) ve Önbellek Mimarisi
**Sorun:** Her sayfa geçişinde Trakt ve TMDB API'lerine tekrar tekrar istek atılması, uygulamanın yavaşlamasına ve API Limitlerine takılmasına neden oluyordu.
**Çözüm:** `context/LibraryContext.tsx` oluşturularak tüm kullanıcı ilerlemesi (showProgressMap) RAM üzerinde tutuldu. Sık kullanılan Dizi afişleri (`@tmdb_cache`), Bölüm görselleri (`@tmdb_still_cache`) ve Dizi detayları (`@show_detail`) `AsyncStorage` ile kalıcı önbelleğe (Cache) alındı.

## 12. Dizi ve Bölüm Detay Ekranları (Show & Episode Detail)
**Aksiyon:** Ana sayfa kartlarına basıldığında dizinin tüm detaylarının, kadrosunun, özetinin ve bölüm listelerinin görüleceği bir yapı kuruldu.
**Çözüm:** `app/show/[id].tsx` rotasıyla Dizi detay ekranı kodlandı. "Sezonu Tümden İzledim" (Bulk Sync) özelliği eklendi. Ana sayfadaki bölüm satırlarına basıldığında direkt bölüm detaylarına giden `app/episode/[id].tsx` sayfası eklendi. Modern yorum arayüzü, Trakt WebView (Tüm Kadroyu Gör) Modalı ve spoiler koruma sistemi bu sayfalara entegre edildi.

## 13. Akıllı "Atlanan Bölümleri Doldur" (Catch-up) Sistemi
**Sorun:** Kullanıcı 3. bölümdeyken yanlışlıkla gidip 5. bölümü işaretlediğinde aradaki bölümler (4. bölüm) Trakt üzerinde işaretlenmeden atlanmış oluyordu.
**Çözüm:** `EpisodeCheckButton` bileşenine akıllı bir uyarı (`Alert`) eklendi. Eğer işaretlenen bölüm ile kullanıcının kaldığı bölüm arasında fark varsa, kullanıcıya "Aradaki X bölümü de izlendi olarak işaretleyelim mi?" diye soran ve onay durumunda tümünü tek bir istekle (`addEpisodesBulkToHistory`) tamamlayan bir mekanizma kuruldu.

## 14. Kimlik Doğrulama Zirvesi: OAuth 2.0 ve Netlify Serverless Geçişi (BFF)
**Sorun:** Device Code Flow (Cihaz Kodu ile giriş) yöntemi, kullanıcılara manuel kopyala-yapıştır yaptırdığı için çok kötü bir UX (Kullanıcı Deneyimi) sunuyordu. Uygulamanın Google Play seviyesinde bir profesyonellik hissi vermesi için "Tek Tıkla Giriş" gerekiyordu. Ancak Trakt'ın istediği `Client Secret` bilgisinin direkt mobil uygulama (.apk) içine gömülmesi güvenlik açığı yaratacaktı (BYOK mimarisi zayıflığı).
**Çözüm:** "Backend For Frontend" (BFF) mimarisine geçildi.
1. Mobil uygulamada cihaz kodundan vazgeçilip, `expo-auth-session` kullanılarak **OAuth 2.0 Authorization Code Flow** entegre edildi. Kullanıcı In-App Browser üzerinden uygulamadan çıkmadan güvenle Trakt onayı verip geri dönüyor.
2. Mobil uygulamada Client Secret gizlemek yerine, tamamen ücretsiz ve sunucusuz olan **Netlify Functions** (`netlify/functions/trakt-auth.js`) proxy olarak kuruldu.
3. Uygulama yetki kodunu Netlify'a atıyor, Netlify sadece kendi bildiği Secret ile kodu Access Token'a çevirip uygulamaya geri veriyor. BYOK dönemi tamamen bitirildi ve mimari kurumsallaştı.
4. **Hata 1 (401 Sonsuz Döngüsü):** Eski "Device Code" token'ı cihazda kalınca `_layout.tsx` bunu geçerli sanıp 401 hatası fırlatan sayfalara girmeye çalıştı ve sonsuz hata döngüsü oluştu. `traktApi.ts` içerisine **Axios Interceptor** eklenerek 401 döndüğü an cihazın SecureStore hafızasındaki bozuk token'ı silmesi sağlandı.
5. **Hata 2 (invalid_redirect_uri):** Expo Go, Trakt'a `exp://` ile başlayan rastgele bir test adresi yolladığı için Trakt bunu reddediyordu. Çözüm olarak ekrana "Geliştirici Notu" eklendi ve anlık `exp://` adresinin alınıp Trakt paneline eklenmesi sağlandı.
6. **Hata 3 (Unmatched route):** `expo-auth-session` geriye döndüğünde Expo Router `/auth` diye bir sayfa bulamadığı için "Page could not be found" diyerek siyah ekrana düşüyordu. Geri dönüş adresi (path) `auth` yerine zaten var olan `settings` olarak değiştirildi.
7. **Hata 4 (Missing code_verifier / PKCE):** `expo-auth-session` varsayılan olarak ekstra güvenlik (PKCE) isteği yolluyordu ancak Netlify proxy'miz Trakt'a Token sorarken bu kodu göndermediği için Trakt 400 Bad Request veriyordu. `useAuthRequest` içerisine `usePKCE: false` ayarı eklenerek bu uyumsuzluk tamamen yok edildi.
8. **⚠️ Regresyon (2026-07-18 denetiminde tespit edildi):** Bu maddede kurulan Netlify Functions proxy'si repodan kaybolmuş; `services/api/auth.ts` şu anda `Client Secret`'ı tekrar `EXPO_PUBLIC_TRAKT_CLIENT_SECRET` ile doğrudan istemciye gömüyor. Yani madde 14'ün çözmeye çalıştığı güvenlik açığı şu anda **tekrar aktif**. Detay ve önerilen çözüm için bkz. `docs/ARCHITECTURE.md` Bölüm 4.

## 15. Web Platformu 1 Dakikalık Yüklenme (Donma) Krizinin Çözümü
**Sorun:** Uygulama mobil platformlarda anında açılırken, Web tarayıcısında (PWA/Desktop) beyaz bir "Skeleton (İskelet)" ekranında ortalama 1 dakika boyunca takılı kalıyordu.
**Çözüm:** Sorunun iki farklı darboğazdan (bottleneck) kaynaklandığı tespit edildi:
1. **Tarayıcı Bağlantı Limiti:** Web tarayıcıları aynı anda maksimum 6 adet TCP/HTTP bağlantısına izin verir. Ancak `tmdbApi.ts`, 100 farklı dizinin afişi için aynı anda Netlify Proxy'ye ping atıyordu. Tarayıcı tüm resimleri yükleyene kadar kuyruğu bloke ediyor ve uygulamanın geri kalan asenkron işlemlerini donduruyordu. Bu durumu çözmek için Web'de resimlerin sadece ekrana girince (Lazy Load) çekilmesi sağlandı ve `SecureStore` (localStorage) kullanılarak resim linkleri kalıcı önbelleğe (Cache) alındı.
2. **InteractionManager Kilidi (Ölümcül Hata):** React Native'in `Animated.loop()` animasyonları Web'de (Native Driver olmadığı için) JavaScript Thread'inde çalışıyordu. `InteractionManager.runAfterInteractions` hook'u, bu iskelet animasyonları döndüğü sürece (bitmedikleri için) asla tetiklenmiyor ve ana veri işleme fonksiyonu (`processData`) sonsuza dek bekliyordu. Tüm loading animasyonlarına `isInteraction: false` bayrağı eklenerek bu kilit kırıldı ve web sürümü saniyesine yüklenebilir hale geldi.

## 16. Kırmızı Çizgi Kuralı ve Netflix Tarzı Masaüstü Arayüzü (Platform Splitting)
**Sorun:** Web sürümünde mevcut UI'ın çok geniş, hantal ve mobil ekranın basitçe esnetilmiş bir versiyonu gibi görünmesi.
**Kırmızı Çizgi Kuralı:** Kusursuz çalışan mevcut mobil (`.tsx`) dosyalarının hiçbir şekilde değiştirilmemesi gerekiyordu.
**Çözüm:** React Native ve Expo Metro bundler'ın sunduğu **Platform Splitting** özelliği kullanılarak tüm tasarım baştan yazıldı.
- Sadece `index.web.tsx`, `movies.web.tsx`, `EpisodeCard.web.tsx` ve `MovieCard.web.tsx` gibi Web'e özel (`.web`) dosyalar oluşturuldu.
- Dikey akordeonlar yerine, Netflix benzeri 1200px maksimum genişliğe sahip yatay bantlar (Horizontal Carousel) entegre edildi.
- Afişlere modern hover animasyonları (Scale %105, Drop Shadow ve Gradient bilgi kutusu) eklendi.
- Mobil UI (Kodları) %100 oranında güvenle korundu.

## 17. TBA (Yayınlanmayan Bölüm) Düzeltmesi ve Performans Artışı (Refactoring)
**Sorun:** Yayınlanmayan bölümler için TBA gösterimi sırasında, Trakt veritabanında eski bölümlerin tarihlerinin null gelmesi sebebiyle yayınlanmış eski bölümler de TBA (Kilitli) olarak kalıyordu. Ayrıca `show/[id].tsx` içindeki render döngüsünde `Array.find` kullanımı nedeniyle performans darboğazı yaşanıyordu.
**Çözüm:**
1. TBA sorunu, Trakt'tan gelen `season.aired_episodes` verisinin saklanıp, bölüm sırasına göre hesaplama yapılmasıyla çözüldü. Tarih eksiği olsa bile `aired_episodes` sayısından küçük/eşit olanlar yayınlanmış kabul edildi.
2. Yaklaşanlar sekmesindeki ve bölüm içi TBA/Sayaç mantığı için DateHelper içindeki `getDateGroup` güncellenerek çoklu dil desteği (i18n `t` fonksiyonu) eklendi.
3. Performans krizini çözmek için uygulamanın en karmaşık sayfaları (`show/[id].tsx` ve `episode/[id].tsx`) tamamen modüler hale getirildi.
4. Veri çekme ve state yönetimleri `hooks/useShowDetail.ts` ve `hooks/useEpisodeDetail.ts` içerisine soyutlandı. Render anındaki ağır işlemler `useMemo` içine alınarak sızmalar önlendi.
5. `utils/cacheManager.ts` oluşturularak AsyncStorage kotaları ve Garbage Collection işlemleri merkezileştirildi. Kodlardaki tüm spagetti (IIFE) yapıları temizlenerek sistem stabilitesi sağlandı.

## 18. Gelişmiş Özel Listeler (Custom Lists) ve Çoklu Platform UX
**Sorun:** Kullanıcılar standart İzleme Listesi dışında kişisel listeler (örn. "Hafta Sonu Filmleri") oluşturmak istiyordu. Ancak Trakt'taki karışık liste (hem film hem dizi) yapısı mobil arayüzümüzde çöküyor veya çirkin görünüyordu. Ayrıca "Listeler" carouseli web'de bozuk (sıkışık) görünüyordu.
**Çözüm:**
1. **Trakt Liste Senkronizasyonu:** Kullanıcıların kendi oluşturduğu tüm listeler (`getCustomLists` ve `getCustomListItems`) sisteme entegre edildi. İçerisinde hem dizi hem film barındıran listeler için (Mixed Media) arayüzde polimorfik (çok biçimli) render mantığı kuruldu (Örn: type'a göre Film veya Dizi kartı gösterimi).
2. **"Beğenilenler" Özel Mantığı:** Trakt'ta listeler tamamen silinebilirken, "Beğenilen Diziler" (Favorites) gibi kök listelerin kaza sonucu silinmemesi için detay sayfasında (ListDetailsScreen) özel koruma/gizleme kuralı yazıldı.
3. **Responsive Liste Detay Ekranı:** Mobil sürümde tam ekran (Edge-to-Edge) harika görünen dikey liste ekranı, geniş ekranlı (Web) platformlarda devasa çirkin bir boyuta ulaşmasın diye, Twitter/Reddit feed benzeri **Merkezlenmiş Kolon (max-width: 800px)** tasarımı ile sarmalandı. Böylece tek kod iki platformda lüks ve kusursuz görünüme ulaştı.
4. **ListCard.web.tsx Düzenlemesi:** Yatay (Horizontal) Scroll içinde `%100` genişlik verilmesi sonucu ezilen kartlar, `width: 180` kare (Spotify vari) boyutlarla sabitlenerek carousel sorunu kökünden çözüldü.
5. **Akıllı "ListPlus" Butonu:** Dizi afişlerindeki liste butonuna dinamik görevler atandı. Masaüstünde sadece menü açarken; Mobilde **kısa basıldığında direkt "İzleme Listesi"ne (Watchlist)** atıyor, **uzun (400ms) basıldığında Özel Listeler Modalı** açılıyor. Tam bir power-user (gelişmiş kullanıcı) deneyimi sağlandı.

## 19. Yeni "Premium" Karşılama Ekranı (Landing Page) ve Dinamik Yönlendirme (Routing) Revizyonu
**Sorun:** Uygulamanın açılış sayfası sadece basit bir Giriş/Kayıt butonundan oluşuyordu ve kullanıcılara uygulamanın özelliklerini (İstatistikler, Topluluk vb.) anlatan "Premium" hissiyatlı bir vitrin (Landing Page) eksikti. Ayrıca web tarafında (PWA) kullanılmak istenen HTML/CSS tabanlı şık bir tasarım, Expo Router'ın mobil yönlendirme mantığı ile çakışıyordu.
**Çözüm:**
1. **Route Groups Ayrımı:** Expo Router'ın yetenekleri kullanılarak klasör yapısı `(public)` ve `(protected)` olmak üzere iki ana gruba ayrıldı. Giriş yapmamış kullanıcılar sadece public sayfalarda gezinirken, giriş yapanlar protected (Korumalı) sayfalara (sekme çubuğu olan `(tabs)`) yönlendirildi.
2. **Platforma Özel Bileşen (Platform Splitting):** Kullanıcının elinde var olan ve çok karmaşık CSS özellikleri (`@keyframes`, `mask-image`, `IntersectionObserver`) kullanan muhteşem HTML tasarımı, sadece web tarayıcılarında çalışması için `index.web.tsx` dosyasına tamamen uyarlandı.
3. **Temaya Uygunluk:** Gelen tasarım HTML'i kırmızı (Rose) ve sarı renkler barındırıyordu. Bu durum KaymakTV'nin orijinal "Gece Mavisi ve Parlak Mavi" (Midnight Navy & Blue) konseptine uymuyordu. CSS değişkenleri (`--bg`, `--gold`) ve mobil platform (iOS/Android) için kullanılan `HeroSection`, `BentoGrid` gibi bileşenlerdeki renkler tamamen projenin asıl temasına (Lacivert/Mavi) güncellendi.
4. **Auth Döngüsü ve "No Fallback Sibling" Hatasının Çözümü:** Expo Router'da bir public klasöründe `index.tsx` varken, protected `(tabs)` klasörü içinde de `index.tsx` (diziler ekranı) bulunması, Expo Web üzerinde "Infinite Redirect" (Sonsuz yönlendirme) ve "No fallback sibling" çökmelerine neden oldu. Bu çakışmayı önlemek için `(tabs)/index.tsx` dosyasının adı `shows.tsx` olarak değiştirildi. Trakt Auth sonrası dönülen redirect adresi `settings` olarak güncellenerek giriş sürecindeki tüm pürüzler giderildi.

## 20. "God Context"in Parçalanması ve Zustand'a Geçiş
**Sorun:** `context/LibraryContext.tsx` dosyası zamanla 1100 satıra ulaşarak bir "God Context" (her işi yapan devasa yapı) haline gelmişti. Tüm API istekleri, senkronizasyon mantığı ve UI state'i aynı dosyada birleşmişti. Bu durum uygulamanın sürdürülebilirliğini (maintainability) yok ediyor, spagetti kodlara sebep oluyor ve herhangi bir küçük state değişiminde tüm ekranların (useLibrary kullanan 17 farklı sayfanın) gereksiz yere yeniden render edilmesine (UI donmalarına) kapı aralıyordu.
**Çözüm:**
1. **Veri Katmanının Ayrılması (Zustand):** Projeye yüksek performanslı global state yönetim kütüphanesi olan Zustand dahil edildi. Tek parça olan veriler `store/slices/` altında mantıksal dilimlere (History, Watchlist, Favorites, Lists, Calendar, Ratings) bölündü.
2. **Mantık Katmanının Ayrılması (Services):** Context içindeki tüm API çağırma ve önbellek (AsyncStorage) kaydetme operasyonları `services/libraryService.ts` adında bağımsız bir servis dosyasına taşındı.
3. **Sıfır Riskli Entegrasyon (Proxy Hook):** 17 farklı ekran dosyasında aynı anda değişiklik yapıp sözdizimi (syntax) hatalarına veya Expo çökmelerine yol açmamak için akıllı bir yöntem kullanıldı. Eski `LibraryContext.tsx` dosyası silinmedi; bunun yerine sadece Zustand ve Servisleri birbirine bağlayıp geriye döndüren "hafif bir Proxy (Köprü) Hook"a dönüştürüldü. Böylece uygulamadaki tek bir sayfa bile değiştirilmeden yeni kusursuz mimariye geçiş sıfır hata ile tamamlandı. İlave performans istendiğinde sayfalar özelinde seçici aboneliğe (selective subscription) geçme altyapısı hazırlandı.

## 21. "God Object" TraktApi'nin Modüler Servislere Bölünmesi
**Sorun:** `services/traktApi.ts` dosyası 953 satıra ulaşarak `axios` bağlantı ayarları, token yenileme mantığı ve onlarca farklı endpoint'i (Shows, Movies, Users, vb.) aynı anda barındıran devasa bir dosyaya dönüşmüştü.
**Çözüm:**
1. **API Klasörlemesi:** `services/api/` dizini oluşturuldu.
2. **Bağlantı İzolasyonu:** Axios nesnesi ve token tazeleyen (queue) interceptor yapıları tamamen `traktClient.ts` dosyasına taşındı.
3. **Endpoint Modülerizasyonu:** API istekleri özelliklerine göre klasörlendi: `auth.ts`, `shows.ts`, `movies.ts`, `users.ts`, `comments.ts`, `search.ts`.
4. **Sıfır Risk Yönlendirici (Barrel File):** Uygulamadaki onlarca sayfanın importlarını değiştirmemek için eski `services/traktApi.ts` dosyası silinmedi, bir yönlendirici (Barrel File) haline getirildi (`export * from './api/shows'` vb.). TypeScript derleyicisi ile (tsc) 0 hata alınarak modülerizasyon başarıyla tamamlandı.

## 22. UI ve İş Mantığı İzolasyonu: `MediaHero.tsx` Sadeleştirilmesi
**Sorun:** Dizi/Film detay ekranlarındaki üst barı (hero) oluşturan `MediaHero.tsx` dosyası 680 satıra ulaşmıştı. Sadece arayüz çizmesi gereken bu bileşen, içerisine Puanlama Modalı, Seçenekler Modalı ve Paylaşma gibi onlarca iş mantığı eklenince okunmaz hale gelmişti.
**Çözüm:** UI ile Logic ayrıldı. Modallar (`RatingModal` ve `OptionsModal`) bağımsız bileşenler olarak `components/modals/` içerisine taşındı. `formatRuntime` gibi yardımcı fonksiyonlar `utils/formatters.ts` dosyasına ayrıldı. `MediaHero.tsx` 680 satırdan 469 satıra düşürülerek temiz bir arayüz bileşenine dönüştürüldü.

## 23. Ekran Bileşenlerinin (Screens) Modülerleştirilmesi
**Sorun:** `app/show/[id].tsx` ve `app/movie/[id].tsx` gibi ana ekran bileşenleri 500-600 satırlara ulaşarak veriyi çekme, state yönetme ve tüm modalları içlerinde render etme sorumluluğunu üstlenmişlerdi (Spagetti).
**Çözüm:**
1. **Veri Çekme (Data Fetching):** `app/movie/[id].tsx` içerisindeki tüm Trakt/TMDB çağrıları sökülerek `hooks/useMovieDetail.ts` içerisine taşındı. Böylece UI ile Veri ayrılmış oldu.
2. **Modalların Çıkarılması:** `app/show/[id].tsx` sayfasındaki devasa satır içi modallar, `components/modals/EpisodeOptionsModal.tsx` ve `EpisodeRatingModal.tsx` olarak izole edildi.
3. Sonuç olarak sayfaların satır sayıları %30-40 oranında küçüldü. Artık ekran dosyaları sadece veri bağlama ve ana bileşenleri çizme işlevine odaklı.

## 24. Doküman Temizliği ve Çakışma (Conflict) Kayıtlarının Giderilmesi (2026-07-18)
**Sorun:** `AGENTS.md`, `docs/AI_RULES.md`, `docs/ARCHITECTURE.md` ve bu dosya (`docs/HISTORY.md`), PR #1 (`de7e192`, "sertay" dalından) çözülmeden merge edildiği için içlerinde çözülmemiş Git conflict işaretleri (`<<<<<<< HEAD` / `=======` / `>>>>>>>`) barındırıyordu. Ayrıca eski proje adı "TvTaym" birçok yerde "KaymakTV" ile karışık geçiyordu.
**Çözüm:** Dört dosyadaki conflict blokları elle birleştirildi; iki tarafın da içerdiği benzersiz bilgi korunarak tek, tutarlı bir metin oluşturuldu (bu dosyada iki tarafın madde numaraları da birleştirildi: eski taraf 1-19, HEAD tarafı 20-23 olarak devam ettirildi). Aktif kod/dokümanlardaki "TvTaym" referansları "KaymakTV" olarak güncellendi; bu dosyadaki geçmişe ait "TvTaym" anıları (o zamanki gerçek isim olduğu için) olduğu gibi bırakıldı. Bu denetim sırasında ayrıca madde 14'te kurulan Netlify OAuth proxy'sinin repodan kaybolduğu ve `Client Secret`'ın tekrar istemciye gömüldüğü tespit edildi (bkz. madde 14.8 ve `docs/ARCHITECTURE.md` Bölüm 4) — bu bir dokümantasyon değişikliği değil, ayrı ele alınması gereken aktif bir güvenlik regresyonuydu. *(Çözümü için bkz. Madde 25.)*

## 25. Trakt Client Secret Sızıntısının Kapatılması: Express BFF Proxy'ye Geçiş (2026-07-18)
**Sorun:** Madde 24'te tespit edilen regresyon doğrulandı: `services/api/auth.ts`'teki `exchangeAuthCode` ve `services/api/traktClient.ts`'teki 401 refresh-token interceptor'ı, Trakt'ın `/oauth/token` uç noktasını **doğrudan istemciden**, `EXPO_PUBLIC_TRAKT_CLIENT_SECRET` ile çağırıyordu. Expo'da `EXPO_PUBLIC_` önekli her değişken build sırasında JS bundle'ına gömüldüğü için, Client Secret uygulamayı indiren/inceleyen herkes tarafından çıkarılabilir durumdaydı — iki ayrı kod yolunda (kod değişimi ve token yenileme) aynı sızıntı vardı.
**Çözüm:**
1. **Keşif:** `server.js`'te zaten çalışan, ama frontend tarafından hiç kullanılmayan bir `POST /api/trakt` uç noktası bulundu (muhtemelen daha önceki bir "Migrate to Express Backend" çalışmasından kalma, `.env`'deki kullanılmayan `EXPO_PUBLIC_PROXY_URL` de bunu doğruluyordu). Bu uç nokta zaten hem `authorization_code` hem `refresh_token` grant tiplerini destekliyordu — sıfırdan yeni bir endpoint kurmak yerine bu genişletildi.
2. **Sunucu Sertleştirmesi:** `server.js`'teki `clientSecret` ataması `process.env.TRAKT_CLIENT_SECRET || process.env.EXPO_PUBLIC_TRAKT_CLIENT_SECRET` idi — bu satırdaki `EXPO_PUBLIC_` fallback'i tamamen kaldırıldı. Artık yalnızca sunucu-taraflı, öneksiz `TRAKT_CLIENT_SECRET` kabul ediliyor (client_id gizli olmadığı için `EXPO_PUBLIC_TRAKT_CLIENT_ID` fallback'i korundu).
3. **`.env` Düzeltmesi:** `EXPO_PUBLIC_TRAKT_CLIENT_SECRET` satırı silindi, aynı değer öneksiz `TRAKT_CLIENT_SECRET` olarak eklendi. Kullanılmayan `EXPO_PUBLIC_PROXY_URL` (sabit LAN IP içeriyordu) yerine `EXPO_PUBLIC_API_URL` (sadece taban adres) tanımlandı.
4. **`services/api/auth.ts`:** `exchangeAuthCode` artık Trakt'ı değil, `/api/trakt` proxy'sini çağırıyor (`TMDB_PROXY_URL` ile aynı desen: `EXPO_PUBLIC_API_URL` tanımlıysa mutlak adres, yoksa göreli `/api/trakt` — Web'de aynı origin'den servis edildiği için sorun çıkmıyor). Ayrıca `traktClient.ts`'in de kullanacağı yeni bir `refreshTraktToken` fonksiyonu eklendi.
5. **`services/api/traktClient.ts`:** 401 interceptor'ındaki doğrudan `axios.post('https://api.trakt.tv/oauth/token', ...)` çağrısı ve `client_id`/`client_secret` okuma satırları tamamen kaldırıldı; yerine `refreshTraktToken` çağrısı geçti. Bu iki dosya arasındaki dairesel import riski de ortadan kalktı (`auth.ts`'in kullanılmayan `getTraktClient` importu zaten dead code'du, silindi).
6. **Doğrulama:** `tsc --noEmit` 0 hata, `node -c server.js` sözdizimi kontrolü geçti, repo genelinde `EXPO_PUBLIC_TRAKT_CLIENT_SECRET` referansı kalmadığı grep ile doğrulandı.
