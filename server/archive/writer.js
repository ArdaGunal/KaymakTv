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

const { transaction } = require('./db');
const { resolveOrCreate, traktIdsToExternal } = require('./identity');
const { upsertPayload, logSync, DILSIZ } = require('./store');

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
function archiveShowSeasons({ showId, seasons, lang = DILSIZ, fetchedAt = Date.now() }) {
  if (!iseYararMi(seasons)) return { ok: false, reason: 'bos_yanit' };

  const disKimlik = yoldanKimlik('show', showId);
  if (!disKimlik.length) return { ok: false, reason: 'kimliksiz_istek' };

  return transaction(() => {
    const dizi = resolveOrCreate({ type: 'show', externalIds: disKimlik });
    if (!dizi) return { ok: false, reason: 'arsiv_kapali' };

    // Payload TEK PARÇA — dizinin kendisine bağlı.
    const yazim = upsertPayload({
      kaymakId: dizi.kaymak_id, provider: 'trakt', endpoint: 'show_seasons',
      lang, data: seasons, fetchedAt,
    });
    if (!yazim.ok) return { ok: false, reason: yazim.reason };

    let sezonSayisi = 0;
    let bolumSayisi = 0;
    let atlanan = 0;

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
      }
    }

    return { ok: true, showKaymakId: dizi.kaymak_id, seasons: sezonSayisi, episodes: bolumSayisi, skipped: atlanan };
  });
}

/**
 * Kendi `ids` bloğunu TAŞIYAN düz yanıtlar (`show_detail`, `movie_detail`,
 * `episode_detail`). Hiyerarşi açılmaz — açılacak bir şey yok.
 */
function archiveSimplePayload({ type, endpoint, data, lang = DILSIZ, fetchedAt = Date.now(), fallbackId = null }) {
  if (!iseYararMi(data)) return { ok: false, reason: 'bos_yanit' };

  // Yanıtın kendi `ids`'i varsa o esastır; yoksa istek yolundaki kimliğe düşülür.
  const kimlikler = data.ids ? traktIdsToExternal(type, data.ids) : yoldanKimlik(type, fallbackId);
  if (!kimlikler.length) return { ok: false, reason: 'kimliksiz_yanit' };

  return transaction(() => {
    const e = resolveOrCreate({
      type,
      externalIds: kimlikler,
      derived: { title: data.title || null, year: data.year || null, status: data.status || null },
    });
    if (!e) return { ok: false, reason: 'arsiv_kapali' };

    const yazim = upsertPayload({ kaymakId: e.kaymak_id, provider: 'trakt', endpoint, lang, data, fetchedAt });
    return yazim.ok
      ? { ok: true, kaymakId: e.kaymak_id }
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
function archiveCatalogResponse({ provider, family, path, query = {}, data, fetchedAt = Date.now() }) {
  if (provider !== 'trakt') return { ok: false, reason: 'desteklenmeyen_saglayici' };
  if (!DESTEKLENEN_AILELER.has(family)) return { ok: false, reason: 'kapsam_disi_aile' };

  const lang = dilCoz(query);

  try {
    if (family === 'show_seasons') {
      const m = /^\/shows\/([^/]+)\/seasons$/.exec(path || '');
      if (!m) return { ok: false, reason: 'yol_cozulemedi' };
      return archiveShowSeasons({ showId: m[1], seasons: data, lang, fetchedAt });
    }

    const tip = family === 'movie_detail' ? 'movie' : family === 'episode_detail' ? 'episode' : 'show';
    const m = /^\/(?:shows|movies)\/([^/]+)/.exec(path || '');
    return archiveSimplePayload({
      type: tip, endpoint: family, data, lang, fetchedAt, fallbackId: m ? m[1] : null,
    });
  } catch (error) {
    logSync({ event: 'error', provider, endpoint: family, detail: `writer: ${error.message}` });
    return { ok: false, reason: error.message };
  }
}

module.exports = {
  archiveCatalogResponse,
  archiveShowSeasons,
  archiveSimplePayload,
  DESTEKLENEN_AILELER,
  // Yalnızca test/ölçüm için.
  yoldanKimlik,
  dilCoz,
  iseYararMi,
};
