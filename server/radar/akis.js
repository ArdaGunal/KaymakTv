const { setTimeout: bekle } = require('node:timers/promises');
const { CircuitBreaker } = require('../lazyfetch/circuitBreaker');
const { kovaDurumu, tryConsume } = require('../lazyfetch/tokenBucket');
const { NotFoundError, RateLimitedError, CircuitOpenError } = require('../lazyfetch/errors');
const { gun, iso, GUN, SAAT, hataKodu, ILK_AKIS_PENCERESI, TELAFI_PARTISI, idMi, RadarHatasi, TMDB_SAYFA_TAVANI,
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

function sayfayiAc(akis, yanit, sayfa, bas, turBasi) {
  const tmdb = akis.saglayici === 'tmdb';
  const satirlar = tmdb ? yanit.data?.results : yanit.data;
  const gelenSayfa = tmdb ? yanit.data?.page : Number(yanit.headers?.['x-pagination-page']);
  const sayfaSayisi = tmdb ? yanit.data?.total_pages : Number(yanit.headers?.['x-pagination-page-count']);
  if (!Array.isArray(satirlar) || gelenSayfa !== sayfa || !Number.isSafeInteger(sayfaSayisi) ||
      sayfaSayisi < 0 || (sayfaSayisi === 0 && satirlar.length) ||
      (sayfa < sayfaSayisi && !satirlar.length)) {
    throw new RadarHatasi('akis_sayfalama');
  }
  const gecerliSatirlar = tmdb ? satirlar : satirlar.filter((s) => {
    const at = Date.parse(s?.updated_at ?? s?.[akis.tur]?.updated_at);
    return !Number.isFinite(at) || (at >= bas && at <= turBasi);
  });
  const kimlikler = gecerliSatirlar.map((s) => tmdb ? s?.id : (s?.[akis.tur] ?? s)?.ids?.trakt);
  if (!kimlikler.every(idMi)) throw new RadarHatasi('akis_kimligi');
  return { kimlikler, sayfaSayisi, hamSatir: satirlar.length };
}

async function akisiTara({ akis, depo, cek, simdi, dur }) {
  const onceki = depo.imlec(akis.ad);
  const tmdb = akis.saglayici === 'tmdb';
  const altSinir = tmdb ? Date.parse(gun(simdi)) - akis.pencere + GUN
    : Math.ceil((simdi - akis.pencere) / SAAT) * SAAT;
  const eski = onceki?.at ?? simdi - ILK_AKIS_PENCERESI;
  const kayit = tmdb ? null : depo.akisDevri(akis.ad);
  const devir = kayit?.imlec === (onceki?.at ?? null) && kayit.bas >= altSinir && kayit.bitis <= simdi ? kayit : null;
  const bas = devir?.bas ?? Math.max(altSinir, eski);
  const bitis = devir?.bitis ?? simdi;
  // Canlı listede sayfa sınırı turlar arasında kayabilir. Devredilen
  // tarama bitince sınırlı telafi, arada yer değiştiren satırları kapsar.
  let telafi = devir || eski < altSinir ? 0 : (onceki?.telafi_son_id ?? null);
  const eslesen = new Set(devir?.eslesen);
  let sonrakiSayfa = devir?.sonrakiSayfa ?? 1;
  let traktToplam = devir?.toplam ?? null;
  let okunan = devir?.okunan ?? 0;
  let uygulananLimit = devir?.uygulananLimit ?? null;
  let saglayiciBaslangici = devir?.saglayiciBaslangici ?? null;
  let sayfaDaraldi = devir?.sayfaDaraldi ?? false;
  let hamSatir = devir?.hamSatir ?? 0;
  let pencereDisi = devir?.pencereDisi ?? 0;

  async function pencereTara(ilkGun, sonGun) {
    const basGun = gun(ilkGun);
    const basSaat = tmdb ? null : iso(Math.floor(bas / SAAT) * SAAT).replace('.000Z', 'Z');
    const yol = tmdb ? akis.yol : akis.yol + '/' + basSaat;
    const sorgu = tmdb ? { start_date: basGun, end_date: gun(sonGun) } : { limit: akis.sayfa };
    let toplam = tmdb ? null : traktToplam;
    for (let sayfa = tmdb ? 1 : sonrakiSayfa; toplam === null || sayfa <= toplam; sayfa++) {
      dur();
      const yanit = await cek(yol, { ...sorgu, page: sayfa });
      okunan++;
      const acik = sayfayiAc(akis, yanit, sayfa, bas, bitis);
      if (tmdb && acik.sayfaSayisi >= TMDB_SAYFA_TAVANI && ilkGun < sonGun) {
        const orta = ilkGun + Math.floor((sonGun - ilkGun) / GUN / 2) * GUN;
        await pencereTara(ilkGun, orta);
        await pencereTara(orta + GUN, sonGun);
        return;
      }
      if (tmdb && acik.sayfaSayisi >= TMDB_SAYFA_TAVANI) telafi = 0;
      const sayi = tmdb ? Math.min(acik.sayfaSayisi, TMDB_SAYFA_TAVANI) : acik.sayfaSayisi;
      // Her iki sağlayıcının canlı listesi daralabilir. Sıralı ve
      // doğrulanmış yanıtlar geldiyse yeni son sayfa yeterlidir.
      sayfaDaraldi ||= toplam !== null && sayi < toplam;
      if (toplam !== null && sayfa > sayi) telafi = 0;
      toplam = sayi;
      hamSatir += acik.hamSatir;
      if (!tmdb) {
        pencereDisi += acik.hamSatir - acik.kimlikler.length;
        const limitMetni = yanit.headers?.['x-pagination-limit'];
        if (limitMetni !== undefined) {
          const limit = Number(limitMetni);
          if (!idMi(limit) || yanit.data.length > limit || (uygulananLimit !== null && uygulananLimit !== limit)) {
            throw new RadarHatasi('trakt_sayfa_boyu');
          }
          uygulananLimit = limit;
        }
        const baslik = yanit.headers?.['x-start-date'];
        const tarih = typeof baslik === 'string' ? Date.parse(baslik) : NaN;
        if (!Number.isFinite(tarih)) throw new RadarHatasi('trakt_baslangic');
        saglayiciBaslangici = Math.max(saglayiciBaslangici ?? tarih, tarih);
        if (tarih > bas) telafi = 0;
      }
      for (const id of depo.kesisim(akis, acik.kimlikler)) eslesen.add(id);
      if (!tmdb) {
        sonrakiSayfa = sayfa + 1;
        traktToplam = toplam;
      }
    }
  }

  try {
    await pencereTara(Date.parse(gun(bas)), Date.parse(gun(bitis)));
    dur();
  } catch (error) {
    if (!tmdb && sonrakiSayfa > 1 && ['yerel_kota', 'http_429', 'gece_isi'].includes(hataKodu(error))) {
      await depo.akisDevriYaz(akis.ad, {
        imlec: onceki?.at ?? null, bas, bitis, sonrakiSayfa, toplam: traktToplam, eslesen: [...eslesen],
        okunan, uygulananLimit, saglayiciBaslangici, sayfaDaraldi, hamSatir, pencereDisi,
      });
    } else if (kayit) {
      await depo.akisDevriYaz(akis.ad, null);
    }
    throw error;
  }
  const takipte = devir ? depo.kesisim(akis, [...eslesen]) : eslesen;
  await depo.akisiKaydet(akis, bitis, takipte, telafi, hamSatir);
  return {
    eslesen: takipte.size ?? takipte.length, sayfa: okunan, telafi: telafi !== null, sayfaDaraldi,
    baslangic: iso(bas), bitis: iso(bitis), hamSatir,
    ...(tmdb ? {} : { uygulananLimit, saglayiciBaslangici: iso(saglayiciBaslangici), pencereDisi }),
  };
}

async function telafiyiIlerlet(depo, akislar, simdi) {
  for (const akis of akislar) await depo.telafi(akis, simdi, TELAFI_PARTISI);
}

module.exports = { akisiTara, telafiyiIlerlet, radarCek };
