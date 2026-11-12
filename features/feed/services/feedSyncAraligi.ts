import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * ISTEK-SEL (M607) · Açılış `/feed/sync`'i F5 sıklığında tekrar atılmaz.
 *
 * Neden: Worker bu ucu IP başına dakikada 10 istekle sınırlıyor (`feedSync/index.js`). Web'de her
 * sayfa yenilemesi uygulamayı baştan kurduğu için art arda F5 sınıra çarpıyor ve konsola 429 düşüyordu
 * (2026-11-12, test hesabı). Bu senkron yalnız Trakt'ta UYGULAMA DIŞINDA yapılan izlemeleri akışa taşır;
 * iki dakikada birden sık koşmasının kullanıcıya faydası yok.
 *
 * Kayıt AsyncStorage'da (web'de localStorage); çıkışta `cikisTemizligi` hepsini sildiği için yeni
 * hesapla girişte senkron hemen koşar. 429 da «az önce koştu» sayılır: sınırdayken tekrar vurmayız.
 */
export const FEED_SYNC_SON_TUR_ANAHTARI = '@kaymak_feed_sync_son_tur_v1';
export const FEED_SYNC_ARALIGI_MS = 2 * 60 * 1000;

/** Saf — sınanır. Son tur bilinmiyorsa, saat geri gittiyse ya da aralık dolduysa koşulur. */
export function feedSyncAtlanirMi(sonTur: number | null, simdi: number, aralik = FEED_SYNC_ARALIGI_MS): boolean {
  if (sonTur === null || !Number.isFinite(sonTur)) return false;
  const gecen = simdi - sonTur;
  return gecen >= 0 && gecen < aralik;
}

/** Bozuk/eksik kayıt → `null` (koşulur). Okuma hatası da koşmayı engellemez. */
export async function feedSyncSonTurOku(): Promise<number | null> {
  try {
    const ham = await AsyncStorage.getItem(FEED_SYNC_SON_TUR_ANAHTARI);
    const n = ham === null ? NaN : Number(ham);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function feedSyncSonTurYaz(zaman: number = Date.now()): void {
  AsyncStorage.setItem(FEED_SYNC_SON_TUR_ANAHTARI, String(zaman)).catch(() => {});
}
