const { promisify } = require('node:util');
const { gunzip } = require('node:zlib');
const { openReadOnly } = require('../archive/db');
const { parseEpisodeSlug } = require('../../utils/slugHelper.ts');
const { afisYoluGecerli } = require('./afis');

const ac = promisify(gunzip);
const MAKS_PAYLOAD = 2 * 1024 * 1024;

function kimliktenVarlik(db, tip, id) {
  return db.prepare(`
    SELECT e.* FROM external_ids x JOIN entities e ON e.kaymak_id = x.kaymak_id
    WHERE x.source = ? AND x.source_id = ? AND x.retired_at IS NULL AND e.type = ?
  `).get(`trakt:${tip}`, String(id), tip);
}

function hedefiCoz(db, hedef) {
  if (hedef.tur === 'show' || hedef.tur === 'movie') {
    return { kok: kimliktenVarlik(db, hedef.tur, hedef.id) };
  }
  if (hedef.tur !== 'season' && hedef.tur !== 'episode') return null;
  const bolum = hedef.tur === 'episode' ? parseEpisodeSlug(hedef.id) : null;
  const sezonNo = bolum ? bolum.season : hedef.season;
  const kok = kimliktenVarlik(db, 'show', bolum ? bolum.showTraktId : hedef.id);
  if (!kok) return null;

  const sezon = db.prepare(`
    SELECT kaymak_id FROM entities WHERE parent_id = ? AND type = 'season' AND season_number = ?
  `).get(kok.kaymak_id, sezonNo);
  if (!sezon) return null;
  if (bolum) {
    const varlik = kimliktenVarlik(db, 'episode', bolum.epTraktId);
    if (!varlik || varlik.parent_id !== sezon.kaymak_id ||
        varlik.season_number !== sezonNo || varlik.episode_number !== bolum.episode) return null;
  }
  return { kok, sezonNo, bolumNo: bolum?.episode };
}

async function tmdbOzeti(db, kok, dil, sezonNo) {
  const aile = kok.type === 'movie' ? 'movie_detail' : 'tv_detail';
  const ara = db.prepare(`
    SELECT body FROM payloads
    WHERE kaymak_id = ? AND provider = 'tmdb' AND endpoint = ? AND lang = ? AND bytes_raw <= ?
  `);
  const diller = [...new Set([dil, 'en', '-', 'tr'])];
  let ozet;
  let afis;
  let sezonAfisi;
  for (const aday of diller) {
    const satir = ara.get(kok.kaymak_id, aile, aday, MAKS_PAYLOAD);
    if (!satir) continue;
    try {
      const veri = JSON.parse(await ac(satir.body, { maxOutputLength: MAKS_PAYLOAD }));
      if (aday === dil || (dil === 'en' && aday === '-')) ozet ||= veri?.overview;
      if (!afis && afisYoluGecerli(veri?.poster_path)) afis = veri.poster_path;
      if (sezonNo !== undefined && !sezonAfisi && Array.isArray(veri?.seasons)) {
        const yol = veri.seasons.find((sezon) => sezon?.season_number === sezonNo)?.poster_path;
        if (afisYoluGecerli(yol)) sezonAfisi = yol;
      }
      if (ozet && (sezonNo === undefined ? afis : sezonAfisi)) break;
    } catch {
      // Bozuk bir dil kaydı diğer arşiv kayıtlarının okunmasını engellemez.
    }
  }
  return { ozet, afis: sezonAfisi || afis };
}

async function katalogOku(hedef, dil, arsiviAc = openReadOnly) {
  const baglanti = arsiviAc();
  if (!baglanti) return null;
  try {
    const hedefKaydi = hedefiCoz(baglanti.db, hedef);
    const kok = hedefKaydi?.kok;
    if (!kok?.title?.trim()) return null;
    const { sezonNo, bolumNo } = hedefKaydi;
    const { ozet, afis } = await tmdbOzeti(baglanti.db, kok, dil, hedef.tur === 'season' ? sezonNo : undefined);

    let aciklama = ozet;
    if (sezonNo !== undefined) {
      aciklama = dil === 'tr' ? `${sezonNo}. sezon` : `Season ${sezonNo}`;
      if (bolumNo !== undefined) aciklama += dil === 'tr' ? ` · ${bolumNo}. bölüm` : ` · Episode ${bolumNo}`;
    }
    const baslik = kok.year ? `${kok.title} (${kok.year})` : kok.title;
    return { baslik, aciklama: typeof aciklama === 'string' ? aciklama : null, afis };
  } finally {
    baglanti.db.close();
  }
}

module.exports = { katalogOku };
