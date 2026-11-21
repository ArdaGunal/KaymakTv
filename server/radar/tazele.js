const { NotFoundError } = require('../lazyfetch/errors');
const { tazeYanitHazirla } = require('../lazyfetch/fetchAndStore');
const { radarCek } = require('./akis');
const { idMi, numaraMi, RadarHatasi, TRAKT_OZET, TRAKT_SEZON, TMDB_DIL } = require('./ayar');


async function kataloguCek(is, saglayicilar, dur, saat, cagir = radarCek) {
  const hazir = [];
  async function cek(provider, path, query, { istegeBagli = false, arsiv = true } = {}) {
    const fetchedAt = saat();
    const fetcher = saglayicilar[provider];
    if (!fetcher) throw new RadarHatasi(`${provider}_yapilandirma`);
    let yanit;
    try {
      yanit = await cagir(provider, fetcher, path, query, dur);
    } catch (error) {
      if (istegeBagli && error instanceof NotFoundError) return null;
      throw error;
    }
    if (yanit.storable === false) throw new RadarHatasi('saklama_yasak');
    if (arsiv) hazir.push(tazeYanitHazirla({ provider, path, query, yanit, fetchedAt }));
    return yanit.data;
  }

  const dizi = is.tur === 'show';
  const traktYol = `/${dizi ? 'shows' : 'movies'}/${is.trakt_id}`;
  const trakt = await cek('trakt', traktYol, TRAKT_OZET);
  if (trakt?.ids?.trakt !== is.trakt_id) throw new RadarHatasi('trakt_icerik_kimligi');
  const sezonlar = dizi ? await cek('trakt', `${traktYol}/seasons`, TRAKT_SEZON) : null;
  const tmdbId = trakt.ids.tmdb || is.tmdb_id;
  if (tmdbId != null && !idMi(tmdbId)) throw new RadarHatasi('tmdb_icerik_kimligi');
  const tmdbYol = `/${dizi ? 'tv' : 'movie'}/${tmdbId}`;
  const tmdb = tmdbId && saglayicilar.tmdb
    ? await cek('tmdb', tmdbYol, TMDB_DIL, { istegeBagli: true }) : null;
  if (tmdb && tmdb.id !== tmdbId) throw new RadarHatasi('tmdb_icerik_kimligi');

  const tmdbSezonlar = new Map();
  // TMDB özetinde bölüm listesi yok. Sezon yanıtı tarih-yalnız
  // bölümleri topluca getirir, bölüm başına yeni bir istek gerekmez.
  for (const s of dizi && Array.isArray(tmdb?.seasons) ? tmdb.seasons : []) {
    const no = s?.season_number;
    if (!numaraMi(no) || !idMi(s.id) || tmdbSezonlar.has(no)) continue;
    const detay = await cek('tmdb', `${tmdbYol}/season/${no}`, TMDB_DIL, { istegeBagli: true, arsiv: false });
    tmdbSezonlar.set(no, detay?.id === s.id && detay.season_number === no ? detay : null);
  }
  return { ...is, trakt, sezonlar, tmdb, tmdbSezonlar, tmdbId, tmdbBekleniyor: !!tmdbId, hazir };
}

module.exports = { kataloguCek };
