// ==========================================================================
// KATALOG ARŞİVİ — A2 KUYRUK VE ORCHESTRATOR KANCASI TESTLERİ
// ==========================================================================
// 🔴 EN KRİTİK İDDİA: arşiv, kullanıcının isteğini REHİN ALAMAZ.
// `enqueue()` senkrondur, hiçbir şey beklemez, hiçbir koşulda throw etmez.
// Arşiv kapalıysa / kuyruk çökerse / yazıcı patlarsa istek etkilenmez.
//
// 🔴 İKİNCİ İDDİA: EŞZAMANLILIK 1. Arşiv tek SQLite bağlantısı kullanıyor
// ve yazıcı transaction ORTASINDA `await` ediyor (`nefesAl`). İki yazım
// iç içe geçerse aynı bağlantıda iki `BEGIN` denenir → veri bozulur.

const path = require('path');
const { baslat, AR, LF } = require('../yardimci');

const T = baslat('ARSIV KUYRUGU (A2)', { kokOneki: 'ar-kuyruk-' });

const db = require(path.join(AR, 'db'));
const { createArchiveQueue, archiveQueue, MAX_KUYRUK } = require(path.join(AR, 'queue'));
const kimlik = require(path.join(AR, 'identity'));
const depo = require(path.join(AR, 'store'));

const SEZONLAR = [
  {
    number: 1, title: 'Sezon 1',
    ids: { tmdb: 3572, tvdb: 30272, trakt: 3950 },
    episodes: [{ number: 1, season: 1, title: 'Pilot', ids: { imdb: 'tt0959621', tmdb: 62085, tvdb: 349232, trakt: 73482 } }],
  },
];

(async () => {
  const durum = db.initArchive();
  if (!durum.enabled) {
    T.ok('Arsiv acilamadi - atlaniyor', false, durum.reason);
    T.bitir();
    return;
  }

  // ======================================================================
  T.H('enqueue ASLA beklemez, ASLA throw etmez');
  // ======================================================================
  let cagrildi = 0;
  const q = createArchiveQueue({
    worker: async (is) => { cagrildi++; await new Promise((r) => setTimeout(r, 20)); return { ok: true, is }; },
  });

  const t0 = performance.now();
  q.enqueue({ provider: 'trakt', family: 'show_seasons', path: '/shows/1/seasons', data: SEZONLAR });
  const enqueueSuresi = performance.now() - t0;
  T.ok('enqueue ANINDA donuyor (isi beklemiyor)', enqueueSuresi < 5, enqueueSuresi.toFixed(2) + ' ms');
  T.ok('Is henuz calismadi (fire-and-forget)', cagrildi === 0);
  await q.drain();
  T.ok('Is arka planda calisti', cagrildi === 1);

  // Bozuk girdiler sessizce reddedilir
  T.ok('provider yoksa reddediliyor, throw YOK', q.enqueue({ family: 'x' }) === false);
  T.ok('null girdi reddediliyor, throw YOK', q.enqueue(null) === false);
  T.ok('undefined girdi reddediliyor, throw YOK', q.enqueue(undefined) === false);

  // ======================================================================
  T.H('Yazici cokerse kuyruk AYAKTA kalir');
  // ======================================================================
  let patlayanCagri = 0;
  const qHata = createArchiveQueue({
    worker: async () => { patlayanCagri++; throw new Error('yazici patladi'); },
  });
  let sunucuCoktu = false;
  process.once('unhandledRejection', () => { sunucuCoktu = true; });
  qHata.enqueue({ provider: 'trakt', family: 'show_seasons', path: '/shows/2/seasons', data: SEZONLAR });
  qHata.enqueue({ provider: 'trakt', family: 'show_seasons', path: '/shows/3/seasons', data: SEZONLAR });
  await qHata.drain();
  await new Promise((r) => setImmediate(r));
  T.ok('Iki is de denendi (ilk hata ikinciyi OLDURMEDI)', patlayanCagri === 2, patlayanCagri + ' cagri');
  T.ok('unhandledRejection SIZMADI', sunucuCoktu === false);
  T.ok('Hata sayaca islendi', qHata.getStats().hata === 2);

  // ======================================================================
  T.H('EŞZAMANLILIK 1 — iki yazim ASLA ic ice gecmez');
  // ======================================================================
  let anlik = 0;
  let zirve = 0;
  const qParalel = createArchiveQueue({
    worker: async () => {
      anlik++;
      zirve = Math.max(zirve, anlik);
      await new Promise((r) => setTimeout(r, 15));
      anlik--;
      return { ok: true };
    },
  });
  for (let i = 0; i < 8; i++) {
    qParalel.enqueue({ provider: 'trakt', family: 'show_seasons', path: `/shows/${100 + i}/seasons`, data: SEZONLAR });
  }
  await qParalel.drain();
  T.ok('🔴 Ayni anda EN FAZLA 1 yazim', zirve === 1, 'zirve=' + zirve);
  T.ok('Sekiz isin hepsi calisti', qParalel.getStats().yazilan === 8);

  // ======================================================================
  T.H('Tekillestirme ve tavan');
  // ======================================================================
  const gorulen = [];
  const qTekil = createArchiveQueue({
    worker: async (is) => { gorulen.push(is.data.surum); await new Promise((r) => setImmediate(r)); return { ok: true }; },
  });
  // Ayni anahtar 5 kez, farkli veriyle. Ilki hemen calismaya baslar;
  // kalan 4 tekillesip SON veriyle tek is olur.
  for (let i = 1; i <= 5; i++) {
    qTekil.enqueue({ provider: 'trakt', family: 'show_seasons', path: '/shows/500/seasons', data: { surum: i } });
  }
  await qTekil.drain();
  T.ok('🔴 5 istek 2 yazima indi (tekillestirme)', gorulen.length <= 2, 'yazim: ' + gorulen.join(','));
  T.ok('En TAZE veri yazildi (son surum)', gorulen[gorulen.length - 1] === 5, 'son=' + gorulen[gorulen.length - 1]);
  T.ok('Tekillesen sayaci calisiyor', qTekil.getStats().tekillesen > 0);

  // Dil anahtarin parcasi: tr ve en AYRI is olmali
  const diller = [];
  const qDil = createArchiveQueue({
    worker: async (is) => { diller.push(is.query.translations); return { ok: true }; },
  });
  qDil.enqueue({ provider: 'trakt', family: 'show_seasons', path: '/shows/600/seasons', query: { translations: 'tr' }, data: SEZONLAR });
  qDil.enqueue({ provider: 'trakt', family: 'show_seasons', path: '/shows/600/seasons', query: { translations: 'en' }, data: SEZONLAR });
  await qDil.drain();
  T.ok('DIL ayri is uretiyor (tekillesmiyor)', diller.length === 2, diller.join(','));

  // Tavan
  const qTavan = createArchiveQueue({
    maxQueue: 3,
    worker: async () => { await new Promise((r) => setTimeout(r, 5)); return { ok: true }; },
  });
  for (let i = 0; i < 20; i++) {
    qTavan.enqueue({ provider: 'trakt', family: 'show_seasons', path: `/shows/${900 + i}/seasons`, data: SEZONLAR });
  }
  const tavanIst = qTavan.getStats();
  T.ok('Tavan asilinca EN ESKI is dusuruluyor', tavanIst.dusurulen > 0, tavanIst.dusurulen + ' dusen');
  T.ok('Kuyruk tavani asmiyor', tavanIst.bekleyen <= 3, tavanIst.bekleyen + ' bekleyen');
  await qTavan.drain();
  T.ok('Varsayilan tavan 200', MAX_KUYRUK === 200);

  // ======================================================================
  T.H('UCTAN UCA — orchestrator kancasi arsive yaziyor');
  // ======================================================================
  // Gercek orchestrator + gercek yazici + sahte SAGLAYICI (ag yok).
  const orch = require(path.join(LF, 'orchestrator'));
  let saglayiciCagri = 0;
  const sahteFetcher = async () => {
    saglayiciCagri++;
    return { data: SEZONLAR, maxAgeSeconds: 600 };
  };

  const yanit = await orch.resolveRequest({
    provider: 'trakt', path: '/shows/1388/seasons',
    query: { extended: 'full,episodes', translations: 'tr' },
    fetcher: sahteFetcher,
  });
  T.ok('Istek normal sekilde cevaplandi', yanit.status === 'miss' && Array.isArray(yanit.data));

  await archiveQueue.drain();
  const diziId = kimlik.findByExternal('trakt:show', '1388');
  T.ok('🔴 Orchestrator kancasi ARSIVE YAZDI', diziId !== null, diziId || 'yazilmadi');
  T.ok('Hiyerarsi de acildi (bolum kimligi cozuluyor)', kimlik.findByExternal('tmdb:episode', 62085) !== null);
  const p = await depo.readPayload({ kaymakId: diziId, provider: 'trakt', endpoint: 'show_seasons', lang: 'tr' });
  T.ok('Payload dogru dille yazildi', p.ok === true);

  // 🔴 CACHE HIT arsive UGRAMAZ — zaten yazilmis veriyi tekrar yazmak bosuna
  const oncekiAlinan = archiveQueue.getStats().alinan;
  const ikinci = await orch.resolveRequest({
    provider: 'trakt', path: '/shows/1388/seasons',
    query: { extended: 'full,episodes', translations: 'tr' },
    fetcher: sahteFetcher,
  });
  T.ok('Ikinci istek cache ten geldi', ikinci.status === 'fresh' && saglayiciCagri === 1);
  T.ok('🔴 Cache hit kuyruga IS EKLEMEDI', archiveQueue.getStats().alinan === oncekiAlinan);

  // 🔴 PASSTHRU (beyaz liste disi) arsive ugramaz
  const oncekiPassthru = archiveQueue.getStats().alinan;
  await orch.resolveRequest({
    provider: 'trakt', path: '/users/settings',
    fetcher: async () => ({ data: { gizli: true } }),
  });
  T.ok('🔴 PASSTHRU kuyruga IS EKLEMEDI (kullaniciya ozel veri)', archiveQueue.getStats().alinan === oncekiPassthru);

  // Kapsam disi aile: kuyruga girer ama yazici REDDEDER (gurultu loglanmaz)
  const oncekiHata = archiveQueue.getStats().hata;
  await orch.resolveRequest({
    provider: 'trakt', path: '/shows/1388/people',
    fetcher: async () => ({ data: { cast: [{ id: 1 }] }, maxAgeSeconds: 600 }),
  });
  await archiveQueue.drain();
  T.ok('Kapsam disi aile atlandi, HATA sayilmadi', archiveQueue.getStats().hata === oncekiHata);
  T.ok('Atlanan sayaca islendi', archiveQueue.getStats().atlanan > 0);

  T.bitir();
})();
