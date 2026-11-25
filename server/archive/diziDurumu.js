// K-54: kaynak sözlüğü ve bütün arşiv yazıcılarının kullandığı tek durum kapısı.
const ORTAK = new Map([
  ['returning series', 'devam'],
  ['ended', 'bitti'],
  ['canceled', 'iptal'],
  ['cancelled', 'iptal'],
  ['in production', 'yapimda'],
  ['planned', 'planli'],
  ['pilot', 'planli'],
]);
const GECERLI_AILE = { tmdb: 'tv_detail', trakt: 'show_detail' };

function diziDurumu(tmdb, trakt) {
  for (const [durum, kaynak] of [[tmdb, 'tmdb'], [trakt, 'trakt']]) {
    if (durum == null) continue;
    const ham = typeof durum === 'string' ? durum.trim().toLowerCase() : '';
    const normal = kaynak === 'trakt' && ham === 'upcoming' ? 'planli' : ORTAK.get(ham);
    if (normal) return { durum: normal, kaynak };
  }
  return { durum: 'bilinmiyor', kaynak: tmdb != null ? 'tmdb' : trakt != null ? 'trakt' : null };
}

function durumAilesiMi(provider, endpoint) {
  return GECERLI_AILE[provider] === endpoint && (provider === 'tmdb' || provider === 'trakt');
}

function kalite(durum, kaynak) {
  if (!durum || durum === 'bilinmiyor') return 0;
  return kaynak === 'tmdb' ? 2 : 1;
}

function diziDurumunuYaz(db, { kaymakId, provider, endpoint, fetchedAt, hamDurum }, simdi = Date.now()) {
  if (!durumAilesiMi(provider, endpoint) || typeof hamDurum !== 'string' || !hamDurum.trim() ||
      !Number.isSafeInteger(fetchedAt) || fetchedAt < 0 || fetchedAt > 8.64e15) return false;

  const yeni = provider === 'tmdb' ? diziDurumu(hamDurum, null) : diziDurumu(null, hamDurum);
  const kaynak = yeni.kaynak ?? provider;
  const eski = db.prepare(`
    SELECT yayin_durumu, durum_kaynak, durum_at FROM entities WHERE kaymak_id=? AND type='show'
  `).get(kaymakId);
  if (!eski) return false;

  const yeniKalite = kalite(yeni.durum, kaynak);
  const eskiKalite = kalite(eski.yayin_durumu, eski.durum_kaynak);
  if (yeniKalite < eskiKalite || (yeniKalite === eskiKalite && eski.durum_at != null && fetchedAt <= eski.durum_at)) {
    return false;
  }

  const degisti = eski.yayin_durumu !== yeni.durum || eski.durum_kaynak !== kaynak;
  db.prepare(`
    UPDATE entities SET yayin_durumu=?, durum_kaynak=?, durum_at=?, updated_at=max(updated_at, ?)
    WHERE kaymak_id=?
  `).run(yeni.durum, kaynak, fetchedAt, simdi, kaymakId);
  return degisti;
}

function durumAynaAlanlari(varlik) {
  if (varlik.type !== 'show') return { yayin_durumu: null, durum_kaynak: null, durum_at: null };
  const tarih = new Date(varlik.durum_at ?? NaN);
  return {
    yayin_durumu: varlik.yayin_durumu ?? null,
    durum_kaynak: varlik.durum_kaynak ?? null,
    durum_at: Number.isFinite(tarih.getTime()) ? tarih.toISOString() : null,
  };
}

module.exports = { diziDurumu, durumAilesiMi, diziDurumunuYaz, durumAynaAlanlari };
