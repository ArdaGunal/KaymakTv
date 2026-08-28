// ==========================================================================
// LAZYFETCH — Bellek İçi Sıcak Katman (L1, dosya 5/5)
// ==========================================================================
// TEK İŞİ: en çok istenen anahtarlar için SSD'ye bile inmemek. `readCacheEntry`
// her seferinde dosya açma + gzip açma + JSON.parse yapıyor — Pi'nin CPU'su
// için ucuz ama sıfır değil (bkz. 01_MIMARI.md "RAM cache" bölümü). Zaten
// parse edilmiş bir nesneyi bellekte tutmak bu maliyeti tamamen atlıyor.
//
// 🔴 SINIRSIZ BÜYÜMEZ (01_MIMARI.md "RAM cache sonsuza büyümemeli"): LRU
// (least-recently-used) — limit aşılınca en uzun süredir dokunulmayan
// girdi atılır. Aynı algoritma istemci tarafında zaten var
// (`services/tmdbApi.ts` `LRUCache`, satır 16-47) — burada BİLİNÇLİ olarak
// aynı desen tekrarlanıyor, tutarlılık için.
//
// Bu katman TTL/bayatlık KARARI VERMEZ — o iş envelope.js'in. Bellek yalnızca
// "bu zarfı en son ben okumuştum, diski atla" der; taze/bayat/expired
// değerlendirmesi çağıran taraf tarafından `getEnvelopeState()` ile HER
// OKUMADA yeniden yapılır (bellekte durmuş bayat bir zarfı yanlışlıkla
// "taze" sanmak diye bir risk yok).

const DEFAULT_MAX_ENTRIES = 200;

class LazyFetchMemoryCache {
  /** @param {number} maxEntries İstemcideki LRUCache(150) ile aynı ölçekte — sayı uydurulmadı, aynı kanıtlanmış değer aralığı kullanıldı. */
  constructor(maxEntries = DEFAULT_MAX_ENTRIES) {
    if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
      throw new Error('[LazyFetch] LazyFetchMemoryCache: "maxEntries" pozitif bir tam sayı olmalı.');
    }
    this.maxEntries = maxEntries;
    // Map, ekleme SIRASINI korur — bir anahtar her `set` edildiğinde
    // (yeniden erişildiğinde) silinip sona eklenir, böylece Map'in BAŞI
    // her zaman "en uzun süredir dokunulmamış" (LRU adayı) olur.
    this.store = new Map();
  }

  get(key) {
    if (!this.store.has(key)) return undefined;
    const value = this.store.get(key);
    // Erişim = "yeniden taze" sayılır: sil + sona ekle (LRU sırasını güncelle).
    this.store.delete(key);
    this.store.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, value);
    if (this.store.size > this.maxEntries) {
      // Map iterasyon sırası = ekleme sırası → ilk anahtar = en eski (LRU).
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
  }

  /** Bir kayıt diskte bozuk çıkıp karantinaya alındığında bellekten de düşürülmeli — tutarlılık için. */
  delete(key) {
    this.store.delete(key);
  }

  has(key) {
    return this.store.has(key);
  }

  get size() {
    return this.store.size;
  }

  /** Yalnızca test/teşhis amaçlı — L2 orkestratörü bunu normal akışta çağırmaz. */
  clear() {
    this.store.clear();
  }
}

/**
 * Factory — orchestrator.js (L2) bunu MODÜL SEVİYESİNDE bir kez çağırıp
 * tek bir paylaşılan instance'ı tüm isteklerde kullanacak (Node'un require
 * cache'i bunu doğal bir singleton yapar). Sınıfın kendisi de export
 * ediliyor — testlerin izole, temiz instance'lar kurabilmesi için.
 */
function createMemoryCache(maxEntries) {
  return new LazyFetchMemoryCache(maxEntries);
}

module.exports = {
  LazyFetchMemoryCache,
  createMemoryCache,
  DEFAULT_MAX_ENTRIES,
};
