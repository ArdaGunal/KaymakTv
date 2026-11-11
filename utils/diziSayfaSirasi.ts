/**
 * DIZI-SAYFA-01 (M513) · Mobil dizi sayfasında bölümlerin sırası.
 *
 * Kullanıcı (2026-10-13): *«apk da dizilerin sayfasında yorumlar kısmı üstte, bölüm yani
 * sezonlar altta, bölümleri yorumun üstüne taşımak daha mantıklı gibi (apk için. web de zaten
 * şu anki daha mantıklı. bu sadece apk da olcak)»*.
 *
 * M587: kullanıcının son sırası native'de oyuncular → sezonlar → incelemeler →
 * fragman → benzerler. Web — dar (telefon tarayıcısı) ya da masaüstü — eski sırada kalır.
 */
export type DiziSayfaBolumu = 'oyuncular' | 'yorumlar' | 'sezonlar' | 'fragman' | 'benzerler';

export function diziSayfaSirasi(platformOS: string): DiziSayfaBolumu[] {
  return platformOS === 'web'
    ? ['oyuncular', 'yorumlar', 'sezonlar', 'benzerler']
    : ['oyuncular', 'sezonlar', 'yorumlar', 'fragman', 'benzerler'];
}
