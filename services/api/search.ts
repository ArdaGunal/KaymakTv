import { getTraktClient } from './traktClient';

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
    const client = await getTraktClient();
    const response = await client.get(`/search/${type}?query=${encodeURIComponent(query)}&extended=full`);
    return response.data;
  } catch (error) {
    console.error('Trakt API HatasÄ± (searchTrakt):', error);
    throw error;
  }
};
