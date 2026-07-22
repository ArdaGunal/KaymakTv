/**
 * Trakt API'nin 429 (Too Many Requests) ve geçici ağ hatalarında kullanılan
 * üstel geri çekilme (exponential backoff) hesaplayıcısı.
 *
 * Öncesinde `traktClient.ts` 429'da SABİT 2.5s bekleyip tekrar deniyordu —
 * API art arda 429 döndürmeye devam ederse (örn. arka plan senkronu ile
 * kullanıcı etkileşimi çakıştığında) istemci de art arda sabit aralıklarla
 * aynı hızda vurmaya devam ediyor, sunucuyu asla rahatlatmıyordu.
 */

const BASE_DELAY_MS = 2000; // ilk retry: 2s
const MAX_DELAY_MS = 5 * 60 * 1000; // üst sınır: 5 dakika
const JITTER_RATIO = 0.2; // %0-20 rastgele ek — çok sayıda istek aynı anda
// 429 alıp aynı gecikmeyle aynı anda tekrar denerse (thundering herd), hepsi
// yine aynı anda çarpışır. Jitter bu senkronizasyonu bozar.

/** `Retry-After` header'ını (saniye ya da HTTP-date biçiminde olabilir) ms'e çevirir. */
const parseRetryAfterHeader = (header: string): number | null => {
  const seconds = Number(header);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return null;
};

/**
 * `attempt` 0-tabanlıdır (ilk retry için 0 verilir → 2s, ikinci için 1 → 4s, ...).
 * `retryAfterHeader` verilmişse (sunucu açıkça ne kadar bekleneceğini söylemişse)
 * üstel hesaplamanın ÖNÜNE geçer — sunucunun kendi tahmini bizimkinden isabetlidir.
 */
export const calculateBackoffDelay = (
  attempt: number,
  retryAfterHeader?: string | null
): number => {
  if (retryAfterHeader) {
    const fromHeader = parseRetryAfterHeader(retryAfterHeader);
    if (fromHeader !== null) {
      return fromHeader;
    }
  }

  const exponential = Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attempt), MAX_DELAY_MS);
  const jitter = exponential * JITTER_RATIO * Math.random();
  return Math.round(exponential + jitter);
};

export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
