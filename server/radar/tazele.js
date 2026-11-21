const { NotFoundError } = require('../lazyfetch/errors');
const { tazeYanitHazirla } = require('../lazyfetch/fetchAndStore');
const { radarCek } = require('./akis');
const { idMi, numaraMi, RadarHatasi, TRAKT_OZET, TRAKT_SEZON, TMDB_DIL, GUN, TMDB_GECMIS_SEZON_TAZELIGI, TMDB_GECMIS_SEZON_TAVANI } = require('./ayar');


async function kataloguCek(is, saglayicilar, dur, saat, cagir = radarCek, gecmis = new Map()) {
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
  const tmdbOnbellekliSezonlar = new Set();
  // TMDB özetinde bölüm listesi yok. Sezon yanıtı tarih-yalnız
  // bölümleri topluca getirir, bölüm başına yeni bir istek gerekmez.
  for (const s of dizi && Array.isArray(tmdb?.seasons) ? tmdb.seasons : []) {
    const no = s?.season_number;
    if (!numaraMi(no) || !idMi(s.id) || tmdbSezonlar.has(no)) continue;
    const simdi = saat();
    const gecmisMi = no > 0 && no < tmdb.last_episode_to_air?.season_number &&
      idMi(s.episode_count) && Date.parse(s.air_date) < simdi - 7 * GUN;
    const anahtar = JSON.stringify([tmdbId, s.id, no, s.air_date, s.episode_count]);
    const eski = gecmisMi ? gecmis.get(anahtar) : null;
    if (eski && simdi < eski.son) {
      tmdbSezonlar.set(no, eski.detay);
      tmdbOnbellekliSezonlar.add(no);
      continue;
    }
    dur();
    const detay = await cek('tmdb', `${tmdbYol}/season/${no}`, TMDB_DIL, { istegeBagli: true, arsiv: false });
    const gecerli = detay?.id === s.id && detay.season_number === no ? detay : null;
    tmdbSezonlar.set(no, gecerli);
    if (gecmisMi && Array.isArray(gecerli?.episodes) && gecerli.episodes.length === s.episode_count &&
        gecerli.episodes.every((b) => idMi(b?.id) && idMi(b?.episode_number) && Date.parse(b.air_date) < simdi - 7 * GUN) &&
        new Set(gecerli.episodes.map((b) => b.episode_number)).size === s.episode_count) {
      gecmis.delete(anahtar);
      const ozet = { id: gecerli.id, season_number: gecerli.season_number,
        episodes: gecerli.episodes.map(({ id, episode_number, air_date, name, status }) =>
          ({ id, episode_number, air_date, name, status })) };
      gecmis.set(anahtar, { detay: ozet, son: simdi + TMDB_GECMIS_SEZON_TAZELIGI });
      if (gecmis.size > TMDB_GECMIS_SEZON_TAVANI) gecmis.delete(gecmis.keys().next().value);
    }
  }
  return { ...is, trakt, sezonlar, tmdb, tmdbSezonlar, tmdbOnbellekliSezonlar, tmdbId, tmdbBekleniyor: !!tmdbId, hazir };
}

module.exports = { kataloguCek };
