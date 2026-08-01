import { getUserProfile } from './social';

/**
 * Giriş yapmış kullanıcının KENDİ Trakt slug'ı — tek gerçek kaynak.
 *
 * NEDEN AYRI BİR MODÜL: bu değer birden fazla yerde gerekiyor (Akış'ta kendi
 * aktivitelerini listeye dahil etmek, gizlilik ayarlarını okumak) ama her
 * çağıranın kendi başına `getUserProfile('me')` çağırması, oturum başına
 * DEĞİŞMEYEN bir veri için tekrar tekrar ağ isteği demekti. Slug oturum
 * boyunca sabittir (yalnızca kullanıcı trakt.tv'de kullanıcı adını
 * değiştirirse değişir — o durumda uygulama zaten yeniden açılır).
 *
 * Önbellek stratejisi:
 *   - Başarılı sonuç modül seviyesinde tutulur → uygulama ömrü boyunca TEK istek.
 *   - Uçuştaki istek paylaşılır (`inFlight`) → aynı anda 3 yerden çağrılsa bile
 *     Trakt'a yalnızca 1 istek gider.
 *   - BAŞARISIZLIK ÖNBELLEĞE ALINMAZ — geçici bir ağ hatası, slug'ı oturumun
 *     geri kalanında kalıcı olarak `null` yapmamalı; bir sonraki çağrı yeniden dener.
 */
let cachedSlug: string | null = null;
let inFlight: Promise<string | null> | null = null;

export async function getMyTraktSlug(): Promise<string | null> {
  if (cachedSlug) return cachedSlug;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const profile = await getUserProfile('me');
      const slug = profile?.ids?.slug ?? null;
      if (slug) cachedSlug = slug;
      return slug;
    } catch (error) {
      console.warn('[myIdentity] Kendi Trakt profilim okunamadı:', error);
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/**
 * Çıkışta ZORUNLU (bkz. context/AuthContext.tsx removeKeys). Modül seviyesindeki
 * önbellek JS süreci canlı kaldığı sürece yaşar; uygulama tamamen kapatılmadan
 * çıkış yapıp BAŞKA bir Trakt hesabıyla girilirse, temizlenmediği takdirde
 * önceki kullanıcının slug'ı yeni oturuma sızar ve Akış'ta yanlış kişinin
 * aktiviteleri "benim" diye görünürdü — `followStore.reset()` ile aynı gerekçe.
 */
export function clearMyTraktSlug(): void {
  cachedSlug = null;
  inFlight = null;
}
