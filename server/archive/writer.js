// ==========================================================================
// KATALOG ARŞİVİ — Yazıcı (A2, çekirdek)
// ==========================================================================
// TEK İŞİ: bir katalog yanıtını arşive yazmak. "İkinci lavabo" — LazyFetch
// önbelleğine yazılan her başarılı yanıt buraya da uğrar.
//
// ⚠️ BU DOSYA HENÜZ İSTEK YOLUNA BAĞLI DEĞİL. A2'nin kalan yarısı
// (sınırlı eşzamanlılıklı kuyruk + orchestrator kancası) ayrı yazılacak.
// Burası önce ÖLÇÜLDÜ (`scripts/arsiv-benchmark.js`), sonra bağlanacak.
//
// ==========================================================================
// 🔴 STRATEJİ: "KİMLİĞİ AÇ, PAYLOAD'U TEK PARÇA BIRAK"
// ==========================================================================
// `show_seasons` yanıtı DİSKE BİR KEZ, BÜTÜN HALDE yazılır. Ama içindeki
// sezonlar ve bölümler için ayrıca `entities` + `external_ids` satırları
// açılır. Bölüm başına AYRI PAYLOAD YAZILMAZ.
//
// Gerekçe — kimlik, sonradan geri getirilemeyen TEK şey:
//   • Çapraz eşlemeyi (trakt↔tmdb↔tvdb↔imdb) yalnızca sağlayıcı veriyor.
//     Bugün yakalamazsak ve Trakt kapanırsa "tmdb bölüm 62085 neydi"
//     sorusunun cevabı kalmaz — A1/A4'ün var oluş sebebi olan senaryo.
//   • Payload'ı ise sonradan DİLİMLEYEBİLİRİZ: `episode_detail` içeriği
//     zaten sezon payload'ının içinde duruyor, A4 oradan kesip verebilir.
//     İkinci kez saklamak sadece yer kaybı olurdu.
//
// 📏 ÖLÇÜLDÜ (2026-08-29, `scripts/arsiv-benchmark.js`) — sayılar
// varsayılmadı, gerçek Trakt yanıtlarıyla (en sert vaka: `general-hospital`,
// 64 sezon / 10.833 bölüm / 6,2 MB) ölçüldü.
//
// ==========================================================================
// 🔴 TEK TRANSACTION — ZORUNLU
// ==========================================================================
// Bir dizinin tüm hiyerarşisi TEK `transaction()` bloğunda yazılır. İki
// sebep:
//   1. PERFORMANS: her satırı ayrı transaction'la yazmak SQLite'ı satır
//      başına bir WAL commit'ine zorlar. 10.833 bölümde bu 10.833 commit
//      demek — Pi'nin diskini döver ve süreyi kat kat uzatır.
//   2. BÜTÜNLÜK: yarım yazılmış bir hiyerarşi, hiç yazılmamış olandan
//      TEHLİKELİDİR — kapsam ölçümü (A4'ün "bağımsızız" kararı) yalan
//      söylemeye başlar. Hep ya da hiç.
// `db.js` `transaction()` iç içe çağrıya dayanıklı: `resolveOrCreate` kendi
// içinde de çağırıyor, hepsi TEK dış işleme katılıyor.

const { transactionAsync } = require('./db');
const { resolveOrCreate, traktIdsToExternal, findByExternal, findChild } = require('./identity');
const { upsertPayload, logSync, DILSIZ } = require('./store');

// ==========================================================================
// 🔴🔴 OLAY DÖNGÜSÜ NEFESİ — ÖLÇÜMDEN DOĞDU
// ==========================================================================
// `node:sqlite` SENKRON (`DatabaseSync`). Bir dizinin tüm hiyerarşisini
// kesintisiz yazmak Node'un TEK iş parçacığını bloklar. ÖLÇÜLDÜ (2026-08-29,
// `general-hospital`, 10.833 bölüm):
//   • geliştirme makinesi: olay döngüsü **691 ms** bloke
//   • Pi (≈8× yavaş):       **~5,5 sn** bloke
// Bu süre boyunca sunucu HİÇBİR HTTP isteğine cevap veremiyordu.
//
// 🪤 "Kuyruğa alırız" ÇÖZÜM DEĞİL — kuyruk da aynı iş parçacığında koşar.
// Bu, ölçmeden kolayca kaçırılacak bir hataydı: kod doğru, testler yeşil,
// ama üretimde sunucu saniyelerce ölü kalırdı.
//
// Çözüm: transaction AÇIK kalır (bütünlük + hız korunur), yazıcı her
// `IS_DILIMI_MS`'de bir olay döngüsüne dönüş yapar. SQLite işlemi bağlantı
// ömrüne bağlıdır, tick'e değil — araya girip dönmek işlemi bozmaz. WAL
// sayesinde okuyucular zaten bloklanmıyordu.
//
// 🔴 SAYI DEĞİL SÜRE BÜTÇESİ: "her 100 bölümde bir nefes al" deseydik, Pi
// ile geliştirme makinesi arasındaki 8× fark yüzünden birinde çok sık,
// diğerinde çok seyrek nefes alırdık. Süre bütçesi her donanımda aynı
// gecikme tavanını verir.
const IS_DILIMI_MS = 25;

/**
 * İş dilimi dolduysa olay döngüsüne dön. Yeni dilim başlangıcını döner.
 *
 * `setImmediate` seçildi (`setTimeout(0)` değil): bekleyen G/Ç geri
 * çağrılarından SONRA, ama bir sonraki timer turundan ÖNCE çalışır —
 * yani HTTP isteklerine sıra gelir ama gereksiz gecikme eklenmez.
 */
async function nefesAl(dilimBasi) {
  if (performance.now() - dilimBasi < IS_DILIMI_MS) return dilimBasi;
  await new Promise((r) => setImmediate(r));
  return performance.now();
}

/**
 * Trakt yolundan dizinin/filmin dış kimliğini çıkarır.
 *
 * `show_seasons` yanıtı dizinin KENDİ `ids` bloğunu TAŞIMAZ (yalnızca
 * sezonlarınkini) — ölçüldü. Yani kimliği istek yolundan almak zorundayız:
 * istemci `/shows/1388/seasons` istedi, demek ki trakt id 1388.
 *
 * Sayısal ise `trakt:<tip>`, değilse `trakt:slug`.
 */
function yoldanKimlik(tip, rawId) {
  const id = String(rawId || '').trim();
  if (!id) return [];
  return /^\d+$/.test(id)
    ? [{ source: `trakt:${tip}`, source_id: id }]
    : [{ source: 'trakt:slug', source_id: id }];
}

/** `?extended=...&translations=tr` → 'tr'; dil yoksa DILSIZ sentinel'i. */
function dilCoz(query = {}) {
  const t = query.translations || query.language || query.lang;
  if (!t || typeof t !== 'string') return DILSIZ;
  // `translations=tr` ya da `language=tr-TR` — ilk iki harf yeterli.
  return t.slice(0, 2).toLowerCase();
}

/**
 * 🔴 BOŞ/BOZUK YANIT ARŞİVLENMEZ.
 *
 * Gerçek vaka (ölçüldü 2026-08-29): Trakt, tanımadığı bir slug için
 * `/shows/greys-anatomy/seasons` isteğine **HTTP 200 + `[]`** döndürüyor.
 * Bunu arşive yazmak, "bu dizinin hiç sezonu yok" yalanını KALICI hale
 * getirirdi — üstelik arşivde TTL olmadığı için kendiliğinden düzelmezdi.
 * Önbellek için zararsız (kısa ömürlü), arşiv için zehirli.
 */
function iseYararMi(data) {
  if (data === null || data === undefined) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === 'object') return Object.keys(data).length > 0;
  return false;
}

/**
 * `show_seasons` yanıtını arşive yazar — HİYERARŞİYİ AÇARAK.
 *
 * @param {Object} opts
 * @param {string} opts.showId  İstek yolundaki dizi kimliği (`1388` veya slug)
 * @param {Array}  opts.seasons Trakt yanıtı (sezon dizisi, `episodes` gömülü)
 * @param {string} [opts.lang]
 * @param {number} [opts.fetchedAt]
 * @returns {{ok: boolean, reason?: string, showKaymakId?: string,
 *            seasons?: number, episodes?: number, skipped?: number}}
 */
async function archiveShowSeasons({ showId, seasons, lang = DILSIZ, fetchedAt = Date.now() }) {
  if (!iseYararMi(seasons)) return { ok: false, reason: 'bos_yanit' };

  const disKimlik = yoldanKimlik('show', showId);
  if (!disKimlik.length) return { ok: false, reason: 'kimliksiz_istek' };

  return transactionAsync(async () => {
    const dizi = resolveOrCreate({ type: 'show', externalIds: disKimlik });
    if (!dizi) return { ok: false, reason: 'arsiv_kapali' };

    // Payload TEK PARÇA — dizinin kendisine bağlı.
    const yazim = await upsertPayload({
      kaymakId: dizi.kaymak_id, provider: 'trakt', endpoint: 'show_seasons',
      lang, data: seasons, fetchedAt,
    });
    if (!yazim.ok) return { ok: false, reason: yazim.reason };

    let sezonSayisi = 0;
    let bolumSayisi = 0;
    let atlanan = 0;
    let nefes = 0;
    let dilimBasi = performance.now();

    for (const sezon of seasons) {
      if (!sezon || typeof sezon.number !== 'number') { atlanan++; continue; }

      const sezonKimlikleri = traktIdsToExternal('season', sezon.ids);
      if (!sezonKimlikleri.length) { atlanan++; continue; }

      const s = resolveOrCreate({
        type: 'season',
        externalIds: sezonKimlikleri,
        parentId: dizi.kaymak_id,
        seasonNumber: sezon.number,
        derived: { title: sezon.title || null },
      });
      sezonSayisi++;

      for (const bolum of sezon.episodes || []) {
        if (!bolum || typeof bolum.number !== 'number') { atlanan++; continue; }

        const bolumKimlikleri = traktIdsToExternal('episode', bolum.ids);
        if (!bolumKimlikleri.length) { atlanan++; continue; }

        resolveOrCreate({
          type: 'episode',
          externalIds: bolumKimlikleri,
          parentId: s.kaymak_id,
          // Bölümün KENDİ `season` alanı, üst sezonunkiyle uyuşmayabilir
          // (Trakt'ta nadiren olur); hiyerarşi indeksinin tutarlı kalması
          // için ÜST SEZONUN numarasını yazıyoruz.
          seasonNumber: sezon.number,
          episodeNumber: bolum.number,
          derived: { title: bolum.title || null },
        });
        bolumSayisi++;

        // 🔴 Nefes: iş dilimi dolduysa olay döngüsüne dön, sunucu bu arada
        // isteklere cevap versin. Transaction AÇIK kalır.
        const yeniDilim = await nefesAl(dilimBasi);
        if (yeniDilim !== dilimBasi) { nefes++; dilimBasi = yeniDilim; }
      }
    }

    return {
      ok: true, showKaymakId: dizi.kaymak_id,
      seasons: sezonSayisi, episodes: bolumSayisi, skipped: atlanan,
      breaths: nefes,
    };
  });
}

/**
 * Kendi `ids` bloğunu TAŞIYAN düz yanıtlar (`show_detail`, `movie_detail`,
 * `episode_detail`). Hiyerarşi açılmaz — açılacak bir şey yok.
 */
async function archiveSimplePayload({ type, endpoint, data, lang = DILSIZ, fetchedAt = Date.now(), fallbackId = null }) {
  if (!iseYararMi(data)) return { ok: false, reason: 'bos_yanit' };

  // 🔴 SAVUNMA (Madde 285): bu fonksiyon HİYERARŞİSİZ tipler içindir.
  // `season`/`episode` şemada `parent_id` + `season_number` istiyor ve
  // burası onları geçirmiyor — sessizce CHECK ihlaline gitmek yerine
  // açıkça reddediyoruz. Bölümler `archiveEpisodeDetail`'e gider.
  if (type === 'episode' || type === 'season') {
    return { ok: false, reason: 'hiyerarsili_tip_yanlis_yolda' };
  }

  // Yanıtın kendi `ids`'i varsa o esastır; yoksa istek yolundaki kimliğe düşülür.
  const kimlikler = data.ids ? traktIdsToExternal(type, data.ids) : yoldanKimlik(type, fallbackId);
  if (!kimlikler.length) return { ok: false, reason: 'kimliksiz_yanit' };

  return transactionAsync(async () => {
    const e = resolveOrCreate({
      type,
      externalIds: kimlikler,
      derived: { title: data.title || null, year: data.year || null, status: data.status || null },
    });
    if (!e) return { ok: false, reason: 'arsiv_kapali' };

    const yazim = await upsertPayload({ kaymakId: e.kaymak_id, provider: 'trakt', endpoint, lang, data, fetchedAt });
    return yazim.ok
      ? { ok: true, kaymakId: e.kaymak_id }
      : { ok: false, reason: yazim.reason };
  });
}

/**
 * `episode_detail` yanıtını arşive yazar — HİYERARŞİYİ ÇÖZEREK.
 *
 * 🔴🔴 NEDEN AYRI BİR YOL (Madde 285 — GERÇEK BİR HATA):
 * Bu aile önce `archiveSimplePayload`'a gidiyordu ve o fonksiyon
 * `parentId`/`seasonNumber`/`episodeNumber` HİÇ geçirmiyordu. Şemanın
 * CHECK'i (`type NOT IN ('season','episode') OR season_number IS NOT NULL`)
 * haklı olarak reddediyordu:
 *
 *     CHECK constraint failed: type NOT IN ('season','episode')
 *                              OR season_number IS NOT NULL
 *
 * Üretimde 14 bölüm yazımı bu yüzden düştü (`sync_log`'da 28 satır — yazıcı
 * + kuyruk). Hata **görünmüyordu** çünkü 48 kayıt BAŞARILI oluyordu: o
 * bölümler `archiveShowSeasons` tarafından zaten yaratılmıştı, dolayısıyla
 * `resolveOrCreate` bulup INSERT'e hiç girmiyordu. Yani kusur yalnızca
 * "kullanıcı diziyi açmadan doğrudan bölüme girdiğinde" ortaya çıkıyordu.
 *
 * 🔴 SENTETİK KİMLİK ÜRETİLMİYOR: bölümün sezonu arşivde YOKSA kayıt
 * yazılmaz ve `sezon_bilinmiyor` diye ATLANIR — hata değil. Sezon için
 * uydurma bir dış kimlik üretmek, gerçek sezon geldiğinde çakışma yaratır
 * ve arşivi kalıcı olarak kirletirdi. Dizi ekranı açıldığında
 * `archiveShowSeasons` sezonları yazacak, bir sonraki bölüm görüntülemesi
 * de yerine oturacak.
 */
async function archiveEpisodeDetail({ showId, data, lang = DILSIZ, fetchedAt = Date.now() }) {
  if (!iseYararMi(data)) return { ok: false, reason: 'bos_yanit' };

  const bolumKimlikleri = traktIdsToExternal('episode', data.ids);
  if (!bolumKimlikleri.length) return { ok: false, reason: 'kimliksiz_yanit' };

  // Sezon/bölüm numarası yanıtın KENDİSİNDE var (ölçüldü: `season`, `number`).
  const sezonNo = typeof data.season === 'number' ? data.season : null;
  const bolumNo = typeof data.number === 'number' ? data.number : null;
  if (sezonNo === null || bolumNo === null) return { ok: false, reason: 'numarasiz_bolum' };

  const diziKimlikleri = yoldanKimlik('show', showId);
  if (!diziKimlikleri.length) return { ok: false, reason: 'kimliksiz_istek' };

  return transactionAsync(async () => {
    // Dizi: yoksa yaratılır (yalnızca istek yolundaki kimlikle).
    const dizi = resolveOrCreate({ type: 'show', externalIds: diziKimlikleri });
    if (!dizi) return { ok: false, reason: 'arsiv_kapali' };

    // Sezon: ARANIR, yaratılmaz (yukarıdaki kırmızı not).
    const sezonId = findChild({ parentId: dizi.kaymak_id, type: 'season', seasonNumber: sezonNo });
    if (!sezonId) return { ok: false, reason: 'sezon_bilinmiyor' };

    const bolum = resolveOrCreate({
      type: 'episode',
      externalIds: bolumKimlikleri,
      parentId: sezonId,
      seasonNumber: sezonNo,
      episodeNumber: bolumNo,
      derived: { title: data.title || null },
    });

    const yazim = await upsertPayload({
      kaymakId: bolum.kaymak_id, provider: 'trakt', endpoint: 'episode_detail',
      lang, data, fetchedAt,
    });
    return yazim.ok
      ? { ok: true, kaymakId: bolum.kaymak_id, created: bolum.created }
      : { ok: false, reason: yazim.reason };
  });
}

/**
 * 🔴 LİSTE YANITLARI (`show_related`, `show_people`) BU TURDA
 * ARŞİVLENMİYOR — bilinçli.
 *
 * `show_related` bir DİZİ döndürüyor ve hangi yapıma ait olduğu yalnızca
 * istek yolunda yazılı; `show_people` ise bir kadro nesnesi. İkisi de
 * "sahibi" olan ama sahibini İÇERMEYEN yanıtlar. Bunları doğru bağlamak
 * zor değil ama A2'nin ilk turunda yüzeyi dar tutuyoruz (L7'nin "tek uçla
 * başla" disiplininin aynısı). Ölçüm ve kanca oturduktan sonra eklenir.
 */
const DESTEKLENEN_AILELER = new Set(['show_seasons', 'show_detail', 'movie_detail', 'episode_detail']);

/**
 * A2'nin kuyruğunun çağıracağı TEK giriş noktası.
 *
 * 🔴 ASLA THROW ETMEZ. Arşiv yazımı bir kullanıcı isteğini rehin alamaz
 * (03_FAZLAR.md A2). Hata `sync_log`'a yazılır ve `{ok:false}` döner.
 */
async function archiveCatalogResponse({ provider, family, path, query = {}, data, fetchedAt = Date.now() }) {
  if (provider !== 'trakt') return { ok: false, reason: 'desteklenmeyen_saglayici' };
  if (!DESTEKLENEN_AILELER.has(family)) return { ok: false, reason: 'kapsam_disi_aile' };

  const lang = dilCoz(query);

  try {
    if (family === 'show_seasons') {
      const m = /^\/shows\/([^/]+)\/seasons$/.exec(path || '');
      if (!m) return { ok: false, reason: 'yol_cozulemedi' };
      return await archiveShowSeasons({ showId: m[1], seasons: data, lang, fetchedAt });
    }

    const m = /^\/(?:shows|movies)\/([^/]+)/.exec(path || '');

    // 🔴 `episode_detail` AYRI YOL — hiyerarşi çözülmeli (Madde 285).
    // `archiveSimplePayload` bölüm entity'si YARATAMAZ; şemanın CHECK'i
    // `season_number` istiyor ve o fonksiyon onu geçirmiyor.
    if (family === 'episode_detail') {
      if (!m) return { ok: false, reason: 'yol_cozulemedi' };
      return await archiveEpisodeDetail({ showId: m[1], data, lang, fetchedAt });
    }

    const tip = family === 'movie_detail' ? 'movie' : 'show';
    return await archiveSimplePayload({
      type: tip, endpoint: family, data, lang, fetchedAt, fallbackId: m ? m[1] : null,
    });
  } catch (error) {
    logSync({ event: 'error', provider, endpoint: family, detail: `writer: ${error.message}` });
    return { ok: false, reason: error.message };
  }
}

module.exports = {
  IS_DILIMI_MS,
  archiveCatalogResponse,
  archiveShowSeasons,
  archiveEpisodeDetail,
  archiveSimplePayload,
  DESTEKLENEN_AILELER,
  // Yalnızca test/ölçüm için.
  yoldanKimlik,
  dilCoz,
  iseYararMi,
};
