const { geceIsleriAcikMi } = require('../geceIsleri');

const DAKIKA = 60_000;
const SAAT = 60 * DAKIKA;
const GUN = 24 * SAAT;

// DOĞRULANACAK: uçların sayfa boyları, pencere ve oran sınırları.
// TMDB sayfa boyunu sağlayıcı belirler. İstek bütçesi LazyFetch'in tokenBucket örneğinden gelir.
const AKISLAR = [
  { ad: 'tmdb_show', saglayici: 'tmdb', tur: 'show', yol: '/tv/changes', pencere: 14 * GUN },
  { ad: 'tmdb_movie', saglayici: 'tmdb', tur: 'movie', yol: '/movie/changes', pencere: 14 * GUN },
  { ad: 'trakt_show', saglayici: 'trakt', tur: 'show', yol: '/shows/updates', sayfa: 100, pencere: 30 * GUN },
  { ad: 'trakt_movie', saglayici: 'trakt', tur: 'movie', yol: '/movies/updates', sayfa: 100, pencere: 30 * GUN },
];
const TAKIP_ARALIGI = 10 * DAKIKA;
// Worker katalog yolu iki 25 sn deneme yapabilir. GNL'nin zaman
// aşımından sonra 50 sn yürütme süresi + 25 sn pay bırak.
const AYNA_BELIRSIZ_BEKLEME_MS = 75_000;
const OLAY_PARTISI = 500;
const OLAY_GOVDE_TAVANI = 900_000;
const DENEME_TAVANI = 5;
const YENI_IS_PARTISI = 4;
const YENI_IS_ARALIGI = 30_000;
// DOĞRULANACAK: TMDB sayfa tavanı, Trakt/TMDB katalog sorguları ve ortak kova rezervi.
const TMDB_SAYFA_TAVANI = 500;
const TRAKT_OZET = { extended: 'full', translations: 'tr' };
const TRAKT_SEZON = { extended: 'full,episodes' };
const TMDB_DIL = { language: 'tr-TR' };
const TAKIP_SAYFASI = 1000;
const KOVA_REZERVI = 0.30;
const KOTA_YEREL_DENEME = 4;
const KOTA_YEREL_BEKLEME = 500;
const RADAR_DEVRE = { failureThreshold: 5, openDurationMs: DAKIKA };
const TELAFI_PARTISI = 100;
const IS_PARTISI = 25;

const gun = (at) => new Date(at).toISOString().slice(0, 10);
const idMi = (id) => Number.isSafeInteger(id) && id > 0;
const numaraMi = (n) => Number.isSafeInteger(n) && n >= 0;
const iso = (at) => new Date(at).toISOString();

function radarKapilari(ortam) {
  const acik = ortam.RADAR_ACIK === '1' && geceIsleriAcikMi(ortam);
  return { acik, yaz: acik && ortam.RADAR_YAZ === '1', olay: acik && ortam.RADAR_OLAY === '1' };
}

class RadarHatasi extends Error {
  constructor(kod) {
    super(kod);
    this.kod = kod;
  }
}

function hataKodu(error) {
  if (error instanceof RadarHatasi) return error.kod;
  if (error.name === 'RateLimitedError') return 'yerel_kota';
  if (error.name === 'CircuitOpenError') return 'devre_acik';
  const durum = error.response?.status ?? error.status;
  return Number.isInteger(durum) && durum >= 400 && durum <= 599 ? `http_${durum}` : 'islem_hatasi';
}

function tekrarMs(error, simdi) {
  const baslik = error.response?.headers?.['retry-after'];
  const ms = /^\d+$/.test(baslik || '') ? Number(baslik) * 1000 : Date.parse(baslik) - simdi;
  return Math.max(0, Number.isSafeInteger(ms) ? ms : 0);
}

function gecikme(deneme) {
  return Math.min(SAAT, 30_000 * 2 ** Math.min(deneme, 7));
}

module.exports = {
  AKISLAR, DAKIKA, SAAT, GUN, TAKIP_ARALIGI, OLAY_PARTISI, TELAFI_PARTISI, IS_PARTISI,
  AYNA_BELIRSIZ_BEKLEME_MS,
  OLAY_GOVDE_TAVANI, DENEME_TAVANI, YENI_IS_PARTISI, YENI_IS_ARALIGI, TMDB_SAYFA_TAVANI,
  TRAKT_OZET, TRAKT_SEZON, TMDB_DIL, TAKIP_SAYFASI, KOVA_REZERVI, KOTA_YEREL_DENEME, KOTA_YEREL_BEKLEME, RADAR_DEVRE,
  gun, idMi, numaraMi, iso, radarKapilari, RadarHatasi, hataKodu, tekrarMs, gecikme,
};
