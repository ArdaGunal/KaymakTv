/**
 * DIZI-SAYFA-01 (M513) · Mobil dizi sayfasında bölümlerin sırası.
 *
 * Kullanıcı (2026-10-13): *«apk da dizilerin sayfasında yorumlar kısmı üstte, bölüm yani
 * sezonlar altta, bölümleri yorumun üstüne taşımak daha mantıklı gibi (apk için. web de zaten
 * şu anki daha mantıklı. bu sadece apk da olcak)»*.
 *
 * Yalnız UYGULAMA (native) için sezonlar yorumların üstüne çıkar. Web — dar (telefon
 * tarayıcısı) ya da masaüstü — eski sırada kalır: masaüstünde sezonlar zaten sağ rayda,
 * dar web'de kullanıcı «web de zaten şu anki daha mantıklı» dedi.
 */
export type DiziSayfaBolumu = 'oyuncular' | 'yorumlar' | 'sezonlar' | 'benzerler';

export function diziSayfaSirasi(platformOS: string): DiziSayfaBolumu[] {
  return platformOS === 'web'
    ? ['oyuncular', 'yorumlar', 'sezonlar', 'benzerler']
    : ['oyuncular', 'sezonlar', 'yorumlar', 'benzerler'];
}
