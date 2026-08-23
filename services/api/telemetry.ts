/**
 * Uzaktan hata telemetrisi — "kara kutu".
 *
 * NEDEN VAR: `utils/errorLog.ts` hataları YALNIZCA cihaza yazıyordu
 * (AsyncStorage, 50 kayıtlık ring buffer). Yani bir kullanıcının telefonunda
 * bir şey çöktüğünde geliştiricinin haberi olmuyordu — öğrenmenin tek yolu
 * kişiyi Geliştirici Paneli'ne yönlendirip ekran görüntüsü istemekti. Soft
 * launch'ın amacı "gerçek kullanımda ne kırılıyor" öğrenmekse, bu boşluk
 * lansmanı kör uçuşa çeviriyordu.
 *
 * YENİ ALTYAPI YOK: geri bildirim sisteminin ZATEN kullandığı Worker +
 * Discord webhook'u yeniden kullanılıyor (`notifyReportToDiscord` ile aynı
 * desen).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 🔴 SPAM KORUMASI NEDEN İSTEMCİDE (Y25 dersi)
 * ═══════════════════════════════════════════════════════════════════════
 * Worker'ın `isRateLimited`'ı isolate-içi bellekte çalışır ve Cloudflare
 * aynı Worker'ı birden çok isolate'te koşturduğu için **dağıtık olarak
 * güvenilmez** (Y25, canlıda kanıtlandı: 15 art arda istek, hiçbiri 429
 * dönmedi). Bu yüzden gerçek koruma BURADA, istemcide:
 *
 *   1. yalnızca `level: 'error'` gönderilir ('warn' hiç gitmez)
 *   2. parmak izi (context+message) başına 24 saatte BİR kez
 *   3. oturum başına en fazla `SESSION_CAP`
 *   4. gün başına en fazla `DAILY_CAP` (diske yazılır, uygulama kapansa da sayar)
 *   5. `SAMPLE_RATE` — büyüme için ayrılmış kadran
 *
 * Worker'ın kendi rate limit'i İKİNCİ hat olarak duruyor; tek başına
 * güvenilmediği için ona bel bağlanmıyor.
 */

// ⚠️ ÇIPLAK `axios` — `services/api/traktClient.ts`'in instance'ı DEĞİL.
// Kritik: o instance'ın response interceptor'ı hata durumunda `logError`
// çağırıyor; telemetri onu kullansaydı logError → telemetri → interceptor →
// logError şeklinde SONSUZ DÖNGÜ olurdu.
// Doğrulandı (2026-08-23): projede `axios.interceptors` ile kayıtlı GLOBAL
// interceptor YOK, yalnızca instance bazlı olanlar var.
// 🔴 Biri global bir axios interceptor eklerse bu güvence sessizce bozulur —
// o gün burası tekrar gözden geçirilmeli.
import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

/** Oturum başına üst sınır. Bir çökme döngüsü bile bu sayıyı aşamaz. */
const SESSION_CAP = 5;
/** Gün başına üst sınır (diske yazılır). */
const DAILY_CAP = 20;
/** Aynı parmak izi bu süre içinde tekrar gönderilmez. */
const FINGERPRINT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Örnekleme kadranı. **Şu an 1.0 — yani fiilen devre dışı, bilinçli.**
 * Gerekçe: soft launch'ta kullanıcı sayısı tek haneli; nadir bir çökmeyi
 * kaçırmak, birkaç fazla Discord mesajından çok daha pahalı. Asıl spam
 * korumasını yukarıdaki dedupe + tavanlar yapıyor.
 * Kullanıcı sayısı büyüdüğünde düşürülecek KADRAN burasıdır (ör. 0.25).
 */
const SAMPLE_RATE = 1.0;

const INSTALL_ID_KEY = '@kaymak_install_id_v1';
const QUOTA_KEY = '@kaymak_telemetry_quota_v1';
const SEEN_KEY = '@kaymak_telemetry_seen_v1';

let sessionCount = 0;

/** Rastgele, KİMLİĞE BAĞLI OLMAYAN kurulum kimliği.
 *
 * ⚠️ Kullanıcı adı / Trakt slug / e-posta BİLİNÇLİ OLARAK gönderilmiyor.
 * Amaç "hangi kullanıcı" değil, "aynı cihaz mı" sorusunu cevaplamak: aynı
 * kurulumdan gelen 5 farklı hata ile 5 kullanıcıdan gelen 1'er hatayı
 * ayırt edebilmek için. Uygulama silinince kimlik de gider. */
const getInstallId = async (): Promise<string> => {
  try {
    const mevcut = await AsyncStorage.getItem(INSTALL_ID_KEY);
    if (mevcut) return mevcut;
    const yeni = `ins_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    await AsyncStorage.setItem(INSTALL_ID_KEY, yeni);
    return yeni;
  } catch {
    return 'ins_unknown';
  }
};

const bugununAnahtari = (): string => new Date().toISOString().slice(0, 10);

/** Günlük kotayı okur/artırır. Gün değiştiyse sayaç sıfırlanır. */
const gunlukKotaAsildiMi = async (): Promise<boolean> => {
  try {
    const raw = await AsyncStorage.getItem(QUOTA_KEY);
    const bugun = bugununAnahtari();
    const state: { day: string; count: number } = raw ? JSON.parse(raw) : { day: bugun, count: 0 };
    if (state.day !== bugun) {
      await AsyncStorage.setItem(QUOTA_KEY, JSON.stringify({ day: bugun, count: 1 }));
      return false;
    }
    if (state.count >= DAILY_CAP) return true;
    await AsyncStorage.setItem(QUOTA_KEY, JSON.stringify({ day: bugun, count: state.count + 1 }));
    return false;
  } catch {
    // Kota okunamadıysa GÖNDERME (güvenli taraf) — "okuyamadım o yüzden
    // sınırsız gönder" yanlış taraf olurdu.
    return true;
  }
};

/** Aynı hata 24 saat içinde tekrar gönderilmesin. Asıl spam korumasını bu
 *  yapıyor: bir çökme döngüsü aynı parmak izini üretir, ilki dışında hepsi
 *  burada durur. */
const dahaOnceGonderildiMi = async (fingerprint: string): Promise<boolean> => {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    const seen: Record<string, number> = raw ? JSON.parse(raw) : {};
    const simdi = Date.now();
    // Süresi geçenleri temizle — sözlük sınırsız büyümesin.
    const temiz: Record<string, number> = {};
    for (const [k, v] of Object.entries(seen)) {
      if (simdi - v < FINGERPRINT_TTL_MS) temiz[k] = v;
    }
    if (temiz[fingerprint]) {
      await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(temiz));
      return true;
    }
    temiz[fingerprint] = simdi;
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(temiz));
    return false;
  } catch {
    return true; // güvenli taraf
  }
};

/** Basit, çakışması önemsiz bir parmak izi (kriptografik değil). */
const parmakIzi = (context: string, message: string): string => {
  const s = `${context}|${message}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return `${context.slice(0, 40)}#${Math.abs(h).toString(36)}`;
};

export interface TelemetryInput {
  context: string;
  message: string;
  stack?: string;
  tags?: Record<string, string>;
}

/**
 * Hatayı merkeze bildirir. **Ateşle-unut** — hiçbir koşulda çağıranı
 * bloklamaz, hiçbir koşulda throw etmez. Telemetri bir teşhis aracıdır;
 * kendisi ana akışı bozarsa amacının tam tersine hizmet eder.
 */
export const reportErrorRemotely = async (input: TelemetryInput): Promise<void> => {
  try {
    if (!WORKER_URL) return;
    if (sessionCount >= SESSION_CAP) return;
    if (SAMPLE_RATE < 1 && Math.random() > SAMPLE_RATE) return;

    const fp = parmakIzi(input.context, input.message);
    if (await dahaOnceGonderildiMi(fp)) return;
    if (await gunlukKotaAsildiMi()) return;

    sessionCount += 1;

    const installId = await getInstallId();
    const payload = {
      installId,
      context: input.context.slice(0, 120),
      message: input.message.slice(0, 500),
      // Stack YALNIZCA ilk satırlar — hem Discord alan sınırı hem de gereksiz
      // veri taşımamak için.
      stack: input.stack ? input.stack.split('\n').slice(0, 6).join('\n').slice(0, 900) : undefined,
      tags: input.tags,
      platform: `${Platform.OS} ${Platform.Version}`,
      appVersion: String(Constants.expoConfig?.version ?? '?'),
      fingerprint: fp,
    };

    await axios.post(`${WORKER_URL}/telemetry/error`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 8000,
    });
  } catch {
    // Telemetri gönderimi başarısız olursa SESSİZCE yutulur. Burada
    // `logError` çağırmak ÖLÜMCÜL olurdu: logError → reportErrorRemotely →
    // hata → logError → ... sonsuz özyineleme.
  }
};
