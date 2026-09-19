// ==========================================================================
// §C30 — ANLIK AKTARIM + EKSİKTE ÇEKME
// ==========================================================================
// 🔴 İDDİALAR (kullanıcının ölçeklenme şartları):
//   • Tekilleştirme: aynı kök pencerede N kez → TEK gönderim
//   • Mikro parti: pencere içindeki kökler TEK uçuşta, tavan aşılınca bölünür
//   • Eşzamanlılık 1: aynı anda iki uçuş YOK
//   • Yeniden deneme artan aralıkla, tavandan sonra BIRAKILIR (gece aynası taşır)
//   • `hemen()` pencereyi beklemez ve sonucu döndürür
//   • Arşiv kuyruğu: başarılı yazımdan sonra `sonrasi` çağrılır; `bekle()`
//     yazım bitene kadar bekler
//   • Eksikte çekme: arşivde varsa Trakt'a GİTMEZ; yoksa çeker, bekler, aktarır;
//     Trakt 404 → `traktta_yok`; kapalı sır → uç kapalı
//
// Ağ YOK: `global.fetch` sahte, Trakt `fetcher`'ı enjekte.

const path = require('path');
const { baslat, AR, LF } = require('../yardimci');

const T = baslat('ANLIK AKTARIM (C30)', { kokOneki: 'ar-anlik-' });

const db = require(path.join(AR, 'db'));
const { createAnlikAktarim } = require(path.join(AR, 'anlikAktarim'));
const { createArchiveQueue } = require(path.join(AR, 'queue'));
const { initLazyFetchPaths } = require(path.join(LF, 'paths'));

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

/** Sahte gönderici: çağrıları kaydeder, eşzamanlılığı ölçer. */
function sahteGonderici({ basarisizSayisi = 0, gecikme = 20 } = {}) {
  const cagrilar = [];
  let ucan = 0;
  let enCokUcan = 0;
  let kalanHata = basarisizSayisi;
  const gonder = async (fazlar) => {
    ucan += 1;
    enCokUcan = Math.max(enCokUcan, ucan);
    await bekle(gecikme);
    ucan -= 1;
    cagrilar.push(fazlar);
    if (kalanHata > 0) { kalanHata -= 1; return { ok: false, reason: 'http_503' }; }
    return { ok: true, yazilan: 1 };
  };
  return { gonder, cagrilar, enCokUcan: () => enCokUcan };
}
const fazlariKur = (kokler) => [{ faz: 'entities', satirlar: kokler.map((k) => ({ kaymak_id: k })) }];
const kokleri = (cagri) => cagri[0].satirlar.map((s) => s.kaymak_id);

(async () => {
  const durum = db.initArchive();
  if (!durum.enabled) { T.ok('Arsiv acilamadi', false, durum.reason); T.bitir(); return; }
  initLazyFetchPaths();

  // ======================================================================
  T.H('Aktarim kuyrugu: tekillestirme + mikro parti');
  // ======================================================================
  {
    const g = sahteGonderici();
    const a = createAnlikAktarim({ gonder: g.gonder, fazlariKur, pencereMs: 40, acik: () => true });
    for (let i = 0; i < 10; i++) a.ekle('show_A');
    a.ekle('show_B');
    a.ekle('movie_C');
    await bekle(150);
    T.ok('12 ekleme -> TEK gonderim', g.cagrilar.length === 1, `${g.cagrilar.length} gonderim`);
    T.ok('Uc tekil kok birlikte gitti', JSON.stringify(kokleri(g.cagrilar[0]).sort()) === '["movie_C","show_A","show_B"]');
    T.ok('Istatistik: 9 tekillesme', a.getStats().tekillesen === 9, JSON.stringify(a.getStats()));
  }
  {
    const g = sahteGonderici();
    const a = createAnlikAktarim({ gonder: g.gonder, fazlariKur, pencereMs: 10, partiKok: 3, acik: () => true });
    for (let i = 0; i < 7; i++) a.ekle('show_' + i);
    await bekle(300);
    T.ok('Parti tavani 3: 7 kok -> 3 gonderim (3+3+1)',
      g.cagrilar.map((c) => c[0].satirlar.length).join('+') === '3+3+1',
      g.cagrilar.map((c) => c[0].satirlar.length).join('+'));
    T.ok('Esazamanlilik 1: ayni anda en cok bir ucus', g.enCokUcan() === 1);
  }

  // ======================================================================
  T.H('Yeniden deneme ve birakma');
  // ======================================================================
  {
    const g = sahteGonderici({ basarisizSayisi: 2 });
    const a = createAnlikAktarim({ gonder: g.gonder, fazlariKur, pencereMs: 5, ilkBeklemeMs: 20, denemeTavani: 4, acik: () => true });
    const sonuc = await a.hemen('show_R');
    T.ok('2 hata sonra basari: hemen() ok doner', sonuc.ok === true && g.cagrilar.length === 3, `${g.cagrilar.length} deneme`);
  }
  {
    const g = sahteGonderici({ basarisizSayisi: 99 });
    const a = createAnlikAktarim({ gonder: g.gonder, fazlariKur, pencereMs: 5, ilkBeklemeMs: 10, denemeTavani: 3, acik: () => true });
    const sonuc = await a.hemen('show_X');
    T.ok('Tavan 3: uc denemeden sonra BIRAKILDI, hata doner',
      sonuc.ok === false && g.cagrilar.length === 3 && a.getStats().birakilan === 1 && a.getStats().bekleyen === 0,
      JSON.stringify(a.getStats()));
  }
  {
    const g = sahteGonderici();
    const a = createAnlikAktarim({ gonder: g.gonder, fazlariKur, pencereMs: 5000, acik: () => true });
    const t0 = Date.now();
    const s = await a.hemen('show_H');
    T.ok('hemen() 5 sn pencereyi BEKLEMEZ', s.ok && Date.now() - t0 < 500, `${Date.now() - t0} ms`);
    T.ok('Kapali iken ekle() hicbir sey yapmaz',
      createAnlikAktarim({ gonder: g.gonder, fazlariKur, acik: () => false }).ekle('show_K') === false);
    const bos = createAnlikAktarim({ gonder: g.gonder, fazlariKur: () => [], pencereMs: 5, acik: () => true });
    T.ok('Bos alt agac: gonderim yok, basari', (await bos.hemen('show_Y')).ok === true);
  }

  // ======================================================================
  T.H('Arsiv kuyrugu kancalari: sonrasi + bekle');
  // ======================================================================
  {
    const sonralar = [];
    let bitti = false;
    const q = createArchiveQueue({
      worker: async () => { await bekle(30); bitti = true; return { ok: true, showKaymakId: 'show_Q' }; },
      sonrasi: (is, sonuc) => sonralar.push(sonuc.showKaymakId),
    });
    const is = { provider: 'trakt', family: 'show_seasons', path: '/shows/1/seasons', query: { extended: 'full,episodes' } };
    q.enqueue(is);
    await q.bekle(is);
    T.ok('bekle() yazim BITTIKTEN sonra doner', bitti === true);
    T.ok('sonrasi basarili yazimda cagrildi', sonralar.join() === 'show_Q');
    T.ok('Kuyrukta olmayan is icin bekle() hemen doner',
      await Promise.race([q.bekle({ ...is, path: '/shows/2/seasons' }).then(() => true), bekle(50).then(() => false)]));

    const q2 = createArchiveQueue({
      worker: async () => ({ ok: true }),
      sonrasi: () => { throw new Error('patladi'); },
    });
    q2.enqueue(is);
    await q2.drain();
    T.ok('sonrasi patlasa bile kuyruk yazimi sayar', q2.getStats().yazilan === 1 && q2.getStats().hata === 0);
  }

  // ======================================================================
  T.H('Eksikte cekme');
  // ======================================================================
  const { eksikteCek, istegiDogrula } = require(path.join(AR, 'eksikteCek'));
  const yazici = require(path.join(AR, 'writer'));
  process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL = 'http://sahte-worker';
  process.env.PI_SYNC_SECRET = 's'.repeat(40);
  const gonderilen = [];
  global.fetch = async (url, init) => {
    const g = JSON.parse(init.body);
    gonderilen.push(g);
    return { ok: true, json: async () => ({ yazilan: g.satirlar.length, atlanan: 0 }), text: async () => '' };
  };

  T.ok('Dogrulama: gecersiz tur/id/sezon reddedilir',
    istegiDogrula({ tur: 'person', traktId: 1 }).hata === 'tur'
      && istegiDogrula({ tur: 'show', traktId: -1 }).hata === 'traktId'
      && istegiDogrula({ tur: 'show', traktId: 5, sezon: 'x' }).hata === 'sezon'
      && istegiDogrula({ tur: 'show', traktId: 5, sezon: 1, bolumler: new Array(101).fill(1) }).hata === 'bolumler');
  T.ok('Dogrulama: gecerli istek, bolumler tekillesir',
    JSON.stringify(istegiDogrula({ tur: 'show', traktId: 5, sezon: 2, bolumler: [3, 3, 4] }).bolumler) === '[3,4]');

  // Arsivde VAR → Trakt'a gidilmez
  await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'show_seasons', path: '/shows/777/seasons', data: [
    { number: 1, ids: { trakt: 7771 }, episodes: [{ number: 1, ids: { trakt: 77711 } }] },
  ] });
  let traktCagrisi = 0;
  const sayanFetcher = async () => { traktCagrisi += 1; return { data: null }; };
  gonderilen.length = 0;
  const r1 = await eksikteCek({ tur: 'show', traktId: 777, sezon: 1, bolumler: [1] }, { fetcher: sayanFetcher });
  T.ok('Arsivde var: arsivden_aktarildi, Trakt cagrisi 0',
    r1.ok && r1.durum === 'arsivden_aktarildi' && traktCagrisi === 0 && gonderilen.length > 0, JSON.stringify(r1));

  // Arsivde YOK → çek, bekle, aktar
  const cekilenYollar = [];
  const tazeFetcher = async (p) => {
    cekilenYollar.push(p);
    if (p.endsWith('/seasons')) {
      return { data: [{ number: 1, ids: { trakt: 8881 }, episodes: [
        { number: 1, ids: { trakt: 88811 } }, { number: 2, ids: { trakt: 88812 } }] }], maxAgeSeconds: 3600 };
    }
    return { data: { title: 'Yeni Dizi', year: 2026, ids: { trakt: 888, slug: 'yeni-dizi' } }, maxAgeSeconds: 3600 };
  };
  gonderilen.length = 0;
  const r2 = await eksikteCek({ tur: 'show', traktId: 888, sezon: 1, bolumler: [2] }, { fetcher: tazeFetcher });
  T.ok('Arsivde yok: cekildi_aktarildi', r2.ok && r2.durum === 'cekildi_aktarildi', JSON.stringify(r2));
  T.ok('Istemciyle ayni iki yol cekildi', cekilenYollar.join() === '/shows/888,/shows/888/seasons', cekilenYollar.join());
  const giden = gonderilen.flatMap((g) => g.satirlar);
  T.ok('Aktarilanda dizi + sezon + 2 bolum + trakt:episode kimlikleri var',
    giden.filter((s) => s.type === 'episode').length === 2
      && giden.some((s) => s.source === 'trakt:episode' && s.source_id === '88812'),
    `${giden.length} satir`);

  // Istenen bolum Trakt'ta da yok
  const r3 = await eksikteCek({ tur: 'show', traktId: 888, sezon: 1, bolumler: [9] }, { fetcher: tazeFetcher });
  T.ok('Olmayan bolum: cekildi_eksik (yalanci basari yok)', !r3.ok && r3.durum === 'cekildi_eksik', JSON.stringify(r3));

  // Trakt 404
  const { NotFoundError } = require(path.join(LF, 'errors'));
  const r4 = await eksikteCek({ tur: 'movie', traktId: 999999 }, { fetcher: async () => { throw new NotFoundError('yok'); } });
  T.ok('Trakt 404: traktta_yok', !r4.ok && r4.durum === 'traktta_yok', JSON.stringify(r4));

  // ======================================================================
  T.H('Kapi: sir ve oran siniri');
  // ======================================================================
  {
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use('/api/katalog-cek', require(path.join(AR, '..', 'katalogCek')));
    const sunucu = app.listen(0);
    const port = sunucu.address().port;
    const gercekFetch = require('node:http');
    const istek = (sir, govde) => new Promise((resolve) => {
      const r = gercekFetch.request({ port, path: '/api/katalog-cek', method: 'POST',
        headers: { 'content-type': 'application/json', ...(sir ? { 'x-kaymak-sync-secret': sir } : {}) } },
      (res) => { let b = ''; res.on('data', (c) => { b += c; }); res.on('end', () => resolve({ s: res.statusCode, b })); });
      r.end(JSON.stringify(govde));
    });
    T.ok('Sirsiz: 401', (await istek(null, { tur: 'movie', traktId: 1 })).s === 401);
    T.ok('Yanlis sir: 401', (await istek('y'.repeat(40), { tur: 'movie', traktId: 1 })).s === 401);
    T.ok('Dogru sir + bozuk govde: 400', (await istek('s'.repeat(40), { tur: 'x' })).s === 400);
    const eski = process.env.PI_SYNC_SECRET;
    process.env.PI_SYNC_SECRET = 'kisa';
    T.ok('Sunucuda sir yok/kisa: uc KAPALI (503)', (await istek('kisa', { tur: 'movie', traktId: 1 })).s === 503);
    process.env.PI_SYNC_SECRET = eski;
    sunucu.close();
  }

  T.bitir();
})().catch((e) => {
  T.ok('Beklenmeyen hata: ' + e.message, false, e.stack);
  T.bitir();
});
