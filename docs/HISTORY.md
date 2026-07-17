# Proje Geçmişi ve Alınan Kararlar

*Not: Eski geçmiş kayıtları git sıfırlaması sırasında temizlenmiştir. Buradan itibaren yeni mimari güncellemeleri tutulacaktır.*

## 20. "God Context"in Parçalanması ve Zustand'a Geçiş
**Sorun:** `context/LibraryContext.tsx` dosyası zamanla 1100 satıra ulaşarak bir "God Context" (her işi yapan devasa yapı) haline gelmişti. 
**Çözüm:** Veriler Zustand (`store/slices`) içerisine, API istekleri ise `services/libraryService.ts` dosyasına taşındı. `LibraryContext` ise geriye uyumluluk sağlayan bir Proxy Hook'a çevrildi.

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
