// ==========================================================================
// LAZYFETCH — Arka Plan Yenileme Kuyruğu (L5, dosya 1/1)
// ==========================================================================
// TEK İŞİ: SWR'nin arka plan yenilemelerini EŞZAMANLILIK SINIRLI tutmak.
//
// 🔴 ÇÖZDÜĞÜ SOMUT PROBLEM (03_FAZLAR.md L5): L2'deki
// `triggerBackgroundRevalidate` "ateşle-unut"tu. `singleFlight` yalnızca
// AYNI anahtarı tekilleştirir — FARKLI anahtarlar birbirini hiç görmez.
// Gece boyunca sessiz kalan bir Pi'de sabah trafiği geldiğinde 200 ayrı
// kayıt aynı anda "stale" olur ve 200 ayrı TMDB çağrısı AYNI ANDA başlar.
//
// Bunun zararı "TMDB kızar" değil — token bucket zaten 20/sn'de keser
// (tokenBucket.js). Asıl zarar şu: token bucket FOREGROUND ile ORTAK.
// Yani kullanıcının EKRAN BEKLEDİĞİ bir istek, arka planda kimsenin
// beklemediği 200 yenilemenin tükettiği kotaya takılıp `RateLimitedError`
// alır ve grace fallback'e düşer. Acil olmayan iş, acil olanın kotasını
// çalar. Kuyruk bunu yapısal olarak imkânsız kılar: arka plan HER ZAMAN
// en fazla `maxConcurrent` token tüketir, gerisi foreground'a kalır.
//
// 🔴 NEDEN KUYRUK SINIRLI VE DÜŞÜRÜLEBİLİR: arka plan yenilemesi TANIMI
// GEREĞİ atılabilir bir iştir — düşürülürse kullanıcı yine de bayat veriyi
// ANINDA alır (SWR sözleşmesi bozulmaz), yalnızca tazelenme bir sonraki
// isteğe kayar. Sınırsız bir kuyruk ise Pi'nin RAM'ini şişirir ve saatler
// önce anlamını yitirmiş yenilemeleri inatla yapmaya devam eder. Bu yüzden
// kuyruk dolduğunda YENİ gelen iş REDDEDİLİR (`dropped`) — kuyruktakiler
// atılmaz, çünkü onlar daha eski/daha çok beklemiş isteklerdir.
//
// ⚠️ SAYILAR BAŞLANGIÇ DEĞERİDİR (04_KARARLAR.md B: "gerçek sayılar
// telemetry ile ölçülmeden belirlenmez"). `maxConcurrent = 2` ölçüm değil,
// 03_FAZLAR.md'nin "en fazla 2-3 paralel" tarifi. L6 telemetrisi
// (`getStats()` bunun için var) gerçek `dropped`/`pending` sayılarını
// gösterdiğinde ayarlanacak.
//
// Bu dosya saf — ne HTTP, ne dosya sistemi, ne sağlayıcı bilir. Yalnızca
// "şu işi çalıştır ama aynı anda ikiden fazlasını çalıştırma" der.

const DEFAULT_MAX_CONCURRENT = 2;
const DEFAULT_MAX_QUEUED = 50;

class RefreshQueue {
  constructor({ maxConcurrent = DEFAULT_MAX_CONCURRENT, maxQueued = DEFAULT_MAX_QUEUED } = {}) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent <= 0) {
      throw new Error('[LazyFetch] RefreshQueue: "maxConcurrent" pozitif bir tam sayı olmalı.');
    }
    if (!Number.isInteger(maxQueued) || maxQueued <= 0) {
      throw new Error('[LazyFetch] RefreshQueue: "maxQueued" pozitif bir tam sayı olmalı.');
    }

    this.maxConcurrent = maxConcurrent;
    this.maxQueued = maxQueued;

    // Şu an ÇALIŞAN anahtarlar.
    this.active = new Set();
    // Sıra bekleyenler. Map, ekleme sırasını korur → FIFO; anahtar bazlı
    // olması da tekilleştirmeyi (aynı kayıt iki kez kuyruğa girmesin)
    // ayrı bir yapı gerektirmeden verir.
    this.pending = new Map();

    // L6 telemetrisi için sayaçlar — bu dosya bunları hiçbir yere
    // GÖNDERMEZ, yalnızca sayar (tek iş kuralı).
    this.stats = { started: 0, completed: 0, failed: 0, dropped: 0, duplicate: 0 };
  }

  /**
   * Bir yenileme işini kuyruğa alır.
   *
   * @param {string} key   Cache anahtarı (`relativePath`) — tekilleştirme kimliği
   * @param {() => Promise<any>} task  Çalıştırılacak iş. Hatası kuyruk
   *   tarafından YUTULUR (sayaca işlenir) — arka plan işi olduğu için
   *   yukarıya iletilecek bir çağıran yok; unhandled rejection üretmemek
   *   yapısal bir gereklilik.
   * @returns {'started'|'queued'|'duplicate'|'dropped'} Test ve telemetri için.
   */
  enqueue(key, task) {
    if (typeof key !== 'string' || !key) {
      throw new Error('[LazyFetch] RefreshQueue.enqueue: "key" boş olmayan bir dize olmalı.');
    }
    if (typeof task !== 'function') {
      throw new Error('[LazyFetch] RefreshQueue.enqueue: "task" bir fonksiyon olmalı.');
    }

    // Zaten çalışıyor ya da zaten sırada → ikinci kez alma. (`singleFlight`
    // aynı korumayı sağlayıcı çağrısı seviyesinde yapıyor; burada amaç
    // kuyruk SLOTUNU boşa harcamamak — aksi halde tek bir sıcak anahtar
    // 50 slotu da doldurabilirdi.)
    if (this.active.has(key) || this.pending.has(key)) {
      this.stats.duplicate += 1;
      return 'duplicate';
    }

    if (this.active.size < this.maxConcurrent) {
      this._run(key, task);
      return 'started';
    }

    if (this.pending.size >= this.maxQueued) {
      // Kuyruk dolu — YENİ iş düşer, sıradakiler korunur (dosya başlığı).
      this.stats.dropped += 1;
      return 'dropped';
    }

    this.pending.set(key, task);
    return 'queued';
  }

  /** Bir slot boşaldığında sıradan bir sonraki işi başlatır. */
  // Alt çizgi konvansiyonu, `#` private DEĞİL — bilinçli: `#` private
  // metotlar Node 14.6+ ister ve bu dosya onları sunucu koduna SOKAN ilk
  // dosya olurdu. Eski bir Node'da hata, LazyFetch'in "sessizce devre dışı
  // kal" tasarımını (paths.js) baypas edip sunucuyu AÇILIŞTA çökertirdi —
  // yani cache'in bir lüks olması gerekirken tüm siteyi düşürürdü.
  // `memoryCache.js` de aynı şekilde düz metot kullanıyor (tutarlılık).
  _pump() {
    while (this.active.size < this.maxConcurrent && this.pending.size > 0) {
      const [key, task] = this.pending.entries().next().value;
      this.pending.delete(key);
      this._run(key, task);
    }
  }

  _run(key, task) {
    this.active.add(key);
    this.stats.started += 1;

    // `Promise.resolve().then(task)` — `task()` SENKRON bir hata atarsa da
    // (ör. bozuk bir fetcher) kuyruğun `finally`'si çalışsın; doğrudan
    // `task()` çağırsaydık senkron throw slotu sonsuza kilitlerdi.
    Promise.resolve()
      .then(task)
      .then(
        () => {
          this.stats.completed += 1;
        },
        () => {
          // Hata İÇERİK olarak burada ele alınmaz — loglama ve
          // `lastErrorAt` damgası çağıranın (orchestrator) işi, çünkü
          // "bu hata ne anlama geliyor" bilgisi orada.
          this.stats.failed += 1;
        }
      )
      .finally(() => {
        this.active.delete(key);
        // `finally` bir mikro-görevde çalışır → `_pump` özyinelemesi
        // senkron yığını büyütmez.
        this._pump();
      });
  }

  /** L6 telemetrisi + testler için anlık görüntü. */
  getStats() {
    return { ...this.stats, active: this.active.size, pending: this.pending.size };
  }

  /** Yalnızca test izolasyonu için — normal akışta çağrılmaz. */
  reset() {
    this.pending.clear();
    this.stats = { started: 0, completed: 0, failed: 0, dropped: 0, duplicate: 0 };
  }
}

/**
 * Factory — orchestrator.js modül seviyesinde BİR kez çağırır (memoryCache
 * ile aynı singleton deseni: Node'un require cache'i tekilliği garanti eder).
 */
function createRefreshQueue(options) {
  return new RefreshQueue(options);
}

module.exports = {
  RefreshQueue,
  createRefreshQueue,
  DEFAULT_MAX_CONCURRENT,
  DEFAULT_MAX_QUEUED,
};
