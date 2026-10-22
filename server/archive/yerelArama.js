// ==========================================================================
// KATALOG ARŞİVİ — Yerel başlık araması  (K5 · M533)
// ==========================================================================
// TEK İŞİ: Trakt araması çalışmadığında (kesinti, devre açık) arşivdeki
// dizi/filmler arasında başlıkla arama yapıp Trakt'ın `/search/:type` yanıtıyla
// AYNI ŞEKİLDE dönmek. Kullanıcı + danışman kararı (2026-10-18): Google-only
// kullanıcının araması Trakt'a mahkûm kalmasın.
//
// Kapsam dürüstçe sınırlı: yalnız arşivdeki yapımlar (canlı 2026-10-18: 1.001
// dizi, 1.245 film — kullanıcılarımızın dokunduğu her şey). Arşivde olmayan bir
// yapım bu yolla BULUNAMAZ; bu yüzden yalnız GERİ DÜŞÜŞ olarak kullanılır.
//
// Yanıt öğesi: `{ type, score, show|movie: <künye> }`. Künye mümkünse arşivdeki
// TAM Trakt yanıtıdır (`show_detail`/`movie_detail`, `extended=full` — aramanın
// döndürdüğü şekil); yoksa `entities` + `external_ids`'ten kurulan asgari künye.
// Trakt kimliği olmayan yapım dönmez (istemci gezinmede onu kullanıyor).
// SALT OKUMA; asla throw etmez.

const { getDb } = require('./db');
const { readPayload, DILSIZ } = require('./store');

const VARSAYILAN_LIMIT = 10;

function kimlikleriTopla(db, kaymakId, tur) {
  const ids = {};
  for (const { source, source_id } of db
    .prepare('SELECT source, source_id FROM external_ids WHERE kaymak_id = ? AND retired_at IS NULL')
    .all(kaymakId)) {
    if (source === `trakt:${tur}`) ids.trakt = Number(source_id);
    else if (source === `tmdb:${tur}`) ids.tmdb = Number(source_id);
    else if (source === 'trakt:slug') ids.slug = source_id;
    else if (source === 'imdb') ids.imdb = source_id;
  }
  return ids;
}

async function arsivKunyesi(kaymakId, tur) {
  const endpoint = tur === 'show' ? 'show_detail' : 'movie_detail';
  for (const lang of ['tr', 'en', DILSIZ]) {
    const yuk = await readPayload({ kaymakId, provider: 'trakt', endpoint, lang });
    if (yuk.ok && yuk.data && yuk.data.ids && yuk.data.ids.trakt) return yuk.data;
  }
  return null;
}

/**
 * Arama için Türkçe katlama: NFC + `tr` küçük harf, sonra noktasız «ı» → «i» (İ/I/ı/i hepsi eşleşsin).
 * Saf — sınanır.
 */
function katla(metin) {
  return String(metin).normalize('NFC').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i');
}

/**
 * @param {'show'|'movie'} tur
 * @param {string} sorgu
 * @returns {Promise<Array>} Trakt `/search/:type` şeklinde; bulunamazsa ya da hata olursa [].
 */
async function yerelAra(tur, sorgu, limit = VARSAYILAN_LIMIT) {
  if (tur !== 'show' && tur !== 'movie') return [];
  const metin = String(sorgu || '').trim();
  if (!metin) return [];
  const db = getDb();
  if (!db) return [];
  try {
    // 🆕 M558 · D-11: eşleştirme JS'te, TÜRKÇE kurallarla. SQLite `LIKE`/`lower()` yalnız ASCII'de büyük/küçük
    // harfi katlıyordu: «şahsiyet» «Şahsiyet»i bulmuyordu. Dizi+film başlıkları ~2,3 bin satır — her aramada
    // taramak ucuz (ms). Sıra aynı: tam eşleşme → başta geçen → kısa başlık. Joker karakter sorunu da yok.
    const aranan = katla(metin);
    const satirlar = db.prepare('SELECT kaymak_id, title, year FROM entities WHERE type = ? AND title IS NOT NULL')
      .all(tur)
      .map((r) => ({ ...r, k: katla(r.title) }))
      .filter((r) => r.k.includes(aranan))
      .sort((x, y) => (y.k === aranan) - (x.k === aranan) || y.k.startsWith(aranan) - x.k.startsWith(aranan) || x.title.length - y.title.length)
      .slice(0, limit * 2);

    const sonuc = [];
    for (const s of satirlar) {
      if (sonuc.length >= limit) break;
      const kunye = (await arsivKunyesi(s.kaymak_id, tur))
        || { title: s.title, year: s.year, ids: kimlikleriTopla(db, s.kaymak_id, tur) };
      if (!kunye.ids || !kunye.ids.trakt) continue;
      sonuc.push({ type: tur, score: 0, [tur]: kunye });
    }
    return sonuc;
  } catch (_) {
    return [];
  }
}

module.exports = { yerelAra, katla };
