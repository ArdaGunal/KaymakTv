import axios from 'axios';
import * as SecureStore from '../../utils/secureStorage';
import { isKaymakSessionToken } from './traktClient';
import { belgeDegisiyor, hesapGecersizBildir } from '../auth/oturumDenetimi';

/**
 * M525 (b) — Worker `invalid_token` → otomatik çıkış (yalnız KaymakTV oturum belgesi).
 *
 * Hesap silindiğinde (ör. başka cihazda «Hesap Seç», ya da hesap silme) Worker o hesabın
 * oturum belgesine her istekte `401 invalid_token` döner (satır yok). Uygulamanın otomatik
 * çıkışı yalnız Trakt API 401'ine bağlıydı → cihaz «girişli» görünüp hata üretmeye (ve
 * Discord'a telemetri göndermeye) devam ediyordu.
 *
 * Trakt token'ı burada TETİKLEMEZ: Trakt'ın kendi yenileme/çıkış yolu var (`traktClient`), ve
 * Worker'ın Trakt kaynaklı geçici hataları oturumu düşürmemeli.
 */
const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';
let kuruldu = false;

/** SAF — isteğin gövdesinde giden kimlik; okunamazsa `null`. */
export function gonderilenKimlik(veri: unknown): string | null {
  try {
    const govde = typeof veri === 'string' ? JSON.parse(veri) : veri;
    const kimlik = (govde as { traktAccessToken?: unknown } | null)?.traktAccessToken;
    return typeof kimlik === 'string' ? kimlik : null;
  } catch {
    return null;
  }
}

/**
 * SAF — bu yanıt «hesabın oturum belgesi artık geçersiz» mi?
 * `gonderilen`: isteğin taşıdığı belge. Diskteki belgeden farklıysa reddedilen ESKİ belgedir (Faz 6: bu
 * cihazın belgesi yenilendi): güncel oturum sağlam, çıkış yapılmaz.
 */
export function hesapGecersizYanitiMi(url: string | undefined, status: number | undefined, kod: unknown, oturum: string | null, gonderilen: string | null = null): boolean {
  // `/auth/trakt/*`: gövdedeki YENİ Trakt erişimi reddedildi; cihazdaki oturum belgesiyle ilgisi yok.
  return !!KAYMAK_WORKER_URL && !!url && url.startsWith(KAYMAK_WORKER_URL) && !url.includes('/auth/trakt/')
    && status === 401 && kod === 'invalid_token' && isKaymakSessionToken(oturum)
    && (gonderilen === null || gonderilen === oturum);
}

export function workerYanitKoruyucusunuKur(): void {
  if (kuruldu) return;
  kuruldu = true;
  axios.interceptors.response.use(undefined, async (hata) => {
    try {
      const r = hata?.response;
      if (r?.status === 401) {
        const oturum = await SecureStore.getItemAsync('traktAccessToken');
        if (!belgeDegisiyor() && hesapGecersizYanitiMi(hata?.config?.url, r.status, r.data?.code, oturum, gonderilenKimlik(hata?.config?.data))) hesapGecersizBildir();
      }
    } catch {
      // Koruyucu asla isteğin kendi hatasını değiştirmez.
    }
    return Promise.reject(hata);
  });
}
