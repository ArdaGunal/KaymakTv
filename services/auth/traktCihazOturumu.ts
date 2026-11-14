import * as SecureStore from '../../utils/secureStorage';
import type { CihazKodu } from '../api/traktCihaz';

/**
 * Trakt cihaz kodu girişi — bekleyen oturum (`docs/design/TRAKT_CIHAZ_KODU_PLANI.md` §3.3).
 *
 * Kişi kodu tarayıcıda onaylarken uygulama arka plana gider; düşük RAM'li telefonda Android süreci
 * öldürebilir. Bekleyen oturum diskte durur: açılışta giriş ekranı kod görünümüne kendiliğinden döner.
 *
 * 🔒 SecureStore (AsyncStorage DEĞİL): `deviceCode` Worker'la birlikte token'a dönüşebilir.
 * Çıkışta `AuthContext.removeKeys` siler (`tests/arayuz/cikis-denetimi` her SecureStore anahtarını denetler).
 *
 * `mod` kod alınırken yazılır: «Trakt'ı bağla» niyeti O ANDA tüketilip buraya geçer. Böylece 10 dk'lık
 * kod sürerken 15 dk'lık niyet dolup bağlama sessizce yeni girişe dönemez (hesap bölünmesi).
 */
export type CihazModu = 'giris' | 'kart' | 'baglama';

export type BekleyenCihazOturumu = {
  deviceCode: string;
  userCode: string;
  dogrulamaAdresi: string;
  bitisMs: number;
  aralikMs: number;
  mod: CihazModu;
};

/** Trakt `slow_down` (429): aralık 5 sn uzar (RFC 8628 §3.5). */
export const YAVASLA_EK_MS = 5_000;
/** Ağ / sunucu hatasında geri çekilme tavanı. */
export const GERI_CEKILME_TAVANI_MS = 30_000;
const MODLAR: readonly CihazModu[] = ['giris', 'kart', 'baglama'];

// ── SAF ────────────────────────────────────────────────────────────────────────────────────────

export function oturumOlustur(kod: CihazKodu, mod: CihazModu, simdi: number): BekleyenCihazOturumu {
  return {
    deviceCode: kod.deviceCode,
    userCode: kod.userCode,
    dogrulamaAdresi: kod.dogrulamaAdresi,
    bitisMs: simdi + kod.sureSn * 1000,
    aralikMs: kod.aralikSn * 1000,
    mod,
  };
}

/** Diskten gelen değer biçimce doğru ve süresi geçmemiş mi. */
export function oturumGecerliMi(o: any, simdi: number): o is BekleyenCihazOturumu {
  return (
    !!o &&
    typeof o.deviceCode === 'string' && o.deviceCode.length >= 16 &&
    typeof o.userCode === 'string' && o.userCode.length > 0 &&
    typeof o.dogrulamaAdresi === 'string' && o.dogrulamaAdresi.startsWith('https://') &&
    typeof o.bitisMs === 'number' && o.bitisMs > simdi &&
    typeof o.aralikMs === 'number' && o.aralikMs > 0 &&
    MODLAR.includes(o.mod)
  );
}

/** Son yoklamadan bu yana aralık dolmadıysa kalan süre; dolduysa 0 (hemen). */
export function sonrakiYoklamaGecikmesi(sonYoklamaMs: number | null, aralikMs: number, simdi: number): number {
  if (sonYoklamaMs === null) return 0;
  return Math.max(0, sonYoklamaMs + aralikMs - simdi);
}

/** n. ardışık geçici hatadan sonra bekleme: aralık × 2ⁿ⁻¹, tavan 30 sn. */
export function geriCekilmeMs(ardisikHata: number, aralikMs: number): number {
  const n = Math.max(1, ardisikHata);
  return Math.min(GERI_CEKILME_TAVANI_MS, aralikMs * 2 ** (n - 1));
}

export type HataSinifi = 'suresi_doldu' | 'reddedildi' | 'yeni_kod' | 'gecici';

/** Worker / ağ hata kodu → ekranın ne yapacağı. */
export function hataSinifi(kod: string): HataSinifi {
  if (kod === 'suresi_doldu') return 'suresi_doldu';
  if (kod === 'reddedildi') return 'reddedildi';
  if (kod === 'gecersiz' || kod === 'kullanildi' || kod === 'gecersiz_istek' || kod === 'yapilandirma') return 'yeni_kod';
  return 'gecici'; // tekrar_dene, cok_istek, sunucu, ag
}

/** «4+4» okunuşu: JBWT7NY7 → JBWT 7NY7. */
export function koduBicimle(kod: string): string {
  return kod.length === 8 ? `${kod.slice(0, 4)} ${kod.slice(4)}` : kod;
}

/** Kalan süre «d:ss». */
export function kalanSureMetni(bitisMs: number, simdi: number): string {
  const sn = Math.max(0, Math.ceil((bitisMs - simdi) / 1000));
  return `${Math.floor(sn / 60)}:${String(sn % 60).padStart(2, '0')}`;
}

// ── DİSK ───────────────────────────────────────────────────────────────────────────────────────

export async function cihazOturumunuKaydet(o: BekleyenCihazOturumu): Promise<void> {
  try {
    await SecureStore.setItemAsync('traktCihazOturumu', JSON.stringify(o));
  } catch {
    // Yazılamazsa yalnız süreç ölümünden kurtarma kaybolur; akış bellekte sürer.
  }
}

/** Geçerli bekleyen oturum ya da null. Bozuk / süresi geçmiş kayıt silinir. */
export async function cihazOturumunuOku(simdi = Date.now()): Promise<BekleyenCihazOturumu | null> {
  try {
    const ham = await SecureStore.getItemAsync('traktCihazOturumu');
    if (!ham) return null;
    const o = JSON.parse(ham);
    if (oturumGecerliMi(o, simdi)) return o;
  } catch {
    // bozuk kayıt → aşağıda silinir
  }
  await cihazOturumunuSil();
  return null;
}

export async function cihazOturumunuSil(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync('traktCihazOturumu');
  } catch {
    // silinemezse süresi dolunca okumada yok sayılır
  }
}
