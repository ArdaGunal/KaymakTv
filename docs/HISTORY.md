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

## 26. Profil İstatistik Vitrini (Hero Stats Card) — Gerçek Trakt Verisiyle
**Hedef:** Profil ekranına, kullanıcının gerçek Trakt istatistiklerini (toplam izleme süresi, izlenen bölüm/film adedi) gösteren Dizi/Film sekmeli bir özet kart eklemek.
**Uygulama:**
1. `services/api/users.ts`'e `GET /users/me/stats` çağıran `getUserStats` eklendi (barrel: `services/traktApi.ts` üzerinden dışa açık).
2. Store'a yeni bir `statsSlice` (`store/slices/statsSlice.ts`, `userStats: { movies, episodes } | null`) eklendi; `services/library/utils.ts`'e `CACHE_KEYS.userStats` ve `setUserStats` setter'ı, `services/library/fetchers.ts`'e ise `loadCache` içinde önbellekten okuma ve `fetchFreshData`'nın "Tier 2" (Filmler sekmesi) `Promise.all` grubuna `getUserStats()` çağrısı işlendi — Tier 1 zaten bilinçli olarak 3 istekle sınırlı tutulduğundan (bkz. yorum), stats isteği oraya değil hafif Tier 2 grubuna eklendi.
3. `utils/watchTimeHelper.ts`: dakikayı Ay/Gün/Saat'e çeviren saf `minutesToWatchDuration` ve en fazla 2 anlamlı birimi birleştiren `formatWatchDuration` yardımcıları — UI'dan bağımsız, birim etiketleri (i18n) dışarıdan parametre olarak veriliyor.
4. `components/profile/ProfileStats.tsx`: izole, kendi verisini `useLibrarySelector(s => s.userStats)` ile okuyan yeni bileşen. Üstte Dizi/Film `SegmentedTabControl` benzeri özel bir sekme, altında glassmorphism/degrade (`expo-linear-gradient`) kart — büyük "Toplam İzleme Süresi", "İzlenen Bölüm/Film" adedi ve boş `onPress`'li "Detaylı Analiz >" butonu. `userStats` henüz gelmediyse (soğuk açılış) hiçbir şey render etmiyor, veri geldiği an belirir.
5. `screens/ProfileMobile.tsx`'te "Listelerim" başlığının hemen üstüne yerleştirildi. Not: masaüstü web varyantı (`profile.web.tsx`) ayrı bir layout kullandığından bu kapsamın dışında bırakıldı; istenirse ayrıca eklenebilir.
6. Sonrasında `components/profile/ProfileStats.tsx`'in mobil tasarımı (sekmeler karta taşındı, tam genişlikte alt bar, ardından Apple tarzı minimal sekme + tek "hero" değer) birkaç turda revize edildi.
7. Detaylı Analiz sayfası eklendi: `app/(protected)/profile/statistics.tsx` → `screens/ProfileStatisticsMobile.tsx`. Veri türetme mantığı `hooks/useProfileStatistics.ts`'e taşındı (özet + "tamamlanma oranı": diziler için `showProgressMap`'ten `completed >= aired` sayımı, filmler için izlenen/izleme listesi oranı). Grafikler için `react-native-gifted-charts` (+ mevcut `react-native-svg` peer bağımlılığı) eklendi; tür dağılımı ve aylık frekans şimdilik `components/profile/stats/mockChartData.ts`'te mock veri (TODO ile işaretli).
   - **Yan etki:** `npm install react-native-gifted-charts` çalıştırılırken `zustand` paketi `package.json`/`package-lock.json`'da hiç kayıtlı olmadığı (yalnızca `node_modules`'te "sahipsiz" duruyordu) ortaya çıktı; npm bunu "extraneous" sayıp temizledi ve tüm store katmanı kırıldı. `npm install zustand` (v5.0.14) ile kalıcı olarak bağımlılıklara işlendi.

## 27. Profil İstatistiklerinin Masaüstü (Web) Sürümü
**Hedef:** Madde 26'daki mobil İstatistik Vitrini ve Detaylı Analiz ekranlarının geniş ekranlara uyarlanmış, yatay Grid/Flex düzenli `.web.tsx` sürümlerini eklemek.
**Kritik mimari tuzak ve çözümü:** `components/profile/ProfileStats.tsx`'e doğrudan bir `ProfileStats.web.tsx` eklemek, projedeki mevcut `EpisodeCard.tsx`/`EpisodeCard.web.tsx`/`EpisodeCardMobile.tsx` deseniyle aynı soruna yol açardı: `screens/ProfileMobile.tsx` hem native uygulama hem de dar ekran web (`profile.web.tsx`'teki `if (!isDesktop) return <ProfileMobile />`) tarafından paylaşıldığından, Metro'nun platform-uzantı çözümlemesi web derlemesinde `ProfileStats` adını her zaman `.web.tsx`'e çevirir — ekran genişliğine bakılmaksızın. Sonuç: dar mobil web görünümünde de yanlışlıkla geniş masaüstü kartı sıkışık biçimde görünürdü. **Çözüm:** Gerçek mobil tasarım `components/profile/ProfileStatsMobile.tsx`'e (platform-uzantısız, çakışmasız isim) taşındı; `ProfileStats.tsx` artık ona yönlenen ince bir re-export (`export { default } from './ProfileStatsMobile'`); `ProfileStats.web.tsx` ise `useResponsive()` ile `isDesktop` kontrolü yapıp dar ekranda yine `<ProfileStatsMobile />`'ı render ediyor — `EpisodeCard.web.tsx`'in `EpisodeCardMobile`'a yaptığının birebir aynısı. Aynı çakışma riskini taşıyan grafik alt bileşenleri (`GenreDonutChart`, `MonthlyFrequencyChart`, `StatsSummaryRow`) için ise platform-uzantı mekanizması hiç kullanılmadı; bunun yerine yalnızca `screens/ProfileStatisticsWeb.tsx` tarafından içe aktarılan, platformdan bağımsız açıkça farklı adlı dosyalar oluşturuldu (`GenreDonutChartWide.tsx`, `MonthlyFrequencyChartWide.tsx`, `StatsSummaryRowWide.tsx`) — hiçbir çakışma riski taşımadan daha basit bir çözüm.
**Uygulama:**
1. `components/profile/ProfileStats.web.tsx`: yatay düzen — sol üstte Dizi/Film sekmesi, ortada dikey ince ayraçlarla bölünmüş 3 sütun (Toplam Süre / Bölüm Sayısı / Film Sayısı — ilk ikisi sekmeye göre, son ikisi her zaman görünür), sağ üstte "Detaylı Analiz'e Git" bağlantısı.
2. `screens/ProfileStatisticsWeb.tsx`: özet kartları üstte 3'lü satır (`StatsSummaryRowWide`), altında `flexDirection: row` ile yan yana Favori Türler (donut, sol) ve Aylık İzleme Frekansı (bar, sağ), en altta tam genişlik `CompletionProgressBar` (paylaşılan, `.web` çakışma riski yok çünkü hiçbir platform-uzantı siblingi yok).
3. `app/(protected)/profile/statistics.web.tsx`: `profile.web.tsx` ile aynı `isDesktop` guard deseni — dar ekranda `ProfileStatisticsMobile`, geniş ekranda `ProfileStatisticsWeb`.
4. `app/(protected)/(tabs)/profile.web.tsx`'e "Listelerim" bölümünün hemen üstüne `<ProfileStats />` eklendi (masaüstü dalı zaten `isDesktop` guard'ının ardında olduğundan doğrudan `.web.tsx` sürümünü render eder).
5. Yeni `detailedAnalysisCta` çeviri anahtarı her iki `media.json`'da zaten mevcuttu, aynen kullanıldı.

## 28. Ayarlar Sayfası: İki Kopya Ekrandan Birine Konsolidasyon + Kayıp Geri Butonu
**Sorun:** Uygulamada aynı işi yapan İKİ farklı, birbirinden habersiz ayarlar ekranı vardı: `app/(protected)/user-settings/index.tsx` (basit: dil + çıkış, eski `#0a0a0a` arka plan rengiyle geri kalan uygulamadan renk olarak da kopuktu) ve `app/(protected)/account.tsx` (daha zengin: Trakt bağla/çöz, hesap/veri silme, `useSettings` hook'u, `SettingsRow` bileşeni). Profil ekranındaki dişli ikonu (`ProfileMobile.tsx`, `profile.web.tsx`) ilk (zayıf) ekrana, web `Sidebar.tsx`'teki "Ayarlar" linki ve `explore.tsx`'teki ikon ise ikinci (zengin) ekrana gidiyordu. `account.tsx` ise `(tabs)` grubunun (ve dolayısıyla onu saran `Sidebar`'ın) DIŞINDA, bağımsız bir route olduğundan ve kendi içinde hiç geri/kapat butonu barındırmadığından — ne mobilde ne webde — kullanıcı oraya girince (özellikle web'de, sidebar da kaybolduğu için) geri çıkacak hiçbir kontrol bulamıyordu.
**Çözüm:**
1. `app/(protected)/account.tsx`'e hem mobil hem masaüstü için çalışan bir geri butonu eklendi (`components/settings/SettingsHeader.tsx`): mobilde yalnızca `ChevronLeft` ikonu, masaüstünde `#1f2937` arka planlı "Geri" etiketli, `cursor:pointer` geçişli bir buton (diğer web ekranlarındaki — `statistics.web.tsx`, `LibraryScreenWeb` vb. — geri butonu deseniyle tutarlı). Buton, "Uygulamaya Git" satırının zaten kullandığı `router.canGoBack() ? router.back() : router.replace('/(protected)/(tabs)/explore')` mantığını paylaşan ortak bir `navigateBack` fonksiyonunu çağırıyor. Bu değişiklik dosyayı 414 satıra çıkarınca (400 satır kuralı), Trakt bağlantı bölümü `components/settings/TraktAccountSection.tsx`'e, `Section`/`SectionDivider` yardımcıları `components/settings/SettingsSection.tsx`'e ayrıştırıldı; `account.tsx` artık 203 satır, sadece orkestrasyon.
2. İki ayrı ayarlar ekranı tutmak yerine `account.tsx` tek/kanonik ayarlar sayfası ilan edildi: `screens/ProfileMobile.tsx` ve `app/(protected)/(tabs)/profile.web.tsx`'teki dişli ikonu artık `/(protected)/account`'a yönleniyor (eskiden `/(protected)/user-settings`). Artık hiçbir yerden referans edilmeyen `app/(protected)/user-settings/` dizini tamamen silindi.
3. `locales/tr|en/common.json`'a yeni `back` anahtarı (`"Geri"` / `"Back"`) eklendi — masaüstü geri butonunun etiketi için.
**Doğrulama:** `tsc --noEmit` yalnızca bu değişiklikten önce de var olan 3 ilgisiz hata veriyor; `user-settings` dizesi için repo genelinde grep artık sıfır sonuç döndürüyor.

## 29. Yapım Sayfası "⋮" Seçenekler Menüsü: Hizalama, Adlandırma, Eksik Onay ve Sessiz Bir Bug
**Sorun:** Dizi/film detay sayfasındaki sağ üst "⋮" menüsünde (`components/modals/OptionsModal.tsx`) dört ayrı sorun tespit edildi:
1. **Hizalama hatası ("kayık yazı"):** "Geçmişten Sil" satırının alt açıklama metni (`removeHistorySub`) kendi `marginLeft`'ine sahip değildi (inline stil kullanılıyordu) — üstteki başlık ikon+16px girintiliyken, alt metin ikonun hemen altından (girintisiz) başlıyor, iki satır birbirine hizasız görünüyordu.
2. **Belirsiz adlandırma:** "Geçmişten Sil" etiketi, aslında ne yaptığını (o yapım için TÜM izleme kayıtlarını sıfırlayıp "izlenmedi" durumuna döndürmek) açıklamıyordu — "geçmişten silmek" kullanıcıya farklı bir şey (örn. arama geçmişi) çağrıştırabilir. `İzleme Geçmişini Sıfırla` olarak yeniden adlandırıldı, alt açıklama da netleştirildi.
3. **Eksik onay:** "İlerlemeyi Gizle" (`onHideFromProgress`) hiçbir onay istemeden anında çalışıyordu; oysa Trakt'ta gizlenen ilerleme uygulama içinden geri getirilemiyor (görünür bir "geri al" akışı yok). "Geçmişten Sil" ile aynı desende bir `Alert.alert` onayı eklendi.
4. **Sessiz bug:** "Gizle" işleminden sonra listeleri tazelemek için çağrılan `fetchFreshData(null, true)` — ikinci parametre `force=true` doğruydu ama BİRİNCİ parametre olarak gerçek erişim jetonu yerine sabit `null` geçiliyordu. `fetchFreshData` jetonu `null` gördüğünde hemen sessizce çıkıyor (bkz. `fetchers.ts` başındaki `if (!accessToken) { ...; return; }`). Sonuç: Trakt'a "gizle" isteği başarıyla gidiyordu ama yerel state/UI hiç yenilenmediği için öğe, bir sonraki doğal senkrona kadar ilerleme/devam-et listesinde görünmeye devam ediyordu. `services/library/mutations/collections.ts`'te `fetchFreshData(currentAccessToken, true)` olarak düzeltildi.
**Ayrıca kontrol edildi, sorun bulunmadı:** İzleme listesine ekle/çıkar (`toggleWatchlistStatus`) — hem bu modaldan hem `ShowCard.tsx`'ten aynı paylaşılan, iyimser-güncellemeli ve hatada geri alan fonksiyonu kullanıyor, doğru id ile eşleşip doğru store diliminde (`watchlistShows`/`watchlistMovies`) güncelliyor; bu dilim de Diziler/Filmler ana sekmelerindeki "İzleme Listesi" bölümünü besliyor. Paylaş ve Tekrar İzle butonlarında da sorun bulunmadı.
**Yan bulgu — ayrıca düzeltildi:** `guestRestrictedMessage` çeviri anahtarı uygulama genelinde 15 farklı yerde `t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.')` şeklinde kullanılıyordu ama `common.json`'ın NE Türkçe NE İngilizce sürümünde hiç tanımlı değildi — her çağrı sessizce ikinci parametredeki (Türkçe) varsayılana düşüyordu, yani İngilizce arayüzde bile bu mesaj hep Türkçe çıkıyordu. Anahtar artık her iki `common.json`'a da eklendi.
**Doğrulama:** `tsc --noEmit` yalnızca önceden var olan 3 ilgisiz hata veriyor; tüm `locales/*/*.json` dosyaları geçerli JSON.

## 30. Sezon Ekranı: Yanlış Anahtarla Asla Yeşilmeyen "Sezon Bitti" Rozeti + Sessiz Tekrar İzleme
**Sorun 1 (asıl şikayet — kök neden bulundu):** `app/show/[id].tsx`'te sezon başlığındaki "tüm sezonu işaretle" rozeti, ilerlemeyi `showProgressMap[id as string]` üzerinden okuyordu. Ama `id`, `useLocalSearchParams()`'tan gelen HAM URL slug'ı (`"12345-dizi-adi"` gibi) — `showProgressMap` ise sayısal Trakt ID'siyle (`traktIdNum`, örn. `12345`) anahtarlanıyor. Bu ikisi asla eşleşmediğinden `seasonProgress` DAİMA `undefined` geliyordu; kullanıcı bir sezonun tüm bölümlerini tek tek izlese bile rozet hiçbir zaman "izlendi" (yeşil) durumuna geçmiyordu — "sezon bitince işaretlenmesi gerekiyor ama işaretlenmiyor" şikayetinin tam kaynağı buydu. Tek satırlık düzeltme: `showProgressMap[traktIdNum]`.
**Sorun 2 (yan etki, aynı yerde bulundu):** Rozetin "izlendi" sayılma koşulu `seasonProgress.completed > 0` idi — yani sezondaki TEK bir bölüm izlense bile rozet yeşile dönüp tek seçenek olarak "tüm sezonu geri al"ı sunuyordu. `components/SeasonAccordion.tsx`'te koşul `completed >= aired && aired > 0` (yayınlanmış TÜM bölümler tamamlanmış) olacak şekilde sıkılaştırıldı; kısmen izlenmiş sezonlarda buton artık normal "kalan bölümleri işaretle" akışına düşüyor.
**Sorun 3 (Tekrar İzle "çalışmıyor gibi"):** Hem bölüm hem film "..." menüsündeki "Tekrar İzle (+1 İzleme)" seçeneği aslında doğru Trakt uç noktasını (`POST /sync/history` — her çağrıda yeni bir "play" ekler) çağırıyordu, yani Trakt tarafında GERÇEKTEN kaydediliyordu. Ama modal kapanmanın dışında HİÇBİR görsel geri bildirim yoktu — bölüm zaten "izlendi" rozetliydi, film zaten "İzledim" butonu aktifti, ikinci bir izlemenin hiçbir görünür etkisi olmuyordu. Bu "çalışmıyor gibi" hissi veriyordu. `app/show/[id].tsx` ve `app/movie/[id].tsx`'e, mevcut "izlemeyi geri al" Snackbar'ıyla aynı desende ikinci bir kısa onay Snackbar'ı (`rewatchConfirmation`) eklendi.
**Yeni özellik — talep edildiği gibi:** Artık tüm sezon zaten tamamen izlenmişken rozete basınca iki seçenek sunuluyor: **Tekrar İzle** (yeni `rewatchSeason` — `markSeasonAsWatched`'ın Trakt'a ikinci bir play ekleyen ince sarmalayıcısı) veya **Sezonu Geri Al** (kendi onayını isteyen, yıkıcı silme). Eskiden bu durumda tek seçenek doğrudan (aracı onaysız) "geri al"dı.
**Yan bulgu — ayrıca düzeltildi:** `SeasonAccordion.tsx`'teki TÜM sezon işaretleme metinleri (`unwatchSeasonTitle`, `markSeasonMsg`, `specials`, `seasonMarkError` vb. — 11 anahtar) ne `locales/tr/media.json`'da ne `locales/en/media.json`'da tanımlıydı; hepsi kod içine gömülü JS template-literal'lı varsayılan değerlere sessizce düşüyordu — yani bu ekran, uygulama dili İngilizce olsa bile HER ZAMAN Türkçe metin gösteriyordu. Tüm anahtarlar artık her iki dosyada da gerçek `{{değişken}}` interpolasyonuyla tanımlı.
**UI:** `SeasonAccordion` kartı, uygulamanın geri kalanındaki modernize edilmiş cam/koyu temayla (rgba yüzeyler, ince kenarlık, 16px radius) uyumlu hale getirildi; eski düz `#1e293b`/`#263346` renkleri kaldırıldı.
**Doğrulama:** `tsc --noEmit` yalnızca önceden var olan 3 ilgisiz hata veriyor; tüm `locales/*/*.json` dosyaları geçerli JSON.

## 31. Giriş/Vitrin Ekranı: "Ücretsiz Başla"nın Kaldırılması + Dağınık Çeviri Temizliği
**Hedef:** "Ücretsiz Başla" akışı kaldırılıp yerine yalnızca "Giriş Yap" ve "Misafir Olarak Devam Et" bırakılacak. Not: uygulamanın TEK giriş yöntemi zaten Trakt OAuth olduğundan, "Ücretsiz Başla" (register) ve "Giriş Yap" (login) butonları farklı `mode` parametreleriyle çağrılsa da ikisi de aynı `/settings` sayfasına gidiyordu — `handleAuthRedirect`'teki `mode` parametresi hiç kullanılmıyordu. Yani "Ücretsiz Başla" gerçekte var olmayan bir ayrım sunuyordu; kaldırılması yalnızca kozmetik değil, dürüst bir sadeleştirmeydi.
**Bulunan buglar:**
1. **Mobil menüde misafir seçeneği hiç yoktu.** `app/(public)/index.web.tsx`'teki masaüstü nav'da "Misafir Olarak Keşfet" linki `desktop-only` sınıfıyla gizliydi ve hamburger menüsünde hiç tekrarlanmamıştı — dar ekran web kullanıcıları (telefon tarayıcısı) giriş yapmadan misafir modunu deneyemiyordu. Artık mobil menüde de var.
2. **"KAYDIR" kaydırma ipucu, hero butonlarının üzerine biniyordu.** `.hero` `min-height:100vh` + `align-items:center` ile içeriği dikeyde ortalıyor, `.scroll-cue` ise kutunun dibine `position:absolute;bottom:36px` ile sabitleniyordu. Kısa viewport'larda (`getBoundingClientRect` ile doğrulandı: ipucu `top:596.8`, buton satırı `bottom:613.96` — gerçek çakışma) ipucu buton satırının üstüne biniyordu. `@media (max-height:820px){ .scroll-cue{ display:none; } }` eklendi.
3. **Rozet metni ile çeviri anahtarı uyuşmuyordu.** `HeroSection.tsx`'teki "🎉 Yeni Sürüm 2.0 Yayında" rozeti kod içine gömülüydü; `common.json`'daki `landingVersion` anahtarı ("✨ Yeni Sürüm 2.0 Yayında") hiç kullanılmıyordu — ikisi arasında emoji farkı bile vardı. Artık gerçek anahtar kullanılıyor.
4. **Var olan bir çeviri anahtarı (`ctaButton`) hiç kullanılmıyordu**, `CallToAction.tsx`'teki buton onun yerine ayrı, hardcoded bir metin ("Hemen Ücretsiz Katıl →") gösteriyordu. Anahtar silindi, buton artık `t('login')` kullanıyor.
**Uygulama:**
1. `locales/tr|en/common.json`: `landingStartFree` ve `ctaButton` (ikisi de artık kullanılmıyor) silindi; yeni `login`, `orDivider`, `viewShowcase`, `ctaBandSubtitle` eklendi; `landingGuest`/`exploreAsGuest` değerleri "Misafir Olarak Devam Et" olarak birleştirildi (eskiden iki farklı ekranda iki farklı ifade — "İncele" vs "Devam Et" — vardı).
2. `components/landing/HeroSection.tsx`: `Play` ikonu → `LogIn`; buton `t('landingStartFree')` → `t('login')`.
3. `components/landing/CallToAction.tsx`: alt CTA butonu `t('login')` kullanıyor.
4. `app/(public)/index.web.tsx` (gerçek web vitrin sayfası — masaüstünde VE mobil tarayıcıda render edilen, `app/(public)/index.tsx`'ten tamamen ayrı, ham HTML/CSS ile yazılmış sürüm): nav, hamburger menü, hero CTA'ları ve alt CTA bandındaki tüm "Ücretsiz Başla" görünümleri `t('login')` + `t('exploreAsGuest')` ikilisiyle değiştirildi; dead `handleAuthRedirect(mode)` → tek `handleLogin()`.
5. `app/(public)/settings.tsx`: hardcoded "VEYA", "Misafir Olarak Devam Et", "Vitrini Görüntüle" metinleri `t()` çağrılarına çevrildi.
**Doğrulama:** Değişiklikler tarayıcıda canlı test edildi (TR + EN, masaüstü + mobil viewport, hamburger menü) — tüm metinler doğru dilde görünüyor, misafir/giriş butonları doğru sayfalara gidiyor, scroll-cue çakışması giderildi. `tsc --noEmit` yalnızca önceden var olan 3 ilgisiz hata veriyor; tüm `locales/*/*.json` dosyaları geçerli JSON.

## 32. Keşfet Ekranı: Arama Çubuğu ve Dizi/Film Sekmesi Artık Sabit
**Hedef:** Kullanıcı sayfada ne kadar aşağı kaydırırsa kaydırsın, arama çubuğu ve Dizi/Film seçici her zaman görünür kalsın — hem mobilde hem webde.
**Kök yapı:** `app/(protected)/(tabs)/explore.tsx`'te tek bir dosya hem mobil (`FlatList`) hem masaüstü (`ExploreWebGrid`, kendi içinde ayrı bir `FlatList`) görünümünü besliyor; `SearchBar` + `SearchTabs` eskiden `renderHeader()`'ın İÇİNDE, yani `ListHeaderComponent` olarak listenin kendisiyle birlikte kayıyordu.
**Çözüm:** `SearchBar`+`SearchTabs`, `renderHeader()`'dan çıkarılıp ayrı bir `renderPinnedBar()` fonksiyonuna taşındı; bu blok artık `FlatList`/`ExploreWebGrid`'in DIŞINDA, üstünde, sabit bir kardeş eleman olarak render ediliyor (`stickyHeaderIndices` gibi platforma özgü/kırılgan bir mekanizma yerine, basitçe listenin dışında tutularak sağlandı — bu yüzden hem mobil hem web derlemesinde otomatik ve garantili çalışıyor). Kalan başlık ("Keşfet" + "Trend Diziler/Filmler" etiketi) `ListHeaderComponent` olarak listeyle birlikte kaymaya devam ediyor. Sabit blok, altındaki kayan içerikten ince bir `borderBottomColor` çizgisiyle görsel olarak ayrıştırıldı.
**Doğrulama:** Tarayıcıda hem mobil hem masaüstü (sidebar'lı) görünümde canlı test edildi — arama çubuğu ve sekmeler doğru konumda, doğru kenarlıkla render ediliyor. `tsc --noEmit` yalnızca önceden var olan 3 ilgisiz hata veriyor.

## 33. Keşfet Web Barı: Madde 32'nin Mimarisi Tersine Çevrildi (Sticky + Glassmorphism + Tek Satır)
**Hedef:** Madde 32'de webde "arama çubuğu + Dizi/Film sekmesi listenin DIŞINDA sabit bir blok" yapılmıştı — bu, barın kendi kalıcı yüksekliğini her zaman koruyup içeriği aşağı ittiği (afişlerin görünür alanını "eziyor" hissi verdiği) ve elemanların alt alta durup dikeyde gereksiz yer kapladığı anlamına geliyordu. Bu görevde tam tersi bir mimari isteniyor: bar artık listenin dışında ayrı bir blok değil, listenin `ListHeaderComponent`'inin İÇİNDE, `position: sticky` ile üstte kalan, yarı saydam + bulanık (glassmorphism) bir katman — içerik onun "arkasından" kayarak geçiyor. Bu, sadece webe özgü (`isDesktop`) bir değişiklik; mobildeki (Madde 32'de kurulan) dışarıda-sabit-blok mimarisi bilerek dokunulmadan bırakıldı çünkü RN'in mobil tarafında `position: sticky` aynı şekilde/güvenilir çalışmıyor ve mobilde zaten "eziyor" şikayeti yoktu.
**Neden `position: sticky` kullanıldı, `fixed` değil:** Masaüstü düzeninde sol tarafta 250px sabit genişlikli bir `Sidebar` (`components/Sidebar.tsx`) var. `position: fixed` viewport'a göre konumlanır ve sidebar'ın GENİŞLİĞİNDEN habersiz olduğundan barın sidebar'ın üzerine binmesine (veya `left: 250` gibi Sidebar'ın genişliğini kod tekrarıyla bilmesi gereken kırılgan bir sabite) yol açardı. `position: sticky` ise normal doküman akışındaki YATAY konumunu korur (sidebar'ın yanındaki sütunun içinde kalır), yalnızca DİKEYDE üstte yapışır — sidebar'la hiç çakışmaz.
**Uygulama:**
1. `components/SearchBar.tsx` ve `components/SearchTabs.tsx`'e isteğe bağlı `style` prop'u eklendi (geriye dönük uyumlu) — böylece web barı, bileşenlerin varsayılan dikey `margin`'lerini (`marginVertical`/`marginBottom`) ezip satır içi hizalama sağlayabiliyor.
2. `app/(protected)/(tabs)/explore.tsx`'e yeni `renderDesktopHeader()` eklendi: `stickyBarWeb` (`position:'sticky', top:0, zIndex:20, backgroundColor:'rgba(15,23,42,0.85)', backdropFilter/WebkitBackdropFilter:'blur(16px)'`) içinde `stickyBarRowWeb` (`flexDirection:'row'`) ile `SearchBar` (`flex:1`, solda genişler) ve `SearchTabs` (`flexShrink:0`, sağda kompakt) tek satırda; hemen altında (aynı `ListHeaderComponent` içinde, kaymaya devam eden) başlık + trend etiketi. Bu, `ExploreWebGrid`'e `header={renderDesktopHeader()}` olarak geçiliyor; eskiden ayrı render edilen masaüstü `pinnedBarOuterWeb`/`pinnedBarInnerWeb` kaldırıldı (mobilin kendi `pinnedBar`'ı dokunulmadan kaldı).
**Doğrulama:** Tarayıcıda 1280px masaüstü genişlikte canlı test edildi; `getComputedStyle` ile doğrudan doğrulandı: `position:"sticky"`, `top:"0px"`, `backdropFilter:"blur(16px)"`, `background:"rgba(15, 23, 42, 0.85)"`, `zIndex:"20"`. Arama kutusu ve "Shows"/"Movies" sekmesinin gerçek piksel koordinatları ölçülüp aynı satırda (aynı y-aralığında), arama solda geniş/sekme sağda kompakt olduğu doğrulandı. Mobil görünüm (375px) ekran görüntüsüyle değişmediği teyit edildi. `tsc --noEmit` yalnızca önceden var olan 3 ilgisiz hata veriyor.

## 34. Keşfet Web Barı: Madde 33 UX Testinde Başarısız Oldu — Dikey Hiyerarşiye Geri Dönüldü
**Sorun:** Madde 33'te kurulan "tek satır, hepsi sticky" mimarisi UX testinde başarısız oldu: arama çubuğu ile Dizi/Film sekmesini yan yana sıkıştırmak, sekmelerin görünürlüğünü/tıklanabilirliğini bozdu. Bu görevde tamamen yeni bir hiyerarşi isteniyor: sekme SABİT OLMAMALI (sayfayla kaysın), yalnızca arama çubuğu sabitlenmeli, ayrıca bir "Yukarı Çık" butonu eklenmeli.
**Uygulama (yalnızca `isDesktop` dalı; mobil Madde 32'deki haliyle dokunulmadı):**
1. `app/(protected)/(tabs)/explore.tsx`'te `renderDesktopHeader()` üçe bölündü:
   - `desktopTopSectionWeb` (SABİT DEĞİL): başlık ("Keşfet") + tam genişlikte `SearchTabs` — `ListHeaderComponent`'in normal (sticky olmayan) bir parçası, sayfayla birlikte kayıp kaybolur.
   - `stickySearchBarWeb` (`position:'sticky', top:0, zIndex:20`): yalnızca arama çubuğu + "Yukarı Çık" butonu. Arka plan artık `rgba(0,0,0,0.6)` (yarı saydam SİYAH, Madde 33'teki lacivert tonun yerine) + `backdropFilter/WebkitBackdropFilter:'blur(16px)'`.
   - `headerContainerWeb`: trend etiketi/boş durum metni — bu da sabit değil, aramanın hemen altında normal akışta kalmaya devam ediyor.
2. **"Yukarı Çık" butonu** (`ArrowUp` ikonlu, 40×40 yarı saydam dairesel, "çok sırıtmayan"): yalnızca `showScrollTop` state'i `true` olduğunda (yani `SCROLL_TOP_THRESHOLD=240`px'ten fazla kaydırılınca) render ediliyor. `useState`/`useCallback` ile `explore.tsx`'te tutuluyor.
3. **Mimari değişiklik — `ExploreWebGrid` artık `forwardRef`:** Buton tıklanınca listeyi başa sarmak (`scrollToOffset`) ve scroll pozisyonunu izlemek (butonu göstermek/gizlemek) için `explore.tsx`'in `ExploreWebGrid` içindeki `FlatList`'e erişmesi gerekiyordu. `components/explore/ExploreWebGrid.tsx`, `React.forwardRef<FlatList<any>, Props>` ile `ref`'i doğrudan iç `FlatList`'e yönlendirecek ve yeni bir `onScroll?: (offsetY: number) => void` prop'unu `FlatList`'in `onScroll`'una (`scrollEventThrottle={16}` ile) bağlayacak şekilde güncellendi. `explore.tsx`'te `desktopGridRef` (`useRef<FlatList<any>>`) bu ref'i tutuyor; `scrollToTop()` fonksiyonu `desktopGridRef.current?.scrollToOffset({offset:0, animated:true})` çağırıyor.
4. `components/SearchBar.tsx`/`SearchTabs.tsx`'e Madde 33'te eklenen `style` prop'u burada da (artık farklı bir bağlamda: tam genişlik sekme, `flex:1` arama) yeniden kullanıldı — API değişmedi.
**Doğrulama:** Tarayıcıda 1280px'de canlı test edildi. `getComputedStyle` ile doğrulandı: arama çubuğunu saran eleman `position:"sticky"`, arka planı `rgba(0, 0, 0, 0.6)`, `backdropFilter:"blur(16px)"`; "Shows" sekmesinin hiçbir atası `position:sticky` DEĞİL (yani sekme gerçekten sabit değil). Mobil görünüm (375px) ekran görüntüsüyle değişmediği doğrulandı. Trakt API bu ortamda engelli olduğundan (trend içerik hiç yüklenemiyor, "Failed to load trending" hatası) gerçek kaydırma sırasında butonun görünüp kaybolması canlı test edilemedi — kod incelemesiyle doğrulandı (`onScroll` → `contentOffset.y` → eşik karşılaştırması → `showScrollTop` state; standart `forwardRef`/`scrollToOffset` deseni). `tsc --noEmit` yalnızca önceden var olan 3 ilgisiz hata veriyor.

## 35. Dizi Takip (Watchlist/Progress) Modülünün Sıfırdan, İzole Yeniden Yazımı
**Sorun:** Diziler ekranının "İzleme" sekmesinde diziler yanlış kategorilere (Sıradaki / Henüz Başlanmadı / Bırakıldı) düşüyor, aynı dizi birden fazla listede görünebiliyor, butonlar kilitleniyor ve `isLoading` state'i bug'da takılıyordu. Kök neden: kategorizasyon mantığı `hooks/useDashboardData.ts` içinde UI'a yakın, dallanmış (birden fazla `for` döngüsü + `farFutureTemp` çapraz-taşımalar + `alreadyInUpNext/alreadyInInactive` elle çakışma kontrolleri) bir yapıdaydı; bir dizi kolayca iki kovaya sızabiliyordu. Loading ise ayrı bir `useState` + `useEffect` zincirinden türetildiği için (özellikle guest/trending yollarıyla) takılıp kalabiliyordu.
**Prensip (Single Source of Truth):** Kategorizasyon UI'dan tamamen çıkarılıp saf, deterministik bir "tek gerçek kaynak" katmanına taşındı. Kural artık basit ve çakışmasız: her dizi trakt id'siyle tekilleştirilir ve **tam olarak bir** kovaya girer — tamamlanmışsa hiçbirine, hiç başlanmamışsa `notStarted`, başlanmış+bayatsa (son izleme > 30 gün) `dropped`, başlanmış+aktifse `upNext`.
**İzolasyon:** SADECE takip modülü değişti. Auth, Keşfet, Profil, API proxy ve ham Zustand dilimleri (`watchedShows`/`watchlistShows`/`showProgressMap` — bunlar Explore/Profile tarafından da paylaşılıyor) DOKUNULMADI. "Yaklaşan" (takvim) sekmesi de eski `useDashboardData`'nın `upcomingShows` çıktısını kullanmaya devam ediyor (o kısım buggy değildi ve paylaşılan takvim verisine dokunmamak için korundu).
**Yeni dosyalar:**
1. `store/tracking/trackingLogic.ts` — SAF kategorizasyon (`categorizeShows`). UI'dan bağımsız, i18n etiketleri parametre olarak alınır. Tek gerçek kaynak.
2. `store/tracking/useTrackingStore.ts` — SADECE accordion aç/kapa UI durumunu tutan izole Zustand store (SecureStore'a kalıcı, tek-seferlik `hydrate` ile sonsuz döngü riski yok). Veri BURADA değil — UI durumu ile veri kategorizasyonu bilinçli olarak ayrıldı.
3. `hooks/useTrackingShows.ts` — ham dilimleri okuyup `categorizeShows`'a veren seçici hook. `isLoading` TÜRETİLMİŞ (`isEmpty && isLibraryLoading`) — ayrı state/effect olmadığı için "yükleniyor'da takılma" yapısal olarak imkânsız.
4. `components/tracking/TrackingAccordionList.tsx` (mobil) — düz (flattened) satır dizisi üzerinde tek `FlatList` (memoize renderItem/keyExtractor, `windowSize`/`initialNumToRender`/`maxToRenderPerBatch`, Android'de `removeClippedSubviews`). Accordion collapse `LayoutAnimation` ile; animasyon süresi boyunca dokunuşları yutan `toggleLockRef` kilidi donmayı önler.
5. `components/tracking/TrackingAccordionList.web.tsx` — aynı store/hook, ama açılan her kategori içindeki kartlar tek sütun yerine `flexWrap` grid (yan yana) dizilir; geniş ekran avantajı.
**Değişen:**
- `screens/IndexMobile.tsx` — İzleme sekmesi artık `useTrackingShows` + `useTrackingStore` + `TrackingAccordionList`. Eski yerel `collapsed` state + SecureStore kodu ve `WatchlistSectionList`/`TrendingFallbackList` kullanımları kaldırıldı.
- `app/(protected)/(tabs)/shows.web.tsx` — masaüstü İzleme sekmesi 3 yatay carousel yerine `TrackingAccordionListWeb`. Nested-scroll'u önlemek için her sekme kendi kaydırma kabına sahip (segmented control dışarıda sabit).
**Silinen (orphan):** `components/index/WatchlistSectionList.tsx`, `components/index/TrendingFallbackList.tsx` — yeni akışta hiçbir yerden referans edilmiyor (grep ile teyit edildi).
**i18n:** Tek yeni anahtar `caughtUp` (aktif ama sıradaki bölümü henüz yayınlanmamış diziler için) her iki `media.json`'a eklendi.
**Doğrulama:** `tsc --noEmit` sonrası hata veren dosya kümesi değişmedi — hâlâ yalnızca önceden var olan 4 dosya (CommentItem, useShowDetail, locales/index, languageDetector); takip modülünden sıfır yeni hata. Dev sunucusu temiz derlendi; Diziler sekmesi tarayıcıda misafir-paywall dalını hatasız render etti (yeni tüm import'lar runtime'da sorunsuz yüklendi). Gerçek veriyle kategorizasyon/accordion davranışı, Trakt API bu ortamda engelli + ekran giriş gerektirdiği için canlı test edilemedi; kategorizasyon saf ve tsc-temiz olduğundan mantık kod düzeyinde doğrulandı.

## 36. Diziler İzleme (Web/Desktop): Accordion Kaldırıldı → Netflix Tarzı Poster Carousel (Filmlerle Aynı Dil)
**Sorun:** Madde 35'te masaüstü web İzleme sekmesine konan accordion + `flexWrap` grid, YATAY `EpisodeCard` (84px poster + geniş içerik, ~340px+) kartlarını tile ettiği için afişler arası devasa boşluklar bırakıyor, "dev accordion butonları" web'de amatör duruyordu. Kullanıcı, zaten iyi görünen FİLMLER sayfasının dilini (basit metin başlık + Netflix tarzı poster carousel) diziler için de istedi.
**Kök fark:** Filmler sayfası `MovieCard.web.tsx` (180×270 POSTER kart) + `WebCarousel` (basit sol-hizalı başlık + yatay kaydırmalı satır, hover ok) kullanıyor. Diziler ise yatay satır kartı `EpisodeCard` kullanıyordu — grid'de bu yüzden çirkin duruyordu.
**Çözüm (SADECE masaüstü web; mobil ve dar-ekran web accordion'u korundu):**
1. `components/tracking/ShowTrackCardWeb.tsx` (yeni) — `MovieCard.web.tsx` ile birebir aynı görsel dil, dizilere uyarlanmış: 180×270 afiş, hover'da karartma gradyanı + oynat ikonu + dizi adı/bölüm başlığı + işaretleme butonu, scale-on-hover. İşaretleme mantığı için mevcut, kendi kendine yeten `EpisodeCheckButton` yeniden kullanıldı (skip-episode uyarısı, iyimser UI, "dizi bitti" tespiti dahil — kod tekrarı yok). Rozetler zarifleştirildi: "Bırakıldı" için küçük amber pill (sol üst), sıradaki bölüm için `S01 · E02` küçük yarı saydam pill (sol alt), altta ince yeşil ilerleme çubuğu (Netflix "devam et" hissi). Platform-uzantısı yerine açık isim (`*Web`) — yalnızca `shows.web.tsx` import eder, çakışma riski yok.
2. `app/(protected)/(tabs)/shows.web.tsx` — masaüstü İzleme görünümü `TrackingAccordionListWeb` yerine, filmler sayfasıyla aynı yapıda 3 `WebCarousel`'e döndü: Sıradaki (`categories.upNext`), Henüz Başlanmadı (`categories.notStarted`), Bırakıldı (`categories.dropped`) — her biri yalnızca doluysa render edilir, `renderItem` olarak `ShowTrackCardWeb`. Veri kaynağı hâlâ Madde 35'teki tek-gerçek-kaynak `useTrackingShows`; yalnızca SUNUM değişti. Nested-scroll için eklenen ayrı kaydırma kabı kaldırıldı, tek `ScrollView`'a geri dönüldü (filmlerle aynı). Yaklaşan (takvim) carousel'leri, trend fallback ve misafir paywall aynen korundu.
**Not:** `components/tracking/TrackingAccordionList.web.tsx` SİLİNMEDİ — `screens/IndexMobile.tsx`, `TrackingAccordionList`'i uzantısız import ettiğinden dar-ekran web'de (mobil genişlik) Metro hâlâ `.web.tsx`'i çözer; orada accordion doğru davranıştır. Yalnızca GENİŞ masaüstü web carousel'e geçti.
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi (yalnızca önceden var olan 4 dosya). Dev sunucusu temiz derlendi; Diziler sekmesi tarayıcıda misafir-paywall dalını runtime/modül hatası olmadan render etti (yeni `ShowTrackCardWeb` import'u sorunsuz çözüldü). Gerçek posterli carousel görünümü giriş + Trakt verisi gerektirdiğinden (bu ortamda engelli) canlı ekran görüntüsüyle doğrulanamadı; tasarım birebir `MovieCard.web` deseninden türetildiği ve tsc-temiz olduğu için kod düzeyinde doğrulandı.

## 37. Otomatik "30 Gün" Kuralı Kaldırıldı → Manuel "Bırakıldı" İşaretleme (3-Nokta Menüsü)
**Sorun:** Madde 35'teki `dropped` kategorisi tamamen otomatikti: `last_watched_at` son 30 günden eskiyse dizi kullanıcı isteği dışında "Bırakıldı"ya düşüyordu. Bu, uzun aralarla izlenen (örn. haftalık yayınlanan) dizilerin kullanıcı hiç istemeden "Bırakılanlar"a kaymasına sebep oluyordu.
**Çözüm:** Zaman tabanlı otomatik kural tamamen silindi; kategorizasyon artık salt kullanıcı iradesine ve ilerleme durumuna dayanıyor:
- `store/tracking/trackingLogic.ts` — `staleDays`/`now`-tabanlı eşik hesaplaması ve `lastWatchedAt` alanı tamamen kaldırıldı. Yeni sıra: (1) tamamlanmış → hiçbir listede yok, (2) kullanıcı manuel "Bırakıldı" işaretlemiş → `dropped` (ilerleme durumundan bağımsız — başlanmamış bir dizi de bırakılabilir), (3) hiç başlanmamış → `notStarted`, (4) başlanmış → `upNext` ("İzlenenler").
- `store/tracking/useTrackingStore.ts` — SecureStore'a kalıcı `droppedIds: number[]` state'i ve `toggleDroppedStatus(id)` aksiyonu eklendi. `hydrate()` artık hem accordion collapse hem dropped-id listesini paralel okuyor.
- `hooks/useTrackingShows.ts` — `droppedIds`'i store'dan okuyup `categorizeShows`'a geçiyor, `toggleDroppedStatus`'u sonuç olarak dışa veriyor, ve store'u kendi içinde `hydrate` ediyor (artık ekranların ayrıca hydrate çağırmasına gerek yok, `IndexMobile`'daki çağrı zaten idempotent olduğu için çakışmıyor).
- `components/tracking/TrackingCardMenu.tsx` (yeni) — afiş kartlarının üzerinde küçük 3-nokta (⋮) tetikleyicisi + tek satırlık "Bırakılanlara Ekle"/"Bırakılanlardan Çıkar" açılır paneli. `onToggleDropped` prop'u verilmediğinde hiç render olmaz (trend/yaklaşan gibi takip-dışı kartlarda görünmüyor).
- Menü, `EpisodeCardMobile.tsx` (poster sağ-üst köşe), `EpisodeCard.web.tsx` (masaüstü hover overlay, info butonunun yanı) ve `ShowTrackCardWeb.tsx` (poster sağ-üst köşe) kartlarına eklendi; `onToggleDropped` prop'u `TrackingAccordionList(.web).tsx` → `screens/IndexMobile.tsx` ve `ShowTrackCardWeb` → `shows.web.tsx` zincirinde `toggleDroppedStatus`'a kadar taşındı.
**i18n:** `upNext` etiketinin metni "Sıradaki"/"Up Next" → "İzlenenler"/"Watching" oldu (anahtar adı değişmedi, sadece görünen metin — kod tabanında `t('upNext')` çağıran hiçbir yer dokunulmadan çalışmaya devam ediyor). `inactive` "Bırakıldı / Eskiler" → "Bırakılanlar"/"Dropped" oldu. Yeni anahtarlar: `addToDropped`, `removeFromDropped` (TR/EN).
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi (yalnızca önceden var olan, bu modülle ilgisiz 4 dosya). Trakt girişi bu ortamda engelli olduğu için canlı ekranda toggle davranışı gözlemlenemedi; mantık saf/tsc-temiz fonksiyonlarda olduğu için kod düzeyinde doğrulandı.

## 38. Madde 37'nin 3-Nokta Menüsü Mobilde Kırpılıyordu → Modal Bottom-Sheet'e Geçildi; "İzlemeyi Bırak" Dizi/Film Profiline de Eklendi
**Sorun 1:** `TrackingCardMenu.tsx`'teki dropdown, kartın üzerine `position: 'absolute'` bir `View` olarak açılıyordu. Ama afiş kartlarının hepsi (`EpisodeCardMobile`, `EpisodeCard.web`, `ShowTrackCardWeb`) `overflow: 'hidden'` bir dış kapsayıcıya sahip — özellikle dar mobil satır kartında (84px poster) `minWidth: 200` menü kart sınırlarının çok dışına taşıp kırpılıyor, kullanıcı seçeneğe dokunamıyordu.
**Çözüm 1:** `TrackingCardMenu` artık `OptionsModal.tsx`'teki ile aynı desende, RN `Modal` (transparent, bottom-sheet) kullanıyor. Modal üst seviyede (native'de ayrı bir pencere katmanı, web'de portal) render edildiğinden hiçbir ebeveynin `overflow: 'hidden'`'ından etkilenmiyor; 3-nokta tetikleyicisi aynı küçük, mutlak-konumlu buton olarak kalıyor (o hiç kırpılmıyordu), yalnızca açılan panel değişti.
**Sorun 2:** Dizi/film detay sayfalarındaki (`MediaHero` → `OptionsModal`, "..." butonu) mevcut seçenekler menüsünde "Bırakılanlara Ekle/Çıkar" aksiyonu yoktu — kullanıcı bunu yalnızca Diziler sekmesindeki kart menüsünden yapabiliyordu.
**Çözüm 2:** `OptionsModal.tsx`'e `isDropped`/`onToggleDropped` opsiyonel prop'ları eklendi; `type === 'show'` ise (filmlerde "izleme ilerlemesi" kavramı yok, bu yüzden yalnızca diziler) `PauseCircle` ikonlu yeni bir satır render ediliyor, `addToDropped`/`removeFromDropped` i18n anahtarlarını (Madde 37'de eklenmişti) yeniden kullanıyor. `MediaHero.tsx` bu prop'ları `OptionsModal`'a taşıyor. `app/show/[id].tsx`, `useTrackingStore`'dan `droppedIds`/`toggleDroppedStatus` okuyup `isDropped = droppedIds.includes(traktIdNum)` hesaplıyor ve kendi `hydrate()` çağrısını yapıyor (ekran doğrudan bu route'a girildiğinde `useTrackingShows` hiç mount olmamış olabilir). `app/movie/[id].tsx` DOKUNULMADI — film profilinde bu seçenek görünmüyor (veri modelinde film için "bırakma" karşılığı yok).
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi (aynı önceden var olan 4 dosya). Dev sunucusu temiz derlendi, guest/paywall akışı masaüstü ve mobil genişlikte hatasız render edildi. Trakt girişi bu ortamda engelli olduğu için gerçek bir kartta menüyü açıp dokunma testi canlı yapılamadı; kırpılma kökeninin `overflow: 'hidden'` + mutlak konumlu dropdown olduğu kod incelemesiyle doğrulandı ve çözüm (üst-seviye `Modal`) zaten `OptionsModal`'da kanıtlanmış aynı desen.

## 39. 3 Kategori Yeniden 4'e Çıkarıldı: "Aktif İzlenenler / Ara Verilenler (45 gün) / Bırakılanlar (manuel) / Henüz Başlanmadı"
**Sorun:** Madde 37'de otomatik zaman kuralı tamamen kaldırılıp yalnızca manuel "Bırakıldı" bırakılmıştı. Kullanıcı bu sistemi beğenmedi: uzun süredir dokunulmamış ama kullanıcının bilinçli olarak "bırakmadığı" diziler artık hiç ayrışmıyor, hepsi "İzlenenler" içinde kalıyordu. İstenen: otomatik zaman sinyali GERİ gelsin ama "Bırakıldı" ile ÇAKIŞMASIN — ikisi birbirinden bağımsız, ayrı iki kova olsun.
**Çözüm — 3 kova yerine 4 kova, hâlâ çakışmasız/tek-kaynak:**
1. `store/tracking/trackingLogic.ts` — `lastWatchedAt` (yalnızca `watchedShows`'tan gelen `last_watched_at`) GERİ eklendi. Yeni sıra: (1) tamamlanmış → hiçbir listede yok, (2) manuel "Bırakıldı" → `dropped` (tarih/ilerlemeden TAMAMEN bağımsız, en yüksek öncelik), (3) hiç başlanmamış → `notStarted`, (4) başlanmış + son izleme `pauseThresholdDays` (varsayılan **45** gün) içinde → `upNext` (Aktif İzlenenler), (5) başlanmış + son izleme 45 günden eski → `paused` (Ara Verilenler/Beklemede). `pauseThresholdDays` parametre olarak dışa açık (test/ayarlanabilirlik için), varsayılanı `DEFAULT_PAUSE_THRESHOLD_DAYS = 45` export ediliyor. `last_watched_at` bilinmiyorsa (yalnızca watchlist'ten gelen uç durum) temkinli davranılıp `upNext`'e düşer — asla sessizce "eski" varsayılmaz. `paused` listesi en son izlenen en üstte olacak şekilde sıralanıyor (`TrackingCard.lastWatchedAt` yeni, opsiyonel alan).
2. `store/tracking/useTrackingStore.ts` — `TrackingCategoryKey`'e `'paused'` eklendi, `DEFAULT_COLLAPSED`'da kapalı (yalnızca `upNext` açık).
3. `hooks/useTrackingShows.ts` — `totalCount` artık 4 kategoriyi topluyor.
4. `components/tracking/TrackingAccordionList(.web).tsx` — `SECTION_META`'ya `paused: { PauseCircle, turuncu }` eklendi (Bırakılanlar'ın amber'ından bilinçli olarak farklı bir ton — ikisi karıştırılmasın), `SECTION_ORDER = [upNext, paused, notStarted, dropped]`.
5. `screens/IndexMobile.tsx` / `app/(protected)/(tabs)/shows.web.tsx` — yeni `paused` etiketi ve (masaüstü) `WebCarousel` eklendi.
6. Kart rozetleri: `EpisodeCardMobile.tsx` (`BEKLEMEDE` → turuncu chip), `ShowTrackCardWeb.tsx` (turuncu köşe rozeti) yeni `'BEKLEMEDE'` tag'ini gösteriyor.
**UI yan-düzeltmesi (fark edilen gerçek bug):** `EpisodeCard.web.tsx`'teki etiket satırı yalnızca `WATCHLIST` etiketini çeviriyor, diğerlerini (`BIRAKILDI`, `EN SON`, yeni `BEKLEMEDE`) ham Türkçe kod olarak basıyordu — İngilizce arayüzde bile Türkçe metin görünürdü. Yeni `getTagLabel()` yardımcı fonksiyonu tüm bilinen etiketleri i18n üzerinden çeviriyor.
**Menü yeniden tasarımı ("çok daha şık"):** `components/tracking/TrackingCardMenu.tsx` bottom-sheet artık: üstte dizi adı başlığı + kapat (X) butonu, ortada ikon-rozetli (aktifken amber vurgulu) seçenek satırı + açıklayıcı alt metin, altta ayrı bir "İptal" satırı. Hem web hem native'de aynı `Modal` tabanlı yapı olduğundan iki platformda da özdeş davranıyor.
**i18n:** Yeni anahtarlar — `paused`/`pausedTag` (bölüm başlığı / kart rozeti), `dropWatchingSubtext`/`undropWatchingSubtext` (menü alt metni). `upNext` metni "İzlenenler" → "Aktif İzlenenler"/"Actively Watching" olarak netleştirildi (artık "aktif" olmayanlar için ayrı bir kova olduğundan isim belirsizliği kalmasın diye).
**Temizlik:** Madde 37'de silinen `staleDays`/`isStale` kodu bilinçli olarak GERİ YAZILMADI — yeni `pauseThresholdDays`/`isPaused` aynı işi görüyor ama farklı bir kovaya (dropped değil, paused) yönlendiriyor; eski kod tabanı korunmadı, sıfırdan aynı prensiple (saf, tek-kaynak, çakışmasız) yazıldı.
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi (aynı önceden var olan, bu modülle ilgisiz 4 dosya). Her iki `media.json` `JSON.parse` ile doğrulandı. Dev sunucusu temiz derlendi; guest/paywall akışı masaüstü ve mobil genişlikte hatasız render edildi. Trakt girişi bu ortamda engelli olduğu için 45 günlük eşiğin gerçek verideki davranışı ve yeni menü tasarımı canlı ekran görüntüsüyle doğrulanamadı; kategorizasyon saf/tsc-temiz bir fonksiyonda olduğu ve her show'un döngüde tam olarak bir `continue`/push ile TEK kovaya girdiği kod incelemesiyle doğrulandı (çakışma yapısal olarak imkânsız).

## 40. İlerleme Çubukları Uygulama Genelinde Durum Rengine Bağlandı (Bırakıldı=Turuncu / Devam=Mavi / Bitti=Yeşil); "BEKLEMEDE" Metin Rozeti Kaldırıldı
**İstek:** İlerleme çubuğunun rengi her yerde diziye özgü duruma göre değişsin: manuel "Bırakıldı" → turuncu, henüz bitmemiş her şey (aktif VEYA Madde 39'daki "Ara Verilenler") → sitenin mavisi, tüm yayınlanan bölümler tamamlanmış → yeşil, hiç başlanmamışsa çubuk zaten hiç görünmesin. Ayrıca Madde 39'da eklenen "BEKLEMEDE" metin rozeti kaldırılsın — kategori grubu (Ara Verilenler bölümü) zaten yeterli sinyal.
**Çözüm — tek paylaşılan renk kuralı:**
1. `utils/progressBarColor.ts` (yeni) — `getProgressBarColor(isDropped, isFinished)` saf fonksiyonu: `isDropped` → turuncu (`#fb923c`), `isFinished` → yeşil (`#10b981`), aksi hâlde mavi (`#3b82f6`, `ProgressBar`'ın zaten var olan varsayılan rengiyle aynı — "site ile uyumlu mavi"). Her ekran kendi `isDropped`/`isFinished` bilgisini hesaplayıp bu tek fonksiyona veriyor; fonksiyon Zustand'a bağımlı değil, saf.
2. Uygulanan TÜM `<ProgressBar>` kullanım yerleri (`grep` ile bulunan 6 gerçek kullanım): `components/EpisodeCardMobile.tsx`, `components/EpisodeCard.web.tsx`, `components/tracking/ShowTrackCardWeb.tsx` (afiş kartları — sabit yeşil `#10b981` yerine dinamik renk), `components/MediaHero.tsx` (dizi/film sayfası — `isDropped` prop'u Madde 38'de zaten vardı, `isFinished` yeni eklendi), `app/episode/[id].tsx` (bölüm sayfasındaki dizi ilerleme özeti — `useTrackingStore`'dan `droppedIds` okunarak hesaplandı), `components/ShowCard.tsx` (Keşfet/liste satır kartı — aynı şekilde `droppedIds` okunuyor).
3. `store/tracking/trackingLogic.ts` — `notStarted` kartlarında `completedCount`/`totalCount` artık BİLİNÇLİ OLARAK `null`'a sabitleniyor (önceden, progress kaydı var ama `completed===0` olan bir uç durumda 0'lık bir çubuk sessizce sızabilirdi) — "henüz başlanmadıysa çıkmasın" artık yapısal olarak garanti.
**BEKLEMEDE rozeti kaldırıldı:**
- `store/tracking/trackingLogic.ts` — `paused` kartları artık ayrı bir `'BEKLEMEDE'` tag'i üretmiyor; `upNext` ile aynı kurala göre (`nextReady ? ['EN SON'] : []`) etiketleniyor.
- `components/EpisodeCardMobile.tsx` — `BEKLEMEDE` chip'i ve kullanılmayan `tagOrange` stili silindi.
- `components/EpisodeCard.web.tsx` — `getTagLabel()`'daki `BEKLEMEDE` eşlemesi silindi.
- `components/tracking/ShowTrackCardWeb.tsx` — turuncu "BEKLEMEDE" köşe rozeti (`badgePaused`) ve `isPaused` değişkeni tamamen kaldırıldı; yalnızca "Bırakıldı" rozeti kalıyor.
- `locales/tr,en/media.json` — artık hiçbir yerden referans edilmeyen `pausedTag` anahtarı silindi (temizlik).
**Temizlik (fark edilen ölü kod):** `components/explore/ExploreWebGrid.tsx`'te hiç kullanılmayan `import ProgressBar from '../ProgressBar'` satırı silindi (o dosyadaki kartlar zaten hiç ilerleme çubuğu render etmiyordu).
**Kapsam notu:** `components/profile/stats/CompletionProgressBar.tsx` (profildeki "Tamamlanma Oranı" kartı) BİLİNÇLİ OLARAK dokunulmadı — bu, tek bir dizi/filmin durumunu değil, TÜM kütüphanenin toplam bitirme oranını gösteren farklı bir bileşen (kendi gradyan çubuğu var, `ProgressBar` bileşenini hiç kullanmıyor); "bırakıldı/aktif/bitti" durum renklendirmesi kavramsal olarak burada uygulanamaz.
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi (aynı, ilgisiz 4 dosya). Her iki `media.json` `JSON.parse` ile doğrulandı. `grep` ile artık hiçbir `fillColor="#10b981"` (sabit yeşil) kalmadığı ve hiçbir yerde `BEKLEMEDE` tag'i üretilmediği teyit edildi. Dev sunucusu temiz derlendi, guest/paywall akışı hatasız render edildi. Trakt girişi bu ortamda engelli olduğu için gerçek verideki renk geçişleri (turuncu/mavi/yeşil) canlı ekran görüntüsüyle doğrulanamadı; her ekranın kendi `isDropped`/`isFinished` hesaplaması ilgili store/prop'lardan doğru şekilde türetildiği kod incelemesiyle doğrulandı.

## 41. Keşfet (Explore) Masaüstü Arama Çubuğu: Kırılgan `position: sticky` Kaldırıldı → Mobildeki Kanıtlanmış "Listenin Dışında Sabit" Desenine Geçildi
**Şikayet:** Keşfet ekranındaki arama çubuğunun çevresi siyah ile kaplı kalıyor, aşağı inmiyor/yukarıda takılı kalıyor ve kaydırırken bug'a giriyor.
**Kök neden (kod incelemesiyle tespit edildi, tarayıcıya girilmedi):** Madde 33/34'te masaüstü arama çubuğu, `ExploreWebGrid`'in (`FlatList`) `ListHeaderComponent`'i İÇİNDE `position: sticky` + yarı saydam siyah (`rgba(0,0,0,0.6)`) + `backdropFilter: blur(16px)` ile uygulanmıştı. Bu yaklaşım o zamanki doğrulamada yalnızca `getComputedStyle` ile STATİK olarak (`position:"sticky"` değerinin var olduğu) test edilmişti — react-native-web'in sanallaştırılmış/kaydırılan `FlatList` ağacı içinde CSS `position: sticky`'nin GERÇEK kaydırma sırasında güvenilir davranıp davranmadığı hiç canlı olarak (gerçek veri ve uzun bir listede) doğrulanamamıştı (Trakt API bu ortamda hep engelliydi). Madde 33'ün kendi yorumu zaten bunu "kırılgan" olarak işaretlemişti. Sonuç: takılma/tepede kilitlenme ve arkasındaki yarı saydam siyah katmanın içerikle beklenmedik çakışması.
**Çözüm:** Masaüstü arama çubuğu, mobildeki `renderPinnedBar()` ile TAMAMEN AYNI, kanıtlanmış desene taşındı — `position: sticky` yerine `ExploreWebGrid`'in TAMAMEN DIŞINDA, gerçek bir kardeş `View` olarak (`app/(protected)/(tabs)/explore.tsx`'te yeni `renderDesktopSearchBar()`), CSS sticky mekanizmasına hiç ihtiyaç duymadan her zaman görünür. Yarı saydam siyah + blur yerine, sayfanın kendi opak koyu-lacivert arka planı (`#0B1120`, mobildeki `pinnedBar` ile aynı renk) kullanıldı — arkadan hiçbir içerik "sızmadığı" için çakışma sorunu yapısal olarak imkânsız hâle geldi. Diziler/Filmler sekmesi ve başlık, `renderDesktopScrollHeader()` (eski `renderDesktopHeader()`'ın geri kalanı) içinde, `ExploreWebGrid`'in `ListHeaderComponent`'i olarak SABİT OLMADAN sayfayla birlikte kaymaya devam ediyor — Madde 34'te istenen "yalnızca arama sabit, sekme sabit değil" davranışı korundu, sadece sabitleme mekanizması değişti. "Yukarı Çık" butonu (`showScrollTop`/`scrollToTop`/`desktopGridRef`) dokunulmadan aynen kaldı.
**Kapsam:** Yalnızca `isDesktop` dalı değişti; mobildeki (`renderPinnedBar`, zaten CSS sticky kullanmayan, kanıtlanmış) davranış hiç dokunulmadı.
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi (aynı, ilgisiz 4 dosya). `grep` ile eski `stickySearchBarWeb`/`stickySearchInnerWeb`/`renderDesktopHeader` isimlerine hiçbir referans kalmadığı teyit edildi. Kullanıcının isteği üzerine bu görev tamamen kod incelemesiyle yapıldı, tarayıcıda canlı test edilmedi — yeni yapı, zaten mobilde kanıtlanmış olan aynı "listenin dışında gerçek kardeş eleman" desenini birebir tekrarladığı için ek bir sticky/CSS kırılganlığı riski taşımıyor.

## 42. Bir Bölüm İzlenince Dizi Otomatik Olarak "Aktif İzlenenler"e Geri Döner
**İstek:** "Bırakılanlar", "Henüz Başlanmadı" veya "Ara Verilenler" kovasındaki bir dizide kullanıcı yeni bir bölüm işaretlerse, dizi normal izlenen bir dizi gibi tekrar "Aktif İzlenenler"e girmeli — sonrasında yine aynı kurallara (45 gün izlenmezse Ara Verilenler'e düşme vb.) tabi olmalı.
**Analiz:** Kategorizasyon (`store/tracking/trackingLogic.ts`) tamamen türetilmiş/saf olduğundan (Madde 35/39) iki geçiş zaten OTOMATİKTİ, kod değişikliği gerekmedi:
- **Henüz Başlanmadı → Aktif:** `hasStarted`, doğrudan `showProgressMap[id].completed > 0`'dan hesaplanıyor; bölüm işaretlenince bu zaten güncelleniyordu.
- **Ara Verilenler → Aktif (dizi daha önce hiç `watchedShows`'ta yoksa):** `last_watched_at` bilinmiyorsa `isPaused` güvenli varsayılan olarak `false` kabul ediliyor.
Ama İKİ gerçek boşluk vardı:
1. **Bırakılanlar → Aktif ASLA olmuyordu:** `dropped` kovası tarihten/ilerlemeden TAMAMEN bağımsız, en yüksek öncelikli bir manuel bayraktı (`useTrackingStore.droppedIds`) — bölüm izlemek bu bayrağı hiç temizlemiyordu, dizi progres güncellense bile sonsuza kadar "Bırakılanlar"da kalıyordu.
2. **Ara Verilenler → Aktif (dizi zaten `watchedShows`'ta varsa) ÇALIŞMIYORDU:** `markEpisodeAsWatched`/`markEpisodesUpToAsWatched`/`markSeasonAsWatched` yalnızca `showProgressMap`'i güncelliyordu; `watchedShows`'taki o dizinin `last_watched_at` alanına hiç dokunmuyordu. Bu yüzden 45 günden eski bir `last_watched_at` değeri, yeni bölüm izlense bile eski kalıyor, dizi bir sonraki tam senkronizasyona kadar "Ara Verilenler"de takılı kalıyordu.
**Çözüm:** `services/library/mutations/progress.ts`'e yeni bir `reactivateShowTracking(showId)` yardımcı fonksiyonu eklendi ve dizinin izlenme ilerlemesini artıran ÜÇ giriş noktasının (`markEpisodeAsWatched`, `markEpisodesUpToAsWatched`, `markSeasonAsWatched` — `rewatchEpisode`/`rewatchSeason` bunlara delege ettiği için otomatik kapsanıyor) başına eklendi (geri alma fonksiyonları — `unwatchEpisode`/`unwatchSeason` — BİLİNÇLİ OLARAK dokunulmadı, "izlemeyi geri almak" aktif izleme sinyali değildir):
1. `store/tracking/useTrackingStore.ts`'e yeni `clearDroppedStatus(id)` aksiyonu eklendi (`toggleDroppedStatus`'tan ayrı — o bir flip, bu ise idempotent "varsa kaldır, yoksa no-op"). `reactivateShowTracking` bunu çağırarak manuel "Bırakıldı" bayrağını temizliyor.
2. Aynı fonksiyon, `watchedShows`'ta o diziye ait kaydı bulup `last_watched_at`'i `new Date().toISOString()`'e optimistik olarak güncelliyor (kayıt yoksa — örn. dizi yalnızca watchlist'teyse — dokunmuyor, çünkü trackingLogic zaten "bilinmeyen tarih = aktif" güvenli varsayılanını uyguluyor).
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi (aynı, ilgisiz 4 dosya). `grep` ile `markSeasonAsWatched`/`rewatchSeason`'a giden TÜM yolların (`SeasonAccordion.tsx`, `useShowDetailHandlers.ts`) tek kaynak `services/library/mutations/progress.ts` üzerinden geçtiği, başka bir bypass implementasyonu olmadığı teyit edildi. Trakt girişi bu ortamda engelli olduğu için gerçek veriyle canlı test edilemedi; mantık, `trackingLogic.ts`'in zaten türetilmiş/saf yapısına dayandığı ve yalnızca eksik iki optimistik güncellemeyi (dropped bayrağı + `last_watched_at`) tamamladığı için kod incelemesiyle doğrulandı.

## 43. Diziler > İzleme Kartlarındaki 3-Nokta Menüsü: Konumlandırma Düzeltildi + Listeye Ekle/Favorilere Ekle/Paylaş Eklendi
**Şikayet:** Menü ekranın çok altında açılıyordu (dizinin hizasında değil) ve bazı durumlarda alt navigasyon çubuğunun arkasında kalıyordu. Ayrıca yalnızca "Bırakılanlara Ekle" seçeneği vardı — "Listeye Ekle", "Favorilere Ekle" (kalp), "Paylaş" ve bir "Vazgeç" seçeneği de isteniyordu.
**Kök neden:** `TrackingCardMenu.tsx` (Madde 38/39'da eklenmişti) tam-ekran bir bottom-sheet `Modal`'dı (`justifyContent:'flex-end'`) — panel her zaman ekranın EN ALTINDA açılıyordu, dokunulan karta olan mesafesi listede nerede olduğuna göre değişiyordu (uzun bir listede en üstteki kart için bile menü ekranın dibinde çıkıyordu) ve alt sekme navigasyonunun güvenli alanı hesaba katılmıyordu.
**Çözüm — bottom-sheet yerine bağlamsal (anchored) açılır menü:**
1. `TrackingCardMenu.tsx` baştan yazıldı: 3-nokta tetikleyicisine basılınca `ref.measureInWindow(...)` ile butonun EKRANDAKİ gerçek koordinatı ölçülüyor; menü panel bu koordinatın hemen altında/sağ hizasında, mutlak konumlu (`position:'absolute'`) olarak açılıyor — yani artık gerçekten "dizinin hizasında" çıkıyor. `useWindowDimensions()` + `useSafeAreaInsets()` ile hem yatayda (ekran kenarlarına taşmasın) hem dikeyde (**`insets.bottom` dahil** — alt navigasyon çubuğunun ARKASINA asla düşmesin) kırpılıyor; ekranın üst kısmına yakın açılırsa da `insets.top`'un altına inmiyor. Kartların `overflow:'hidden'` gövdesinden kaçmak için hâlâ bir `Modal` içinde render ediliyor (Madde 38'in çözdüğü kırpılma sorunu korunuyor), ama artık tam ekran değil — yalnızca menü panelinin kendisi.
2. Yeni seçenekler eklendi (artık toplam 5 satır): **Bırakılanlara Ekle/Çıkar** (mevcut), **Listeye Ekle** (`AddToListModal` kendi içinde, `mediaId`/`mediaType="show"` ile açılıyor — ekstra prop taşımaya gerek kalmadan bileşen kendi kendine yeterli), **Favorilere Ekle/Çıkar** (kalp ikonu, aktifken kırmızı dolu; `useLibrarySelector`'dan `favShows` okunup `useLibraryActions().toggleFavoriteStatus` çağrılıyor), **Paylaş** (`Share.share`, `OptionsModal.tsx`'teki desenle aynı URL şeması), **Vazgeç** (eski "İptal" yerine — kullanıcı isteği üzerine, yeni `dismissAction` i18n anahtarı).
3. Kompakt tasarım: eski sürümdeki başlık satırı ve her seçenek altındaki açıklama metni (subtext) kaldırıldı — artık 5 satırlı bir bağlamsal menüde bunlar gereksiz yer kaplardı; her satır yalnızca ikon + tek satır etiket.
**Kapsam:** `TrackingCardMenu` prop arayüzü değişti (`title` kaldırıldı; `id`, `showName`, `tmdbId`, `slug` eklendi — bileşen artık liste/favori/paylaşım aksiyonlarını kendi içinde yürütebilsin diye). Üç çağıran (`EpisodeCardMobile.tsx`, `EpisodeCard.web.tsx`, `components/tracking/ShowTrackCardWeb.tsx`) yeni prop setine güncellendi.
**i18n:** Yeni anahtarlar `addToFavorites`, `removeFromFavorites`, `dismissAction` (TR/EN). Kullanılmayan `dropWatchingSubtext`/`undropWatchingSubtext` (Madde 38'de eklenmişti, artık gösterilmiyor) temizlendi.
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi (aynı, ilgisiz 4 dosya). `grep` ile üç çağıranın da eski `title` prop'unu bırakıp yeni sete geçtiği doğrulandı. Dev sunucusu temiz derlendi, guest/paywall akışı hatasız render edildi. Trakt girişi bu ortamda engelli olduğu için gerçek bir kartta menüyü açıp konumlandırmayı/yeni aksiyonları canlı test edemedim; `measureInWindow` + ekran sınırı/safe-area kırpma mantığı ve `AddToListModal`/`toggleFavoriteStatus`/`Share.share` entegrasyonları kod incelemesiyle (imza uyumu, mevcut `OptionsModal`/`MediaHero` desenleriyle birebir tutarlılık) doğrulandı.

## 44. Otonom Kod Denetimi: OAuth 401 Kilitlenmesi + AsyncStorage CursorWindow Koruması
**Bağlam:** Tüm proje (özellikle `store/`, `services/`, `hooks/`) uçtan uca tarandı ve bir "Stabilizasyon ve Hızlandırma Ana Planı" hazırlandı (kritik tehditler, performans darboğazları, mimari öneriler). Bu maddede, planın Faz 1'inden yalnızca en kritik iki madde (OAuth token yaşam döngüsü + AsyncStorage/Android CursorWindow riski) koda geçirildi; kalan maddeler (rate-limit backoff, granüler selector'lar, global countdown, hata standardizasyonu, cache invalidation) planda belgeli ama henüz uygulanmadı.

**1. OAuth 401 Interceptor Kilitlenmesi (`services/api/traktClient.ts`):**
- **Gerçek kök neden** (ilk varsayımdan — "kuyruğa yeni token yazılmıyor" — farklı çıktı; o kısım zaten doğruydu): `refreshToken` SecureStore'da yoksa, kod `isRefreshing = true` set ettikten SONRA erken `return` ediyordu ve bu dalda `isRefreshing` HİÇBİR ZAMAN `false`'a dönmüyordu (yalnızca asıl refresh denemesinin `try/finally`'si bunu yapıyordu, "refresh token yok" dalı bu bloğun tamamen dışındaydı). Sonuç: bir kez bu duruma düşüldüğünde `isRefreshing` sonsuza dek `true` kalıyor, sonraki HER 401 `failedQueue`'ya ekleniyor ama `processQueue()` bir daha asla çağrılmadığı için o istekler sonsuza dek çözülmeyen bir Promise'te asılı kalıyordu — ekranlar sessizce "yükleniyor" durumunda donuyordu.
- **Çözüm:** "Refresh token yok" dalı artık `isRefreshing = false` set ediyor VE `processQueue(error, null)` çağırıp kuyruktaki her isteği reddediyor. Asıl refresh denemesi (`try/catch/finally`) değişmedi, zaten doğru reset ediyordu.
- **İkincil düzeltme (thrash önleme):** `originalRequest._retry = true` artık kuyruğa girme kontrolünden ÖNCE, isteğin kendisine (yalnızca refresh'i başlatan isteğe değil) işaretleniyor — böylece kuyruktan yeni token'la tekrar denenen bir istek YİNE 401 alırsa (örn. token hemen sonra da geçersizse), bağımsız yeni bir refresh döngüsü tetiklemek yerine doğrudan reddediliyor.
- **Üçüncül düzeltme (kaynak sızıntısı):** Başarılı refresh sonrası modül seviyesindeki `cachedAccessToken` artık güncelleniyor; güncellenmezse `getTraktClient()` bir sonraki çağrıda SecureStore'daki (yeni) token'la eşleşmediğini sanıp gereksiz yeni bir axios instance + yeni bir response interceptor daha kuruyordu (her token yenilemesinde bir tane daha üst üste yığılıyordu).
- **Sessiz oturum kapanması (`context/AuthContext.tsx`):** `traktClient.ts`'e yeni `onSessionExpired(listener)` pub/sub eklendi. Refresh tamamen başarısız olduğunda (kötü/eksik refresh token) artık `notifySessionExpired()` çağrılıyor; `AuthContext` buna abone olup `accessToken`'ı `null`'a çekiyor. ESKİ DAVRANIŞ: SecureStore'daki token'lar interceptor tarafından silinse bile `AuthContext`'in React state'i bundan habersizdi — UI "giriş yapılmış" sanmaya devam edip her istekte tekrar 401 alıyordu; artık `(protected)/_layout.tsx`'teki guard bu state değişimini görüp kullanıcıyı otomatik olarak `/` (public) sayfasına yönlendiriyor.

**2. AsyncStorage Chunk/Batch Koruması (`services/library/utils.ts`, `fetchers.ts`, `mutations/progress.ts`, `mutations/collections.ts`):**
- **Risk:** `showProgressMap` (her dizi için TÜM sezon/bölüm `completed` durumları) tek bir AsyncStorage anahtarı altında TEK bir dev JSON string olarak saklanıyordu. Büyük kütüphanelerde (binlerce dizi) bu satır Android'in varsayılan SQLite CursorWindow limitini (~1-2MB) aşıp o anahtarın hem okunmasını hem yazılmasını patlatabilir — `fetchers.ts`'teki mevcut `safeMultiGet` yorumu zaten bu riski "tek bir aşırı büyük satır" olarak tarif ediyordu, ama yalnızca OKUMA tarafında (per-key fallback) korunuyordu; YAZMA tarafında hiçbir koruma yoktu.
- **Çözüm:** `services/library/utils.ts`'e `writeChunkedRecord(baseKey, record, {silent?})` / `readChunkedRecord(baseKey)` eklendi — bir haritayı (`Record<id, data>`) 100'lük sabit boyutlu parçalara bölüp her parçayı ayrı bir anahtara (`{baseKey}__c0`, `__c1`, ...) yazar; hangi parçaların var olduğunu bir `{baseKey}__meta` anahtarında tutar. Okuma tarafında her parça BAĞIMSIZ parse edilir — biri bozuksa yalnızca o parçadaki (en fazla 100 dizi) ilerleme kaybolur, tüm harita değil. Parça sayısı önceki yazımdan azaldıysa (örn. dizi silme) artık kullanılmayan eski parçalar `multiRemove` ile temizlenir. Eski (chunk'lanmamış) tek-parça formatına geriye dönük okuma uyumluluğu korundu (meta yoksa düz anahtar denenir).
- **`persistShowProgressMap(map)`** eklendi — `progress.ts`'teki 7 ve `collections.ts`'teki 1 `safeStorageSet(CACHE_KEYS.showProgressMap, JSON.stringify(updated))` çağrısının hepsi bu tek fonksiyona yönlendirildi (davranış: hata halinde "Depolama Dolu" uyarısı gösterir, aynı `safeStorageSet` gibi — kullanıcı doğrudan bir bölüm/sezon işaretlediğinde tetiklenen kritik yazımlar için uygun).
- **`fetchers.ts`** iki farklı yazım noktası ayrı ele alındı: arka planda sık tetiklenen ara "checkpoint" yazımı (her 4 ağ chunk'ında bir) ve senkron sonu "final" yazımı artık `writeChunkedRecord(..., {silent:true})` kullanıyor — bunlar kullanıcı eylemi değil otomatik arka plan senkronu olduğundan, hata olursa sessizce loglanır, art arda Alert spam'i gösterilmez (eski davranışla aynı: bu iki nokta zaten `.catch(() => {})` ile sessizdi).
- **Delta-sync regresyonu önlendi:** `fetchFreshData`'daki `oldProgressMap` artık `safeMultiGet`'in düz anahtar listesinden değil, ayrı bir `readChunkedRecord(CACHE_KEYS.showProgressMap)` çağrısıyla okunuyor. Bu değişiklik yapılmasaydı (düz anahtar chunk'lanmış formata geçtiği için hep boş dönerdi) `oldProgressMap` her zaman `{}` olur, delta-sync'in "hangi diziler değişti" kontrolü (`!oldProgressMap[traktId]`) HER diziyi "değişmiş" sayıp Madde 5'te kurulan delta-sync optimizasyonunu tamamen devre dışı bırakırdı — her açılışta tam senkron.
- **`loadCache()`** artık `showProgressMap`'i `readChunkedRecord` ile okuyor (`getParsed` yerine); diğer anahtarlar değişmedi.
**Doğrulama:** `tsc --noEmit` yalnızca önceden var olan, bu değişikliklerle ilgisiz hatalar veriyor (`CommentItem.tsx`, `useShowDetail.ts`, `locales/index.ts`, `locales/languageDetector.ts` — hiçbiri bu maddede dokunulan dosyalarla ilgili değil); değiştirilen 6 dosyada (`traktClient.ts`, `AuthContext.tsx`, `fetchers.ts`, `library/utils.ts`, `mutations/progress.ts`, `mutations/collections.ts`) sıfır hata. `grep` ile `CACHE_KEYS.showProgressMap`'in artık yalnızca `writeChunkedRecord`/`readChunkedRecord`/`persistShowProgressMap` üzerinden dokunulduğu, eski düz `safeStorageSet`/`AsyncStorage.setItem` çağrısı kalmadığı teyit edildi. Trakt girişi bu ortamda engelli olduğu için 401/refresh akışı ve büyük kütüphaneli chunk yazımı canlı/cihaz üzerinde test edilemedi; değişiklikler kod incelemesiyle (tip kontrolü + tüm çağıran/okuyan noktaların tam taranması) doğrulandı — gerçek cihazda (özellikle Android + büyük Trakt kütüphanesi) doğrulama önerilir.

## 45. Faz 2 — Performans: Granüler Selector'lar, O(1) Lookup'lar ve Tekil Global Geri Sayım
**Bağlam:** Madde 44'teki Stabilizasyon Planının Faz 2'sinden (performans darboğazları) iki madde uygulandı: dizi detay ekranındaki gereksiz yeniden hesaplama + iç içe `.find()` zinciri, ve her karttaki bağımsız `setInterval` sızıntısı.

**1. Granüler Selector + O(1) Lookup (`hooks/useShowDetail.ts`, `app/show/[id].tsx`, `services/library/fetchers.ts`):**
- **Önceki durum:** `useShowDetail(traktIdNum, tmdbId, showProgressMap)` — TÜM `showProgressMap` nesnesi parametre olarak geçiyor ve içindeki `useMemo`'nun bağımlılık dizisindeydi. `setShowProgressMap((prev) => ({...prev, ...chunkResults}))` her arka plan senkron chunk'ında (ve HERHANGİ bir dizinin ilerlemesi her güncellendiğinde) YENİ bir map referansı üretir — kullanıcı Dizi A'nın detayında dururken arka planda Dizi B senkronlansa bile `showProgressMap` referansı değişir, bu da `computedSeasons` `useMemo`'sunu (dizinin TÜM sezon/bölüm listesini yeniden map'leyip her sezon için `.find()`, her bölüm için `seasonProgress.episodes.find()` çalıştıran ağır bir hesaplama) gereksiz yere yeniden tetikliyordu. Büyük sezonlu yapımlarda (200+ bölümlü animeler gibi) sezon içi bölüm araması gerçek bir O(bölüm_sayısı²) darboğazıydı.
- **Çözüm:**
  1. `app/show/[id].tsx`: `useLibrary()`'den `showProgressMap` (tüm harita) çekmek yerine `useLibrarySelector(s => s.showProgressMap[traktIdNum])` ile YALNIZCA bu dizinin ilerleme nesnesi okunuyor. Store'daki immutable güncelleme deseni (`{...prev, [id]: yeni}`) sayesinde İLGİSİZ bir dizi güncellendiğinde bu nesnenin referansı SABİT kalıyor — bileşen gereksiz yeniden render tetiklemiyor.
  2. `hooks/useShowDetail.ts`: parametre `showProgressMap` → `showProgress` (tek dizinin nesnesi) olarak değişti; `useMemo` bağımlılığı `[mediaData.seasons, showProgressMap, traktIdNum]` → `[mediaData.seasons, showProgress]`. İç mantık: sezon numarası → ilerleme ve bölüm numarası → `completed` eşlemeleri artık her render'da `.find()` ile taranan dizi değil, sezon başına bir kez kurulan `Map`'ler üzerinden O(1) okunuyor.
  3. `computedSeasons`'ın her öğesine artık ham `seasonProgress` nesnesi de (`seasonProgress: seasonProgress || null`) ekleniyor — `app/show/[id].tsx`'teki `<SeasonAccordion seasonProgress={showProgressMap[traktIdNum]?.seasons?.find(...)}/>` satırındaki İKİNCİ (aynı veriyi tekrar arayan) `.find()` çağrısı tamamen kaldırıldı, doğrudan `season.seasonProgress` kullanılıyor.
  4. `services/library/fetchers.ts`: delta-sync'te `oldProgressMap` artık düz obje (`Record<string, any>`, `obj[id]` erişimi) değil gerçek bir `Map<number, any>` — binlerce dizili büyük kütüphanelerde düz obje üzerinde sayısal-benzeri anahtarlarla `dictionary mode`a düşme riskini ortadan kaldırıp garantili O(1) erişim sağlıyor (`showsData.forEach`/`wlistShows.forEach` içindeki iki sorgu noktası `.has()`'e çevrildi). `calShowIds` inşa eden üç ayrı `forEach` (calShows/showsData/wlistShows) incelendi — zaten O(n) + `Set.add` (O(1)) kullanıyorlar, gerçek bir darboğaz bulunmadı, dokunulmadı.

**2. Tekil Global Geri Sayım (`store/useGlobalCountdownStore.ts` — yeni, `hooks/useAirCountdown.ts`):**
- **Önceki durum:** `useAirCountdown` her çağrıldığında (dizi/film kartı başına bir kez — `EpisodeCard.web.tsx`, `EpisodeCardActions.tsx`, `MovieCard.web.tsx`, `MovieCardMobile.tsx`) kendi `setInterval(60s)`'ını açıyordu. Explore/Grid gibi 50-100+ kartlı ekranlarda aynı anda onlarca bağımsız timer RAM'de birikip, özellikle uzun kaydırma sonrası cihazı yavaşlatıyordu.
- **Çözüm:** Yeni `store/useGlobalCountdownStore.ts` — yalnızca `now: number` tutan minimal bir Zustand store + modül seviyesinde (reaktif olmayan, `traktClient.ts`'teki `isRefreshing`/`failedQueue` deseniyle aynı) bir abone sayacı. `subscribeToGlobalCountdown()`/`unsubscribeFromGlobalCountdown()`: abone sayısı 0→1 olduğunda TEK bir `setInterval(60s)` başlar, 1→0 olduğunda durur — ekranda kaç kart olursa olsun her zaman en fazla 1 timer çalışır. Yeni abone olan her bileşen mount anında `now`'ı hemen `Date.now()`'a senkronize eder (60s'lik ilk tick'i beklemeden) — eski hook'taki "İlk hesaplamayı hemen yap" garantisi korunmuş oldu. `useAirCountdown`'ın PUBLIC arayüzü (parametre/dönüş tipi) değişmedi — dört çağıran dosyada da tek satır değişikliği bile gerekmedi, tamamen iç implementasyon değişikliği.
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi (aynı, önceden var olan, ilgisiz hatalar — `useShowDetail.ts`'teki implicit-any uyarıları da dahil, satır numaraları eklenen yorumlar yüzünden kaydı ama hata içeriği aynı). Web derlemesi temiz (2900+ modül, sıfır bundler hatası), açılış ekranı hatasız render edildi. `grep` ile `useShowDetail`'in tek çağrı noktasının (`app/show/[id].tsx`) ve `useAirCountdown`'ın dört çağrı noktasının (`EpisodeCard.web.tsx`, `EpisodeCardActions.tsx`, `MovieCard.web.tsx`, `MovieCardMobile.tsx`) hepsinin yeni imzayla/davranışla uyumlu olduğu doğrulandı. Trakt girişi bu ortamda engelli olduğu için dizi detay ekranı ve kartlı bir liste canlı açılıp gerçek `showProgressMap` güncellemeleriyle re-render sayısı / timer sayısı ölçülemedi (DevTools Profiler / `setInterval` sayacı ile); değişiklikler kod incelemesiyle doğrulandı — gerçek cihazda (özellikle uzun bir Explore/Grid listesinde ve büyük bir kütüphanede) doğrulama önerilir.

## 46. Faz 2 (devamı) — Dizi Detay Ekranının Kalan `useLibrary()` Aboneliği + İki Denetlenip Reddedilen Öneri
**Bağlam:** Madde 45'te `showProgressMap` için başlatılan granüler selector geçişi tamamlandı; ayrıca Madde 44/45'teki ana planda yer alan iki maddeyi (FlatList `keyExtractor`, Web'de image lazy-load) kodda incelendi — ikisi de zaten doğru/çözülmüş çıktı, gereksiz "düzeltme" yapılmadı (bkz. aşağıda "İncelenip dokunulmayanlar").

**1. `app/show/[id].tsx` + `hooks/useShowDetailHandlers.ts`: Kalan `useLibrary()` çağrıları granüler hale getirildi.**
- **Önceki durum:** İki dosya da hâlâ `useLibrary()` (TÜM store'u `useShallow` ile subscribe eden proxy hook) çağırıyordu — `showProgressMap` Madde 45'te ayrıştırılmış olsa da, `watchlistShows`, `favShows`, `userRatingsShows`, `userRatingsEpisodes` ve aksiyon fonksiyonları (`toggleWatchlistStatus`, `toggleFavoriteStatus`, `hideMediaFromProgress`, `deleteMediaFromHistory`, `markSeasonAsWatched`, `unwatchSeason`, `setLocalRating`, `removeLocalRating`, `unwatchEpisode`, `rewatchEpisode`) hâlâ geniş abonelik üzerinden geliyordu — kütüphanedeki AYRI bir dizinin puanı/watchlist durumu değişince bile bu ekran (ve `useShowDetailHandlers`) gereksiz yeniden render oluyordu.
- **Çözüm:**
  1. `app/show/[id].tsx`: `isWatchlisted`/`isFavorited` artık `watchlistShows?.some(...)`/`favShows?.some(...)` sonucu bileşen içinde her render'da yeniden hesaplanmıyor — doğrudan `useLibrarySelector(s => s.watchlistShows?.some(...))` / `useLibrarySelector(s => s.favShows?.some(...))` ile store seviyesinde boole olarak seçiliyor. `userRatingsEpisodes` de granüler `useLibrarySelector` ile okunuyor.
  2. Aksiyon fonksiyonları (`toggleWatchlistStatus`, `toggleFavoriteStatus`, `hideMediaFromProgress`, `deleteMediaFromHistory`) `useLibraryActions()`'a taşındı — bu hook store'a HİÇ abone olmaz (servis fonksiyonları modül seviyesinde sabittir, yalnızca `accessToken` değişince yenilenir; bkz. Madde'siz zaten var olan `context/LibraryContext.tsx` tasarımı).
  3. `useShowDetailHandlers.ts`'te aynı desen: `userRatingsShows` → `useLibrarySelector`, `markSeasonAsWatched`/`unwatchSeason`/`setLocalRating`/`removeLocalRating`/`unwatchEpisode`/`rewatchEpisode` → `useLibraryActions()`.
  4. **Yan bulgu (ölü kod):** Her iki dosyada da `useLibrary()`'den çekilen `userRatingsShows` (show/[id].tsx) ve `userRatingsEpisodes` (useShowDetailHandlers.ts) `grep` ile dosya içinde HİÇ kullanılmadığı doğrulanıp kaldırıldı (muhtemelen `useShowDetailHandlers` ayrıştırılırken artık gereksiz kalan kalıntılar).
  5. Sonuç: bu iki dosya artık `useLibrary()`'yi HİÇ çağırmıyor (`app/show/[id].tsx`'teki gereksiz kalan `useLibrary` import'u da temizlendi) — dizi detay ekranı artık yalnızca gerçekten okuduğu 4 dilime (progress/watchlist/favori/puan) ve aksiyonlara bağımlı, kütüphanedeki başka hiçbir değişiklik onu tetiklemiyor.

**2. İncelenip dokunulmayanlar (planda "sorun" olarak işaretlenmiş ama koda bakınca gerçek çıkmayan iki madde):**
- **FlatList `keyExtractor`:** `components/tracking/TrackingAccordionList.tsx`/`.web.tsx` (Madde 44/45'teki ana planın "performans darboğazı" listesinde "zayıf keyExtractor" olarak işaretlenmişti) incelendi — satırlar zaten `key: \`${key}-${card.id}\`` biçiminde, kategori+dizi-id'sinden türetilen gerçek anlamda benzersiz ve kararlı bir anahtar kullanıyor, index tabanlı değil. Projedeki diğer tüm `FlatList`/`SectionList` kullanımları da (`grep` ile tek tek tarandı: `MoviesMobile.tsx`, `LibraryMobile.tsx`, `HorizontalMediaList.tsx`, `ExploreWebGrid.tsx`, `explore.tsx`, `library/[type].web.tsx`, `MediaCast.tsx`, `WebCarousel.tsx` vb.) `item.id` veya `${item.id}-${index}` bileşik anahtarları kullanıyor — hiçbirinde sadece `index` tabanlı bir anahtar bulunmadı. Bu madde koda bakılmadan (kod okunmadan yalnızca "büyük listelerde genelde olur" varsayımıyla) yazılmış yanlış bir teşhisti; dokunulmadı.
- **Web'de image lazy-load:** `components/MediaPoster.tsx` + `services/tmdbApi.ts` incelendi — poster/afiş yükleme zaten `FlatList`/`WebCarousel` (aynı alttaki `VirtualizedList` mekanizması, `react-native-web`'de de windowing yapar) içinde render edildiğinden, ekran dışındaki hücreler hiç mount OLMUYOR — `MediaPoster`'ın `useEffect`'i (TMDB isteğini atan yer) yalnızca hücre gerçekten mount olduğunda çalışıyor; bu, Madde 15'te kurulan "yalnızca görünüre girince çek" garantisiyle aynı sonucu (fiili lazy-load) zaten sağlıyor. Ayrıca `expo-image`'in `cachePolicy="disk"`'i ve `tmdbApi.ts`'teki 150 girişlik LRU bellek-içi önbellek + senkron `peekPosterCache` (spinner flaşını önlüyor) üst üste iki katman koruma sağlıyor. Ek bir IntersectionObserver katmanı eklemek zaten var olan virtualization'ın üstüne gereksiz karmaşıklık eklerdi; dokunulmadı.
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi (aynı, önceden var olan, ilgisiz hatalar). `grep` ile `app/show/[id].tsx` ve `hooks/useShowDetailHandlers.ts`'te artık `useLibrary()` çağrısı kalmadığı (yalnızca açıklayıcı yorumlarda adı geçiyor) doğrulandı. Web derlemesi temiz, sunucu log'unda hata yok. Trakt girişi bu ortamda engelli olduğu için dizi detay ekranı canlı açılıp gerçek re-render sayısı ölçülemedi; değişiklikler kod incelemesiyle doğrulandı.

## 47. Faz 3 — Hata Standardizasyonu (Error Buffer) ve Merkezi Cache TTL Katmanları
**Bağlam:** Kullanıcı Faz 1/2'yi gerçek cihaz + Trakt hesabıyla stres testine soktuğu sırada, plandaki Faz 3'ün iki somut talebi (hata günlüğü, profesyonel cache TTL standardı) koda geçirildi. Faz 1/2'de dokunulan dosyalardaki (canlı test edilen) kontrol akışı BİLİNÇLİ OLARAK değiştirilmedi — yalnızca EKLENTİ niteliğinde `logError(...)` çağrıları eklendi (mevcut throw/rollback/console.error davranışı birebir korunarak); tam bir "mutation'lar `{success,error}` döndürsün" rewrite'ı bilinçli olarak kapsam dışı bırakıldı (bkz. "Bilinçli kapsam dışı" bölümü).

**1. Yeni `utils/errorLog.ts` — kalıcı hata günlüğü (ring buffer, en fazla 50 kayıt).**
`logError(context, error)`: AsyncStorage'a `{timestamp, context, message, stack}` ekler; art arda hızlı çağrılarda (örn. ağ kopması sırasında peş peşe başarısız istekler) entry kaybını önlemek için yazmalar sıralı bir `writeQueue` promise zincirine alınır (paralel read-modify-write yarışı yok). `getErrorLog()`/`clearErrorLog()` de dışa açıldı — ileride bir "Ayarlar > Hata Günlüğü" tanılama ekranı veya destek talebine log ekleme özelliği için hazır altyapı (henüz UI eklenmedi, kapsam dışı).
Wired edildiği (ekleme, davranış değişikliği YOK) noktalar:
- `services/api/traktClient.ts`: 401 sonrası refresh token yok / refresh başarısız iki dalda da (`notifySessionExpired()`'dan hemen önce).
- `services/library/fetchers.ts`: `fetchFreshData`'nın en dıştaki `catch`'i.
- `services/library/mutations/progress.ts`: 6 mutation'ın (markEpisodeAsWatched, unwatchEpisode, unwatchSeason, markSeasonAsWatched, markEpisodesUpToAsWatched, markMovieAsWatched) tamamındaki `catch` blokları.
- `services/library/mutations/collections.ts`: 7 mutation'ın (toggleWatchlistStatus, toggleFavoriteStatus, hideMediaFromProgress, deleteMediaFromHistory, createNewList, toggleMediaInList, deleteListById) tamamındaki `catch` blokları.

**2. Yeni `utils/cacheTTL.ts` — TEK kaynaktan yönetilen cache TTL katmanları.**
Öncesinde TTL süreleri (`utils/cacheManager.ts`'teki `CACHE_LIFETIME_MS = 6 saat`, `fetchers.ts`'teki `tenMinutes = 10 dk` ve `TTL_48_HOURS = 48 saat`) üç farklı dosyaya gömülü "sihirli sayılar"dı. Artık tek bir `CACHE_TTL` nesnesinde: `SYNC_INTERVAL` (10 dk), `STANDARD` (6 saat), `LONG` (7 gün — YENİ katman), `CALENDAR_SEASONS` (48 saat).
- `utils/cacheManager.ts`: `get<T>(key, ttlMs = CACHE_TTL.STANDARD)` — opsiyonel parametre haline getirildi, varsayılan STANDARD ile eski davranış (6 saat) birebir korundu. Mevcut üç çağıran (`useShowDetail.ts`, `useEpisodeDetail.ts`, `tmdbApi.ts`'in eski hali) hiçbir değişiklik gerekmeden aynı şekilde çalışmaya devam eder.
- `services/library/fetchers.ts`: `tenMinutes`/`TTL_48_HOURS` yerel sabitleri silindi, `CACHE_TTL.SYNC_INTERVAL`/`CACHE_TTL.CALENDAR_SEASONS` kullanılıyor — **sayısal değerler BİREBİR aynı**, yalnızca merkezi kaynağa taşındı, davranış değişmedi (kullanıcının şu an test ettiği delta-sync/takvim zamanlaması etkilenmedi).
- `services/tmdbApi.ts`: poster/afiş URL önbelleği (`getShowPoster`/`getMoviePoster`'ın kullandığı `getCachedData`) artık `cacheManager.get<string>(key, CACHE_TTL.LONG)` — **tek gerçek değer değişikliği**: TMDB'de var olan bir yapımın afiş yolu neredeyse hiç değişmediğinden TTL 6 saatten 7 güne çıkarıldı, gereksiz TMDB API çağrıları azaltıldı. Backdrop/trailer/cast/still'lar zaten yalnızca bellek-içi LRU kullanıyor (disk cache'e hiç girmiyor), onlara dokunulmadı.

**Bilinçli kapsam dışı bırakılanlar (canlı test riskini azaltmak için):**
- Mutation'ların dönüş tipini (`{success, error}` gibi) standardize etmek — bu, çağıran onlarca hook/ekranı da değiştirmeyi gerektirir; kullanıcı Faz 1/2'yi telefonunda test ederken bu genişlikte bir davranış değişikliği riske girmeye değmezdi. Mevcut throw/rollback deseni korundu, yalnızca ek log çağrısı eklendi.
- `handleMarkSeason`/`handleUnwatchEpisode`/`handleRewatchEpisode` (`hooks/useShowDetailHandlers.ts`) gibi hâlâ sessizce (yalnızca `console.error`, Alert YOK) başarısız olan UI-katmanı handler'ları — bunlara Alert eklemek görsel/UX bir değişiklik olduğundan, arka plan/servis katmanındaki bu turdan ayrı, kullanıcı onayı sonrası ele alınmak üzere bırakıldı.
- Cache invalidation'da yeni bir "mutation sonrası ilgili anahtarı temizle" tetikleyicisi eklenmedi — inceleme sonucu `@show_detail_v3_*` önbelleğinin (özet/kadro/ilişkili) izleme ilerlemesinden bağımsız olduğu (ilerleme `showProgressMap`'ten ayrı okunuyor, cache'e hiç yazılmıyor) doğrulandı; yani "izlendi işaretlemesi sonrası cache bayatlıyor" türünde gerçek bir sorun bulunamadı, uydurma bir tetikleyici eklenmedi.
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi (aynı, önceden var olan, ilgisiz hatalar). `grep` ile `tenMinutes`/`TTL_48_HOURS`/`CACHE_LIFETIME_MS` adlarının kod tabanında (yalnızca `cacheTTL.ts`'in açıklayıcı yorumu hariç) kalmadığı doğrulandı. Web derlemesi temiz, sunucu log'unda hata yok, açılış ekranı hatasız. Trakt girişi bu ortamda engelli olduğu için gerçek bir mutation hatası tetiklenip `getErrorLog()` çıktısı canlı doğrulanamadı; kod incelemesiyle (fonksiyon imzaları, tüm çağrı noktaları) doğrulandı.

## 48. LibraryMobile'da Liste Sonunda Kaydırma Sonrası Donma (Scroll Jump) Düzeltmesi
**Sorun:** Profil sayfasından geçiş yapılan Kütüphane listelerinde (örn. Diziler, Filmler) kullanıcı listenin en altına kadar kaydırıp biraz daha yukarı çektiğinde (overscroll), ekran 1-2 saniyeliğine yukarı sıçrayıp donuyor, sonra geri geliyordu. Bunun sebebi, performans optimizasyonu için kullanılan `getItemLayout` metodunun, sayfanın en üstündeki `paddingTop: SPACING` değerini (8px) hesaba katmaması ve listenin altındaki `paddingBottom: 40` boşluğunun `FlatList`'in kendi iç hesaplamalarını (content size vs measured size) şaşırtmasıydı. Aradaki birkaç piksellik fark, listenin sonunda FlatList'in zorla "offset correction" yapmasına ve cihazın kısa süreli kilitlenmesine neden oluyordu.
**Çözüm:**
1. `screens/LibraryMobile.tsx` içindeki `getItemLayout` metodunda hesaplanan `offset` değerine baştaki padding (`SPACING`) eklendi: `offset: SPACING + (ROW_HEIGHT * row)`.
2. `FlatList`'in kafasını karıştıran `contentContainerStyle` içindeki `paddingBottom: 40` silinip, listeye `ListFooterComponent={<View style={{ height: 40 }} />}` olarak dahil edildi. Footer'lar FlatList tarafından otomatik olarak hatasız ölçülür.
**Sonuç:** `FlatList`'in sanal hesapladığı yükseklik ile ekrandaki fiziksel ölçümler milimetrik olarak eşleşti ve liste sonundaki donma / sıçrama bug'ı giderildi.

## 49. Faz 4 — Rate Limiting & Circuit Breaker (Üstel Geri Çekilme, Devre Kesici, İstek Kuyruğu)
**Bağlam:** Madde 44'teki Stabilizasyon Planının Faz 4'ü (rate-limit backoff) koda geçirildi. Trakt API sık 429 (Too Many Requests) döndürüyordu: `traktClient.ts` 429'da SABİT 2.5s bekleyip SINIRSIZ tekrar deniyordu (bir endpoint kalıcı 429 dönerse istemci sonsuza dek aynı hızda vurmaya devam ederdi), `fetchFreshData`'nın üst üste binen çağrılarına karşı hiçbir kilit yoktu ve arka plan senkron aşamaları (TIER1/2/3 + ilerleme/takvim sezonları chunk döngüleri) network bağlantı limitini gözetmeden birbirine paralel ateşleniyordu.

**1. Yeni `utils/exponentialBackoff.ts`.**
`calculateBackoffDelay(attempt, retryAfterHeader?)`: sunucunun `Retry-After` header'ı (saniye ya da HTTP-date biçiminde) varsa ona uyar; yoksa 2s → 4s → 8s → 16s → 32s... şeklinde üstel büyüyüp 5 dakikada tavanlanan bir gecikme hesaplar, üzerine thundering-herd'i kırmak için %0-20 rastgele jitter ekler.

**2. Yeni `utils/circuitBreaker.ts`.**
`CircuitBreaker` sınıfı: CLOSED → (5 art arda hata) → OPEN (30sn, istekler `canRequest()` ile anında reddedilir, ağa hiç gitmez) → (süre dolunca lazy) → HALF_OPEN (yalnızca TEK yoklama isteğine izin verilir — `halfOpenProbeInFlight` bayrağı ile) → başarılıysa CLOSED, başarısızsa tekrar OPEN. `getCircuitBreaker(key)` ile endpoint başına ayrı bir breaker tutulur (bir dizinin `/progress/watched` isteği başarısız oluyor diye TÜM dizilerin isteği bloklanmasın); `normalizeEndpointKey(url)` sayısal path segmentlerini (`/shows/123/...` → `/shows/:id/...`) normalize ederek aynı ENDPOINT TÜRÜNÜN tek bir breaker'da izlenmesini sağlar.

**3. Yeni `services/api/requestQueue.ts`.**
`requestQueue.enqueue(task, priority, deadlineMs?)`: CRITICAL/NORMAL/LOW üç öncelik seviyesi, aynı anda en fazla 3 görev çalıştıran merkezi bir eşzamanlılık sınırı, kuyrukta en fazla 50 bekleyen görev (dolunca en düşük öncelikli görev feda edilir) ve 5 dakikayı aşan (deadline) görevlerin sessizce elenmesi.

**4. `services/api/traktClient.ts` entegrasyonu (401 refresh akışına DOKUNULMADI — canlı test edilen kritik yol korundu):**
- Yeni bir `request` interceptor'ı her istekten önce `normalizeEndpointKey(url)` ile breaker'ı sorar; `canRequest()` false ise (devre OPEN) istek AĞA HİÇ GÖNDERİLMEDEN `isCircuitBreakerRejection` bayraklı bir hata ile reddedilir — spesifikasyondaki "queue'ye gitme" davranışı.
- `response` interceptor'ının başarı dalı ilgili breaker'a `onSuccess()` işler.
- 429 dalı: ESKİ sabit-2.5s/sınırsız-retry davranışı kaldırıldı; artık her 429'da breaker'a `onFailure()` işlenir, `calculateBackoffDelay` ile (config üzerinde tutulan `_retryAttempt` sayacıyla) artan gecikmeyle tekrar denenir. Sınırsız retry riski KENDİLİĞİNDEN ortadan kalkar: art arda 5 başarısızlık sonrası breaker OPEN'a geçer, bir sonraki `instance(originalRequest)` çağrısı request interceptor'da ağa hiç gitmeden anında reddedilir.
- 5xx / yanıtsız ağ hatalarında da breaker'a `onFailure()` işlenir; 429/5xx DIŞI bir yanıt (401/400/403/404 gibi) gelirse `onSuccess()` işlenir — aksi halde HALF_OPEN'daki tek yoklama denemesi hiç "sonuçlanmamış" sayılıp `halfOpenProbeInFlight` bayrağı sonsuza dek takılı kalır, breaker asla CLOSED'a dönemezdi.

**5. `services/library/fetchers.ts` entegrasyonu:**
- Yeni bir `isFetchingFreshData` kilidi + `FETCH_LOCK_TIMEOUT_MS` (5 dk) güvenlik ağı eklendi: `fetchFreshData` çalışırken üst üste binen bir çağrı (örn. bir mutation sonrası tetiklenen resync ile uygulamanın arka plandan öne gelmesinin tetiklediği resync çakışırsa) sessizce atlanır. Kilit, fonksiyonun erken dönüşünden SONRA da arka planda süren asıl ağır iş (ilerleme + takvim sezonları chunk döngüsünü içeren trailing IIFE, artık `backgroundWork` adıyla referans tutuluyor) bitene kadar açık tutulur — `.finally(releaseFetchLock)` ile; senkron donarsa timeout kilidi zorla açar.
- TIER1 (kritik ana ekran istekleri) → `requestQueue.enqueue(..., 'CRITICAL')`, TIER2 (filmler sekmesi) → `'NORMAL'`, TIER3 (geçmiş/puanlar/listeler) → `'LOW'`, ilerleme (`getShowProgress`) ve takvim sezonları (`getShowSeasons`) chunk döngüleri → `'LOW'`.
- **Yan bulgu (kod incelemesinde tespit edilen gizli darboğaz):** TIER3'ün 7 isteği (`getWatchedMovies`, `getCustomLists`, `getLikedShows`, `getLikedMovies`, 3× `getUserRatings`) `Promise.all` ile HİÇBİR eşzamanlılık sınırı olmadan aynı anda ateşleniyordu — TIER1'in "tarayıcının 6 connection limitini aşmamak için sadece 3 istek" disiplinini tamamen görmezden gelen, 429'ların gerçek gizli kaynaklarından biri. `requestQueue`'nun paylaşılan eşzamanlılık sınırına (3) alınarak düzeltildi; artık CRITICAL/NORMAL istekleriyle aynı kuyrukta yarıştıklarında öncelik her zaman onlarda kalıyor.
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi (aynı, önceden var olan, ilgisiz 4 dosya — `CommentItem.tsx`, `useShowDetail.ts`, `locales/index.ts`, `locales/languageDetector.ts`); yeni/değiştirilen 5 dosyada (`exponentialBackoff.ts`, `circuitBreaker.ts`, `requestQueue.ts`, `traktClient.ts`, `fetchers.ts`) sıfır hata. Web derlemesi temiz (2909 modül, sıfır bundler hatası), açılış (public landing) sayfası hatasız render edildi; konsolda beklenen `Network Error` (bu sandbox ortamının dış ağ erişimi kapalı, Trakt girişi de bu ortamda engelli) DIŞINDA hata yok — bu da yeni request/response interceptor zincirinin normal (giriş gerektirmeyen trending) istekleri bozmadığını doğruluyor. Circuit breaker state geçişleri, backoff hesaplaması (jitter/header parse) ve queue'nun deadline/eviction mantığı bu ortamda gerçek 429 trafiğiyle canlı tetiklenip test edilemedi (proje jest/test altyapısı içermiyor); değişiklikler kod incelemesiyle (state machine mantığı, tüm çağrı noktaları, mevcut 401 akışının bit bit korunduğu) doğrulandı — gerçek cihazda büyük bir kütüphaneyle (çok sayıda dizi/bölüm) yoğun senkron sırasında doğrulama önerilir.

## 50. Faz 5 — Cache Invalidation: `refreshData()`'nın Diskteki Bayat Veriyi Geri Döndürme Hatası
**Bağlam:** Madde 44'teki Stabilizasyon Planının Faz 5'i (cache invalidation) ele alındı. Plan maddesi mutation'lar sonrası `@show_detail_v3_*` bayatlığını hedef alıyordu; kod incelemesi asıl kök nedeni planda yazılandan FARKLI çıkardı — aşağıda hem gerçek bulgu hem de planın yanlış varsaydığı (ve bu yüzden bilinçli olarak uygulanmayan) maddeler ayrı ayrı belgelendi.

**1. Gerçek bulgu — `useShowDetail`/`useMovieDetail`'in `refreshData()`'sı TTL içinde SESSİZCE no-op'tu.**
`app/show/[id].tsx` ve `app/movie/[id].tsx`'te yorum yazma/silme sonrası zaten `refreshData()` çağrılıyordu (örn. yorum sayısının tazelenmesi için). Ancak bu fonksiyon yalnızca bir React state sayacını (`refreshTrigger`) artırıyordu; sayaç değiştiğinde tetiklenen `loadData()`/`fetchDetails()` HER ZAMAN önce diskteki (AsyncStorage) önbelleği kontrol ediyor, TTL (show için 6 saat, movie için 24 saat) dolmadıysa aynı bayat `summary`/`seasons`/`cast`/`related`'i geri döndürüyordu. Yani mevcut "yenile" akışı, kullanıcı tam da TTL penceresinin İÇİNDEYKEN (en olası senaryo) sessizce hiçbir şey yapmıyordu.
**Çözüm:** Yeni `services/library/mutations/invalidation.ts` — `invalidateShowDetailCache(showId)` / `invalidateMovieDetailCache(movieId)`, ilgili `@show_detail_v3_${id}` / `@movie_detail_v4_cache_${id}` AsyncStorage anahtarını siler (hata olursa sessizce yoksayılır — en kötü ihtimalle bir sonraki TTL dolumuna kadar ESKİ davranış sürer, regresyon yok). `hooks/useShowDetail.ts` ve `hooks/useMovieDetail.ts`'teki `refreshData`, `void` yerine artık `async`: önce ilgili anahtarı siliyor, SONRA `refreshTrigger`'ı artırıyor/`fetchDetails()`'i çağırıyor — böylece bir sonraki `loadData`/`fetchDetails` cache-miss alıp GERÇEK bir ağ isteği atmak zorunda kalıyor. Dönüş tipi `void` → `Promise<void>` değişti ama mevcut TÜM çağıranlar (`app/show/[id].tsx`, `app/movie/[id].tsx`) zaten dönüş değerini kullanmadan `refreshData()` şeklinde çağırıyordu — hiçbir çağıran dosyada değişiklik gerekmedi.
**`hooks/useEpisodeDetail.ts`'e DOKUNULMADI:** İncelendi — bu hook kendi ana verisini (episode detayı) hiç diske önbelleklemiyor, `loadData()` her `refreshTrigger` değişiminde zaten koşulsuz gerçek bir ağ isteği atıyor (yalnızca show-detail cache'ini cast/backdrop FALLBACK'i için okuyor). Yani episode tarafında bu bug hiç yoktu; gereksiz bir "düzeltme" eklenmedi.

**2. Planda yer alıp kod incelemesi sonucu YANLIŞ varsayıma dayandığı için bilinçli olarak uygulanmayanlar:**
- **"Mutation API response'undan updated progress/show object parse et, redundant `getShowProgress()` çağrısını kaldır":** `services/api/users.ts` incelendi — Trakt'ın `/sync/history` ve `/sync/watchlist` POST uç noktaları yalnızca `{added, deleted, existing, not_found}` özet nesnesi döndürüyor; ne güncel `next_episode`/`completed` sayısı içeren bir progress nesnesi NE DE tam bir show/movie nesnesi dönüyor. Yani `getShowProgress()` çağrısı "redundant" değil — progress verisini elde etmenin TEK yolu bu; kaldırılması mümkün değil, plan Trakt API'nin gerçek response şeklini yanlış varsaymış.
- **"`toggleWatchlistStatus` response'undan gelen show object'i kullanarak `watchlistShows`'u update et":** `services/library/mutations/collections.ts` incelendi — `toggleWatchlistStatus`/`toggleFavoriteStatus` zaten çağıran tarafın geçtiği `mediaData` ile `setWatchlistShows`/`setFavShows`'u OPTİMİSTİK olarak (API isteğinden ÖNCE) güncelliyor; iddia edilen "watchlistShows update edilmiyor" hatası kodda mevcut değildi (muhtemelen daha eski bir mimariye ait, kod okunmadan yazılmış bir teşhis — Madde 46'daki FlatList `keyExtractor` yanlış alarmıyla aynı kategori).
- **"`store/useLibraryStore.ts`'te cascade invalidation + kütüphane 'view-all' cache'i refresh trigger et":** `utils/viewAllStore.ts` incelendi — burada kalıcı/TTL'li bir "cache" yok; yalnızca "Tümünü Gör" ekranına geçmeden hemen önce doldurulan geçici (transient), her navigasyonda zaten yeniden yazılan düz bir obje. Invalidate edilecek bir şey bulunamadı.
- **"Genel `base.ts` mutation lifecycle wrapper (optimistic/success/failure hook'ları standardize eden bir taban sınıf/pattern)":** Madde 47'deki gerekçeyle aynı — `progress.ts`/`collections.ts`'teki 13 mutation halihazırda canlı cihazda test edilmiş durumda; hepsini ortak bir soyutlamaya geçirmek, yukarıdaki iki maddenin göstermiş olduğu üzere gerçek bir kazanç sağlamayacak geniş bir davranış-değişikliği riski taşırdı. Uygulanmadı.
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi (aynı, önceden var olan, ilgisiz 4 dosya). Web derlemesi temiz, açılış sayfası hatasız render edildi. Trakt girişi bu ortamda engelli olduğu için gerçek bir dizi/film detay ekranında yorum yazma → `refreshData()` → cache-miss zinciri canlı tetiklenemedi; değişiklik kod incelemesiyle (her iki hook'un `loadData`/`fetchDetails` akışı, `AsyncStorage` anahtar isimlerinin `cacheManager`/`useMovieDetail.ts`'teki yazma noktalarıyla birebir eşleştiği) doğrulandı.

## 51. Faz 6 İncelemesi — Store Normalizasyon Planı Ertelendi, Yerine Gerçek Bir Denormalizasyon Bug'ı Bulunup Düzeltildi
**Bağlam:** Kullanıcı, Madde 44'teki Stabilizasyon Planının Faz 6'sını (state management consolidation / normalized store) uygulamadan önce plana Madde 47/50'dekiyle aynı şekilde kod incelemesiyle karşı denetim yapılmasını istedi. Sonuç, Madde 50'yle aynı örüntüyü doğruladı: planın kök neden teşhisinin bir kısmı kodu okumadan yazılmıştı, ama altında gerçek ve dar kapsamlı düzeltilebilir bir bug bulundu.

**1. Planın yanlış/abartılı öncülleri (kod incelemesiyle):**
- **"API response'u flat array, store'a girince nested object'e çevrilmiş":** `services/api/users.ts`'teki `getWatchedShows`/`getWatchlistShows` vb. incelendi — Trakt'ın `/sync/watched/shows` uç noktası zaten `{last_watched_at, show: {...}}` şeklinde İÇ İÇE bir dizi döndürüyor; `response.data` HİÇBİR dönüştürme yapılmadan doğrudan döndürülüyor. Yani "flat → nested çevrimi" diye bir adım kod tabanında hiç yok; öncül temelden yanlış.
- **Genel normalize-şema rewrite'ı (`store/schema/index.ts`, `showData`/`showProgress`/`collections: {Set...}`):** Planın kendisi bunu "Risk: High: Breaking change... tüm store accessors update gerekir" olarak işaretlemişti. `store/slices/*.ts` (7 dosya) incelendi — dilimler arası GERÇEK bir show-object kopyalanması var (aşağıya bkz.), ama bunu düzeltmenin bedeli plan'ın öngördüğü gibi devasa: 6+ hook/component'in import'ları, `services/library/mutations/*.ts`'teki TÜM atomic update çağrıları, disk cache migration fonksiyonu. Madde 47'deki gerekçeyle aynı: kullanıcı canlı cihazda test ederken bu genişlikte, riski kanıtlanmamış bir mimari değişikliğe girmek gerekçesiz. **Uygulanmadı.**

**2. Doğrulanan gerçek sorun ve dar kapsamlı düzeltme — "Geçmişten Sil" sonrası dizi Yaklaşanlar'da hayalet gibi kalıyor.**
Planın "aynı show object'ler 3+ yerde saklanıyor" tespiti DOĞRUYDU — ama gerçek sonucu "memory waste" değil, somut bir SENKRON bug'ıydı: `services/library/mutations/collections.ts`'teki `deleteMediaFromHistory(id, 'show')`, diziyi yalnızca `watchedShows` ve `showProgressMap`'ten temizliyordu; aynı dizinin `calendarShows`/`calendarSeasonsMap` dilimlerindeki TAMAMEN AYRI kopyalarına hiç dokunmuyordu (`hideMediaFromProgress`'in aksine — o, başarı sonrası `fetchFreshData(..., true)` ile tam resync tetikleyip bu kopyaları da kendiliğinden tazeliyordu). `hooks/useDashboardData.ts`'teki "Yaklaşanlar" derivasyonu doğrudan `calendarShows` üzerinden iterate ettiğinden, kullanıcı bir diziyi "Geçmişten Sil" ile sildiğinde o dizi bir sonraki doğal senkrona (10 dk `SYNC_INTERVAL` TTL) kadar hâlâ Yaklaşanlar'da görünmeye devam ediyordu.
**Çözüm:** `deleteMediaFromHistory`'e (tip `'show'` dalı) ek bir temizlik adımı eklendi: dizi HÂLÂ watchlist'te değilse (`useLibraryStore.getState().watchlistShows` kontrolü — Trakt'ın takvimi watchlist'i de kapsadığından, dizi hâlâ watchlist'teyse calendar kopyasına KASITLI OLARAK dokunulmuyor, aksi halde hâlâ meşru şekilde takip edilen bir dizi yanlışlıkla Yaklaşanlar'dan kaybolurdu) `calendarShows`'tan filtrelenip çıkarılıyor ve `calendarSeasonsMap[id]` siliniyor, ikisi de `safeStorageSet` ile diske de yazılıyor.
**Kapsam dışı bırakılan (bilinçli):** Aynı sınıf bug, teorik olarak `toggleWatchlistStatus` (watchlist'ten çıkarma) için de var olabilir — ama o durumda dizi hâlâ `watchedShows`'ta (aktif izleniyor) olabileceğinden "hâlâ meşru mü" kontrolü tam tersi yönde ekstra bir sorgu gerektirir ve mevcut kod tabanında bunun gerçekten kullanıcıyı rahatsız eden bir senaryo olduğu doğrulanmadı; bu turda dokunulmadı. Filmler (`calendarMovies`) için de aynı desen incelenmedi — Trakt'ta film takvimi izleme geçmişinden değil watchlist'ten türediği için `deleteMediaFromHistory('movie', ...)`'un calendar'ı etkilemesi beklenmiyor, kapsam dışı bırakıldı.
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi (aynı, önceden var olan, ilgisiz 4 dosya). Web derlemesi temiz, açılış sayfası hatasız render edildi. Trakt girişi bu ortamda engelli olduğu için "bir diziyi geçmişten sil → Yaklaşanlar'dan kaybolduğunu doğrula" akışı canlı test edilemedi; değişiklik kod incelemesiyle (watchlist kontrolünün `toggleWatchlistStatus`'taki aynı `useLibraryStore.getState()` erişim deseniyle tutarlı olduğu, `setCalendarShows`/`setCalendarSeasonsMap`'in `services/library/utils.ts`'te zaten var olan setter'lar olduğu) doğrulandı.

## 52. Faz 7 — Monitoring & Performance Profiling (Kara Kutu Telemetri)
**Bağlam:** Madde 44'teki Stabilizasyon Planının Faz 7'si (izlenebilirlik) uygulandı. Madde 50/51'in aksine bu planın kök nedenleri kod incelemesiyle DOĞRULANDI — `utils/errorLog.ts` (Madde 47) gerçekten yalnızca manuel inceleme için bir ring buffer'dı, mutation başarı oranı/API gecikmesi/bellek trendi hiçbir yerde ölçülmüyordu, gerçek cihazlarda DevTools erişimi yok. Yine de kapsam, planın kendisinin "opsiyonel/düşük öncelik" işaretlediği ve önceki fazların disiplinine aykırı düşecek kısımlarda bilinçli olarak daraltıldı.

**1. Yeni `utils/metricsStore.ts` — düşük seviye kalıcılık.**
Counter/Histogram/Gauge birincilleri, SAAT BAŞINA bir kova (`HourBucket`) halinde tutulur, en fazla 24 kova (rolling window) saklanır. Histogramlar spesifikasyondaki sabit kovalarla (100ms/500ms/1s/5s/30s+) çalışır — HER isteğin ham süresi değil, yalnızca kova sayaçları + `min`/`max`/`sum`/`count` saklanır (sınırsız büyüyebilecek bir dizi yerine sabit boyutlu depolama). Kamuya açık fonksiyonlar (`recordCounter`/`recordHistogram`/`setGauge`) `errorLog.ts`'teki `logError` ile AYNI "fire-and-forget" deseninde SENKRONDUR; diske yazma 3 saniyelik debounce ile TOPLU yapılır — Faz 4'teki requestQueue patlamaları gibi art arda hızlı gelen onlarca kayıt AsyncStorage'ı spam'lemesin diye.
**2. Yeni `utils/metrics.ts` — anlamlı isimli üst katman.**
`recordMutationResult(name, success)`, `recordApiLatency(endpoint, ms)`, `setMemoryGauge(name, value)`, `recordScreenTransition(screen, ms)` (henüz hiçbir yerden çağrılmıyor — bkz. "kapsam dışı"). `aggregateHistogram`: sabit kova sınırlarından p50/p95/p99'u DOĞRUSAL ENTERPOLASYONLA tahmin eder (Prometheus'un `histogram_quantile`'ıyla aynı yaklaşım — ham değerler saklanmadığı için KESİN değil, tahminidir; en son [30s, ∞) kovasına düşen değerler için `null` döner, üst sınır bilinmediğinden enterpolasyon yapılamaz). `exportMetricsReport()`: son 24 saatin hem toplam özetini hem saat saat kırılımını okunabilir bir JSON string'e çevirir.
**3. Enstrümantasyon (tamamı EKLENTİ niteliğinde — mevcut kontrol akışı/davranış BİREBİR korunarak, Madde 47'deki "canlı test riskini azaltma" disipliniyle aynı):**
- `services/api/traktClient.ts`: request interceptor'da `_metricsStartTime` damgalanır; response interceptor'ın hem başarı hem hata dalında (yalnızca GERÇEK bir yanıt geldiyse — `error.response` varsa; yanıtsız ağ hatalarında/timeout'ta SAYILMAZ) `recordApiLatency(endpoint, süre)` çağrılır. 429/401 retry'ları `instance(originalRequest)` ile interceptor'a TEKRAR uğradığından her deneme kendi gerçek süresiyle AYRI ölçülür.
- `services/library/mutations/progress.ts` (6 fonksiyon) ve `collections.ts` (7 fonksiyon): her `try`/`catch` bloğunun başarı ve hata uçlarına `recordMutationResult(mutationAdı, true/false)` eklendi — `logError`'un zaten var olan çağrı noktalarının hemen yanına.
- `services/library/fetchers.ts`: `fetchFreshData`'nın tam senkron sonunda (chunk başına DEĞİL — gereksiz gauge churn'ü önlemek için) `setMemoryGauge('showProgressMap.entries', ...)`.
- `utils/errorLog.ts`: `logError(context, error, tags?)` — opsiyonel 3. parametre (geriye dönük uyumlu, mevcut ~15 çağrı noktası değişmeden çalışır); `traktClient.ts`'teki iki 401 hata noktasında `{endpoint: breakerKey}` etiketiyle kullanıldı.
**4. Ayarlar > "🛠️ Tanılama" bölümü (`app/(protected)/account.tsx`, `hooks/useSettings.ts`):** Tek satırlık "Performans Raporunu Kopyala" butonu — `exportMetricsReport()`'u çağırıp `expo-clipboard` ile panoya kopyalar, `Alert` ile sonucu bildirir (mevcut `handleLogout`/`handleDeleteAccount` ile aynı desen). Yeni i18n anahtarları `tr`/`en` `settings.json`'a eklendi.

**Bilinçli kapsam dışı bırakılanlar:**
- **Tam görsel dashboard (saatlik grafikler):** Planın kendisi bunu "opsiyonel, düşük öncelik" olarak işaretlemişti; bir grafik kütüphanesi + yeni bir ekran gerektirir. `exportMetricsReport()` hazır ve JSON döndürdüğü için ileride bir dashboard eklenmek istendiğinde veri katmanı zaten kullanıma hazır.
- **`logError`'a context tag'lerin 40+ ham API fonksiyonuna (`services/api/*.ts`) geriye dönük eklenmesi:** Bu fonksiyonlar bugün yalnızca `console.error` + `throw` yapıyor, hiç `logError` çağırmıyor. Bunu eklemek mekanik ama geniş bir değişiklik (40+ dosya) olurdu; Faz 4'teki circuit breaker (rate-limit/erişilebilirlik) ve Faz 3'teki mutation-seviyeli `logError` (kullanıcı eylemleri) zaten en kritik iki hata sınıfını kapsıyor — ham GET istekleri zaten çağıran tarafta (`Promise.allSettled` vb.) zarifçe yutuluyor. Uygulanmadı.
- **"Silent errors vs. user-visible (Alert.alert vs. console.error)" etiketi:** İncelendi — `progress.ts`/`collections.ts`'teki mutation'lar hiç `Alert.alert` çağırmıyor (hata geri fırlatılıp UI katmanına bırakılıyor); UI katmanındaki handler'lar (`hooks/useShowDetailHandlers.ts` vb.) da Madde 47'de KASITLI olarak `logError` çağırmadan bırakılmıştı ("hâlâ sessizce başarısız oluyorlar... kullanıcı onayı sonrası ele alınmak üzere bırakıldı"). Yani şu an kod tabanında hem `Alert.alert` HEM `logError`'un birlikte çağrıldığı tek bir nokta yok — anlamlı bir "sessiz/görünür" ayrımı yapabilmek için önce Madde 47'nin bilinçli olarak ertelediği UI-Alert entegrasyonunun tamamlanması gerekir. Bu tur kapsamı dışında bırakıldı.
- **`recordScreenTransition`:** Fonksiyon yazıldı/export edildi ama hiçbir ekrandan çağrılmıyor — navigasyon süresi ölçmek için Expo Router'ın her rota dosyasına enstrümantasyon eklemek gerekir, riski/emeği "kara kutu" sorununun en kritik parçası (mutation başarı oranı, API gecikmesi) karşısında orantısızdı.
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi (aynı, önceden var olan, ilgisiz 4 dosya); yeni/değiştirilen 8 dosyada (`metrics.ts`, `metricsStore.ts`, `traktClient.ts`, `progress.ts`, `collections.ts`, `errorLog.ts`, `fetchers.ts`, `useSettings.ts`, `account.tsx`) sıfır hata. Web derlemesi temiz (2920 modül — `expo-clipboard`'ın artık gerçekten import edildiği doğrulandı, önceki fazlarda paket kurulu ama hiç kullanılmıyordu), açılış sayfası hatasız render edildi, konsolda yalnızca beklenen `Network Error` (sandbox'ın dış ağ erişimi kapalı) var — metrics modüllerinin import-time hydration'ı (`metricsStore.ts`'teki modül-seviyesi `hydrate()` çağrısı) hatasız çalıştı. Trakt girişi bu ortamda engelli olduğu için Ayarlar > Tanılama ekranındaki butonun gerçek bir cihazda tıklanıp panoya kopyalamanın doğrulanması ve gerçek mutation/API trafiğiyle metrik birikimi canlı test edilemedi; değişiklikler kod incelemesiyle (debounce/hydration race koşulları, histogram kova indeksleme, tüm mutation çağrı noktalarının hem başarı hem hata ucunun kapsandığı) doğrulandı.

## 53. Kritik Hata Düzeltmesi: Circuit Breaker, 401 Sonrası `HALF_OPEN`'da Kalıcı Olarak Kilitleniyordu
**Bulan:** Kullanıcı, Madde 49'daki circuit breaker entegrasyonunu (`services/api/traktClient.ts`) satır satır inceleyip `tsc` ile doğruladıktan sonra gerçek bir kilitlenme hatası tespit etti.
**Sorun:** `utils/circuitBreaker.ts`'teki `canRequest()`, devre `HALF_OPEN` durumundayken (30sn'lik `OPEN` süresi dolup "tek deneme" moduna geçtiğinde) `halfOpenProbeInFlight = true` set ediyor; bu bayrak YALNIZCA `onSuccess()`/`onFailure()` çağrıldığında temizleniyor. Ancak Madde 49'da eklenen 401 (kimlik doğrulama) bloğunun kendi içinde DÖRT ayrı erken `return` noktası vardı (kuyruğa alma → `instance(originalRequest)`; refresh-token-yok → `Promise.reject`; refresh başarılı → `instance(originalRequest)`; refresh başarısız → `Promise.reject`) ve bunların HİÇBİRİ breaker'a `onSuccess()`/`onFailure()` çağırmıyordu — yalnızca 429 ve "diğer 429/5xx dışı durumlar" (satır ~245 civarı, kod akışında 401 bloğunun TAMAMEN dışında) bu çağrıları yapıyordu.
**Somut senaryo:** Bir endpoint 5 kere üst üste 429/5xx alıp devre `OPEN` olur → 30sn sonra `HALF_OPEN`'a geçer → o endpoint'e giden İLK (yoklama) istek tam bu sırada 401 alırsa (token süresi dolmuşsa — refresh akışıyla eşzamanlı oldukça olası bir senaryo) kod 401 bloğundaki dört çıkıştan biriyle sonlanır, breaker'a hiç dokunmadan. `halfOpenProbeInFlight` sonsuza dek `true` kalır; `syncState()` yalnızca `state === 'OPEN'` iken zaman kontrolü yaptığından (zaten `HALF_OPEN`'a geçmiş bir breaker için bu kontrol bir daha ASLA çalışmaz) devre sonsuza dek `HALF_OPEN`'da (yeni istekleri reddeder halde) takılı kalır — o endpoint, token yenilense bile, uygulama yeniden başlatılana kadar KALICI OLARAK bloklanır. Daha da kötüsü: refresh-başarılı yolundaki `return instance(originalRequest);` bile bu döngüden muaf değildi — retry, request interceptor'da `canRequest()` false döndüğü için ANINDA `isCircuitBreakerRejection` ile reddedilirdi.
**Çözüm:** Dört ayrı çıkış noktasına tek tek yama yapmak yerine (kırılgan — beşinci bir çıkış noktası eklenirse yine unutulabilir), `if (breakerKey) getCircuitBreaker(breakerKey).onSuccess();` çağrısı 401 bloğunun EN BAŞINA (tüm dallanmalardan önce) taşındı — 401'in kendisi zaten "sunucudan yanıt geldi, endpoint erişilebilir" anlamına geldiğinden (satır ~245'teki 429/5xx-dışı durumlar için uygulanan kuralla BİREBİR aynı mantık; 401 bir kimlik doğrulama sorunudur, endpoint sağlığıyla ilgisizdir) bu tek satır dört çıkışın TAMAMINI kapsar.
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi (aynı, önceden var olan, ilgisiz 4 dosya). Web derlemesi temiz, açılış sayfası hatasız render edildi. Trakt girişi bu ortamda engelli olduğu için "devre HALF_OPEN'dayken 401 al → breaker'ın CLOSED'a döndüğünü doğrula" senaryosu canlı test edilemedi; düzeltme kod incelemesiyle (yeni çağrının 401 bloğunun TÜM erken-return yollarından ÖNCE çalıştığı, mevcut 429/5xx-dışı `onSuccess()` kuralıyla tutarlı olduğu, `originalRequest._retry = true` işaretlemesinden önce konularak sıralamanın bozulmadığı) doğrulandı.

## 54. RequestQueue: Kuyruk Dolunca Yanlış Görev Feda Ediliyordu
**Bulan:** Madde 49-53'ün ikinci bir denetim turunda (kullanıcı isteğiyle) `services/api/requestQueue.ts` yeniden satır satır incelendi.
**Sorun:** `evictLowestPriority()`, kuyruk (50) dolduğunda kuyruktaki EN DÜŞÜK öncelikli görevi bulup atıyordu — ama YENİ gelen görevin kendi önceliğiyle hiç karşılaştırmıyordu. Kuyruk 50 CRITICAL görevle doluyken yeni bir LOW öncelikli istek gelirse, kod CRITICAL görevlerden birini feda edip yerine bu düşük öncelikli isteği koyuyordu — tasarımın kendi önceliklendirme sözleşmesinin tam tersi.
**Çözüm:** `evictLowestPriority()` → `evictIfLowerPriorityThan(incomingRank)` olarak değiştirildi: yalnızca kuyruktaki en kötü görev, GELEN görevden GERÇEKTEN daha düşük öncelikliyse feda edilir (`worstRank > incomingRank`); aksi halde (kuyruk zaten eşit/daha yüksek öncelikli işle doluysa) hiçbir şey feda edilmez, bunun yerine `enqueue()` gelen görevin kendisini reddeder — mevcut kritik iş korunur.
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi. Tetiklenme ihtimali düşük (kuyruğun 50'ye ulaşması normal `fetchFreshData` akışında olası değil — chunk'lar 6'şar 6'şar işleniyor), ama gerçek bir mantık hatasıydı; kod incelemesiyle doğrulandı.

## 55. Diziler Ekranı: "Ara Verilenler"e Yanlış Düşme + Tamamlanmış Dizilerin Yenilenmesi Fark Edilmiyordu
**Bulan:** Kullanıcı gerçek kullanımda gözlemledi: bir diziyi bitirdikten aylar sonra yeni bir sezonu duyuruldu (henüz YAYINLANMAMIŞ bir `next_episode` ile) — dizi "Aktif İzlenenler" yerine "Ara Verilenler"de kaldı.
**Sorun 1 (kategorizasyon, `store/tracking/trackingLogic.ts`):** `isPaused` hesaplaması yalnızca "son izlemenin üzerinden ne kadar zaman geçti"ye bakıyordu — dizinin şu an izlenebilir (yayınlanmış) bekleyen bir bölümü olup olmadığını (`nextReady`) hiç sormuyordu. Bitirilmiş bir dizinin yeni sezonu henüz yayınlanmamışsa, ortada "ihmal edilmiş" bir şey yokken dizi yine de 45 günlük eşiğe göre "Ara Verilenler"e düşüyordu.
**Sorun 2 (daha derin kök neden, `services/library/fetchers.ts`):** Delta-sync, bir dizinin `getShowProgress`'ini SADECE kullanıcının o dizide `last_watched_at`'i değiştiren bir izleme eylemi olduğunda yeniden çekiyordu. Kullanıcı hiçbir şey izlemedikçe (ki senaryo tam olarak buydu — dizi zaten bitmişti), yerel önbellek `next_episode: null` olarak SONSUZA DEK kalıyordu — Trakt'ta yeni sezon eklense bile uygulama bunu asla öğrenmiyordu. Normal günlük kullanımda (cache hiç temizlenmeden) bu, dizinin Sorun 1'deki gibi yanlış kovaya düşmesinden bile daha kötü bir sonuca yol açardı: `next_episode` hep `null` görüneceğinden `isComplete` hep `true` kalır, dizi TÜM takip listelerinden tamamen kaybolurdu. (Kullanıcının gözlemlediği "Ara Verilenler'de kalıyor" durumu muhtemelen bir tam senkron/cache temizleme anından sonra `next_episode`'un doğru çekilip Sorun 1 yüzünden yanlış kovaya düşmesiyle oluştu.) İlginç olan: aynı dosyadaki `calendarSeasonsMap` mekanizması (calShowIds) bunu zaten doğru yapıyordu — dizinin `status !== 'ended' && status !== 'canceled'` olması yeterli sayılıyordu, izleme geçmişinden bağımsız olarak. "Yaklaşanlar" ekranının doğru göstermesinin sebebi buydu; tracking/kategorizasyon ise ayrı, daha kısıtlı bir veri kapısından (`showProgressMap`) besleniyordu.
**Çözüm 1:** `isPaused = nextReady && entry.lastWatchedAt ? ... : false` — "Ara Verilenler" artık yalnızca GERÇEKTEN yayınlanmış, izlenmeyi bekleyen bir bölüm birikmişken (`nextReady`) ve bu bölüme 45+ gün dokunulmamışsa anlamlı sayılıyor.
**Çözüm 2:** `showIds` (progress yeniden çekme seti) oluşturulurken, `calShowIds`'te zaten kullanılan "hâlâ yayında mı" kontrolü eklendi — dizi `status !== 'ended' && status !== 'canceled'` İSE ve yerel önbellek onu "tamamlandı" (next_episode yok) olarak biliyorsa, bu "belki yenilendi, kontrol edilmeli" sinyali sayılıp yeniden çekme setine eklenir. Bilinçli olarak DAR tutuldu (yalnızca "hâlâ yayında + yerelde tamamlanmış görünen" diziler) — zaten bir `next_episode`'u OLAN diziler bu ek kontrole ihtiyaç duymaz (onların ilerlemesi kullanıcı bir sonraki bölümü izlediğinde mutation'lar tarafından zaten güncelleniyor), bu yüzden normal delta-sync'in API maliyetini büyük ölçüde artırmaz.
**Platform notu:** Her iki dosya da (`trackingLogic.ts`, `fetchers.ts`) saf TS'dir, platforma özel kod/dallanma içermez — düzeltme Android ve Web'de birebir aynı şekilde geçerlidir.
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi (aynı, önceden var olan, ilgisiz hatalar). Web derlemesi temiz, açılış ekranı hatasız render edildi. Trakt girişi bu ortamda engelli olduğu için "diziyi bitir → yeni sezon duyurulsun → Aktif İzlenenler'de görün" senaryosu uçtan uca canlı test edilemedi; düzeltme kod incelemesiyle (her iki dosyadaki tüm ilgili kod yolları, `calShowIds`'teki zaten var olan emsal desenle tutarlılık) doğrulandı — gerçek cihazda (özellikle yakın zamanda yenilenmiş bir diziyle) doğrulama önerilir.

## 56. Madde 55'in Revizyonu: Kullanıcı Niyetini Netleştirdi — "Hazır Bölüm Yoksa Hiçbir Aktif Listede Görünmesin"
**Bağlam:** Madde 55'te "next_episode var ama henüz yayınlanmamış" diziler "Ara Verilenler"den "Aktif İzlenenler"e taşınmıştı. Kullanıcı gerçek bir örnekle (Dark Matter — S1 izlendi, S2 35 gün sonra çıkacak) bunun da yanlış olduğunu netleştirdi: dizi "Aktif İzlenenler"de DE görünmemeli, sonsuza dek bitmiş bir dizi gibi davranılmalı (yalnızca profil/istatistiklerde görünür kalmalı) — çünkü "şu an izlenecek bir bölüm var mı" sorusu, "dizi bir daha hiç yeni bölüm almayacak mı" sorusundan bağımsız, asıl önemli olan sinyal.
**Yan bulgu (Sorun 2):** Aynı senaryoda dizi kartında sezon/bölüm "S1E1" gösteriyordu — sanki hiç izlenmemiş gibi. Kök neden: `season = hasStarted && nextReady ? next.season : 1` satırı, `nextReady=false` her durumda (dizi hiç başlanmamış OLSUN ya da tüm mevcut bölümleri bitirilmiş OLSUN farketmeksizin) `: 1` dalına düşüyordu — bu dal aslında yalnızca "hiç başlanmamış" durumu için tasarlanmıştı.
**Çözüm:** İki sorun da TEK bir kök düzeltmeyle çözüldü (`store/tracking/trackingLogic.ts`). Eski `isComplete` değişkeni (`!!progress && !next && aired>0 && completed>=aired` — yalnızca "next===null" durumunu kapsıyordu) tamamen kaldırılıp yerine daha geniş bir kural kondu: `if (!!progress && hasStarted && !nextReady) continue;` — kullanıcı izlemeye başlamış VE (hesaplanmakta olmayan, gerçek) ilerleme verisine göre şu an izlenmeye hazır bir bölüm yoksa, dizi hiçbir takip kategorisine (upNext/paused/notStarted/dropped) girmeden döngüden çıkarılır. Eski `isComplete` mantıksal olarak bu yeni kuralın bir ALT KÜMESİYDİ (next===null her zaman nextReady=false anlamına gelir), yani hiçbir davranış kaybı yok, yalnızca genişletme. `!!progress` şartı bilinçli korundu: arka planda ilerlemesi henüz hesaplanmakta olan (isCalculating) diziler bu filtreden MUAF — "hesaplanıyor" spinner kartı göstermeye devam ederler. Bu filtre en üste (season/episode hesaplamasından ÖNCE) taşındığı için, aşağıya sızan HER `hasStarted` dizi artık garanti `nextReady=true` olur — "S1E1" bug'ı ayrı bir yama gerektirmeden kendiliğinden ortadan kalktı (kod yolu artık hiç `: 1` dalına düşmüyor). Dosyanın en üstündeki kural özeti (JSDoc) de yeni mantıkla eşleşecek şekilde güncellendi.
**Platform notu:** Saf TS, platforma özel dallanma yok — Android ve Web'de birebir aynı davranış. `useDashboardData.ts` (ayrı, eski bir modül) da kontrol edildi — yalnızca "Yaklaşanlar" (takvim) sekmesini besliyor, Aktif/Ara Verilenler/Henüz Başlanmadı ile hiçbir ilgisi yok; bu düzeltmenin kapsamı dışında bırakılması doğruydu.
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi; `isComplete` adının dosyada başka hiçbir yerde kalmadığı `grep` ile doğrulandı. Web derlemesi temiz, açılış ekranı hatasız render edildi. Trakt girişi bu ortamda engelli olduğu için "S1 izle → S2 duyurulsun (yayınlanmadan) → dizi hiçbir listede görünmesin" senaryosu canlı test edilemedi; kod incelemesiyle (yeni filtrenin tüm alt dallardan ÖNCE çalıştığı, eski `isComplete`'in matematiksel olarak alt kümesi olduğu, `isCalculating` durumunun korunduğu) doğrulandı.

## 57. Diziler > İzleme Sekmesi (Mobil): Accordion+FlatList → Yapışkan Başlıklı `SectionList`
**Bağlam:** Kullanıcı, kategori başlıklarının (Aktif İzlenenler, Ara Verilenler vb.) kaydırma sırasında ekranın üstüne yapışmasını istedi (`components/tracking/TrackingAccordionList.tsx` — yalnızca mobil; `.web.tsx` sürümüne dokunulmadı, kullanıcının açık isteği).
**Kapsam dışı bırakılan madde (kullanıcıya bildirildi):** İstenen "grid chunking" (afişleri 3'lü/4'lü satırlara bölme) algoritması UYGULANMADI — bu ekranın kartı (`EpisodeCardMobile.tsx`) `LibraryMobile.tsx`'teki poster ızgarasından FARKLI: tek sütunlu, tam genişlikte bir satır kartı (afiş + başlık + ilerleme çubuğu + aksiyon butonu yan yana, `flexDirection: row` kartın İÇ düzeni için, kartlar arası değil). Bu ekranda zaten bir grid yok; chunking algoritması zorla uygulansaydı kartların metin/aksiyon içeriğini kırpıp anlamsız bir 3-4 sütunlu afiş ızgarasına dönüştürecek, gerçek bir görsel regresyon olacaktı.
**Değişiklikler:**
1. `FlatList` + elle düzleştirilmiş `rows` (header/card satırları tek dizide) → native `SectionList`, her kategori kendi `section`'ı (`{key, title, count, collapsed, data}`). Kapalı (collapsed) bölümler `data: []` ile temsil ediliyor — eski "kapalı bölümün kartları hiç eklenmez" davranışı birebir korundu, başlık kategori boş olmadığı sürece HER ZAMAN görünür durumda.
2. `stickySectionHeadersEnabled` eklendi. Başlık sarmalayıcısına KATI (opak, `#0B1120` — ekranın kendi arka plan rengi) zemin verildi; Blur/glassmorphism BİLİNÇLİ OLARAK tercih edilmedi (Android'de LayoutAnimation + BlurView + sticky header kombinasyonu ekstra bir render riski katardı, katı renk hem daha ucuz hem garanti hatasız). `marginHorizontal: -12` + `paddingHorizontal: 12` ile zemin, listenin kendi yatay padding'ini iptal edip ekranın tam genişliğine yayılıyor (aksi halde yapışan başlığın kenarlarında altındaki kartın sızabileceği ince bir boşluk kalırdı).
3. `keyExtractor` sadeleşti: `${key}-${card.id}` (eski, header+card'ı TEK düz dizide ayırt etmek için gerekliydi) → `item.id.toString()` (trackingLogic.ts'in "bir dizi = bir kova" garantisi sayesinde zaten global olarak benzersiz).
4. `initialNumToRender`/`maxToRenderPerBatch`/`windowSize`/`removeClippedSubviews` korundu. `getItemLayout` BİLİNÇLİ OLARAK eklenmedi — `EpisodeCardMobile`'ın yüksekliği sabit değil (başlık 1-2 satır, etiket satırı olup olmamasına göre değişir); sahte bir sabit yükseklik varsayımı yanlış scroll konumu tahminine yol açardı.
**Kullanıcıya bildirilen potansiyel riskler (test edilmesi önerilir):**
- **Android `removeClippedSubviews` + sticky header:** RN'in eski sürümlerinde bu ikisinin birlikte kullanımı sticky header'da titreme/yanlış kırpma bugına yol açabiliyordu. Modern RN sürümlerinde büyük ölçüde çözülmüş olsa da, gerçek bir Android cihazda hızlı kaydırma sırasında görsel olarak doğrulanması önerilir.
- **Kaydırılmış durumda bölüm kapatma:** Kullanıcı bir bölümün ortasına kadar kaydırmışken o bölümü (sticky haldeki başlığından) kapatırsa, `data` aniden boşalacağından ekran içeriği anlık olarak sıçrayabilir — bu, eski düz-FlatList mimarisinde de zaten var olan bir karakteristikti (satır kaldırma her zaman altındaki içeriği kaydırır), sticky header ile biraz daha belirgin hissedilebilir. Yeni bir regresyon değil, mevcut bir sınırlamanın devamı.
**Platform notu:** Yalnızca `TrackingAccordionList.tsx` (mobil) değiştirildi. `.web.tsx` sürümü kullanıcının isteği üzerine dokunulmadan bırakıldı. Not: masaüstü olmayan (dar) web tarayıcı pencerelerinde `shows.web.tsx` zaten `IndexMobile`'a (dolayısıyla bu bileşene) düşüyor — yani bu değişiklik hem Android/iOS'ta hem de dar web pencerelerinde aynı şekilde geçerli olacak.
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi. Web bundle'ı mobil genişlikte (375px) hatasız derlendi ve açılış ekranı sorunsuz render edildi. Trakt girişi bu ortamda engelli olduğu için (misafir modu bile bu sekmede `LoginPaywall`'a düşüyor) gerçek kategorili verilerle sticky-scroll/collapse davranışı canlı test edilemedi; gerçek cihazda (özellikle Android'de hızlı kaydırma + bölüm kapatma) doğrulama önerilir.

## 58. Madde 57'nin Kırılganlığı: `LayoutAnimation` + Sanallaştırılmış `SectionList` Çakışması
**Bulan:** Kullanıcı gerçek cihazda test ederken üç semptom bildirdi: (1) "Ara Verilenler" gibi ortadaki bir bölüm bazen anlık kayboluyor, sonra kendiliğinden düzeliyor, (2) bir bölüm açık diğeri kapalıyken toggle bazen tepki vermiyor, (3) 100 dizilik bir listenin 20.sindeyken görünen (sticky) başlığa basıp bölümü kapatınca ekran beklenmedik şekilde en üste sıçrayabiliyor.
**Kök neden:** Madde 57'de bölüm aç/kapa geçişini yumuşatmak için korunan `LayoutAnimation.configureNext()` çağrısı, NATİF görünüm ağacının TAMAMI üzerinde çalışan global bir mekanizmadır. `SectionList`'in kendi sanallaştırma/hücre-geri-dönüşüm sistemiyle (`windowSize`, `removeClippedSubviews`) React Native'de BİLİNEN, kırılgan bir çakışma içindedir: kullanıcı listenin ortasına kadar kaydırmışken (ekran dışındaki hücreler zaten native ağaçtan kırpılmış/geri dönüştürülmüşken) bir bölümü kapatınca, LayoutAnimation'ın "öncesi" native layout referansı o hücreler için ya hiç yok ya da yanlış; içerik boyutu değiştikçe VirtualizedList'in kendi windowing yeniden hesaplaması da bu native geçişle aynı anda yarışıyor. Bu üçü (anlık kaybolma, ardışık dokunuşlara tepkisizlik, kaydırma sıçraması) tam olarak bu çakışmanın tipik belirtileridir — spesifik bir mantık hatası değil, iki mekanizmanın birbirine müdahale etmesi.
**Çözüm (`components/tracking/TrackingAccordionList.tsx`):**
1. `LayoutAnimation.configureNext()` çağrısı VE onu koruyan `UIManager.setLayoutAnimationEnabledExperimental` bootstrap'ı tamamen kaldırıldı — bölüm aç/kapa artık native layout animasyonu OLMADAN, SectionList'in kendi güvenilir re-render'ına bırakılıyor. Şevron ikonunun dönüş animasyonu (`rotateAnim`, izole bir `Animated.Value`, tek bir küçük view'i etkiliyor) bu çakışmadan muaf olduğu için korundu.
2. LayoutAnimation'ın "yarıda kesilmesini" önlemek için var olan paylaşımlı `toggleLockRef` debounce'u (TEK bir zaman damgasına göre çalıştığından farklı iki bölüme hızlı ardışık dokunuşları da yanlışlıkla engelliyordu — "biri açık diğeri kapalıyken çalışmıyor" şikayetinin doğrudan kaynağı) kaldırıldı. LayoutAnimation olmadan artık gerek yok; her dokunuş anında, bağımsız işleniyor.
3. `maintainVisibleContentPosition={{ minIndexForVisible: 0 }}` eklendi — içerik yukarıda/görünür alanda boyut değiştirdiğinde (bir bölüm kapanıp `data`sı sıfırlandığında) React Native'e kullanıcının o an gördüğü konumu SABİT TUTMASI (scroll offset'i otomatik telafi etmesi) söylenir. Bu, "20.deyken kapat, en üste sıçramasın" isteğinin doğrudan çözümü.
4. `removeClippedSubviews={Platform.OS === 'android'}` kaldırıldı — Android'de bu prop'un sticky section header'larla birlikte kullanımı, Madde 57'de zaten "test edilmesi önerilir" olarak işaretlenmiş bilinen bir glitch kaynağıydı; kullanıcının "her türlü çalışır olmalı" önceliği gereği uzun listelerdeki marjinal bellek kazancından feragat edilip risk tamamen ortadan kaldırıldı.
**Platform notu:** Değişiklik yalnızca `TrackingAccordionList.tsx`'te (mobil + dar web pencereleri, Madde 57'deki gibi) — Android/iOS ve web'de birebir aynı davranış.
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi. Web bundle'ı mobil genişlikte hatasız derlendi. Trakt girişi bu ortamda engelli olduğu için üç semptomun de düzeldiğini gerçek kategorili verilerle canlı doğrulayamadım; kök neden analizi (LayoutAnimation + VirtualizedList'in React Native'de belgeli çakışması) ve önerilen düzeltmelerin (animasyonu kaldırma, debounce'u kaldırma, `maintainVisibleContentPosition` ekleme) her üç semptomu da doğrudan hedeflediği kod incelemesiyle doğrulandı — gerçek cihazda (özellikle Android, uzun bir "Ara Verilenler" listesinde) doğrulama önerilir. **[DÜZELTME — bkz. Madde 59: bu maddedeki "gerçek cihazda test edilemedi" notu ve Madde 57'nin "dar web pencerelerinde de bu bileşen kullanılıyor" iddiası YANLIŞTI; asıl kanıtlanmış doğrulama Madde 59'dadır.]**

## 59. Madde 58 "Düzelmedi" Dedi — Gerçek Kök Neden: Test Hiç Doğru Dosyayı Çalıştırmıyordu
**Bağlam:** Kullanıcı Madde 58'in düzeltmesini test etti ve "düzelmedi" dedi. Trakt girişi bu sandbox'ta Cloudflare bot-koruması tarafından engellendiği için (kullanıcının kendi tarayıcısıyla dener denemez `trakt.tv` "Attention Required" sayfası döndü — bypass edilmeye ÇALIŞILMADI, kurallara aykırı), gerçek veriyle canlı test imkânsızdı. Bunun yerine kullanıcının onayıyla **sahte (mock) veri enjekte eden geçici bir test rotası** (`app/dev-tracking-test.tsx` — 100 "Aktif İzlenenler", 15 "Ara Verilenler", 5 "Henüz Başlanmadı", 3 "Bırakılanlar" kartı, `TrackingAccordionList`'i gerçek Zustand store'a hiç dokunmadan doğrudan besleyen) yaratılıp tarayıcıda GERÇEKTEN etkileşimli test edildi.
**Keşif 1 — sticky header web'de HİÇ çalışmıyordu:** Mock veriyle test edilince `stickySectionHeadersEnabled` prop'unun react-native-web'de hiçbir etkisi olmadığı, başlığın kaydırınca içerikle birlikte tamamen kaybolduğu (yapışmadığı) DOM incelemesiyle (`getComputedStyle().position` hiçbir ecerçevede `'sticky'` dönmüyordu) doğrulandı.
**Keşif 2 — GERÇEK kök neden: Metro yanlış dosyayı derliyordu:** `position: 'sticky'` CSS'ini elle eklemek de İLK BAŞTA işe yaramadı. DOM'da `categoryHeaderWrapper`'a ait HİÇBİR iz bulunamayınca kaynak koda geri dönüldü: **Metro/Expo Router, `platform=web` için bir modülü import ederken, aynı isimde bir `.web.tsx` kardeş dosya varsa viewport genişliğinden TAMAMEN BAĞIMSIZ olarak HER ZAMAN onu tercih ediyor.** `components/tracking/TrackingAccordionList.web.tsx` zaten var olduğundan, bu sandbox'taki HER web testi (dar/mobil pencere dahil) sessizce `TrackingAccordionListWeb`'i (Madde 57'den ÖNCEKİ, sticky header'sız, grid tabanlı `FlatList` mimarisi — hiç dokunulmayan, ayrı bir dosya) render ediyordu. Madde 57'deki "masaüstü olmayan web pencerelerinde de bu bileşen [mobil TrackingAccordionList.tsx] kullanılıyor" iddiası bu yüzden YANLIŞTI — `IndexMobile.tsx` render ediliyor olsa bile, onun İÇİNDEKİ `TrackingAccordionList` import'u web derlemesinde HER ZAMAN `.web.tsx`'e çözümleniyor. Madde 58'deki tüm düzeltmeler (`LayoutAnimation` kaldırma, `maintainVisibleContentPosition` ekleme vb.) bu yüzden bu sandbox'ta ASLA test edilememişti — kod doğruydu ama hiç çalıştırılmamıştı.
**Doğrulama yöntemi:** `TrackingAccordionList.web.tsx` GEÇİCİ olarak `.disabled-for-testing` uzantısıyla yeniden adlandırılıp Metro'nun `.tsx` (mobil) dosyaya düşmesi sağlandı, sunucu yeniden başlatıldı, mock test rotası tarayıcıda uçtan uca denendi, ardından dosya BİREBİR eski adına geri döndürüldü (`git status` ile içerik değişikliği olmadığı doğrulandı).
**Sonuçlar (üçü de tarayıcıda gerçekten gözlemlendi):**
1. `position: 'sticky'` (artık `StyleSheet.create()`'in DIŞINDA, düz bir JS objesi — `StyleSheet.create` React Native'in resmi tipinde olmayan `'sticky'` değerini SESSİZCE siliyordu, bu da ayrıca düzeltildi) ile başlık gerçekten ekranın üstüne yapıştı, 40+ kart kaydırılırken sabit kaldı.
2. Kalabalık (100 kart) "Aktif İzlenenler"in ortasındayken (item ~24) sticky başlığa basılıp bölüm kapatıldığında ekran en üste SIÇRAMADI — doğrudan bir sonraki bölüme ("Ara Verilenler", TAM ve KAYBOLMADAN görünür) indi.
3. Farklı iki bölüme (biri "Bırakılanlar" açılırken diğeri "Aktif İzlenenler" açılırken) art arda hızlı dokunulduğunda İKİSİ DE doğru işlendi, hiçbiri yutulmadı.
**Ek düzeltme (`components/tracking/TrackingAccordionList.tsx`):** `WEB_STICKY_STYLE` sabiti artık `StyleSheet.create()`'in dışında tanımlanıp `style` array'ine ayrı bir eleman olarak geçiriliyor (`<View style={[styles.categoryHeaderWrapper, WEB_STICKY_STYLE]}>`) — `StyleSheet.create()`'e gömülü bir spread olarak denendiğinde `position: 'sticky'` sessizce kayboluyordu.
**Temizlik:** Test rotası (`app/dev-tracking-test.tsx`) ve geçici yeniden adlandırma tamamen geri alındı; `git status` ile `.web.tsx`'in içerik olarak DOKUNULMAMIŞ olduğu doğrulandı.
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi. Bu kez — Madde 58'in aksine — üç semptomun de gerçekten düzeldiği CANLI, gerçek etkileşimli testle (mock veri üzerinden) doğrulandı; tek eksik, Trakt'ın gerçek verisiyle Android/iOS'ta native bir son doğrulamadır (bu sandbox'ın ulaşamadığı tek katman `stickySectionHeadersEnabled`'ın native tarafta doğru çalıştığını doğrulamaktır — bu, React Native'in kendi standart, iyi test edilmiş mekanizmasıdır, web'deki gibi ayrı bir CSS hack'i gerektirmez).

## 60. APK'da Sticky Header: "Hayalet Başlık" (Tıklanmayan Buton) ve Kaydırırken Başlığın Kaybolması
**Bağlam:** Madde 59'daki doğrulama yalnızca web'de (mock veriyle, `.web.tsx` geçici olarak devre dışı bırakılarak) yapılabilmişti. Kullanıcı gerçek APK çıktısında iki YENİ semptom bildirdi: (1) yapışkan başlık ekranın üstünde asılı kaldığında içindeki butona basılamıyor, dokunuş alttaki karta gidiyor; (2) uzun bir bölümde birkaç kart kaydırıldıktan sonra yapışkan başlık aniden kayboluyor, listenin sonuna gelince veya kaydırma yönü değişince geri geliyor. Her ikisi de sadece native (Android) tarafta — web'de bu davranış zaten `position: 'sticky'` ile çözülmüştü.
**Kök neden 1 (kaybolan başlık) — yorum yazılmış ama PROP HİÇ EKLENMEMİŞ:** Madde 58'de `removeClippedSubviews` "kaldırıldı" denmiş ve `TrackingAccordionList.tsx` içine bunu açıklayan uzun bir yorum bloğu yazılmıştı — ancak prop'un KENDİSİ (`removeClippedSubviews={false}`) JSX'e hiç eklenmemişti. `VirtualizedList`'te bu prop'un Android varsayılanı `true` olduğu için liste fiilen kırpma yapmaya devam ediyordu: ekran dışına çıkan hücreler native ağaçtan tamamen sökülünce, sticky header'ın pinlenme/ölçüm mantığı bozuluyor ve başlık kayboluyordu. Yorum ile gerçek kod arasındaki bu sessiz uyuşmazlık, semptomun tam olarak Madde 58'den sonra da sürmesini açıklıyor.
**Kök neden 2 (hayalet başlık):** Android'de görünüm sıralaması `zIndex`'ten çok `elevation` ile belirlenir. Sticky header sarmalayıcısında ikisi de tanımlı olmadığı için, başlık ÇİZİM olarak üstte görünse bile hit-test sırasında altından kayan hücreler önüne geçebiliyor ve `TouchableOpacity` dokunuşu hiç almıyordu.
**Çözüm (`components/tracking/TrackingAccordionList.tsx`):**
1. `removeClippedSubviews={false}` prop'u SectionList'e GERÇEKTEN eklendi (mevcut yorum, prop'un daha önce unutulduğunu açıkça belirtecek şekilde güncellendi).
2. `categoryHeaderWrapper` stiline `zIndex: 999` (iOS/web) + `elevation: 10` (Android) eklendi. Arka plan zaten KATI (`#0B1120`) olduğu için touch event'lerin yakalanması garanti — transparan bırakılmadı.
3. Mevcut tasarımın görünümünü BİREBİR korumak için `shadowColor: 'transparent'` + `shadowOpacity: 0` eklendi: `elevation` Android'de normalde bir gölge de çizer, burada yalnızca z-sıralama etkisi isteniyor.
**Uygulanmayan öneri — `getItemLayout` (BİLİNÇLİ):** Kullanıcının önerdiği üç yamadan biri olan `getItemLayout` eklenmedi, çünkü ön koşulu ("satır yükseklikleri sabitse") bu listede sağlanmıyor: `EpisodeCardMobile.tsx`'te bölüm başlığı `numberOfLines={2}` ile render ediliyor ve kart yüksekliği 1-2 satıra göre değişiyor. Sabit bir yükseklik varsayımı, kaybolan başlık sorununu çözmek yerine yanlış scroll konumu tahminine ve daha kötü bir glitch'e yol açardı.
**Zaten uygulanmış olan öneri:** "`chunkArray`'i `useMemo` ile sarmala" maddesi bu dosyada karşılıksız — `chunkArray` burada hiç kullanılmıyor ve `sections` dizisi zaten `useMemo(..., [categories, collapsed, labels])` ile referans olarak stabil.
**Doğrulama:** `tsc --noEmit` hata kümesi değişmedi (dosyada hata yok; mevcut hatalar `CommentItem.tsx`, `useShowDetail.ts`, `locales/` içindeki önceden var olan hatalardır). Semptomlar yalnızca native (APK) tarafta göründüğü ve bu ortamda Android build/cihaz erişimi olmadığı için canlı doğrulama YAPILAMADI — gerçek APK'da (uzun bir "Aktif İzlenenler" listesinde hızlı kaydırma + yapışık başlığa dokunma) test edilmesi gerekir.

## 61. Kesin Çözüm: Yapışkan Başlık `SectionList`'ten Çıkarıldı, Kendi Overlay'imize Taşındı
**Bağlam:** Madde 60'ın yamaları (`removeClippedSubviews={false}` + `zIndex`/`elevation`) APK'da yetmedi. Kullanıcının bildirdiği kesin desen: 1. bölüm ("Aktif İzlenenler") sorunsuz yapışıyor; 50 elemanlı 2. bölümün ("Ara Verilenler") başlığı ilk 3-4 karttan sonra kayboluyor, listenin en altına inince son 3-4 dizide geri geliyor; ayrıca yukarı-aşağı-yukarı kaydırınca sistem büsbütün bozuluyor.
**Kök neden (RN kaynak kodu okunarak doğrulandı, tahmin değil):**
1. `React Native`'in yapışkan başlığı NATİF bir özellik DEĞİL. `ScrollView`, `stickyHeaderIndices`teki çocukları `ScrollViewStickyHeader` ile sarmalar ve `translateY`yi bir `Animated` interpolasyonuyla sürer (`node_modules/react-native/Libraries/Components/ScrollView/ScrollViewStickyHeader.js:212-223`). Bu interpolasyonun aralığı İKİ ÖLÇÜME bağlıdır: başlığın kendi `layoutY`si ve bir SONRAKİ başlığın `nextHeaderLayoutY`si.
2. `VirtualizedSectionList` her bölüm için düz listeye 1 header + 1 footer item ekler (`VirtualizedSectionList.js:189-199`) — yani **bölüm başlıkları da sanallaştırmaya tabi normal item'lardır**, kaydırdıkça render penceresinden çıkıp girerler.
3. Başlık pencereden çıkıp girdikçe `layoutY`/`nextHeaderLayoutY` ölçümleri eskir, interpolasyon aralığı yanlış hesaplanır ve başlık "yapışmayı" bırakır. 1. bölümün her zaman çalışmasının sebebi ise `VirtualizedList`in `initialNumToRender` bölgesini KALICI olarak render'da tutmasıdır (`VirtualizedList.js:529-534`) — index 0'daki başlık hiç unmount olmaz, diğerleri olur. Semptomun neden tam olarak 1. bölümü ayrıcalıklı kıldığı bu şekilde açıklanmış oldu.
**Çözüm — mimari değişiklik (`components/tracking/TrackingAccordionList.tsx`):** RN'in yapışkan mekanizması tamamen terk edildi (`stickySectionHeadersEnabled={false}`). Yerine:
1. `SectionList` artık normal (yapışkansız) akıyor, `flex: 1` bir `container` içine alındı.
2. Başlık, listenin KARDEŞİ olarak `position: 'absolute'; top: 0` bir OVERLAY olarak render ediliyor. Overlay asla unmount olmaz, sanallaştırmayla hiçbir alışverişi yoktur.
3. Overlay'de hangi bölümün gösterileceğini `onViewableItemsChanged` belirliyor: ekranda görünen EN ÜSTTEKİ satırın bölümü. Bu, yapışkanlığın matematiksel tanımıdır ve ölçüm eskimesine bağışıklıdır. Görünürlük eşiği `itemVisiblePercentThreshold: 1` (KASITLI olarak 0 değil — `ViewabilityHelper` `percent >= threshold` karşılaştırması yaptığı için 0 verilirse ekran dışındaki render edilmiş satırlar da "görünür" sayılır ve mantık bozulurdu).
4. Overlay yalnızca `scrollY >= 12` (içeriğin `paddingTop`u) iken gösteriliyor: tam bu eşikte overlay'in üst kenarı ile listedeki gerçek başlığın üst kenarı BİREBİR çakışır, böylece tepede çift başlık görünmez.
5. Başlık bileşeni tekil kaldı; liste içi ve overlay kullanımı yalnızca dış sarmalayıcı stiliyle (`wrapperStyle`) ayrışıyor — ikisinin birebir aynı görünmesinin garantisi bu.
6. **Hayalet başlık sorunu kökten çözüldü:** overlay listenin kardeşi ve ondan sonra render edildiği için dokunuşları doğal olarak yakalar; ayrıca `zIndex: 999` + `elevation: 10` korundu, `shadowColor: 'transparent'` ile Android gölgesi bastırılarak tasarım birebir korundu.
7. **Kritik çökme önlendi:** `onViewableItemsChanged` açıkken `VirtualizedSectionList._convertViewable`, görünürlük token'ını dönüştürürken kullanıcının `keyExtractor`ını BÖLÜM BAŞLIĞI/ALTLIĞI satırları için de çağırır — o satırlarda `item` bir `TrackingCard` değil `Section` objesidir ve `id` alanı yoktur. Eski `item.id.toString()` orada anında çökerdi; `keyExtractor` defansif hale getirildi.
**Bilinçli olarak uygulanmayanlar:** `getItemLayout` (kartların yüksekliği `numberOfLines={2}` yüzünden değişken, sahte sabit yükseklik daha kötü bir glitch üretirdi). `removeClippedSubviews={false}` ve `maintainVisibleContentPosition` korundu.
**Doğrulama — bu kez GERÇEK, etkileşimli test yapıldı:** Madde 59'daki yöntemle geçici bir mock rota (`app/dev-tracking-test.tsx` — 30 Aktif / 50 Ara Verilen / 25 Başlanmadı / 12 Bırakılan) yaratıldı ve `TrackingAccordionList.web.tsx` geçici olarak devre dışı bırakılarak Metro'nun mobil dosyayı derlemesi sağlandı (overlay mantığı saf JS olduğu için web'deki doğrulama Android için de geçerlidir; kaybolmanın kaynağı olan mekanizmanın kendisi zaten platformdan bağımsız JS'ti).
1. **15.322 px'lik listede 120 px'lik adımlarla aşağı VE yukarı tam tur (256 ölçüm):** başlığın kaybolduğu tek adım scrollTop = 0 (tasarım gereği, liste tepedeyken gerçek başlık zaten görünür). "Ara Verilenler" aşağı inişte 56, yukarı çıkışta 57 ardışık adım boyunca KESİNTİSİZ yapışık kaldı — eski kodun bozulduğu yer tam burasıydı.
2. **Yukarı-aşağı-yukarı zıplama testi** (6000 → 3000 → 7000 → 2000 → 9000 → 500 → 8000 → 10500 → 4300): her adımda doğru bölüm başlığı.
3. **Hayalet başlık testi:** bölümün ortasındayken (scrollTop 7000) yapışık başlığın üzerindeki noktada `document.elementFromPoint` GERÇEKTEN overlay'i döndürdü (alttaki kartı değil); gönderilen dokunuş bölümü kapattı, `scrollTop` 7000'de kaldı (en üste sıçrama yok — `maintainVisibleContentPosition` çalışıyor) ve overlay doğru şekilde bir sonraki bölüme güncellendi.
4. **Ardışık hızlı dokunuş:** 50 ms arayla iki FARKLI bölüm başlığına dokunuldu, ikisi de işlendi.
**Temizlik:** Test rotası silindi, `.web.tsx` birebir eski adına döndürüldü ve `git diff` ile içerik olarak DOKUNULMAMIŞ olduğu doğrulandı.
**Kalan tek belirsizlik:** Android'e özgü native katman (dokunma hit-test'i). Overlay listenin kardeşi olduğu ve `elevation: 10` taşıdığı için bu katmanda risk minimaldir, ancak gerçek APK'da son bir doğrulama yine de önerilir. **[Madde 60'a düzeltme: oradaki `zIndex`/`elevation` yaması korunmuştur ama tek başına yeterli değildi; asıl çözüm bu maddedir.]**

## 62. Profil > Diziler: Lokal Arama + Çoklu Seçim Kategori Filtresi ve Grid Bug Temizliği
**Bağlam:** `/library/shows` ekranı (profildeki "Diziler" > Tümünü Gör) 136 öğelik düz bir grid'ti; içinde tek bir diziyi bulmanın yolu yoktu ve üstteki "Toplam: 136 Diziler" satırı ekran alanını sayaç göstermek dışında bir işe yaramadan harcıyordu.

**Aşama 1-2 — Kompakt üst bar + filtre menüsü (yeni dosyalar):**
1. `hooks/useLibraryShowFilters.ts` — TÜM süzme mantığı burada, UI'dan tamamen bağımsız. Ağ isteği YOK; yalnızca store'dan gelen dizi bellekte süzülür.
2. `components/library/LibraryFilterBar.tsx` — tek satırda arama kutusu + filtre butonu (rozetli), altında tek satırlık sayaç. Eski `statsContainer` bloğunun yerini alır, net ekran alanı kazancı sağlar.
3. `components/library/LibraryFilterModal.tsx` — 4 kategorili çoklu seçim menüsü. `wide` prop'u ile platform ayrımı: mobilde alttan açılan sheet (`animationType="slide"` + grabber), web/masaüstünde ekranın ortasında modal (`animationType="fade"`, Escape ile kapanır).
4. Seçimler TASLAK olarak tutulur; liste yalnızca "Göster"e basılınca güncellenir — menü açıkken arkadaki grid her dokunuşta yeniden düzenlenip zıplamaz (istenen davranış).
5. Arama 180 ms debounce'lu ve **locale duyarlı**: karşılaştırma `toLocaleLowerCase('tr-TR')` ile yapılır. Düz `toLowerCase()` kullanılsaydı "Işık Yolu" başlığı "i̇şık"a dönüşüp "ışık" aramasıyla ASLA eşleşmezdi.

**Kategori kaynağı — tek gerçek kaynak korundu:** 4 kategori (`upNext`/`paused`/`dropped`/`notStarted`) yeniden tanımlanmadı, takip modülünün saf fonksiyonu `categorizeShows`'tan türetiliyor. Böylece "Aktif İzlenenler" bu ekranda ve takip ekranında ASLA farklı anlama gelemez. Etiketler de `media` namespace'indeki mevcut anahtarlardan (`upNext`, `paused`, `inactive`, `notStarted`) okunur, yeni metin uydurulmadı.

**Doğrulama sırasında bulunan tasarım boşluğu — "Henüz Başlanmadı" ölü seçenekti:** Bu ekranın veri kaynağı `watchedShows` (İZLENEN diziler). `notStarted` kategorisi ise tanımı gereği yalnızca izleme listesinde olup hiç izlenmemiş dizilerden oluşur — yani bu listede HİÇ bulunmazlar. Dört seçenekten biri hiçbir koşulda sonuç döndüremeyecekti. Çözüm: kategori filtresi AÇIKKEN havuza `watchlistOnly` (izlenenlerde olmayan, yalnızca izleme listesindeki) diziler de eklenir. Bunlar sadece "Henüz Başlanmadı" seçiliyken eşleşebildiği için diğer seçimlerde listeye sızmazlar; filtre kapalıyken ekranın varsayılan içeriği ve "Toplam" sayısı hiç değişmez.

**Aşama 3 — Liste bug'ları ve performans:**
1. **Eşsiz `keyExtractor` (asıl bug):** Anahtar `${item.id}-${index}` ile üretiliyordu. Index anahtara girdiği için liste her süzüldüğünde aynı dizi YENİ bir kimlik alıyor, FlatList hücreleri geri dönüştüremeyip hepsini baştan monte ediyordu. `useLibraryTypeData` artık her öğeye kalıcı bir `key` yazıyor (`LibraryItem.key`) ve aynı anda **kimliğe göre tekilleştirme** yapıyor — Trakt'ın aynı diziyi tekrar döndürdüğü durumlarda oluşan "aynı kart iki kez" hatası da böylece kapandı. Web tarafındaki `item.id ? ... : index.toString()` fallback'i de aynı nedenle kaldırıldı.
2. **`numColumns` sabitlendi:** Sütun sayısı hiçbir yerde türetilmiyor; ayrıca FlatList'e sütun sayısından türeyen sabit bir `key` verilerek, ileride değiştirilmesi hâlinde RN'i çökerten "Changing numColumns on the fly is not supported" hatası yerine güvenli bir yeniden mount'a çevrildi.
3. **Ekran genişliği bug'ı:** `CARD_WIDTH` modül seviyesinde `Dimensions.get('window')` ile bir kez hesaplanıyordu; cihaz döndürüldüğünde/katlanabilir açıldığında ESKİ genişlikte kalıp kartlar taşıyor ve `getItemLayout` gerçek satır yüksekliğinden sapıp kaydırmayı sıçratıyordu. `useWindowDimensions` + `useMemo`'ya taşındı; hücre stili memoize edildiği için `memo`'lu kartlar gereksiz yeniden çizilmiyor.
4. `initialNumToRender=12`, `maxToRenderPerBatch=9`, `windowSize=7`, `updateCellsBatchingPeriod=50` ayarlandı; ayrıca `keyboardShouldPersistTaps="handled"` + `keyboardDismissMode="on-drag"` ile arama yaparken klavye/dokunuş çakışması giderildi.
5. **`removeClippedSubviews` — YALNIZCA Android:** İstendiği gibi eklendi ama `Platform.OS === 'android'` ile sınırlandı. Bu prop daha önce bu dosyada BİLEREK kapatılmıştı (kod içindeki eski yorum): grid ile birlikte listenin sonundaki elastik geri sekmede hücreler hızla clip/unclip olup boş/karışık render üretiyordu. Semptom iOS'ta gözlendiği için Android'de açık, iOS'ta kapalı bırakıldı — regresyon görülürse tek satırla geri alınabilir.

**Yan bulgu — ayrı bir çökme hatası düzeltildi (`components/comments/CommentItem.tsx`):** `SpoilerOverlay` bileşeni `t('containsSpoilers')` / `t('tapToView')` çağırıyordu ama `t` o bileşenin kapsamında HİÇ tanımlı değildi (dıştaki `CommentItem`'ın hook'u). Spoiler içeren bir yorum render edilir edilmez "t is not defined" ile çöküyordu. `useTranslation('common')` bileşenin içine alındı; aynı yerdeki hardcoded "Gizle" metni de `hideSpoiler` anahtarına taşındı (tr/en).

**Kapsam dışı bırakılanlar (bilinçli):** Süzme yalnızca `type === 'shows'` iken etkin. Filmler, favoriler ve listeler ekranları — istendiği gibi — davranış olarak hiç değiştirilmedi; onlar eski sayaç satırını görmeye devam ediyor. API/backend'e dokunulmadı.

**Doğrulama (web, gerçek etkileşimli test):** `LibraryContext`'e geçici bir store kancası takılarak 100 izlenen (60 aktif + 40 ara verilmiş) + 36 izleme listesi dizisi enjekte edildi, test sonunda kanca silindi.
1. Arama: "ışık" → 1 sonuç ("Işık Yolu"), sayaç "1 sonuç · toplam 100" — Türkçe büyük-I katlaması çalışıyor.
2. Çoklu seçim: "Ara Verilenler" + "Henüz Başlanmadı" işaretlendi, kutucuklar tik aldı ve **liste arkada değişmedi** (sayaç hâlâ "Toplam: 100 Diziler") — taslak mantığı doğrulandı.
3. "Göster"e basınca: 76 sonuç (40 ara verilmiş + 36 izleme listesi), "Aktif Dizi" eşleşmesi 0 — sızıntı yok.
4. Yalnızca "Bırakılanlar" (elle işaretlenmiş dizi yok) → 0 sonuç + "Sonuç bulunamadı" boş ekranı, filtre butonunda "1" rozeti.
5. `tsc --noEmit`: dokunulan dosyalarda hata yok (kalan hatalar `useShowDetail.ts` ve `locales/` içindeki önceden var olanlardır; `CommentItem.tsx` hataları bu maddeyle giderildi).
**Doğrulanamayan:** Mobil (native) tarafın kendine özgü kısımları — alttan açılan sheet görünümü ve `removeClippedSubviews`/`getItemLayout` davranışı. Bu ortamda Android/iOS cihaz erişimi yok; hook ve bileşenler web ile ortak olduğu için mantık doğrulandı, native render'ın APK'da bir kez gözden geçirilmesi önerilir.

## 63. Film Takip Altyapısı (Adım 1) ve `droppedIds` → `droppedShowIds` Simetrik Yeniden Adlandırma
**Bağlam:** Filmler tarafı projede baştan beri ihmal edilmişti. Profil > Filmler sayfasına dizilerdekine benzer bir "arama + kategori filtresi" kurulmasına karar verildi; ancak dizilerdeki 4 kategori yerine filmler için çok daha sade bir model seçildi: **İzlenenler / İzlenecekler / Bırakılanlar**. Filmlerde "sıradaki bölüm", "yayınlandı mı", "ara verilmiş mi" kavramları olmadığı için dizilerdeki karmaşıklık bilinçli olarak taklit EDİLMEDİ.

**Ön inceleme — filmler tarafında bulunan eksikler (bu maddede hepsi çözülmedi, tespit amaçlı kayda geçiyor):**
1. Filmler sekmesinde "İzlenenler" diye bir görünüm HİÇ yok; sekme yalnızca İzleme Listesi + Yaklaşanlar gösteriyor. `watchedMovies` dilimi store'da duruyor ama o ekran onu hiç okumuyor (yalnızca profil, istatistikler ve film detayı kullanıyor).
2. "Bırakıldı" %100 dizilere özeldi: `OptionsModal` o satırı `type === 'show'` ile kapatıyordu, yani bir filmi bırakılmış işaretlemenin HİÇBİR yolu yoktu (Adım 2'de açılacak).
3. Kalıntı: `movies.web.tsx`'te filmlerin izleme listesi carousel'inin başlığı `t('notStarted')` — yani "Henüz Başlanmadı", bir DİZİ terimi (Adım 4'te temizlenecek).
4. Kalıntı: `MovieCardMobile.tsx` ham `'WATCHLIST'` etiketini çevirmeden basıyor; web kartı aynı etiketi çeviriyor (Adım 4).

**Adım 1 — veri modeli (yeni dosya `store/tracking/movieTrackingLogic.ts`):** `categorizeMovies()` saf fonksiyonu, dizi tarafındaki `trackingLogic.ts` ile aynı sözleşmeye sahip: ham Zustand dilimlerini alır, her filmi TAM OLARAK BİR kovaya koyar. Öncelik sırası: (1) elle "Bırakıldı" → dropped, (2) izleme geçmişinde → watched, (3) yalnızca listede → watchlist. Sıralama: izlenenler son izlemeye, izlenecekler listeye eklenme tarihine göre.
**Bilinçli fark — başlık BÜYÜK HARFE ÇEVRİLMİYOR:** Dizi kartlarındaki `toTitle` başlığı `toUpperCase()` yapıyor. Film kartında aynısını yapmadık çünkü bu başlık lokal aramada da kullanılacak ve Türkçe'de `i → İ` dönüşümü karşılaştırmayı bozardı (Madde 62'de dizilerde bu yüzden `toLocaleLowerCase('tr-TR')` kullanmak zorunda kalmıştık).

**Adım 1 — ayrı "bırakıldı" deposu (`useTrackingStore.ts`):** Filmler için `droppedMovieIds` + ayrı `kaymak_tracking_dropped_movies_v1` anahtarı eklendi.
**Neden ayrı liste (kritik):** Trakt'ta dizi ve film id'leri AYRI uzaylardadır ama ikisi de düz sayıdır. Tek listede tutulsalardı, id'si 1390 olan bir filmi bırakan kullanıcı id'si 1390 olan bir diziyi de sessizce "bırakılmış" yapardı. Bu, ortaya çıkması aylar sürecek türden bir hatadır.
Ayrıca dizi/film toggle-clear mantığı dört ayrı kopya olacaktı; `writeIds`/`toggleId`/`clearId` yardımcılarıyla tek yere toplandı — ileride eklenecek bir kuralın yalnızca birine uygulanıp diğerinde unutulması yapısal olarak engellendi. Bozuk/eski kayıtları eleyen `parseIdList` eklendi (dizi olmayan bir JSON tüm store'u çökertmesin, karışık tipli dizi süzülsün).

**Adım 1 — veri bütünlüğü (`services/library/mutations/progress.ts`):** `markMovieAsWatched` artık `clearDroppedMovieStatus` çağırıyor. "Bırakıldı" en yüksek öncelikli kova olduğu için, kullanıcı bıraktığı bir filmi sonradan izlediğinde geçmişe eklenmesi tek başına yetmez — işaretin açıkça temizlenmesi gerekir. Dizilerdeki `reactivateShowTracking` kuralının film karşılığı.

**Yeniden adlandırma — `droppedIds` → `droppedShowIds`:** Film listesi eklenince `droppedIds` (diziler) ile `droppedMovieIds` (filmler) yan yana durunca isimlendirme asimetrik ve tuzaklı hale geldi. Simetri için 10 dosyada mekanik yeniden adlandırma yapıldı. Aynı asimetriye sahip olan komşu isimler de birlikte düzeltildi:
- `droppedIds` → `droppedShowIds` (state, `categorizeShows` seçeneği, tüm tüketiciler)
- `toggleDroppedStatus` → `toggleDroppedShowStatus`
- `clearDroppedStatus` → `clearDroppedShowStatus`
- `DROPPED_STORAGE_KEY` → `DROPPED_SHOWS_STORAGE_KEY`
**KRİTİK — kalıcı veri anahtarının DEĞERİ değiştirilmedi:** Sabitin adı değişti ama değeri `'kaymak_tracking_dropped_v1'` olarak AYNEN korundu. Değer değiştirilseydi mevcut tüm kullanıcıların elle işaretlediği "bırakılmış diziler" sessizce kaybolurdu. Bu yüzden veri göçü (migration) gerekmiyor.

**Doğrulama:**
1. **Saf fonksiyon — 22 test yazılıp çalıştırıldı, 22'si geçti** (`tsc` ile derlenip Node'da koşuldu): temel ayrım, "bırakıldı" önceliğinin izlenmiş filmi de kovadan çıkarması, bir film = tam olarak bir kova (aynı film hem geçmişte hem listede olduğunda tekilleştirme), kaynak içi yinelenen kayıtların elenmesi, iki kovanın sıralaması, bozuk/eksik veri (`null`, `undefined`, `{}`, id'siz kayıt, tarihsiz kayıt), boş/null dilimler, `Set` olarak `droppedMovieIds`, kategori anahtar sırası.
2. **Store — tarayıcıda gerçek zamanlı çakışma testi:** aynı trakt id'si (1390) hem dizi hem film olarak bırakıldı; iki liste yan yana durdu, film geri alındığında dizi ETKİLENMEDİ. İki ayrı localStorage anahtarı, reload sonrası `hydrate`'in ikisini de geri yüklemesi, bozuk JSON'un (`{"bozuk":true}`) mevcut veriyi SİLMEDEN yok sayılması, karışık dizinin (`[1,"x",null,2]`) `[1,2]`'ye süzülmesi doğrulandı.
3. **Yeniden adlandırma — eski verinin hâlâ okunduğu UÇTAN UCA kanıtlandı:** Yeniden adlandırmadan önceki sürümün diske yazdığı kayıt (`kaymak_tracking_dropped_v1` = `[1042]`) elle yazılıp sayfa yenilendi; 3 dizilik bir kütüphanede Profil > Diziler ekranından "Bırakılanlar" filtresi uygulandı ve ekran tam olarak 1 sonuç ("BIRAKILAN DIZI") gösterdi. Yani eski kayıt → `droppedShowIds` → `categorizeShows` → filtre zinciri kesintisiz çalışıyor.
4. `tsc --noEmit`: dokunulan 11 dosyada hata yok (kalan hatalar `useShowDetail.ts` ve `locales/` içindeki önceden var olanlardır). Yazma yolu (`toggleId`/`clearId`) yeniden adlandırmadan ÖNCE 2. maddede doğrulanmıştı; sonrasında yalnızca tanımlayıcı adları değişti, mantık aynı kaldı ve `tsc` tüm çağrı noktalarını doğruladı.
5. Geçici doğrulama kancaları ve test verisi silindi, `grep` ile teyit edildi.

**Bu maddede BİLİNÇLİ olarak yapılmayanlar:** Ekranlarda hiçbir görsel değişiklik yok — Adım 1 saf altyapıdır. Filmleri bırakılmış işaretleme yolu (Adım 2), Profil > Filmler arama+filtre arayüzü (Adım 3) ve yukarıdaki 3-4 numaralı kalıntılar (Adım 4) ayrı adımlara bırakıldı.

## 64. Adım 2: Filmlerde "Bırakıldı" Yolunun Açılması + "Bırakılanlara Ekle" → "İzlemeyi Bırak"
**Bağlam:** Madde 63'te film "bırakıldı" altyapısı (`droppedMovieIds` + `categorizeMovies`) kuruldu ama kullanıcıya açılan HİÇBİR giriş noktası yoktu — `OptionsModal`'daki ilgili satır `type === 'show'` ile kapalıydı. Bu adım o kapıyı açtı.

**Metin değişikliği (kullanıcı geri bildirimi):** "Bırakılanlara Ekle" ifadesi, sanki kullanıcının kendi oluşturduğu bir LİSTEYE ekleme yapılıyormuş izlenimi veriyordu. Oysa yapılan şey içeriğin takip durumunu değiştirmek. Etiketler hem dizilerde hem filmlerde eylem odaklı hale getirildi:
- `addToDropped` → `stopWatching`: "Bırakılanlara Ekle" → **"İzlemeyi Bırak"** (EN: "Stop Watching")
- `removeFromDropped` → `resumeWatching`: "Bırakılanlardan Çıkar" → **"İzlemeye Devam Et"** (EN: "Resume Watching")
Çeviri ANAHTARLARI da yeniden adlandırıldı: eski `addToDropped`/`removeFromDropped` adları artık gösterdikleri metni yanlış tarif ediyordu (Madde 63'teki `droppedIds` asimetrisiyle aynı sınıf bir kalıntı — bir sonraki okuyucuyu yanıltmadan temizlendi). İki kullanım yeri de güncellendi: `OptionsModal.tsx` (dizi + film detayı) ve `TrackingCardMenu.tsx` (Diziler > İzleme sekmesindeki kart menüsü).

**Kapının açılması:**
1. `components/modals/OptionsModal.tsx` — dropped satırındaki `type === 'show'` koşulu KALDIRILDI; artık tek koşul `onToggleDropped` prop'unun verilmiş olması. Böylece hangi medya tipinin bu özelliği desteklediğine ekran karar veriyor, modal değil.
2. `app/movie/[id].tsx` — `useTrackingStore`'dan `droppedMovieIds` + `toggleDroppedMovieStatus` okunuyor, `isDropped` türetiliyor ve `MediaHero`'ya geçiliyor. Dizi detayındaki desenle birebir aynı; `hydrate()` de aynı gerekçeyle çağrılıyor (kullanıcı bildirimden/paylaşılan linkten doğrudan buraya gelmiş olabilir, o durumda liste boş kalır ve daha önce bırakılmış bir film menüde yanlış etiketi gösterirdi).
3. `MediaHero.tsx` ve `OptionsModal.tsx`'teki "Yalnızca dizilerde:" prop yorumları güncellendi.
**Değiştirilmeyen (bilinçli):** `ShowCard.tsx`'teki `isDropped = type === 'show' && ...` satırı olduğu gibi bırakıldı — oradaki tek kullanım ilerleme çubuğunun rengi ve ilerleme çubuğu zaten yalnızca dizilerde var.
**Misafir kilidi:** `handleToggleDropped` içindeki mevcut `isGuest` koruması aynen geçerli; film tarafı için ayrıca bir şey eklemeye gerek olmadı (doğrulamada bu kilit gerçekten devreye girdi, bkz. aşağıda).

**Doğrulama — gerçek, etkileşimli test (web):**
Ağ bu ortamda kapalı olduğu için detay ekranları normalde açılmıyordu. Kod değiştirmek yerine hook'ların KENDİ disk önbelleği kullanıldı: `@movie_detail_v4_cache_999999` ve `@show_detail_v3_888888` anahtarlarına sahte özet yazılıp sayfalar cache-hit yolundan açıldı (üretim kodu hiç kirletilmedi).
1. **Film menüsü:** 3-nokta menüsünde "İzlemeyi Bırak" satırı GÖRÜNDÜ — bu satır daha önce filmlerde hiç yoktu.
2. **Misafir kilidi çalışıyor:** misafir modunda tıklandığında hiçbir şey yazılmadı (beklenen davranış).
3. **Yazma yolu (oturum açıkken):** "İzlemeyi Bırak" → `kaymak_tracking_dropped_movies_v1` = `[999999]`, `kaymak_tracking_dropped_v1` = `null`. Film, dizi listesine SIZMADI.
4. **Etiket tersine dönüyor:** menü yeniden açıldığında satır "İzlemeye Devam Et" oldu.
5. **Dizi tarafında regresyon yok:** dizi detayında da yeni etiket göründü, tıklandığında `kaymak_tracking_dropped_v1` = `[888888]` yazıldı ve film listesi `[999999]` olarak DEĞİŞMEDEN kaldı. İki yol uçtan uca birbirinden bağımsız.
6. `tsc --noEmit`: dokunulan dosyalarda hata yok; eski `addToDropped`/`removeFromDropped` anahtarları `grep` ile projede sıfır.
**Ortam kaynaklı bir gözlem (ürün hatası DEĞİL):** `OptionsModal` `animationType="slide"` kullanıyor ve bu tarayıcı paneli kare üretmediği için RNW'nin slide animasyonu hiç çalışmıyor, modal `translateY(720px)`'de donup ekran dışında kalıyor. Doğrulama sırasında bu transform konsoldan geçici olarak sıfırlandı. Aynı sınıf artefakt Madde 62'de de görülmüştü; gerçek cihazda/normal tarayıcıda animasyon çalıştığı için sorun teşkil etmiyor.
**Temizlik:** Sahte önbellek kayıtları, sahte token ve test sırasında yazılan "bırakıldı" kayıtları silindi, misafir modu geri alındı; üretim kodunda geçici satır kalmadığı `grep` ile teyit edildi.

**Sırada:** Adım 3 (Profil > Filmler ekranına arama + 3'lü kategori filtresi) ve Adım 4 (`movies.web.tsx`'teki `t('notStarted')` kalıntısı, `MovieCardMobile`'daki çevrilmemiş `WATCHLIST` etiketi).

## 65. Adım 3: Profil > Filmler'e Arama + 3'lü Kategori Filtresi (ve Sheet Butonlarının Gezinme Çubuğu Altında Kalması)
**Bağlam:** Madde 63-64'te film takip altyapısı (`categorizeMovies`, `droppedMovieIds`) ve "İzlemeyi Bırak" giriş noktası kuruldu. Bu adım, Madde 62'de dizilere yapılan arama+filtre arayüzünü filmlere de getirdi.

**Kullanıcı kararları (bu adımın çerçevesi):** Filtre YALNIZCA Profil > Filmler (`/library/movies`) ekranına kuruldu, Filmler sekmesine (`/movies`) hiç dokunulmadı. Sayfanın varsayılan içeriği (filtre kapalıyken) bugünküyle aynı kaldı: izlenen filmler, "Toplam: N Filmler" sayısı değişmedi.

**Ortak çekirdek çıkarıldı (`hooks/libraryFilterCore.ts` — YENİ):** Arama, debounce, taslak seçim, uygula/temizle ve süzme algoritması dizilerle filmlerde BİREBİR aynıydı. Kopyalamak yerine tek yere alındı: `useMediaFilterState` (durum), `filterLibraryItems` (saf süzme), `useFilterResult` (memoize sonuç), `normalizeForSearch`. Medya tipine özel hook'lar artık yalnızca kendi "durum indeksini" üretiyor:
- `useLibraryShowFilters` → `categorizeShows` (4 kategori) — mantığı değişmedi, sadece çekirdeğe taşındı.
- `useLibraryMovieFilters` (YENİ) → `categorizeMovies` (3 kategori).
- `useLibraryFilters` (YENİ — cephe/facade): `/library/[type]` rotası hem dizileri hem filmleri sunduğu ve hook'lar KOŞULLU çağrılamadığı için iki hook da her zaman çağrılır, yalnızca biri etkin olur. Ekranlar bu ayrımı hiç bilmez; etiketleri çözülmüş `options` ve menü başlığını da bu hook üretir.

**`LibraryFilterModal` medya tipinden bağımsız hale getirildi:** Sabit 4 dizi kategorisi ve `t('media:...')` çağrıları kaldırıldı; bileşen artık `options` (çözülmüş etiketlerle) + `title` prop'u alıyor ve `TKey extends string` üzerinden generic. Yeni bir medya tipi eklendiğinde bu dosya değişmek zorunda kalmayacak.

**Kategori havuzu — filmlerde 3'te 2 kategori varsayılan listede YOK:** Ekranın veri kaynağı `watchedMovies`. "İzlenecekler" ve izleme listesinden gelen "Bırakılanlar" orada hiç bulunmaz. Bu yüzden kategori filtresi AÇIKKEN havuza `extraPool` katılıyor (kategorilere ait olup ekranda olmayan öğeler). Filtre kapalıyken havuza girmedikleri için varsayılan içerik ve "Toplam" sayısı hiç değişmiyor — Madde 62'de dizilerdeki "Henüz Başlanmadı" için kurulan mekanizmanın aynısı, bu kez `MediaStatusIndex.extraPool` adıyla ortak çekirdeğe taşındı.

**Metin anahtarları:** `filterTitle` → `filterTitleShows` + `filterTitleMovies` ("Dizileri/Filmleri Filtrele"). Film kategorileri için `media.json`'a `filterWatched` ("İzlenenler" / "Watched") ve `filterWatchlist` ("İzlenecekler" / "Want to Watch") eklendi; "Bırakılanlar" mevcut `inactive` anahtarından okunuyor (dizilerle ortak).

**BUG DÜZELTMESİ — "Göster/Temizle" gezinme çubuğunun altında kalıyordu:** Alttan açılan sheet'te bu iki buton, Android'in gezinme çubuğunun (ve iOS'un home göstergesinin) ALTINDA kalıyordu. Sebep: modal `statusBarTranslucent` ile sistem çubuklarının altına uzanıyor, panelin sabit `paddingBottom: 32` değeri ise bunu hesaba katmıyordu. Panelin alt boşluğu artık `Math.max(insets.bottom, 16) + 16` ile hesaplanıyor (`useSafeAreaInsets`). Taban 16px, inset'in 0 döndüğü cihazlarda da parmağa pay bırakmak için. Modal tek bileşen olduğu için düzeltme dizi ve film ekranlarının İKİSİNİ birden kapsıyor.

**Doğrulama — gerçek, etkileşimli test (web):** Uygulamanın KENDİ kalıcı önbelleği (`@trakt_lib_*`) doldurularak veri sağlandı; üretim koduna hiçbir geçici satır eklenmedi. Veri seti: 40 izlenen + 25 izlenecek film, elle bırakılmış 3 tanesi (2'si izlenenlerden: 3005/3006, 1'i izleneceklerden: 4010).
1. **Varsayılan içerik korunuyor:** filtre kapalıyken "Toplam: 40 Filmler" — sayfa bugünkü anlamını aynen sürdürüyor.
2. **Arama:** "ışık" → 1 sonuç ("Işıklar Sönerken"). Türkçe büyük-I katlaması çalışıyor.
3. **Menü:** başlık "Filmleri Filtrele", kategoriler tam olarak İzlenenler / İzlenecekler / Bırakılanlar.
4. **İzlenenler** → 38 sonuç (40 − 2 bırakılan). Bırakılan ikisi (Izlenen Film 5 ve 6) doğru şekilde elendi, izlenecek hiçbir film sızmadı.
5. **İzlenecekler** → 24 sonuç (25 − 1 bırakılan). Bırakılan "Izlenecek Film 10" listede YOK. Bu kategori tamamen `extraPool`'dan geliyor — mekanizmanın çalıştığının doğrudan kanıtı.
6. **Bırakılanlar** → tam 3 kayıt: Izlenen Film 5, Izlenen Film 6, Izlenecek Film 10. Yani hem izlenenlerden hem izleneceklerden gelenler birlikte.
7. **Dizilerde regresyon YOK** (ortak çekirdeğe taşıma sonrası): 30 dizilik veri setinde (20'si 3 gün, 10'u 120 gün önce izlenmiş) "Aktif İzlenenler" → 20 (Dizi 0-19), "Ara Verilenler" → 10 (Dizi 20-29). Toplam 30, çakışma ve sızıntı yok. Menü hâlâ 4 kategorili ve başlığı "Dizileri Filtrele".
8. **Mobil sheet:** panelin doğal genişliği 768'in altına düştüğünde sheet varyantı doğru render oldu; alt boşluk `useSafeAreaInsets`'ten hesaplandı, "Göster" butonu görünür alanın içinde ve altında 32px boşlukla konumlandı. Modal içinde `useSafeAreaInsets` çağrısının çökmediği de böylece doğrulandı (context sağlayıcıdan miras alınıyor).
9. `categorizeMovies` saf fonksiyon testi (22 test) yeniden koşuldu, hepsi geçti. `tsc --noEmit`: dokunulan dosyalarda hata yok.

**DOĞRULANAMAYAN — dürüst kayıt:** Gezinme çubuğu düzeltmesinin ASIL etkisi web'de görülemez, çünkü web'de `insets.bottom = 0` ve hesaplanan değer `max(0,16)+16 = 32px`, yani eski sabit 32 ile AYNI. Düzeltme yalnızca `insets.bottom`'ın 24-48px olduğu Android/iOS'ta fark yaratır. Kod yolu ve çökmezlik doğrulandı, görsel sonuç gerçek cihazda teyit edilmeli.
**Ortam kısıtı (ürün hatası değil):** Tarayıcı paneli `resize_window` ile 375px'e küçültüldüğünde CDP tıklamaları sayfaya hiç ulaşmıyor (arama kutusuna tıklamak bile odak vermiyor). Mobil doğrulama bu yüzden panelin doğal boyutu (523px, yine 768 altı → sheet varyantı) kullanılarak yapıldı. Ayrıca Madde 62/64'te olduğu gibi RNW'nin `slide` animasyonu bu panelde kare üretilmediği için donuyor; ölçüm öncesi transform konsoldan geçici sıfırlandı.
**Temizlik:** Tüm test verisi (`@trakt_lib_*`, bırakıldı kayıtları, sahte token) silindi, misafir modu geri alındı; üretim kodunda geçici satır kalmadığı `grep` ile teyit edildi.

**Sırada:** Adım 4 — `movies.web.tsx`'teki `t('notStarted')` kalıntısı ve `MovieCardMobile`'daki çevrilmemiş `WATCHLIST` etiketi.

## 66. Adım 4: Filmlerdeki Dizi Kalıntılarının Temizlenmesi ve Etiket Çevirisinin Tek Kaynağa Alınması
**Bağlam:** Madde 63'ün ön incelemesinde filmler tarafında tespit edilen iki kalıntı bu adımda kapatıldı. İkisinin de kökeni aynı: filmler dizilerden kopyalanırken bazı metinler ya olduğu gibi taşınmış ya da hiç ele alınmamış.

**Kalıntı 1 — filmlerde "Henüz Başlanmadı" (`movies.web.tsx`):** İzleme Listesi sekmesindeki karuselin başlığı `t('notStarted')` idi — yani **"Henüz Başlanmadı"**. Bu, takip modülünün DÖRT DİZİ KATEGORİSİNDEN biri ve filmlerde hiçbir karşılığı yok. Doğru terim olan `t('filterWatchlist')` ("İzlenecekler" / "Want to Watch") ile değiştirildi. Aynı yanlış anahtar yükleme iskeletinin başlığında da kullanılıyordu; o da düzeltildi — aksi halde veri gelince başlık metni değişip zıplardı.

**Kalıntı 2 — etiket (tag) çevirisi üç farklı yerde üç farklı şekilde yapılıyordu:** Veri katmanı etiketleri SEMANTİK KOD olarak üretir (`'WATCHLIST'`, `'BIRAKILDI'`, `'EN SON'`…) ve bu kodlar tarihsel sebeplerle Türkçe yazılmıştır. Bulunan durum:
- `EpisodeCard.web.tsx` — dosyaya gömülü yerel bir `getTagLabel` yardımcısı vardı (doğru davranış, ama paylaşılmıyordu).
- `MovieCard.web.tsx` — yalnızca tek bir kodu ele alan kendi ayrı ternary'si: `tag === 'WATCHLIST' ? t('watchlistTab') : tag`.
- `MovieCardMobile.tsx` — **hiçbir çeviri yok**, etiket HAM haliyle basılıyordu: kullanıcı kartta İngilizce arayüzde bile "WATCHLIST" görüyordu.
**Çözüm:** `utils/mediaTagLabel.ts` (YENİ) — `getMediaTagLabel(tag, t)` tek kaynak. `EpisodeCard.web`'deki yerel yardımcı silinip buraya taşındı, eksik kodlar (`PREMIERE`, `YENİ`, `TAMAMLANDI`) da eklendi; üç kart bileşeni de artık bunu kullanıyor. Bilinmeyen kod geldiğinde kodun kendisi dönüyor (ekranda boşluk değil, en azından ham kod görünsün).
**Dokunulmayan (bilinçli):** `EpisodeCardMobile.tsx` her etiketi kendi rengi/stiliyle ayrı ayrı render ediyor (`PREMIERE` beyaz, `BIRAKILDI` sarı…) ve metinleri zaten çeviriyor. Orası tasarım gereği farklı, ortak yardımcıya zorlanmadı.

**Yoldan çıkan üçüncü bulgu — İngilizce menüde "Ayarlar":** Doğrulama sırasında fark edildi. `Sidebar.tsx` `navigation` namespace'ini kullanıyor ama `settings` anahtarı yalnızca `common` ve `settings` namespace'lerinde tanımlıydı. Sonuç: `t('settings', { defaultValue: 'Ayarlar' })` her zaman varsayılana düşüyor ve İngilizce kullanıcı menüde "Ayarlar" görüyordu. Anahtar iki dilin `navigation.json`'una eklendi.

**Doğrulama — her iki dilde gerçek test (web):** Uygulamanın kendi kalıcı önbelleği (`@trakt_lib_*`) doldurularak 6 izleme listesi filmi enjekte edildi; üretim koduna geçici satır eklenmedi.
1. **Mobil kart (dar görünüm):** etiket artık "İzleme Listesi" — ham `WATCHLIST` metni ekranda YOK.
2. **Web karuseli (geniş görünüm):** başlık "İzlenecekler"; "Henüz Başlanmadı" ekranda YOK.
3. **İngilizce (`app_language = en`):** karusel başlığı "Want to Watch", etiket "Watchlist", menüde "Settings". Türkçe sızıntı taraması temiz: "Henüz Başlanmadı", "İzlenecekler", "İzleme Listesi", ham "WATCHLIST" ve "Ayarlar" — hiçbiri yok.
4. **Türkçeye geri dönüşte regresyon yok:** menü ve başlıklar eski hâlinde ("Diziler / Filmler / Keşfet / Profil / Ayarlar", "İzlenecekler").
5. `tsc --noEmit`: dokunulan dosyalarda hata yok (kalan hatalar `useShowDetail.ts` ve `locales/` içindeki önceden var olanlardır). `grep`: filmlerde `notStarted` ve ham etiket basımı sıfır.

**Yanlış alarm (kayda geçiyor):** Doğrulama sırasında mobil film kartında ham ISO tarih (`2026-06-22T21:12:21.363Z`) göründü ve bir an biçimlendirme hatası sanıldı. İncelendiğinde web ve mobil kartların AYNI ifadeyi (`data.releaseDate || data.year`) kullandığı, sorunun test verisinde tam ISO damgası enjekte edilmiş olmasından kaynaklandığı görüldü — Trakt gerçekte `YYYY-MM-DD` gönderiyor. Ürün hatası değil, değişiklik yapılmadı.

**Temizlik:** Tüm test verisi ve dil seçimi silindi, misafir modu geri alındı; üretim kodunda geçici satır kalmadığı `grep` ile teyit edildi.

**Filmler dört adımlık planın sonuna geldi:** veri modeli (63) → "İzlemeyi Bırak" giriş noktası (64) → arama + 3'lü filtre (65) → kalıntı temizliği (66).

## 67. KÖK NEDEN BULUNDU: Profil > Diziler/Filmler Listesinin Sonunda "Sayfa Yenileniyormuş Gibi" Sıçrama
**Semptom (kullanıcı bildirimi):** Profil > Diziler (ör. 140 öğe) veya Profil > Filmler listesinde en son öğeye kadar inip biraz DAHA kaydırınca ekran 1-2 saniyeliğine bozuluyor, sanki sayfa yenileniyormuş gibi sıçrayıp geri geliyor. Tekrar kaydırınca tekrar oluyor. Her iki listede de var.

**Neden daha önce çözülemedi:** Madde 62'de (ve öncesinde) bu semptom "küsurat birikmesi" sanılmıştı — `getItemLayout`'un bildirdiği yükseklik ile piksele yuvarlanmış gerçek hücre arasında satır başına biriken sub-pixel farkı. Bu teoriyle hücre boyutları `Math.round` ile tam piksele çekilmişti. Sorun devam etti, çünkü gerçek sapma küsurat DEĞİL, **3 KATLIK bir çarpandı**.

**Gerçek kök neden (React Native kaynağı okunarak doğrulandı, tahmin değil):**
`numColumns > 1` iken FlatList, alttaki `VirtualizedList`'e listeyi ÖĞE ÖĞE değil **SATIR SATIR** verir:
- `_getItemCount` → `Math.ceil(data.length / numColumns)` (yani satır sayısı)
- `_getItem` → bir satırın `numColumns` kadar öğesini TEK bir dizi olarak döndürür (`index * numColumns + kk`)
- `_keyExtractor` ve `_onViewableItemsChanged` de aynı `index * numColumns + kk` dönüşümünü yapar
(`node_modules/react-native/Libraries/Lists/FlatList.js`)

Buna karşılık **`getItemLayout` hiçbir dönüşüme uğramadan** `...restProps` ile VirtualizedList'e aktarılır (aynı dosya, `render()`). Yani `getItemLayout`'a gelen `index` **ZATEN SATIR İNDEKSİDİR**.

`screens/LibraryMobile.tsx` ise bu indeksi bir kez DAHA sütun sayısına bölüyordu:
```
const row = Math.floor(index / NUM_COLUMNS);   // ← HATA: index zaten satır indeksi
return { length: rowHeight, offset: SPACING + rowHeight * row, index };
```
Sonuç: ardışık ÜÇ satır aynı `offset` değerini alıyor ve offset gerçeğin 1/3'ü hızında büyüyordu. `length` doğru olduğu için liste normal görünüyor, hata yalnızca VirtualizedList'in kare (frame) verilerinden hesapladığı TOPLAM İÇERİK YÜKSEKLİĞİNDE ortaya çıkıyordu. Kullanıcı listenin gerçek sonuna inip biraz daha kaydırınca, VirtualizedList'in kare modeli ile gerçekte ölçülen içerik boyutu çelişiyor ve bir scroll-offset düzeltmesi tetikleniyordu — ekrandaki "yenileniyormuş gibi sıçrama" tam olarak buydu. Overscroll her tekrarlandığında çelişki yeniden doğduğu için bug da tekrarlıyordu.

**Sayısal kanıt (tarayıcıda, 140 öğelik gerçek listede ölçüldü — genişlik 700px):**
| | Değer |
|---|---|
| Hesaplanan `rowHeight` | 343 px |
| DOM'da ÖLÇÜLEN satır aralığı | 343 px ✓ (model doğru) |
| Satır sayısı (`ceil(140/3)`) | 47 |
| GERÇEK içerik yüksekliği (`scrollHeight`) | 16177 px |
| Beklenen (`8 + 47×343 + 8 + 40`) | 16177 px ✓ |
| **ESKİ** formülün son kare sonu | **5496 px** |
| **YENİ** formülün son kare sonu | **16129 px** ✓ (kalan 48px = alt padding + footer, VirtualizedList onları ayrı takip eder) |

Eski model içeriğin 5496px'te bittiğini söylüyordu, gerçekte 16177px'te bitiyor — **~10.700 px / ~2,94 kat** sapma. Küsurat yuvarlamanın bunu düzeltmesi imkânsızdı.

**Çözüm (`screens/LibraryMobile.tsx`):** Fazladan bölme kaldırıldı, parametre adı da niyeti belgeleyecek şekilde `rowIndex` yapıldı:
```
const getItemLayout = useCallback((_data, rowIndex) => ({
  length: metrics.rowHeight,
  offset: SPACING + metrics.rowHeight * rowIndex,
  index: rowIndex,
}), [metrics.rowHeight]);
```
Hücre boyutlarındaki `Math.round` KORUNDU (kendi başına doğru ve zararsız bir önlem), ama onu açıklayan yanıltıcı yorum düzeltildi: artık sıçramanın sebebi olarak küsurat birikmesini göstermiyor.

**Doğrulama:** Düzeltme sonrası 140 öğelik listede en alta kaydırılıp 2,5 saniye boyunca 100ms aralıkla 25 örnek alındı: `scrollTop` **15516'da sabit kaldı, sapma 0 px**; `scrollHeight` de 16177'de değişmedi. Kare modeli ile gerçek içerik artık örtüştüğü için düzeltme tetiklenmiyor.

**Kapsam taraması — başka yerde aynı hata var mı:** Projedeki tüm `getItemLayout` ve `numColumns` kullanımları tarandı.
- `components/HorizontalShowList.tsx` → `horizontal` (tek satır, `numColumns` yok); `index` doğrudan öğe indeksidir, kodu DOĞRU.
- `library/view-all.web.tsx`, `library/[type].web.tsx`, `explore/ExploreWebGrid.tsx` → `numColumns` kullanıyor ama `getItemLayout` VERMİYOR, dolayısıyla etkilenmiyorlar.
- `components/tracking/TrackingAccordionList.tsx` → `getItemLayout` bilinçli olarak eklenmemiş (bkz. Madde 60/61).
Yani hata yalnızca `LibraryMobile`'daydı ve orası hem Diziler hem Filmler ekranını besleyen TEK dosya olduğu için kullanıcının "ikisinde de var" gözlemiyle birebir örtüşüyor.

**Not:** Semptom native (APK) tarafında bildirildi; buradaki ölçüm ve doğrulama web üzerinde yapıldı. VirtualizedList mantığı saf JS ve iki platformda ortak olduğu için kare/gerçek yükseklik uyumsuzluğu ve düzeltmesi de ortaktır; yine de gerçek cihazda son bir teyit önerilir.

## 68. Profil (Mobil) Tasarım Elden Geçirmesi: Ortak Ölçü/Başlık Dili ve Kompakt Özet Kartı
**Bağlam:** Profil ekranı zamanla parça parça büyümüş, her bölüm kendi ölçüsünü ve kendi başlık stilini tanımlar hale gelmişti. Kullanıcının bildirdiği iki somut şikâyet — "Listelerim kartları diğerlerinden büyük" ve "en üstteki toplam izleme süresi çok iri" — aynı kök sorunun belirtileriydi: ortak bir tasarım kaynağı yoktu.

**Ortak ölçü kaynağı (`components/profile/profileMetrics.ts` — YENİ):** Poster kart genişliği/yüksekliği, kartlar arası boşluk, şerit kenar boşluğu ve şeritler arası dikey boşluk tek yere alındı. Önceki durum: poster kartları `width * 0.28`, "Listelerim" kartları ise SABİT 160×220 idi; aynı ekranda alt alta duran şeritler belirgin şekilde farklı boyuttaydı. Ayrıca kenar boşlukları da tutarsızdı (poster şeritleri 16px, Listelerim 20px, üst başlık 20px).

**Ortak bölüm başlığı (`components/profile/SectionHeader.tsx` — YENİ):** Ekranda İKİ ayrı başlık dili vardı — poster şeritleri 18px kalın başlık + yalnız chevron; "Listelerim" ise 19px + ikon rozeti + sayı rozeti + "Tümü" metni. Tek bileşende birleştirildi (ikon rozeti + başlık + opsiyonel sayı + "Tümünü Gör ›"). `HorizontalShowList` de bu bileşene geçirildi ve kendi başlık stillerinden arındırıldı. Her şerit artık ikonlu: Diziler/Filmler mavi, favoriler kırmızı.

**Kompakt özet kartı (`ProfileStatsMobile.tsx`):** Süre 44px'lik dev bir rakamla tek başına bir satırda duruyor, altında ayrı bir istatistik satırı daha vardı. Yeni düzende süre (26px) ve izlenen sayısı ince bir dikey ayraçla AYNI satırda; sekmeler de küçültüldü. Kart yüksekliği ölçüldü: **145 px** (öncesi ~255 px — yaklaşık %43 daha alçak), bilgi kaybı yok.

**"Listelerim" kartları:** Artık poster kartlarıyla BİREBİR aynı ölçüde. Başlık poster üzerine bindirme yerine ALTINA taşındı (küçülen kartta iki satırlık bindirme kapağın neredeyse tamamını örtüyordu) ve öğe sayısı posterin köşesinde küçük bir rozete alındı. Başlığa sabit iki satırlık yükseklik verildi — aksi halde 1 ve 2 satırlık başlıklar kartların alt kenarını tırtıklı bırakıyordu.

**Yoldan çıkan düzeltmeler:**
1. **İskelet ile kart uyuşmuyordu:** `ListCardSkeleton` kartın ALTINDA bir başlık çizgisi çiziyordu (yani başlığın altta olduğu bir düzene göre yazılmıştı), oysa `ListCard` başlığı posterin ÜSTÜNE basıyordu; ayrıca iskelet 160×220 sabitlerini kendi içinde tekrar tanımlıyordu. İkisi de artık `profileMetrics`'ten besleniyor, veri gelince layout kaymıyor.
2. **Türkçe büyük harf hatası:** Özet kartındaki etiket `textTransform: 'uppercase'` ile büyütülüyordu. Bu dönüşüm locale duyarsızdır ve Türkçe'de "i" harfini "İ" değil "I" yapar — ekranda **"TOPLAM İZLEME SÜRESI"** yazıyordu (ekran görüntüsüyle doğrulandı). `textTransform` kaldırıldı, vurgu harf aralığı ve renkle sağlanıyor. (Madde 62'deki arama normalizasyonuyla aynı sınıf bir hata.)
3. **Sekmeye dokunmak istatistik sayfasına götürüyordu:** Özet kartının TAMAMI `Pressable` idi ve Diziler/Filmler sekmeleri onun İÇİNDE yer alıyordu; sekmeye dokunuş dışa sızıp `router.push` tetikliyordu (web'de doğrulandı, iç içe Pressable'ın bilinen davranışı). Kart artık düz bir `View`; yalnızca yanında zaten ok işareti bulunan DEĞER SATIRI gezinir. Bu yapı eski koddan devralınmıştı, bu maddede düzeltildi.
4. Favori Filmler boş durumu da ortak başlık + `ListsEmptyCard` diliyle uyumlu, alçak (88px) kesikli çerçeveli bir karta dönüştürüldü; eskiden 120px'lik ayrı bir stil adasıydı.
5. Üst başlık şeridi (Profil + ayarlar) 20px'ten 16px'e alınarak altındaki tüm içerikle aynı ızgaraya oturtuldu.

**Doğrulama (web, 420×860 mobil görünüm, gerçekçi veriyle — 24 dizi, 18 film, 6 favori dizi, 4 liste, boş favori filmler):**
1. **Kart ölçüleri:** ekrandaki 68 kartın tamamı 118×177 px — Listelerim kartları dahil hepsi aynı (beklenen `round(420×0.28)=118`, `round(118×1.5)=177`).
2. **Hizalama:** dört şeridin de ilk kartı x=16'da; özet kartı da x=16, genişlik 388 (=420−32). Tam ızgara uyumu.
3. **Özet kartı yüksekliği:** 145 px.
4. **Etiket:** "Toplam İzleme Süresi" doğru yazılıyor (artık "SÜRESI" değil).
5. **Sekme davranışı:** "Filmler" sekmesine dokunulduğunda sayfa `/profile`'da KALDI ve değerler doğru şekilde film verisine geçti ("28 Gün, 15 Saat" / "316 İzlenen Film"). Değer satırına dokunulduğunda ise `/profile/statistics` açıldı — iki eylem artık birbirine karışmıyor.
6. Ekran görüntüsüyle üst ve alt bölümler görsel olarak kontrol edildi; `tsc --noEmit` dokunulan dosyalarda temiz.

**Temizlik:** Test verisi silindi, misafir modu geri alındı.

**Not:** Doğrulama web'in mobil genişliğinde yapıldı. Ölçü ve yerleşim mantığı platformdan bağımsız olduğu için native'de de aynı sonucu vermeli; yine de gerçek cihazda bir kez göz atılması önerilir.

## 69. "Detaylı Analiz" Ekranı: Sahte Verinin Kaldırılması, Puan Kaybı Hatası ve Etkileşimli Grafikler
**En büyük bulgu — sayfa uyduruyordu:** Tür ve aylık grafiklerin ikisi de `components/profile/stats/mockChartData.ts` içindeki SABİT değerlerden besleniyordu. Her kullanıcıya aynı "Bilim Kurgu %40, Drama %25, Komedi %20, Suç %15" tablosu gösteriliyor; aylık çubukların etiketleri ("Şub, Mar, Nis, May, Haz, Tem") koda gömülü olduğu için gerçek takvimle hiç ilgisi olmuyordu. Dosyadaki `TODO` bunun geçici olduğunu söylüyordu ama ekran üretimde bu haliyle duruyordu.

**Gerçek veri kaynakları (doğrulandı):** `getWatchedShows` ve `getWatchedMovies` uç noktalarının İKİSİ de `extended=full` ile çekiliyor — yani `show.genres` / `movie.genres` alanları zaten elimizde ve hiç kullanılmıyormuş. Aylık etkinlik için `last_watched_at`, puanlar için `userRatingsShows/Movies` kullanıldı.

**KRİTİK HATA — kullanıcının tüm puanları siliniyordu (`services/api/users.ts`):** `getUserRatings` hatayı yutup `return []` yapıyordu. Oysa çağıran taraf (`fetchers.ts`) "başarısızlık = null" sözleşmesine göre yazılmış: istek `.catch(() => null)` ile sarmalanıyor ve `null` gelince `setIfValidInitial` önbellekteki eski veriyi koruyor. Fonksiyon reject etmediği için o `.catch` HİÇ çalışmıyor, `[]` geçerli bir sonuç sanılıp hem store'a hem diske yazılıyordu. Sonuç: ağ hatası, Trakt kesintisi veya rate-limit durumunda kullanıcının verdiği TÜM puanlar uygulamadan ve yerel önbellekten siliniyordu. `throw error` ile kardeş fonksiyonların (getWatchedShows vb.) sözleşmesine uyduruldu. **Bu hata bu maddedeki çalışma sırasında tesadüfen değil, puan grafiği boş çıkınca kovalanarak bulundu.**
Aynı desendeki diğer iki fonksiyon (`getEpisodeComments`, `getRelatedMovies`) incelendi ve BİLİNÇLİ olarak değiştirilmedi: onların boş dönmesi yalnızca "yorum yok / benzer film yok" demek, kalıcı kullanıcı verisi silmiyor.

**Diğer düzeltilen hata:** `GenreDonutChartWide` en büyük dilimi `data.reduce(fn, data[0])` ile buluyordu; veri boşken `max.value` okunurken ÇÖKÜYORDU. Sahte veri hep dolu olduğu için bu hata görünmüyordu — gerçek veriye geçilince ilk boş kütüphanede çökecekti. Boş durum artık açıkça ele alınıyor.
**Görsel hata:** Aylık grafiğin eksen tavanı veriye göre ayarlanmıyordu; aylık değerler küçükken (1-3) sütunlar kartın dibinde cılız kalıyordu. Tavan artık tepe değerden türetiliyor ve bölüm sayısına tam bölünecek şekilde yuvarlanıyor (eksen etiketleri tam sayı çıksın diye).

**Veri katmanı (`hooks/useProfileStatistics.ts`):** Hook artık `genres`, `monthly`, `ratings` ve `hasContent` da döndürüyor.
- **Türler:** İzlenen içeriklerin `genres` dizileri sayılır, ilk 6 tür gösterilir, kalanı "Diğer"de toplanır. Yüzde, İÇERİK sayısı üzerinden değil TÜR ETİKETİ toplamı üzerinden hesaplanır — bir dizi birden fazla türe ait olabildiği için aksi halde yüzdeler 100'ü aşardı. Eşit sayıdaki türler arasında alfabetik sıralamayla deterministik sıra garantilenir (renkler kaymasın).
- **Aylık:** Son 6 ay iskeleti önce kurulur (veri olmayan ay 0 değeriyle grafikte yer alır, zaman ekseni kesintisiz görünür), ay adları `toLocaleDateString` ile ARAYÜZ DİLİNDE üretilir.
- **Dürüstlük notu (kod içinde de yazılı):** `last_watched_at` bir içeriğin SON izlenme anıdır; dolayısıyla grafik "o ay kaç bölüm izlendi"yi değil "o ay kaç dizi/filmle ilgilenildi"yi gösterir. Etiketler ("{{count}} dizi/film") elimizdeki veriyle dürüstçe söylenebilecek şeyi söyleyecek biçimde yazıldı.
- **Puanlar:** 1-10 dağılımı, toplam ve ortalama.

**Tür etiketleri:** `locales/{tr,en}/media.json` içine 35 Trakt tür kodunun çevirisi eklendi (`genres.science-fiction` → "Bilim Kurgu" / "Science Fiction"). Çevirisi olmayan bir kod gelirse okunabilir yedek üretilir ('game-show' → 'Game Show').

**Etkileşim (kullanıcı isteği):**
1. **Tür halkası:** dilimler VE lejant satırları tıklanabilir; seçilen tür halkanın ortasında yüzdesiyle, altta ise "Dram · 8 içerikte" şeklinde GERÇEK SAYISIYLA gösteriliyor. Seçilmeyen dilimler soluklaşıyor. Eskiden yalnızca en büyük dilimin yüzdesi sabit yazıyordu ve yüzdenin kaç içeriğe denk geldiği hiç görünmüyordu.
2. **Aylık grafik:** sütunlara dokunulunca o ayın gerçek değeri başlıkta yazıyla çıkıyor; seçili sütun renkle ayrışıyor. Varsayılan seçim en güncel ay.
3. **Özet kartları:** "İzlenen Bölüm" ve "İzlenen Film" kutuları artık kütüphanenin ilgili listesine gidiyor. Süre kutusu bir listeye karşılık gelmediği için bilinçli olarak tıklanamaz.
4. **YENİ kart — Puan Dağılımı:** 1-10 arası sütunlar, ortalama rozeti, sütuna dokununca o puandan kaç tane verildiği. Grafik kütüphanesi bilinçli KULLANILMADI: on basit sütun için `flex` yükseklikleri hem daha az bağımlılık hem de dokunma alanı/seçili durum üzerinde tam kontrol demek.
5. **Boş durumlar:** hiç içerik yoksa sayfa artık boş grafikler yerine açıklayıcı bir kart gösteriyor; tür/aylık/puan kartlarının her birinin kendi boş metni var.

**Ölü kod temizliği:** `mockChartData.ts` tamamen silindi. `getHistoryEpisodes` (users.ts) tanımlıydı ama projede HİÇ çağrılmıyordu — silindi.

**Doğrulama (web, 420×860, 15 dizi + 10 film gerçekçi tür/puan/tarih verisiyle):**
1. **Tür matematiği bağımsız betikle karşılaştırıldı:** Diziler → Dram 8, Suç 3, Bilim Kurgu 3, Komedi 2, Macera 1, Animasyon 1, Diğer 6; toplam etiket 24; Dram %33 (8/24). Birebir tuttu. (Bağımsız betiğim eşitlik durumunda alfabetik sıralama uygulamadığı için 1'lik türlerin sırası farklı çıktı; hook'un deterministik sıralaması doğru olan.)
2. **Sekme gerçekten veriyi değiştiriyor:** Filmler → Aksiyon 3, Dram 3, Komedi 2, Bilim Kurgu 2, Macera 1, Aile 1, Diğer 3; toplam 15; Aksiyon %20 (3/15) ✓.
3. **Tür seçimi:** lejanttan "Bilim Kurgu"ya tıklandı → merkez "%13 Bilim Kurgu", alt satır "Bilim Kurgu · 3 içerikte" (3/24 = %12,5 → 13) ✓.
4. **Aylık:** etiketler gerçek son 6 ay (Şub, Mar, Nis, May, Haz, Tem), seçili ay vurgulu; eksen tavanı düzeltmesinden sonra sütunlar kart alanını düzgün dolduruyor (ekran görüntüsüyle önce/sonra karşılaştırıldı).
5. **Puanlar:** Diziler → 10 puanlama, ortalama 7.9, dağılım 3→1, 6→1, 7→1, 8→2, 9→3, 10→2 (girilen 10,10,9,9,9,8,8,7,6,3 ile birebir) ✓. Filmler → 5 puanlama, ortalama 7.4 (37/5) ✓.
6. **Puan kaybı hatası:** düzeltmeden ÖNCE, ağ hatası sonrası `@trakt_lib_userRatingsShows` diskte `[]` oluyor ve kart "Henüz puan vermedin" gösteriyordu — iki kez üst üste tekrarlandı. Düzeltmeden SONRA aynı senaryoda puanlar hem diskte hem ekranda korundu.
7. **Navigasyon:** "İzlenen Bölüm" kutusuna dokunuldu → `/library/shows` açıldı ✓.
8. **Tamamlanma:** Filmler %100 (10/10) ✓.
9. `tsc --noEmit` dokunulan dosyalarda temiz; `grep` ile `mockChartData` ve `getHistoryEpisodes` referansı sıfır.

**Temizlik:** Test verisi silindi, misafir modu geri alındı.
**Not:** Web (`Wide`) bileşenleri de aynı gerçek veriye ve aynı seçim davranışına geçirildi; ancak doğrulama mobil genişlikte yapıldı, masaüstü düzeni gözle kontrol edilmedi.

## 70. Madde 69'daki İki Yeni Hatanın Düzeltilmesi: Puan Ölçeği (10 → 5) ve Sekmeler Arası Veri Sızıntısı
**Bağlam:** Madde 69'da eklenen Puan Dağılımı kartı ve özet satırında kullanıcının bildirdiği iki hata bulundu — ikisi de kodsal inceleme + izole Node betiğiyle (tarayıcı açılmadan) doğrulandı.

**Hata 1 — Puan Dağılımı 10'luk ölçekte gösteriyordu, uygulama genelinde ölçek 5:** `StarSlider`, `MediaHero`, `InlineRater`, `formatRating` — projedeki HER yer Trakt'ın dahili 1-10 tam sayı puanını ikiye bölüp "X/5" olarak gösteriyor (`grep` ile 7 dosyada doğrulandı). Yeni eklenen `RatingDistributionChart` ise ham 1-10 değerleri doğrudan basıyordu ("7.9" gibi) — kullanıcı puan verirken 1-5 yıldız seçiyor, analiz sayfasında 10 üzerinden bir sayı görüyordu.
**Çözüm (`hooks/useProfileStatistics.ts`):** `RatingBar.score` artık 5 yıldızlık ölçekte (0.5 artışlarla: raw/2), ham değer ayrıca `rawScore` alanında saklanıyor. `average` da aynı ölçekte hesaplanıyor. `RatingDistributionChart.tsx` bar etiketleri ve ortalama için ARTIK KENDİ FORMÜLÜNÜ İCAT ETMİYOR — uygulamanın tek doğru kaynağı olan `utils/formatRating.ts` yeniden kullanılıyor (`formatRating(bar.rawScore)`, `formatRating(ratings.average * 2)`), böylece bu grafik projenin geri kalanıyla otomatik olarak aynı biçimlendirme kuralına (tam sayıda ondalık göstermeme vb.) tabi.

**Hata 2 — özet kartları sekmeden bağımsız her zaman AYNI değeri gösteriyordu:** `summary.totalMinutes` = `episodes.minutes + movies.minutes` (HER ZAMAN toplam), `episodesWatched` ve `moviesWatched` de her zaman İKİSİ BİRDEN gösteriliyordu. Sonuç: kullanıcı "Filmler" sekmesine geçse bile üstteki kartlar hâlâ dizi verisini (ör. "İzlenen Bölüm") gösteriyordu — sekmelerin görsel dışında hiçbir işlevi yoktu.
**Çözüm:** `ProfileStatsSummary` arayüzü `{ totalMinutes, watchedCount }` olarak sadeleştirildi; `useProfileStatistics` artık `activeTab`'a göre YALNIZCA o sekmenin süresini/sayısını döndürüyor (diziler → yalnızca `episodes.*`, filmler → yalnızca `movies.*`). `StatsSummaryRow` ve `StatsSummaryRowWide` üç kart yerine iki karta indirildi: geniş süre kartı + sekmeye göre ikonu/etiketi/gittiği kütüphane sayfası değişen tek bir sayaç kartı (Tv/mor → `/library/shows`, Film/turuncu → `/library/movies`). Her iki ekran (`ProfileStatisticsMobile.tsx`, `ProfileStatisticsWeb.tsx`) yeni `activeTab` prop'unu geçecek şekilde güncellendi.

**Doğrulama — KULLANICI İSTEĞİ ÜZERİNE tarayıcı AÇILMADAN, yalnızca kod incelemesi + izole mantık testiyle yapıldı:**
1. `grep` ile projede `episodesWatched`/`moviesWatched`/eski `ProfileStatsSummary` alanlarına kalan referans olmadığı, `RatingBar`/`ratings.bars`/`ratings.average`'ın tek tüketicisinin güncellenen `RatingDistributionChart` olduğu doğrulandı.
2. Hook'taki `computeSummary` ve `computeRatings` fonksiyonlarının BİREBİR kopyası ayrı bir Node betiğinde çalıştırıldı (kullanıcının bildirdiği senaryoya yakın veriyle: 4812 bölüm/187430 dk dizi, 316 film/41220 dk film, 10 dizi + 5 film puanı) — **18 test, 18'i geçti**:
   - Diziler sekmesi → `totalMinutes` SADECE 187430 (film süresi 41220 hiç karışmıyor), `watchedCount` SADECE 4812.
   - Filmler sekmesi → `totalMinutes` SADECE 41220, `watchedCount` SADECE 316.
   - Regresyon kontrolü: iki sekmenin döndürdüğü değerler artık kesinlikle FARKLI (eski hata tam olarak bunun aynı olmasıydı).
   - Puan ortalaması artık 5 ölçekte **3.95** (10 ölçekte 7.9 DEĞİL), 5.0'ı geçmiyor.
   - Bar etiketleri tam olarak `["0.5","1","1.5","2","2.5","3","3.5","4","4.5","5"]` — `formatRating` ile üretildi, elle yazılmadı.
   - Girilen 10 puanın (10,10,9,9,9,8,8,7,6,3) kova dağılımı doğru: `[0,0,1,0,0,1,1,2,3,2]`.
   - Filmler sekmesinde bağımsız hesap: 5 puan, ortalama 3.7 (ham 7.4/2) ✓.
   - Uç durumlar: puan yokken çökmeden `{total:0, average:0}`; `userStats` `null` iken çökmeden `{0,0}`.
3. `tsc --noEmit`: dokunulan dosyalarda hata yok (kalan hatalar önceden var olan `useShowDetail.ts`/`locales/` hatalarıdır).

**Bilinçli olarak dokunulmayan bir kozmetik ayrıntı:** `formatRating(ratings.average * 2)` bazı ortalamalarda (ör. 3.95) `toFixed(1)`'in kayan nokta yuvarlamasından dolayı "4.0" gösterebiliyor (tam sayıya çok yakın ama tam eşit değil). Bu, paylaşılan `formatRating` yardımcısının projede zaten var olan bir davranışı — düzeltmek `formatRating`'i (ve onu kullanan 7 dosyayı) değiştirmeyi gerektirirdi, bu maddenin kapsamı dışında bırakıldı.

## 71. Mobil Profil İyileştirmelerinin Masaüstüne (Web) Taşınması
**Bağlam:** Madde 68-70'te profil ana sayfası ve Detaylı Analiz ekranı mobilde kapsamlı biçimde elden geçirildi. Kullanıcı bu işi masaüstü tarafına da uygun şekilde taşımayı istedi. Kodlamaya başlamadan önce projedeki `.web.tsx` dosyaları tarandı ve neyin zaten paylaşılan/dual-purpose olduğu, neyin gerçekten mobil-özel kaldığı netleştirildi.

**Zaten dual-purpose olup ek iş gerektirmeyenler (doğrulandı, dokunulmadı):** Diziler/Filmler arama+filtre (`[type].web.tsx` zaten `useLibraryFilters` + `LibraryFilterBar/Modal`'a bağlıydı), "İzlemeyi Bırak" metni/mantığı (`OptionsModal`/`TrackingCardMenu` platform ayrımı olmayan ortak dosyalar), Detaylı Analiz sayfası (`ProfileStatisticsWeb.tsx` + `Wide` grafik bileşenleri Madde 69-70'te zaten paralel güncellenmişti), `LibraryMobile.tsx`'e özgü `getItemLayout` satır-indeksi hatası (web grid'i bu prop'u hiç kullanmıyor, hataya hiç maruz kalmamış).

**Gerçekten geride kalan tek yer — Profil ana sayfası (`profile.web.tsx` + `ProfileStats.web.tsx`):** Mobildeki hiçbir yeniliği görmüyordu, kendi ayrı ve eski kod yolunu koruyordu.

**Taramada bulunan 2 hata:**
1. **`ProfileStats.web.tsx` — sekmeler arası veri sızıntısı (Madde 70'teki hatanın masaüstü ikizi):** Bu dosya `useProfileStatistics` hook'unu HİÇ kullanmıyor, kendi ayrı `useLibrarySelector` + yerel hesaplamasına sahipti. Yalnızca "Toplam İzleme Süresi" `activeTab`'a göre değişiyor, "İzlenen Bölüm" VE "İzlenen Film" sayıları sekmeden bağımsız olarak HER ZAMAN birlikte gösteriliyordu. Madde 70'teki düzeltme bu dosyaya hiç sirayet etmemişti çünkü tamamen ayrı bir kod yolu.
2. **"Listelerim" kartları masaüstünde devasa büyüyordu:** `ListCard.tsx` boyutunu `profileMetrics.ts`'ten alıyor, o da `Dimensions.get('window').width * 0.28` formülü — MOBİL EKRAN için tasarlanmış. Web'deki komşu carousel kartları (`MovieCard.web.tsx`, `EpisodeCard.web.tsx`) ise SABİT 180×270. `WebCarousel` de `renderItem`'a genişlik sınırı koymuyor. Sonuç: 1440px'lik bir pencerede Listelerim kartları ~403px'e çıkıyor, yanındaki 180px'lik Diziler/Filmler kartlarından 2 kattan fazla büyük görünüyordu. Kod incelemesiyle doğrulandı, tahmin değil.

**Ayrıca bulunan, kullanıcı isteğiyle YALNIZCA KAYDA GEÇİRİLEN, düzeltilmeyen bir bulgu:** Projede 6 farklı modal (`OptionsModal`, `AddToListModal`, `CommentSheet`, `WriteCommentSheet`, `EpisodeOptionsModal`, `app/(public)/settings.tsx`) tamamen platform-farkında olmayan `animationType="slide"` alttan-açılan-sheet desenini kullanıyor — masaüstünde tam pencere genişliğinde alttan kayan bir panel olarak açılıyorlar. `LibraryFilterModal`'a (Madde 65) yapılan `wide` (ortalanmış modal) varyantı hiçbirinde yok. Bu, bu oturumun mobil işinin bir parçası değil, önceden var olan sistemik bir tasarım borcu; kullanıcı "şimdilik not al, ileride konuşuruz" dedi — KOD DEĞİŞTİRİLMEDİ.

**Çözüm 1 — `ProfileStats.web.tsx` yeniden yazıldı:** Kullanıcının açık talimatıyla ("mobildeki ile benzer karta yaklaştır, ama web ekranlarıyla uyumlu da olsun") mobildeki `ProfileStatsMobile.tsx`'in "süre + sayı TEK satırda, ince ayraçla yan yana" iskeleti masaüstü ölçeğine taşındı (birebir kopya değil: daha büyük tipografi — süre 40px vs mobilin 26px —, daha geniş dolgu, masaüstüne özgü her zaman görünen "Detaylı Analiz'e Git" bağlantısı korundu). Artık İKİ değer de (`formattedDuration` VE `watchedCount`) `activeTab`'a göre değişiyor — sekme sızıntısı kapandı. Dar ekranda (`!isDesktop`) hâlâ `ProfileStatsMobile`'a devrediyor (mevcut, doğru desen korundu).

**Çözüm 2 — kart boyutu:** `profileMetrics.ts`'e `DESKTOP_CARD_WIDTH=180`, `DESKTOP_CARD_HEIGHT=270`, `DESKTOP_CARD_GAP=16` sabitleri eklendi (sibling web kartlarıyla birebir). `ListCard.tsx` ve `ListCardSkeleton.tsx`'e opsiyonel `cardWidth`/`cardHeight`/`gap` prop'ları eklendi (varsayılan = mobil yüzde-tabanlı ölçüler, yani `ProfileMobile.tsx`'teki mevcut çağrılar SIFIR değişiklikle eski davranışını korudu). `profile.web.tsx` artık bu üç prop'u masaüstü sabitleriyle geçiyor — hem dolu `WebCarousel` durumunda hem yüklenme iskeletinde.

**Yan düzeltme:** "Listelerim" boş durumundaki elle çizilen başlık (`carouselTitle`, 20px) ile `WebCarousel`'in kendi başlığı (`categoryTitle`, 24px) arasında font boyutu tutarsızlığı bulundu — liste dolup boşaldıkça başlık görünür şekilde zıplıyordu. 24px'e eşitlendi.

**Doğrulama — tarayıcıda, 1440×900 masaüstü genişliğinde, gerçekçi veriyle (24 dizi, 18 film, 6 favori dizi, 3 liste, userStats):**
1. **Kart boyutu — konumsal olarak izole ölçüldü** (sidebar'daki aynı-metinli nav linkleriyle karışmaması için "Listelerim" ve carousel "Diziler" başlıklarının GERÇEK y-koordinatları bulunup kartlar o aralıkta arandı): Listelerim kartları `180×270`, Diziler carousel kartları da `180×270` — BİREBİR eşleşme.
2. **Sekme sızıntısı testi:** İlk denemede `computer` aracının `ref`-tabanlı tıklaması RNW'nin Pressable'ını tetiklemedi (bu oturumda daha önce de görülen bir ortam kısıtı — bkz. Madde 64); gerçek `pointerdown/mousedown/pointerup/mouseup/click` olay dizisini doğrudan `dispatchEvent` ile göndererek doğrulandı. Filmler sekmesine geçildiğinde: süre "4 Ay, 10 Gün" → **"28 Gün, 15 Saat"**, sayı "4.812 İzlenen Bölüm" → **"316 İzlenen Film"** — ikisi de değişti (eski hata tam olarak ikisinin de değişmemesiydi). Diziler'e geri dönüldüğünde değerler doğru şekilde eski haline döndü (round-trip).
3. **Navigasyon:** "Detaylı Analiz'e Git" bağlantısı `/profile/statistics`'e gitti.
4. **Regresyon — dar ekran (400px):** `!isDesktop` dalı hâlâ doğru tetikleniyor (`ProfileMobile` başlığı "Profil" göründü), özet kartı mobildeki tek-değerli tasarımını koruyor, Listelerim kartları mobil yüzde-tabanlı boyutuna (112px = round(400×0.28)) geri döndü — masaüstü sabitleri mobil tarafa hiç sızmamış.
5. Konsolda yalnızca beklenen ağ hataları var (bu ortamda internet kapalı; Madde 70'in düzeltmesi gereği `getUserRatings` artık sessizce yutmak yerine `throw` ediyor, bu da hata mesajlarının görünür olmasının SEBEBİ — regresyon değil, doğru davranışın kanıtı). React/bileşen seviyesinde hiçbir hata yok.
6. `tsc --noEmit`: dokunulan dosyalarda hata yok (kalan hatalar önceden var olan `useShowDetail.ts`/`locales/` hatalarıdır).

**Temizlik:** Test verisi silindi, misafir modu geri alındı.

**Kapsam dışı bırakılan (kullanıcı onayıyla):** 6 modalin platform-farkında `wide` varyantına kavuşturulması — ayrı, daha büyük bir görev olarak ileride ele alınacak.

## 72. Ayarlar: "Performans Raporunu Kopyala" Gizli Geliştirici Moduna Alındı
**Bağlam:** Kullanıcı, tanılama amaçlı "Performans Raporunu Kopyala" butonunun normal kullanıcılara görünmemesini, yalnızca sürüm numarasına Android'in "Yapı Numarası" esprisiyle aynı mantıkta (7 hızlı ard arda dokunma) gizli bir Geliştirici Modu açıldığında ortaya çıkmasını istedi. Açık kural: performans raporunu toplayan arka plan/telemetri mantığına (`hooks/useSettings.ts`'teki `handleExportMetrics`, `utils/metrics.ts`, `utils/metricsStore.ts`, `utils/errorLog.ts`) KESİNLİKLE dokunulmayacaktı — yalnızca UI'da gizlenecekti. `git diff --stat` ile bu dört dosyanın SIFIR satır değiştiği doğrulandı.

**Uygulama (`app/(protected)/account.tsx`):**
1. "🛠️ Tanılama" `SettingsSection`'ının TAMAMI (yalnızca içindeki buton değil — aksi halde `isDeveloperMode=false` iken içi boş bir bölüm başlığı görünürdü) `isDeveloperMode` state'ine bağlandı.
2. Sayfanın en altına, sürüm numarasını (`Constants.expoConfig?.version` — `app.json`'daki gerçek değer, hardcode edilip zamanla eskimemesi için) soluk/küçük bir metin olarak gösteren, görünüşte sıradan bir satır eklendi. `activeOpacity={1}` bilinçli: normal metinmiş gibi durması, buton gibi "bastırılmış" görünmemesi gerekiyordu.
3. Bu metne 1500ms'lik bir pencere içinde ard arda 7 kez dokunulunca `isDeveloperMode` TERSİNE çevrilir (`!isDeveloperMode`) — yani AYNI jest tekrar uygulanınca modu KAPATIR (kullanıcının ek isteği: "tekrar 7 kere basınca gizlensin"). Pencere dışına taşan bir dokunuş sayacı sıfırlar — "hızlı ard arda" şartı gerçekten aranıyor, dağınık 7 dokunuş saymaz.
4. Mod her değiştiğinde projenin mevcut `Snackbar` bileşeniyle (yeni bir toast sistemi icat edilmedi) "🔓 Geliştirici Konsolu Kilidi Açıldı" / "🔒 Geliştirici Konsolu Gizlendi" bildirimi gösterilir.
5. Kalıcı DEĞİL (AsyncStorage'a yazılmıyor) — bilinçli tercih: uygulama yeniden açıldığında sıfırlanır, gerçek bir kullanıcının bunu yanlışlıkla açık unutması söz konusu olmaz.

**Kapsam dışı bırakılan, kullanıcıya açıkça bildirilecek eksik:** Görev tarifi "Performans Raporunu Kopyala butonu (VE hata günlüğü ekranı) sadece bu gizli mod açıldığında görünür olsun" diyordu. Kod tabanı TARANDI (`grep -rn "errorLog\|hata günlüğü\|ErrorLog"`) ve projede böyle bir EKRAN (route/screen) bulunmadığı görüldü — yalnızca `utils/errorLog.ts` adında, hataları AsyncStorage'a yazan bir ARKA PLAN yardımcı dosyası var, hiçbir UI tüketicisi yok. Var olmayan bir şey gizlenemeyeceği için bu madde atlandı; sahte bir ekran icat edilmedi. Kullanıcıya bu bulgunun ayrı bir görev olarak ele alınıp alınmayacağı soruldu.

**Doğrulama — tarayıcıda, gerçek olay dizileriyle:**
1. **Varsayılan durum (taze sayfa yüklemesi):** "TANILAMA" metni ekranda YOK, "Sürüm 1.1.1" (app.json'daki gerçek sürüm) alt kısımda görünüyor — istenen 1. ve 2. madde doğrulandı.
2. **Test sırasında karşılaşılan, KODLA İLGİSİZ bir ortam kısıtı:** İlk denemelerde tek bir senkron script içinde hem 7 dokunuşu gönderip hem de DOM'u AYNI ANDA kontrol etmek, React'in state güncellemesini henüz DOM'a yansıtmadığı bir ana denk geldiği için "toggle çalışmıyor" izlenimi verdi. `window` üzerine geçici bir çağrı sayacı (`__devTapInvocations`) koyup gerçek davranışı izole ettim: 7 dokunuş = TAM OLARAK 7 gerçek çağrı (çift tetikleme YOK), `setIsDeveloperMode` doğru tetikleniyor — sorun yalnızca DOM'u React'in commit'inden ÖNCE okumamdı. DOM kontrolü ayrı bir script çağrısına (React'e render için bir tık payı bırakacak şekilde) taşınınca:
   - 7 hızlı dokunuş → "🛠️ TANILAMA" ve "Performans Raporunu Kopyala" GÖRÜNDÜ, Snackbar "🔓 Geliştirici Konsolu Kilidi Açıldı" ekranda belirdi (ekran görüntüsüyle doğrulandı).
   - Aynı sayfada 7 hızlı dokunuş DAHA → "🛠️ TANILAMA" TEKRAR KAYBOLDU — istenen "tekrar basınca gizlensin" davranışı çalışıyor.
3. **Pencere şartı doğrulandı (yan bulgu, iki ayrı tool çağrısı arasındaki gerçek gecikmeden kaynaklandı):** 1 dokunuş + (gerçek birkaç saniyelik bir aradan sonra) 6 dokunuş daha = toplam 7 gerçek çağrıya rağmen mod AÇILMADI — çünkü aradaki boşluk 1500ms penceresini aştığı için sayaç sıfırlandı. Bu, "hızlı ard arda" şartının kodda gerçekten uygulandığının kanıtı, hata değil.
4. `tsc --noEmit`: dokunulan dosyada hata yok (kalan hatalar önceden var olan `useShowDetail.ts`/`locales/` hatalarıdır). `handleExportMetrics`'in kendisi ve arkasındaki telemetri zinciri hiç değiştirilmedi.

**Temizlik:** Kök nedeni ararken eklenen geçici `console.log` ve `window.__devTap*` debug kancaları tamamen kaldırıldı (`grep` ile teyit edildi).

## 73. "Hata Günlüğü" Tanılama Ekranı
**Bağlam:** Madde 72'de kapsam dışı bırakılan eksik tamamlandı: `utils/errorLog.ts`'in zaten hazır olan `getErrorLog()`/`clearErrorLog()` API'sinin üstüne gerçek bir UI kondu.

**Uygulama:**
- `hooks/useErrorLog.ts`: `{ entries, isLoading, isRefreshing, refresh, clear }` — `useSettings.ts` ile aynı desen.
- `app/(protected)/error-log.tsx`: geri butonlu başlık, boş durum, `FlatList` (yeniden→eskiye), dokununca genişleyip stack/tags gösteren kartlar, Kopyala (panoya JSON) ve Temizle (onaylı) aksiyonları. `_layout.tsx`'e `Stack.Screen name="error-log"` eklendi.
- Ayarlar > 🛠️ Tanılama bölümüne, "Performans Raporunu Kopyala"nın altına "Hata Günlüğü" satırı eklendi.
- Çeviri anahtarları (tr/en `settings.json`): `errorLogTitle`, `errorLogEmpty(Text)`, `errorLogClear(Confirm)`, `errorLogCopy(Success)` vb.

**Bulunan ve düzeltilen hata:** İlk sürümde "Temizle" onayı düz `Alert.alert(...)` kullanıyordu. `react-native-web`'de `Alert.alert` **tam bir no-op**'tur (`node_modules/react-native-web/dist/exports/Alert/index.js` — `static alert() {}`) — proje bunu zaten biliyor, `app/(protected)/list/[id].tsx`'teki `confirmAsync` (web'de `window.confirm`'e düşen) helper'ı tam bu yüzden var. Aynı `confirmAsync` deseni `error-log.tsx`'e eklendi.

**Doğrulama:** Sahte `LoggedError[]` verisiyle (`@kaymak_error_log_v1` anahtarına yazılarak) uçtan uca test edildi: boş durum, liste sırası, genişlet/daralt (stack/tags olan/olmayan kayıtlar), Kopyala (panoya yazma), Temizle (gerçek `window.confirm` diyaloğu + gerçek AsyncStorage temizliği + boş duruma dönüş) — hepsi doğrulandı. `tsc --noEmit` temiz.

## 74. Performans Raporu Analizi: Trend/Yorum Cache'i ve "İlerlemeyi Gizle" Düzeltmesi
**Bağlam:** Kullanıcı, uygulamanın kendi "Performans Raporunu Kopyala" özelliğiyle (Madde 72) topladığı gerçek telemetri raporlarını ard arda paylaşarak iteratif performans incelemesi istedi. `utils/metricsStore.ts`'teki histogram kovaları (100/500/1000/5000/30000ms) nedeniyle p95/p99'un GERÇEK yüzdelik değil, doğrusal enterpolasyonla tahmin edildiği (küçük örneklemde yanıltıcı olabileceği) not edildi.

**Bulgu 1 — `hooks/useExplore.ts`: trend dizi/film listesi hiç önbelleklenmiyordu.** Keşfet sekmesine her giriş-çıkışta component-local state sıfırlanıp `getTrendingShows`/`getTrendingMovies` baştan çekiliyordu (rapor: `movies/trending` tek oturumda 15-19 çağrı). Çözüm: `services/api/shows.ts` ve `movies.ts`'e sayfa başına 60sn'lik (`CACHE_TTL.SHORT`, `utils/cacheTTL.ts`'e eklendi) önbellek + `force` parametresi eklendi; `useExplore.ts`'te pull-to-refresh ve dil değişimi `force=true` ile önbelleği bilerek atlıyor.

**Bulgu 2 — `MyInlineComment.tsx` + `WriteCommentSheet.tsx`: her dizi/film/bölüm sayfası kullanıcının SON 200 YORUMUNU baştan çekiyordu.** İkisi de bağımsız olarak sadece "bu içerikte zaten yorumum var mı" kontrolü için `getUserComments()`'ı (limit=200) tam çekiyordu (rapor: `users/me/comments/all/newest` en yüksek çağrı sayılarından biriydi, 38). Çözüm: `services/api/comments.ts`'te aynı 60sn TTL + eşzamanlı çağrıları tekilleştiren (in-flight promise paylaşımı) bir önbellek eklendi; `addComment`/`updateComment`/`deleteComment` başarı sonrası önbelleği geçersiz kılıyor.

**Doğrulama (gerçek kullanıcı raporlarıyla, ardışık 3 rapor karşılaştırılarak):** Düzeltme sonrası bir saatlik dilimde 5-6 dizi/film detay sayfası açılmasına rağmen `users/me/comments/all/newest` sadece 1 kez çağrıldı (öncesinde sayfa başına 1 çağrı olurdu) — cache+dedup doğrulandı.

**Bulgu 3 (kullanıcının bizzat test edip bulduğu) — "İlerlemeyi Gizle" orantısız tam kütüphane resync'i tetikliyordu.** Ardışık raporlardaki TIER1/2/3 endpoint'lerinin (`sync/watchlist/shows`, `sync/ratings/*`, `users/me/lists/:id/items/*` vb.) HEPSİNİN birebir aynı miktarda (+1, sayfalananlar +2/+3) arttığı gözlemlenerek `services/library/mutations/collections.ts`'teki `hideMediaFromProgress`'in her çağrıda `fetchFreshData(force=true)` (13+ endpoint'lik tam resync) tetiklediği kesin kanıtlandı.

**Kullanıcının istediği asıl davranış değişikliği** (basit bir performans düzeltmesinin ötesinde, gerçek bir özellik tarifiydi): "İlerlemeyi Gizle" izleme geçmişine/puanlara DOKUNMAMALI, sadece diziyi ana vitrin listelerinden (Aktif İzlenenler, Takvim, Sıradaki Bölümler) çıkarmalı; dizi Kütüphane'nin yeni bir "Gizlenenler" filtresinde bulunabilir kalmalı ki kullanıcı geri getirebilsin. "İzlemeyi Bırak" (dropped) özelliğine KESİNLİKLE dokunulmayacaktı (kullanıcı: "orayı elleme").

**Uygulama:**
- `services/api/users.ts`: `getHiddenShows()` (GET `/users/hidden/progress_watched?type=show`) ve `unhideItemTrakt()` (POST `.../remove`) eklendi.
- `store/slices/hiddenShowsSlice.ts` (yeni): `hiddenShowIds: number[]` — `droppedShowIds`'in aksine CİHAZA ÖZEL DEĞİL, Trakt'ın kendi listesinden gelir, bu yüzden mobil/web arasında otomatik senkron.
- `services/library/fetchers.ts`: `hiddenShowIds` TIER3'e (LOW öncelik) eklendi, `loadCache()`'e de bağlandı.
- `store/tracking/trackingLogic.ts`: `ShowCategories`'e yeni `hidden` kovası eklendi — kontrolü kural 1'in ("hazır bölümü yoksa hiçbir listede görünmez") bile ÖNÜNE alındı, çünkü gizli bir dizi bitmiş olsa bile Gizlenenler'de bulunabilmeli. `dropped` mantığı HİÇ değiştirilmedi.
- `hooks/useTrackingShows.ts` + `useDashboardData.ts`: `hiddenShowIds` `categorizeShows`'a ve Takvim'in (`upcomingShows`) son filtresine bağlandı. `TrackingAccordionList`'in `SECTION_ORDER`'ı sabit 4 kategoriyle kaldığından `hidden` kovası Diziler sekmesinin vitrinine hiç sızmıyor (ekstra kod gerekmedi).
- `hooks/useLibraryShowFilters.ts` + `useLibraryFilters.ts`: `SHOW_STATUS_KEYS`'e (en sona) `'hidden'` eklendi → Kütüphane filtre menüsünde "Gizlenenler" seçeneği.
- `services/library/mutations/collections.ts`: `hideMediaFromProgress` → `toggleHiddenFromProgress(id, type, isCurrentlyHidden)` — `toggleFavoriteStatus` ile AYNI optimistic desen (önce yerel `hiddenShowIds` + cache güncellenir, sonra API çağrılır, hata olursa rollback). Gereksiz `fetchFreshData(force=true)` çağrısı KALDIRILDI — artık yerel state anında güncellendiği için tam resync'e gerek yok (Bulgu 3'ü de kökten çözer).
- `app/show/[id].tsx` + `MediaHero.tsx` + `OptionsModal.tsx`: `isHidden` prop'u zincirlendi; "İlerlemeyi Gizle" satırı artık `isHidden`'a göre "İlerlemeyi Göster"e dönüşen bir toggle (ikon `EyeOff`↔`Eye`). Gizleme onay ister (`confirmAsync`, Madde 73'teki web-safe desen), gösterme (unhide) istemez — geri dönüş her zaman mümkün olduğundan sürtünmeye gerek yok.

**Doğrulama:** `tsc --noEmit` tüm dokunulan dosyalarda temiz (kalan hatalar önceden var olan, alakasız `useShowDetail.ts`/`locales/` hataları). Tarayıcıda misafir modunda Ayarlar/Diziler/Kütüphane ekranlarına girilip yeni `hiddenShowIds`/`categorizeShows` kod yollarının boş veriyle çalışırken hiçbir runtime hatası üretmediği doğrulandı. **Kapsam dışı/doğrulanamayan:** Bu sandbox'ın Trakt API'ye ağ erişimi olmadığından (ve misafir modunda `fetchFreshData` hiç çalışmadığından) gerçek Trakt verisiyle uçtan uca akış (gizleme → Gizlenenler'de görünme → Aktif İzlenenler'den kaybolma → sonraki performans raporunda tam resync'in artık tetiklenmediğinin görülmesi) kullanıcının gerçek cihazında doğrulanmayı bekliyor.

## 75. Misafir (Guest) İzin Denetimi + `Alert.alert`'in Web'de Kalıcı Olarak Düzeltilmesi
**Bağlan:** Kullanıcı, misafir kullanıcıların Ayarlar'da "Hesabı Sil" gibi kendileri için anlamsız/işe yaramaz seçenekleri görebildiğini fark etti ve tüm uygulamada misafir izinlerinin denetlenmesini istedi.

**Bulgu 1 — `app/(protected)/account.tsx`:** `isGuest` bu dosyada HİÇ kullanılmıyordu. "Hesabı Sil" satırı ve onay modalındaki "Trakt hesabınız etkilenmez" metni, olmayan bir Trakt hesabını "silmek" anlamına geldiğinden misafir için anlamsız/yanıltıcıydı. **Çözüm:** Bu satır artık yalnızca gerçek kullanıcıya gösteriliyor (`!isGuest &&`); "Çıkış Yap ve Sıfırla" misafir için "Misafir Modundan Çık"a dönüşüyor (yeni çeviri anahtarı `exitGuestMode`). Tarayıcıda doğrulandı.

**Bulgu 2 (denetim sırasında bulunan, gerçekten erişilebilir bir hata) — bölüm "..." menüsündeki "Puanla veya Düzenle" butonu (`EpisodeOptionsModal.tsx`) hiç `isGuest` kontrolü yapmıyordu.** Dizinin/filmin ana puanlama butonu (`MediaHero.tsx`) zaten korunuyordu, ama bölüm bazlı puanlama bu tek noktada atlanmıştı — misafir bir bölümü puanlamaya çalışınca Trakt'a token'sız istek gidip genel "hata oluştu" mesajı görüyordu. Düzeltildi + tutarlılık için `useShowDetailHandlers.ts`'teki (`handleRate`, `handleRemoveRating`, `handleRateEpisode`, `handleRemoveEpisodeRating`) ve `movie/[id].tsx`'teki (`handleRate`, `handleRemoveRating`, `handleRewatch`) karşılık gelen handler'lara da ikinci bir savunma katmanı eklendi (tetikleyici buton zaten korumalıydı, handler'ın kendisi değildi). `WriteCommentSheet.tsx`'in `handleSend`'ine de aynı sebeple eklendi.

**Doğrulanan, zaten sorunsuz alanlar:** Keşfet (bilinçli olarak serbest), Profil/Filmler/Diziler ana sekmeleri (misafir için zaten giriş daveti gösteriyor — `LoginPaywall`), izleme listesi/favori/gizle/bırak/liste ekleme butonları, yorum yanıtları (`CommentReplies.tsx`) — hepsi tetikleyici seviyesinde zaten `isGuest` ile korunuyordu.

**Bulgu 3 (denetim sırasında ortaya çıkan, çok daha büyük bir kök sorun) — `react-native-web`'de `Alert.alert` TAM BİR NO-OP'tur** (`node_modules/react-native-web/dist/exports/Alert/index.js` — `static alert() {}`). Bu, tek butonlu bilgi/hata mesajları DAHİL, projedeki 20 dosyadaki HER `Alert.alert` çağrısının web'de sessizce hiçbir şey yapmadığı anlamına geliyordu (misafir kısıtlama mesajları, hata bildirimleri, onay diyalogları — hepsi). Önceki maddelerde (72-74) bu sorunu her ekranda ayrı ayrı bir `confirmAsync` kopyalayarak atlatmıştık; bu kez kök nedeni düzeltmeye karar verildi.

**Çözüm — iki katmanlı:**
1. `utils/confirmDialog.ts` (yeni, paylaşılan modül): `confirmAsync` (2 seçenekli onay) ve `notify` (tek butonlu bilgi) — artık `list/[id].tsx`, `error-log.tsx`, `OptionsModal.tsx`, `SeasonAccordion.tsx` kendi kopyalarını yazmak yerine buradan içe aktarıyor.
2. **Kök neden düzeltmesi (patch-package):** `node_modules/react-native-web/dist/(cjs/)exports/Alert/index.js` — no-op yerine gerçek RN `Alert.alert(title, message, buttons, options)` imzasını `window.alert`/`window.confirm`'e eşleyen bir uygulama yazıldı (butonsuz/tek buton → `window.alert`; iki buton → `window.confirm`, `style:'cancel'` olan buton "Vazgeç" tarafına eşlenir). `npx patch-package react-native-web` ile `patches/react-native-web+0.21.2.patch` oluşturuldu — proje zaten `postinstall: patch-package` kullandığından bu, HER kurulumda kalıcı olarak uygulanır. Bu tek değişiklik, projedeki 20 dosyanın TAMAMINDAKİ mevcut `Alert.alert` çağrılarını (yeni yazılacaklar dahil) web'de otomatik olarak çalışır hale getirir — tek tek dosya değiştirmeye gerek kalmadan.
3. **İstisna — `SeasonAccordion.tsx`'teki "Sezon Tamamen İzlendi" menüsü** (Vazgeç/Tekrar İzle/Bırakılmışı Sil, 3 seçenek): `window.confirm` en fazla 2 seçenek sunabildiğinden bu, patch ile bile tam temsil edilemez. Bu yüzden native bir bottom-sheet modale çevrildi (`EpisodeOptionsModal.tsx` ile aynı görsel/etkileşim deseni) — hem web hem mobilde aynı şekilde çalışır, tarayıcı diyaloğu sınırlamasına tabi değil.

**Doğrulama:**
- `tsc --noEmit`: dokunulan dosyalarda hata yok (kalan 3 hata önceden var olan, alakasız `useShowDetail.ts`/`locales/` hataları — bu oturumun başından beri değişmedi).
- Patch'lenmiş `Alert.alert` mantığı Node ile izole birim testle doğrulandı: (1) butonsuz → `window.alert` çağrılıyor, (2) tek buton → `window.alert` + `onPress` tetikleniyor, (3) iki buton onaylanınca → `window.confirm` + doğru (cancel olmayan) butonun `onPress`'i tetikleniyor, (4) iki buton reddedilince → `cancel` butonunun `onPress`'i tetikleniyor. Dördü de beklendiği gibi çalıştı.
- Tarayıcıda uygulama sıfırdan (Metro önbelleği temizlenmiş halde) sorunsuz açıldı, konsolda yalnızca bu sandbox'ın ağ erişimi olmamasından kaynaklanan (alakasız) hatalar var.

**Kullanıcıya bildirilen, henüz aksiyon alınmamış madde:** `tsc --noEmit` çıktısında bu oturumun başından beri değişmeyen 3 hata var (`hooks/useShowDetail.ts`'te 8 adet implicit-any, `locales/index.ts` ve `locales/languageDetector.ts`'te i18next tip uyuşmazlığı) — bugünkü çalışmanın kapsamı dışında, dokunulmadı.

## 76. Kalan 3 `tsc` Hatasının Temizlenmesi — Proje Genelinde Sıfır Tip Hatası
**Bağlam:** Kullanıcı büyük bir sisteme geçmeden önce "hatasız bir başlangıç" istedi; Madde 75'te bildirilen 3 kalan hatanın da temizlenmesi istendi.

**1. `hooks/useShowDetail.ts` (8 implicit-any hatası):** `let summary = null, seasons = null, cast = null, related = null;` — TS bu değişkenlerin tipini sonraki atamalardan çıkaramıyordu. Açık tip verildi (`summary: any`, `seasons`/`cast`/`related`: `any[]`, başlangıç değeri `[]` — `null` değil, çünkü bu üçü hiçbir kod yolunda kavramsal olarak "yok" değil, her zaman gerçek bir diziyle doluyor). İlk düzeltme (`any[] | null`) yeni "possibly null" hataları açtı (satır 90/106/122) çünkü TS akış analizi ternary/try-catch dallarını `null` içerebilir sayıyordu; `[]` başlangıcıyla ve nullable olmayan tipe geçilince bu da ortadan kalktı — `MediaData` arayüzüyle de artık birebir eşleşiyor.

**2. `locales/index.ts` — `compatibilityJSON: 'v3'`:** Yüklü i18next sürümünde (26.x) bu seçenek hem tip tanımlarından hem ÇALIŞMA ZAMANINDAN (derlenmiş `i18next.js`'te "compatibilityJSON" hiç geçmiyor) tamamen kaldırılmış — yani zaten etkisizdi. Proje çeviri dosyalarının hiçbiri v3'e özgü `_plural` anahtar biçimini kullanmadığından (`grep` ile doğrulandı) satır davranışı hiç değiştirmeden kaldırıldı.

**3. `locales/languageDetector.ts` — `detect` imza uyuşmazlığı:** i18next'in `LanguageDetectorAsyncModule.detect` tipi ya `callback(lng)` çağırmayı ya da doğrudan `Promise<string>` DÖNDÜRMEYİ bekler, ikisi birden değil. Eski kod `async` bir fonksiyon İÇİNDE `return callback(...)` yapıyordu — bu dönüş tipini `Promise<void>` yapıyordu (callback zaten void döner), beklenen `Promise<string | readonly string[] | undefined>` ile uyuşmuyordu. `callback` parametresi kaldırılıp değerler doğrudan `return` edildi — davranış birebir aynı, yalnızca dönüş şekli değişti.

**Doğrulama:** `npx tsc --noEmit` artık **SIFIR hata** veriyor (proje genelinde). Tarayıcıda uygulama sıfırdan yeniden başlatılıp Türkçe metinlerin doğru render edildiği (i18n zinciri bozulmadı), konsolda i18n/languageDetector/useShowDetail kaynaklı hiçbir hata olmadığı doğrulandı.

## 77. Film Kartlarına Dizi Kartlarındaki 3-Nokta Menüsü Eklendi
**Bağlam:** Kullanıcı, Diziler sekmesindeki takip kartlarında (Aktif İzlenenler, Ara Verilenler vb.) her kartın üstünde bir 3-nokta menüsü olduğunu ("İzlemeyi Bırak", "Listeye Ekle", "Favorile", "Paylaş") fark etti ve aynı özelliğin film kartlarında da olmasını istedi.

**Bulgu:** Bu menü `components/tracking/TrackingCardMenu.tsx`'te yaşıyor ama tamamen diziye özel sabitlenmişti (`showName` prop'u, `mediaType: 'show'` sabit `toggleFavoriteStatus` çağrısı, `favShows` seçici, `/show/${slug}` paylaşım linki). Film kartları (`MovieCardMobile.tsx`, `MovieCard.web.tsx`) bu menüyü hiç render etmiyordu; Filmler sekmesi (`MoviesMobile.tsx`/`movies.web.tsx`) ayrıca `useTrackingStore`'a (dizilerin `droppedShowIds`'iyle aynı desendeki `droppedMovieIds`) hiç abone değildi.

**Çözüm — component TEKRARLANMADI, genelleştirildi** (yeni bir `MovieTrackCardMenu` kopyası yazmak yerine): `TrackingCardMenu`'ya `mediaType: 'show' | 'movie'` prop'u eklendi, `showName` → generic `title`'a yeniden adlandırıldı. Favori dilimi (`favShows`/`favMovies`), paylaşım linki/mesajı (`/show/` veya `/movie/`, `shareShowMsg`/`shareMovieMsg`) ve `AddToListModal`'ın `mediaType`'ı artık bu prop'a göre seçiliyor; menünün geri kalanı (konumlama, "Bırak/Devam Et" metni, favori/paylaş/listeye-ekle satırları) zaten dizi/film arasında ortaktı.

**Değişen dosyalar:**
- `TrackingCardMenu.tsx`: genelleştirildi (yukarıda).
- Dizi tarafı (davranış DEĞİŞMEDİ, yalnızca yeni prop adlarına güncellendi): `EpisodeCardMobile.tsx`, `EpisodeCard.web.tsx`, `ShowTrackCardWeb.tsx` (kullanılmayan bir kalıntı olabilir, yine de derleme hatası vermesin diye güncellendi).
- Film tarafı (yeni): `MovieCardMobile.tsx` ve `MovieCard.web.tsx`'e `isDropped`/`onToggleDropped` prop'ları eklendi, poster üzerine (mobilde sağ üst köşe, web'de hover overlay'in üst satırı — dizi kartlarıyla birebir aynı konumlar) menü bağlandı. `MoviesMobile.tsx` ve `movies.web.tsx`: `useTrackingStore`'dan `droppedMovieIds`/`toggleDroppedMovieStatus`/`hydrate` okunup `MovieCard`'a geçirildi (dizi ekranlarındaki `IndexMobile.tsx`/`shows.web.tsx` ile birebir aynı desen). Menü yalnızca `onToggleDropped` verilmişken render edildiğinden, `MovieCard`'ın DİĞER kullanıcıları (`profile.web.tsx`, `library/view-all.web.tsx` — bu prop'u hiç geçmiyor) hiç etkilenmedi.

**Doğrulama:** `tsc --noEmit` projede sıfır hatayla temiz. Tarayıcıda misafir modunda Filmler sekmesine girilip yeni `useTrackingStore` bağlantısının (guest early-return'den ÖNCE çalışan hook'lar) hiçbir çalışma zamanı hatası üretmediği doğrulandı. **Doğrulanamayan:** Bu sandbox'ta misafir modu Filmler'i tamamen kilitlediğinden (ve gerçek Trakt verisi olmadığından) menünün gerçek bir film kartı üzerinde görsel olarak açılıp her 4 aksiyonun (Bırak/Listeye Ekle/Favorile/Paylaş) çalıştığı kullanıcının kendi cihazında doğrulanmayı bekliyor.

## 78. Faz 7.1 — Kullanıcıdan Doğrudan Hata Bildirimi ("Görünmez Köprü" / Cloudflare Worker Proxy)

**Bağlam:** Kullanıcıların uygulama içinden çıkmadan hata/geri bildirim gönderebilmesi isteniyordu. Discord webhook'unu doğrudan istemciye gömmek güvenlik açığı olacağından, bağımsız bir Cloudflare Worker (`kaymaktv-feedback-worker`, workers.dev alt alan adı: `kaymaktv-feedback`) ara katman olarak kuruldu: mobil uygulama Worker'a POST atar, Worker regex ile veriyi sanitize edip aynı anda hem Supabase'e (`error_logs` tablosu) hem Discord webhook'una yazar. Discord/Supabase sırları yalnızca Worker'ın Cloudflare Secrets kasasında durur.

**Not:** Bu proje Supabase auth KULLANMIYOR (kimlik doğrulama tamamen Trakt OAuth). Bu yüzden `userId` alanı için gerçek bir kullanıcı ID'si yok — bunun yerine `expo-crypto`'nun `randomUUID()`'i ile üretilip `useFeedbackStore`'da (AsyncStorage'a `persist` edilen küçük bir zustand store) kalıcı olarak saklanan anonim bir cihaz ID'si kullanıldı. Misafir kullanıcılarda `guest-` öneki eklenir. Supabase istemci SDK'sı hiçbir yerde eklenmedi — mobil uygulama yalnızca Worker'ı bilir, Worker'ın arkasında ne olduğunu bilmez.

**İstemci tarafı eklenen dosyalar** (bilinçli olarak izole/silinebilir tutuldu — kullanıcı "sistem çalışmazsa yokmuş gibi silebilelim" istedi):
- `utils/sanitize.ts`: Worker'daki regex kalkanının istemci tarafı kopyası (Bearer token, `apiKey`/`password`/`secret` alanları, çıplak JWT'ler için "çift dikiş" güvenlik).
- `store/useFeedbackStore.ts`: `zustand` + `persist` (AsyncStorage) — projede daha önce hiç `persist` middleware kullanılmamıştı, bu ilk örnek. `anonymousId` ve 3 dakikalık cooldown için `lastSentAt` tutuyor.
- `services/api/feedback.ts`: `EXPO_PUBLIC_FEEDBACK_WORKER_URL` (`.env`, gitignored) adresine axios POST.
- `hooks/useReportIssue.ts`: mesaj/switch state'i, cooldown hesaplama, `utils/errorLog.ts`'teki mevcut hata günlüğünü (opsiyonel) ekleyip gönderme.
- `components/settings/ReportIssueModal.tsx`: `DeleteAccountModal.tsx` ile aynı görsel dil (koyu kart, ikon rozeti, iki butonlu aksiyon satırı), mor (`#a78bfa`) vurgu.
- `app/(protected)/account.tsx`'e tek satırlık entegrasyon: yeni "💬 Destek" bölümü + bir `SettingsRow` + modal render'ı.

**Doğrulama:** `tsc --noEmit` sıfır hata. **Doğrulanamayan (kullanıcının kendi cihazında test edilmeli):** Worker'daki `DISCORD_WEBHOOK_URL`/`SUPABASE_URL`/`SUPABASE_KEY` environment variable'larının Cloudflare panelinden girilip girilmediği, gerçek bir gönderimin Discord'a ve Supabase'e düşüp düşmediği, cooldown'un gerçek cihazda uygulama kapatılıp açıldıktan sonra da (AsyncStorage persist) hatırlanıp hatırlanmadığı.

## 79. Madde 78'in Ardından: "import.meta" Web Export Krizi + Tanılama Bölümünün Yeniden Düzenlenmesi

**Sorun:** Kullanıcı kendi `dist` prod web export'unu (`npm run serve`) test ederken tarayıcı konsolunda `Uncaught SyntaxError: Cannot use 'import.meta' outside a module` hatası aldı — sayfa parse aşamasında tamamen çöküyordu (React hiç render olmuyordu).

**Kök neden:** `store/useFeedbackStore.ts`, `zustand/middleware`'den `persist`/`createJSONStorage` import ediyordu. Bu paketin ESM build'i (`zustand/esm/middleware.mjs`) `devtools` middleware'i için `import.meta.env` kullanıyor — `persist`'i tek başına import etsek bile Metro bu dosyanın tamamını tree-shake etmeden pakete dahil ediyor. Metro'nun web statik export'u script'i `type="module"` OLARAK işaretlemediğinden `import.meta` tarayıcıda geçersiz syntax oluyor ve tüm bundle parse hatasıyla çöküyor. Proje genelinde `zustand/middleware`'i import eden tek yer bu yeni dosyaydı (Madde 78'de eklenen Hata Bildir özelliği).

**Çözüm:** `persist` middleware tamamen kaldırıldı. Yerine projede `utils/errorLog.ts`'te zaten kullanılan manuel AsyncStorage okuma/yazma deseni uygulandı: store düz `create()` ile tanımlanıp, modül yüklenirken bir kere `AsyncStorage.getItem` ile hidrate ediliyor, `setLastSentAt` her çağrıldığında `AsyncStorage.setItem` ile fire-and-forget yazılıyor. Davranış (kalıcı anonim ID + 3 dakikalık cooldown) aynı, sadece `zustand/middleware` bağımlılığı yok.

**Doğrulama:** `expo start --web` dev sunucusunda ana sayfa artık tam render oluyor (önceden kök `<div id="root">` tamamen boş kalıyordu — bu blank-root sorunu da aslında AYNI `import.meta` çökmesiydi, ayrı bir "Browser pane görünmüyor" sorunu değilmiş). Misafir modunda Ayarlar > Tanılama > Hata Bildir modalı açıldı, mesaj yazıldı, "Gönder"e basıldı — `handleSubmit` doğru tetiklendi, `sendFeedback` axios çağrısı gerçek bir istek attı (bu sandbox'ta Worker'a ağ erişimi olmadığından `AxiosError: Network Error` ile başarısız oldu, tıpkı aynı sandbox'ta Trakt API çağrılarının da başarısız olması gibi — kod tarafı doğru, hata `{success:false, reason:'error'}` olarak zarifçe yakalandı). **Kullanıcının kendi cihazında gerçek internet erişimiyle doğrulaması gereken tek şey:** mesajın gerçekten Discord'a düşüp Supabase'e yazıldığı.

**Ayrıca aynı oturumda — Tanılama bölümü yeniden düzenlendi:** Kullanıcı isteği üzerine `app/(protected)/account.tsx`'teki bölüm sırası `Hesap Ayarları → Uygulama Tercihleri → Hesap Seçenekleri → Tanılama` oldu (önceden Tanılama, Hesap Seçenekleri'nden ÖNCE ve yalnızca gizli Geliştirici Modu açıkken görünüyordu). Artık "Tanılama" bölümü HER ZAMAN görünür ve içinde "Hata Bildir / Bize Ulaşın" satırı her zaman en altta duruyor; "Performans Raporunu Kopyala" ve "Hata Günlüğü" satırları ise hâlâ yalnızca sürüm numarasına 7 hızlı dokunmayla açılan gizli Geliştirici Modu'nda, Hata Bildir'in ÜSTÜNDE beliriyor.

## 84. Feed Sistemi — Gerçek Veriye Bağlama (Adım 5): Phase 1 Kodlaması Tamamlandı

**Bağlam:** Madde 83'te Follow sistemi tamamlanınca, Feed'in son eksik parçası kalmıştı: `useFeed.ts` hâlâ mock veri döndürüyordu. Bu madde onu gerçek Supabase sorgusuna bağlayarak `docs/feed.md`'deki Phase 1 planının **tüm adımlarını** (1-5) tamamlıyor.

**`features/feed/services/feedApi.ts` — `fetchFeedActivities(myUserId)`:** Önce `user_follows`'tan kimleri takip ettiğimi çekiyor — kimseyi takip etmiyorsam sorguyu hiç Supabase'e atmıyor (boş bir `.in()` isteği anlamsız olurdu, gereksiz network round-trip'i önleniyor). Sonra `feed_activities`'i, PostgREST'in gömülü join sözdizimiyle (`user:users(id, trakt_slug, username, avatar_url)` — şemadaki `feed_activities.user_id → users.id` FK'sinden otomatik çıkarılıyor) `users` tablosuyla birleştirip son **30 gün** + en fazla **30 kayıt** ile sınırlı şekilde, en yeniden eskiye sıralı çekiyor (docs/feed.md'de baştan kararlaştırılan "taze" feed prensibi).

**`useFeed.ts`:** Artık `features/feed/store/useFeedUserStore.ts`'teki `myUserId`'ye abone (Madde 83'te sync yanıtından doldurulan önbellek). `myUserId` henüz yoksa (senkronizasyon tamamlanmadı veya misafir kullanıcı) sessizce boş dizi döner, hataya düşmez; `myUserId` değiştiğinde (null'dan gerçek bir UUID'ye) otomatik yeniden sorgulanır — kullanıcı hiçbir şey yapmadan, senkron tamamlanınca feed kendiliğinden dolar.

**Temizlik:** Artık hiçbir yerden kullanılmayan `features/feed/mock/mockFeedData.ts` silindi (mock veri tamamen gerçek sorguyla değiştirildi).

**Doğrulama:** `tsc --noEmit` sıfır hata. Web preview'da: `users`/`user_follows` tabloları boş/takipsiz olduğu için feed doğru şekilde "Akışın Boş" durumuna düşüyor, konsol tamamen temiz (Supabase/Feed kaynaklı hiçbir hata yok). **Doğrulanamayan:** Gerçekten dolu bir feed'in render'ı — bunun için en az bir gerçek takip ilişkisi + o kişinin senkronize olmuş aktivitesi gerekiyor, ikinci bir gerçek Trakt hesabı bu oturumda mevcut değildi.

## 93. KRİTİK BUG: Arka Planda Yenilenen Trakt Token'ı AuthContext'e Hiç Yansımıyordu

**Bağlam:** Kullanıcı gerçek cihazında "Aktivitemi Akışta Gizle" anahtarına basınca anahtarın açılmayıp hemen geri kapandığını, alttaki iki anahtarın da tekrar açıldığını bildirdi. Madde 92'nin state mantığı doğruydu (`hideAll` türetilmiş durumu, `setHideAll` fonksiyonu) — sorun bambaşka bir yerdeydi.

**Teşhis (yine `npx wrangler tail` ile canlı log yakalama — tahmine değil kanıta dayalı):** İlk denemede kullanıcının isteği hiç log basmadı — Worker'ın henüz yeni loglamalı sürümle deploy edilmediği ortaya çıktı (kendi attığım bir teşhis `curl` isteğiyle doğrulandı: benim isteğim loglanıyordu, kullanıcının önceki denemeleri loglanmıyordu). Loglama eklenip deploy edildikten sonra kullanıcının gerçek isteği net bir sonuç verdi:
```
[verifyAndUpsertUser] Trakt /users/settings başarısız: 401
```
Yani sahte bir token değil, **kullanıcının kendi gerçek token'ı** Trakt tarafından reddediliyordu.

**Kök neden:** `services/api/traktClient.ts`'teki axios interceptor, bir Trakt isteği 401 aldığında token'ı sessizce yeniliyor — ama yalnızca `SecureStore`'a ve kendi modül-içi `cachedAccessToken` değişkenine yazıyor. `context/AuthContext.tsx`'teki React state'i (`accessToken`) GÜNCELLEMİYOR. Bu, `onSessionExpired` pub/sub deseninin (Madde ~40 civarı, "refresh token da geçersizse SecureStore temizlenir ama state bilmez" için zaten yazılmış) **simetriğinin eksik olduğu** anlamına geliyordu — "refresh BAŞARILI olunca" durumu hiç ele alınmamıştı.

**Etkisi:** Uygulamanın geri kalanı (dizi/film listeleri vb.) `getTraktClient()` üzerinden Trakt'a DOĞRUDAN istek atıyor — bu yüzden interceptor'ın kendi otomatik retry mekanizmasından (401 al → yenile → aynı isteği tekrar dene) görünmez şekilde faydalanıyor, kullanıcı hiçbir sorun fark etmiyordu. Ama Worker'a giden çağrılarımız (`features/feed/services/feedSync.ts`, `feedPrivacy.ts`) `getTraktClient()`'i HİÇ kullanmıyor — `useAuth().accessToken`'ı (React state) doğrudan okuyup Worker'a gönderiyorlar. Token arka planda (başka bir ekranda yapılan sıradan bir Trakt isteği sırasında) sessizce yenilendiğinde, React state hâlâ ESKİ (artık gerçekten geçersiz) token'ı tutmaya devam ediyordu — Worker'a giden HER istek (feed sync dahil, yalnızca gizlilik anahtarı değil) bu eski token'la gidip Trakt'tan gerçek bir 401 alıyordu.

**Düzeltme:** `onSessionExpired`'ın simetriği olan `onTokenRefreshed(token)` pub/sub'ı `traktClient.ts`'e eklendi, başarılı yenileme noktasında (`cachedAccessToken = newAccessToken;`'den hemen sonra) tetikleniyor. `AuthContext.tsx`, `onSessionExpired`'a abone olduğu AYNI desenle buna da abone olup `setAccessToken(newToken)` çağırıyor. Artık arka planda HANGİ ekranda/hangi Trakt isteğiyle olursa olsun bir yenileme gerçekleşince, React state anında güncelleniyor — `useAuth().accessToken`'ı okuyan HER kod yolu (yalnızca gizlilik anahtarı değil, feed sync de) her zaman güncel token'ı görür.

**Doğrulama:** `tsc --noEmit` sıfır hata. Kök neden canlı `wrangler tail` loglarıyla (tahmin değil) kesin olarak doğrulandı. **Doğrulanamayan:** Düzeltmenin kullanıcının gerçek cihazında sorunu tamamen çözdüğü — kullanıcı tekrar deneyecek. Not: bu oturumdaki MEVCUT React state'i düzeltme deploy edildikten SONRA da eski/stale kalmaya devam eder (state zaten bozulmuş) — kullanıcının uygulamayı bir kez daha kapatıp açması gerekiyor (bu, `SecureStore`'dan taze okuma yapar); bundan SONRA bu sınıf bug bir daha hiç oluşmayacak.

## 92. Feed Sistemi — "Her Şeyi Gizle" DB Sütunu Kaldırıldı, Client'ta Türetilmiş (Derived) UI Durumuna Dönüştürüldü

**Bağlam:** Madde 91'in sonunda kullanıcıya sorulan açık soruya ("feed_hidden gereksiz mi?") kullanıcı net bir cevapla döndü: "Veritabanında 3 ayrı sütun tutup çelişkili durumlar yaratmak istemiyorum." — önerilen "UI Kısayolu" yaklaşımını onayladı ve tam davranışı tarif etti: üstteki anahtar açılınca alttaki ikisi otomatik kapansın, alttakilerden biri açılırsa üsttekinin otomatik kapanması, üstteki açıkken alttakilerin gri/basılamaz olması.

**Şema:** `supabase/schema/008_drop_feed_hidden.sql` — `ALTER TABLE users DROP COLUMN feed_hidden;`. Madde 91'de eklenen `006_add_feed_hidden.sql` artık yalnızca tarihsel bir kayıt (migration dosyaları asla düzenlenmiyor, yalnızca üzerine yenisi ekleniyor — kurulan konvansiyon).

**Worker sadeleştirmesi:** `verifyAndUpsertUser`'ın dönüşünden `feedHidden` tamamen çıkarıldı (artık yalnızca `isPrivate`, `publishWatches`, `publishRatings`). `handleFeedSync`'teki `if (isPrivate || feedHidden)` kontrolü sade `if (isPrivate)`'a indirildi — "her şeyi gizle" davranışı zaten `publishWatches`/`publishRatings`'in ikisi de `false` olduğunda mevcut per-type mantık (Madde 91) üzerinden KENDİLİĞİNDEN oluşuyor, ayrı bir kontrole hiç gerek yoktu. `handleFeedPrivacy`'deki `PRIVACY_FIELDS` haritasından `feedHidden` çıkarıldı, `if (dbPatch.feed_hidden === true) {...} else {...}` dallanması kaldırılıp iki bağımsız `if` bloğuna indirgendi (`deleteUserActivities` — tüm tabloyu silen genel helper — hâlâ yalnızca `isPrivate` yolunda kullanılıyor, silinmedi).

**Client — "türetilmiş durum" deseni:** `features/feed/services/feedPrivacy.ts`'teki `FeedPrivacySettings`'ten `feedHidden` çıkarıldı (yalnızca `publishWatches`/`publishRatings` kaldı). `features/feed/hooks/useFeedPrivacy.ts`'e yeni `setHideAll(hide: boolean)` fonksiyonu eklendi — `hide:true` ise TEK bir istekte `{publishWatches:false, publishRatings:false}` gönderiyor, `hide:false` ise ikisini birden `true`'ya döndürüyor (kullanıcının istediği simetrik davranış). Hook'un döndürdüğü `hideAll` değeri hiçbir state'te TUTULMUYOR, her render'da `!settings.publishWatches && !settings.publishRatings` olarak HESAPLANIYOR — bu, kullanıcının ikinci kuralını (alttakilerden biri açılırsa üsttekinin otomatik kapanması) sıfır ekstra kod olmadan, yalnızca matematiksel olarak garanti ediyor: senkron dışı kalma İHTİMALİ yok, çünkü ayrı bir "senkron" işlemi yok, tek bir hesaplama var.

**UI:** `app/(protected)/account.tsx`'teki üç `SettingsSwitchRow`'dan üsttekinin `value`/`onValueChange`'i `feedPrivacy.hideAll`/`feedPrivacy.setHideAll`'a bağlandı; alttaki ikisinin `disabled` koşuluna `|| feedPrivacy.hideAll` eklendi (kullanıcının üçüncü kuralı: üstteki açıkken alttakiler gri/basılamaz).

**Doğrulama:** `tsc --noEmit` sıfır hata. Worker `wrangler deploy --dry-run` ile doğrulandı (18.53 KiB — Madde 91'deki 19.02 KiB'den küçüldü, kod gerçekten sadeleşti). `grep` ile `feedHidden`/`feed_hidden` kalıntı taraması temiz (yalnızca açıklayıcı yorumlar + tarihsel SQL dosyaları). Web preview'da (test token'ıyla) üstteki anahtar tıklandığında: iyimser (optimistic) güncelleme tetiklendi, gerçek deploy edilmiş Worker'a istek gitti (bu kez "Network Error" değil gerçek bir **401** — sahte token'ın Trakt tarafından doğru şekilde reddedildiğinin kanıtı), başarısızlık üzerine state doğru şekilde geri alındı — tüm zincir (tıklama → optimistic UI → gerçek Worker isteği → gerçek Worker yanıtı → doğru geri alma) uçtan uca doğrulandı, yalnızca "gerçek token ile başarılı kayıt" adımı gerçek bir hesap gerektirdiği için test edilemedi.

## 91. Feed Sistemi — İnce Taneli Gizlilik: "Her Şeyi Gizle" Yerine Tür Bazında Kontrol

**Bağlam:** Madde 90'da tek bir "her şeyi gizle" (`feed_hidden`) anahtarı eklenmişti. Kullanıcı bunu daha da geliştirmek istedi: bazı içerikleri (örnek verdiği: "pembe dizi, çizgi film") izlerken akışa hiç düşmesin ama diğer izlemeleri/puanlamaları paylaşmaya devam etsin — yani tek büyük anahtar yerine TÜR BAZINDA (izleme vs. puanlama) bağımsız kontrol.

**Şema:** `supabase/schema/007_add_publish_toggles.sql` — `users.publish_watches`, `users.publish_ratings` (`BOOLEAN NOT NULL DEFAULT TRUE` — varsayılan her zaman "paylaş", kullanıcı bilinçli olarak kapatır).

**Worker — genelleştirme:** Madde 90'da eklenen dar kapsamlı `POST /feed/visibility` (yalnızca `hidden` alanını yönetiyordu) tamamen `POST /feed/privacy`'ye dönüştürüldü — `{traktAccessToken, patch: {feedHidden?, publishWatches?, publishRatings?}}` şeklinde, yalnızca gönderilen alanları güncelleyen genel bir uç nokta. `verifyAndUpsertUser` artık `publishWatches`/`publishRatings`'i de döndürüyor (aynı "upsert payload'ında hiç gönderilmediği için kullanıcının ayarı asla ezilmez" deseni, Madde 90'daki `feedHidden` ile birebir aynı mantık). Yeni `deleteUserActivitiesByType(env, userId, activityType)` helper'ı — bir tür kapatıldığında yalnızca O türe ait kayıtları siler (`deleteUserActivities`'in tüm-tabloyu-silen haline karşı, tür-filtreli versiyonu).

**`handleFeedSync`'teki üç seviyeli gizlilik mantığı:**
1. `isPrivate || feedHidden` → her şey atlanır (Madde 89/90'daki gibi, en üstteki anahtar)
2. `publishWatches` false ise → `/sync/history/episodes` hiç çağrılmaz (gereksiz API isteği yapılmaz), var olan `watched_episode` kayıtları hemen silinir
3. `publishRatings` false ise → `/sync/ratings/*` hiç çağrılmaz, var olan `rated` kayıtları hemen silinir

İlginç bir detay: `rated` için geri alma (retraction, Madde 90) zaten TAM anlık görüntü karşılaştırması yaptığından (`ratedRows` boşsa tüm var olan `rated` satırları otomatik silinir), `publishRatings=false` durumunda AYRICA açık bir silme çağrısına GEREK YOK — mevcut reconciliation mantığı "kendiliğinden" doğru sonucu veriyor. Ama `watched_episode`'un retraction'ı Madde 89'da BİLİNÇLİ olarak yalnızca çekilen pencereyle sınırlı tutulmuştu (eski gerçek geçmişi yanlışlıkla silmemek için) — bu yüzden `publishWatches=false` iken `history=[]` olduğunda o pencere-sınırlı mantık devreye HİÇ girmez, açık bir `deleteUserActivitiesByType` çağrısı olmadan eski kayıtlar silinmeden kalırdı. Bu asimetri kodda yorumla belirtildi.

**Client:** `features/feed/services/feedVisibility.ts` + `hooks/useFeedVisibility.ts` (Madde 90'da yeni yazılmıştı, henüz başka hiçbir tüketicisi yoktu) tamamen silinip yerine genelleştirilmiş `features/feed/services/feedPrivacy.ts` + `hooks/useFeedPrivacy.ts` kondu — üç ayarı da tek bir `FeedPrivacySettings` nesnesinde tutan, her biri bağımsız iyimser (optimistic) güncelleme + başarısızsa geri alma yapan tek hook. Ayarlar ekranındaki "💬 Akış" bölümüne iki `SettingsSwitchRow` daha eklendi ("İzlediklerimi Akışta Paylaş", "Puanlarımı Akışta Paylaş") — "Her şeyi gizle" açıkken bu ikisi UI'da `disabled` + soluk gösteriliyor (mantıksal olarak geçersiz kaldıkları için, kullanıcı kafası karışmasın diye).

**Doğrulama:** `tsc --noEmit` sıfır hata. Worker `wrangler deploy --dry-run` ile doğrulandı (19.02 KiB). `grep` ile eski `feedVisibility`/`handleFeedVisibility`/`/feed/visibility` kalıntı taraması temiz (yalnızca dokümantasyon + eski migration'ın açıklama yorumunda, beklenen). Web preview'da (test token'ıyla) Ayarlar ekranındaki üç anahtar da doğru etiket/ipucu/renk ile render oldu, konsol hatasız (yalnızca bu ortamın bilinen, ilgisiz Trakt-network kısıtları). **Doğrulanamayan:** Gerçek bir hesapla üç anahtarın bağımsız çalıştığının (ör. yalnızca puanlamayı kapatınca izleme aktivitesinin akışta kalmaya devam ettiğinin) uçtan uca testi.

## 90. Feed Sistemi — Gizlilik (Trakt + KaymakTV-özel) ve Geri Alma (Retraction) Senkronizasyonu

**Bağlam:** Madde 89'daki bug tamamen düzeldikten sonra kullanıcı ve arkadaşı gerçek verilerle test ederken üç soru/gözlem geldi: (1) depolama büyümesi endişesi, (2) Trakt'ta gizli olanların akışa hiç düşmemesi isteği + bunun Ayarlar'dan da açılıp kapanabilmesi isteği, (3) bir izlemeyi geri alırsa (un-watch) ne olacağı sorusu. Kullanıcıyla birlikte önceliklendirilmiş bir yol haritası çıkarılıp (`docs/feed.md`) gizlilik + geri alma bu oturumda uygulandı; depolama/pagination/poster/Phase 1.1/bildirimler sonraki oturumlara planlandı.

**1) Gizlilik — Trakt-kaynaklı (Madde 88'de zaten yapılmıştı, doğrulandı):** `is_private=true` ise Worker hiç aktivite yazmıyor. Test öncesi bu değişikliğin kullanıcının kendi verisini yanlışlıkla silip silmediği kontrol edildi (`is_private:false` her iki hesap için de, veri kaybı yok — `feed_activities` 52'den 59'a çıkmıştı, sync sorunsuz çalışıyordu).

**2) Gizlilik — KaymakTV-özel anahtar (yeni):** Kullanıcı, Trakt'a gitmeden KaymakTV içinden aç/kapa yapabilmek istedi — Trakt'ın `private` ayarından tamamen BAĞIMSIZ bir anahtar. `supabase/schema/006_add_feed_hidden.sql`: `users.feed_hidden BOOLEAN DEFAULT FALSE`. Worker'a yeni `POST /feed/visibility` uç noktası eklendi (`{traktAccessToken, hidden}` — kimlik doğrulanır, `feed_hidden` güncellenir, `hidden:true` ise var olan aktiviteler HEMEN silinir — kullanıcı bir sonraki app açılışını beklemek istemez). `handleFeedSync`'in gizlilik kontrolü `isPrivate || feedHidden` oldu. `verifyAndUpsertUser`'ın upsert payload'ında `feed_hidden` hiç gönderilmediği için (PostgREST'in `merge-duplicates` çözümü yalnızca payload'daki alanları günceller) kullanıcının ayarı her sync'te asla ezilmiyor.

Client: `features/feed/services/feedVisibility.ts` (okuma: doğrudan Supabase anon key + RLS SELECT; yazma: Worker), `features/feed/hooks/useFeedVisibility.ts` (iyimser güncelleme + başarısızsa geri alma), yeni `components/settings/SettingsSwitchRow.tsx` (projede daha önce toggle'lı bir ayar satırı deseni yoktu, `SettingsRow`'un chevron/value yerine `Switch` kullanan kardeşi), `app/(protected)/account.tsx`'te yeni "💬 Akış" bölümü (yalnızca gerçek kullanıcıya, misafire gösterilmiyor).

**3) Geri alma (retraction) — gerçek bir veri bütünlüğü açığıydı:** Sync o zamana kadar yalnızca EKLEME yapıyordu, hiçbir zaman ÇIKARMA yapmıyordu — kullanıcı Trakt'ta bir izlemeyi/puanı geri alsa bile bizde sonsuza dek "izlenmiş/puanlanmış" görünmeye devam ederdi. `handleFeedSync`'e iki farklı stratejiyle reconciliation eklendi:
- **`rated`:** Trakt `/sync/ratings/{shows,movies}` her seferinde TÜM güncel puanları döndürüyor (limitsiz) — tam karşılaştırma güvenli. Bizde olup Trakt'ın güncel listesinde olmayan puan → silinir.
- **`watched_episode`:** Trakt `/sync/history/episodes` yalnızca son 50 kaydı döndürüyor (limit var) — "bizde olup gelen 50'de olmayanı sil" burada YANLIŞ olurdu, limit dışında kalan gerçek eski geçmişi silerdi. Bunun yerine yalnızca bu senkronda ÇEKİLEN pencerenin (en eski `watched_at`'ten bu yana) zaman aralığındaki mevcut kayıtlar karşılaştırılıp, o pencere içinde kalıp artık gelmeyenler silinir — pencere dışına hiç dokunulmaz. `history` boş dönerse (örn. geçici API hatası) hiç silme yapılmaz — riskli bir varsayımda bulunmaktansa bayat veriyi olduğu gibi bırakmak tercih edildi.

Yeni `supabaseDeleteByIds(env, table, ids)` helper'ı — `DELETE .../feed_activities?id=in.(...)` ile toplu silme.

**Doğrulama:** `tsc --noEmit` sıfır hata, Worker `wrangler deploy --dry-run` ile doğrulandı (16.57 KiB). Web preview'da (test token'ıyla) Ayarlar ekranındaki yeni "💬 Akış" bölümü ve anahtar doğru render oldu, konsol hatasız (yalnızca bu ortamın bilinen, ilgisiz Trakt-network kısıtları). **Doğrulanamayan:** Gerçek bir hesapla anahtarın gerçekten çalıştığının ve retraction mantığının (bir bölümü Trakt'ta izlenmemiş yapıp senkron sonrası bizde de kalktığının) uçtan uca testi — kullanıcı ve arkadaşı deneyecek.

## 89. KRİTİK BUG: feed_activities Hiç Yazılmıyordu — Kısmi Index + PostgREST on_conflict Uyumsuzluğu

**Bağlam:** Madde 88'de Aktiviteler sekmesi gerçek veriye bağlandıktan sonra kullanıcı ve arkadaşı gerçek hesaplarıyla test etti — ikisi de dizi izleyip puan verdi, ama Feed'de/Profil'de hiçbir şey görünmedi. Bu, ciddi bir canlı-hata avı sürecine dönüştü.

**Teşhis Adım 1 — veritabanına bakış:** `users` tablosunda ikisi de vardı (senkron identity kısmı çalışıyordu) ama `feed_activities` **tamamen boştu**. Kod incelemesinde gerçek bir hata bulundu: Worker'daki `feed_activities` yazma çağrılarının HTTP yanıtı hiç kontrol edilmiyordu — yazma başarısız olsa bile client'a hep `success:true` dönüyordu. Bu düzeltilip (`response.ok` kontrolü + `502` + hata detayı) yeniden deploy edildi.

**Teşhis Adım 2 — `npx wrangler tail` ile canlı log yakalama:** Kullanıcı hâlâ aynı sonucu alınca (502), tam Postgres hatasını görmek için `wrangler tail --format pretty` arka planda başlatılıp kullanıcıdan senkronu tekrar tetiklemesi istendi (web'de: sekmeyi kapatıp sert yenileme — `hasSyncedRef` bellekte tutulduğu için normal F5 yetmeyebilir). Yakalanan gerçek hata:
```
code: 42P10 — there is no unique or exclusion constraint matching the ON CONFLICT specification
```

**Kök neden (asıl bulgu):** `feed_activities` üzerindeki `uq_feed_watched_episode`/`uq_feed_rated` index'leri **kısmi** (`WHERE activity_type = '...'`) idi (Madde 82'de bilinçli bir tasarımdı — iki farklı aktivite tipini tek tabloda ayrı ayrı tekilleştirmek için). Postgres'in kendi dokümantasyonu açık: kısmi bir unique index'i `ON CONFLICT` çakışma hedefi olarak kullanabilmek için, `ON CONFLICT (kolonlar) WHERE <aynı şart>` şeklinde şartın TEKRAR belirtilmesi gerekiyor. **Supabase/PostgREST'in `on_conflict=` query parametresi yalnızca kolon listesi kabul ediyor, bu şartı hiçbir zaman iletemiyor.** Yani kullanıcı SQL'i doğru çalıştırmış olsa bile (ki çalıştırmıştı, birden fazla kez) bu upsert deseni **hiçbir zaman** çalışamayacaktı — mimari düzeyde bir uyumsuzluktu, "migration çalıştırılmamış" değil. `idempotent 005_ensure_feed_activity_indexes.sql` bu yüzden hiçbir şeyi çözmedi (indexler zaten doğru kuruluyordu, sorun onları KULLANAMAMAKTI).

**Gerçek çözüm — `on_conflict`'ten tamamen vazgeçildi:** `kaymaktv-feedback-worker/src/index.js`'teki `handleFeedSync` yeniden yazıldı: artık Supabase'e "upsert" demek yerine, önce o kullanıcının var olan `feed_activities` satırlarını (`fetchExistingActivities`) çekip Worker'ın kendisi karşılaştırıyor — `watched_episode` için `(show_id, episode_number, activity_at)` anahtarıyla zaten var olanları eliyor, `rated` için `show_id`'ye göre var olan satırı bulup değişmişse `PATCH` ile güncelliyor, yoksa ekliyor. Sade `INSERT`/`PATCH` kullanılıyor, `ON CONFLICT` hiç yok — bu deseni her Postgres/PostgREST kurulumunda çalışır.

**Yan bug (aynı geliştirme sırasında bulunup düzeltildi):** İlk düzeltmede `newWatchedRows` ve `ratedToInsert`'i TEK bir toplu `INSERT` çağrısında birleştirmiştim — ama biri `episode_number`, diğeri `rating` alanı taşıdığı için farklı anahtar kümelerine sahipler. PostgREST toplu INSERT'te tüm nesnelerin AYNI anahtar kümesine sahip olmasını zorunlu kılıyor (`PGRST102: All object keys must match`) — canlı testte hemen yakalandı, iki ayrı `INSERT` çağrısına bölünerek düzeltildi.

**Ekstra sağlamlaştırma:** Timestamp karşılaştırmaları ham string eşitliği yerine (`new Date(x).getTime()`) epoch ms'e çevrilerek yapılıyor — Postgres'ten geri okunan `TIMESTAMPTZ` string'i Trakt'ın gönderdiği ISO string'le birebir aynı biçimde olmayabilir (`Z` vs `+00:00` gibi), ham string karşılaştırması aynı bölümü/puanı her senkronda "değişmiş/yeni" sanıp gereksiz yazma/tekrar kayıt riski taşırdı.

**Doğrulama:** Üç yeniden-deploy + canlı `wrangler tail` döngüsünden sonra (her adımda gerçek hata mesajı yakalanıp bir sonraki kodda düzeltildi — teşhis asla varsayıma dayanmadı, her seferinde gerçek Postgres/PostgREST hata koduna bakıldı) son istekte hata log satırı çıkmadı. Doğrudan Supabase sorgusuyla teyit edildi: `feed_activities` artık kullanıcının gerçek verileriyle dolu (Castlevania: Nocturne, Star Trek: Voyager/TNG bölümleri; Interstellar 9/10, Doctor Who 10/10 puanları). **Ders:** Kısmi (partial) unique index'ler PostgREST'in `on_conflict` upsert mekanizmasıyla ASLA kullanılamaz — ileride benzer bir tekilleştirme ihtiyacı çıkarsa (ör. Phase 2 comments), ya tam (non-partial) index ya da bu maddedeki "önce oku, sonra sade insert/patch" deseni tercih edilmeli.

## 88. Profil Ekranı — Üst Boşluk Düzeltmesi + Aktiviteler Sekmesi Gerçek Veriye Bağlandı

**Bağlam:** Madde 87'deki profil yenilemesi sonrası kullanıcı iki şey istedi: (1) özellikle mobilde avatarın üstünde gereksiz büyük bir boşluk vardı, (2) "Aktiviteler" sekmesi hâlâ mock veriydi, gerçek veriyle çalışsın.

**Boşluk düzeltmesi (kök neden):** Ayarlar dişlisi kendi başına bir başlık satırında duruyordu (`topHeader` View) — mobilde `paddingTop:8 + paddingBottom:14 + 22px ikon` ≈ 44px, webde ise `marginBottom:32` ile birlikte daha da fazla. Eskiden bu satırda dişlinin yanında büyük bir "Profil" başlığı da vardı (dengeli görünüyordu); Madde 87'de o başlık kaldırılınca (kimlik zaten `ProfileHeader`'da gösterildiği için tekrar olurdu) satır neredeyse boş bir dişli ikonuna indi ama kendi boşluğunu korudu. Çözüm: dişli ikonu artık akıştan çıkarılıp (`position: 'absolute'`) hem mobilde (`screens/ProfileMobile.tsx`) hem webde (`profile.web.tsx`) sağ üst köşeye bindirildi — kendi satırının aldığı dikey alan tamamen ortadan kalktı. Web'de ayrıca `ScrollView`'ın DIŞINA taşındı ki scroll ile birlikte kaymasın (sabit köşe ikonu).

**Aktiviteler sekmesi — gerçek veri:** `features/feed/services/feedApi.ts`'e `fetchUserFeedActivities(traktSlug)` eklendi — takip listesi filtrelemesi olmadan, TEK bir kullanıcının (profilde: kendimin) `feed_activities`'ini `trakt_slug` üzerinden `users.id`'ye çevirip son 20 kaydı çekiyor (mevcut `fetchFeedActivities`'teki `mapRow`/`FeedActivityRow` ile aynı, kopyalanmadı). Yeni `features/feed/hooks/useUserActivity.ts` bunu sarmalıyor. `components/profile/ProfileActivityTab.tsx` artık `traktSlug` prop'u alıyor (`useMyTraktProfile`'dan gelen `profile.ids.slug`), mock veri tamamen kaldırıldı; yükleniyor durumunda `FeedSkeleton`, veri yoksa yeni bir boş durum ("Henüz aktivite yok") gösteriyor.

**Doğrulama:** `tsc --noEmit` sıfır hata. Web preview'da (yine geçici test token'ıyla, gerçek Trakt/Supabase verisi bu sandboxed ortamda çekilemediği için) hem mobil hem masaüstü genişlikte üst boşluğun belirgin şekilde azaldığı doğrulandı; Aktiviteler sekmesi artık (çözülemeyen sahte kimlik nedeniyle) doğru şekilde "Henüz aktivite yok" boş durumuna düşüyor — çökme yok, sonsuz yükleniyor durumu yok. **Doğrulanamayan:** Gerçek bir Trakt hesabıyla dolu bir Aktiviteler listesinin render'ı — kullanıcı ve arkadaşı gerçek cihazda deneyecek.

## 87. Profil Ekranı — Sosyal Medya Standardına Yükseltme (Avatar, Takipçi/Takip Edilen, Özet/Aktiviteler Sekmeleri)

**Bağlam:** Madde 86'da Feed içi arama+takip sistemi tamamlanınca, kullanıcı Profil ekranının hâlâ eski "yalnızca istatistik paneli" halinde kaldığını belirtti — kullanıcının kendi avatarı/adı/kullanıcı adı, takipçi-takip edilen sayıları hiçbir yerde gösterilmiyordu (bu oturumun başlarında da doğrulanmıştı: uygulama daha önce hiçbir yerde `/users/settings` veya `/users/me` çağırmıyordu).

**`services/api/social.ts`'e eklenenler:** `getFollowers(username)` ve `getFollowing(username)` — `GET /users/{id}/followers` ve `/following`'i `?extended=full` ile (avatar dahil) çağırıp `user` alanlarını döndürüyor. Aynı dosyadaki mevcut `getUserProfile`/`followTraktUser` ile aynı desen — hepsi client'ın kendi Trakt token'ıyla, doğrudan.

**`hooks/useMyTraktProfile.ts` (yeni):** Kendi profilimi (`getUserProfile('me')` — Trakt'ın "me" kısayolu, kodda zaten `/users/me/stats` gibi yerlerde kullanılan bir konvansiyon) + takipçi/takip edilen sayılarını (`getFollowers('me').length`, `getFollowing('me').length`) paralel çekiyor. Hata durumunda sessizce `console.warn`, `isLoading:false` ile devam ediyor — profil çekilemese bile geri kalan ekran çalışmaya devam eder.

**Yeni paylaşılan bileşenler (`components/profile/`):**
- `ProfileHeader.tsx` — büyük yuvarlak avatar (yoksa baş harf fallback'i), ad + `@kullaniciadi`, tıklanabilir Takipçi/Takip Edilen sayıları, hap şeklinde aksiyon butonu. `isOwnProfile` prop'uyla (varsayılan `true`) hazır: `false` verilince "Profili Düzenle" yerine "Takip Et"/"Takip Ediliyor" durumuna geçiyor — şu an başka bir kullanıcının profilini görüntüleme rotası olmadığı için bu dal henüz kullanılmıyor ama Phase 1.5 için hazır.
- `ProfileHeaderSkeleton.tsx` — yükleniyor durumu, gerçek bileşenle birebir aynı ölçülerde (layout sıçraması yok).
- `ProfileTabs.tsx` — "Özet"/"Aktiviteler" arasında basit state-tabanlı sekme (kütüphane eklenmedi, `react-native-tab-view` gerekmedi — kullanıcı da bunu opsiyonel bırakmıştı).
- `ProfileActivityTab.tsx` — Feed modülündeki `FeedCard`'ı KOPYALAMADAN yeniden kullanıyor (`features/feed/components/FeedCard` import), 3 mock aktiviteyle. Gerçek veri (kendi `feed_activities`'im) bağlanması ayrı bir adım.

**Ekran değişiklikleri:** `screens/ProfileMobile.tsx` ve `app/(protected)/(tabs)/profile.web.tsx` — ikisi de eski sabit "Profil" başlığını kaldırıp (kimlik bilgisi zaten ProfileHeader'da gösteriliyor, tekrar olurdu) yerine ProfileHeader/Skeleton + ProfileTabs ekledi. "Özet" sekmesi = eskiden zaten var olan tüm içerik (İstatistik kartı, Listelerim, Diziler, Favori Diziler, Filmler, Favori Filmler) değişmeden aynı yerde; "Aktiviteler" sekmesi = yeni mock içerik. Ayarlar dişlisi (sağ üst) yerinde kaldı.

**Doğrulama:** `tsc --noEmit` sıfır hata. Web preview'da gerçek bir Trakt oturumu yoktu (guest mod) — yalnızca UI/layout doğrulaması için `localStorage`'a geçici bir sahte token yazılıp gate aşıldı (gerçek Trakt verisi bu sandboxed ortamda zaten çekilemiyor, bilinen kısıt — bkz. Madde 86), test sonrası temizlendi. Bu şekilde hem mobil (375px) hem masaüstü (1280px, sidebar'lı) genişlikte doğrulandı: iskelet doğru ölçülerde render oluyor, "Özet"/"Aktiviteler" sekme geçişi çalışıyor, "Özet" altındaki mevcut Listelerim/Favori Filmler bölümleri bozulmadan duruyor, "Aktiviteler" altında 3 mock `FeedCard` doğru render oluyor. **Doğrulanamayan:** Gerçek bir Trakt hesabıyla avatar/isim/takipçi-takip edilen sayılarının gerçek veriyle dolu render'ı — gerçek cihazda/build'de kullanıcının kendisi tarafından test edilmesi gerekiyor.

## 86. Feed Sistemi — Uygulama İçi Arama + Takip, Trakt'ın Kendi Follow API'siyle (Trakt'a Gidip Gelme Yok)

**Bağlam:** Madde 85'teki pivottan sonra kullanıcı danışman modunda sordu: "Keşfet'te kişi araması yoktu, kişileri nereden ekleyelim?" Konuşma sonunda üç seçenek sunuldu (A: hiç arama yok, B: Trakt'a dışarı yönlendiren kısayol, C: KaymakTV içinde salt-okunur profil arama + takip için Trakt'a yönlendirme) ve C, ama Keşfet yerine Feed'de olacak şekilde kararlaştırıldı. Kullanıcı sonra kritik bir düzeltme yaptı: **Trakt'a gidip gelmeye hiç gerek yok** — Trakt'ın gerçek bir `POST /users/{id}/follow` uç noktası var, takip etme de tamamen uygulama içinde kalabilir.

**Doğrulama (kodlamaya başlamadan önce):** Bu oturumda ikinci kez, iddia edilen bir Trakt endpoint'i koda geçirilmeden önce gerçek dokümantasyon + canlı istekle doğrulandı (Madde 82'deki `trakt_id` hatasından çıkarılan ders uygulandı):
- `docs.trakt.tv/reference/postusersfollow.md`: `POST /users/{id}/follow`, boş body, `201` döner, yanıtta `approved_at` alanı var — **gizli (private) hesaplarda `null`** (onay bekliyor), **public hesaplarda dolu** (anında takip edildi). `409` = zaten takip ediliyor/istek zaten gönderilmiş.
- `docs.trakt.tv/reference/deleteusersunfollow.md`: dokümantasyon sayfasının adı "unfollow" olsa da gerçek HTTP path'i **`DELETE /users/{id}/follow`** (`/unfollow` DEĞİL) — bu, kontrol edilmeseydi bir başka yanlış varsayım olurdu.
- `docs.trakt.tv/reference/getusersprofile.md` + canlı istek: `GET /users/{id}` avatar'ı (`images.avatar.full`) yalnızca `?extended=full` ile döndürüyor, eksikse alan hiç gelmiyor.

**`services/api/social.ts` (yeni):** `getUserProfile`, `getMyFollowingSlugs`, `followTraktUser`, `unfollowTraktUser` — hepsi client'ın **kendi** Trakt token'ıyla, var olan `getTraktClient()` altyapısı (circuit breaker, backoff, token yenileme) üzerinden, doğrudan çağrılıyor. Worker'a hiç uğramıyor çünkü bunlar zaten "kendi hesabımla kendi işlemimi yapıyorum" — Trakt'ın kendi OAuth'u zaten kimliği doğruluyor, ayrı bir doğrulama katmanına gerek yok (Madde 85'te follow/unfollow için kurulan Worker karmaşıklığının tam olarak neden gereksiz olduğunun kanıtı). `features/feed/services/feedApi.ts`'teki özel `fetchMyTraktFollowingSlugs` silinip bu ortak `getMyFollowingSlugs`'a yönlendirildi (kod tekrarı ortadan kalktı).

**`features/feed/utils/extractTraktUsername.ts`:** Kullanıcı ya tam kullanıcı adı yazıyor ya da `https://app.trakt.tv/profile/sertay?mode=media` gibi bir link yapıştırıyor — regex (`trakt\.tv\/(?:users|profile)\/([a-zA-Z0-9_-]+)`) ile kullanıcı adını ayıklıyor. **Panoya (clipboard) hiç erişilmiyor** — kullanıcı metni kendi yapıştırıyor, biz yalnızca gelen string'i işliyoruz.

**`features/feed/hooks/useUserSearch.ts`:** Arama tetiklenince (`onSubmitEditing` VEYA arama ikonuna tıklama — ikisi de var, aşağıya bak neden) `getUserProfile` + `getMyFollowingSlugs`'ı paralel çeker, `connectionState`'i (`none`/`following`/`pending`) hesaplar. `toggleFollow`, `approved_at`'e göre `following`/`pending` arasında karar verir; `409` hatasını "zaten bağlı" olarak yorumlayıp kullanıcıya hata göstermez.

**UI:** `UserSearchBar.tsx` (arama kutusu) + `UserProfileCard.tsx` (avatar, `@kullaniciadi`, gizli hesap kilidi ikonu, Takip Et/Takip Ediliyor/Onay Bekleniyor butonu) — `app/(protected)/(tabs)/feed.tsx`'in başlığının hemen altına, listenin üstüne eklendi.

**Web preview testinde bulunan ve düzeltilen gerçek bug:** İlk halde arama yalnızca `TextInput`'un `onSubmitEditing`'ine bağlıydı. Test sırasında (RN Web'de programatik Enter tuşu tetiklenmedi) bunun tek tetikleyici olmasının kırılgan olduğu görüldü — büyüteç ikonu da `TouchableOpacity` yapılıp `onSubmit`'i tetikleyecek şekilde düzeltildi. Bu, yalnızca test aracının bir kısıtı değil, gerçek bir UX eksikliğiydi (masaüstü/web kullanıcısı ikona tıklamayı bekler) — düzeltme kalıcı.

**Web preview testinde bulunan, KODLA İLGİSİZ ortam kısıtı:** Arama gerçek bir Trakt kullanıcı adıyla (`sean`) denendiğinde "Something went wrong" hatası alındı. Kontrol için hiç dokunulmamış `/explore` sekmesi açıldı — o da (var olan `getTrendingShows` çağrısı) aynı ortamda "AxiosError: Network Error" veriyor ve devre kesici açılıyor. Bu, bu oturumdaki web preview sandbox'ının `api.trakt.tv`'ye client-side doğrudan ulaşamamasından kaynaklanan, **bu koddan önce de var olan** bir ortam kısıtı — yeni kodun bir hatası değil. Hata durumu UI'ı (mesaj gösterimi, çökmeme) doğru çalıştığı için en azından o kısım doğrulandı.

**Doğrulama:** `tsc --noEmit` sıfır hata. Endpoint şekilleri hem resmi dokümantasyon hem canlı Node.js istekleriyle (raw `https` modülüyle, uygulama dışında) doğrulandı. `grep` ile kalıntı taraması temiz. **Doğrulanamayan (kullanıcıya bırakıldı):** Uygulamanın kendi runtime'ında (gerçek cihaz/`expo start`) arama + takip akışının uçtan uca çalıştığının teyidi — web preview sandbox'ının ağ kısıtı yüzünden bu oturumda mümkün olmadı.

## 85. Feed Sistemi — Mimari Pivot: Kendi Follow Sistemi Terk Edildi, Trakt'ın Kendi Sosyal Grafiği Kullanılıyor

**Bağlam:** Madde 83'te tamamlanan "kendi DB'mizde takip sistemi" (arama + follow/unfollow + `user_follows` tablosu + Worker'da kimlik-doğrulamalı yazma) üzerine kullanıcı danışman modunda bir soru sordu: "Trakt'ta zaten takip sistemi varken neden sıfırdan kendi DB'mizi kurduk?" Bu, gerçek bir over-engineering'i açığa çıkardı — kullanıcının en baştaki (bu oturumdan önceki) orijinal isteği zaten "Trakt'taki arkadaşlığı kullanalım, ekstra arkadaşlığa gerek yok" idi, ama uygulama sırasında `feed_activities` için geçerli olan "Trakt rate-limit'ine takılmayalım, kendi DB'mizde tutalım" mantığı yanlışlıkla takip ilişkisine de bulaştırılmış, kullanıcının orijinal kararından sessizce sapılmıştı.

**Doğrulama:** Karar öncesi canlı bir Trakt API isteğiyle doğrulandı — Trakt'ın gerçekten tam işlevsel, public (auth gerektirmeyen) bir sosyal grafiği var: `GET /users/{username}/followers`, `/following`, `/friends` hepsi `200 OK` dönüyor.

**Kullanıcının kararı:** Kendi takip sistemini kökten sil, Trakt'ın kendi API'sini kullan. Feed_activities'i Supabase'de tutma kararı (rate-limit gerekçesiyle) aynen geçerli kaldı — yalnızca "kim kimi takip ediyor" bilgisi Trakt'a devredildi.

**Silinen dosyalar (client):** `features/feed/services/followApi.ts`, `features/feed/hooks/useFollowSearch.ts`, `features/feed/components/FollowSearchModal.tsx`, `features/feed/store/useFeedUserStore.ts` (kimlik önbelleği — yalnızca follow arama UI'ı için vardı, artık gereksiz).

**Sadeleştirilen dosyalar:** `features/feed/hooks/useFeedSyncTrigger.ts` ve `features/feed/services/feedSync.ts` eski (Madde 83 öncesi) sade hallerine döndürüldü — artık sync yanıtından `userId`/`traktSlug`/`username` çıkarıp saklamıyorlar. `app/(protected)/(tabs)/feed.tsx`'ten header'daki "Kullanıcı Bul" butonu ve modalı kaldırıldı, tekrar sade bir başlık.

**Worker (`kaymaktv-feedback-worker/src/index.js`):** `findUserBySlug`, `resolveFollowRequest`, `handleFollow`, `handleUnfollow` fonksiyonları ve `/feed/follow`/`/feed/unfollow` routing'i tamamen silindi. `verifyAndUpsertUser` (yalnızca `handleFeedSync` tarafından kullanılıyor artık) sadeleşti — dönüş değeri `{ userId, traktSlug, username }`'den yalnızca `{ userId }`'ye indirildi, çünkü diğer ikisine artık hiçbir tüketici ihtiyaç duymuyor. `handleFeedSync`'in yanıtından da `userId`/`traktSlug`/`username` alanları kaldırıldı. Sonuç: Worker upload boyutu 12.73 KiB'den 9.46 KiB'e düştü (`wrangler deploy --dry-run` ile doğrulandı) — kod gerçekten küçüldü, yama değil gerçek bir sadeleşme.

**`features/feed/services/feedApi.ts` — yeni akış:** `fetchFeedActivities()` artık parametre almıyor (eskiden `myUserId` alıyordu). İçeride: (1) `getTraktClient()` ile `GET /users/me/following` çağırıp `trakt_slug` listesi çıkarır — bu, projede zaten var olan Trakt client altyapısıyla (circuit breaker, backoff, token yenileme) yapılıyor, Worker'a hiç gerek yok çünkü kullanıcı yalnızca **kendi** takip listesini okuyor (kimlik doğrulama sorunu yok, kendi token'ı zaten kendini yetkilendiriyor); (2) bu slug'ları bizim `users` tablomuzda arayıp (Trakt'ta takip ettiği ama KaymakTV'yi hiç açmamış kişiler doğal olarak elenir) eşleşen `id`'leri bulur; (3) `feed_activities`'i bu id'lerle filtreleyip son 30 gün + 30 kayıtla sınırlı okur — bu adım (Madde 84) değişmedi.

**`useFeed.ts`:** Artık `useFeedUserStore` yerine doğrudan `useAuth()`'tan `accessToken`/`isGuest` okuyor — misafir kullanıcı veya token yoksa sessizce boş feed döner.

**SQL:** `supabase/schema/004_drop_user_follows.sql` eklendi (`DROP TABLE IF EXISTS user_follows;`). Önceki migration dosyaları (001-003) geçmiş kaydı olarak düzenlenmeden bırakıldı (migration konvansiyonu: uygulanmış dosyalar değiştirilmez, yalnızca üzerine yenisi eklenir) — 001'deki artık geçersiz `user_follows` CREATE TABLE bloğu tarihsel bir kayıt olarak duruyor, 004 onu canlı veritabanından kaldırıyor.

**i18n:** `locales/{tr,en}/feed.json`'daki arama/takip-özel anahtarları (`searchTitle`, `searchPlaceholder`, `follow`, `following`, vb.) silindi, yalnızca `emptyTitle`/`emptyText` kaldı (metni de güncellendi: "Trakt'ta takip ettiğin kişiler" diye netleştirildi).

**`docs/feed.md`:** Kökten yeniden yazıldı (yama değil) — eski, artık geçersiz "Follow Sistemi Mimarisi", "İlgili Dosyalar" (yanlış path'lere işaret ediyordu: `services/api/feedSync.ts`, `components/feed/` gibi hiç var olmamış konumlar) gibi bölümler temizlendi, güncel gerçek mimariyi ("Mimari Pivot" bölümü dahil) yansıtacak şekilde baştan yazıldı.

**Doğrulama:** `tsc --noEmit` sıfır hata. `grep` ile tüm follow-sistemi kalıntıları tarandı — yalnızca dokümantasyon (beklenen, açıklayıcı) ve migration dosyası (beklenen, DROP ifadesi) eşleşti, kod tarafında hiçbir kalıntı yok. Worker `wrangler deploy --dry-run` ile doğrulandı. Web preview'da Feed ekranı hatasız render oldu, "Kullanıcı Bul" butonu artık yok, boş durum metni güncel. **Doğrulanamayan:** Worker'ın gerçek deploy'u ve `004` migration'ının çalıştırılması (kullanıcıya bırakıldı — onaysız üretim deploy'u yapmadım) ve gerçek bir Trakt takip ilişkisiyle dolu feed'in uçtan uca testi.

## 83. Feed Sistemi — Follow (Takip) Sistemi

**Bağlam:** Madde 82'de senkronizasyon servisi tamamlanmıştı ama feed'i anlamlı kılacak bir şey eksikti: kimseyi takip edemiyorduk. Bu madde kullanıcının onayıyla ("bence follow sistemi yapalım") o boşluğu dolduruyor.

**Kısıt (bilinçli, Phase 1):** Trakt API'sinde genel bir "kullanıcı arama" uç noktası yok. Bu yüzden arama, kendi `users` tablomuzda (yalnızca KaymakTV'yi en az bir kez açıp senkronize olmuş kişiler) yapılıyor — birini takip edebilmek için o kişinin önce uygulamayı bir kez açmış olması gerekiyor. Bu, ek bir "genel kullanıcı dizini" inşa etmeden en basit çözüm.

**Worker refactor (`kaymaktv-feedback-worker/src/index.js`):** `handleFeedSync`'in içindeki "Trakt token'ı doğrula + `users` tablosuna upsert et" mantığı `verifyAndUpsertUser(token, env)` adında ortak bir fonksiyona çıkarıldı — üç uç nokta (sync, follow, unfollow) da aynı kimlik doğrulamaya ihtiyaç duyduğu için. Yeni `findUserBySlug(traktSlug, env)` helper'ı hedef kullanıcıyı `trakt_slug`'a göre bulup Supabase UUID'sini döndürüyor.

**Yeni uç noktalar:** `POST /feed/follow` ve `POST /feed/unfollow` — ikisi de `{ traktAccessToken, targetTraktSlug }` alır, çağıranın kimliğini doğrular, kendini takip etmeyi engeller (`traktSlug === targetSlug` kontrolü), hedefi bulur, `user_follows`'a satır ekler/siler. Ekleme `on_conflict=follower_id,following_id` + `ignore-duplicates` ile upsert edildiği için aynı isteği iki kez atmak hata vermiyor. `handleFeedSync`'in yanıtına da `userId`/`traktSlug`/`username` eklendi — client bunu önbelleğe alıp kendi kimliği için tekrar Trakt'a sormasın diye.

**Client — kimlik önbelleği:** `features/feed/store/useFeedUserStore.ts` — Madde 79'daki `useFeedbackStore.ts` ile birebir aynı desen (manuel AsyncStorage persistence, `zustand/middleware`'in ESM `import.meta` sorununu önlemek için `persist` middleware'i kullanılmadı). `useFeedSyncTrigger.ts` artık senkron yanıtını bu store'a yazıyor.

**Client — arama ve takip UI'ı:** `features/feed/services/followApi.ts` — `searchUsers` (Supabase client, anon key + RLS SELECT, salt okunur olduğu için kimlik doğrulama gerektirmiyor), `getMyFollowingIds` (kendi takip listem, arama sonuçlarında "zaten takip ediyorum" işareti için), `followUser`/`unfollowUser` (Worker'a POST — yazma işlemi olduğu için). `features/feed/hooks/useFollowSearch.ts` — 350ms debounce'lu arama + iyimser (optimistic) takip/bırak güncellemesi (başarısız olursa geri alınıyor). `features/feed/components/FollowSearchModal.tsx` — mevcut bottom-sheet dilinde (`ReportIssueModal`/`LanguagePickerModal` ile aynı desen) arama kutusu + sonuç listesi + Takip Et/Takip Ediliyor butonu. Feed ekranının header'ına (`UserPlus` ikonlu, sağ üstte) bu modalı açan bir buton eklendi.

**i18n:** Yeni `locales/{tr,en}/feed.json` namespace'i (`resources.ts`'e kaydedildi) — Feed'e özgü tüm metinler artık ortak `settings.json`'ı şişirmek yerine kendi dosyasında, `features/feed/`'in izole modül felsefesiyle tutarlı.

**Doğrulama:** `tsc --noEmit` sıfır hata, Worker `wrangler deploy --dry-run` ile hem refactor hem yeni uç noktalar sonrası tekrar doğrulandı. Web preview'da: arama modalı doğru açılıyor (bottom-sheet, grabber, X buton), 2 karakterden az yazınca doğru ipucu ("en az 2 karakter") gösteriliyor, gerçek bir arama (`users` tablosu şu an boş olduğu için) doğru şekilde "kullanıcı bulunamadı" boş durumuna düşüyor, konsol hatasız (yalnızca bu preview ortamının önceden var olan, ilgisiz Trakt trending-API ağ hataları var). **Doğrulanamayan:** Gerçek iki farklı Trakt hesabıyla uçtan uca takip etme/bırakma testi (ikinci bir gerçek kullanıcı/cihaz gerektiriyor, bu oturumda mevcut değildi) ve Worker'ın yeniden deploy edilmesi (kullanıcıya bırakıldı, halka açık üretim Worker'ını onaysız deploy etmek istemedim).

## 82. Feed Sistemi — Senkronizasyon Servisi (Worker) + Kimlik Şeması Düzeltmesi

**Bağlam:** Madde 81'de kurulan Feed UI iskeleti hâlâ mock veriyle çalışıyordu; bu madde onu gerçek Trakt verisiyle besleyecek senkronizasyon servisini (`docs/feed.md` Adım 2) ekliyor.

**Bulunan gerçek hata — `trakt_id` diye bir alan yok:** Madde 81'de yazılan şemada `users.trakt_id BIGINT` vardı — bu varsayım test edilmeden yazılmıştı. Canlı bir Trakt API isteğiyle (`GET https://api.trakt.tv/users/sean`, `trakt-api-key` header'ıyla) doğrulandı: yanıt yalnızca `{"username":"sean","ids":{"slug":"sean"}}` içeriyor — Trakt kullanıcılar için hiçbir zaman sayısal ID döndürmüyor (diziler/filmlerde var, kullanıcılarda yok). Not: ilk denemede User-Agent header'sız istek Cloudflare tarafından 403 ile bot sanılıp engellendi — `trakt-api-key` + `User-Agent` ikisi birden gerekiyor. `supabase/schema/002_fix_user_identity.sql` ile `trakt_id` → `trakt_slug TEXT UNIQUE` olarak düzeltildi (tablo boştu, `ALTER` güvenliydi); `features/feed/types.ts`'teki `FeedUser.traktId: number` → `traktSlug: string` oldu, mock veri güncellendi.

**Kapsam kararı — kullanıcıyla konuşuldu:** `watched_episode`/`rated` Trakt'ın doğrudan verdiği olaylar (`/sync/history/episodes`, `/sync/ratings/{shows,movies}`), ama `started_show`/`completed_show` gerçek bir Trakt olayı değil — "tamamladı" durumunu doğru çıkarsamak her dizi için ayrı bir `/shows/{id}/progress/watched` çağrısı (rate-limit riski) + önceki senkronla-kıyaslama mantığı gerektiriyor. Kullanıcı, bunun için acele etmeyip ayrı bir adımda (Phase 1.1) ele alınmasını, şimdilik yalnızca ilk 2 tipin senkronize edilmesini seçti.

**Senkronizasyon servisi — `kaymaktv-feedback-worker` (`C:\Yapay_Zeka_Uygulamalar\kaymaktv-feedback-worker`, KaymakTV reposunun dışında, ayrı bir Wrangler projesi):** `src/index.js`'e path-bazlı routing eklendi — kök path (`/`) eski feedback davranışını (hiç değişmeden) korurken, yeni `POST /feed/sync` uç noktası eklendi. Akış: client kendi Trakt access token'ını gönderir → Worker `GET /users/settings` ile token'ı doğrulayıp gerçek kimliği (username/slug/private) öğrenir → `users` tablosuna upsert eder (`on_conflict=trakt_slug`) → `/sync/history/episodes?limit=50` ve `/sync/ratings/{shows,movies}`'i çekip `feed_activities`'e upsert eder. Bunların hepsi `env.SUPABASE_KEY` (zaten feedback sisteminde tanımlı `service_role` anahtarı) ile yapılıyor — client asla bu anahtarı görmüyor, RLS bu yolu hiç etkilemiyor çünkü sunucu tarafında, RLS'i bypass eden bir anahtarla çalışıyor. `wrangler.jsonc`'a `TRAKT_CLIENT_ID` public `vars` olarak eklendi (zaten `EXPO_PUBLIC_TRAKT_CLIENT_ID` ile client bundle'ında public — sır değil).

**Tekrar-senkron koruması:** `supabase/schema/003_feed_activity_upsert_constraints.sql` iki kısmi (partial) unique index ekliyor — `watched_episode` için `(user_id, show_id, episode_number, activity_at)`, `rated` için `(user_id, show_id)`. Bunlar olmadan her app açılışında aynı geçmiş tekrar tekrar eklenirdi; `rated` için ayrıca yeniden puanlama var olan satırı GÜNCELLİYOR (yeni satır değil) — Trakt'ta da bir içeriğe tek bir güncel puan verilebildiği için.

**Client tarafı tetikleme:** `features/feed/services/feedSync.ts` (Worker'a POST atan ince bir fonksiyon) + `features/feed/hooks/useFeedSyncTrigger.ts` (`app/(protected)/_layout.tsx`'e bağlı, giriş yapmış-misafir-olmayan kullanıcı için app açılışında BİR KEZ, tamamen sessizce/hataya-dayanıklı şekilde tetikler — Feed senkronizasyonu çökse bile uygulamanın geri kalanı hiç etkilenmez).

**Doğrulama:** `tsc --noEmit` sıfır hata. Worker tarafında `npx wrangler deploy --dry-run` ile config + kod derlemesi doğrulandı (gerçek deploy kullanıcıya bırakıldı — canlı, halka açık bir Worker'ı onaysız deploy etmek istemedim). **Doğrulanamayan:** Gerçek bir Trakt kullanıcı token'ıyla uçtan uca test (kullanıcının kendi hesabıyla, deploy sonrası) ve `/sync/history/episodes`, `/sync/ratings/*` yanıt şekillerinin tam doğruluğu (yalnızca `/users/settings` canlı test edildi — diğer ikisi OAuth kullanıcı token'ı gerektirdiğinden buradan doğrulanamadı, dokümantasyon bilgisine dayanıyor).

## 81. Feed (Akış) Sistemi — Phase 1 Başlangıç: Şema + İzole Modül + Mock UI

**Bağlam:** KaymakTV'ye sosyalleşme katmanı ekleniyor: kullanıcılar takip ettikleri kişilerin izleme aktivitelerini (`watched_episode`, `started_show`, `completed_show`, `rated`) bir "Akış" sekmesinde görecek. Tasarım tartışması ve mimari kararlar `docs/feed.md`'de detaylı tutuluyor (Follow tek-yönlü, Trakt+Supabase hibrit, App-launch senkronizasyon, son 14-30 gün). Bu madde, o kararların **ilk kodlama turunu** kapsıyor: veritabanı şeması, `features/feed/` izole modülü, ve mock veriyle çalışan UI iskeleti.

**Kritik mimari karar — Supabase erişimi:** Mevcut feedback sistemi (Madde 78-80) Supabase'e HİÇ doğrudan bağlanmıyor, her şey Cloudflare Worker üzerinden akıyordu. Feed için bu deseni tekrarlamak yerine (her okuma/yazma için ayrı Worker endpoint'i yazmak gerekirdi), kullanıcıyla birlikte **doğrudan Supabase client (anon key + Row Level Security)** kararlaştırıldı — Supabase'in kendi önerdiği, mobil/web istemciler için standart desen. Anon key `service_role` gibi gerçek bir sır değil, public olması tasarlanmış bir anahtar.

**Bulunan gerçek kısıt:** Proje Supabase Auth kullanmıyor (kimlik Trakt OAuth'tan geliyor), bu yüzden `auth.uid()` tabanlı RLS satır-sahipliği kontrolü (`"sadece kendi satırını güncelleyebilir"`) çalışmıyor — anon key ile gelen her istek Supabase'in gözünde aynı anonim rol. Bunun için **RLS politikaları şimdilik yalnızca SELECT (okuma) izni veriyor; INSERT/UPDATE/DELETE için hiç politika yok** (RLS açıkken politikasız işlem varsayılan olarak reddedilir). Yazma güvenliği (kimin adına yazıldığının doğrulanması — muhtemelen Worker + Trakt token doğrulaması), senkronizasyon servisi inşa edilirken (Adım 2, bir sonraki oturum) ayrıca karara bağlanacak. Detay: `docs/feed.md` → "Adım 2 öncesi karara bağlanacak açık konu".

**Veritabanı (`supabase/schema/001_feed_schema.sql`):** `users` (Trakt kullanıcısının aynası: `trakt_id`, `username`, `avatar_url`, `is_private`), `user_follows` (tek yönlü takip, `UNIQUE(follower_id, following_id)` + kendi kendini takip engeli), `feed_activities` (4 aktivite tipi, `CHECK` kısıtlı `activity_type`/`rating`), ve Phase 2 için şimdiden hazır boş `comments` tablosu. Kullanıcı bu SQL'i kendi Supabase panelinde çalıştıracak (repo'da doğrudan DB erişim aracı yok, önceki "NOTIFY pgrst" düzeltmesinde olduğu gibi).

**Yeni bağımlılıklar:** `@supabase/supabase-js` + `react-native-url-polyfill` (React Native'in Hermes motorunda `URL` API'si eksik olduğundan supabase-js'in resmi olarak gerektirdiği polyfill — kurulmazsa runtime'da patlar).

**`features/feed/` — izole modül:** Kullanıcı ileride bu alana çok özellik ekleneceğini belirtip mevcut ortak `components/`/`hooks/`/`services/` klasörlerini kirletmeden, taşınması gerekmeyecek ayrı bir yapı istedi. Sonuç: `features/feed/{types.ts, components/ (FeedCard, FeedSkeleton), hooks/ (useFeed), services/ (supabaseClient), mock/ (mockFeedData), utils/ (formatRelativeTime)}` — kendi kendine yeten, mevcut proje klasörlerine hiç dokunmayan bir alt-mimari.

**`FeedCard.tsx`:** 4 aktivite tipinin her biri kendi ikonu + vurgu rengiyle (`watched_episode`→mavi Eye, `started_show`→mor Play, `completed_show`→yeşil CheckCircle2, `rated`→sarı Star) tek bir `ACTIVITY_META` map'inden okunuyor — Phase 2'de yeni tip eklemek bu map'e bir satır eklemek kadar basit olacak. Kart, mevcut `ShowCard.tsx` ile aynı tasarım dilini kullanıyor (`#172033` yüzey, `#22304A` kenarlık, `14` border radius). **Not:** Kart şu an tıklanabilir değil — kullanıcı profili görüntüleme ekranı henüz yok (Phase 1.5), var olmayan bir rotaya yönlendirme eklemek yerine bu bilinçli olarak ertelendi.

**Navigasyon:** Yeni "Akış" sekmesi mobil alt tab bar'da 5 sekmenin tam ortasına (Diziler → Filmler → **Akış** → Keşfet → Profil), web'de `Sidebar.tsx`'e aynı sırayla eklendi.

**Doğrulama:** `tsc --noEmit` sıfır hata. Web preview'da: 5 mock aktivite (4 tipin tamamı dahil) doğru şablon metinleriyle render oldu, göreli zaman hesaplaması (`12dk önce`, `3sa önce` vb.) doğru çalıştı, tab bar'da Akış ikonu doğru konumda ve aktifken mavi vurgulanıyor. **Doğrulanamayan:** Gerçek Supabase bağlantısı (tablolar henüz kullanıcı tarafından oluşturulmadı/oluşturuluyor) ve senkronizasyon servisi — bunlar bir sonraki oturumun konusu, `docs/feed.md`'de yol haritası güncel tutuluyor.

## 80. Hata Bildir Modalı Bottom-Sheet'e Dönüştürüldü + Ayarlar Sayfası Cilası + Dil Seçici

**Bağlam:** Madde 78'de eklenen "Hata Bildir" modalı (ortada yüzen kutu, ikon rozeti, yan yana iki buton) kullanıcı tarafından "yapay/AI-generated hissiyat" olarak eleştirildi ve klavye input'un üzerini kapatıyordu. Ayrıca dil değiştirme tek dokunuşla tr↔en arasında toggle yapıyordu (ileride 3. bir dil eklenince ölçeklenmiyor) ve Trakt bağlıyken gereksiz bir "Uygulamaya Git" satırı vardı (zaten geri butonu aynı işi yapıyor).

**Çözüm — `components/settings/ReportIssueModal.tsx` tamamen yeniden yazıldı:** Ortada yüzen `Modal` yerine, projede zaten `AddToListModal.tsx`/`WriteCommentSheet.tsx`'te kullanılan bottom-sheet deseni uygulandı: `justifyContent:'flex-end'`, üstte grabber (`40x4, radius 2`), üst köşeler `borderRadius:24`, arkaplan `#0F172A` (AddToListModal ile birebir aynı). Input'taki keskin border kaldırılıp `rgba(255,255,255,0.05)` dolgu rengine geçildi. Yan yana Vazgeç/Gönder butonları kaldırıldı — tek, tam genişlik, mavi (`#3b82f6`, uygulamanın her yerdeki asıl aksiyon rengi — mor sadece satır ikonunda kaldı) "Gönder" butonu + sağ üstte `X` kapatma ikonu. Switch satırı `space-between` hizalandı, altına küçük gri "Geliştiricilerin sorunu çözmesine yardımcı olur." ipucu eklendi.

**Klavye sorunu:** `KeyboardAvoidingView behavior` iOS'ta `'padding'`, Android'de `'height'` yapıldı — `WriteCommentSheet.tsx`'teki (Madde ~30'lar civarı) aynı, daha önce kanıtlanmış düzeltme: Android'de `'padding'` Modal içinde çoğu cihazda çalışmayıp input'u klavye altında bırakıyordu.

**Yeni: `components/settings/LanguagePickerModal.tsx`** — aynı bottom-sheet deseninde, `locales/languageDetector.ts`'teki `SUPPORTED_LANGUAGES` dizisi üzerinden liste oluşturuyor (bayrak+isim `LANGUAGE_META` map'inden, eksikse otomatik 🌐+kod'a düşüyor). İleride 3. dil eklenince (SUPPORTED_LANGUAGES + resources.ts'e dosya eklemek yeterli, tek satırlık `LANGUAGE_META` girişi opsiyonel) liste otomatik büyür — eski "tek dokunuşla toggle" mantığı tamamen kaldırıldı.

**`TraktAccountSection.tsx`:** Bağlıyken gösterilen "Uygulamaya Git" satırı (+ `onGoToApp` prop'u, `Compass` ikonu, `SettingsRow`/divider'ı) tamamen kaldırıldı — bağlı durumda artık sade bir yeşil banner var.

**Metin güncellemeleri (`account.tsx` + `locales/*/settings.json`):** "🛠️ Tanılama" → "💬 Destek & Geri Bildirim" (aynı `diagnostics` anahtarı, sadece metni değişti), satır etiketi "Hata Bildir / Bize Ulaşın" → "Bize Ulaşın / Hata Bildir". `goToApp` (settings ns) çeviri anahtarı artık kullanılmadığından silindi.

**Yan bulgu — dil değiştirmeyi test ederken keşfedilen gerçek çeviri hatası:** "Uygulama Tercihleri" başlığı `t('appPreferences', ...)` çağırıyordu ama `appPreferences` anahtarı HİÇBİR locale dosyasında yoktu — İngilizce'ye geçince de hep Türkçe kalıyordu. "⚠️ Hesap Seçenekleri" ise `t()` içine hiç sarılmamış düz bir string'di (aynı şekilde hiç çevrilmiyordu); JSON'da bunun için zaten var olan ama hiçbir yerde kullanılmayan (`grep` ile doğrulandı) yetim `accountOptions` anahtarı (farklı bir emojiyle: ⚙️) fark edildi. İkisi de düzeltildi: `appPreferences` anahtarı iki dile de eklendi, `accountOptions`'ın emojisi koddaki gerçek ⚠️'e güncellenip `account.tsx`'te kullanılmaya başlandı.

**Doğrulama:** `tsc --noEmit` sıfır hata. Web preview'da: bottom-sheet doğru şekilde alttan açılıyor (grabber, yuvarlak köşeler, X butonu çalışıyor), input kenarlıksız/dolgun, switch + ipucu doğru hizalanmış, karakter sayacı doğru, "Gönder" butonu mesaj boşken soluk/disabled dolunca mavi/aktif. Dil seçici bottom-sheet açılıp İngilizce seçilince TÜM sayfa (yeni düzeltilen "Uygulama Tercihleri"/"Hesap Seçenekleri" dahil) doğru çevriliyor. **Doğrulanamayan (gerçek cihazda test edilmeli):** Android'de klavye açıldığında input'un gerçekten klavyenin üzerinde kalıp kalmadığı (kod `WriteCommentSheet`'teki kanıtlanmış desenle birebir aynı, ama bu spesifik ekranda cihazda görsel olarak doğrulanmadı).

## 62. Logo-Spinner (Thekaymak.png) Kaldırıldı, Tüm Uygulama Skeleton Yükleme Ekranlarına Geçti
**Talep:** Kullanıcı APK'da dönen `Thekaymak.png` logo-spinner'ını beğenmedi; "her uygulama gibi" daha alışılmış/bilindik bir iskelet (skeleton) yükleme deneyimine geçilmesini istedi — hem mobil hem web, uygulamanın TAMAMI için. Ayrıca genel yükleme hızının artırılmasını istedi.
**Keşif:** `components/LoadingIndicator.tsx` (dönen `Thekaymak.png`) **21 dosyada** import ediliyordu, ancak iki tamamen farklı amaçla:
1. Tam sayfa/bölüm "içerik yükleniyor" durumları (~10 yer: film/dizi/bölüm detay, keşfet, listeler, kütüphane, hata günlüğü, yorumlar).
2. Buton içi "işlem sürüyor" göstergeleri (~15 yer: "İzledim" butonu, listeye ekle, yorum gönder/sil, hesap sil, Trakt'a bağlan vb.) — bunlar an be an bir eylemin geri bildirimi, içerik placeholder'ı DEĞİL; skeleton buraya uygun değil. `LoadingIndicator`'ın kendi eski kod yorumu zaten "`color` prop'u `ActivityIndicator` ile API uyumluluğu için tutuldu" diyordu, yani bu ikinci grup React Native'in native `ActivityIndicator`'ına tek satırlık, risksiz bir değişimle geçebiliyordu.
**Çözüm — yeni skeleton primitifleri (`components/skeletons/`):**
- `DetailHeroSkeleton.tsx` — film/dizi/bölüm detay sayfası. Ölçüler `MediaHero`/`MediaCast`/`HorizontalMediaList`'teki GERÇEK değerlerle AYNI kaynaktan (backdrop 280, poster 110x165, cast/benzer kart genişliği ekran genişliğinin %28'i) — gerçek içerik geldiğinde layout sıçramaz. `hasPoster={false}` prop'uyla bölüm detay sayfasının poster'sız, tam genişlik "still" düzenine de uyarlanabiliyor (movie/show'daki yan yana poster+başlık yerine backdrop'un tam altına dikey başlık bloğu).
- `PosterGridSkeleton.tsx` — poster grid'i olan her ekran (mobil `LibraryMobile`, web `library/[type].web.tsx`, `ExploreWebGrid`) için tek, parametrik bileşen: sütun sayısı/genişlik/aralık çağıran ekranla AYNI kaynaktan geliyor. Web tarafında kart genişliği `calc()`/yüzde olduğundan sabit piksel yükseklik hesaplanamıyordu — bunun için `aspectRatio` prop'u eklendi (gerçek kartla aynı 2/3 oranı).
- `MediaRowSkeleton.tsx` — `ShowCard` tabanlı satır listeleri (keşfet mobil, liste detayı) için; varsayılan ölçüler `ShowCard.tsx`teki `card`/`posterContainer` (height 144, poster genişliği 96) ile AYNI.
- `CommentListSkeleton.tsx` — yorum listesi (avatar dairesi + iki metin satırı).
- `error-log.tsx` için ayrı bir bileşen açılmadı (tek kullanım yeri, medya değil düz metin satırları) — doğrudan mevcut `SkeletonLoader` primitifiyle inline kompoze edildi.
**Buton-içi göstergeler:** Kalan ~15 kullanım (`AddToListModal`, `CommentReplies`, `MyInlineComment`, `EpisodeOptionsModal`, `SeasonAccordion`, `ShowCard`, `WriteCommentSheet`, `TraktAccountSection`, `DeleteAccountModal`, `settings.tsx`, `movie/[id].tsx`, `episode/[id].tsx`, `list/[id].tsx`, `CommentSheet`/`ExploreWebGrid`/`explore.tsx`'teki "daha fazla yükleniyor" footer'ları) `react-native`'in native `ActivityIndicator`'ına çevrildi — sıfır görsel risk (aynı `size`/`color` prop'ları), sıfır ek maliyet (resim decode/rotate animasyonu yok).
**Silinenler:** `components/LoadingIndicator.tsx` ve `assets/images/Thekaymak.png` tüm importlar temizlendikten sonra silindi. `app.json`'daki native açılış ekranı (`expo.splash.image`) zaten `./assets/icon.png` kullanıyordu, Thekaymak'a hiç dokunmuyordu — değişmedi.
**Hız iyileştirmeleri:**
1. `context/AuthContext.tsx` — açılışta `SecureStore`'dan iki BAĞIMSIZ anahtar (`traktAccessToken`, `traktGuestMode`) sıralı `await` ile okunuyordu; `Promise.all` ile paralelleştirildi.
2. `app/(public)/index.web.tsx` — trend afişleri (`getShowPoster`/`getMoviePoster`) 20 öğe için sıralı `for` döngüsünde tek tek `await` ediliyordu; `Promise.all(...map(...))` ile paralelleştirildi.
3. **Bilinçli olarak dokunulmadı:** `services/library/fetchers.ts`'teki kasıtlı 150-500ms gecikmeler Trakt API rate-limit koruması (429 önleme) amaçlı — kaldırmak "yükleme hızı" değil fonksiyonel bir regresyon riski doğururdu.
**Doğrulama:** `tsc --noEmit` **0 hata** ile temiz derlendi (önceki oturumdaki `CommentItem.tsx`/`useShowDetail.ts`/`locales/` hataları kullanıcının bu konuşma öncesindeki değişiklikleriyle zaten giderilmiş). `grep -r LoadingIndicator` artık YALNIZCA silinen dosyanın kendisini buluyordu (silinmeden önce), silme sonrası sıfır kalıntı. Madde 59/61'deki yöntemle geçici bir test rotası (`app/dev-skeleton-test.tsx`) ile 4 yeni skeleton bileşeninin TAMAMI tarayıcıda gerçekten render edilip ekran görüntüsüyle doğrulandı (backdrop/poster/pill/cast satırları, 3 ve 6 sütunlu grid, medya satırı, yorum listesi — hepsi doğru oranlarda, animasyonlu pulse ile). Test rotası doğrulama sonrası silindi. **Kalan tek belirsizlik:** Trakt girişi bu sandbox'ta engelli olduğu için gerçek API verisiyle (mock değil) uçtan uca canlı test yapılamadı — gerçek cihazda/APK'da genel bir gözden geçirme önerilir.

## 63. Madde 62'nin Ardından: "Sabit Gri Kalıyor" Bug'ı — `SkeletonLoader`'da Animasyon Hiç Bağlanmamıştı
**Bulan:** Kullanıcı web'de "sayfalar yüklenirken garip bir bug oluyor, yüklenince geçiyor" dedi. Sorulan takip sorularıyla netleşti: metin/afiş yerleri gri KALIYOR (SABİT, hiç kımıldamıyor), 2-3 saniye sonra gerçek içerikle değişiyor.
**Kök neden:** Bu bug'ın kaynağı Madde 62'de eklenen yeni kod DEĞİL — `components/SkeletonLoader.tsx` (projede önceden var olan, `MoviesMobile`/`IndexMobile`/`ProfileMobile`/web `movies`/`shows` sekmelerinde zaten kullanılan primitif) baştan beri kırıktı: `useEffect` içinde bir `opacity` Animated.Value'su gerçekten `Animated.loop` ile animasyonlanıyordu, AMA bu `opacity` değeri `Animated.View`'in `style` dizisine HİÇ EKLENMEMİŞTİ. Animasyon arka planda "çalışıyordu" ama hiçbir görsel karşılığı yoktu — kutular hep aynı sabit `#3f3f46` (Zinc 700) renginde donuk duruyordu. Bu, önceden az sayıda ekranda (özellikle kısa süreli yüklemelerde fark edilmesi zor) gizli kalmış bir hataydı; Madde 62 `SkeletonLoader`'ı TÜM uygulamaya (özellikle 2-3 saniyeye kadar sürebilen film/dizi detay sayfalarına) yaydığı için artık HER SAYFADA görünür ve rahatsız edici hale geldi.
**Çözüm (`components/SkeletonLoader.tsx`):** `Animated.View`'in `style` dizisine `opacity` eklendi (`{ width, height, borderRadius, opacity }`). Tek satırlık değişiklik.
**Doğrulama:** Geçici bir test rotasıyla (`app/dev-skel-check.tsx`, doğrulama sonrası silindi) tek bir `SkeletonLoader` render edilip `getComputedStyle(el).opacity` 200ms aralıklarla 10 kez örneklendi — düzeltmeden ÖNCE sabit `1` (veya `0.3`, animasyon etkisiz) kalıyordu, düzeltmeden SONRA `0.31–0.69` aralığında gerçekten dalgalandığı ölçümle doğrulandı (`0.56 → 0.67 → 0.69 → 0.59 → 0.44 → 0.33 → 0.31 → 0.41 → 0.56 → 0.67`, ~1.6 saniyelik periyotla — kodun `duration: 800`×2 ayarıyla birebir uyumlu). `tsc --noEmit` 0 hata.
**Ders:** Skeleton primitifini TEK bir ekrana değil TÜM uygulamaya yayan bir refactor, o primitifteki gizli/az fark edilir hataları da orantısız şekilde büyütüp görünür kılabiliyor — bu yüzden "önceden var olan, dokunulmayan" bir bileşeni bile geniş çaplı bir yayılımdan önce bir kez daha gözden geçirmek değerliydi.

## 84. Yorum "5 Kelime" Uyarısının Netleştirilmesi + Misafirin Onay Kutusunu Atlayarak Trakt'a Bağlanabilmesi

**Bildiren:** Kullanıcı iki hata bildirdi: (1) yorum yazarken "5 karakter sınırı" olduğunu, 20 karakter yazsa bile gönderemediğini söyledi; (2) misafir kullanıcı ayarlardan Trakt'a bağlanmak istediğinde "Kullanım Koşulları'nı okudum" onay kutusuna hiç dokunmadan doğrudan giriş yapabildiğini söyledi.

**1. "Karakter sınırı" aslında 5 KELİME şartı (gerçek bir hata değil, netlik sorunu):** `WriteCommentSheet.tsx` ve `CommentReplies.tsx`'teki `wordCount < 5` kontrolü karakter değil KELİME sayıyor — bu, Trakt'ın kendi `POST /comments` uç noktasının gerçek sunucu-taraflı kuralı (en az 5 kelime, web araştırmasıyla doğrulandı: forums.trakt.tv/t/unable-to-comment). Yani kural kaldırılamaz — kaldırılırsa istek Trakt'tan 422 ile geri döner. Asıl sorun, hata mesajının belirsizliği: `min5WordsError` çevirisi yalnızca "Yorum çok kısa" diyordu, "kelime" kelimesini hiç geçmiyordu — kullanıcı bunu bir KARAKTER sınırı sandı (Türkçe'de az kelimeyle 20+ karakter yazmak kolay, örn. "Bu bölüm süperdi" = 3 kelime). **Çözüm:** `locales/{tr,en}/media.json`'daki `min5Words` ipucu metnine "(karakter değil)" eklendi, `min5WordsError` artık `{{count}}` interpolasyonuyla anlık kelime sayısını gösteriyor (örn. "En az 5 kelime yazmalısınız — şu an 3 kelime var."); `WriteCommentSheet.tsx`'e `wordErrorCount` state'i eklendi, `CommentReplies.tsx`'teki sabit Alert metni de aynı şekilde canlı sayaç içerecek şekilde güncellendi.

**2. Gerçek hata — misafir onay kutusunu atlayarak bağlanabiliyordu:** Madde 28'de iki ayrı ayarlar ekranı `(protected)/account.tsx` altında birleştirilmişti. `(public)/settings.tsx` (ilk giriş ekranı) "Kullanım Koşulları'nı okudum" onay kutusu işaretlenmeden "Trakt ile Giriş Yap" butonunu pasif tutuyordu — ama `account.tsx`'in kullandığı `components/settings/TraktAccountSection.tsx` (misafirin ayarlardan SONRADAN bağlanma yolu) bu onayı hiç istemiyordu; "Trakt'a Bağlan" butonu `onConnect`'i doğrudan, hiçbir onay kontrolü olmadan çağırıyordu. Yani misafir sözleşmeyi hiç okumadan/onaylamadan Trakt hesabını bağlayabiliyordu. **Çözüm (`TraktAccountSection.tsx`):** `(public)/settings.tsx`'teki ile birebir aynı desen taşındı — `isChecked`/`isLegalModalVisible` state'i, onay kutusu satırı (`Trans` ile tıklanabilir "Kullanım Koşulları" linki açan legal modal), "Trakt'a Bağlan" butonu artık `disabled={isConnecting || !canConnect || !isChecked}`. `legal` i18n namespace'i zaten `resources.ts`'te global kayıtlı olduğu için ek bir kayıt gerekmedi.

**Doğrulama:** `tsc --noEmit` 0 hata. **Doğrulanamayan:** Bu değişiklikler RN/Expo native ekranlarında (yorum sheet'i ve ayarlar sayfası web preview'da doğrudan çalıştırılamıyor — Trakt girişi bu ortamda engelli); gerçek cihazda/APK'da onay kutusu işaretlenmeden butonun gerçekten pasif kaldığı ve kelime sayacının doğru göründüğü görsel olarak teyit edilmeli.

## 85. Yorum Sistemi Tam Denetimi — 422 Hatasının Kök Nedeni + Web'de Sessizce Yutulan Tüm Hata Mesajları

**Bildiren:** Kullanıcı yorum gönderemediğini, konsolda `POST api.trakt.tv/comments 422` gördüğünü ve arayüzde HİÇBİR hata mesajı çıkmadığını bildirdi. "Sorunsuz bir yorum yazma kısmı olsun" (hem mobil hem web), ayrıca spoiler butonunun ve yorum akışının tamamen denetlenmesini istedi.

**Kök neden 1 — istemci kuralı ile sunucu kuralı uyuşmuyordu (422'nin sebebi):** Bir önceki maddede (84) istemci doğrulaması "en az 5 KARAKTER"e çevrilmişti. Ancak Trakt'ın sunucu tarafındaki gerçek kuralı **en az 5 KELİME** — kendi FAQ'ında açıkça yazıyor (forums.trakt.tv/t/what-are-the-rules-for-posting-comments/22155: yorumlar en az 5 kelime olmalı, 200 kelimeyi aşanlar otomatik "review" etiketlenir). Yani `aaaaa` (5 karakter, 1 kelime) istemciden geçiyor ama Trakt `422 Unprocessable Entity` ile reddediyordu. Bu kural sunucuda zorlandığı için istemcide GEVŞETİLEMEZ. **Çözüm:** doğrulama tek kaynağa (`utils/commentValidation.ts`) taşındı ve gönder butonu, istek Trakt tarafından KESİN kabul edilecek duruma gelene kadar pasif tutuluyor — böylece 422 kullanıcıya hiç ulaşmıyor.

**Kök neden 2 — web'de tüm hata mesajları sessizce yutuluyordu (KRİTİK):** `WriteCommentSheet`, `CommentReplies` ve `MyInlineComment` hâlâ ham `Alert.alert` kullanıyordu. Projede zaten `utils/confirmDialog.ts` var ve dosyanın kendi başlığı bu tuzağı belgeliyor: `react-native-web`'de `Alert.alert` **tam bir no-op** (`static alert() {}`). Sonuç: web'de 422 hatası, misafir uyarısı, "cevap gönderilemedi" gibi mesajların HİÇBİRİ görünmüyordu — kullanıcının "konsolda hata var ama ekranda hiçbir şey yok" gözlemi tam olarak buydu. Daha kötüsü: çok butonlu `Alert.alert` de no-op olduğu için **web'de yorum silme onayı hiç açılmıyor, yani yorum silinemiyordu**. Üç dosyadaki tüm çağrılar `notify` / `confirmAsync`'e çevrildi.

**Kök neden 3 — spoiler switch'i:** (a) `isSpoiler` varsayılanı `true` idi; kullanıcı hiç dokunmasa bile bu uygulamadan atılan HER yorum Trakt'ta "SPOILER" etiketiyle, diğer kullanıcılara bulanık gidiyordu. Trakt'ın kendi varsayılanıyla aynı olacak şekilde `false` yapıldı. (b) Sheet kapanırken hiçbir state sıfırlanmıyordu ve `loadMyComment`'in "yorum yok" dalında `isSpoiler` resetlenmiyordu — spoiler'lı yorumu olan bir medyayı açıp kapatıp yorumu olmayan başka bir medyaya geçince switch açık kalıyor, önceki yorumun metni de yeni veri gelene kadar ekranda duruyordu. `visible=false` olduğunda tam state reset eklendi.

**Diğer düzeltmeler:**
1. **Buton artık içeriğe göre pasif** — eskiden `disabled={sending}` idi, yani boş metinle bile basılabiliyordu (istek atılıp hata dönüyordu).
2. **Anlık ipucu satırı** — kullanıcı butonun NEDEN pasif olduğunu her an görüyor ("En az 5 kelime gerekli — şu an 3 kelime"). Eskiden geri bildirim yalnızca butona bastıktan SONRA 2 saniyeliğine çıkıyordu.
3. **422 mesajı düzeltildi** — `commentLengthError` ("Yorum çok uzun") gösteriliyordu; 422 neredeyse her zaman TAM TERSİ (çok kısa) anlamına geliyor. Yerine `commentRejectedError` eklendi, yetim kalan `commentLengthError` iki dilden de silindi.
4. **Servis katmanı hata gövdesini basmıyordu** — `console.error('...', error)` yalnızca AxiosError basıyordu; Trakt reddetme sebebini yanıt GÖVDESİNDE döndürdüğü için 422'nin sebebi görünmüyordu. `addComment`/`updateComment`/`addCommentReply` artık `error.response.status` + `error.response.data` basıyor.
5. **Switch çift-tetikleme riski** — spoiler `Switch`'i `TouchableOpacity` ile sarılmak üzereydi (switch'e dokunma hem switch'i hem sarmalayıcıyı tetikleyip değeri iki kez çevirebilir); bunun yerine yalnızca etiket metni ayrı dokunma hedefi yapıldı.
6. **i18n boşlukları** — `CommentReplies`'taki sabit Türkçe metinler ("Cevapları gizle", "Cevapla", "Çok Kısa", "Giriş Gerekli", placeholder) çeviri anahtarlarına taşındı; İngilizce'ye geçince artık gerçekten çevriliyorlar. Yeni `hideReplies`/`reply`/`replyPlaceholder` + 6 ipucu anahtarı iki dile de eklendi.
7. **Web'e özel cila** — sheet web'de ekranın tamamına yayılıyordu (`maxWidth: 680` + ortalama eklendi), `TextInput`'a web'de `outlineStyle: 'none'`, kapatma butonuna `hitSlop`.

**Mimari not:** Doğrulama mantığı `utils/commentValidation.ts`'te tek kaynakta toplandı (`AGENTS.md`: mantık UI'dan ayrılmalı). Daha önce aynı kural `WriteCommentSheet` ve `CommentReplies` içinde bağımsız kopyalanmış ve zamanla birbirinden SAPMIŞTI — 84. maddedeki karakter/kelime karışıklığının da asıl sebebi buydu. Dokunulan tüm dosyalar 400 satır sınırının altında (en büyüğü `WriteCommentSheet.tsx`, 382).

**Doğrulama:** `tsc --noEmit` 0 hata. Doğrulama mantığı izole bir Node betiğiyle test edildi: 16 senaryonun tamamı geçti (boş, sadece boşluk, `aaaa`, `aaaaa`, tek uzun kelime, 3/4 kelime, tam 5 kelime sınırı, fazladan boşluk/tab/newline, virgülle ayrılmış boşluksuz metin, emoji, MAX aşımı). Ayrıca **kritik güvence** ayrıca test edildi: "butonun aktif olduğu hiçbir girdi Trakt tarafından reddedilmemeli" — 16 senaryo + **20.000 rastgele girdide 0 uyumsuzluk**. Locale dosyaları JSON olarak parse edildi ve kodda referans verilen 27 anahtarın tamamının hem TR hem EN'de var olduğu, iki dosyada yetim/eksik anahtar kalmadığı betikle doğrulandı. **Doğrulanamayan:** Gerçek Trakt hesabıyla uçtan uca canlı gönderim (bu ortamda Trakt girişi engelli) — gerçek cihazda/APK'da ve web'de bir kez teyit edilmeli.

## 86. Yorumlara Sıralama/Filtreleme Eklendi — Popüler / En Yeni / En Eski

**İstek:** Kullanıcı yorumlar için "en çok beğenilen", "en yeni", "en eski" gibi bir sıralama filtresi istedi — hem web hem mobil.

**Keşif — altyapı zaten vardı, yalnızca UI eksikti:** `services/api/comments.ts`'teki `getMediaComments` zaten bir `sort: 'likes' | 'newest' | 'oldest'` parametresi alıp Trakt'ın `/comments/{sort}` uç noktasına doğrudan geçiriyordu (Trakt bu üç değeri destekliyor); `hooks/useComments.ts` da bunu zaten dışa açıyordu. Ama `CommentSheet.tsx` bunu hep sabit `sort: 'likes'` ile çağırıyordu — kullanıcıya sıralamayı değiştirecek hiçbir kontrol yoktu.

**Çözüm:**
1. **`hooks/useComments.ts`:** `CommentSort` tipi (`'likes' | 'newest' | 'oldest'`) dışa açıldı — tek kaynak, `CommentSheet` ve yeni bileşen buradan alıyor.
2. **Yeni `components/comments/CommentSortBar.tsx`:** Tek satırlık, 3 chip'lik bir sıralama çubuğu (Popüler/Flame, En Yeni/Clock, En Eski/History ikonlarıyla). `LibraryFilterModal`'daki çoklu-seçim + modal deseni BİLİNÇLİ olarak kullanılmadı — sıralama tek seçimli olduğu için (aynı anda yalnızca biri aktif) modal açmak gereksiz bir ekstra adım olurdu; tek dokunuşla anında değişen chip grubu tercih edildi. Web/mobil ayrımı gerekmedi — aynı bileşen ikisinde de çalışıyor (yalnızca web'de `cursor: 'pointer'` eklendi).
3. **`CommentSheet.tsx`:** `sort` state'i eklendi, `useComments`'e geçiliyor; sıralama değiştiğinde listenin yeniden çekilmesi için mevcut `loadComments` efektinin bağımlılık dizisine `sort` eklendi. Sheet kapanınca sıralama `'likes'`'a sıfırlanıyor (bir sonraki medyada önceki seçim sızmasın). Sıralama çubuğu yalnızca `totalCount > 0` iken gösteriliyor — ilk yükleme bitmeden veya boş durumda gösterip kullanıcıyı yanıltmasın; `totalCount` yalnızca başarılı fetch sonunda güncellendiği için sıralama DEĞİŞİRKEN de çubuk ekrandan kaybolup zıplamıyor.
4. **Yan temizlik:** Aynı dosyadaki iki sabit Türkçe metin (`"Yorumlar"` başlığı, `"Tekrar Dene"` butonu) zaten var olan `media:comments`/`common:retry` çeviri anahtarlarına bağlandı — İngilizce'de artık gerçekten çevriliyorlar.

**Doğrulama:** `tsc --noEmit` 0 hata. Bu ortamda Trakt/TMDB API'sine ağ erişimi TAMAMEN engelli (doğrulandı: `read_network_requests` sıfır istek gösterdi, gerçek uygulamada "Trendler yüklenemedi" / arama hatası çıktı — projenin kendi devre kesici/`CircuitBreaker` mekanizması bunu zaten karşılıyor, önceden bilinen bir sandbox kısıtı, bu değişiklikle ilgisiz). Bu yüzden gerçek yorum verisiyle uçtan uca test edilemedi; bunun yerine `CommentSortBar`'ı gerçek API'ye dokunmadan izole render eden geçici bir test rotası (`app/dev-comment-sort-test.tsx`) ile web preview'da gerçekten tıklanarak doğrulandı — 3 chip arasında geçiş sorunsuz, aktif/pasif stiller ve ikonlar (Flame/Clock/History) doğru, konsol hatasız. Test rotası doğrulama sonrası silindi. **Doğrulanamayan:** Gerçek Trakt yorumlarıyla uçtan uca sıralama davranışı (API'nin kendisi bu ortamda erişilemez durumda) — cihazda/APK'da bir kez teyit edilmeli.

## 87. Silinen Yorum Yeniden Yazılınca Eski Sürüm "Yorumlar" Listesinde Kalıyordu — Trakt CDN Önbelleği

**Bildiren:** Kullanıcı bir yorumu silip aynı yere yenisini yazdı. Trakt.tv'nin kendisinde her şey anlık ve doğru: eski yorum gitti, yenisi görünüyor. Uygulamanın "yorum yaz" kısmı da (`MyInlineComment`/`WriteCommentSheet`) doğru — yeni yorumu gösteriyor. Ama "Yorumlar" listesi (`CommentSheet`, herkesin gördüğü) hâlâ SİLİNMİŞ eski yorumu gösteriyordu. Kullanıcının haklı endişesi: bu pencerede başka bir kullanıcı o artık var olmayan yoruma cevap yazabilir veya beğenebilir.

**Kök neden:** Bu projede daha önce bir kez görülüp çözülmüş, aynı sınıftan bir hata (bkz. Madde 9 — o zamanki `temp_app` prototipinde). Trakt'ın CDN'i GET yanıtlarını agresif önbelliyor. `POST /comments` (yeni yorum) ve `DELETE /comments/{id}` (silme) Trakt'ta ANINDA işleniyor — bu yüzden `/users/me/comments/...` uç noktası (yazma kısmının kullandığı) doğru görünüyordu. Ama medyaya özgü liste uç noktası (`GET /shows/{id}/comments/{sort}` — "Yorumlar" sekmesinin kullandığı) CDN'de duran ESKİ bir sürümü döndürmeye devam edebiliyordu; bu önbellek dakikalarca sürebilir. Madde 9'daki `cb=${Date.now()}` çözümü, projenin `temp_app`'ten mevcut mimariye geçişinde (`services/api/comments.ts`'in yeniden yazılmasında) unutulup geri gelmemişti — repo genelinde artık HİÇBİR GET isteğinde cache-busting parametresi yoktu.

**Çözüm (`services/api/comments.ts`):** Paylaşımlı bir `cacheBustParam()` yardımcı fonksiyonu eklendi (`_=${Date.now()}`) ve yorumla ilgili DÖRT GET isteğine uygulandı: `getMediaComments` (asıl bildirilen hata — "Yorumlar" listesi), `getCommentReplies` (bir yorumun cevapları aynı sınıf sorunu yaşayabilirdi), `getUserComments` (şu an sorunsuz görünse de aynı savunma eklendi — "en stabil" istekle simetrik güçlendirme), `getEpisodeComments` (bölüm sayfasındaki yorum ön izlemesi, aynı uç nokta ailesi). Kapsam bilinçli olarak yalnızca `comments.ts`'e sınırlı tutuldu — bu proaktif olarak repo genelindeki HER GET isteğine yayılmadı (ratings/watchlist/history vb.), çünkü bildirilen sorun yalnızca yorumlarda gözlemlendi ve bu ortamda Trakt API'sine ağ erişimi engelli olduğu için geniş bir değişikliği canlı doğrulamak mümkün değildi — riski düşük tutmak için dar kapsam tercih edildi.

**İkinci endişe (silinmiş bir yoruma cevap/beğeni):** Cache-busting bu riski dramatik şekilde azaltıyor (önbellek penceresi dakikalardan, tek bir isteğin gidiş-dönüş süresine iniyor) ama TEORİK olarak tamamen sıfırlamıyor — biri bir yorumu tam olarak başka biri ekranında açıkken silerse, o kısa an içinde cevap denemesi Trakt'tan `404` döner. Bu, herhangi bir sosyal platformda (Instagram, Reddit vb.) var olan, kaçınılmaz bir "eventual consistency" yarışı — `CommentReplies.tsx`'teki `handleSendReply` zaten bunu genel bir hata mesajıyla (`common:replyError`) yakalayıp kullanıcıya bildiriyor, bu davranış yeterli kabul edildi; ek bir "yorum silindi, listeyi yenile" UX'i bu maddenin kapsamı dışında bırakıldı (mevcut hiçbir yerde gerçek bir "beğen" butonu da yok — `CommentItem.tsx` yalnızca beğeni SAYISINI gösteriyor, aksiyon yok).

**Doğrulama:** `tsc --noEmit` 0 hata. Bu ortamda Trakt API'sine ağ erişimi engelli olduğu için gerçek bir sil+yeniden yaz döngüsüyle uçtan uca doğrulanamadı — değişiklik yalnızca dört GET isteğinin URL'sine parametre eklemekle sınırlı, mevcut davranışı bozma riski düşük. **Cihazda/APK'da bir kez teyit edilmeli:** yorum sil → aynı yere yeniden yaz → "Yorumlar" sekmesini kapatıp tekrar aç → eski yorumun artık görünmediği, yenisinin göründüğü doğrulanmalı.

## 88. Web'de Giriş Tamamen Kilitlenmişti — Trakt Proxy URL'i Build Anında Yanlış Gömülüyordu (CORS)

> ⛔ **BU MADDE YANLIŞ TEŞHİSE DAYANIYOR — UYGULANAN DEĞİŞİKLİK MADDE 91'DE GERİ ALINDI.**
> Buradaki "üretim sunucusunun CORS politikası `localhost` origin'ini tanımıyor" çıkarımı HATALIDIR:
> `server.js` `app.use(cors())` ile TÜM origin'lere izin veriyor. Gerçek sebep, API'yi barındıran
> makinenin (Raspberry Pi) o sırada KAPALI olmasıydı — kapalı sunucu yerine cevap veren katman
> CORS başlığı göndermediği için tarayıcı bunu CORS hatası olarak raporluyordu. Aşağıdaki metin
> tarihsel kayıt olarak bırakıldı; uygulanabilir bilgi için Madde 91'e bakın.

**Bildiren:** Kullanıcı `localhost:4830`'da bir haftadır sorunsuz test ederken aniden Trakt girişi kırıldı. Konsol: `Access to XMLHttpRequest at 'https://kaymaktv.com/api/trakt' from origin 'http://localhost:4830' has been blocked by CORS policy`. Soru: "az önce yaptığımız bir şey mi engelledi?"

**Teşhis — bu oturumun DEĞİL, bir build'in eseri olduğu kanıtlandı:** `git diff HEAD -- services/api/auth.ts server.js` boş döndü — bu oturumda (ve önceki hiçbir committen sonra) bu dosyalara dokunulmamış. `.env`'in son değişikliği 24 Temmuz 21:38 (2 gün önce). Ama `server.js`'in port 4830'da servis ettiği **statik `dist/` build'i** 26 Temmuz 03:56'da (bugün) yeniden derlenmiş — ve kullanıcının hata log'undaki bundle dosya adı (`entry-3f8e488685bde16e85f8e97eeca980bd.js`) bu yeni build'teki dosyayla birebir eşleşiyor. Bu oturumda hiçbir `expo export`/build komutu çalıştırılmadı (yalnızca `tsc --noEmit` ve `dist/`'e hiç yazmayan ayrı bir Metro dev sunucusu) — yani bugünkü yeniden derleme bu konuşmanın dışında bir yerde tetiklenmiş.

**Kök neden — gerçek bir hata, `services/api/auth.ts`'te:** `EXPO_PUBLIC_API_URL` çalışma anında değil, DERLEME anında JS bundle'ının içine gömülüyor. `TRAKT_PROXY_URL` şu ana kadar yalnızca bu değişkenin var/yok olduğuna bakıyordu, `Platform.OS`'a hiç bakmıyordu — kodun kendi yorumu niyeti doğru anlatıyordu ("Web'de aynı origin, göreli yol yeterli") ama bunu uygulamıyordu. `.env`'de native build için gerekli olan `EXPO_PUBLIC_API_URL=https://kaymaktv.com` tanımlı olduğu sürece, web build'i de mutlak üretim adresine gidiyordu. Önceki `dist/` build'i muhtemelen bu değer `.env`'e eklenmeden ÖNCE derlenmiş olduğu için göreli yolu koruyordu (bir haftadır sorunsuz çalışmasının sebebi); bugünkü yeniden derleme ilk kez güncel `.env`'i bundle'a gömüp mutlak URL'e (ve dolayısıyla üretim sunucusunun `localhost` origin'ini tanımayan CORS politikasına) çarptı.

**Çözüm (`services/api/auth.ts`):** `TRAKT_PROXY_URL` artık `Platform.OS !== 'web' && process.env.EXPO_PUBLIC_API_URL` kontrolü yapıyor — `services/tmdbApi.ts`'deki (`isWeb = Platform.OS === 'web'`) zaten doğru çalışan desenle birebir aynı. Web'de artık `.env`'de ne olursa olsun HER ZAMAN göreli `/api/trakt` kullanılıyor; mutlak URL yalnızca native'de devreye giriyor.

**Build yeniden alındı:** `npx expo export -p web` çalıştırıldı (yeni bundle: `entry-413a99aa4e98dc4314fd4d9c480c3340.js`). Doğrulama: yeni bundle'da `kaymaktv.com` ile `/api/trakt` hiçbir yerde birleşmiyor (`grep` ile teyit edildi — kalan 3 `kaymaktv.com` eşleşmesi tamamen ilgisiz, sosyal paylaşım linkleri: `kaymaktv.com/{show|movie|episode}/...`). `server.js` yeniden başlatılmasına gerek yok (statik dosyaları diskten canlı okuyor); tarayıcıda sayfa yenilenmesi yeterli (bundle dosya adı zaten değişti, eski önbellekle karışmaz).

**Ders:** `EXPO_PUBLIC_*` değişkenleri build-time'da gömülüyor — bir `.env` değişikliği, `dist/` yeniden derlenene kadar HİÇBİR ÇALIŞAN build'i etkilemez; tersine, kaynak kodda hiçbir şey değişmese bile salt `dist/`'i yeniden derlemek, aradan geçen zamanda `.env`'e sessizce eklenmiş bir değeri ilk kez devreye sokup görünürde "hiçbir şey değişmemişken" davranışı kırabilir. `tsc --noEmit` 0 hata.

## 89. Misafir Profil Sekmesini Açınca Sessizce Misafir Modundan Atılıyordu — `useMyTraktProfile` Koruma Eksikliği

**Bildiren:** Kullanıcı hata günlüğünde şu kaydı buldu: `{"context":"traktClient.401.noRefreshToken","message":"Request failed with status code 401","tags":{"endpoint":"/users/me"}}` (25 Temmuz 15:37).

**Kök zincir — koddan birebir izlendi:**
1. `hooks/useMyTraktProfile.ts` — `getUserProfile('me')`'i (`/users/me`) `useEffect(..., [])` içinde, `isGuest`/`accessToken` kontrolü YAPMADAN, mount olur olmaz çağırıyordu.
2. Bu hook hem `screens/ProfileMobile.tsx` (satır 73) hem `app/(protected)/(tabs)/profile.web.tsx` (satır 59)'da, render gövdesindeki `if (!accessToken || isGuest) return <LoginPaywall/>` kontrolünden ÖNCE çağrılıyor — React hook kuralları gereği hook'lar koşulsuz en üstte olmak zorunda, yani bu erken-dönüş hook'un ateşlenmesini ENGELLEYEMİYOR.
3. Bir misafir (token yok) Profil sekmesini açtığında `/users/me` isteği Authorization header'sız gidiyor → Trakt `401` döndürüyor.
4. `services/api/traktClient.ts`'in 401 yakalayıcısı SecureStore'da `traktRefreshToken` arıyor — misafirde zaten hiç yok → `noRefreshToken` dalına düşüp `logError('traktClient.401.noRefreshToken', ...)` ile günlüğe yazıyor (kullanıcının bulduğu tam olarak bu) ve `notifySessionExpired()` çağırıyor.
5. `context/AuthContext.tsx`'teki `onSessionExpired` dinleyicisi `setAccessToken(null); setIsGuest(false)` yapıyor — **misafiri doğrudan misafir modundan atıp giriş ekranına düşürüyordu**, oysa hiçbir "oturum" hiç var olmamıştı.

Aynı proje içinde zaten DOĞRU yazılmış bir emsal vardı — `features/feed/hooks/useFeedPrivacy.ts` aynı `/users/me` çağrısını `if (!accessToken || isGuest) { setIsLoading(false); return; }` koruması ARDINDAN yapıyordu. `useMyTraktProfile.ts` bu deseni takip etmiyordu.

**Çözüm (`hooks/useMyTraktProfile.ts`):** `useFeedPrivacy.ts` ile birebir aynı koruma taşındı — `useAuth()`'tan `accessToken`/`isGuest` okunup efektin başına `if (!accessToken || isGuest) { setIsLoading(false); return; }` eklendi, bağımlılık dizisi `[accessToken, isGuest]` yapıldı. Bu ayrıca AuthContext'in SecureStore'dan token'ı ASENKRON okuduğu ilk anlarda (henüz `accessToken` state'ine ulaşmamışken) da aynı sınıf yarış durumunu (race condition) örtük olarak kapatıyor — efekt artık gerçek `accessToken` değeri gelene kadar hiç ateşlenmiyor, geldiğinde de bağımlılık değiştiği için otomatik yeniden çalışıyor.

**Doğrulama:** `tsc --noEmit` 0 hata. Web preview'da CANLI test edildi: misafir olarak devam edilip Profil sekmesine tıklandı — "Misafir Erişimi / Profilinizi görmek için giriş yapın" ekranı doğru göründü, `read_network_requests` ile `/users/me`'ye SIFIR istek gittiği doğrulandı, konsolda 401/"Oturum süresi doldu" uyarısı çıkmadı ve kullanıcı misafir modunda kaldı (giriş ekranına atılmadı). `npx expo export -p web` ile `dist/` yeniden derlendi (yeni bundle: `entry-b5fcc58d19f246c56c116920b89c40bd.js`) ki `server.js`'in servis ettiği build de düzeltmeyi içersin (bkz. Madde 88 — `EXPO_PUBLIC_*`'in build-time gömülmesiyle aynı ders, ama bu kez düzeltilen kod runtime'da okunan bir React state kontrolü olduğu için build-time'a bağımlı değil; yine de tutarlılık için build tazelendi).

**Kapsam dışı bırakılan, benzer ama düşük riskli bir kod yolu:** `features/feed/hooks/useUserSearch.ts`'teki `getUserProfile(username)` çağrısı da bir guard içermiyor, ama bu hook yalnızca kullanıcının açıkça tetiklediği bir arama eylemiyle (`search()`) çalışıyor — mount anında OTOMATİK ateşlenmiyor, ve barındığı `FollowSearchModal` zaten yalnızca giriş yapmış kullanıcılara gösteriliyor (Madde 82'de belgelendiği gibi feed ekranları misafir için ayrı bir davet gösteriyor). Bu yüzden aynı "misafiri mount'ta atma" riski taşımıyor; bu maddenin kapsamına dahil edilmedi.

## 90. Giriş Tamamen Kırıktı — Kök Neden: Uygulama `node server.js` Yerine `npx serve` ile Sunuluyordu + Sessiz Yutulan Hata

**Bildiren:** Kullanıcı misafir modunda takılı kaldığını, hiçbir şekilde giriş yapamadığını bildirdi. Trakt'taki yönlendirme adresi doğruydu (`http://localhost:4830/settings`) ve sorunun "misafirler ayarlardan giriş yapabilsin" özelliğiyle başladığını düşünüyordu.

**Kök neden 1 — ORTAM (asıl engel, canlı olarak kanıtlandı):** `localhost:4830`'da dinleyen sürecin komut satırı incelendi:
`serve -s dist -l 4830` — yani `npx serve`, **saf statik dosya sunucusu**. Oysa `/api/trakt` (Trakt token değişim proxy'si) YALNIZCA `server.js` (Express) tarafından sunuluyor. Tarayıcıdan atılan sondayla doğrulandı: `serve` üzerinde hem `POST /api/trakt` hem `GET /api/tmdb` **HTTP 200 + `text/html`** (SPA fallback'inin `index.html`'i) döndürüyordu. Karşılaştırma için `node server.js` ayrı bir portta çalıştırıldı ve aynı sonda **gerçek Trakt yanıtını** verdi: `{"error":{"error_description":"invalid code","error":"invalid_grant"}}` (`application/json`, 400) — yani proxy çalışıyor, secret doğru okunuyor, Trakt'a gerçekten ulaşıyor. Tek fark hangi sunucunun çalıştığı. Madde 88'de düzeltilen CORS hatası bu katmanı MASKELİYORDU: istek üretim alan adına gidip CORS'a takıldığı için `serve`'ün HTML döndürdüğü hiç görülememişti.

**Kök neden 2 — KOD (hatayı görünmez yapan):** `app/(public)/settings.tsx`'te
`const tokenData = await exchangeAuthCode(...); if (tokenData && tokenData.access_token) { ...kaydet, yönlendir... }` — ve bu `if`'in **`else`'i YOKTU**. HTML yanıtında `access_token` bulunmadığı için blok hiç çalışmıyor, hiçbir istisna fırlamıyor, hiçbir mesaj gösterilmiyordu: token kaydedilmiyor, yönlendirme olmuyor, kullanıcı sebebini göremeden misafir kalıyordu. Üstüne `catch` içindeki `Alert.alert` de react-native-web'de TAM NO-OP (bkz. Madde 85) — yani gerçek bir hata olsa bile web'de görünmeyecekti.

**Kök neden 3 — MİMARİ (kullanıcının sezgisi doğruydu):** "Misafirler ayarlardan giriş yapabilsin" özelliği, `app/(protected)/account.tsx` içine `(public)/settings.tsx`'tekinin neredeyse birebir KOPYASI ikinci bir OAuth implementasyonu koymuştu (`useAuthRequest` + `makeRedirectUri` + `handleTokenExchange` + iki yakalayıcı efekt). Bu yapısal olarak kırılgandı: Trakt'a kayıtlı yönlendirme adresi TEK bir yola (`/settings`) işaret ettiği için, giriş `/account`'tan başlatılsa bile Trakt kodu `/settings`'e geri gönderiyordu — akışı başlatan ekranla kodu yakalayan ekran FARKLIYDI. Ayrıca iki yakalayıcının aynı **tek kullanımlık** kodu iki kez değişmeye çalışıp `invalid_grant` üretme riski vardı.

**Çözüm:**
1. **Tek giriş noktası (kullanıcının önerdiği yön):** `account.tsx`'ten TÜM OAuth makinesi silindi (`AuthSession`, `WebBrowser`, `exchangeAuthCode`, `redirectUri`, `handleTokenExchange`, iki efekt, `isConnecting` state'i). `TraktAccountSection` artık yalnızca giriş ekranına yönlendiren bir "Giriş Yap" butonu. OAuth kodu artık repoda TEK yerde: `app/(public)/settings.tsx`. Bunun bir yan faydası: Madde 84'te misafirin atlayabildiği "Kullanım Koşulları" onayı artık yapısal olarak tek noktada zorlanıyor (ayarlarda ayrı bir onay kutusu tutmaya gerek kalmadı, o da silindi).
2. **Savunmacı doğrulama (`services/api/auth.ts`):** Yeni `parseTokenResponse` yardımcı fonksiyonu yanıtı denetliyor — HTML geldiyse `AUTH_PROXY_MISSING` (mesajın kendisi çözümü söylüyor: "`node server.js` ile çalıştırın"), `access_token` yoksa `AUTH_NO_TOKEN` fırlatıyor. Artık sessiz başarısızlık İMKÂNSIZ. `refreshTraktToken` de aynı doğrulamayı kullanıyor.
3. **Görünür hata + çift-değişim koruması (`(public)/settings.tsx`):** Tüm `Alert.alert` çağrıları web-güvenli `notify`'a çevrildi; hata türüne göre ayrı mesaj gösteriliyor. `exchangedCodeRef` ile bir kodun yalnızca bir kez değişilmesi garanti altına alındı. Trakt'ın `?error=access_denied` ile dönüşü de artık okunuyor (eskiden tamamen yok sayılıyordu).
4. **Ölü kod temizliği (istendiği gibi acımasızca):** `(public)/settings.tsx`'te hiç çağrılmayan `handleLogout` + kullanılmayan `accessToken`/`removeKeys` bağlamaları, kullanılmayan `loggedInContainer`/`loggedInText` stilleri silindi. Yetim çeviri anahtarları (`connectWithTrakt`, `loginSuccessText`, `loggedInText`) 4 locale dosyasından kaldırıldı. Kodun `t('common:close', 'Kapat')` ile çağırdığı ama hiçbir dosyada var olmayan `common:close` anahtarı eklendi (İngilizce'de "Kapat" görünüyordu).
5. **400 satır kuralı:** `(public)/settings.tsx` 492 satıra çıkmıştı. İki bağımsız blok ayrı bileşenlere çıkarıldı: `components/settings/LegalTermsModal.tsx` (bir dönem `TraktAccountSection`'da da KOPYALANMIŞTI) ve `components/settings/LanguageMenuModal.tsx` (diller artık elle kodlanmak yerine `SUPPORTED_LANGUAGES`'ten geliyor — üçüncü bir dil eklenince bu ekran sessizce eksik kalmayacak). Dosya 407 satıra indi; dokunulan diğer tüm dosyalar sınırın altında.

**Doğrulama (canlı, tarayıcıda):** `tsc --noEmit` 0 hata. `serve` vs `server.js` farkı sondayla kanıtlandı (yukarıda). Düzeltme sonrası `/settings?code=TEST` ile sahte bir OAuth dönüşü simüle edildi: konsolda artık tam teşhis görünüyor (`AUTH_PROXY_MISSING: ... Giriş için node server.js ile çalıştırın`) — eskiden hiçbir iz yoktu. Ayarlar ekranı misafir olarak açıldı: OAuth'suz, sade "Giriş Yap" butonu doğru render oluyor ve tıklanınca giriş ekranına (sözleşme onay kutusuyla) götürüyor. Refactor sonrası giriş ekranı ve ayrılan dil menüsü görsel olarak doğrulandı (menü açılıyor, aktif dil vurgulu). `dist/` yeniden derlendi.

**KULLANICI İÇİN KRİTİK:** Giriş yapabilmek için uygulama `node server.js` ile sunulmalıdır (`npx serve` ile DEĞİL). `package.json`'daki `serve` script'i yalnızca statik önizleme içindir ve Trakt girişini ÇALIŞTIRAMAZ — çünkü token proxy'sini barındırmaz.

**Ders:** Bir kimlik doğrulama akışında "yanıt beklediğim gibi değilse sessizce hiçbir şey yapma" deseni (`if (ok) {...}` + `else` yok) hatayı yok etmez, yalnızca GÖRÜNMEZ kılar — ve teşhisi saatlerce imkânsızlaştırır. Beklenmeyen her yanıt biçimi açıkça istisna fırlatmalı.

## 91. Madde 88'in Geri Alınması — Giriş Sorununun Gerçek Sebebi: API Makinesi (Raspberry Pi) Elektrik Kesintisinde Kapanmış

**Bağlam:** Kullanıcı, günlerdir süren giriş sorununun gerçek sebebini buldu: bu kurulumda API'yi bir **Raspberry Pi** üzerindeki `node server.js` süreci sunuyor (`EXPO_PUBLIC_API_URL=https://kaymaktv.com`). O gün elektrik kesilmiş, Pi kapanmış, dolayısıyla `/api/trakt` proxy'si erişilemez hale gelmişti. Uygulamanın kendisi ise yerelde **statik** olarak (`serve -s dist`) sunuluyor — yani mimari bilinçli olarak "statik istemci + ayrı makinede API" şeklinde.

**Madde 88'in yanlış olduğu nasıl kanıtlandı (canlı ölçüm, tahmin değil):**
1. `server.js` incelendi: `app.use(cors())` — hiçbir origin kısıtı YOK, `localhost` dahil her origin'e izin veriyor. Yani Madde 88'in "üretim CORS'u localhost'u reddediyor" varsayımı en baştan yanlıştı.
2. Pi geri açıldıktan sonra tarayıcıdan `http://localhost:4830` origin'i ile `https://kaymaktv.com/api/trakt`'a sonda atıldı: istek **CORS'a takılmadan geçti** ve Trakt'ın gerçek yanıtını döndürdü — `{"error":{"error_description":"invalid code","error":"invalid_grant"}}`, `application/json`, 400. Bu, cross-origin çağrının en başından beri sorunsuz çalıştığının kesin kanıtı.
3. Sonuç: Madde 88'de görülen "No 'Access-Control-Allow-Origin' header" hatası bir CORS YAPILANDIRMA sorunu değildi. Sunucu kapalıyken isteğe cevap veren katman (Cloudflare/yönlendirici hata sayfası) CORS başlığı göndermediği için tarayıcı hatayı CORS diliyle raporluyordu — klasik bir yanlış yönlendiren hata mesajı.

**Geri alınan değişiklik (`services/api/auth.ts`):** Madde 88'de eklenen `Platform.OS !== 'web'` koşulu KALDIRILDI, orijinal mantık geri getirildi:
`EXPO_PUBLIC_API_URL` tanımlıysa mutlak adres, değilse göreli `/api/trakt`. O koşul bu mimariyi aktif olarak KIRIYORDU: web'i göreli yola zorlayarak isteği, proxy'si olmayan yerel statik sunucuya (`serve`) yönlendiriyordu — yani Pi geri gelse bile giriş çalışmayacaktı. Kodun başına, aynı hatanın tekrarlanmaması için açık bir uyarı yorumu eklendi ("BU KOŞULA `Platform.OS` KONTROLÜ EKLEMEYİN" + gerekçe).

**Korunan iyileştirmeler (bunlar doğruydu, dokunulmadı):** Madde 90'daki tek giriş noktası mimarisi (OAuth artık yalnızca `(public)/settings.tsx`'te), `Alert.alert` → web-güvenli `notify` dönüşümü, `exchangedCodeRef` ile çift-değişim koruması, yanıt doğrulama (`parseTokenResponse`) ve ölü kod temizliği.

**`AUTH_PROXY_MISSING` mesajı gerçek senaryoya göre düzeltildi:** Eskiden "uygulama statik sunucuyla servis ediliyor, `node server.js` ile çalıştırın" diyordu — bu kurulumda YANILTICI, çünkü uygulamanın statik sunulması DOĞRU ve kasıtlı; sorun API makinesinin ayakta olmaması. Yeni metin: "Trakt token uç noktası JSON yerine HTML döndürdü. Bu genellikle API sunucusunun ÇALIŞMADIĞI anlamına gelir — makinenin açık ve sürecin ayakta olduğunu kontrol edin." (`loginProxyMissing` çevirisi de iki dilde güncellendi.)

**Doğrulama (uçtan uca, gerçek altyapıyla):** `tsc --noEmit` 0 hata. Yeniden derlenen bundle'da mutlak Pi adresinin geri geldiği `grep` ile teyit edildi (`kaymaktv.com/api/trakt`). Tarayıcıda sahte bir OAuth dönüşü (`/settings?code=FINALTEST`) simüle edildi ve konsol tüm zinciri kanıtladı: istek Pi'ye ulaştı (**HTTP 400**, HTML değil) → Pi Trakt'a iletti → Trakt sahte kodu `invalid_grant` ile reddetti → hata `catch`'e düştü → kullanıcıya `notify` ile uyarı gösterildi (`Page dialog suppressed (alert): "Hata — Trakt ile iletişim kurarken bir hata oluştu."`). Yani hem ağ yolu hem de Madde 90'da eklenen "sessiz hata olmasın" güvencesi gerçek altyapıyla çalışır durumda. **Kalan tek doğrulanmamış adım:** gerçek bir Trakt kodu ile başarılı giriş (gerçek bir OAuth onayı gerektiriyor) — ama zincirin Trakt'a kadar olan tüm halkaları kanıtlandığı için bunun çalışmaması için bir sebep yok.

**Token/sır saklama yerleri (kullanıcının sorusu üzerine, referans için):**
- **Trakt Client Secret:** Pi'deki `.env` dosyasında `TRAKT_CLIENT_SECRET` (bilinçli olarak `EXPO_PUBLIC_` önekSİZ, böylece istemci bundle'ına asla gömülmez). `server.js` okur, satır ~83.
- **Kullanıcının access/refresh token'ları:** `utils/secureStorage.ts` üzerinden — native'de `expo-secure-store` (şifreli keychain), web'de `localStorage`. Anahtarlar: `traktAccessToken`, `traktRefreshToken`, `traktGuestMode`.

**Ders:** "CORS hatası" mesajı çoğu zaman CORS yapılandırmasını değil, karşı tarafın ERİŞİLEMEZ olduğunu gösterir — çünkü ölü bir origin'e giden istekte hata sayfasını dönen ara katman CORS başlığı eklemez. Bir CORS hatasına yapılandırma düzeltmesiyle yanıt vermeden ÖNCE, hedef sunucunun gerçekten ayakta olduğu bağımsız olarak (curl/sonda) doğrulanmalı. Bu doğrulama yapılmadığı için Madde 88'de çalışan bir mimari "düzeltilmeye" çalışıldı.

## 92. Auth Zinciri Stabilizasyon Denetimi + İlk Senkronizasyon Göstergesi

**Bağlam:** Kullanıcı, art arda gelen auth düzeltmelerinden (Madde 88-91) sonra iki aşamalı bir görev istedi: (1) son değişikliklerde gözden kaçmış mantık hatası/ölü kod varsa temizlemek ve sistemin stabil olduğundan emin olmak, (2) ilk girişte Trakt verisi çekilirken ekranların "sapıtmış" görünmesini önleyecek bir "senkronize ediliyor" göstergesi eklemek.

**Faz 1 — Stabilizasyon denetimi:** `auth.ts`, `AuthContext.tsx`, `(public)/settings.tsx`, `(protected)/account.tsx`, `TraktAccountSection.tsx`, `LegalTermsModal.tsx`, `LanguageMenuModal.tsx`, `traktClient.ts`, `useSettings.ts`, `useMyTraktProfile.ts`, `useFeedSyncTrigger.ts` tek tek okunup denetlendi. İki gerçek (küçük) hata bulundu:
1. **Ölü CSS:** `(public)/settings.tsx`'te `modalOverlay`/`langMenu*` (7 stil) — Madde 90'da dil menüsü `LanguageMenuModal.tsx`'e çıkarılırken JSX taşınmış ama eski stil tanımları silinmemişti. Silindi (407→369 satır).
2. **Eksik i18n:** `useSettings.ts`'teki `logoutError`/`deleteAccountError` hiçbir locale dosyasında yoktu, kod sabit Türkçe bir `defaultValue`'ya düşüyordu (İngilizce modda bile Türkçe görünürdü). İki dile de eklendi.

Geri kalan her şey (tek OAuth giriş noktası, 401/refresh-token interceptor mantığı, misafir korumaları, rota kalıpları, i18n TR/EN senkronu) sağlam bulundu. `tsc --noEmit` 0 hata.

**Faz 2 — `SyncStatusBanner`:**
**Keşif:** `store/useLibraryStore.ts`'teki `isLoading`/`isMoviesLoading` bayrakları zaten global senkron durumunu tutuyordu (Tier 1: diziler/izleme listesi/takvim, Tier 2: filmler/istatistik) ama hiçbir yerde kullanıcıya gösterilmiyordu — ekranlar bu bayraklara bakmadan doğrudan (boş) veriyi render ediyordu.

**⚠️ Bulunan tuzak (uygulanmadan önce yakalandı):** `context/LibraryContext.tsx`'teki `LibraryProvider`, `loadCache`/`fetchFreshData` zincirini yalnızca `accessToken` doluyken tetikliyor (`if (accessToken && !authIsLoading)`). Misafir oturumunda bu zincir HİÇ ÇALIŞMADIĞI için `isLoading`/`isMoviesLoading` store'un başlangıç değerinde (`true`) SONSUZA DEK takılı kalıyor. Banner doğrudan bu bayraklara bağlansaydı her misafirde kalıcı olarak ekranda asılı kalırdı — bu, `useLibrarySyncStatus` hook'unda `!!accessToken && !isGuest` koruması eklenerek önlendi.

**Yeni dosyalar:**
- `hooks/useLibrarySyncStatus.ts` — tek gerçek kaynak: `accessToken`/`isGuest`'i `isLoading`/`isMoviesLoading` ile birleştirip tek bir `isSyncing` boolean'ı döndürür.
- `components/SyncStatusBanner.tsx` — üstte, safe-area'ya oturan, dokunuşları engellemeyen (`pointerEvents="none"`) bir "pill" gösterge. `Snackbar.tsx`'teki (300ms, `Animated.timing`, `useNativeDriver: Platform.OS !== 'web'`) animasyon diliyle tutarlı. İki ekstra ince ayar: (1) **350ms gösterme gecikmesi** — cache'ten anında dolan (TTL geçerli) açılışlarda banner GÖZ KIRPMASIN diye; senkron bu süreden önce biterse zamanlayıcı iptal edilir, banner hiç render edilmez. (2) Bitince 280ms'lik fade+slide ile "pürüzsüzce" kaybolur.
- `app/(protected)/_layout.tsx`'e TEK mount noktası olarak eklendi (`<Stack>` bir `<View style={{flex:1}}>` içine alınıp `<SyncStatusBanner/>` sibling olarak eklendi) — tüm sekmelerin/ayarların/hata günlüğünün üzerinde, ek bir entegrasyon gerekmeden çalışır.
- `common.json` (tr/en) → `syncInProgress` anahtarı.

**Doğrulama (web preview'da, gerçek store canlı manipüle edilerek — Trakt API'sine dokunmadan):** Geçici bir test rotasıyla (`app/dev-sync-banner-test.tsx`, doğrulama sonrası silindi) dört senaryo tek tek tetiklendi ve ekran görüntüsüyle kanıtlandı:
1. Kimliği doğrulanmış + `isLoading=true` → banner doğru görünüyor (spinner + "Verileriniz senkronize ediliyor..." metni, üstte ortalanmış pill).
2. `isLoading`/`isMoviesLoading` false olunca → banner pürüzsüzce kayboluyor.
3. **Kritik test:** `isGuest=true` + `isLoading=true` (elle zorlanmış) → banner HİÇ görünmüyor (yukarıdaki tuzak koruması doğrulandı).
4. 150ms'lik "hızlı yükleme" simülasyonu (350ms eşiğin altında) → banner hiç yanıp sönmedi.

`tsc --noEmit` 0 hata. `npx expo export -p web` ile `dist/` yeniden derlendi. **Doğrulanamayan:** Gerçek bir Trakt hesabıyla ilk girişte banner'ın gerçek network gecikmesiyle (350ms'den uzun sürecek şekilde) görünüp gerçek veri gelince kaybolması — bu ortamda Trakt API'sine ağ erişimi engelli; cihazda/APK'da bir kez teyit edilmeli.

## 94. Akış Gizlilik Anahtarları Denetimi + "Hesabı Sil" Aslında Hiçbir Sunucu Verisini Silmiyordu

**Bağlam:** Kullanıcı iki ayrı denetim istedi: (1) Ayarlar → "💬 Akış" bölümündeki 3 anahtarın ("Aktivitemi Akışta Gizle" + iki alt anahtar) mantığının sağlam olduğunu doğrulamak, (2) "Hesabı Sil" butonunun KaymakTV'nin sakladığı HER veriyi (Supabase dahil) gerçekten silip silmediğini, Trakt hesabına hiç dokunmadığını doğrulamak.

**Faz 1 — Akış gizlilik anahtarları:** Mantık zaten sağlamdı — `useFeedPrivacy.ts`'teki `hideAll` türetilmiş durumu, üstteki anahtar açıkken alt ikisinin `disabled` olması ([account.tsx](../app/(protected)/account.tsx)) ve Worker'ın (`kaymaktv-feedback-worker`) bir alan `false` yapıldığı an ilgili `feed_activities` kayıtlarını hemen silmesi hep tutarlıydı. Tek gerçek eksik: `SettingsSwitchRow.tsx` `disabled` olduğunda yalnızca native `Switch`'i pasifleştiriyordu, satırın ikon/etiket/açıklaması tam opaklıkta kalıyordu — projenin kendi `SettingsRow.tsx`'inde zaten var olan `rowDisabled: { opacity: 0.4 }` deseniyle tutarsızdı. Aynı desen `SettingsSwitchRow`'a da eklendi.

**Faz 2 — "Hesabı Sil" gerçek bir bug'dı:** `hooks/useSettings.ts`'teki `handleDeleteAccount` yalnızca `removeKeys()` (SecureStore token'ları + `AsyncStorage.clear()`, salt cihaz) çağırıyordu — Supabase'deki `users` satırına (ve ona FK ile bağlı `feed_activities`/`comments`'e) HİÇ dokunmuyordu. Buna rağmen `DeleteAccountModal` kullanıcıya "Tüm Veriler Silinsin mi?" diyip `deleteDataWarning` metninde yalnızca "cihazdan siler" diyordu — yani kullanıcı sunucudaki izleme/puanlama geçmişinin de silindiğini sanırken aslında hiç silinmiyordu.

**Çözüm:**
- `kaymaktv-feedback-worker/src/index.js`: yeni `POST /account/delete` uç noktası (`handleAccountDelete`). `traktAccessToken` YALNIZCA kimlik doğrulamak için `verifyAndUpsertUser` ile okunur (var olan desen, `handleFeedPrivacy` ile aynı) — Trakt tarafına hiçbir yazma/silme isteği ATILMAZ (Trakt zaten hesap silme API'si sunmuyor). Doğrulanan `userId` ile yeni `supabaseDeleteRow(env, "users", userId)` çağrılır; `feed_activities.user_id` ve `comments.user_id` ikisi de `ON DELETE CASCADE` olduğu için (bkz. `supabase/schema/001_feed_schema.sql`) tek bu satırı silmek KaymakTV'nin sakladığı TÜM kullanıcı verisini kaldırır.
- `features/feed/services/accountDeletion.ts` (yeni): `deleteAccountData(traktAccessToken)` — Worker'a POST atar.
- `hooks/useSettings.ts`: `handleDeleteAccount` artık önce (misafir değilse ve token varsa) sunucu silme isteğini atıyor, BAŞARISIZ olursa `removeKeys()`'i hiç çağırmıyor (kullanıcı hâlâ oturumdaydı, verisi sunucuda dururken "silindi" sanıp tekrar denemeyi kaçırmasın diye) — yalnızca sunucu silme başarılı olduktan (veya zaten silinecek sunucu verisi yoksa) sonra yerel token'lar temizleniyor.
- `deleteDataWarning` metni (tr/en) gerçeğe uydurulacak şekilde güncellendi: artık "cihazdan siler" değil, "KaymakTV sunucularındaki verilerinizi (akış aktiviteniz, izleme/puanlama geçmişi) ve cihazdaki önbellekleri" siler diyor.

**Bilinçli olarak DOKUNULMAYAN:** Trakt'taki yorumlar (`services/api/comments.ts` → doğrudan Trakt'ın `/comments` API'si) — bunlar zaten bizim Supabase'imizde hiç saklanmıyor, Trakt'ın kendi verisi, kullanıcının isteği gereği ("Trakt hesabını silmemeli") dokunulmadı. Supabase'deki `comments` tablosu (Phase 2 için hazır şema) hâlâ kullanılmıyor (`.from('comments')` hiçbir client kodunda yok) ama CASCADE zinciri zaten kapsıyor, ileride kullanılmaya başlanırsa ek kod gerekmeyecek.

**Doğrulama:** `tsc --noEmit` 0 hata, worker dosyası `node --check` ile sözdizimi doğrulandı. **Doğrulanamayan:** Gerçek bir hesapla "Hesabı Sil" butonuna basıp Supabase'de satırın gerçekten kalktığını görmek — bu ekran gerçek Trakt girişi gerektiriyor ve bu ortamda Trakt API'sine ağ erişimi yok. **Kullanıcının yapması gereken:** `kaymaktv-feedback-worker`'ı deploy etmeden (`npx wrangler deploy`) yeni `/account/delete` uç noktası canlıya çıkmaz — deploy edilene kadar client `Ayarlar → Hesabı Sil` denemesi Worker'dan 404 alıp hata gösterir (yerel veri de silinmez, mevcut davranış korunur, sessiz bir veri kaybı riski yok).

## 95. "Diziler" Sekmesi Web/Mobil Filtreleme Sapması Giderildi — `view-all` Mekanizması Tamamen Kaldırıldı

**Bağlam:** Kullanıcı "Diziler kısmı webde farklı mobilde farklı filtreleme yapıyor, hangisi doğru bilmiyorum" dedi. Kod incelemesi istendi (kod yazılmadan önce), sonra bulunan sapma için karar verildi.

**Teşhis:** Ana "Diziler" sekmesinin KENDİ kategorizasyonu (Aktif İzlenenler/Ara Verilenler/Başlanmadı/Bırakılanlar) zaten platform bağımsız tek kaynaktan (`store/tracking/trackingLogic.ts` → `categorizeShows`) geliyordu — sorun orada YOKTU. Asıl sapma **Profil ekranı ve Diziler sekmesindeki "Tümünü Gör" akışındaydı**: aynı buton, platforma göre iki bambaşka ekrana gidiyordu.
- **Mobil** ([`screens/ProfileMobile.tsx`](screens/ProfileMobile.tsx)): `/library/{type}` rotasına gidiyordu — canlı, TÜM kütüphaneyi çeken `useLibraryTypeData` + gerçek arama (`LibraryFilterBar`) + 5 kategorili filtre modalı (`LibraryFilterModal`).
- **Web**: `/library/view-all?type=...` rotasına gidiyordu — `viewAllStore`'a önceden konmuş STATİK bir anlık görüntüyü (yalnızca o an ekranda görünen, izleme listesi HARİÇ ilk 100 öğe) filtresiz bir gridde gösteriyordu.

**Karar (kullanıcı, tereddütsüz):** A seçeneği — web mobile eşitlensin. `/library/[type].web.tsx` masaüstünde zaten tam teşekküllü arama+filtre desteğini içeriyordu (`supportsFilters = isDesktop && filtersEnabled`), sadece web'in "Tümünü Gör" butonları oraya bağlı DEĞİLDİ.

**Uygulama:**
1. **3 ekranda yönlendirme değişti** — `app/(protected)/(tabs)/shows.web.tsx`, `movies.web.tsx`, `profile.web.tsx`: `viewAllStore.data=...; router.push('/library/view-all?type=...')` deseni → `router.push('/library/{type}')` (parametresiz, `viewAllStore`'a hiç ihtiyaç yok çünkü hedef ekran veriyi zaten canlı çekiyor).
2. **Yan bulgu — gerçek bir hata, düzeltildi:** `profile.web.tsx`'teki "Favori Diziler"/"Favori Filmler" carousel'leri `routeType` olarak `'favShows'`/`'favMovies'` yerine `'shows'`/`'movies'` gönderiyordu. Eski `view-all` ekranında zararsızdı (tip yalnızca kart görünümünü seçiyordu, veri zaten doğru stash edilmişti) — ama yeni sistemde `type`, `/library/{type}`'ın HANGİ VERİYİ ÇEKECEĞİNİ belirlediği için, düzeltilmeseydi "Favori Diziler'in Tümünü Gör"ü favoriler yerine TÜM kütüphaneye giderdi. İki satır da doğru tipe çevrildi.
3. **Misafir kenar durumu:** `shows.web.tsx`'teki misafirlere gösterilen "Trend Diziler" carousel'i de aynı `renderCarousel` fonksiyonunu (kimlik doğrulanmış "yaklaşan" gruplarıyla PAYLAŞIMLI) kullanıyordu. Kör kör `/library/shows`'a yönlendirilseydi misafir boş bir kişisel kütüphane ekranına düşerdi (misafirin kütüphanesi yok). `renderCarousel`'e `showViewAll` parametresi eklendi; misafir trend carousel'inde `false` geçilip "Tümünü Gör" butonu hiç gösterilmiyor (yanlış bir hedefe götürmek yerine).
4. **Tamamen silindi:** `app/(protected)/library/view-all.tsx` (mobil stub), `view-all.web.tsx` (asıl web ekranı), `utils/viewAllStore.ts`. `grep` ile repo genelinde sıfır kalıntı doğrulandı.

**Doğrulama (web preview'da, gerçek store'a sahte veri enjekte edilerek — Trakt API'sine dokunmadan):** Geçici bir test rotasıyla (`app/dev-library-filter-test.tsx`, doğrulama sonrası silindi) masaüstü genişlikte (800px, `isDesktop` eşiği 768px) `/library/shows`'a gidildi:
- Arama kutusu + filtre butonu doğru render oldu, "Toplam: 6 Diziler" doğru sayıyı gösterdi.
- Filtre modalı (`LibraryFilterModal`) sorunsuz açıldı — 5 kategori (Aktif İzlenenler/Ara Verilenler/Bırakılanlar/Henüz Başlanmadı/Gizlenenler) doğru listelendi.
- "Henüz Başlanmadı" seçilip uygulanınca doğru şekilde "0 sonuç · toplam 6" döndü (sahte veriler gerçekte "Aktif İzlenenler" kategorisine düşüyordu — bu YANLIŞ değil, kategorizasyon mantığının doğru çalıştığının kanıtı); "Aktif İzlenenler" seçilince "6 sonuç · toplam 6" doğru döndü.
- Arama kutusuna "dizi 3" yazılınca, kategori filtresi hâlâ aktifken, doğru şekilde yalnızca ilgili öğeye süzüldü ("1 sonuç · toplam 6") — arama ve kategori filtresi birlikte doğru çalışıyor.
- Konsolda bu akışla ilgili sıfır hata (yalnızca bu ortamın bilinen, ilgisiz Trakt ağ kısıtları vardı).

`tsc --noEmit` 0 hata. `npx expo export -p web` ile `dist/` yeniden derlendi. **Doğrulanamayan:** Gerçek bir Trakt hesabıyla uçtan uca (bu ortamda Trakt API'sine ağ erişimi engelli) — cihazda/APK'da bir kez teyit edilmeli, özellikle "Favori Diziler/Filmler"in artık doğru filtrelendiği.

## 96. "Diziler" İzleme Sekmesi Web/Mobil Sapması Giderildi — Masaüstü Artık `TrackingAccordionList.web.tsx`'e Bağlı

**Bağlam:** Bir önceki maddedeki (95) "Tümünü Gör" sapmasının hemen ardından kullanıcı, ana "Diziler" sekmesinin KENDİSİNDE (Aktif İzlenenler/Ara Verilenler/Henüz Başlanmadı/Bırakılanlar) de "sanki bir uyumsuzluk var" dedi. Kod yazmadan önce yine rapor istendi.

**Teşhis — kategorizasyon değil, GÖSTERİM katmanı sorunuydu:** Hangi dizinin hangi kategoriye düştüğü zaten tek kaynaktan (`categorizeShows`) geliyordu, orada sorun yoktu. Asıl sapma: bu veriyi göstermek için **üç ayrı bileşen** vardı ve hangisinin çalıştığı platforma göre değişiyordu:
- Native mobil → `TrackingAccordionList.tsx` (aç/kapa + sayı rozeti VAR).
- Web, dar ekran (<768px, `IndexMobile` üzerinden) → `TrackingAccordionList.web.tsx` (aç/kapa + sayı rozeti VAR, grid düzeni).
- **Web, masaüstü (≥768px)** → `shows.web.tsx`'e GÖMÜLÜ, elle yazılmış, `WebCarousel` tabanlı üçüncü bir uygulama — **aç/kapa YOK, sayı rozeti YOK**, boş olmayan 4 kategori de HER ZAMAN tam açık gösteriliyordu.

Kanıt: [`store/tracking/useTrackingStore.ts:37-42`](store/tracking/useTrackingStore.ts:37)'deki `DEFAULT_COLLAPSED` — mobilde Diziler sekmesi ilk açıldığında yalnızca "Aktif İzlenenler" açık başlar (diğer üçü kapalı); masaüstünde bu kavram hiç yoktu, hepsi her zaman dökülüyordu. `TrackingAccordionList.web.tsx` tam da bu iş için (grid + aç/kapa + rozet) zaten yazılmıştı ama yalnızca dar-ekran web'de devreye giriyordu — Madde 95'teki "hazır bileşen var ama bağlı değil" kalıbının birebir tekrarı.

**Karar (kullanıcı, tereddütsüz):** A seçeneği — masaüstü `TrackingAccordionList.web.tsx`'e bağlansın, tekerlek yeniden icat edilmesin.

**Uygulama (`app/(protected)/(tabs)/shows.web.tsx`):**
1. `IndexMobile.tsx`'in kullandığı BİREBİR aynı desen taşındı: `useTrackingStore`'dan `collapsed`/`toggle`/`hydrate` okunuyor, `hydrateCollapsed()` mount'ta çağrılıyor, `accordionLabels` memo'su aynı 4 etikete (`upNext/paused/notStarted/dropped→inactive`) sahip.
2. **Mimari düzeltme — iç içe kaydırma riski:** `TrackingAccordionList`'in kendi `FlatList`'i (kendi `RefreshControl`'ü dahil) var; eskiden TÜM sayfa tek bir dış `ScrollView` içindeydi. Bunu doğrudan o `ScrollView`'in içine koymak "VirtualizedList içinde VirtualizedList" hatasına yol açardı. Bunun yerine `IndexMobile.tsx`'in yaptığı gibi segmented tab kontrolü dış kaydırılabilir alanın DIŞINA çıkarıldı; "İzleme" sekmesi + kimliği doğrulanmış kullanıcı + iskelet bitmiş durumdayken `TrackingAccordionList` DOĞRUDAN (sarmalayan `ScrollView` olmadan) render ediliyor; diğer tüm durumlar (Yaklaşanlar sekmesi, misafir trend carousel'i, iskelet) eski `ScrollView` tabanlı yolu aynen koruyor.
3. **Ölü kod temizliği:** `renderTrackCarousel`/`renderTrackItem` (eski elle yazılmış carousel mantığı) ve onların tek tüketicisi olan `components/tracking/ShowTrackCardWeb.tsx` tamamen silindi (`grep` ile repo genelinde sıfır kalıntı doğrulandı). Dosya 293→321 satırdan (yeni state/effect eklenmesine rağmen) 400 satır sınırının altında kaldı.

**Doğrulama (web preview'da, store'a sahte veri enjekte edilerek — Trakt API'sine dokunmadan):** Geçici bir test rotasıyla (`app/dev-tracking-accordion-test.tsx`, doğrulama sonrası silindi) 6 sahte dizi 4 kategoriye (upNext=3, paused=1, notStarted=1, dropped=1) dağıtıldı:
- Segmented control artık listenin DIŞINDA — nested-VirtualizedList konsol uyarısı SIFIR.
- Varsayılan aç/kapa durumu masaüstünde de mobille BİREBİR aynı doğrulandı: yalnızca "Aktif İzlenenler" açık geldi (3 kart görünür), diğer üçü kapalı (yalnızca başlık + sayı rozeti).
- Sayı rozetleri doğru (3/1/1/1); "Bırakılanlar" boş olmadığı için (1 dizi) doğru şekilde gizlenmedi.
- Bir kategori tıklanınca (Ara Verilenler) doğru şekilde açıldı/kapandı.
- **Grid genişlik testi — gerçek DOM ölçümüyle:** 800px (dar, `isDesktop` eşiği 768'e yakın) pencerede grid tek sütuna düşüyordu — bu bir hata değil, `flexBasis:340` + mevcut genişliğin standart CSS flex-wrap davranışı (ölçüldü: 340+340+gap konteyner genişliğini aşıyor). **1440px (gerçekçi masaüstü) pencerede** aynı ölçüm 3 düzgün sütun gösterdi (`getBoundingClientRect` ile: 3 kart, her biri 371px, aynı satırda, taşma yok) — kullanıcının istediği "taşma/stil bozukluğu olmadığı" teyidi burada, gerçek genişlikte, DOM ölçümüyle kanıtlandı.
- "Yaklaşanlar" sekmesine geçiş sorunsuz, boş durum mesajı doğru, layout bozulmadı.

`tsc --noEmit` 0 hata. `npx expo export -p web` ile `dist/` yeniden derlendi. **Doğrulanamayan:** Gerçek bir Trakt hesabıyla uçtan uca (bu ortamda Trakt API'sine ağ erişimi engelli) ve gerçek bir tarayıcı penceresinde (bu ortamın "masaüstü" simülasyonu sınırlı) — cihazda/gerçek tarayıcıda bir kez teyit edilmeli, özellikle 768-900px arası "dar masaüstü" pencere genişliklerinde grid'in tek sütuna düşme davranışının kullanıcı için kabul edilebilir olup olmadığı (isteniyorsa `CARD_MIN_WIDTH` düşürülebilir — bilinçli olarak bu maddenin kapsamı dışında bırakıldı).

## 97. "Bırak" (Dropped) Mimari Değişikliği — Ayrı Supabase/Yerel Durum Yerine Doğrudan Trakt "İlerlemeyi Gizle" Entegrasyonu

**Bağlam:** "Bırakılanlar" durumu için ayrı bir Supabase altyapısı kurmaktan vazgeçildi. Karar: KaymakTV'deki "Diziyi/Filmi Bırak" eylemi doğrudan Trakt'ın yerleşik "Hide from Progress/Calendar" API'sine bağlanacak — Gizle = Bırak. Trakt hesabı tüm cihazlarda tek gerçek kaynak (single source of truth) olacak, ekstra bir veritabanı/state senkronuna gerek kalmayacak.

**Teşhis:** Kod tabanında iki AYRI, birbirinden habersiz mekanizma zaten vardı: (1) `store/tracking/useTrackingStore.ts`'teki `droppedShowIds`/`droppedMovieIds` — kullanıcının 3-nokta menüsünden elle işaretlediği, yalnızca cihaza özel (SecureStore) "Bırakıldı" durumu; (2) `hiddenShowIds` + `toggleHiddenFromProgress`/`hideItemTrakt` — Trakt'ın `/users/hidden/progress_watched` (diziler) uç noktasına zaten bağlı, cihazlar arası senkron "İlerlemeyi Gizle" özelliği (yalnızca diziler için, film tarafı hiç yoktu). İkisi de kategorizasyon mantığında (`categorizeShows`) ayrı kovalardı (`dropped` vs `hidden`) ve UI'da ayrı satırlardı (OptionsModal'da hem "İzlemeyi Bırak" hem "İlerlemeyi Gizle").

**Uygulama:**
1. **Film tarafına Trakt gizleme desteği eklendi** (eskiden yalnızca dizilerde vardı): `services/api/users.ts:getHiddenMovies` (`/users/hidden/calendar?type=movie`), `store/slices/hiddenShowsSlice.ts`'e `hiddenMovieIds`/`setHiddenMovieIds`, `services/library/utils.ts`'e `CACHE_KEYS.hiddenMovieIds` + setter, `fetchers.ts`'in senkron döngüsüne (`loadCache` + `fetchFreshData` TIER3) film gizleme çekme/kalıcılık eklendi, `mutations/collections.ts:toggleHiddenFromProgress` artık `type==='movie'` dalını da optimistic-update ile destekliyor (`hideItemTrakt`/`unhideItemTrakt` zaten `type` parametresiyle filmi `calendar` bölümünden gizliyordu, yalnızca store/senkron tarafı eksikti).
2. **`dropped` kovası tamamen kaldırıldı, `hidden` tek kova oldu:** `store/tracking/trackingLogic.ts` (`categorizeShows`) ve `store/tracking/movieTrackingLogic.ts` (`categorizeMovies`) artık yalnızca `hiddenShowIds`/`hiddenMovieIds`'e bakıyor; `droppedShowIds`/`droppedMovieIds` parametreleri silindi. `useTrackingStore.ts`'ten `droppedShowIds`/`droppedMovieIds` ve ilgili `toggle*`/`clear*` fonksiyonları + SecureStore anahtarları (`kaymak_tracking_dropped_v1`, `kaymak_tracking_dropped_movies_v1`) tamamen silindi — store artık yalnızca akordeon aç/kapa UI durumunu tutuyor.
3. **Ana "Dizi Takip" ekranı temizliği:** `TrackingAccordionList.tsx`/`.web.tsx`'teki `SECTION_ORDER`'dan `'dropped'` çıkarıldı — pano artık yalnızca Aktif/Ara Verilen/Başlanmadı gösteriyor (Gizlenenler zaten tasarım gereği hiç okunmuyordu, bu davranış korundu). `useTrackingShows.ts` artık `dropShow(id)` adında, doğrudan `toggleHiddenFromProgress(id,'show',false)` çağıran bir handler döndürüyor (panodaki kartlar tanım gereği asla zaten-gizli bir diziyi göstermediği için bu her zaman "gizle" yönünde çalışıyor).
4. **Profil/Kütüphane filtre güncellemesi:** `useLibraryShowFilters`/`useLibraryMovieFilters`/`useLibraryFilters`'taki `'dropped'` kategorisi kaldırıldı; her iki medya tipi de artık tek bir `'hidden'` filtresini paylaşıyor, etiketi `media:hiddenProgress` → **"Gizlenenler / Bırakılanlar"** (tr) / **"Hidden / Dropped"** (en) olacak şekilde güncellendi (artık kullanılmayan `media:inactive` çeviri anahtarı silindi).
5. **UI birleştirme:** `OptionsModal`'daki ayrı "İzlemeyi Bırak" satırı (PauseCircle ikonlu, `isDropped`/`onToggleDropped`) tamamen kaldırıldı; "İlerlemeyi Gizle/Göster" satırı artık `type==='show'` kısıtı olmadan hem dizilerde hem filmlerde tek "Bırak" eylemi olarak çalışıyor. `MediaHero`'dan `isDropped`/`onToggleDropped` prop'ları silindi. `app/movie/[id].tsx`'e (eskiden hiç yoktu) `isHidden`/`onHideFromProgress` bağlandı.
6. **Otomatik yeniden aktifleştirme davranışı korundu:** Eskiden bir diziyi/filmi "Bırakıldı" işaretlemişken yeni bölüm/film izlenince işaret otomatik temizleniyordu (`clearDroppedShowStatus`/`clearDroppedMovieStatus`). Aynı UX artık Trakt gizlemesi üzerinden korunuyor: `services/library/mutations/progress.ts`'e eklenen `unhideShowIfNeeded`/`unhideMovieIfNeeded`, yerel `hiddenShowIds`/`hiddenMovieIds`'i anında güncelleyip Trakt'a yaz-ve-unut bir `unhideItemTrakt` isteği atıyor.
7. **Ölü kod/etiket temizliği:** Takip kartlarındaki (`EpisodeCard.web.tsx`, `EpisodeCardMobile.tsx`, `ShowTrackCardWeb.tsx`, `mediaTagLabel.ts`) `'BIRAKILDI'` semantik etiketi `'GİZLİ'`ye çevrildi (artık üretilen tek "kullanıcı bıraktı" etiketi bu). `ShowCard.tsx` (Keşfet kartı) ve `app/episode/[id].tsx`'teki yerel `droppedShowIds` okumaları `hiddenShowIds`'e taşındı. `useMoviesDashboardData` artık `hiddenMovieIds`'i alıp izleme listesi/takvim vitrininden gizlenmiş filmleri diziler tarafındaki (`useDashboardData`) davranışla birebir aynı şekilde filtreliyor.

**Bilinçli olarak DOKUNULMAYAN:** Supabase şemasında (`supabase/schema/*.sql`) bu özellikle ilgili hiçbir kalıntı bulunmadı — "Bırakılanlar" için Supabase planı koda hiç yansımamıştı, temizlenecek orphan tablo/migration yoktu.

**Doğrulama:** `npx tsc --noEmit` → 0 hata (tüm çağrı yerleri, tip imzaları ve store dilimleri baştan sona tutarlı). **Doğrulanamayan:** Gerçek bir Trakt hesabıyla uçtan uca (bu ortamda Trakt API'sine ağ erişimi engelli; UI da gerçek girişe kilitli) — cihazda/APK'da bir kez teyit edilmeli, özellikle: (a) bir diziyi/filmi "Bırak" ile işaretleyip Trakt web arayüzünde gerçekten "gizlenen ilerleme/takvim" listesine düştüğünü görmek, (b) gizlenmiş bir filmi/diziyi Kütüphane → "Gizlenenler/Bırakılanlar" filtresinde bulup oradan geri getirmek, (c) gizli bir diziye yeni bölüm izleyince otomatik gizleme kaldırmanın gerçekten Trakt'a yansıdığını doğrulamak.

## 98. Madde 97 Denetimi — Sayfalama Kaynaklı Sessiz Veri Kaybı, Senkron Yarış Durumu ve Ölü `isDropped` Zinciri

**Bağlam:** Madde 97'deki mimari değişikliğin (Bırak → Trakt "Gizle") ardından kullanıcı bağımsız bir denetim istedi: state yönetimi, UI kalıntıları, unhide mantığında yarış durumu/async hatası ve ölü kodlar. Denetimde **iki gerçek hata** (biri veri kaybına yol açan) ve bir ölü kod zinciri bulundu.

**HATA 1 — `/users/hidden/:section` sayfalandırılmış, ama sayfa döngüsü yoktu (sessiz veri kaybı):** `getHiddenShows`/`getHiddenMovies` tek istek + `limit=200` ile çalışıyordu. Trakt'ın resmi dokümanı bu uç noktanın page/limit destekli olduğunu söylüyor (ve topluluk da "hidden endpoint paginated" olduğunu teyit ediyor — bkz. trakt/trakt-api#430). "Gizle" yalnızca ara sıra kullanılan bir ek özellikken bu görünmezdi; **artık uygulamanın TEK "Bırak" mekanizması olduğu için liste zamanla kolayca 200'ü aşar** ve 200. sıradan sonraki her yapım `hiddenShowIds`'e hiç girmez → kullanıcının bıraktığı diziler sessizce takip panosuna geri döner, "Gizlenenler / Bırakılanlar" filtresinden kaybolur. Ortak `getAllHiddenItems(section, type)` yardımcısı eklendi: dosyanın geri kalanıyla (`getWatchedShows`) aynı `x-pagination-page-count` desenini kullanıp tüm sayfaları sıralı çekiyor (sayfa başına 100, `HIDDEN_MAX_PAGES=100` güvenlik tavanı, bozuk başlıkta sonsuz döngü yok). İstekler zaten en düşük öncelikli arka plan turunda olduğundan bilinçli olarak sıralı — Trakt rate limit'i zorlanmıyor.

**HATA 2 — Senkron, uçuştaki gizle/göster mutasyonunu eziyordu (yarış durumu):** `fetchFreshData` (TIER3) gizli listeyi store'a TOPTAN yazıyor. Sıra şuydu: (1) senkron `GET /users/hidden/...` gönderir (yanıt: [A,B]) → (2) kullanıcı C'yi bırakır, yerel dilim iyimser [A,B,C] olur, POST yola çıkar → (3) (1)'deki **eski** yanıt döner ve dilimi [A,B]'ye geri yazar → **C bırakılmamış görünür, panoya geri düşer.** Kullanıcı açısından bu tam olarak "Bırak butonu çalışmıyor"dur; bir sonraki senkronda kendiliğinden düzeldiği için teşhisi de zordur. Yeni `services/library/hiddenSyncGuard.ts`: devam eden her mutasyon "beklenen son durum" olarak işaretlenir (`beginHiddenMutation`), senkron sunucu listesini yazmadan önce `reconcileHiddenIds` ile bu niyetleri listenin üstüne uygular, mutasyon bitince (başarı VEYA rollback — `finally` bloğunda) işaret kalkar ve sunucu yeniden tek gerçek kaynak olur. Dizi/film kuyrukları ayrı tutuluyor (Trakt'ta id uzayları farklı). Bekleyen mutasyon yokken dizi referansı AYNI döner — gereksiz render üretmez.

**HATA 3 (kod tekrarı, rollback eksikti) — `progress.ts`'teki `unhideShowIfNeeded`/`unhideMovieIfNeeded`:** Madde 97'de bu iki yardımcı, `toggleHiddenFromProgress`'in mantığını elle kopyalamıştı ama **rollback'i yoktu**: unhide isteği başarısız olursa yerel durum "gizli değil", Trakt "gizli" kalıyor, ilk senkronda dizi kullanıcının gözü önünde geri gizleniyordu. Ayrıca metrik kaydı ve (yeni) yarış koruması da eksikti. İkisi de tek kaynağa devredildi: artık doğrudan `toggleHiddenFromProgress(id, type, true)` çağırıyorlar (ateşle-ve-unut — "izledim" akışını bloklamamalı; hata halinde rollback içeride yapılıyor). ~18 satır duplikasyon silindi. `progress.ts → collections.ts` yönünde döngüsel import olmadığı doğrulandı.

**ÖLÜ KOD TEMİZLİĞİ (Madde 97'nin yan ürünü):** Gizlenmiş yapımlar hiçbir kart listesine girmediği için `TrackingCardMenu`'nün `isDropped` prop'u **beş çağrı yerinin hepsinde kalıcı olarak `false`** kalmıştı — yani menüdeki "İzlemeye Devam Et" dalı ULAŞILAMAZDI. Silinenler: `TrackingCardMenu.isDropped` prop'u + 5 çağrı yeri (`EpisodeCard.web`, `EpisodeCardMobile`, `ShowTrackCardWeb`, `MovieCard.web`, `MovieCardMobile`); `MovieCard.web`/`MovieCardMobile`'ın `isDropped` prop'u ve onu besleyen `isDropped={false}` satırları (`MoviesMobile`, `movies.web`); `ShowTrackCardWeb`'in hiç render edilmeyen "Bırakıldı" rozeti + `badge`/`badgeDropped`/`badgeDroppedText` stilleri + öksüz kalan `useTranslation`/`t`; `EpisodeCardMobile`'ın ulaşılamaz "GİZLİ" tag chip'i; kartlardaki ölü `isDropped` hesapları (`getProgressBarColor(false, …)` ile sadeleştirildi). Çeviri: artık ulaşılamayan `media:resumeWatching` (tr+en) silindi. Cihaz depolaması: eski sürümden kalan `kaymak_tracking_dropped_v1` / `kaymak_tracking_dropped_movies_v1` SecureStore anahtarları `useTrackingStore.hydrate()` içinde bir kez sessizce siliniyor (güncelleme yapan kullanıcıların cihazında öksüz kalmasınlar).

**Bilinçli olarak KORUNAN:** `trackingLogic`'in `hidden` kovasına verdiği `tags: ['GİZLİ']` + `mediaTagLabel`'ın `GİZLİ → t('dropped')` eşlemesi + `media:dropped` anahtarı. Bunlar "ölü kod" değil, veri katmanının ürettiği canlı bir değerin eksiksiz çeviri sözleşmesi — kaldırılsaydı hidden kovası ileride render edildiğinde etiketi çevrilemez hale gelirdi. `getProgressBarColor(isDropped, …)` parametre adı da korundu (jenerik; `ShowCard` ve `MediaHero` bunu artık `hiddenShowIds`/`isHidden` ile canlı besliyor).

**Doğrulama:** `npx tsc --noEmit` → 0 hata. Ayrıca saf mantık modülleri (`trackingLogic`, `movieTrackingLogic`, `hiddenSyncGuard`) commonjs'e derlenip **22 iddialık bir test betiğiyle gerçekten ÇALIŞTIRILDI** (hepsi geçti): `dropped` kovasının her iki kategorizasyondan da tamamen kalktığı; gizli dizilerin görünür kategorilerin hiçbirinde olmadığı; "bitmiş ama gizli" bir dizinin (kural 2'nin erken `continue`'unu atlayarak) hâlâ `hidden`'da kaldığı — yoksa kullanıcı onu geri getirecek yer bulamazdı; hiçbir yapımın iki kovaya birden düşmediği; ve **yarış durumu senaryosunun her iki yönde de (hide/unhide) çözüldüğü**, dizi/film kuyruklarının birbirini kirletmediği, bekleyen mutasyon yokken referansın değişmediği. **Doğrulanamayan:** Gerçek Trakt hesabıyla uçtan uca (bu ortamda Trakt API'sine ağ erişimi engelli) — özellikle 200+ gizli öğesi olan bir hesapta sayfalamanın gerçekten tüm listeyi getirdiği cihazda teyit edilmeli.

## 99. "Gizlenenler" Web/APK Uyumsuzluğu — `/users/me` 401 Kaydı İncelemesi ve İki Sessiz Başarısızlık Hatası

**Bildiren:** Kullanıcı Madde 97-98'deki mimari değişikliği (Bırak → Trakt "Gizle") APK'da test ederken "Gizlenenler (ya da Bırakılanlar) web ve APK uyumlu çalışmıyor" dedi ve hata günlüğünden şu kaydı paylaştı: `{"context":"traktClient.401.noRefreshToken","message":"Request failed with status code 401","tags":{"endpoint":"/users/me"}}`.

**Teşhis — bu log kaydı Gizlenenler özelliğinden GELMİYOR:** `/users/me` uç noktasını hide/unhide kodunun (`getHiddenShows`, `getHiddenMovies`, `hideItemTrakt`, `unhideItemTrakt` — hepsi `/users/hidden/*`'e gider) hiçbiri çağırmıyor. `normalizeEndpointKey` (bkz. `utils/circuitBreaker.ts`) yalnızca sorgu string'ini atıp sayısal ID'leri normalize ediyor, `/users/me/stats` gibi farklı bir yolu `/users/me`'ye ASLA indirgemez — yani günlükteki etiket TAM OLARAK `GET /users/me` isteğine ait. Kod tabanında bu isteği yalnızca `getUserProfile('me')` (Profil ekranındaki `useMyTraktProfile.ts` ve `useFeedPrivacy.ts`) atıyor, ikisi de zaten `accessToken`/`isGuest` korumalı (bkz. Madde ~92'deki önceki tanı). Bu kayıt muhtemelen o zaten bilinen/düzeltilmiş senaryonun bir tekrarı ya da cihazda `traktAccessToken` var ama `traktRefreshToken` hiç yazılmamış eski bir oturum durumu — Gizlenenler özelliğiyle DOĞRUDAN bir ilgisi yok.

**Ama arayışta İKİ GERÇEK, somut sessiz-başarısızlık hatası bulundu:**

**HATA 1 — Detay sayfası "..." menüsündeki "İlerlemeyi Gizle/Göster" tamamen sessiz kalıyordu (unhandled promise rejection):** `app/show/[id].tsx` ve `app/movie/[id].tsx`, `MediaHero`'ya `onHideFromProgress={() => toggleHiddenFromProgress(...)}` veriyordu — bu, Trakt'a giden ve HATA DURUMUNDA `throw` eden asenkron bir istek. `OptionsModal.tsx`'teki `handleHideProgress` bunu `await` etmeden, `.catch()` da eklemeden çağırıyordu (`onHideFromProgress(); onClose();`). Sonuç: ağ hatası/401/rate-limit gibi HERHANGİ bir sebeple istek başarısız olduğunda — `toggleHiddenFromProgress` kendi içinde iyimser güncellemeyi sessizce rollback ediyordu ama **ekranda hiçbir şey görünmüyordu**. Kullanıcı butona basıyor, kart bir an gizleniyor gibi oluyor, sonra sessizce eski haline dönüyor — "buton çalışmıyor" hissi, tek iz cihazın hata günlüğünde. Bu, uygulamanın PRIMARY "Bırak" giriş noktası (detay sayfası menüsü, takip panosundaki 3-nokta menüsünden daha belirgin) olduğu için en yüksek etkili nokta.

**HATA 2 — Takip panosu/film listesi 3-nokta menüsünde (`TrackingCardMenu`) hem misafir koruması hem hata bildirimi eksikti:** Aynı "Bırak" eylemi `OptionsModal`'da misafiri (`isGuest`) engelleyip net bir mesaj gösterirken, `TrackingCardMenu.handleToggleDropped` hiçbir kontrol yapmadan doğrudan `onToggleDropped()`'ı çağırıyordu — bir misafir, kartı iyimser olarak anında gizliyor (Trakt'a auth'suz istek gidip 401 alıyor), sonra kart sessizce geri geliyordu. Ayrıca (Hata 1'le aynı desen) `onToggleDropped()`'ın döndürdüğü promise ne `TrackingCardMenu`'de ne çağıran taraflarda (`useTrackingShows.dropShow`, `screens/MoviesMobile.tsx`, `movies.web.tsx`) gerçek bir kullanıcı bildirimine bağlıydı — yalnızca `console.error` ile yutuluyordu.

**Çözüm:**
- `OptionsModal.tsx`: `onHideFromProgress` prop tipi `() => void | Promise<void>` oldu; `handleHideProgress` artık `await onHideFromProgress()`'i `try/catch` içine alıp reddedilirse `Alert.alert(t('common:error'), t('common:actionFailedMessage'))` gösteriyor.
- `TrackingCardMenu.tsx`: `handleToggleDropped` artık async — önce `isGuest` kontrolü (OptionsModal'daki `guestRestrictedMessage` ile AYNI mesaj), sonra `await onToggleDropped()` + `try/catch` + aynı görünür hata Alert'i. `onToggleDropped` prop tipi `() => void | Promise<void>` oldu, `useAuth` import edildi.
- Çağıran taraflardaki gereksiz yerel `.catch(console.error)` sarmalayıcıları kaldırıldı (`hooks/useTrackingShows.ts:dropShow`, `screens/MoviesMobile.tsx`, `app/(protected)/(tabs)/movies.web.tsx`) — hata artık yutulmadan `TrackingCardMenu`'nün merkezi yakalayıcısına kadar yükseliyor.
- Yeni çeviri anahtarı: `common:actionFailedMessage` (tr: "İşlem gerçekleştirilemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin." / en: "The action failed. Please check your internet connection and try again.") — projede daha önce böyle bir jenerik "işlem başarısız" mesajı yoktu, her yer kendi özel metnini (`listAddError` gibi) kullanıyordu; bu, "Bırak" gibi tek bir özel metne ihtiyaç duymayan aksiyonlar için tekrar kullanılabilir jenerik bir mesaj.

**Doğrulama:** `npx tsc --noEmit` → 0 hata. Promise-zinciri mantığı (`await`+`try/catch` + misafir kısayolu) izole edilip commonjs'e çevrilmeden, doğrudan aynı mantıkla **4 iddialık bir test betiğiyle çalıştırıldı** (hepsi geçti): reddedilen bir istek artık kullanıcıya görünür bir hata gösteriyor (eskiden hiçbir şey göstermiyordu); misafir modunda Trakt'a istek HİÇ atılmıyor; başarılı durumda hiçbir alert görünmüyor. **Doğrulanamayan:** Gerçek bir Trakt hesabıyla, gerçek bir ağ hatası/401 anında (bu ortamda Trakt API'sine erişim yok) — kullanıcının APK'sında bu düzeltmenin gerçek 401'i yakalayıp görünür hale getirdiğini teyit etmesi gerekiyor. Ayrıca kullanıcıdan şu bilgiler istendi (bu oturumda cevaplanmadı): hangi platformda hangi sırayla ne yaptığı ve tam olarak ne gözlemlediği — paylaşılan tek kanıt (yukarıdaki log) özelliğin kendisiyle ilgili değildi, bu yüzden kök neden kesin olarak doğrulanamadı; bulunan iki hata "sessiz başarısızlık her zaman kullanıcı için 'çalışmıyor' gibi görünür" ilkesine dayanarak düzeltildi.

## 100. `localapk.bat` Derleme Hatası — `assets/icon.png` Aslında Bir JPEG'miş (AAPT2 "file failed to compile")

**Bildiren:** Kullanıcı `localapk.bat`'ı çalıştırdı, `gradlew assembleRelease` "BUILD FAILED" ile bitti ve yalnızca son birkaç satırı (Gradle 9.0 uyumluluk uyarısı + "APK dosyası bulunamadı") paylaştı — asıl hata mesajı terminalde yukarıda kalmıştı.

**Teşhis:** Build'i doğrudan `--stacktrace` ile çalıştırıp tam günlüğü yakalayınca gerçek hata ortaya çıktı:
```
Execution failed for task ':app:mergeReleaseResources'.
> Android resource compilation failed
  ERROR: .../drawable-mdpi\assets_icon.png: AAPT: error: file failed to compile.
```
`assets_icon.png`, Metro'nun `require('.../assets/icon.png')` çağrısını Android'e paketlerken ürettiği dosya adı — yani kaynağı [assets/icon.png](assets/icon.png). Dosyayı ikili olarak incelendiğinde: magic byte'ları `FF D8 FF E0` (**JPEG**), `89 50 4E 47` (**PNG**) DEĞİL — dosya `.png` uzantısı taşıyan, içeriği aslında bir JPEG olan bozuk bir varlık. Bu, Madde 99'da eklenen `features/versionGate/components/ForceUpdateScreen.tsx`'in `require('../../../assets/icon.png')` ile bu dosyayı **ilk kez JS asset olarak** (Metro'nun native bundling hattından) kullanmasıyla ortaya çıktı — eskiden yalnızca `app.json`'ın `icon`/`splash` alanları bu dosyaya işaret ediyordu, o alanlar `expo prebuild`'in kendi (format'a toleranslı, muhtemelen otomatik yeniden kodlayan) ikon üretim aracından geçiyor; Metro'nun asset paketleyicisi ise byte'ları OLDUĞU GİBİ bir `drawable/*.png` kaynağına kopyalıyor ve AAPT2 (katı bir PNG derleyicisi) gerçek bir PNG olmayan bu dosyayı reddediyor.

**Çözüm:** `jimp-compact` (proje bağımlılıklarında zaten mevcut, saf JS — native `sharp` gerekmiyor) ile dosya okunup GERÇEK bir PNG olarak yeniden yazıldı (`assets/icon.png`, 1600×1600, aynı piksel verisi — JPEG zaten kayıplı sıkıştırılmıştı, PNG'ye çevirmek ek bir kalite kaybı yaratmaz). Dosya boyutu 123KB → 1MB büyüdü (PNG kayıpsız), bu normal ve zararsız.

**Tuzak — ilk yeniden derlemede hata AYNEN tekrarladı:** `app:createBundleReleaseJsAndAssets` görevi Gradle tarafından `UP-TO-DATE` sayılıp yeniden çalıştırılmadı; `android/app/build/generated/res/.../assets_icon.png` hâlâ İLK (bozuk) derlemeden kalma JPEG içerikli dosyaydı. `android/app/build` dizini elle silinip görev zorla yeniden çalıştırıldıktan sonra derleme **BUILD SUCCESSFUL** ile bitti (83 MB APK, `Kaymak-V2.0_Beta.apk` olarak proje köküne kopyalandı).

**Doğrulama:** İkili karşılaştırmayla üretilen `assets_icon.png`'nin artık gerçek PNG magic byte'larına sahip olduğu doğrulandı; `gradlew assembleRelease` temiz bir `app/build`'den baştan sona hatasız tamamlandı (443 görev, 83 çalıştı/360 güncel, 1dk 51sn). **Not:** `localapk.bat`'ın kendisi `expo prebuild --clean` çalıştırdığı için kullanıcı script'i normal şekilde tekrar çalıştırdığında da (bu oturumdaki manuel `app/build` silme adımına gerek kalmadan) düzeltme kalıcı olarak devreye girecek — `--clean` her seferinde `android/` klasörünü sıfırdan kurduğu için stale-cache sorunu bir daha yaşanmaz.

## 101. Cihazlar Arası Senkron Kopukluğu — Asıl Kopan Halka Bulundu (`AppState` Dinleyicisi Hiç Yoktu) + "İzlemeyi Bırak" Buton Adı Birleştirmesi

**Bildiren:** Kullanıcı, Cihaz A'da bir diziyi "Bırak" dediğinde Cihaz B'nin bunu asla görmediğini bildirdi ve 3 şüpheli noktayı denetlememi istedi: (1) POST isteği gerçekten başarılı mı, (2) `fetchFreshData` gizli listeleri gerçekten çekiyor mu, (3) `hiddenSyncGuard.ts` ikinci cihazın taze veriyi yazmasını engelliyor olabilir mi.

**Üç şüpheli noktanın denetimi — hiçbiri bozuk DEĞİLDİ:**
1. **POST başarısı:** `toggleHiddenFromProgress` başarısız olursa `throw` ediyor, sessizce yutmuyor; Madde 99'da eklenen görünür hata bildirimi (`Alert.alert`) zaten bunu kullanıcıya gösteriyor. Kod doğru.
2. **Sync loop:** `fetchers.ts`'in TIER3'ü `getHiddenShows()`/`getHiddenMovies()`'i (Madde 98'de sayfalama eklenmiş hâlleriyle) zaten çağırıyor, sonucu `setHiddenShowIds`/`setHiddenMovieIds`'e yazıyor. Kod doğru.
3. **`hiddenSyncGuard.ts`:** `pendingMutations` modül-seviyesinde, yalnızca O CİHAZIN kendi JS çalışma zamanında yaşıyor — Cihaz B'nin kendi `pendingMutations` haritası A'daki işlemden tamamen habersiz ve HER ZAMAN boş, `reconcileHiddenIds` de boşken sunucu listesini OLDUĞU GİBİ (referansı bile değiştirmeden) döndürüyor. Cihaz B'yi engelleyen bir şey YOK. Kod doğru. `toggleHiddenFromProgress`'in `finally` bloğu da `endHiddenMutation`'ı koşulsuz çağırdığından aynı cihaz içinde bile sızıntı riski yok.

**Asıl kopan halka — sorulmayan 4. soru:** `context/LibraryContext.tsx`'teki `LibraryProvider`, `fetchFreshData`'yı yalnızca (a) soğuk açılışta VE (b) `SYNC_INTERVAL` (10 dk, `utils/cacheTTL.ts`) dolduğunda tetikliyordu. Repo genelinde **tek bir `AppState` dinleyicisi bile yoktu** — uygulama arka plana atılıp geri getirildiğinde HİÇBİR yeniden senkron tetiklenmiyordu. Sonuç: Cihaz B ya zaten açık duruyorsa ya da kendi son senkronundan bu yana 10 dakika geçmemişse, Trakt'a BİR DAHA HİÇ sormuyordu — Cihaz A'daki "Bırak" isteği Trakt'a başarıyla ulaşmış olsa bile Cihaz B bunu asla öğrenmiyordu. Kullanıcının test ettiği en gerçekçi senaryo ("A'da bırak, hemen B'yi kontrol et") tam olarak bu 10 dakikalık pencereye düşüyor.

**Çözüm:** `context/LibraryContext.tsx`'e standart RN deseni eklendi — `AppState.addEventListener('change', ...)` ile yalnızca GERÇEK arka plan→ön plan GEÇİŞİ (`background`/`inactive` → `active`, ilk mount'ta ekstra tetiklenmeyecek şekilde bir `useRef` ile takip edilir) yakalanıp `fetchFreshData(accessToken, true)` (TTL'i bilinçli olarak ATLAYARAK) çağrılıyor. Mevcut `isFetchingFreshData` kilidi + devre kesici + rate-limit koruması zaten üst üste binen çağrılara karşı savunma sağladığından ek bir throttle eklenmedi.

**İkinci konu — "buton karmaşası":** Kullanıcı aynı eylemin iki yüzeyde (takip panosu 3-nokta menüsü ve detay sayfası "..." menüsü) farklı isimler taşıdığını belirtti. Takip panosu zaten "İzlemeyi Bırak" diyordu (`TrackingCardMenu`, `stopWatching` anahtarı, işlevi denetlendi — `toggleHiddenFromProgress`'e doğru bağlı, değişiklik gerekmedi). Detay sayfasındaki `OptionsModal` ise "İlerlemeyi Gizle"/"İlerlemeyi Göster" diyordu — aynı fonksiyonu çağırmasına rağmen farklı bir isimdi. `hideProgress`/`unhideProgress`/`hideProgressConfirmMsg`/`yesHide` çeviri değerleri (tr+en) "İzlemeyi Bırak"/"İzlemeye Devam Et" temasına çekildi; onay mesajı da "gizlenecek" yerine "bırakılacak, yeni bölüm izleyince otomatik geri döner" diyecek şekilde güncellendi. İkon `Eye`/`EyeOff`'tan `PauseCircle`/`PlayCircle`'a çevrildi — `Bookmark` BİLİNÇLİ OLARAK seçilmedi çünkü aynı modalde zaten "İzleme Listesi" satırı onu kullanıyor, aynı ikonun iki farklı eylemde tekrarı karışıklığı büyütürdü. Bu değişiklik `type==='show'` kısıtı Madde 97'de zaten kaldırıldığı için hem diziler hem filmler için otomatik olarak geçerli — ayrı bir film kodu gerekmedi.

**Doğrulama:** `npx tsc --noEmit` → 0 hata. `AppState` geçiş mantığı izole edilip **6 senaryoluk bir testle gerçekten çalıştırıldı** (hepsi geçti): soğuk açılışta çift senkron yok, `background→active` ve `inactive→active` geçişlerinde tam olarak bir zorla senkron tetikleniyor, `background→inactive→active` zincirinde yalnızca son geçiş sayılıyor, `active→active` gibi no-op geçişlerde gereksiz senkron yok. **Doğrulanamayan:** Gerçek iki cihazla uçtan uca (bu ortamda ikinci bir fiziksel/emülatör cihaz ve Trakt ağ erişimi yok) — kullanıcının Cihaz A'da bırakıp Cihaz B'yi arka plandan öne getirerek (basitçe yeniden açarak DEĞİL, gerçekten arka plana atıp geri getirerek) doğrulaması gerekiyor; salt "uygulamayı kapat-aç" (tam cold start) senaryosu hâlâ 10 dakikalık TTL'e tabi kalabilir çünkü `LibraryProvider`'ın mount-effect'i `force` parametresi geçmiyor — bu OLDUĞU GİBİ bırakıldı (kapsam dışı, kullanıcı özellikle "arka plandan öne gelme" akışını değil "cihazlar arası" tutarlılığı sordu; cold-start'ı da her zaman zorlamak istenirse ayrı bir karar gerekir).

## 102. "Bazen Senkron Oluyor Bazen Olmuyor" — Kök Neden: Trakt CDN Önbelleği (Madde 9'un Kaybolmuş Koruması) + Gizli Listelerin TIER3 Darboğazı

**Bildiren:** Madde 101'deki `AppState` düzeltmesinden sonra kullanıcı senkronun **kısmen** çalıştığını bildirdi: "bir kaç dizide denedim, bazen tam senkron çalışıyor bazen çalışmıyor... o dizi senkron olmadı, bir daha denedim oldu. hata günlüğüne baktığımda bir sorun göremedim."

**En kritik ipucu, semptomun kendisiydi:** aynı dizi ikinci denemede çalışıyor + hata günlüğünde HİÇBİR iz yok. Bu ikisi birlikte "istek başarısız oluyor" senaryosunu ELER — istek 200 dönüyor, sadece İÇERİĞİ bayat.

**KÖK NEDEN 1 (asıl sebep) — Trakt CDN önbelleği, daha önce çözülmüş ama kaybolmuş bir koruma:** `docs/HISTORY.md` Madde 9 aynen şunu diyor: *"Sorun (Trakt Caching): Trakt'ın CDN önbelleğinden kaynaklı veri gecikmeleri yaşanıyordu. Çözüm: Tüm GET isteklerine `cb=${Date.now()}` eklendi."* Bu koruma sonraki refaktörlerde kaybolmuş — bugün repoda yalnızca `services/api/comments.ts` (kendi `cacheBustParam()`'ı ile) korunuyordu. Gizli liste uç noktasının URL'si ise her çağrıda BİREBİR AYNIydı (`/users/hidden/progress_watched?type=show&page=1&limit=100`) — mükemmel bir CDN önbellek anahtarı. Akış: Cihaz A "Bırak" POST'unu atar (Trakt'ta anında işlenir) → Cihaz B hemen ardından GET atar → CDN'de duran ESKİ liste döner → dizi hâlâ "Aktif"te görünür. Önbellek düşünce (ya da tekrar denenince) kendiliğinden düzeldiği için tam olarak "bazen oluyor bazen olmuyor" şeklinde davranıyordu. **Çözüm:** `getAllHiddenItems`'ın ürettiği her sayfa URL'sine `_=${Date.now()}` eklendi (comments.ts'teki mevcut desenle aynı). Devre kesici anahtarı bundan etkilenmez — `normalizeEndpointKey` query string'i zaten atıyor (testle doğrulandı).

**KÖK NEDEN 2 (gecikme/atlama penceresi) — gizli listeler TIER3 darboğazındaydı:** `getHiddenShows`/`getHiddenMovies`, `fetchFreshData`'nın TIER3 turunda 9 isteklik TEK bir `Promise.all` içinde ve `LOW` öncelikte çekiliyordu. Üç ayrı sorun: (a) `setHiddenShowIds` ancak o turdaki EN YAVAŞ istek (sayfalanan `getWatchedMovies`, 3× `getUserRatings`, ekstra round-trip yapan 2× `getLiked*`) bitince çalışıyordu; (b) `LOW` öncelik, `backgroundWork`'ün onlarca/yüzlerce `getShowProgress` isteğiyle aynı kuyruk seviyesinde yarışıyordu — büyük kütüphanelerde dakikalarca sıra bekleyebiliyordu; (c) `fetchFreshData` TTL (10 dk) veya eşzamanlılık kilidi yüzünden erken dönerse TIER3'e HİÇ ulaşılmıyor, gizli listeler o çağrıda hiç yenilenmiyordu. **Çözüm:** Yeni `syncHiddenLists(accessToken)` fonksiyonu — iki hafif isteği `NORMAL` öncelikte, kendi başına çalıştırır ve `fetchFreshData` içinde TTL/kilit kontrollerinden **ÖNCE** çağrılır. Böylece tam senkron atlansa bile "Bırak" durumu her tetiklemede tazelenir. TIER3'ten ve oradaki `setIfValidInitial` kalıcılığından tamamen çıkarıldılar (geç biten turun elindeki daha eski store anlık görüntüsüyle taze listeyi geri ezme riskini de kaldırır).

**KÖK NEDEN 3 (teşhisi imkânsız kılan) — TIER3 hataları kalıcı günlüğe HİÇ yazılmıyordu:** O turdaki tüm `.catch()`'ler yalnızca `console.error` kullanıyordu. Cihazda geliştirici konsolu olmadığından, gizli liste isteği gerçekten başarısız olsa bile kullanıcının "Hata Günlüğü" ekranında hiçbir iz kalmıyordu — kullanıcının "hata günlüğünde bir sorun göremedim" gözlemi bu yüzden bir kanıt değil, bir kör noktaydı. `syncHiddenLists` artık `logError` ile kalıcı günlüğe de yazıyor.

**Denetlenip SAĞLAM bulunanlar (kullanıcının şüphelendiği 3 nokta):** (1) POST başarısı — `toggleHiddenFromProgress` hata durumunda `throw` ediyor, Madde 99'daki görünür `Alert` zaten devrede, sessiz yutma yok. (2) Sync loop — TIER3 gizli listeleri zaten çağırıyordu (sorun çağırmaması değil, GEÇ ve KOŞULLU çağırmasıydı). (3) `hiddenSyncGuard.ts` — `pendingMutations` modül seviyesinde, yalnızca o cihazın kendi çalışma zamanında yaşıyor; Cihaz B'nin haritası her zaman BOŞ ve `reconcileHiddenIds` boşken sunucu listesini referansını bile değiştirmeden döndürüyor (testle doğrulandı). Cihaz B'yi engelleyen bir şey yoktu.

**Doğrulama:** `npx tsc --noEmit` → 0 hata. **9 iddialık bir test betiği gerçekten çalıştırıldı** (hepsi geçti): cache-bust'ın aynı sayfa için bile benzersiz URL ürettiği; uç nokta/type/pagination'ın bozulmadığı; devre kesici anahtarının parçalanmadığı; sunucu yanıtının doğru eşlendiği ve bozuk/yanlış-tip kayıtların elendiği; **Cihaz B'nin (işlem yapmayan cihaz) taze listeyi hiç engellenmeden uyguladığı**; Cihaz A'nın uçuştaki mutasyonunun hâlâ korunduğu. Release APK yeniden derlendi (BUILD SUCCESSFUL). **Doğrulanamayan:** Gerçek iki cihazla uçtan uca (bu ortamda ikinci cihaz + Trakt ağ erişimi yok) — asıl teyit kullanıcıda.

**AÇIK KALAN / KULLANICIYA SORULACAK:** Madde 9'un "TÜM GET isteklerine cache-bust" koruması yalnızca gizli listeler için geri getirildi. Aynı CDN önbelleği teorik olarak `getWatchedShows`/`getWatchlistShows` gibi diğer senkron uç noktalarını da etkileyebilir (yani "izledim" işaretlemeleri de cihazlar arası gecikmeli görünebilir). Bilinçli olarak genişletilMEDİ: `getShowProgress` gibi yüksek hacimli uç noktalarda cache-bust, CDN önbelleğini tamamen devre dışı bırakıp büyük kütüphanelerde rate-limit baskısını ve senkron süresini artırabilir. Bu bir ürün kararı — kullanıcı "izledim" senkronunda da gecikme gözlemlerse hedefli olarak genişletilmeli.

## 103. "İzlemeyi Bırak" Son Rötuşlar: Onay Diyaloğu Kaldırıldı, İkon Birleştirildi + Eski Kalıntı Kod Temizliği

**Bağlam:** Madde 102'deki CDN önbellek düzeltmesinden sonra kullanıcı cihazlar arası senkronun çalıştığını doğruladı ve üç istek iletti: (1) dizi detay sayfasındaki "İzlemeyi Bırak" onay ("Emin misiniz?") diyaloğu kaldırılsın — "o butona basan biri zaten emindir", (2) `PauseCircle` ikonu bu eylemin HER yerinde kullanılsın (bazı yerlerde farklı ikon vardı), (3) eskilerden kalma gereksiz kodlar temizlensin — **ama çalışan koda dokunulmasın**.

**1) Onay diyaloğu kaldırıldı:** `OptionsModal.handleHideProgress` içindeki `confirmAsync(...)` bloğu silindi. Gerekçe koda da yazıldı: eylem YIKICI DEĞİL — izleme geçmişi/puanlar korunur, yapım Kütüphane > "Gizlenenler / Bırakılanlar" filtresinden her an geri getirilebilir ve yeni bir bölüm izlenince zaten otomatik geri döner (`mutations/progress.ts:unhideShowIfNeeded`). Ayrıca takip panosundaki 3-nokta menüsü (`TrackingCardMenu`) zaten onay sormuyordu — iki yüzey davranışsal olarak eşitlendi. Öksüz kalan `media:hideProgressConfirmMsg` ve `media:yesHide` çeviri anahtarları (tr+en) silindi; `areYouSure` KORUNDU (hâlâ "Geçmişi Sil" onayında kullanılıyor).

**2) İkon birleştirildi:** Tek tutarsız yer `TrackingCardMenu`'ydü — `Bookmark` kullanıyordu, `OptionsModal` ise `PauseCircle`. Aynı eylem iki yüzeyde iki farklı ikonla görünüyordu. `TrackingCardMenu` artık `PauseCircle` kullanıyor. `PauseCircle` bundan böyle bu eylemin uygulama genelindeki TEK ikonu; "devam et" yönünde doğal karşıtı `PlayCircle`. (NOT: `TrackingAccordionList`'teki `Bookmark`'a DOKUNULMADI — o "Henüz Başlanmadı" KATEGORİ ikonu, farklı bir kavram.)

**3) Filmler denetlendi — ayrı düzeltme GEREKMEDİ:** Kullanıcı filmleri test etmediğini belirtip "Trakt'taki mantığıyla aynı olsun, aldığımız hataları orada almayalım" dedi. Denetim sonucu filmler dizilerle BİREBİR aynı kod yollarını paylaşıyor: doğru uç nokta (`calendar` — Trakt'ta filmler `progress_watched` bölümünü KABUL ETMEZ, o yalnızca show/season alır), ortak `getAllHiddenItems` üzerinden CDN cache-bust, `syncHiddenLists`'te `logError`'lu hızlı yol, `movie/[id].tsx`'te iki yönlü `isHidden` bağlantısı, `useMoviesDashboardData`'da liste filtreleme, ve ortak UI bileşenleri (`OptionsModal`/`TrackingCardMenu`) sayesinde yukarıdaki iki UI değişikliği filmlere de otomatik yansıdı.

**4) Ölü kod temizliği — YALNIZCA kullanılmayan import/değişkenler:** `tsc --noUnusedLocals --noUnusedParameters` ile kesin liste çıkarıldı (tahmine dayalı grep taraması bilinçli olarak TERK EDİLDİ — `t('common:actionFailedMessage')` gibi namespace önekli kullanımları kaçırıp CANLI anahtarları "ölü" gösteriyordu, yani riskliydi). Temizlenenler: `app/_layout.tsx` (`useEffect`, `useRef`, `useRouter`, `useSegments`, `Platform` + kullanılmayan `accessToken`/`isGuest` destructure'ları; ayrıca dosya ortasındaki `LibraryProvider` import'u en üste taşındı), `app/show/[id].tsx` (10 ölü import + ölü `useAuth()` çağrısı + kullanılmayan `width` sabiti), `app/episode/[id].tsx` (10 ölü import), `app/movie/[id].tsx` (`Dimensions`, `LayoutAnimation`), `components/MediaHero.tsx` (`BlurView`, `generateMediaSlug`, `useResponsive` + ölü `isDesktop`), `index.tsx`/`index.web.tsx`/`UpcomingSectionList`/`SkeletonLoader`/`HeroSection`/`useSettings` (birer ölü import), `services/api/traktClient.ts` (dosya sonundaki 59 satırlık tamamen ölü blok: boş satırlar + altında hiçbir kod olmayan, mojibake'li eski yorum başlıkları). Her düzenlemeden sonra `tsc --noEmit` çalıştırılarak hiçbir şeyin kırılmadığı doğrulandı. **Bilinçli olarak DOKUNULMAYAN:** kullanılmayan yerel state/fonksiyonlar (`isWebViewVisible`, `toggleSpoiler`, `renderUnairedBadgeText`, `handleMarkSeason` vb.) — bunlar import'lardan farklı olarak davranışsal risk taşır ve kullanıcının "sakın çalışan koda dokunma" kuralı gereği kapsam dışı bırakıldı; `tsc --noUnusedLocals` çıktısında listelenmiş halde duruyorlar, ileride ayrı ve dikkatli bir turda ele alınabilirler.

**Doğrulama:** `npx tsc --noEmit` → 0 hata (temizliğin her adımından sonra ayrı ayrı). Release APK yeniden derlendi → BUILD SUCCESSFUL.

## 104. Kopuk Kod Otopsisi: 3 Özellik Geri Bağlandı, 25 Ölü Kalıntı Temizlendi (25 → 0) + Kalıcı "Ölü Kod Hijyeni" Kuralı

**Bağlam:** Madde 103'te `tsc --noUnusedLocals` ile 25 "kullanılmayan" yerel değişken/fonksiyon tespit edilmiş ama BİLİNÇLİ OLARAK silinmemişti (kullanıcının "sakın çalışan koda dokunma" kuralı). Kullanıcı bu frene basmayı onaylayıp körlemesine silme yerine **"Cerrahi İnceleme"** istedi: her kalıntının nerede olduğu, ne işe yaradığı ve NEDEN boşta kaldığı. Ardından "Önce Bağla/Düzelt, Sonra Temizle" sırasıyla ilerlendi.

**OTOPSİ SONUCU — 5 kategori:**
- **(A) Taşınmış (3):** `handleMarkSeason`+`seasonLoading`, `renderUnairedBadgeText` → `SeasonAccordion.tsx`'e taşınmış (oradaki sürümlerde misafir kontrolü, yayınlanmamış bölüm ayıklama ve "Tekrar İzle/Geçmişi Sil" menüsü de var — yani eski kopyalar hem ölü hem ZAYIFTI). `toggleSpoiler`+`revealedSpoilers` → `components/comments/CommentItem.tsx`'teki `SpoilerOverlay`'e taşınmış. Özellikler yaşıyor; kopyalar silindi.
- **(B) Bilinçli olarak değiştirilmiş (1):** WebView modalı (`isWebViewVisible`/`isWebViewLoading` + 7 öksüz stil). HISTORY Madde 54'e göre "Tümünü Gör" eskiden Trakt'ın web sayfasını uygulama içinde açıyordu; yerine native `CommentSheet` geldi. Bilinçli bir yükseltme → tamamen silindi.
- **(C) GERÇEK HATA (1) — düzeltildi:** `app/episode/[id].tsx`'te `useSafeAreaInsets()` çağrılıyor ama kullanılmıyordu; geri/paylaş butonları `top: 50` ile SABİT kodlanmıştı. Çentik/durum çubuğu yüksekliği farklı cihazlarda (küçük ekranlı Android, katlanabilir, Dynamic Island) butonlar ya durum çubuğunun altına giriyor ya gereksiz aşağıda kalıyordu — ekran, `MediaHero.tsx`'teki doğru desenden sapmıştı. Artık `insets.top + 10` (+ yatayda `insets.left/right`) kullanılıyor.
- **(D) GERÇEK KAYIP ÖZELLİK (1) — geri bağlandı:** `votes` (bölümün Trakt oy sayısı) hesaplanıyor ama HİÇBİR yerde basılmıyordu (repo genelinde `.votes`'un tek kullanımı o satırdı). Puan rozeti artık `⭐ 8.4 (1.234)` formatında; oy sayısı yalnızca `> 0` iken gösteriliyor (0 oylu bölümlerde "(0)" basmak puanı gereksiz şüpheli gösterirdi).
- **(E) Zararsız kalıntı (19):** kullanılmayan import'lar/destructure fazlalıkları.

**⚠️ ÖNCEKİ RAPORDA DÜZELTİLEN HATALI TESPİT — "arama çevirisi" (D10):** Otopsi raporunda `search.ts`'teki kullanılmayan `applyTranslation`/`i18n` import'ları "yapılmak istenip yarım kalmış, en büyük UX kazancımız olacak" diye yorumlanmıştı ve kullanıcı buna dayanarak bağlanmasını istedi. **Uygulamadan ÖNCE doğrulandı ve tespit YANLIŞ çıktı:** Trakt'ın `/search/:type` uç noktası `translations` parametresini DESTEKLEMİYOR (yalnızca `fields` + `extended=full` kabul ediyor — bkz. trakt.tv resmi method listesi). Yanıtta `translations` dizisi hiç gelmediği için `applyTranslation` sessiz bir no-op olurdu; yani "arama sonuçları artık Türkçe" demek gerçeğe aykırı olurdu. Bu bir **kopuk bağlantı değil, API kısıtıdır** — bağlamak yerine yanıltıcı import'lar kaldırıldı ve dosyaya bu tespiti açıklayan kalıcı bir not eklendi. (Arama sonuçlarını yerelleştirmek gerçekten istenirse TMDB tabanlı ayrı bir çözüm gerekir: TMDB `language=tr-TR` ile arayıp sonuçları Trakt ID'lerine eşlemek — ayrı ve daha büyük bir iş.)

**TEMİZLİK — 25 → 0:** Yukarıdaki A/B/E kalemlerinin tamamı silindi: `app/show/[id].tsx` (`handleMarkSeason`, `seasonLoading`, `renderUnairedBadgeText`, `snackbarData`, `showSlug`), `app/episode/[id].tsx` (WebView state'leri + spoiler state'leri + `safeTitle` + 10 öksüz stil), `EpisodeCard.web.tsx` (`isSuccess` + artık gereksiz `onSuccessStateChange` prop'u — prop opsiyonel olduğu için temiz kaldırıldı), `MovieCardMobile.tsx` (kullanılmayan `setIsLoading`; `isLoading` okunmaya devam ettiği için salt-okunur bırakıldı, davranış aynı), `library/[type].web.tsx` (`insets`), `Sidebar.tsx` (`router` — `<Link>`'e geçilmiş), `useSettings.ts` (`router`), `ExploreWebGrid.tsx` (2× `t`), `RatingModal.tsx` (`t` — başlık artık `title` prop'uyla geliyor), `traktClient.ts` + `search.ts` (`i18n`). Öksüz kalan 3 import da ikinci turda temizlendi.

**Doğrulama:** `npx tsc --noEmit` → 0 hata (her aşamadan sonra ayrı ayrı). `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` → **25 hatadan 0'a düştü** (kod tabanında sıfır kullanılmayan yerel/import). Release APK yeniden derlendi → BUILD SUCCESSFUL. **Doğrulanamayan:** C1 (safe-area) düzeltmesinin çentikli gerçek bir cihazda görsel teyidi ve B2 (oy sayısı) rozetinin gerçek Trakt verisiyle görünümü — bu ortamda cihaz/Trakt erişimi yok, APK'da bakılmalı.

**KALICI KURAL EKLENDİ (`docs/AI_RULES.md` → yeni "2.5. Ölü Kod ve Refactor Hijyeni" bölümü):** Kullanıcının talebi üzerine bu turun dersleri kalıcı kurala dönüştürüldü: (1) bir mantık taşındığında eski kopya AYNI değişiklikte silinir — state/handler/stil/çeviri/import hepsi birlikte; (2) silmeden önce OTOPSİ zorunlu (taşınmış mı / bilinçli değiştirilmiş mi / **kazara kopmuş mu** — üçüncüsü gerçek kayıp özelliktir, silinmez, geri bağlanır); (3) ölü kod yalnızca `tsc --noUnusedLocals` ile aranır, `grep` ile aranmaz (namespace önekli/dinamik anahtarları kaçırıp canlı kodu sildirir); (4) sessiz başarısızlık yasağı da "Error Handling" bölümüne eklendi.

## 105. Madde 104'ün İki Pürüzü Giderildi: `MovieCardMobile` Zombi State'i Tam Kazındı + Arama Çevirisi İçin TMDB Yolu REDDEDİLDİ

**Bildiren:** Kullanıcı, Madde 104'teki temizliği inceleyip iki isabetli itiraz getirdi.

**1) `MovieCardMobile` — yarım kalmış temizlik (zombi state):** Madde 104'te `setIsLoading` ölü olduğu için kaldırılmış ama `isLoading` "hâlâ okunuyor" gerekçesiyle salt-okunur bırakılmıştı (`const [isLoading] = useState(false);`). Kullanıcının tespiti doğru: **setter'ı olmayan bir React state, tanım gereği sonsuza dek başlangıç değerinde kalan bir zombidir.** "Davranış aynı, sıfır risk" değerlendirmesi teknik olarak doğruydu ama temizlik yarım kalmıştı — ki bu, aynı turda `docs/AI_RULES.md`'ye eklenen "ölü kod bırakmak yasaktır / state-handler-stil-import hepsi birlikte temizlenir" kuralının kendisine aykırıydı.

**Zincirin tamamı kazındı:** (a) `const [isLoading] = useState(false)` state'i silindi; (b) `handleCheckIn`'deki `if (busyRef.current || isLoading || isSuccess)` guard'ı `if (busyRef.current || isSuccess)`'e indirildi — çift-dokunuş koruması zaten `busyRef`'e dayanıyor (state güncellemesi asenkron olduğundan hızlı iki dokunuşu kaçırırdı, ref bu yüzden eklenmişti); (c) `MovieCardActions`'ın `isLoading` prop'u arayüzünden ve destructure'ından silindi; (d) o prop'a bağlı `ActivityIndicator` dalı (hiç render edilmeyen spinner) kaldırıldı, buton doğrudan `<Check/>` render ediyor; (e) `disabled={isLoading || isSuccess}` → `disabled={isSuccess}`; (f) öksüz kalan `ActivityIndicator` import'u da silindi. **Davranış değişmedi** çünkü `isLoading` zaten kalıcı olarak `false`'tu: spinner ASLA görünmüyordu ve görünse bile "izledim" akışında isteği beklemeden başlayan başarı çapraz geçişinin (crossfade) altında kalırdı. Nedeni koda kalıcı bir not olarak yazıldı.

**2) Arama sonuçlarının çevirisi — TMDB yolu DEĞERLENDİRİLDİ ve REDDEDİLDİ:** Madde 104'te, Trakt'ın `/search/:type` uç noktasının `translations` parametresini desteklemediği doğrulandıktan sonra alternatif olarak "TMDB'de `language=tr-TR` ile arayıp sonuçları Trakt ID'lerine eşlemek" önerilmişti. Kullanıcı bunu **aşırı mühendislik (over-engineering)** olarak değerlendirip reddetti ve gerekçeleri kabul edildi: her arama için ek bir servis çağrısı + N adet ID eşleme isteği demek olurdu — mimariyi hantallaştırır, Trakt/TMDB rate limit'lerini zorlar ve aramanın hızını düşürürdü. **Kabul edilen davranış:** arama sonuçları İngilizce kalır; kullanıcı içeriğin DETAYINA girdiğinde başlık/özet zaten Türkçe geliyor (`shows.ts`/`movies.ts` → `applyTranslation`) ve bu yeterlidir. Karar, gerekçesiyle birlikte `services/api/search.ts`'in başına kalıcı bir not olarak yazıldı ("bu notu silmeden önce yukarıdaki gerekçeyi yeniden değerlendirin") — ileride aynı fikrin tekrar gündeme gelip sessizce uygulanmasını önlemek için.

**Doğrulama:** `npx tsc --noEmit` → 0 hata. `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` → 0 hata (kod tabanında hâlâ sıfır kullanılmayan yerel/import). Release APK yeniden derlendi → BUILD SUCCESSFUL. **Doğrulanamayan:** Film kartındaki "izledim" akışının gerçek cihazda görsel teyidi (bu ortamda cihaz/Trakt erişimi yok) — beklenen davranış değişmemesidir; APK'da bir kez teyit edilmeli.

## 106. Sürüm Güncellemesi: 1.1.2

**Bağlam:** Kullanıcının talimatı üzerine uygulamanın sürüm numarası `1.1.2` olarak güncellendi.
- `package.json`: `"version": "1.1.2"`
- `app.json`: `"version": "1.1.2"`
- `app/(protected)/account.tsx`: fallback sürüm `'1.1.2'`
- `npx tsc --noEmit` ile doğrulandı.

## 117. APK İndirme Sayfası (`download.web.tsx`) Tasarımsal Yenileme & Çapraz Ekran Duyarlılığı (Responsive 2-Column)

**Bağlam:** Kullanıcı `download` klasörü/sayfası için APK indirme linkinin virüs linki gibi değil, resmi, son derece şık, güvenli ve modern bir uygulamanın indirme sayfası gibi görünmesini istedi. Ardından dar mobil görünümünün masaüstü geniş ekranlarda (1280px+) küçük kalması üzerine geniş ekranlara özel responsive 2 sütunlu düzen istendi. Son olarak, "Resmi ve Virüssüz" ifadesinin aksine gereksiz şüphe uyandırabileceği gerekçesiyle kaldırılması ve indirme butonlarının göz yormayan, daha mat ve şık bir renge çekilmesi istendi.

**Uygulama:**
- `app/(public)/download.web.tsx` masaüstü & mobil duyarlı (responsive) olacak şekilde yenilendi:
  - **Duyarlı Düzen (`isDesktop` = width ≥ 868px):**
    - Masaüstünde geniş 2 sütunlu düzen (`maxWidth: 1040px`, `flexDirection: 'row'`, `gap: 40px`).
    - **Sol Sütun:** Sade kategori rozeti ("Android APK İndirme"), uygulama başlığı & ikonu, mat şık indirme butonu, teknik metrikler izgarası (Boyut, Android 8.0+, GitHub Release) ve "Android Yükleme Bilgisi" kutusu.
    - **Sağ Sütun:** Sürüm notları (`v1.1.2` Changelog) ve varsayılan olarak açık tutulan 3 Adımda Kolay Kurulum Rehberi.
  - **Mobil Düzen (width < 868px):**
    - Mobil ekranlar için dikey 1 sütunlu dikey layout (`maxWidth: 520px`), akordiyon kurulum rehberi ve dikey sıralama korundu.
  - **Ton ve Görsel İyileştirmeler (Sade & Şık):**
    - Şüphe uyandıran "Resmi & Virüssüz" metni tamamen kaldırıldı, yerine sade `Android APK İndirme` rozeti kondu.
    - Parlak neon mavi/kırmızı buton ve parlak gölgeler kaldırıldı; yerine gözü yormayan, mat lacivert/mavi gradyan (`#2563eb` -> `#1d4ed8`) ve ince şeffaf kenarlık eklendi.
    - Ortam ışıkları (ambient glow) parlaklığı düşürüldü.
    - Metrik kartlarındaki **"GitHub Release"** alanı tıklanabilir hale getirildi (`ExternalLink` ikonu eklendi); tıklandığında kullanıcının doğrudan GitHub Release (`/tag/beta`) sayfasına gitmesi sağlandı.
- `npx tsc --noEmit` ile doğrulandı (0 hata).

## 118. Sürüm Güncellemesi: 2.0.0

**Bağlam:** Kullanıcının talimatı üzerine uygulamanın sürüm numarası `2.0.0` olarak güncellendi.
- `package.json`: `"version": "2.0.0"`
- `app.json`: `"version": "2.0.0"`
- `app/(protected)/account.tsx`: fallback sürüm `'2.0.0'`
- `app/(public)/download.web.tsx`: `CURRENT_VERSION = 'v2.0.0'`
- `npx tsc --noEmit` ile doğrulandı (0 hata).










## 106. Performans Raporu Analizi — 4 Bulgudan 3'ü Düzeltildi (Timeout Eksikliği, Üçlü İstek Tekrarı, Metrik Kardinalite Patlaması)

**Bildiren:** Kullanıcı 8 saatlik bir performans raporu (`exportMetricsReport` çıktısı) paylaşıp "hız sorunları oldu sanırım, bir bak" dedi.

**Önce bir okuma uyarısı:** Rapordaki `p95`/`p99` değerleri (`utils/metrics.ts:estimatePercentile`) sabit histogram kovalarından (100/500/1000/5000/30000ms) DOĞRUSAL ENTERPOLASYONLA tahmin ediliyor — ham değerler saklanmıyor. Son kovaya (`30000+`) düşen ölçümler için gerçek üst sınır bilinmediğinden fonksiyon o kovanın ALT sınırını (`30000`) döndürüyor; bu bir tahmin değil, "gerçek değer 30sn'den büyük" anlamına gelen bir sinyal. Rapordaki `p50: 1800 > max: 1690` gibi matematiksel olarak imkânsız görünen satırlar da bu enterpolasyonun bir artefaktı. **Anlamlı olanlar `count`/`min`/`p50`/`max`'tır** — bunlara bakıldığında normal durumda uygulama HIZLI (`p50` çoğu uç noktada 300-500ms); asıl sorun ortalamada değil, kuyruktaki (tail) uç değerlerdeydi.

**BULGU 1 (🔴 en kritik, düzeltildi) — `traktClient.ts`'te HİÇ `timeout` yoktu:** Projedeki diğer TÜM HTTP istemcileri (`feedPrivacy.ts`, `feedSync.ts`, `accountDeletion.ts`, `services/api/feedback.ts`) 10-15sn timeout kullanırken, uygulamanın TÜM Trakt trafiğini taşıyan bu istemci korumasızdı. Zincirleme etki: `requestQueue`'nun eşzamanlılık sınırı 3 (`requestQueue.ts:30`); timeout olmadan asılı kalan BİR istek bu 3 slottan birini SÜRESİZ tutar; üç istek asılırsa kuyruktaki her şey görünürde donar (5 dakikalık deadline'a kadar hiç ilerlemez). Devre kesici de bu senaryoda hiç devreye giremez çünkü `onFailure()` yalnızca istek GERÇEKTEN başarısız/timeout olduğunda çağrılır. Raporda `10:00` saatinde dört farklı uç noktanın aynı anda ~130 saniyeye çıkması (`130196`, `130171`, `131862`, `130095`) bu boşluğun izidir — dört bağımsız yavaş istek değil, muhtemelen tek bir "ağ askıda kaldı, hiçbir şey kopmadı" olayı. **Çözüm:** `axios.create({...})`'e `timeout: 20000` eklendi (p99 ~5sn'nin kat kat üstünde ama süresiz beklemeyi imkânsız kılacak kadar kısa).

**BULGU 2 (🟡 orta, düzeltildi) — `/users/me/lists` senkron başına 3 KEZ çekiliyordu:** Rapor 75 çağrı gösteriyordu (25 senkron × 3). Sebep: `fetchFreshData`'nın TIER3'ünde `getCustomLists()` + `getLikedShows()` + `getLikedMovies()` AYNI `Promise.all` turunda tetikleniyor; `getLikedShows`/`getLikedMovies` de kendi içlerinde `getOrCreateLikedList()`'i çağırıp AYRI birer `GET /users/me/lists` atıyordu — üçü de aynı, değişmeyen veriyi (Beğenilenler listesinin ID'si) çekiyordu. **Çözüm:** `services/api/users.ts`'e token-bazlı bir önbellek + eşzamanlı çağrı birleştirme (in-flight request dedup) eklendi: (a) liste ID'si `cachedLikedListId` + `cachedForAccessToken` ile önbelleğe alınır — hesap değişirse (SecureStore'daki token farklıysa) önbellek OTOMATİK geçersiz sayılır, elle bir "logout'ta temizle" bağlantısı gerekmez; (b) `Promise.all` içindeki eşzamanlı çağrılar `inFlightListLookup` ile TEK bir ağ isteğini paylaşır; (c) liste kullanıcı tarafından Trakt.tv'den elle silinmişse (404) önbellek bir kez temizlenip TEK seferlik yeniden denenir (`withLikedListId` ortak sarmalayıcısı, `getLikedShows`/`getLikedMovies`/`toggleLikedMedia`'nın üçü de kullanıyor).

**BULGU 3 (⚪ düşük ama gerçek, düzeltildi) — metrik/devre kesici anahtarı sınırsız büyüyordu:** Raporda `api.latency./users/Kimi%20ile%20sohbetinizi%20g%C3%B6r%C3%BCnt%C3%BClemek...` gibi bir satır vardı — kullanıcı arama kutusuna bir Kimi sohbet linki yapıştırmış ve bu KALICI bir metrik anahtarı olmuştu. Sebep: `normalizeEndpointKey` (`utils/circuitBreaker.ts`) yalnızca SAYISAL path segmentlerini `:id`'ye normalize ediyordu; `/users/{kullanıcı_adı}` gibi (bkz. `services/api/social.ts`: `getUserProfile`, `getFollowers`, `getFollowing`) rastgele string segmentler her çağrıda YENİ bir anahtar üretiyordu. Bu yalnızca metrik depolamasını değil, `CircuitBreaker` registry `Map`'ini de (hiç temizlenmiyor) sınırsız büyütüyordu — VE asıl korumayı da işlevsiz kılıyordu: `/users/{sorunlu-kullanıcı}` art arda 5 kez başarısız olsa bile her denemede FARKLI bir kullanıcı adıyla geldiğinden breaker hiçbir zaman art arda hata SAYAMIYOR, devre asla açılamıyordu. **Çözüm:** `normalizeEndpointKey`'e `/users/<segment>` için ek bir normalize kuralı eklendi — `me`/`hidden` gibi BİLİNEN SABİT alt yollar (kod tabanındaki gerçek kullanım taranarak tespit edildi) korunur, geri kalan HER ŞEY `/users/:user`'a indirgenir.

**BULGU 4 (🟡 orta, DÜZELTİLMEDİ — kullanıcı kararı bekleniyor):** Madde 101'de eklenen `AppState` dinleyicisi her foreground geçişinde `fetchFreshData(token, force=true)` çağırıp 10 dakikalık TTL'i tamamen atlıyor; rapor 8 saatte 25 tam senkron gösteriyor. Bu kullanıcının test davranışıyla (sık sık arka plana atıp geri getirme) tutarlı olsa da, günlük kullanımda pil/veri maliyeti yaratabilir. Üç seçenek sunuldu (A: olduğu gibi bırak, B: foreground'da yalnızca `syncHiddenLists` — hafif, C: kısa bir minimum aralıkla tam senkron) — kullanıcının tercihi bekleniyor, kod tabanına henüz dokunulmadı.

**Doğrulama:** `npx tsc --noEmit` → 0 hata. `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` → 0 hata. **İki ayrı test paketi gerçekten çalıştırıldı:** (1) GERÇEK `utils/circuitBreaker.ts` derlenip doğrudan test edildi — 17/17 geçti, rapordaki sızan anahtarın artık `/users/:user`'a düştüğü, `me`/`hidden`'ın korunduğu, sayısal ID normalizasyonunun bozulmadığı VE devre kesicinin artık gerçekten birikebildiği (5 "farklı kullanıcı" başarısızlığından sonra devre açılıyor — eskiden asla açılamıyordu) doğrulandı. (2) `getOrCreateLikedList`/`withLikedListId` mantığının sahte SecureStore + sahte Trakt client ile izole edilmiş kopyası — 10/10 geçti: 3 eşzamanlı çağrının TEK ağ isteğine indiği, hesap değişiminin önbelleği otomatik geçersiz kıldığı, liste-yoksa-oluştur akışının bozulmadığı doğrulandı. Release APK yeniden derlendi → BUILD SUCCESSFUL. **Doğrulanamayan:** Gerçek bir ağ askıda kalma senaryosunda 20sn timeout'un devreye girdiğinin canlı teyidi (bu ortamda Trakt ağ erişimi yok) — cihazda (özellikle zayıf sinyal altında) gözlemlenmeli.

## 107. Madde 106'nın Açık Kalan 3. Sorusu Çözüldü: `force=true` → `force=false` — Tek Parametre Değişikliğiyle Hem Gecikmesiz Hem Spamsız

**Bağlam:** Madde 106'da kullanıcıya cross-device senkron davranışı için A/B/C seçenekleri sunulmuştu. Kullanıcının cevabı iki görünüşte çelişkili isteği içeriyordu: **"cihazlar arası gecikme pek istediğim bir durum değildir"** (yani B/C'nin getirdiği gecikmeyi istemiyor) AMA **"pil ve performans ta önemli, sistemi yormayacak ve spama yol açmayacak"** (yani A'nın her foreground'da tam senkron yapan maliyetini de istemiyor).

**Çözüm — yeni bir throttle mekanizması EKLEMEDEN, mevcut mimariyi yeniden okumak:** Madde 102'de eklenen `syncHiddenLists(accessToken)` çağrısı, `fetchFreshData` içinde `force`/TTL kontrolünden **ÖNCE**, KOŞULSUZ çalışacak şekilde tasarlanmıştı (o zamanki amaç farklıydı: tam senkron atlansa bile "Bırak" durumunun tazelenmesini garanti etmek). Bu, tam olarak kullanıcının şimdi istediği şeyi **zaten yapıyordu** — fark edilmemişti. `context/LibraryContext.tsx`'teki `AppState` dinleyicisinde tek satırlık bir değişiklik yapıldı: `fetchFreshData(accessToken, **true**)` → `fetchFreshData(accessToken, **false**)`.

**Sonuç:**
- **"Bırak" (hide/unhide) senkronu HİÇBİR gecikme almadı** — `syncHiddenLists` `force`'tan bağımsız olduğu için her foreground geçişinde (uygulamalar arası en hızlı geçişte bile) iki hafif `GET` isteğiyle anında tazeleniyor.
- **Ağır ~15 uç noktalı tam senkron (izleme geçmişi, puanlar, listeler, takvim, favoriler) artık 10 dakikalık TTL'e tabi** — kullanıcı bildirim kontrolü için uygulamalar arasında saniyeler içinde geçiş yapsa bile her seferinde tetiklenmiyor, pil/veri harcamıyor.
- `force=true` kullanılsaydı (Madde 101'in orijinal hâli) "Bırak" için zaten gereksiz olan bu ağır senkron da her foreground'da tetiklenir, kullanıcının açıkça istemediği "spam" davranışını üretirdi.

Yeni bir throttle/debounce mekanizması, ek bir zamanlayıcı ya da ek bir state İNŞA EDİLMEDİ — mevcut, zaten test edilmiş iki mekanizma (`syncHiddenLists`'in koşulsuzluğu + `SYNC_INTERVAL` TTL kapısı) birbirini tamamlayacak şekilde yeniden bir araya getirildi. Bu, en düşük riskli ve en az kod ekleyen çözümdü.

**Doğrulama:** `npx tsc --noEmit` → 0 hata. `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` → 0 hata. `fetchFreshData`'nın dallanma sırasının (syncHiddenLists → TTL kontrolü → ağır senkron) BİREBİR kopyasıyla **4 senaryolu bir test** çalıştırıldı (hepsi geçti): kullanıcı 2 dakikada bir 9 kez uygulamalar arası geçiş yaptığında "Bırak" senkronunun 9 defasının da (gecikmesiz) çalıştığı AMA ağır senkronun yalnızca gerçekten TTL dolduğunda (9'da 2) tetiklendiği; aynı senaryoda `force=true` olsaydı ağır senkronun 9'da 9 (spam) çalışacağı karşılaştırmalı olarak kanıtlandı; gerçekten uzun süre sonra (15dk, TTL'i aşan) dönüldüğünde ağır senkronun da doğru şekilde geri geldiği (staleness'ın kaçırılmadığı) doğrulandı. Release APK yeniden derlendi → BUILD SUCCESSFUL. **Doğrulanamayan:** Gerçek iki cihazla uçtan uca (bu ortamda ikinci cihaz + Trakt ağ erişimi yok) — kullanıcının kendi ortamında hem "Bırak"ın gecikmesiz hem günlük kullanımda pil/veri tüketiminin makul kaldığının teyidi gerekiyor.

## 108. Profil › Aktiviteler'de Kalıcı Silme (Tekil + Toplu) — Worker'a Yönlendirilen Mimari Kararı

**İstek:** Kullanıcı, Profil › Aktiviteler sekmesinde kendi aktivitelerini (tekil kaydırarak/hover ile veya "Düzenle" moduyla toplu seçip) kalıcı olarak silebilmesini istedi; orijinal tasarım `feedApi.ts`'in Supabase'e RLS ile korunan doğrudan bir `DELETE` atmasını öngörüyordu.

**Sorun (mimari uyuşmazlık):** Bu proje **Supabase Auth kullanmıyor** (kimlik doğrulama yalnızca Trakt OAuth üzerinden yürüyor — bkz. `supabase/schema/001_feed_schema.sql`'in en tepesindeki not). Bu yüzden `auth.uid()` her istekte boş döner ve RLS, "bu isteği gerçekten hangi kullanıcı attı" sorusunu asla cevaplayamaz — anon key'li her client Supabase'in gözünde aynı "anonim" roldedir. Client'tan doğrudan `DELETE`'e izin veren bir RLS politikası açmak, herhangi bir kullanıcının başka bir kullanıcının `user_id`/`activityId`'sini uydurup onun aktivitesini silebilmesine yol açardı — klasik bir IDOR açığı. Mevcut tüm yazma uçları (`feedSync.ts`, `feedPrivacy.ts`, `accountDeletion.ts`) zaten bu yüzden ayrı bir Cloudflare Worker'a (`kaymaktv-feedback-worker`, yerelde `C:\Yapay_Zeka_Uygulamalar\kaymaktv-feedback-worker`) yönlendiriliyor.

**Çözüm:** Aynı desen tekrarlandı — doğrudan client-side Supabase yazımı YAPILMADI.
- **Worker (`kaymaktv-feedback-worker/src/index.js`):** `POST /feed/delete` uç noktası eklendi. `verifyAndUpsertUser` ile Trakt token doğrulanıp gerçek `userId` çözülüyor; `activityIds` sıkı bir UUID regex'iyle doğrulanıyor (id'ler doğrudan PostgREST'in `id=in.(...)` URL filtresine gömüldüğü için doğrulamasız enjeksiyon riski taşırdı); silme her zaman `user_id=eq.{doğrulanan kullanıcı}` ile de kısıtlanıyor (ikinci savunma katmanı — başka bir kullanıcının id'si gönderilse bile o satır eşleşmediği için silinmiyor). IP başına 20/dk rate limit + 50 id/istek üst sınırı eklendi. **NOT: Bu repo git ile izlenmiyor ve canlı bir Cloudflare Worker'ı barındırıyor — kod yerelde güncellendi, `wrangler deploy` ile canlıya alınması ayrıca kullanıcı onayına bırakıldı.**
- **`features/feed/services/feedApi.ts`:** `deleteActivity(traktAccessToken, activityId)` ve `deleteActivitiesBulk(traktAccessToken, activityIds)` eklendi — `feedSync.ts` ile birebir aynı axios+Worker deseni.
- **`features/feed/types.ts`:** `MarathonActivity`'e `originalActivityIds: string[]` eklendi. Maraton kartının `id`'si sentetik bir bileşik anahtar (`marathon-{userId}-{showId}-{lastTime}`) olduğu için, kart silinmek istendiğinde gruplanan TÜM ham `feed_activities` satırlarının gerçek id'lerine ihtiyaç var — `groupMarathonActivities.ts`'teki `buildMarathon` bunu artık dolduruyor.
- **UI:** Yeni `react-native-gesture-handler` bağımlılığı **bilinçli olarak eklenmedi** (kullanıcı native rebuild istemedi) — `features/feed/components/ActivityDeleteRow.tsx` mobildeki "sola kaydır → kırmızı çöp kutusu belirir → dokunup sil" davranışını salt React Native'in yerleşik `PanResponder`+`Animated` API'leriyle inşa ediyor. Web'de kaydırma tamamen devre dışı, bunun yerine kartın sağ üstünde sabit görünen bir çöp kutusu ikonu var. Aynı bileşen, seçim modunda (`isSelectionMode`) sola kaydırma/hover-sil yerine bir onay kutusu render ediyor. `FeedCard`/`MarathonFeedCard`'a eklenen `isSelectionMode`/`isSelected`/`onToggleSelect`/`onDelete` proplarının hepsi **opsiyonel** — `onDelete` verilmezse kart eskisi gibi davranıyor, bu sayede takip edilen kişilerin aktivitelerini gösteren ana Akış (`feed.tsx`) ekranı hiç etkilenmedi.
- **`features/feed/hooks/useUserActivity.ts`:** `deleteItem`/`deleteItems` eklendi — Optimistic UI (state'ten anında kaldır, hata olursa geri al + `Alert` ile bildir), misafir kullanıcı guard'ı (`isGuest`/`accessToken` yoksa istek hiç atılmadan engellenir).
- **`components/profile/ProfileActivityTab.tsx`:** "Düzenle"/"Bitti" başlık butonu, seçim state'i, ve gerçekten viewport'a sabit kalan bir "Seçilenleri Sil (N)" alt bar (bu, `ProfileActivityTab`'ın kendi dış `ScrollView`'unu kontrol etmediği için `position: absolute` yerine `Modal` ile çözüldü).
- Onay penceresi için (`Alert.alert` / `window.confirm`) tek bir `features/feed/utils/confirmDialog.ts` yardımcı fonksiyonu yazıldı — hem tekil (kaydırma/hover) hem toplu silme aynı fonksiyonu kullanıyor.

**Doğrulama:** Worker tarafında `node --check src/index.js` → sözdizimi geçerli. Kaymak tarafında `npx tsc --noEmit` çalıştırıldı (bkz. bir sonraki madde/commit). **Doğrulanamayan:** Mobildeki gerçek dokunmatik swipe jesti bu ortamda (tarayıcı önizlemesi, dokunmatik ekran yok) test edilemedi — kullanıcının kendi cihazında denemesi gerekiyor. Worker `wrangler deploy` ile henüz canlıya alınmadı.

## 109. Madde 108'i Test Ederken Ortaya Çıkan Ayrı Bir Bug: "Gizlenenler" Web'de CORS'a Takılıyormuş (`/users/hidden/*`)

**Bildiren:** Kullanıcı Madde 108'in web build'ini (`node server.js`, `localhost:4830`) test ederken konsolda şu hatayı paylaştı: `Access to XMLHttpRequest at 'https://api.trakt.tv/users/hidden/progress_watched?...' from origin 'http://localhost:4830' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present`. Aynı hata `/users/hidden/calendar` için de vardı. Bu, Madde 108'deki aktivite silme özelliğiyle İLGİSİZ — hiçbir dosyası bu oturumda değiştirilmemişti.

**Teşhis:** `services/api/users.ts`'teki `getAllHiddenItems` (→ `getHiddenShows`/`getHiddenMovies`) ve `hideItemTrakt`/`unhideItemTrakt`, tüm diğer Trakt çağrıları gibi `getTraktClient()` ile TARAYICIDAN doğrudan `https://api.trakt.tv/users/hidden/*`'e gidiyordu. Bu proje zaten `/api/trakt` (OAuth) ve `/api/tmdb` için AYNI CORS sorununu `server.js`'teki bir Express proxy'siyle çözmüştü (bkz. `services/api/auth.ts`'teki not: "client secret istemciye asla gömülmez... /api/trakt proxy'sine gidilir") — ama `/users/hidden/*` o zaman bu deseni almamıştı, muhtemelen çünkü Madde 99'da (Web/APK uyumsuzluğu araştırması) paylaşılan tek kanıt (`/users/me` 401 kaydı) bu özellikle ilgisiz çıkmış ve gerçek kök neden (CORS) o oturumda hiç ortaya çıkmamıştı.

**Neden yalnızca bu ikisi (diğer Trakt uç noktaları çalışırken):** Kesin olarak doğrulanamadı (bu ortamdan Trakt'ın sunucu tarafı CORS/WAF davranışına görünürlük yok) — ama gözlemlenen davranışla tutarlı en olası açıklama, Trakt'ın `/users/hidden/*` ailesi için OPTIONS preflight'ına `Access-Control-Allow-Origin` başlığı hiç eklemediği. Kanıt: `/shows/trending` gibi başka bir uç nokta, AYNI `getTraktClient()` header setiyle (aynı `trakt-api-version`/`trakt-api-key`/`Content-Type`) sorunsuz çalışıyor.

**Çözüm — mevcut `/api/trakt`/`/api/tmdb` proxy deseninin TEKRARI, yeni bir mimari icat edilmedi:**
- `server.js`'e `GET /api/trakt-proxy` ve `POST /api/trakt-proxy` eklendi — `endpoint` query param'ıyla hangi Trakt yoluna gidileceğini alıp sunucu-sunucu (`axios`, CORS'a hiç tabi değil) istek atıyor, `x-pagination-page-count` başlığını (`getAllHiddenItems`'ın sayfalama için okuduğu) yanıtta koruyor. **Token URL/query string'e KONULMADI** (kalıcı sunucu log izi bırakabileceği için — bkz. genel privacy kuralı) — bunun yerine isteğin kendi `Authorization` başlığından okunup olduğu gibi Trakt'a iletiliyor.
- `services/api/users.ts`: `getAllHiddenItems`, `hideItemTrakt`, `unhideItemTrakt` artık `getTraktClient()` yerine bu proxy'yi (`TRAKT_PROXY_URL` — `EXPO_PUBLIC_API_URL` tanımlıysa mutlak, değilse göreli, `services/api/auth.ts`'teki desenle BİREBİR aynı) kullanıyor. **`hideItemTrakt`/`unhideItemTrakt` kullanıcı hiç raporlamadan da düzeltildi** — aynı `/users/hidden/*` ailesine aynı header setiyle POST attıkları için aynı CORS reddine düşecekleri neredeyse kesindi; yalnızca okuma (GET) tarafını düzeltip yazma (POST, "İzlemeyi Bırak" butonunun kendisi) tarafını bozuk bırakmak yarım bir çözüm olurdu.
- `services/api/auth.ts`'teki **"BU KOŞULA `Platform.OS` KONTROLÜ EKLEMEYİN" uyarısına (Madde 91) aynen uyuldu** — `TRAKT_PROXY_URL` seçimi native/web ayrımı yapmadan her platformda aynı mantıkla çalışıyor.

**Doğrulama:** `node --check server.js` → sözdizimi geçerli. `npx tsc --noEmit` → 0 hata. Sunucu gerçekten (boş bir portta) ayağa kaldırılıp **canlı Trakt API'sine karşı** test edildi: (1) `GET /api/trakt-proxy?endpoint=/shows/trending&limit=2` → gerçek Trakt verisiyle `200`, sunucu-sunucu isteğinin CORS'a hiç takılmadığı kanıtlandı; (2) `GET /api/trakt-proxy?endpoint=/users/hidden/progress_watched...` (token'sız) → Trakt'tan gelen gerçek `401` düzgünce client'a yansıdı (çökme yok, sessiz yutma yok). **Doğrulanamayan:** Gerçek bir kullanıcı token'ıyla uçtan uca (bu ortamda gerçek bir Trakt oturumu yok) — kullanıcının kendi hesabıyla web'de "Gizlenenler" listesinin artık yüklendiğini ve "İzlemeyi Bırak"ın web'de çalıştığını doğrulaması gerekiyor. Ayrıca bu değişiklik yalnızca YEREL `server.js` dosyasında — üretimdeki `kaymaktv.com` sunucusuna (kullanıcının deyimiyle bir Raspberry Pi üzerinde çalışıyor) deploy edilmedi, kullanıcının kendi güncelleme/yeniden başlatma sürecini uygulaması gerekiyor.

## 110. Madde 108'in İki Kalan Kusuru: Web'de Sil İkonu Her Zaman Görünüyordu + Silinen Aktivite Senkronda Geri Geliyordu

**Bildiren:** Kullanıcı Madde 108/109'u test ettikten sonra iki şey bildirdi: (1) web'de çöp kutusu ikonu her zaman görünüyor, yalnızca fare üzerine gelince (hover) görünmeli; (2) bir aktiviteyi hem tekil (sil ikonu) hem toplu (Düzenle → Seçilenleri Sil) yoldan silmeyi denedi, ikisinde de sayfa yenilenince aktivite GERİ GELDİ. Kullanıcının beklentisi net: "supabaseden tutuyorsak ordan da silinmeli çünkü kullanıcı siliyorsa bize her yerden silinmesi için güveniyordur."

**1) Hover sorunu — basit düzeltme:** `ActivityDeleteRow.tsx`'in web dalı, Madde 108'de TypeScript'in `View`'a `onMouseEnter`/`onMouseLeave` tipini tanımaması yüzünden bilinçli olarak "her zaman görünür" yapılmıştı. Kod tabanında zaten bu tam sorunu çözen bir desen vardı (`components/web/WebCarousel.tsx`: `// @ts-ignore - Web specific` + `onMouseEnter`/`onMouseLeave`) — **aynı desen** burada da uygulandı: `isHovered` state'i eklendi, ikon yalnızca `isHovered && (...)` iken render ediliyor.

**2) Silinen aktivitenin geri gelmesi — asıl kök neden, Madde 108'in mimarisiyle İLGİSİZ bir başka sistemin (senkron) yan etkisi:** `handleFeedDelete` (Madde 108) `feed_activities`'ten satırı GERÇEKTEN kalıcı olarak siliyor — bu doğru çalışıyordu. Ama `handleFeedSync` (feed_activities'i Trakt'la senkron tutan, bu özellikten tamamen bağımsız ÖNCEDEN VAR OLAN kod), her çalıştığında Trakt'tan çektiği izleme geçmişi/puanları `feed_activities`'teki MEVCUT satırlarla karşılaştırıp farkı (Trakt'ta olup bizde olmayanı) "yeni" sayıp ekliyor. Kullanıcı bir aktiviteyi sildiğinde, o satık artık "mevcut" değil — ama Trakt'taki asıl izleme/puanlama olayı hâlâ duruyor (silme yalnızca KaymakTV'nin kendi kopyasını kaldırıyor, Trakt'a hiç dokunmuyor). Sonuç: bir sonraki `/feed/sync` (sayfa yenilendiğinde/uygulama yeniden açıldığında tetikleniyor) bu "eksik" satırı Trakt'tan tekrar okuyup SESSİZCE GERİ EKLİYORDU. Kullanıcının "kalıcı silme" + "her yerden silinmeli" isteği ile mevcut sync'in "Trakt = tek doğruluk kaynağı, aradaki farkı her zaman KaymakTV'ye kopyala" mantığı doğrudan ÇATIŞIYORDU.

**Çözüm — Tombstone (silme kaydı) tablosu, soft-delete'e GERİ DÖNÜLMEDEN:** Kullanıcının orijinal isteği açıkça "Soft delete/gizleme DEĞİL, veritabanından kalıcı silme" idi — bu yüzden `feed_activities`'e bir `deleted_at` sütunu eklemek (en basit çözüm) REDDEDİLDİ, çünkü satır DB'de fiziksel olarak kalmaya devam ederdi. Bunun yerine `feed_activities`'ten TAMAMEN AYRI, yeni bir `deleted_feed_activities` tablosu eklendi (bkz. `supabase/schema/010_deleted_feed_activities.sql`, Kaymak reposu) — yalnızca "hangi (kullanıcı, olay) kombinasyonu bilinçli olarak silindi" bilgisini tutan bir kayıt (tombstone), asıl aktivite verisi değil:
- `handleFeedDelete` (worker), `feed_activities`'ten DELETE ettiği satırların (zaten `Prefer: return=representation` ile geri dönüyordu) `activity_type`/`show_id`/`episode_number`/`activity_at` bilgisiyle `deleted_feed_activities`'e bir tombstone yazıyor.
- `handleFeedSync`, `existing` (mevcut satırlar) sorgusunun yanına `fetchDeletedActivities` ile bu tombstone'ları da okuyup aynı `watchedKey` (show_id|episode_number|activity_at) ve `show_id` (rated için) anahtarlarıyla `newWatchedRows`/`ratedToInsert` filtrelerine ekliyor — Trakt'ta hâlâ duran bir olay, tombstone'u varsa artık ASLA geri eklenmiyor.
- **Fail-soft tasarım (kasıtlı):** Hem `fetchDeletedActivities` hem tombstone INSERT'i, `deleted_feed_activities` tablosu henüz oluşturulmamışsa (migration çalıştırılmadan worker deploy edilirse) hatayı yalnızca LOGLAYIP sessizce devam ediyor — TÜM kullanıcıları etkileyen kritik `/feed/sync` yolunu kırmıyor. Bu, iki ayrı sistemde (Supabase migration + Cloudflare Worker deploy) kesin bir sıralama gerektirmeden güvenli bir kademeli devreye alma sağlıyor: migration ne zaman çalıştırılırsa çalıştırılsın, ek bir worker deploy'una gerek kalmadan bir sonraki sync'ten itibaren devreye giriyor.
- **Bilinçli sınırlama (rated):** Puanlamalar Trakt'ta show_id başına TEK kayıt olduğundan tombstone da yalnızca `show_id`'ye göre kontrol ediyor — kullanıcı sildiği bir puanlamayı Trakt'ta yeniden puanlarsa (rating DEĞİŞİRSE) bu zaten `prev` mevcut olduğu normal UPDATE yoluna girer (tombstone'dan etkilenmez); yalnızca "hiç değişmeden sessizce geri gelme" senaryosu engellenir. Aşırı mühendislik yapılmadı.

**Doğrulama:** `node --check src/index.js` (worker) → sözdizimi geçerli. Kaymak tarafında `npx tsc --noEmit` → 0 hata. **Doğrulanamayan:** (a) Gerçek bir kullanıcı hesabıyla uçtan uca silme→senkron→geri gelmeme akışı (bu ortamda gerçek Trakt oturumu/Supabase yazma erişimi yok); (b) hover ikonunun gerçek fare davranışı. **KULLANICI TARAFINDAN YAPILMASI GEREKENLER:** (1) `supabase/schema/010_deleted_feed_activities.sql`'i Supabase Dashboard → SQL Editor'de çalıştır; (2) `kaymaktv-feedback-worker`'ı `wrangler deploy` ile yeniden yayınla (bu oturumda yalnızca yerel dosya güncellendi); (3) Kaymak web build'ini (`expo export` + `dist/`) yeniden üretip hem yerel `node server.js`'i hem `kaymaktv.com`'daki üretim sunucusunu yeniden başlat — aksi halde ne CORS/hover düzeltmesi ne de bu madde tarayıcıda görünür.

## 111. Activity Delete Feature Paused and UI Hidden

**Karar:** Kullanıcı, Madde 108-110'da kurulan silme mimarisinin (Tombstone tablosu) kalıcı çözüm mü yoksa Soft Delete/Delta Sync gibi başka bir yaklaşıma mı geçilmesi gerektiğine daha sonra karar vereceğini belirtti — bu karar netleşene kadar özellik UI seviyesinde donduruldu. Odak şimdi yeni bir özelliğe (Public Profile & Follow System) kaydı.

**Uygulama — kod SİLİNMEDİ, yalnızca gizlendi:** `components/profile/ProfileActivityTab.tsx`'e `const ACTIVITY_DELETE_ENABLED = false;` bayrağı eklendi (üstünde `TODO: Activity delete UI hidden pending DB architecture decision` notu var). Bu bayrak `false` iken:
- "Düzenle" başlık butonu ve toplu silme alt çubuğu (`Modal`) hiç render edilmiyor.
- `FeedCard`/`MarathonFeedCard`'a `isSelectionMode`/`isSelected`/`onToggleSelect`/`onDelete` proplarının HİÇBİRİ geçilmiyor (`deleteProps = {}`) — bu iki bileşen `onDelete` yoksa `ActivityDeleteRow` sarmalayıcıyı zaten hiç kullanmadığından (Madde 108'de bilinçli olarak böyle tasarlanmıştı, ana Akış ekranını etkilememek için), mobildeki sola kaydırma VE web'deki hover çöp kutusu ikonu bu tek bayrakla birlikte otomatik olarak devre dışı kalıyor — `ActivityDeleteRow.tsx`'e ayrıca dokunmaya gerek kalmadı.
- `ActivityDeleteRow.tsx`'in başına da bu duraklatmayı ve bayrağın nerede olduğunu açıklayan bir `TODO` notu eklendi (ileride "neden bu bileşen hiç kullanılmıyor" sorusunu soracak birinin — insan ya da AI — hemen doğru yeri bulması için).
- `deleteItem`/`deleteItems` (`useUserActivity.ts`), `feedApi.ts`'teki `deleteActivity`/`deleteActivitiesBulk` ve Worker'daki `/feed/delete` + tombstone mantığı OLDUĞU GİBİ bırakıldı — hiçbiri çağrılmıyor ama mimari karar netleştiğinde bayrağı `true` yapmak dışında ek çalışma gerekmeyecek.

**Doğrulama:** `npx tsc --noEmit` → 0 hata.

## 112. Public Profile & Follow Sistemi — Adım 1 (Refactor) ve Adım 2 (Veri Katmanı)

**Bağlam:** Madde 111'de silme özelliği donduruldu, odak yeni bir özelliğe (başka kullanıcıların profilini görüntüleme + Takip Et) kaydı. Kod tabanı incelendi: `docs/feed.md`'deki "Mimari Pivot" zaten "takip Trakt'ın kendi API'sinden yönetilsin, kendi Supabase tablomuz olmasın" kararını içeriyordu (bkz. `supabase/schema/004_drop_user_follows.sql`) ve `services/api/social.ts` + `features/feed/hooks/useUserSearch.ts` + `features/feed/components/UserProfileCard.tsx` zaten TAM İŞLEVSEL bir arama/takip akışı olarak vardı (Feed ekranındaki arama çubuğu). Kullanıcı bu analizi onaylayıp 3 adımlık bir plan istedi: (1) `useUserSearch`'teki takip mantığını paylaşımlı bir `useFollowState(slug)`'a ayrıştır, (2) `features/publicProfile/` veri katmanını (yalnızca okuma, silme YOK) kur, (3) `app/(protected)/user/[slug].tsx` arayüzü (bu madde yalnızca 1-2'yi kapsıyor).

**Adım 1 — `useFollowState(slug)` (yeni: `hooks/useFollowState.ts`):** `useUserSearch.ts`'teki `connectionState`/`isFollowPending`/`toggleFollow` (409-conflict özel durumu, gizli hesapta "onay bekliyor" ayrımı dahil) buraya taşındı. `services/api/social.ts`'e (zaten paylaşımlı, `features/feed/` altında değil) doğrudan bağlı olduğundan üst-seviye `hooks/` klasörüne kondu (`hooks/useMyTraktProfile.ts`, `useSettings.ts` ile aynı katman) — `features/feed/` içine gömülseydi Public Profile'ın "feed" özelliğine bağımlı olması gerekirdi, ki mantıksal olarak değil. `useUserSearch.ts` artık yalnızca arama (`query`/`profile`/`error`) taşıyor, takip durumunu `useFollowState(profile?.ids?.slug ?? null)`'dan alıyor.
- **Bilinçli, küçük bir davranış farkı:** Eski kod profil + takip listesini TEK `Promise.all` ile paralel çekip ATOMİK günceliyordu (ikisi aynı render'da gelirdi). Yeni `useFollowState`, `slug` değiştiğinde KENDİ effect'inde ayrı bir istek atıyor — arama akışında profil geldikten SONRA bir adım daha sıralı gerçekleşiyor (yalnızca kullanıcı arama yaptığında, gözle görülür bir gecikme değil). Bunun UI'da yanlış bir "Takip Et" durumu YANIP SÖNMESİNE yol açmaması için `isLoadingConnection` dışarı açıldı ve `UserProfileCard.tsx`'in buton spinner/disabled koşuluna (`isFollowPending || isLoadingConnection`) eklendi — `feed.tsx` bunu `search.isLoadingConnection` olarak iletiyor.
- `ConnectionState` tipi artık `hooks/useFollowState.ts`'ten export ediliyor; `UserProfileCard.tsx`'in import'u güncellendi (`useUserSearch.ts`'te geriye dönük uyumluluk için bir re-export BIRAKILMADI — AI_RULES'daki "gereksiz kalıntı" kuralına uyarak tek gerçek import yolu bırakıldı).

**Adım 2 — `features/publicProfile/hooks/usePublicProfileActivity.ts`:** `features/feed/hooks/useUserActivity.ts` ile BİLİNÇLİ OLARAK paylaşılmadı/genelleştirilmedi — o hook `deleteItem`/`deleteItems` (Worker'a silme isteği, `useAuth().accessToken` gerektiren) taşıyor; başkasının profilini gösteren bir hook'un silme fonksiyonlarına HİÇ erişimi olmaması yapısal bir garanti (birinin ileride yanlışlıkla "başkasının aktivitesini sil" butonu bağlaması ihtimalini kod seviyesinde imkânsız kılıyor). Fetch + `groupMarathonActivities` çağrısı `useUserActivity`/`useFeed` ile birebir aynı desen (~15 satırlık bir tekrar, bilinçli bir tercih — "three similar lines is better than a premature abstraction").
- **Backend tarafında SIFIR değişiklik gerekti:** `feedApi.ts`'teki `fetchUserFeedActivities(traktSlug)` zaten GENELdi (yalnızca "ben" değil, herhangi bir slug alıyordu) — Public Profile ekranı bunu olduğu gibi kullanabiliyor.

**Doğrulama:** `npx tsc --noEmit` → 0 hata. `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` → 0 hata (taşınan kodun eski yerinde hiçbir kalıntı kalmadı). **Kapsam dışı (bilinçli):** Kullanıcının temel Trakt profil bilgilerini (avatar/isim/takipçi sayıları — `useMyTraktProfile.ts`'in "başkası" versiyonu) çeken bir hook bu adımda YAZILMADI — kullanıcı yalnızca `usePublicProfileActivity`'yi istedi, temel profil hook'u Adım 3'te (arayüzle birlikte) doğal olarak gelecek.

## 113. Public Profile & Follow Sistemi — Adım 3 (Arayüz: mobil + web)

**Bağlam:** Madde 112'nin devamı. `app/(protected)/user/[slug].tsx` (mobil) ve `.web.tsx` (masaüstü) ekranları inşa edildi: üstte geri butonu + avatar/isim/kullanıcı adı, hemen altında `useFollowState`'e bağlı Takip Et/Takip Ediliyor/Onay Bekleniyor butonu, altta `usePublicProfileActivity`'den gelen `FeedCard`/`MarathonFeedCard` akışı.

**Veri katmanına eklenen tek parça — `features/publicProfile/hooks/usePublicProfile.ts`:** Avatar/isim/takipçi-takip edilen sayıları için. `getUserProfile`/`getFollowers`/`getFollowing` (`services/api/social.ts`) zaten GENELdi ve auth GEREKTİRMİYOR (bkz. docs/feed.md: "auth bile gerektirmiyor, canlı test edildi") — bu yüzden `useMyTraktProfile.ts`'teki gibi bir `accessToken`/`isGuest` koruması burada YOK, misafir bile başkasının profilini görebiliyor.

**`components/profile/ProfileHeader.tsx` genişletildi, YENİDEN YAZILMADI:** Bileşenin kendi eski yorumu zaten "isOwnProfile=false verilince Takip Et/Takip Ediliyor butonuna döner" diyordu ama gerçek bağlantı hiç kurulmamıştı — ikili (`isFollowing: boolean`) bir prop taşıyordu, bu da Trakt'ın gizli hesap "onay bekliyor" durumunu (`pending`) HİÇ temsil edemezdi. `isFollowing` kaldırılıp `connectionState: ConnectionState` (`hooks/useFollowState.ts`'ten) + `isFollowPending`/`isLoadingConnection` eklendi; buton artık `UserProfileCard.tsx` ile aynı 3 durumu (+ spinner) gösteriyor. Tek çağıran (`screens/ProfileMobile.tsx`) bu yeni proplardan hiçbirini geçmiyordu (`isOwnProfile` varsayılan `true` kalıyor) — değişiklik geriye dönük güvenli, `grep` ile tek kullanım noktası doğrulandıktan sonra yapıldı.

**Dosya yapısı — `screens/PublicProfileMobile.tsx` eklendi:** İlk yazımda tüm mobil ekran doğrudan `app/(protected)/user/[slug].tsx` içindeydi; `.web.tsx` yazılırken `app/(protected)/(tabs)/profile.web.tsx`'in **zaten var olan** deseniyle (`!isDesktop` durumunda `screens/ProfileMobile.tsx`'i olduğu gibi render etmesi) tutarlı olmak için mobil ekran `screens/PublicProfileMobile.tsx`'e taşındı; `[slug].tsx` artık yalnızca onu render eden ince bir sarmalayıcı. `[slug].web.tsx` da `useResponsive().isDesktop` false ise AYNI `PublicProfileMobile`'ı render ediyor (kopya kod yok), true ise kendi masaüstü düzenini (ortalanmış 720px içerik sütunu, `feed.tsx`'in `contentDesktop` deseniyle aynı) çiziyor.

**Yan bulgu — `useFollowState.toggleFollow`'da misafir koruması eksikti (düzeltildi):** Arayüzü inşa ederken fark edildi: `toggleFollow`, `isGuest`/`accessToken` hiç kontrol etmiyordu — bir misafir "Takip Et"e bassaydı istek token'sız gidip Trakt'tan sessizce 401 alacaktı (409 dışında hiçbir hata özel olarak ele alınmıyordu), bu da AI_RULES.md'nin "sessiz başarısızlık yasak" kuralını ihlal ederdi. Projenin her yerde kullandığı **birebir aynı** desen eklendi: `Alert.alert(t('common:error'), t('common:guestRestrictedMessage', ...))`, istek hiç gönderilmeden. Bu, Madde 112'de onaylanmış koddaki gerçek bir açıktı — yeni tüketici (Public Profile ekranı) bunu daha görünür kıldığı için bu adımda düzeltildi.

**Doğrulama:** `npx tsc --noEmit` ve `--noUnusedLocals --noUnusedParameters` → 0 hata. Web önizlemede canlı test edildi: (a) mobil genişlik (730px) → `PublicProfileMobile` render edildi, geri butonu + "Profil yüklenemedi" hata durumu doğru göründü; (b) masaüstü genişlik (1280px) → kendi başlığı ("← Geri Dön") + hata durumu göründü, `getComputedStyle` ile DOM ölçümü yapılıp arka planın (`#0B1120`) gerçekten tüm 1280×900 viewport'u kapladığı ve içeriğin 720px'lik ortalanmış bir sütunda (`x:280`) doğru konumlandığı doğrulandı (screenshot aracının küçük/karanlık-üstü-karanlık render'ı ilk bakışta yanıltıcıydı, DOM ölçümüyle netleştirildi). **Doğrulanamayan:** Gerçek bir Trakt kullanıcı profiliyle uçtan uca (bu ortamda Trakt ağ erişimi yok) — avatar görseli, gerçek takipçi/takip edilen sayıları, ve gerçek bir "Takip Et" tıklamasının uçtan uca çalıştığı kullanıcının kendi ortamında doğrulanmalı.

## 114. "Aktiviteler Bölümü Geç Geliyor" — `feedApi.ts`'te İki Ayrı Yavaşlık Kaynağı Bulunup Düzeltildi

**Bildiren:** Kullanıcı, Profil sekmesindeki "Aktiviteler" bölümünün (`ProfileActivityTab.tsx` → `useUserActivity.ts`) belirgin şekilde geç yüklendiğini bildirdi ve "olabildiğince hızlı ve stabil olması" istendi. (Not: Bu oturumdan bağımsız olarak, kullanıcı tarafında `[slug].web.tsx`/`PublicProfileMobile.tsx`'e Diziler/Filmler sekmeleri ve `usePublicProfileLibrary.ts` eklenmişti — bu madde yalnızca doğrudan şikayet edilen "Aktiviteler" veri yoluna odaklanıyor, o eklentilere dokunulmadı.)

**Kök Neden 1 — `fetchUserFeedActivities` (Profil Aktiviteleri) ve `fetchFeedActivities` (Ana Akış) her çağrıda 2 SIRALI Supabase isteği atıyordu:** Önce `users` tablosundan `trakt_slug` ile `id` çekiliyor, o `id` gelene KADAR ikinci sorgu (`feed_activities`) hiç başlamıyordu — gereksiz bir tam ağ round-trip'i (~100-300ms, ağ koşuluna göre) her yüklemeye ekleniyordu. **Çözüm:** PostgREST'in `!inner` join + gömülü kaynak filtresi (`user:users!inner(...)` + `.eq('user.trakt_slug', ...)` / `.in('user.trakt_slug', ...)`) kullanılarak TEK sorguya indirildi — `supabase-js@2.110.8`'in resmi, belgelenmiş bir özelliği (yeni bir bağımlılık gerekmedi). Eşleşen `users` satırı yoksa join hiç satır döndürmediğinden eski "bulunamadı" dalına da gerek kalmadı, kod kısaldı.

**Kök Neden 2 — Her sekme geçişinde/yeniden mount'ta baştan yükleme, önbellek YOKTU:** `ProfileActivityTab`, "Özet"e geçilip geri dönüldüğünde tamamen unmount/remount oluyor (`activeTab === 'activity' ? <ProfileActivityTab/> : ...`), `useUserActivity`'nin `useEffect`'i her seferinde SIFIRDAN başlıyordu — kullanıcı 10 saniye önce baktığı aynı listeyi tekrar tam bir yükleme animasyonuyla bekliyordu. **Çözüm:** `services/api/shows.ts`'teki `trendingShowsCache` ile BİREBİR AYNI desen — `feedApi.ts`'e slug başına kısa ömürlü (`CACHE_TTL.SHORT` = 60sn, `utils/cacheTTL.ts`, projede zaten merkezi olarak tanımlıydı) bir bellek-içi önbellek (`userFeedActivitiesCache`) eklendi. Aynı slug'a 60sn içinde tekrar bakıldığında ağ isteği ATLANIR, veri anında (0ms) görünür. Yeni bir `invalidateUserFeedActivitiesCache(slug)` export'u eklenip `useUserActivity.ts`'in başarılı silme akışına bağlandı — böylece bir aktivite silindiğinde önbellek TTL dolana kadar beklemeden temizlenir (şu an `ACTIVITY_DELETE_ENABLED=false` olduğu için pratikte tetiklenmiyor ama özellik geri açıldığında ekstra bir düzeltmeye gerek kalmayacak).

**Kapsam:** İki fonksiyon da (`fetchFeedActivities`, `fetchUserFeedActivities`) AYNI dosyada, AYNI mekanik hata deseni taşıdığı için ikisi de düzeltildi — yalnızca önbellek (Kök Neden 2) `fetchUserFeedActivities`'e (doğrudan şikayet edilen yol) eklendi, ana Akış ekranının kendi `refresh()`/pull-to-refresh semantiğiyle beklenmedik şekilde çakışmasın diye.

**Doğrulama:** `npx tsc --noEmit` → 0 hata. **Doğrulanamayan:** `!inner` join sorgusu bu ortamda gerçek Supabase'e karşı ÇALIŞTIRILAMADI (kimlik bilgisi/ağ erişimi yok) — resmi, belgelenmiş bir PostgREST/supabase-js özelliği olduğundan yüksek güvenle doğru, ama kullanıcının kendi ortamında Aktiviteler sekmesini açıp gerçekten veri geldiğini (ve hızlandığını) doğrulaması gerekiyor. Sözdizimi hatalı olsaydı sonuç sessiz bir veri bozukluğu değil, açık bir API hatası (mevcut `.catch` zaten yakalıyor) olurdu.

## 115. Takip (Follow) Sistemi Denetimi — Kararsız "Takip Ediyorum/Etmiyorum" Durumu ve Performans Denetimi

**Bildiren:** Kullanıcı, Aktiviteler (feed) ve Profil'deki yeni takipçi/takip edilen alanlarını denetlememi istedi. İki somut hata bildirdi: (1) takip ettiği biri bazen "takip etmiyor" gibi görünüyor, (2) özel (private) bir hesaba takip isteği gönderip onay beklerken uygulamadan çıkıp tekrar girince buton yine "Takip Et" yazıyor (aslında istek hâlâ beklemede).

**Kök Neden 1 — `store/followStore.ts`'te hidrasyon/ağ yarış durumu (race condition):** Uygulama açılışında AsyncStorage'daki kalıcı `connectionStates`'i okuyan hidrasyon, bağımsız bir IIFE olarak modül yüklenir yüklenmez ateşleniyordu; `fetchFollowingSlugs()` (Trakt `/users/me/following` ağ isteği) ise tamamen ayrı, sıralamasız bir yoldan aynı state'i güncelliyordu. İkisi arasında HİÇBİR sıralama garantisi yoktu — AsyncStorage okuması ağ isteğinden yavaş kalırsa (yavaş cihaz/disk G/Ç) hidrasyon SONRADAN tamamlanıp `connectionStates`'i doğrudan eski disk anlık görüntüsüyle DEĞİŞTİRİYOR, ağdan az önce doğrulanmış "following" listesini VE varsa optimistic "pending" durumlarını sessizce siliyordu. **Çözüm:** Hidrasyon artık `fetchFollowingSlugs`'ın en başında `await` edilen tek bir paylaşımlı promise (`ensureHydrated()`) — ağdan gelen sonuç asla hidrasyondan ÖNCE birleştirilemiyor, işlem sırası artık cihaz hızından bağımsız olarak garanti. Ayrıca `isFetched` bayrağı eskiden oturum boyunca SÜRESİZ "tek seferlik" kilitliyordu (bir kez çekildikten sonra bir daha asla tazelenmiyordu) — `fetchedAt` eklenip `CACHE_TTL.SYNC_INTERVAL` (10dk) aşıldığında otomatik yeniden çekim izni verildi, böylece uygulama açık kalırken oluşan (ör. takip isteğinin onaylanması/reddedilmesi gibi) sapmalar kendiliğinden düzelir.

**Kök Neden 2 — `useFollowStore.reset()` hiç çağrılmıyordu (ölü kod, bkz. docs/AI_RULES.md § Ölü Kod):** `context/AuthContext.tsx`'teki `removeKeys()` (çıkış) `AsyncStorage.clear()` ile DİSKİ temizliyor ama Zustand store bir RAM singleton'ı olduğundan bir önceki oturumun `connectionStates`/`isFetched`'i JS süreci canlı kaldığı sürece hafızada kalıyordu. Uygulama tamamen kapatılmadan çıkış yapılıp (aynı veya farklı bir Trakt hesabıyla) tekrar girildiğinde `isFetched: true` yeni oturumda `fetchFollowingSlugs`'ın hiç çalışmasını engelliyor, önceki oturuma ait takip durumu yeni oturuma sızıyordu. **Çözüm:** `removeKeys()` içine `useFollowStore.getState().reset()` eklendi.

**Kök Neden 3 (yapısal sınırlama, iyileştirildi ama tam çözülemedi) — "pending" durumu tamamen istemci-yerel:** Trakt API'sinde gönderdiğim bekleyen takip isteklerini listeleyen bir uç nokta yok (yalnızca BANA gelen istekleri onaylayan `/users/requests` var) — bu yüzden `pending` durumu yalnızca `setOptimisticState` ile yazılıp `AsyncStorage`'a kalıcılaştırılan bir işaret, sunucudan asla yeniden doğrulanamıyor. Kök Neden 1 ve 2 bu durumun kaybolmasının ASIL sebebiydi (ikisi de düzeltildi); kalan artık kabul edilebilir bir sınırlama: hedef kullanıcı isteği onaylarsa bir sonraki `fetchFollowingSlugs` (en geç 10dk içinde, bkz. yukarı) durumu doğru şekilde `following`'e çevirir, ama REDDEDİLİRSE bunu öğrenecek bir yol yok (Trakt bunu hiçbir occasion'da bildirmiyor) — kullanıcıya açıklandı, gelecekte "isteği geri çek" gibi bir UI eklenebilir.

**Performans — Zustand'da seçicisiz (selector'sız) whole-store abonelik:** `useFollowState.ts` ve `useNetworkList.ts` `useFollowStore()`'u parametresiz çağırıp TÜM store'a abone oluyordu — Zustand'da bu, `connectionStates` içindeki HERHANGİ bir slug değiştiğinde (tek bir "Takip Et" tıklaması) ekrandaki HER `useFollowState` örneğinin (arama sonucu kartı, takipçi/takip edilen listesindeki HER satır) gereksiz yere yeniden render olması demek — kalabalık takipçi listelerinde gözle görülür yavaşlık/donma riski. `app/(protected)/user/[slug]/network.tsx` da aynı şekilde `connectionStates`'in tamamına abone olup her satırın state'ini kendisi hesaplıyordu. **Çözüm:** Üç dosyada da `useFollowStore(selector)` deseni kullanılarak yalnızca ilgili slug'a/alana abone olunacak şekilde değiştirildi; `network.tsx`'teki whole-store abonelik tamamen kaldırıldı (her kart kendi durumunu `NetworkUserCard` → `useFollowState` üzerinden doğrudan okuyor).

**Performans raporuna eklenen görünürlük:** `useFollowState.ts`'teki takip et/bırak mutasyonlarına `recordMutationResult('followUser'/'unfollowUser', ...)` eklendi (`utils/metrics.ts` — Ayarlar > Tanılama > "Performans Raporunu Kopyala" ile dışa aktarılıyor, desen `services/library/mutations/*.ts`'teki mevcut kullanımla birebir aynı). Ayrıca `features/feed/services/feedApi.ts` (Supabase sorguları) ve `feedSync.ts` (`/feed/sync` Worker isteği) `services/api/traktClient.ts`'in otomatik `recordApiLatency` enstrümantasyonundan GEÇMİYOR (Trakt'a değil Supabase/Worker'a gidiyorlar) — bu yüzden performans raporunda hiç görünmüyorlardı. İkisine de manuel `recordApiLatency` (`supabase.feed_activities.*`, `worker.feed.sync`, `worker.feed.delete`) eklendi; artık bir sonraki performans raporunda görünürler.

**Kapsam dışı bırakılanlar:** `feedSync.ts`/`useFeedSyncTrigger.ts` (senkronizasyon zamanlaması), `groupMarathonActivities.ts` (maraton gruplama algoritması) ve Feed/Profil FlatList render katmanı incelendi, yapısal bir hata bulunmadı — mevcut `FlatList` kullanımı zaten doğru virtualization sağlıyor, ek bir değişiklik yapılmadı.

**Doğrulama:** `npx tsc --noEmit` → 0 hata. **Doğrulanamayan:** Gerçek bir Trakt hesabıyla uçtan uca (takip isteği gönder → uygulamayı kapat/aç → hâlâ "Onay Bekleniyor" görünüyor mu) bu ortamda test EDİLEMEDİ — kullanıcının kendi cihazında doğrulaması gerekiyor.

## 116. Bildirim Sistemi Denetimi — Sahte Sayaç Kaldırıldı + `docs/notifications.md` Yol Haritası

**Bildiren:** Kullanıcı, yeni kurulmakta olan `features/notifications/` iskeletinin denetlenmesini istedi.

**Bulgu:** Tüm servis dosyaları (`expoPush.ts`, `webPush.ts`, `notificationApi.ts`) ve `useNotifications.ts` hook'u tamamen TODO/no-op durumundaydı (`expo-notifications` bağımlılığı bile kurulu değil) — **tek istisna**, `NotificationBadge.tsx`'in üç gerçek ekranda (mobil/web Profil + tab bar rozeti) canlıda görünen, `store/notificationStore.ts`'teki `unreadCount`'u butona her basışta sahte şekilde artıran bir "test" davranışıydı. Bu, kullanıcıyı gerçek bir bildirim varmış gibi yanıltıyordu.

**Çözüm (Görev 1 — Acil Müdahale):**
1. `store/notificationStore.ts`: test amaçlı `incrementUnread` kaldırıldı, yalnızca gerçek bir kaynağın besleyeceği `setUnreadCount`/`clearUnread` bırakıldı — `unreadCount` artık başka hiçbir yerden mutasyona uğramadığı için her zaman `0`.
2. `NotificationBadge.tsx`: `incrementUnread()` çağrısı kaldırıldı, yerine platforma göre `Alert.alert` (native) / `window.alert` (web) ile "Çok Yakında" uyarısı eklendi — `hooks/useFollowState.ts`'teki web/native Alert ayrımıyla aynı desen. Kullanılmayan `useRouter` importu da temizlendi (zaten hiç kullanılmıyordu).
3. Çeviri anahtarları eklendi: `locales/{tr,en}/common.json` → `notificationsComingSoonTitle`, `notificationsComingSoonMessage`.
4. Tab bar / header rozetleri (`_layout.tsx`'teki `tabBarBadge` dahil) hiçbir değişiklik gerektirmedi — `unreadCount > 0` koşulu zaten `0` iken otomatik gizleniyor.

**Görev 2 — `docs/notifications.md`:** Yeni bir mimari doküman oluşturuldu (`docs/feed.md` ile aynı format/derinlik). İçerik: gerekli kütüphaneler (`expo-notifications`, `expo-device`; web için ekstra native paket gerekmiyor — Service Worker + PushManager yeterli), platforma göre ayrılmış token alma stratejisi (mobil: Expo Push token + Android bildirim kanalı zorunluluğu; web: VAPID + Service Worker, `PushToken` tipinin web için genişletilmesi gerektiği), backend stratejisi (yeni Supabase `push_tokens` tablosu taslağı + `kaymaktv-feedback-worker`'a eklenecek `/notifications/register`/`/unregister` uç noktaları + Cloudflare Workers'ta Node `web-push` paketinin ÇALIŞMAYACAĞI, VAPID imzalamanın Web Crypto API ile elle yapılması gerektiği uyarısı) ve bir tetikleyici taslağı tablosu. En önemli mimari tespit: **Trakt'ın webhook'u olmadığından, "biri seni takip etti" gibi bir bildirim yalnızca eylem KaymakTV içinden yapıldığında gerçek zamanlı yakalanabilir** — trakt.tv üzerinde yapılan eylemler ancak periyodik senkronizasyonla (Faz 2) sonradan fark edilebilir. Doküman sonunda kodlamaya başlamadan önce karar gerektiren 5 açık soru listelendi (EAS projectId, VAPID key üretimi, Web SW dosya yolu, gelen istekleri onaylama arayüzünün hiç var olmaması, rate-limit).

**Doğrulama:** `npx tsc --noEmit` → 0 hata.

## 117. Beta APK Dağıtım (Web Sideloading) Sayfası — Geçici, Kolayca Kaldırılabilir Özellik

**İstek:** Google Play'e yayınlanmadan önce test kullanıcılarına APK dağıtmak için, auth gerektirmeyen bir Web sayfası. Kullanıcı açıkça "Play Store'a çıktıktan sonra kökten kaldıracağım" dediği için tasarım kriteri **temiz/izole olması ve tek adımda silinebilmesi** oldu.

**Eklenenler:**
1. `utils/constants.ts`: `APK_DOWNLOAD_URL` sabiti (örnek bir Supabase public storage linkiyle, kullanıcı kendi gerçek linkiyle güncelleyecek).
2. `app/(public)/download.web.tsx`: Auth bariyerine hiç takılmayan (`(public)` grubunda), yalnızca Web'de gösterilen, `#0B1120` arka planlı, ortalanmış, `Smartphone` ikonlu, kırmızı `LinearGradient` "APK İndir" butonlu (`Linking.openURL(APK_DOWNLOAD_URL)`) bir sayfa.
3. `app/(public)/download.tsx`: **Beklenmedik bir keşifle eklenmesi ZORUNLU hale gelen** fallback dosyası — canlı tarayıcı testinde expo-router (~6.0.24)'nin, platforma özel bir rota dosyasının yanında sade bir `.tsx` fallback'i OLMADAN **tüm uygulamayı** "does not have a fallback sibling file without a platform extension" hatasıyla çökerttiği bulundu. `docs/ARCHITECTURE.md` § D'deki platform-splitting açıklaması (mobil dosyalara dokunulmadan Web'e özel dosya eklenmesi) COMPONENT import'ları için doğru ama ROTA dosyaları için geçerli değilmiş — bu proje için yeni bir mimari ders. Fallback, native'de `/` (herkese açık karşılama) sayfasına `Redirect` yapıyor.

**Kaldırma stratejisi (bilinçli tasarım kararı):** Üç parça da BAŞKA HİÇBİR dosyadan import/link almıyor — hiçbir navigasyon menüsüne, `_layout.tsx`'e veya başka bir ekrana bağlanmadı (yalnızca beta testçilere doğrudan paylaşılacak bir URL olarak düşünüldü). Metinler bilerek `locales/`'e değil, doğrudan dosyaya yazıldı — geçici bir sayfa için çeviri anahtarı eklemek, silinirken o anahtarların da ayrıca temizlenmesini gerektirirdi. **Play Store yayını sonrası kaldırma = şu üç şeyi silmek:** `app/(public)/download.web.tsx`, `app/(public)/download.tsx`, `utils/constants.ts`'teki `APK_DOWNLOAD_URL` satırı. Başka hiçbir dosyada değişiklik gerekmiyor.

**Doğrulama:** `npx tsc --noEmit` → 0 hata. Canlı tarayıcıda test edildi (`expo start --web`) — ilk denemede fallback dosyası olmadan TÜM uygulama çöktü (yukarıda açıklandı), `download.tsx` eklenince taze bir tarayıcı sekmesinde `/download` sıfır konsol hatasıyla doğru render oldu, buton tıklaması çökme üretmedi. (Not: aynı oturumda önceden açılmış, fallback dosyası eklenmeden ÖNCE yüklenmiş bir sekmede hata mesajı bir süre ısrarla göründü — bu Metro/Fast Refresh'in o sekmedeki eski modül önbelleğinden kaynaklı bir test artefaktıydı, sunucu yeniden başlatılıp taze bir sekmede doğrulandı, gerçek bir kod sorunu değildi.)

**Ek (aynı gün, ayrı bir istekte):** `download.web.tsx`'e "APK İndir" butonunun altına statik bir sürüm notları kartı eklendi (`RELEASE_NOTES_VERSION`/`RELEASE_NOTES` — dosyanın içinde, DB'ye bağlı değil, geliştirici elle günceller). Mevcut kart tasarım diliyle (`#172033`/`#22304A`, bkz. `FeedCard.tsx`) uyumlu. Yalnızca bu dosya değişti.

## 118. APK Barındırma: Supabase Storage → GitHub Releases

**Sorun:** Madde 117'de kurulan `APK_DOWNLOAD_URL`, Supabase Storage'ın ücretsiz plandaki **50 MB dosya yükleme sınırına** takıldı — APK dosyası bunu aştığı için kullanıcı barındırma stratejisini GitHub Releases'e taşıdı (ücretsiz, boyut sınırı KaymakTV'nin ölçeği için pratikte sorun değil, kalıcı bir indirilebilir URL veriyor).

**Çözüm:** `utils/constants.ts`'teki `APK_DOWNLOAD_URL`, sabit bir `beta` tag'i altındaki GitHub Release asset'ine güncellendi: `https://github.com/ArdaGunal/KaymakTv/releases/download/beta/kaymaktv-latest.apk`. Yeni bir beta derlemesi çıktığında kullanıcı bu asset'i **aynı dosya adıyla** `beta` release'ine tekrar yükleyip eskisinin üzerine yazacak — link URL'si sabit kaldığı için kod tarafında BAŞKA HİÇBİR değişiklik gerekmiyor. Dosyadaki yorum satırı da Supabase'e referans vermeyecek şekilde güncellendi.

**Kapsam dışı:** `app/(public)/download.web.tsx`/`download.tsx` (madde 117'deki kaldırma stratejisi hâlâ aynen geçerli — bu değişiklik yalnızca `APK_DOWNLOAD_URL`'in DEĞERİNİ değiştirdi, dosya yapısına dokunmadı) ve `docs/notifications.md` (orada barındırılan tek Supabase referansı `push_tokens` tablosu tasarımı — APK dağıtımıyla ilgisiz, GEÇERLİLİĞİNİ KORUYOR).

**Doğrulama (madde 118):** `npx tsc --noEmit` → 0 hata.

## 119. Sürüm Notları: Statik → GitHub Releases API (Dinamik)

**Sorun:** `app/(public)/download.web.tsx`'teki sürüm notları önceden statik bir TypeScript array'i (`const RELEASE_NOTES: string[]`) idi. Yeni bir beta sürümü her çıktığında geliştirici dosyayı elle açıp array'i güncellemelidir — tasarımdan uzak bir iş akışı.

**Çözüm:** GitHub API'den dinamik olarak sürüm notları çekme sistemi kuruldu:

1. **Import:** `useEffect` hook'u eklenmiş.
2. **State'ler:**
   - `releaseNotes`: GitHub'dan çekilen markdown metin (body field)
   - `isLoadingNotes`: Loading durumu
   - `notesError`: Hata durumuna ait fallback mesaj
3. **`useEffect` Hook:** Component mount edildiğinde, genel API'ye (auth gerektirmiyor) istek atılıyor:
   ```
   fetch('https://api.github.com/repos/ArdaGunal/KaymakTv/releases/tags/beta')
   ```
   Gelen JSON'dan `body` alanı state'e kaydediliyor. Hata durumunda: `"Sürüm notlarına GitHub üzerinden ulaşabilirsiniz."` fallback'i gösteriliyor.
4. **UI Render:** Markdown metin `\n`'ler split'lenerek her bir satır kontrol ediliyor (boş satırlar filtreleniyor), ardından liste olarak render ediliyor. Loading/error durumlarında uygun mesajlar gösteriliyor.

**Eski Kalıntılar Kaldırıldı:**
- `const RELEASE_NOTES: string[]` array (statik, 5 madde)
- `const RELEASE_DATE` sabit (artık gerekmiyor — tarih GitHub Release tarafından otomatik olarak veriliyor)

**İş Akışı:** Yeni bir beta APK'sı dışarı çıktığında, geliştirici (1) yeni sürüm notlarını GitHub release'inin `body` alanına yazıyor, (2) APK dosyasını `beta` tag'ine aynı dosya adıyla yükleyip eski sürümün üzerine yazıyor, (3) başka hiçbir kod değişikliği gerekmeden dinamik sistem yeni notaları otomatik çekiyor. Yükleme sayfası (canlı kullanıcılara bakış açısından) her refresh'te en güncel notaları gösteriyor.

**Kapsam:** Yalnızca `app/(public)/download.web.tsx` değişti. Diğer download-related dosyalar (`download.tsx`, `utils/constants.ts` sabitleri) etkilenmedi.

**Doğrulama:** `npx tsc --noEmit` → 0 hata. Canlı tarayıcıda test edildi — GitHub Releases'ten beta tag'inin body'si başarıyla çekiliyor ve sayfa render ediliyor (yükleme animasyonu + hata handling başarılı).

## 120. "Takip İsteği Gitmiyor" Bug'ı — `/users/:id/follow` Web'de CORS'a Takılıyormuş + Sessiz Hata Yutma

**Bildiren:** Kullanıcı birine takip isteği attığında hiçbir şey olmadığını bildirdi.

**Teşhis (iki ayrı, birbirini güçlendiren kök neden bulundu):**

1. **CORS — Madde 109'daki `/users/hidden/*` ile BİREBİR AYNI aile davranışı.** `services/api/social.ts`'teki `followTraktUser`/`unfollowTraktUser`, tüm diğer Trakt çağrıları gibi `getTraktClient()` ile TARAYICIDAN doğrudan `https://api.trakt.tv/users/:id/follow`'a gidiyordu. Madde 109'da zaten kanıtlanmıştı ki Trakt'ın CORS desteği uç noktaya göre TUTARSIZ — `/users/hidden/*` ailesi tarayıcı preflight'ına `Access-Control-Allow-Origin` döndürmüyor. `/users/:id/follow` de aynı "kullanıcı özel verisine yazma" sınıfında bir uç nokta; canlı testte (bkz. aşağıdaki Doğrulama) bunun da aynı CORS reddine düştüğü doğrulandı.
2. **Sessiz hata yutma (ayrı, gerçek bir bug — CORS'tan bağımsız olarak da var olurdu).** `hooks/useFollowState.ts`'teki `toggleFollow`/`execUnfollow`, hata yakaladığında yalnızca `console.warn` yazıp optimistic UI'ı sessizce eski haline (rollback) döndürüyordu — kullanıcıya HİÇBİR Alert/Toast gösterilmiyordu. Sonuç: kullanıcı butona basıyor, "Takip Ediliyor" kısa süreliğine görünüyor, sonra açıklamasız eski haline dönüyor — tam olarak "hiçbir şey olmadı" hissi.

**Çözüm:**
1. `server.js`'e mevcut `/api/trakt-proxy` GET/POST köprüsünün (Madde 109) yanına bir **`DELETE /api/trakt-proxy`** handler'ı eklendi (`unfollowTraktUser`'ın DELETE isteği için — POST zaten mevcut handler'ı kullanabiliyordu).
2. `services/api/social.ts`: `followTraktUser`/`unfollowTraktUser`, `getTraktClient()` yerine bu proxy'yi kullanacak şekilde güncellendi — `services/api/users.ts`'teki `TRAKT_PROXY_URL` deseniyle BİREBİR AYNI (mutlak/göreli URL seçimi, token'ın query string'e değil `Authorization` başlığına konması, `Platform.OS` kontrolü EKLENMEDİ — bkz. Madde 91). `getUserProfile`/`getFollowers`/`getFollowing`/`getMyFollowingSlugs` (okuma uç noktaları) DOKUNULMADI — yalnızca yazma (`POST`/`DELETE /follow`) etkileniyordu, kapsam gereksiz yere genişletilmedi.
3. `hooks/useFollowState.ts`: Yeni bir `showFollowErrorAlert` helper'ı eklendi (`NotificationBadge.tsx`'teki web/native Alert ayrımıyla aynı desen, zaten var olan `actionFailedMessage` i18n anahtarını kullanıyor — yeni çeviri anahtarı gerekmedi). Hem `toggleFollow` hem `execUnfollow`'un hata dallarına eklendi (409 "zaten pending" özel durumu hariç — o zaten başarı sayılıyor).

**Doğrulama:** `npx tsc --noEmit` → 0 hata, `node --check server.js` → sözdizimi geçerli. Yeni `DELETE` proxy handler'ı, boş bir portta (4831) ayağa kaldırılıp **canlı Trakt API'sine karşı** test edildi (Madde 109'daki yöntemle aynı): (1) token'sız `POST`/`DELETE /users/:id/follow` → gerçek Trakt yanıtı (`404`, network/CORS hatası DEĞİL) düzgünce client'a yansıdı; (2) geçersiz bir `Authorization: Bearer` başlığıyla aynı istek → gerçek Trakt `401`'i döndü — bu, header'ın proxy üzerinden Trakt'a doğru şekilde iletildiğini kanıtlıyor. **Doğrulanamayan (Madde 109'la aynı sınırlama):** Gerçek bir kullanıcı token'ıyla uçtan uca (bu ortamda gerçek bir Trakt OAuth oturumu yok) — kullanıcının kendi hesabıyla hem web'de takip isteğinin gerçekten gittiğini hem de (varsa) hata Alert'inin göründüğünü doğrulaması gerekiyor. **KULLANICI TARAFINDAN YAPILMASI GEREKENLER:** Bu değişiklik yalnızca YEREL `server.js` ve `services/api/social.ts`'te — üretimdeki Raspberry Pi sunucusuna deploy edilmedi; kullanıcının kodu çekip (1) `node server.js`'i yeniden başlatması, (2) web build'ini (`expo export` + `dist/`) yeniden üretip yayınlaması gerekiyor.

## 121. Bildirimler ve Takip İstekleri Ekranı (Cross-Platform) — Yalnızca UI, Mock Veri

**İstek:** Bildirimler sistemi için uygulama içi bir merkez ekran. `NotificationBadge.tsx`'teki geçici "Çok Yakında" Alert'i tamamen kaldırılıp gerçek bir sayfaya yönlendirme yapılacak; sayfa hem mobilde tam ekran hem web'de ortalanmış/dar bir feed olarak responsive davranacak; içerik şimdilik statik mock veri (backend/Supabase entegrasyonu SONRAKİ bir adım).

**Eklenenler:**
1. `features/notifications/components/NotificationBadge.tsx`: `Platform`/`Alert`/`useTranslation`/`window.alert` mantığı TAMAMEN kaldırıldı, yerine `useRouter().push('/notifications')` kondu. Artık kullanılmayan `notificationsComingSoonTitle`/`notificationsComingSoonMessage` i18n anahtarları da `locales/{tr,en}/common.json`'dan silindi (başka hiçbir dosya bunları referans almıyordu — grep ile doğrulandı).
2. `app/(protected)/notifications.tsx` (YENİ): Korumalı (auth gerektiren) yeni bir rota. `docs/ARCHITECTURE.md`'deki platform-splitting kuralına göre bu dosya `.web.tsx` platform-özel BİR ŞEY yapmıyor (dış bağlantı/fetch içeren `app/(public)/download.web.tsx`'ten farklı olarak) — `error-log.tsx`/diğer korumalı ekranlarla AYNI desende, tek dosyada `useWindowDimensions` ile responsive; bu yüzden Madde 117'deki gibi bir `.tsx` fallback'ine gerek YOK (platform-özel dosya adı yok, split hiç yapılmadı).
   - `components/settings/SettingsHeader.tsx` (mevcut, `error-log.tsx`'te de kullanılan geri butonlu başlık) AYNEN tekrar kullanıldı — yeni bir header icat edilmedi.
   - İki bölüm: **Takip İstekleri** (avatar + isim + `Kabul Et`/belirgin tema rengi buton + `Reddet`/gri outline X butonu) ve **Genel Bildirimler** (ikon + mesaj + `timeAgo` metni ile sade satır tasarımı).
   - Responsive kural: `contentDesktop` stilinde `maxWidth: 600, alignSelf: 'center'` — kullanıcının istediği 600 değeri birebir kullanıldı (`SettingsHeader`'ın kendi iç `maxWidth: 680`'i yalnızca header'a ait, ayrı bir prop olmadığından content'e dokunulmadı; ikisi de `alignSelf: 'center'` olduğu için görsel fark yaratmıyor).
   - Mock veri: `MOCK_FOLLOW_REQUESTS`/`MOCK_NOTIFICATIONS` sabitleri, dosyanın en üstünde TODO yorumuyla ("Backend entegrasyonu — Supabase'e bağlanacak") işaretlendi. `Kabul Et`/`Reddet` butonları yalnızca yerel `useState`'ten satırı kaldırıyor (optimistic UI'ye BENZER ama gerçek bir mutasyon YOK, sayfa yenilenince mock veri sıfırlanır) — böylece arayüz backend bağlanmadan da "canlı" hissettiriyor, ama hiçbir sahte kalıcılık iddiası yok.
   - Boş durum: her iki liste de boşaldığında (`noFollowRequests`/`noNotifications` i18n anahtarlarıyla) ayrı bir boş-durum kutusu gösteriliyor.
3. `app/(protected)/_layout.tsx`: Yeni rota `<Stack.Screen name="notifications" />` olarak kaydedildi (`account`/`error-log` ile AYNI desen).
4. Çeviriler: `locales/{tr,en}/common.json`'a `accept`, `reject`, `followRequests`, `generalNotifications`, `notifications`, `noFollowRequests`, `noNotifications` eklendi — mevcut alfabetik sıraya uygun konumlara yerleştirildi. Mock veri İÇERİĞİ (ör. "Ahmet K.", "Sisteme yeni bir dizi eklendi: Severance") BİLİNÇLİ OLARAK i18n'e bağlanmadı — gerçek veri geldiğinde zaten backend'den (kullanıcı adları, sistem mesajları) gelecek, sabit çeviri anahtarı açmak gereksiz kalıcı kod olurdu.

**Kapsam dışı (bilinçli):** Gerçek Supabase/backend bağlantısı, push token kaydı, `unreadCount`'un gerçek bir kaynaktan güncellenmesi — hepsi `docs/notifications.md`'deki yol haritasının bir SONRAKİ adımı, bu görevde açıkça istenmedi.

**Doğrulama:** `npx tsc --noEmit` → 0 hata. Canlı tarayıcıda (misafir modunda) uçtan uca test edildi: `/notifications`'a doğrudan gidildi, iki bölüm de mock veriyle doğru render oldu; `Kabul Et` ve `Reddet` (X) butonları test edildi — ikisi de satırı listeden kaldırıyor; tüm takip istekleri kaldırılınca "Bekleyen takip isteğiniz yok." boş durumu doğru göründü; masaüstü genişliğinde (`isDesktop`) `SettingsHeader`'ın "Geri" etiketi göründü, responsive `maxWidth` davranışı çalıştı; konsolda bu sayfaya ait SIFIR hata (yalnızca sandbox'ın internet erişimi olmamasından kaynaklanan, ilgisiz Trakt trending network hataları vardı). **Doğrulanamayan:** `NotificationBadge.tsx`'in gerçek tıklama-yönlendirme davranışı — bu bileşen yalnızca GERÇEK (misafir olmayan) bir profil ekranında render oluyor ve bu ortamda gerçek bir Trakt oturumu yok; değişikliğin kendisi (bir `Alert` çağrısını `router.push` ile değiştirmek) düşük riskli ve `tsc` ile doğrulandı.

## 122. Ayarlar'a Trakt Profil Gizliliği (Gizli/Açık Hesap) — Instagram Tarzı Tek Dokunuşluk Toggle

**İstek:** Kullanıcıların Trakt.tv'ye gitmeden, doğrudan uygulama içinden hesaplarını gizli/açık yapabilmesi. İstek metninde `services/trakt.ts` adında bir dosyaya ve Zustand'a (`isPrivateProfile`/`setPrivateProfile`) atıfta bulunuluyordu — ikisi de bu projenin gerçek mimarisiyle uyuşmuyordu, aşağıda "Kullanıcının isteğinden bilinçli sapmalar" bölümünde açıklandı.

**Kritik ön-doğrulama — `PUT /users/settings` gerçekten var mı?** Kod yazmadan önce, halüsinasyon bir uç nokta üzerine inşa etmemek için gerçek Trakt API'sine karşı `curl` ile doğrulandı: token'sız `GET`/`PUT /users/settings` → gerçek `401` (bilinçli olarak uydurulmuş bir yol `/users/totallyfakeendpointxyz123` ile karşılaştırıldı, o `404` döndü — yani `/users/settings` GERÇEKTEN yönlendirilen, kimlik doğrulama bekleyen bir rota). Kullanıcının verdiği body şekli (`{"user":{"private":true}}`) da Trakt'ın resmi response şemasıyla (`user.private`) tutarlı.

**CORS kararı — ihtiyatlı yol seçildi:** Bu oturumda ayrıca ilginç bir bulgu ortaya çıktı: `curl` ile hem `/users/settings` HEM DE önceden gerçek tarayıcı hatalarıyla CORS'a takıldığı KANITLANMIŞ olan `/users/hidden/*` ve `/users/:id/follow` (Madde 109/120) — OPTIONS preflight'ı DAHİL — hepsi `Access-Control-Allow-Origin: *` döndürdü. Yani **`curl` ile CORS testi bu iki bilinen-bozuk uç nokta için YANLIŞ NEGATİF veriyor** — gerçek tarayıcı davranışını güvenilir şekilde öngöremiyor (muhtemelen Trakt'ın Cloudflare kenar sunucusu bazlı/coğrafi tutarsız CORS yapılandırması, ya da tarayıcının gönderdiği tam header kombinasyonuna duyarlı bir davranış). Bu nedenle `/users/settings` için de AYNI ihtiyatlı proxy deseni uygulandı — "muhtemelen çalışır" riskini almak yerine, zaten var olan ve iki kardeş uç noktada battle-tested olan `/api/trakt-proxy` köprüsü kullanıldı.

**Eklenenler:**
1. `server.js`: Mevcut `/api/trakt-proxy` GET/POST/DELETE köprüsünün (Madde 109/120) yanına bir **`PUT /api/trakt-proxy`** handler'ı eklendi — BİREBİR aynı desen (endpoint query param, `Authorization` başlığının olduğu gibi iletilmesi, hata durumunda Trakt'ın gerçek status kodunun yansıtılması).
2. `services/api/users.ts`: `getProfilePrivacy(): Promise<boolean>` (GET, `response.data.user.private` okur) ve `updateProfilePrivacy(isPrivate: boolean): Promise<void>` (PUT, `{ user: { private: isPrivate } }` gönderir) eklendi — kullanıcının istediği `updateProfilePrivacy(isPrivate: boolean)` imzası BİREBİR korundu, ama `services/trakt.ts` DEĞİL, mevcut `hideItemTrakt`/`getAllHiddenItems` ile AYNI dosyada (`services/api/users.ts`) ve AYNI `TRAKT_PROXY_URL`/SecureStore token deseninde.
3. `hooks/useProfilePrivacy.ts` (YENİ): `isPrivate`, `isLoading`, `isSaving`, `toggle(value)` döndüren bir hook — `features/feed/hooks/useFeedPrivacy.ts` ile BİREBİR aynı desende (mount'ta `getProfilePrivacy()` ile okuma, `toggle` optimistic güncelleme yapıp arka planda `updateProfilePrivacy()` çağırıyor, hata olursa `setIsPrivate(previous)` ile rollback). Hata durumunda ekstra olarak `utils/confirmDialog.ts`'teki (yeni keşfedilen) `notify()` yardımcısıyla kullanıcıya görünür bir Alert gösteriliyor — kullanıcının açıkça istediği "zarif hata mesajı" gereksinimi.
4. `app/(protected)/account.tsx`: "Akış" bölümünün hemen altına yeni bir **"Gizlilik"** `SettingsSection`'ı eklendi — tek satır: `SettingsSwitchRow` (`Lock` ikonu, "Gizli Hesap" etiketi, açıklama metni, `isLoading || isSaving` iken switch yerine `ActivityIndicator` — bileşenin zaten desteklediği bir prop). Misafir/`accessToken` guard'ı "Akış" bölümüyle BİREBİR aynı (`!isGuest && accessToken`) — yeni bir kod yolu icat edilmedi, mevcut satır kopyalandı.
5. Çeviriler: `locales/{tr,en}/settings.json`'a `privacySection`, `privateAccount`, `privateAccountHint` eklendi (kullanıcının verdiği Türkçe metinler birebir kullanıldı), alfabetik sıraya uygun konumlara yerleştirildi.

**Kullanıcının isteğinden bilinçli sapmalar (hata düzeltmesi):**
- `services/trakt.ts` yerine `services/api/users.ts` — proje zaten Trakt çağrılarını `services/api/{auth,social,users,...}.ts` altında sorumluluğa göre bölüyor; ayrı, paralel bir `services/trakt.ts` dosyası açmak hem bu düzeni bozar hem de bu tür yazma uç noktalarının (Madde 109/120) proxy gerektirdiği bilgisinin nerede yaşadığını belirsizleştirirdi.
- Zustand yerine yerel hook state — bu proje, kullanıcıya özel/tekil ayarlar (akış gizliliği, dil, vs.) için ZATEN "hook + optimistic + rollback" desenini kullanıyor (`useFeedPrivacy`, `useSettings`); global bir Zustand store'a yalnızca BU bayrak için taşımak, `followStore.ts` gibi GERÇEKTEN uygulama genelinde paylaşılan/çok sayıda bileşenden okunan state'ler için ayrılmış bir mekanizmayı, tek bir ayarlar-sayfası anahtarı için gereksiz yere karmaşıklaştırırdı.
- `showFollowErrorAlert`'in (Madde 120) kendi web/native Alert mantığını elle yazdığı fark edildi — halbuki `utils/confirmDialog.ts`'te zaten bunu yapan bir `notify()` yardımcısı VARDI (kendi yorumunda da "artık hepsi buradan içe aktarır" diyor). Bu görev sırasında hem yeni `useProfilePrivacy.ts` hem de mevcut `useFollowState.ts` bu tek kaynağa yönlendirildi (kod tekrarı giderildi). AYNI dosyadaki (`useFollowState.ts`) bir başka, daha büyük çaplı tekrar (`confirmAsync` ile aynı işi yapan elle yazılmış onay diyaloğu) kapsam dışı bırakılıp ayrı bir arka plan görevi olarak işaretlendi.

**Doğrulama:** `npx tsc --noEmit` → 0 hata, `node --check server.js` → sözdizimi geçerli, JSON dosyaları `node -e "JSON.parse(...)"` ile doğrulandı. Yeni `PUT` proxy handler'ı boş bir portta (4832) ayağa kaldırılıp **canlı Trakt API'sine karşı** test edildi: token'sız `GET`/`PUT /users/settings` → gerçek Trakt `401`'i (network/routing hatası DEĞİL) doğru şekilde yansıttı. Tarayıcıda `/account` sayfası MİSAFİR modunda açılıp yeni importların/JSX'in sayfayı ÇÖKERTMEDİĞİ doğrulandı (yeni "Gizlilik" bölümü, "Akış" bölümüyle AYNI guard'a sahip olduğundan misafirde beklendiği gibi görünmüyor — bu doğru davranış). **Doğrulanamayan:** Gerçek bir kullanıcı token'ıyla uçtan uca toggle davranışı (bu ortamda gerçek bir Trakt OAuth oturumu yok) — kullanıcının kendi hesabıyla (1) mevcut gizlilik durumunun doğru okunduğunu, (2) toggle'ın Trakt.tv'deki gerçek ayarı değiştirdiğini, (3) internetsizken rollback + hata mesajının göründüğünü doğrulaması gerekiyor. **KULLANICI TARAFINDAN YAPILMASI GEREKENLER:** Bu değişiklik yalnızca YEREL `server.js`'te — üretimdeki Raspberry Pi sunucusuna deploy edilmedi; kodu çekip (1) `node server.js`'i yeniden başlatması, (2) web build'ini yeniden yayınlaması gerekiyor.

## 123. Bug: Zaten Takip Edilen Kullanıcının Profilinde "Takip Et" Görünüyordu — `slug` vs `username` Karışıklığı

**Bildiren:** Kullanıcı, zaten takip ettiği birinin profiline girince "Takip Ediliyor" yerine "Takip Et" butonu gördüğünü bildirdi.

**Kök neden:** `followStore.connectionStates`, `getMyFollowingSlugs()`'tan gelen Trakt'ın KANONİK `ids.slug` değerleriyle anahtarlanıyor (her zaman küçük harfli, URL-güvenli). Ama profil sayfalarına yönlendiren üç yer — `features/feed/components/FeedCard.tsx`, `MarathonFeedCard.tsx`, `UserProfileCard.tsx` — `router.push` ile rotaya `.username`'i (Trakt'ın görünen kullanıcı adı, büyük harf İÇEREBİLİR) koyuyordu; oysa projedeki DİĞER tüm `/user/*` yönlendirmeleri (ör. `ProfileMobile.tsx`, `profile.web.tsx`, `[slug].web.tsx`'in takipçi/takip listesi linkleri) zaten doğru `ids?.slug || username` desenini kullanıyordu — bu üçü, o deseni kaçırmış "yetim" noktalardı. `username !== ids.slug` olan (ör. adında büyük harf olan) bir kullanıcı için, `screens/PublicProfileMobile.tsx`/`app/(protected)/user/[slug].web.tsx`'teki `useFollowState(slug)` bu YANLIŞ değeri store'da arıyor, bulamayınca (`isFetched=true` ama `connectionStates[bu-değer]` yok) `useFollowState.ts`'in kendi mantığı gereği kesin bir "hayır, takip etmiyor" varsayıyordu (bkz. `hooks/useFollowState.ts`'teki `else if (isFetched) connectionState = 'none'` dalı) — teknik olarak DOĞRU bir mantık, ama YANLIŞ bir anahtarla besleniyordu.

**Çözüm — iki katmanlı:**
1. **Kök neden (yönlendirme kaynağı):** `FeedCard.tsx`, `MarathonFeedCard.tsx`, `UserProfileCard.tsx`'teki üç `router.push(\`/user/${...username}\`)` çağrısı, projenin geri kalanıyla AYNI `traktSlug || username` / `ids?.slug || username` desenine çevrildi (`FeedUser` tipinde zaten hazır bir `traktSlug` alanı var, `TraktUserProfile`'da `ids.slug`).
2. **Savunma katmanı (tüketici ekranlar):** `screens/PublicProfileMobile.tsx` ve `app/(protected)/user/[slug].web.tsx`, `useFollowState`'i artık ham rota parametresiyle DEĞİL, `profile?.ids?.slug || slug` ile çağırıyor — profil yüklenince (kaynağı ne olursa olsun, eski bir bookmark/manuel URL dahil) kanonik slug'a "kendi kendini düzeltiyor". Bu, gelecekte biri yine yanlışlıkla `username` ile yönlendirse bile aynı hatanın TEKRARLANMASINI önlüyor — tek bir merkezi noktada (üç ayrı call-site'a güvenmek yerine) ek bir güvence katmanı.

**Kapsam dışı (bilinçli):** `features/feed/hooks/useUserSearch.ts` zaten doğru `profile?.ids?.slug`'ı kullanıyordu, dokunulmadı. `NetworkUserCard.tsx` kendi `useFollowState` çağrısında zaten `user.ids?.slug || user.username` kullanıyordu (yalnızca dolaylı olarak, içindeki `UserProfileCard`'ın yönlendirme hatasından etkileniyordu — o da bu madde ile düzeldi).

**Doğrulama:** `npx tsc --noEmit` → 0 hata. Tarayıcıda `/user/testuser` (mevcut olmayan bir slug) açılıp yeni kodun sayfayı ÇÖKERTMEDİĞİ, beklenen "Profil yüklenemedi" hata durumunun düzgün göründüğü doğrulandı (bu sandbox'ta internet erişimi olmadığından gerçek bir Trakt kullanıcısıyla uçtan uca test edilemedi). **Doğrulanamayan:** Gerçek bir `username !== ids.slug` senaryosuyla (büyük harfli kullanıcı adı) canlı doğrulama — kullanıcının böyle bir hesabı takip ettiği bir profile feed/marathon kartından tıklayıp artık doğru "Takip Ediliyor" gördüğünü teyit etmesi gerekiyor.

## 124. Arka Plan Görevinin (Madde 120'nin `confirmAsync` Temizliği) Elle Birleştirilmesi + Genel Denetim

**Durum:** Madde 120'de spawn edilen arka plan görevi (`task_462d9a57`, ayrı bir git worktree'de — `.claude/worktrees/intelligent-mclaren-7b32d5`, dal `claude/intelligent-mclaren-7b32d5`) `hooks/useFollowState.ts`'teki takipten çıkma onay diyaloğunu `utils/confirmDialog.ts`'teki `confirmAsync`'e taşıyarak tamamlandı. Ama bu worktree, bu oturumun BAŞINDAKİ commit'ten (b8496b8) dallandığı için, aynı dosyada Madde 120/122'de yapılan `notify()` tabanlı hata mesajı eklemelerinden HABERSİZDİ — iki değişiklik aynı import bloğuna ve yakın satırlara dokunduğundan, worktree'nin diff'i olduğu gibi uygulansaydı git merge çakışmasına, `docs/HISTORY.md`'de de İKİ AYRI "## 120." başlığının çakışmasına yol açacaktı.

**Çözüm — küçük ölçekli olduğu için elle birleştirildi (worktree'ye ayrı bir komut verilmedi):** Worktree'nin `useFollowState.ts` diff'i doğrulandı (`Platform` import'unun kaldırılması güvenli — dosyada başka hiçbir `Platform.` kullanımı yoktu; `Alert` import'u misafir uyarısı için hâlâ gerekli olduğundan korundu) ve mevcut (`notify()`'lı) sürümün üzerine elle uygulandı: `confirmDialog.ts`'ten hem `confirmAsync` hem `notify` TEK bir import satırında birleştirildi, elle yazılmış `Platform.OS === 'web' ? window.confirm(...) : Alert.alert(...)` dallanması kaldırılıp yerine `await confirmAsync(title, message, confirmLabel, cancelLabel)` kondu (davranış AYNI: web'de `window.confirm`, native'de iki butonlu `Alert.alert`).

**Genel denetim:** Kullanıcının isteği üzerine bu oturumdaki TÜM değişen dosyaların (`git diff --stat` ile 17 dosya) diff'leri tek tek yeniden gözden geçirildi — routing/screen dosyaları, `services/api/social.ts`/`users.ts`, `server.js`'in yeni `PUT`/`DELETE` handler'ları, tüm locale dosyaları, `FeedCard`/`MarathonFeedCard`/`UserProfileCard`'daki slug düzeltmesi. Ek bir hata bulunmadı.

**KULLANICIYA ÖNEMLİ NOT:** `task_462d9a57`'nin çalıştığı ayrı worktree/oturum ARTIK GEREKSİZ — onun tek değişikliği burada elle (ve `notify()` ile birleştirilerek) zaten uygulandı. O oturumdaki chip/PR'ı AYRICA uygulamayın/birleştirmeyin — mevcut haliyle uygulanırsa (eski, `notify()`'sız bir temel üzerinden geldiği için) Madde 120/122'nin hata mesajı gösterme özelliğini SESSİZCE GERİ ALIR. O arka plan oturumu güvenle kapatılabilir/atlanabilir.

**Doğrulama:** `npx tsc --noEmit` → 0 hata.

## 125. İzleme Listesi Butonu Rozet Satırına Taşındı — Başka Bir Worktree'nin Elle Birleştirilmesi (Madde 124'le Aynı Desen)

**Bağlam:** Kullanıcı, `.claude/worktrees/intelligent-mclaren-7b32d5` (plan dosyası: `C:\Users\ardag\.claude\plans\iterative-sparking-hippo.md`) adlı ayrı bir oturumda "İzleme Listesi" butonunun `MediaHero.tsx` rozet satırına (Puan/Favori/Liste Ekle'nin yanına) TV Time tarzı görünür bir buton olarak eklendiğini, "..." menüsündeki eski satırın kaldırıldığını bildirdi — ama o oturum worktree olduğu için `npm install`/tarayıcı testi yapamamıştı.

**Teşhis — worktree'nin kod hâli ARTIK GEÇERSİZDİ, elle yeniden uygulandı (Madde 124'teki `task_462d9a57` durumuyla BİREBİR AYNI desen):** Worktree, ana daldan (`main`) BUGÜNKÜ oturumun TÜM işinden (Madde 108-124) önceki bir noktada (`b8496b8`) ayrılmıştı. `git diff` ile karşılaştırıldığında:
- `components/modals/OptionsModal.tsx`: worktree'nin taban sürümü mevcut `main` ile **birebir aynıydı** (0 satır fark) — oradaki değişiklik (İzleme Listesi satırının kaldırılması) doğrudan uygulanabilir durumdaydı.
- `components/MediaHero.tsx`: worktree'nin taban sürümü mevcut `main`'den **1022 satır** farklıydı (dosya neredeyse tamamen başka bir noktada) — worktree'nin diff'i doğrudan uygulanamazdı, mevcut `main`'in GERÇEK yapısına göre YENİDEN yazıldı.
- `hooks/useFollowState.ts`: worktree'nin uncommitted değişikliği (`Platform.OS` dallanmasını merkezi `confirmAsync()`'e taşımak) zaten **mevcut `main`'de vardı** (üstelik çok daha ileri bir hâliyle — Zustand `followStore`, metrik kaydı, takipten çıkma onayı dahil) — bu kısım atlandı, hiçbir şey yapılmadı.
- **Ayrı bir bulgu — `.gitignore`:** Worktree'de commit edilmiş (`f9e585e`) ve commit edilmemiş bir değişiklik daha vardı: `docs/` klasörünü (İLK `docs/HISTORY.md` DAHİL) git takibinden tamamen çıkarma teklifi ("Raspberry Pi depolama tasarrufu" gerekçesiyle). Kullanıcıya soruldu — `AGENTS.md`'nin kendi "HISTORY.md her özellik sonrası güncellenmeli" kuralıyla çelişeceği ve yeni clone/Pi deploy'larda bu dosyaların hiç gelmeyeceği açıklandı. Kullanıcı "güvenlik açığı yoksa en mantıklısını yap" dedi — **`.gitignore`'a DOKUNULMADI**, mevcut takip davranışı korundu (bu, AGENTS.md'nin kendi kuralıyla çelişmeyen tek seçenekti).

**Uygulanan (mevcut `main`'in gerçek yapısına göre, worktree'den ilham alınarak):**
- `components/MediaHero.tsx`: `Bookmark` ikonu import edildi; rozet satırına Favori ile Listeye Ekle arasına (plandaki sıra: `[Puan][Kullanıcı Puanı][Favori][İzleme Listesi][Listeye Ekle]`) yeni bir `TouchableOpacity` eklendi — Favori butonuyla BİREBİR AYNI rozet deseni (`styles.userRatingBadge` + `styles.iconOnlyBadge`), aktifken `styles.userRatingActive` (mavi `#3b82f6`, rating rozetiyle aynı vurgu — Favori'nin kırmızısından bilinçli olarak farklı). Misafir kontrolü Favori butonuyla aynı desende (`handleToggleWatchlist` → `isGuest` ise `Alert.alert`).
- `components/modals/OptionsModal.tsx`: Eski "İzleme Listesine Ekle/Çıkar" satırı, `handleToggleWatchlist` fonksiyonu, `isWatchlisted`/`onToggleWatchlist` prop'ları ve artık kullanılmayan `Bookmark` import'u KALDIRILDI (AI_RULES'daki "eski state/handler/import'u aynı anda temizle" kuralına uyularak) — aynı eylemi iki yerde göstermemek için.
- `app/show/[id].tsx` / `app/movie/[id].tsx`: DOKUNULMADI — `isWatchlisted`/`onToggleWatchlist`'i zaten `MediaHero`'ya geçiyorlardı (`toggleWatchlistStatus()` mutation'ı optimistic UI + Trakt sync + rollback ile zaten hazırdı).

**Doğrulama:** `npx tsc --noEmit` → 0 hata. `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` → değiştirilen iki dosyada (MediaHero.tsx, OptionsModal.tsx) sıfır kalıntı (raporlanan diğer hatalar — `features/notifications/hooks/useNotifications.ts`, `screens/PublicProfileMobile.tsx` — bu değişiklikten ÖNCE de vardı, başka bir oturumun işi, kapsam dışı bırakıldı). Metro bundler hatasız derledi (`preview_logs` temiz). **Doğrulanamayan:** Gerçek bir dizi/film detay sayfasında görsel/etkileşimli test — bu ortamda tarayıcı sekmesi Trakt'a hiç ulaşamıyor (iskelet ekranında süresiz bekliyor, önceki maddelerdeki AYNI kısıtlama), kullanıcının kendi ortamında (a) rozet satırında Bookmark ikonu görünüyor mu, (b) tıklayınca mavi/aktif olup tekrar tıklayınca geri dönüyor mu, (c) "..." menüsünde artık bu satırın olmadığını, (d) mobil+web'de rozet satırının taşmadığını doğrulaması gerekiyor. **Kullanıcıya not:** `.claude/worktrees/intelligent-mclaren-7b32d5` oturumu artık gereksiz — Madde 124'teki gibi güvenle kapatılabilir, işi burada zaten (mevcut `main`'e göre düzeltilerek) uygulandı; oradaki `.gitignore` değişikliği AYRICA uygulanmamalı.

## 126. "Takip Et" (Watchlist) Butonu Salt İkondan İkon+Metne Çevrildi — "Listeye Ekle" ile Görsel Karışıklık Giderildi

**Bildiren:** Proje sahibi, Madde 125'te eklenen Takip Et (watchlist, `Bookmark` ikonu) butonunun hemen yanındaki "Listeye Ekle" (`ListPlus` ikonu) butonuyla ikisi de salt ikon olduğu için görsel olarak ayırt edilemediğini fark etti — kullanıcılar bunu muhtemelen hiç sorun olarak görmezdi ama iki ayrı eylemin (Trakt watchlist'e ekleme vs. kişisel özel listeye ekleme, bkz. Madde 125'teki net ayrım) aynı görünmesi istenmedi. Çözüm için özellikle şunu vurguladı: kişiyi takip etme (Public Profile ekranındaki Takip Et/Ediliyor butonu) ile KARIŞTIRILMAMALI.

**Çözüm:** `components/MediaHero.tsx`'teki Takip Et butonu, `styles.iconOnlyBadge` (salt ikon) yerine `Kullanıcı Puanı` rozetiyle AYNI ikon+metin deseni kullanacak şekilde değiştirildi: pasifken "Takip Et", aktifken "Takip Ediliyor" (mavi `#3b82f6`, rating rozetiyle aynı vurgu). Karışıklık riski iki katmanlı önlendi: (1) farklı bir sayfa bağlamı — bu buton medya (dizi/film) detay sayfasında, kişi takip butonu Public Profile ekranında, ikisi asla aynı ekranda yan yana görünmüyor; (2) farklı ikon — `Bookmark` (medya) vs `UserPlus`/`Check` (kişi). Yeni çeviri anahtarları: `watchlistAction` ("Takip Et"/"Track"), `watchlistActive` ("Takip Ediliyor"/"Tracking") — tr/en `media.json`.

**Kapsam bilinçli olarak dar tutuldu:** `MediaHero.tsx` mobil/web arasında zaten TEK, paylaşımlı bir dosya (ayrı `.web.tsx` yok) — bu yüzden tek bir değişiklik her iki platforma da otomatik yansıyor, ayrı bir web implementasyonu gerekmedi. İstek özellikle medya detay sayfasındaki butonla ilgiliydi (plan'ın Faz 4'ü — kart hover'larına watchlist butonu eklemek — kapsam dışı, ayrıca istenmedi).

**Doğrulama:** `npx tsc --noEmit` → 0 hata. **Doğrulanamayan:** Gerçek bir detay sayfasında görsel test (bu ortamda tarayıcı Trakt'a ulaşamıyor, Madde 125'teki AYNI kısıtlama) — kullanıcının kendi ortamında rozetin taşmadığını ve iki metnin (Takip Et/Takip Ediliyor) doğru göründüğünü doğrulaması gerekiyor.

## 127. Takip Et Butonu Rozet Satırından Çıkarılıp Kendi Aksiyon Çubuğuna Taşındı

**Bildiren:** Proje sahibi, Madde 126'nın ekran görüntüsünü paylaştı — House of the Dragon detay sayfasında rozet satırının artık 5 öğe (Puan/Kullanıcı Puanı/Favori/Takip Et/Listeye Ekle) taşıdığını, satırın "tek yerde ve kalabalık" göründüğünü bildirdi. Takip Et butonunun kullanıcı deneyimi açısından daha iyi bir yere konulmasını istedi.

**Çözüm:** `components/MediaHero.tsx`'te Takip Et, rozet satırından (ratingsRow) tamamen çıkarılıp `contentContainer` (poster+başlık satırı) kapandıktan HEMEN SONRA, OVERVIEW'dan ÖNCE kendi başına tam genişlikte bir aksiyon çubuğuna taşındı — TV Time'daki gibi belirgin, kendi satırında tek bir buton. Rozet satırı eski hâline (4 öğe: Puan, Kullanıcı Puanı, Favori, Listeye Ekle) döndü. Görsel dil: pasifken yarı saydam beyaz (`rgba(255,255,255,0.08)` arka plan + `rgba(255,255,255,0.14)` kenarlık, beyaz `Bookmark` ikon+metin), aktifken mavi (`rgba(59,130,246,0.12)` arka plan + mavi kenarlık/metin/ikon) — Madde 126'daki renk kararlarıyla (ve projenin genelindeki "aktif = mavi" deseniyle) tutarlı, yalnızca yerleşim değişti. `insets.left`/`insets.right` `contentContainer` ile aynı şekilde uygulandı (çentikli ekranlarda hizasız kalmasın diye).

**Kapsam:** Yine `MediaHero.tsx` TEK dosya (mobil/web ortak) olduğundan bu yerleşim değişikliği otomatik olarak her iki platforma yansıyor — ayrı bir web düzeni gerekmedi.

**Doğrulama:** `npx tsc --noEmit` → 0 hata.

## 128. "Profili Düzenle" Artık Gerçek Bir Form Ekranı — Ayarlar'a Yönlendirme Kaldırıldı

**İstek:** Profil sayfasındaki "Profili Düzenle" butonu genel Ayarlar ekranına (`/(protected)/account`) yönlendiriyordu — orada isim/bio/konum düzenleme hiç yoktu. Kullanıcının Trakt profilindeki `name`/`about`/`location` alanlarını düzenleyebileceği kendi ekranı istendi; avatar değişimi resim seçici AÇMADAN Trakt.tv'ye yönlendirmeli.

İstek metninde `services/trakt.ts` adında bir dosyaya ve global Zustand state güncellemesine atıfta bulunuluyordu — ikisi de bu projenin gerçek mimarisiyle uyuşmuyordu (bkz. Madde 122'deki AYNI iki sapma), aşağıda açıklandı.

**Eklenenler:**
1. `services/api/social.ts`: `TraktUserProfile` interface'ine `about`/`location` alanları eklendi — Trakt'ın `extended=full` yanıtı bunları zaten döndürüyordu, sadece tipte tanımlı değildi; yeni bir GET çağrısına gerek kalmadı.
2. `services/api/users.ts`: `updateProfile(data: { name, about, location })` eklendi — `updateProfilePrivacy` (Madde 122) ile BİREBİR aynı desen: `PUT /users/settings`, `TRAKT_PROXY_URL` üzerinden (CORS gerekçesi Madde 109/120/122'yle aynı).
3. `hooks/useMyTraktProfile.ts`: Fetch mantığı `fetchProfile` adlı bir `useCallback`'e çıkarıldı ve `refetch` olarak dışa aktarıldı (eski mount-`useEffect`'teki race-condition koruması `isMounted` parametresiyle korunarak, kod TEKRARI olmadan).
4. `hooks/useEditProfile.ts` (YENİ): `useProfilePrivacy.ts` ile AYNI desen — yerel state (`name`/`about`/`location`/`isSaving`), `profile` geldiğinde formu dolduran bir `useEffect`, `save()` (`updateProfile()` çağırır, hata olursa `notify()` ile Alert, başarıysa `true` döner).
5. `screens/EditProfileMobile.tsx` (YENİ) + `app/(protected)/profile/edit.tsx` (YENİ, re-export): `profile/statistics.tsx`'in izlediği "route dosyası re-export eder, gerçek ekran `screens/`'te" deseni. `SettingsHeader` (mevcut, `account.tsx`/`error-log.tsx`'te de kullanılan) yeniden kullanıldı. Avatar üzerine kalem ikonlu bir buton — tıklanınca resim seçici AÇILMIYOR, `confirmAsync` ile "Trakt.tv'yi ziyaret etmek ister misiniz?" sorup onaylanırsa `Linking.openURL('https://trakt.tv/settings/profile')`. Mount'ta `isGuest` ise `notify` + otomatik geri dönüş (AI_RULES'ın zorunlu guest koruması).
6. `components/profile/ProfileHeader.tsx` ve `app/(protected)/(tabs)/profile.web.tsx`'teki "Profili Düzenle" butonları artık `/(protected)/account` yerine `/(protected)/profile/edit`'e yönleniyor.
7. `screens/ProfileMobile.tsx` ve `app/(protected)/(tabs)/profile.web.tsx`: `@react-navigation/native`'in `useFocusEffect`'i ile, ekran odağa her geldiğinde `useMyTraktProfile().refetch()` çağrılıyor — Profili Düzenle'den `router.back()` ile dönüldüğünde güncel isim/bio anında görünür.
8. Çeviriler: `locales/{tr,en}/media.json`'a `editProfileTitle`, `editProfileNameLabel`, `editProfileNamePlaceholder`, `editProfileAboutLabel`, `editProfileAboutPlaceholder`, `editProfileLocationLabel`, `editProfileLocationPlaceholder`, `editProfileAvatarHint`, `editProfileAvatarConfirmTitle/Message/Button`, `editProfileSaveButton` eklendi (mevcut `editProfile` anahtarının yanına, alfabetik sırada). Hata mesajı için yeni bir anahtar açılmadı — mevcut `common:actionFailedMessage`/`common:error` yeniden kullanıldı (`useEditProfile.ts` → `notify()`).

**Kullanıcının isteğinden bilinçli sapmalar (Madde 122'deki gerekçeyle AYNI):**
- `services/trakt.ts` yerine `services/api/users.ts` — proje zaten Trakt çağrılarını sorumluluğa göre `services/api/{auth,social,users,...}.ts` altında bölüyor.
- Global Zustand state güncellemesi yerine `useFocusEffect` tabanlı refetch — bu proje kullanıcıya özel/tekil profil verisini (Madde 122'de olduğu gibi) ZATEN "hook + yerel state" desenine tutuyor; tek bir düzenleme ekranı için global bir store eklemek gereksiz karmaşıklık olurdu. Aynı "kaydedince anında görünme" kullanıcı deneyimi, Zustand olmadan `refetch()` ile sağlandı.

**Doğrulama:** `npx tsc --noEmit` → 0 hata. **Doğrulanamayan:** Gerçek bir Trakt oturumuyla uçtan uca (bu ortamda gerçek OAuth oturumu yok) — kullanıcının kendi hesabıyla (1) formun mevcut ad/bio/konumla dolu geldiğini, (2) kaydedince Trakt'a gerçekten yazıldığını ve profile dönünce yeni değerlerin göründüğünü, (3) avatar kalemine basınca resim seçicinin AÇILMADIĞINI ve `confirmAsync`in çıktığını, (4) misafir hesapla `/(protected)/profile/edit`'e doğrudan gidilirse guard'ın geri attığını doğrulaması gerekiyor.

## 129. Bildirimler Ekranındaki Sahte Veriler Kaldırıldı — Gerçek Takip İstekleri + Basit Aktivite Bildirimleri

**İstek:** Madde 121'de kurulan `/notifications` ekranı tamamen `MOCK_FOLLOW_REQUESTS`/`MOCK_NOTIFICATIONS` sahte verisiyle çalışıyordu. Kullanıcı sahte verilerin kaldırılıp gerçek verilerle değiştirilmesini istedi. İki ayrı soruyla kapsam netleştirildi: (1) Genel Bildirimler için TAM push-bildirim altyapısı (yeni Supabase tablosu + `kaymaktv-feedback-worker`'a yeni endpoint) DEĞİL, yalnızca basit uygulama-içi "aktivite" bildirimleri ("biri seni takip etti" / "takip isteğin onaylandı") isteniyor — dış push YOK. (2) Takip İstekleri gerçek Trakt verisine bağlansın.

**Kritik bulgu:** Trakt'ın gelen takip isteklerini listeleme/onaylama uç noktaları (`GET/POST/DELETE /users/requests[/:id]`) bu projede HİÇ kullanılmamıştı — `docs/notifications.md`'nin kendi "Açık Soru #4"ü bunu zaten ayrı bir özellik olarak işaretlemişti. Bu oturumda internet erişimi olmadığından Madde 122'deki gibi `curl` ile CORS doğrulaması YAPILAMADI — ihtiyatlı yol seçildi: yeni üç uç nokta da `TRAKT_PROXY_URL` üzerinden geçiyor (Madde 109/120/122'deki AYNI "kullanıcının özel/yazma verisi" ailesi mantığı; `server.js`'te değişiklik GEREKMEDİ, proxy zaten endpoint-agnostik).

**Bölüm A — Takip İstekleri (gerçek Trakt verisi):**
1. `services/api/social.ts`: `getFollowRequests()` (GET `/users/requests`), `approveFollowRequest(id)` (POST `/users/requests/:id`), `denyFollowRequest(id)` (DELETE `/users/requests/:id`) eklendi — `followTraktUser`/`unfollowTraktUser` ile BİREBİR aynı proxy deseni.
2. `hooks/useFollowRequests.ts` (YENİ): `useProfilePrivacy.ts` ile aynı desen — guest/token korumalı fetch, `accept(id)`/`reject(id)` optimistic kaldırma + hata olursa rollback + `notify()`.
3. `app/(protected)/notifications.tsx`: "Takip İstekleri" bölümü artık bu hook'u kullanıyor, `FollowRequestRow` gerçek `TraktFollowRequest.user` alanlarını (`images.avatar.full`, `name`, `username`) okuyor, yükleniyor durumu için `ActivityIndicator` eklendi.

**Bölüm B — Basit Aktivite Bildirimleri (Genel Bildirimler, push YOK, backend YOK):**
1. `store/notificationStore.ts` genişletildi (mevcut `unreadCount`/`setUnreadCount`/`clearUnread` korunarak): `items` (en fazla 50, en yeni önde), `seenFollowerSlugs` (`null` = ilk çalıştırma, taban alınır ama bildirim ÜRETİLMEZ — aksi halde mevcut TÜM takipçiler "yeni" gibi görünüp bildirim yağmuru olurdu), `pendingSentSlugs`, `addPendingSentSlug(slug)`, `refreshActivity()` (yeni takipçi diff'i için `getFollowers('me')` + onaylanan istekler için `followStore.fetchFollowingSlugs()`'un ZATEN TTL-cache'li sonucunu okur, yeni bir ham `getMyFollowingSlugs()` çağrısı EKLEMEZ), `markAllRead()`. Kalıcılık `store/followStore.ts`'teki hydrate/persist deseninin BİREBİR aynısı (AsyncStorage, `logError` ile sessiz-yutmayan hata günlüğü).
2. `hooks/useFollowState.ts`: `toggleFollow` başarıyla `approvedAt: null` (veya 409 "zaten pending") döndürdüğünde `useNotificationStore.getState().addPendingSentSlug(slug)` çağrısı eklendi — karşı taraf daha sonra onaylayınca `refreshActivity()` bunu tespit edip bildirim üretebilsin diye.
3. `features/notifications/components/NotificationBadge.tsx`: mount olduğunda (guest/token korumalı — Madde 89'daki AYNI hata sınıfını tekrar açmamak için `useAuth()` kontrolü eklendi) `refreshActivity()` çağrılıyor.
4. `app/(protected)/notifications.tsx`: "Genel Bildirimler" bölümü artık `store`'un `items`'ını okuyor; ekran açılınca (guest korumalı) `refreshActivity()` + `markAllRead()` çağrılıyor (ekranı açmak rozeti temizler).
5. `utils/formatRelativeTime.ts` (YENİ): `components/comments/CommentItem.tsx`'teki yerel `formatRelativeDate` fonksiyonu davranış AYNI kalacak şekilde buraya taşındı (bildirim satırları da aynı "X önce" formatına ihtiyaç duyduğundan tekrar yazmak yerine tek kaynağa çıkarıldı), `CommentItem.tsx` bu paylaşılan fonksiyonu kullanacak şekilde güncellendi.
6. Çeviriler: `locales/{tr,en}/common.json`'a `activityNewFollower`/`activityRequestApproved` eklendi (alfabetik sırada); mevcut `daysAgo`/`hoursAgo`/`minutesAgo`/`justNow`/vb. yeniden kullanıldı.

**Kapsam dışı (bilinçli, kullanıcının seçimiyle):** Gerçek push bildirimleri (Expo/Web Push), yeni Supabase tablosu, `kaymaktv-feedback-worker` değişiklikleri — `docs/notifications.md`'nin Faz 2'si olarak kalıyor. Arka planda/uygulama kapalıyken bildirim üretimi YOK — yalnızca `NotificationBadge` mount olduğunda veya Bildirimler ekranı açıldığında diff hesaplanıyor. Takip isteği reddedilirse karşı tarafa herhangi bir "reddedildi" bildirimi YOK (Trakt bunun için sinyal vermiyor).

**Doğrulama:** `npx tsc --noEmit` → 0 hata, değişen `common.json` dosyaları `node -e "JSON.parse(...)"` ile doğrulandı. Kod tabanında `MOCK_FOLLOW_REQUESTS`/`MOCK_NOTIFICATIONS` referansı KALMADI (grep ile doğrulandı, yalnızca bu HISTORY.md kaydında geçiyor). **Doğrulanamayan:** Gerçek bir Trakt oturumuyla uçtan uca (bu ortamda internet erişimi/gerçek OAuth oturumu yok) — kullanıcının kendi hesabıyla (1) gelen bir takip isteğinin listede gerçekten göründüğünü ve Kabul Et/Reddet'in Trakt'a gerçekten yazdığını, (2) yeni bir takipçi kazanınca (bir SONRAKİ `refreshActivity()` çağrısında, ilk çalıştırma hariç) bildirim üretildiğini, (3) gizli bir hesaba gönderilen bir takip isteği onaylanınca "onaylandı" bildirimi göründüğünü doğrulaması gerekiyor.

## 130. Bug: "Profili Düzenle" Kaydediyor Ama Kalıcı Olmuyormuş Gibi Görünüyordu — Trakt CDN Önbelleği

**Bildiren:** Kullanıcı Madde 128'deki Profili Düzenle ekranında ad/bio/konumu değiştirip kaydetti, profile geri döndü, tekrar Düzenle'ye girince DEĞİŞMEMİŞ eski hali gördü — "Trakt ile tam entegre olması gerekiyor" diyerek durumun kontrol edilmesini istedi.

**Doğrulama adımları (bu oturumda istisnaen internet erişimi vardı):**
1. **Yazma tarafı gerçek Trakt kaynağıyla doğrulandı** — `github.com/trakt/trakt-api` deposundaki (Trakt'ın resmi API tanım kaynağı) `settingsRequestSchema.ts` çekildi: `PUT /users/settings` gövdesi tam olarak `{ user: { name, about, location, private, dob } }` şeklinde, üçü de (name/about/location) GERÇEKTEN yazılabilir alanlar — `services/api/users.ts`'teki `updateProfile()`'ın gönderdiği gövde BİREBİR doğru. `server.js`'teki PUT proxy handler'ı da body'yi olduğu gibi Trakt'a iletiyor, sorun yok.
2. **Okuma tarafı da doğru alanı istiyor** — aynı depodaki `profileResponseSchema.ts`, `about`/`location`'ın yalnızca `extended=full` ile geldiğini doğruluyor; `getUserProfile()` zaten `?extended=full` gönderiyor.
3. **Kök neden — proje bu TAM sınıftan hatayı daha önce İKİ KEZ yaşamıştı (Madde 87, Madde 102):** Trakt'ın CDN'i GET yanıtlarını agresif önbelliyor. `getUserProfile('me')`'in çağırdığı `/users/me?extended=full` her seferinde BİREBİR AYNI URL — Madde 102'nin tabiriyle "mükemmel bir önbellek anahtarı". `updateProfile()` (PUT) Trakt'a anında yazıyor ama hemen ardından aynı ekranın/`useMyTraktProfile`'ın yaptığı `getUserProfile('me')` okuması CDN'de duran ESKİ yanıtı dönebiliyordu — yazma İŞLEMİ başarılı, yalnızca okunan içerik bayat, bu yüzden hata günlüğünde de HİÇBİR iz yoktu (istek teknik olarak 200 dönüyor).

**Çözüm (`services/api/social.ts`):** Madde 87'deki `services/api/comments.ts`'in `cacheBustParam()` deseni (`_=${Date.now()}`) BİREBİR aynı şekilde `getUserProfile()`'a eklendi — `/users/{id}?extended=full&_=...` artık her çağrıda benzersiz, CDN'i "yeni kaynak" sanmaya zorluyor. Kapsam Madde 87'deki gibi dar tutuldu: yalnızca `getUserProfile` (bu hatayla doğrudan ilgili fonksiyon), `getFollowers`/`getFollowing` gibi diğer `services/api/social.ts` GET'lerine YAYILMADI (bildirilen sorun yalnızca profil alanlarıyla ilgiliydi).

**Doğrulama:** `npx tsc --noEmit` → 0 hata. Bu oturumda istisnaen gerçek internet erişimi vardı ve `github.com/trakt/trakt-api` kaynağına karşı hem yazma hem okuma şemaları doğrulandı (yukarıda). **Doğrulanamayan:** Gerçek bir kullanıcı token'ıyla uçtan uca (bu ortamda hâlâ gerçek bir Trakt OAuth oturumu yok) — kullanıcının kendi hesabıyla Profili Düzenle'de bir alanı değiştirip kaydettikten hemen sonra tekrar girip yeni değerin göründüğünü doğrulaması gerekiyor.

## 131. Konum Alanı Tamamen Kaldırıldı + "Hakkında" Hiçbir Yerde Görünmüyordu — Bio Profil Ekranlarına Eklendi

**İstek:** Kullanıcı (1) Konum (şehir) alanının bu tür bir uygulamada gereksiz olduğunu belirtip TAMAMEN kaldırılmasını istedi, (2) Hakkında (bio) alanının kaydedildikten sonra "ne profilde görünüyor ne başka yerde" diye bildirdi.

**Teşhis (2. madde) — kök neden Madde 130'daki CDN önbelleği DEĞİL, daha temel bir eksiklik:** `grep -rn "\.about\b" **/*.tsx` sıfır sonuç döndürdü — `about` alanı `services/api/users.ts` (yazma), `hooks/useEditProfile.ts` (form state) ve `services/api/social.ts` (tip) dışında HİÇBİR ekran/bileşende OKUNMUYOR/RENDER EDİLMİYORDU. Yani Madde 130'daki CDN düzeltmesi doğru olsa bile, yazma+okuma mükemmel çalışsa dahi, kullanıcı bio'yu HİÇBİR YERDE göremezdi — çünkü onu gösterecek tek satır kod yoktu. "Ne profilde görünüyor ne başka yerde" şikayetinin en dolaysız açıklaması buydu.

**Çözüm — bio artık gerçekten gösteriliyor (hem kendi hem başkasının profilinde, Trakt'tan gelen gerçek veriyle):**
1. `components/profile/ProfileHeader.tsx` (mobil, hem `ProfileMobile.tsx`'te kendi profil hem `PublicProfileMobile.tsx`'te başka kullanıcı profili için ORTAK bileşen) — `@kullaniciadi` satırının altına `profile.about` varsa (`numberOfLines={3}`) eklendi.
2. `app/(protected)/(tabs)/profile.web.tsx`'teki `DesktopProfileHeader` (kendi profil, masaüstü) — aynı şekilde eklendi.
3. `app/(protected)/user/[slug].web.tsx` (başkasının profili, masaüstü) — aynı şekilde eklendi.
Üçü de `!!profile.about` koşuluyla — bio boşsa hiçbir boşluk/satır bırakmıyor.

**Konum kaldırma (1. madde) — kodun tamamından temizlendi:**
- `services/api/social.ts`: `TraktUserProfile.location` alanı silindi.
- `services/api/users.ts`: `updateProfile(data: { name, about, location })` → `updateProfile(data: { name, about })`, PUT gövdesinden `location` çıktı.
- `hooks/useEditProfile.ts`: `location`/`setLocation` state'i ve `save()`'in gönderdiği alan kaldırıldı.
- `screens/EditProfileMobile.tsx`: Konum `TextInput`/etiketi kaldırıldı; boşalan alanı doldurmak ve kullanıcının "açıklama çok daha önemli" vurgusuna karşılık, Hakkında kutusu büyütüldü (`numberOfLines={4}→6`, `minHeight: 100→150`).
- Çeviriler: `locales/{tr,en}/media.json`'dan `editProfileLocationLabel`/`editProfileLocationPlaceholder` silindi.

**Doğrulama:** `npx tsc --noEmit` → 0 hata, değişen `media.json` dosyaları `node -e "JSON.parse(...)"` ile doğrulandı. Kod tabanında `location`/`setLocation`/`editProfileLocation*` referansı KALMADI (yalnızca bu HISTORY.md kaydında geçiyor, grep ile doğrulandı). **Doğrulanamayan:** Gerçek bir Trakt oturumuyla uçtan uca (bu ortamda gerçek OAuth oturumu yok) — kullanıcının kendi hesabıyla Hakkında'yı kaydedip profiline döndüğünde metnin artık gerçekten göründüğünü doğrulaması gerekiyor; hâlâ görünmüyorsa bu, Madde 130'un CDN teorisinin ötesinde üçüncü bir kök neden (ör. yazmanın kendisinin sessizce reddedilmesi) olduğunu işaret eder ve hata günlüğü/ağ isteği detaylarıyla tekrar incelenmelidir.

## 132. ✅ ÇÖZÜLDÜ — "Kaydediyorum Ama Olmuyor, Hata da Vermiyor": SPA Fallback Her İsteğe `200 + HTML` Dönüyormuş

**Bildiren:** Kullanıcı Madde 130/131'den sonra da açıklamanın kaydedilmediğini bildirdi: "hem Trakt'ı hem uygulamayı test ettim, her ikisinde de yazılmamış." Yani önceki iki maddedeki teşhisler (CDN önbelleği, bio'nun render edilmemesi) GERÇEK sorunlardı ama ASIL kök neden bu değildi — yazma işlemi Trakt'a hiç ulaşmıyordu.

**Teşhis — bu oturumda internet erişimi vardı, kök neden CANLI SUNUCUYA KARŞI KESİN OLARAK KANITLANDI:**

1. **Trakt tarafı tamamen doğruydu.** Resmi API sözleşmesi (`github.com/trakt/trakt-api`) satır satır doğrulandı: `saveSettings` → `path: '/settings'`, `method: 'PUT'`, gövde `{ user: { name?, about?, location?, private?, dob? } }`, başarıda gövdesiz `201`. `about` hem istek (`settingsRequestSchema`) hem yanıt (`settingsResponseSchema`) şemasında GERÇEK bir alan. Token'sız canlı `PUT /users/settings` → `401` (yani uç nokta yönlendiriliyor, `404`/`405` değil). Kısacası gönderdiğimiz gövde/metot/yol %100 doğruydu.

2. **Kök neden `server.js`'in SPA fallback'iydi.** Satır 310'daki `app.use((req, res) => { res.sendFile(index.html) })` — metoda ve yola BAKMADAN **her** eşleşmeyen isteği yakalıyor ve `200 + index.html` döndürüyordu. Canlı sunucuya (kaymaktv.com) karşı yapılan iki test bunu kanıtladı:
   - `GET /api/trakt-proxy?endpoint=/users/settings` → `401`, `application/json` ✅ (GET handler'ı deploy edilmiş)
   - `PUT /api/trakt-proxy?endpoint=/users/settings` → **`200`, `text/html`** ❌ (PUT handler'ı YOK — Madde 122'de eklenmişti ama o maddenin kendi notunda yazdığı gibi Raspberry Pi'ye HİÇ DEPLOY EDİLMEDİ)

   Zincir şöyle işliyordu: PUT isteği → sunucuda PUT handler'ı yok → SPA fallback yakalıyor → `200 + HTML` → **axios 2xx gördüğü için hata FIRLATMIYOR** → `updateProfile()` başarıyla çözülüyor → `save()` `true` dönüyor → ekran `router.back()` ile kapanıyor, kullanıcı "kaydedildi" sanıyor → **ama istek Trakt'a hiç ulaşmamış.** Hata mesajı çıkmamasının ve hata günlüğünde hiçbir iz olmamasının sebebi tam olarak buydu.

   **Bu aynı sessiz hata `updateProfilePrivacy`'yi (Madde 122'deki "Gizli Hesap" anahtarı) de vuruyordu** — o da aynı PUT proxy'sini kullanıyor ve Madde 122'de "doğrulanamayan" olarak işaretlenmişti; hiçbir zaman gerçekten çalışmamış.

**Çözüm — üç katmanlı (biri bile tek başına yeterli değildi):**

1. **`server.js` (kök neden):** SPA fallback artık YALNIZCA gerçek sayfa gezinmelerine (`GET`/`HEAD`) hizmet ediyor ve `/api/*` altındaki hiçbir yolu ASLA yutmuyor — eşleşmeyen her API isteği dürüstçe JSON `404` dönüyor (`docs/AI_RULES.md` § sessiz başarısızlık yasak).

2. **`services/api/users.ts` — native artık proxy'ye HİÇ UĞRAMIYOR:** Proxy yalnızca tarayıcı CORS'u için vardı (Madde 109/120/122); native'de CORS diye bir şey yok ve uygulamanın diğer TÜM Trakt çağrıları zaten `getTraktClient()` ile doğrudan gidiyor. Artık `/users/settings` de native'de doğrudan Trakt'a gidiyor — **böylece özellik APK'da sunucu deploy'una hiç bağımlı olmadan çalışıyor** (ek fayda: 401'de token yenileme/rate-limit/circuit breaker mantığı da devreye giriyor, ham `axios` çağrısında bunların hiçbiri yoktu). Web proxy'yi kullanmaya devam ediyor. ⚠️ Bu, `auth.ts`'teki "Platform.OS EKLEMEYİN" uyarısıyla ÇELİŞMEZ: o uyarı `TRAKT_PROXY_URL`'in mutlak/göreli seçim koşuluna aittir (Madde 88/91), o koşula HİÇ dokunulmadı.

3. **İki ayrı sessiz-başarı savunması:**
   - `assertProxyReachedTrakt()`: proxy JSON yerine HTML döndürürse (SPA fallback yuttuysa) hata fırlatır — sunucu düzeltmesi deploy edilene kadar da web'i korur.
   - **Yaz-sonra-oku doğrulaması:** `updateProfile()` artık PUT'tan sonra ayarları geri okuyup `name`/`about`'un GERÇEKTEN yazıldığını teyit ediyor; tutmadıysa gönderilen ve okunan değerleri içeren açıklayıcı bir hata fırlatıyor. Doğrulama okuması cache-bust'lı (Madde 130) — bayat okuma yüzünden yanlış hata verilmesin diye. Artık bir kaydetmenin sessizce kaybolması MÜMKÜN DEĞİL.
   - `hooks/useEditProfile.ts`: hata artık `logError` ile kalıcı hata günlüğüne de yazılıyor (yalnızca `console.warn` yetmez) — sebebi Ayarlar > Hata Günlüğü'nden okunabilir.

**Ortak katman temizliği:** `getProfilePrivacy`/`updateProfilePrivacy`/`updateProfile` artık tek bir `getUserSettings()`/`updateUserSettings()` çiftini paylaşıyor — üç yerde kopyalanmış token/proxy/axios kodu tek kaynağa indi ve gizlilik anahtarı da yukarıdaki tüm korumaları otomatik olarak kazandı.

**Karakter sınırı (kullanıcının sorusu):** Trakt'ın resmi API sözleşmesinde `about` alanı `z.string().nullish()` — **hiçbir `.max()` kısıtı YOK**, yani API düzeyinde belgelenmiş bir karakter/kelime sınırı bulunmuyor. Bu yüzden istemciye UYDURMA bir sınır KONULMADI (yanlış bir sayı kullanıcının metnini haksız yere keserdi). Trakt ileride bir sınır uygularsa, yaz-sonra-oku doğrulaması bunu artık sessizce yutmak yerine görünür bir hataya çevirir.

**Doğrulama:** `npx tsc --noEmit` → 0 hata, `node --check server.js` → geçerli. **`server.js` düzeltmesi boş bir portta (4877) GERÇEKTEN AYAĞA KALDIRILIP test edildi — üç senaryo da geçti:** (1) `PUT /api/trakt-proxy?endpoint=/users/settings` → Trakt'ın gerçek `401`'i, `application/json` (istek Trakt'a ulaşıyor); (2) `PUT /api/olmayan-yol` → `404` + `{"error":"Not Found"}` JSON (ESKİDEN `200` + HTML dönerdi — kök neden düzeldi); (3) `GET /profile/edit` → `200` + `index.html` (SPA yönlendirmesi bozulmadı). İstemci guard'ının yakalaması gereken durum da canlı sunucuya karşı doğrulandı (`200`/`text/html`).

**KULLANICI TARAFINDAN YAPILMASI GEREKENLER:**
- **Mobil (APK):** Yeni bir derleme almak yeterli — sunucuya hiç dokunmadan çalışır (native artık doğrudan Trakt'a gidiyor).
- **Web:** `server.js` Raspberry Pi'ye deploy edilip `node server.js` yeniden başlatılmalı, ardından web build'i yeniden yayınlanmalı. Bu yapılmadan web'de kaydetme çalışmaz — ama artık sessizce başarılı görünmek yerine **görünür bir hata** verir.

## 133. ✅ ÇÖZÜLDÜ — Madde 132'nin Düzeltmesi Deploy Edildikten Sonra Yeni (Gerçek) Bir 401 Ortaya Çıktı: Web Proxy Yolu Token Yenileme Mekanizmasından Hiç Geçmiyordu

**Bildiren:** Kullanıcı Madde 132'deki `server.js` düzeltmesini Raspberry Pi'ye deploy edip yeniden başlattı. Bu KANITLADI ki kök neden gerçekten oradaydı: istek artık sessizce "başarılı" görünmüyor, **gerçek bir Trakt `401`'i** dönüyor (konsolda `AxiosError: Request failed with status code 401`, `/api/trakt-proxy?endpoint=%2Fusers%2Fsettings` isteğine). Yani proxy artık doğru çalışıyor — Trakt'a gerçekten ulaşıyor — ama Trakt token'ı reddediyor.

**Teşhis:** `services/api/traktClient.ts`'teki `getTraktClient()`'ın axios instance'ı, 401 aldığında OTOMATİK olarak refresh token ile yeni bir access token alıp isteği tekrar deneyen bir interceptor'a sahip (uygulamanın diğer TÜM Trakt trafiği — senkron, izleme geçmişi, vb. — bu instance'ı kullandığı için sorunsuz çalışıyor). Ama Madde 132'de web için yazılan `/users/settings` proxy çağrıları (`getUserSettings`/`updateUserSettings`'in web dalı) bu instance'ı HİÇ KULLANMIYOR — kendi ham `axios.get/put(TRAKT_PROXY_URL, ...)` çağrısını, `SecureStore`'dan tek seferlik okunan bir token'la yapıyor. Access token süresi dolmuşsa (ör. bir GET isteği az önce arka planda sessizce yenilemişti ama kullanıcı formu doldurup Kaydet'e basana kadar araya zaman girdi, ya da token doğal ömrünün sonundaydı), bu yol hiç yenileme DENEMEDEN doğrudan `401` ile başarısız oluyordu.

**Çözüm — iki dosya:**
1. **`services/api/traktClient.ts`:** Interceptor'ın 401→refresh mantığı, dışarıdan çağrılabilir bir `refreshAccessToken(): Promise<string>` fonksiyonu olarak dışa açıldı. Interceptor'la AYNI modül-seviyesi `isRefreshing`/`failedQueue`/`cachedAccessToken` durumunu PAYLAŞIR — bağımsız, yarışan ikinci bir yenileme akışı OLUŞTURMAZ (Trakt refresh token'ları muhtemelen tek kullanımlık; iki ayrı akış aynı anda aynı refresh_token'ı kullanmaya çalışırsa biri başarısız olurdu). Refresh token yoksa VEYA Trakt onu reddederse (süresi dolmuş/iptal edilmiş), interceptor'daki `refreshFailed` dalıyla BİREBİR aynı davranış: token'lar temizlenir, `notifySessionExpired()` çağrılır, kalıcı hata günlüğüne yazılır.
2. **`services/api/users.ts`:** Yeni bir `webProxyRequest()` yardımcı fonksiyonu — proxy isteği `401` alırsa `refreshAccessToken()`'ı çağırıp isteği TEK SEFERLİK tekrar dener (interceptor'ın `originalRequest._retry` deseniyle aynı ilke: sonsuz döngü riski yok). `getUserSettings`/`updateUserSettings`'in web dalları artık bunu kullanıyor — dolayısıyla `getProfilePrivacy`/`updateProfilePrivacy`/`updateProfile` üçü de otomatik olarak bu korumayı kazandı (zaten ortak katmanı paylaşıyorlardı, Madde 132'de birleştirilmişti).

**Kapsam bilinçli olarak dar tutuldu:** `services/api/social.ts`'teki diğer proxy çağrıları (`followTraktUser`/`unfollowTraktUser`/`getFollowRequests`/`approveFollowRequest`/`denyFollowRequest`) AYNI potansiyel açığa sahip olabilir ama bu oturumda dokunulmadı — kullanıcının isteği özellikle "açıklama özelliği" ile sınırlıydı, kanıtlanmamış bir hipotezle çalışan/test edilmiş kodu genişletmek riski gereksiz büyütürdü. Bu, ayrı bir arka plan görevi olarak işaretlendi (bkz. bu oturumun sonundaki chip).

**Doğrulama:** `npx tsc --noEmit` → 0 hata. `server.js` boş bir portta (4878) tekrar ayağa kaldırılıp geçersiz bir token'la hem `GET` hem `PUT /api/trakt-proxy?endpoint=/users/settings` denendi — ikisi de Trakt'ın gerçek `401`'ini `application/json` olarak dönüyor (proxy'nin kendisi sağlam, sorun istemci tarafındaydı). **Doğrulanamayan:** `refreshAccessToken()`'ın gerçek bir süresi dolmuş token + geçerli refresh token ile uçtan uca çalıştığı (bu ortamda gerçek bir Trakt OAuth oturumu yok) — kullanıcının kendi hesabıyla Hakkında'yı kaydedip artık ne 401 ne HTML hatası almadığını, değerin gerçekten Trakt'a yazıldığını doğrulaması gerekiyor.

## 134. 🔴 KESİN TEŞHİS — Trakt Profil Ayarlarını API'den YAZMAK MÜMKÜN DEĞİL: Yazma Kodu Tamamen Kaldırıldı, Salt-Okunur + trakt.tv Yönlendirmesine Geçildi

**Bildiren:** Kullanıcı Madde 133'ün token-yenileme düzeltmesinden sonra da aynı `401`'i aldı. Konsol logu belirleyiciydi: **iki ardışık `PUT` denemesi** görünüyordu (yani Madde 133'ün retry mantığı ÇALIŞTI, araya token yenilemesi girdi) ama **ikinci deneme de `401` döndü**. Aynı anda uygulamanın diğer Trakt trafiği (Delta Sync: "159 diziden 39'unun ilerlemesi çekilecek") sorunsuz çalışıyordu — yani access token TAMAMEN GEÇERLİ. Bu, "token süresi dolmuş" hipotezini kesin olarak ELEDİ.

**Araştırma — Trakt'ın public API'si canlı olarak denendi ve dokümantasyon satır satır tarandı:**

1. **Trakt, desteklenmeyen metot/yol için `400`, kimlik doğrulama reddi için `401` dönüyor** (canlı doğrulandı): `PUT /shows/trending` → `400`, `PUT /uydurma/yol/xyz123` → `400`, ama `PUT /users/settings` → `401`. Yani uç nokta bizim `client_id`'miz için GERÇEKTEN yönlendiriliyor — sorun "endpoint yok" değil, yetkilendirme.
2. **Trakt'ın tam yanıtı:** `WWW-Authenticate: Bearer realm="Trakt", error="invalid_token"` + **`Set-Cookie: _traktsession=...`**. Bir API uç noktasının oturum çerezi set etmesi, bu rotanın Trakt'ın **oturum-tabanlı (first-party web) akışından** geçtiğini gösteriyor.
3. **Public API dokümantasyonu (apiary blueprint, 854 KB, tam metin indirilip tarandı) kesin sonucu verdi:** `## Settings [/users/settings]` bölümünün altında **YALNIZCA `### Retrieve settings [GET]`** var. Hiçbir yazma metodu YOK. Karşılaştırma olarak, yazmaya izin veren bölümler metotlarını AÇIKÇA belgeliyor (`### Update a comment or reply [PUT]`, `### Update personal list [PUT]` vb.). Public API'de yazma izni olan `/users/*` uç noktalarının tam listesi çıkarıldı: `POST/DELETE /users/requests/{id}`, `POST/DELETE /users/{id}/follow`, `POST /users/hidden/*`, listeler CRUD, block/report — **`/users/settings` bu listede YOK.**
4. **Madde 128/132'nin dayandığı kaynak yanlış yorumlanmıştı:** `github.com/trakt/trakt-api`, Trakt'ın **KENDİ uygulamalarının** (app.trakt.tv) kullandığı sözleşme kütüphanesidir ve public API'de olmayan first-party uç noktaları da içerir (`younify`, `team`, `smart_lists`, plex ayarları vb. yanında `saveSettings` de). Oradaki `PUT /users/settings` tanımı, üçüncü partilere açık olduğu anlamına GELMİYORDU.

**Sonuç:** KaymakTV (ve herhangi bir üçüncü parti uygulama) Trakt profil ayarlarını — **ad, bio (`about`) ve gizli/açık hesap** — API üzerinden DEĞİŞTİREMEZ. Kullanıcının token'ı ne kadar geçerli olursa olsun `401` döner. Bu kod hatası değil, Trakt'ın bilinçli bir platform kısıtıdır.

**Kullanıcının kararı:** "Trakt'ın 1st-party kısıtlamalarına saygı duyacağız." Salt-okunur önizleme + dış bağlantı yaklaşımı seçildi.

**Uygulanan — yazma yolu TAMAMEN kaldırıldı:**
1. `services/api/users.ts`: `updateProfile`, `updateUserSettings`, `updateProfilePrivacy` SİLİNDİ. `webProxyRequest` yalnızca GET yapan `webProxyGet`'e indirildi. `getUserSettings`/`getProfilePrivacy` (GET, gerçekten çalışıyor) korundu; `getProfilePrivacy`'nin üstüne, gelecekte biri yazma eklemeye kalkarsa diye gerekçeli bir "⛔ YAZMA FONKSİYONU EKLEMEYİN" notu kondu.
2. `hooks/useEditProfile.ts`: TAMAMEN SİLİNDİ (form state + save mantığı artık anlamsız).
3. `hooks/useProfilePrivacy.ts`: `toggle`/`isSaving` kaldırıldı, salt-okunur (`isPrivate`, `isLoading`) hale getirildi. Aynı "⛔ toggle eklemeyin" notu eklendi. **Bu, Madde 122'de eklenen "Gizli Hesap" anahtarının aslında HİÇBİR ZAMAN çalışmadığını da düzeltiyor** — o madde kendi içinde "doğrulanamayan" olarak işaretlenmişti, kullanıcıya çalışıyormuş gibi görünen ama Trakt'a hiç yazmayan bir anahtardı.
4. `screens/EditProfileMobile.tsx`: Form (`TextInput`'lar, Kaydet butonu, `KeyboardAvoidingView`, avatar kalem ikonu + onay diyaloğu) kaldırıldı; yerine büyük avatar + görünen ad + `@kullanıcıadı` başlığı, "Görünen Ad" ve "Hakkında" kartları (boşsa italik "Belirtilmemiş"), bilgilendirme kutusu ve belirgin bir **"Trakt.tv'de Düzenle"** butonu (`Linking.openURL('https://trakt.tv/settings/profile')`) kondu. Ekran başlığı "Profili Düzenle" → **"Profilim"**.
5. `app/(protected)/account.tsx`: "Gizlilik" bölümündeki `SettingsSwitchRow` kaldırıldı; yerine (a) mevcut durumu gösteren salt-okunur bir `SettingsRow` ("Hesap Gizliliği: Gizli/Açık", yüklenirken "Yükleniyor..."), (b) `https://trakt.tv/settings/privacy` adresini açan "Gizlilik ayarlarını Trakt.tv'de yönet" satırı eklendi.
6. **Çeviri temizliği:** Yetim kalan 7 anahtar silindi (`editProfileNamePlaceholder`, `editProfileAboutPlaceholder`, `editProfileSaveButton`, `editProfileAvatarHint`, `editProfileAvatarConfirmTitle/Message/Button`) + `privateAccountHint`. Yeni anahtarlar eklendi: `editProfileEmpty`, `editProfileOpenTrakt`, `editProfileTraktOnlyHint`, `privateAccountPrivate`, `privateAccountPublic`, `privacyManageOnTrakt`. `editProfileTitle`/`privateAccount` değerleri yeni anlamlarına güncellendi.
7. **Silinen koda atıf yapan yorumlar düzeltildi:** `screens/ProfileMobile.tsx` (odakta refetch'in gerekçesi artık "kullanıcı trakt.tv'de değiştirip dönerse"), `services/api/social.ts` (cache-bust gerekçesi aynı şekilde güncellendi — mantık hâlâ GEÇERLİ ve gerekli), `server.js` (PUT proxy handler'ı BİLİNÇLİ olarak bırakıldı: artık istemcide kullanıcısı yok ama GET/POST/DELETE kardeşleriyle simetrik genel amaçlı bir köprü; yorumda bu durum açıkça belirtildi).

**KORUNAN VE GERÇEKTEN ÇALIŞAN kısımlar:** Bio'yu **okuma/gösterme** (Madde 131) tamamen geçerli — `GET /users/{id}?extended=full` public API'de ve `about` döndürüyor; kullanıcı hem kendi hem başkalarının açıklamasını profilde görüyor. Takip istekleri (Madde 129) doğru uç noktaları kullanıyor (`POST/DELETE /users/requests/{id}` — public API'de yazma izni VAR). Madde 132'nin `server.js` SPA-fallback düzeltmesi ve Madde 133'ün `refreshAccessToken`'ı da geçerliliğini koruyor: ikisi de GET proxy yolunu ve gelecekteki tüm proxy çağrılarını sessiz başarısızlıktan koruyor.

**Doğrulama:** `npx tsc --noEmit` → 0 hata, `node --check server.js` → geçerli. Dört locale dosyası JSON olarak parse edildi ve **tr/en anahtar paritesi betikle doğrulandı (her iki yönde de fark YOK)**. Yetim anahtar taraması `ripgrep` ile yapıldı — kodda kullanılan tüm `editProfile*`/`privateAccount*`/`privacy*` anahtarlarının JSON'da var olduğu, JSON'daki hiçbirinin yetim kalmadığı teyit edildi. Metro bundler hatasız derledi; tarayıcıda misafir modunda `/account` ve `/profile/edit` açıldı — çökme yok, konsol temiz, "Gizlilik" bölümü misafirde beklendiği gibi görünmüyor (mevcut `!isGuest && accessToken` guard'ı). **Doğrulanamayan:** Gerçek bir Trakt oturumuyla yeni salt-okunur ekranın görsel hâli (bu ortamda gerçek OAuth oturumu yok) — kullanıcının kendi hesabıyla (1) Profilim ekranında ad/bio'sunun doğru göründüğünü, (2) "Trakt.tv'de Düzenle" butonunun doğru sayfayı açtığını, (3) Ayarlar'da hesap gizliliğinin doğru okunduğunu doğrulaması gerekiyor.

**KULLANICI TARAFINDAN YAPILMASI GEREKENLER:** Yeni APK derlemesi + web build'inin yeniden yayınlanması. `server.js` bu maddede DAVRANIŞSAL olarak değişmedi (yalnızca bir yorum güncellendi) — Madde 132'de deploy edilen sürüm geçerliliğini koruyor, tekrar deploy gerekmiyor.

## 135. "Bize Ulaşın" Geri Bildirimine Performans Raporu da Eklendi — Artık Supabase'de Hata Günlüğü + Performans Raporu BİRLİKTE

**Bağlam:** Kullanıcı, Ayarlar'daki gizli Geliştirici Modu'nda "Performans Raporu" ve "Hata Günlüğü" satırlarının kullanıcıya (cihazında) göründüğünü fark etti, ama "Bize Ulaşın" ile bir sorun bildirildiğinde geliştiricilerin yalnızca performans durumunu görebildiğini, hata günlüğünün GERÇEK İÇERİĞİNİ göremediğini belirtti. Etik açıdan sorun olup olmayacağı soruldu.

**Teşhis:** İstemci zaten `getErrorLog()`'u topluyor ve `includeLogs` (kullanıcının açıkça onayladığı "Hata loglarımı da gönder" anahtarı) true iken Worker'a gönderiyordu — yani onay/gizlilik katmanı ZATEN vardı (Worker'da `sanitizeData` ile Bearer/apiKey/password/e-posta regex'i de zaten temizliyordu). Asıl kopukluk: Worker (`kaymaktv-feedback-worker/src/index.js`) `error_data`'yı Supabase'in `error_logs` tablosuna YAZIYORDU ama Discord bildirimine yalnızca `"💾 Log Durumu: ✅ Supabase'e kaydedildi"` gibi bir DURUM METNİ koyuyordu — gerçek log içeriği hiçbir zaman görünür bir yere ulaşmıyordu (Discord embed alan sınırı — 1024 karakter — zaten ham JSON'u sığdırmaya uygun değildi). Kullanıcı, Discord'un mevcut sınırlaması yüzünden bilinçli olarak "içerik Supabase'de kalsın" tercihini yaptı ve performans raporunun da AYNI şekilde (şu an hiçbir yere gitmiyor, yalnızca kullanıcının kendi panosuna kopyalanıyor — `handleExportMetrics`) Supabase'e eklenmesini istedi.

**Çözüm:**
1. `services/api/feedback.ts`: `FeedbackPayload`'a `performanceReport: unknown` eklendi.
2. `hooks/useReportIssue.ts`: `includeLogs` true iken `utils/metrics.ts`'teki `exportMetricsReport()` (zaten var olan, gizli Geliştirici Modu'nun "Performans Raporu" satırının kullandığı AYNI fonksiyon) çağrılıp `errorLogs` ile AYNI sanitize katmanından (`sanitizeText`) geçirilip payload'a ekleniyor. Metrik toplama başarısız olursa (ör. bozuk `metricsStore`) bu, ASIL bildirim gönderimini ENGELLEMEZ — yalnızca o alan `null` kalır (ayrı try/catch).
3. `kaymaktv-feedback-worker/src/index.js` (`handleFeedback`): `body.performanceReport`, `cleanLogs` ile BİREBİR aynı `sanitizeData()` katmanından geçirilip Supabase insert'ine `performance_report` sütunu olarak eklendi. Discord embed'indeki alan adı "💾 Log Durumu" → **"💾 Log & Performans Durumu"** olarak güncellendi (durum metni artık "(log + performans)" diyor) — Discord'a HÂLÂ ham veri KONULMADI, kullanıcının Supabase tercihi korundu.
4. `supabase/schema/011_error_logs_performance_report.sql` (YENİ): `ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS performance_report JSONB;` — Dashboard'dan elle çalıştırılması gereken bir migration. NOT: `error_logs` tablosunun kendisi hiçbir zaman bir migration dosyası olarak İZLENMEMİŞTİ (Madde 78'de Dashboard'dan elle kurulmuştu) — bu yüzden bu dosya bir `CREATE TABLE` değil, yalnızca eklemeli bir `ALTER TABLE`.
5. Çeviri: `reportIssueIncludeLogs` ("Hata loglarımı da gönder" → **"Hata loglarımı ve performans raporumu da gönder"**) — onay metni artık gerçekte gönderilenle BİREBİR eşleşiyor (şeffaflık).

**Kapsam bilinçli olarak dar tutuldu:** Discord bildirim formatı DEĞİŞTİRİLMEDİ (kullanıcının kendi tercihiyle Supabase-öncelikli akış korundu). Gizli Geliştirici Modu'ndaki "Performans Raporunu Kopyala" satırı (yalnızca kullanıcının kendi panosuna kopyalıyor) DOKUNULMADI — bu madde yalnızca "Bize Ulaşın" gönderim akışını genişletiyor.

**Doğrulama:** `npx tsc --noEmit` → 0 hata. Worker tarafı `node --check src/index.js` (sözdizimi geçerli) VE `npx wrangler deploy --dry-run` (27.31 KiB, bundle hatasız) ile doğrulandı. Worker'ın kendi `test/index.spec.js`'i (2 test) başarısız — ama bu, `wrangler init` şablonundan kalma alakasız bir "Hello World" testi (gerçek `handleFeedback` uç noktasını hiç test etmiyor, bu değişiklikten ÖNCE de başarısızdı, dokunulmadı). Dört locale dosyası (`settings.json` tr/en) JSON olarak parse edildi, tr/en anahtar paritesi betikle doğrulandı. Web preview'da misafir modunda "Bize Ulaşın" modalı açılıp yeni onay metninin doğru göründüğü ve anahtarın varsayılan AÇIK geldiği doğrulandı; bir mesaj yazılıp Gönder'e basıldı — bu sandbox'ta tarayıcının Worker'a ağ erişimi olmadığından (bilinen kısıt, Madde 79'daki AYNI durum) gerçek bir POST/Supabase yazımı doğrulanamadı, konsolda kod tarafına ait bir hata da görülmedi. **Ayrıca bu doğrulama sırasında keşfedilen, TAMAMEN İLGİSİZ bir bulgu:** genel giriş (landing) sayfasında (bu oturumda hiç dokunulmayan bir route) tekrarlayan bir "Maximum update depth exceeded" React hatası bulundu — ayrı bir arka plan görevi olarak işaretlendi, bu maddenin kapsamı dışında. **Doğrulanamayan (kullanıcının kendi cihazında/Supabase panelinde teyit etmesi gerekiyor):** (1) `011_error_logs_performance_report.sql`'in Supabase Dashboard'dan çalıştırılması, (2) Worker'ın yeniden deploy edilmesi (`npm run deploy` — kaymaktv-feedback-worker reposunda), (3) gerçek bir "Bize Ulaşın" gönderiminin `error_logs` tablosunda hem `error_data` hem `performance_report` sütunlarını dolu görmesi.

**KULLANICI TARAFINDAN YAPILMASI GEREKENLER:** (1) `supabase/schema/011_error_logs_performance_report.sql`'i Supabase SQL Editor'de çalıştır. (2) `kaymaktv-feedback-worker` reposunda `npm run deploy` ile Worker'ı yeniden yayınla (migration çalıştırılmadan deploy edilirse, bir sonraki gönderimde Supabase 400 döner ve Discord'daki durum metni bunu "⚠️ Supabase API Hatası" olarak gösterir — sessizce yutulmaz). (3) KaymakTV mobil/web'de yeni build gerekmiyor (yalnızca metin/payload değişikliği, mevcut build'ler de yeni alanı gönderir).

## 136. "Discord'da Başarılı Diyor Ama Supabase'de Göremiyorum" — `dbRes.ok` Kontrolü Satırın Gerçekten Yazıldığını Hiç Kanıtlamıyordu

**Bildiren:** Kullanıcı Madde 135'i deploy ettikten sonra: Discord'a mesaj geliyor, durum satırı "✅ Supabase'e kaydedildi (log + performans)" yazıyor, ama Supabase Dashboard'da `error_logs` tablosunda hiçbir yeni satır göremiyor.

**Kök teşhis — kod, "başarılı" derken aslında hiçbir şeyi DOĞRULAMIYORDU:** `handleFeedback`, Supabase'e `Prefer: "return=minimal"` ile POST atıyor ve yalnızca `dbRes.ok` (HTTP 2xx mi?) kontrol ediyordu. `return=minimal` Supabase'e "satırı bana geri gönderme" der — yani kod satırın GERÇEKTEN oluştuğuna dair hiçbir kanıt görmüyor, yalnızca isteğin bir 2xx ile bittiğini biliyor. Bu durumda "Discord başarılı diyor ama Supabase'de yok" için üç aday kaldı: (a) Worker'ın `SUPABASE_URL`/`SUPABASE_KEY` secret'ları kullanıcının Dashboard'da baktığı projeden FARKLI bir Supabase projesine işaret ediyor, (b) kullanıcı yanlış tabloya/filtreye bakıyor, (c) satır gerçekten oluşuyor ama görünürlüğü engelleyen bir DB-seviyesi kural var. Bu ortamdan Worker'ın canlı `SUPABASE_URL`/`SUPABASE_KEY` secret'larına ERİŞİM YOK (yalnızca isim listelenebilir, değer görülemez) — bu yüzden kesin teşhis yerine, kullanıcının kendisinin ayırt edebileceği somut kanıt üretecek şekilde kod güçlendirildi.

**Çözüm (`kaymaktv-feedback-worker/src/index.js`, `handleFeedback`):**
1. `Prefer: "return=minimal"` → **`"return=representation"`**: Supabase artık gerçekten eklediği satırı (id dahil) geri döndürüyor. Başarı artık `dbRes.ok`'a değil, dönen satırın varlığına dayanıyor.
2. Discord durum satırı artık somut kanıt taşıyor: **`✅ Kaydedildi — satır id: \`123\` (log + performans)`** — bir `id` görünüyorsa satır KESİNLİKLE o Supabase projesinde var demektir.
3. **Yeni Discord alanı — "🗄️ Supabase Projesi":** `env.SUPABASE_URL`'den ayrıştırılan host (ör. `omgjrsgginbiwyndvlxo.supabase.co`) gösteriliyor (yalnızca host, anahtar/secret DEĞİL). Kullanıcı bunu doğrudan kendi Dashboard'ının adres çubuğuyla KARŞILAŞTIRABİLİR — "yanlış proje" ihtimalini tek bakışta eler ya da doğrular.
4. Hata dalı artık Supabase'in GERÇEK hata gövdesini gösteriyor (`⚠️ Supabase API Hatası (400)` + Supabase'in kendi mesajı, ör. "Could not find the 'performance_report' column..." — migration çalıştırılmamışsa TAM OLARAK bunu verir) — önceden yalnızca sayısal status kodu vardı, asıl sebep hiç görünmüyordu.

**Doğrulama:** `node --check src/index.js` → geçerli. `npx wrangler deploy --dry-run` → 28.43 KiB, bundle hatasız. Bu ortamda Worker'ın canlı Supabase/Discord secret'larına erişim olmadığından gerçek bir uçtan uca gönderim (satırın gerçekten oluştuğu, "🗄️ Supabase Projesi" alanının doğru host'u gösterdiği) doğrulanamadı.

**KULLANICI TARAFINDAN YAPILMASI GEREKENLER:** `kaymaktv-feedback-worker`'da `npm run deploy` ile yeniden yayınla, sonra bir kez daha "Bize Ulaşın" ile test gönderimi yap. Discord'daki YENİ "🗄️ Supabase Projesi" alanındaki host'u, Dashboard'da baktığın projenin adres çubuğuyla karşılaştır — eşleşmiyorsa sorun kesinleşmiş olur (Cloudflare Worker ayarlarından `SUPABASE_URL` secret'ını düzelt). Eşleşiyorsa ve durum satırında bir `satır id` görüyorsan, satır o projede kesinlikle var demektir — o zaman sorun Dashboard'daki tablo/filtre seçimi olabilir (doğru tabloyu — `error_logs` — seçtiğinden ve herhangi bir filtre/sıralamanın yeni satırı gizlemediğinden emin ol).

## 137. Satır Gerçekten Vardı Ama Table Editor'de Bulunamıyordu — `error_logs`'ta Sıralanabilir Zaman Damgası YOKTU

**Bildiren:** Kullanıcı Madde 136'nın kanıtını gösterdi: Discord'da `🗄️ Supabase Projesi: omgjrsgginbiwyndvlxo.supabase.co` VE gerçek bir satır id'si (`549054b7-e547-48c3-85b8-ddf11b17648e`, `return=representation` ile Supabase'den GERÇEKTEN dönen, uydurma olamayacak bir değer) görünüyordu. Yine de Dashboard'da satırı bulamadı.

**Kesin teşhis:** Bu artık "yanlış proje" ya da "sahte başarı" ihtimalini TAMAMEN ELİYOR — PostgREST bir INSERT'e yalnızca satır GERÇEKTEN o tabloda oluştuysa `return=representation` ile bir id döndürür. Kalan tek açıklama: `error_logs` tablosunun birincil anahtarı bir **UUID** (rastgele görünümlü, insertion-order İLE SIRALI DEĞİL) ve tabloda zamana göre sıralanabilir bir sütun (`created_at` vb.) hiç yoktu — bu Madde 78'de Dashboard'dan elle kurulduğu için hiç bir migration'da tanımlanmamıştı. Supabase Table Editor varsayılan olarak ilk sütuna/birincil anahtara göre sıralar; bir UUID'ye göre sıralama pratikte RASTGELE görünür, "en yeni üstte" varsayımıyla bakan kullanıcı yeni satırı büyük bir tabloda görmeyebilir — satır ORADA ama listenin neresinde olduğu belirsiz.

**Çözüm:**
1. `supabase/schema/012_error_logs_created_at.sql` (YENİ): `ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();` — Postgres 11+'ta bu, tabloyu yeniden yazmadan (hızlı, kilitlenmeden) hem yeni hem MEVCUT satırları dolduruyor. Worker tarafında (`src/index.js`) HİÇBİR değişiklik gerekmiyor — sütun DB seviyesinde otomatik dolduruluyor, istemci `created_at` göndermiyor.
2. Kullanıcıya İKİ somut doğrulama yolu verildi: (a) migration çalıştırılmadan ÖNCE bile, bilinen id ile doğrudan `SELECT * FROM error_logs WHERE id = '549054b7-e547-48c3-85b8-ddf11b17648e';` sorgusu satırın VARLIĞINI kesin olarak kanıtlar; (b) migration sonrası Table Editor'de `created_at` sütununa göre azalan sıralama (veya `ORDER BY created_at DESC`) yeni satırları her zaman en üstte gösterir.

**Doğrulama:** SQL dosyası, projenin diğer `ADD COLUMN IF NOT EXISTS` migration'larıyla (Madde 135/011) AYNI eklemeli/idempotent desende yazıldı — bu ortamda Supabase'e canlı erişim olmadığından çalıştırılıp doğrulanamadı. **Doğrulanamayan:** Migration'ın Dashboard'da hatasız çalıştığı, mevcut satırların (bilinen id dahil) `created_at` ile dolduğu, YENİ bir test gönderiminin artık Table Editor'de (azalan sıralamayla) hemen görünür olduğu.

**KULLANICI TARAFINDAN YAPILMASI GEREKENLER:** (1) Hemen şimdi, migration'a gerek KALMADAN, Supabase SQL Editor'de şunu çalıştırarak Madde 135'teki satırın gerçekten var olduğunu doğrula: `SELECT * FROM error_logs WHERE id = '549054b7-e547-48c3-85b8-ddf11b17648e';` — bir satır dönerse sorun kesin olarak Dashboard'ın sıralama/görünüm tarafındaydı. (2) `supabase/schema/012_error_logs_created_at.sql`'i çalıştır. (3) Table Editor'de `error_logs`'u açıp `created_at` sütun başlığına tıklayarak azalan sırala — yeni gönderimler artık en üstte görünecek.

## 138. Madde 137'den Sonra Da Aynı Durum: "Discord Kaydedildi Diyor, Satır id de Gerçek, Ama Tabloda Hiçbir Şey Yok"

**Bildiren:** Kullanıcı Madde 137'nin önerdiği SQL sorgusunu denemeden, "yaptığın hiçbir şey bu sorunu çözmedi... discorda mesaj geliyor, supabase'de error_logs tablosunda hiçbir aktivite yok" diye bildirdi ve **kod düzeyinde** kökten çözüm istedi, tarayıcı testi istemedi.

**Bu oturumda yapılan tam kod denetimi (kaymaktv-feedback-worker/src/index.js):**

1. **Router doğrulandı:** İstemci köke (`/`) POST atıyor, worker'ın `export default { fetch }`'i `pathname==='/'` için hiçbir özel route'a uymadığından doğru şekilde `handleFeedback`'e düşürüyor ("Geriye dönük uyumluluk" yorumuyla tutarlı). Yanlış yönlendirme YOK.

2. **KRİTİK, GERÇEK BİR HATA BULUNDU VE DÜZELTİLDİ — dış `catch` bloğu tamamen SESSİZDİ.** `handleFeedback`'in en dıştaki `try/catch`'i, İÇİNDE herhangi bir şey (örn. Discord webhook'una `fetch` — bu, Supabase adımından SONRA, KENDİ try/catch'i OLMADAN çağrılıyordu) beklenmedik şekilde patlarsa, HİÇBİR loglama yapmadan yalnızca jenerik `{success:false,"Beklenmeyen sunucu hatası"}` (500) dönüyordu — `wrangler tail`'de bile iz bırakmıyordu. Bu, projenin kendi "sessiz başarısızlık yasak" ilkesini ihlal ediyordu ve gerçek nedenin GÖRÜNMEZ kalmasına sebep olabilirdi. **Düzeltme:** `console.error("[feedback] Beklenmeyen hata:", error?.stack || ...)` eklendi — artık Cloudflare Dashboard → Worker → Logs (`wrangler tail`) üzerinden gerçek hata her zaman görülebilir.

3. **Bu ortamda, GERÇEK kod dosyası Node'da doğrudan çalıştırılıp (Miniflare/wrangler'a değil, çıplak `fetch`'e dayanan) uçtan uca test edildi — kullanıcının gerçek Supabase projesine karşı, ama KASITLI OLARAK GEÇERSİZ bir anahtarla (hiçbir veri riski/okuma/yazma YOK, yalnızca hata-yolu davranışı gözlemlendi):**
   - `https://omgjrsgginbiwyndvlxo.supabase.co/rest/v1/error_logs` anahtarsız → gerçek `401` (`404` DEĞİL) — tablo GERÇEKTEN o projede PostgREST tarafından tanınıyor, routing/tablo adı sorunu YOK.
   - Aynı uç nokta geçersiz bir `apikey` ile → worker'ın kodu bunu doğru yakalayıp Discord'a `⚠️ Supabase API Hatası (401)` + Supabase'in kendi gerçek mesajını (`"Invalid API key"`) BASIYOR. Hata yolu (sanitize → format → Discord'a gönderme) UÇTAN UCA ÇALIŞIYOR.
   - Bu, kodun genel iskeletinin (istek kurma, header'lar, hata yakalama, Discord'a raporlama) SAĞLAM olduğunu kanıtlıyor — geçerli bir anahtarla neler döndüğü bu ortamdan test EDİLEMEDİ (kasıtlı olarak hiçbir gerçek secret istenmedi/kullanılmadı).

4. **Kalan tek açıklanamayan senaryo — Madde 137'de zaten kuruldu, henüz DEPLOY EDİLMEDİ:** Kullanıcının paylaştığı Discord mesajı (`✅ Kaydedildi — satır id: 549054b7-...`) Madde 136'nın kodunu (`return=representation`, YAZ-SONRA-OKU DOĞRULAMASI OLMADAN) yansıtıyor — Madde 137'de eklenen "insert'ten hemen sonra o satırı GERİ OKUYUP doğrulama" adımı henüz canlıya alınmamış. `return=representation`'ın döndürdüğü bir `id` UYDURMA OLAMAZ (PostgREST bunu yalnızca gerçek bir INSERT'ten sonra üretir) — ama satırı bir AFTER INSERT trigger'ın hemen silmesi/taşıması TEORİK olarak mümkündür ve bu, kullanıcının gördüğü TAM tabloyla örtüşür (Discord: "var" / Dashboard: "yok"). Bu Worker koduyla ÇÖZÜLEMEZ — bir DB-seviyesi trigger/kural varsa bu, Supabase Dashboard → Database → Triggers (`error_logs` tablosu) içinde aranmalı, kodda değil.

**Bu maddede ek olarak yapılan:** `dbStatus` her istekte `console.log("[feedback] dbStatus:", dbStatus)` ile de basılıyor artık — Discord'un 1024 karakter embed sınırı bir gün bir hatayı kısaltırsa, `wrangler tail`'de TAM metin her zaman görülebilir.

**Doğrulama:** `node --check` geçerli, `wrangler deploy --dry-run` temiz (29.91 KiB). Yukarıdaki 3 canlı test (401/404 ayrımı, geçersiz-anahtar hata yolu) kullanıcının GERÇEK Supabase projesine karşı bu oturumda ÇALIŞTIRILDI ve doğrulandı — kullanıcının "kodsal olarak kontrol et" isteği tarayıcı DIŞINDA, doğrudan bu yöntemle karşılandı. **Doğrulanamayan (yalnızca geçerli bir anahtarla, kullanıcının kendisinin yapması gereken):** Madde 137'nin YAZ-SONRA-OKU doğrulaması deploy edildikten sonra gerçek bir gönderimin Discord'da "✅ Kaydedildi ve DOĞRULANDI" mi yoksa "🔴 ANOMALİ" mi gösterdiği — ikinci durumda sorun kesin olarak Supabase'in kendi trigger/politika ayarlarındadır, bu repodaki hiçbir kod değişikliği onu çözemez.

**KULLANICI TARAFINDAN YAPILMASI GEREKENLER (SIRAYLA, ATLAMADAN):**
1. `kaymaktv-feedback-worker`'da `npm run deploy` — Madde 136/137/138'in TÜMÜ henüz canlıda değil, kullanıcının gördüğü mesaj hâlâ ESKİ koddan.
2. Bir test gönderimi yap. Discord'daki YENİ mesaj **"✅ Kaydedildi ve DOĞRULANDI"** mi yoksa **"🔴 ANOMALİ"** mi diyor, oku.
3. "🔴 ANOMALİ" ise: Supabase Dashboard → Database → Triggers ve Policies bölümlerinde `error_logs` tablosuna bağlı HERHANGİ bir trigger/rule/policy var mı kontrol et — varsa onu paylaş, kod tarafında yapılabilecek bir şey kalmadı.
4. "✅ DOĞRULANDI" ise: Sorun Worker/Supabase'de DEĞİL, Dashboard'da — Madde 137'deki `created_at` migration'ını çalıştırıp Table Editor'de o sütuna göre azalan sırala.

**Ek Doğrulama (kullanıcının "izleme listesini test et" isteği üzerine):** Bu ortamdan gerçek bir Trakt detay sayfasına hâlâ erişilemediği için (Madde 125-126'daki AYNI kısıtlama), `MediaHero`'yu mock veriyle izole render eden GEÇİCİ bir test rotası (`app/test-watchlist-preview.tsx`) oluşturuldu, tarayıcı önizlemesinde hem masaüstü (1280px) hem mobil (375px) genişlikte gerçekten tıklanarak test edildi, ardından SİLİNDİ (kalıcı kod tabanında iz bırakmadı). Doğrulanan davranışlar: (1) rozet satırı artık 4 öğeye (Puan/Kullanıcı Puanı/Favori/Listeye Ekle) döndü, tek satırda rahatça sığıyor, taşma yok; (2) aksiyon çubuğu tam genişlikte, rozet satırından net bir şekilde ayrışıyor; (3) tıklanınca "Takip Et" (yarı saydam beyaz, outline `Bookmark`) ↔ "Takip Ediliyor" (mavi `#3b82f6` arka plan/kenarlık/metin, dolu `Bookmark`) arasında doğru geçiş yapıyor, her iki yönde de; (4) 375px mobil genişlikte de rozet satırı VEYA aksiyon çubuğu hiç taşmıyor/sarmıyor; (5) konsolda hata yok. **Hâlâ doğrulanamayan (yalnızca mock veriyle test edildiği için):** gerçek `toggleWatchlistStatus()` mutation'ının uçtan uca Trakt senkronu ve misafir (`isGuest`) engelleme diyaloğu — bunlar için kullanıcının kendi (gerçek giriş yapılmış) ortamında denemesi gerekiyor.

## 139. İstek / Öneri / Şikayet Sistemi (Geri Bildirim Kategorileri)

**Arka plan:** Mevcut "Hata Bildir" sistemi (Madde 136-138) yalnızca bug/hata bildirimi için tasarlanmıştı. Kullanıcı yeni özellik istekleri ve önerilerini de aynı kanal üzerinden iletebilmek istedi; ancak istek/öneri bildirimleri için hata loglarının gereksiz olduğu fark edildi.

**Tasarım kararları:**
- Yeni bir tablo veya endpoint yerine mevcut `error_logs` tablosuna `category TEXT NOT NULL DEFAULT 'bug'` sütunu eklendi (`supabase/schema/012_add_feedback_category_column.sql`). Bu sütun `CHECK (category IN ('bug', 'feature'))` kısıtıyla korunuyor. Ayrı bir tablo hem migration yükü hem yönetim karmaşıklığı yaratırdı; tek tablo tek sorguda filtrelenebiliyor.
- Discord kanalı BÖLÜNMEDİ — aynı webhook, farklı embed renkleri: Hata = Kırmızı (`#E74C3C`), İstek/Öneri = Yeşil (`#2ECC71`). Kanalı bölmek, daha az bildirimle küçük bir projede overkill olurdu.
- `category === 'feature'` olduğunda log ve performans raporu ASLA gönderilmez (hem hook'ta hem Worker'da garantileniyor). UI'de de Switch gizleniyor — kullanıcıya gereksiz teknik seçenek sunulmaz.

**Değiştirilen dosyalar:**
- `supabase/schema/012_add_feedback_category_column.sql` — [YENİ] `error_logs` tablosuna `category` sütunu ve index.
- `services/api/feedback.ts` — `FeedbackCategory` tipi ve `category` alanı eklendi.
- `hooks/useReportIssue.ts` — `category` state/setter eklendi; `shouldSendLogs` mantığı category'e bağlandı.
- `components/settings/ReportIssueModal.tsx` — İki sekmeli UI (Hata / İstek-Öneri), dinamik karakter limiti (bug: 250, feature: 1000), kategori bazlı gönder butonu rengi.
- `app/(protected)/account.tsx` — Menü butonu adı "İstek / Öneri / Şikayet" olarak güncellendi.
- `kaymaktv-feedback-worker/src/index.js` — `handleFeedback` kategoriye göre `error_logs.category` sütununa yazıyor; Discord embed başlık/renk/alanlar kategoriye göre dallanıyor.

**Kullanıcı tarafından yapılması gerekenler:**
1. Supabase Dashboard → SQL Editor → `supabase/schema/012_add_feedback_category_column.sql` içeriğini çalıştır.
2. `c:\Yapay_Zeka_Uygulamalar\kaymaktv-feedback-worker` dizininde `npx wrangler deploy` komutunu çalıştır.
3. Uygulamayı açıp Ayarlar → "İstek / Öneri / Şikayet"e girerek her iki sekmeyi de test et; Discord'da doğru renk/başlık geldiğini ve Supabase'de `category` sütununun doğru değeri aldığını doğrula.

**Görsel Tasarım Güncellemesi (2026 UI Standartları):**
- Web tarafında `Platform.OS === 'web'` için ekranın ortasında konumlanan modern card modal diyaloğu (`maxWidth: 520px`, `fade` animasyonu, gölge efektleri), mobilde ise `slide` geçişli bottom-sheet düzeni sağlandı.
- Segmented control sekmeleri (Hata / İstek-Öneri) aktif sekme durumuna göre canlı renk vurgusu (Crimson Red & Emerald Green) ve alt nokta göstergesi kazandı.
- TextInput alanına odaklanma (Focus) durumu state'e bağlanarak dinamik kenarlık parlaması (accent glow border) eklendi.
- Kategori açıklamaları için accent renkli callout banner ve buton içi ikon kombinasyonları (`Send` / `Sparkles`) eklendi.
- İstek / Öneri kategorisindeki karakter sınırı 300 karaktere güncellendi.
- Uygulama sürümü `v2.0.2` olarak yükseltildi (`package.json`, `app.json`, `account.tsx`, `download.web.tsx`).

## 141. Geliştirici Paneli: Profesyonel Teşhis & Hata Raporu Butonu Yenilemesi

**Arka plan:** Geliştirici Paneli'ndeki (`dev-panel.tsx`) sağ alt köşedeki tekli mavi yuvarlak kâğıt uçak butonu (FAB), sohbet/Telegram ikonu algısı oluşturuyor ve panelin amacından kopuk görünüyordu.

**Yapılan Değişiklikler:**
- Sağ alt köşedeki anonim mavi kâğıt uçak daire butonu tamamen kaldırıldı.
- Hem Web hem Mobil uyumlu, profesyonel **"Teşhis Raporu Gönder"** yapısı kuruldu:
  - **Üst Bar (Header):** `SettingsHeader` sağ tarafında `Bug` simgeli, dikkat çekici Crimson Red vurgulu "Teşhis Raporu Gönder" CTA butonu eklendi.
  - **Mobil Sabit Alt Çubuk (Mobile Bottom Bar):** Mobilde ekranın en altında güvenli alan çubuğu (`useSafeAreaInsets` -> `insets.bottom`) gözetilerek `Hata & Teşhis Raporu Gönder` yazan tam genişlikli, şık ve korumalı bir aksiyon barı eklendi.

## 142. Yeni Uygulama Logosu & İkon Güncellemesi

**Yapılan İşlem:**
- Eski beğenilmeyen `logo.png` tamamen silindi.
- `ikon.png` dosyası uygulamanın güncel mobil ve web uygulama ikonu olarak ayarlandı (`assets/icon.png`, `assets/favicon.png`, `assets/images/adaptive-icon.png`, `assets/images/splash-icon.png`, `public/apple-touch-icon.png`).
- `yazı.png` (1983x763 KaymakTV logo+yazı marka görseli) ileride kullanılmak üzere korundu ve `assets/images/logo-text.png` olarak da yedeklendi.

  - `assets/images/adaptive-icon.png` (Android adaptive icon)
  - `assets/images/icon.png`
  - `assets/images/splash-icon.png`
  - `public/apple-touch-icon.png`


## 140. Takip Ekranı: Performans (Chunk Toplulaştırma + Lazy Dashboard) ve UX ("Güncel" Kategorisi + Zaman Girdisi)

**Arka plan:** Kullanıcı "Diziler" sekmesindeki üç kategorinin (Aktif İzlenenler / Ara Verilenler / Henüz Başlanmadı) mantığını sorguladı, uygulamanın "daha hızlı ve daha stabil" olmasını istedi. Yapılan kod analizinde iki ayrı sorun sınıfı bulundu: (a) senkron sırasında arayüzü kilitleyen render dalgaları, (b) kategorizasyonun kullanıcıya açıklanamayan davranışları. İki aşamada uygulandı.

### Aşama 1 — Performans

**② Chunk yayınını toplulaştırma (`services/library/fetchers.ts`).** ESKİ DAVRANIŞ: `backgroundWork` içindeki ilerleme döngüsü, her 6 dizilik ağ chunk'ı biter bitmez `setShowProgressMap((prev) => ({...prev, ...chunk}))` çağırıyordu. Bu, yeni bir obje referansı üretip şu zinciri tetikliyordu: store bildirimi → `useLibrarySelector` shallow karşılaştırması false → `categorizeShows` TÜM kütüphaneyi baştan tarıyor → `useDashboardData` (354 satır) da baştan koşuyor → `sections` yeniden kuruluyor → SectionList görünür hücreleri yeniden çiziyor. 300 dizilik bir kütüphanede bu 50 kez tekrarlanıyordu; üstelik her 4 chunk'ta bir `writeChunkedRecord` tüm haritayı (bölüm bazlı ham veriyle megabaytlarca JSON) JS thread'inde senkron olarak `JSON.stringify` ediyordu. İlk senkrondaki donmanın kaynağı ağ değil, buydu. **ÇÖZÜM:** sonuçlar bir tamponda (`pendingResults`) birikir, store'a yalnızca ~400ms'de bir (veya son chunk'ta) TEK seferde yayınlanır (`flushPending`). Ağ isteklerinin hızı/sırası, rate-limit gecikmesi (150ms) ve kademeli kalıcılık davranışı DEĞİŞMEDİ — yalnızca kaç kez render tetiklendiği azaldı. **Aynı anti-pattern takvim sezonları (`calendarSeasonsMap`) döngüsünde de vardı** ve o döngü ilerleme döngüsünün hemen ardından çalışıp kendi render dalgasını üstüne bindirdiği için, o da aynı teknikle (`flushPendingSeasons`) toplulaştırıldı.

**⑧ Dashboard'u lazy yapma (`hooks/useDashboardData.ts`, `screens/IndexMobile.tsx`, `app/(protected)/(tabs)/shows.web.tsx`).** ESKİ DAVRANIŞ: `useDashboardData` yalnızca "Yaklaşan" sekmesinin verisini üretiyordu (`upNextShows`/`inactiveShows`/`watchlistShowsList` alanları artık kullanılmıyor — gerçek kaynak `trackingLogic`), ama girdileri her senkron chunk'ında değiştiği için kullanıcı "İzleme" sekmesindeyken BİLE tüm dizi/takvim/sezon haritası taraması boşuna koşuyordu. **ÇÖZÜM:** hook'a `enabled` parametresi eklendi; `false` iken tüm ağır tarama atlanıp son hesaplanan sonuç bir `useRef`'ten döndürülür. Her iki ekranda da `enabled = (renderedTab === 'yaklasan')`. `enabled` bağımlılık dizisinde olduğu için sekmeye geçildiğinde güncel veriyle otomatik yeniden hesaplanır.

### Aşama 2 — Kullanıcı Deneyimi

**③ `now` (zaman) girdisinin koda dahil edilmesi (`hooks/useTrackingShows.ts`).** ESKİ DAVRANIŞ: `categorizeShows` `now = Date.now()` varsayılanını kullanıyordu ama `useTrackingShows`'un `useMemo` bağımlılıklarında zaman YOKTU. Kategorizasyon zamana bağlı olmasına rağmen (45 günlük `paused` eşiği, "bölüm yayınlandı mı" kontrolü) zamanı bir girdi olarak almıyordu. Sonuç: eşiği geçen bir dizi kendiliğinden kova değiştirmiyor, ALAKASIZ bir store güncellemesi tetiklenene kadar bekliyor, sonra aniden yer değiştiriyordu — kullanıcının bildirdiği "bazen atlıyor, bazen atlamıyor" hissinin kaynağı buydu. **ÇÖZÜM:** hook artık kendi `now` state'ini tutup iki tetikleyiciyle tazeliyor (`useTrackingNow`): (1) saatte bir `setInterval` — gün sınırlarını makul gecikmeyle yakalamaya yeter, dakikalık kontrol gereksiz re-render üretirdi; (2) uygulama arka plandan öne her geldiğinde `AppState` dinleyicisi — kullanıcı günlerce uzak kalmış olabilir, ekrana döner dönmez kategoriler güncel olmalı. `now` artık hem `categorizeShows`'a açıkça geçiliyor hem de `useMemo` bağımlılığı.

**⑤ "Güncel" (caughtUp) kategorisinin eklenmesi.** ESKİ DAVRANIŞ (kural 2): izlenmeye başlanmış ama şu an izlenmeye hazır (yayınlanmış) bir sonraki bölümü olmayan diziler — dizi bitmiş ya da yeni sezon henüz yayınlanmamış — `continue` ile eleniyor, HİÇBİR listede görünmeden sessizce kayboluyordu. "Bırak" değillerdi, o yüzden Gizlenenler'e de düşmüyorlardı; kullanıcının onları geri bulabileceği hiçbir yer yoktu. Üstelik `labels.caughtUp` ("Yeni bölüm bekleniyor") etiketi kodda üretiliyor ama bu diziler elendiği için pratikte hiç görünmüyordu — ölü bir yol. **ÇÖZÜM:** `ShowCategories`'e dördüncü kova `caughtUp` eklendi; kural 2 artık `continue` yerine bu kovaya yazıyor. Bölüm akordeonda **en sonda** ve **varsayılan KAPALI** (aksiyon gerektirmeyen, bilgilendirici bir liste), yeşil `CheckCircle2` ikonu ve sayaçla. **Yan düzeltme:** bu kartlarda `season`/`episode` hesabı `hasStarted && nextReady` şartını sağlayamadığı için `: 1` dalına düşüp hep "S1E1" gösteriyordu; artık Trakt progress yanıtındaki `next_episode` (duyurulmuş ama yayınlanmamış) veya `last_episode` (son izlenen) referans alınıyor, izlenmiş sezonlar artık doğru görünüyor.

**Değiştirilen dosyalar (Aşama 2):** `store/tracking/trackingLogic.ts` (dördüncü kova + `last_episode` referansı + `caughtUp` sıralaması + `now` dokümantasyonu), `store/tracking/useTrackingStore.ts` (`TrackingCategoryKey`'e `caughtUp`, `DEFAULT_COLLAPSED`'a `caughtUp: true`), `hooks/useTrackingShows.ts` (`useTrackingNow` + `now` girdisi + `totalCount`'a `caughtUp` dahil), `components/tracking/TrackingAccordionList.tsx` ve `.web.tsx` (`SECTION_META`/`SECTION_ORDER`), `screens/IndexMobile.tsx` + `app/(protected)/(tabs)/shows.web.tsx` (etiket/carousel), `locales/tr|en/media.json` (`caughtUpSection`: "Güncel" / "Up to Date").

**Geriye uyumluluk:** `useTrackingStore.hydrate` kayıtlı durumu `{ ...DEFAULT_COLLAPSED, ...JSON.parse(saved) }` ile birleştirdiği için, mevcut kullanıcıların cihazındaki eski `v2` kaydı (`caughtUp` anahtarı olmayan) sorunsuz okunur ve `caughtUp` varsayılan (kapalı) değerini alır — ayrı bir migration GEREKMEDİ.

**Doğrulama:** `tsc --noEmit` her iki aşamada da temiz (0 hata). `trackingLogic.ts` bağımlılıksız saf bir dosya olduğu için tek başına derlenip Node'da **22 senaryoluk bir test koşusundan geçirildi** (hepsi geçti): bitmiş dizi → caughtUp; yayınlanmamış yeni sezon → caughtUp (paused DEĞİL); caughtUp kartının S1E1 yerine gerçek sezon/bölümü göstermesi; **aynı veriyle `now` 2 gün ilerletilince upNext → paused geçişi (③'ün çalıştığının kanıtı)**; gizli dizinin caughtUp'a sızmaması (kural 1 önceliği); `completed=0`'ın notStarted'da kalması; `isCalculating` spinner'ının korunması; ve her dizinin TAM OLARAK bir kovada olması (çakışma yok). Web önizlemesi hatasız derlenip render edildi. **Doğrulanamayan (gerçek Trakt hesabı/kütüphanesi gerektirdiği için, kullanıcının kendi cihazında test etmesi gereken):** büyük bir kütüphanede ilk senkron sırasındaki gerçek FPS kazancı ve "Güncel" bölümünün gerçek verideki dolulukları.

**Bilinçli olarak KAPSAM DIŞI bırakılan:** Kütüphane ekranının dizi filtresi (`hooks/useLibraryShowFilters.ts`, `SHOW_STATUS_KEYS`) `caughtUp`'ı bir filtre seçeneği olarak SUNMUYOR — o ekranda bu diziler eskiden de hiçbir duruma eşleşmiyordu, davranış aynen korundu (regresyon yok). İstenirse ayrı bir iş olarak eklenebilir.

## 141. Madde 140 Revizyonu: "Güncel" Kategorisi Arayüzden Kaldırıldı (Veri Katmanı Korundu)

**Kullanıcı geri bildirimi:** Madde 140'ta eklenen ⑤ numaralı "Güncel" (caughtUp) akordeon bölümü arayüzden tamamen kaldırılması istendi. Gerekçe: bu ekran bir "Yapılacaklar" (to-do) panosu — kullanıcının şu an izleyebileceği yeni bir bölümü yoksa, o dizi ekranda kalabalık yapmamalı; diziler listeden "sessizce kaybolması" BİLİNÇLİ bir tasarım kararı, hata değil. Yeni bölüm yayınlandığında Trakt'ın kendi verisi zaten diziyi otomatik olarak upNext/paused'a geri taşıyor. ③ ve `now` girdisiyle ilgili altyapı değişiklikleri ("harika" olarak onaylandı) AYNEN korundu.

**Değişiklik:** UI katmanı 3 orijinal kategoriye (Aktif İzlenenler / Ara Verilenler / Henüz Başlanmadı) döndürüldü, veri katmanındaki `caughtUp` kovası ise ileride başka bir yerde (ör. profil sayfası) kullanılabilecek mantıksal bir etiket olarak KORUNDU:
- `store/tracking/trackingLogic.ts`: **DEĞİŞMEDİ** — `categorizeShows` hâlâ `caughtUp` kovasını üretiyor (kural 2, `last_episode`/`next_episode` referanslı S/E düzeltmesiyle birlikte); yalnızca dosya başındaki ve `ShowCategories.caughtUp` üzerindeki yorumlar, artık takip panosunda render edilmediğini netleştirecek şekilde güncellendi.
- `store/tracking/useTrackingStore.ts`: `TrackingCategoryKey` tekrar `'upNext' | 'paused' | 'notStarted'`e daraltıldı (bilinçli olarak `keyof ShowCategories`'in TAMAMI değil, panoda RENDER EDİLEN alt kümesi — bunu açıklayan bir yorum eklendi). `DEFAULT_COLLAPSED`'dan `caughtUp` çıkarıldı.
- `components/tracking/TrackingAccordionList.tsx` ve `.web.tsx`: `SECTION_META`'dan `caughtUp` girdisi ve `CheckCircle2` importu, `SECTION_ORDER`'dan `'caughtUp'` kaldırıldı.
- `screens/IndexMobile.tsx`: `accordionLabels`'tan `caughtUp` etiketi kaldırıldı.
- `app/(protected)/(tabs)/shows.web.tsx`: dördüncü carousel çağrısı (`renderTrackCarousel(t('caughtUpSection'), categories.caughtUp)`) kaldırıldı.
- `hooks/useTrackingShows.ts`: `totalCount`/`isEmpty` hesabından `categories.caughtUp.length` ÇIKARILDI — panoda hiç render edilmeyen bir kovayı sayıma dahil etmek, pano boşken bile "boş değil" gibi yanlış bir sinyal verirdi (boş durumu mesajı yanlış zamanda gizlenirdi). JSDoc bunu açıklayacak şekilde güncellendi.
- `locales/tr|en/media.json`: artık hiçbir yerden referans edilmeyen `caughtUpSection` anahtarı silindi (dead entry bırakılmadı).

**Doğrulama:** `tsc --noEmit` temiz (0 hata). `trackingLogic.ts` yeniden derlenip Madde 140'taki 22 senaryoluk test takımı tekrar koşturuldu — hepsi geçti (veri katmanının, özellikle `now` girdisinin ve `caughtUp` kovasının davranışı DEĞİŞMEDİĞİNİN kanıtı). Web önizlemesi hatasız derlendi; `SECTION_ORDER`'ın her iki accordion dosyasında da 3 elemanlı olduğu ve `caughtUp`'a hiçbir UI dosyasından referans kalmadığı grep ile doğrulandı.

## 142. Akış (Feed): Performans, Stabilite ve "Kendimi de Akışta Gör"

**Kullanıcı isteği:** (1) Akış özelliği "hantal" çalışıyor, hız ve stabilite kazandırılmalı; (2) kullanıcılar kendi aktivitelerini profillerinde görebiliyor ama Akış sekmesinde göremiyor — orada da görmeliler. Spagetti kod yazılmadan, gereksiz kod bırakılmadan.

### Tespit edilen sorunlar

1. **Her akış yüklemesinde GEREKSİZ ve SIRALI bir Trakt isteği.** `fetchFeedActivities` her çağrıldığında `getMyFollowingSlugs()` ile Trakt'a gidiyordu — oysa `store/followStore.ts` bu veriyi zaten 10 dakikalık TTL + AsyncStorage kalıcılığıyla tutuyordu. Sonuç: aynı veri iki ayrı mekanizmayla yönetiliyor ve Supabase sorgusu, hiç gerekmeyen bir ağ round-trip'inin bitmesini SIRAYLA bekliyordu. "Hantal" hissinin ana kaynağı buydu.
2. **Akış verisinde hiç önbellek yoktu.** `fetchUserFeedActivities` (profil) 60 saniyelik bellek önbelleğine sahipti; `fetchFeedActivities` (akış) hiç yoktu — her yeniden mount = tam yeniden yükleme + boş skeleton.
3. **`followStore.fetchFollowingSlugs`'ta yarış durumu.** `|| get().isLoading` koşulu yüzünden, o an başka bir çağrı uçuştaysa ikinci çağıran BEKLEMEDEN anında dönüyordu. `await fetchFollowingSlugs()` yapıp hemen `connectionStates`i okuyan tüketiciler (Akış, `store/notificationStore.ts`) HENÜZ DOLMAMIŞ listeyi okuyup "kimseyi takip etmiyorum" sonucuna varabiliyordu.
4. **Sessiz başarısızlık (`docs/AI_RULES.md` ihlali).** `useFeed` hatayı yalnızca `console.warn` ile yutuyor, `data` boş kalıyordu — kullanıcı gerçek bir ağ/veritabanı hatasında "Akışın Boş — takip ettiğin kişilerin aktiviteleri burada görünecek" mesajını görüyordu. Uygulama ona YANLIŞ bilgi veriyordu.
5. **`useFeed`'de yarış koruması YOKTU.** `useUserActivity`/`usePublicProfileActivity`'de `cancelled` bayrağı vardı, `useFeed`'de yoktu — hızlı arka arkaya tazelemede eski yanıt yeninin üzerine yazabiliyordu.
6. **Üç hook'ta birebir aynı mantığın kopyası.** `useFeed`, `useUserActivity`, `usePublicProfileActivity` üçü de "çek → grupla → state'e yaz → iptal bayrağı → hatayı yut" işini ayrı ayrı yapıyordu.
7. **Ölü/gereksiz kod.** `feed.tsx` kendi lokal `isMarathon` tip guard'ını tanımlamıştı (oysa `types.ts`'te `isMarathonActivity` zaten vardı); üç hook'ta da `setData([...grouped])` ile gereksiz bir kopya alınıyordu (`groupMarathonActivities` zaten YENİ dizi döndürüyor); `useFeedPrivacy` ile Akış ayrı ayrı `getUserProfile('me')` çağırıyordu.

### Yapılanlar

**`services/api/myIdentity.ts` [YENİ]** — kullanıcının kendi Trakt slug'ı için tek gerçek kaynak. Oturum boyunca değişmeyen bu değer modül seviyesinde önbelleklenir (uygulama ömrü boyunca TEK istek), uçuştaki istek paylaşılır, BAŞARISIZLIK önbelleğe alınmaz (geçici ağ hatası slug'ı kalıcı olarak `null` yapmasın). `context/AuthContext.tsx`'in `removeKeys`'ine `clearMyTraktSlug()` eklendi — `followStore.reset()` ile aynı gerekçe: uygulama kapatılmadan hesap değiştirilirse önceki kullanıcının slug'ı yeni oturuma sızardı.

**`store/followStore.ts`** — (a) uçuştaki istek artık paylaşılıyor (`inFlightFetch`), eşzamanlı çağıranlar onu bekliyor; `reset()` bu referansı da bırakıyor. (b) `getFollowingSlugs()` dışa aktarıldı: takip listesini store'un mevcut `connectionStates`'inden TÜRETİR, ayrı ağ isteği YAPMAZ; `pending` (onay bekleyen) durumlar bilinçli olarak dışarıda. (c) `ConnectionState` importu `import type`a çevrildi — düz import, `useFollowState` üzerinden AuthContext + notificationStore'u içeri çekip **followStore ↔ useFollowState çalışma-zamanı döngüsü** yaratıyordu; Akış artık bu store'u kullandığından döngü daha erken bir yükleme yolunda tetiklenebilirdi. Derlenmiş çıktıda ilgili `require` satırının tamamen kalktığı doğrulandı.

**`features/feed/services/feedApi.ts`** — `getMyFollowingSlugs()` çağrısı kaldırıldı; takip listesi `followStore`'dan, kendi slug'ı `myIdentity`'den **PARALEL** okunuyor. Kendi slug'ı sorguya dahil edildi (**kullanıcı isteği**). `followingSlugs.length === 0` erken dönüşü kaldırıldı — kendi aktiviteleri de akışa girdiği için bu, hiç kimseyi takip etmeyen kullanıcının KENDİ aktivitelerini de gizlerdi. `fetchUserFeedActivities` ile aynı desende kısa ömürlü (60sn) önbellek + `invalidateFeedCache()` eklendi; `deleteActivitiesBulk` başarıda önbelleği tek yerden geçersiz kılıyor.

**`features/feed/services/feedSync.ts`** — senkron başarıyla bitince `invalidateFeedCache()` çağırıyor: senkron kullanıcının kendi yeni aktivitelerini Supabase'e yazar, artık bunlar Akış'ta da göründüğü için "az önce bölüm izledim ama akışta yokum" durumu önlenir.

**`features/feed/hooks/useActivityFeed.ts` [YENİ]** — üç hook'un ortak veri çekirdeği: çek → grupla → state, `runId` sayacıyla yarış koruması (boolean bayrak yerine sayaç, çünkü `refresh` art arda çağrılırsa önce BAŞLAYAN sonra BİTEBİLİR), unmount'ta uçuştaki yanıtı yok sayma ve **`hasError` durumu**. `useFeed`/`useUserActivity`/`usePublicProfileActivity` üçü de buna bağlandı; `useUserActivity` yalnızca SİLME yetkisini üstüne ekliyor (rollback için `previousData` bilinçli olarak `data` bağımlılığından okunuyor — `setData` güncelleyicisi StrictMode'da birden fazla kez çağrılabildiği için SAF kalmalı).

**`app/(protected)/(tabs)/feed.tsx`** — lokal `isMarathon` kopyası silindi (`isMarathonActivity` kullanılıyor); "veri yok" ile "yüklenemedi" ayrıştırıldı: hata durumunda `WifiOff` ikonu + "Akış Yüklenemedi" + **"Tekrar Dene"** butonu. `locales/tr|en/feed.json`'a `errorTitle`/`errorText`/`retry` eklendi.

**`features/feed/hooks/useFeedPrivacy.ts`** — kendi `getUserProfile('me')` çağrısı yerine `getMyTraktSlug()` kullanıyor (aynı isteğin ikinci kopyası kaldırıldı).

### Sonuç
Akış açılışı **2 sıralı ağ isteğinden 1'e** indi (takip listesi çoğu zaman zaten önbellekte, ağa hiç çıkmaz); yeniden mount'larda 60sn önbellek sayesinde ağ isteği tamamen atlanıyor; kullanıcı kendi aktivitelerini artık Akış'ta da görüyor (Profil'deki "Aktiviteler" sekmesi **aynen korundu**, o kod yolu değişmedi).

**Doğrulama:** `tsc --noEmit` temiz (0 hata). `feedApi.ts` sahte bağımlılıklarla (Supabase sorgu yakalayıcı + stub followStore/myIdentity) izole derlenip Node'da **11 senaryoluk test koşusundan geçirildi, hepsi geçti**: sorgunun takip edilenler + KENDİM ile yapılması; takip listesi boşken bile kendi aktivitelerimin görünmesi (eski erken-dönüş bug'ı); slug tekilleştirme; kimlik çözülemediğinde (mySlug=null) akışın yine çalışması; gösterilecek kimse yokken Supabase'e HİÇ gidilmemesi; önbelleğin 2. çağrıda ağa çıkmaması; `force=true`nun (pull-to-refresh) önbelleği atlaması; `invalidateFeedCache` sonrası taze veri çekilmesi. Ayrıca `import type` düzeltmesinin döngüyü gerçekten kırdığı, derlenmiş `followStore.js`'te `useFollowState` require'ının kalmadığı doğrulandı. Web bundle hatasız derlenip render edildi.

**Doğrulanamayan (gerçek Trakt+Supabase hesabı gerektirdiği için, kullanıcının kendi cihazında test etmesi gereken):** Akış'ta kendi aktivitelerinin gerçek veriyle görünmesi ve algılanan hız kazancı.

**Bilinçli olarak KAPSAM DIŞI:** Akış verisinin AsyncStorage'a kalıcı yazılması (soğuk açılışta anında içerik gösterip arkada tazelemek). Bellek önbelleği sekme geçişlerini/yeniden mount'ları zaten çözüyor; kalıcılık ayrı bir adım olarak değerlendirilebilir.

## 143. Akış Kartlarında Dizi Adına Basınca Dizi Sayfasına Gitme

**Kullanıcı isteği:** Akış'ta "X dizisi izledi" yazısındaki dizi adına basınca dizinin detay sayfasına gidilsin.

**Yapılan:** `FeedCard.tsx` ve `MarathonFeedCard.tsx` — bu iki bileşen Akış, Profil › Aktiviteler VE Herkese Açık Profil'in ÜÇÜ tarafından paylaşıldığı için tek noktadan düzeltme her yerde geçerli oldu.
- `ACTIVITY_META.label` (tam cümle) → `labelSuffix` (yalnızca dizi adından SONRAKİ kısım) olarak ayrıştırıldı — dört aktivite şablonu de zaten `showTitle` ile başladığından hiçbir template bozulmadan bölünebildi.
- Dizi adı artık kendi iç içe `<Text onPress=...>` öğesi (RN'de bir cümle içinde yalnızca bir alt-dizeyi tıklanabilir yapmanın standart yolu), kalın/açık renkle görsel olarak "tıklanabilir" hissettiriliyor.
- Hedef: `router.push(\`/show/${activity.showId}\`)`. `feed_activities` tablosunda dizi/film için yalnızca Trakt'ın SAYISAL id'si tutuluyor (ne slug ne tmdbId) — `/show/[id]` rotasının `parseMediaSlug`'ı `{traktId}-{slug}` biçimini ayrıştırıyor, slug kısmı boşken de (yalnızca sayı) sorunsuz çalıştığı doğrulandı. `tmdbId` de opsiyonel — `useShowDetail` eksikse Trakt özetinden kendisi keşfediyor.

**Doğrulama:** `tsc --noEmit` temiz. Web bundle hatasız derlendi. **Doğrulanamayan:** gerçek Akış verisiyle tıklama testi — gerçek bir Trakt+Supabase oturumu gerektiriyor, kullanıcının kendi cihazında denemesi gerekiyor.

## 144. "Takip Et" Butonu: İzlenen/Bitirilen Yapımlar İçin Yanlış Durum Gösteriyordu

**Kullanıcı bildirimi:** "200-300 dizim var, önceden izlediklerim, hâlihazırda takip ettiklerim, bazıları bitirdiklerim. Bunlarda 'Takip Et' butonu 'Takip Ediliyor' şeklinde olması gerekiyor. Zaten izleme listemdeyse ya da dizi/film bittiyse mantıken takip ediyorumdur. TV Time'daki sistem bile bendeki gibiydi."

**Kök neden:** Bu uygulamada izleme listesi (watchlist) **"henüz başlanmadı"** anlamına gelir — bir diziyi izlemeye başlayınca watchlist'ten düşer (bkz. `store/tracking/trackingLogic.ts` `notStarted` kovası ve `mutations/progress.ts`'teki "WATCHLIST RECOVERY": ilerleme sıfıra düşünce dizi watchlist'e GERİ eklenir). Detay sayfasındaki takip butonu (`components/MediaHero.tsx`) ise YALNIZCA `isWatchlisted`e bakıyordu. Sonuç: kullanıcının izlediği/bitirdiği yüzlerce yapım için buton hâlâ "Takip Et" gösteriyordu.

**Aynı soru uygulamada üç yerde, iki farklı şekilde cevaplanıyordu** — asıl mimari sorun buydu:
- `components/ShowCard.tsx` → `isWatchlisted || isWatched` (neredeyse doğru, "bırakılmış"ı gözetmiyor)
- `components/explore/ExploreWebGrid.tsx` → aynısının ikinci kopyası
- `components/MediaHero.tsx` → yalnızca `isWatchlisted` (**HATALI**)

**`utils/followStatus.ts` [YENİ] — tek gerçek kaynak.** Tanım:

> takipEdiyorum = (izleme listemde **VEYA** izleme geçmişim var) **VE** bırakmadım

`isDropped` (Trakt'ta "Bırak" ile gizlenmiş — uygulamanın TEK bırakma mekanizması, `trackingLogic.ts`'te de EN YÜKSEK öncelikli kural) bilinçli olarak dahil edildi: kullanıcının bilerek bıraktığı bir yapım için "Takip Ediliyor" demek ona yanlış bilgi vermek olurdu. İki giriş noktası, TEK kural: `deriveFollowStatus(flags)` (bayrakları zaten elinde olanlar için — `MediaHero`) ve `getMediaFollowStatus(id, type, slices)` (ham store dilimlerinden — kartlar).

**Toggle davranışı da düzeltildi (`resolveFollowAction`).** ESKİ DAVRANIŞ: her durumda körü körüne `toggleWatchlistStatus` çağrılıyordu — izleme geçmişi olan ama watchlist'te olmayan bir yapımda bu, yapımı watchlist'e EKLİYOR ve butonun görünümünü hiç değiştirmiyordu, yani buton "hiçbir şey yapmıyor" gibi hissettiriyordu. Yeni karar tablosu:

| Durum | Buton | Basınca |
|---|---|---|
| Kütüphanede yok | Takip Et | izleme listesine ekle |
| Sadece izleme listesinde (başlanmadı) | Takip Ediliyor | listeden çıkar |
| İzleme geçmişi var (izleniyor/bitti) | Takip Ediliyor | **Bırak** |
| Bırakılmış | Takip Et | bırakmayı geri al |

"İzleme geçmişi var" durumunda geçmişi silmek YIKICI olurdu; doğru karşılık uygulamanın kendi "takibi bırak" ilkeli olan **"Bırak"**tır — izleme geçmişi ve puanlar KORUNUR, yapım yalnızca vitrin listelerinden çıkar, her an geri alınabilir ve yeni bir bölüm izlenince kendiliğinden geri döner (`mutations/progress.ts` `unhideShowIfNeeded`). Bu eylem detay sayfasının "..." menüsünde zaten mevcuttu; buton yeni bir yetenek eklemiyor, var olanı doğru duruma bağlıyor.

**Değiştirilen dosyalar:** `utils/followStatus.ts` [YENİ]; `components/MediaHero.tsx` (durum + toggle kararı, `handleToggleWatchlist` → `handleToggleFollow`); `app/show/[id].tsx` (`isWatched` hiç hesaplanmıyordu — eklendi ve `MediaHero`'ya geçildi; `movie/[id].tsx` zaten geçiyordu); `components/ShowCard.tsx` ve `components/explore/ExploreWebGrid.tsx` (yinelenen `.some()` blokları ortak fonksiyona devredildi, `isAdded` yerel değişkeni kalktı, `hiddenMovieIds` seçiciye eklendi).

**Liste/grid kartlarındaki küçük +/✓ butonu BİLİNÇLİ OLARAK basılamaz kaldı** (izleme geçmişi varken): oradaki tek anlamlı "takibi bırak" karşılığı "Bırak"tır ve o, bir kartın köşesindeki küçük bir butondan tetiklenecek kadar hafif bir eylem değil — detay sayfasından ya da "..." menüsünden yapılır. Yalnızca GÖSTERİM tek kaynaktan doğrulandı.

**Doğrulama:** `tsc --noEmit` temiz. `utils/followStatus.ts` bağımlılıksız saf bir modül olduğu için tek başına derlenip Node'da **20 senaryoluk test koşusundan geçirildi, hepsi geçti**: karar tablosunun her hücresi (kütüphanede yok / sadece listede / izleme geçmişi var — ESKİ BUG / bitirdim / hem liste hem geçmiş / bırakılmış), her durum için doğru toggle eylemi, ham store dilimlerinden hesaplama, **dizi ve film id'lerinin karışmaması** (aynı trakt id'si farklı tipte), `traktId` yokken ve boş dilimlerde çökmemesi. Web bundle hatasız derlendi. **Doğrulanamayan (gerçek Trakt kütüphanesi gerektirdiği için):** kullanıcının 200-300 dizilik gerçek kütüphanesinde butonun toplu davranışı — kendi cihazında doğrulaması gerekiyor.

## 145. Akış'ın Gerçek Zamanlı Sosyal Akışa Dönüştürülmesi

**Kullanıcı isteği:** "Her şey anlık olarak oraya düşüp anlık etkileşimler olmalı. Şu an diziyi izliyorum, uygulamadan çıkıp gelince ancak düşüyor. Bu kabul edilemez. İşaretlenen diziler/filmler ve verilen puanlar anlık olarak oraya düşmeli. Gerekirse sistemi baştan kur, bu akışı bir sosyal medya uygulaması gibi tasarla — hızlı, stabil, kullanıcı dostu, web+mobil uyumlu, Trakt ile entegre."

### Kök neden
Akış tamamen bir **PULL** modeliydi: `/feed/sync` YALNIZCA uygulama açılışında (`useFeedSyncTrigger`) tetikleniyor, Trakt'tan son 50 kaydı çekip Supabase ile karşılaştırıyordu. Bir bölümü işaretlemek yalnızca Trakt'a yazıyordu; aktivitenin akışa düşmesi için uygulamanın kapanıp yeniden açılması gerekiyordu. Ayrıca **film izlemeleri akışta HİÇ yoktu** (sync sadece `/sync/history/episodes` çekiyordu).

### Mimarinin temel taşı: ZAMAN DAMGASI HİZALAMASI
Anında yayın (PUSH) eklemenin önündeki asıl engel çift kayıttı. Uygulama Trakt'a `watched_at`/`rated_at` GÖNDERMİYORDU — Trakt kendi sunucu saatini yazıyordu, dolayısıyla client olayın hangi damgayla kaydedildiğini **bilmiyordu**. Damga bilinmeden yayınlanan satır, bir sonraki senkronda farklı bir dedup anahtarı üretir ve ya kopyalanır ya da "Trakt'ta yok" sanılıp silinirdi.

**Çözüm:** client damgayı kendisi üretir, Trakt'a `watched_at`/`rated_at` olarak **açıkça** gönderir ve **aynısını** akışa yayınlar. Sonraki tam senkron Trakt'tan aynı damgayı okur → aynı dedup anahtarı → satır "zaten var" sayılır. (`services/api/users.ts`: `addEpisodeToHistory`, `addSeasonToHistory`, `addEpisodesBulkToHistory`, `addMovieToHistory`, `addRating` — hepsi opsiyonel damga parametresi aldı, verilmezse eski davranış korunuyor.)

### Yapılanlar

**Şema — `supabase/schema/013_realtime_feed.sql` [YENİ, idempotent]**
- `media_type` ('show'|'movie'): `show_id` kolonu HEM dizi HEM film trakt id'si taşıyordu ve ayırt etmenin hiçbir yolu yoktu — akış kartından bir FİLM puanına tıklandığında `/show/{id}`ye gidiliyordu (yanlış sayfa). Aynı alan `deleted_feed_activities`e de eklendi: olmadan silinen bir film aktivitesinin tombstone'u eşleşmez ve aktivite bir sonraki senkronda **sessizce geri gelirdi**.
- `tmdb_id`: `show_poster_url` hep NULL yazılıyordu, kartlarda gri bir film ikonu vardı. URL yerine tmdb id saklanıyor (URL bayatlar); poster uygulamanın var olan TMDB önbellekli `MediaPoster` bileşeniyle çiziliyor.
- Yeni aktivite tipi `watched_movie` (CHECK constraint güncellendi).
- Idempotent yazma için kısmi unique index'ler — **öncesinde mevcut çift satırları temizleyen DELETE'ler** (aksi halde `CREATE UNIQUE INDEX` patlar ve migration'ın tamamı geri alınır).
- `feed_activities` Realtime publication'a eklendi + `REPLICA IDENTITY FULL`.

**Worker — `/feed/publish` [YENİ uç nokta]**
Token doğrular (satırın `user_id`si **istekten değil**, doğrulanan kullanıcıdan gelir — başkası adına yazmak imkânsız), gizlilik ayarlarına ve gizli Trakt hesabı kuralına uyar, sync ile **AYNI** dedup anahtarlarını kullanır (`watchedKeyOf`/`ratedKeyOf` modül seviyesine alınıp paylaşıldı), idempotenttir. `normalizePublishActivity` client girdisini sıkı doğrular (bölüm biçimi, puan aralığı, gelecek tarih reddi).
Ayrıca sync: film izleme geçmişini de çekiyor (`/sync/history/movies`), `tmdb_id`/`media_type` yazıyor ve **TAZE YAYIN KORUMASI** kazandı — Trakt'ın geçmiş/puan uç noktaları kısa süre gecikebildiği için, son 10 dakikada yazılmış satırlar geri alma kontrolünden muaf (aksi halde kart beliriyor → saniyeler sonra kayboluyor → sonraki senkronda geri geliyordu).

**Client**
- `features/feed/store/feedStore.ts` [YENİ]: akış artık paylaşılan bir zustand store'unda. Zorunluydu — veri UI dışından da değişiyor (mutasyon katmanı + Realtime WebSocket), bir hook'un yerel state'ine bu iki yazıcı erişemezdi.
- `features/feed/services/feedPublish.ts` [YENİ]: iyimser (optimistic) kart ANINDA ekranda, ardından Worker'a POST. Başarısızlıkta kart geri alınır (yayınlanmamış bir şeyi "yayınlandı" göstermek yalan olurdu). Gizlilik kapalıysa Worker `published: 0` döner ve kart yine düşer. Geçici id **deterministik** (`tempActivityId`) — Realtime'dan gerçek satır geldiğinde hangi kartın değiştirileceği arama/tahmin gerektirmez.
- `features/feed/hooks/useFeedRealtime.ts` [YENİ]: `feed_activities` INSERT aboneliği. Sunucu tarafı filtre yerine, takip ettiklerimin `users.id` kümesi bir kez çözülüp bellek içi `Set` ile eleniyor (Realtime `filter`ı uzun/değişken listeler için uygun değil). Arka plandan öne dönüşte küme tazeleniyor.
- Mutasyonlar bağlandı: `markEpisodeAsWatched`, `markSeasonAsWatched`, `markEpisodesUpToAsWatched`, `markMovieAsWatched` → yayın; `unwatchEpisode`/`unwatchSeason` → yerel akıştan düşürme. Hepsi **ateşle-ve-unut** (izleme akışını asla bloklamaz).
- `rateMedia`/`unrateMedia` [YENİ, `mutations/ratings.ts`]: puanlama 6 ayrı ekrandan ham `addRating` ile çağrılıyordu, hiçbiri akıştan haberdar değildi. Dizi/film puanı için tek giriş noktası oldu (bölüm puanı kapsam dışı — akış şeması taşımıyor).
- `services/library/mediaMeta.ts` [YENİ]: yayın için gereken başlık/tmdb id kütüphane dilimlerinden çözülüyor — 6 ekranın imzasını Akış yüzünden değiştirmemek için.
- UI: gerçek posterler, dizi/film ayrımına göre doğru rota (`utils/feedNavigation.ts`), "N yeni gönderi" pill'i (canlı gelen içerik kullanıcının okuduğu yeri kaydırmaz), yayınlanıyor göstergesi, puanlama metni artık dizi/film ayrımı yapıyor (eskiden dizilere de "filmine ... puan verdi" diyordu).
- Çıkışta `feedStore.reset()` + kimlik önbellekleri temizleniyor (hesap değişiminde önceki kullanıcının akışı sızmasın).

**Temizlik:** Worker'ın `test/index.spec.js`'i `npm create cloudflare` iskeletinden kalma, hiç güncellenmemiş ve **uzun süredir başarısız** olan "Hello World!" testiydi (bu Worker o yanıtı hiç döndürmedi) — gerçek testlerle değiştirildi.

### Doğrulama
- `tsc --noEmit` temiz; web bundle hatasız derlendi.
- **Worker: 26 test geçti** (vitest) — `normalizePublishActivity` doğrulaması (geçersiz tip/tarih/puan/bölüm biçimi reddi, gelecek tarih reddi, `user_id`nin istekten alınmaması), dedup anahtarlarının ISO biçim farklarına (Z / +00:00 / ms) dayanıklılığı, dizi-film ayrımı, `/feed/publish` istek doğrulama yolları.
- **Client: 18 test geçti** — store sıralaması, aynı id'nin çift kart üretmemesi (Realtime yankısı), "yeni gönderi" sayacının kendi aktivitemi saymaması, iyimser kartın yaşam döngüsü (ekle → gerçek satırla değiştir → başarısızlıkta geri al → gerçek satır zaten varsa kopya bırakma), oturum izolasyonu, dizi/film rota ayrımı.
- **Zincir doğrulaması: 7 test geçti** — client'ın ürettiği damganın Trakt→sync yolundan geçtikten sonra **aynı dedup anahtarını** üretmesi, sunucu satırından hesaplanan geçici id'nin iyimser kartınkiyle eşleşmesi ve **damga hizalanmasaydı anahtarların tutmayacağının** kanıtı (regresyon testi).

### ⚠️ KULLANICININ ELLE YAPMASI GEREKEN 2 ADIM
Bu ikisi yapılmadan anında yayın ve canlı akış ÇALIŞMAZ (uygulama çalışmaya devam eder, yalnızca eski davranışa düşer):
1. **Supabase SQL Editor**'de `supabase/schema/013_realtime_feed.sql` çalıştırılmalı.
2. **Worker deploy**: `cd "C:\Yapay_Zeka_Uygulamalar\kaymaktv-feedback-worker" && npx wrangler deploy`

### Doğrulanamayan (gerçek hesap + canlı altyapı gerektirir)
Gerçek Trakt hesabıyla uçtan uca akış (bölüm işaretle → kart anında düşsün → başkasının ekranında canlı belirsin), Realtime WebSocket'in gerçek Supabase projesinde bağlanması ve poster yüklenmesi — kullanıcının kendi cihazında/hesabıyla doğrulaması gerekiyor.

## 146. Canlı Ortam Bulgusu: Bilinmeyen POST Yolları Sessizce Discord'a Düşüyordu

**Kullanıcı bildirimi:** "Bir dizi izledim, anlık geldi ve gördüm. Ama ardından hata çıktı, garip şekilde Discord'a hata mesajı geldi (ben atmadım), 'anonim' kullanıcıdan. Daha da ilginci bu hata Supabase error_logs'ta yok. Hepsi bağlantılı mı?"

**Evet — üç belirti de tek kök nedene çıkıyor: Madde 145'in iki elle adımı henüz yapılmamıştı.**

### 1) Supabase 400 — migration 013 çalıştırılmamış
Client artık `media_type` ve `tmdb_id` kolonlarını seçiyor; migration çalıştırılmadığı için PostgREST 400 döndü ve akış yüklenemedi. Dizinin "anlık gelmesi" gerçek yayından DEĞİL, **iyimser (optimistic) karttan** geliyordu — o kart tamamen client tarafında, sunucuya hiç dokunmadan çiziliyor. Yani üç katmandan yalnızca en üsttekinin çalıştığını görüyorduk.

### 2) Discord'a "anonim" mesaj — Worker'ın CATCH-ALL router'ı (GERÇEK KUSUR)
Worker'ın router'ında **path kontrolü yoktu**: tanınmayan HER POST yolu `handleFeedback`e düşüyordu ("eski client kök path'e POST atıyor" uyumluluğu için). Worker henüz `/feed/publish` ile deploy edilmediğinden client'ın yayın isteği bu catch-all'a düştü ve:
- `body.userMessage`/`body.userId` yok → `sanitizeData(undefined)` → `""` → **boş/anonim bir "geri bildirim"** oluştu,
- **Discord'a gönderildi** (kullanıcı hiçbir şey bildirmemişken),
- `error_logs` INSERT'i zorunlu alanlar boş olduğu için başarısız oldu → **bu yüzden Supabase'de yok**,
- ve en kötüsü, `handleFeedback` `{success: true}` döndürdüğü için **client aktiviteyi yayınlanmış sandı** ve iyimser kartı geri almadı.

**Düzeltme:** artık yalnızca kök path (`/`) geri bildirimdir; tanınmayan her yol **404** döner. Bu, ileride eklenecek herhangi bir uç noktanın (ya da bir yazım hatasının) aynı sessiz Discord spam'ini üretmesini yapısal olarak imkânsız kılar.

### 3) Client tarafı savunma — "yanlış başarı" kapatıldı
`publishActivities` yalnızca `success: true`ya bakıyordu; eski Worker da bunu döndürdüğü için ayırt edemiyordu. Artık yayın yanıtına ÖZGÜ `published` alanı şart: yoksa "karşımızdaki uç nokta yayın uç noktası değil" kabul edilip iyimser kart geri alınıyor ve net bir mesaj loglanıyor ("Worker güncel sürümle deploy edilmiş mi?").

**Doğrulama:** Worker testleri **29/29 geçti** — yenileri: tanınmayan yolun 404 dönmesi, yazım hatalı uç noktanın 404 dönmesi, kök path'in geri bildirim olarak KALMASI (eski client uyumu korunuyor). `tsc --noEmit` temiz.

**Not:** Bu iki düzeltme, asıl 2 elle adımın (migration + deploy) yerine geçmez — onlar hâlâ gerekli. Yaptıkları, adımlar atlandığında sistemin **sessizce yanlış davranmak yerine gürültülü ve dürüst şekilde başarısız olması**.

## 147. Kütüphane Filtrelerine "Bitirilenler" Eklendi (Diziler + Filmler)

**Kullanıcı isteği:** Profil › Diziler/Filmler ekranındaki mevcut filtre yapısını (diziler: Aktif İzlenenler/Ara Verilenler/Henüz Başlanmadı/Gizlenenler; filmler: İzlenenler/İzlenecekler/Gizlenenler) bozmadan "Bitirilenler" filtresi eklensin — dizilerde de filmlerde de bitmiş yapımlar gösterilsin.

### Önce mevcut mimari anlaşıldı
`hooks/libraryFilterCore.ts` medya tipinden bağımsız, paylaşılan bir süzme çekirdeği; `useLibraryShowFilters`/`useLibraryMovieFilters` yalnızca kendi "durum indeksini" (trakt id → kategori) üretip ona veriyor. `LibraryFilterModal`/`LibraryFilterBar` tamamen jenerik — `options: FilterOption[]` üzerinde döner, kaç kategori olduğunu bilmez. Bu sayede yeni bir kategori eklemek, listedeki anahtar dizisine bir satır eklemekten ibaret — **modal/bar/çekirdek hiç değişmedi**.

### Diziler: gerçek bir boşluk vardı
`store/tracking/trackingLogic.ts`'teki `categorizeShows` zaten bir `caughtUp` kovası hesaplıyordu (izlenmeye başlanmış AMA şu an izlenmeye hazır bir sonraki bölümü olmayan diziler — dizi bitmiş ya da yeni sezon henüz yayınlanmamış). Ancak Takip panosu bu kovayı BİLİNÇLİ OLARAK göstermiyordu (Madde "Güncel Kategorisini Kaldırıyoruz" — panosu bir "Yapılacaklar" listesi felsefesiyle 3 sekmeye döndürülmüştü) VE Kütüphane filtresi de onu hiç tüketmiyordu. Sonuç: bitmiş bir diziyi filtreyle bulmanın **hiçbir yolu yoktu**.

**Çözüm:** `hooks/useLibraryShowFilters.ts`'teki `ShowStatusKey`e ve `SHOW_STATUS_KEYS`e `'caughtUp'` eklendi — isim BİLİNÇLİ OLARAK `categorizeShows`'un ürettiği kova adıyla birebir aynı tutuldu (yeni bir kavram icat edilmedi, var olanı UI'a açtı). `useShowStatusIndex` zaten `SHOW_STATUS_KEYS` üzerinde döngüye giriyordu, tek satırlık ekleme yeterliydi. `extraPool`e hiçbir şey EKLENMEDİ: bitmiş diziler tanım gereği `completed > 0`, yani zaten `watchedShows`te — ekranın base listesi (`useLibraryTypeData`) de tam olarak oradan geliyor, dolayısıyla bu diziler filtre kapalıyken bile zaten görünüyordu, yalnızca ONLARI SEÇEREK bulmanın yolu yoktu.

### Filmler: gerçek bir boşluk YOKTU — etiket düzeltildi
`store/tracking/movieTrackingLogic.ts`'in kendi başlığında açıkça yazıyor: filmlerde dizilerdeki bölüm/sezon ilerlemesinin karşılığı yok, bir film ya `watched` ya `watchlist` ya `hidden`dır — ara bir durum yok. Yani `watched` (Trakt'ın izleme geçmişinde olan film) kovası zaten **tam olarak** "Bitirilenler" anlamına geliyordu; yeni bir kova icat etmek `İzlenenler` ile bitebir aynı üyeliğe sahip, kafa karıştırıcı bir ikinci (yinelenen) filtre çipi yaratırdı. Bunun yerine yalnızca ETİKET değiştirildi: `MOVIE_LABEL_KEYS.watched` artık dizi tarafındaki ile AYNI terimi kullanan `'filterFinished'` anahtarına bağlı — kova/mantık/davranış **birebir aynı**, filtreye basınca hâlâ tam olarak aynı filmler geliyor, yalnızca artık doğru terimle adlandırılmış.

### Değişen dosyalar
- `hooks/useLibraryShowFilters.ts` — `caughtUp` eklendi (yukarıda).
- `hooks/useLibraryFilters.ts` — `SHOW_LABEL_KEYS.caughtUp: 'filterFinished'` (YENİ — `caughtUp`'ın kendi i18n anahtarı "Yeni bölüm bekleniyor" kart metni içindi, filtre menüsünde YANLIŞ görünürdü, bu yüzden ayrı bir etiket anahtarı); `MOVIE_LABEL_KEYS.watched: 'filterWatched'` → `'filterFinished'`.
- `locales/tr|en/media.json` — yeni `filterFinished` ("Bitirilenler"/"Finished") eklendi; artık hiçbir yerde kullanılmayan `filterWatched` kaldırıldı (ölü kod bırakılmadı).
- `LibraryFilterModal.tsx`, `LibraryFilterBar.tsx`, `libraryFilterCore.ts`, `movieTrackingLogic.ts`, `trackingLogic.ts` — **HİÇBİRİ değişmedi**, mimarinin zaten bunu desteklediğinin kanıtı.

### Doğrulama
`tsc --noEmit` temiz. `categorizeShows` + `filterLibraryItems`i sahte bir kütüphaneyle (aktif/ara verilen/bitmiş/başlanmamış 4 dizi) izole çalıştırıp **11 senaryo test edildi, hepsi geçti**: bitmiş dizinin yalnızca `caughtUp` kovasına düştüğü, diğer HİÇBİR kovaya (upNext/paused/notStarted/hidden) girmediği, "Bitirilenler" filtresi seçilince yalnızca bitmiş dizinin göründüğü, başka bir filtre seçiliyken bitmiş dizinin dışarıda kaldığı ve filtre hiç seçili değilken bitmiş dizinin yine de (base listede) göründüğü. Web bundle hatasız derlendi.

**Doğrulanamayan:** gerçek bir Trakt kütüphanesiyle uçtan uca (Profil → Diziler/Filmler → filtre menüsünü aç → "Bitirilenler"i seç → doğru listenin gelmesi) — kullanıcının kendi cihazında denemesi gerekiyor.

## 148. Akış Ölçeklenmesi: Cursor Pagination + Sonsuz Kaydırma + Veri Saklama Politikası

**Kullanıcı isteği:** Akış global 30 kayıtla sınırlıydı ve sayfalama yoktu; kullanıcı sayısı arttıkça çökecekti. Pagination + Infinite Scroll + Data Retention kurulması istendi. Plan sunuldu, kullanıcı 3 kritik uyarıyı kabul edip onayladı.

### Plandan sapılan 5 nokta (kullanıcı onayıyla)

1. **Migration numarası `013` → `014`.** `013_realtime_feed.sql` zaten mevcuttu.
2. **`created_at` indeksi EKLENMEDİ.** Akış `activity_at DESC`e göre okunuyor; `001_feed_schema.sql`'deki `idx_feed_activities_time` ve `idx_feed_activities_user_time` bu işi zaten yapıyor. `created_at` indeksi hiçbir okumayı hızlandırmaz, yalnızca INSERT maliyeti eklerdi.
3. **Zaman bazlı silme (30 gün) → kullanıcı başına 200 kayıt.** İki somut gerekçe: (a) Profil › Aktiviteler sekmesi bilinçli olarak tarih penceresiz çalışıyor — zaman bazlı silme herkesin profil geçmişini yok ederdi; (b) Worker senkronu Trakt'tan son 50 kaydı çekiyor, az aktif kullanıcıda "gece sil / sabah geri ekle" sonsuz döngüsü oluşurdu. 50 < 200 olduğu için bu döngü artık yapısal olarak imkânsız.
4. **Basit imleç → BİLEŞİK imleç `(activity_at, id)`.** Toplu sezon işaretlemesinde TÜM bölümler aynı `activity_at` damgasını alıyor (dedup hizalaması için bilinçli, bkz. Madde 145). Basit `.lt(activity_at)` imleci sayfa sınırı bir damga grubunun ortasına denk geldiğinde kalan kayıtları ATLARDI; `.lte` ise 40 bölümlük bir sezonda sonsuz döngüye girerdi.
5. **Cron saati `0 0 * * *` (UTC).** pg_cron UTC çalışır; `0 3 * * *` yazmak TR saatiyle 06:00 demek olurdu.

Ayrıca planın Aşama 3'ünün yarısı (pull-to-refresh, skeleton) Madde 145'te zaten yapılmıştı — yalnızca sonsuz kaydırma ve footer eksikti.

### Yapılanlar

**`supabase/schema/014_feed_retention.sql` [YENİ]** — `prune_feed_activities()` (kullanıcı başına en yeni 200; `activity_at DESC, id DESC` ile deterministik sıralama), `prune_deleted_feed_activities()` (tombstone'lar için çok daha cömert 1000 eşiği — erken silinen bir tombstone, Trakt'ta hâlâ duran aktivitenin sessizce geri gelmesine yol açardı), idempotent `cron.schedule('prune-feed', '0 0 * * *')`. Dosya sonunda doğrulama sorguları yorum olarak bırakıldı.

**`features/feed/services/feedApi.ts`** — `fetchFeedActivities(cursor, force)` artık `FeedPage { items, nextCursor, hasMore }` döndürüyor. `PAGE_SIZE: 30 → 15`. Filtre `user.trakt_slug` join'i yerine **`user_id`** üzerinden (mevcut `(user_id, activity_at DESC)` composite index'i böylece gerçekten kullanılıyor; uzun takip listelerinde URL de öngörülebilir kalıyor). İmleç damgası `toISOString()` ile normalize ediliyor — Postgres'in `+00:00` eki PostgREST'in `or=` ifadesinde URL kodlama riski taşıyordu. `getVisibleUserIds` 60 sn önbelleğe alındı (aksi halde HER sayfa için fazladan bir `users` sorgusu atılırdı) + `invalidateVisibleUserIds` çıkışta çağrılıyor.

**`features/feed/store/feedStore.ts`** — `setFirstPage`/`appendPage`/`nextCursor`/`hasMore`/`isLoadingMore`. **`MAX_ACTIVITIES = 200` KALDIRILDI**: sonsuz kaydırmayla birlikte çalışamaz — `slice(0,200)` en eski kayıtları kırptığı için kullanıcı 200. kayda geldiğinde eklenen her sayfa aynı anda düşer, liste asla ilerlemezdi. Büyüme artık 30 günlük pencere + sunucu retention'ı ile doğal olarak sınırlı. Yerel `sortDesc` sunucunun `activity_at DESC, id DESC` sözleşmesiyle BİREBİR aynı (aksi halde sayfa sınırlarında sıra kayardı).

**`features/feed/hooks/useFeed.ts`** — `loadMore` (uçuştaki istek referansıyla eşzamanlılık koruması: `onEndReached` hızlı kaydırmada arka arkaya tetikleniyor), `isLoadingMore`, `hasMore`. Alt sayfa hatası tam ekran hata GÖSTERMEZ — liste dolu, kullanıcı okumaya devam eder.

**`app/(protected)/(tabs)/feed.tsx`** — `onEndReached` + `onEndReachedThreshold={0.5}` + `ListFooterComponent` (spinner / "Hepsi bu kadar"). Tek dosya hem mobil hem web'i besliyor (responsive), ayrı web varyantı yok.

### Doğrulama
- `tsc --noEmit` temiz; web bundle hatasız derlendi.
- **Pagination simülasyonu: 12/12 geçti** — Supabase'in sıralama + keyset filtresi birebir taklit edilerek: 40 bölümlük tek damgalı sezonun TAMAMININ çekilmesi (hiçbiri atlanmadan, tekrar etmeden, sonsuz döngüye girmeden), sayfa sınırının tie-group ortasına denk gelmesi, sıranın sunucu sırasıyla birebir aynı olması, `hasMore`'un tam bölünen sayfada doğru sonlanması. **Senaryo 3 regresyon kanıtı olarak duruyor: basit imleç kullanılsaydı 40 kayıttan yalnızca 15'i gelirdi (25 kayıp).**
- **Store testleri: 13/13 geçti** — sayfa ekleme, imleç sınırında tekrar eden kaydın çift kart üretmemesi, Realtime ile birlikte çalışma (canlı kayıt üstte kalırken sayfa alta eklenir), damga eşitliğinde yerel sıranın sunucu sözleşmesine uyması, 300 kayda kadar birikme (eski 200 sınırı kalksaydı takılırdı), pull-to-refresh'in imleci sıfırlaması, oturum izolasyonu.

**Doğrulanamayan (gerçek Supabase + Trakt hesabı gerektirir):** gerçek veriyle sonsuz kaydırma, `pg_cron` işinin gece çalışması, Realtime'ın canlı bağlanması.

## 149. Akış Kartlarında Puanlama /10 Değil /5 Gösterilmeliydi

**Kullanıcı bildirimi:** "Puan verince 10/10 yazıyor akışta. 5/5 yazması gerekmez mi? Puan 5 üzerinden. Buçuklu de verirse 2.5/5 gibi gösterilir."

**Kök neden:** Trakt'ın API'si puanı 1-10 skalada tutuyor, ama bu uygulamanın kendi arayüzü (`StarSlider`, 5 yıldız) kullanıcıya HER YERDE 5 üzerinden gösteriyor — `ShowCard`, `MediaHero` dahil tüm ekranlar zaten `utils/formatRating.ts`'i kullanıyordu (10 → 2'ye böl, tam sayıysa ondalıksız). `FeedCard.tsx` bu ortak yardımcıyı atlayıp ham `a.rating` ile `"${a.rating}/10"` yazıyordu — akış, uygulamanın geri kalanıyla tutarsızdı.

**Düzeltme:** `FeedCard.tsx`'teki `rated` etiketi artık `formatRating(a.rating)` kullanıyor, `/10` → `/5`. Tek dosyada düzeltildi; bu kart Akış, Profil › Aktiviteler ve Herkese Açık Profil'in üçü tarafından paylaşıldığı için değişiklik hepsinde otomatik geçerli.

**Doğrulama:** `tsc --noEmit` temiz. `formatRating`in 6 senaryosu (10→5, 9→4.5, 5→2.5, 2→1, 1→0.5, 8→4) test edildi, hepsi geçti.

## 150. Takip Kategorileri: "Tümünü Gör" Artık Kategoriyle Açılıyor + İlk Giriş Senkronu Toplu Uç Noktayla Stabilize Edildi

**Kullanıcı bildirimi (iki ayrı sorun):** (1) Web'de Diziler sekmesindeki kategori carousel'lerinin ("Aktif İzlenenler" / "Ara Verilenler" / "Henüz Başlanmadı") sağındaki ok, hangi kategoriden basılırsa basılsın TÜM dizileri açıyordu. (2) İlk girişte (önbellek boşken) diziler 2-3 dakika boyunca "bir listeden diğerine akıyordu" — önce çoğu Aktif İzlenenler'e düşüyor, verisi geldikçe gerçek kovasına taşınıyordu. Kullanıcı ayrıca "filtreleme Trakt'ta zaten yapılıyorsa bizim tekrar yapmamız yavaşlatır, mümkünse Trakt'tan filtreli çekilsin" diye sordu.

### Önce araştırma: Trakt sunucu tarafında ne veriyor?
Güncel resmi dokümantasyon (docs.trakt.tv) tarandı:
- **`GET /sync/progress/up_next_nitro?intent=all`** (ve kardeşi `/sync/progress/up_next`): kullanıcının TÜM dizilerinin ilerleme ÖZETİNİ (`aired`, `completed`, `last_watched_at`, `next_episode`, `last_episode`) sayfalanmış tek uç noktadan veriyor — `intent=all` başlanmış + bitmiş + yeni başlanan hepsini kapsıyor. VIP şartı YOK, yalnızca OAuth. ~100 dizi/istek.
- **Uygulamanın 3'lü kategorizasyonunun (Aktif/Ara Verilen/Başlanmadı, 45 gün eşiği) Trakt'ta birebir karşılığı YOK** — nitro'nun `intent`i (continue/start/completed) farklı bir eksende ayırıyor ve "Ara Verilenler" kavramı hiç yok. Yani kategorizasyon istemcide KALMALI; ama bu zaten saf, bellek-içi, ucuz bir hesap (`categorizeShows`). Pahalı olan kategorizasyon değil, onu besleyen VERİNİN dizi başına tek tek (`/shows/:id/progress/watched`) çekilmesiydi — asıl kazanç oradaydı.
- Özet yanıtında sezon/bölüm kırılımı (`seasons`) YOK — bölüm bazlı işaretleme kontrolleri (`EpisodeCheckButton`, `app/episode/[id].tsx`, dizi detayındaki bölüm tikleri) için dizi başına tam çekim hâlâ gerekli. Bu yüzden toplu uç nokta tam çekimin YERİNE değil, ÖNÜNE kondu (aşağıda).

### (1) "Tümünü Gör" düzeltmesi — kök neden ve çözüm
`shows.web.tsx`'teki `openViewAllShows` üç carousel için de parametresiz `/library/shows`'a gidiyordu; kütüphane ekranının zaten var olan kategori filtresi (Madde 95/147 altyapısı) hiç tetiklenmiyordu. Çözüm URL sözleşmesi: ok artık `/library/shows?status=upNext|paused|notStarted` taşıyor; `useMediaFilterState` yeni `initialStatuses` parametresiyle bu önseçimi İLK mount'ta uyguluyor (bilinmeyen anahtarlar `orderedKeys` süzgecinden geçemez, sonradan filtre değiştirmek serbest). Zincir: `[type].web.tsx` + `LibraryMobile.tsx` (aynı `?status=` sözleşmesi — platformlar ayrışmaz) → `useLibraryFilters` → `useLibraryShowFilters`/`useLibraryMovieFilters` → `libraryFilterCore`. Filmler tarafında da aynı hata vardı: "İzlenecekler" carousel'inin oku, varsayılan listesi İZLENENLER olan `/library/movies`'i parametresiz açıyordu → artık `?status=watchlist`. Ayrıca `openViewAllShows` artık parametre aldığı için trend/yaklaşan carousel'lerine doğrudan referans olarak verilemezdi (Pressable'ın event nesnesi `statusKey`e sızardı) — sarmalayıcı ok fonksiyonuyla verildi.

### (2) İlk giriş kargaşası — kök neden ve çözüm
Kök neden zinciri: ilk girişte `showProgressMap` boş → `fetchFreshData`'nın delta hesabı TÜM izlenen dizileri kuyruğa alıyor → `getShowProgress` dizi başına tek istek, 6'lık gruplar + 150ms bekleme + LOW öncelik = yüzlerce istek, 2-3 dakika → bu süre boyunca `categorizeShows`'ta `isCalculating` kuralı gereği verisi gelmemiş her izlenen dizi upNext'e ("hesaplanıyor" kartıyla) düşüyor, verisi geldikçe gerçek kovasına sıçrıyordu.

**Çözüm — FAZ 0 "toplu tohumlama" (`services/library/fetchers.ts`):** eksik/bayat ilerleme sayısı eşiği (10) aşıyorsa, tek tek çekime başlamadan ÖNCE yeni `getUpNextProgress()` (`services/api/users.ts`, `up_next_nitro?intent=all`, `getWatchedShows`'la aynı sayfalama deseni, 50 sayfa tavanı) ile tüm özetler birkaç istekte alınıp haritaya TEK yayında yazılıyor ve diske kalıcılaştırılıyor → kategoriler dakikalar yerine birkaç saniyede doğru oturuyor. Birleşim kuralı: `{...mevcutTamKayıt, ...özet}` — mevcut kaydın sezon kırılımı korunur, özet alanları tazelenir. Sonra tam (sezonlu) çekim kuyruğu ŞU ŞEKİLDE budanıyor: sezon kırılımı zaten olan VE izlenme damgası değişmemiş diziler (yani yalnızca "hâlâ yayında + tamamlanmış görünüyor" tedbir çekimleri — taze `next_episode`yi artık toplu özet verdi) kuyruktan düşer; kalanlar en son izlenen en önce sıralanır (kullanıcının etkileşeceği dizinin bölüm tikleri ilk saniyelerde hazır olsun). Toplu istek başarısız olursa (`try/catch`) eski tek tek yol AYNEN devam eder — davranışsal gerileme yapısal olarak imkânsız. Yan kazanç: toplu özet HER tam senkronda değişmeyen dizilerin de `next_episode`sini tazelediği için "bitmiş sanılan dizinin yeni sezonu duyuruldu" durumu artık gecikmesiz yakalanıyor.

### Doğrulama
- `tsc --noEmit` temiz; web bundle Metro'da hatasız derlendi; `/library/shows?status=upNext` rotası tarayıcıda çökmeden açıldı (misafir, boş kütüphane — parametreli/parametresiz davranış birebir aynı).
- **İzole mantık testi 12/12 geçti** (gerçek `categorizeShows` import edilerek): boş haritada izlenen dizilerin spinner'la upNext'e düştüğünün (eski kargaşanın) kanıtı; toplu özet yüklenince aynı dizilerin sezon kırılımı OLMADAN doğru kovalara (upNext/paused/caughtUp/notStarted, çakışmasız) oturduğu; kuyruk süzgecinin ilk-kez-görülen ve izlenmesi-değişen dizileri tutarken değişmeyen tam kayıtları düşürdüğü; özet birleşiminin sezonları koruyup `aired`/`next_episode`yi tazelediği.

**Doğrulanamayan (gerçek Trakt hesabı gerekir):** `up_next_nitro`nun canlı yanıtı ve web'de CORS'a takılmadığı (takılırsa fallback devrede), gerçek büyük kütüphanede ilk giriş süresi. Kullanıcının kendi hesabıyla ilk girişte konsolda `Bulk seed: N dizi özeti tek turda yüklendi` satırını görmesi beklenir.

## 151. Geliştirici Paneli: "Hata Günlüğü" Ekranı Performans Sekmesiyle Birleşip Gerçek Ölçümlerle Zenginleştirildi

**Kullanıcı isteği:** Ayarlar'daki gizli tanılama ekranı (sürüm numarasına 7 kez dokunma) başka bir uygulamadaki bir "Geliştirici Paneli" tasarımına (ekran görüntüsü paylaşıldı: üstte 4 istatistik kartı — Ölçüm/Yavaş/Hata/Uyarı, Performans + Hata Günlüğü sekmeleri, kategori çipleri, renkli noktalı ölçüm satırları) göre yeniden kurulsun. Ayrıca: 5. dokunuşta bir uyarı yazısı, 7. dokunuşta panel DOĞRUDAN açılsın (ayrı bir "kilit açıldı" adımı olmadan). Son olarak, panelden logları "profesyonel bir üslupla" (kullanıcıya asla "Discord'a gönder" denmeden) hem Supabase'e hem Discord'a gönderen bir buton istendi; karakter sınırı sorun olursa ayrı bir sistem kurulması teklif edildi.

### Önce mevcut altyapı incelendi — YENİ bir arka uç GEREKMEDİ
`services/api/feedback.ts` + Cloudflare Worker (`EXPO_PUBLIC_FEEDBACK_WORKER_URL`) zaten `sendFeedback({ errorLogs, performanceReport, deviceInfo, userId, category })` ile hem Supabase'in `error_logs` tablosuna (ham veri, karakter sınırı yok — bkz. `011_error_logs_performance_report.sql`) hem Discord'a (özet embed + "kaydedildi" durumu, ham veri kasıtlı olarak yalnızca Supabase'de) yazıyordu (`hooks/useReportIssue.ts`, "İstek/Öneri/Şikayet" akışı). Bu yüzden Geliştirici Paneli'nin "Raporu Gönder" butonu YENİ bir Discord webhook'u/Supabase tablosu KURMADI — `category: 'bug'` ile AYNI boruyu ikinci bir giriş noktasından (`hooks/useSendDevReport.ts`) tetikliyor; aynı 3 dakikalık soğuma penceresini (`useFeedbackStore`) de PARANTEZSİZ paylaşıyor.

### Performans verisi: iki katmanlı, TEK gerçek kaynak yok — İKİSİ DE gerekli
`utils/metrics.ts`/`metricsStore.ts` (Faz 7'den beri var) yalnızca SAATLİK HİSTOGRAM tutuyor — "bir isteğin ortalaması" bilinir ama "hangi TEKİL çağrı ne kadar sürdü" kayboluyor, ekran görüntüsündeki "aynı isim 5 kez farklı ms'lerle" listesini üretemez. Bunun yerine yeni bir sistem İCAT EDİLMEDİ — `errorLog.ts`'teki ring buffer deseni AYNEN kopyalanıp `utils/perfLog.ts` (60 kayıtlık, `{timestamp, name, category, durationMs}`) eklendi; `recordApiLatency` (histogram, feedback raporunda hâlâ kullanılıyor) ile `recordPerfMark` (ring buffer, panelin canlı listesi) AYNI ölçüm noktasından PARALEL çağrılıyor, biri diğerinin yerini almıyor.

### Gerçek ölçüm noktaları (uydurma veri YOK)
- `services/api/traktClient.ts` — her Trakt isteğinin interceptor'ı zaten `recordApiLatency` çağırıyordu; yanına `recordPerfMark(breakerKey, 'network', ms)` eklendi (başarı VE "yanıt geldi ama hata" dallarının ikisinde de). 429 tekrar deneme dalına `logWarning` eklendi — akışı bozmaz ama panelin "Uyarı" sayacı için gerçek bir sinyal.
- `features/versionGate/hooks/useVersionGate.ts` — kontrol süresi `'Sürüm Kontrolü'` etiketiyle ölçülüyor (`try/finally`, tüm çıkış yollarını TEK yerden kapsar); fail-open catch bloğu artık `logWarning` da çağırıyor (kullanıcı engellenmiyor, bu yüzden HATA değil UYARI).
- `context/AuthContext.tsx` — `loadKeys()` (SecureStore'dan token okuma) `'Oturum Başlatma'` etiketiyle ölçülüyor.
- `app/_layout.tsx` — modül değerlendirilir değerlendirilmez (`appLoadStartedAt`) damgalanıp `RootLayoutNav`'ın `isLoading` state'i `false` olduğu ANDA (VersionGate + Auth bootstrap bitmiş, ilk anlamlı ekran hazır) `'Toplam Uygulama Açılışı'` olarak kaydediliyor — `useRef` ile yalnızca BİR kez.
- Diğer uygulamadaki 5 iç içe/örtüşen başlangıç etiketi (RootNavigator Render Hazır + Session/Profil Yükleme + Profil Yükleme ayrı ayrı) BİLİNÇLİ OLARAK birebir kopyalanmadı — bu üç net, örtüşmeyen aşama (Sürüm Kontrolü / Oturum Başlatma / Toplam Açılış) gerçek mimariye daha uygun.

### Ekran: `error-log.tsx` SİLİNDİ, `dev-panel.tsx` + alt bileşenler
`app/(protected)/error-log.tsx` kaldırıldı (`_layout.tsx`'teki `Stack.Screen` kaydı `dev-panel`e çevrildi); eski davranışının TAMAMI (kopyala/temizle/boş durum/genişleyen satır) `components/devPanel/ErrorsTab.tsx` + `ErrorEntryRow.tsx`ye BİREBİR taşındı (yalnızca `level: 'warn'` rozeti eklendi). Yeni `PerformanceTab.tsx` (kategori çipleri + renkli nokta) yanına eklendi. Dosya 400 satır kuralına uysun diye (`AGENTS.md`) ekran `dev-panel.tsx` (265 satır, orkestrasyon) + `StatCard`/`CategoryChip`/`PerfEntryRow`/`ErrorEntryRow`/`PerformanceTab`/`ErrorsTab`/`EmptyState`/`ListSkeleton`/`SendReportButton`/`formatTimestamp`/`listActionStyles` olarak bölündü. Veri tarafı: `usePerfLog.ts` (`useErrorLog.ts` ile BİREBİR iskelet) + bu ikisini istatistiklere (toplam/yavaş/hata24s/uyarı24s) ve kategori özetlerine (`ø{avg}ms` çipleri) dönüştüren `useDeveloperPanel.ts`.

### Dokunuş jesti: tek yönlü açılış
`app/(protected)/account.tsx`'teki `handleVersionTap`: eskiden 7. dokunuş bir booleanı AÇIP/KAPATIYOR, ayrı bir "Performans Raporu" (panoya kopyala, `hooks/useSettings.ts`→`handleExportMetrics`, artık SİLİNDİ) ve "Hata Günlüğü" satırı gösteriyordu. Artık: 5. dokunuşta `devPanelOpeningHint` toast'ı ("2 dokunuş kaldı"), 7. dokunuşta `isDeveloperMode` TEK YÖNLÜ `true` olup `router.push('/(protected)/dev-panel')` ile DOĞRUDAN yönlendirir. İki ayrı satır tek bir `"Geliştirici Paneli"` satırına birleşti (sonraki ziyaretler için — jestin kendisi zaten anlık yönlendiriyor).

### Değişen/silinen dosyalar
YENİ: `utils/perfLog.ts`, `hooks/usePerfLog.ts`, `hooks/useDeveloperPanel.ts`, `hooks/useSendDevReport.ts`, `app/(protected)/dev-panel.tsx`, `components/devPanel/*` (11 dosya). SİLİNDİ: `app/(protected)/error-log.tsx`. DÜZENLENDİ: `utils/errorLog.ts` (`level` alanı + `logWarning`), `services/api/traktClient.ts`, `features/versionGate/hooks/useVersionGate.ts`, `context/AuthContext.tsx`, `app/_layout.tsx`, `app/(protected)/_layout.tsx`, `app/(protected)/account.tsx`, `hooks/useSettings.ts` (ölü `handleExportMetrics`/`isExportingMetrics` kaldırıldı), `locales/tr|en/settings.json` (ölü `developerModeLocked/Unlocked`, `exportPerformanceReport*` kaldırıldı; `devPanel*` eklendi).

### Doğrulama
`tsc --noEmit` temiz. Web'de canlı doğrulama (misafir modu): sürüm etiketine 5 dokunuşta toast göründü ("🛠️ Geliştirici Paneli açılıyor... 2 dokunuş kaldı"), 7 dokunuşta `/dev-panel`e yönlendirdi; panelde GERÇEK ölçümler ("Toplam Uygulama Açılışı", "Oturum Başlatma", `startup ø43ms` çipi) doğru sayıldı/listelendi; Hata Günlüğü sekmesi boş durumu doğru gösterdi; "Raporu Kopyala" panoya yazıp "Rapor panoya kopyalandı." toast'ını tetikledi; Ayarlar'a dönünce "Geliştirici Paneli" satırı kalıcı kaldı (aynı ekran örneği React Navigation stack'inde mount'lu kaldığı sürece — sayfa tam yeniden yüklenirse `isDeveloperMode` kalıcı DEĞİL, bu bilinçli bir tercih). Konsolda yalnızca ortama özgü, önceden var olan Trakt CORS hataları görüldü, yeni koddan kaynaklanan hiçbir hata yoktu.

**Doğrulanamayan:** "Raporu Gönder" butonunun gerçek bir Cloudflare Worker + Discord/Supabase ile uçtan uca teslimi (yerel ortamda `EXPO_PUBLIC_FEEDBACK_WORKER_URL` gerçek bir Worker'a bağlı değildi) — kod yolu `useReportIssue.ts`'in ZATEN PRODUCTION'DA ÇALIŞAN AYNI `sendFeedback` çağrısını birebir kullandığından yüksek güvenle çalışması beklenir, ama kullanıcının gerçek cihazda denemesi gerekir. Native (Android/iOS) tarafında `network` kategorisi ölçümleri de test edilmedi (yalnızca web'de, misafir modunda, CORS yüzünden network isteği atılamadığından `startup` ölçümleri doğrulandı).

## 152. Geliştirici Paneli Toast'ı Sürüm Etiketinin Üzerine Biniyordu (Madde 151'in Bulgusu)

**Kullanıcı bildirimi:** Web'de 5. dokunuşta çıkan "🛠️ ... 2 dokunuş kaldı" toast'ı, tam sürüm numarasının (dokunma hedefi) üzerine biniyor — kullanıcı 6./7. dokunuşu yapamıyor, paneli hiç açamıyor. Mobilde test edilmedi ama aynı bileşen olduğu için aynı riski taşıyor.

**Kök neden:** `components/Snackbar.tsx` HER ZAMAN `position:'absolute', bottom:24` ile ekranın en altında beliriyordu. `account.tsx`'teki sürüm etiketi de (`versionRow`) ScrollView içeriğinin en altında — tam o bölgede oturuyor. Toast görünür olduğu 2,5 saniye boyunca dokunma hedefini tamamen kaplıyordu.

**Çözüm:** `Snackbar`'a opsiyonel `position?: 'top' | 'bottom'` eklendi (varsayılan `'bottom'` — projedeki DİĞER tüm çağıranların görünümü DEĞİŞMEDİ). `account.tsx`'teki geliştirici modu toast'ı `position="top"` ile açılıyor; animasyon yönü de (`translateY` başlangıç/bitiş işareti) konuma göre ters çevrildi ki 'top'ta doğal biçimde yukarıdan aşağı kayarak belirsin.

**Doğrulama:** `tsc --noEmit` temiz. Web'de canlı test: 5 dokunuştan sonra toast kutusunun (`getBoundingClientRect`) sürüm etiketinin dikey aralığıyla **çakışmadığı** ölçülerek doğrulandı (`overlapsVersion: false`); ardından TAM 7 dokunuşluk tek bir senkron tıklama dizisi `/dev-panel`e sorunsuz yönlendirdi (ara ölçüm çağrıları YÜZÜNDEN 1500ms'lik dokunma penceresinin aşıldığı, dolayısıyla sayacın sıfırlandığı BİR test denemesi — gerçek bir regresyon DEĞİL, kendi test metodolojimin bir artefaktıydı — ayrıştırılıp doğrulandı).

## 153. Geliştirici Paneli İkinci Tur: Kompakt Üstbilgi Aksiyonları + Seçimli Rapor Gönderimi + 3 Renkli Ciddiyet Bandı

**Kullanıcı isteği:** Madde 151'de kurulan panel için dört iyileştirme: (1) alttaki "Raporu Kopyala"/"Raporu Geliştiriciye Gönder" butonları "fazla sırıtıyor", daha az yer kaplayan modern bir tasarıma taşınsın; (2) "Gönder"e basınca NELERİN gönderileceğini (Hata Raporu / Performans) seçtiren bir ekran çıksın — ikisi de işaretliyse ikisi de gitsin, hiçbiri işaretli değilse "en az birini işaretle" uyarısı çıksın; (3) 250 karakter sınırlı, isteğe bağlı bir not alanı eklensin; (4) performans satırlarındaki yeşil/turuncu ikilisine, CİDDİ performans sorunları için üçüncü bir kırmızı renk eklensin; genel olarak paneli "profesyonel seviyeye" çıkar, gereksiz kod bırakma.

### (1) Alt footer kaldırıldı — üstbilgi ikonları + yüzen tek CTA
Eski tasarım: ekranın en altında, tam genişlikte, metinli iki buton + bir ipucu satırı (`SendReportButton.tsx`, artık SİLİNDİ) — dikeyde ciddi yer kaplıyordu ve listenin altında "yabancı" duruyordu. Yeni tasarım: `components/settings/SettingsHeader.tsx`'e additive bir `rightSlot?: React.ReactNode` prop'u eklendi (varsayılan `undefined` — mevcut 3 çağıranın (account.tsx, notifications.tsx, EditProfileMobile.tsx) hiçbiri bunu geçmiyor, görünümleri BİREBİR aynı kaldı; `title` stiline eklenen `flex:1` de aynı gerekçeyle zararsız). Geliştirici Paneli bu slot'a iki küçük ikon buton koyuyor: **Yenile** (`RefreshCw` — masaüstü web'de dokunmatik "aşağı çek" jesti olmadığından pull-to-refresh'in fonksiyonel bir alternatifi, salt kozmetik değil) ve **Kopyala** (`Copy`). "Rapor Gönder" ise ekranın sağ altında sabit duran, hiçbir düzen alanı KAPLAMAYAN yüzen bir buton (FAB, `Send` ikonu, mavi) — listelerin `paddingBottom`'u (`listActionStyles.ts`) FAB'ın son satırı örtmemesi için 20'den 90'a çıkarıldı.

### (2)+(3) Seçimli gönderim + not alanı — yeni `SendReportModal.tsx`
`ReportIssueModal.tsx`nin görsel dilinin (sheet/backdrop/switch kartı/karakter sayacı) BİREBİR devamı olarak `components/devPanel/SendReportModal.tsx` yazıldı (stiller ayrı `sendReportModalStyles.ts`e alındı — bileşen dosyası 400 satırı geçiyordu). İki `Switch` satırı ("Hata Günlüğü — N kayıt", "Performans Verileri — N ölçüm"), varsayılan olarak İKİSİ DE AÇIK (önceki davranışla aynı: "her şeyi gönder" en yaygın senaryo, kullanıcı istediğini kapatarak daraltır). İkisi de kapatılırsa turuncu bir uyarı satırı ("Göndermek için en az birini seç.") belirir VE gönder butonu `disabled` olur — sunucuya boş bir rapor GİTMEZ. 250 karakterlik not alanı (`DEV_REPORT_NOTE_MAX_LENGTH`, `useSendDevReport.ts`te export edilen tek sabit — UI ve hook AYNI sınırı kullanır) doluysa gönderilen mesajın gövdesi olur, boşsa eski sabit metne düşer.

`hooks/useSendDevReport.ts` baştan yazıldı: `handleSend(perfEntries, errorEntries)` yerine artık tek bir `handleSend(options: SendDevReportOptions)` alıyor (`includeErrors`, `includePerf`, `note`, `perfEntries`, `errorEntries`). `includePerf: false` ise `performanceReport: null` gider — bu, "İstek/Öneri" akışındaki `includeLogs` kapalıyken aynı alanın `null` gitmesiyle (bkz. `011_error_logs_performance_report.sql` yorumu) BİREBİR AYNI sözleşme, yeni bir kural icat edilmedi. `includeErrors: false` ise `errorLogs: []` gider. Savunma amaçlı: hook, ikisi de false'sa `'nothing_selected'` ile REDDEDER (UI zaten butonu disabled ettiği için normal akışta hiç tetiklenmez, ama hook kendi başına da güvenli).

### (4) Üçüncü renk — kırmızı "Kritik" bandı
`utils/perfLog.ts`e `CRITICAL_THRESHOLD_MS = 2000` eklendi (`SLOW_THRESHOLD_MS = 500` yanına). `PerfEntryRow.tsx`teki `severityColor()` artık AYRIK üç bant döndürüyor: yeşil (≤500ms) / turuncu (500ms, 2000ms] / kırmızı (>2000ms) — nokta VE süre metni AYNI fonksiyondan renk aldığı için ikisinin farklı renk göstermesi YAPISAL OLARAK imkânsız (eskiden iki ayrı yerde hesaplanıyordu). `hooks/useDeveloperPanel.ts`teki `DevPanelStats.slowCount` (>500ms, kritik dahil, ÖRTÜŞEN) yerine ayrık `moderateCount` (500ms-2sn) ve `criticalCount` (>2sn) geldi — üstteki kart sayısı 4'ten 5'e çıktı (Ölçüm/Orta/Kritik/Hata/Uyarı); `statsRow` `flexWrap:'wrap'`e çevrildi (5 kart tek satırda mobilde sıkışırdı, artık 3+2 iki satır).

### Temizlik
`components/devPanel/SendReportButton.tsx` SİLİNDİ (yerini header ikonları + FAB + modal aldı). `hooks/useSendDevReport.ts`nin eski `(perfEntries, errorEntries)` imzası tamamen kaldırıldı, geriye dönük bir sarmalayıcı BIRAKILMADI (tek çağıran zaten `SendReportModal` — ölü bir uyumluluk katmanına gerek yoktu). Locale'lerden artık gösterilmeyen `devPanelSendReportHint`/`devPanelStatSlow` kaldırıldı; yerine `devPanelSendModalTitle/Subtitle`, `devPanelIncludeErrors(Hint)`, `devPanelIncludePerf(Hint)`, `devPanelSelectAtLeastOne`, `devPanelNotePlaceholder`, `devPanelRefreshAction`, `devPanelStatModerate`, `devPanelStatCritical` eklendi (tr+en).

### Doğrulama
`tsc --noEmit` temiz. Web'de canlı test: 5 istatistik kartı doğru sayıldı; üstbilgi ikonlarının (`accessibilityLabel="Yenile"`/`"Raporu Kopyala"`) ikisi de doğru tetiklendi (Kopyala → "Rapor panoya kopyalandı." toast'ı, modal AÇIKKEN bile); FAB modalı açtı; iki `Switch`i de kapatınca uyarı satırı belirdi VE gönder butonunun `aria-disabled="true"` olduğu DOM'dan doğrulandı; birini geri açınca uyarı kayboldu; not alanına 29 karakter yazılınca sayaç "29 / 250" gösterdi; backdrop'a tıklayınca modal kapandı. Konsolda yalnızca ortama özgü, önceden var olan Trakt CORS hataları görüldü.

**Doğrulanamayan:** Gerçek bir gönderimin (hem "en az biri seçili" hem soğuma penceresi dolu durumda) Worker'a ulaşıp Discord/Supabase'e yazması — yerel ortamda gerçek bir Worker'a bağlı değildi, kod yolu `useReportIssue.ts` ile aynı `sendFeedback` çağrısını kullandığından yüksek güvenle çalışması beklenir.

## 154. Geliştirici Paneli Üçüncü Tur: Kullanıcının Kendi Planı — Süre Çubuğu, Durum Kodu Rozeti, Tekil Kopyalama, Arama, Canlı İzleme, Işımalı Kartlar

**Bağlam:** Bu turdan hemen önce kullanıcı (başka bir araçla/oturumda) `dev-panel.tsx`'e DOĞRUDAN müdahale etmişti: eski yüzen "Gönder" butonu (FAB) kaldırılmış, yerine başlıkta `Bug` ikonlu kırmızı bir "Teşhis Raporu Gönder" aksiyon çubuğu VE mobilde ekranın altında sabit duran ikinci bir kopyası eklenmişti — bu değişiklik BİLİNÇLİ kabul edilip DOKUNULMADI, üzerine inşa edildi. Kullanıcı ayrıca kendi yazdığı 5 maddelik bir geliştirme planını "hata var mı kontrol et, sonra uygula" isteğiyle paylaştı.

### Plan incelemesinde bulunan gerçek sorunlar
1. **"HTTP Status Code Badges" maddesinin veri kaynağı YOKTU.** `PerfMark` tipi yalnızca `{timestamp, name, category, durationMs}` tutuyordu — hiçbir yerde HTTP durum kodu kaydedilmiyordu. Plan bu boşluğu atlamıştı. Çözüm: `PerfMark`e opsiyonel `statusCode?: number` eklendi, `traktClient.ts`'teki interceptor'ların `recordPerfMark` çağrıldığı İKİ noktada (başarı: `response.status`, hata-ama-yanıtlı: `error.response.status`) zaten elde olan durum kodu iletildi — yeni bir istek/ölçüm türü İCAT EDİLMEDİ, var olan ölçüm noktasına tek parametre eklendi.
2. **Süre çubuğunun (duration bar) ölçek tavanı tanımsızdı.** "Süreye ORANLA dinamik genişlesin" deniyordu ama neye oranla belirtilmemişti. Listenin o anki en yavaş kaydına oranlamak YERİNE (bu, liste her değiştiğinde çubukların anlamını kaydırır ve tek bir 30sn'lik uç değer diğer TÜM çubukları görünmez kılardı) sabit bir tavan seçildi: `BAR_MAX_MS = 3000` (kritik eşiğin — 2000ms — hemen ötesi, bir nefes payı bırakır; `utils/perfLog.ts`'te TEK kaynak).

### Yapılanlar
- **`utils/perfLog.ts`**: `statusCode?: number` alanı, `BAR_MAX_MS` sabiti, `recordPerfMark`e 4. opsiyonel parametre.
- **`services/api/traktClient.ts`**: iki `recordPerfMark` çağrısına da durum kodu eklendi.
- **YENİ `components/devPanel/DurationBar.tsx`**: ince, orantılı, renk-eşleşen (severity ile AYNI fonksiyondan gelen renk) çubuk.
- **YENİ `components/devPanel/StatusBadge.tsx`**: 2xx yeşil/3xx mavi/4xx turuncu/5xx kırmızı, yalnızca `network` + `statusCode` doluyken render edilir (`startup` ölçümleri bir HTTP isteği olmadığından hiç göstermez).
- **YENİ `components/devPanel/RowCopyButton.tsx`**: kullanıcının ek isteği — her satırda tek kaydı JSON olarak panoya kopyalayan mikro-buton. Her tıklamada AYRI bir Snackbar/toast GÖSTERMEZ (art arda birkaç satır kopyalanırsa toast yağmuru olurdu) — ikon 1200ms'liğine ✓'a döner, kendi kendine sıfırlanır. `PerfEntryRow.tsx` VE `ErrorEntryRow.tsx`de kullanılıyor (aynı bileşen, iki yerde tekrar YOK).
- **`PerfEntryRow.tsx` yeniden düzenlendi**: satır artık üç satır — [nokta+isim+süre+kopyala] / [kategori+durum rozeti+saat] / [süre çubuğu].
- **YENİ `components/devPanel/SearchBar.tsx`**: Performans ve Hata Günlüğü sekmelerinin PAYLAŞTIĞI arama kutusu; arama DURUMU her sekmenin kendisinde tutulur (prop drilling yok). Türkçe "İ/i" ayrımı için `hooks/libraryFilterCore.ts`'teki MEVCUT `normalizeForSearch`'ü kullanır — yeni bir normalizasyon fonksiyonu İCAT EDİLMEDİ. Performans sekmesinde arama, mevcut kategori filtresiyle BİRLİKTE (AND) çalışır.
- **YENİ `components/devPanel/LiveModeToggle.tsx`** + `usePerfLog.ts`/`useErrorLog.ts`/`useDeveloperPanel.ts`'e `silentRefresh`: Canlı İzleme açıkken `dev-panel.tsx`'teki tek bir `setInterval` (4sn) `silentRefresh`'i çağırır — `refresh` DEĞİL, çünkü o `isRefreshing`i tetikleyip RefreshControl döngüsünü her 4 saniyede bir görünür biçimde "titretirdi" (kullanıcı hiçbir şey çekmediği hâlde). Zamanlayıcı anahtar kapanınca veya ekran unmount olunca temizlenir.
- **`StatCard.tsx`**: değer >0 iken accentColor'a göre kenarlık+gölge "ışıması". Android'de renkli `shadowColor` DESTEKLENMEDİĞİNDEN (yalnızca gri `elevation` verir) ışıma web/iOS'ta gerçek, Android'de yalnızca renkli kenarlık vurgusuna düşer — sahte bir efekt eklenmedi, platform sınırı açıkça yorumlandı.
- **Gerçek bir çeviri hatası bulunup düzeltildi**: `devPanelSendReport` anahtarı zaten locale JSON'da MEVCUTTU (eski değer: "Raporu Geliştiriciye Gönder"); kullanıcının header/mobil-bar kodundaki `t(key, 'farklı varsayılan metin')` çağrıları i18next'in "anahtar varsa JSON değerini kullan, fallback'i YOKSAY" kuralı yüzünden HİÇBİR ZAMAN görünmüyordu — üçü de aynı eski metni gösteriyordu. `devPanelSendReport`'un JSON değeri "Teşhis Raporu Gönder"e güncellendi, mobil çubuk için AYRI bir `devPanelSendReportMobile` anahtarı eklendi.

### Doğrulama
`tsc --noEmit` temiz. Web'de canlı test: arama kutusuna "oturum" yazınca liste doğru süzüldü (yalnızca "Oturum Başlatma" kayıtları kaldı), temizleyince geri geldi; Canlı İzleme anahtarı açılıp kapatıldı, hiçbir konsol hatası/çökme olmadı, arka planda gerçek bir yeniden yükleme (Metro reload) sonrası yeni kayıtlar RefreshControl döngüsü GÖRÜNMEDEN listeye yansıdı; satır kopyalama butonu tıklanıp 400ms sonra ikonun `#64748b`'den `#4ade80`'e (Copy→Check) döndüğü DOM'dan doğrulandı (ilk birkaç deneme, ayrı round-trip'lerin `Clipboard.setStringAsync`in async doğasıyla çakışıp yanlış negatif vermesi yüzünden yanıltıcıydı — tek bir senkron script içinde gerçek bir gecikmeyle tekrarlanınca doğrulandı).

**Doğrulanamayan:** Durum kodu rozetinin VE süre çubuğunun gerçek Trakt ağ trafiğiyle görünümü — yerel web ortamında CORS engeli yüzünden hiçbir gerçek Trakt isteği tamamlanamadı (yalnızca `startup` kategorisi ölçümleri üretildi), bu yüzden yalnızca kod/tip doğruluğu (`tsc`) ile doğrulandı, kullanıcının gerçek bir hesapla (native veya CORS-proxy'li web) denemesi gerekiyor. StatCard'ın web/iOS'taki gerçek renkli ışıması da ekran görüntüsü alınamayan bu ortamda görsel olarak teyit edilemedi.

## 155. Akış Sosyal Katmanı: Kişisel Not/Alıntı, Yorum, Beğeni, Kullanıcı Engelleme

**Bağlam:** `docs/FEED_SOCIAL_PLAN.md`'de onaylanan planın tam uygulaması — üç oturumluk bir tasarım sürecinin (maraton sistemi denetimi → sosyal mimari tartışması → plan onayı) sonucu. Kullanıcının açık talimatı: "Kaydettikten sonra başla", "hızlı, stabil, kullanıcı dostu olsun."

**Veritabanı (`supabase/schema/015_feed_social.sql` + `016_user_blocks.sql`):** Önceki oturumda yazılmıştı (bkz. plan dokümanı) — `feed_activities`'e `note`/`note_spoiler`/`like_count`/`comment_count`; dormant `comments` tablosuna (001'den beri hiç kullanılmamış) `spoiler`/`like_count`; yeni `feed_activity_likes`/`feed_comment_likes` (iki sade tablo, polymorphic değil); sayaçlar için `security definer` trigger'lar (014'teki `pg_cron` deseninin devamı); yeni `user_blocks` tablosu. Bu oturumda bu şemanın ÜZERİNE Worker + client + UI inşa edildi.

**Worker (`kaymaktv-feedback-worker/src/index.js`):** 6 yeni uç nokta — `/feed/note` (yalnızca kendi aktivitene, sahiplik `fetchRowOwner` ile doğrulanır), `/feed/comment` (yalnızca notlu/puanlı aktivitelere — çıplak "izledi" logları kasıtlı olarak yorumlanamaz, spam yüzeyini daraltmak için), `/feed/comment/delete` (sahiplik WHERE koşulunda, `handleFeedDelete` ile aynı IDOR deseni), `/feed/like` (aktivite VEYA yorum, toggle, tam/partial-olmayan UNIQUE kısıt sayesinde `on_conflict` güvenle kullanılabiliyor — Madde 89'daki partial-index sorunu burada YOK), `/feed/block`, `/feed/unblock`. Ortak güvenlik katmanı: `isBlockedEitherWay()` — yorum/beğeni yazmadan önce işlemi yapanla hedef sahibi arasında blok var mı kontrol edilir, varsa jenerik bir hata döner (blok varlığı açıkça doğrulanmaz). 29 mevcut worker testi (`vitest run`) hiç bozulmadan geçti.

**Client servisleri:** `features/feed/services/feedSocial.ts` (not/yorum/beğeni CRUD + "ben beğendim mi" kümeleri — Supabase Auth olmadığı için `auth.uid()` yok, bu kümeler ayrı, dar kapsamlı sorgularla çekiliyor), `features/feed/services/userBlocks.ts` (`getMySupabaseUserId`, `getBlockedUserIds` — engelleyen VEYA engellenen birleşimi, `getMyBlockedUsers`, `blockUser`/`unblockUser`). `feedApi.ts`'teki `getVisibleUserIds` artık blok kümesini çıkarıyor — akış, yorumlar ve Realtime AYNI kümeyi paylaşıyor, tutarsızlık riski yok.

**Realtime (`useFeedRealtime.ts`):** `feed_activities` üzerinde artık INSERT'e ek olarak UPDATE de dinleniyor (beğeni/yorum sayacı değiştiğinde canlı güncellenir) — `feedStore.ts`'e yeni `patchActivity()` metodu eklendi (tam bir `FeedActivity` gerektirmeyen kısmi güncelleme, `user` join'i olmadan da çalışır çünkü REPLICA IDENTITY FULL sayesinde `payload.new` tam satırı taşıyor).

**UI:**
- `FeedCard.tsx`: kart altına ❤️/💬 satırı (iyimser toggle, `isPending` kartlarda gizli), kendi aktivitende kalem ikonuyla not ekleme/düzenleme (`NoteEditorModal.tsx`), notlu kartlarda alıntı görünümü (`FeedActivityNote.tsx`, spoiler blur + dokununca aç).
- `FeedCommentSheet.tsx` + `FeedCommentItem.tsx` + `useFeedComments.ts`: Trakt'ın kendi yorum sistemiyle (`components/CommentSheet.tsx`) KARIŞTIRILMAYACAK şekilde ayrı isimlendirildi ve konumlandırıldı — 500 karakter sınırı (DB/Worker/UI üç katmanlı), spoiler switch'i, kendi yorumunu silme, yorum beğenme.
- Engelleme: `BlockUserButton.tsx` (tek eylem olduğu için "..." menüsü yerine doğrudan ikon), `BlockedProfileLock.tsx`, `useBlockState.ts` — hem `screens/PublicProfileMobile.tsx` (native + dar web) HEM `app/(protected)/user/[slug].web.tsx` (masaüstü) ayrı ayrı entegre edildi ki iki ekran da aynı davranışı göstersin. Yeni `app/(protected)/blocked-users.tsx` ekranı + Ayarlar → "💬 Akış" bölümüne satır.
- Trakt takip/KaymakTV engel çakışması KESİN karar: engel her zaman üstün, Trakt'a hiç dokunulmuyor (Worker `resolveUserIdBySlug` + `user_blocks`, Trakt API'sine hiçbir yazma isteği gitmiyor).

**i18n:** Tüm yeni metinler `t('feed:key', 'varsayılan')` deseniyle, `locales/{tr,en}/feed.json` + `settings.json`'a (yalnızca `blockedUsers` anahtarı) toplu eklendi.

**Doğrulama:** `tsc --noEmit` her aşamada temiz. Worker `vitest run` 29/29 geçti, `node --check` sözdizimi doğrulandı. Web preview'da guest modda Akış (yeni yenile butonu + boş durum), `/blocked-users` (boş liste durumu, ağ hatası zinciri sessizce yutulup zarif boş ekrana düşüyor) ve Ayarlar ekranları hatasız yüklendi, konsolda yalnızca beklenen (sandboxed ortamda Trakt API'sine ağ erişimi olmaması nedenli) CORS hataları vardı. **Doğrulanamayan:** gerçek bir hesapla uçtan uca akış — not ekleme, yorum yazma, beğenme, engelleme, canlı (Realtime) sayaç güncellemesi — bu ortamda Trakt'a ağ erişimi yok. Migration'lar (`015`/`016`) da bu ortamda gerçek bir Postgres'e karşı çalıştırılıp doğrulanamadı, yalnızca satır satır gözden geçirildi.

## 156. Maraton Tekilleştirme (Set) + "Alıntı Yap" Twitter-Tarzı Yeniden Tasarım + v2.0.3

**Bağlam:** Kullanıcı gerçek bir kullanım ekran görüntüsü paylaştı: "Silo S03E01 - S03E01 arası izlendi ×2" — yani TEK bir bölüm iki kez sayılıp "Hız Turu" rozetini tetiklemişti. Aralığın aynı bölümle başlayıp bitmesi (`S03E01 - S03E01`) kanıttı: gruplama ham satır sayısına bakıyordu, farklı bölüm sayısına değil. Kullanıcı ayrıca `Notu Düzenle` UI'ının "sönük" kaldığını belirtip Twitter'ın "Alıntı Yap" (Quote) modeline yakın bir tasarım istedi.

**Faz 1 — Maraton düzeltmesi (`features/feed/utils/groupMarathonActivities.ts`):** Aynı bölüm kodundan (`S03E01` gibi) birden fazla ham `feed_activities` satırı olabilir (çift tıklama, tekrar izleme) — kök neden ne olursa olsun, sayaç artık HER ZAMAN `dedupeByEpisodeCode()` ile tekilleştirilmiş bölüm kümesine göre hesaplanıyor, ham dizi uzunluğuna göre DEĞİL. Yan etki (bilinçli, olumlu): eşiğin altında kalan gruplarda bile aynı bölümün yinelenen kayıtları artık TEK karta iniyor — akışta aynı "X izledi" iki kez görünmüyor. `originalActivityIds` yine TÜM ham satırları (yinelenenler dahil) taşıyor ki silme hepsini kapsasın. `MARATHON_MIN_COUNT` 2'den **3**'e çıkarıldı (kullanıcı: "2 bölüm izlemek pek maraton sayılmaz"), `marathonMessages.ts`'teki seviyeler orantılı kaydırıldı: **Hız Turu 3-4, Maratoncu 5-7, Sezon Fatihi 8+** (eskiden 2-3/4-6/7+).

**Faz 2 — "Alıntı Yap" yeniden tasarımı:** Kullanıcının UX gerekçesi: ❤️/💬 BAŞKALARININ senin gönderine yaptığı eylemler, alıntı ise SANA ait bir eylem — bu yüzden alt sıradaki küçük ikonlardan koparılıp içeriğin hemen altına, belirgin bir CTA olarak taşındı.
- `FeedCard.tsx`: alt sosyal satırdaki pencil+"Not Ekle/Notu Düzenle" girişi tamamen kaldırıldı. Alıntı yoksa: vurgu renkli çerçeveli/arkaplanlı "🔖 Alıntı Yap" pili (`Quote` ikonu). Alıntı varsa: ayrı bir "Düzenle" butonu YOK — `FeedActivityNote` bloğunun kendisi (yalnızca kendi aktivitende) tıklanınca düzenleme modalını açıyor, küçük bir kalem ikonuyla düzenlenebilir olduğu ima ediliyor.
- `FeedActivityNote.tsx`: yeni `editable`/`onPressEdit` prop'ları. Spoiler'lı bir alıntıda İLK dokunuş HER ZAMAN spoiler'ı açar (sahibi bile olsa) — yanlışlıkla düzenleme moduna girilmesin diye ayrı bir adım.
- `NoteEditorModal.tsx`: başlık artık duruma göre değişiyor — not yoksa "Alıntı Yap", varsa "Alıntıyı Düzenle" (`initialNote` doluluğuna göre).
- Kullanılmayan `addNote`/`editNote` i18n anahtarları kaldırıldı, yerine `quoteAction` + `noteEditorTitleEdit` eklendi (`locales/{tr,en}/feed.json`).

**Faz 3 — Kullanıcının "gizli spam" uyarısı doğrulandı (tarih sabitliği):** Kullanıcı haklı bir endişe dile getirdi: "1 ay önce izlenen bir diziye bugün alıntı eklenirse kart akışın tepesine fırlar mı?" Kod zaten DOĞRU yazılmıştı — hem Worker'ın `handleFeedNote`'u (`supabasePatch`'e yalnızca `note`/`note_spoiler` gönderiliyor, `activity_at` hiç yok) hem client'ın `patchActivity` çağrısı (yalnızca `note`/`noteSpoiler` alanlarını günceller) `activity_at`'a hiç dokunmuyordu — ama bu invaryant hiçbir yerde AÇIKÇA yazılı değildi, ileride biri "düzenlenme tarihini de göstersek" diye `activity_at`'ı ekleyebilirdi. İki yere de (Worker + FeedCard.tsx) açık uyarı yorumu eklendi. **Tek-kart kuralı da doğrulandı:** not ekleme/güncelleme hiçbir yolda yeni bir `feed_activities` satırı INSERT etmiyor — Worker `PATCH` (aynı id), client `patchActivity` (aynı id'yi bulup günceller, bulamazsa no-op) — yeni kart oluşma ihtimali yapısal olarak yok.

**Bilinçli KAPSAM DIŞI bırakılan bir sınır (kullanıcıya ayrıca bildirilecek):** Bir maraton kartına (`MarathonFeedCard`) gruplanmış bölümlere şu an not eklenemiyor — not/yorum/beğeni UI'ı yalnızca `FeedCard.tsx`'te (tekil, gruplanmamış aktiviteler) var. Bir binge session'ın İÇİNDEKİ belirli bir bölüme alıntı eklemek istenirse ayrı bir tasarım gerekir, şimdilik istenmedi.

**Sürüm:** `app.json` + `package.json` 2.0.2 → **2.0.3**, `account.tsx`'teki fallback güncellendi. `app/(public)/download.web.tsx`'teki `CURRENT_VERSION` BİLİNÇLİ OLARAK dokunulmadı — o, kaynak koddaki sürümü değil GitHub Releases'e gerçekten yüklenmiş APK'nın sürümünü yansıtıyor; yeni bir 2.0.3 APK derlenip yüklenmeden orayı güncellemek indirme sayfasını yanıltırdı.

**Doğrulama:** `tsc --noEmit` her aşamada temiz, Worker `vitest run` 29/29 (regresyon yok), `node --check` temiz. Web preview'da guest modda Akış hatasız yüklendi. **Doğrulanamayan:** gerçek verilerle maraton eşiğinin/tekilleştirmenin canlı davranışı ve "Alıntı Yap" akışının görsel sonucu — bu ortamda Trakt'a ağ erişimi yok, kullanıcının gerçek hesabıyla test etmesi gerekiyor.

**Faz 4 — Kullanıcı gerçek cihazda test etti, görsel hiyerarşi tersineymiş:** Ekran görüntüsü: "Silo S03E01 izledi" (kalın, ana metin gibi) altında küçük italik "Deneme" (kullanıcının kendi yazdığı alıntı) — kullanıcının tespiti doğruydu, alıntı "izledi" satırından daha SİLİK duruyordu, oysa alıntı kartın BİRİNCİL içeriği olmalı (Twitter'ın Alıntı Tweet modeli: senin yazdığın büyük/üstte, alıntıladığın içerik küçük/altta). Düzeltme:
- `FeedActivityNote.tsx`: italik kaldırıldı, punto 13→15, ağırlık normal→600, renk soluk gri (`#cbd5e1`)→parlak (`#f1f5f9`), sol kenarlık rengi gri→mavi (`#3b82f6`) ve kalınlaştı, tırnak işareti büyütülüp mavi vurgu rengine çekildi — artık kartın en göz alıcı metni.
- `FeedCard.tsx`: alıntı VARSA render sırası değişti — önce alıntı (birincil), altında "Silo S03E01 izledi" artık küçük, soluk, hafif arkaplanlı bir "bağlam çipi" (`contextChip`) olarak görünüyor (Twitter'ın gömülü alıntı kutusuna benzer). Alıntı YOKSA eski davranış (tek, birincil "izledi" satırı) korunuyor — regresyon yok.
`tsc --noEmit` temiz, web preview'da bundler hatasız yüklendi.

## 157. Bağımsız Gönderi ("Fikir Paylaş") — Twitter Tarzı "Ne Düşünüyorsun?" Kutusu

**Bağlam:** Kullanıcı akışı "başlı başına bir özellik" olarak genişletmek istedi: izleme/puanlama olayına bağlı olmayan, kullanıcının istediği an bir dizi/film hakkında (ya da hiçbir yapım hakkında olmadan, genel bir soru/tartışma olarak) paylaşabileceği bağımsız gönderiler. Detaylı tasarım tartışması: giriş noktası (FAB yerine sabit "Ne düşünüyorsun?" kutusu — kullanıcının gerekçesi: FAB "teknik bir parça" gibi görünüp görmezden gelinebilir), karakter sınırı (gönderiler 1000, yorumlar 500 kalır), yapım seçimi (tek, OPSİYONEL — "Bilimkurgu önerisi olan var mı?" gibi genel sorular da sorulabilsin), gizlilik (ayrı anahtar YOK, paylaşmak zaten bilinçli bir eylem).

**Mimari karar (yine yeni tablo DEĞİL):** `feed_activities`'e altıncı bir `activity_type`: `'posted'`. `FeedCard.tsx`'teki `ACTIVITY_META` map'i tam bunun için tasarlanmıştı — sayfalama, Realtime, beğeni, yorum, retention hepsi bedavaya çalıştı.

**Veritabanı (`017_feed_posts.sql`):** `activity_type` CHECK'ine `'posted'` eklendi. `show_id`/`show_title`/`media_type` artık NULLABLE — yalnızca 'posted' tipi yapımsız olabilir (defense-in-depth CHECK: `activity_type = 'posted' OR show_id IS NOT NULL`). Yeni CHECK: `'posted'` tipinin `note`u HER ZAMAN dolu olmalı (bu, yorum-yapılabilirlik kuralını da otomatik sağlıyor, ek kod gerekmeden). `note` karakter sınırı 500'den **1000**'e çıkarıldı — TEK, birleşik sınır (tipe göre koşullu DEĞİL): hem kısa alıntılar hem bağımsız gönderiler aynı kolonu paylaşıyor, `comments.body` (yorumlar) AYRI ve hâlâ 500.

**Worker:** Yeni `POST /feed/post` — metin (1-1000 karakter), opsiyonel yapım (ya HİÇBİRİ ya HEPSİ tutarlılığı doğrulanır), `isPrivate` kontrolü (Trakt'ta gizliyse gönderi de paylaşılamaz, sessizce değil AÇIK hatayla — kullanıcının o an bilerek bastığı bir buton). `activity_at` sunucuda üretiliyor (Trakt'la hiç senkron olmadığı için client damgasına güvenmeye gerek yok). `handleFeedDelete`: `'posted'` tipi artık tombstone'lanmıyor (Trakt bağı olmadığı için anlamsız, ayrıca `show_id` NULL olabildiğinden tombstone tablosunun NOT NULL kısıtına da takılırdı) — `/feed/note`'un 500 karakter sınırı da 1000'e güncellendi.

**Tipler:** `FeedActivityType`'a `'posted'`; `showId`/`mediaType`/`showTitle` artık opsiyonel. `groupMarathonActivities.ts`'e `GroupableEpisode` dar tipi + `isGroupableEpisode` type guard eklendi — maraton gruplaması hâlâ yalnızca `watched_episode` işliyor (etkilenmedi), ama TypeScript artık showId'nin o yolda HER ZAMAN dolu olduğunu biliyor, `!` (non-null assertion) serpiştirmeye gerek kalmadı.

**Client:** `feedPublish.ts`'e `publishPost()` — `publishActivities`'ten FARKLI olarak ateşle-ve-unut DEĞİL, sonucu (`{ok:true}` / `{ok:false,message}`) compose modalına döndürür ki kullanıcı hata görsün. `FeedActivityNote.tsx` genelleştirildi: hem alıntılarda hem gönderilerde AYNI bileşen — 220 karakteri aşan metinler 4 satırla kesilip küçük bir "Devamını Gör" linkiyle tam metni gösteren küçük bir modala (`NoteFullTextModal.tsx`, tüm sayfayı KAPLAMAZ) açılıyor. Kesme kararı gerçek satır sayımı DEĞİL karakter eşiği (RN Web'de `onTextLayout` tutarsız).

**UI:**
- `ComposePostBar.tsx` — Akış ekranının en üstünde sabit "Ne düşünüyorsun?" kutusu (yalnızca gerçek kullanıcıya, misafire gösterilmez), dokununca `ComposePostModal.tsx` açılır.
- `ComposePostModal.tsx` — 1000 karakter sayaç, opsiyonel yapım chip'i (seçiliyse poster+başlık+kaldır ikonu), spoiler anahtarı, yayınla.
- `MediaPickerModal.tsx` + `MediaPickerRow.tsx` — var olan `searchTrakt`/`SearchBar`/`SearchTabs` (Keşfet sekmesinde zaten kanıtlı) REUSE edildi; `ShowCard` BİLİNÇLİ OLARAK kullanılmadı (detay sayfasına yönlendirir + kütüphane butonları taşır, "seç" davranışına uymuyor) — amaca özel, küçük bir satır bileşeni yazıldı.
- `FeedCard.tsx`: `posted` tipi için context chip ve sağdaki poster yalnızca yapım SEÇİLMİŞSE render ediliyor (`hasShow` kontrolü) — yapımsız bir gönderide boş gri kutu göstermek yerine metin tüm genişliği kullanıyor.
- Diğer 3 gösterim noktası (`ProfileActivityTab.tsx`, `PublicProfileMobile.tsx`, `[slug].web.tsx`) hiç DEĞİŞMEDİ — zaten marathon-olmayan her şeyi `<FeedCard/>`'a veriyorlardı, 'posted' tipi bu sayede otomatik doğru render ediliyor.

**Doğrulama:** `tsc --noEmit` her adımda temiz, Worker `vitest run` 29/29 (regresyon yok), `node --check` temiz. Web preview'da guest modda Akış ekranı (ComposePostBar doğru şekilde gizli) hatasız yüklendi, bundler hatası yok. **Doğrulanamayan:** gerçek bir hesapla uçtan uca gönderi akışı — yazma, yapım seçme/seçmeme, yayınlama, akışta görünme, "Devamını Gör" — bu ortamda Trakt'a ağ erişimi yok, migration (`017`) da gerçek bir Postgres'e karşı çalıştırılıp doğrulanamadı.

## 158. "Alıntı Yap" Sosyal Satıra Taşındı — 3 Turlu İterasyon

**Bağlam:** Kullanıcı Madde 156'da tasarlanan vurgu renkli/çerçeveli "🔖 Alıntı Yap" pilini "çok saçma" buldu, beğeni/yorum ikonlarıyla aynı satırda aynı görsel dilde olmasını istedi. Üç tur geri bildirimle son hâline ulaştı:

1. **1. tur:** `Quote` ikonu `socialRow`'a taşındı, `socialBtn` stiliyle (çerçevesiz/arkaplansız, `#64748b` gri) — ama metin etiketi yok, kullanıcı "kimse alıntı olduğunu anlamaz, akademik kalmış" dedi.
2. **2. tur:** `MessageSquareQuote` ikonu + mor (`#c084fc`) vurgu rengi + "Alıntı" metin etiketi eklendi — kullanıcı hem yazıyı hem moru beğenmedi.
3. **3. tur (son hâl):** Metin etiketi tamamen kaldırıldı, ikon `Repeat`e (lucide — Spotify/YouTube'daki yuvarlak köşeli "tekrarla" ikonuna yakın, Twitter'ın "retweet"ine benzer ama kare değil) çevrildi, renk beğeni/yorumla **birebir aynı** `#64748b`. Buton artık yalnızca kendi aktivitende ve henüz alıntın yokken `socialRow` içinde, diğer ikonlarla görsel olarak ayırt edilemez duruyor.

**Temizlik:** Her turda bir önceki turun kalıntıları (stil, import, i18n anahtarı) aynı düzenlemede silindi — `quoteCta`/`quoteCtaText`/`quoteLabel` stilleri, `Quote`/`MessageSquareQuote` importları, `quoteAction` çeviri anahtarı (`locales/{tr,en}/feed.json`) son hâlde HİÇBİRİ kalmadı çünkü nihai tasarımda metin/vurgu renk hiç yok. `useTranslation`/`t` de `FeedCard.tsx`'te başka hiçbir yerde kullanılmadığından kaldırıldı.

**Doğrulama:** Her turda `tsc --noEmit` temiz, web bundle (3400+ modül) hatasız derlendi. Görsel sonuç bu ortamda doğrulanamadı (gerçek bir aktivite kartı için Trakt girişi gerekiyor, guest modda akış boş) — kullanıcının gerçek hesabıyla kontrol etmesi gerekiyor.

## 159. Akış ↔ Profil Aktiviteleri Denetimi: Sessiz Hata Yutma + Eksik Önbellek Geçersiz Kılma Düzeltildi

**Kullanıcı isteği:** "Akışı uzun zamandır güncelliyorum (farklı oturumlarda da) ama profilimdeki aktiviteleri aksattım. İkisini denetle, uyumlu hale getir, gereksiz kod varsa sil, Akış ile profildeki aktiviteler senkron olsun."

### Denetim yöntemi
Feed'in veri/UI katmanı (`useFeed.ts`, `feed.tsx`, `feedStore.ts`, `useFeedRealtime.ts`) ile Profil'in aktivite katmanı (`useUserActivity.ts` → paylaşılan `useActivityFeed.ts`, `ProfileActivityTab.tsx`) satır satır karşılaştırıldı; `docs/HISTORY.md`'deki Madde 142/145/148/155/156/157 (Feed'in son büyük değişiklikleri) tek tek okunup HANGİLERİNİN kasıtlı olarak yalnızca Feed'e mi (`activity_type` filtresi gerektirmeyenler zaten `<FeedCard/>` üzerinden otomatik paylaşılıyor), hangilerinin gerçekten Profil'de EKSİK kaldığı ayrıştırıldı. `npx tsc --noEmit --noUnusedLocals --noUnusedParameters -p .` ile proje genelinde gerçek ölü kod taraması yapıldı.

### Kasıtlı farklar — DOKUNULMADI (gerçek bir "aksama" değil)
- **Sonsuz kaydırma + Realtime yalnızca Feed'de** (Madde 148): Profil bilinçli olarak tarih penceresiz/sabit-20-kayıt çalışıyor — Madde 148'in kendi metninde gerekçesi açık ("zaman bazlı silme herkesin profil geçmişini yok ederdi"). Bu bir eksiklik değil, tasarım kararı.
- **Not/Alıntı/Yorum/Beğeni/"Fikir Paylaş" (Madde 155-157):** Hepsi `FeedCard.tsx`/`MarathonFeedCard.tsx` üzerinden paylaşılıyor, Profil hiç değişmeden otomatik destekliyor (Madde 157'nin kendi notu bunu doğruluyor). Bu oturumun başında `FeedCard.tsx`'te yapılan "Alıntı Yap" buton redesign'ı (Madde 158) da bu sayede Profil'e otomatik yansıdı.
- Ayrı bir `.claude/worktrees/intelligent-mclaren-7b32d5` klasörü bulundu ama `git merge-base` ile `main`'in zaten bir ATASI olduğu (main..HEAD boş) doğrulandı — kayıp/unmerged bir iş DEĞİL, dokunulmadı.

### Gerçek bulgular — düzeltildi
1. **Sessiz hata yutma (`docs/AI_RULES.md` § "Sessiz başarısızlık YASAKTIR" ihlali).** `useUserActivity.ts` zaten paylaşılan `useActivityFeed`'den `hasError`/`refresh` döndürüyordu ama `ProfileActivityTab.tsx` bunları HİÇ tüketmiyordu — gerçek bir ağ/Supabase hatasında bile ekranda sessizce "Henüz aktivite yok" yazıyordu (Feed tarafı bu TAM SORUNU Madde 142'de zaten çözmüştü, Profil'e hiç taşınmamıştı). Düzeltme: Feed'in `showError = hasError && data.length === 0` deseni birebir kopyalandı — `WifiOff` ikonu + "Aktiviteler Yüklenemedi" + `common:retry` butonu (`refresh()` çağırır). Yeni `profileActivityErrorTitle`/`profileActivityErrorText` anahtarları `locales/{tr,en}/media.json`'a eklendi (var olan `profileActivityEmpty*` adlandırma deseniyle birebir), buton metni için yeni anahtar İCAT EDİLMEDİ — zaten var olan `common:retry` reuse edildi.
2. **Geri alma (un-watch/un-rate) Profil önbelleğini geçersiz kılmıyordu.** `feedPublish.ts`'teki `retractLocalActivity` (bölüm/puan geri alındığında `progress.ts`/`ratings.ts`'ten çağrılır) yalnızca `invalidateFeedCache()` çağırıyordu — Akış canlı `feedStore`'dan okuduğu için zaten anında düşüyordu, ama Profil AYRI bir fetch+kısa-ömürlü-önbellek (`userFeedActivitiesCache`, bkz. `fetchUserFeedActivities`) kullandığından geri alınan aktivite TTL (60sn) dolana kadar orada görünmeye devam edebilirdi. `publishActivities`/`publishPost` zaten HER İKİ önbelleği de geçersiz kılıyordu (`invalidateFeedCache` + `invalidateUserFeedActivitiesCache`) — `retractLocalActivity`'ye eksik olan tek satır eklendi (modül içi `cachedMe` üzerinden, yalnızca kendi aktivitelerim için çağrıldığından güvenli — çağıranlar hep kendi izleme/puanlama mutasyonları).

### Gerçek ölü kod — BULUNAMADI
`tsc --noUnusedLocals --noUnusedParameters` taraması Feed/Profil katmanında hiçbir kullanılmayan sembol göstermedi (bu oturumun başındaki Madde 158 temizliği zaten kendi kalıntılarını temizlemişti). Taramanın bulduğu 7 kullanılmayan sembol tamamen ilgisiz dosyalardaydı (`blocked-users.tsx`, `ReportIssueModal.tsx`, `useNotifications.ts`, `PublicProfileMobile.tsx`'te tek bir `FeedItem` importu) — bu görevin kapsamı dışında bırakıldı, silinmedi.

### Kapsam dışı bırakılan, aynı desendeki bir üçüncü nokta
`usePublicProfileActivity.ts` (BAŞKASININ profiline bakarken) de `hasError` döndürüyor ama `PublicProfileMobile.tsx`/`[slug].web.tsx` bunu tüketmiyor — Madde 1'deki AYNI hata. Kullanıcı açıkça "Akış" ve "profilimdeki aktiviteler" (kendi profili) dedi, başkasının profili bu isteğin kapsamında değildi; ayrı bir arka plan görevi olarak flag'lendi (spawn_task), bu oturumda DEĞİŞTİRİLMEDİ.

### Değişen dosyalar
`components/profile/ProfileActivityTab.tsx`, `features/feed/services/feedPublish.ts`, `locales/{tr,en}/media.json`.

### Doğrulama
`npx tsc --noEmit` (hem normal hem `--noUnusedLocals --noUnusedParameters`) temiz. Web bundle hatasız derlendi, guest modda konsol hatasız (yalnızca ortama özgü Trakt CORS hataları). **Doğrulanamayan:** Profil ekranı bu sandbox'ta guest kullanıcıya kapalı ("Profilinizi görmek için giriş yapın" duvarı) — yeni hata durumunun (WifiOff + "Tekrar Dene") VE geri alma sonrası Profil'in gerçekten tazelendiğinin görsel/canlı doğrulaması için gerçek bir Trakt hesabıyla cihazda test gerekiyor.

## 160. Madde 159'da Flag'lenen Üçüncü Nokta Kapatıldı: Public Profile'da da Sessiz Hata Yutma

**Bağlam:** Madde 159'da kapsam dışı bırakılıp `spawn_task` ile arka plana flag'lenen bulgu ("başkasının profiline bakarken de AYNI sessiz hata yutma var") kullanıcı tarafından bu turda işleme alındı — Madde 159'un kendi metnindeki teşhis ve önerilen çözüm birebir uygulandı.

**Kapsam:** `usePublicProfileActivity.ts` zaten paylaşılan `useActivityFeed`'den `hasError` döndürüyordu ama hiç `refresh` döndürmüyordu (yalnızca `useUserActivity.ts` döndürüyordu) VE iki tüketici ekran da `hasError`'ı hiç almıyordu:
- `usePublicProfileActivity.ts`: dönüş değerine `refresh` eklendi (tek satır, `useActivityFeed`'den doğrudan geçiliyor).
- `screens/PublicProfileMobile.tsx` (+ native `[slug].tsx` — doğrudan bunu render ediyor, ayrı değişiklik gerekmedi): `FlatList`'in `ListEmptyComponent`'ine `activeTab === 'activity' && isActivityError` dalı eklendi (yükleniyor/hata/boş üç-yollu ayrım) — `WifiOff` ikonu + yeni `publicProfileActivityErrorTitle/Text` + `common:retry` butonu (`refreshActivity()` çağırır). Diziler/Filmler sekmeleri AYNI `ListEmptyComponent`i paylaştığı için dal açıkça `activeTab === 'activity'` ile sınırlandı, diğer ikisi etkilenmedi.
- `app/(protected)/user/[slug].web.tsx` (masaüstü dalı, FlatList değil düz JSX): aynı üç-yollu ayrım (`isActivityLoading` → `isActivityError && activityData.length === 0` → `activityData.length === 0` → liste) elle eklendi — burada FlatList'in "ListEmptyComponent yalnızca data boşken çağrılır" garantisi olmadığı için `data.length === 0` kontrolü AÇIKÇA yazıldı.
- Kullanılmayan `FeedItem` importu (`PublicProfileMobile.tsx`, `tsc --noUnusedLocals` taramasının Madde 159'da flag'lediği) temizlendi — bu dosyada tip yalnızca `isMarathonActivity`'nin parametre çıkarımıyla kullanılıyordu, ayrı bir import gerekmiyordu. `[slug].web.tsx`'te `FeedItem` GERÇEKTEN kullanıldığından (`activityData.map((item: FeedItem) => ...)`) dokunulmadı.

**i18n:** `publicProfileLoadError` (profil BAŞLIĞININ yüklenemediği, farklı ve daha ciddi bir durum için var olan anahtar) kasıtlı olarak REUSE EDİLMEDİ — metni ("Profil yüklenemedi") bu bağlamda yanıltıcı olurdu (profil başlığı aslında yüklenmiş olabilir, yalnızca aktivite listesi başarısız olmuş olabilir). Bunun yerine `profileActivityErrorTitle/Text` (Madde 159, `media.json`) ile aynı adlandırma desenini izleyen `publicProfileActivityErrorTitle/Text` çifti `locales/{tr,en}/feed.json`'a eklendi. Retry buton metni için yeni anahtar İCAT EDİLMEDİ — `common:retry` reuse edildi (her iki ekran da `useTranslation` dizisine `'common'` eklendi, teknik olarak gerekmese de — `locales/resources.ts` TÜM namespace'leri önden yüklüyor, isim alanı önekiyle çağrı zaten çalışırdı — kod tabanının kendi konvansiyonuyla tutarlılık için eklendi).

**Belgeleme hijyeni notu:** Bu maddeyi eklerken önceki bir hata fark edilip düzeltildi: Madde 159 eklenirken dosyanın gerçek son satırı (Madde 157'nin kendi "Doğrulama" paragrafı) okunmadan, ondan BİR ÖNCEKİ satıra yeni içerik eklenmişti — bu, Madde 157'nin doğrulama paragrafını kendi başlığından koparıp Madde 159'un ALTINA, başlıksız/öksüz bırakmıştı. Fark edilince paragraf doğru yerine (Madde 157'nin gövdesinin hemen altına) taşındı, kopya silindi.

### Değişen dosyalar
`features/publicProfile/hooks/usePublicProfileActivity.ts`, `screens/PublicProfileMobile.tsx`, `app/(protected)/user/[slug].web.tsx`, `locales/{tr,en}/feed.json`.

### Doğrulama
`npx tsc --noEmit` (hem normal hem `--noUnusedLocals --noUnusedParameters`) temiz — `noUnusedLocals` taramasında `PublicProfileMobile.tsx`'in `FeedItem` bulgusu artık YOK, kalan 7 bulgu tamamen ilgisiz dosyalarda (görev kapsamı dışı, dokunulmadı). Web bundle (3377 modül) hatasız derlendi. Guest modda `/user/{slug}` rotası (auth duvarı YOK, herkese açık) canlı denendi: `usePublicProfile` Trakt'a gidip CORS'a takıldığı için üstteki profil-başlığı hata dalı (`publicProfileLoadError`, ÖNCEDEN VAR olan, bu oturumda değişmeyen kod yolu) devreye girdi — bu, aktivite sekmesine hiç ulaşılamadığı, dolayısıyla yeni `isActivityError` dalının bu sandbox'ta DOĞRUDAN görsel olarak tetiklenemediği anlamına geliyor (profil başlığı önce başarısız oluyor, aktivite listesi hiç render edilmiyor). Konsolda yalnızca beklenen Trakt CORS hataları vardı, yeni koddan kaynaklanan bir hata/çökme yoktu. **Doğrulanamayan:** yeni aktivite-hata durumunun (WifiOff + "Tekrar Dene") gerçek görünümü — profil başlığının başarıyla yüklenip yalnızca aktivite listesinin başarısız olduğu bir senaryo bu ortamda üretilemiyor (Trakt'a hiç ağ erişimi yok); gerçek bir hesap/cihazda test gerekiyor.

## 161. Aktivite Kartlarına 3-Nokta Menü: Düzenle / Sil / Paylaş (Link)

**Kullanıcı bildirimi:** "Silme özelliğini unuttuğumuzu farkettim. Kullanıcı yazabiliyor, paylaşabiliyor ama silemiyor. Silerse DB'den de silinmeli, her yerden silinmeli — boşa saklamaya gerek yok. Her karta 3 nokta koyarız, basınca Düzenle/Sil/Paylaş (link olarak) açılır." Plan önce sunuldu (`EnterPlanMode`), 4 net soruyla (`AskUserQuestion`) kapsam netleştirildi, kullanıcı onayladı, sonra uygulandı.

### Keşif: "mimari karar" aslında çoktan verilmişti
`ProfileActivityTab.tsx`'teki `ACTIVITY_DELETE_ENABLED = false` bayrağı "mimari karar netleşene kadar" notuyla silme UI'ını tamamen gizliyordu. Ama Worker'da (`kaymaktv-feedback-worker/src/index.js` → `handleFeedDelete`) o karar ÇOKTAN verilmiş ve TAM ÇALIŞIR durumdaydı: gerçek `DELETE` (hard delete) + `deleted_feed_activities` tombstone tablosuna kayıt (010 migration — sonraki Trakt senkronunun sildiğini sessizce geri getirmemesi için). Yani backend hazırdı, yalnızca kullanıcı arayüzü kapalıydı — bu oturumda yeni bir silme mekanizması İCAT EDİLMEDİ, var olanın önüne modern bir arayüz kondu.

### Kullanıcıyla netleşen kapsam (4 soru)
1. Menü **hem Akış hem Profil › Aktiviteler'de**, yalnızca **kendi** kartlarında.
2. "Paylaş" **o aktiviteye özel yeni bir kalıcı sayfa** açar (`kaymaktv.com/activity/{id}`) — `/show`/`/movie`/`/episode` ile AYNI, zaten var olan paylaşım deseni.
3. Eski kaydırarak-sil/checkbox/toplu-silme arayüzü (`ActivityDeleteRow.tsx`, hiç kullanıcıya gösterilmemişti) **tamamen kaldırıldı**.
4. Sosyal satırdaki "alıntı ekle" `Repeat` butonu (Madde 158) **kaldı** — 3-nokta menüsündeki "Düzenle" aynı ekranı açan ikinci bir yol.

### Yapılanlar

**Yeni `features/feed/components/CardMenu.tsx`:** `components/tracking/TrackingCardMenu.tsx`'in konumlandırma iskeleti (trigger'ı `measureInWindow` ile ölçüp safe-area'ya göre kırpılan, `Modal`+`Pressable` backdrop'lu bir açılır menü) BİREBİR tekrarlandı — afiş kartlarına özel favori/listeye-ekle mantığı taşımayan, yalnızca `onEdit?`/`onDelete?`/`onShare?` alan genel bir versiyon. Hiçbiri verilmezse `null` döner. "Sil" satırı ONAYI kendi içinde alır (`confirmAsync`, yeni `media:activityDeleteConfirmTitle/Message` anahtarları) — eskiden bu onay hem `ActivityDeleteRow` hem `ProfileActivityTab.handleBulkDelete`'te AYRI AYRI vardı, artık TEK yerde. Etiketler yeni anahtar İCAT EDİLMEDEN reuse edildi: `common:edit` (yeni), `common:delete` (vardı), `media:share` (vardı).

**Yeni `features/feed/utils/resolveRawActivityIds.ts`:** `useUserActivity.ts` içine gömülü olan maraton-ham-id çözümleyici paylaşılan bir util'e taşındı — Akış'ın yeni silme yolu da aynı mantığı kullanıyor, kopyalanmadı.

**`FeedCard.tsx`/`MarathonFeedCard.tsx`:** `ActivityDeleteRow` sarmalayıcısı + `isSelectionMode`/`isSelected`/`onToggleSelect` prop'ları tamamen kaldırıldı, yerine tek bir `onDeleteActivity?: () => void | Promise<void>` prop'u geldi (Akış'ta `feedStore`'a, Profil'de yerel listeye bağlanır — kart HANGİSİ olduğunu bilmek zorunda değil). `FeedCard`'ın `headerRow`'u `justifyContent:'space-between'` oldu, sağ üstte `CardMenu` (`onEdit` → var olan `setNoteModalVisible(true)`, `onShare` → yeni `handleShare`, ikisi de `isOwnActivity`/`isInteractive`'e göre koşullu). `MarathonFeedCard`'da yalnızca "Sil" var (Madde 156'daki "maraton kartına not eklenemez" kararıyla tutarlı — tek bir notu/kalıcı linki olmayan sentetik bir gruplama), kartın sağ üst köşesinde `position:'absolute'` bir trigger.

**Silme — Akış tarafına yeni bağlandı:** `useFeed.ts`'e `deleteActivity(item)` eklendi — `resolveRawActivityIds` ile ham id'leri bulur, `feedStore`'dan İYİMSER kaldırır (rollback için tam nesneleri saklar), `deleteActivitiesBulk` çağırır (Worker, YENİ bir uç nokta DEĞİL — Profil'in zaten kullandığı `/feed/delete`), başarısızsa `upsertActivity` ile geri ekler + `Alert`, başarılıysa `invalidateUserFeedActivitiesCache` (Madde 159'daki `retractLocalActivity` ile BİREBİR AYNI çapraz-senkron deseni — Akış'tan silinen Profil'de de düşsün diye). `feed.tsx` her karta `onDeleteActivity={() => deleteActivity(item)}` geçiyor.

**`ProfileActivityTab.tsx` sadeleşti:** `ACTIVITY_DELETE_ENABLED` bayrağı, `isSelectionMode`/`selectedIds` state'i, "Düzenle/Bitti" başlık butonu, floating toplu-silme `Modal`'ı TAMAMEN kaldırıldı — artık koşulsuz `onDeleteActivity={() => deleteItem(item)}`. `useUserActivity.ts`'in `deleteItem`/`deleteItems`'ı DEĞİŞMEDİ (zaten çalışıyordu), yalnızca kendi `resolveRawActivityIds` kopyası silinip paylaşılan util'e yönlendirildi.

**Yeni `app/activity/[id].tsx` + `features/feed/hooks/useActivityDetail.ts`:** Paylaşım linkinin hedefi — `app/episode/[id].tsx` ile AYNI konum deseni (`(protected)`/`(public)` gruplarının DIŞINDA, tek dosya, herkese açık). Hook, ŞİMDİYE KADAR yalnızca Realtime'ın satır tamamlama yolunda kullanılan `fetchActivityById`'yi doğrudan çağırıyor (herkese açık RLS sayesinde yeni bir yetkilendirme kodu gerekmedi). Sayfa tek bir `<FeedCard/>` render ediyor (kendi `CardMenu`'sü zaten doğru davranır, ekstra prop gerekmez). Bulunamadı/silinmiş durumu BİLİNÇLİ OLARAK `WifiOff`+"Tekrar Dene" değil, sıradan bir boş durum (`SearchX` + "Bu Gönderi Artık Yok") — eski bir paylaşım linkine tıklamak (aktivite sahibi silmiş olabilir) NORMAL bir senaryo, hata değil.

**Silinen dosya:** `features/feed/components/ActivityDeleteRow.tsx` (hiçbir yerden çağrılmıyordu). `confirmDialog.ts`'teki ona atıfta bulunan yorum güncellendi.

**Temizlik:** Bulk-silme UI'ına özel, artık kullanılmayan 5 çeviri anahtarı (`activityBulkDeleteTitle/Text`, `activityDeleteSelectedButton`, `activityDoneAction`, `activityEditAction`) `locales/{tr,en}/media.json`'dan kaldırıldı — grep ile TEK kalan referanslarının `.claude/worktrees/intelligent-mclaren-7b32d5` (donmuş, zaten `main`'in bir atası, canlı kod DEĞİL — bkz. Madde 159) altında olduğu doğrulandı.

### Değişen/Yeni/Silinen dosyalar
YENİ: `app/activity/[id].tsx`, `features/feed/hooks/useActivityDetail.ts`, `features/feed/components/CardMenu.tsx`, `features/feed/utils/resolveRawActivityIds.ts`. DEĞİŞTİ: `FeedCard.tsx`, `MarathonFeedCard.tsx`, `useFeed.ts`, `useUserActivity.ts`, `ProfileActivityTab.tsx`, `feed.tsx`, `confirmDialog.ts`, `locales/{tr,en}/{feed,media,common}.json`. SİLİNDİ: `ActivityDeleteRow.tsx`.

### Doğrulama
`npx tsc --noEmit` (hem normal hem `--noUnusedLocals --noUnusedParameters`) temiz — dead-code taraması `ActivityDeleteRow`'a ait HİÇBİR kalıntı göstermedi, kalan 7 bulgu bu görevle ilgisiz dosyalarda (dokunulmadı). Web bundle (3407 modül) hatasız derlendi. Guest modda canlı test: `/activity/{geçersiz-uuid}` ve `/activity/{var-olmayan-gerçek-uuid}` ikisi de doğru "Bu Gönderi Artık Yok" boş durumunu gösterdi (Supabase isteği bu sandbox'ta 400 dönse bile `useActivityDetail`'in `catch`'i çökmeden zarif bir boş duruma düşüyor); Akış guest modda hatasız yüklendi ("Akışın Boş"); Profil'in misafir duvarı (önceki oturumlardan, bu oturumda değişmedi) sağlam. Konsolda yalnızca ortama özgü Trakt/Supabase ağ hataları vardı. **Doğrulanamayan:** gerçek bir Trakt hesabıyla uçtan uca — 3-nokta menüsünün gerçek bir kartta açılıp doğru konumlanması, "Sil"in gerçekten Supabase'den + bir sonraki senkronda geri gelmeyecek şekilde silmesi, "Paylaş"ın OS paylaşım sayfasını açması ve paylaşılan linkin gerçek bir tarayıcıda o kartı göstermesi — bu ortamda Trakt/Supabase'e gerçek ağ erişimi yok, kullanıcının kendi hesabıyla/cihazında test etmesi gerekiyor.

## 162. Denetim Turu: Realtime'da Eksik DELETE Aboneliği + Alıntı Düzenleyicide Bayat 500 Karakter Sınırı

**Kullanıcı isteği:** "Şu an sorunsuz çalışıyor gibi. Öncelikle ölü kod var mı buna bak, varsa sil. Daha stabil hale getirebiliyorsan bunu yap. Başka hata bulursan bildir." Madde 161'in üzerinden hedefli bir denetim turu — tüm `features/feed/` ağacı okunup iki katmanda kontrol edildi: (1) ölü kod — `tsc --noUnusedLocals --noUnusedParameters` taraması + her dosyanın başka bir yerden import edilip edilmediğinin (orphan dosya) manuel kontrolü, (2) mantık/stabilite — özellikle Madde 161'de yeni bağlanan silme yolunun geri kalan sistemle (Realtime, karakter sınırları) tutarlılığı.

### Ölü kod — BULUNAMADI
`tsc --noUnusedLocals --noUnusedParameters` taraması `features/feed/`+`features/publicProfile/` içinde SIFIR bulgu verdi (yalnızca bu görevle ilgisiz 7 önceden bilinen bulgu — `blocked-users.tsx`, `ReportIssueModal.tsx`, `useNotifications.ts` — hâlâ duruyor, dokunulmadı). Her dosyanın en az bir yerden import edildiği doğrulandı (orphan/hiç kullanılmayan dosya yok) — Madde 161'in kendi temizliği (ActivityDeleteRow.tsx silinmesi + 5 ölü çeviri anahtarı) zaten bu ağacı temiz bırakmıştı.

### Gerçek bulgu 1 — Realtime'da DELETE aboneliği hiç yoktu (düzeltildi)
`useFeedRealtime.ts` yalnızca `INSERT`/`UPDATE` `postgres_changes` olaylarına abone oluyordu. Madde 161'e kadar bu sorun DEĞİLDİ çünkü silme hiçbir yerden tetiklenemiyordu (`ACTIVITY_DELETE_ENABLED=false`) — ama artık gerçek bir silme (Akış VEYA Profil'den) yalnızca SİLEN KİŞİNİN kendi ekranından anında kayboluyor, akışı o an açık olan BAŞKA kullanıcılar kartı hâlâ görmeye devam ediyordu (yalnızca bir sonraki tazelemede düşerdi) — kullanıcının "her yerden silinmeli" isteğiyle doğrudan çelişen bir boşluk. Düzeltme: yeni bir `DELETE` handler eklendi, `payload.old.id`'yi (REPLICA IDENTITY FULL sayesinde — 013_realtime_feed.sql'de zaten ayarlıydı, `payload.old` TAM satırı taşır) `feedStore.removeActivity()`'ye geçiyor — INSERT/UPDATE handler'larıyla BİREBİR aynı desen, yeni bir mekanizma icat edilmedi.

### Gerçek bulgu 2 — NoteEditorModal hâlâ 500 karakterde kilitliydi (düzeltildi)
Madde 157'de `note` alanının karakter sınırı Worker/DB'de 500'den **1000**'e çıkarılmıştı ("hem kısa alıntıları hem bağımsız gönderileri taşıyor" gerekçesiyle, `ComposePostModal.tsx`'in `POST_MAX_LENGTH`i de doğru şekilde 1000). Ama `NoteEditorModal.tsx`'teki `NOTE_MAX_LENGTH` sabiti hiç güncellenmemiş, 500'de kalmıştı — bu modal hem "alıntı ekle/düzenle" (Repeat butonu, 3-nokta menüsündeki Düzenle) hem de bir "Fikir Paylaş" gönderisinin gövdesini düzenlemek için AYNI bileşen (bkz. FeedCard.tsx). Sonuç: 501-1000 karakter arası (ComposePostModal ile oluşturulmuş, backend'in kabul ettiği GEÇERLİ) bir gönderiyi kullanıcı tekrar düzenlemeye çalıştığında — hatta hiç değiştirmeden yalnızca yeniden kaydetmeye çalışsa bile — sayaç "800/500" gösterip Kaydet butonu SESSİZCE devre dışı kalıyordu. `TextInput`'un sert `maxLength` sınırı da (`NOTE_MAX_LENGTH + 50` = 550) yeni bir alıntının hiçbir zaman 550 karakteri aşmasına izin vermiyordu. Düzeltme: sabit 1000'e çıkarıldı, Worker'daki (`handleFeedNote`, satır ~1435) gerçek kaynakla hizalandı.

**Dokunulmayan (bilinçli, ayrı repo):** `kaymaktv-feedback-worker/src/index.js`'te `handleFeedNote`'un hemen üstünde stale bir yorum var ("DB'deki 500 sınırı gerçek kaynak") — kodun kendisi doğru (1000 kontrol ediyor), yalnızca yorum eski. Bu Worker AYRI bir repo/deploy döngüsüne sahip (`kaymaktv-feedback-worker`), bu oturumun kapsamı KaymakTV app repo'suydu — kullanıcıya bildirilecek, düzenlenmedi.

### Değişen dosyalar
`features/feed/hooks/useFeedRealtime.ts`, `features/feed/components/NoteEditorModal.tsx`.

### Doğrulama
`npx tsc --noEmit` temiz. Web bundle hatasız derlendi. Guest modda Akış hatasız yüklendi, konsolda yeni koddan kaynaklanan hata yoktu (yalnızca ortama özgü Trakt CORS gürültüsü). **Doğrulanamayan:** guest modda `useFeedRealtime` hiç subscribe OLMUYOR (`canLoad=false` iken kanal kurulmuyor) — yeni `DELETE` handler'ının gerçek bir Supabase kanalına karşı çalıştığı bu ortamda doğrulanamadı; `NOTE_MAX_LENGTH` değişikliği yalnızca statik/tip doğruluğuyla teyit edildi. İkisi de gerçek bir hesapla cihazda test edilmeli.

## 163. Güvenlik Denetimi (`/security-review`) + "Hayalet Silme" Düzeltmesi + Akış Ekranı Sıralaması

**Bağlam:** Kullanıcı Madde 161-162'nin (3-nokta menü + denetim) ardından `/security-review` skill'iyle güvenlik denetimi istedi.

### Güvenlik denetimi sonucu
İki aşamalı, ajan tabanlı denetim (önce olası açıkları tara, sonra her adayı bağımsız bir ajanla doğrula/çürüt) `features/feed/` ağacındaki tüm bekleyen değişiklikleri (Madde 158-162'nin diff'i) taradı. **Yüksek güvenilirlikli (≥8/10) bir güvenlik açığı BULUNAMADI.** Tek aday — `MarathonFeedCard.tsx`'te "Sil" seçeneğinin sahiplik kontrolü olmadan gösterilmesi — doğrulama turunda 2/10 güvenle ELENDİ: Worker'ın `handleFeedDelete`'i (`deleteFeedActivitiesForUser`) gerçek SQL DELETE'i HEM `id` HEM `user_id=eq.<doğrulanmış çağıran>` şartıyla filtreliyor, yani başkasının aktivite id'leri gönderilse bile sunucu tarafında sıfır satır eşleşiyor — hiçbir veri gerçekten silinmiyor. Yetkilendirme sınırı (IDOR'a karşı) sağlam.

### Gerçek bulgu — "Hayalet Silme" (Phantom Delete), güvenlik değil UX hatası (düzeltildi)
Güvenlik açığı olmasa da gerçek bir kullanıcı deneyimi sorunuydu: `MarathonFeedCard.tsx`, `FeedCard.tsx`'in aksine, `CardMenu`'nün "Sil" satırını `isOwnActivity` kontrolü olmadan gösteriyordu — takip ettiğin birinin maraton kartında da "Sil" çıkıyordu. Sunucu isteği reddetmese de (sessizce 0 satır silip `success:true` dönüyor), istemci bunu iyimser olarak YİNE DE kendi ekranından kaldırıyordu — kullanıcı gerçekte hiçbir şey silmediği hâlde "sildim" sanıyordu (kart yalnızca kendi cihazında, geçici olarak kayboluyordu, DB'de dokunulmamış durumdaydı). Düzeltme: `FeedCard.tsx`'teki `isOwnActivity = myTraktSlug === activity.user.traktSlug` kontrolü `MarathonFeedCard.tsx`'e birebir taşındı (`useMyTraktSlug` hook'u eklendi), `CardMenu`'ye `onDelete={isOwnActivity ? onDeleteActivity : undefined}` geçiliyor artık.

### UI — "Ne düşünüyorsun?" kutusu arama çubuğunun altına indi
Kullanıcı isteği: Akış ekranının en üstünde arama çubuğunun ÜSTÜNDE duran "Ne düşünüyorsun?" (Fikir Paylaş giriş noktası) kutusu, kullanıcıların gözünden kaçıyordu. `app/(protected)/(tabs)/feed.tsx`'te iki blok yer değiştirdi — `UserSearchBar` üstte sabit kalıyor, `ComposePostBar` onun altına indi. Salt sıralama değişikliği, iki bileşenin kendisi DOKUNULMADI.

### Değişen dosyalar
`features/feed/components/MarathonFeedCard.tsx`, `app/(protected)/(tabs)/feed.tsx`.

### Doğrulama
`npx tsc --noEmit` temiz. Web bundle hatasız derlendi, guest modda Akış hatasız yüklendi (konsolda yalnızca ortama özgü Trakt CORS gürültüsü). **Doğrulanamayan:** `ComposePostBar` yalnızca gerçek (misafir olmayan) kullanıcıya gösterildiğinden yeni sıralama bu sandbox'ta GÖRSEL olarak doğrulanamadı (guest modda hiç render edilmiyor) — kod değişikliği salt iki JSX bloğunun yer değiştirmesi, düşük risk, ama kullanıcının gerçek hesabıyla görsel teyidi gerekiyor. "Hayalet silme" düzeltmesi de gerçek bir maraton kartı ve iki farklı hesap gerektirdiğinden bu ortamda uçtan uca test edilemedi.

## 164. Akış Sisteminin Tam Denetimi: Oturum Sızıntısı + 3 Sessiz Başarısızlık + Doküman Temizliği

**Kullanıcı isteği:** "Akışı komple her yerini denetlemeni istiyorum çünkü burayı oluşturdum, başka özelliklere geçeceğim. Denetleme planı oluştur ve denetle. Sorunlar varsa bildir. Sorun yoksa bu alanla alakalı gereksiz .md dosyası varsa temizleyelim ya da güncelleyelim."

### Denetim planı (6 eksen)
`features/feed/` (44 dosya) + `features/publicProfile/` + tüketici ekranlar + Worker + şema + dokümanlar şu eksenlerde tarandı: (1) veri katmanı/servisler — önbellek geçersiz kılma tutarlılığı, (2) hook'lar — yarış durumu/stale closure/unmount, (3) UI bileşenleri — guest guard, sessiz hata, (4) oturum izolasyonu, (5) Worker sözleşmesi + DB şeması uyumu, (6) doküman güncelliği.

### 🔴 Bulgu 1 — Hesap değişiminde kimlik önbelleği sızıntısı (düzeltildi)
`AuthContext.removeKeys()` (çıkış) altı önbelleği temizliyordu (followStore, myTraktSlug, feedStore, feedPublish kimliği, feedCache, visibleUserIds) ama `features/feed/services/userBlocks.ts`'teki **İKİ modül seviyesi önbelleği atlıyordu**: `myUserIdCache` (benim Supabase `users.id`'im) ve `blockedIdsCache` (engel kümem). İkisinin de `invalidate*` fonksiyonu ZATEN VARDI ama hiçbir yerden çağrılmıyordu. Sonuç: uygulama kapatılmadan hesap değiştirilirse (çıkış → farklı hesapla giriş) TTL (60sn) dolana kadar ÖNCEKİ kullanıcının kimliği kullanılırdı — `attachIsLikedByMe` başkasının beğenilerini "benim" gösterir, `useFeedComments.myUserId` yanlış yorumlarda "sil" butonu çıkarır (kendi yorumunda çıkarmaz), engel filtresi önceki hesabın listesiyle çalışırdı. Düzeltme: iki `invalidate` çağrısı `removeKeys`'e eklendi + `docs/feed.md`'ye "yeni önbellek eklersen buraya da ekle" uyarısı yazıldı.

### 🟡 Bulgu 2-4 — Üç sessiz başarısızlık (`docs/AI_RULES.md` ihlali, düzeltildi)
Kural: *"Kullanıcının başlattığı bir eylem başarısız olduğunda ekranda görünür bir geri bildirim OLMAK ZORUNDADIR."* Tüm `catch` blokları tarandı; iyimser geri alması OLAN yollar (beğeni, yorum silme, gizlilik anahtarı — durum görünür şekilde geri döner) kabul edildi, geri bildirimi HİÇ olmayan üç yol düzeltildi:
1. **Alıntı kaydetme** (`FeedCard.handleSaveNote`): hata yalnızca `console.warn`'a düşüyordu — modal açık kalıyor ama kullanıcı NEDEN kapanmadığını göremiyordu ("Kaydet çalışmıyor" izlenimi). `NoteEditorModal`'a `error?: string | null` prop'u eklendi (`ComposePostModal`'daki AYNI desen/stil), `FeedCard` sunucu mesajını oraya geçiriyor. `if (!accessToken) return;` sessiz dönüşü de görünür bir mesaja çevrildi.
2. **Engelle/engeli kaldır** (`BlockUserButton`): `catch {}` tamamen boştu ("hata zaten hook'ta loglanıyor" notuyla) — artık `Alert`.
3. **Engeli kaldır** (`app/(protected)/blocked-users.tsx`): aynı desen, satır listede kalıyor ama sebep gösterilmiyordu — artık `Alert`.

### ✅ Temiz çıkan eksenler
- **Worker sözleşmesi:** client'ın çağırdığı 12 uç noktanın HEPSİ Worker'ın router'ıyla birebir eşleşiyor (`/feed/{sync,publish,privacy,delete,note,comment,comment/delete,like,post,block,unblock}` + `/account/delete`) — eşleşmeyen/ölü uç nokta yok.
- **Ölü kod:** `tsc --noUnusedLocals --noUnusedParameters` akış kapsamında SIFIR bulgu. Tek bulgu `blocked-users.tsx`'teki kullanılmayan `UserX` importuydu (otopsi: `Ban` ile değiştirilmiş, kalıntı) — silindi. Kalan 6 bulgu akış dışı dosyalarda (`ReportIssueModal`, `useNotifications`), dokunulmadı.
- **Yarış korumaları:** `useActivityFeed` (runId sayacı), `MediaPickerModal` (searchSeq), `useFeed.loadMore` (isFetchingRef), `useActivityDetail`/`useFeedPrivacy` (cancelled bayrağı) — hepsi doğru kurulmuş.
- **İyimser UI geri almaları:** yayın, gönderi, silme, beğeni, yorum, gizlilik — hepsinin rollback'i var.

### 📄 Doküman temizliği
- **`docs/feed.md`** (asıl temizlik): tamamlanmış işleri "⏳ Yapılmadı" gösteren yol haritası tablosu, iki ayrı **bayat "Kullanıcının Yapması Gerekenler"** listesi (aylar önceki oturumlardan kalma, 006/007/008 migration'ları çalıştırma talimatları), "Phase 1/Phase 1.5/Phase 2" kapsam listeleri, artık geçersiz **"Status Tracker"** ve eksik/yanlış **DB şeması bloğu** (013/015/017'nin eklediği `media_type`/`tmdb_id`/`note`/`like_count` kolonları yoktu, `show_id NOT NULL` yazıyordu ama 017'de NULLABLE olmuştu) güncellendi. Yerine: gerçek durum özeti, güncel şema, migration tablosu (010-017 eklendi), kalan-işler tablosu ve "yeni migration/Worker değişikliği yaptıysan" adımları.
- **`docs/FEED_SOCIAL_PLAN.md`:** SİLİNMEDİ (kod yorumlarının onlarcası `§` numarasıyla buraya atıf yapıyor, tasarım gerekçesi hâlâ değerli) ama başlığı "Plan" → "TASARIM KAYDI" yapıldı ve §7 düzeltildi — tamamlanmış işleri ("Worker uç noktaları, RN UI, Realtime genişletmesi — sonraki tur") hâlâ yapılmamış gibi listeliyordu. Sonradan değişen üç madde (not sınırı 500→1000, silme, Realtime DELETE) başa not düşüldü.
- `docs/HISTORY.md`'ye DOKUNULMADI (tarihsel kayıt, geriye dönük düzeltilmez).

### Değişen dosyalar
`context/AuthContext.tsx`, `features/feed/components/{FeedCard,NoteEditorModal,BlockUserButton}.tsx`, `app/(protected)/blocked-users.tsx`, `locales/{tr,en}/feed.json`, `docs/{feed,FEED_SOCIAL_PLAN}.md`.

### Doğrulama
`npx tsc --noEmit` temiz; `--noUnusedLocals --noUnusedParameters` taramasında akış kapsamında hiç bulgu yok. Web bundle hatasız derlendi; guest modda Akış ("Akışın Boş") ve `/blocked-users` ("Kimseyi engellemedin") ekranları hatasız yüklendi, konsolda yalnızca ortama özgü Trakt CORS gürültüsü vardı. **Doğrulanamayan:** oturum sızıntısı düzeltmesi iki farklı Trakt hesabıyla çıkış-giriş döngüsü gerektiriyor; üç yeni hata mesajının görünümü gerçek bir ağ hatası gerektiriyor — ikisi de bu ortamda üretilemedi, gerçek cihazda test edilmeli.

---

## 165. İnceleme (Review) Entegrasyonu — Mimari Plan + Ölü Kod Temizliği + Faz 1 (DB)

**Kullanıcı isteği:** "Sosyal akışa Trakt incelemelerini (Type 1 yorumları) Letterboxd mantığıyla entegre etmek istiyoruz. Dual-write: hem Trakt'a hem Supabase'e, `tmdb_id` ile birlikte. Yanıtlar Trakt'a GİTMEYECEK. Önce kod yazmadan mimari plan ve risk analizi çıkar." Plan onaylandıktan sonra: "Gereksiz kodu sil ve tekrarlayan kodları düzelt, ardından Faz 1 ile başla."

### 📐 Plan: `docs/REVIEWS_PLAN.md` (yeni)
`FEED_SOCIAL_PLAN.md` ile aynı rol: önce tasarım kararları + gerekçe, sonra katman katman uygulama (DB → Worker → Client → UI), her faz ayrı onay. Kullanıcının iki sorusuna verilen cevaplar:

- **Çift görünme:** Worker senkronu bugün `/users/me/comments`'i HİÇ çekmiyor (yalnızca `/sync/history/episodes` + `/sync/ratings/*`), yani manuel yazmayla çakışma **bugün yok**. Ama "Trakt web'den yazdığım inceleme de akışımda görünsün" istendiği gün çakışacak. Yapısal çözüm: **`trakt_comment_id`** — Trakt yorumun kendisine kalıcı sayısal bir id verip POST yanıtında döndürüyor; izleme/puanlamadaki kırılgan *zaman damgası hizalamasından* kat kat güçlü bir dedup anahtarı. Toplam **5 ayrı çift-görünme ekseni** tespit edilip her biri ayrı ayrı kapatıldı.
- **Dizi detay sayfası:** **İki ayrı bölüm** ("KaymakTV İncelemeleri" + "Trakt Topluluğu"), birleşik liste **reddedildi**. Belirleyici gerekçe: birleşik listede kullanıcı bir Trakt yorumunun altında yanıt kutusu görür; o kutu ya "yanıtlar Trakt'a gitmez" kuralını bozar ya da Trakt'ta hiç görünmeyen yanıt biriktirip kullanıcıyı yanıltır. Ayrıca Trakt beğenisi ile bizim `like_count`'umuz farklı evrenlerden geldiği için "beğeniye göre sırala" birleşik listede anlamını yitirirdi.

### 🔴 Plan sırasında bulunan iki MEVCUT veri kaybı açığı
İkisi de `'posted'` tipini **bugün** etkiliyor, `'reviewed'` aynısını miras alacaktı. Kullanıcı kararı: "bekletmeden bu fazın içinde düzelt."
1. **Retention elle yazılmış içeriği siliyordu (R1).** `prune_feed_activities()` her gece kullanıcı başına en yeni 200 satırı `activity_type` ayrımı yapmadan tutuyordu. Ayda 200+ `watched_episode` üreten aktif bir kullanıcının elle yazdığı gönderisi/incelemesi, altındaki tüm yanıtlarla (CASCADE) sessizce yok olurdu — `FEED_SOCIAL_PLAN.md` §5'teki açık kararla ("kullanıcının bilerek yazdığı içerik zaman bazlı SİLİNMEZ") doğrudan çelişiyordu. 018'de düzeltildi.
2. **İyimser kart + Realtime yankısı çift kart üretiyor (R6).** `useFeedRealtime` gelen INSERT'i `tempActivityId` ile eşleştiriyor ve bu id `activityAt`'i içeriyor. `publishActivities` damgayı Worker'a gönderiyor (eşleşme tutuyor ✅) ama `publishPost` göndermiyor; `handleFeedPost:1763` kendi `new Date()`'ini yazıyor → eşleşme tutmuyor → ikinci kart ekleniyor ❌. Kök neden, oradaki *"istemcinin damgasına güvenmeye gerek yok"* yorumu: dedup için gerçekten gerek yok, ama **Realtime yankı eşleşmesi için gerekli**. Faz 2'de düzeltilecek (Worker turu).

Ayrıca: gizlilik anahtarı `publishWatches=false` yalnızca `watched_episode` siliyor, `watched_movie` kalıyor (`handleFeedPrivacy:1140` vs `handleFeedSync:623-624`) — incelemelerle ilgisiz, ayrı düzeltme olarak not düşüldü.

### 🧹 Ölü kod + yinelenme temizliği (`docs/AI_RULES.md` §2.5)
Madde 164'ün "kalan 6 bulgu akış dışı dosyalarda, dokunulmadı" dediği kalıntılar bu turda kapatıldı. Her biri için **otopsi yapıldı**, körlemesine silme yok:

- **Yinelenen mantık → `hooks/useMyMediaComment.ts` (yeni).** `MyInlineComment` ve `WriteCommentSheet` "bu yapıma ben yorum yazmış mıyım?" mantığını **birbirinden bağımsız** kopyalıyordu: ikisi de `getUserComments()` çağırıp aynı 4 satırlık `.find()` eşleştirmesini yapıyordu (`services/api/comments.ts`'teki paylaşımlı önbellek ağ maliyetini çözmüştü ama mantık yinelenmesi duruyordu) ve hata yönetimleri şimdiden ıraksamıştı. Otopsi: **(a) taşınmalı** — ortak hook'a çıkarıldı, iki kopya da AYNI değişiklikte silindi. Bonus: eski kopyaların ikisinde de olmayan **yarış koruması** eklendi (A dizisinden B'ye hızlı geçişte A'nın geç dönen yanıtı B'nin durumunu eziyordu). `getUserComments` artık tek yerden çağrılıyor.
- **`app/show/[id].tsx` + `app/movie/[id].tsx` — `MyInlineComment` iki kez.** İki karşılıklı dışlayan dalda (`commentsData.length > 0` / `=== 0`) birebir aynı 5 prop'la render ediliyordu. Otopsi: **kopyala-yapıştır**, bilinçli değil. Tek render'a indirildi; dal artık yalnızca *Trakt yorumları bloğunu* sarmalıyor. (`app/episode/[id].tsx` zaten tekti.)
- **`features/notifications/` push-token iskelesi — 5 dosya silindi.** `hooks/useNotifications.ts` (gövdesi tamamen yorum satırı, 0 kullanım), `services/{expoPush,webPush,notificationApi}.ts` (`return null` / `console.log` TODO stub'ları) ve artık hiçbir tüketicisi kalmayan `types.ts`. Otopsi: **hiç bağlanmamış iskele** — kayıp özellik DEĞİL (kodun kendisi "TODO: İleride yazılacak" diyor, `docs/feed.md` yol haritasında bildirimler "Ertelendi"), `AI_RULES` §2.5'in açık yasağı olan *"ileride lazım olur diye bağlanmamış kod"*. Tasarım `docs/notifications.md`'de duruyor, bilgi kaybı yok. ⚠️ **Klasör silinmedi:** `NotificationBadge` CANLI (`screens/ProfileMobile.tsx:113`, `app/(protected)/(tabs)/profile.web.tsx:241`) ve beslendiği `store/notificationStore.ts` tamamen bağımsız (istemci-tarafı, push'suz).
- **`components/settings/ReportIssueModal.tsx`** — kullanılmayan `Check` importu ve `FeedbackCategory` tipi.

### 🗄️ Faz 1 — `supabase/schema/018_feed_reviews.sql` (yeni, HENÜZ ÇALIŞTIRILMADI)
Yeni tablo AÇILMADI; `'posted'`de kanıtlanmış desen tekrarlandı — `feed_activities`'e 7. tip (`'reviewed'`), böylece sayfalama/Realtime/beğeni/yorum/engelleme/`/activity/{id}` bedavaya çalışıyor. İçerik: `activity_type` CHECK genişletmesi · `trakt_comment_id` kolonu + kısmi unique · yapım başına tek inceleme kısmi unique'i (`COALESCE(episode_number,'')` ile — Postgres'te `NULL != NULL` olduğu için bu şart, aksi halde v1'de kısıt hiç çalışmazdı) · dizi sayfası sorgusu için kısmi indeks · `note` ve **`tmdb_id` zorunluluğu** (bağımsızlık garantisi) · tombstone CHECK'ine `'reviewed'` · **retention muafiyeti (R1)**.

Kararlar (kullanıcı, 2026-08-16): Trakt'a **Worker** yazar (tek işlem sınırı) · dizi sayfasında **iki ayrı bölüm** · bölüm incelemeleri **v1'de yok** (spam) · Trakt gizliliği açılınca elle yazılmış içerik **KESİNLİKLE SİLİNMEZ** (hard delete yasak; otomatik loglar silinebilir) · `tmdb_id` **zorunlu** · R1+R6 bu turda.

### Değişen dosyalar
**Yeni:** `docs/REVIEWS_PLAN.md`, `hooks/useMyMediaComment.ts`, `supabase/schema/018_feed_reviews.sql`.
**Değişen:** `components/{MyInlineComment,WriteCommentSheet}.tsx`, `components/settings/ReportIssueModal.tsx`, `app/show/[id].tsx`, `app/movie/[id].tsx`.
**Silinen:** `features/notifications/{types.ts, hooks/useNotifications.ts, services/expoPush.ts, services/webPush.ts, services/notificationApi.ts}`.

### Doğrulama
`npx tsc --noEmit --noUnusedLocals --noUnusedParameters -p .` → **SIFIR bulgu** (temizlik öncesi 8 bulgu vardı, hepsi kapandı). `npx tsc --noEmit` temiz. Kopan import taraması boş; `getUserComments` artık tek çağrı noktasından geliyor. **Doğrulanamayan:** 018 migration'ı Supabase SQL Editor'de ELLE çalıştırılmalı (bu ortamdan production DB'ye erişim yok); `MyInlineComment`/`WriteCommentSheet` davranış eşdeğerliği gerçek Trakt oturumu gerektirdiği için gerçek cihazda test edilmeli.

---

## 166. İnceleme Entegrasyonu Faz 2 — Worker: Trakt'a İlk Yazma Ucu + R6/R11 Düzeltmeleri

**Bağlam:** `docs/REVIEWS_PLAN.md` Faz 2. Faz 1 (`018_feed_reviews.sql`) Madde 165'te yazılmıştı.

### 🔑 Worker artık Trakt'a YAZIYOR — bir ilk
`traktFetch` bugüne kadar yalnızca GET yapabilen bir sarmalayıcıydı (`method`/`body` parametresi yoktu); Worker Trakt'ı sadece OKUYORDU. Dual-write'ın iki bacağını tek yere koymak için genişletildi (geriye dönük uyumlu — `init` verilmezse davranış birebir aynı). Gerekçe: client Trakt'a yazıp Supabase'e yazamazsa "hayalet inceleme" oluşur; tek işlem sınırı bunu yapısal olarak imkânsız kılıyor.

### `POST /feed/review` — yaz/güncelle
Sıra **pazarlığa kapalı: önce Trakt, sonra Supabase.** Ters sırada Trakt reddettiğinde (5 kelime kuralı, 409, ağ hatası) `trakt_comment_id`'si NULL, sonsuza dek dedup edilemeyen bir hayalet satır kalırdı. Öne çıkanlar:
- **409 kurtarması:** Trakt "zaten yorum var" diyor ama bizde satır yok (kullanıcı Trakt web'den yazmış) → `/users/me/comments`'ten bulunup `PUT`'a düşülüyor. Olmasaydı kullanıcı **kalıcı olarak tıkanırdı** — her denemede 409, incelemesini KaymakTV'ye hiç taşıyamazdı.
- **PUT 404 kurtarması:** yorum Trakt'ta silinmiş ama bizde duruyor (öksüz satır) → hata değil, POST dalına düşüp yeniden oluşturuluyor.
- **`tmdb_id` ZORUNLU** — diğer 6 tipte nullable, incelemede değil (bağımsızlık garantisi, DB CHECK'iyle birlikte üç katmanlı doğrulama).
- **TARİH SABİTLİĞİ:** düzenlemede `activity_at` PATCH'e eklenmiyor — `handleFeedNote`'takiyle aynı kural; aksi halde 6 ay önceki bir incelemede yazım hatası düzeltmek kartı akışın tepesine fırlatırdı ("gizli spam").
- Supabase adımı başarısız olursa `traktOk: true` dönülüyor ki client doğru mesajı gösterebilsin; bir sonraki deneme 409→PUT ile aynı adımı tekrarlayıp **sistemi kendi kendine onarıyor**.

### `POST /feed/review/delete`
`/feed/delete` KULLANILAMAZ (yalnızca Supabase'i siler, yorum Trakt'ta kalır ve senkron eklendiğinde geri gelir). Yine **önce Trakt**: DELETE başarısızsa yerel satıra dokunulmuyor. Trakt 404'ü hata sayılmıyor (zaten silinmiş = istenen son durum; hata saymak kullanıcının kendi kartını hiç silememesi demekti). Tombstone `trakt_comment_id` ile yazılıyor — `'posted'`dan farklı olarak inceleme tombstone'lanıyor çünkü Trakt'ta karşılığı var.

### R11 — gizlilikte manuel içerik artık silinmiyor
`deleteUserActivities` (`activity_type` ayrımı yapmadan o kullanıcının TÜM satırlarını siliyordu) → **`deleteUserAutoLogActivities`**: yalnızca `AUTO_LOG_ACTIVITY_TYPES` (Trakt aynası olan 5 tip) siliniyor, `'posted'`/`'reviewed'` korunuyor. Fonksiyon adı da değişti — "TÜM aktiviteleri sil" artık doğru olmayan, bir sonraki okuyanı yanıltacak bir isimdi. Kullanıcı kararı: *"emek verip yazdığı içeriği, sırf dışarıdaki bir platformun ayarı değişti diye silmek kabul edilemez."*

### R6 — `posted` çift kart hatası düzeltildi
`handleFeedPost` sunucunun kendi zamanını yazıyordu; client'ın iyimser kartının `tempActivityId`'si damgayı içerdiği için Realtime yankısı eşleşmiyor ve **aynı gönderi iki kart** görünüyordu. Artık `resolveClientStamp(body.activityAt)`. Damga körü körüne kabul edilmiyor: geleceğe dönük (saati ileri cihaz akışa çakılır) ve 10 dakikadan eski (gönderiyi akışın dibine gömerek "sessizce paylaşma") damgalar sunucu zamanına düşürülüyor. Koddaki *"istemcinin damgasına güvenmeye gerek yok"* yorumu — hatanın kök nedeni — düzeltildi: dedup için gerek yok, ama **Realtime yankı eşleşmesi için gerekli**.

### Yan temizlik (AI_RULES §2.5)
- **`MAX_NOTE_LENGTH`** — `feed_activities.note`'un 1000 sınırı üç yerde ayrı ayrı yazılıydı (`handleFeedNote`'ta çıplak literal, `MAX_POST_LENGTH` sabiti, ve yeni inceleme ucu). Tek sabite indirildi.
- **`supabaseInsertReturning`** — `handleFeedPost`'un inline INSERT bloğu paylaşılan yardımcıya çıkarıldı; inceleme ucu ikinci kopya üretmek yerine onu kullanıyor.

### Değişen dosyalar
`kaymaktv-feedback-worker/src/index.js` (tek dosya), `docs/REVIEWS_PLAN.md`.

### Doğrulama
`node --check src/index.js` temiz. Router↔handler çapraz kontrolü: 15 rotanın tamamı tanımlı fonksiyona bağlı. Kalıntı referans taraması (`deleteUserActivities(`, `MAX_POST_LENGTH`) boş. **Doğrulanamayan:** uçlar canlı Trakt token'ı + deploy gerektirdiği için bu ortamda çalıştırılamadı; `wrangler tail` ile gerçek cihazda test edilmeli. **İki elle adım bekliyor:** (1) `018_feed_reviews.sql` Supabase'de çalıştırılmalı, (2) `npx wrangler deploy` — bu SIRAYLA, çünkü Worker `trakt_comment_id` kolonuna yazıyor.

### Sonraya bırakılanlar
Faz 2 sırasında çıkan 5 yan sorun `docs/REVIEWS_PLAN.md`'nin sonundaki **"SONRA BAKILACAKLAR"** bölümüne kaydedildi (en kritiği S1: `note`'un 1000 karakter sınırı, Trakt'ın 200 kelimelik "review" eşiğinin altında kaldığı için KaymakTV'den yazılan bir inceleme Trakt tarafından hiçbir zaman "review" sayılamıyor — karar bekliyor).

---

## 167. İnceleme Entegrasyonu Faz 3 — Client Servis/Hook Katmanı

**Bağlam:** `docs/REVIEWS_PLAN.md` Faz 3. Faz 1 (DB) Madde 165, Faz 2 (Worker) Madde 166.

### Yeni: `features/feed/services/feedReviews.ts`
`publishReview` / `deleteReview` — Worker'ın `/feed/review` ve `/feed/review/delete` uçlarını sarar. `services/api/comments.ts` (Trakt'ın kendi yorum sistemi) ile karıştırılmasın diye ayrı dosya: oradaki `addComment` Trakt'a DOĞRUDAN yazar ve akıştan haberi yoktur, buradaki iki sistemi birden değiştirir.

İki nokta özellikle önemli:
- **S2 kapatıldı (önbellek tuzağı):** Trakt'a artık Worker yazdığı için `services/api/comments.ts` içindeki `invalidateUserCommentsCache()` HİÇ çalışmıyor. Bu satır olmadan `MyInlineComment`/`WriteCommentSheet` 60 saniye boyunca incelemeyi göremez ve kullanıcı "yazdım ama görünmüyor" derdi. Tek bir `invalidateAfterReviewChange` yardımcısında toplandı (yorum önbelleği + yapım incelemeleri + akış + profil).
- **`traktOk` sinyali UI'a taşınıyor:** Worker "Trakt'a yazıldı ama Supabase'e yazılamadı" durumunu ayrı bildiriyor; hook bunu *"İncelemen Trakt'a kaydedildi ama akışa düşürülemedi, tekrar dener misin?"* mesajına çeviriyor. Kullanıcıya "hiçbir şey olmadı" demek yalan olurdu.

### 🔴 Uygulama sırasında yakalanan tuzak: silme yanlış uca gidiyordu
`useFeed` ve `useUserActivity`, "⋯ → Sil" için HER öğeyi `deleteActivitiesBulk` (`/feed/delete`) ile siliyordu. Bir `reviewed` kartında bu, satırı bizden kaldırıp **yorumu Trakt'ta bırakırdı** — Madde 161'deki kullanıcı beklentisinin ("sildiğimde her yerden silinmeli, bize güveniyor") tam tersi, üstelik inceleme senkronu eklendiği gün kayıt geri gelirdi.

Karar **iki ekranda birden** verilmek zorunda olduğu için UI'a değil servise kondu: `deleteFeedItemsRouted` öğeleri tipine göre ayırıp doğru uca gönderiyor, iki hook da onu çağırıyor. Kopyalansaydı biri güncellenip diğeri unutulurdu (`AI_RULES` §2.5). Bu, planda Faz 4'e yazılmıştı; mantık katmanı kararı olduğu için Faz 3'e alındı.

### Yeni: `hooks/useMediaReviews.ts`
Dizi/film detay sayfasının "KaymakTV İncelemeleri" bölümünün veri hook'u — `hooks/useComments.ts` (Trakt Topluluğu bölümü) ile aynı ekranda YAN YANA çalışacak. Liste + kendi incelemem ayrımı, beğeni toggle'ı (iyimser + geri alma), yaz/güncelle/sil, yarış koruması, hata durumu ("Tekrar Dene", sessiz boş liste YOK).

`canSubmit`, `tmdbId` çözülene kadar false — `tmdb_id` olmadan Worker da DB CHECK'i de reddederdi; kullanıcıyı butona bastırıp hata göstermek yerine erkenden pasif tutmak doğrusu (üç katmanlı doğrulama). **Plandan sapma:** hook adı `useShowReviews` yerine `useMediaReviews` — hem dizi hem filme hizmet ediyor, "show" yanıltıcı olurdu.

### `feedApi.ts` — yeni okuma deseni
`fetchMediaReviews(showId, mediaType)`: akışın bugüne kadar hiç yapmadığı "kullanıcıya göre değil YAPIMA göre" filtreleme (018'deki `idx_feed_reviews_by_media` tam bunun için). **Takip filtresi bilinçli olarak YOK** — bir yapımın inceleme listesi herkese açık (Letterboxd mantığı), akıştan farklı bir görünürlük modeli.

**Engel filtresi beşinci okuma noktası olarak eklendi** (`FEED_SOCIAL_PLAN` §4.3 dördünü sayıyordu). Akıştan farklı olarak küme çıkarma yapılamıyor (burada sonlu bir "görünür kullanıcılar" listesi yok), bu yüzden dışlama sorguya taşındı — bellekte filtrelemek 20'lik sayfa kotasını engellenen kayıtlarla harcardı.

### `types.ts` + `FeedCard`
`'reviewed'` tipi, `traktCommentId` alanı, `isReviewActivity` guard'ı. `FeedCard.ACTIVITY_META`'ya bir satır — dosyanın kendi yorumunun ("yeni bir tip eklemek bu map'e bir satır eklemek kadar basit olacak şekilde tasarlandı") doğrulandığı yer; tip sistemi eksik satırı derleme hatasıyla yakaladı.

### Değişen dosyalar
**Yeni:** `features/feed/services/feedReviews.ts`, `hooks/useMediaReviews.ts`.
**Değişen:** `features/feed/types.ts`, `features/feed/services/feedApi.ts`, `features/feed/hooks/{useFeed,useUserActivity}.ts`, `features/feed/components/FeedCard.tsx`, `docs/REVIEWS_PLAN.md`.

### Doğrulama
`npx tsc --noEmit` temiz; `--noUnusedLocals --noUnusedParameters` SIFIR bulgu. Döngüsel import kontrolü: `feedApi` → `feedReviews` bağı YOK (tek yön). **Doğrulanamayan:** uçlar canlı Trakt token'ı + deploy edilmiş Worker + çalıştırılmış 018 migration'ı gerektiriyor; ayrıca henüz bu hook'ları çağıran bir ekran yok (Faz 4). Gerçek doğrulama Faz 4'ten sonra cihazda yapılacak.

### Sonraya bırakılan
S6 `docs/REVIEWS_PLAN.md` "SONRA BAKILACAKLAR"a eklendi: `deleteFeedItemsRouted` karışık listede kısmi başarısızlık bırakabilir — bugün erişilemez (Madde 161'de toplu silme arayüzü kaldırıldı, `deleteItems` yalnızca tek öğeyle çağrılıyor), ama toplu silme geri gelirse canlanır.

---

## 168. İnceleme Entegrasyonu Faz 4 — UI: Dizi/Film Sayfasında İki Bölümlü Yapı

**Bağlam:** `docs/REVIEWS_PLAN.md` Faz 4. Faz 1-3: Madde 165-167.

### Üç yeni bileşen — `components/reviews/`
- **`MediaReviewsSection.tsx`** — "KaymakTV İncelemeleri" bölümü. Kendi incelemem her zaman en üstte (kullanıcı kendi yazdığını listede aramasın), altında başkalarınınki. Dört ayrı durum: yükleniyor / hata+"Tekrar Dene" / boş / dolu — "yüklenemedi" ile "henüz yok" **ayrı** gösteriliyor (Madde 142'de Akış için çözülen aynı sessiz-yalan sorunu).
- **`ReviewItem.tsx`** — tek inceleme satırı. Görsel dil `FeedCommentItem` ile bilinçli olarak aynı (ikisi de "birinin yazdığı metin" birimi); ayrı bileşen olmalarının tek sebebi veri tipi (`FeedActivity` vs `FeedComment`). Spoiler perdesi, beğeni, "⋯" menüsü (kendi incelemende Düzenle/Sil, başkasınınkinde Bildir/Engelle).
- **`WriteReviewSheet.tsx`** — yazma/düzenleme. Mevcut metni **Trakt'tan** okuyor (`useMyMediaComment`), Supabase'den değil: kullanıcı incelemesini Trakt web'den yazmış olabilir, o durumda bizde satır yok ama Trakt'ta metin var — boş kutuyla üzerine yazmasını önlüyor.

### 🔀 Plandan sapma: `WriteCommentSheet` "uyarlanmadı", DEĞİŞTİRİLDİ
Plan "inceleme moduna uyarlanması" diyordu. Dosya 380 satır ve kendi Trakt yükleme/gönderme/silme mantığını taşıyor; içine ikinci bir yazma hedefi, ikinci bir silme hedefi ve ikinci bir karakter sınırı koymak koşullu bir yumak üretirdi (`AI_RULES` §1). Bunun yerine ekrana göre ayrıldı:
- **Dizi/film sayfaları** → `WriteReviewSheet` (dual-write, Trakt + Supabase)
- **Bölüm sayfaları** → `WriteCommentSheet` (Trakt-only, DEĞİŞMEDİ)

Bölüm incelemeleri zaten v1 kapsamı dışında (karar 3), yani ayrım kapsam kararıyla birebir örtüşüyor ve "iki kapı" sorunu oluşmuyor. `MyInlineComment` de dizi/film sayfalarından kaldırıldı — işlevini `MediaReviewsSection` üstlendi. **İkisi de ölü kod DEĞİL**, bölüm sayfasında yaşamaya devam ediyor (doğrulandı).

### ⚠️ Kopan bağlantı yakalandı (`AI_RULES` §2.5 durum c)
`WriteCommentSheet` kaldırılınca `refreshComments`/`refreshData` boşta kaldı ve `--noUnusedLocals` bunları "ölü" gösterdi. **Silinmedi:** otopsi, bunun kazara kopmuş GERÇEK bir bağlantı olduğunu gösterdi — inceleme Trakt'a da yazıldığı için aynı ekrandaki "Trakt Topluluğu" listesi de bayatlıyor, eskiden `onSuccess` bunu tazeliyordu. Silmek sessiz bir gerileme olurdu. `MediaReviewsSection`'a `onPublished` prop'u eklenip yeniden bağlandı ("önce bağla, sonra temizle").

### Ekran yapısı
`app/show/[id].tsx` + `app/movie/[id].tsx`: "KaymakTV İncelemeleri" (yeni, sosyal) → "Trakt Topluluğu" (mevcut önizleme, yalnızca başlığı değişti). Birleşik liste reddedildi (REVIEWS_PLAN §4.2). `tmdbId` artık `showData?.ids?.tmdb ?? URL param` ile çözülüyor — inceleme satırında zorunlu olduğu için (018 CHECK) URL'de yoksa Trakt özetinden alınıyor; çözülene kadar yazma butonu pasif + "Yapım bilgisi yükleniyor…" notu.

### Değişen dosyalar
**Yeni:** `components/reviews/{MediaReviewsSection,ReviewItem,WriteReviewSheet}.tsx`.
**Değişen:** `app/{show,movie}/[id].tsx`, `utils/commentValidation.ts` (`MAX_REVIEW_CHARS`), `locales/{tr,en}/media.json` (14 anahtar, ikisi de senkron — doğrulandı), `docs/REVIEWS_PLAN.md`.

### Doğrulama
`npx tsc --noEmit` temiz; `--noUnusedLocals --noUnusedParameters` SIFIR bulgu. Web bundle derlendi, `/show/1388` ekranı **JS hatası olmadan mount oldu** (konsoldaki hatalar yalnızca bu ortama özgü Trakt CORS engeli — Madde 164'teki aynı sınırlama; bu yüzden ekran "Dizi bilgisi bulunamadı" durumunda kaldı ve inceleme bölümü render EDİLEMEDİ).

**Canlı Supabase'e karşı sorgu doğrulaması yapıldı** (asıl riskli kısım): (A) `fetchMediaReviews`'in ürettiği sorgu → 200, (B) `user_id=not.in.(...)` blok filtresi sözdizimi → 200, (C) **yeni `trakt_comment_id` kolonuyla ana akış sorgusu → 200, 3 satır** — yani `ACTIVITY_COLUMNS` değişikliği mevcut akışı BOZMUYOR. 018 migration'ının canlıda çalıştırılmış olduğu da bu sayede doğrulandı.

**Doğrulanamayan:** inceleme yazma/silme akışının uçtan uca çalışması, Worker deploy'u + gerçek Trakt oturumu gerektiriyor — gerçek cihazda test edilmeli.

### Sonraya bırakılanlar
`docs/REVIEWS_PLAN.md` "SONRA BAKILACAKLAR"a iki madde eklendi: **S7** (kendi incelemen aynı ekranda iki bölümde birden görünüyor — çözüm önerisi: Trakt bölümünden `trakt_comment_id` ile ele) ve **S8** 🔴 (dizi/film sayfasında yorum karakter sınırı 10000→1000 daraldı; bölüm sayfası hâlâ 10000, **tutarsız** — S1 kararına bağlı).

---

## 169. İnceleme Entegrasyonu Faz 5 — Dokümantasyon Senkronizasyonu

**Bağlam:** `docs/REVIEWS_PLAN.md` Faz 5, son faz. Faz 1-4: Madde 165-168. `AI_RULES` §3'ün "her özellik sonrası `docs/` güncellenmeli" kuralının gereği.

### `docs/feed.md` — akışın ana dokümanı
Aktivite tipleri 6 → **7** (`reviewed`), şema bloğuna `trakt_comment_id` + 018'in kısıt/indeks özeti, migration tablosuna 018 satırı, "İlgili Dosyalar"a inceleme katmanı. İki yeni "bilinçli olarak YOK" maddesi eklendi (bölüm incelemesi, inceleme senkronu) — ikisi de kapsam kararıydı, eksiklik değil.

**Yeni mimari karar bölümü — "2️⃣.5 Worker artık Trakt'a YAZIYOR":** Worker'ın bugüne kadar Trakt'ı yalnızca okuduğu, incelemeyle birlikte ilk kez yazdığı, sıranın (önce Trakt sonra Supabase) neden pazarlığa kapalı olduğu ve dedup anahtarının neden damga değil `trakt_comment_id` olduğu kaydedildi. Veri kaynağı tablosuna iki satır: inceleme = dual-write, yanıtlar = yalnızca Supabase.

Yol haritasına iki ertelenmiş madde: **inceleme senkronu** (anahtar ve desen hazır; eklenirken `on_conflict` DEĞİL "oku-karşılaştır-yaz" kullanılmalı — Madde 89 tuzağı) ve **bölüm incelemesi**.

### `docs/FEED_SOCIAL_PLAN.md` — engel filtresi 4 → 5 okuma noktası
§4.3'e beşinci nokta (dizi/film sayfasındaki inceleme listesi) eklendi. Sadece sayı artışı değil: bu noktanın diğer dördünden **yapısal olarak farklı** olduğu da yazıldı — orada "görünür kullanıcılar" sonlu bir kümedir ve engellenenler çıkarılır (`Set.delete`), burada herkes görünür olduğu için dışlama SORGUYA taşınmak zorunda (`user_id=not.in.(...)`). §7'ye "sonradan değişenler" notu: dokümanın "yorumlar Trakt'la karışmaz" ifadesi artık YANITLAR için geçerli, çünkü akışta Trakt'ta da yaşayan bir tip var.

### `docs/ARCHITECTURE.md` — iki eksik kapatıldı
Klasör ağacında **`features/` hiç yoktu** (proje aylardır kullanıyor) — dört alt modülüyle eklendi. Yeni "D. Yatay Katman mı, Dikey Feature mı?" bölümü: ayrımın kuralı (birden fazla ekranın paylaştığı → yatay, tek özelliğe ait → `features/`) ve sınırda kalan durumlar için karar ölçütü ("ikinci tüketici çıktığı AN yatay klasöre taşınır" — `useMyMediaComment` bu şekilde doğdu).

### 🔴 `docs/notifications.md` — kendi değişikliğimin yarattığı bayatlama
Madde 165'te silinen beş push-token stub'ı bu dokümanda **"mevcut iskelet, içi doldurulacak"** diye 7 ayrı yerde anılıyordu. Düzeltilmeseydi bir sonraki geliştirici olmayan dosyaları arayacaktı. Başa açık bir uyarı bloğu eklendi: hangi dosyaların silindiği, NEDEN silindiği (`AI_RULES` §2.5 — bağlanmamış kod), neyin hâlâ CANLI olduğu (`NotificationBadge` + `notificationStore` + `/notifications` ekranı — push'suz aktivite bildirimleri, bu işe hiç bağlı değil) ve dokümanın geri kalanının nasıl okunması gerektiği. Tasarımın kendisi geçerli olduğu için içerik yeniden yazılmadı.

### `docs/REVIEWS_PLAN.md` — plandan tasarım kaydına
`FEED_SOCIAL_PLAN.md`'nin geçtiği dönüşümün aynısı: başlık "MİMARİ PLAN" → "TASARIM KAYDI", durum bloğu güncellendi, kalan tek elle adım (`wrangler deploy`) ve açık kalan kararların (S1-S8) yeri başa taşındı.

### Değişen dosyalar
`docs/{feed,FEED_SOCIAL_PLAN,ARCHITECTURE,notifications,REVIEWS_PLAN}.md`. Kod DEĞİŞMEDİ.

### Doğrulama
`npx tsc --noEmit` temiz (kod değişmediği için beklenen). Dokümanlar arası dahili bağlantılar tarandı — REVIEWS_PLAN/feed.md/FEED_SOCIAL_PLAN çapraz atıfları geçerli (HISTORY'deki iki "kopuk" sonuç, parantezli yol ve `:37` satır soneki yüzünden regex artefaktı, gerçek bağlantı değil).

### İnceleme özelliğinin genel durumu
Faz 1-5 tamamlandı. **Kalan tek elle adım: `npx wrangler deploy`** — bu yapılmadan `/feed/review` uçları canlıda yok ve inceleme yazma çalışmaz. 018 migration'ı canlı Supabase'de doğrulandı (Madde 168). Uçtan uca test (gerçek Trakt oturumu + cihaz) hâlâ yapılmadı. Açık kararlar: `docs/REVIEWS_PLAN.md` "SONRA BAKILACAKLAR" S1-S8, en kritiği **S8** (karakter sınırı tutarsızlığı).

---

## 170. STRATEJİK PİVOT — Trakt'a Yazmayı Bırakma Kararı (analiz + yeni plan, kod yazılmadı)

**Tetikleyici:** Kullanıcı bildirdi — Trakt API ücretlendirmeye geçiyor. Soru: "devam mı edelim, yoksa git'ten geri dönüp baştan mı yazalım?"

### Ölçüm önce, tavsiye sonra
Karar vermeden önce canlı sistem ölçüldü; üçü de sonucu değiştirdi:
- **Canlı `reviewed` satırı: 0** → pivotun veri göçü maliyeti YOK
- **Worker `/feed/review`: deploy edilmiş ama hiç kullanılmamış** (boş gövdeyle probe → 400 "traktAccessToken zorunlu", yani yeni sürüm canlıda)
- **Faz 4 UI: commit edilmemiş, build alınmamış** → hiçbir kullanıcı ulaşamıyor

Sonuç: **mümkün olan en temiz pivot anı.** Buradan çıkan tek acil operasyonel karar — pivot bitene kadar build DAĞITILMAMALI, aksi halde Trakt'ta gerçek yorumlar oluşur ve temiz sayfa kaybolur.

### Tavsiye: devam, baştan yazma
Pivot bir yeniden yazım değil **çıkarma** işlemi — yazılanın ~%70'i aynen kalıyor. Git'ten geri dönmenin somut bedeli: **R1** (retention elle yazılmış içeriği siliyordu), **R11** (gizlilik açılınca gönderiler yok oluyordu) ve **R6** (`posted` çift kart) düzeltmelerini geri getirmek. Üçünün de Trakt'la ilgisi yok; ikisi canlı veri kaybı hatasıydı. Kullanıcı bu gerekçeyle geri dönüşü reddetti.

### 🔴 Ana uyarı: pivot sistemi KURTARMIYOR
Kod tabanındaki Trakt kullanımı sayıldı: **30+ uç nokta.** Yorumlar en küçük dilim (~5). Gerçek kritik bağımlılıklar: kimlik/giriş (OAuth tek yol), `/users/me/following` (akışın görünürlük modelinin tamamı), `/sync/*` (dizi takibinin kendisi). İncelemeleri koparmak doğru bir ilk adım ama tek başına yetmiyor — bağımsızlık için öncelik sırası plana yazıldı (en üstte: `tmdb_id`'yi tüm aktivite tiplerine yaymak; incelemede zorunlu tutma kararı tam da bu senaryo içindi ve karşılığını verdi).

### Kullanıcının planındaki iki kör nokta bulundu ve kabul edildi
1. **Bölüm sayfası sızıntısı:** "Trakt'a yazmıyoruz" deniyordu ama `app/episode/[id].tsx` hâlâ `WriteCommentSheet` ile doğrudan Trakt'a yazıyordu. → Bölüm incelemeleri de Supabase'e alınacak, **ama ana akışa düşmeyecek** (spam kuralı korunuyor).
2. **Birleşik listenin yarattığı YENİ çift kayıt:** aynı kişinin hem KaymakTV incelemesi hem Trakt yorumu varsa tek listede yan yana çıkar. → `users.trakt_slug` ↔ `comment.user.ids.slug` eşleşmesiyle tekilleştirme (tek `Set.has()`, ek istek yok).

### Sayfalama/sıralama — karmaşıklık ölçekle çözüldü
Gerçek interleave iki imleçli merge-sort ister (kırılgan, test edilmesi zor). Ölçek bunu gereksiz kılıyor: bir yapımda bizim inceleme sayımız uzun süre 0-2, Trakt'ınki yüzlerce olacak. Çözüm **"tek akış, iki blok"**: kullanıcı kesintisiz tek liste görür, teknik olarak üstte bizim blok (sayfalama gerekmiyor), altta Trakt bloğu mevcut sayfa-bazlı sayfalamasıyla — `useComments.loadMore` hiç değişmiyor. Birleşik "beğeniye göre sırala" matematiksel olarak anlamsız olduğu için (iki farklı evrenin sayıları) `CommentSortBar` yalnızca Trakt bloğunu yönetecek.

### 🆕 Google girişi bilgisi → en kritik bulguyu açtı (S9)
Kullanıcı "yakında Google ile giriş ekleyeceğim" dedi. Tarama sonucu: `002_fix_user_identity.sql` → `users.trakt_slug TEXT UNIQUE NOT NULL` ve Worker'daki **13 uç noktanın hepsi** `traktAccessToken` zorunlu tutuyor. **Google ile giren kullanıcı bugün hiçbir şey yazamaz — satırı bile oluşturulamaz.** Çözüm yönü plana yazıldı (trakt_slug nullable + `auth_provider`/`google_sub` + Worker'da `verifyAndUpsertUser` → sağlayıcıdan bağımsız `resolveCaller`; 13 ucun gövdesi değişmez çünkü hepsi zaten dönen `userId`'yi kullanıyor). İyi haber: istemcide `getMySupabaseUserId()` zaten var, altyapı yarı hazır.

### Temizlik zinciri haritalandı
Trakt'a yazmayı bırakmak bir ölü kod zinciri bırakıyor: `WriteCommentSheet.tsx` (~370), `MyInlineComment.tsx` (227), `hooks/useMyMediaComment.ts` (~115) tamamen ölüyor; `services/api/comments.ts`'in yazma yarısı (`addComment`/`updateComment`/`deleteComment`/`addCommentReply`/`getUserComments`) siliniyor, dosya salt-okuma servisine iniyor; Worker'da `traktFetch` GET-only'ye geri dönüyor; istemcide `deleteFeedItemsRouted` gereksizleşiyor. **İroni:** `useMyMediaComment` Madde 165'te yinelenmeyi gidermek için oluşturulmuştu, pivot iki tüketicisini de öldürdüğü için kendisi de ölüyor.

### Yeni: `in_feed` türetilmiş kolon
"Bölüm incelemeleri akışa düşmesin" kuralı için elle bayrak yerine
`GENERATED ALWAYS AS (NOT (activity_type='reviewed' AND episode_number IS NOT NULL)) STORED`.
Gerekçe `008_drop_feed_hidden.sql`'in dersi: elle yönetilen bayrak senkron dışı kalıp çelişir. Ayrıca akış sorgusundaki hassas keyset `.or(...)` ifadesine ikinci bir bileşik koşul eklemek onu kırma riski taşıyordu; tek `.eq('in_feed', true)` hem güvenli hem okunur.

### Denetim (kullanıcı "her şeyi dahil et, iyice araştır" dedi)
**Temiz:** `.env` ve `dist/` git dışı, kodda kalıntı TODO/FIXME yok, `tsc` sıfır bulgu.
**🟠 S10:** 400 satır kuralını **17 dosya** ihlal ediyor — en büyükleri `services/api/users.ts` (963), `app/(public)/download.web.tsx` (861), `index.web.tsx` (753), `services/library/fetchers.ts` (733). Bu turun yolunda olanlar: `app/episode/[id].tsx` (551), `FeedCard.tsx` (527), `feedApi.ts` (494), `app/show/[id].tsx` (412). Ayrı bir refactor turu hak ediyorlar.

### Doküman
`docs/REVIEWS_PLAN.md` **baştan yazıldı** (v2 — Trakt'tan Kopuş): 13 bölüm + 8 fazlık eylem planı + güncellenmiş SONRA BAKILACAKLAR (S1-S10). Ara belge olarak oluşturulan `docs/REVIEWS_PIVOT.md` içeriği plana katılıp **silindi** — iki ayrı doküman hangisinin geçerli olduğunu belirsizleştirirdi (`AI_RULES` §2.5'in "iki kopya bırakma" ilkesi dokümanlar için de geçerli).

**Pivotun yan kazancı:** S2, S3, S4, S6 kendiliğinden kapanıyor; S1, S7, S8 plandaki fazlarda çözülüyor. Açık kalanlar: S5 (pivotla ilgisiz), S9 (Google kimlik), S10 (dosya boyutları).

### Kod DEĞİŞMEDİ
Bu madde yalnızca analiz ve plan. Uygulama P0'dan (build dağıtmama) başlayacak.

---

## 171. v2 P1 — Worker Sadeleştirme + `019` Migration + S5 Düzeltmesi

**Bağlam:** `docs/REVIEWS_PLAN.md` v2, P1. Trakt'a yazma tamamen sökülüyor.

### Kullanıcının sorusu: "Trakt bloğu çökerse sayfa beyaz ekran olur mu?"
Doğrulandı, iddia edilmedi:
- **Veri hatası korunuyor.** `useShowDetail`/`useMovieDetail` yorumları `Promise.allSettled` ile çekiyor, tazeleme yollarında ayrı `.catch(() => {})` var. Faz 4 doğrulamasında bu ortamda TÜM Trakt çağrıları CORS'a takıldı ve sayfa beyaz ekran vermedi — canlı kanıt. UI'da blok zaten `if (!commentsData || length === 0) return null` ile sessizce gizleniyor (Karar 4 bugün de sağlanıyor).
- **🟡 Render hatası korunmuyor.** Projede Error Boundary VAR (`app/_layout.tsx`, Expo Router konvansiyonu) ama **kök seviyede** — bir render istisnası tüm ekranı fallback'e düşürür, "sadece o blok kaybolsun" olmaz. P3'te blok bazlı `SectionErrorBoundary` eklenecek. Plandaki "kademeli çöküş" iddiası şu an veri katmanı için doğru, render katmanı için değildi; düzeltildi.

### `019_reviews_local_only.sql`
- **`note` sınırı 1000 → 5000** (S1 + S8). Trakt'ın 5 kelime minimumu kalktığı gibi maksimum da tamamen bizim kararımız oldu. Üç yer aynı turda senkronlandı: DB CHECK, Worker `MAX_NOTE_LENGTH`, istemci `MAX_REVIEW_CHARS`.
- **`in_feed` TÜRETİLMİŞ kolon** — `GENERATED ALWAYS AS (NOT (activity_type='reviewed' AND episode_number IS NOT NULL)) STORED`. Bölüm incelemeleri ana akışa düşmez. Elle bayrak yerine türetilmiş kolon seçilme gerekçesi `008_drop_feed_hidden.sql`'in dersi; ayrıca akış sorgusundaki hassas keyset `.or(...)` ifadesine ikinci bileşik koşul eklemek onu kırma riski taşıyordu.
- Bölüm incelemeleri için **ek şema değişikliği gerekmedi** — 018'deki unique index zaten `COALESCE(episode_number,'')` içeriyordu ("ileride açılmak istendiğinde migration gerekmesin" diye bilinçli konmuştu; o gün geldi ve gerçekten gerekmedi).

### Worker: 2495 → 2323 satır
- `handleFeedReview` **yeniden yazıldı**: Trakt POST/PUT, 409 kurtarma, `findMyTraktComment`, `traktWriteErrorMessage`, `traktOk` modeli ve `MIN_REVIEW_WORDS` **söküldü**. Kazanç: tek yazma hedefi = kısmi başarısızlık durumu YOK.
- **`handleFeedReviewDelete` + `/feed/review/delete` rotası KALDIRILDI** — silme artık sıradan `/feed/delete`.
- **`traktFetch` GET-only'ye geri döndürüldü.** `method`/`body` parametresi bilerek yok: biri Trakt'a yazma ihtiyacı duyarsa bu kısıtla karşılaşıp önce mimari kararı okusun, sessizce yeniden bağımlılık oluşmasın.
- **Bölüm incelemesi desteği:** opsiyonel `episodeNumber` (`S01E02` regex + film ise reddet). `fetchExistingReview` artık `episode_number` ayrımı yapıyor — **NULL için `is.null`, dolu için `eq.`**; bu ayrım atlanırsa genel inceleme hiç bulunamaz ve her düzenleme unique index'e çarpardı.
- Rate limit 10 → 20/dk (artık Trakt kotasını korumuyor).
- Tombstone filtresi `'posted'` → `['posted','reviewed']`: inceleme artık yalnızca bizde yaşadığı için geri getirebilecek senkron yolu yok.

### ✅ S5 düzeltildi (kullanıcı isteği: "uygun bir aralıkta eritilsin")
`handleFeedPrivacy`, `publishWatches=false` olduğunda yalnızca `watched_episode` siliyordu; `watched_movie` akışta kalıyordu. Oysa `handleFeedSync` AYNI bayrağı okuyup ikisini birden siliyor — iki kod yolu aynı kullanıcı ayarını farklı yorumluyordu. Sonuç: "izlediklerimi paylaşma" diyen kullanıcının izlediği FİLMLER akışta görünmeye devam ediyordu. Artık döngüyle iki tip birden siliniyor.

### 🔒 Güvenlik denetimi (kullanıcı sordu)
**Sağlam çıkanlar (canlı test dahil):**
- **Anon key ile YAZMA denemesi → HTTP 401, reddedildi.** RLS modeli çalışıyor.
- **PostgREST enjeksiyonu yok:** URL'e gömülen her kullanıcı girdisi önce doğrulanıyor (UUID'ler `UUID_RE`, `showId` `Number.isFinite && >0`, `mediaType` beyaz liste, yeni `episodeNumber` regex **+ `encodeURIComponent`**). `table`/`ownerColumn`/`onConflict` kod içi sabit.
- IDOR: sahiplik her zaman `WHERE user_id = <doğrulanan çağıran>`.
- `service_role` anahtarı yalnızca Worker ortamında; `.env`/`dist` git dışı.
- **Trakt yazma yüzeyi tamamen kapandı** — Worker artık Trakt'ta hiçbir şeyi değiştiremez.

**🟠 S11 (YENİ, açık):** `users_select_all USING (true)` nedeniyle anon key'i olan herkes (anahtar istemci bundle'ında olduğundan: herkes) tüm kullanıcı listesini çekebiliyor. Canlı doğrulandı — 5 kullanıcının `trakt_slug`, `username`, **`is_private`, `publish_watches`** alanları döndü. Kritik nokta: **gizlilik AYARLARININ kendisi herkese açık.** Şiddet düşük-orta (yazma yok, Trakt kullanıcı adları zaten public) ama ölçek büyüdükçe kim-KaymakTV-kullanıyor ve kim-ne-gizliyor çıkarılabilir. Postgres RLS kolon seviyesinde çalışmadığı için çözüm ya ayrı `user_settings` tablosu (önerilen) ya kısıtlı VIEW. **Pivotun yarattığı bir açık değil — `001`'den beri var**, P1 taramasında ortaya çıktı.

### Doğrulama
Worker `node --check` temiz; 14 rotanın tamamı tanımlı fonksiyona bağlı; kalıntı referans taraması boş (`handleFeedReviewDelete`, `findMyTraktComment`, `traktWriteErrorMessage`, `MIN_REVIEW_WORDS`, `traktOk` — yalnızca açıklayıcı yorumlarda geçiyor); tüm `traktFetch` çağrıları 3 argümanlı (GET). İstemci `npx tsc --noEmit` temiz.

**⚠️ Beklenen geçici tutarsızlık:** istemcideki `feedReviews.deleteReview` hâlâ kaldırılan `/feed/review/delete` ucunu çağırıyor. P2 bunu düzeltecek. Kullanıcıya ulaşan bir build olmadığı için (Faz 4 UI commit edilmemiş) canlıda etkisi yok — ama **P2 tamamlanmadan build alınmamalı.**

### Elle adımlar (bu sırayla)
1. `supabase/schema/019_reviews_local_only.sql` → Supabase SQL Editor
2. `cd "C:\Yapay_Zeka_Uygulamalar\kaymaktv-feedback-worker" && npx wrangler deploy`

---

## 172. Plan v2 Genişletildi — 4 Yeni Risk, Migration Çakışması Düzeltmesi, Oturumlar-Arası Devir Formatı

**Kullanıcı isteği:** Kendi tespit ettiği 4 riski plana dahil etmek + *"Büyük ihtimal çok fazla oturum kullanacağım, tek oturumun süresi yetmeyecek — o yüzden plan dosyasını detaylıca oluştur."*

### Format değişikliği: plan artık bir DEVİR belgesi
`docs/REVIEWS_PLAN.md` yeniden yapılandırıldı. Yeni oturum (veya başka bir geliştirici/asistan) sıfır bağlamla devam edebilsin diye başa iki bölüm kondu: **§0 Durum Panosu** (faz tablosu + bekleyen elle adımlar + bilinen geçici tutarsızlık) ve **§0.1 Yeni Oturuma Nasıl Devam Edilir** (doğrulama komutları + "bu projede kolay unutulan 6 şey": migration'ların elle çalıştırılması, `on_conflict` tuzağı, Supabase Auth'un olmayışı, karakter sınırının üç yerde senkron olması, oturum izolasyonu, `activity_at` sabitliği).

### 🔴 Kendi hatam yakalandı: MIGRATION NUMARA ÇAKIŞMASI
Madde 165'te oluşturduğum `018_feed_reviews.sql`, projede zaten var olan **`018_content_reports.sql`** ile çakışıyordu — aynı numara, belirsiz çalıştırma sırası. Yeniden adlandırıldı:
- `018_feed_reviews.sql` → **`019_feed_reviews.sql`** (canlıda ZATEN çalıştırılmış; dosya başına numara-düzeltme + "yeniden çalıştırma gerekmiyor" notu eklendi)
- `019_reviews_local_only.sql` → **`020_reviews_local_only.sql`** (henüz çalıştırılmadı)

Koddaki atıflar da güncellendi (`feedApi.ts`, `types.ts`, `feed.md`). **`HISTORY.md`'ye dokunulmadı** — tarihsel kayıt geriye dönük düzeltilmez (Madde 164'teki kural); eski maddelerde `018_feed_reviews` adı geçmeye devam ediyor, bu madde bağlantıyı kuruyor. Repoda `010` ve `012`'de de eski çakışmalar var (dokunulmadı, ikisi de çalıştırılmış) — plana "yeni migration eklerken son numarayı kontrol et" uyarısı yazıldı.

### Kullanıcının 4 riski — hepsi doğrulandı, ikisi tahminden İYİ, biri KÖTÜ çıktı

**1. 🔴 Senkron yükleme tuzağı — RİSK DEĞİL, MEVCUT HATA (S12).**
Kullanıcı "`Promise.all` kurulursa Trakt yavaşlığı bizi de bekletir" diye uyardı. Kod okundu: `hooks/useShowDetail.ts:66` **zaten** `getMediaComments`'i bloklayan `Promise.allSettled` batch'inin içinde tutuyor — yani dizi sayfasının özeti, sezonları ve tüm ekranı bugün Trakt'ın yorum ucunu bekliyor. `useMovieDetail`'de aynı desen. Yani sorun gelecekte değil, şu an yaşanıyor. İyi haber: bizim taraf zaten bağımsız (`useMediaReviews` kendi isteğini atıyor) ve aynı dosyada satır ~128'de doğru desen (`.then().catch()`) tazeleme için ZATEN var. P3'e alındı.

**2. 🔴 Hesap birleştirme (S14) — en pahalı gelecek hatası.**
Spotify/Facebook örneği yerinde. Plana detaylı akış yazıldı. Kritik tasarım kuralları: tek `users` satırı = tek kimlik, `trakt_slug`/`google_sub` iki **bağlantı kolonu** → birleştirme = bağlantıyı taşımak, içeriği taşımak değil · **asla yalnızca e-postaya bakıp otomatik birleştirme** (Trakt e-postası bizce doğrulanmamış → hesap ele geçirme riski) · köprü **ilk girişte** gösterilmeli, kullanıcı içerik üretmeden önce · yine de iki satır oluşursa birleştirmede **unique kısıt çakışmaları** (aynı yapıma iki hesaptan inceleme) önceden karara bağlanmalı.

**3. 🟢 Moderasyon — tahmin edilenden ÇOK daha iyi durumda.**
Kullanıcı "V2'de rapor butonu koymalıyız" dedi; keşif: **altyapı zaten var.** `018_content_reports.sql` tam bir şema kuruyor (target_type `activity`/`comment`/**`trakt_comment`**, reason enum'u, status akışı, iki indeks) ve RLS'te **INSERT politikası var** — projede istemcinin doğrudan yazabildiği tek tablo. UI **7 bileşene bağlı** (yeni `ReviewItem` dahil). Eksik olan tek şey **otomatik gizleme**.

**⚠️ Ama otomatik gizlemeden önce kapatılması gereken bir açık bulundu (S15):** `content_reports`'ta `UNIQUE(reporter_user_id, target_type, target_id)` YOK ve `reporter_user_id` nullable. Bugün "5 rapor alan gizlensin" eklenirse **tek kişi aynı içeriği 5 kez raporlayıp istediği yorumu sansürleyebilir.** Sıra şart: UNIQUE + reporter zorunlu → sayaç → otomatik gizleme.

**4. 🟡 TMDB görsel bağımlılığı (S16) — azaltıcı önlem yarı kurulu.**
`expo-image@~3.0.11` **zaten kurulu** ama yalnızca 4 dosyada kullanılıyor; **12 dosya** hâlâ React Native `Image` (önbelleksiz) ve `cachePolicy="disk"` sadece 2 yerde. Kullanıcı "acil değil" dedi, ertelendi — ama ucuz önlem net: görsel gösteren yolları `expo-image` + disk önbelleğine çevirmek yeni altyapı gerektirmiyor.

### Plan yapısı
13 bölüm + 16 maddelik açık listesi (S1-S16) + 8 fazlık yol haritası. Fazlar arası **sıra bağımlılıkları** açıkça işaretlendi (en kritiği: `WriteCommentSheet`/`MyInlineComment`/`useMyMediaComment` **P4'ten önce silinemez**, bölüm sayfası hâlâ kullanıyor).

### Kod değişmedi
Bu madde plan + migration yeniden adlandırma + atıf düzeltmeleri. `npx tsc --noEmit` temiz.

---

## 173. S12 (Performans) + P2 (İstemci Sadeleştirme) + Tünel Problemi

**Kullanıcı kararı:** S12'yi P2'nin önüne al; ayrıca 5000 karaktere çıkan sınır nedeniyle "emek kaybolmasın" mekanizmasının korunduğundan emin ol.

### 🔴 S12 — Trakt yorumları artık ekranı BLOKLAMIYOR
**Hata neydi:** `useShowDetail`/`useMovieDetail`'in önbellek-**ıska** yolu `getMediaComments`'i bloklayan `Promise.allSettled` batch'inin İÇİNDE tutuyordu. `allSettled` hepsinin bitmesini beklediği için, Trakt'ın yorum ucu yavaşladığında dizinin ÖZETİ, SEZONLARI, BENZER YAPIMLARI ve tüm ekran onu bekliyordu.

**Çelişki:** önbellek-**isabet** yolu bunu ZATEN doğru yapıyordu (fire-and-forget). Yani aynı dosyada doğru ve yanlış desen yan yana duruyordu; ilk kez açılan sayfa yavaş, ikinci açılış hızlıydı.

**Düzeltme:** yorum çekimi tek bir `loadCommentsInBackground`/`fetchCommentsInBackground` yardımcısına alındı ve **`loadData`'nın en başında, önbellek okumasıyla PARALEL** başlatılıyor. Her iki yol da artık aynı yardımcıyı kullanıyor (film hook'unda yardımcı zaten vardı ama yalnızca bir dalda kullanılıyordu — mantığın iki kopyası da böylece kalktı).

**Yakalanan yarış durumu:** dizi hook'u önbellek-ıska sonunda `setMediaData({...})` ile nesneyi KOMPLE değiştiriyordu. Yorumlar artık paralel geldiği için bu, o sırada gelmiş yorumları SİLERDİ. Fonksiyonel güncellemeye (`prev => ({...prev, ...})`) çevrildi.

**Yeni:** `isLoadingComments` durumu iki hook'tan da dönüyor — P3'te Trakt bloğu kendi spinner'ını gösterebilsin diye. İlk yüklemede hata olursa boş listeye düşülüyor (blok gizlenir, Karar 10); `refreshComments` hatasında ise MEVCUT yorumlar korunuyor (orada gösterilecek veri var, silmek yanlış olurdu).

### P2 — İstemci sadeleştirme
- **`feedReviews.ts`:** `traktOk` kısmi-başarısızlık modeli **kalktı** (tek yazma hedefi = "ya olur ya olmaz", ara durum yok) · `deleteFeedItemsRouted` **silindi** · `deleteReview` artık `/feed/review/delete` yerine `deleteActivitiesBulk` (`/feed/delete`) çağırıyor, yalnızca yapım-bazlı önbelleği ek olarak temizleyen ince bir sarmalayıcı · `invalidateUserCommentsCache` çağrısı kaldırıldı (o önbellek Trakt'ın yorum listesinindi; inceleme akışı ona artık hiç dokunmuyor — **S2 böylece konusuz kaldı**).
- **`useFeed` / `useUserActivity`:** tipe göre yönlendirme kalktı, ikisi de `deleteActivitiesBulk`'a döndü → **S6 kapandı**.
- **`useMediaReviews`:** `traktOk` dalı kalktı.
- **`WriteReviewSheet`:** Trakt ön-doldurma (`useMyMediaComment`) **söküldü** — tek gerçek kaynak artık kendi satırımız, çağıran `initialBody`/`initialSpoiler` ile geçiyor. Doğrulama `validateComment` (Trakt'ın 5 kelime kuralı) yerine kendi `MIN_REVIEW_CHARS = 3` / `MAX_REVIEW_CHARS = 5000` sınırlarımıza geçti.
- **Çeviriler:** 6 yeni anahtar; `reviewPublishNote` düzeltildi ("hem Trakt'ta hem KaymakTV'de" → artık yalnız KaymakTV — **yanlış bilgi veriyordu**); kullanılmayan `reviewHintValid` ve `reviewLoadedFromTrakt` iki dilden birlikte silindi (`AI_RULES` §2.5). tr/en senkron: 277 anahtar.

### ✅ S17 — Tünel problemi (kullanıcı isteği)
Hata yolu zaten doğruydu ve korundu: `handleSend` başarısızlıkta sheet'i **kapatmıyor**, metni kutuda **bırakıyor**, sebebi ekranda gösteriyor.

**Ama emeğin kaybolduğu İKİNCİ bir yol daha vardı:** kullanıcının yanlışlıkla kapatması (X'e dokunma / Android geri tuşu). 5000 karakterlik bir metin için bu, ağ hatası kadar can sıkıcı. `handleRequestClose` eklendi — yazılmış ve kaydedilmemiş metin varsa önce onay ister; `Modal.onRequestClose` (Android geri tuşu) da bu akıştan geçiyor. Sheet sıfırlaması bilinçli olarak **açılışta** çalışıyor (kapanışta değil) ki hata sonrası state'i temizleyen bir yan etki olmasın.

### Değişen dosyalar
`hooks/{useShowDetail,useMovieDetail,useMediaReviews}.ts` · `features/feed/services/feedReviews.ts` · `features/feed/hooks/{useFeed,useUserActivity}.ts` · `components/reviews/{WriteReviewSheet,MediaReviewsSection}.tsx` · `utils/commentValidation.ts` (`MIN_REVIEW_CHARS`) · `locales/{tr,en}/media.json`.

### Doğrulama
`npx tsc --noEmit` temiz · `--noUnusedLocals --noUnusedParameters` **SIFIR bulgu** · `deleteFeedItemsRouted`/`traktOk` kalıntı taraması temiz (yalnızca açıklayıcı yorumlarda) · çeviri anahtarları tr/en senkron. **Doğrulanamayan:** uçtan uca akış hâlâ gerçek cihaz + `020` migration + Worker deploy gerektiriyor.

### Sıradaki
P3: tek akış iki blok · slug tekilleştirme (S7) · `SectionErrorBoundary` (S13). Asenkron yükleme P3'ten çıkarıldı çünkü S12 olarak erken çözüldü.

---

## 174. Ana Plan (MASTER_PLAN.md) — Program Fazlara Bölündü

**Kullanıcı isteği:** "Yapacağımız her şeyi fazlara böl · kritik yerler ayrıca ele alınsın · belli adımlarda ölü/spagetti/hatalı kod kontrolü yapılsın · bazı adımlarda güvenlik açıkları tespit edilsin."

### Yeni doküman: `docs/MASTER_PLAN.md`
Doküman rolleri netleştirildi: **MASTER_PLAN = "hangi sırayla ve nasıl doğrulayarak"**, diğerleri = "neden böyle tasarlandı". `AGENTS.md`'ye 4. madde olarak eklendi (yeni oturumlar önce oradan geçiyor), `REVIEWS_PLAN.md`'ye çapraz atıf kondu.

### Yapı: 4 iş kolu, 17 faz
- **Kol A — İnceleme sistemini bitir** (F1→F2→K1→F3→G1→F4): build kilidini açan kol
- **Kol B — Trakt'tan bağımsızlık** (F5→F6→K2→F7→F8→G2): stratejik kol
- **Kol C — Moderasyon/UGC** (F9→F10→G3): App Store gerekliliği
- **Kol D — Teknik borç** (F11·F12·F13): paralel

A önce bitmeli (kilit ona bağlı); B ve C paralel yürüyebilir.

### Denetim fazları ayrı birer FAZ yapıldı
K (kalite) ve G (güvenlik) denetimleri bir alışkanlık değil, programın içinde numaralı adımlar. Gerekçe plana yazıldı: bu projede her özellik turu arkasında ölü kod zinciri bırakıyor (v1→v2 pivotu bunun kanıtı) ve yazma yüzeyi her turda değişiyor. `useMyMediaComment` örneği somut: bir turda yinelenmeyi gidermek için oluşturuldu, bir sonraki turda tamamen öldü.

**Kontrol listeleri kopyala-çalıştır komutlarla verildi** — 7 kalite, 4 güvenlik kontrolü + her fazda elle bakılacaklar (IDOR, rate limit, RLS, "yeni kolon mahrem mi").

### Bilinen yanlış alarmlar kaydedildi
Denetim komutlarının her çalıştırmada üreteceği iki **hata olmayan** bulgu, tekrar tekrar araştırılmasın diye plana yazıldı:
1. `feed.json` → `newPosts` (tr) vs `newPosts_one`/`newPosts_other` (en) — **i18next çoğul biçimleri**, Türkçe tek biçim kullanır. Doğru davranış.
2. `tmdbApi.ts` + `library/fetchers.ts`'teki 4 boş `catch` — önbellek ayrıştırma yolları, hata = "önbellek yok". Sessizlik kasıtlı.

### 🟠 Yeni güvenlik bulgusu (G1'de kapatılacak)
`server.js:33` → `process.env.TMDB_API_KEY || process.env.EXPO_PUBLIC_TMDB_API_KEY`

`.env` bugün doğru adı (öneksiz `TMDB_API_KEY`) kullanıyor, yani **aktif sızıntı YOK.** Ama bu fallback birinin `.env`'e `EXPO_PUBLIC_` önekli adı yazmasını davet ediyor — o önek değeri Expo'nun istemci bundle'ına gömmesi demek. **Trakt için aynı fallback Madde 25'te bilinçli olarak kaldırılmıştı** (`ARCHITECTURE.md` §4); TMDB'de gözden kaçmış. Silinecek.

### 4 kritik nokta ayrı başlıkta
Yanlış yapılırsa geri dönüşü pahalı olanlar, her biri **tek başına** ele alınacak şekilde işaretlendi: (1) hesap birleştirme — kullanıcı ikinci hesapta içerik ürettikten sonra iş "iki içerik kümesini birleştirme"ye dönüşür · (2) otomatik gizleme sırası — F9 öncesi F10 canlı bir sansür aracı olur · (3) ilk build dağıtımı — "0 satır" temiz sayfası geri gelmez · (4) kimlik refactor — 13 yazma ucunun tamamı aynı fonksiyondan geçiyor.

### İhlal edilemez sıra bağımlılıkları
`020 → deploy` · `F2 → K1` (bölüm sayfası taşınmadan `WriteCommentSheet` silinemez) · `F1..G1 → F4` · `F7 → F8` · **`F9 → F10`**.

### Kod değişmedi
Bu madde yalnızca plan + doküman bağlantıları. Sıradaki iş: **F1** (inceleme UI: tek akış iki blok).

---

## 175. F1 — İnceleme UI: Tek Akış İki Blok

**Bağlam:** `docs/MASTER_PLAN.md` F1. Kullanıcı ayrıca "plan dosyasının altına yeni bulgular için alan aç" dedi.

### Tek kesintisiz liste
Dizi/film sayfasında Trakt yorumları AYRI bir bölüm olmaktan çıktı; artık `MediaReviewsSection`'ın içinde, kendi incelemelerimizin altında yumuşak bir ayraçla akıyor. Sekme yok, ayrı alan yok.

**Gerçek "interleave" bilinçli olarak YAPILMADI:** iki kaynağı tarihe göre iç içe harmanlamak iki imleçli merge-sort ister. Ölçek gereksiz kılıyor (bir yapımda bizim sayımız uzun süre 0-2, Trakt'ınki yüzlerce) ve bloklar sıralı olunca Trakt'ın mevcut sayfalaması **hiç değişmeden** çalışıyor.

**Kapsam sapması — kayıt için:** Plan `CommentSortBar`'ın ayracın altına taşınmasını öngörüyordu. Yapılmadı: sayfadaki Trakt bloğu bir **önizleme** (3 satır + "Tümünü Gör"), tam sayfalama ve sıralama zaten `CommentSheet`'te. Sıralama çubuğunu önizlemeye taşımak çalışan bir özelliği bozma riski taşıyordu, kazancı yoktu.

### Yeni bileşenler
- **`components/SectionErrorBoundary.tsx` (S13):** blok bazlı hata sınırı. Projede Error Boundary vardı ama **kök seviyede** (`app/_layout.tsx`) — bir render istisnası tüm ekranı fallback'e düşürüyordu. Bu sınıf yalnızca sardığı ağacı yakalıyor. `silent` modunda hiçbir şey çizmiyor (Trakt bloğu için — Karar 10) ama **kayıt yine tutuluyor** (`logError`), aksi halde sürekli çöken bir bölümü kimse fark etmezdi.
- **`components/reviews/TraktCommentRow.tsx`:** salt okunur Trakt satırı. `ReviewItem`'dan ayrı bileşen çünkü etkileşim yüzeyleri tamamen ayrık (beğeni Trakt'ta yaşıyor, yanıt Trakt'a gitmiyor) — tek bileşende `variant` ile birleştirmek aksiyon satırının tamamını koşullu yapıp ikisini de okunmaz kılardı. Emsal: `FeedCommentItem` ↔ `ReviewItem`. **Buton yokluğu bilinçli bir sinyal**; disabled/gri buton gösterilmiyor (bozuk sanılırdı).

### S7 — slug tekilleştirmesi
Aynı kişinin hem KaymakTV incelemesi hem Trakt yorumu varsa tek listede yan yana çıkıyordu. Eşleştirme anahtarı iki tarafta da hazırdı (`users.trakt_slug` ↔ `comment.user.ids.slug`) — eleme tek `Set.has()`, ek istek yok. Yan fayda: kullanıcı KaymakTV'den yazdığı an Trakt'taki eski yorumu listeden düşüyor, "hangisi güncel" belirsizliği oluşmuyor.

### 🧹 Yol üstünde ölü kod yakalandı: `refreshComments`
F1, `refreshComments`'ın son tüketicisini (`onPublished`) kaldırdı. `--noUnusedLocals` bunu **yakalayamaz** (hook'un dönüş nesnesinde olduğu için "kullanılmış" sayılıyor) — elle fark edildi.

**Otopsi:** durum (b), bilinçli olarak değiştirilmiş. İki gerekçe: (1) v2'de Trakt'a yazmadığımız için yayın sonrası Trakt listesi bayatlamıyor, (2) S12'den beri `refreshData` zaten yorumları da tazeliyor (effect yeniden çalışınca `loadCommentsInBackground` koşuyor — ikisi de doğrulandı). Yani gerçekten gereksiz. `AI_RULES` §2.5 "aynı değişiklikte sil" gereği K1'e ertelenmeden silindi.

### 📥 Plana yeni bölüm: "SONRADAN BULUNANLAR"
Kullanıcı isteği üzerine `MASTER_PLAN.md`'nin en altına, faz kapsamı dışında kalan bulguların birikeceği bir alan açıldı. Kural: her madde (a) nerede bulunduğu, (b) neden şimdi düzeltilmediği, (c) hangi faza ait olduğu ile yazılır. F1'in bıraktığı 4 madde girildi:
- **Y1:** `onPublished` gereksiz tam tazeleme yapıyor (özet+sezon+benzerleri yeniden çekiyor, oysa inceleme bunları değiştirmiyor) → K1
- **Y2:** `MediaReviewsSection` 400 satır sınırına yaklaşıyor → K1 (F2 tekrar dokunacağı için ondan sonra bölünmeli)
- **Y3:** bileşen adı artık içeriğini anlatmıyor → K1 (Y2 ile birlikte)
- **Y4:** Trakt yorumları sayfada ve sheet'te iki farklı görsel dille çiziliyor → K1 / ayrı UI turu

### Doğrulama
`tsc --noEmit` temiz · `--noUnusedLocals --noUnusedParameters` SIFIR bulgu · web bundle derlendi, `/show/1388` **JS hatası olmadan mount oldu** (konsolda yalnızca bu ortama özgü Trakt CORS gürültüsü). **Doğrulanamayan:** bu ortamda Trakt özeti çekilemediği için ekran "Dizi bilgisi bulunamadı" durumunda kalıyor ve inceleme bölümü render EDİLEMİYOR — görsel doğrulama gerçek cihazda F4'te yapılacak.

---

## 176. F2 — Bölüm Sayfası Yerel İncelemeye Geçti + `in_feed` Bağlandı

**Bağlam:** `docs/MASTER_PLAN.md` F2.

### Bölüm sayfası artık Trakt'a yazmıyor
`app/episode/[id].tsx`, `MyInlineComment` + `WriteCommentSheet` ikilisini bırakıp dizi/film sayfalarıyla **aynı** `MediaReviewsSection`'ı kullanıyor. Tek fark `episodeNumber` prop'u (`formatEpisodeCode` ile "S01E02" biçiminde — Worker'ın beklediği regex). Böylece pivotun "Trakt'a yazma tamamen kalkıyor" iddiası artık gerçekten doğru: uygulamada Trakt'a yazan başka yorum yolu kalmadı.

### 🔴 `in_feed` kolonu oluşturulmuş ama HİÇ BAĞLANMAMIŞ — yakalandı
`020` migration'ında `in_feed` türetilmiş kolonunu oluşturmuştum ama **hiçbir sorguya bağlamamışım.** Bu hâliyle F2'nin çıkış kriteri ("bölüm incelemesi ana akışa düşmeyecek") sağlanmıyordu — bölüm incelemeleri doğrudan akışa düşecekti.

Üç yere birden bağlandı:
1. **`fetchFeedActivities`** — ana akış
2. **`fetchUserFeedActivities`** — profil aktiviteleri (kullanıcı kararı "sadece o bölümün kendi sayfasında görünecek" dediği için profil de dahil)
3. **`useFeedRealtime`** — ⚠️ **atlanması en kolay yer.** Realtime sorgudan GEÇMEZ; canlı INSERT doğrudan store'a girer. Bu kontrol olmadan bölüm incelemesi "yenilemede kaybolan ama WebSocket'ten canlı sızan" bir kart olurdu — engel filtresinde yaşanan aynı sınıf hata (`FEED_SOCIAL_PLAN` §4.3, 4. madde). `REPLICA IDENTITY FULL` (013) sayesinde payload `in_feed`'i taşıyor.

### 🔴 İkinci sızıntı yolu: dizi sayfası
`fetchMediaReviews` `episode_number`'a hiç bakmıyordu. Bölüm incelemeleri var olmadan önce zararsızdı; F2 ile birlikte dizi sayfası o dizinin TÜM bölüm incelemelerini listeler hale gelecekti. Filtre eklendi — **NULL için `is.null`, dolu için `eq.`** (Worker'daki `fetchExistingReview` ile aynı tuzak: PostgREST'te NULL için `eq.` çalışmaz). Önbellek anahtarına da `episodeNumber` eklendi, yoksa dizi ve bölüm listeleri aynı kutuyu paylaşırdı.

### S12 eksik kalmış — `useEpisodeDetail` de düzeltildi
S12 turunda `useShowDetail`/`useMovieDetail` düzeltilmiş ama **`useEpisodeDetail` gözden kaçmıştı**: `getEpisodeComments` orada da bloklayan `Promise.allSettled` batch'inin içindeydi, yani bölümün detayı ve görseli Trakt'ın yorum ucunu bekliyordu. Aynı desenle düzeltildi + `setMediaData` fonksiyonel güncellemeye çevrildi (yorumlar paralel geldiği için nesneyi komple değiştirmek onları silerdi — `useShowDetail`'de yakalanan aynı yarış durumu).

### Canlı doğrulama (4 sorgu + 1 probe)
| Kontrol | Sonuç |
|---|---|
| `in_feed` kolonu var mı | ✅ HTTP 200 → **`020` migration çalıştırılmış** |
| Dizi sayfası sorgusu (`episode_number=is.null`) | ✅ 200 |
| Bölüm sayfası sorgusu (`episode_number=eq.S01E02`) | ✅ 200 |
| Akış sorgusu (`in_feed=true`) | ✅ 200, **3 satır** → mevcut akış BOZULMADI |
| Worker `/feed/review/delete` | ✅ HTTP **404** → **P1 deploy edilmiş** |

> 🔴 Kayıt: akış sorgusu artık `in_feed`'e bağımlı. `020` çalıştırılmamış bir ortamda filtre "kolon yok" hatası verir ve **akışın tamamı kırılır**. Prod'da çalıştırıldı; yeni ortam kurulumunda migration ÖNCE gelmeli.

### Ölü kod zinciri hazır (K1'e devir)
`WriteCommentSheet`, `MyInlineComment`, `useMyMediaComment` artık **tüketicisiz** — kalan referansların hepsi açıklayıcı yorum (doğrulandı). `AI_RULES` §2.5 "aynı değişiklikte sil" der ama bu silme K1'de planlanmış bir FAZ: `services/api/comments.ts`'in yazma yarısı + `CommentReplies` yazma kısmı + tam denetim taraması aynı turda yapılacak. Yarısını şimdi yapmak K1'i kafa karıştırıcı bir ara durumda bırakırdı. **Unutulma riski yok:** hem plan panosunda hem burada kayıtlı.

### Doğrulama
`tsc --noEmit` temiz · `--noUnusedLocals --noUnusedParameters` SIFIR bulgu.
**Doğrulanamayan:** bölüm incelemesi yazma akışının uçtan uca çalışması — gerçek Trakt oturumu gerektiriyor, F4'te cihazda.

---

## 177. K1 — Kalite Denetimi #1: Pivotun Bıraktığı Ölü Kod Zinciri Temizlendi

**Bağlam:** `docs/MASTER_PLAN.md` K1. v1→v2 pivotu (Trakt'a yazmayı bırakma) arkasında bir ölü kod zinciri bırakmıştı; F2 son tüketicileri de kaldırınca zincir tamamen koptu.

### Silinen dosyalar (~800 satır)
| Dosya | Otopsi |
|---|---|
| `components/WriteCommentSheet.tsx` (~370) | (b) bilinçli değiştirildi → `WriteReviewSheet` |
| `components/MyInlineComment.tsx` (227) | (b) → `MediaCommentsSection` |
| `hooks/useMyMediaComment.ts` (~115) | (b) — iki tüketicisi de öldü |
| `utils/commentValidation.ts` (~95) | (b) → `utils/reviewLimits.ts` |

Silmeden önce her biri için **gerçek import taraması** yapıldı (yorum içi atıflar hariç tutularak) — üçünün de sıfır tüketicisi olduğu doğrulandı.

### `services/api/comments.ts`: 177 → 82 satır
Yazma yarısı komple gitti: `addComment`, `updateComment`, `deleteComment`, `addCommentReply`, `getUserComments` + 200 kayıtlık önbelleği. Kalan üç fonksiyon (`getMediaComments`, `getCommentReplies`, `getEpisodeComments`) yalnızca "Trakt topluluğu" bloğunu besliyor. Dosya başlığı da güncellendi — artık adı gibi bir **okuma servisi**.

> Dikkat gerektiren nokta: `addComment`/`deleteComment` adları `features/feed/services/feedSocial.ts`'te de VAR (bizim Supabase yorumlarımız). Silmeden önce her çağrı yerinin hangisine ait olduğu tek tek ayrıştırıldı — kör bir `grep` sayımı yanlış sonuç verirdi.

### `utils/commentValidation.ts` → `utils/reviewLimits.ts`
Dosyanın tamamı Trakt'ın SUNUCU kurallarını kodluyordu (`validateComment`, `MIN_COMMENT_WORDS = 5`, `REVIEW_WORD_THRESHOLD = 200`, `MAX_COMMENT_CHARS`) — hiçbiri artık bizi bağlamıyor. Yalnızca kendi seçtiğimiz iki sınır kaldı, dolayısıyla dosya adı da yalan söylüyordu (içinde "validation" yok). Yeniden adlandırıldı.

### `CommentReplies.tsx` — yazma kısmı söküldü (Karar 9)
`TextInput` + `addCommentReply` + `handleSendReply` + misafir kontrolü + doğrulama ipucu kaldırıldı; cevap **görüntüleme** kaldı. Kullanıcı kararıydı: bir Trakt yorumuna dokununca cevaplarını görebilmek değer katıyor, yazma kutusu ise gidecek yer olmadığı için yanıltıcı olurdu. `localCount` state'i de gitti (cevap eklenmediği için değişmiyor, prop doğrudan okunuyor); cevabı olmayan yorumlar için "Henüz cevap yok" notu eklendi — eskiden orayı yazma kutusu dolduruyordu.

### Y1 — gereksiz tam tazeleme kaldırıldı
İnceleme yayınlandıktan sonra ekran `refreshData()` çağırıyordu: dizi detay **önbelleğini geçersiz kılıp özet + sezonlar + benzer yapımları yeniden çekiyordu.** Oysa inceleme bunların hiçbirini değiştirmiyor. `onPublished` prop'u tamamen kaldırıldı (bileşen + 3 ekran).

### Y5 — nerede DURULDUĞU da bir karar
Y1 sonrası `refreshData` üç hook'ta tüketicisiz kaldı. Ekranların destructuring'inden kaldırıldı (orası gerçekten ölüydü) ama **hook'larda bırakıldı**: silmek `refreshData` → `invalidate*DetailCache` → `services/library/mutations/invalidation.ts` şeklinde üç seviyeli bir zincire dönüşüyordu, yani çalışan bir önbellek katmanını yerine bir şey koymadan budamak olurdu. Hiçbir ekranda pull-to-refresh olmadığı doğrulandı; eklendiği gün doğrudan buraya bağlanacak. `MASTER_PLAN` "SONRADAN BULUNANLAR"a Y5 olarak kaydedildi.

### Y2 + Y3 — bölme ve yeniden adlandırma
`MediaReviewsSection` 441 satıra çıkmıştı (400 kuralı ihlali). Trakt kuyruğu `components/reviews/TraktCommentsBlock.tsx`'e taşındı — bölme çizgisi boyut değil **sorumluluk**: o dosyanın tek işi "başka kaynaktan gelen yorumları göster ve kendi listemizle çakışanları ele" (S7 slug tekilleştirmesi de oraya taşındı). Sonuç: 441 → **339**.

Ardından `MediaReviewsSection` → **`MediaCommentsSection`**: bileşen artık yalnızca incelemeleri değil TÜM yorumlar bölümünü çiziyor, eski ad yanıltıcıydı. 3 ekranın import'u + `docs/feed.md` atfı güncellendi. `HISTORY.md`'ye dokunulmadı (tarihsel kayıt).

### Y4 — bilinçli olarak YAPILMADI
Trakt yorumları sayfada (`TraktCommentRow`) ve "Tümünü Gör" sheet'inde (`CommentItem`) farklı görsel dille çiziliyor. K1 bir **ölü kod** turuydu; bu ise saf tasarım kararı ve "hangi tasarım kazanacak" sorusunun cevabı yok. `CommentItem`'a dokunmak `CommentSheet` + `CommentReplies`'ı da kapsayıp K1'i UI yeniden tasarımına genişletirdi. Ayrı bir UI turuna bırakıldı.

### Kapanış denetimi (§4.1 kontrol listesi)
| Kontrol | Sonuç |
|---|---|
| `tsc --noEmit` | ✅ temiz |
| `--noUnusedLocals --noUnusedParameters` | ✅ **SIFIR bulgu** |
| Worker `node --check` | ✅ |
| `components/reviews/` 400 satır | ✅ ihlal yok (en büyük 358) |
| Çeviri senkronu | ✅ yalnızca bilinen `newPosts` çoğul farkı (i18next, hata değil) |
| Migration çakışması | 🟡 `010`/`012` — eski, ikisi de çalıştırılmış, dokunulmadı |
| Bayat worktree | 🟡 `intelligent-mclaren-7b32d5` duruyor — silme kararı kullanıcıya ait |

### Değişen dosyalar
**Silinen:** `components/{WriteCommentSheet,MyInlineComment}.tsx`, `hooks/useMyMediaComment.ts`, `utils/commentValidation.ts`
**Yeni:** `utils/reviewLimits.ts`, `components/reviews/TraktCommentsBlock.tsx`
**Yeniden adlandırılan:** `MediaReviewsSection.tsx` → `MediaCommentsSection.tsx`
**Değişen:** `services/api/comments.ts`, `components/comments/CommentReplies.tsx`, `components/reviews/{MediaCommentsSection,WriteReviewSheet}.tsx`, `app/{show,movie,episode}/[id].tsx`, `docs/{MASTER_PLAN,feed}.md`

---

## 178. F3 — Doküman Senkronizasyonu: v1'den Kalan Yanlış İfadeler Temizlendi

**Bağlam:** `docs/MASTER_PLAN.md` F3. Pivot (v1 dual-write → v2 Trakt'tan kopuş) ve K1 temizliği sonrası dokümanların bir kısmı **artık yanlış olan şeyler anlatıyordu.**

### `docs/feed.md` — en çok bayatlayan doküman
- **§2️⃣.5 tamamen yeniden yazıldı.** Başlığı "Worker artık Trakt'a YAZIYOR (dual-write)" idi — yani mimarinin tam TERSİNİ anlatıyordu. Yeni hâli pivotu, gerekçesini ve `traktFetch`'in GET-only'ye döndürülerek bunun nasıl garanti altına alındığını açıklıyor.
- Aktivite tipi satırı: `reviewed` için "**Trakt'ta DA yaşar**" → "**yalnızca bizde yaşar**"
- Veri kaynağı tablosu: "İKİSİ BİRDEN (dual-write)" → "Yalnızca Supabase"
- "Bilinçli olarak YOK" listesi yeniden yazıldı: **bölüm incelemesi artık VAR** (yapıldı), yerine "Trakt'a yazma", "Trakt'tan içeri alma", "Trakt yorumlarına yanıt" kondu
- Şema bloğu: `note ≤1000` → `≤5000`, **`in_feed` türetilmiş kolonu eklendi**
- Migration tablosuna `020` satırı
- Yol haritası: 5. madde "inceleme senkronu" → "Trakt yorumlarını önbelleğe alma" (senkron artık istenmiyor, önbellekleme ise API kapanma senaryosunun cevabı); 6. madde (bölüm incelemesi) ✅ YAPILDI olarak işaretlendi
- **Silinmiş bir dosyaya atıf kaldırıldı:** "İlgili Dosyalar" hâlâ `hooks/useMyMediaComment.ts`'i mevcut gibi listeliyordu

> Üst özete bilinçli bir not kondu: dokümanda "dual-write" geçen yerler v1'e ait; okuyan kişi kafası karışmadan tarihsel bağlamı ayırt edebilsin diye. Bu ifadeler tamamen silinmedi — özelliğin NASIL evrildiğini anlatıyorlar.

### `docs/REVIEWS_PLAN.md` — ikinci durum panosu kaldırıldı
Bu dosyada MASTER_PLAN'dakine PARALEL bir §0 Durum Panosu vardı ve **ıraksamıştı**: "Aktif faz: P3", "020 bekliyor", "P1 elle adım bekliyor" — üçü de yanlıştı (F1/F2/K1 bitmiş, 020 çalıştırılmış, Worker deploy edilmişti).

Bu tam olarak `AI_RULES` §2.5'in kod için uyardığı "iki kopya sessizce ıraksar" durumunun **doküman karşılığı**. Pano kaldırıldı; faz takibi artık TEK yerde (MASTER_PLAN). Dosya saf bir **tasarım gerekçesi kaydına** dönüştü ve başına bunun neden yapıldığı yazıldı.

Ayrıca faz atıfları düzeltildi (`P1'de tamamlandı` → `uygulandı`), temizlik bölümü "silinecek" → "silindi", `MediaReviewsSection` → `MediaCommentsSection`.

### `docs/ARCHITECTURE.md` — örnekler silinmiş dosyalara dayanıyordu
"Yatay katman mı, dikey feature mı?" bölümü kuralı `utils/commentValidation.ts` ve `useMyMediaComment` üzerinden anlatıyordu — **ikisi de K1'de silinmişti.** Canlı örnekle (`utils/reviewLimits.ts`) değiştirildi.

`useMyMediaComment` örneği ise **silinmedi, tamamlandı**: kuralın iki ucunu birden gösteren nadir bir vaka olduğu için ("ikinci tüketici çıktığı an yatayda doğdu, tüketici kalmadığı an silindi") anlatıya dönüştürüldü.

### `docs/FEED_SOCIAL_PLAN.md`
§7'deki "inceleme iki sistemde birden (dual-write), yanıtlar yalnızca bizde" notu düzeltildi: artık **her şey** yalnızca bizde. Kısa dual-write dönemi parantez içinde tarihsel not olarak bırakıldı.

### Değişen dosyalar
`docs/{feed,REVIEWS_PLAN,ARCHITECTURE,FEED_SOCIAL_PLAN,MASTER_PLAN}.md`. **Kod değişmedi.**

### Sıradaki
**G1** — güvenlik denetimi #1. Özel odağı: Trakt yazma yüzeyinin gerçekten kapalı olduğu, `in_feed` GENERATED kolonuna yazma denemesinin reddedildiği, `episodeNumber` girdisinin güvenli gittiği + `server.js`'teki TMDB fallback'inin silinmesi.

---

## 179. G1 — Güvenlik Denetimi #1: Yazma Yüzeyi + İki Denetim Yöntemi Hatası

**Bağlam:** `docs/MASTER_PLAN.md` G1. Pivot sonrası yazma yüzeyinin son hâli denetlendi.

### ✅ Canlı enjeksiyon testi — 9/9 reddedildi
Worker'ın girdi doğrulaması **token doğrulamasından ÖNCE** çalıştığı fark edildi; bu sayede sahte bir token'la, hiçbir şey yazmadan gerçek saldırı girdileri denenebildi:

| Deneme | Sonuç |
|---|---|
| `showId` = `1&user_id=neq.0` (PostgREST enjeksiyonu) | 400 |
| `showId` = `1' OR '1'='1` | 400 |
| `mediaType` = beyaz liste dışı (`episode`) | 400 |
| `episodeNumber` = `S01E02&select=*` | 400 |
| `episodeNumber` = biçim dışı (`1x02`) | 400 |
| film + `episodeNumber` (tutarsız kombinasyon) | 400 |
| `tmdbId` eksik | 400 |
| metin 5001 karakter / 2 karakter | 400 |
| **geçerli girdi** | **401** (token doğrulamasına doğru şekilde ilerledi) |

### ✅ Trakt yazma yüzeyi kapalı — kanıtlandı
`traktFetch` içinde `method` geçişi **0**; kodda `traktFetch(..., {method: ...})` çağrısı **yok**. `in_feed` GENERATED kolonuna Worker hiç dokunmuyor (yalnızca iki açıklama satırında geçiyor).

### 🔴 DENETİM YÖNTEMİ HATASI #1 — yanlış alarm üretiyordu
Kontrol listesindeki "anon key ile yazma → 401/403 bekle" testi çalıştırıldığında **UPDATE ve DELETE HTTP 204 döndü** — yani "izin verildi" gibi göründü. İlk okumada gerçek bir açık gibi durdu.

**Kanıtlanmadan rapor edilmedi.** `Prefer: return=representation` ile tekrar denendi:
- PATCH → **0 satır etkilendi**
- DELETE → **0 satır etkilendi**
- Hedef satır işlem sonrası tekrar okundu → **hâlâ duruyor, değişmemiş**

**Açıklama:** RLS'te UPDATE/DELETE için politika yoksa satırlar o işleme *görünmez* olur; PostgREST "0 satır etkilendi" anlamında 204 döner. INSERT ise doğrudan politika ihlali verdiği için 401 + `42501` döner. Yani **sistem güvenli, test yöntemi yanıltıcıydı.**

Kontrol listesi düzeltildi: artık "sadece HTTP koduna bakma, ETKİLENEN SATIR SAYISINI ölç" uyarısı ve doğru yöntem yazılı. Bu hata düzeltilmeseydi her G fazında aynı yanlış panik yaşanacaktı.

### 🔴 DENETİM YÖNTEMİ HATASI #2 — gerçek bir kör nokta
Enjeksiyon taraması yapan `grep`, F2'de eklenen `fetchExistingReview` sorgusunu **hiç görmüyordu**: o sorgu URL'i `+` ile ÇOK SATIRLI kuruluyor, regex ise tek satır bekliyor. Yani yeni eklenen kod sessizce denetim dışında kalmıştı.

Elle kontrol edildi ve güvenli çıktı (`showId` → `Number.isFinite`, `mediaType` → beyaz liste, `episodeNumber` → regex **+** `encodeURIComponent`, `userId` → kendi DB'mizden). Ama kontrol listesine "grep tek başına yeterli DEĞİL, her yeni sorgu elle de bakılmalı" uyarısı eklendi.

### ✅ TMDB anahtar fallback'i kapatıldı
`server.js:33` → `process.env.TMDB_API_KEY || process.env.EXPO_PUBLIC_TMDB_API_KEY` fallback'i kaldırıldı. Aktif sızıntı hiç olmamıştı (üç kontrolle doğrulanmıştı: `.env`'de o ad yok, istemci okumuyor, `dist` temiz) ama `EXPO_PUBLIC_` öneki Expo'da "bundle'a göm" demek — o adla yapılacak ilk yanlış tanımda sessizce sızardı. Trakt'ta aynı fallback Madde 25'te kaldırılmıştı, TMDB'de gözden kaçmıştı.

### Denetim özeti
| Kontrol | Sonuç |
|---|---|
| Anon INSERT (feed_activities / comments / user_blocks) | ✅ 401 + `42501` |
| Anon UPDATE / DELETE | ✅ 0 satır etkilendi (RLS çalışıyor) |
| Enjeksiyon (9 canlı deneme) | ✅ hepsi 400 |
| Trakt yazma yüzeyi | ✅ kapalı (`traktFetch` GET-only) |
| `in_feed` GENERATED | ✅ Worker hiç yazmıyor |
| IDOR | ✅ sahiplik `WHERE user_id = <doğrulanan>` |
| `EXPO_PUBLIC_*` sırları | ✅ TMDB fallback'i kaldırıldı; kalan 6 değişken gerçekten public |
| `.env` / `dist` | ✅ git dışı |

### Açık kalan (değişmedi)
**S11** — `users_select_all USING (true)` yüzünden anon key'le tüm kullanıcı listesi + `is_private`/`publish_watches` okunabiliyor. Postgres RLS kolon seviyesinde çalışmadığı için çözüm ayrı `user_settings` tablosu. F11'de.

### Değişen dosyalar
`server.js` (fallback kaldırıldı), `docs/MASTER_PLAN.md` (§4.2 kontrol listesi düzeltildi + G1 bulgusu kapatıldı).

### Sıradaki
**F4** — uçtan uca doğrulama + ilk build. **Bu faz gerçek cihaz gerektiriyor**, bu ortamda yapılamaz: inceleme yaz → akışa düş → yanıt yaz → beğen → düzenle → sil; bölüm incelemesinin akışa düşmediğinin teyidi; `wrangler tail` ile Worker logları. Geçerse 🔓 build kilidi kalkar.

---

## 180. Oturum Devri — Kol A Tamamlandı, Durum Kaydı

**Bu madde bir özellik kaydı değil, oturum sonu devir notudur.**

### Bu oturumda yapılanlar (Madde 165-179)
İnceleme sistemi sıfırdan kuruldu (v1: Trakt dual-write), Trakt API'nin ücretlendirmeye geçmesi üzerine **stratejik pivot** yapıldı (v2: yalnızca Supabase), ve MASTER_PLAN Kol A'nın tamamı bitirildi:

| | |
|---|---|
| **165** | Plan + ölü kod temizliği + Faz 1 (DB) |
| **166-169** | Worker · Client · UI · Doküman (v1 dual-write) |
| **170-172** | 🔀 **PİVOT:** analiz, karar, plan v2, ana plan (MASTER_PLAN) |
| **173** | S12 (performans) + P2 + tünel problemi |
| **175-176** | F1 (tek akış iki blok) + F2 (bölüm sayfası) |
| **177** | K1 — ~800 satır ölü kod silindi |
| **178** | F3 — doküman senkronizasyonu |
| **179** | G1 — güvenlik denetimi + 2 denetim yöntemi hatası |

### ⚠️ COMMIT DURUMU
**Hiç commit atılmadı.** 42 dosya değişik/yeni/silinmiş halde çalışma ağacında. Son commit `368b127` bu oturumdan ÖNCE. Yeni oturumun ilk işi bunu ele almak olmalı.

### Canlıda doğrulanmış durum
- `019_feed_reviews.sql` + `020_reviews_local_only.sql` → **çalıştırıldı**
- Worker → **deploy edildi** (`/feed/review/delete` 404 veriyor = yeni sürüm)
- `in_feed` kolonu mevcut, akış sorgusu bozulmadı (3 satır döndü)
- Canlı `reviewed` satırı: **0** (özellik henüz kullanıcıya ulaşmadı)

### 🔒 BUILD KİLİDİ HÂLÂ YÜRÜRLÜKTE
F4 (uçtan uca cihaz testi) yapılmadan build dağıtılmamalı. Sebep artık "kod yarım" değil — **hiç uçtan uca test edilmedi.** Trakt CORS engeli yüzünden bu ortamda dizi sayfası render edilemiyor, dolayısıyla inceleme akışının çalıştığı hiç görülmedi.

### Sıradaki iki seçenek
1. **F4** — cihazda uçtan uca test (kilidi kaldırır). Cihaz gerektirir.
2. **F5** — `tmdb_id`'yi tüm aktivite tiplerine yay (Kol B). Cihaz gerektirmez, Trakt'tan bağımsızlığın en yüksek getirili adımı.

### Açık kalan maddeler
`MASTER_PLAN` → "AÇIK MADDELER" (S5, S9-S11, S14-S16) ve "SONRADAN BULUNANLAR" (Y4, Y5). En kritik ikisi: **S9/S14** (Google girişi hiçbir şey yazamaz + hesap birleştirme köprüsü yok) ve **S15** (moderasyonda UNIQUE yok → tek kişi 5 raporla sansürleyebilir).

---

## 181. Kol A Commit Edildi · F4 Test Protokolü · F5 — Planın Bayat Çıktığı Faz

**Bağlam:** Madde 180'in devir notuyla açılan oturum. İlk iş commit, sonra F4/F5.

### ✅ Kol A tek commit'te kayıt altına alındı — `93aa678`
Madde 165-179'un tamamı (46 dosya, +1375/−1316). **Tek commit tercih edildi**, mantıksal parçalara bölünmedi: Madde 165-179 birbirine bağlı ilerlediği için ara noktalarda `tsc`'nin temiz olduğu garanti değildi (ör. K1 öncesi hâlâ silinmiş dosyalara referans vardı). Amaç okunur bir git geçmişi değil, **kesin çalışan bir geri dönüş noktası**ydı.

Commit öncesi üç doğrulama da tekrar çalıştırıldı (`tsc --noUnusedLocals --noUnusedParameters`, Worker `node --check`, `server.js node --check`) — üçü de temiz. Stage edilen 46 dosya tek tek gözden geçirildi; `.env`/`dist`/sır dosyası yok. **Push YAPILMADI** (istenmedi) — `origin` hâlâ `368b127`'de.

> **Otopsi doğrulaması:** `git status`'ta HISTORY'de kaydı olmayan gibi görünen 5 silme vardı (`features/notifications/{types,hooks/useNotifications,services/expoPush,services/webPush,services/notificationApi}`). Kör commit atmak yerine arandı ve **Madde 165'te otopsili olarak kayıtlı** oldukları görüldü: hiç bağlanmamış push-token iskelesi, kayıp özellik değil. `NotificationBadge` canlı olduğu için klasör bilinçli olarak silinmemişti.

### 📋 F4 test protokolü — `docs/F4_TEST_PROTOCOL.md` (yeni)
F4 cihaz gerektiriyor ve bu ortamda yapılamıyor (Trakt CORS). Faz bekletilmek yerine **yazılı protokole dönüştürüldü**: 13 test adımı (T1-T13) + 5 doğrulama sorgusu (S1-S5), her adımda "cihazda gör / Worker logunda gör / DB'de gör" üçlemesi.

Protokol **uydurulmadı, koddan çıkarıldı** — gerçek buton metinleri, gerçek hata mesajları, gerçek sınırlar (`MIN_REVIEW_CHARS=3`, `MAX_NOTE_LENGTH=5000`) okunarak yazıldı. Özellikle yakalanması zor iki adım: **T5** (düzenlemede `activity_at` sabit kalmalı — kart tepeye fırlamamalı) ve **T6** (bölüm incelemesi `in_feed=false` ile ana akışa düşmemeli).

Dosyanın başına "bu bir durum panosu DEĞİLDİR" uyarısı kondu — Madde 178'de ikinci panonun ıraksaması yaşanmıştı.

### 🔴 F5 — planın kendisi bayat çıktı
`MASTER_PLAN`'ın F5 kapsamı şunu diyordu: *"Worker `normalizePublishActivity` + `handleFeedSync` tmdb_id yazsın."* Kod okununca **o işin zaten yapılmış olduğu** görüldü. Plana güvenip körlemesine yazılsaydı var olan mantık tekrarlanacaktı.

Doğrulanan mevcut durum: anlık yayının **5 istemci çağrı noktasının hepsi** `tmdbId` gönderiyor (`ratings.ts:86`, `progress.ts:148,399,469,558`), `resolveMediaMeta` onu döndürüyor, Worker `normalizePublishActivity` okuyup yazıyor, tam senkron **dört map'in hepsinde** yazıyor.

**Gerçek boşluk başka yerdeydi:** kolon eklenmeden önce yazılmış satırlarda `tmdb_id` NULL ve **hiçbir yol onlara dokunmuyordu** — INSERT'ler yalnızca "bizde olmayan" satırlar için, `ratedToUpdate` ise yalnızca puan/tarih değişince çalışıyordu. Yani eski satırlar kendiliğinden ASLA dolmayacaktı.

**Uygulanan çözüm (Worker):** senkron, o turda Trakt'tan **zaten çekilmiş** veriyi kullanarak eksikleri tamamlıyor — ek Trakt isteği yok, kota harcanmıyor. Eşleştirme yeni mantık icat etmiyor, sync/publish'in paylaştığı dedup anahtarlarını kullanıyor. Yalnızca NULL satırlara dokunuluyor. `activity_at` patch'e **girmiyor** (handleFeedReview/handleFeedNote ile aynı "gizli spam" kuralı). `ratedToUpdate`'e giren satıra `tmdb_id` aynı PATCH'e bindiriliyor — ikinci istek atılmıyor.

Yan düzeltme: `fetchExistingActivities`'in select listesinde **`tmdb_id` yoktu** — onsuz hangi satırın eksik olduğu bilinemez, her satır gereksiz PATCH alırdı. Eklendi. Yanıta `tmdbBackfilled` sayacı kondu (`wrangler tail` ile izlenebilir; sıfıra inmesi işin bittiğini gösterir).

> **⚠️ Kabul edilen sınır, gizlenmiyor:** `watched_*` için Trakt yalnızca son 50 kaydı döndürüyor → o pencerenin dışındaki eski izleme satırları bu yolla dolmaz. `rated` için sınır yok → orada doldurma TAM. Pencere dışı satırların sayısı **ölçülmedi** (canlı DB erişimi gerekiyor); ölçüm sorgusu `MASTER_PLAN` F5 bölümünde.

### 🧹 F3'ün kaçırdığı üç kalıntı
F3 doküman turu `docs/` dosyalarına baktı, **kod içi yorumlara ve kullanıcıya görünen metne bakmadı**:
1. `WriteReviewSheet.tsx` JSDoc başlığı hâlâ v1 anlatıyordu — *"Worker hem Trakt'a hem `feed_activities`'e yazar (dual-write)"* ve *"bölüm incelemeleri v1 kapsamı dışında"*. İkisi de yanlış; ayrıca K1'de silinmiş `WriteCommentSheet.tsx`'e canlıymış gibi atıf yapıyordu.
2. Aynı dosyada `t()` **fallback** metni: *"İncelemen hem Trakt'ta hem KaymakTV akışında yayınlanır."*
3. `020_reviews_local_only.sql:37` → silinmiş `utils/commentValidation.ts`'e atıf (artık `reviewLimits.ts`).

> **Yanlış alarm düzeltildi:** (2) ilk bakışta "kullanıcıya yalan söyleniyor" gibi göründü. Çeviri dosyaları kontrol edilince **ikisi de doğru** çıktı (`tr`: "İncelemen KaymakTV akışında yayınlanır.", `en`: "…in the KaymakTV feed."). Yani metin yalnızca i18n yüklenemezse görünürdü. Rapor edilmeden önce doğrulandığı için yanlış panik yaşanmadı — G1'deki "sadece HTTP koduna bakma" dersinin aynısı.

### 🔴 `.gitignore`'daki `*.md` — beş döküman git DIŞINDAYDI
Commit sonrası `git status` kontrolünde `docs/MASTER_PLAN.md`'nin hiç görünmediği fark edildi. Sebep: `.gitignore:74` → **`*.md`**, altında yalnızca beş istisna (`README`, `AGENTS`, `HISTORY`, `ARCHITECTURE`, `AI_RULES`).

Git dışında kalanlar: **`MASTER_PLAN.md`** (oturumlar arası devir belgesi — `AGENTS.md` yeni oturuma oradan başlamayı şart koşuyor), `REVIEWS_PLAN.md`, `FEED_SOCIAL_PLAN.md`, `notifications.md`, `F4_TEST_PROTOCOL.md`. Tek bir disk hatası tüm planlama geçmişini silerdi.

`docs/{feed,ui,PROJECT_VISION,TODO,README}.md` istisna listesinde OLMADIĞI hâlde takip ediliyor — kural eklenmeden önce commit edildikleri için (git, takip ettiği dosyayı ignore etmez). Bu tuzak `.gitignore`'a not olarak yazıldı: biri silinip yeniden oluşturulursa sessizce git dışında kalır.

Kullanıcı kararı: beşi de istisna listesine eklendi.

> **Kontrol yöntemi hatası (üçüncüsü, G1'deki ikisinin ardından):** doğrulama için `git check-ignore -v` kullanıldı ve beş dosya için de satır numarası döndürdü — "hâlâ ignore ediliyor" gibi göründü. Yanlış: `check-ignore` **eşleşen kuralı** gösteriyor, o da negatif (`!`) kuralın kendisiydi. Gerçek kanıt `git status`'tı — beşi de `??` (untracked) olarak listelendi, yani ignore edilmiyorlar. **Rapor edilmeden önce ikinci yöntemle doğrulandığı için yanlış alarm verilmedi.** Ders G1'dekiyle aynı: tek bir komutun çıktısını "kanıt" saymak yerine, ölçtüğü şeyin gerçekten sorduğun soru olduğunu kontrol et.

### Doğrulama
| Kontrol | Sonuç |
|---|---|
| `tsc --noEmit --noUnusedLocals --noUnusedParameters` | ✅ temiz |
| Worker `node --check` | ✅ temiz |
| Worker `vitest run` | ✅ **29/29 geçti** |
| `server.js node --check` | ✅ temiz |
| `.gitignore` istisnaları | ✅ 5 döküman `git status`'ta görünür oldu |

**Doğrulanamayan:** F5 canlıda test edilmedi (deploy yapılmadı, bilinçli).

### 📊 F5 canlı ölçümü + zincir planı (aynı gün, kullanıcı çalıştırdı)
**57 satırda `tmdb_id` eksik** (47 `watched_episode` + 10 `rated`; `watched_movie` **0/200** — o yol hep doğru yazmış). Eksikler **yalnızca 12 diziye** ait.

Bir varsayım kuruldu ve **ölçümle çürütüldü:** "eksik satırın dizisi başka bir satırda doludur, saf SQL self-join hepsini çözer." Gerçek: **6/57**. Sebep geriye dönük açık — bir dizinin `tmdb_id`'si hiç yazılmamışsa o dizinin TÜM satırları eksiktir, kopyalanacak kaynak yoktur.

Ölçüm bunun yerine daha iyi bir şey gösterdi: `rated` listesindeki diziler `watched_episode` listesiyle **örtüşüyor**. Sıralı bir zincir kuruldu (ayrıntı + SQL: `MASTER_PLAN` F5): self-join (6) → **F5 deploy + senkron** (10 `rated`, Trakt tüm puanları döndürdüğü için TAM) → self-join TEKRAR (**31**). Kalan yalnızca 16, sonra 10. Hiç ek Trakt isteği yazılmıyor. Sıra bozulursa 31 satır çözülmeden kalır.

### 🎬 F4-T1…T9 CANLIDA GEÇTİ (ilk uçtan uca doğrulama)
İnceleme sistemi kurulduğundan beri ilk kez gerçek cihazda çalıştı.

| Adım | Sonuç |
|---|---|
| **T1** yaz | ✅ `tmdb_id=125988` dolu, `in_feed=true`, `episode_number=null` |
| **T2** akış | ✅ tek kart — **R6 regresyonu yok** |
| **T3** yanıt · **T4** beğeni | ✅ |
| **T5** düzenle | ✅ **tarih sabit kaldı**, kart tepeye fırlamadı |
| **T6** bölüm incelemesi | ✅ bölüm sayfasında var, **ana akışta YOK** (`in_feed` çalışıyor) |
| **T7** film | ✅ akışta görünüyor (**beklenen** — akıştan hariç tutulan yalnızca *bölüm* incelemeleri) |
| **T8** sil | ✅ |
| **T9** uçak modu | ✅ **sheet açık kaldı, metin korundu**, hata görünür kutuda — "tünel problemi" koruması canlıda çalışıyor |

Bonus kanıt (T1): `activity_at` (10:17:06.877) `created_at`'ten (10:17:10.622) **3.7 sn ÖNCE** — Worker sunucu zamanını değil **istemcinin damgasını** yazmış. R6'nın (Realtime yankısı çift kart üretmesin) dayandığı mekanizmanın canlıda çalıştığı ilk gözlem; T2'de sonucu da doğrulandı.

| **T10** sınırlar · **T11** misafir | ✅ |
| **T12** gizlilik anahtarı | ✅ **veri kaybı YOK** — aşağıya bak |
| **T13** Trakt bloğu | ✅ görünüyor (ama Y6 bulundu) |

### ✅ T12 — S5 canlıda kanıtlandı, ama önce YANLIŞ ALARM verildi
Ayar kapatıldıktan sonra kullanıcının satırları: `reviewed 3` · `posted 1` · **`watched_episode`/`watched_movie`/`rated` HİÇ YOK**. `users` → `publish_watches=false, publish_ratings=false`. Yani otomatik loglar silindi, **elle yazılan içerik korundu** — S5 düzeltmesi (film izlemelerinin de temizlenmesi) canlıda doğrulandı.

> 🔴 **ÖLÇÜM HATASI (bu turun ikinci yöntem hatası):** Kullanıcıya verilen sayım sorgusunda **`user_id` filtresi yoktu**. Filtresiz `count(*)` TÜM kullanıcıları topluyor; gizlilik anahtarı ise yalnızca o kullanıcının satırlarını siliyor. Sonuç 511→468 ve 200→150 göründü ve **"kısmi silme, T12 BAŞARISIZ" diye raporlandı** — oysa silinen 43+50 satır o kullanıcının TAMAMIydı. `user_id` filtreli sorgu gerçeği gösterdi. Protokole kalıcı uyarı eklendi. Ders G1/gitignore vakalarıyla aynı: **ölçtüğün şeyin sorduğun soru olduğunu doğrula.**

### 🔧 T12'nin ortaya çıkardığı GERÇEK hata: gizleme ekrana yansımıyordu
Kullanıcı bildirdi: *"aktiviteni akışta gizle açıktı ama aktiviteler hâlâ akışta."* DB'de o satırlar **yoktu** (yukarıda kanıtlı), ekranda **vardı**.

Kök neden: `useFeedPrivacy` ayarı kaydettikten sonra **hiçbir önbelleği geçersiz kılmıyor, feed store'a da dokunmuyordu**. Worker DB'yi temizliyor, istemci eski kartları göstermeye devam ediyordu. Eylem başarılı ama sonucu kullanıcıya YANSIMIYOR — `AI_RULES` §2'nin ters yönü ve bir **gizlilik** özelliğinde bu, kullanıcının gizlediğini sandığı şeyin ekranda durması demek.

**Düzeltme:** `applyPrivacyToFeed()` — `invalidateFeedCache()` + `invalidateUserFeedActivitiesCache(mySlug)` + store'dan yalnızca KENDİ ilgili kartlarını çıkarma. Bunun için `feedStore`'a `removeActivitiesWhere(predicate)` eklendi.

> ⚠️ **`feedStore.reset()` bilinçli olarak KULLANILMADI.** İlk akla gelen çözüm oydu ama `useFeed`'in yükleme efekti yalnızca **mount'ta** çalışıyor (`useFeed.ts:98-103`) ve sekmeler bellekte kaldığı için store'u boşaltmak akışı **BOŞ bırakırdı** — hatayı düzeltmek yerine büyütürdü. Kod okunmadan uygulansaydı bu tuzağa düşülecekti.

**Kapsam sınırı (gizlenmiyor):** düzeltme yalnızca GİZLEME yönünde anında etki eder. Ayar tekrar açıldığında satırlar sunucuda da hemen geri gelmiyor (bir sonraki `/feed/sync` gerekiyor), bu yüzden orada yalnızca önbellek geçersiz kılınıyor.

### ℹ️ "Trakt token geçersiz" — hata değil, Trakt rate limit
Test sırasında bir inceleme denemesi bu mesajı verdi. Yeni bir `wrangler tail` ile tekrarlandığında **sorunsuz geçti** ve `[verifyAndUpsertUser]` hata logu hiç basılmadı. Sebep: kısa sürede çok sayıda `/feed/sync` → Trakt'ın kendi 429'u. Kod bunu zaten biliyor (`verifyAndUpsertUser:477-482` durum kodunu logluyor) ama **kullanıcıya 401 ile 429 aynı mesajı gösteriyor** — yanlış teşhis sınıfı, ayrı bir iyileştirme.

### 🔧 T9'un yan ürünü: `publishPost` yanlış teşhis koyuyordu
Akıştaki "ne düşünüyorsun" alanı bağlantı yokken **"Kimliğin doğrulanamadı, tekrar dene."** gösteriyordu (`feedPublish.ts:243`).

Kök neden: `resolveMe()` İKİ AĞ ÇAĞRISI yapıyor (`getMyTraktSlug` + `getUserProfile`); ağ yokken ikisi de düşüyor, fonksiyon `null` dönüyor ve erken çıkış bu mesajı basıyordu. Görünür geri bildirim VARDI (yani `AI_RULES` §2 ihlali değil) ama **yanlış yere işaret ediyordu** — kullanıcı hesabının bozulduğunu sanıp oturumunu kurcalamaya yöneliyordu.

**Düzeltme:** `me` yokluğu artık yayını engellemiyor. Kimliği zaten Worker token'dan çözüyor; `me` burada YALNIZCA iyimser kartı çizmek için. Çizilemiyorsa kart atlanır, gönderi gönderilir, gerçek hata kendi doğru mesajıyla (`Network Error`) catch'ten döner. **Yan fayda:** ağ varken Trakt profil ucu geçici düşerse kullanıcı artık gönderisini kaybetmiyor — eskiden o durum da bloke ediyordu.

### 📌 Y6 kaydedildi — "Tümünü Gör" kendi incelemeleri göstermiyor
Kullanıcı T13 sırasında buldu. Sheet yalnızca Trakt yorumlarını içeriyor; teknik olarak doğru (buton `TraktCommentsBlock`'a ait) ama F1 listeyi kasten tek parça gösterdiği için kullanıcı "tümü"nün eksilmesini kayıp olarak algılıyor. **Y4 ile aynı kök**, ikisi birlikte çözülmeli. Bir ürün kararı gerektirdiği ve `CommentSheet`+`CommentReplies`'a dokunacağı için F4'te düzeltilmedi — üç seçenekle `MASTER_PLAN` → SONRADAN BULUNANLAR'a yazıldı.

> **Yöntem notu:** `wrangler tail` bu turda hiçbir hata logu basmadı ama iki gerçek kusur vardı. Tail'in sessizliği "sorun yok" demek değil — 400/401 dalları log basmıyor, tail'deki `Ok` de yalnızca "istisna atılmadı" demek. Bulguların ikisi de **kullanıcının cihazda gördüğünden** çıktı.

> 🔴 **Protokol hatası bulundu ve düzeltildi:** `F4_TEST_PROTOCOL.md` T1'de "`wrangler tail` → 200" yazıyordu. Yanlış — tail'deki **`Ok` bir HTTP durumu değil**, Cloudflare'in *outcome* alanı ("Worker istisna atmadan bitti"). 400/401/403/502 dönse de aynen `Ok` görünür. Bu hâliyle protokol, sessizce reddedilmiş bir isteği "geçti" saydırabilirdi. Tek geçerli kanıtın DB olduğu uyarısı eklendi.

### Değişen dosyalar
**Yeni:** `docs/F4_TEST_PROTOCOL.md`.
**Değişen:** `kaymaktv-feedback-worker/src/index.js` (F5), `components/reviews/WriteReviewSheet.tsx`, `supabase/schema/020_reviews_local_only.sql` (yorum), `docs/MASTER_PLAN.md`, `.gitignore`.

> ⚠️ **Bu maddedeki değişiklikler COMMIT EDİLMEDİ** (kullanıcı kararı: F4 sonucunu görüp hepsi tek commit'te toplanacak). Commit edilmiş tek şey Kol A: `93aa678`.
>
> ⚠️ **`kaymaktv-feedback-worker` bir git reposu DEĞİL** — hiç versiyon kontrolü yok, bugünkü F5 değişikliğinin de geri dönüş noktası yok. Ayrı bir iş olarak ele alınmalı.

### Sıradaki
1. **F4** — cihazda `F4_TEST_PROTOCOL.md` uygulanır (mevcut canlı Worker sürümüyle). Geçerse 🔓 build kilidi kalkar.
2. Ardından `npx wrangler deploy` → F5 canlıya çıkar → `tmdbBackfilled` sayacı izlenir.

> **Deploy neden F4'ten SONRA:** F5 şimdi deploy edilseydi ve F4'te bir hata çıksaydı, hatanın inceleme sisteminden mi F5'ten mi geldiği karışırdı.

---

## 182. F14 — Elle Yazılan İçerik İçin Akış Görünürlüğü (`publish_manual`)

**Kullanıcı isteği:** *"Elimiz değmişken sistemi düzgünce kuralım, gerekli ne varsa yapalım, daha sonra başımıza iş çıkarmasın."* Yani etiket yaması değil, gerçek çözüm.

**Bulan:** kullanıcı, F4 testi sırasında — *"İzlediklerimi ve puanlamaları akışta paylaşabiliyorum, aç-kapa var. Yorumlar için buton yapmamışız ki?"*

Tam tasarım gerekçesi: **[`docs/FEED_VISIBILITY_PLAN.md`](FEED_VISIBILITY_PLAN.md)** (yeni).

### Sorun
`reviewed` ve `posted` hiçbir gizlilik ayarının kapsamında değildi. "Aktivitemi Akışta Gizle" adını taşıyan anahtar yalnızca izleme ve puanları kapsıyordu — kullanıcı "her şeyi gizledim" sanırken incelemeleri ve gönderileri akışta kalmaya devam ediyordu. Canlı kanıt: ayar açıkken kullanıcının satırları `reviewed 3` + `posted 1`.

### 🔍 `008`'in kararı çürütüldü (silinmedi)
`008_drop_feed_hidden.sql` `users.feed_hidden`'ı kaldırmıştı çünkü o gün `feed_hidden=true` ile `publish_watches=false AND publish_ratings=false` **birebir aynı şeydi** — iki gerçeği tutan üç sütun.

**O gün doğruydu.** Ama sonra `posted` (017) ve `reviewed` (019) geldi ve o denklik sessizce bozuldu: bugün "izleme kapalı + puan kapalı" artık "her şey gizli" ANLAMINA GELMİYOR.

008'in **ilkesi korundu**: üç ayar AYRIK kümeleri yönetiyor (hiçbiri diğerinin gerçeğini tutmuyor) ve "Her Şeyi Gizle" hâlâ DB'de değil, üçünden TÜRETİLİYOR.

> Bu, bu projede tekrar eden bir hata sınıfının örneği: **doğru bir karar, dayandığı koşullar değişince sessizce yanlışa döner.** 008'in gerekçesi yazılı olduğu için çürütülebildi — kararın kendisi değil, dayanağı denetlendi.

### Mekanizma — neden trigger
`in_feed` bir GENERATED kolon ve Postgres'te GENERATED ifadesi yalnızca **aynı satırdaki** kolonlara bakabilir, `users`'a JOIN yapamaz. Değerlendirilip ELENEN yollar (gerekçeleriyle plan dosyasında): koşulsuz `.eq('users.publish_manual', true)` (tip ayrımı yapamaz) · PostgREST `or(...)` (keyset ifadesini kırma riski, 020'de zaten uyarılmış) · VIEW (`users!inner` embed'i view üzerinde güvenilir değil) · elle yönetilen bayrak (**tam olarak 008'in tuzağı**).

Seçilen: **denormalize kolon + İKİ TRIGGER.**
```
users.publish_manual → (trigger) → author_hides_manual → (GENERATED) → in_feed → akış sorgusu
```
Bayrak elle yazılmıyor, Postgres türetiyor → senkron dışı kalması imkânsız. **Akış sorgusu hiç değişmedi** (`in_feed` zaten tek kapı).

### ⚠️ Silme DEĞİL, gizleme
Diğer iki anahtar kapatılınca satırlar siliniyor (Trakt'ın aynası, senkron geri getirir). `reviewed`/`posted` **silinmiyor** — Madde 165 kararı. Worker'ın `/feed/privacy` ucuna bu alan için **hiç silme kodu eklenmedi**; users PATCH'i yeterli, gerisini trigger yapıyor.

### 🔬 Bağımsız tarama — kendi tasarımımda 3 boşluk buldu
Kullanıcının önerisiyle, akışın TÜM okuma yollarını bulmak için ayrı bir tarama yapıldı. Sonuç, işin en değerli kısmı oldu:

- 🔴 **`fetchActivityById` HİÇBİR filtre uygulamıyordu** ve `/activity/{id}` sayfası `(protected)` grubunun **DIŞINDA**. Bu yalnızca yeni ayarı değil, **mevcut `in_feed` sözleşmesini de deliyordu**: F4-T6'da "akışa düşmüyor" diye doğruladığımız bölüm incelemeleri, id'si bilinen herkese tam kart olarak açılabiliyormuş. `.eq('in_feed', true)` eklendi.
- 🔴 **Realtime UPDATE'te görünürlük kontrolü yoktu.** 021 öncesi `in_feed` satır ömrü boyunca sabitti, gerek yoktu. Artık gizleme tam olarak bir UPDATE olarak geliyor — kart güncellenmek yerine **düşürülmeli**. Eklendi.
- 🟠 **`fetchUserFeedActivities` hem kendi hem başkasının profilini besliyor.**

**İki öneri bilinçli olarak UYGULANMADI:**
1. *Realtime INSERT'i `!== true` yap (fail-closed).* Alan bir gün yükte hiç gelmezse bu **tüm canlı akışı sessizce öldürür** — gizli bir kartın görünmesinden daha kötü bir başarısızlık modu. Asıl kilit sunucuya taşındı (yukarıdaki `fetchActivityById`), buradaki kontrol "ucuz ön eleme" olarak belgelendi.
2. *`isOwnProfile` parametresi ekle.* `in_feed` iki kuralı birleştiriyor ve ayırmak keyset `.or(...)` ifadesini riske atardı. Seçilen davranış daha tutarlı: **"gizle" dedinse her akış görünümünde gizli, kendi profilin dahil.** İçerik silinmiyor, yapım sayfasında duruyor.

### 📥 Kapsam dışı iki bulgu kaydedildi
**Y8** — `fetchUserFeedActivities`'te **engellenen kullanıcı filtresi YOK** (akışta ve yapım sayfasında var). Engellediğin kullanıcının profilindeki aktiviteleri görebiliyorsun. **Y9** — yorum yolunda (istemci `fetchComments` + Worker `fetchActivityForComment`) görünürlük hiç kontrol edilmiyor. İkisi de `MASTER_PLAN` → SONRADAN BULUNANLAR'da, gerekçe ve faz atamalarıyla.

### 🔄 UI yön tutarlılığı — dört anahtar da "GİZLE" oldu
**Bulan:** kullanıcı, F14'ü cihazda denerken — *"Çalışıyor ama ters. Buton kapalıyken paylaşmıyor, açıkken paylaşıyor."*

Davranış aslında doğruydu, ama aynı ekranda **iki ZIT yön** vardı: üstteki anahtar "Gizle" (açık = gizli), alttaki üçü "Paylaş" (açık = görünür). Daha kötüsü: "Gizle"yi açınca alttaki üç anahtar `false`'a düşüp **KAPALI** görünüyordu — kullanıcı "her şeyi gizledim" derken üç anahtarın kapandığını görüyordu.

**Kullanıcı kararı:** veri modeli doğru, metin değişsin. Dördü de "Gizle" yönüne çevrildi (AÇIK = GİZLİ). DB alanları `publish_*` (true = paylaş) olarak **kaldı** — dönüşüm yalnızca `account.tsx`'te, tek yerde. Çeviri anahtarları `publishX` → `hideX` olarak yenilendi, eskiler silindi (ölü anahtar bırakılmadı).

### 🧪 Anahtar mantığı simülasyonla test edildi — 1 gerçek kusur buldu
Etkileşim saf mantık olduğu için 8 senaryoluk bir simülasyon yazılıp çalıştırıldı (hideAll türetimi · hide↔publish dönüşümü · kilit durumu · regresyon).

🔴 **S6 — KİLİTLENME (test bulundu, düzeltildi):** alt üç anahtar `hideAll` iken `disabled` yapılıyordu. Kullanıcı üçünü **tek tek** gizlerse `hideAll` türetilmiş olarak `true` olur ve üçü birden **kilitlenir** — artık yalnızca birini geri açamaz, önce üst anahtarı kapatması gerekir, o da üçünü birden açar. Tuzak eskiden de vardı (iki anahtarla), üçüncüsüyle kolay tetiklenir hâle geldi.

**Düzeltme:** `disabled`'dan `|| hideAll` kaldırıldı. `hideAll` türetilmiş bir **kısayol**, kilit değil; alt anahtarlardan biri açılırsa kendiliğinden `false` olur, tutarlılık zaten korunuyor.

| Senaryo | Sonuç |
|---|---|
| S1 başlangıç · S3 hepsini geri aç | ✅ |
| S2 "Tümünü Gizle" → dördü de AÇIK görünür | ✅ görsel çelişki bitti |
| S4 yalnızca inceleme gizle → üst anahtar KAPALI kalır | ✅ |
| S5 üçünü tek tek gizle → üst anahtar kendiliğinden açılır | ✅ türetim doğru |
| **S6 kilitlenme** | 🔴 → ✅ düzeltildi |
| S7 gizle/geri göster yön doğruluğu · S8 ters davranış regresyonu | ✅ |

> Simülasyon `scratchpad/privacy-switch-test.js`'te; projede istemci tarafı test altyapısı olmadığı için **kalıcı bir teste dönüştürülmedi**. Mantık değişirse elle tekrar çalıştırılmalı.

### Değişen dosyalar
**Yeni:** `docs/FEED_VISIBILITY_PLAN.md`, `supabase/schema/021_feed_manual_visibility.sql`.
**Değişen:** `kaymaktv-feedback-worker/src/index.js` (`PRIVACY_FIELDS` + silme YOK gerekçesi) · `features/feed/services/{feedPrivacy,feedApi}.ts` · `features/feed/hooks/{useFeedPrivacy,useFeedRealtime}.ts` · `app/(protected)/account.tsx` · `locales/{tr,en}/settings.json` · `docs/{MASTER_PLAN,HISTORY}.md`.

### Doğrulama
| Kontrol | Sonuç |
|---|---|
| `tsc --noEmit --noUnusedLocals --noUnusedParameters` | ✅ temiz |
| Worker `node --check` | ✅ temiz |
| Worker `vitest run` | ✅ **29/29** |
| Çeviri senkronu (tr ↔ en) | ✅ yalnızca bilinen `newPosts` çoğul farkı |
| Migration numara çakışması | ✅ `021` boştu (010/012 eski ve bilinen) |

**Doğrulanamayan:** hiçbiri canlıda test edilmedi — `021` çalıştırılmadı, Worker deploy edilmedi. Trigger zinciri yalnızca SQL olarak yazıldı; `021`'in sonundaki "CANLI ZİNCİR TESTİ" bloğu bunun içindir.

### Sıradaki
`MASTER_PLAN` §0'daki 5 adımlı sıra. Kritik: **önce migration, sonra deploy** — ters sırada `publish_manual` kolonu bulunamaz.

---

## 183. Y8 + K2 — Kalite Denetimi #2: Çıkışta Temizlenmeyen İki Kimlik Önbelleği

**Bağlam:** F14 cihazda doğrulandıktan sonra kullanıcı sıradaki işi sordu; Y8 (engel filtresi) + K2 (kalite denetimi) birlikte seçildi. Öncesinde bu turun tamamı commit edildi (`72cab42`).

### 🔴 K2'nin bulduğu gerçek kusur — kimliğe bağlı önbellekler
`AuthContext.removeKeys()` çıkışta 8 şeyi temizliyordu (follow store · trakt slug · feed store · publish kimliği · akış önbelleği · görünür kullanıcılar · Supabase user id · engel kümesi). **İkisi listede yoktu:**

- `userFeedActivitiesCache` (profil aktiviteleri)
- `mediaReviewsCache` (yapım sayfası incelemeleri)

İkisi de `attachIsLikedByMe` ile doldurulan **`isLikedByMe`** alanını taşıyor — yani içerikleri kimliğe bağlı. Uygulama kapatılmadan hesap değiştirilirse (çıkış → başka hesapla giriş) 60 saniyelik TTL boyunca **önceki hesabın beğeni durumu yeni oturumda görünürdü.**

Bu, `myIdentity`/`userBlocks`/`feedPublish` için zaten çözülmüş olan hata sınıfının aynısı; o üçü `removeKeys`'e bağlıydı ama bu ikisi inceleme sistemi turunda (F1/F2) eklendiği için gözden kaçmıştı. Tam olarak `MASTER_PLAN` §4.1'in *"her K fazında elle bak: yeni eklenen modül seviyesi önbellek removeKeys()'e eklendi mi?"* maddesinin yakalamak için var olduğu şey.

**Düzeltme:** `invalidateIdentityScopedFeedCaches()` eklendi, `removeKeys()` çağırıyor. Fonksiyonun başına, bu dosyaya yeni bir kimliğe bağlı önbellek eklendiğinde buraya da eklenmesi gerektiği yazıldı.

### Y8 — engel filtresi profil aktivitelerine eklendi (ama ilk rapor abartılıydı)
Akış (`getVisibleUserIds`) ve yapım sayfası (`fetchMediaReviews`) engellenen kullanıcıları eliyordu; `fetchUserFeedActivities` elemiyordu.

> ⚠️ **Kendi yanlış alarmımın düzeltmesi:** bunu ilk raporlarken *"engellediğin birinin profiline girip aktivitelerini görebiliyorsun"* demiştim. **Yanlıştı.** `PublicProfileMobile.tsx:138` ve `user/[slug].web.tsx:187` engellenmiş profilde listeyi hiç çizmiyor, `<BlockedProfileLock />` gösteriyor — görsel sızıntı yoktu. Bağımsız taramanın bulgusunu doğrulamadan aktarmıştım.
>
> **Gerçek kusur daha ılımlı ama yine de geçerli:** engel kuralının TEK katmanı UI'daydı ve o ekranlar hook'u koşulsuz çağırdığı için sorgu yine de gidiyordu. Eklenen filtre ikinci katman: yeni bir ekran bu fonksiyonu kilit kontrolü olmadan tüketirse veri yine sızmaz. Fail-soft davranış akış/inceleme listesindeki kararla aynı.

### 📋 K2 kontrol listesi sonuçları
| Kontrol | Sonuç |
|---|---|
| Ölü kod (`--noUnusedLocals --noUnusedParameters`) | ✅ **SIFIR** |
| Worker `node --check` | ✅ |
| Çeviri senkronu | ✅ yalnızca bilinen `newPosts` çoğul farkı |
| Boş `catch` | ✅ 4 bulgu, **hepsi bilinen** (önbellek ayrıştırma); **yeni eklenen yok** |
| Modül önbelleği ↔ `removeKeys` | 🔴 **2 eksik → düzeltildi** |
| 400 satır kuralı | 🟡 **13 dosya** — F12'ye |
| Migration numara çakışması | 🟡 `010`/`012` — eski, ikisi de çalıştırılmış, dokunulmadı |
| Bayat worktree | 🟡 `intelligent-mclaren-7b32d5` hâlâ duruyor — silme kararı kullanıcıya ait |
| `console.log` kalıntısı | 🟡 47 adet (20'si `progress.ts`, 14'ü `fetchers.ts` — eski kod, akış dışı) |

> **400 satır notu:** iki dosya BU turlarda sınırı aştı — `feedApi.ts` (522, F14+Y8 ile) ve `account.tsx` (415, yeni anahtarla). Sessizce geçilmedi: F12'nin kapsamına açıkça yazıldı. `feedApi.ts` bölünmesi akış sorgusuna dokunacağı için ayrı ve dikkatli bir tur ister.

### Değişen dosyalar
`features/feed/services/feedApi.ts` (engel filtresi + `invalidateIdentityScopedFeedCaches`) · `context/AuthContext.tsx` · `docs/{MASTER_PLAN,HISTORY}.md`.

### Doğrulama
`tsc --noEmit --noUnusedLocals --noUnusedParameters` ✅ temiz. **Doğrulanamayan:** hesap değiştirme senaryosu cihazda test edilmedi (iki farklı Trakt hesabı gerekiyor).

### Sıradaki
Build kilidi hâlâ yürürlükte — **T9 tekrar testi** ve **F5 backfill zinciri** kaldı (bkz. §0).

---

## 184. 🔓 F4 KAPANDI — Build Kilidi Kalktı

**T9 tekrar testi geçti** (kullanıcı, web): wifi kapalıyken akıştan gönderi paylaşma denemesi artık **"Network Error"** veriyor, Madde 181'de düzeltilen yanlış teşhis (*"Kimliğin doğrulanamadı"*) geri gelmiyor.

Bununla F4'ün tüm çıkış kriterleri karşılandı: 13 test adımı geçti, bulunan 3 kusur (yanlış teşhis · gizleme ekrana yansımıyor · `fetchActivityById` filtresiz) düzeltildi ve düzeltmeler doğrulandı.

**🔓 Build dağıtma kilidi KALKTI.** Madde 172'de konulmuştu (v2 pivotu), gerekçesi: *"dağıtıldıktan sonra kullanıcıda oluşan veri temizlenemez; şu anki '0 satır' temiz sayfası kaybolur."* İnceleme sistemi artık uçtan uca doğrulandığı için oluşacak veri **beklenen** veri.

> 🔴 **Düzeltilen bir plan hatası:** `MASTER_PLAN` §0'a bir ara "kilit F5 backfill zincirine de bağlı" yazılmıştı. **Yanlıştı.** Kilidin gerekçesi dağıtım güvenliğiydi; backfill ise mevcut satırların veri kalitesi — ikisi farklı şeyler. Backfill açık iş olarak duruyor ama kilidi bloke etmiyor.

**Not:** T9 gerçek cihazda değil **web'de** doğrulandı. Kabul edilebilir sayıldı çünkü test edilen şey ağ hatası dalının mesajı ve o kod yolu platformdan bağımsız; T1-T13'ün tamamı zaten gerçek cihazda çalıştırılmıştı.

### Açık kalan elle iş
**F5 backfill zinciri** — 57 satırda `tmdb_id` eksik (47 `watched_episode` + 10 `rated`, 12 diziye ait). Üç adımlı zincir `MASTER_PLAN` F5 bölümünde. Trakt kapanma senaryosunda o kartlar poster çizemez.

### Sıradaki
**F6** — takip listesi snapshot'ı (Kol B). `getVisibleUserIds` bugün Trakt'ın `/users/me/following` ucuna bağlı; Trakt giderse akış tamamen boşalır.

---

## 185. 🔴 `rated` Geri-Alma Koruması — Trakt Kesintisi Beğeni/Yorumları Siliyordu

**Bulan:** F6 tasarımı için görevlendirilen alt ajan, yol boyunca. **F6'nın kapsamı dışında ama F6'nın gerekçesini çürütecek kadar ciddiydi:** faz "Trakt gittiğinde veri yaşasın" derken, mevcut kod aynı senaryoda veri siliyordu.

### Hata
`handleFeedSync` içinde `watchedToDelete` bir kapıyla korunuyordu:
```js
let watchedToDelete = [];
if (watchedRows.length > 0) { ... }   // "history boşsa hiç silme yapma"
```
Yanındaki `ratedToDelete` **korunmuyordu**. Üstündeki yorum varsayımı açıkça yazıyordu — *"Trakt her seferinde TÜM güncel puanları döndürüyor, bu yüzden tam karşılaştırma güvenli"* — ama **isteğin başarılı olduğu hiçbir yerde kontrol edilmiyordu.**

`ratingsShowsRes.ok ? await ratingsShowsRes.json() : []` deseni yüzünden bir 429/5xx sessizce `ratedRows = []`'e dönüşüyor, kod bunu "kullanıcının hiç puanı yok" diye okuyor ve grace penceresi dışındaki **tüm `rated` satırlarını siliyordu.** Kısmi hata bile yetiyordu: shows OK + movies 429 → tüm film puanları gider.

**Teorik değil:** Y7'de Trakt'ın 429'u canlıda gözlenmişti.

### Neden ciddi — asıl kayıp puanlar değil
Silinen satırlar bir sonraki BAŞARILI senkronda geri gelir (sync silmesi tombstone yazmıyor, doğrulandı) — ama **yeni bir `id` ile**. `feed_activity_likes` ve `comments` satıra `ON DELETE CASCADE` bağlı olduğu için o kartlara yapılmış **beğeniler ve yorumlar kalıcı olarak kaybolur.** Puan geri gelir, altındaki sosyal etkileşim gelmez.

> Alt ajan bunu "kalıcı veri kaybı" diye raporladı; doğrulandığında tablo daha ayrıntılı çıktı — puanlar için geçici, sosyal etkileşim için kalıcı. Fark, düzeltmenin gerekliliğini değiştirmiyor.

### Düzeltme
`ratedFetchOk = ratingsShowsRes.ok && ratingsMoviesRes.ok` bayrağı eklendi; geri alma yalnızca **ikisi birden başarılıysa** çalışıyor. Başarısızlıkta `console.error` ile durum kodları loglanıyor (sessiz atlama yok). `watchedToDelete`'in yanındaki koruma ilkesinin aynısı: *riskli bir varsayımda bulunmaktansa bayat veriyi olduğu gibi bırak.*

### Doğrulama
`node --check` ✅ · `npx vitest run` ✅ **29/29**. **Doğrulanamayan:** canlı 429 senaryosu simüle edilmedi (Trakt'ı kasten hata verdirmek gerekir).

### ✅ Yan doğrulama: `/users/me/following` sayfalanmıyor (F6 Adım 0)
Alt ajan, F6'nın ön koşulu olarak şunu uyarmıştı: *"Trakt'ın varsayılan sayfa boyutu 10 ise `getMyFollowingSlugs()` bugün yalnızca ilk 10 takibi görüyor ve akış zaten sessizce kırık demektir."* Spekülasyondu; **canlıda ölçüldü ve çürütüldü.**

| Uç | `x-pagination` | Dönen |
|---|---|---|
| `/movies/popular` (kontrol — sayfalandığı kesin) | ✅ `item-count=488, limit=100, page-count=5` | 100 |
| `/users/ardagnl/following` | ❌ **yok** | 3 (tamamı) |

Kontrol testi bilinçliydi: "başlık yok" sonucunun gerçekten "sayfalanmıyor" mu yoksa *ölçüm hatası* mı olduğunu ayırmak için. Bu oturumda üç kez ölçüm yöntemi yanıltmıştı (G1 HTTP 204 · `git check-ignore` · `user_id` filtresiz `count(*)`); dördüncüsü bu şekilde önlendi.

**Sonuç:** `getMyFollowingSlugs()` `limit` göndermediği için tam listeyi alıyor, sessiz kırpma yok. ⚠️ Uç `?limit=N`'i **kabul ediyor** — koda bir gün `limit` eklenirse liste sessizce kırpılır; parametresiz çağrı bilinçli korunmalı.

### Değişen dosyalar
`kaymaktv-feedback-worker/src/index.js`. **Deploy EDİLMEDİ.**

---

## 186. F6 — Takip Listesi Snapshot'ı (sunucu tarafı)

Tam tasarım: **[`docs/FOLLOW_SNAPSHOT_PLAN.md`](FOLLOW_SNAPSHOT_PLAN.md)** (yeni).

### 🔄 Faz yeniden çerçevelendi — ön tasarım çürütüldü
İlk tasarım *"Trakt başarısız olursa istemci snapshot'ı okur"* diyordu. Alt ajan taraması üç gerekçeyle çürüttü ve kabul edildi:

1. **Okuma yolu döngüsel.** Snapshot'ı okumak `users.id` gerektirir → o `trakt_slug`'dan gelir → slug **yalnızca Trakt'tan** gelir. Worker üzerinden okumak da imkânsız (`verifyAndUpsertUser` de Trakt'a gidiyor). **Fallback, tam ihtiyaç duyulduğu anda çalışmazdı.**
2. **Anon okuma = takip grafiği herkese açık.** Auth olmadığı için politika `USING(true)` olmak zorundaydı. Üstelik Trakt'ta gizli hesapların following listesi dışarıdan görünmezken `/users/me/following` kendi token'ıyla onu da getirir → **Trakt'ta olmayan bir sızıntı**.
3. **F8'den önce marjinal değeri sıfır.** Yerel kopya zaten var.

**Yeni model: snapshot F6'da YALNIZCA YAZILIR.** RLS açık, politika yok. Okuma yolu F7/F8'de açılacak. *Kapalı RLS sonradan açılabilir; açık RLS geri kapatılamaz.*

### 🔍 Üç yanlış varsayım ölçümle düzeltildi
| Varsayım | Gerçek |
|---|---|
| "Trakt giderse akış tamamen boşalır" | ❌ `followStore` listeyi **AsyncStorage'a kalıcılaştırıyor** — cihazda zaten çalışan bir yerel snapshot var |
| "Kendi aktivitelerin kalır" | ❌ **Tam tersi** — `getMyTraktSlug()` de Trakt'a bağlı, hatada `null` döner. Kaybolan **kullanıcının kendisi** |
| "Sayfalama riski olabilir" | ❌ Ölçüldü: `x-pagination` yok, tüm liste tek yanıtta (Madde 185) |

### Uygulanan (sunucu tarafı)
**`022_user_following_snapshot.sql`** — tek satır + `TEXT[]` dizi. Kenar tablosu reddedildi: N satır + diff döngüsü gerektirirdi ve **boş liste temsil edilemezdi** ("hiç senkron olmadı" ile "kimseyi takip etmiyor" ayrılamazdı). Slug saklanıyor, `users.id` FK'si değil — henüz katılmamış kişileri sessizce düşürmemek için (fazın amacı tam olarak onları saklamak).

**Worker `captureFollowingSnapshot`** — `handleFeedSync` içinde, **gizlilik erken dönüşünden ÖNCE** (gizlilik "senin aktiviten görünmesin" der; bu tablo "sen kimi görebilirsin" sorusudur). 12 saatlik tazelik kapısı Trakt maliyetini `+1/senkron`'dan `~1/kullanıcı/gün`'e indiriyor.

> ⛔ **Bu fonksiyonda `res.ok ? … : []` deseni YASAK** ve yorumla işaretlendi. O desen, bu dosyada hâkim olmasına rağmen tam olarak Madde 185'teki veri kaybına yol açtı. Snapshot'ta aynı hata, korumak için var olduğumuz veriyi silerdi. `normalizeFollowingSlugs` `null` (kabul edilemez yanıt) ile `[]` (gerçekten boş) ayrımını yapıyor.

### Doğrulama
`node --check` ✅ · `npx vitest run` ✅ **34/34** (29 mevcut + 5 yeni: geçerli yanıt · boş dizi · dizi olmayan · bozuk kayıtlar · tekilleştirme).

**Doğrulanamayan:** `022` çalıştırılmadı, Worker deploy edilmedi, canlı yakalama görülmedi.

### ✅ Canlı doğrulama (sunucu tarafı)
`022` çalıştırıldı, Worker deploy edildi. Snapshot yazıldı: **3 slug**, `synced_at 23:07:23Z` — `wrangler tail`'deki `02:07:22` senkronuyla birebir uyumlu. Hata/uyarı logu yok.

### Adım 5 — istemci sertleştirme (tamamlandı)
> **Değişmez korundu: `feedApi.ts` ve `useFeedRealtime.ts`'e HİÇ DOKUNULMADI.** Tüm iş `getFollowingSlugs()`/`getMyTraktSlug()`'ın arkasında yapıldı — bu, keyset `.or(...)` kırılganlığını ve Realtime senkronu gereğini yapısal olarak devre dışı bıraktı.

**`myIdentity.ts` — slug disk kopyası (fazın ön koşuluydu).** `getMyTraktSlug()` Trakt'a gidiyor ve hatada `null` dönüyordu; `getVisibleUserIds` kendi slug'ımı kümeye eklediği için **Trakt kesintisinde kullanıcı akışta KENDİNİ kaybediyordu.** Takip ettiklerinin kartları yerel kopyadan gelmeye devam ederken kendi kartları yok oluyordu — ters ve fark edilmesi zor. Artık başarılı slug AsyncStorage'a yazılıyor, hatada oradan okunuyor. `clearMyTraktSlug()` diski de siliyor (yoksa başka hesapla girişte önceki kullanıcının slug'ı fallback olarak dönerdi).

**`social.ts` — `Array.isArray` guard.** Trakt bir gün 200 + HTML gövde döndürürse (kapanış duyurusu, proxy sayfası) bugün `.map is not a function` TypeError'ı **tesadüfen** doğru davranıyordu. Artık niyetli ve teşhis edilebilir. Ayrıca `page`/`limit` göndermeme kararı yorumla korundu.

**`followStore.ts` — dört değişiklik:**
1. `fetchedAt` **diske yazılıyor.** Eskiden yalnızca RAM'deydi, yani her soğuk açılışta zaten kabul edilmiş 10 dakikalık tazelik sözleşmesi çöpe atılıyor ve akış ağı bekliyordu. Yeni bayatlık penceresi icat edilmedi — var olan sözleşme soğuk açılışa taşındı.
2. **`FAILURE_BACKOFF_MS = 60sn`.** Hata dalı `isFetched:false`, `fetchedAt:0` bırakıyordu → `isStale` hep `true` → **her `getFollowingSlugs()` çağrısı ölü Trakt isteğini yeniden deniyordu.** Sonsuz kaydırmada her sayfa `traktClient` timeout'una (20sn) kadar bloke olabiliyordu.
3. **`lastFailedAt`** + `selectIsFollowingListStale` — hata dalı `connectionStates`'e hâlâ dokunmuyor (mevcut doğru davranış), yalnızca damga koyuyor.
4. 🔴 **`reset()` artık diski de siliyor.** Eskiden yalnızca RAM temizleniyordu; AsyncStorage'daki liste duruyordu ve uygulama yeniden başlatıldığında hidrasyon **önceki hesabın takip listesini** yüklerdi. `fetchedAt` de diske yazıldığı için bu artık daha tehlikeli olurdu: liste "taze" görünüp ağa hiç çıkılmadan kullanılabilirdi. `hydrationPromise` da sıfırlanıyor.

**Akış ekranı** — `selectIsFollowingListStale` doğruyken satır içi amber not: *"Takip listesi güncellenemedi — son bilinen hâli gösteriliyor."* Alert değil, blocker değil. AI_RULES §2: akış çalışmaya devam ediyor ama kullanıcının "bu liste güncel olmayabilir" bilgisine hakkı var (o sırada takip ettiği yeni biri akışında görünmez).

### Doğrulama
`tsc --noEmit --noUnusedLocals --noUnusedParameters` ✅ · çeviri senkronu ✅ (yalnızca bilinen `newPosts`) · Worker `node --check` ✅ · `vitest` ✅ 34/34.

**Cihaz testi:** kullanıcı sorunsuz raporladı → **F6 ✅ KAPANDI.**

---

## 187. F9 — Moderasyon Altyapısı: Sansür Vektörü Kapatıldı (S15)

**Bağlam:** `MASTER_PLAN` F9. **F10'un ön koşulu** — sıra ihlal edilirse canlı bir sansür aracı doğar.

### Sorun
`018_content_reports.sql` ile gelen tabloda `UNIQUE(reporter_user_id, target_type, target_id)` yoktu ve `reporter_user_id` nullable'dı. Bugün zararsızdı çünkü otomatik gizleme kapalı — ama F10 (N rapor alan içerik akıştan düşer) bu düzeltme olmadan açılsaydı **tek kişi aynı içeriği N kez raporlayıp istediği yorumu sansürleyebilirdi.**

### 🔑 Üç değişiklik neden AYRILAMAZ
`UNIQUE` tek başına **hiçbir işe yaramazdı**: Postgres'te `NULL != NULL` olduğu için `reporter_user_id` nullable kaldığı sürece aynı kişi kimliksiz olarak sınırsız satır ekleyebilir ve kısıt hiç devreye girmezdi. NOT NULL yapmak için kimlik doğrulaması gerekiyor, o da yazmanın Worker'a taşınması demek. Üçü tek bir düzeltmenin parçaları.

### `023_content_reports_integrity.sql`
Migration **kendini durdurabiliyor**: NULL `reporter_user_id` veya UNIQUE'i ihlal edecek tekrar satır bulursa `RAISE EXCEPTION` ile duruyor ve ne yapılacağını (hazır SQL ile) söylüyor. **Bilinçli olarak veri silmiyor** — moderasyon sinyali sessizce yok edilmemeli, karar insana ait.

> ⚠️ **Yakalanan çelişki:** `reporter_user_id` `ON DELETE SET NULL` idi. `NOT NULL` ile birlikte bu, kullanıcı silindiğinde Postgres'in kolonu NULL yapmaya çalışıp kısıta takılması — yani **hesap silme işleminin başarısız olması** demekti. FK `ON DELETE CASCADE`'e çevrildi; `handleAccountDelete`'in mevcut davranışıyla da tutarlı (hesap silme = tüm verinin silinmesi).

Bölüm B (anon INSERT politikasını düşürme) **ayrı tutuldu**: Bölüm A güvenle hemen çalıştırılabilir, B bir dağıtım penceresi ister — erken çalıştırılırsa güncellenmemiş istemcilerde bildirme kırılır.

### Worker `/feed/report`
`reporter_user_id` **istekten değil, doğrulanan token'dan** geliyor (diğer 13 ucun IDOR deseni). Rate limit diğer sosyal uçlardan **daha sıkı** (10/dk vs 20/dk) — F10 sonrası bu uç bir moderasyon kaldıracı olacak. `status` gönderilmiyor (DB DEFAULT `'open'`); istemcinin moderasyon durumuna yazma yetkisi hiçbir zaman olmamalı.

`ignore-duplicates` + `return=representation` ile tekrar bildirim **sessizce "başarılı" sayılmıyor**: boş dizi dönerse `duplicate: true` bayrağı istemciye geçiyor ve kullanıcı *"Bu içeriği zaten bildirmiştin."* görüyor. Sessizce teşekkür etmek yalan olurdu ve kullanıcı tekrar tekrar denemeye devam ederdi.

### 018'in mimari sapması kapandı
O migration anon INSERT'e izin verirken gerekçesini yazmıştı: *"bu tablonun Worker'ı YOK, kaynak kodu bu repoda değil… ileride ayrı bir Worker endpoint'i eklenirse bu INSERT politikası kaldırılıp yazma da Worker'a taşınabilir."* Gerekçe yazılı olduğu için bugün ne zaman kapanacağı belliydi.

### ⚠️ Davranış değişikliği: misafir artık bildiremez
Bilinçli. 018 *"kim olduğu bilinmese bile bildirim değerlidir"* diyordu; o gün doğruydu ama kimliksiz bildirim kabul etmek UNIQUE kısıtının tamamını işlevsiz bırakıyor. Beğeni, yorum ve engelleme de giriş gerektiriyor — bildirme tek istisnaydı.

### Doğrulama
`tsc` ✅ · Worker `node --check` ✅ · `vitest` ✅ 34/34 · çeviri senkronu ✅.

**Doğrulanamayan:** `023` çalıştırılmadı, Worker deploy edilmedi, bildirme akışı canlıda denenmedi. Elle adımların sırası `MASTER_PLAN` §0'da.

### ✅ Canlı doğrulama
`023` Bölüm A çalıştırıldı, Worker deploy edildi. `wrangler tail`:
```
[feed/report] yeni — hedef: activity/56893ec0…, sebep: spam
[feed/report] TEKRAR (yok sayıldı) — aynı hedef, sebep: harassment
[feed/report] TEKRAR (yok sayıldı) — aynı hedef, sebep: spoiler
```
**UNIQUE kısıtı canlıda çalışıyor** — ve sebep değiştirmenin kısıtı atlatmadığı da doğrulandı (kısıt `(kullanıcı, hedef)` üzerinde, sebep dahil değil).

> Test sırasında birkaç `401 "Trakt token geçersiz"` görüldü, sonra kendiliğinden geçti. Token sağlamdı (ilk istek başarılıydı) — **Y7'nin ikinci kez ısırması**: `verifyAndUpsertUser` her çağrıda Trakt `/users/settings`'e gidiyor ve Trakt'ın 429'u ile gerçekten geçersiz token aynı mesajı üretiyor. Y7 artık ertelenmemeli; ayrıntı SONRADAN BULUNANLAR.

### 🔧 Kullanıcı bildirimi: "zaten bildirdin" mesajı görünmüyordu
Mesaj `Snackbar` ile gösteriliyordu ama modal açık kalınca **toast modalın arkasında eziliyordu** — kullanıcı mesajı hiç görmüyor, tekrar tekrar deniyordu.

**Düzeltme:** başarı dışındaki tüm durumlar (duplicate + hata) artık **modal İÇİNDE**, butonların hemen üstünde kalıcı bir kutuda gösteriliyor (`WriteReviewSheet`'teki `errorMessage` deseni). Toast yalnızca başarıda kalıyor — orada modal zaten kapanıyor, mesajın gidecek bir yeri var. "Zaten bildirdin" bir hata değil bilgi olduğu için amber, gerçek hata kırmızı.

Metin de genişletildi: *"Sebebi değiştirmek yeni bir bildirim oluşturmaz."* — kullanıcının ilk refleksi tam olarak sebebi değiştirip tekrar denemekti (tail'de görüldü: spam → harassment → spoiler).

Ayrıca hata dalında artık sunucudan gelen gerçek mesaj gösteriliyor; genel "tekrar dene" metni oturum/ağ/kota gibi farklı sebepleri aynı kutuya tıkıyordu.

### 📖 `docs/MODERATION.md` (yeni)
Kullanıcı sordu: *"bildirilen içerikler nereye gidiyor, kaldırmadan önce nerden görürüm?"* — cevabın kalıcı hâli. Bildirimleri **içerikleriyle birlikte** getiren SQL (activity/comment join'li), en çok bildirilenler sorgusu, moderasyon eylemleri (sil/kapat/reddet) ve yetki tablosu. Uygulama içi panel bilinçli olarak yok: `content_reports`'ta `SELECT` politikası hiç verilmedi, yalnızca `service_role` okuyabiliyor.

### Sıradaki
**F10** — rapor sayacı + otomatik gizleme. Artık güvenli: `023` sonrası bir hedefe ait bildirim sayısı **gerçek kişi sayısı**, eşik ona güvenebilir. Orada iki ürün kararı var: **eşik** ve **itiraz yolu** (gizleme geri alınabilir, silme alınamaz).

---

## 188. Y7 Kısmen Kapandı — Kimlik Hatalarının Sebebi Yüzeye Çıktı

**Tetikleyici:** kullanıcı `/feed/report` VE `/feed/sync` uçlarında `401 "Trakt token geçersiz veya süresi dolmuş."` aldı. Token sağlamdı (aynı oturumda başka istekler geçiyordu). **Y7'nin üçüncü ısırması** ve ilk kez `/feed/report` dışında bir uçta.

### Sorun: dört farklı sebep, tek mesaj
`verifyAndUpsertUser` başarısızlıkta `null` dönüyordu ve 13 ucun tamamı bunu aynı cümleye çeviriyordu. Oysa:

| Gerçek sebep | Kullanıcının yapması gereken | Gördüğü mesaj |
|---|---|---|
| Trakt **429** | Birkaç dakika beklemek | "token geçersiz" |
| Trakt **401** | Yeniden giriş | "token geçersiz" |
| Trakt **5xx** | Hiçbir şey (bizde sorun yok) | "token geçersiz" |
| **Supabase** hatası | Hiçbir şey (sunucu sorunu) | "token geçersiz" |

En kötüsü 429: kullanıcı "token geçersiz" görüp çıkış/giriş deniyor, bu da **daha çok Trakt isteği** demek — yani mesaj, sorunu büyütüyordu.

### Çözüm: `verifyCaller` + `authErrorResponse`
`verifyCaller` `{ user, errorKind }` döndürüyor (`rate_limited` · `invalid_token` · `trakt_unavailable` · `trakt_unreachable` · `trakt_bad_response` · `db_error`). `authErrorResponse` her birini doğru HTTP koduna ve **kullanıcının o durumda ne yapması gerektiğini söyleyen** bir mesaja çeviriyor. 429 mesajında *"oturununda bir sorun yok"* cümlesi bilinçli — yanlış refleksi baştan kesiyor.

> ⚠️ **TOPLU REFACTOR BİLİNÇLİ OLARAK YAPILMADI.** `verifyAndUpsertUser` ince bir sarmalayıcı olarak korundu; 13 ucun hiçbiri değişmek zorunda kalmadı. Yalnızca sorunun yaşandığı iki uç (`/feed/sync`, `/feed/report`) geçirildi. Gerekçe: 13 yazma ucunu tek seferde değiştirmek `MASTER_PLAN` §3'ün "kimlik refactoru — hata hepsini birden kırar" dediği riskin ta kendisi. Bu, F7'deki `resolveCaller`'ın **tohumu**; kalan uçlar dokunuldukça geçecek.

**Yan kazanç:** sebep artık HER durumda loglanıyor (`[verifyCaller] …`), yani geçirilmemiş uçlarda bile `wrangler tail` ile teşhis mümkün. Ayrıca `traktFetch` çağrısı try/catch'e alındı — ağ seviyesindeki hata eskiden isteği tamamen düşürüyordu.

### Doğrulama
`node --check` ✅ · `vitest` ✅ **34/34** (geriye uyumluluk korundu). **Doğrulanamayan:** deploy edilmedi; 401'in gerçek sebebi hâlâ bilinmiyor — bir sonraki denemede `[verifyCaller]` logu veya kullanıcının gördüğü yeni mesaj söyleyecek.

### 🔔 Bildirimler artık Discord'a düşüyor (kullanıcı isteği)
Kullanıcı sordu: *"Bu raporlar nereye düşüyor? Zaten kurmuş olduğumuz Discord sistemi var, oraya düşebilir. Bir id ile düşse kolayca Supabase'den bulabilirim."*

`MODERATION.md`'nin "bilinen sınırlar" bölümünde yazılı olan eksik tam olarak buydu: *"Bildirim geldiğinde uyarı yok — düzenli olarak sorguyu çalıştırmak gerekiyor."* Geri bildirim sisteminin **zaten kullandığı** webhook yeniden kullanıldı, yeni altyapı eklenmedi.

Mesaj içeriği: rapor id · sebep · hedef tipi/id · bildirenin açıklaması.

> ⚠️ **Bildirilen içeriğin METNİ gönderilmiyor** — bilinçli. UGC'yi üçüncü bir platforma yaymak gereksiz bir gizlilik yüzeyi; kullanıcının istediği zaten "id ile bulabileyim" idi. Rapor id'siyle `MODERATION.md` §2'deki sorgudan tam kayda bakılıyor.

**Tekrar bildirimlerde mesaj gitmiyor:** UNIQUE kısıtı yeni satır üretmediği için Discord'a da yeni bilgi taşınmaz — aksi halde kullanıcının bilinen "sebebi değiştirip tekrar dene" refleksi kanalı doldururdu.

**Fail-soft:** Discord erişilemezse bildirim yine de kaydedilir, `/feed/report` yanıtı etkilenmez — ama sessiz değil, hata loglanır.

### 📌 Kayda geçen: "İçeriği Bildir" notsuz kartlarda da görünüyor (Y10)
Kullanıcı fark etti: *"şu kişi X sezonu izledi"* gibi sistem loglarında bildirmeye gerek yok. Araştırıldı ve **kısmen doğru** çıktı:

- **Maraton kartında rapor zaten yok** — `MarathonFeedCard` sentetik bir gruplama, tek bir `target_id`'ye bildirilemiyor (gerekçesi kodda yazılı).
- **Ama "izleme kartı = sistem mesajı" varsayımı yanlış:** `FeedCard` her aktivite tipinde not eklemeye izin veriyor ve not varsa o kartın **birincil içeriği** oluyor (Twitter'ın alıntı tweet'i deseni, bilinçli özellik). Yani notlu bir izleme kartı tam anlamıyla UGC.

Doğru koşul tipe değil içeriğe bakmak olurdu (`!!activity.note`). **Uygulanmadı — kullanıcı kararı:** Google Play UGC politikası açısından menüden bildirme seçeneği kaldırmak, gereksiz bir seçenek bırakmaktan daha riskli. `MASTER_PLAN` → Y10.

### 📌 Kayda geçen (F10 sonrası okunacak): Google girişi altyapısı hazır
Kullanıcı bildirdi: Supabase ↔ Google Cloud entegrasyonu **yapılmış**, kimlik bilgileri hazır. **Henüz kullanılmıyor.** Sıra bağımlılığı değişmedi ve kritik: **F7 (kimlik katmanı) → F8 (Google giriş + hesap birleştirme) → G2.** S9 (`users.trakt_slug` NOT NULL + 13 uç `traktAccessToken` zorunlu) ve S14 (birleştirme köprüsü yok) çözülmeden Google girişi açılırsa mevcut kullanıcıların hesabı ikiye bölünür. Kullanıcı da aceleci olmadığını belirtti.

---

## 189. F10 — Rapor Sayacı + Otomatik Gizleme

**Bağlam:** `MASTER_PLAN` F10. `023` (F9) ön koşuldu ve tamamlandı. Kullanıcı kararları: **eşik 3 farklı kişi**, **kapsam akış kartları + yorumlar**.

### 🔑 İtiraz yolu tasarımdan doğdu
Sayaç "toplam bildirim" değil **"açık (`open`) bildirim"** olarak tanımlandı. Bu tek karar itiraz yolunu kendiliğinden üretti: moderatör bir bildirimi `dismissed` yaptığında sayaç düşer ve **içerik otomatik geri gelir.** Ek bir mekanizma, "geri al" butonu, geri yükleme işi yok.

Bu, F10'un en riskli sorusuna (*"yanlış gizlenen içerik ne olacak?"*) yapısal bir cevap: gizleme **silme değil**, dolayısıyla geri dönüş bedava.

### Mekanizma
`feed_activities.report_count` + `comments.report_count`, `content_reports` üzerindeki bir trigger'la güncelleniyor. Sonra:
- `in_feed` GENERATED ifadesine **üçüncü kural** eklendi (`report_count < 3`) — 020'nin bölüm incelemesi ve 021'in yazar gizlemesi kurallarının yanına. **Akış sorgusu yine hiç değişmedi**; `in_feed` üç turdur tek kapı olmayı sürdürüyor.
- `comments.is_visible` (yeni, türetilmiş) + istemci filtresi.

> ⚠️ **Trigger artırma/azaltma DEĞİL, YENİDEN HESAPLAMA yapıyor** — `015`'teki `bump_activity_like_count` deseninden bilinçli sapma. Gerekçe: orada "beğeni" iki durumlu (var/yok), burada üçüncü bir eksen var — `status`. Bir bildirimin durumu değiştiğinde artırma/azaltma hangi yöne gideceğini bilemez ve sayaç zamanla ıraksar. Yeniden hesaplama INSERT/DELETE/status-UPDATE'in üçünü de tek yoldan doğru sonuca götürüyor.

> **Eşik neden `app_settings`'te değil:** GENERATED ifadeleri sabit gerektiriyor. Bu bilinçli bir kısıt olarak kabul edildi — eşiğin çalışma zamanında değişebilmesi, moderasyon davranışını sessizce kaydırabilecek bir kaldıraç olurdu. Değiştirmek küçük bir migration.

> **`is_visible` POZİTİF isimlendirildi** (`is_hidden` değil), `in_feed` ile aynı yönde okunsun diye. Ters isimlendirme F14'te canlıda yaşanan "aynı ekranda iki zıt yön" karışıklığını tekrarlardı.

### 🔴 Dürüst tespit: bugün tetiklenmeyecek
Kullanıcının bildirdiği ölçek 10'dan az kullanıcı (3 kişi takip ediliyor). "3 farklı kişinin aynı içeriği bildirmesi" bugün imkânsıza yakın. **F10'un bugünkü değeri işlevsel değil ALTYAPISAL:** Google Play/App Store'un UGC moderasyonu beklentisi ve ölçek büyüdüğünde hazır olmak. Bunu "şu an bir sorunu çözüyoruz" diye sunmak yanlış olurdu; migration'ın başına da yazıldı.

### 📥 Y11 kaydedildi
Gizlenen yorumlar kartın `comment_count` sayacında sayılmaya devam ediyor ("3 yorum" der, 2 görünür). Düzeltmek `015`'teki artırma trigger'ını yeniden hesaplamaya çevirmeyi gerektiriyor — çalışan bir sayaca dokunmak F10'un kapsamını genişletirdi. Bugün tetiklenmiyor; ölçek büyümeden önce kapatılmalı.

### Değişen dosyalar
**Yeni:** `supabase/schema/024_report_auto_hide.sql`.
**Değişen:** `features/feed/services/feedSocial.ts` (`is_visible` filtresi) · `docs/{MODERATION,MASTER_PLAN,HISTORY}.md`.

### Doğrulama
`tsc` ✅ · migration numara çakışması ✅ yok. **Doğrulanamayan:** `024` çalıştırılmadı; sayaç, otomatik gizleme ve itiraz yolu canlıda denenmedi (migration sonundaki "CANLI ZİNCİR TESTİ" bunun için).

### Sıradaki
Kol C tamamlandı (F9 → F10). Kalan büyük iş **F7 → F8** (kimlik katmanı + Google giriş). Google altyapısı kullanıcı tarafından hazırlanmış durumda; `verifyCaller` (Madde 188) F7'nin ilk adımıydı.

---

## 190. 🔍 SİSTEM DENETİMİ — 4 Alt Ajan + Canlı Doğrulama

**Kullanıcı isteği:** *"Şu ana kadar yaptığımız her şeyi alt ajanlara denetlettir. Yeni özelliklere geçmeden önce sistemi acımasızca test etmeni istiyorum."* Dört uzmanlık alanı: güvenlik/RLS · ölü kod · veri bütünlüğü · performans/UX.

**Yöntem notu:** her ajana **bilinen yanlış alarmların listesi** verildi (S11, 400 satır borcu, `newPosts` çoğulu, kasıtlı boş `catch`'ler, silinmiş dosyalar, `010/012` çakışması). Bu olmadan dördü de aynı bilinen şeyleri raporlar ve gerçek bulgular gürültüde kaybolurdu.

---

### 🔴 K1 — CANLI SÖMÜRÜLEBİLİR AÇIK (kapatıldı)

**Zincirin dört halkası da canlıda ölçüldü:**

| Halka | Doğrulama |
|---|---|
| `users.id` anon'a açık | ✅ `GET /users?select=id` → gerçek UUID'ler |
| `content_reports` anon INSERT açık | ✅ `status:'open'` ile **23503 FK** → RLS geçti |
| `024` canlıda | ✅ `report_count`, `in_feed`, `is_visible` kolonları mevcut |
| Eşik 3 → otomatik gizleme | ✅ |

**İstismar:** Uygulamayı indiren herhangi biri, Trakt hesabı olmadan, 3 gerçek `users.id` alıp tek istekte 3 sahte bildirim yazar → `report_count=3` → istediği içerik herkesin akışından kaybolur. Moderatör tabloda **masum üç kullanıcıyı** görür; Discord'a uyarı gitmez (o yalnızca Worker yolunda).

> 🔴 **Bu benim hatamdı.** `023` Bölüm B'yi *"istemci deploy'undan sonra"* diye ertelemiştim. İstemci deploy edildi ve `/feed/report` canlıda çalışmaya başladı — erteleme gerekçesi o an geçersizleşti ama kapatmayı hatırlatmadım. Sonra `024` üzerine geldi ve boşluk teorik bir eksiklikten **gerçek bir sansür aracına** dönüştü.

**Çözüm:** `DROP POLICY "content_reports_insert_anon"`. Kullanıcı çalıştırdı, **kapandığı doğrulandı** (aynı test artık `42501`) ve Worker yolunun sağlam kaldığı da test edildi (`/feed/report` token'sız → 400).

---

### 🔬 Ölçüm yöntemi ders verdi (iki kez)

**1. İlk K1 testim beni yanılttı.** `status` alanını göndermeden yaptığım INSERT `42501` (RLS ihlali) döndü — "kapalı" diye yorumlayacaktım. Ama politika `WITH CHECK (status = 'open')` ve PostgREST DEFAULT uygulanmadan değerlendiriyor. `status:'open'` açıkça gönderilince **23503 (FK)** döndü — yani RLS geçmişti. Kıyas testi (`feed_activities` INSERT → `42501`) gerçekten kapalı bir tablonun nasıl göründüğünü doğruladı.

**2. Ajan 4'ün 1 numaralı bulgusu çürüdü.** *"Web'de `Alert.alert` no-op, 60 çağrı bozuk"* dedi. `patches/react-native-web+0.21.2.patch` mevcut ve `node_modules`'daki kod `window.alert`/`window.confirm`'e düşüyor — bulgu geçersiz.

> **Ajanı yanıltan şey bir BAYAT YORUMDU:** `utils/confirmDialog.ts`'in başlığında hâlâ *"Alert.alert TAM BİR NO-OP'tur"* yazıyor. Patch geldiğinden beri o cümle yalan ve bir denetçiyi 60 çağrı noktası boyunca yanlış yöne sürükledi. Yanlış doküman, yanlış koddan daha pahalıya mal olabiliyor.

**3. Benim de bir varsayımım yanlıştı:** ajanlara *"024 hariç hepsi canlıda"* dedim. İki ajan bağımsız olarak `024`'ün uygulanmış olduğunu ölçtü; doğruladım, haklılar. `HISTORY` Madde 189'daki "çalıştırılmadı" notu bayatmış.

---

### `025_integrity_fixes.sql` — üç düzeltme

**B1 · `uq_feed_rated`'da `media_type` eksikti.** Trakt id'leri dizi ve film için ayrı uzaylardan; aynı sayı ikisinde de geçerli ve ikisi de `show_id` kolonunda. Proje bunu **üç yerde doğru tespit etmiş** (`ratedKeyOf`, `013`, Worker yorumları), kısıtı hiç düzeltmemiş. Tetiklenirse o kullanıcının senkronu **kalıcı olarak** 502'ye düşer ve kendini onarmaz. Canlıda ölçüldü: çakışma **yok**, yani henüz tetiklenmemiş.

**B4 · Retention `rated`'i her gece silip geri ekliyor.** `014`'ün *"döngü yapısal olarak imkânsız"* gerekçesi (senkron penceresi 50 < korunan 200) **yalnızca `watched_*` için doğru** — `rated` için Trakt limitsiz döndürüyor. Silinen satır ertesi gün **yeni id** ile geri gelir → o karta yapılmış beğeni/yorumlar `CASCADE` ile kalıcı gider (Madde 185'in birebir aynısı). Canlıda ölçüldü: **bir kullanıcı tam 200/200 satırda.**

**B3 · Moderasyon gizlemesi yapım sayfasında etkisizdi.** `in_feed` üç kural taşıyor ama kapsamları farklı: bölüm incelemesi ve yazar gizlemesi yapım sayfasında *görünmeli*, moderasyon gizlemesi **her yerde** gizlenmeli. Üçü `AND`'lendiği için `fetchMediaReviews` filtreyi bilinçli olarak uygulamıyordu — 021 için doğruydu, 024 gelince delik açtı. Ayrı `is_visible` kolonu eklendi (`comments.is_visible` ile simetrik).

> **`watched_movie` unique kısıtı (B2) BİLİNÇLİ OLARAK EKLENMEDİ.** Kısıt eklenirse senkronun toplu INSERT'i tek çakışan satır yüzünden tüm partiyi düşürür ve 502 döner. Önce Worker'ın tek-tek INSERT + 23505 yutma desenine geçmesi gerekiyor. Migration'ın başına yazıldı.

### Doğrulama
`tsc` ✅ · migration çakışması ✅ yok · K1 kapanışı canlıda ✅ · Worker yolu sağlam ✅.
**Doğrulanamayan:** `025` henüz çalıştırılmadı.

---

## 191. F15 — Kullanıcıya Dokunan Denetim Düzeltmeleri

**Bağlam:** `MASTER_PLAN` Kol E, sistem denetiminden (Madde 190) çıkan bulgular. **Seçim ölçütü bilinçli olarak dar tutuldu:** bugün gerçek bir kullanıcıyı *yanıltan* veya *emeğini kaybettiren* kusurlar. Performans ve mimari borcu bu faza alınmadı.

### 🔴 Y17 — Uygulama hata durumunda YALAN söylüyordu (en ağırı)

`useEpisodeDetail` `hasError` **hiç tutmuyordu.** Trakt düştüğünde `episode/[id].tsx` fallback zinciriyle (`episodeData?.title || t('episodeNum')`) sayfayı **başarıyla açılmış gibi** çiziyordu: *"Bölüm 5 · Henüz özet yok · Tarih yok"*.

Daha kötüsü: `first_aired` boş kaldığı için `isFutureOrTBA` **true** oluyor, **"TBA" rozeti** basılıyor ve **"İzledim" butonu tamamen kayboluyordu**. Yani Trakt çöktüğü için kullanıcıya *"bu bölüm henüz yayınlanmadı"* deniyordu. Bu boş ekrandan kötü — uygulama yanlış bilgi veriyordu.

`show`/`movie` ekranlarında bir dal vardı ama **yanlış teşhis** koyuyordu: *"Dizi bulunamadı"*. Dizi duruyor; yalnızca yüklenemedi. Üstelik **"Tekrar Dene" yoktu**, sadece "Geri Dön" — geçici bir ağ hatası kullanıcıyı sayfadan tamamen kovuyordu.

**Düzeltme:** üç hook'a da `hasError` eklendi (ölçüt: yapımın/bölümün **kendi** verisi gelmediyse hata; `related`/`cast`/`still` eksikliği hata **değil**, fallback'leri var). Ortak `components/LoadFailedState.tsx` yazıldı.

> **Yan kazanç:** üç hook da `refreshData` döndürüyordu ve **üçünde de kullanılmıyordu** (Y5 ile aynı kök). "Tekrar Dene" butonu onu nihayet bağladı.

### 🔴 Y16 — Üç yazma yüzeyinde onaysız metin kaybı
`ComposePostModal` · `FeedCommentSheet` · `NoteEditorModal`: arka plana dokunma, X ve Android geri tuşu metni **onaysız** siliyordu. Klavyeyi kapatmak için sheet'in üstündeki karartılmış alana dokunmak mobilde en doğal refleks — yani uzun bir metin tek dokunuşla, geri alınamaz şekilde gidiyordu.

`WriteReviewSheet` bu korumayı F4-T9'da kazanmıştı; **kapatma tarafı diğer üçüne hiç taşınmamıştı.** `requestClose` deseni eklendi.

> `NoteEditorModal`'da ölçüt *"metin var mı"* değil **"değişti mi"** — düzenleme modunda not zaten dolu geliyor; hiçbir şey değiştirmeden çıkana onay sormak gereksiz sürtünme olurdu.

### 🔴 Y18 — Gizlilik anahtarı sessizce başarısız oluyordu
`catch` yalnızca `console.warn` atıp anahtarı eski hâline döndürüyordu. Kullanıcı "gizle" der, Worker 401/429 döner, anahtar **sessizce geri açılır** — fark etmezse aktiviteleri paylaşılmaya devam eder ve **gizlediğini sanır.** Bir beğeni değil, bir **gizlilik kontrolü**; burada sessizlik kabul edilemez. `saveError` + ayarlar ekranında görünür uyarı (bölümün en üstünde, hangi anahtarın başarısız olduğundan bağımsız görülsün diye).

> **İlke:** optimistic UI'ın geri alınması **geri bildirim değildir** — `AI_RULES` §2 bunu açıkça söylüyor.

### 🟠 Y21 — Akışta "devamı yüklenemedi" çıkmazı
Eski yorum *"tekrar kaydırınca yeniden denenir"* diyordu — **ama kullanıcı zaten en alttadır ve kaydıracak yer yoktur**, yani `onEndReached` bir daha tetiklenmez. Spinner kaybolur, hiçbir şey gelmez, hiçbir mesaj çıkmazdı: akışın bittiğini mi bozulduğunu mu anlamanın yolu yoktu. `loadMoreFailed` + footer'da görünür "Tekrar Dene". Çelişen eski yorum da kaldırıldı.

### 🟢 Y20 — `SectionErrorBoundary` yayılımı (KISMİ)
**Yapıldı:** akış kartları (`renderItem`, `silent` — bozuk **tek** kart artık tüm akışı `ErrorFallback`'e düşürmüyor) ve `show/[id].tsx` → `MediaCast`.
**Kalan:** `MediaHero` (595 satır, Trakt ham verisini okuyor — en değerlisi), `SeasonAccordion`, `HorizontalMediaList`, `movie` blokları. Çok satırlı JSX oldukları için script ile sarmalamak riskliydi; elle yapılmalı.

### Doğrulama
`tsc --noEmit --noUnusedLocals --noUnusedParameters` ✅ temiz · çeviri senkronu ✅ (yalnızca bilinen `newPosts`).
**Doğrulanamayan:** hiçbiri cihazda test edilmedi.

> **Yöntem notu:** bu tur `sed`/`node` ile yapıldı ve üç kez bash **backtick'i komut olarak yorumlayıp** eklenen yorumları bozdu; bir kez de fonksiyon `import` satırının ortasına yazıldı (`git checkout` ile geri alınıp düzeltildi). Çok satırlı JSX/TS düzenlemesinde satır-numarası tabanlı yaklaşım ve `<< 'EOF'` heredoc (bash genişletmesi kapalı) güvenilir olan; ham `node -e "..."` içinde backtick ve `$1` kullanmak değil.

### Değişen dosyalar
**Yeni:** `components/LoadFailedState.tsx`.
**Değişen:** `hooks/{useEpisodeDetail,useShowDetail,useMovieDetail}.ts` · `app/{episode,show,movie}/[id].tsx` · `features/feed/components/{ComposePostModal,FeedCommentSheet,NoteEditorModal}.tsx` · `features/feed/hooks/{useFeed,useFeedPrivacy}.ts` · `app/(protected)/{account,(tabs)/feed}.tsx` · `locales/{tr,en}/{feed,media}.json`.

### Sıradaki
**F16** — açık proxy güvenliği (Y12). Cloudflare WAF rate-limit `/api/*` kodsuz ve anında; ardından `server.js`'te `cors({origin})` + `express-rate-limit` + Trakt uç beyaz listesi.

---

## 192. F16 — Açık Proxy Güvenliği (Y12): CORS + Rate Limit + Uç Beyaz Listesi

**Bağlam:** `MASTER_PLAN` Kol E, denetimin en acil güvenlik bulgusu. `kaymaktv.com/api/tmdb` ve `/api/trakt-proxy` kimliksiz, rate-limit'siz ve `Access-Control-Allow-Origin: *` ile herkese açıktı. SSRF yok — sorun **kimliksiz kota tüketimi**: Trakt ücretlendirmeye geçtiği için doğrudan fatura riski, TMDB tarafında anahtarın kota aşımıyla askıya alınması.

Oturumun başında canlıda tekrar ölçüldü ve açık doğrulandı: `curl -sI https://kaymaktv.com/` → `access-control-allow-origin: *`, `x-powered-by: Express`, `Server: cloudflare`.

### 🔴 Beyaz liste TAHMİNLE yazılsaydı iki şey kırılırdı

Proxy'nin dört handler'ı (`GET`/`POST`/`DELETE`/`PUT`) **genel amaçlıydı**: `endpoint` query parametresine ne yazılırsa `api.trakt.tv`'nin o yoluna gidiliyordu. Yani Trakt'ın TÜM API'si kimliksiz olarak dışarıdaydı. Daraltmak için "hangi uçlar gerçekten kullanılıyor" sorusunun cevabı gerekiyordu ve bu **tahmin edilecek bir şey değildi**:

**1. `urn:ietf:wg:oauth:2.0:oob`** — `redirect_uri` beyaz listesi yazarken makul liste "`kaymak://settings` + `https://kaymaktv.com/settings`" gibi görünüyor. Ama `services/api/traktClient.ts`'te **iki çağrı noktası** token yenilemeyi `refreshTraktToken(refreshToken, 'urn:ietf:wg:oauth:2.0:oob')` ile yapıyor. Bu değer listeden düşseydi hiçbir kullanıcının oturumu yenilenemez, **herkes oturumdan düşerdi** — üstelik hata deploy'dan saatler sonra, token'lar dolmaya başlayınca ortaya çıkardı.

**2. `/users/settings`** — `services/api/users.ts`'teki `webProxyGet` yolundan geçiyor ve grep'te doğrudan `endpoint:` deseniyle görünmüyor (değişken üzerinden geliyor).

Liste `services/api/{social,users}.ts` okunarak çıkarıldı, sonra **derlenmiş `dist` bundle'ıyla karşılaştırılarak** doğrulandı — iki bağımsız kaynak aynı 13 çağrıyı gösterdi.

> **Yanlış alarm da elendi:** `services/api/traktClient.ts:100`'deki bir yorum *"CORS yüzünden Trakt'a doğrudan değil `/api/trakt-proxy` üzerinden gidiyor"* diyor. Bu okununca "tüm Trakt trafiği proxy'den geçiyor, beyaz liste her şeyi kırar" sanılabilirdi. Dosya açılınca görüldü ki yorum `users.ts`'teki dar yolu tarif ediyor; `getTraktClient()` doğrudan Trakt'a gidiyor.

### Ölçülen beyaz liste (13 çağrı, 4 metod)
`GET`: `/users/hidden/{progress_watched,calendar}` · `/users/requests` · `/users/settings`
`POST`: `/users/hidden/{...}` · `/users/hidden/{...}/remove` · `/users/{slug}/follow` · `/users/requests/{id}`
`DELETE`: `/users/{slug}/follow` · `/users/requests/{id}`
`PUT`: **boş** — handler ayakta (HISTORY Madde 134'te bilinçli bırakılmıştı) ama bugün hiçbir istemci çağrısı yok.

Desenler tam eşleşme (`^...$`) olduğu için yol geçişi (`/users/settings/../../oauth/token`) ve `endpoint`'e query iliştirme de kendiliğinden kapandı.

### 🔬 `trust proxy` açmak yanlış cevaptı

Rate limit anahtarı Cloudflare arkasında ince bir tuzak: `req.ip` edge sunucusunun IP'sini verir, yani **tüm kullanıcılar tek anahtar altında toplanır** ve limit hepsini birlikte keser. Refleks çözüm `app.set('trust proxy', true)` ama o da yanlış: Cloudflare `X-Forwarded-For`'a ziyaretçi IP'sini **ekler** (üzerine yazmaz), dolayısıyla saldırganın gönderdiği sahte değer en solda kalır ve limit atlatılır. Doğrusu `CF-Connecting-IP` — onu Cloudflare her zaman üzerine yazar.

### Sessiz yanlış yapılandırmaya karşı
Geliştirme kaynakları (`localhost`, `exp://`) `NODE_ENV !== 'production'` ile açılıyor ve sunucu açılışında hangi modda olduğu **terminale basılıyor**. Tercih bilinçli olarak "kırılmama yönünde": prod'da `NODE_ENV` set edilmemişse localhost kaynakları kabul edilir (ciddi bir açık değil — saldırgan kendi localhost'una yönlendirebilir ama Trakt `code`/`redirect_uri` eşleşmesini kendisi doğrular), tersi tüm geliştirme ortamını sessizce kırardı.

### Doğrulama
**33 birim testi** (beyaz liste + `redirect_uri`, geçmesi ve düşmesi gerekenler ayrı ayrı) ✅ · **7 canlı HTTP senaryosu** yerel sunucuda ✅:

| Senaryo | Sonuç |
|---|---|
| Liste dışı uçlar (`/sync/watched/shows`, `/users/me/stats`, `/oauth/token`, yol geçişi, `PUT`) | 403 |
| Listedeki uçlar | 401 (Trakt'tan — guard'ı geçip Trakt'a ulaştılar) |
| `Origin: evil.example` | ACAO başlığı **yok** |
| `Origin: kaymaktv.com` | `ACAO: https://kaymaktv.com` |
| `Origin` yok (native taklidi) | 200 — **etkilenmiyor** |
| `redirect_uri: evil.example` | 400 `Invalid redirect_uri` |
| `redirect_uri: urn:...:oob` | Trakt'ın `invalid_grant`'i — guard'ı geçti |
| Auth limiti (20/dk) | 20. istekten sonra 429 + `Retry-After` |
| CORS preflight (OPTIONS) | 204 + izin başlıkları — guard'a takılmıyor |

`tsc --noEmit --noUnusedLocals --noUnusedParameters` ✅ · `node --check` ✅ (iki dosya).

> **Ölçüm aracı yine yanılttı (bu oturumda 5. kez).** İlk HTTP turunda *listedeki* uçlar da 403 döndü — beyaz liste bozuk sanılacaktı. Sebep kodda değildi: Git Bash'in MSYS yol dönüşümü `endpoint=/users/settings` argümanını `endpoint=/C:/Program Files/Git/users/settings`'e çeviriyordu. `MSYS_NO_PATHCONV=1` ile tekrarlanınca gerçek tablo çıktı. Aynı turda ikinci bir tuzak: izinli ve izinsiz `redirect_uri` **ikisi de HTTP 400** dönüyor — ayrım yalnızca gövdede (`Invalid redirect_uri` vs Trakt'ın `invalid_grant`'i). Sadece durum koduna bakılsaydı guard "her şeyi reddediyor" sanılırdı.

### ✅ CANLIDA DOĞRULANDI (aynı gün deploy edildi)

Kullanıcı push + Pi deploy'unu yaptı; `kaymaktv.com` üzerinde ölçüldü:

| Test | Sonuç |
|---|---|
| `Origin` yok (native taklidi) | 200 + `ratelimit-policy: 300;w=60`, ACAO **yok** — native etkilenmiyor |
| `Origin: https://kaymaktv.com` | `access-control-allow-origin: https://kaymaktv.com` |
| `Origin: https://evil.example` | ACAO **yok** — üçüncü parti site artık kullanamaz |
| `/sync/watched/shows`, `/users/me/stats`, `/shows/trending` | **403** |
| `/users/settings`, `/users/requests`, `/users/hidden/progress_watched` | 401 (Trakt'tan — beyaz listeyi geçtiler) |
| `POST /api/trakt` + `redirect_uri: evil.example` | 400 `Invalid redirect_uri` |

**`Access-Control-Allow-Origin: *` gitti.** Denetimin en acil bulgusu (Y12) kod tarafında kapandı.

### 🖥️ Deploy hedefi: `server.js` bir Raspberry Pi'de — ve siteyi de o sunuyor

Bu tur netleşen (ve deploy planında ilk yazdığımda EKSİK olan) iki şey:

**1. İki sunucu iki farklı sorunu çözüyor, ikisi de bilinçli.** Cloudflare Worker (`...workers.dev`) yalnızca `/feed/*` + `/account/delete` sunuyor — Supabase `service_role` ile yazma, kimlik Trakt token'ı doğrulanarak. Raspberry Pi'deki Express ise `kaymaktv.com`'u, üç `/api/*` proxy'sini **ve web sitesinin kendisini** sunuyor. Ayrılığın tarihsel gerekçesi Madde 91: Pi bir elektrik kesintisinde kapandı ve giriş günlerce çalışmadı. Sosyal akış/moderasyon bu yüzden Pi'ye değil Cloudflare'e kuruldu — Pi düşerse posterler ve OAuth etkilenir, akış ayakta kalır.

**2. `express-rate-limit` seçimi bu mimariye bağlı.** Pi normal bir Node.js süreci olduğu için sayaç tek bellekte tutulur ve gerçekten çalışır. Aynı kod bir Worker'da olsaydı izolatlara dağılır ve sayaç dolmazdı — koruma **var sanılır, olmazdı**. (Worker'ın kendi `isRateLimited`'ı tam bu yüzden zayıf; `MASTER_PLAN` D1.)

> ⚠️ **`server.js` restart'ı `kaymaktv.com`'un tamamını kısa süre düşürür** — sadece API'yi değil. Aynı süreç `dist/`'i statik sunuyor (`server.js`'te `express.static` + SPA fallback). Deploy zamanlaması buna göre yapılmalı.

### 🪤 Deploy planında yakalanan üç boşluk
1. **Push olmadan `git pull` eski kodu kurardı.** 17 commit yereldeydi; Pi "Already up to date" der, `server/security.js` hiç gitmez ve doğrulama komutu "deploy tutmadı" gibi görünür — sebebi anlaşılmadan. Sessiz başarısızlığın deploy hâli.
2. **`npm ci` Pi'de riskli.** `node_modules`'ü tamamen silip baştan kurar; Expo SDK 54 + RN bağımlılıklarıyla Pi'de çok uzun sürer ve o pencerede süreç yeniden başlatılamaz. Ayrıca `postinstall: patch-package` ve `patch-package` **devDependencies**'te — kabuk ortamında `NODE_ENV=production` varsa `npm ci` onu atlar ve kurulum kırılır. Doğrusu `npm install`. (`.env` içindeki `NODE_ENV` npm'i etkilemez, `dotenv` onu yalnızca süreç içinde okur — orada güvenli.)
3. **Web build'i yeniden almaya gerek yoktu.** `dist/` git'te takipli değil; değişiklik tamamen sunucu tarafında ve bundle zaten aynı origin'e (`https://kaymaktv.com/api/...`) gidiyor.

### Değişen dosyalar
**Yeni:** `server/security.js` (243 satır).
**Değişen:** `server.js` (361 → 383 satır; `cors()` → beyaz listeli middleware, üç limiter, iki guard) · `package.json` + `package-lock.json` (`express-rate-limit`) · `docs/{MASTER_PLAN,HISTORY}.md`.

> Güvenlik mantığı `server.js`'e gömülmedi: dosya zaten 361 satırdı ve AI_RULES §1'in 400 satır sınırını aşardı.

### Sıradaki
**F17** — kopya birleştirme (`formatRelativeTime`, `confirmAsync`) ve `utils/confirmDialog.ts`'in patch'ten beri yalan söyleyen başlığı. Alternatif: F15'in cihaz testi (hâlâ yapılmadı).

---

## 193. F17 — Kopya Birleştirme + Bayat Doküman (Y19): Kol E Kapandı

**Bağlam:** `MASTER_PLAN` Kol E'nin son fazı. `formatRelativeTime` ve `confirmAsync`'in ikişer kopyası ıraksamıştı; denetimde (Madde 190) `utils/confirmDialog.ts`'in yalan başlığı bir alt ajanı 60 çağrı noktası boyunca yanıltmıştı.

### 🔴 İlk izlenim yanlış kanonik dosyayı seçtirtiyordu

`grep`'in ilk turu `confirmAsync`/`notify` için 17 import satırı buldu, hepsi `'../utils/confirmDialog'` veya `'../../utils/confirmDialog'` gibi görünüyordu — yüzeysel bakışta "16'sı köke, 1'i feed'e" gibi bir izlenim veriyordu. Ama **literal string aynı olsa bile hangi dosyaya çözüldüğü çağıranın kendi dizinine bağlıydı.** Her satırı çağıranın konumuna göre tek tek çözünce gerçek tablo çıktı:

| | Importer sayısı |
|---|---|
| Kök `utils/confirmDialog.ts` | 10 |
| `features/feed/utils/confirmDialog.ts` | 7 |

Üstelik `notify` fonksiyonu **yalnızca kök dosyada** vardı — bu, sayım ne çıkarsa çıksın kanonik hedefi yapısal olarak belirliyordu (feed kopyasını kanonik seçseydim 5 `notify` importer'ı kırılırdı). Kararı doğru veren şey sayım değil, bu yapısal zorunluluktu; sayımın kendisi yanıltıcıydı.

### 🔴 "Kanonik" dosya, gerçekte buglu olandı

Kök `utils/confirmDialog.ts`'in başlığı kendini *"projenin her yerinde AYNI web-güvenli davranışı garanti eden TEK kaynak"* ilan ediyordu — ama Android'de `Alert.alert`'e `onDismiss` geçirmiyordu. Varsayılan olarak kapatılabilir bir diyalogda (dışarı dokunma / geri tuşu) bu, `onPress` hiç tetiklenmeden diyaloğun kapanması demek — döndürülen Promise **sonsuza dek askıda** kalıyordu. Fix, "kopya" damgası yenmiş `features/feed/utils/confirmDialog.ts`'te zaten vardı (`{ cancelable: true, onDismiss: () => resolve(false) }`). Kendini kanonik ilan eden dosya, aslında eksik olandı.

### `formatRelativeTime` — namespace bağımsızlığı

Kök `utils/formatRelativeTime.ts` i18n'liydi ama `t('justNow')` gibi önek'siz anahtarlar kullanıyordu — yani yalnızca `'common'` namespace'i aktif olan ekranlardan çağrılabiliyordu. Feed kartları (`FeedCard`, `FeedCommentItem`, `MarathonFeedCard`) `useTranslation('feed')` kullandığı için kök fonksiyonu çağıramıyor, kendi **Türkçe sabit kodlu** kopyasını yazmışlardı — İngilizce arayüzde akış Türkçe zaman gösteriyordu (`ReviewItem` de aynı feed kopyasını import ediyordu, üstelik `components/reviews/` altında).

Çözüm kopyalamak değil, kök fonksiyonu **namespace'ten bağımsız** hale getirmekti: tüm anahtarlar `common:justNow` gibi önekli çağrılıyor artık. `locales/index.ts`'te i18next tüm namespace'leri `resources` ile senkron/statik yüklüyor (lazy backend yok), yani `t('common:key')` hangi ekranın `t`'si verilirse verilsin çalışıyor — proje zaten `app/(protected)/list/[id].tsx`'te bu deseni kullanıyordu, icat edilmedi.

`MarathonFeedCard.tsx`'in hiç `useTranslation` çağrısı yoktu — eklendi.

### Doğrulama

- **tsc** `--noEmit --noUnusedLocals --noUnusedParameters` ✅ temiz (17 dosya değişti, iki dosya silindi).
- **`formatRelativeTime` mantık testi:** gerçek `tr`/`en` `common.json`'lardan okuyarak 7 zaman aralığı (saniye→yıl) iki dilde de test edildi — EN sözlükle hiçbir Türkçe kelime sızmadı (Y19'un tarif ettiği kusur birebir tekrarlanıp kapandığı doğrulandı). `undefined` guard'ı da test edildi.
- **Kalan referans taraması:** `features/feed/utils/{confirmDialog,formatRelativeTime}.ts` silindikten sonra hem eski dosya adı hem eski import path'i için tüm proje tarandı — sıfır kalıntı.
- **Doğrulanamayan:** Android'deki `onDismiss` davranışı ve web'de `confirmAsync`/`formatRelativeTime`'ın gerçek ekranda görünüşü cihaz/tarayıcı gerektiriyor, bu turda yapılmadı (bu proje Trakt CORS'a takıldığı için web önizlemesi de kimlikli akışları göstermiyor).

### Değişen dosyalar
**Silinen:** `features/feed/utils/confirmDialog.ts` · `features/feed/utils/formatRelativeTime.ts`.
**Değişen:** `utils/confirmDialog.ts` (başlık düzeltildi + `onDismiss` eklendi) · `utils/formatRelativeTime.ts` (`common:` önekleri) · import path'i değişen 10 dosya (`app/(protected)/blocked-users.tsx` · `components/reviews/ReviewItem.tsx` · `features/feed/{components/{BlockUserButton,CardMenu,ComposePostModal,FeedCard,FeedCommentItem,FeedCommentSheet,MarathonFeedCard,NoteEditorModal},hooks/useQuickBlock}.ts(x)`) · `docs/{MASTER_PLAN,HISTORY}.md`.

### Sıradaki
**Kol E tamamlandı** (F15 → F16 → F17, üçü de kapandı). Sıradaki büyük iş **F7 → F8** (Kol B, kimlik katmanı + Google giriş) — bilinçli olarak ertelenmiş, büyük ve riskli bir iş. F15'in cihaz testi de hâlâ yapılmadı; iki iş de sırada.

---

## 194. F15 Cihaz Testi Sonucu — Y22 Bulundu: Devre Kesici, Retry'ı Görünmez Kılıyor

**Bağlam:** `docs/F15_TEST_PROTOCOL.md`'nin T1-T5'i kullanıcı tarafından gerçek cihazda çalıştırıldı. Sonuç 4 satırlık bir onay değil — T1 **belirsiz** çıktı, T2'de **yeni bir kusur** bulundu.

### T1 · Belirsiz (BAŞARISIZ değil, DOĞRULANMADI)
Kullanıcı akışın en altına indi, *"hepsi bu kadar"* mesajını gördü. Bu, `!hasMore` (doğal akış sonu) dalı — `loadMoreFailed` (Y21'in düzelttiği hata dalı) hiç tetiklenmedi. Protokolün kendisi bu ihtimali önceden işaretlemişti (*"azsa hasMore hemen false olur, test tetiklenmez"*). **Y21 bu turda doğrulanmadı**, yalnızca ilgisiz bir yolun sorunsuz çalıştığı görüldü.

### T3, T4 · Geçti
Gizlilik anahtarı (Y18): uçak modunda kaydedilemedi uyarısı çıktı, internet gelince **uygulamadan çıkmaya gerek kalmadan** düzeldi. Üç yazma yüzeyi (Y16): onay akışında sorun yok.

### 🔴 T2 · BAŞARISIZ — ama Y17'nin kendisi değil, yeni bir kusur: Y22

`LoadFailedState` (Y17'nin düzelttiği ekran) doğru göründü: sahte veri yok, "İçerik yüklenemedi" dürüstçe yazıyor. Sorun **"Tekrar Dene"nin kendisinde**: kullanıcı interneti geri açtıktan SONRA "Tekrar Dene"ye bastı, aynı hata tekrar çıktı. Uygulamayı arka plana atıp geri girince düzeldi.

**Kod kanıtı (`services/api/traktClient.ts` + `utils/circuitBreaker.ts`):**

- Her Trakt endpoint'inin kendi devre kesicisi var: **5 art arda hata → 30 saniye boyunca istekler ağa hiç gönderilmeden anında reddedilir** (`FAILURE_THRESHOLD=5`, `OPEN_DURATION_MS=30000`).
- Yanıtsız ağ hatası (uçak modu → `error.response` yok) **devre kesiciye hata olarak işleniyor** (`traktClient.ts:384`).
- `useEpisodeDetail`/`useShowDetail`/`useMovieDetail`'in catch bloğu bu ayrımı YAPMIYOR — devre kesici reddi de, gerçek ağ hatası da **aynı** `setHasError(true)`'ya düşüyor, `LoadFailedState` **aynı** genel mesajı gösteriyor.

**Sonuç:** uçak modundayken birkaç kez "Tekrar Dene"ye basmak (her biri ayrı bir hata olarak sayılıyor) 5 hataya ulaşıp devreyi **AÇAR**. İnternet geri gelse bile devre 30 saniye boyunca isteği ağa hiç göndermeden reddediyor — ekranda görünen mesaj değişmiyor, kullanıcı "tekrar dene çalışmıyor" sanıyor. Devre kayıtları (`registry`) yalnızca bellekte tutuluyor; basit arka plan/öne getirme JS motorunu yeniden başlatmaz ama **30 saniyeden fazla uzakta kalmak** devrenin kendiliğinden `HALF_OPEN`'a geçmesine yeter — kullanıcının "arka plana atıp girince düzeldi" gözlemiyle tutarlı.

> ⚠️ **Bu bir hipotez, kanıtlanmış olgu değil** — buton basış zamanlaması cihazda ölçülmedi, yalnızca kod okunarak çıkarıldı. Ama mekanizma tam olarak gözlemi açıklıyor ve `console.warn('[CircuitBreaker...] Devre AÇILDI')` satırı (breaker.ts:80) bunu doğrulardı; test sırasında konsol izlenmedi.

**T3'ün T2'den farklı sonucu bunu destekliyor:** `useFeedPrivacy`'nin hata yolu devre kesiciden GEÇMİYOR (Worker'a gidiyor, Trakt'a değil) — ve o, internet gelince **anında** düzeldi, arka plana atmaya gerek kalmadı. İki test aynı "internet yok" senaryosunu koşuyor ama farklı davrandı; fark tam olarak devre kesicinin varlığı/yokluğuyla örtüşüyor.

### 📥 Y22 kaydedildi
`docs/MASTER_PLAN.md`'ye eklendi. Önerilen düzeltme (henüz yapılmadı): üç detay hook'unun catch bloğu `error.isCircuitBreakerRejection`'ı ayırt etsin, `LoadFailedState`'e farklı bir mesaj versin (*"Çok fazla deneme yapıldı, birkaç saniye bekleyip tekrar dene"*) — genel ağ hatasıyla karıştırılmasın. Küçük, düşük riskli bir değişiklik; üç dosyaya birkaç satır.

### Doğrulama
Kullanıcı gerçek cihazda test etti (T1 belirsiz, T2 başarısız + teşhis edildi, T3/T4 geçti, T5 atlandı — kullanıcı kararı, pratik değildi).

### Sıradaki
Y22'nin küçük düzeltmesi mi, yoksa doğrudan Kol B (F7 → F8) mi — kullanıcı kararı bekleniyor.

---

## 195. Y22 Düzeltildi — Devre Kesici Reddi Artık Ayrı Mesajla Gösteriliyor

**Bağlam:** Madde 194'te bulunan Y22. Kullanıcı kararı: küçük düzeltmeyi yap, doğrula, sonra sıradaki adıma geç.

### Neyin ayrımı yapılıyor
Üç detay hook'u (`useEpisodeDetail`/`useShowDetail`/`useMovieDetail`) `Promise.allSettled` kullanıyor; asıl özet isteği reddedilirse (`results[0].status === 'rejected'`) reddin sebebi `results[0].reason` içinde duruyor. `traktClient.ts`'in devre kesici reddi bu nesneye `isCircuitBreakerRejection: true` işaretini koyuyor (bkz. `services/api/traktClient.ts:210-213`) — gerçek ağ hatalarında bu alan yok. Üç hook'a da yeni bir `isCircuitBreakerError` state'i eklendi; `results[0].reason?.isCircuitBreakerRejection` true ise bu da true olur (yalnızca `hasError` zaten true olduğunda anlamlı, ayrı bir hata sınıfı değil).

`useEpisodeDetail`'de ayrıca dıştaki `catch` bloğu da kontrol edildi (`(e as any)?.isCircuitBreakerRejection`) — `useShowDetail`/`useMovieDetail`'de `loadData`'yı saran bir dış `catch` yok, dokunulmadı.

Ekranlarda (`app/{episode,show,movie}/[id].tsx`) `isCircuitBreakerError` true ise `LoadFailedState`'e özel bir `text` geçiliyor: *"Çok fazla deneme yapıldı — birkaç saniye bekleyip tekrar dene."* (yeni çeviri anahtarı `media:loadFailedCircuitBreakerText`, `tr`/`en` ikisinde de eklendi). false ise `text` `undefined` kalıyor, `LoadFailedState` kendi varsayılan genel mesajını basıyor — davranış aynen korundu.

### ⚠️ Bilinçli olarak dokunulmayan bir kusur
`useMovieDetail`'in dış `catch (error)` bloğu `hasError`'ı **hiç set etmiyor** — yalnızca `console.error` basıyor (`useShowDetail`/`useEpisodeDetail`'deki dallardan farklı). Bu Y22'nin kapsamı dışında, ayrı bir kusur adayı; kaydedildi ama bu turda dokunulmadı (kapsam dışına taşımamak için).

### Doğrulama
- `tsc --noEmit --noUnusedLocals --noUnusedParameters` ✅ temiz.
- `Promise.allSettled`'in gerçek davranışı simüle edilerek 4 senaryo test edildi: devre kesici reddi → `true`, gerçek ağ hatası → `false`, başarılı istek → `false`, sunucudan gelen 401 → `false`. Dördü de beklenen sonucu verdi.
- Referans sayımı: üç hook'ta `isCircuitBreakerError` sırasıyla 5/4/4 geçiyor (deklarasyon + reset + set + [`useEpisodeDetail`'de iki set noktası] + return) — atlanan yer yok.
- **Doğrulanamayan:** cihazda gerçek uçak modu senaryosu bu turda tekrar denenmedi; mantık test edildi, ekranda görünüş henüz doğrulanmadı.

### Değişen dosyalar
`hooks/{useEpisodeDetail,useShowDetail,useMovieDetail}.ts` · `app/{episode,show,movie}/[id].tsx` · `locales/{tr,en}/media.json` (`loadFailedCircuitBreakerText`).

### Sıradaki
Kullanıcı isterse cihazda tekrar T2'yi (ve T1'i, Y21 hâlâ doğrulanmadı) deneyip kapatabilir. Sonrasında Kol B (F7 → F8, kimlik katmanı + Google giriş).

---

## 196. F7 — Kimlik Katmanı: Trakt "anahtar" olmaktan çıkıp "bağlantı" oldu

**Bağlam:** Kol B'nin başlangıcı. `MASTER_PLAN` F7 · `REVIEWS_PLAN` §9. Kullanıcı planı dört maddeyle verdi ve *"hatalı, eksik ya da sorunlu yer varsa bana söyle"* dedi. **Plandaki bir madde uygulansaydı sistemi kilitlerdi**, ikisi de eksik varsayıma dayanıyordu.

### 🔴 `auth_provider` UNIQUE olsaydı sistemde toplam 2 kullanıcı olabilirdi

Görev tanımı *"`auth_provider` ve `google_sub` için UNIQUE kısıtlamalarını ekle"* diyordu. `auth_provider` bir etikettir (`'trakt'` | `'google'`); UNIQUE yapılsaydı **ikinci Trakt kullanıcısı kaydolamazdı** — üstelik hata, ilk iki kullanıcı oluşana kadar görünmezdi. `REVIEWS_PLAN` §9.2 doğru yazmıştı (*yalnızca* `google_sub` UNIQUE); hata görev tanımına aktarılırken oluşmuş. `026`'da yalnızca `google_sub` UNIQUE, `auth_provider` ise `CHECK` kısıtlı serbest etiket.

### 🔴 "13 uç" sayısı baştan beri yanlıştı — ölçüm aracının klasik tuzağı

Beş ayrı dokümanda (`MASTER_PLAN`, `REVIEWS_PLAN`, `HISTORY`'nin dört maddesi) *"13 uç noktanın tamamı"* yazıyordu. Kaynağı `grep -c "verifyAndUpsertUser(token, env)"` → **13**. Ama bunun **1'i fonksiyonun kendi tanımıydı** (`async function verifyAndUpsertUser(token, env) {`). Yedek dosyadan satır satır ayrıştırılınca gerçek dağılım çıktı:

| | Sayı |
|---|---|
| `verifyAndUpsertUser` **tanımı** | 1 |
| `verifyAndUpsertUser` **çağrısı** (→ `resolveCaller`) | **12** |
| `verifyCaller` çağrısı (→ `resolveCallerWithReason`) | **2** |
| **Toplam kimlik doğrulama noktası** | **14** |

Refactor sırasında `sed` 12 satır değiştirince "13 bekliyordum" uyuşmazlığı ortaya çıktı ve sayı düzeltildi. Uyuşmazlık kovalanmasaydı, eksik kalan bir uç arayarak zaman kaybedilecekti.

### 🔴 `getMySupabaseUserId()` "zaten vardı" ama Trakt'a bağımlıydı

`REVIEWS_PLAN` §9.2 madde 4 *"altyapı yarı hazır"* diyordu. Gerçekte fonksiyon şunu yapıyordu:

```
getMyTraktSlug() → Trakt'a HTTP isteği → slug → users tablosunda ara
```

Yani Trakt'ı olmayan bir kullanıcıda (F8'in tam hedef kitlesi) `null` döner ve **engelleme, yorum sahipliği ("sil" butonu), inceleme sahipliği, beğeni durumu** sessizce çalışmazdı. Ayrıca mevcut kullanıcı da Trakt kesintisinde kendi kimliğini kaybediyordu.

Yeni öncelik sırası: **bellek → disk → (yalnızca gerekirse) Trakt slug'ı**. `users.id` değişmeyen bir birincil anahtar olduğu için diske yazmak güvenli ve TTL gerektirmiyor — `myIdentity.ts`'in slug için kullandığı desenin aynısı. Üçüncü adım geriye uyumluluk: bu sürümden önce giriş yapmış kullanıcıların diskinde henüz id yok. `setMySupabaseUserId()` yazıldı; F8'in Google dalı `users.id`'yi doğrudan yazıp üçüncü adıma hiç düşmeyecek.

> `invalidateMySupabaseUserId()` artık disk kopyasını da siliyor. Silmeseydi, çıkış yapıp başka hesapla girildiğinde önceki kullanıcının kimliği **kalıcı olarak** okunurdu — K2'de bulunan önbellek sınıfının aynısı, ama bellekteki değil diskteki hâli.

### 🔴 `google_sub` anon key'e açık olacaktı — K1'in birebir tekrarı

`001_feed_schema.sql`: `CREATE POLICY "users_select_all" ON users FOR SELECT USING (true)`. `users`'ın **tüm kolonları** anon key ile okunabiliyor; `google_sub` eklenince herkes herkesin Google kalıcı kimliğini çekebilirdi.

Çözüm `026`'nın **aynı** dosyasında: `REVOKE SELECT ON users FROM anon, authenticated` + yalnızca güvenli kolonlara `GRANT SELECT (...)`. Kolon seviyesinde GRANT'a PostgREST uyuyor (Y15'in tespiti).

> **Neden aynı migration'da, sonraya bırakılmadan:** K1 açığı (Madde 190) tam olarak *"istemci deploy'undan sonra kapatırım"* diye ertelendiği için gerçek ve sömürülebilir bir sansür aracına dönüşmüştü. Hassas kolon ile onu koruyan GRANT ayrılmamalı.

> 🔬 **GRANT kolon listesi canlıdan doğrulandı.** Elle sayılan liste eksik olsaydı istemci o kolonu okuyamaz ve sebebi "RLS" sanılırdı. Anon key ile `GET /rest/v1/users?select=*&limit=1` çekildi: dönen 10 kolon, migration'daki listeyle **birebir** eşleşti (+`auth_provider`, −`google_sub`).

### `resolveCaller(request)` DEĞİL `resolveCaller(body, env)`

Görev tanımı `resolveCaller(request)` diyordu. Uygulanmadı, gerekçesi: uçlar gövdeyi zaten okuyor (`const body = await request.json()`) ve **bir `Request` gövdesi iki kez okunamaz**. `request` geçirmek 14 uçta `request.clone()` gerektirir; unutulan tek bir yer çalışma zamanında patlardı. `body` nesnesi aynı sonucu sıfır riskle veriyor.

Dönüş tipi eski `verifyAndUpsertUser` ile **birebir aynı** tutuldu (`user` | `null`) — bu sayede 12 ucun gövdesindeki `if (!verified)` ve `verified.userId` satırlarının **hiçbiri** değişmedi. Değişen tek şey çağrı satırı. `verifyCaller` → `verifyTraktCaller` olarak yeniden adlandırıldı: F8'de yanına Google dalı geleceği için "caller'ı doğrulayan tek şey" izlenimi yanlış olurdu.

`no_credentials` hata dalı ve 401 yanıtı eklendi — bugün uçların kendi `if (!token)` kontrolleri bunu yakalıyor, ama F8'de "iki token da yok" durumu buraya düşecek ve `default` (502 "Sunucu hatası") yanlış teşhis olurdu.

### Doğrulama
- **Worker `vitest`: 34/34 ✅** — refactorün asıl kanıtı.
- `node --check` ✅ · `tsc --noEmit --noUnusedLocals --noUnusedParameters` ✅.
- 14 çağrı noktasının tamamında `body` değişkeninin kapsamda olduğu tarandı ✅.
- GRANT kolon listesi canlı Supabase'ten doğrulandı ✅.
- **Doğrulanamayan:** `026` çalıştırılmadı, Worker deploy edilmedi. F7 canlıda DEĞİL.

> 💾 **Worker git'te olmadığı için refactor öncesi `src/index.js.bak-F7-<zaman>` yedeği alındı** (F18'e kadar tek geri dönüş noktası).

### Değişen dosyalar
**Yeni:** `supabase/schema/026_identity_layer.sql`.
**Değişen:** Worker `src/index.js` (`verifyCaller`→`verifyTraktCaller`, `verifyAndUpsertUser`→`resolveCaller`+`resolveCallerWithReason`, 14 çağrı noktası, `no_credentials` dalı) · `features/feed/services/userBlocks.ts` (kimlik disk öncelikli, `setMySupabaseUserId`) · `docs/{MASTER_PLAN,REVIEWS_PLAN,HISTORY}.md`.

### 📥 Kaydedilen, bu fazda yapılmayan
- **Kimlik mantığı hâlâ `userBlocks.ts`'te.** Dosyanın konusu "kullanıcı engelleme"; kimlik oraya ait değil, `services/api/myIdentity.ts`'e taşınmalı. Taşıma 5 dosyada import değişikliği demek — F7'nin kapsamı dışında tutuldu (dosya 210 satır, 400 sınırının altında).
- **Google kullanıcısının akışı boş olacak** (`getVisibleUserIds` Trakt following'e dayalı) — F8 kararına bırakıldı.

### Sıradaki
Kullanıcının elle adımları: **`026` çalıştır** → **Worker deploy**. İkisi de tamamlanıp bir giriş + yazma işlemi denendikten sonra **F8** (Google giriş + hesap birleştirme köprüsü) için onay istenecek.

---

## 197. F7 Canlıda Doğrulandı — Elle Adımlar Tamamlandı

**Bağlam:** Madde 196'nın devamı. Kullanıcı `026`'yı çalıştırdı ve Worker'ı deploy etti.

### Doğrulama
- **`026`:** Canlı Supabase'e anon key ile sorgu atıldı. `select=google_sub` → `42501 permission denied` (GRANT çalışıyor). `select=id,username,auth_provider` → `200`, `auth_provider: "trakt"` döndü (kolon var, migration çalışmış).
- **Worker deploy:** İlk HTTP testi (`/feed/report` boş gövdeyle → `"traktAccessToken zorunlu"`) **yanıltıcı** olurdu — bu mesaj ucun `resolveCallerWithReason`'a hiç ulaşmadan kendi eski `if (!token)` kontrolünden geliyor; refactor tasarım gereği istemciden görünen davranışı hiç değiştirmediği için HTTP üzerinden eski/yeni kod ayırt edilemiyor. Bunun yerine `npx wrangler deployments list` çalıştırıldı: en son iki deploy 2026-08-20 01:34/01:36 UTC'de, `src/index.js`'in son değişim zamanından (mtime) SONRA. Worker git'te olmadığı ve diskte tek kopya olduğu için bu, canlı kodun F7'nin refactor'ünü içerdiğini mantıken kanıtlıyor. Kullanıcı deploy'u kendisinin çalıştırdığını doğruladı.

> **Ölçüm metodolojisi notu:** İlk kurulan HTTP testi yanlış pozitif *üretebilirdi* — rapor edilmeden önce yakalandı ve düzeltildi (`wrangler deployments list` + mtime karşılaştırmasına geçildi). Bu projede tekrar eden bir ders: bir doğrulamanın "aynı sonucu eski kod da verir mi" sorusu sorulmadan kanıt sayılmaması gerekiyor.

### Sonuç
**F7 tamamen kapandı** — kod, migration ve deploy üçü de canlıda doğrulandı. `MASTER_PLAN` güncellendi.

### Sıradaki
F8 (Google giriş + hesap birleştirme köprüsü) için onay bekleniyor. Kullanıcı test niyetini paylaştı: Trakt ve Google e-postalarının aynı olmasına dayanarak birleşmeyi denemek istiyor — bu, F8'in kırmızı çizgisiyle (yalnızca e-postaya bakıp otomatik birleştirme YASAK) çelişeceği için netleştirildi: köprü e-posta eşleşmesine değil, kullanıcının Trakt OAuth'unu tekrar açıp token'la kanıtlamasına dayanacak.

---

## 198. F8 Faz 1 — Google ID Token Doğrulaması (Worker'da) Yazıldı ve Test Edildi

**Bağlam:** Kol B'nin en kritik fazı. Kullanıcı planı verdi ve *"bildiğini yapmak yerine test et, doğrula"* dedi. Kod yazmadan önce üç araştırma yapıldı, ikisi plan üzerinde doğrudan etkili çıktı.

### 🔴 `.env`'de Client ID yerine Client SECRET yazılmış

`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID="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"`. `GOCSPX-` öneki Google'ın **Client Secret** biçimi — gerçek Client ID'ler `....apps.googleusercontent.com` ile biter. Muhtemelen Google Cloud Console'da yan yana duran iki alan karışmış.

**Ölçülen risk:** `.env` git'e hiç girmemiş (`git log --all --full-history -- .env` boş) ve `dist/`'e henüz gömülmemiş (istemci kodu bu değeri henüz hiç okumuyordu, F8 başlamamıştı) — bugünkü sızıntı sıfır. Ama `EXPO_PUBLIC_` önekli olduğu için, bu değer düzeltilmeden client koduna bağlanırsa **bir sonraki build'de** gerçek Client Secret dünyaya açık bir bundle'a gömülürdü. Bu yüzden client tarafı yazılmadı; `wrangler.jsonc`'ye de yanlış değer konmadı, yorum satırı olarak doğru alma yeri belgelendi.

### 🔴 OAuth mantığının iki yerde olması geçmişte gerçek bir hataya yol açmış

`TraktAccountSection.tsx`'in başlığı: eskiden `settings.tsx` ve `account.tsx` ikisi de kendi `useAuthRequest`'ini çalıştırıyordu; Trakt'a kayıtlı redirect URI **tek** (`/settings`) olduğu için akışı başlatan ekranla kodu yakalayan ekran farklılaşıyor, aynı tek-kullanımlık kod iki kez değişilmeye çalışılıp `invalid_grant` üretiyordu.

**Sonucu:** birleştirme köprüsünün "Trakt'ı tekrar doğrula" adımı **ayrı bir ekranda değil, `settings.tsx`'in içinde**, mevcut `request`/`response`/`promptAsync` altyapısını yeniden kullanarak kurulmalı. Bu, onboarding tasarımını doğrudan şekillendiriyor (aşağıda).

### Kütüphane seçimi: `jose` — elle RS256 yazılmadı

Cloudflare dokümanı ve `jose`'nin kendi belgeleri canlıdan çekilerek doğrulandı: Web Crypto API Workers'ta `nodejs_compat` gerekmeden RS256 destekliyor; `jose` Workers'ı resmi olarak destekliyor, `createRemoteJWKSet` + `jwtVerify` JWKS getirme/önbellekleme/rotasyonu kendisi yönetiyor. Elle imza doğrulama (base64url, `kid` seçimi, algoritma karıştırma saldırılarına karşı savunma) güvenlik açısından riskli olurdu — bu proje için doğru çağrı kütüphaneyi seçmekti, "gereksiz bağımlılık eklememe" ilkesine aykırı değil.

`npm install jose` → sıfır bağımlılık ekledi (kendisi zaten sıfır-bağımlılık kütüphanesi).

### Yazılan: `verifyGoogleIdToken` — saf, ağ gerektirmeyen doğrulama katmanı

`verifyGoogleCaller`'ı tek fonksiyon yerine ikiye böldüm:
- **`verifyGoogleIdToken(idToken, env, jwks)`** — yalnızca kriptografik doğrulama (imza + `aud` + `iss` + `exp`). Supabase'e HİÇ dokunmuz. `jwks` parametresi test edilebilirlik için enjekte edilir (üretimde `GOOGLE_JWKS`).
- **`verifyGoogleCaller(idToken, env)`** — üstekini çağırır, sonra `google_sub` ile `users`'ta arar (yeni bir `supabaseSelect` yardımcısı yazıldı — bu Worker'da daha önce genel amaçlı SELECT yoktu).

Ayrım iki gerekçeyle: (1) bu havuzda Supabase/Trakt'a giden çağrılar bilinçli olarak mock'lanmıyor (`test/index.spec.js` başlığındaki kural), saf kısım gerçek testlerle doğrulanabiliyor; (2) onboarding uç noktası (henüz yazılmadı) da aynı doğrulamaya ihtiyaç duyacak, kopyalanmayacak.

**`aud` üç client ID'yi birden kabul ediyor** (web/iOS/Android) — Google her platform için ayrı client ID kullanıyor, sabit tek `aud` beklemek diğer ikisini baştan kilitlerdi. `jose`'nin `audience` alanının `string | string[]` kabul ettiği tip tanımlarından doğrulandı.

`resolveCallerWithReason`'a bağlandı — Trakt dalıyla **kasıtlı fark**: Trakt dalı doğrulama başarılıysa satırı upsert ediyor (slug tek anlamlı kimlik), Google dalı ise `google_sub` bulunamazsa satır OLUŞTURMUYOR (`errorKind: "google_unlinked"` döner) — bu karar 12 yazma ucunun ortak kapısında otomatik verilirse "iki içerik kümesini birleştirme" felaketini riske atardı.

### Doğrulama
- **`test/auth.spec.js` — 9 yeni test, `test/index.spec.js`'in 34'üyle birlikte 43/43 geçti.** Gerçek bir RSA anahtar çifti üretilip `createLocalJWKSet` ile enjekte edildi (Google'ın gerçek anahtarına ihtiyaç yok, ağ gerektirmez):
  - Geçerli token → kabul
  - Üç client ID'den herhangi biri (Android örneği) → kabul
  - Yanlış `aud`, yanlış `iss`, süresi dolmuş, `sub` eksik, hiçbir client ID env'de yok, çöp string → hepsi reddedildi
  - **🔴 Kritik test: farklı bir anahtarla imzalanmış (sahte) token reddedildi** — Google'ın gerçek özel anahtarına sahip olmayan birinin üretebileceği en iyi ihtimal bu, ve reddedildi
- `node --check` ✅ · `npx wrangler deploy --dry-run` ✅ (config geçerli, `jose` bundle'a gerçekten girdi — yükleme boyutu 119.57 KiB'a çıktı)
- **Doğrulanamayan:** gerçek bir Google ID token'ıyla uçtan uca test edilmedi (Client ID düzeltilmeden yapılamaz).

### 📥 Bilinçli olarak YAZILMAYAN: onboarding/birleştirme uç noktası

REVIEWS_PLAN §9.3'ün karar ağacını uygulayacak yeni uç nokta (yeni kullanıcı mı, mevcut Trakt hesabına mı bağlanıyor) henüz yazılmadı. Bu, projenin kendi dokümanlarının "EN KRİTİK" / "geri dönüşü en pahalı faz" dediği parça — kullanıcıya somut bir API tasarımı sunulup onay istenecek, MASTER_PLAN'da onayı beklenen bir sonraki adım olarak işaretlendi.

### Değişen dosyalar
Worker: `src/index.js` (`jose` import, `supabaseSelect`, `verifyGoogleIdToken`, `verifyGoogleCaller`, `resolveCallerWithReason`'ın Google dalı, `google_unlinked` hata dalı) · `package.json`+`package-lock.json` (`jose@6.2.9`) · `wrangler.jsonc` (Google client ID'leri için yorumlu yer tutucu + GOCSPX uyarısı) · **Yeni:** `test/auth.spec.js`.

### Sıradaki
Onboarding/birleştirme uç noktasının API tasarımı kullanıcıya sunulacak, onay bekleyecek. Ayrıca kullanıcının elle adımı: Google Cloud Console'dan **gerçek** Web Client ID'yi alıp hem `.env`'e hem `wrangler.jsonc`'ye yazmak.
