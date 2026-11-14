import axios from 'axios';
import type { TraktGirisi } from './traktKasa';

/**
 * Trakt cihaz kodu girişi uçları (`docs/design/TRAKT_CIHAZ_KODU_PLANI.md` §3.2). Karar SUNUCUDA
 * (Worker `routes/authTraktCihaz.js`); bu dosya yalnız taşır. Başarıda Worker `/auth/trakt/degis`
 * ile AYNI paketi verir → hesap kilidi, bağlama ve oturum açma tek yoldan geçer.
 */
const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';
// Worker: köprü (≤10 sn) + kimlik + depo + 409'da 1,5 sn bekleme. `traktKasa` ile aynı tavan.
const ZAMAN_ASIMI_MS = 30_000;

/**
 * Sunucu kodu ya da yerel: `suresi_doldu` · `reddedildi` · `gecersiz` · `kullanildi` (yeni kod gerekir) ·
 * `tekrar_dene` · `cok_istek` · `sunucu` · `ag` (geçici) · `yapilandirma`.
 */
export class CihazHatasi extends Error {
  constructor(public kod: string) {
    super(kod);
  }
}

export type CihazKodu = {
  deviceCode: string;
  userCode: string;
  dogrulamaAdresi: string;
  sureSn: number;
  aralikSn: number;
};

export type YoklamaSonucu = { durum: 'bekliyor' | 'yavasla' } | { durum: 'tamam'; giris: TraktGirisi };

async function gonder(yol: string, govde: Record<string, unknown>): Promise<any> {
  if (!KAYMAK_WORKER_URL) throw new CihazHatasi('yapilandirma');
  try {
    const r = await axios.post(`${KAYMAK_WORKER_URL}${yol}`, govde, {
      headers: { 'Content-Type': 'application/json' },
      timeout: ZAMAN_ASIMI_MS,
    });
    if (!r.data?.success) throw new CihazHatasi(r.data?.code || 'sunucu');
    return r.data;
  } catch (e: any) {
    if (e instanceof CihazHatasi) throw e;
    throw new CihazHatasi(e?.response?.data?.code || (e?.response ? 'sunucu' : 'ag'));
  }
}

/** SAF — Worker `baslat` gövdesi geçerli mi (cihaz bu adresi tarayıcıda açar: yalnız https trakt.tv). */
export function cihazKoduGecerli(v: any): v is CihazKodu {
  if (!v || typeof v.deviceCode !== 'string' || typeof v.userCode !== 'string' || typeof v.dogrulamaAdresi !== 'string') return false;
  if (!(v.sureSn > 0) || !(v.aralikSn > 0)) return false;
  return /^https:\/\/([a-z0-9-]+\.)*trakt\.tv\//.test(v.dogrulamaAdresi);
}

export async function cihazKoduBaslat(): Promise<CihazKodu> {
  const veri = await gonder('/auth/trakt/cihaz/baslat', {});
  if (!cihazKoduGecerli(veri)) throw new CihazHatasi('sunucu');
  return {
    deviceCode: veri.deviceCode,
    userCode: veri.userCode,
    dogrulamaAdresi: veri.dogrulamaAdresi,
    sureSn: veri.sureSn,
    aralikSn: veri.aralikSn,
  };
}

export async function cihazKodunuYokla(deviceCode: string): Promise<YoklamaSonucu> {
  const veri = await gonder('/auth/trakt/cihaz/yokla', { deviceCode });
  if (veri.durum === 'bekliyor' || veri.durum === 'yavasla') return { durum: veri.durum };
  if (veri.durum === 'tamam' && typeof veri.erisim === 'string' && typeof veri.kasaBileti === 'string') {
    return { durum: 'tamam', giris: { erisim: veri.erisim, kimlik: veri.kimlik ?? {}, kasaBileti: veri.kasaBileti } };
  }
  throw new CihazHatasi('sunucu');
}
