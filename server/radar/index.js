const { radarKapilari, hataKodu } = require('./ayar');
const { workerIstemcisi } = require('./worker');
const { radarKilidi } = require('../zamanlayici/geceKilidi');

const KONTROL_MS = 30_000;
let zamanlayici = null;
let depo = null;
let tur = null;
let sirUyarildi = false;
let sonHata = null;
let duruyor = false;
let ucus = null;

function radariBaslat({
  ortam = process.env, gunluk = console, istemci = workerIstemcisi, depoAc = null,
  saglayicilar = null, aralik = setInterval, ilk = setImmediate,
} = {}) {
  const kapilar = radarKapilari(ortam);
  if (!kapilar.acik) return null;
  if (typeof ortam.RADAR_SIR !== 'string' || ortam.RADAR_SIR.length < 32) {
    if (!sirUyarildi) gunluk.warn('[Radar] RADAR_SIR yok veya cok kisa, Radar kapali.');
    sirUyarildi = true;
    sonHata = 'sir_yok';
    return null;
  }
  const workerUrl = (ortam.EXPO_PUBLIC_KAYMAK_WORKER_URL || '').replace(/\/+$/, '');
  if (!workerUrl) { sonHata = 'worker_url_yok'; return null; }
  if (zamanlayici) return zamanlayici;

  function kontrolEt() {
    if (duruyor || ucus) return ucus;
    ucus = radarKilidi(async (geceBekliyor) => {
      if (!tur) {
        depo = await (depoAc || require('./depo').depoAc)(kapilar);
        const { createTmdbFetcher } = require('../lazyfetch/providers/tmdb');
        const { createTraktCatalogFetcher } = require('../lazyfetch/providers/trakt');
        tur = require('./tur').radarTuruKur({
          kapilar, depo, gunluk,
          worker: istemci({ workerUrl, sir: ortam.RADAR_SIR }),
          saglayicilar: saglayicilar || {
            tmdb: ortam.TMDB_API_KEY ? createTmdbFetcher(ortam.TMDB_API_KEY) : null,
            trakt: ortam.EXPO_PUBLIC_TRAKT_CLIENT_ID ? createTraktCatalogFetcher(ortam.EXPO_PUBLIC_TRAKT_CLIENT_ID) : null,
          },
        });
      }
      await tur(() => duruyor || geceBekliyor());
      sonHata = null;
    }).catch((error) => {
      const kod = hataKodu(error);
      if (sonHata !== kod) gunluk.warn(`[Radar] zamanlayici:${kod}`);
      sonHata = kod;
    }).finally(() => { ucus = null; });
    return ucus;
  }

  zamanlayici = aralik(kontrolEt, KONTROL_MS);
  zamanlayici?.unref?.();
  ilk(kontrolEt)?.unref?.();
  return zamanlayici;
}

function radarSagligi(ortam = process.env) {
  const k = radarKapilari(ortam);
  const ozet = k.acik && depo ? depo.saglik() : require('./depo').saglikOku(null);
  return { etkin: k.acik && !!zamanlayici, yazim: k.yaz, olay: k.olay, ...ozet, sonHata: sonHata || ozet.sonHata };
}

function radariDurdur() {
  duruyor = true;
  if (zamanlayici) clearInterval(zamanlayici);
  zamanlayici = null;
  return ucus || Promise.resolve();
}

module.exports = { radariBaslat, radarSagligi, radariDurdur };
