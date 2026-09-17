// ==========================================================================
// ARŞİV BACKFILL — ÇALIŞTIRMA (`tamamla`)
// ==========================================================================
// TEK İŞİ: `backfill.js`'in "eksik" dediği hedefleri sağlayıcıdan (LazyFetch
// üzerinden) alıp arşive yazmak ve sonucu deftere işlemek.
//
// 📁 NEDEN AYRI DOSYA (2026-09-17, §C23): `backfill.js` HEAD'de zaten 462
// satırdı (AI_RULES 400 kuralı ihlal edilmişti) ve §C23 düzeltmesi ~70 satır
// daha ekledi. Kesim, dosyanın KENDİ bölüm başlıklarından geçiyor:
//
//   backfill.js         Defter + Tespit  → "ne eksik, ne beklemede, ne bayat?"
//   backfillTamamla.js  Çalıştırma (BU)  → "eksik olanı nasıl alıp yazarım?"
//
// 🔴 BAĞIMLILIK TEK YÖNLÜ: bu dosya `backfill.js`'ten alır, `backfill.js` bu
// dosyayı TANIMAZ. `backfill.js` `tamamla`'yı yeniden dışa verseydi döngüsel
// `require` olurdu (Node yarım başlatılmış `exports` döndürür — sessizce
// `undefined`). Bu yüzden çağıranlar `tamamla`'yı doğrudan BURADAN alır.

const { logSync } = require('./store');
const { archiveCatalogResponse } = require('./writer');
const { DEFAULT_CONFIG: DEVRE_CONFIG } = require('../lazyfetch/circuitBreaker');
const {
  defterYaz,
  uyu,
  TAZELIK_MS,
  ARDISIK_HATA_TAVANI,
  ISTEKLER_ARASI_MS,
} = require('./backfill');

// ==========================================================================
// Çalıştırma
// ==========================================================================

/**
 * Eksik hedefleri tamamlar.
 *
 * 🔴 `resolveRequest` (orchestrator) ÜZERİNDEN GİDİLİR, Trakt'a doğrudan
 * DEĞİL. Sebep: token bucket + devre kesici + tek-uçuş + `cache/` yeniden
 * kullanımı bedavaya gelir ve backfill kendi sağlayıcı kodunu yazmaz
 * (AI_RULES §2.5: aynı iş iki yerde durmaz). Somut kazanç: hedef zaten
 * önbellekte tazeyse AĞA HİÇ ÇIKILMAZ, veri oradan alınıp arşive yazılır.
 *
 * 🔴 ARŞİVE YAZIM `archiveCatalogResponse` İLE DOĞRUDAN YAPILIR,
 * `archiveQueue` ile DEĞİL. Kuyruk "ateşle ve unut"tur; backfill'in ise
 * SONUCU bilmesi gerekiyor — defterine "başarılı mı" yazacak. Kuyruğa
 * atsaydık defter, yazımın gerçekten olduğunu bilmeden "tamam" derdi:
 * fail-soft'un sessizliğini deftere kopyalamak (Madde 284/286'nın deseni).
 *
 * ⚠️ Sağlayıcıya gerçekten gidilen durumda orchestrator'ın A2 kancası da
 * aynı yanıtı kuyruğa atar — yani o kayıt iki kez upsert edilir. Zararsız
 * (upsert idempotent, `db.js transactionAsync` çağrıları sıraya sokuyor) ve
 * bilinçli: tekilleştirmek için kancayı atlatmak, canlı yolun garantisini
 * backfill'in varlığına bağlamak olurdu.
 *
 * @param {Object} opts
 * @param {Array}  opts.hedefler       Tamamlanacak (eksik) hedefler
 * @param {Function} opts.fetcher      LazyFetch sağlayıcı adaptörü
 * @param {Function} [opts.resolve]    `resolveRequest` (test için enjekte)
 * @param {Function} [opts.arsivle]    `archiveCatalogResponse` (test için)
 * @param {number} [opts.limit]        En fazla kaç hedef denensin
 * @param {number} [opts.beklemeMs]
 * @param {Function} [opts.ilerleme]   Her hedeften sonra çağrılır (CLI çıktısı)
 */
async function tamamla({
  hedefler,
  fetcher,
  resolve = null,
  arsivle = archiveCatalogResponse,
  limit = Infinity,
  beklemeMs = ISTEKLER_ARASI_MS,
  ardisikHataTavani = ARDISIK_HATA_TAVANI,
  ilerleme = () => {},
  uyuFn = uyu,
} = {}) {
  const resolveRequest = resolve || require('../lazyfetch/orchestrator').resolveRequest;

  const sayac = {
    denenen: 0, yazilan: 0, basarisiz: 0, bulunamadi: 0,
    agdanCekilen: 0, onbellekten: 0, atlanan: 0,
    // 🆕 §C23 — ölçülebilirlik. `zorlaCekilen`: önbellek yaş sınırını aştığı
    // için sağlayıcıya ZORLA gidilen tazeleme hedefi. `yedektenDonen`:
    // sağlayıcıya ulaşılamayıp eski veri dönen (ve bu yüzden YAZILMAYAN) hedef.
    zorlaCekilen: 0, yedektenDonen: 0,
  };
  let ardisikHata = 0;
  let durduranSebep = null;

  for (const h of hedefler) {
    if (sayac.denenen >= limit) { durduranSebep = 'limit'; break; }

    // 🔴 FREN BURADA. Devre kesici uyanmadan ÖNCE duruyoruz.
    if (ardisikHata >= ardisikHataTavani) {
      durduranSebep = 'ardisik_hata';
      logSync({
        event: 'backfill', provider: 'trakt', endpoint: h.endpoint,
        detail: `DURDURULDU: ${ardisikHata} ardisik hata (devre kesici esigi ${DEVRE_CONFIG.trakt.failureThreshold})`,
      });
      break;
    }

    sayac.denenen++;
    let sonuc;
    try {
      sonuc = await resolveRequest({
        provider: 'trakt', path: h.path, query: h.query, fetcher,
        // 🆕 §C23-B: YALNIZCA tazelik bakımı hedefinde. Diğer hedeflerde
        // LazyFetch'in önbelleği aynen kullanılır — "önbellekte tazeyse ağa
        // çıkma" kazancı korunur.
        ...(h.tazelikBakimi ? { maxEnvelopeAgeMs: TAZELIK_MS } : {}),
      });
    } catch (error) {
      ardisikHata++;
      sayac.basarisiz++;
      defterYaz(h, { hata: error.message });
      logSync({ event: 'backfill', provider: 'trakt', endpoint: h.endpoint, detail: `hata: ${error.message}` });
      ilerleme({ hedef: h, durum: 'hata', hata: error.message, ardisikHata });
      continue;
    }

    // 🔴 `not-found` HATA DEĞİL: sağlayıcı sağlıklı cevap verdi, içerik yok.
    // Ardışık hata sayacına DÜŞMEZ — düşseydi, arşivden silinmiş üç yapım
    // üst üste geldiğinde backfill kendini boşuna durdururdu. Ama deftere
    // YAZILIR ki her gece yeniden denenmesin.
    if (sonuc.status === 'not-found' || !sonuc.data) {
      ardisikHata = 0;
      sayac.bulunamadi++;
      defterYaz(h, { hata: 'not-found' });
      ilerleme({ hedef: h, durum: 'bulunamadi' });
      continue;
    }

    // ══════════════════════════════════════════════════════════════════════
    // 🆕 §C23 — SAĞLAYICIYA ULAŞILAMADI: yedekten dönen veri TAZELEME DEĞİL
    // ══════════════════════════════════════════════════════════════════════
    // Orkestratör sağlayıcı çökünce FIRLATMIYOR; elindeki eski zarfı
    // (`grace-fallback`) ya da arşivdeki kaydı (`archive-fallback`) dönüyor.
    // Kullanıcı isteği için doğru davranış bu — boş ekran yok. Ama backfill'in
    // TEK işi sağlayıcıdan veri almak ve bu iki durumda ALAMADI.
    //
    // 🔴 ESKİDEN: bu durumlar "ağdan çekildi" sayılıyor, arşive "şimdi"
    // damgasıyla yazılıyor (aynı aklamanın kesinti sırasındaki hâli) ve
    // `ardisikHata` SIFIRLANIYORDU — yani Trakt çökükken fren hiç devreye
    // girmiyor, tur 200 hedefi boşa tüketiyordu.
    //
    // ➡️ ŞİMDİ: fırlatma yoluyla (yukarıdaki `catch`) BİREBİR aynı muamele —
    // sayılır, deftere yazılır, ardışık hataya eklenir, arşive YAZILMAZ.
    if (sonuc.status === 'grace-fallback' || sonuc.status === 'archive-fallback') {
      ardisikHata++;
      sayac.basarisiz++;
      sayac.yedektenDonen++;
      defterYaz(h, { hata: `saglayiciya_ulasilamadi:${sonuc.status}` });
      logSync({ event: 'backfill', provider: 'trakt', endpoint: h.endpoint, detail: `hata: saglayiciya ulasilamadi (${sonuc.status})` });
      ilerleme({ hedef: h, durum: 'hata', hata: sonuc.status, ardisikHata });
      continue;
    }

    const agaGidildi = sonuc.status !== 'fresh' && sonuc.status !== 'stale';
    if (agaGidildi) sayac.agdanCekilen++; else sayac.onbellekten++;
    if (sonuc.forced) sayac.zorlaCekilen++;

    // ══════════════════════════════════════════════════════════════════════
    // 🆕 §C23-A — ARŞİVİN DAMGASI YALAN SÖYLEMEZ
    // ══════════════════════════════════════════════════════════════════════
    // Eskiden `fetchedAt` hiç geçirilmiyordu → `upsertPayload` varsayılanı
    // `Date.now()`. Önbellekten gelen 15,9 günlük veri "bu gece çekildi"
    // olarak yazıldı; §C20 kuralı onu taze sanıp bayat kümeden çıkardı.
    //
    // 🔑 Önbellek isabetinde damga ZARFTAN gelir ve yoksa YAZILMAZ: `Date.now()`
    // ile doldurmak tam da düzeltilen yalanı geri getirirdi. Ağa gidildiyse
    // zarfın damgası zaten "şimdi"dir; yine de yoksa (ör. passthru) `Date.now()`
    // o durumda DOĞRUDUR.
    let fetchedAt = Number(sonuc.fetchedAt);
    if (!Number.isFinite(fetchedAt)) {
      if (agaGidildi) {
        fetchedAt = Date.now();
      } else {
        sayac.basarisiz++;
        defterYaz(h, { hata: 'damga_yok' });
        logSync({ event: 'backfill', provider: 'trakt', endpoint: h.endpoint, detail: 'hata: onbellek isabeti fetchedAt tasimiyor — YAZILMADI (damga uydurulmaz)' });
        ilerleme({ hedef: h, durum: 'yazilamadi', hata: 'damga_yok' });
        continue;
      }
    }

    const yazim = await arsivle({
      provider: 'trakt', family: h.endpoint, path: h.path, query: h.query, data: sonuc.data, fetchedAt,
    });

    if (yazim && yazim.ok) {
      ardisikHata = 0;
      sayac.yazilan++;
      defterYaz(h, { basarili: true });
      ilerleme({ hedef: h, durum: 'yazildi', kaynak: sonuc.status });
    } else {
      // 🔴 YAZIM hatası ardışık sayaca DÜŞMEZ: sağlayıcı suçsuz, sorun
      // bizde (disk/şema). Devre kesiciyi Trakt'a karşı açmak yanlış teşhis
      // olurdu. Yine de deftere yazılır ve sayılır.
      sayac.basarisiz++;
      defterYaz(h, { hata: (yazim && yazim.reason) || 'bilinmeyen' });
      ilerleme({ hedef: h, durum: 'yazilamadi', hata: yazim && yazim.reason });
    }

    // Yalnızca gerçekten ağa çıktıysak beklenir.
    if (agaGidildi && beklemeMs > 0) await uyuFn(beklemeMs);
  }

  sayac.atlanan = Math.max(hedefler.length - sayac.denenen, 0);
  return { ...sayac, ardisikHata, durduranSebep };
}

module.exports = { tamamla };
