/**
 * Trakt API endpoint'leri için Circuit Breaker (devre kesici).
 *
 * Sorun: Bir endpoint (örn. `/sync/watched/shows`) art arda başarısız
 * olduğunda (429, 5xx, timeout), eski davranışta istemci bunu fark etmeden
 * her çağrıda yeniden denemeye devam ediyordu — hem kullanıcıyı gereksiz
 * yere bekletiyor hem de zaten zorlanan sunucuyu/rate-limit penceresini
 * daha da kötüleştiriyordu. Circuit breaker, "belli sayıda art arda hata
 * sonrası bir süre hiç deneme" prensibiyle bu kısır döngüyü kırar.
 *
 * State machine: CLOSED (normal) → OPEN (istekler anında reddedilir) →
 * HALF_OPEN (tek bir deneme izinlidir) → başarılıysa CLOSED, başarısızsa OPEN.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

const FAILURE_THRESHOLD = 5; // art arda 5 hata → devre açılır
const OPEN_DURATION_MS = 30 * 1000; // 30 saniye boyunca istekler reddedilir

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAt = 0;
  private halfOpenProbeInFlight = false;

  constructor(private readonly key: string) {}

  /** OPEN süresi dolduysa otomatik olarak HALF_OPEN'a geçirir (lazy — polling gerekmez). */
  private syncState(): CircuitState {
    if (this.state === 'OPEN' && Date.now() - this.openedAt >= OPEN_DURATION_MS) {
      this.state = 'HALF_OPEN';
      this.halfOpenProbeInFlight = false;
    }
    return this.state;
  }

  getState(): CircuitState {
    return this.syncState();
  }

  /**
   * Bu isteğin devam edip etmeyeceğine karar verir. HALF_OPEN durumunda
   * yalnızca TEK bir "yoklama" isteğine izin verilir — aksi halde HALF_OPEN
   * anında art arda gelen birden fazla istek devreyi tekrar kolayca açar ve
   * asla gerçek bir toparlanma şansı bulamaz.
   */
  canRequest(): boolean {
    const state = this.syncState();
    if (state === 'OPEN') return false;
    if (state === 'HALF_OPEN') {
      if (this.halfOpenProbeInFlight) return false;
      this.halfOpenProbeInFlight = true;
    }
    return true;
  }

  onSuccess(): void {
    this.consecutiveFailures = 0;
    this.halfOpenProbeInFlight = false;
    this.state = 'CLOSED';
  }

  onFailure(): void {
    this.consecutiveFailures++;
    this.halfOpenProbeInFlight = false;

    if (this.state === 'HALF_OPEN') {
      // Yoklama denemesi de başarısız oldu — toparlanma yok, hemen tekrar aç.
      this.trip();
      return;
    }
    if (this.consecutiveFailures >= FAILURE_THRESHOLD) {
      this.trip();
    }
  }

  private trip(): void {
    this.state = 'OPEN';
    this.openedAt = Date.now();
    console.warn(`[CircuitBreaker:${this.key}] Devre AÇILDI — ${OPEN_DURATION_MS / 1000}s boyunca istekler reddedilecek.`);
  }
}

// Endpoint başına ayrı bir breaker: `/sync/watched/shows` sürekli 429 alıyor
// diye `/shows/trending` gibi ilgisiz, sağlıklı bir endpoint de bloklanmasın.
const registry = new Map<string, CircuitBreaker>();

export const getCircuitBreaker = (key: string): CircuitBreaker => {
  let breaker = registry.get(key);
  if (!breaker) {
    breaker = new CircuitBreaker(key);
    registry.set(key, breaker);
  }
  return breaker;
};

/**
 * Bir istek URL'sini breaker anahtarına indirger: sorgu string'i atılır,
 * sayısal path segmentleri (dizi/film/sezon ID'leri) `:id` ile normalize
 * edilir. Aksi halde `/shows/123/progress/watched` ve `/shows/456/progress/watched`
 * ayrı breaker'lar sayılır ve tek bir dizinin ilerlemesi başarısız olduğunda
 * diğer TÜM dizilerin ilerleme isteği yanlışlıkla korunmuş olurdu — oysa asıl
 * amaç, aynı ENDPOINT TÜRÜNÜN sağlığını izlemektir.
 */
export const normalizeEndpointKey = (url: string): string => {
  const path = (url || '').split('?')[0];
  return path.replace(/\/\d+(?=\/|$)/g, '/:id');
};
