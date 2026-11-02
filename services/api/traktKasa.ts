import axios from 'axios';

/**
 * Trakt kasası uçları (`docs/design/TRAKT_KASA_PLANI.md` §4.4). Karar SUNUCUDA (Worker
 * `routes/authTrakt.js`); bu dosya yalnız taşır. Yenileme anahtarı buradan hiç almaz:
 * `kasaBileti` Worker'ın açabildiği mühürlü bir zarf, cihaz içini okuyamaz.
 */
const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';
// Worker kilit başkasındaysa ~3 sn bekler, Trakt köprüsü + doğrudan deneme en çok 20 sn sürer.
const ZAMAN_ASIMI_MS = 30_000;

/** Sunucu kodu (`kasa_koptu`, `tekrar_dene`…) ya da `ag` / `sunucu` / `yapilandirma`. */
export class KasaHatasi extends Error {
  constructor(public kod: string) {
    super(kod);
  }
}

export type GelenKimlik = { slug?: unknown; uuid?: unknown; ad?: unknown; avatar?: unknown };

/** Giriş ekranı → hesap kilidi → (bağlama | oturum) arasında taşınan yeni giriş. Diske YAZILMAZ. */
export type TraktGirisi = { erisim: string; kimlik: GelenKimlik; kasaBileti: string };

export type KasaOturumu = { erisim: string; kaymakOturum: string; userId?: string; tasindi?: boolean };

async function gonder<T>(yol: string, govde: Record<string, unknown>): Promise<T> {
  if (!KAYMAK_WORKER_URL) throw new KasaHatasi('yapilandirma');
  try {
    const r = await axios.post(`${KAYMAK_WORKER_URL}${yol}`, govde, {
      headers: { 'Content-Type': 'application/json' },
      timeout: ZAMAN_ASIMI_MS,
    });
    if (!r.data?.success || typeof r.data?.erisim !== 'string') throw new KasaHatasi(r.data?.code || 'sunucu');
    return r.data as T;
  } catch (e: any) {
    if (e instanceof KasaHatasi) throw e;
    throw new KasaHatasi(e?.response?.data?.code || (e?.response ? 'sunucu' : 'ag'));
  }
}

export function koduDegis(code: string, redirectUri: string): Promise<TraktGirisi> {
  return gonder('/auth/trakt/degis', { code, redirect_uri: redirectUri });
}

export function kasaOturumuAc(erisim: string, kasaBileti: string): Promise<KasaOturumu> {
  return gonder('/auth/trakt/oturum', { traktAccessToken: erisim, kasaBileti });
}

/** `zorla`: Trakt kasanın verdiği erişimi reddetti; Worker kalan süreye bakmadan yeniler. */
export function kasadanErisimIste(kaymakOturum: string, zorla = false): Promise<KasaOturumu> {
  return gonder('/auth/trakt/token', { kaymakOturum, ...(zorla ? { zorla: true } : {}) });
}

/** Eski cihazın yenileme anahtarını kasaya devreder. Anahtarsız: yalnız kasadan oturum (Hesap Seç sonrası). */
export function kasayaTasi(erisim: string, yenileme?: string): Promise<KasaOturumu> {
  return gonder('/auth/trakt/tasi', { traktAccessToken: erisim, ...(yenileme ? { yenileme } : {}) });
}

/** Yanlış hesapla dönen girişin yetkisini kaldırır (GIRIS-KILIT). En iyi çaba: akışı asla bozmaz. */
export async function kasaBiletiniBirak(kasaBileti: string): Promise<void> {
  if (!KAYMAK_WORKER_URL) return;
  try {
    await axios.post(`${KAYMAK_WORKER_URL}/auth/trakt/birak`, { kasaBileti }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: ZAMAN_ASIMI_MS,
    });
  } catch (e) {
    // Hata nesnesi YAZILMAZ: istek gövdesinde kasa bileti var (plan §10).
    console.warn('[traktKasa] Yanlış hesabın yetkisi kaldırılamadı:', (e as any)?.response?.status ?? 'ag');
  }
}
