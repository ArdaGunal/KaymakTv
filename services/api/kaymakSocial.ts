import axios from 'axios';
// 🔴 `expo-secure-store` DEĞİL — web'de yerel anahtarlık yok, ham SecureStore
// orada FIRLATIR. `utils/secureStorage` web'de `localStorage`'a düşüyor.
// ⚠️ Bu tam olarak canlıda ısırdı (2026-09-10): web'de arama "Bir şeyler ters
// gitti" veriyordu çünkü token okuması `try` bloğunun dışında fırlıyordu.
import * as SecureStore from '../../utils/secureStorage';

/**
 * SOSYAL API'si — Worker'ın `/social/*` uçlarının istemci tarafı.
 * Faz T · T3. Hedef tablolar `supabase/schema/040_social_graph.sql`.
 *
 * ==========================================================================
 * 🪪 "EVRENSEL KAYMAK KİMLİĞİ" — bu dosyanın taşıyıcı ilkesi
 * ==========================================================================
 * Kullanıcı kararı (2026-09-10, `MASTER_PLAN`): **`trakt_slug` sosyal kimlik
 * DEĞİLDİR.** Arama, profil bağlantıları ve takip ilişkileri TAMAMEN
 * `users.username` üzerinden çalışır; Trakt slug'ı yalnızca bir dış referans.
 *
 * 🔴 BU DOSYA `services/api/social.ts` İLE KARIŞTIRILMAMALI. O dosya Trakt'ın
 * sosyal grafına gidiyor (takip/takipçi/istekler) ve Google-only kullanıcıda
 * **401 veriyor** (`BACKLOG` §C12 komşusu, `FAZ_T3_TASLAK` §1.1). Bu dosya
 * BİZİM grafımıza gider.
 *
 * ==========================================================================
 * ⚠️ ARAMADA ADAPTÖR YOK — BİLİNÇLİ
 * ==========================================================================
 * `library.ts` bir adaptörün yarısıdır: token tipine bakıp isteği Trakt'a ya
 * da bize yönlendirir. Arama BÖYLE DEĞİL — token tipi ne olursa olsun
 * **HER ZAMAN bize** gider. Gerekçe (kullanıcı kararı §5.1): sosyal grafın
 * tek otoritesi bizim veritabanımız, ve `user_follows` satırları
 * `users.id`'ye FK veriyor. Trakt'ta arayıp KaymakTV'de olmayan birini
 * bulmak, takip EDİLEMEYEN bir sonuç göstermek olurdu.
 */

const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

export interface KaymakUserSonucu {
  id: string;
  /** 🔑 KANONİK ADRES. Gösterim ve (T3.2'den sonra) takip bunun üzerinden. */
  username: string;
  avatarUrl: string | null;
  /** Gizli hesap: "Takip Et" yerine "İstek Gönder" gösterilir. */
  isPrivate: boolean;
  /**
   * ⚠️ KİMLİK DEĞİL, YETENEK BAYRAĞI. Yalnızca "profil ekranına gidilebilir
   * mi?" sorusunu yanıtlar — profil ekranı (`usePublicProfile*` ailesi)
   * bugün hâlâ tamamen Trakt'tan okuyor, dolayısıyla Google-only kullanıcının
   * (`null`) açılacak bir profili YOK. T3.3'te kendi profil ekranımız gelince
   * bu alan DÜŞECEK — yeni kod buna kimlik olarak GÜVENMESİN.
   */
  traktSlug: string | null;
}

/** `search()` çağıranının ayırt etmesi gereken üç durum. */
export type AramaHatasi = 'cok_kisa' | 'yetki' | 'genel';

export class KaymakAramaHatasi extends Error {
  constructor(public readonly tur: AramaHatasi, message: string) {
    super(message);
  }
}

/**
 * Kullanıcı adına göre arama — Worker `POST /social/search`.
 *
 * 🔴 `userId` GÖNDERİLMİYOR: Worker çağıranı TOKEN'DAN çözüyor. Buraya bir
 * kimlik alanı eklemek klasik mass-assignment açığı olurdu (`library.ts`
 * ile aynı kural).
 *
 * ⚠️ Terim temizliği SUNUCUDA yapılıyor (`aramaTerimiTemizle`) — burada
 * tekrar etmiyoruz. İki yerde yaşayan bir kural ıraksar; sunucu tarafı
 * güvenlik sınırı olduğu için otorite ORASI.
 */
export const searchKaymakUsers = async (query: string): Promise<KaymakUserSonucu[]> => {
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');

  try {
    // ⚠️ TOKEN OKUMASI `try` İÇİNDE. Dışarıdayken depolama hatası düz bir
    // `Error` olarak kaçıyor ve çağıran onu `genel`e düşürüyordu — kullanıcı
    // "Bir şeyler ters gitti" görüyor, hangi katmanın düştüğü ise hiçbir
    // yerde yazmıyordu.
    const token = await SecureStore.getItemAsync('traktAccessToken');

    const res = await axios.post(
      `${KAYMAK_WORKER_URL}/social/search`,
      { query, traktAccessToken: token },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
    );
    return (res.data?.results ?? []) as KaymakUserSonucu[];
  } catch (error: any) {
    const durum = error?.response?.status;
    const govde = error?.response?.data;

    // 🔴 SESSİZ KAYIP YASAK (AI_RULES §2): boş liste dönmek, "kimse
    // bulunamadı" ile "istek başarısız" durumlarını aynı ekrana düşürürdü.
    if (durum === 400) {
      throw new KaymakAramaHatasi('cok_kisa', govde?.message || 'Arama terimi geçersiz.');
    }
    if (durum === 401 || durum === 403) {
      throw new KaymakAramaHatasi('yetki', govde?.message || 'Oturum doğrulanamadı.');
    }
    throw new KaymakAramaHatasi('genel', govde?.message || 'Arama yapılamadı.');
  }
};
