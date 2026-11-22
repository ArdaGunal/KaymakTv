const assert = require('node:assert/strict');
const { test } = require('node:test');
const { SAAT, DAKIKA } = require('../../server/bildirim/ayar');
const { yayinZamani, duyuruZamani, duvarAni, iso } = require('../../server/bildirim/zaman');
const { planlariHesapla } = require('../../server/bildirim/planlayici');
const { filmTuru } = require('../../server/bildirim/planTuru');
const { KATEGORILER, tarihMetni, basligiKisalt, sablonHavuzu, kutuMetni } = require('../../server/bildirim/sablon');

const T = Date.parse;
const gun = '2026-11-23';
const simdi = T('2026-11-22T18:00Z');

test('K-52 yayın saati, gece sınırları, tarih-yalnız ve film', () => {
  for (const [tur, an_turu, tarih, an, ttl] of [
    ['show', 'kesin', `${gun}T06:00Z`, `${gun}T05:45Z`, 45 * DAKIKA],
    ['show', 'kesin', `${gun}T19:59Z`, `${gun}T19:44Z`, 45 * DAKIKA],
    ['show', 'kesin', `${gun}T20:00Z`, '2026-11-24T07:00Z', 36 * SAAT],
    ['show', 'kesin', `${gun}T05:59Z`, `${gun}T07:00Z`, 36 * SAAT],
    ['show', 'yalniz_tarih', gun, `${gun}T07:00Z`, 36 * SAAT],
    ['movie', 'yalniz_tarih', gun, `${gun}T07:00Z`, 36 * SAAT],
  ]) {
    const r = yayinZamani({ tur, an_turu, tarih }, 'Europe/Istanbul');
    assert.equal(r.an, T(an));
    assert.equal(r.son - r.an, ttl);
    assert.equal(r.gun, gun);
  }
  assert.equal(yayinZamani({ tur: 'show', an_turu: 'tba', tarih: null }, 'UTC'), null);
});

test('Duyuru kutu anı ile 09:00 push zamanı ve DST ilk 10:00', () => {
  const z = 'America/New_York';
  for (const [tespit, an] of [
    ['2026-03-08T03:59Z', '2026-03-08T03:59Z'],
    ['2026-03-08T04:00Z', '2026-03-08T13:00Z'],
    ['2026-03-08T12:59Z', '2026-03-08T13:00Z'],
    ['2026-03-08T13:00Z', '2026-03-08T13:00Z'],
  ]) {
    assert.deepEqual(duyuruZamani(T(tespit), z), { an: T(an), son: T(tespit) + 7 * 24 * SAAT });
  }
  assert.equal(yayinZamani({ tur: 'show', an_turu: 'kesin', tarih: '2026-03-08T04:30Z' }, z).an, T('2026-03-08T14:00Z'));
  assert.equal(yayinZamani({ tur: 'show', an_turu: 'kesin', tarih: '2026-11-01T03:30Z' }, z).an, T('2026-11-01T15:00Z'));
  assert.equal(duvarAni('2026-11-01', 1, z), T('2026-11-01T05:00Z'));
  assert.equal(duvarAni('2026-03-08', 2, z), T('2026-03-08T07:00Z'));
});

const bolum = (bolum, tarih = `${gun}T09:00:00Z`) => ({
  sezon: 2, bolum, tarih, an_turu: tarih.length === 10 ? 'yalniz_tarih' : 'kesin', durum: 'kesin',
});
const kok = (trakt_id, satirlar, ek = {}) => ({
  tur: 'show', trakt_id, baslik: 'Dizi', takvim_rev: 2, aynalanan_rev: ek.takvim_rev ?? 2, satirlar, ...ek,
});
function planla(kokler, ek = {}, an = simdi) {
  return planlariHesapla({
    girdi: { zaman_dilimi: 'UTC', izlenen: [], onceki: [], olaylar: [], takip: kokler, ...ek },
    kokler: new Map(kokler.map((k) => [`${k.tur}:${k.trakt_id}`, k])), simdi: an, motorBaslangic: simdi - 24 * SAAT,
  });
}

test('Dizi 1 / 2 / 3 / 4 ve belgelenmiş tüm sezon sınırları', () => {
  for (const [adet, kategori] of [[1, 'bolum_yakinda'], [2, 'bolum_grup'], [3, 'bolum_grup'], [4, 'sezon_yayinlandi']]) {
    const [plan] = planla([kok(1, Array.from({ length: adet }, (_, i) => bolum(i + 1)))]).planlar;
    assert.equal(plan.kategori, kategori);
    assert.equal(plan.beklenen_rev, 2);
    assert.equal(plan.planlanan_an, `${gun}T08:45:00.000Z`);
    assert.equal(plan.bolum_kimlikleri.length, adet);
  }
  assert.equal(planla([kok(1, [bolum(1), bolum(2)], { tam: true })]).planlar[0].kategori, 'sezon_yayinlandi');
  assert.equal(planla([kok(1, [bolum(1, gun)])]).planlar[0].kategori, 'bolum_bugun');
});

test('Aynı gün farklı sezonlar için tek kutu ve nötr metin', () => {
  const [plan] = planla([kok(1, [bolum(1), { ...bolum(1), sezon: 3 }])]).planlar;
  assert.equal(plan.kategori, 'bolum_grup');
  const metin = kutuMetni([{ id: 's', dil: 'tr', kategori: 'bolum_grup', baslik: 'S{sezon}', govde: '{adet}', agirlik: 1 }],
    plan, { dil: 'tr' });
  assert.equal(metin.sablon_id, null);
  assert.equal(metin.govde, 'Dizi · 2 yeni bölüm');
});

test('Özet dizi birimlerinden oluşur, erken zamanı seçer ve gönderilmiş özete ekler', () => {
  const dizi = kok(1, [bolum(1), bolum(2)]);
  const ikinci = kok(2, [bolum(1)]);
  const film = kok(3, [{ ...bolum(null, gun), sezon: null }], { tur: 'movie', film_turu: 4 });
  assert.equal(planla([dizi, ikinci]).planlar.length, 2);
  assert.equal(planla([film]).planlar[0].kategori, 'film_dijital');
  const [ozet] = planla([dizi, ikinci, film]).planlar;
  assert.equal(ozet.kategori, 'gunluk_ozet');
  assert.equal(ozet.birimler.length, 3);
  assert.equal(ozet.icerikler.length, 4);
  assert.equal(ozet.beklenen_rev, null);
  assert.equal(ozet.planlanan_an, `${gun}T08:45:00.000Z`);
  const yeni = planla([dizi, ikinci, film, kok(4, [bolum(1)])], {
    onceki: [{ ...ozet, id: 'ozet', kutu_id: 'kutu', durum: 'gonderildi' }],
  });
  assert.deepEqual(yeni.planlar, []);
  assert.deepEqual(yeni.duzeltmeler.map((d) => d.eklenen[0].icerikler[0].kimlik), ['show:4:2:1']);
  assert.equal(planla([1, 2, 3].map((id) => kok(id, [bolum(1, `${gun}T15:00Z`)]))).planlar[0].planlanan_an,
    `${gun}T10:00:00.000Z`);
});

test('Takvim değişimi ve dilim değişimi tamamlanmış bölümü yeniden göndermez', () => {
  const dizi = kok(1, [bolum(1)]);
  const [plan] = planla([dizi]).planlar;
  const bekliyor = { ...plan, id: 'teslim', durum: 'bekliyor' };
  assert.equal(planla([dizi], { onceki: [bekliyor], zaman_dilimi: 'America/New_York' }).planlar[0].planlanan_an,
    `${gun}T15:00:00.000Z`);
  const degisti = kok(1, [bolum(1, `${gun}T11:00Z`)], { takvim_rev: 3 });
  const biten = planla([degisti], { onceki: [{ ...bekliyor, durum: 'gonderildi', kutu_id: 'kutu' }] });
  assert.deepEqual(biten.planlar, []);
  assert.equal(biten.duzeltmeler[0].degisen[0].takvim_rev, 3);
  const belirsiz = kok(1, [{ ...bolum(1), durum: 'eksik_yanit' }], { takvim_rev: 3 });
  assert.deepEqual(planla([belirsiz], { onceki: [bekliyor] }).korunanlar, ['teslim']);
  assert.deepEqual(planla([kok(1, [bolum(1, '2026-11-25T18:01Z')])]).planlar, []);
  assert.deepEqual(planla([dizi], { izlenen: ['show:1:2:1'] }).planlar, []);
});

test('Gönderilmiş dizinin sonradan eklenen bölümü ikinci push veya özet üretmez', () => {
  const [oncekiPlan] = planla([kok(1, [bolum(1)])]).planlar;
  const yeni = planla([kok(1, [bolum(1), bolum(2)]), kok(2, [bolum(1)]), kok(3, [bolum(1)])], {
    onceki: [{ ...oncekiPlan, id: 'ilk', kutu_id: 'kutu', durum: 'gonderildi' }],
  });
  assert.deepEqual(yeni.planlar.map((p) => p.dedupe_anahtari), [`dizi:2:${gun}`, `dizi:3:${gun}`]);
  assert.equal(yeni.duzeltmeler[0].eklenen[0].icerikler[0].kimlik, 'show:1:2:2');
});

test('Yeni Radar duyurusu kutuya erken gider, özet eşiğini değiştirmez', () => {
  for (const tarih of [gun, null]) {
    const satir = { sezon: 2, bolum: null, tarih, an_turu: tarih ? 'yalniz_tarih' : 'tba', durum: tarih ? 'kesin' : 'tba' };
    const tespit_at = '2026-11-22T03:00:00.000Z';
    const olay = { id: 'olay', tur: 'sezon_duyuru', icerik_tur: 'show', trakt_id: 1, sezon: 2,
      tespit_at, alindi_at: tespit_at, veri: { tarih } };
    const { planlar } = planla([kok(1, [satir, bolum(1)]), kok(2, [bolum(1)])], { olaylar: [olay] });
    assert.equal(planlar.length, 3);
    const p = planlar.find((r) => r.olay_id === 'olay');
    assert.equal(p.kategori, tarih ? 'sezon_duyuru' : 'sezon_duyuru_tarihsiz');
    assert.equal(p.kutu_an, tespit_at);
    assert.equal(p.planlanan_an, '2026-11-22T09:00:00.000Z');
  }
});

test('TMDB çıkış türü yalnız eşleşen tarihten alınır, 3 ve 4 çakışırsa vizyon', () => {
  const yayin = (type, tarih = gun) => ({ type, release_date: `${tarih}T00:00:00Z` });
  const veri = (...release_dates) => ({ results: [{ release_dates }] });
  assert.equal(filmTuru(veri(yayin(4), yayin(3, '2026-11-21')), gun), 4);
  assert.equal(filmTuru(veri(yayin(4), yayin(3)), gun), 3);
  assert.equal(filmTuru(veri(yayin(5)), gun), null);
});

test('Özette yalnız açık birimler sayılır, kapalı olanların ayrı kutu planı kalır', () => {
  const diziler = [1, 2, 3].map((id) => kok(id, [bolum(1)]));
  const film = kok(4, [{ ...bolum(null, gun), sezon: null }], { tur: 'movie' });
  const tercihler = { film: false };
  const iki = planla([...diziler.slice(0, 2), film], { tercihler });
  assert.equal(iki.planlar.length, 3);
  assert.ok(iki.planlar.every((p) => p.kategori !== 'gunluk_ozet'));
  const uc = planla([...diziler, film], { tercihler });
  assert.equal(uc.planlar.length, 2);
  assert.equal(uc.planlar.find((p) => p.kategori === 'gunluk_ozet').birimler.length, 3);
  assert.equal(uc.planlar.find((p) => p.kategori === 'film_vizyon').birimler.length, 1);
});

test('İlk motor açılışından önce alınan ve sınırdaki duyuru planlanmaz', () => {
  const dizi = kok(1, [{ sezon: 2, bolum: null, tarih: null, an_turu: 'tba', durum: 'tba' }]);
  const tespit_at = iso(simdi - 36 * SAAT);
  const olay = { id: 'olay', tur: 'sezon_duyuru', icerik_tur: 'show', trakt_id: 1, sezon: 2,
    tespit_at, veri: { tarih: null } };
  for (const fark of [-1, 0, 1]) {
    const alindi_at = iso(simdi - 24 * SAAT + fark);
    const { planlar } = planla([dizi], { olaylar: [{ ...olay, alindi_at }] });
    assert.equal(planlar.length, Number(fark > 0));
    if (fark > 0) {
      assert.equal(planlar[0].olay_alindi_at, alindi_at);
      const onceki = [{ ...planlar[0], id: 'duyuru', durum: 'iptal', iptal_nedeni: 'rev_degisti', kutu_id: 'kutu' }];
      assert.equal(planla([dizi], { onceki, olaylar: [{ ...olay, alindi_at }] }).planlar.length, 1);
    }
  }
});

test('Ayna gerideyken eski grup korunur ve başka dizinin planı donmaz', () => {
  const dizi = kok(1, [bolum(1)]);
  const geride = { ...dizi, takvim_rev: 3 };
  const onceki = [{ ...planla([dizi]).planlar[0], id: 'eski', durum: 'bekliyor' }];
  const sonuc = planla([geride, kok(2, [bolum(1)])], { onceki });
  assert.deepEqual(sonuc.korunanlar, ['eski']);
  assert.deepEqual(sonuc.planlar.map((p) => p.dedupe_anahtari), [`dizi:2:${gun}`]);
});

test('Gece yarısı seri hale getirilen tarih-yalnız gün Amerika’da geriye kaymaz', () => {
  const tarih = `${gun}T00:00:00Z`;
  const dilim = 'America/Los_Angeles';
  for (const r of [{ tur: 'movie', an_turu: 'kesin' }, { tur: 'show', an_turu: 'yalniz_tarih' }]) {
    assert.equal(yayinZamani({ ...r, tarih }, dilim).an, T(`${gun}T18:00:00Z`));
  }
  assert.equal(tarihMetni(tarih, dilim, 'en', true), 'on Nov 23');
  assert.equal(tarihMetni(tarih, dilim, 'en'), 'on Nov 22');
});

test('Şablon hatasında eski havuz, ilk hatada yedek ve düzeltmede özgün şablon kullanılır', async () => {
  let an = simdi;
  let cagrilar = 0;
  const s = { id: 'eski', dil: 'tr', kategori: 'gunluk_ozet', aktif: true, agirlik: 1, baslik: 'Özet', govde: '{adet} yapım' };
  const havuz = sablonHavuzu(async () => {
    cagrilar++;
    if (cagrilar === 1) return [s];
    throw new Error('kapali');
  }, () => an);
  assert.deepEqual(await havuz(), [s]);
  an += 10 * DAKIKA;
  assert.deepEqual(await havuz(), [s]);
  assert.deepEqual(await havuz(), [s]);
  assert.equal(cagrilar, 2);
  const bos = await sablonHavuzu(async () => { throw new Error('kapali'); })();
  const p = { kategori: 'gunluk_ozet', zaman_dilimi: 'UTC', birimler: [{ icerikler: [] }] };
  assert.equal(kutuMetni(bos, p, { dil: 'tr' }).govde, 'Bugün 1 yapım yayında.');
  assert.equal(kutuMetni(bos, p, { dil: 'en', kutu_sablonu: s }).sablon_id, 'eski');
  assert.equal(kutuMetni(bos, p, { dil: 'en', kutu_sablonu: s }).govde, '1 yapım');
  for (const kategori of KATEGORILER) assert.ok(kutuMetni([], { ...p, kategori }, {}).govde);
});

test('Şablon dili, ağırlık, son şablon, grafem ve tüm TR ay ekleri', async () => {
  assert.equal(KATEGORILER.length, 15);
  assert.equal(tarihMetni('2026-01-13T22:30Z', 'Europe/Istanbul', 'en'), 'on Jan 14');
  assert.equal(tarihMetni('2026-01-14', 'America/Los_Angeles', 'tr'), "14 Ocak'ta");
  assert.deepEqual(Array.from({ length: 12 }, (_, i) => tarihMetni(`2026-${String(i + 1).padStart(2, '0')}-01`, 'UTC', 'tr')),
    ["1 Ocak'ta", "1 Şubat'ta", "1 Mart'ta", "1 Nisan'da", "1 Mayıs'ta", "1 Haziran'da", "1 Temmuz'da",
      "1 Ağustos'ta", "1 Eylül'de", "1 Ekim'de", "1 Kasım'da", "1 Aralık'ta"]);
  const emoji = '👩🏽‍💻';
  assert.equal(basligiKisalt(emoji.repeat(28)), emoji.repeat(28));
  assert.equal(basligiKisalt(emoji.repeat(29)), emoji.repeat(27) + '…');
  const satir = { kategori: 'sezon_duyuru', dil: 'en', aktif: true, baslik: '{baslik}', govde: 'S{sezon} {tarih}', agirlik: 1 };
  const uzak = [{ ...satir, id: 'hafif' }, { ...satir, id: 'agir', agirlik: 9 }, { ...satir, id: 'kapali', aktif: false }];
  let saat = simdi;
  let cagrilar = 0;
  const sablonlar = sablonHavuzu(async () => { cagrilar++; return uzak; }, () => saat);
  const [havuz] = await Promise.all([sablonlar(), sablonlar()]);
  assert.equal(cagrilar, 1);
  saat += 10 * DAKIKA;
  assert.equal((await sablonlar()).length, 2);
  assert.equal(cagrilar, 2);
  const p = { kategori: satir.kategori, zaman_dilimi: 'Europe/Istanbul',
    birimler: [{ baslik: 'Dizi', sezon: '002', icerikler: [{ tarih: iso(T('2026-01-13T22:30Z')) }] }] };
  assert.equal(kutuMetni(havuz, p, { dil: 'de', rastgele: () => 0.1 }).sablon_id, 'agir');
  const metin = kutuMetni(havuz, p, { dil: 'de', son_sablon_id: 'agir', rastgele: () => 0.9 });
  assert.equal(metin.govde, 'S2 on Jan 14');
  assert.equal(metin.sablon_id, 'hafif');
});
