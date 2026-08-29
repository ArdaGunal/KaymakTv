import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from '../../utils/secureStorage';
import { getUserProfile } from './social';
import { isKaymakSessionToken } from './traktClient';

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
 *   - **DİSK KOPYASI (F6):** başarılı slug AsyncStorage'a yazılır ve Trakt
 *     erişilemediğinde oradan okunur — aşağıdaki gerekçe.
 *
 * 🔴 NEDEN DİSK KOPYASI ŞART (F6 ön koşulu, bkz. docs/design/FOLLOW_SNAPSHOT_PLAN.md):
 * `getVisibleUserIds` akışta gösterilecek kullanıcı kümesini kurarken kendi
 * slug'ımı da ekliyor — "kullanıcı kendi aktivitelerini de görür" kuralı.
 * Bu fonksiyon Trakt'a gidiyor ve hatada `null` dönüyordu, dolayısıyla
 * **Trakt kesintisinde kullanıcı akışta KENDİNİ kaybediyordu.** Takip
 * ettiklerinin kartları `followStore`'un yerel kopyasından gelmeye devam
 * ederken kendi kartları kayboluyordu — ters ve fark edilmesi zor bir durum.
 *
 * Slug oturumlar arası da sabit olduğu için (yalnızca kullanıcı trakt.tv'de
 * kullanıcı adını değiştirirse değişir) diske yazmak güvenli.
 */
const SLUG_STORAGE_KEY = 'myIdentity.traktSlug';

let cachedSlug: string | null = null;
let inFlight: Promise<string | null> | null = null;

export async function getMyTraktSlug(): Promise<string | null> {
  if (cachedSlug) return cachedSlug;
  if (inFlight) return inFlight;

  // 🔴 Google-only oturum (`create_new`, Madde 221): Trakt hesabı HİÇ yok,
  // dolayısıyla bir slug da yok. İstek göndermek yalnızca 401 üretir (canlı
  // testte, 2026-08-22, akışın her yüklemesinde tekrarlanıyordu). `null`
  // dönmek zaten DOĞRU cevap — ama artık ağa çıkmadan veriliyor.
  //
  // ⚠️ Bu, çağıranların "ben kimim"i slug'tan çözemeyeceği anlamına gelir;
  // Google-only kimliğin doğru kaynağı `getMySupabaseUserId()`'dir (bkz.
  // features/feed/services/userBlocks.ts — disk-öncelikli, sağlayıcıdan
  // bağımsız).
  const token = await SecureStore.getItemAsync('traktAccessToken');
  if (isKaymakSessionToken(token)) return null;

  // 🔴 MİSAFİR: hiç token yok, dolayısıyla bir Trakt kimliği de YOK. İstek
  // `Authorization` başlığı olmadan gider ve `/users/me` KESİNLİKLE 401
  // döner — yani ağa çıkmanın hiçbir faydası yok, tek etkisi boşa giden bir
  // round-trip (dizi/film detay sayfası başına 2-3 tane; canlı ölçüldü).
  // `null` zaten DOĞRU cevap, artık ağa çıkmadan veriliyor — Google-only
  // dalıyla (yukarıda) BİREBİR aynı gerekçe.
  //
  // Bu tek başına yeterli DEĞİL, ikinci bir kalkan olarak duruyor: 401'i
  // "oturum sona erdi" sanan asıl kusur `traktClient.ts`'in 401 dalında
  // kapatıldı (bkz. oradaki "KİMLİKSİZ İSTEK" notu).
  if (!token) return null;

  inFlight = (async () => {
    try {
      const profile = await getUserProfile('me');
      const slug = profile?.ids?.slug ?? null;
      if (slug) {
        cachedSlug = slug;
        // Ateşle-ve-unut: yazma gecikmesi çağıranı bekletmemeli. Başarısız
        // olursa yalnızca gelecekteki bir kesintide fallback kaybedilir —
        // o yüzden sessizce yutulmuyor, uyarı düşüyor.
        AsyncStorage.setItem(SLUG_STORAGE_KEY, slug).catch((error) =>
          console.warn('[myIdentity] Slug diske yazılamadı:', error)
        );
      }
      return slug;
    } catch (error) {
      console.warn('[myIdentity] Kendi Trakt profilim okunamadı:', error);
      // Trakt erişilemiyor → son bilinen slug'a düş. `cachedSlug`'a da
      // yazıyoruz ki oturumun geri kalanında her çağrı diski yeniden
      // okumasın; slug zaten değişmeyen bir değer.
      try {
        const stored = await AsyncStorage.getItem(SLUG_STORAGE_KEY);
        if (stored) {
          cachedSlug = stored;
          console.warn('[myIdentity] Slug diskten okundu (Trakt erişilemedi).');
          return stored;
        }
      } catch (storageError) {
        console.warn('[myIdentity] Slug diskten okunamadı:', storageError);
      }
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
  // Disk kopyası da gitmeli — aksi halde çıkış yapıp BAŞKA bir hesapla
  // girildiğinde, yeni hesabın ilk Trakt isteği başarısız olursa fallback
  // ÖNCEKİ kullanıcının slug'ını döndürürdü. Ateşle-ve-unut: bu fonksiyon
  // senkron sözleşmesini koruyor (çağıranı `AuthContext.removeKeys`).
  AsyncStorage.removeItem(SLUG_STORAGE_KEY).catch((error) =>
    console.warn('[myIdentity] Slug diskten silinemedi:', error)
  );
}
