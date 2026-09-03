// ==========================================================================
// KATALOG ARŞİVİ — Kimlik Çözümleyici (A1, dosya 2/3)
// ==========================================================================
// TEK İŞİ: sağlayıcıdan gelen dış kimlikleri (`trakt`, `tmdb`, `imdb`,
// `tvdb`, `slug`) BİZİM `kaymak_id`'mize çevirmek — yoksa oluşturmak.
//
// 🔴 ARŞİVİN EN KRİTİK DOSYASI BU. Şema doğruysa ama kimlik çözümlemesi
// yanlışsa arşiv sessizce çift kayıt biriktirir: aynı dizi iki farklı
// `kaymak_id` altında, ikisi de yarım. A4'te "kapsamımız %80" derken
// aslında %40 oluruz ve bunu FARK ETMEYİZ.
//
// 🎁 TRAKT BU İŞİ BİZE BEDAVA YAPIYOR: her katalog yanıtı bir `ids` bloğu
// taşıyor — `{trakt, slug, tvdb, imdb, tmdb}`. Yani çapraz eşleme tablosu
// zaten çektiğimiz veriden doluyor, ayrı bir iş değil.
//
// ⚠️ TERSİ DOĞRU DEĞİL: TMDB yanıtları trakt ID taşımaz. Bir TMDB kaydı
// ancak karşılık gelen Trakt kaydını görmüşsek bağlanabilir — bu, A3
// backfill'in TRAKT tarafından başlaması gerektiğini söyler.
//
// 🔴 KAYNAK ADI TİPİ İÇERİR (`tmdb:show` / `tmdb:movie`): TMDB'de dizi 1396
// ile film 1396 FARKLI yapımlardır. Tipi gömmezsek iki ayrı yapım aynı
// satıra çakışır ve arşiv sessizce yalan söyler.
//
// 🔴 DÜZELTME (Madde 288, 2026-09-03): burada eskiden *"`imdb` tipsizdir —
// IMDB kimlikleri global olarak benzersizdir (tt0903747)"* yazıyordu ve bu
// varsayım ÜRETİMDE ÇÜRÜDÜ. Benzersizlik IMDB'nin kendi tarafında doğru;
// ama TRAKT aynı `tt...` kimliğini hem bir FİLME hem o filmin "özel bölüm"
// kaydına veriyor. Canlı ölçüm: 44.287 entity'nin 9'u bu yüzden iki ayrı
// yapımın birleşmiş haliydi ve 9/9'u `imdb` taşıyordu. Kimlik hâlâ tipsiz
// SAKLANIYOR (göç ayrı bir tur) ama artık tipsiz anahtarlar yalnızca AYNI
// TİPTEKİ yapımla eşleşebiliyor — bkz. `TIPSIZ_KAYNAKLAR`.

const crypto = require('crypto');
const { getDb, transaction } = require('./db');

/** `schema.sql`'deki CHECK ile aynı liste — ıraksarsa veritabanı reddeder. */
const GECERLI_TIPLER = new Set(['show', 'movie', 'season', 'episode', 'person']);

/**
 * ADINDA TİP TAŞIMAYAN kaynaklar — `resolveOrCreate` bunlarla eşleşirken
 * ekstra bir tip kontrolü uygular (aşağıdaki "TİPSİZ ANAHTAR BARİYERİ").
 *
 * 🔴 `imdb` — ÖLÇÜLDÜ (2026-09-03): dosyanın eski varsayımı ("IMDB
 * kimlikleri global olarak benzersizdir, tip gerekmez") ÜRETİMDE ÇÜRÜDÜ.
 * Benzersizlik IMDB'nin kendi tarafında doğru; ama TRAKT aynı `tt...`
 * kimliğini hem bir filme hem o filmin "özel bölüm" kaydına veriyor.
 *
 * 🔴 `trakt:slug` — adı iki parçalı olduğu için tipli SANILABİLİR ama
 * "slug" bir VARLIK TİPİ DEĞİL. Trakt'ta dizi slug'ları ile film
 * slug'ları ayrı ad uzaylarında: aynı slug ikisinde birden var olabilir.
 * `yoldanKimlik()` sayısal olmayan bir yol parçasını buraya çeviriyor,
 * yani bu anahtar TEK BAŞINA bir yapımı çözebiliyor — bariyersiz
 * bırakmak `imdb` ile aynı sızıntıyı açık tutardı.
 */
const TIPSIZ_KAYNAKLAR = new Set(['imdb', 'trakt:slug']);

/**
 * `kaymak_id` üretir: `<tip>_<32 hex>`.
 *
 * Tip öneki teknik olarak gereksiz (`entities.type` kolonu zaten var) ama
 * TEŞHİS için değerli: bir log satırında ya da `sync_log` kaydında ID'yi
 * görünce ne olduğu anlaşılır. Madde 260'ın dersi — teşhis edilebilirlik
 * sonradan eklenmez, baştan tasarlanır.
 *
 * Rastgele (sıralı değil): arşiv iki ayrı makinede doldurulup birleştirilse
 * bile çakışma olmaz. Sıralama gerektiğinde `created_at` var.
 */
function yeniKaymakId(tip) {
  return `${tip}_${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Trakt'ın `ids` bloğunu `external_ids` satırlarına çevirir.
 *
 * 📏 GERÇEK YANITLA ÖLÇÜLDÜ (2026-08-29, `/shows/1388/seasons?extended=
 * full,episodes`): sezon `ids` → `{plex, tmdb, tvdb, trakt}`, bölüm `ids`
 * → `{imdb, plex, tmdb, tvdb, trakt}`. 72 bölümün 72'sinde `trakt`,
 * 71'inde `tmdb` var. Yani tek bir katalog yanıtı, dizinin TÜM
 * hiyerarşisinin kimlik haritasını bedava veriyor.
 *
 * 🔴 KAYNAK ADI HER ZAMAN KENDİ TİPİNİ TAŞIR. İlk taslakta bölümün
 * `tmdb`/`tvdb` kimlikleri `tmdb:show`/`tvdb:show` diye etiketleniyordu —
 * "bölümün tmdb'si üst diziyi gösterir" varsayımıyla. YANLIŞ: ölçümde
 * görüldü ki bölümün kendi tmdb kimliği (62085) geliyor. O etiketle
 * yazsaydık, tmdb dizi kimliği 62085 olan GERÇEK bir dizi geldiğinde
 * çakışırdı ve arşiv sessizce iki farklı yapımı karıştırırdı. Kod
 * okumasıyla görülmezdi; gerçek yanıt açılınca çıktı.
 *
 * ⛔ `plex` BİLİNÇLİ OLARAK ALINMIYOR: değeri skaler değil, iç içe bir
 * nesne (`{guid: "..."}`). Bizim için bir karşılığı yok ve `String()`'e
 * sokmak `[object Object]` üretirdi — sahte bir kimlik.
 *
 * @param {'show'|'movie'|'season'|'episode'} tip
 * @param {Object} ids  Trakt yanıtındaki `ids` nesnesi
 * @returns {Array<{source: string, source_id: string}>}
 */
function traktIdsToExternal(tip, ids) {
  if (!ids || typeof ids !== 'object') return [];
  const cikti = [];
  const ekle = (kaynak, deger) => {
    // 0 ve boş string GEÇERSİZ: Trakt eksik kimlikleri bazen `null`,
    // bazen `0` olarak döndürüyor. `0`'ı kimlik sanmak, TÜM eksik
    // kimlikli yapımları tek bir sahte kayda bağlardı.
    if (deger === null || deger === undefined || deger === '' || deger === 0) return;
    // Nesne değerli kimlikler (`plex`) buraya hiç gelmemeli; gelse bile
    // "[object Object]" yazmaktansa atlıyoruz.
    if (typeof deger === 'object') return;
    cikti.push({ source: kaynak, source_id: String(deger) });
  };

  ekle(`trakt:${tip}`, ids.trakt);
  // Slug yalnızca dizi/filmde var (sezon/bölümde yok — ölçüldü).
  ekle('trakt:slug', ids.slug);
  // IMDB kimlikleri tipten BAĞIMSIZ olarak globalde benzersiz (tt...).
  ekle('imdb', ids.imdb);
  ekle(`tvdb:${tip}`, ids.tvdb);
  ekle(`tmdb:${tip}`, ids.tmdb);

  return cikti;
}

/** TMDB tarafı: tek bir kimlik, tipiyle birlikte. */
function tmdbIdToExternal(tip, tmdbId) {
  if (tmdbId === null || tmdbId === undefined || tmdbId === '' || tmdbId === 0) return [];
  return [{ source: `tmdb:${tip}`, source_id: String(tmdbId) }];
}

/**
 * Verilen dış kimliklerden `kaymak_id` çözer; yoksa yeni bir entity yaratır.
 *
 * @param {Object} opts
 * @param {'show'|'movie'|'season'|'episode'|'person'} opts.type
 * @param {Array<{source,source_id}>} opts.externalIds  BOŞ OLAMAZ (aşağıdaki not)
 * @param {Object} [opts.derived]  Türetilmiş alanlar: { title, year, status }
 * @param {string} [opts.parentId] season/episode için üst entity
 * @param {number} [opts.seasonNumber]
 * @param {number} [opts.episodeNumber]
 * @returns {{kaymak_id: string, created: boolean, conflict: boolean}|null}
 *   Arşiv kapalıysa `null`.
 */
function resolveOrCreate({ type, externalIds, derived = {}, parentId = null, seasonNumber = null, episodeNumber = null }) {
  const db = getDb();
  if (!db) return null;

  if (!GECERLI_TIPLER.has(type)) {
    throw new Error(`[Arsiv] Bilinmeyen entity tipi: "${type}"`);
  }
  // 🔴 DIŞ KİMLİKSİZ ENTITY YARATILMAZ. Arama yalnızca `external_ids`
  // üzerinden yapılıyor; kimliksiz bir satır bir daha ASLA bulunamaz ve
  // her çağrıda yenisi eklenerek arşivi sessizce şişirirdi.
  if (!Array.isArray(externalIds) || externalIds.length === 0) {
    throw new Error('[Arsiv] resolveOrCreate: en az bir dis kimlik zorunlu.');
  }

  return transaction(() => {
    const simdi = Date.now();

    // 1) Verilen kimliklerin HANGİLERİ zaten bağlı?
    const bul = db.prepare('SELECT kaymak_id FROM external_ids WHERE source = ? AND source_id = ?');
    const tipBul = db.prepare('SELECT type FROM entities WHERE kaymak_id = ?');
    const bulunanlar = new Set();
    for (const { source, source_id } of externalIds) {
      const satir = bul.get(source, String(source_id));
      if (!satir) continue;

      // 🔴🔴 TİPSİZ ANAHTAR BARİYERİ (2026-09-03, Madde 288)
      // ----------------------------------------------------------------
      // Bu blok bir GERÇEK ÜRETİM HATASINDAN doğdu. Ölçüm: canlı arşivde
      // 44.287 entity'nin 9'u İKİ FARKLI YAPIMIN birleşmiş haliydi ve
      // 9/9'u tipsiz `imdb` anahtarını taşıyordu.
      //
      // Somut vaka: "Sword Art Online the Movie: Ordinal Scale" hem bir
      // FİLM (`trakt:movie 258811`) hem de dizinin ÖZEL BÖLÜMÜ (S0E22,
      // `trakt:episode 2612436`) olarak Trakt'ta duruyor — ve Trakt
      // İKİSİNE DE AYNI `imdb tt5544384` kimliğini veriyor.
      //
      // Eski akış: `archiveShowSeasons` önce bölüm entity'sini yaratıyor
      // (imdb ile), sonra `movie_detail` geldiğinde imdb üzerinden O
      // BÖLÜMÜ buluyor ve film payload'ını bir BÖLÜM entity'sine yazıyordu.
      //
      // 🔴 EN SİNSİ TARAFI: `bulunanlar.size` 1 olduğu için ÇAKIŞMA
      // SAYILMIYORDU — `conflict` sayacı 0'da duruyordu. Yani dosyanın
      // kendi başlığındaki korku aynen gerçekleşti: "arşiv sessizce çift
      // kayıt biriktirir ve bunu FARK ETMEYİZ."
      //
      // Kural: tipsiz bir anahtar YALNIZCA aynı tipteki bir yapımla
      // eşleşebilir. Tipli anahtarlar (`trakt:movie`, `tmdb:show`...)
      // zaten kendi tiplerini taşıdığı için bu bariyere ihtiyaç duymaz.
      //
      // ⚠️ Bu ARAMA tarafı düzeltmesidir; var olan 9 kayda DOKUNMAZ
      // (arşiv silmez/yeniden yazmaz). Onların temizliği + `imdb`'nin
      // `imdb:movie` gibi tiplenmesi ayrı bir bakım turunun işi —
      // 44.287 satırlık bir UPDATE, SSD yeni BOT moduna alındığı için
      // bilerek ertelendi (MASTER_PLAN §0 açık iş).
      if (TIPSIZ_KAYNAKLAR.has(source)) {
        const sahip = tipBul.get(satir.kaymak_id);
        if (sahip && sahip.type !== type) {
          // 🔴 SESSİZ GEÇME YOK. Bu satırın yokluğu hatanın haftalarca
          // görünmemesinin sebebiydi (Madde 284/286: fail-soft sessizdir).
          db.prepare(
            'INSERT INTO sync_log (at, event, kaymak_id, detail) VALUES (?, ?, ?, ?)'
          ).run(
            simdi,
            'conflict',
            satir.kaymak_id,
            `TIPSIZ_ANAHTAR: "${source}/${source_id}" ${sahip.type} tipinde bir yapima bagli, istenen tip ${type} — birlestirme ENGELLENDI`
          );
          continue;
        }
      }

      bulunanlar.add(satir.kaymak_id);
    }

    let cakisma = false;
    let kaymakId;
    let yaratildi = false;

    if (bulunanlar.size > 1) {
      // 🔴 İKİ FARKLI YAPIMA BAĞLI KİMLİKLER — sağlayıcı bir düzeltme
      // yapmış (iki yapımı birleştirmiş) ya da bir kimlik yanlış olabilir.
      // BİRLEŞTİRME YAPMIYORUZ: arşivin geçmişini otomatik yeniden yazmak,
      // sessizce veri kaybı üretir. Olay kaydedilir, insan bakar.
      cakisma = true;
      kaymakId = [...bulunanlar].sort()[0]; // deterministik seçim
      db.prepare(
        'INSERT INTO sync_log (at, event, kaymak_id, detail) VALUES (?, ?, ?, ?)'
      ).run(
        simdi,
        'conflict',
        kaymakId,
        `Dis kimlikler ${bulunanlar.size} farkli yapima bagli: ${[...bulunanlar].join(', ')} | girdi: ${externalIds.map((e) => e.source + '/' + e.source_id).join(', ')}`
      );
    } else if (bulunanlar.size === 1) {
      kaymakId = [...bulunanlar][0];
    } else {
      kaymakId = yeniKaymakId(type);
      yaratildi = true;
      db.prepare(
        `INSERT INTO entities (kaymak_id, type, parent_id, season_number, episode_number, title, year, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        kaymakId, type, parentId, seasonNumber, episodeNumber,
        derived.title ?? null, derived.year ?? null, derived.status ?? null,
        simdi, simdi
      );
    }

    // 2) EKSİK kimlikleri bağla — bu, arşivin zamanla ZENGİNLEŞMESİDİR.
    // İlk görüşte yalnızca trakt ID'si olan bir dizi, ikinci görüşte
    // tmdb + imdb de kazanır. Var olan bağ ASLA başka bir yapıma
    // çevrilmez (schema.sql'deki PK bunu zaten reddeder); yalnızca
    // `last_seen_at` tazelenir.
    const kimlikYaz = db.prepare(
      `INSERT INTO external_ids (source, source_id, kaymak_id, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(source, source_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`
    );
    for (const { source, source_id } of externalIds) {
      const mevcut = bul.get(source, String(source_id));
      if (mevcut && mevcut.kaymak_id !== kaymakId) {
        // Bu kimlik BAŞKA bir yapıma ait — repointlemeyiz (yukarıdaki
        // gerekçe). Yalnızca kaydederiz.
        continue;
      }
      kimlikYaz.run(source, String(source_id), kaymakId, simdi, simdi);
    }

    // 3) Türetilmiş alanları tazele — gerçeğin kaynağı payload, bunlar
    // yalnızca sorgu/kapsam içindir, ama bayat kalmalarının anlamı yok.
    if (!yaratildi && (derived.title || derived.year || derived.status)) {
      db.prepare(
        `UPDATE entities SET
           title  = COALESCE(?, title),
           year   = COALESCE(?, year),
           status = COALESCE(?, status),
           updated_at = ?
         WHERE kaymak_id = ?`
      ).run(derived.title ?? null, derived.year ?? null, derived.status ?? null, simdi, kaymakId);
    }

    return { kaymak_id: kaymakId, created: yaratildi, conflict: cakisma };
  });
}

/**
 * Dış kimlikten `kaymak_id` bulur — YARATMAZ.
 * A4'ün (bağımsızlık anahtarı) sıcak yolu burası olacak: istemci
 * `/shows/1388` isterse önce burada bakılır.
 */
function findByExternal(source, sourceId) {
  const db = getDb();
  if (!db) return null;
  const satir = db
    .prepare('SELECT kaymak_id FROM external_ids WHERE source = ? AND source_id = ?')
    .get(source, String(sourceId));
  return satir ? satir.kaymak_id : null;
}

/**
 * 🆕 Hiyerarşide bir ÇOCUK entity arar — YARATMAZ.
 *
 * 🔴 NEDEN GEREKLİ (Madde 285): `episode_detail` yanıtı bölümün kendi
 * `ids`'ini taşıyor ama SEZONUNUNKİNİ taşımıyor. Bölüm entity'si yaratmak
 * için şema `parent_id` + `season_number` istiyor (CHECK). Sezonun
 * `kaymak_id`'sini bulmanın tek yolu, diziye bağlı sezonu numarasıyla
 * aramaktır.
 *
 * @returns {string|null} bulunan `kaymak_id`, yoksa `null`
 */
function findChild({ parentId, type, seasonNumber = null, episodeNumber = null }) {
  const db = getDb();
  if (!db || !parentId || !type) return null;
  const satir = db
    .prepare(
      `SELECT kaymak_id FROM entities
       WHERE parent_id = ? AND type = ?
         AND season_number IS ? AND episode_number IS ?`
    )
    .get(parentId, type, seasonNumber, episodeNumber);
  return satir ? satir.kaymak_id : null;
}

/** Bir yapımın BİLİNEN tüm dış kimlikleri — teşhis ve A3 backfill için. */
function listExternalIds(kaymakId) {
  const db = getDb();
  if (!db) return [];
  return db
    .prepare('SELECT source, source_id, first_seen_at, last_seen_at FROM external_ids WHERE kaymak_id = ? ORDER BY source')
    .all(kaymakId);
}

module.exports = {
  resolveOrCreate,
  findByExternal,
  findChild,
  listExternalIds,
  traktIdsToExternal,
  tmdbIdToExternal,
  yeniKaymakId,
  TIPSIZ_KAYNAKLAR,
};
