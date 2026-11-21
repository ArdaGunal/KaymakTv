const { getDb, transactionAsync } = require('../archive/db');
const { dilCoz } = require('../archive/writer');
const { findByExternal, resolveOrCreate, tmdbIdToExternal, traktIdsToExternal } = require('../archive/identity');
const { payloadHazirla, hazirPayloadYaz } = require('../archive/store');
const { sezonAgaciniYaz } = require('../archive/sezonAgaci');
const { takvimCikar, olaylariCikar } = require('./takvim');
const { gidenKutusuBuda } = require('./gidenKutusu');
const { idMi, numaraMi, radarKapilari } = require('./ayar');

function tmdbAgaciniTamamla(db, kok, veri) {
  const bul = db.prepare(`SELECT kaymak_id FROM entities
    WHERE parent_id=? AND type=? AND season_number=? AND coalesce(episode_number,-1)=?`);
  function eldeEt(tip, ust, sezon, bolum, id, title) {
    const varlik = bul.get(ust, tip, sezon, bolum ?? -1);
    if (varlik) return varlik.kaymak_id;
    return resolveOrCreate({
      type: tip, parentId: ust, seasonNumber: sezon, episodeNumber: bolum,
      externalIds: tmdbIdToExternal(tip, id), derived: { title },
    })?.kaymak_id;
  }
  const eksikSezonlar = new Set();
  for (const s of Array.isArray(veri.tmdb?.seasons) ? veri.tmdb.seasons : []) {
    if (!numaraMi(s?.season_number) || !idMi(s?.id)) continue;
    const sezon = s.season_number;
    const ust = eldeEt('season', kok, sezon, null, s.id, s.name);
    if (!ust) { eksikSezonlar.add(sezon); continue; }
    const detay = veri.tmdbSezonlar?.get(sezon);
    for (const b of Array.isArray(detay?.episodes) ? detay.episodes : []) {
      if (!idMi(b?.episode_number) || !idMi(b?.id)) continue;
      if (!eldeEt('episode', ust, sezon, b.episode_number, b.id, b.name)) {
        eksikSezonlar.add(sezon);
      }
    }
  }
  return eksikSezonlar;
}

const ret = (reason) => ({ ok: false, reason });

function arsivYaz(db, veri, mevcutKok, girdiler, yeni) {
  const { tur, trakt, tmdbId } = veri;
  const kimlikler = traktIdsToExternal(tur, trakt.ids);
  if (!trakt.ids.tmdb && tmdbId) kimlikler.push(...tmdbIdToExternal(tur, tmdbId));
  const kok = resolveOrCreate({
    type: tur, externalIds: kimlikler,
    derived: mevcutKok ? {} : { title: trakt.title, year: trakt.year, status: trakt.status },
  });
  if (!kok || (mevcutKok && mevcutKok !== kok.kaymak_id) ||
      (tmdbId && findByExternal(`tmdb:${tur}`, String(tmdbId)) !== kok.kaymak_id)) {
    return ret('arsiv_kimligi_degisti');
  }

  const damga = db.prepare('SELECT max(fetched_at) AS at FROM payloads WHERE kaymak_id=? AND provider=? AND endpoint=? AND lang=?');
  const yazilan = [];
  const eksikSezonlar = new Set();
  for (const g of girdiler) {
    const { is, sikisik } = g;
    const sezon = is.family === 'show_seasons';
    const traktFilm = tur === 'movie' && is.provider === 'trakt';
    if (traktFilm && !yeni.traktTam) continue;
    if (damga.get(kok.kaymak_id, is.provider, is.family, dilCoz(is.query)).at > is.fetchedAt) {
      if (sezon && !yeni.traktTam) continue;
      return ret('daha_yeni_yanit');
    }
    if (sezon && Array.isArray(is.data) && is.data.length) {
      const agac = sezonAgaciniYaz(kok, is.data, true, !yeni.traktTam);
      let adim = agac.next();
      while (!adim.done) adim = agac.next();
      for (const no of adim.value.eksikSezonlar) eksikSezonlar.add(no);
      if (adim.value.skipped) continue;
    }
    if (sezon && !yeni.traktTam) continue;
    if (sikisik) hazirPayloadYaz(db, {
      kaymakId: kok.kaymak_id, provider: is.provider, endpoint: is.family,
      lang: dilCoz(is.query), fetchedAt: is.fetchedAt, ...sikisik,
    });
    yazilan.push(g);
  }
  if (tur === 'show') for (const no of tmdbAgaciniTamamla(db, kok.kaymak_id, veri)) eksikSezonlar.add(no);
  return { ok: true, kaymakId: kok.kaymak_id, yazilan, eksikSezonlar };
}

function takvimIslemi(db, veri, beklenenRev, simdi, hamGirdiler, onceki, yeni, olayAcik) {
  const { tur, trakt_id } = veri;
  const durum = db.prepare('SELECT * FROM radar_takvim WHERE tur=? AND trakt_id=?').get(tur, trakt_id);
  if ((durum?.takvim_rev ?? 0) !== beklenenRev) return ret('eski_revizyon');
  const mevcutKok = findByExternal(`trakt:${tur}`, String(trakt_id));
  if (durum && durum.kaymak_id !== mevcutKok) return ret('arsiv_kimligi_degisti');
  const sonuc = arsivYaz(db, veri, mevcutKok, hamGirdiler, yeni);
  if (!sonuc.ok) return sonuc;
  if (sonuc.eksikSezonlar.size) {
    yeni = takvimCikar(veri, onceki, durum?.kaynak_at, sonuc.eksikSezonlar);
  }
  const kok = sonuc.kaymakId;

  const json = JSON.stringify(yeni);
  const degisti = durum?.veri !== json;
  const rev = beklenenRev + Number(degisti);
  db.prepare(`INSERT INTO radar_takvim (tur,trakt_id,kaymak_id,takvim_rev,kaynak_at,ayna_hazir_at,veri)
    VALUES (?,?,?,?,?,?,?) ON CONFLICT(tur,trakt_id) DO UPDATE SET
    kaynak_at=excluded.kaynak_at, takvim_rev=excluded.takvim_rev, veri=excluded.veri,
    ayna_bekliyor=CASE WHEN takvim_rev<>excluded.takvim_rev THEN 1 ELSE ayna_bekliyor END,
    ayna_hazir_at=CASE WHEN takvim_rev<>excluded.takvim_rev THEN excluded.ayna_hazir_at ELSE ayna_hazir_at END,
    ayna_deneme=CASE WHEN takvim_rev<>excluded.takvim_rev THEN 0 ELSE ayna_deneme END
  `).run(tur, trakt_id, kok, rev, simdi, simdi, json);

  if (durum && degisti) {
    const ekle = db.prepare(`INSERT INTO radar_giden (olay_anahtari,icerik_tur,trakt_id,takvim_rev,olay)
      VALUES (?,?,?,?,?) ON CONFLICT(olay_anahtari) DO NOTHING`);
    const olaylar = olaylariCikar(veri, onceki, yeni, rev, simdi);
    for (const olay of olaylar) {
      ekle.run(olay.olay_anahtari, olay.icerik_tur, olay.trakt_id, rev, JSON.stringify(olay));
    }
    if (olaylar.length && !olayAcik) gidenKutusuBuda(db, simdi);
  }
  if (!durum || JSON.stringify(onceki) !== JSON.stringify(yeni.satirlar)) {
    db.prepare(`UPDATE entities SET updated_at=max(updated_at,?) WHERE kaymak_id=? OR parent_id=?
      OR parent_id IN (SELECT kaymak_id FROM entities WHERE parent_id=?)`).run(simdi, kok, kok, kok);
  }
  return { ok: true, rev, tam: yeni.tam, girdiler: sonuc.yazilan, cakisma: [...sonuc.eksikSezonlar].some((no) => no !== 0) };
}

async function takvimiYaz({ veri, beklenenRev, simdi, olayAcik = radarKapilari(process.env).olay }) {
  const hazir = await Promise.all(veri.hazir.map(async (g) => ({
    ...g,
    sikisik: g.is.family === 'show_seasons' && !g.is.data?.length ? null : await payloadHazirla(g.is.data),
  })));
  const db = getDb();
  if (!db) return ret('arsiv_kapali');
  const temel = db.prepare('SELECT veri,kaynak_at FROM radar_takvim WHERE tur=? AND trakt_id=?').get(veri.tur, veri.trakt_id);
  const onceki = temel ? JSON.parse(temel.veri).satirlar : [];
  const yeni = takvimCikar(veri, onceki, temel?.kaynak_at);
  return transactionAsync((h) => {
    // Beklenen ret yanıtı bile kimlik ve yük değişikliklerini geri alır.
    h.exec('SAVEPOINT radar_yazim');
    const sonuc = takvimIslemi(h, veri, beklenenRev, simdi, hazir, onceki, yeni, olayAcik);
    if (!sonuc.ok) h.exec('ROLLBACK TO radar_yazim');
    h.exec('RELEASE radar_yazim');
    return sonuc;
  });
}

module.exports = { takvimiYaz };
