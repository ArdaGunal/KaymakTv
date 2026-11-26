const { UFUK, DUYURU_TTL, DAKIKA, SAAT, GUN } = require('./ayar');
const { iso } = require('./zaman');
const { kokKimligi, planlariHesapla } = require('./planlayici');
const { sayfalariOku, geciciWorkerHatasi } = require('./worker');

function filmTuru(veri, tarih) {
  const turler = new Set();
  for (const bolge of veri?.results ?? []) {
    for (const yayin of bolge.release_dates ?? []) {
      if (yayin.release_date?.slice(0, 10) === tarih) turler.add(yayin.type);
    }
  }
  return turler.has(3) ? 3 : turler.has(4) ? 4 : null;
}

function filmTurleriniKur(cek, saat = Date.now) {
  const bellek = new Map();
  return async (kokler, simdi, dur) => {
    if (!cek) return;
    for (const kok of kokler.values()) {
      if (dur()) return;
      if (kok.tur !== 'movie' || !/^\d+$/.test(kok.tmdb_id ?? '')) continue;
      const yayin = kok.satirlar?.find((s) => s.durum === 'kesin' && s.tarih);
      const yayinAni = Date.parse(yayin?.tarih);
      if (!Number.isFinite(yayinAni) || yayinAni < simdi - 2 * GUN || yayinAni > simdi + UFUK + GUN) continue;
      const anahtar = `${kok.tmdb_id}:${yayin.tarih}`;
      if (bellek.get(anahtar)?.son <= saat()) bellek.delete(anahtar);
      if (!bellek.has(anahtar)) {
        let tur = null;
        let ttl = 6 * SAAT;
        try {
          const yanit = await cek(Number(kok.tmdb_id), dur);
          tur = filmTuru(yanit.data, yayin.tarih.slice(0, 10));
          if (yanit.storable === false) ttl = 0;
        } catch {
          ttl = DAKIKA;
        }
        if (bellek.size >= 1000) bellek.delete(bellek.keys().next().value);
        if (ttl) bellek.set(anahtar, { tur, son: saat() + ttl });
        kok.film_turu = tur;
      } else {
        kok.film_turu = bellek.get(anahtar).tur;
      }
    }
  };
}

function kullaniciKimlikleri(girdi) {
  if (!girdi?.user_id || !girdi.goruntu || !Array.isArray(girdi.izlenen) || !Array.isArray(girdi.olaylar)) {
    throw new Error('plan_girdisi');
  }
  const kimlikler = [...girdi.takip, ...girdi.onceki.flatMap((p) => p.icerikler)];
  if (kimlikler.some((k) => !k || !['show', 'movie'].includes(k.tur) || !Number.isSafeInteger(k.trakt_id))) {
    throw new Error('icerik_kimligi');
  }
  return kimlikler;
}

async function planTuru({ worker, arsivTakvimi, filmTurleriniCoz, saat, dur, motorBaslangic }) {
  const simdi = saat();
  const sayac = { kullanici: 0, aday: 0, eklenen: 0, degisen: 0, ayni: 0, iptal: 0, duzeltme: 0, cakisma: 0,
    hata: 0, terk: 0, kategori: {} };
  const istek = { simdi: iso(simdi), ufuk: iso(simdi + UFUK), olay_baslangici: iso(Math.max(motorBaslangic, simdi - DUYURU_TTL)) };
  const terkEt = () => { sayac.hata++; sayac.terk++; };
  let ardisikGeciciYazmaHatasi = 0;
  for await (const sayfa of sayfalariOku(worker.planGirdisi, istek, dur)) {
    const kimlikler = new Map();
    const girdiler = [];
    for (const girdi of sayfa) {
      if (dur()) return sayac;
      sayac.kullanici++;
      try {
        const kullaniciKokleri = kullaniciKimlikleri(girdi);
        for (const { tur, trakt_id } of kullaniciKokleri) {
          const k = { tur, trakt_id };
          kimlikler.set(kokKimligi(k), k);
        }
        girdiler.push({ girdi, kullaniciKokleri });
      } catch {
        terkEt();
      }
    }
    const kokler = arsivTakvimi([...kimlikler.values()]);
    await filmTurleriniCoz(kokler, simdi, dur);
    for (const { girdi, kullaniciKokleri } of girdiler) {
      if (dur()) return sayac;
      let plan;
      try {
        if (kullaniciKokleri.some((k) => kokler.get(kokKimligi(k))?.bozuk)) throw new Error('takvim_bozuk');
        plan = planlariHesapla({ girdi, kokler, simdi, motorBaslangic });
      } catch {
        terkEt();
        continue;
      }
      const { planlar, duzeltmeler, korunanlar } = plan;
      sayac.aday += planlar.length;
      for (const { kategori } of planlar) sayac.kategori[kategori] = (sayac.kategori[kategori] ?? 0) + 1;
      try {
        const sonuc = await worker.planYaz({ user_id: girdi.user_id, goruntu: girdi.goruntu, planlar, duzeltmeler, korunanlar });
        ardisikGeciciYazmaHatasi = 0;
        if (sonuc?.durum === 'cakisma') {
          sayac.cakisma++;
          continue;
        }
        const alanlar = ['eklenen', 'degisen', 'ayni', 'iptal', 'duzeltme'];
        if (sonuc?.durum !== 'uygulandi' || alanlar.some((a) => !Number.isSafeInteger(sonuc[a]) || sonuc[a] < 0)) {
          throw new Error('plan_yaniti');
        }
        for (const alan of alanlar) sayac[alan] += sonuc[alan];
      } catch (hata) {
        terkEt();
        ardisikGeciciYazmaHatasi = geciciWorkerHatasi(hata) ? ardisikGeciciYazmaHatasi + 1 : 0;
        if (ardisikGeciciYazmaHatasi === 3) throw hata;
      }
    }
  }
  return sayac;
}

module.exports = { filmTuru, filmTurleriniKur, planTuru };
