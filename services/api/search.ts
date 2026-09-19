import axios from 'axios';

// 🔴 M414 — ARAMA KÖPRÜDEN GEÇER, TRAKT'A DOĞRUDAN GİTMEZ.
// `getTraktClient()` doğrudan `https://api.trakt.tv`'ye gidiyor; tarayıcıdan
// çağrıldığında Trakt CORS preflight'ını reddediyor ve arama HER SORGUDA
// «Arama sırasında bir hata oluştu» ile bitiyordu (canlıda ölçüldü, misafir
// oturumu: `/search/show` ve `/search/movie` → `ERR_NETWORK`, konsolda
// «No 'Access-Control-Allow-Origin'»). Uç PUBLIC — kimlik gerektirmiyor, yani
// `shows.ts`/`movies.ts`'in trend uçlarıyla AYNI sınıf: çözüm de aynı,
// `/api/trakt-proxy` (beyaz liste: server/security.js).
// ⚠️ Hem web hem native AYNI yolu kullanır (watchlist.ts'in deseni): tek yol =
// tek davranış, platformlar ıraksamaz.
const TRAKT_PROXY_URL = process.env.EXPO_PUBLIC_API_URL
  ? `${process.env.EXPO_PUBLIC_API_URL}/api/trakt-proxy`
  : '/api/trakt-proxy';

// ARAMA SONUÇLARI BİLİNÇLİ OLARAK ÇEVRİLMEZ (karar: bkz. docs/HISTORY.md Madde 105)
//
// Bu dosyada eskiden `applyTranslation` + `i18n` import ediliyor ama HİÇ
// kullanılmıyordu — birinin arama sonuçlarını da çevirmeyi denediğini
// düşündüren bir kalıntıydı. Doğrulandı: Trakt'ın `/search/:type` uç noktası
// `translations` parametresini DESTEKLEMİYOR (yalnızca `fields` +
// `extended=full` kabul ediyor), yani yanıtta `translations` dizisi hiç gelmez
// ve `applyTranslation` sessiz bir no-op olurdu. Kopmuş bir bağlantı değil,
// bir API kısıtı.
//
// TMDB üzerinden yerelleştirme (TMDB'de `language=tr-TR` ile arayıp sonuçları
// Trakt ID'lerine eşlemek) DEĞERLENDİRİLDİ ve REDDEDİLDİ: her arama için ek bir
// servis + N adet ID eşleme isteği demek olurdu — mimariyi hantallaştırır, rate
// limit'i zorlar ve aramanın hızını düşürürdü. Kazanca değmeyen bir aşırı
// mühendislik. Kullanıcı içeriğin DETAYINA girdiğinde başlık/özet zaten Türkçe
// geliyor (bkz. shows.ts/movies.ts → `applyTranslation`); arama sonuçlarının
// İngilizce kalması kabul edilen bir davranıştır. Bu notu silmeden önce
// yukarıdaki gerekçeyi yeniden değerlendirin.
export const searchTrakt = async (query: string, type: 'show' | 'movie') => {
  try {
    const response = await axios.get(TRAKT_PROXY_URL, {
      params: { endpoint: `/search/${type}`, query, extended: 'full' },
    });
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÄ± (searchTrakt):', error);
    throw error;
  }
};
