import axios from 'axios';

/**
 * Kimlik birliği Faz 5 (M520) · D3 — Ayarlar → «Giriş yöntemleri» ve «Hesap Seç».
 * Karar SUNUCUDA (Worker `routes/girisYontemi.js`); bu dosya yalnız taşır.
 * `oturumTokeni` = bugünkü oturum (Trakt token'ı ya da KaymakTV oturumu).
 */
const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

export type HesapOzeti = {
  kaymakNo: number | null;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  yontemler: ('trakt' | 'google')[];
  sayilar: { izleme: number | null; yorum: number | null; takipci: number | null };
};

/** Sonraki oturum: yeni Trakt token'ına geç · değişme · çıkış + Trakt girişi. */
export type SonrakiOturum = 'yeni_trakt' | 'ayni' | 'trakt_ile_gir';

export type BaglaSonucu =
  | { durum: 'baglandi'; yontem: 'trakt' | 'google'; oturum: SonrakiOturum }
  | { durum: 'cakisma'; yontem: 'trakt' | 'google'; bilet: string; hesaplar: { mevcut: HesapOzeti; diger: HesapOzeti } };

/** Sunucu hata kodu taşıyan hata (`zaten_bagli`, `baglanamadi`, `durum_degisti`…). */
export class GirisYontemiHatasi extends Error {
  constructor(public kod: string) {
    super(kod);
  }
}

async function gonder<T>(yol: string, govde: Record<string, unknown>): Promise<T> {
  if (!KAYMAK_WORKER_URL) throw new GirisYontemiHatasi('yapilandirma');
  try {
    const r = await axios.post(`${KAYMAK_WORKER_URL}${yol}`, govde, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000,
    });
    if (!r.data?.success) throw new GirisYontemiHatasi(r.data?.code || 'bilinmeyen');
    return r.data as T;
  } catch (e: any) {
    if (e instanceof GirisYontemiHatasi) throw e;
    throw new GirisYontemiHatasi(e?.response?.data?.code || 'ag');
  }
}

export function traktBagla(oturumTokeni: string, yeniTraktToken: string): Promise<BaglaSonucu> {
  return gonder('/account/giris-yontemi/bagla', { traktAccessToken: oturumTokeni, yeniTraktToken });
}

export function googleBagla(oturumTokeni: string, googleIdToken: string, nonce?: string): Promise<BaglaSonucu> {
  return gonder('/account/giris-yontemi/bagla', { traktAccessToken: oturumTokeni, googleIdToken, ...(nonce ? { nonce } : {}) });
}

export function hesapSec(
  oturumTokeni: string,
  bilet: string,
  secim: 'mevcut' | 'diger'
): Promise<{ oturum: SonrakiOturum; kalanBenMiyim: boolean }> {
  return gonder('/account/hesap-sec', { traktAccessToken: oturumTokeni, bilet, secim, onay: true });
}
