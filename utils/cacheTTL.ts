/**
 * Uygulama genelindeki TÜM önbellek (cache) süreleri TEK bir yerden yönetilir.
 * Öncesinde bu süreler (10 dakika, 6 saat, 48 saat gibi) farklı dosyalara
 * (cacheManager.ts, fetchers.ts) gömülü "sihirli sayılar" olarak dağınık
 * duruyordu — birini ayarlamak isteyen geliştirici hangi sayının neyi
 * etkilediğini dosyalar arasında arayarak bulmak zorunda kalıyordu.
 *
 * Katman mantığı:
 * - SYNC_INTERVAL: kütüphane senkronizasyonunun (fetchFreshData) minimum
 *   tekrar deneme aralığı. Kısa tutulur çünkü kullanıcı eylemine (izledim
 *   işaretleme) yakın zamanda tazelik önemlidir. (Değer korunmuştur — fetchers.ts'teki
 *   eski `tenMinutes` sabitiyle birebir aynı, davranış DEĞİŞMEDİ, yalnızca taşındı.)
 * - STANDARD: dizi/bölüm/film detay sayfası önbelleği (özet, kadro, ilişkili
 *   yapımlar) — orta sıklıkta değişir. (utils/cacheManager.ts'in eski
 *   `CACHE_LIFETIME_MS` sabitiyle birebir aynı, davranış DEĞİŞMEDİ.)
 * - LONG: nadiren değişen görsel varlıklar (poster/afiş URL'leri) — TMDB'de
 *   var olan bir yapımın afiş yolu neredeyse hiç değişmez; kısa TTL yalnızca
 *   gereksiz TMDB API çağrısı israfına yol açar. (YENİ — services/tmdbApi.ts'teki
 *   poster önbelleği eskiden STANDARD/6 saat kullanıyordu, artık 7 güne çıkarıldı.)
 * - CALENDAR_SEASONS: "Yaklaşanlar" sekmesindeki 33 günlük takvim penceresinin
 *   ÖTESİNDEKİ bölüm tarihlerini önbellekleyen harita — bu veri haftalarca sabit
 *   kaldığından en uzun TTL'e sahiptir. (fetchers.ts'teki eski `TTL_48_HOURS`
 *   sabitiyle birebir aynı, davranış DEĞİŞMEDİ.)
 * - SHORT: dakikalar içinde tazeliği önemli olan, sık tekrar istenen veri
 *   (trend dizi/film listeleri, "yorumum var mı" kontrolü için kullanıcının
 *   son yorumları). Önceden bu ikisi HİÇ önbelleklenmiyordu — Keşfet'e her
 *   giriş-çıkışta ve her açılan dizi/film/bölüm sayfasında baştan çekiliyordu
 *   (bkz. performans raporu: `shows/trending`, `movies/trending`,
 *   `users/me/comments/all/newest` en yüksek çağrı sayılarındaydı).
 */
export const CACHE_TTL = {
  SYNC_INTERVAL: 10 * 60 * 1000,
  SHORT: 60 * 1000,
  STANDARD: 6 * 60 * 60 * 1000,
  LONG: 7 * 24 * 60 * 60 * 1000,
  CALENDAR_SEASONS: 48 * 60 * 60 * 1000,
} as const;
