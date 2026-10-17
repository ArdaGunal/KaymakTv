import axios from 'axios';
import * as SecureStore from '../../utils/secureStorage';
import { isKaymakSessionToken } from './traktClient';
import { hesapGecersizBildir } from '../auth/oturumDenetimi';

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

/** SAF — bu yanıt «hesabın oturum belgesi artık geçersiz» mi? */
export function hesapGecersizYanitiMi(url: string | undefined, status: number | undefined, kod: unknown, oturum: string | null): boolean {
  return !!KAYMAK_WORKER_URL && !!url && url.startsWith(KAYMAK_WORKER_URL)
    && status === 401 && kod === 'invalid_token' && isKaymakSessionToken(oturum);
}

export function workerYanitKoruyucusunuKur(): void {
  if (kuruldu) return;
  kuruldu = true;
  axios.interceptors.response.use(undefined, async (hata) => {
    try {
      const r = hata?.response;
      if (r?.status === 401) {
        const oturum = await SecureStore.getItemAsync('traktAccessToken');
        if (hesapGecersizYanitiMi(hata?.config?.url, r.status, r.data?.code, oturum)) hesapGecersizBildir();
      }
    } catch {
      // Koruyucu asla isteğin kendi hatasını değiştirmez.
    }
    return Promise.reject(hata);
  });
}
