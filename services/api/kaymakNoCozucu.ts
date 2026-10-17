import axios from 'axios';

/**
 * Kimlik Faz 6 (M522) · D7 — KaymakNo → kullanıcı adı (Worker `/social/profile/no`).
 * Giriş zorunlu (D6). Dönüş: ad · 'yok' (404) · 'gorulemez' (403 engel) · hata fırlatır (ağ/sunucu).
 */
const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

export async function kaymakNoCoz(oturumTokeni: string, no: string): Promise<string | 'yok' | 'gorulemez'> {
  try {
    const r = await axios.post(
      `${KAYMAK_WORKER_URL}/social/profile/no`,
      { traktAccessToken: oturumTokeni, no },
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    if (r.data?.success && typeof r.data.username === 'string') return r.data.username;
    return 'yok';
  } catch (e: any) {
    const s = e?.response?.status;
    if (s === 404 || s === 400) return 'yok';
    if (s === 403) return 'gorulemez';
    throw e;
  }
}
