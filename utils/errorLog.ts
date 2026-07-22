import AsyncStorage from '@react-native-async-storage/async-storage';

const ERROR_LOG_KEY = '@kaymak_error_log_v1';
const MAX_ENTRIES = 50;

export interface LoggedError {
  timestamp: number;
  context: string;
  message: string;
  stack?: string;
  /** Faz 7 — opsiyonel yapısal etiketler (örn. `{endpoint: '/sync/history'}`).
   * Geriye dönük uyumluluk için opsiyonel: mevcut ~15 çağrı noktası bu
   * parametreyi hiç geçmeden `logError(context, error)` şeklinde çalışmaya
   * devam eder — `context` string'i (örn. 'mutations.progress.X') zaten
   * "hangi mutation" bilgisini taşıyor, `tags` yalnızca ek yapısal bilgi
   * (endpoint gibi) gerektiğinde kullanılır. */
  tags?: Record<string, string>;
}

const serializeError = (error: unknown): { message: string; stack?: string } => {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
};

// Yazma işlemleri SIRALI bir kuyruğa alınır: `logError` ard arda hızlı
// çağrılırsa (örn. ağ kopması sırasında art arda başarısız olan istekler),
// her çağrı kendi read-modify-write'ını paralel yapıp birbirinin üstüne
// yazarak önceki entry'leri kaybetmesin diye.
let writeQueue: Promise<void> = Promise.resolve();

/**
 * Kalıcı, sabit boyutlu (ring buffer, en fazla 50 kayıt) hata günlüğü.
 * Uygulama genelindeki "console.error ile yut" noktalarına eklenir —
 * kullanıcının cihazından geliştirici console log'una asla erişilemeyeceği
 * gerçek koşullarda ("izledim butonuna bastım, bir şey olmadı" tarzı
 * şikayetlerde), sonradan `getErrorLog()` ile son hataları geri getirebilmek
 * için. Yazma işlemi fire-and-forget'tir — ana akışı asla bloklamaz/bozmaz.
 */
export const logError = (context: string, error: unknown, tags?: Record<string, string>): void => {
  const { message, stack } = serializeError(error);
  const entry: LoggedError = { timestamp: Date.now(), context, message, stack, ...(tags ? { tags } : {}) };

  writeQueue = writeQueue.then(async () => {
    try {
      const raw = await AsyncStorage.getItem(ERROR_LOG_KEY);
      const existing: LoggedError[] = raw ? JSON.parse(raw) : [];
      const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
      await AsyncStorage.setItem(ERROR_LOG_KEY, JSON.stringify(updated));
    } catch {
      // Hata günlüğünün kendisi başarısız olursa sessizce yutulur — bu bir
      // teşhis aracıdır, ana akışı asla etkilememeli.
    }
  });
};

/** En yeniden eskiye, son kaydedilen hatalar (örn. Ayarlar > "Hata Günlüğü" gibi
 * bir tanılama ekranında veya destek talebine eklenecek bir dışa aktarımda). */
export const getErrorLog = async (): Promise<LoggedError[]> => {
  try {
    const raw = await AsyncStorage.getItem(ERROR_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const clearErrorLog = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(ERROR_LOG_KEY);
  } catch {
    // yoksay
  }
};
