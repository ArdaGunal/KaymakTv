const { setTimeout: bekle } = require('node:timers/promises');
const { CircuitBreaker } = require('../lazyfetch/circuitBreaker');
const { kovaDurumu, tryConsume } = require('../lazyfetch/tokenBucket');
const { NotFoundError, RateLimitedError, CircuitOpenError } = require('../lazyfetch/errors');
const { gun, GUN, TELAFI_PARTISI, idMi, RadarHatasi, TMDB_SAYFA_TAVANI,
  KOVA_REZERVI, KOTA_YEREL_DENEME, KOTA_YEREL_BEKLEME, RADAR_DEVRE } = require('./ayar');

const devreler = new Map();

async function radarCek(saglayici, fetcher, yol, sorgu, dur) {
  for (let deneme = 0; ; deneme++) {
    dur();
    const { jeton, kapasite } = kovaDurumu(saglayici);
    if (jeton > Math.ceil(kapasite * KOVA_REZERVI)) break;
    if (deneme >= KOTA_YEREL_DENEME) throw new RateLimitedError(saglayici);
    await bekle(KOTA_YEREL_BEKLEME);
  }
  if (!devreler.has(saglayici)) devreler.set(saglayici, new CircuitBreaker(RADAR_DEVRE));
  const devre = devreler.get(saglayici);
  if (!devre.canRequest()) throw new CircuitOpenError(saglayici);
  if (!tryConsume(saglayici)) throw new RateLimitedError(saglayici);
  try {
    const yanit = await fetcher(yol, sorgu);
    devre.recordSuccess();
    return yanit;
  } catch (error) {
    if (error instanceof NotFoundError) devre.recordSuccess();
    else devre.recordFailure();
    throw error;
  }
}

function sayfayiAc(akis, yanit, sayfa, turBasi) {
  const tmdb = akis.saglayici === 'tmdb';
  const satirlar = tmdb ? yanit.data?.results : yanit.data;
  const gelenSayfa = tmdb ? yanit.data?.page : Number(yanit.headers?.['x-pagination-page']);
  const sayfaSayisi = tmdb ? yanit.data?.total_pages : Number(yanit.headers?.['x-pagination-page-count']);
  if (!Array.isArray(satirlar) || gelenSayfa !== sayfa || !Number.isSafeInteger(sayfaSayisi) ||
      sayfaSayisi < 0 || (sayfaSayisi === 0 && satirlar.length) ||
      sayfa > Math.max(sayfaSayisi, 1) || (sayfa < sayfaSayisi && !satirlar.length)) {
    throw new RadarHatasi('akis_sayfalama');
  }
  const gecerliSatirlar = tmdb ? satirlar : satirlar.filter((s) => !(Date.parse(s?.updated_at ?? s?.[akis.tur]?.updated_at) > turBasi));
  const kimlikler = gecerliSatirlar.map((s) => tmdb ? s?.id : (s?.[akis.tur] ?? s)?.ids?.trakt);
  if (!kimlikler.every(idMi)) throw new RadarHatasi('akis_kimligi');
  return { kimlikler, sayfaSayisi };
}

async function akisiTara({ akis, depo, cek, simdi, dur }) {
  const onceki = depo.imlec(akis.ad);
  const tmdb = akis.saglayici === 'tmdb';
  // Gün çözünürlüğündeki API'lerde sınır gününü yeniden okuruz. İlk
  // kurulumda son günü alırız, yeni takipler zaten ayrı kuyruğa girer.
  const altSinir = Date.parse(gun(simdi)) - akis.pencere + GUN;
  const eski = onceki?.at ?? simdi - GUN;
  const bas = Math.max(altSinir, eski);
  let telafi = eski < altSinir ? 0 : (onceki?.telafi_son_id ?? null);
  const eslesen = new Set();
  let okunan = 0;

  async function pencereTara(ilkGun, sonGun) {
    const basGun = gun(ilkGun);
    const yol = tmdb ? akis.yol : `${akis.yol}/${basGun}`;
    const sorgu = tmdb ? { start_date: basGun, end_date: gun(sonGun) } : { limit: akis.sayfa };
    let toplam = null;
    for (let sayfa = 1; toplam === null || sayfa <= toplam; sayfa++) {
      dur();
      const yanit = await cek(yol, { ...sorgu, page: sayfa });
      okunan++;
      const acik = sayfayiAc(akis, yanit, sayfa, simdi);
      if (tmdb && acik.sayfaSayisi >= TMDB_SAYFA_TAVANI && ilkGun < sonGun) {
        const orta = ilkGun + Math.floor((sonGun - ilkGun) / GUN / 2) * GUN;
        await pencereTara(ilkGun, orta);
        await pencereTara(orta + GUN, sonGun);
        return;
      }
      if (tmdb && acik.sayfaSayisi >= TMDB_SAYFA_TAVANI) telafi = 0;
      const sayi = tmdb ? Math.min(acik.sayfaSayisi, TMDB_SAYFA_TAVANI) : acik.sayfaSayisi;
      if (toplam !== null && sayi < toplam) throw new RadarHatasi('akis_sayfa_azaldi');
      toplam = sayi;
      if (!tmdb) {
        const baslik = yanit.headers?.['x-start-date'];
        const tarih = typeof baslik === 'string' ? Date.parse(baslik) : NaN;
        if (!Number.isFinite(tarih)) throw new RadarHatasi('trakt_baslangic');
        if (tarih > bas) telafi = 0;
      }
      for (const id of depo.kesisim(akis, acik.kimlikler)) eslesen.add(id);
    }
  }

  await pencereTara(Date.parse(gun(bas)), Date.parse(gun(simdi)));

  dur();
  await depo.akisiKaydet(akis, simdi, eslesen, telafi);
  return { eslesen: eslesen.size, sayfa: okunan, telafi: telafi !== null };
}

async function telafiyiIlerlet(depo, akislar, simdi) {
  for (const akis of akislar) await depo.telafi(akis, simdi, TELAFI_PARTISI);
}

module.exports = { akisiTara, telafiyiIlerlet, radarCek };
