// F12 — app/(public)/download.web.tsx'teki ham fetch() çağrısı buraya taşındı
// (AI_RULES §1: veri çekme mantığı component'te değil services/'te olmalı).

const BETA_SURUM_API = 'https://api.github.com/repos/ArdaGunal/KaymakTv/releases/tags/beta';

export interface BetaApk {
  url: string;
  ad: string;
  /** Bayt. */
  boyut: number;
}

export interface BetaSurumu {
  notlar: string;
  apk: BetaApk | null;
}

/**
 * «beta» sürümündeki indirilecek APK'yı seçer (SAF).
 *
 * 🔴 2026-11-07: indirme düğmesi sabit `kaymaktv-latest.apk` adresine gidiyordu;
 * APK sürüm numaralı adla (`KaymakTV-2.6.8.apk`) yüklenince sayfa 404 verdi.
 * Kullanıcı kararı: sürüm numaralı ad mantıklı → dosya adı sabit DEĞİL, yanıttan
 * okunur. Birden çok APK varsa en son yükleneni; ağ günlüklü test paketi
 * (`-AG-TEST`) asla seçilmez.
 */
export function betaApkSec(assets: any[] | null | undefined): BetaApk | null {
  const apklar = (assets || []).filter((a) => typeof a?.name === 'string'
    && /\.apk$/i.test(a.name) && !/-AG-TEST/i.test(a.name) && typeof a?.browser_download_url === 'string');
  if (!apklar.length) return null;
  const zaman = (a: any) => Date.parse(a?.updated_at || a?.created_at || '') || 0;
  const secilen = [...apklar].sort((a, b) => zaman(b) - zaman(a))[0];
  return { url: secilen.browser_download_url, ad: secilen.name, boyut: Number(secilen.size) || 0 };
}

/** «beta» sürümünün notları ve indirilecek APK'sı — tek istek. */
export async function fetchBetaRelease(): Promise<BetaSurumu> {
  const response = await fetch(BETA_SURUM_API);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  const data = await response.json();
  return { notlar: data?.body || '', apk: betaApkSec(data?.assets) };
}
