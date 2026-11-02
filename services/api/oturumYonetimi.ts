import axios from 'axios';
import * as SecureStore from '../../utils/secureStorage';
import { eskiCihazGecisi, isKaymakSessionToken } from './traktClient';

/**
 * Trakt kasası Faz 6: «Diğer tüm cihazlardan çık» (`docs/design/TRAKT_KASA_PLANI.md` Senaryo 5).
 * Karar sunucuda (Worker `routes/accountOturum.js`); bu dosya yalnız taşır.
 * Kimlik KaymakTV oturum belgesidir: Trakt'lı cihazda `kaymakOturum`, Google-only cihazda erişim yuvasındaki belge.
 */
const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';
const ZAMAN_ASIMI_MS = 30_000;

export type DigerCihazlarSonucu = { kaymakOturum: string; erisim: string | null; traktli: boolean };

export class OturumYonetimiHatasi extends Error {
  constructor(public kod: string) {
    super(kod);
  }
}

async function oturumBelgesi(): Promise<string | null> {
  const yuva = await SecureStore.getItemAsync('traktAccessToken');
  if (isKaymakSessionToken(yuva)) return yuva;
  await eskiCihazGecisi(); // Taşınmamış eski cihazın henüz oturum belgesi yok.
  return SecureStore.getItemAsync('kaymakOturum');
}

export async function digerCihazlardanCik(): Promise<DigerCihazlarSonucu> {
  const kaymakOturum = await oturumBelgesi();
  if (!KAYMAK_WORKER_URL || !kaymakOturum) throw new OturumYonetimiHatasi('oturum_yok');
  try {
    const r = await axios.post(`${KAYMAK_WORKER_URL}/account/diger-cihazlardan-cik`, { kaymakOturum }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: ZAMAN_ASIMI_MS,
    });
    if (!r.data?.success || typeof r.data?.kaymakOturum !== 'string') throw new OturumYonetimiHatasi('sunucu');
    return { kaymakOturum: r.data.kaymakOturum, erisim: r.data.erisim ?? null, traktli: !!r.data.traktli };
  } catch (e: any) {
    if (e instanceof OturumYonetimiHatasi) throw e;
    throw new OturumYonetimiHatasi(e?.response?.data?.code || (e?.response ? 'sunucu' : 'ag'));
  }
}
