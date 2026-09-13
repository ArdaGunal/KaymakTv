import axios from 'axios';
// 🔴 `expo-secure-store` DEĞİL — web'de ham SecureStore FIRLATIR (2026-09-10,
// `kaymakSocial.ts`'in başlığındaki aynı ders). Token okuması `try` İÇİNDE.
import * as SecureStore from '../../utils/secureStorage';

import {
  ImportAdimSonucu,
  ImportAilesi,
  ImportHataBilgisi,
  hataTuruCoz,
} from './traktImportCekirdek';

/**
 * TRAKT İÇE AKTARIMI — Worker `/import/trakt`'ın istemci tarafı (Faz T · T5.4).
 *
 * ==========================================================================
 * 🔑 NEDEN ADIM ADIM, NEDEN İSTEMCİ YÜRÜTÜYOR
 * ==========================================================================
 * Kullanıcı kararı K2 (2026-09-11): **Trakt token'ı sunucuda SAKLANMAZ.**
 * Dolayısıyla "gece arka planda aktar" mümkün değil; aktarım uygulama AÇIKKEN,
 * her adımda token'ı taşıyarak ilerler. Kaldığı yer SUNUCUDA
 * (`user_import_state`) — uygulama kapanırsa kayıp yok, sonraki açılışta
 * aynı yerden devam eder.
 *
 * ⚠️ Bu dosya KARAR VERMEZ: hata sınıfı, bekleme, yüzde → `traktImportCekirdek.ts`
 * (saf, test edilebilir). Buradaki tek iş ağ.
 */

const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

export class ImportHatasi extends Error {
  constructor(public readonly bilgi: ImportHataBilgisi) {
    super(bilgi.mesaj);
  }
}

/**
 * Aktarımın TEK adımı: bir Trakt sayfası.
 *
 * 🔴 Yalnızca gerçek Trakt token'ıyla anlamlı. Google-only kullanıcıda Worker
 * `trakt_gerekli` döner (`lib/auth/session.js` önek koruması) — çağıranın
 * bunu kullanıcıya göstermesi gerekir, yutması DEĞİL.
 */
export async function traktImportAdimi(
  aile: ImportAilesi = 'gecmis',
  /** 🔄 Fark turu: bitmiş aileyi sunucuda sıfırlayıp TAM LİSTEYİ yeniden işler (§D15). */
  yenile = false,
  /** 🧹 K3 kapanış turu: fark penceresi + Trakt'tan SİLİNENLERİN süpürülmesi.
   *  ⚠️ `yenile` ile birlikte gönderilemez — sunucu 400 `celisen_istek` döner. */
  kapanis = false,
): Promise<ImportAdimSonucu> {
  if (!KAYMAK_WORKER_URL) {
    throw new ImportHatasi({ tur: 'genel', mesaj: 'Sunucu adresi tanımlı değil.' });
  }

  let token: string | null = null;
  try {
    token = await SecureStore.getItemAsync('traktAccessToken');
  } catch {
    token = null;
  }
  if (!token) {
    throw new ImportHatasi({ tur: 'yetki', mesaj: 'Aktarım için giriş yapmalısın.' });
  }

  let response;
  try {
    response = await axios.post(
      `${KAYMAK_WORKER_URL}/import/trakt`,
      { traktAccessToken: token, aile, ...(yenile ? { yenile: true } : {}), ...(kapanis ? { kapanis: true } : {}) },
      { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
    );
  } catch (error: any) {
    // Worker hata durumlarında da JSON gövde döner; axios 4xx/5xx'i exception'a
    // çeviriyor ama gövde `error.response.data`'da (bkz. profile.ts'teki desen).
    const status = error?.response?.status;
    const data = error?.response?.data;
    throw new ImportHatasi(hataTuruCoz(status, data ?? { message: error?.message }));
  }

  if (!response.data?.success) {
    throw new ImportHatasi(hataTuruCoz(response.status, response.data));
  }
  return response.data as ImportAdimSonucu;
}
