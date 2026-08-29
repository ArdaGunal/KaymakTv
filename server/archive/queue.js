// ==========================================================================
// KATALOG ARŞİVİ — Yazım Kuyruğu (A2, kanca tarafı)
// ==========================================================================
// TEK İŞİ: LazyFetch'in sıcak yolundan gelen "şu yanıtı arşivle" isteğini
// ALIP HEMEN DÖNMEK, işi arka planda sırayla yaptırmak.
//
// 🔴 SÖZLEŞME: `enqueue()` SENKRONDUR, HİÇBİR ŞEY BEKLEMEZ ve ASLA THROW
// ETMEZ. Kullanıcının isteği arşivin rehinesi olamaz (03_FAZLAR.md A2:
// "arşiv yazımı başarısız olursa istek BAŞARISIZ OLMAZ, sadece loglanır").
//
// ==========================================================================
// 🔴🔴 EŞZAMANLILIK 1 — TARTIŞMAYA AÇIK DEĞİL
// ==========================================================================
// `refreshQueue.js` (L5) 2 paralel çalışır; burada 1 ZORUNLU. Sebep:
// arşiv TEK bir SQLite bağlantısı kullanıyor ve yazıcı, olay döngüsüne
// nefes vermek için transaction ORTASINDA `await` ediyor (`writer.js`
// `nefesAl`). İki yazım iç içe geçerse aynı bağlantıda iki `BEGIN`
// denenir → veri bozulur.
//
// `db.js` `transactionAsync()` bunu ayrıca YAPISAL olarak da engelliyor
// (dış çağrıları sıraya sokuyor). İki katman bilinçli: kuyruk niyeti
// söyler, `transactionAsync` garantiyi verir. Biri unutulursa diğeri tutar.
//
// ==========================================================================
// 🔴 TEKİLLEŞTİRME: aynı anahtar kuyruktaysa ÜZERİNE YAZILIR
// ==========================================================================
// Aynı diziye 10 istek gelirse 10 kez arşivlemenin anlamı yok — sonuncusu
// en tazesi. Bekleyen iş, yeni veriyle GÜNCELLENİR; kuyruktaki sırası
// korunur (açlık olmasın).

const { logSync } = require('./store');
const { isArchiveEnabled } = require('./db');
const { archiveCatalogResponse } = require('./writer');

// Kuyruk tavanı. Aşılırsa EN ESKİ iş düşürülür — en yeni veri daha
// değerlidir ve arşiv zaten "kaçırdığını A3 backfill ile tamamlayacak"
// tasarımında. Sayı ölçülmedi; ölçülene kadar makul bir başlangıç
// (04_KARARLAR.md B). Tavana dayanmak zaten patolojik bir durumdur:
// yazım Pi'de en kötü 5,6 sn sürüyor, yani 200 iş ≈ 18 dakikalık birikim.
const MAX_KUYRUK = 200;

function createArchiveQueue({ maxQueue = MAX_KUYRUK, worker = archiveCatalogResponse } = {}) {
  const bekleyenler = new Map(); // anahtar -> is
  const sira = [];               // anahtar sirasi (FIFO)
  let calisiyor = false;

  const istatistik = { alinan: 0, yazilan: 0, atlanan: 0, hata: 0, dusurulen: 0, tekillesen: 0 };

  function anahtarUret({ provider, family, path, query }) {
    // Dil anahtarın parçası: `tr` ve `en` AYRI kayıtlar (payloads PK'si).
    const dil = (query && (query.translations || query.language || query.lang)) || '-';
    return `${provider}/${family}${path}?${String(dil).slice(0, 2)}`;
  }

  async function calistir() {
    if (calisiyor) return;
    calisiyor = true;
    try {
      while (sira.length) {
        const anahtar = sira.shift();
        const is = bekleyenler.get(anahtar);
        bekleyenler.delete(anahtar);
        if (!is) continue;

        try {
          const sonuc = await worker(is);
          if (sonuc && sonuc.ok) istatistik.yazilan += 1;
          else {
            istatistik.atlanan += 1;
            // "Kapsam dışı aile" gürültü değil, normal akış — loglanmaz.
            // Gerçek bir başarısızlık (bozuk veri, disk) ise iz bırakır.
            if (sonuc && sonuc.reason && !['kapsam_disi_aile', 'desteklenmeyen_saglayici', 'bos_yanit'].includes(sonuc.reason)) {
              logSync({ event: 'error', provider: is.provider, endpoint: is.family, detail: `kuyruk: ${sonuc.reason}` });
            }
          }
        } catch (error) {
          // 🔴 Buraya düşmek bir HATA DEĞİL, bir GÜVENCE: kuyruk hiçbir
          // koşulda çökmemeli, yoksa sonraki tüm arşiv yazımları ölür.
          istatistik.hata += 1;
          logSync({ event: 'error', provider: is.provider, endpoint: is.family, detail: `kuyruk cokmesi: ${error.message}` });
        }
      }
    } finally {
      calisiyor = false;
    }
  }

  return {
    /**
     * İşi kuyruğa koyar ve HEMEN döner.
     *
     * @returns {boolean} kuyruğa alındı mı (teşhis için; çağıran umursamaz)
     */
    enqueue(is) {
      try {
        if (!isArchiveEnabled()) return false;
        if (!is || !is.provider || !is.family) return false;

        istatistik.alinan += 1;
        const anahtar = anahtarUret(is);

        if (bekleyenler.has(anahtar)) {
          // Sıradaki yerini KORU, yalnızca veriyi tazele.
          bekleyenler.set(anahtar, is);
          istatistik.tekillesen += 1;
        } else {
          if (sira.length >= maxQueue) {
            const dusen = sira.shift();
            bekleyenler.delete(dusen);
            istatistik.dusurulen += 1;
          }
          bekleyenler.set(anahtar, is);
          sira.push(anahtar);
        }

        // 🔴 `setImmediate` — İŞİ BİR SONRAKİ TICK'E ERTELER. Doğrudan
        // `calistir()` çağırsaydık, işleyicinin ilk `await`'ine kadarki
        // KISIM SENKRON ÇALIŞIRDI: yani `enqueue` çağıran sıcak yol, o
        // işin bir parçasını üstlenmiş olurdu. Bugünkü yazıcıda o kısım
        // boş (`transactionAsync` hemen await ediyor) ama buna güvenmek,
        // "istek arşivin rehinesi olamaz" garantisini yazıcının İÇ
        // YAPISINA bağlamak demekti. Burada yapısal hale getiriyoruz.
        // (Testte yakalandı: "is henuz calismadi" iddiası kırmızı yandı.)
        //
        // `.catch` ayrıca var: `calistir` kendi hatalarını yutuyor ama bir
        // gün oradan bir hata sızarsa `unhandledRejection` ile sunucuyu
        // düşürmesin.
        setImmediate(() => { calistir().catch(() => {}); });
        return true;
      } catch (_) {
        // enqueue ASLA throw etmez — sıcak yoldan çağrılıyor.
        return false;
      }
    },

    /** Teşhis/telemetri — denetçi ve L6 telemetrisi buradan okuyacak. */
    getStats() {
      return { ...istatistik, bekleyen: sira.length, calisiyor };
    },

    /** Yalnızca test için: kuyruk boşalana kadar bekle. */
    async drain() {
      while (calisiyor || sira.length) {
        await new Promise((r) => setImmediate(r));
      }
    },
  };
}

// Modül seviyesinde TEK paylaşılan kuyruk — `orchestrator.js`'in
// `memoryCache`/`refreshQueue` singleton deseniyle aynı. İki kuyruk olsaydı
// eşzamanlılık-1 garantisi anlamsız kalırdı.
const archiveQueue = createArchiveQueue();

module.exports = {
  archiveQueue,
  createArchiveQueue,
  MAX_KUYRUK,
};
