/**
 * Trakt API isteklerini önceliğe göre sıralayan ve eşzamanlı çalışan istek
 * sayısını sınırlayan kuyruk yöneticisi.
 *
 * Sorun: `fetchFreshData` içindeki arka plan senkronizasyon aşamaları
 * (kritik ana ekran verisi, filmler sekmesi, geçmiş/puanlar/listeler) hepsi
 * kendi başına `Promise.all`/`setTimeout` ile ateşleniyordu. İki farklı
 * tetikleyici (örn. kullanıcı bir bölümü işaretleyip mutation sonrası
 * `fetchFreshData(null, true)` çağırırken, aynı anda uygulama arka plandan
 * öne gelip kendi senkronunu da başlatırsa) üst üste bindiğinde, düşük
 * öncelikli (geçmiş/puanlar gibi) istekler kritik (ana ekran) isteklerle
 * aynı anda yarışıyor, ikisi de yavaşlıyordu.
 *
 * Bu kuyruk, görevleri önceliğe göre çalıştırır (CRITICAL önce), aynı anda en
 * fazla `CONCURRENCY` görev çalıştırır (tarayıcı/mobil ağın bağlantı limitini
 * zorlamamak için — bkz. fetchers.ts'teki "6 connection limiti" yorumu) ve
 * kuyrukta aşırı uzun süredir bekleyen görevleri (deadline) sessizce eler.
 */

export type RequestPriority = 'CRITICAL' | 'NORMAL' | 'LOW';

const PRIORITY_RANK: Record<RequestPriority, number> = {
  CRITICAL: 0,
  NORMAL: 1,
  LOW: 2,
};

const MAX_QUEUE_SIZE = 50;
const DEFAULT_DEADLINE_MS = 5 * 60 * 1000; // 5 dakika sonra hâlâ sırada bekleyen görev atlanır
const CONCURRENCY = 3;

interface QueuedTask<T> {
  priority: RequestPriority;
  enqueuedAt: number;
  deadlineMs: number;
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

class RequestQueue {
  private pending: QueuedTask<any>[] = [];
  private activeCount = 0;

  enqueue<T>(
    run: () => Promise<T>,
    priority: RequestPriority = 'NORMAL',
    deadlineMs: number = DEFAULT_DEADLINE_MS
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (this.pending.length >= MAX_QUEUE_SIZE) {
        // ESKİ DAVRANIŞ: kuyrukta EN DÜŞÜK öncelikli görevi bulup, gelen
        // görevin kendi önceliğine BAKMADAN feda ediyordu — kuyruk 50 CRITICAL
        // görevle doluyken yeni bir LOW öncelikli istek gelirse, o CRITICAL
        // görevlerden biri feda edilip yerine LOW öncelikli istek konuyordu.
        // Doğrusu tam tersi: kuyruk zaten gelen görevle eşit/daha yüksek
        // öncelikli işle doluysa, feda edilmesi gereken mevcut iş değil,
        // gelenin KENDİSİdir.
        const evicted = this.evictIfLowerPriorityThan(PRIORITY_RANK[priority]);
        if (!evicted) {
          reject(new Error(`RequestQueue: kuyruk dolu, bu istek (öncelik: ${priority}) kabul edilmedi.`));
          return;
        }
      }

      this.pending.push({ priority, enqueuedAt: Date.now(), deadlineMs, run, resolve, reject });
      // Kararlı sıralama: aynı öncelikteki görevler geliş sırasını korur (FIFO),
      // farklı öncelikte olanlar arasında yüksek öncelik (düşük rank) öne geçer.
      this.pending.sort(
        (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.enqueuedAt - b.enqueuedAt
      );
      this.drain();
    });
  }

  /**
   * Kuyruk (50) dolduğunda, gelen görevden DAHA DÜŞÜK öncelikli bir görev
   * varsa onu feda edip yer açar ve `true` döner. Kuyruktaki en kötü görev
   * bile gelenle EŞİT ya da ondan DAHA YÜKSEK öncelikliyse hiçbir şeye
   * dokunmadan `false` döner — bu durumda çağıran (`enqueue`), zaten
   * kuyrukta duran işi korumak için gelen görevin kendisini reddetmelidir.
   */
  private evictIfLowerPriorityThan(incomingRank: number): boolean {
    let worstIndex = -1;
    let worstRank = -1;
    this.pending.forEach((task, index) => {
      const rank = PRIORITY_RANK[task.priority];
      if (rank > worstRank) {
        worstRank = rank;
        worstIndex = index;
      }
    });
    if (worstIndex >= 0 && worstRank > incomingRank) {
      const [evicted] = this.pending.splice(worstIndex, 1);
      evicted.reject(new Error('RequestQueue: kuyruk dolu, düşük öncelikli istek iptal edildi.'));
      return true;
    }
    return false;
  }

  private drain(): void {
    while (this.activeCount < CONCURRENCY) {
      const next = this.dequeueNext();
      if (!next) return;
      this.runTask(next);
    }
  }

  /** Sıradaki görevi döndürür; deadline'ı geçmiş görevleri atlayıp reddeder. */
  private dequeueNext(): QueuedTask<any> | undefined {
    while (this.pending.length > 0) {
      const task = this.pending.shift()!;
      if (Date.now() - task.enqueuedAt > task.deadlineMs) {
        task.reject(new Error('RequestQueue: istek son teslim süresini (deadline) aştı.'));
        continue;
      }
      return task;
    }
    return undefined;
  }

  private async runTask(task: QueuedTask<any>): Promise<void> {
    this.activeCount++;
    try {
      task.resolve(await task.run());
    } catch (error) {
      task.reject(error);
    } finally {
      this.activeCount--;
      this.drain();
    }
  }

  /** Tanılama/gözlemlenebilirlik için — UI'da "X istek beklemede" göstermek gibi ileri kullanımlara açık. */
  getPendingCount(): number {
    return this.pending.length;
  }
}

export const requestQueue = new RequestQueue();
