// ==========================================================================
// ARSIV — TUTARLILIK KILIDI (Parca A) + AKILLI SURE (Parca C) + GECE TURU (Parca E)
// ==========================================================================
// Olcum kaynagi (2026-10-29, Pi arsivi): "Cekic ve Gul" (Trakt 199742) ozet 30
// bolum / sezon listesi 22. Ham kural 1.100 dizide 6 kez tetikleniyordu; uc
// koruma ile yalniz 1 (gercek) kaldi. Bu test o dort ornek durumu sabitler.

const path = require('path');
const { baslat, AR } = require('../yardimci');

const T = baslat('ARSIV TUTARLILIK KILIDI (Parca A + C + E)', { kokOneki: 'ar-tutarlilik-' });
process.env.ARCHIVE_ROOT = path.join(T.kok, 'archive');

const db = require(path.join(AR, 'db'));
const { archiveSimplePayload, archiveShowSeasons } = require(path.join(AR, 'writer'));
const tut = require(path.join(AR, 'tutarlilik'));
const { tamamla } = require(path.join(AR, 'backfillTamamla'));
const zam = require(path.join(AR, 'backfillSchedule'));
const rr = require(path.join(AR, '..', 'lazyfetch', 'routeRegistry'));
const { createEnvelope } = require(path.join(AR, '..', 'lazyfetch', 'envelope'));
const { arsivDiziDurumu } = require(path.join(AR, '..', 'lazyfetch', 'fetchAndStore'));

const SAAT = 3600 * 1000;
const GUN = 24 * SAAT;
const SIMDI = Date.now();
const gecmis = (gunOnce) => new Date(SIMDI - gunOnce * GUN).toISOString();
const gelecek = (gunSonra) => new Date(SIMDI + gunSonra * GUN).toISOString();

/** Trakt `show_seasons` bicimi. `sezonlar`: [[sezonNo, [first_aired...]], ...] */
let bolumKimlik = 9000000;
function sezonYaniti(traktId, sezonlar) {
  return sezonlar.map(([no, tarihler]) => ({
    number: no,
    ids: { trakt: traktId * 100 + no },
    episodes: tarihler.map((t, i) => ({ season: no, number: i + 1, title: `S${no}E${i + 1}`, first_aired: t, ids: { trakt: bolumKimlik++ } })),
  }));
}
const tekrar = (n, f) => Array.from({ length: n }, (_, i) => f(i));

/** Diziyi arsive iki yukuyle yazar (ozet `tr`, sezonlar `-`). */
async function diziYaz({ traktId, ad, ozetAired, ozetAt, sezonlar, sezonlarAt, durum = 'returning series' }) {
  const o = await archiveSimplePayload({
    type: 'show', endpoint: 'show_detail', lang: 'tr', fetchedAt: ozetAt,
    data: { title: ad, year: 2022, status: durum, aired_episodes: ozetAired, ids: { trakt: traktId, slug: `dizi-${traktId}` } },
  });
  const s = await archiveShowSeasons({ showId: String(traktId), seasons: sezonYaniti(traktId, sezonlar), lang: '-', fetchedAt: sezonlarAt });
  return { kaymakId: o.kaymakId, ozetOk: o.ok, sezonOk: s.ok };
}

(async () => {
  db.initArchive();

  // ================================================================
  T.H('SAF: tarihe gore yayinlanmis bolum sayimi');
  // ================================================================
  const ornek = [
    { number: 0, episodes: [{ first_aired: gecmis(10) }] },               // S0 sayilmaz
    { number: 1, episodes: [{ first_aired: gecmis(5) }, { first_aired: gecmis(1) }] },
    { number: 2, episodes: [{ first_aired: gelecek(2) }, { first_aired: null }] }, // gelecek + tarihsiz sayilmaz
  ];
  T.ok('S0, gelecek ve tarihsiz bolum SAYILMAZ', tut.yayinlanmisBolumSayisi(ornek, SIMDI) === 2);

  // ================================================================
  T.H('SAF: uc korumali karar (olculmus dort ornek)');
  // ================================================================
  const s22 = sezonYaniti(1, [[1, tekrar(8, () => gecmis(400))], [2, tekrar(7, () => gecmis(300))], [3, tekrar(7, () => gecmis(60))]]);
  const cekic = tut.celiskiVarMi({ ozet: { aired_episodes: 30 }, ozetAt: SIMDI - 4 * GUN, sezonlar: s22, sezonlarAt: SIMDI - 11 * GUN, simdi: SIMDI });
  T.ok('Cekic ve Gul (ozet 30 > liste 22, ozet yeni, liste 11 gunluk) -> CELISKI', cekic.celiski === true && cekic.sezonSayi === 22, JSON.stringify(cekic));

  // Love is Blind: liste cekildiginde 141 yayinlanmisti, simdi 147'si tarihce gecmis; ozet 144.
  const love = sezonYaniti(2, [[1, tekrar(147, () => gecmis(3))]]);
  love[0].aired_episodes = 141;
  const lv = tut.celiskiVarMi({ ozet: { aired_episodes: 144 }, ozetAt: SIMDI - 1 * GUN, sezonlar: love, sezonlarAt: SIMDI - 3 * GUN, simdi: SIMDI });
  T.ok('Love is Blind (alan 141 / tarih 147, ozet 144) -> celiski YOK (tarihe gore sayim)', lv.celiski === false && lv.neden === 'tutarli', JSON.stringify(lv));

  // Das Traumschiff: ozet daha ESKI ama 1 fazla (Trakt'in kendi tutarsizligi).
  const dt = tut.celiskiVarMi({ ozet: { aired_episodes: 119 }, ozetAt: SIMDI - 39 * GUN, sezonlar: sezonYaniti(3, [[1, tekrar(118, () => gecmis(50))]]), sezonlarAt: SIMDI - 1 * GUN, simdi: SIMDI });
  T.ok('Das Traumschiff (ozet eski, 119 > 118) -> celiski YOK (sonsuz dongu korumasi)', dt.celiski === false && dt.neden === 'ozet_daha_eski', JSON.stringify(dt));

  const yeni = tut.celiskiVarMi({ ozet: { aired_episodes: 30 }, ozetAt: SIMDI - 1 * SAAT, sezonlar: s22, sezonlarAt: SIMDI - 2 * SAAT, simdi: SIMDI });
  T.ok('Liste 6 saatten genc -> celiski YOK (bekleme)', yeni.celiski === false && yeni.neden === 'liste_cok_yeni', JSON.stringify(yeni));
  T.ok('Veri eksik -> celiski YOK, throw yok', tut.celiskiVarMi({ ozet: {}, sezonlar: null }).celiski === false);

  // ================================================================
  T.H('ARSIV: tarama yalniz gercek celiskiyi bulur');
  // ================================================================
  const c = await diziYaz({
    traktId: 199742, ad: 'The Hammer and The Rose', ozetAired: 30, ozetAt: SIMDI - 4 * GUN,
    sezonlar: [[1, tekrar(8, () => gecmis(400))], [2, tekrar(7, () => gecmis(300))], [3, tekrar(7, () => gecmis(60))]],
    sezonlarAt: SIMDI - 11 * GUN,
  });
  T.ok('Cekic fiksturu arsive yazildi', c.ozetOk && c.sezonOk, JSON.stringify(c));
  const d = await diziYaz({
    traktId: 180770, ad: 'Silo', ozetAired: 10, ozetAt: SIMDI - 2 * GUN,
    sezonlar: [[0, [gecmis(100)]], [1, tekrar(10, () => gecmis(200))], [2, [gelecek(30)]]], sezonlarAt: SIMDI - 2 * GUN,
  });
  T.ok('Tutarli dizi (Silo benzeri, S0 + gelecek bolum) yazildi', d.ozetOk && d.sezonOk);
  const e = await diziYaz({
    traktId: 777001, ad: 'Das Traumschiff', ozetAired: 5, ozetAt: SIMDI - 39 * GUN,
    sezonlar: [[1, tekrar(4, () => gecmis(60))]], sezonlarAt: SIMDI - 1 * GUN,
  });
  T.ok('Ozeti eski dizi yazildi', e.ozetOk && e.sezonOk);

  const bulunan = tut.celiskiliDiziler({ simdi: SIMDI });
  T.ok('Tarama: TAM 1 celiski (Cekic), digerleri yok', bulunan.length === 1 && bulunan[0].traktId === '199742', JSON.stringify(bulunan));
  T.ok('Tarama sayilari olcumle ayni (30 > 22)', bulunan[0] && bulunan[0].ozetSayi === 30 && bulunan[0].sezonSayi === 22);

  const hedefler = tut.celiskiHedefleri('tr', { simdi: SIMDI });
  T.ok('Gece hedefi: yalniz show_seasons, zorla + tutarlilikBakimi',
    hedefler.length === 1 && hedefler[0].endpoint === 'show_seasons' && hedefler[0].path === '/shows/199742/seasons'
      && hedefler[0].zorla === true && hedefler[0].tutarlilikBakimi === true && hedefler[0].lang === '-',
    JSON.stringify(hedefler));

  // ================================================================
  T.H('KANCA: ozet yazildiktan sonra sezon listesi tazelenir');
  // ================================================================
  tut._sifirla();
  const cagrilar = [];
  const sahteResolve = async (args) => { cagrilar.push(args); return { status: 'fresh-fetch', data: [] }; };
  const k1 = tut.yazimSonrasiKontrol({ provider: 'trakt', family: 'show_detail' }, { ok: true, kaymakId: c.kaymakId },
    { resolve: sahteResolve, fetcher: {}, simdi: SIMDI });
  T.ok('Celiskili ozet yazimi -> tetiklendi', !!k1 && k1.traktId === '199742');
  await (k1 && k1.bekle);
  T.ok('Tazeleme dogru yol + kanonik sorgu + 6 sa yas siniriyla',
    cagrilar.length === 1 && cagrilar[0].path === '/shows/199742/seasons' && cagrilar[0].query.extended === 'full,episodes'
      && cagrilar[0].maxEnvelopeAgeMs === tut.BEKLEME_MS && cagrilar[0].provider === 'trakt',
    JSON.stringify(cagrilar));
  const iz = db.getDb().prepare("SELECT detail FROM sync_log WHERE event = 'tutarlilik'").all();
  T.ok('sync_log a "tutarlilik" satiri dustu', iz.length === 1 && /ozet 30 > sezon listesi 22/.test(iz[0].detail), JSON.stringify(iz));

  const k2 = tut.yazimSonrasiKontrol({ provider: 'trakt', family: 'show_detail' }, { ok: true, kaymakId: c.kaymakId },
    { resolve: sahteResolve, fetcher: {}, simdi: SIMDI + 1 * SAAT });
  T.ok('6 saat icinde ikinci yazim -> TETIKLENMEZ', k2 === null && cagrilar.length === 1);

  tut._sifirla();
  T.ok('Sezon listesi yazimi -> kanca ILGILENMEZ',
    tut.yazimSonrasiKontrol({ provider: 'trakt', family: 'show_seasons' }, { ok: true, kaymakId: c.kaymakId }, { resolve: sahteResolve, fetcher: {} }) === null);
  T.ok('Tutarli dizinin ozeti -> TETIKLENMEZ',
    tut.yazimSonrasiKontrol({ provider: 'trakt', family: 'show_detail' }, { ok: true, kaymakId: d.kaymakId }, { resolve: sahteResolve, fetcher: {} }) === null);
  T.ok('Bozuk girdi -> null, throw YOK', tut.yazimSonrasiKontrol(null, null) === null);

  tut._sifirla();
  const patlayan = async () => { throw new Error('trakt coktu'); };
  const k3 = tut.yazimSonrasiKontrol({ provider: 'trakt', family: 'show_detail' }, { ok: true, kaymakId: c.kaymakId }, { resolve: patlayan, fetcher: {}, simdi: SIMDI });
  let sizdi = false;
  try { await (k3 && k3.bekle); } catch (_) { sizdi = true; }
  T.ok('Tazeleme hatasi YUTULUR ve loglanir (yazimi bozamaz)', !sizdi && db.getDb().prepare("SELECT count(*) c FROM sync_log WHERE detail LIKE 'tutarlilik tazelemesi:%'").get().c === 1);

  // ================================================================
  T.H('TAMAMLA: tutarlilikBakimi hedefi onbellek yas sinirini gecer');
  // ================================================================
  const gorulenArg = [];
  await tamamla({
    hedefler,
    fetcher: {},
    resolve: async (a) => { gorulenArg.push(a); return { status: 'fresh-fetch', data: [], fetchedAt: SIMDI }; },
    arsivle: async () => ({ ok: true }),
    beklemeMs: 0,
  });
  T.ok('tamamla -> maxEnvelopeAgeMs = 6 sa', gorulenArg.length === 1 && gorulenArg[0].maxEnvelopeAgeMs === tut.BEKLEME_MS, JSON.stringify(gorulenArg.map((a) => a.maxEnvelopeAgeMs)));

  // ================================================================
  T.H('GECE TURU (Parca E): 522 iptal ettirmez, sira celiski -> akis -> en eski');
  // ================================================================
  T.ok('Bayat arsiv tavani 60', zam.BAYAT_TAVAN === 60);

  // Bayat (10 gunden eski) ama celiskisiz bir dizi — "en eski" kovasi.
  const b = await diziYaz({
    traktId: 555001, ad: 'Bayat Dizi', ozetAired: 4, ozetAt: SIMDI - 20 * GUN,
    sezonlar: [[1, tekrar(4, () => gecmis(30))]], sezonlarAt: SIMDI - 15 * GUN,
  });
  T.ok('Bayat dizi yazildi', b.ozetOk && b.sezonOk);

  const oncekiId = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID;
  process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID = 'test-istemci';
  let verilen = null;
  const sahteTamamla = async ({ hedefler: h }) => { verilen = h; return { denenen: h.length, yazilan: h.length, bulunamadi: 0, basarisiz: 0, onbellekten: 0, zorlaCekilen: 0, atlanan: 0, ardisikHata: 0, durduranSebep: null }; };
  let aktarimCagrildi = false;
  const sahteAktarim = async () => { aktarimCagrildi = true; return { calisti: false }; };

  const r522 = await zam.runBackfill({
    kaynakOku: async () => ({ ok: false, reason: 'http 522' }), fetcher: {}, tamamlaFn: sahteTamamla, aktarimFn: sahteAktarim,
  });
  const yollar = (verilen || []).map((h) => h.path);
  T.ok('Kaynak 522 -> tur IPTAL OLMADI (ok:true, sebep tasindi)', r522.ok === true && r522.kaynakHatasi === 'http 522', JSON.stringify(r522));
  T.ok('522 de celiski + bayat diziler YINE islendi', yollar.includes('/shows/199742/seasons') && yollar.includes('/shows/555001/seasons'), JSON.stringify(yollar));
  T.ok('Celiski EN BASTA', yollar[0] === '/shows/199742/seasons', JSON.stringify(yollar));
  T.ok('522 de aktarim turu DENENMEDI (Supabase e muhtac)', aktarimCagrildi === false && r522.aktarim.atlandi === 'kaynak_okunamadi');
  const log522 = db.getDb().prepare("SELECT detail FROM sync_log WHERE event = 'backfill' AND detail LIKE 'kaynak okunamadi%'").all();
  T.ok('sync_log: "kaynak okunamadi: http 522 — yalniz arsiv tazelemesi"', log522.length === 1 && /yalniz arsiv tazelemesi/.test(log522[0].detail), JSON.stringify(log522));

  verilen = null;
  aktarimCagrildi = false;
  const rOk = await zam.runBackfill({
    kaynakOku: async () => ({ ok: true, items: [{ traktId: '444001', type: 'show' }] }), fetcher: {}, tamamlaFn: sahteTamamla, aktarimFn: sahteAktarim,
  });
  const sira = (verilen || []).map((h) => h.path);
  const iCel = sira.indexOf('/shows/199742/seasons');
  const iAkis = sira.indexOf('/shows/444001');
  const iBayat = sira.indexOf('/shows/555001/seasons');
  T.ok('Kaynak saglam -> sira celiski -> akis -> en eski', rOk.ok === true && iCel === 0 && iAkis > iCel && iBayat > iAkis, JSON.stringify(sira));
  T.ok('Kaynak saglam -> aktarim turu calisti', aktarimCagrildi === true);
  T.ok('Ayni hedef iki kez denenmez (celiskili dizi bayat da olsa tek kopya)', sira.filter((p) => p === '/shows/199742/seasons').length === 1, JSON.stringify(sira));
  if (oncekiId === undefined) delete process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID; else process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID = oncekiId;

  // ================================================================
  T.H('PARCA C: akilli sure (show_seasons) — yayin + 6 sa sinir');
  // ================================================================
  const TRAKT_BEYAN = 43200; // Trakt s-maxage = 12 sa (olculdu)
  const sezonlu = (tarihler) => [{ number: 1, episodes: tarihler.map((t) => ({ first_aired: t })) }];
  const sinirKontrol = (ttl, sonrakiMs) => ttl * rr.JITTER_UST <= sonrakiMs + rr.YAYIN_PAYI_MS - SIMDI + 1;

  const haftalik = rr.resolveTtl(TRAKT_BEYAN, { family: 'show_seasons', data: sezonlu([gecmis(4), gelecek(3)]), now: SIMDI });
  T.ok('Haftalik dizi (sonraki bolum 3 gun sonra) -> sure 7 gunden KISA ve sinira sigar',
    haftalik.ttlMs < 7 * GUN && sinirKontrol(haftalik.ttlMs, SIMDI + 3 * GUN), `${(haftalik.ttlMs / SAAT).toFixed(1)} sa`);

  const birSaat = rr.resolveTtl(TRAKT_BEYAN, { family: 'show_seasons', data: sezonlu([gecmis(6), new Date(SIMDI + 1 * SAAT).toISOString()]), now: SIMDI });
  T.ok('🔴 Bolum 1 sa sonra -> Trakt in 12 sa tabanini da KESER (yayin + 6 sa)',
    birSaat.ttlMs < 12 * SAAT && sinirKontrol(birSaat.ttlMs, SIMDI + 1 * SAAT), `${(birSaat.ttlMs / SAAT).toFixed(2)} sa`);

  const uzak = rr.resolveTtl(TRAKT_BEYAN, { family: 'show_seasons', data: sezonlu([gecmis(60), gelecek(300)]), now: SIMDI });
  T.ok('Sonraki bolum 300 gun sonra (Silo S4E1 benzeri) -> 7 gun (degismedi)', uzak.ttlMs === 7 * GUN);

  const cekicSure = rr.resolveTtl(TRAKT_BEYAN, { family: 'show_seasons', data: sezonlu([gecmis(400)]), durum: 'returning series', now: SIMDI });
  T.ok('🔴 Cekic ve Gul (son bolum 400 gun once, durum returning) -> 7 gun (eskiden 30)', cekicSure.ttlMs === 7 * GUN);
  T.ok('Bitmis dizi (durum ended, son bolum 10 gun once) -> 30 gun',
    rr.resolveTtl(TRAKT_BEYAN, { family: 'show_seasons', data: sezonlu([gecmis(10)]), durum: 'ended', now: SIMDI }).ttlMs === 30 * GUN);
  T.ok('Durum bilinmiyor -> eski kural (son bolum 10 gun -> 7 g, 400 gun -> 30 g)',
    rr.resolveTtl(TRAKT_BEYAN, { family: 'show_seasons', data: sezonlu([gecmis(10)]), now: SIMDI }).ttlMs === 7 * GUN
      && rr.resolveTtl(TRAKT_BEYAN, { family: 'show_seasons', data: sezonlu([gecmis(400)]), now: SIMDI }).ttlMs === 30 * GUN);
  T.ok('show_detail politikasi DEGISMEDI (returning 7 g)',
    rr.resolveTtl(3760, { family: 'show_detail', data: { status: 'returning series' } }).ttlMs === 7 * GUN);

  // Rastgele sapma (+-%10) sinirin otesine tasimamali.
  const sonraki = SIMDI + 2 * GUN;
  const t2 = rr.resolveTtl(TRAKT_BEYAN, { family: 'show_seasons', data: sezonlu([sonraki].map((x) => new Date(x).toISOString())), now: SIMDI });
  let enGec = 0;
  for (let i = 0; i < 500; i++) {
    const z = createEnvelope({ provider: 'trakt', family: 'show_seasons', payload: [], ttlMs: t2.ttlMs, graceMs: t2.graceMs, now: SIMDI });
    enGec = Math.max(enGec, z.expiresAt);
  }
  T.ok('🔴 500 zarfta en gec bayatlama <= yayin + 6 sa (jitter dahil)', enGec <= sonraki + rr.YAYIN_PAYI_MS,
    `asim ${((enGec - (sonraki + rr.YAYIN_PAYI_MS)) / 60000).toFixed(1)} dk`);

  T.ok('Arsiv durumu sayi kimlikle okunur', arsivDiziDurumu('/shows/199742/seasons') === 'returning series');
  T.ok('Arsiv durumu slug ile okunur', arsivDiziDurumu('/shows/dizi-199742/seasons') === 'returning series');
  T.ok('Bilinmeyen dizi / bozuk yol -> null, throw yok',
    arsivDiziDurumu('/shows/999999/seasons') === null && arsivDiziDurumu('/movies/1') === null && arsivDiziDurumu(null) === null);

  db.closeArchive();
  T.bitir();
})().catch((e) => {
  console.error('TEST COKTU:', e);
  process.exit(1);
});
