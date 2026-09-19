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
  /**
   * §C24 · `053` — gerçek ad. BENZERSİZ DEĞİL: kimliği `username` ayırt eder,
   * bu yüzden gösterildiği her yerde @username de yanında durmalı. Opsiyonel:
   * `053` öncesi Worker bu alanı döndürmüyor. `null` = yok.
   */
  displayName?: string | null;
  avatarUrl: string | null;
  /** Gizli hesap: "Takip Et" yerine "İstek Gönder" gösterilir. */
  isPrivate: boolean;
  /**
   * ⚠️ KİMLİK DEĞİL — TRAKT ZENGİNLEŞTİRME ANAHTARI (M338). Profil ekranı
   * isim/biyografi/izleme kütüphanesini hâlâ Trakt'tan okuyor ve o okumalar
   * YALNIZCA bu değerle yapılmalı, rota parametresiyle (`username`) DEĞİL:
   * KaymakTV adı Trakt'taki adla aynı olmak zorunda değil, aynı adda Trakt'ta
   * BAŞKA biri de olabilir. `null` = Trakt verisi yok (Google-only).
   */
  traktSlug: string | null;
}

/** Çağıranın ayırt etmesi gereken hata sınıfları. */
export type AramaHatasi = 'cok_kisa' | 'yetki' | 'bulunamadi' | 'istek_yok' | 'genel';

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
const sosyalIstek = async (yol: string, govde: Record<string, unknown>): Promise<any> => {
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');

  try {
    // ⚠️ TOKEN OKUMASI `try` İÇİNDE. Dışarıdayken depolama hatası düz bir
    // `Error` olarak kaçıyor ve çağıran onu `genel`e düşürüyordu — kullanıcı
    // "Bir şeyler ters gitti" görüyor, hangi katmanın düştüğü ise hiçbir
    // yerde yazmıyordu (canlıda ısırdı, M333).
    const token = await SecureStore.getItemAsync('traktAccessToken');

    const res = await axios.post(
      `${KAYMAK_WORKER_URL}${yol}`,
      { ...govde, traktAccessToken: token },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
    );
    return res.data;
  } catch (error: any) {
    const durum = error?.response?.status;
    const yanit = error?.response?.data;

    // 🔴 SESSİZ KAYIP YASAK (AI_RULES §2): boş sonuç dönmek, "bulunamadı" ile
    // "istek başarısız" durumlarını aynı ekrana düşürürdü.
    if (durum === 400) {
      throw new KaymakAramaHatasi('cok_kisa', yanit?.message || 'İstek geçersiz.');
    }
    if (durum === 401 || durum === 403) {
      throw new KaymakAramaHatasi('yetki', yanit?.message || 'Oturum doğrulanamadı.');
    }
    if (durum === 404) {
      throw new KaymakAramaHatasi('bulunamadi', yanit?.message || 'Kullanıcı bulunamadı.');
    }
    // `/social/approve` · `/social/deny`: istek artık YOK (geri çekildi ya da
    // araya bir engelleme girdi). Çağıran bunu HATA değil SONUÇ olarak ele
    // almalı — `genel`e düşseydi olmayan bir istek listeye geri konurdu.
    if (durum === 409 && yanit?.code === 'istek_yok') {
      throw new KaymakAramaHatasi('istek_yok', yanit?.message || 'Bekleyen bir istek bulunamadı.');
    }
    throw new KaymakAramaHatasi('genel', yanit?.message || 'İşlem tamamlanamadı.');
  }
};

export const searchKaymakUsers = async (query: string): Promise<KaymakUserSonucu[]> => {
  const data = await sosyalIstek('/social/search', { query });
  return (data?.results ?? []) as KaymakUserSonucu[];
};

/** `/social/profile` yanıtı — kimlik + sosyal ilişki (izleme geçmişi DEĞİL). */
export interface KaymakProfil {
  profile: KaymakUserSonucu & {
    userId: string;
    /** T4 · `043`. Opsiyonel: `043` öncesi Worker bu alanı hiç döndürmüyor. */
    bio?: string | null;
  };
  followersCount: number;
  followingCount: number;
  /** `takip` · `bekliyor` · `yok`. Kendi profilinde her zaman `yok`. */
  iliski: 'takip' | 'bekliyor' | 'yok';
  kendisi: boolean;
}

/**
 * Kullanıcı adından profil + ilişki durumu — `POST /social/profile`.
 *
 * 🪪 T3.3'ün TAŞIYICI ucu: profil ekranı bugüne kadar Trakt slug'ıyla
 * adresleniyordu ve bizim `users.id`'mizi hiç taşımıyordu. Takip düğmesinin
 * çalışabilmesi için o kimlik ŞART (bkz. HISTORY M335).
 *
 * ⛔ İzleme geçmişi/istatistik DÖNMEZ — onlar hâlâ `usePublicProfile*`
 * ailesinde ve Trakt'tan okunuyor.
 */
export const fetchKaymakProfile = async (username: string): Promise<KaymakProfil> => {
  return (await sosyalIstek('/social/profile', { username })) as KaymakProfil;
};

/** `/social/graph` yanıtı. `pendingOut` yalnızca KENDİ grafında dolu. */
export interface KaymakGraf {
  gizli: boolean;
  followersCount: number;
  followingCount: number;
  followers: (KaymakUserSonucu & { userId: string })[];
  following: (KaymakUserSonucu & { userId: string })[];
  /** Benim GÖNDERDİĞİM bekleyen istekler (hedef `userId` listesi). */
  pendingOut: string[];
  /** BANA gelen bekleyen istek sayısı — zil rozeti. Yalnızca kendi grafımda dolu. */
  pendingInCount: number;
}

/**
 * Takip grafı — `POST /social/graph`. `targetUserId` verilmezse KENDİ ağım.
 *
 * ⚠️ Gizli hesabın ağında `followers`/`following` BOŞ gelir ama sayılar
 * doludur (Worker'ın kararı) — istemci `gizli` bayrağına bakıp listeyi
 * göstermemeli, sayıyı gösterebilir.
 */
export const fetchKaymakGraph = async (targetUserId?: string): Promise<KaymakGraf> => {
  return (await sosyalIstek('/social/graph', targetUserId ? { targetUserId } : {})) as KaymakGraf;
};

/**
 * Takip et — `POST /social/follow`.
 *
 * 🔑 Dönen `durum` hedefin gizliliğine göre değişiyor: `takip` (doğrudan) ya
 * da `istek` (gizli hesap, onay bekliyor). Çağıran bunu AYIRT ETMELİ, yoksa
 * gizli hesaba istek atan kullanıcı "takip ediyorum" sanır.
 */
export const followKaymakUser = async (
  targetUserId: string,
): Promise<'takip' | 'istek'> => {
  const data = await sosyalIstek('/social/follow', { targetUserId });
  return data?.durum === 'istek' ? 'istek' : 'takip';
};

/**
 * Takibi bırak VEYA gönderilmiş isteği geri çek — `POST /social/unfollow`.
 *
 * 🔑 TEK UÇ, iki iş: istemci "şu an takip mi ediyorum yoksa istek mi
 * bekliyor" ayrımını yapmak zorunda değil (Worker ikisini de siler). Bayat
 * bir ekranın yanlış ucu çağırması yapısal olarak imkânsız.
 */
export const unfollowKaymakUser = async (targetUserId: string): Promise<void> => {
  await sosyalIstek('/social/unfollow', { targetUserId });
};

/** `/social/requests` satırı — BANA gelen bekleyen istek. */
export interface GelenIstek {
  userId: string;
  username: string | null;
  /** §C24 · `053`. */
  displayName?: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

/**
 * Bana gelen bekleyen takip istekleri — `POST /social/requests`.
 *
 * ⛔ `social.ts`'teki `getFollowRequests` İLE KARIŞTIRMA: o TRAKT'ın istek
 * kuyruğunu okuyor ve bizim grafta atılan hiçbir isteği görmüyor. Bildirimler
 * ekranının "Takip İstekleri" bölümü bu yüzden hep boş kalıyordu (M338).
 */
export const fetchIncomingRequests = async (): Promise<GelenIstek[]> => {
  const data = await sosyalIstek('/social/requests', {});
  return (data?.requests ?? []) as GelenIstek[];
};

/** İsteği onayla — Worker `approve_follow_request` RPC'siyle TEK işlemde yapar. */
export const approveIncomingRequest = async (requesterUserId: string): Promise<void> => {
  await sosyalIstek('/social/approve', { requesterUserId });
};

/** İsteği reddet — satır SİLİNMEZ, `denied` olur ("sessiz duvar"). */
export const denyIncomingRequest = async (requesterUserId: string): Promise<void> => {
  await sosyalIstek('/social/deny', { requesterUserId });
};
