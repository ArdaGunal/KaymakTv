// ==========================================================================
// KATALOG ARŞİVİ — Okuma Tarafı (A4, dosya 1/2)
// ==========================================================================
// TEK İŞİ: bir LazyFetch isteğini (`provider` + `family` + `path` + `query`)
// arşivdeki ham yanıta çevirmek. Yani `writer.js`'in TAM TERSİ.
//
// NE ZAMAN ÇAĞRILIR: yalnızca SAĞLAYICI BAŞARISIZ OLDUĞUNDA ve elde
// kullanılabilir bir cache zarfı da kalmadığında. Sıcak yolda DEĞİL.
//
// ==========================================================================
// 🔴 KARAR A5 (2026-09-04): ARŞİV-ÖNCE DEĞİL, GERİ DÜŞÜŞ
// ==========================================================================
// `03_FAZLAR.md` A4'ü eskiden *"sıra `Trakt → arşiv` yerine `arşiv → Trakt`
// olur"* diye tarif ediyordu. Bu REDDEDİLDİ, çünkü arşivin TAZELİK KAVRAMI
// YOK (TTL yok, SWR yok) — oysa `routeRegistry.js` yayını süren dizilere
// 7 günlük özel bir tazelik veriyor. Arşivi öne almak, *House of the
// Dragon*'ın bölüm listesini KALICI OLARAK DONDURURDU.
//
// Yürürlükteki akış (`04_KARARLAR.md` §A5):
//   cache taze/bayat  → cache döner (arşive hiç bakılmaz)
//   sağlayıcı başarılı → sağlayıcı döner
//   sağlayıcı ÇÖKTÜ   → 1) grace fallback (eski cache zarfı)
//                       2) 🆕 BU DOSYA (arşiv)
//                       3) hata yukarı
//
// 🔴 ARŞİV, GRACE FALLBACK'İN ARDINA GİRER — ÖNÜNE DEĞİL. Eski bir cache
// zarfı arşivdeki kayıttan DAHA TAZE olabilir: cache her istekte yazılıyor,
// arşiv ise yalnızca sağlayıcıya gidilen isteklerde + gece backfill'de.
// Sırayı ters kurmak, elimizdeki en taze veriyi ıskalamak olurdu.

const { getDb } = require('./db');
const { findByExternal, findChild } = require('./identity');
const { readPayload } = require('./store');
// 🔴 ANAHTAR TÜRETME YAZICIDAN GELİYOR, KOPYALANMIYOR.
// `dilCoz` ve `yoldanKimlik` burada yeniden yazılsaydı iki taraf zamanla
// ıraksardı: bir anahtarla YAZIP başka bir anahtarla ARARDIK ve arşiv
// "boş" görünürdü. Madde 286 tam olarak bu ailedendi (dil yanlış
// etiketlenince 523 mükerrer satır). Test bu eşitliği ayrıca kilitliyor.
const { dilCoz, yoldanKimlik, DESTEKLENEN_AILELER } = require('./writer');

/**
 * 🔴 ACİL KAPATMA. Arşiv geri düşüşü beklenmedik bir davranış üretirse
 * (yanlış veri, yavaşlık) build beklemeden kapatılabilmeli:
 *   Pi'de `.env` → `ARSIV_GERI_DUSUS=0` + `systemctl restart kaymak`
 * Kapatıldığında davranış A4 ÖNCESİNE döner: sağlayıcı çökerse hata yukarı
 * gider (grace fallback yine çalışır). Yani kapatmak kimseyi kırmaz.
 */
function geriDususAcikMi() {
  const v = process.env.ARSIV_GERI_DUSUS;
  if (v === undefined || v === '') return true; // varsayılan AÇIK
  return !['0', 'false', 'hayir', 'no', 'off'].includes(String(v).trim().toLowerCase());
}

/**
 * İstek yolundan `kaymak_id` çözer.
 *
 * 🔴🔴 HİÇBİR ŞEY YARATMAZ — `resolveOrCreate` BURADA KULLANILMAZ.
 * Yazıcı yaratabilir (elinde gerçek veri vardır); okuyucu ASLA. Sebebi
 * somut: bu fonksiyon TAM DA SAĞLAYICI ÇÖKTÜĞÜNDE çağrılıyor, yani
 * isteklerin biriktiği anda. `resolveOrCreate` kullansaydık her başarısız
 * istek arşive BOŞ bir entity kabuğu eklerdi ve bir Trakt kesintisi
 * arşivi binlerce sahte kayıtla şişirirdi — üstelik arşiv hiçbir şeyi
 * silmediği için geri dönüşü olmadan.
 *
 * @returns {string|null}
 */
function yoldanKaymakId(family, path) {
  const db = getDb();
  if (!db) return null;

  // --- Bölüm: hiyerarşi ile çözülür (yazıcıdaki `archiveEpisodeDetail`in tersi)
  if (family === 'episode_detail') {
    const m = /^\/shows\/([^/]+)\/seasons\/(\d+)\/episodes\/(\d+)$/.exec(path || '');
    if (!m) return null;
    const [, diziId, sezonNo, bolumNo] = m;

    const dizi = kimlikleriAra(yoldanKimlik('show', diziId));
    if (!dizi) return null;

    const sezon = findChild({ parentId: dizi, type: 'season', seasonNumber: Number(sezonNo) });
    if (!sezon) return null;

    return findChild({
      parentId: sezon, type: 'episode',
      seasonNumber: Number(sezonNo), episodeNumber: Number(bolumNo),
    });
  }

  // --- Dizi/film: yolun ilk kimliği yeter
  const m = /^\/(shows|movies)\/([^/]+)/.exec(path || '');
  if (!m) return null;
  const tip = m[1] === 'movies' ? 'movie' : 'show';
  return kimlikleriAra(yoldanKimlik(tip, m[2]));
}

/** `yoldanKimlik` çıktısındaki ilk eşleşmeyi döndürür. */
function kimlikleriAra(kimlikler) {
  for (const { source, source_id } of kimlikler || []) {
    const id = findByExternal(source, source_id);
    if (id) return id;
  }
  return null;
}

/**
 * Arşivden bir katalog yanıtı okur.
 *
 * 🔴 ASLA THROW ETMEZ. Bu bir GERİ DÜŞÜŞ yolu: buradan sızacak bir hata,
 * çağıranın elindeki GERÇEK sağlayıcı hatasının yerini alır ve teşhisi
 * bozardı ("Trakt 504 verdi" yerine "sqlite ... " görürdük). Her başarısızlık
 * `{ok:false, reason}` olarak döner, çağıran orijinal hatayı fırlatmaya
 * devam eder.
 *
 * @returns {Promise<{ok:boolean, data?:any, fetchedAt?:number, updatedAt?:number, reason?:string}>}
 */
async function readCatalogFromArchive({ provider, family, path, query = {} }) {
  try {
    if (!geriDususAcikMi()) return { ok: false, reason: 'geri_dusus_kapali' };
    if (provider !== 'trakt') return { ok: false, reason: 'desteklenmeyen_saglayici' };

    // 🔴 Yazıcının listesiyle AYNI KÜME — ayrı bir liste tutmak, bir aile
    // arşive eklendiğinde okuma tarafının sessizce geride kalması demekti.
    if (!DESTEKLENEN_AILELER.has(family)) return { ok: false, reason: 'kapsam_disi_aile' };

    if (!getDb()) return { ok: false, reason: 'arsiv_kapali' };

    const kaymakId = yoldanKaymakId(family, path);
    if (!kaymakId) return { ok: false, reason: 'kimlik_bulunamadi' };

    // 🔴 DİL, YAZICININ ÇÖZDÜĞÜ DİLLE AYNI FONKSİYONDAN geliyor (`dilCoz`).
    // `show_seasons` dilsizdir ('-'), diğer üçü `translations=tr` taşır —
    // bu asimetri ÖLÇÜLDÜ (Madde 288), varsayılmadı.
    return await readPayload({
      kaymakId, provider: 'trakt', endpoint: family, lang: dilCoz(query),
    });
  } catch (error) {
    return { ok: false, reason: `okuyucu: ${error.message}` };
  }
}

module.exports = {
  readCatalogFromArchive,
  geriDususAcikMi,
  // Yalnızca test/teşhis için.
  yoldanKaymakId,
};
