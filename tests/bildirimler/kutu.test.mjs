// ==========================================================================
// BILDIRIMLER — B3: UYGULAMA ICI BILDIRIM KUTUSU (defter suzme)
// ==========================================================================
// 🔴 COZULEN SORUN: bildirim Android tepsisinde gorunuyor ama uygulama
// icindeki zil listesinde izi kalmiyordu. Kullanici tepsideki bildirimi
// kaydirip attiysa haber tamamen kayboluyordu.
//
// Bu takim "hangi bildirim dustu?" kararinin dogrulugunu sinar. Karar yanlis
// olursa iki yonde de kotu: dusmemis bildirim listeye girer (yalan), ya da
// dusmus bildirim hic gorunmez (asil sikayet).
//
// Cikti ASCII (tests/yardimci.js kurali).

import yardimci from '../yardimci.js';
import {
  buildLedger,
  sweepLedger,
  mergeIntoInbox,
} from '../../features/notifications/inbox/sweep.ts';

const { baslat } = yardimci;
const T = baslat('BILDIRIM KUTUSU (B3)', { kokOneki: 'bildirim-kutu-' });

const simdi = new Date(2026, 8, 15, 12, 0, 0, 0).getTime();
const DK = 60 * 1000;

const kayit = (id, fireAt) => ({
  identifier: id,
  categoryId: 'episodeToday',
  fireAt,
  title: 'baslik',
  body: 'govde',
  deepLink: '/episode/' + id,
});

// ─────────────────────────────────────────────────────────────────────────
T.H('buildLedger — plandan defter uretimi');

const plan = {
  identifier: 'episodeToday:42',
  categoryId: 'episodeToday',
  fireAt: simdi + 5 * DK,
  title: 'Misirlari patlat',
  body: 'Dizi S1B2 bugun yayinda',
  data: {
    categoryId: 'episodeToday',
    entityId: '42',
    deepLink: '/episode/42',
    plannedFireAt: simdi + 5 * DK,
  },
};
const defter = buildLedger([plan]);

T.ok('Defter kaydi plandan turedi', defter.length === 1 && defter[0].identifier === 'episodeToday:42');
T.ok('Deep link plandan tasindi', defter[0].deepLink === '/episode/42');
T.ok('Metin plandan tasindi (liste tepsideki ile ayni sozu gosterir)', defter[0].body === 'Dizi S1B2 bugun yayinda');
T.ok('Bos plan kumesi bos defter uretir', buildLedger([]).length === 0);

// ─────────────────────────────────────────────────────────────────────────
T.H('sweepLedger — dusen ve bekleyen ayrimi');

const sonuc = sweepLedger(
  [
    kayit('a', simdi - 30 * DK), // dustu
    kayit('b', simdi - 5 * DK),  // dustu (daha yeni)
    kayit('c', simdi + 10 * DK), // bekliyor
    kayit('d', simdi),           // tam simdi -> dustu sayilir
  ],
  simdi,
);

T.ok('Vakti gecenler dustu sayildi', sonuc.fired.length === 3);
T.ok('Gelecektekiler defterde kaldi', sonuc.pending.length === 1 && sonuc.pending[0].identifier === 'c');
T.ok('Tam "simdi" olan kayit dustu sayilir (sinir dahil)', sonuc.fired.some((e) => e.identifier === 'd'));
T.ok(
  'Dusenler EN YENI basta siralandi',
  sonuc.fired.map((e) => e.identifier).join(',') === 'd,b,a',
);

// 🔴 IPTAL EDILMIS PLAN TUZAGI: kullanici bolumu izledigi icin iptal edilen
// bir planin fireAt'i HALA GELECEKTEDIR. "Dustu" sayilirsa kullaniciya hic
// gonderilmemis bir bildirim listede gorunurdu.
T.ok(
  'Iptal edilmis (gelecek tarihli) plan DUSTU SAYILMAZ',
  sweepLedger([kayit('iptal', simdi + 60 * DK)], simdi).fired.length === 0,
);

T.ok(
  'Bozuk kayit listeyi cokertmez, sessizce atlanir',
  (() => {
    const r = sweepLedger([null, { identifier: 'x' }, kayit('ok', simdi - DK)], simdi);
    return r.fired.length === 1 && r.fired[0].identifier === 'ok';
  })(),
);

T.ok('Bos defter bos sonuc verir', sweepLedger([], simdi).fired.length === 0);

// ─────────────────────────────────────────────────────────────────────────
T.H('mergeIntoInbox — tekillestirme ve tavan');

const mevcut = [kayit('a', simdi - DK), kayit('b', simdi - 2 * DK)];

T.ok(
  'Yeni kayit basa eklenir',
  mergeIntoInbox(mevcut, [kayit('c', simdi)], 50)[0].identifier === 'c',
);

// Kullanici uygulamayi arka arkaya acip kapatirsa ayni defter kaydi iki kez
// supurulebilir; ayni bildirim listede iki kez gorunmemeli.
T.ok(
  'Ayni identifier ikinci kez EKLENMEZ',
  mergeIntoInbox(mevcut, [kayit('a', simdi)], 50).length === 2,
);

T.ok(
  'Tavan asilmaz ve en yeniler korunur',
  (() => {
    const cok = Array.from({ length: 60 }, (_, i) => kayit('yeni' + i, simdi - i * DK));
    const r = mergeIntoInbox(mevcut, cok, 50);
    return r.length === 50 && r[0].identifier === 'yeni0';
  })(),
);

T.ok(
  'Mevcut liste YERINDE degistirilmez (saf fonksiyon sozu)',
  (() => {
    const girdi = [kayit('a', simdi)];
    mergeIntoInbox(girdi, [kayit('b', simdi)], 50);
    return girdi.length === 1;
  })(),
);

T.bitir();
