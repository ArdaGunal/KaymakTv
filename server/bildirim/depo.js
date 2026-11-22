const { openReadOnly } = require('../archive/db');
const { kokKimligi, uyeKimligi } = require('./planlayici');

function arsivTakvimi(kimlikler) {
  if (!kimlikler.length) return new Map();
  const baglanti = openReadOnly();
  if (!baglanti) throw new Error('arsiv_kapali');
  const { db } = baglanti;
  try {
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='radar_takvim'").get()) {
      throw new Error('radar_takvimi_yok');
    }
    const satirlar = db.prepare(`
      SELECT t.tur, t.trakt_id, t.takvim_rev, t.aynalanan_rev, t.veri, e.title AS baslik,
        (SELECT source_id FROM external_ids WHERE kaymak_id=t.kaymak_id AND source='tmdb:movie'
          AND retired_at IS NULL ORDER BY last_seen_at DESC, source_id LIMIT 1) AS tmdb_id
      FROM json_each(?) j JOIN radar_takvim t ON t.tur=json_extract(j.value,'$.tur')
        AND t.trakt_id=json_extract(j.value,'$.trakt_id')
      JOIN entities e ON e.kaymak_id=t.kaymak_id
    `).all(JSON.stringify(kimlikler));
    return new Map(satirlar.map(({ veri, ...r }) => {
      try {
        const takvim = JSON.parse(veri);
        if (!Array.isArray(takvim?.satirlar) || takvim.satirlar.some((s) => !s || typeof s !== 'object')) {
          throw new Error('takvim_satirlari');
        }
        return [kokKimligi(r), { ...r, ...takvim }];
      } catch {
        return [kokKimligi(r), { ...r, bozuk: true }];
      }
    }));
  } finally {
    db.close();
  }
}

function takvimiDogrula(icerikler, oku = arsivTakvimi) {
  const kokler = oku([...new Map(icerikler.map((i) => [kokKimligi(i), { tur: i.tur, trakt_id: i.trakt_id }])).values()]);
  const guncel = [];
  let belirsiz = false;
  for (const i of icerikler) {
    const kok = kokler.get(kokKimligi(i));
    const satir = kok?.satirlar?.find((s) => uyeKimligi({ ...kok, ...s }) === i.kimlik);
    if (!satir || satir.durum === 'eksik_yanit' || kok.takvim_rev < i.takvim_rev || kok.aynalanan_rev < i.takvim_rev) {
      belirsiz = true;
      continue;
    }
    if (satir.tarih !== i.tarih || satir.an_turu !== i.an_turu || satir.durum !== i.durum) return { neden: 'tarih_degisti' };
    guncel.push({ ...i, takvim_rev: Math.min(kok.takvim_rev, kok.aynalanan_rev) });
  }
  return belirsiz ? { neden: 'takvim_belirsiz' } : { icerikler: guncel };
}

module.exports = { arsivTakvimi, takvimiDogrula };
