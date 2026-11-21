const { createHash } = require('node:crypto');
const { idMi, numaraMi, iso, gun } = require('./ayar');

const TARIH = /^\d{4}-\d{2}-\d{2}$/;
const AN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i;

function zamaniSinifla(deger, kaynak) {
  if (typeof deger === 'string' && Number.isFinite(Date.parse(deger))) {
    if (TARIH.test(deger) && gun(Date.parse(deger)) === deger) {
      return { an_turu: 'yalniz_tarih', tarih: deger, guven: 'tarih' };
    }
    if (kaynak === 'trakt' && AN.test(deger) && gun(Date.parse(deger.slice(0, 10))) === deger.slice(0, 10)) {
      return { an_turu: 'kesin', tarih: iso(Date.parse(deger)), guven: 'saat' };
    }
  }
  const tba = deger === null || (kaynak === 'tmdb' && deger === '');
  return { an_turu: tba ? 'tba' : null, tarih: null, guven: tba ? 'yok' : 'gecersiz' };
}

const iptalMi = (status) => ['canceled', 'cancelled'].includes(String(status ?? '').trim().toLowerCase());

function satir(sezon, bolum, deger, kaynak, status) {
  const zaman = zamaniSinifla(deger, kaynak);
  const durum = iptalMi(status) ? 'iptal' : zaman.guven === 'gecersiz' ? 'eksik_yanit'
    : String(status ?? '').toLowerCase() === 'postponed' ? 'ertelendi' : zaman.tarih ? 'kesin' : 'tba';
  return { sezon, bolum, ...zaman, an_turu: zaman.an_turu ?? 'tba', durum, kaynak };
}

const anahtar = ({ sezon, bolum }) => `${sezon ?? '-'}:${bolum ?? '-'}`;
const sirala = (a, b) => (a.sezon ?? -1) - (b.sezon ?? -1) || (a.bolum ?? -1) - (b.bolum ?? -1);
const canli = (r) => r && !['silindi_dogrulandi', 'iptal', 'eksik_yanit'].includes(r.durum);
const etkiliDurum = (r) => r?.onceki_durum ?? r?.durum;
const tariheBak = (r) => r?.tarih?.slice(0, 10);

function sezonlariOku(liste, { kaynak, detaylar = new Map(), beklenen = [] }) {
  const satirlar = [];
  const eksikSezonlar = new Set();
  const sezonlar = new Set();
  let listeTam = Array.isArray(liste);
  const trakt = kaynak === 'trakt';

  for (const s of Array.isArray(liste) ? liste : []) {
    const sezon = trakt ? s?.number : s?.season_number;
    const sezonId = trakt ? s?.ids?.trakt || s?.ids?.tmdb : s?.id;
    if (!numaraMi(sezon) || !idMi(sezonId) || sezonlar.has(sezon)) {
      if (sezon === 0) eksikSezonlar.add(0);
      else listeTam = false;
      continue;
    }
    sezonlar.add(sezon);
    const detay = trakt ? s : detaylar.get(sezon);
    const bolumler = detay?.episodes;
    const sayi = s.episode_count;
    if (!Array.isArray(bolumler) || (numaraMi(sayi) && sayi !== bolumler.length) ||
        (Array.isArray(bolumler) && !bolumler.length && sayi !== 0)) eksikSezonlar.add(sezon);
    const bolumNolari = new Set();
    const sezonSatiri = satir(sezon, null, trakt ? (s.first_aired === undefined ? null : s.first_aired) : s.air_date, kaynak, s.status);
    if (sezonSatiri.durum === 'eksik_yanit') eksikSezonlar.add(sezon);
    for (const b of Array.isArray(bolumler) ? bolumler : []) {
      const bolum = trakt ? b?.number : b?.episode_number;
      const bolumId = trakt ? b?.ids?.trakt || b?.ids?.tmdb : b?.id;
      if (!idMi(bolum) || !idMi(bolumId) || bolumNolari.has(bolum)) { eksikSezonlar.add(sezon); continue; }
      bolumNolari.add(bolum);
      const tarihAlani = trakt ? 'first_aired' : 'air_date';
      if (!Object.hasOwn(b, tarihAlani)) eksikSezonlar.add(sezon);
      const r = satir(sezon, bolum, b[tarihAlani], kaynak, b.status);
      if (r.durum === 'eksik_yanit') eksikSezonlar.add(sezon);
      if (r.tarih && canli(r) && (!sezonSatiri.tarih || r.tarih < sezonSatiri.tarih) && !['iptal', 'eksik_yanit'].includes(sezonSatiri.durum)) {
        Object.assign(sezonSatiri, { tarih: r.tarih, guven: r.guven, an_turu: r.an_turu, durum: 'kesin' });
      }
      satirlar.push(r);
    }
    satirlar.push(sezonSatiri);
  }
  if (beklenen.some((s) => idMi(s) && !sezonlar.has(s))) listeTam = false;
  return { satirlar, listeTam, eksikSezonlar };
}

function airsOku(airs) {
  if (!airs || typeof airs !== 'object') return null;
  const { day, time, timezone } = airs;
  if (!['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].includes(day) ||
      typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
      typeof timezone !== 'string' || timezone.length > 64) return null;
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch (_) { return null; }
  return { day, time, timezone };
}

function takvimCikar({ tur, trakt, sezonlar, tmdb, tmdbSezonlar, tmdbOnbellekliSezonlar, tmdbBekleniyor }, onceki = [], oncekiKaynakAt, cakismalar = new Set()) {
  const t = tur === 'movie'
    ? { satirlar: [satir(null, null, trakt?.released, 'trakt', trakt?.status)], listeTam: iptalMi(trakt?.status) || Object.hasOwn(trakt || {}, 'released'), eksikSezonlar: new Set() }
    : sezonlariOku(sezonlar, { kaynak: 'trakt', beklenen: [trakt?.next_episode?.season, trakt?.last_episode?.season] });
  const m = tur === 'movie'
    ? { satirlar: tmdb ? [satir(null, null, tmdb.release_date, 'tmdb', tmdb.status)] : [], listeTam: iptalMi(tmdb?.status) || Object.hasOwn(tmdb || {}, 'release_date'), eksikSezonlar: new Set() }
    : sezonlariOku(tmdb?.seasons, { kaynak: 'tmdb', detaylar: tmdbSezonlar });
  if (tur === 'movie') {
    if (t.satirlar.some((r) => r.durum === 'eksik_yanit')) t.listeTam = false;
    if (m.satirlar.some((r) => r.durum === 'eksik_yanit')) m.listeTam = false;
  } else {
    const traktBolum = t.satirlar.filter((r) => r.sezon > 0 && r.bolum !== null).length;
    if (Number.isSafeInteger(trakt?.aired_episodes) && trakt.aired_episodes > traktBolum) t.listeTam = false;
    const tmdbSezon = m.satirlar.filter((r) => r.sezon > 0 && r.bolum === null).length;
    if (Number.isSafeInteger(tmdb?.number_of_seasons) && tmdb.number_of_seasons !== tmdbSezon) m.listeTam = false;
  }
  const traktSatirlari = new Map(t.satirlar.map((r) => [anahtar(r), r]));
  const tmdbSatirlari = new Map(m.satirlar.map((r) => [anahtar(r), r]));
  const eski = new Map(onceki.map((r) => [anahtar(r), r]));
  // Eşlemenin görüntüden düşmesi, daha önce TMDB'de görülen bir
  // takvim yuvasının silindiğine kanıt oluşturmaz.
  const tmdbGerekli = tmdbBekleniyor || onceki.some((r) => r.kaynak === 'tmdb' && etkiliDurum(r) !== 'silindi_dogrulandi');
  const satirlar = [];
  const diziIptal = tur === 'show' && (iptalMi(trakt?.status) || iptalMi(tmdb?.status));

  for (const k of new Set([...traktSatirlari.keys(), ...tmdbSatirlari.keys(), ...eski.keys()])) {
    const tr = traktSatirlari.get(k);
    const tm = tmdbSatirlari.get(k);
    const once = eski.get(k);
    const sezon = (tr || tm || once).sezon;
    if (cakismalar.has(sezon)) {
      if (once) satirlar.push({ ...once, durum: 'eksik_yanit', onceki_durum: etkiliDurum(once), ayna_kaynak_at: once.ayna_kaynak_at ?? oncekiKaynakAt });
      continue;
    }
    const eskiTmdbOnbellekli = once?.kaynak === 'tmdb' && !tm && tmdbOnbellekliSezonlar?.has(sezon);
    const tam = !eskiTmdbOnbellekli && t.listeTam && !t.eksikSezonlar.has(sezon) &&
      (!tmdbGerekli || (m.listeTam && !m.eksikSezonlar.has(sezon)));
    const secim = tr?.durum === 'iptal' ? tr : tm?.durum === 'iptal' ? tm
      : tr?.durum === 'ertelendi' || tr?.tarih ? tr : tm?.tarih || tm?.durum === 'ertelendi' ? tm : tr || tm;
    if (secim?.durum === 'iptal') { satirlar.push(secim); continue; }
    const tba = secim?.durum === 'tba' || (!secim && etkiliDurum(once) === 'tba');
    if (diziIptal && !secim?.tarih && secim?.durum !== 'ertelendi' &&
        once?.tarih && !['iptal', 'silindi_dogrulandi'].includes(etkiliDurum(once))) {
      satirlar.push(once);
      continue;
    }
    if (diziIptal && tba) {
      const kaynak = iptalMi(trakt?.status) ? 'trakt' : 'tmdb';
      satirlar.push(satir(sezon, (tr || tm || once).bolum, null, kaynak, 'canceled'));
      continue;
    }
    const kuvvetliEski = once?.an_turu === 'kesin' && secim?.an_turu === 'yalniz_tarih' &&
      tariheBak(once) === tariheBak(secim);
    const eskiKaynak = once?.kaynak === 'tmdb' ? tm : tr;
    const kaynakEksik = !eskiKaynak || eskiKaynak.durum === 'eksik_yanit';
    const eksik = !tam && (once?.tarih && kaynakEksik || !secim || secim.durum === 'eksik_yanit' ||
      ((!secim.tarih || kuvvetliEski) && once?.tarih));
    const dayanak = once || secim;
    if (eksik) {
      const aynaAt = once?.ayna_kaynak_at ?? oncekiKaynakAt;
      satirlar.push({
        ...dayanak, durum: 'eksik_yanit', onceki_durum: etkiliDurum(once),
        ...(once?.tarih && aynaAt != null ? { ayna_kaynak_at: aynaAt } : {}),
      });
    } else if (!secim) {
      satirlar.push({ ...once, ...zamaniSinifla(null), durum: 'silindi_dogrulandi', onceki_durum: undefined });
    } else if (once?.tarih && !['iptal', 'silindi_dogrulandi'].includes(etkiliDurum(once)) && !secim.tarih && secim.durum === 'tba') {
      satirlar.push({ ...secim, durum: 'ertelendi' });
    } else if (secim.durum === 'tba' && etkiliDurum(once) === 'ertelendi') {
      satirlar.push({ ...secim, durum: 'ertelendi' });
    } else {
      satirlar.push(secim);
    }
  }

  // Dizi yayın şablonu kaynak verisi olarak saklanır. Tarih-yalnız bir
  // bölümde şablondan saat türetmek özel/birlikte yayınları yanlış gösterir.
  const eksik = (sezonlar) => [...sezonlar].some((no) => no !== 0);
  return {
    satirlar: satirlar.sort(sirala),
    airs: airsOku(trakt?.airs),
    traktTam: t.listeTam && !eksik(t.eksikSezonlar),
    tam: !eksik(cakismalar) && t.listeTam && !eksik(t.eksikSezonlar) && (!tmdbGerekli || (m.listeTam && !eksik(m.eksikSezonlar))),
  };
}

function olaylariCikar(kimlik, onceki, { satirlar, airs }, rev, simdi) {
  const { tur: icerik_tur, trakt_id } = kimlik;
  const eski = new Map(onceki.map((r) => [anahtar(r), r]));
  const olaylar = [];
  for (const r of satirlar) {
    if (r.sezon === 0 || r.durum === 'eksik_yanit') continue;
    const o = eski.get(anahtar(r));
    const degisti = o?.tarih !== r.tarih || o?.an_turu !== r.an_turu || etkiliDurum(o) !== r.durum;
    if (!degisti) continue;
    const gelecek = r.an_turu === 'kesin' ? Date.parse(r.tarih) >= simdi : r.tarih && r.tarih >= gun(simdi);
    let tur;
    if (icerik_tur === 'movie' && (gelecek || o?.tarih)) tur = 'film_tarih';
    if (r.bolum !== null && (gelecek || o?.tarih || (o && !canli(r)))) tur = 'takvim_degisti';
    if (icerik_tur === 'show' && r.bolum === null && canli(r) &&
        ((!o && (gelecek || !r.tarih)) || (!o?.tarih && gelecek))) tur = 'sezon_duyuru';
    if (icerik_tur === 'show' && r.bolum === null && o && !tur) tur = 'takvim_degisti';
    if (!tur) continue;

    const ozet = createHash('sha256').update(JSON.stringify([r.tarih, r.an_turu, r.durum])).digest('hex');
    olaylar.push({
      olay_anahtari: `${tur}:${icerik_tur}:${trakt_id}:${anahtar(r)}:r${rev}:${ozet}`,
      tur, icerik_tur, trakt_id, sezon: r.sezon, bolum: r.bolum, takvim_rev: rev,
      veri: { durum: r.durum, an_turu: r.an_turu, tarih: r.tarih, guven: r.guven, onceki_tarih: o?.tarih ?? null, ...(airs ? { airs } : {}) },
      kaynak: r.kaynak,
      tespit_at: iso(simdi),
    });
  }
  return olaylar;
}

module.exports = { takvimCikar, olaylariCikar, zamaniSinifla };
