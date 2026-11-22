const { UFUK, DUYURU_TTL, SAAT } = require('./ayar');
const { iso, yerel, duvarAni, yayinZamani, duyuruZamani, gecerliDilim } = require('./zaman');

const kokKimligi = ({ tur, trakt_id }) => `${tur}:${trakt_id}`;
const uyeKimligi = (r) => `${kokKimligi(r)}:${r.sezon ?? '-'}:${r.bolum ?? '-'}`;
const duyuruMu = (p) => ['sezon_duyuru', 'sezon_duyuru_tarihsiz'].includes(p.kategori);
const birimAcik = (b, tercihler) => tercihler?.tumu !== false &&
  tercihler?.[b.icerikler[0].tur === 'movie' ? 'film' : 'yayin'] !== false;
const aynayaHazir = (kok) => kok && kok.aynalanan_rev >= kok.takvim_rev;
const yenidenPlanlanir = (p) => p.durum === 'iptal' &&
  ['rev_degisti', 'tarih_degisti', 'dilim_degisti', 'ozet_tercihi_degisti'].includes(p.iptal_nedeni);
const karsilastir = (a, b) => a.an - b.an || a.anahtar.localeCompare(b.anahtar);

function ekle(gruplar, anahtar, veri) {
  if (!gruplar.has(anahtar)) gruplar.set(anahtar, []);
  gruplar.get(anahtar).push(veri);
}

function uyeyiYap(kok, satir, olay = null) {
  const { tur, trakt_id, takvim_rev } = kok;
  const { sezon, bolum, tarih, an_turu, durum } = satir;
  const uye = { tur, trakt_id, sezon, bolum, tarih, an_turu, durum, takvim_rev };
  return { ...uye, kimlik: uyeKimligi(uye), olay_id: olay?.id ?? null };
}

function planYap({ anahtar, kategori, an, son, gun, dilim, birimler, kutu_an = an, yakin_son = null }) {
  const icerikler = birimler.flatMap((b) => b.icerikler);
  const revler = new Set(icerikler.map(kokKimligi));
  return {
    dedupe_anahtari: anahtar, kategori, yerel_gun: gun, zaman_dilimi: dilim,
    planlanan_an: iso(an), push_son_an: iso(son), kutu_an: iso(kutu_an),
    yakin_son: yakin_son === null ? null : iso(yakin_son),
    beklenen_rev: revler.size === 1 ? icerikler[0].takvim_rev : null,
    olay_id: icerikler.map((i) => i.olay_id).find(Boolean) ?? null,
    bolum_kimlikleri: icerikler.filter((i) => i.bolum !== null).map((i) => i.kimlik),
    birimler, icerikler,
  };
}

function yayinBirimleri(yayinlar) {
  const diziler = new Map();
  const birimler = [];
  for (const y of yayinlar) {
    if (y.uye.tur === 'movie') {
      birimler.push({
        ...y.zaman, anahtar: `film:${y.uye.trakt_id}`, icerikler: [y.uye], baslik: y.baslik,
        kategori: y.film_turu === 4 ? 'film_dijital' : 'film_vizyon',
      });
    } else {
      ekle(diziler, `dizi:${y.uye.trakt_id}:${y.zaman.gun}`, y);
    }
  }
  for (const [anahtar, grup] of diziler) {
    grup.sort((a, b) => a.zaman.an - b.zaman.an || a.uye.sezon - b.uye.sezon || a.uye.bolum - b.uye.bolum);
    const [ilk] = grup;
    const tek = grup.length === 1;
    const sezonlar = new Set(grup.map(({ uye }) => uye.sezon));
    const tamSezon = sezonlar.size === 1 && ilk.sezonTam && grup.length === ilk.sezonAdet;
    const kategori = tek ? (ilk.zaman.erken ? 'bolum_yakinda' : 'bolum_bugun')
      : grup.length >= 4 || tamSezon ? 'sezon_yayinlandi' : 'bolum_grup';
    birimler.push({
      ...ilk.zaman, anahtar, kategori, baslik: ilk.baslik, icerikler: grup.map((y) => y.uye),
      sezon: sezonlar.size === 1 ? ilk.uye.sezon : null, bolum: tek ? ilk.uye.bolum : null,
      yakin_son: kategori === 'bolum_yakinda' ? Date.parse(ilk.uye.tarih) : null,
    });
  }
  return birimler.sort(karsilastir);
}

function yayinPlanlari(birimler, dilim, oncekiOzetler, tercihler) {
  const gunler = new Map();
  const planlar = [];
  for (const b of birimler) {
    if (birimAcik(b, tercihler)) ekle(gunler, b.gun, b);
    else planlar.push(planYap({ ...b, dilim, birimler: [b] }));
  }
  for (const [gun, grup] of gunler) {
    const [ilk] = grup;
    const anahtar = `ozet:${gun}`;
    if (grup.length >= 3 || oncekiOzetler.has(anahtar)) {
      const an = Math.min(duvarAni(gun, 10, dilim), ilk.an);
      planlar.push(planYap({ anahtar, kategori: 'gunluk_ozet', an, son: an + 36 * SAAT, gun, dilim, birimler: grup }));
    } else {
      for (const b of grup) planlar.push(planYap({ ...b, dilim, birimler: [b] }));
    }
  }
  return planlar;
}

function duyuruPlanlari({ olaylar, kokler, dilim, simdi, motorBaslangic }) {
  const planlar = new Map();
  for (const o of olaylar) {
    if (o.tur !== 'sezon_duyuru' || o.icerik_tur !== 'show' || !(o.sezon > 0)) continue;
    const kok = kokler.get(kokKimligi({ tur: o.icerik_tur, trakt_id: o.trakt_id }));
    if (!aynayaHazir(kok)) continue;
    const satir = kok.satirlar.find((s) => s.sezon === o.sezon && s.bolum === null);
    if (!satir || !['kesin', 'tba'].includes(satir.durum) || o.takvim_rev > kok.takvim_rev ||
        Boolean(satir.tarih) !== Boolean(o.veri?.tarih)) continue;
    const alindi = Date.parse(o.alindi_at);
    if (!(alindi > motorBaslangic && alindi <= simdi)) continue;
    const tespit = Date.parse(o.tespit_at);
    if (!Number.isFinite(tespit) || tespit > simdi || simdi - tespit >= DUYURU_TTL) continue;
    const { an, son } = duyuruZamani(tespit, dilim);
    const kategori = satir.tarih ? 'sezon_duyuru' : 'sezon_duyuru_tarihsiz';
    const anahtar = `${kategori}:${kok.trakt_id}:${satir.sezon}`;
    if (!planlar.has(anahtar) || planlar.get(anahtar).tespit > tespit) {
      const plan = planYap({
        anahtar, kategori, an, son, gun: null, dilim, kutu_an: tespit,
        birimler: [{ anahtar, baslik: kok.baslik, sezon: satir.sezon, icerikler: [uyeyiYap(kok, satir, o)] }],
      });
      planlar.set(anahtar, { tespit, plan: { ...plan, olay_alindi_at: iso(alindi) } });
    }
  }
  return [...planlar.values()].map(({ plan }) => plan);
}

function planlariHesapla({ girdi, kokler, simdi, motorBaslangic }) {
  const { takip, izlenen, olaylar, onceki, tercihler } = girdi;
  const dilim = gecerliDilim(girdi.zaman_dilimi);
  const bugun = yerel(simdi, dilim).gun;
  const takipli = new Map(takip.map((r) => [kokKimligi(r), kokler.get(kokKimligi(r))]));
  const gorulen = new Set(izlenen);
  const tamamlanan = onceki.filter((p) => p.durum !== 'bekliyor' && p.kutu_id && !yenidenPlanlanir(p));
  const bitenler = new Map(tamamlanan.map((p) => [p.dedupe_anahtari, p]));
  const ozetler = new Set(tamamlanan.filter((p) => p.kategori === 'gunluk_ozet').map((p) => p.dedupe_anahtari));
  const bekleyenUyeler = new Set();
  const korunanPlanlar = onceki.filter((p) => p.durum === 'bekliyor' &&
    p.icerikler.every((u) => takipli.has(kokKimligi(u))) && p.icerikler.some((u) => {
      const kok = takipli.get(kokKimligi(u));
      return !aynayaHazir(kok) || kok.satirlar.some((s) => s.sezon === u.sezon && s.bolum === u.bolum && s.durum === 'eksik_yanit');
    }));
  const korunanAnahtarlar = new Set(korunanPlanlar.map((p) => p.dedupe_anahtari));
  const korunanUyeler = new Set(korunanPlanlar.filter((p) => !duyuruMu(p)).flatMap((p) => p.icerikler.map((u) => u.kimlik)));
  for (const p of onceki) {
    if (duyuruMu(p)) continue;
    for (const uye of p.icerikler) {
      if (p.durum === 'bekliyor') bekleyenUyeler.add(uye.kimlik);
      if (p.durum !== 'bekliyor' && p.kutu_id && !yenidenPlanlanir(p) && p.kategori !== 'gunluk_ozet') gorulen.add(uye.kimlik);
    }
  }
  const olayIndeksi = new Map();
  for (const o of olaylar) {
    if (o.tur === 'sezon_duyuru') continue;
    const k = uyeKimligi({ ...o, tur: o.icerik_tur });
    if (!olayIndeksi.has(k) || olayIndeksi.get(k).takvim_rev < o.takvim_rev) olayIndeksi.set(k, o);
  }
  const yayinlar = [];
  for (const kok of takipli.values()) {
    if (!aynayaHazir(kok)) continue;
    const sezonAdetleri = new Map();
    for (const s of kok.satirlar) {
      if (s.bolum !== null && !['iptal', 'silindi_dogrulandi'].includes(s.durum)) {
        sezonAdetleri.set(s.sezon, (sezonAdetleri.get(s.sezon) ?? 0) + 1);
      }
    }
    for (const s of kok.satirlar) {
      if (s.durum !== 'kesin' || (kok.tur === 'show' && (s.bolum === null || !(s.sezon > 0)))) continue;
      const k = uyeKimligi({ ...kok, ...s });
      const o = olayIndeksi.get(k);
      const uye = uyeyiYap(kok, s, o?.takvim_rev === kok.takvim_rev ? o : null);
      if (gorulen.has(uye.kimlik) || korunanUyeler.has(uye.kimlik)) continue;
      const zaman = yayinZamani(uye, dilim);
      if (!zaman) continue;
      const yayin = uye.an_turu === 'kesin' && uye.tur === 'show' ? Date.parse(uye.tarih) : zaman.an;
      if (yayin > simdi + UFUK || (yayin < simdi && zaman.gun < bugun &&
          yerel(zaman.an, dilim).gun < bugun && !bekleyenUyeler.has(uye.kimlik))) continue;
      yayinlar.push({
        uye, zaman, baslik: kok.baslik, film_turu: kok.film_turu,
        sezonTam: kok.tam, sezonAdet: sezonAdetleri.get(s.sezon),
      });
    }
  }

  // Önceki özetin üyeleri yalnız kendi kutusuna katılır; dilim değişiminde tekrar planlanmaz.
  const ozetUyeleri = new Map();
  for (const p of tamamlanan.filter((r) => r.kategori === 'gunluk_ozet')) {
    for (const uye of p.icerikler) ozetUyeleri.set(uye.kimlik, p.dedupe_anahtari);
  }
  const birimler = yayinBirimleri(yayinlar.filter((y) => !ozetUyeleri.has(y.uye.kimlik) ||
    ozetUyeleri.get(y.uye.kimlik) === `ozet:${y.zaman.gun}`));
  const duzeltmeler = new Map();
  function eklenenleriYaz(biten, birimler) {
    const varOlan = new Set(biten.icerikler.map((u) => u.kimlik));
    const eklenen = birimler.map((b) => ({
      ...b, icerikler: b.icerikler.filter((u) => !varOlan.has(u.kimlik)),
    })).filter((b) => b.icerikler.length);
    if (eklenen.length) duzeltmeler.set(biten.id, { id: biten.id, eklenen });
  }
  // İlk push'tan sonra aynı dizi ve yayın günü yeni bir özetin üyesi olamaz.
  const yeniBirimler = birimler.filter((b) => {
    const biten = bitenler.get(b.anahtar);
    if (biten) eklenenleriYaz(biten, [b]);
    return !biten;
  });
  const yeni = [
    ...yayinPlanlari(yeniBirimler, dilim, ozetler, tercihler).filter((p) => {
      const biten = bitenler.get(p.dedupe_anahtari);
      if (biten) eklenenleriYaz(biten, p.birimler);
      return !biten;
    }),
    ...duyuruPlanlari({ olaylar, kokler: takipli, dilim, simdi, motorBaslangic }).filter((p) => !bitenler.has(p.dedupe_anahtari)),
  ].filter((p) => !korunanAnahtarlar.has(p.dedupe_anahtari));
  for (const p of tamamlanan) {
    const degisen = [];
    for (const uye of p.icerikler) {
      const kok = kokler.get(kokKimligi(uye));
      if (!aynayaHazir(kok) || kok.takvim_rev <= uye.takvim_rev) continue;
      const s = kok.satirlar.find((r) => r.sezon === uye.sezon && r.bolum === uye.bolum);
      if (!s || s.durum === 'eksik_yanit') continue;
      if (s.tarih === uye.tarih && s.an_turu === uye.an_turu && s.durum === uye.durum) continue;
      degisen.push(uyeyiYap(kok, s, { id: uye.olay_id }));
    }
    if (degisen.length) {
      duzeltmeler.set(p.id, { ...duzeltmeler.get(p.id), id: p.id, degisen });
    }
  }
  return { planlar: yeni, duzeltmeler: [...duzeltmeler.values()], korunanlar: korunanPlanlar.map((p) => p.id) };
}

module.exports = { planlariHesapla, duyuruMu, birimAcik, kokKimligi, uyeKimligi };
