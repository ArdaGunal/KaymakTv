// ==========================================================================
// KATALOG ARŞİVİ — Backfill Motoru (A3 Adım 2, dosya 2/2)
// ==========================================================================
// TEK İŞİ: hedef listesini alıp "arşivde eksik olanı" bulmak, hız sınırlı
// biçimde tamamlamak ve başarısız ucu DEFTERE İŞARETLEMEK.
//
// NEDEN VAR: A2'nin kancası yalnızca SAĞLAYICIYA GİDEN istekte ateşleniyor
// ve L8'den sonra TTL 30 gün — yani çağrı seyreldi, arşiv kendiliğinden
// dolmuyor (MASTER_PLAN §0 açık iş 4). A3/1 `cache/`'te olanı kurtardı;
// bu dosya HİÇ İSTENMEMİŞ olanı getirir.
//
// ==========================================================================
// 🔴🔴 EN ÖNEMLİ KURAL: BACKFILL CANLI TRAFİĞİ REHİN ALAMAZ
// ==========================================================================
// `circuitBreaker.js` sağlayıcı BAŞINA TEK singleton (`breakers` Map) —
// yani backfill'in yediği hata, o an sitede gezinen gerçek kullanıcının
// isteğini de kesen devreyi açar. Trakt eşiği 5 ARDIŞIK hata / 30 sn OPEN.
//
// Korumamız ARALIĞA dayanıyor, sabite değil (Madde 273'ün dersi: "sabitleri
// değil, ARALARINDAKİ İLİŞKİYİ test et"):
//
//     ARDISIK_HATA_TAVANI (3)  <  circuitBreaker trakt eşiği (5)
//
// Yani backfill, devre kesici uyanmadan ÖNCE kendi kendini durdurur. İki
// sayıdan biri değişirse `tests/arsiv/tamamlama.test.js` KIRMIZI YANAR —
// L8'de tam olarak bunun yokluğu üç sessiz tuzağa yol açmıştı (iki test de
// kendi sabitini doğru ölçüyordu, kusur aradaydı).
//
// ⚠️ Bu koruma "tavanı 4 yapalım" diye gevşetilemez: `refreshQueue` (L5) 2
// paralel arka plan yenilemesi çalıştırıyor, yani devre kesicinin sayacına
// backfill'den BAĞIMSIZ hatalar da düşebilir. Pay bilinçli olarak geniş.

const { getDb } = require('./db');
const { findByExternal } = require('./identity');
const { logSync } = require('./store');
const { archiveCatalogResponse } = require('./writer');
const { DEFAULT_CONFIG: DEVRE_CONFIG } = require('../lazyfetch/circuitBreaker');
const { hedefAnahtari } = require('./backfillSource');

/** Bkz. dosya başlığı — devre kesici eşiğinin ALTINDA kalmak ZORUNDA. */
const ARDISIK_HATA_TAVANI = 3;

/**
 * Sağlayıcıya giden iki istek arasındaki bekleme.
 *
 * 🔴 SAYI ÖLÇÜLMEDİ, GEREKÇELENDİRİLDİ (04_KARARLAR.md B'nin deseni —
 * "uydurulmadı ama ölçülmedi de" dürüstlüğü). `tokenBucket` Trakt için
 * 2/sn sürekli hıza izin veriyor; backfill ARKA PLAN işi olduğu için o
 * tavanın altında, ~0,4/sn'de kalıyor. Böylece aynı anda gelen gerçek
 * kullanıcı isteği kovada her zaman token buluyor.
 *
 * ⚠️ Bekleme YALNIZCA sağlayıcıya gerçekten gidildiğinde uygulanır.
 * Önbellekten dönen hedefte beklemek, 296 hedefi boşuna 12 dakikaya
 * yayardı.
 */
const ISTEKLER_ARASI_MS = 2500;

/**
 * Başarısız hedefin geri çekilme merdiveni (deneme sayısına göre).
 *
 * 🔴 "SONSUZA DEK VAZGEÇME" YOK — bilinçli. `general-hospital`'ın 504'ü
 * Trakt'ın kendi tarafındaki geçici bir sınır; bir gün düzelebilir. Kalıcı
 * kara liste, düzeldiği gün bunu FARK ETMEMEK demekti. Onun yerine aralık
 * uzuyor: 6 saat → 1 gün → 3 gün → 7 gün → 30 gün (tavan).
 */
const GERI_CEKILME_MS = [
  6 * 3600 * 1000,
  24 * 3600 * 1000,
  3 * 24 * 3600 * 1000,
  7 * 24 * 3600 * 1000,
  30 * 24 * 3600 * 1000,
];

function geriCekilme(deneme) {
  const i = Math.min(Math.max(deneme, 1), GERI_CEKILME_MS.length) - 1;
  return GERI_CEKILME_MS[i];
}

const uyu = (ms) => new Promise((r) => setTimeout(r, ms));

// ==========================================================================
// Defter (backfill_state)
// ==========================================================================

/** Hedefin defter satırı — yoksa `null`. */
function defterOku(anahtar) {
  const db = getDb();
  if (!db) return null;
  try {
    return db.prepare('SELECT * FROM backfill_state WHERE hedef = ?').get(anahtar) || null;
  } catch (_) {
    return null;
  }
}

/**
 * Defteri günceller. THROW ETMEZ — defter yazamamak backfill'i durdurmaz
 * (`store.js logSync`'in aynı sözleşmesi).
 */
function defterYaz(h, { hata = null, basarili = false, simdi = Date.now() } = {}) {
  const db = getDb();
  if (!db) return false;
  const anahtar = hedefAnahtari(h);
  try {
    const mevcut = defterOku(anahtar);
    const deneme = basarili ? (mevcut ? mevcut.deneme : 0) : (mevcut ? mevcut.deneme : 0) + 1;
    db.prepare(
      `INSERT INTO backfill_state
         (hedef, provider, endpoint, source_id, lang, deneme, son_hata, son_deneme_at, sonraki_deneme_at, basarili_at)
       VALUES (?, 'trakt', ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(hedef) DO UPDATE SET
         deneme            = excluded.deneme,
         son_hata          = excluded.son_hata,
         son_deneme_at     = excluded.son_deneme_at,
         sonraki_deneme_at = excluded.sonraki_deneme_at,
         basarili_at       = excluded.basarili_at`
    ).run(
      anahtar, h.endpoint, String(h.sourceId), h.lang, deneme,
      hata ? String(hata).slice(0, 500) : null,
      simdi,
      basarili ? null : simdi + geriCekilme(deneme),
      basarili ? simdi : null
    );
    return true;
  } catch (_) {
    return false;
  }
}

/** Defterdeki geri çekilme penceresi hâlâ açık mı? */
function beklemedeMi(anahtar, simdi = Date.now()) {
  const satir = defterOku(anahtar);
  if (!satir || !satir.sonraki_deneme_at) return false;
  return satir.sonraki_deneme_at > simdi;
}

// ==========================================================================
// Eksik tespiti
// ==========================================================================

/**
 * Bu hedef arşivde VAR MI?
 *
 * 🔴 `entities` DEĞİL `payloads` SORGULANIR — ayrım kritik. Arşivde 37.572
 * entity var ama bunların ezici çoğunluğu `archiveShowSeasons`'ın açtığı
 * BÖLÜM kayıtları: kimliği bilinen ama ham yanıtı olmayan satırlar. A4
 * istemciye yanıt ÜRETECEK; üretebilmek için ham payload lazım. "Entity var,
 * demek ki kapsıyoruz" demek, A4'te boş dönen bir arşiv olurdu.
 *
 * @returns {{var: boolean, kaymakId: string|null}}
 */
function arsivdeVarMi(h) {
  const db = getDb();
  if (!db) return { var: false, kaymakId: null };

  const kaymakId = findByExternal(h.source, h.sourceId);
  if (!kaymakId) return { var: false, kaymakId: null };

  try {
    const satir = db
      .prepare(
        `SELECT 1 FROM payloads
          WHERE kaymak_id = ? AND provider = 'trakt' AND endpoint = ? AND lang = ?`
      )
      .get(kaymakId, h.endpoint, h.lang);
    return { var: !!satir, kaymakId };
  } catch (_) {
    return { var: false, kaymakId };
  }
}

/**
 * Hedef listesini üç kovaya ayırır: `kapsanan` · `beklemede` · `eksik`.
 * SIFIR ağ isteği yapar — kuru çalışmanın (`--uygula` yok) tamamı budur.
 */
function eksikleriBul(hedefler, { simdi = Date.now() } = {}) {
  const kapsanan = [];
  const beklemede = [];
  const eksik = [];

  for (const h of hedefler) {
    if (arsivdeVarMi(h).var) { kapsanan.push(h); continue; }
    const anahtar = hedefAnahtari(h);
    if (beklemedeMi(anahtar, simdi)) {
      beklemede.push({ ...h, defter: defterOku(anahtar) });
      continue;
    }
    eksik.push(h);
  }

  return { kapsanan, beklemede, eksik };
}

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
      sonuc = await resolveRequest({ provider: 'trakt', path: h.path, query: h.query, fetcher });
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

    const agaGidildi = sonuc.status !== 'fresh' && sonuc.status !== 'stale';
    if (agaGidildi) sayac.agdanCekilen++; else sayac.onbellekten++;

    const yazim = await arsivle({
      provider: 'trakt', family: h.endpoint, path: h.path, query: h.query, data: sonuc.data,
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

module.exports = {
  tamamla,
  eksikleriBul,
  arsivdeVarMi,
  defterOku,
  defterYaz,
  beklemedeMi,
  geriCekilme,
  ARDISIK_HATA_TAVANI,
  ISTEKLER_ARASI_MS,
  GERI_CEKILME_MS,
};
