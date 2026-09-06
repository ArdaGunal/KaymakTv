// ==========================================================================
// BILDIRIMLER — B8: BIRLESIK ZAMAN AKISI (icerik + sosyal, tarih gruplari)
// ==========================================================================
// Kullanici sikayeti (2026-09-05, cihaz testi): "bildirimleri silme ve
// temizleme ozelligi yok, sonsuza kadar kaliyorlar" + "bu sekilde kullanisli
// degil". Cozum: iki ayri liste tek zaman akisinda birlestirildi.
//
// 🔴 STORE'LAR BIRLESMEDI, yalnizca GORUNUM birlesti. Bu takim o birlestirmenin
// SAF katmanini sinar: hangi kayit hangi gruba duser, hangisi elenir, iki
// kaynagin kimlikleri birbirine karisir mi.
//
// Cikti ASCII (tests/yardimci.js kurali).

import yardimci from '../yardimci.js';
import { buildTimeline, timelineCount } from '../../features/notifications/inbox/timeline.ts';

const { baslat } = yardimci;
const T = baslat('BILDIRIM ZAMAN AKISI (B8)', { kokOneki: 'bildirim-akis-' });

const SAAT = 60 * 60 * 1000;
const GUN = 24 * SAAT;

// Yerel saatle 15 Eylul 2026, 09:00. Yerel secildi cunku gruplama yerel
// takvim gunune gore yapiliyor (kullanicinin "bugun"u).
const simdi = new Date(2026, 8, 15, 9, 0, 0, 0).getTime();

const icerik = (id, fireAt, ekstra = {}) => ({
  identifier: id,
  categoryId: 'episodeToday',
  fireAt,
  title: 'baslik-' + id,
  body: 'govde-' + id,
  deepLink: '/episode/' + id,
  read: false,
  ...ekstra,
});

const sosyal = (id, createdAt, ekstra = {}) => ({
  id,
  type: 'newFollower',
  slug: 'kullanici-' + id,
  username: 'kullanici' + id,
  name: null,
  avatarUrl: null,
  createdAt,
  read: false,
  ...ekstra,
});

const grupBul = (gruplar, kimlik) => gruplar.find((g) => g.id === kimlik);
const tumKayitlar = (gruplar) => gruplar.flatMap((g) => g.entries);

// ─────────────────────────────────────────────────────────────────────────
T.H('Birlestirme — iki kaynak tek akista');

{
  const gruplar = buildTimeline([icerik('a', simdi - 2 * SAAT)], [sosyal('b', simdi - SAAT)], simdi);
  const hepsi = tumKayitlar(gruplar);

  T.ok('Iki kaynak da akisa girdi', hepsi.length === 2, hepsi.length + ' kayit');
  T.ok(
    'Kaynak "kind" ile ayrik tutuluyor',
    hepsi.some((e) => e.kind === 'content') && hepsi.some((e) => e.kind === 'social'),
  );
  T.ok('timelineCount toplami dogru', timelineCount(gruplar) === 2, String(timelineCount(gruplar)));
}

{
  // Bos girdi bos akis uretmeli — ekran "bos kutu" dalini cizebilsin.
  const gruplar = buildTimeline([], [], simdi);
  T.ok('Iki kaynak da bossa hic grup donmez', gruplar.length === 0, gruplar.length + ' grup');
  T.ok('timelineCount sifir', timelineCount(gruplar) === 0);
}

// ─────────────────────────────────────────────────────────────────────────
T.H('Siralama — en yeni ustte, kaynak farketmeksizin');

{
  const gruplar = buildTimeline(
    [icerik('eski', simdi - 5 * SAAT), icerik('yeni', simdi - 1 * SAAT)],
    [sosyal('orta', simdi - 3 * SAAT)],
    simdi,
  );
  const sirali = tumKayitlar(gruplar).map((e) => e.id);

  T.ok('Ters kronolojik sirali', JSON.stringify(sirali) === JSON.stringify(['yeni', 'orta', 'eski']), sirali.join(' > '));
  T.ok(
    'Sosyal kayit iki icerik kaydinin ARASINA girdi',
    sirali[1] === 'orta',
    'kaynak siralamayi bozmuyor',
  );
}

// ─────────────────────────────────────────────────────────────────────────
T.H('🔴 Gruplama TAKVIM GUNUNE gore — 24 saatlik aritmetige gore DEGIL');

{
  // Bu takimin en kritik iddiasi. Simdi 09:00; dun aksam 22:00'de dusen bir
  // bildirim 11 saat oncedir. "now - 24h" olcusuyle "bugun" sayilirdi ve
  // kullanici onu BUGUN gelmis sanardi.
  const dunAksam = new Date(2026, 8, 14, 22, 0, 0, 0).getTime();
  const gruplar = buildTimeline([icerik('dun', dunAksam)], [], simdi);

  T.ok('Dun 22:00 "bugun" DEGIL', grupBul(gruplar, 'today') === undefined);
  T.ok('Dun 22:00 "dun" grubunda', grupBul(gruplar, 'yesterday')?.entries.length === 1);
  T.ok(
    'Fark 24 saatten AZ oldugu halde ayri gun sayildi',
    simdi - dunAksam < GUN,
    Math.round((simdi - dunAksam) / SAAT) + ' saat once',
  );
}

{
  // 🔴 "DUN" GRUBU CANLI ONIZLEMEDE DOGDU (2026-09-06, 00:12): gece yarisini
  // yeni gecmisken "2 saat once" yazan satir "Bu hafta" basligi altinda
  // duruyordu. Ikisi de dogruydu ama yan yana sacma goruniyordu.
  const geceYarisiSonrasi = new Date(2026, 8, 15, 0, 12, 0, 0).getTime();
  const ikiSaatOnce = geceYarisiSonrasi - 2 * SAAT; // dun 22:12
  const gruplar = buildTimeline([icerik('gece', ikiSaatOnce)], [], geceYarisiSonrasi);

  T.ok('Gece yarisi sonrasi: 2 saat oncesi "dun"', grupBul(gruplar, 'yesterday')?.entries.length === 1);
  T.ok('Gece yarisi sonrasi: "bu hafta"ya DUSMEDI', grupBul(gruplar, 'week') === undefined);
}

{
  // Onceki gun (2 gun once) "dun" DEGIL, "bu hafta".
  const oncekiGun = new Date(2026, 8, 13, 22, 0, 0, 0).getTime();
  const gruplar = buildTimeline([icerik('onceki', oncekiGun)], [], simdi);
  T.ok('2 gun once "dun" DEGIL', grupBul(gruplar, 'yesterday') === undefined);
  T.ok('2 gun once "bu hafta"', grupBul(gruplar, 'week')?.entries.length === 1);
}

{
  // Ayni gunun 00:05'i — gun basina cok yakin ama HALA bugun.
  const bugunGeceyarisi = new Date(2026, 8, 15, 0, 5, 0, 0).getTime();
  const gruplar = buildTimeline([icerik('erken', bugunGeceyarisi)], [], simdi);
  T.ok('Bugun 00:05 "bugun" grubunda', grupBul(gruplar, 'today')?.entries.length === 1);
}

{
  // 6 gun once ayni saat -> hala "bu hafta"; 7 gun once -> "daha eski".
  const altiGun = new Date(2026, 8, 9, 9, 0, 0, 0).getTime();
  const yediGun = new Date(2026, 8, 8, 9, 0, 0, 0).getTime();
  const gruplar = buildTimeline([icerik('alti', altiGun), icerik('yedi', yediGun)], [], simdi);

  T.ok('6 gun once "bu hafta"', grupBul(gruplar, 'week')?.entries[0]?.id === 'alti');
  T.ok('7 gun once "daha eski"', grupBul(gruplar, 'older')?.entries[0]?.id === 'yedi');
}

{
  // Grup SIRASI sabit olmali: bugun -> dun -> bu hafta -> daha eski.
  // 🔴 Girdi BILEREK karisik sirada veriliyor; sira cikti tarafinda kuruluyor.
  const gruplar = buildTimeline(
    [
      icerik('c', new Date(2026, 8, 1, 9).getTime()),
      icerik('b', new Date(2026, 8, 13, 9).getTime()),
      icerik('a', simdi - SAAT),
      icerik('d', new Date(2026, 8, 14, 9).getTime()),
    ],
    [],
    simdi,
  );
  const sira = gruplar.map((g) => g.id);
  T.ok(
    'Grup sirasi sabit',
    JSON.stringify(sira) === JSON.stringify(['today', 'yesterday', 'week', 'older']),
    sira.join(' > '),
  );
  T.ok('Bos grup DONMEZ (ekran kosulsuz cizebilsin)', gruplar.every((g) => g.entries.length > 0));
}

// ─────────────────────────────────────────────────────────────────────────
T.H('Eleme — gelecek tarihli ve bozuk kayitlar');

{
  const gruplar = buildTimeline([icerik('gelecek', simdi + 2 * SAAT), icerik('gecmis', simdi - SAAT)], [], simdi);
  const idler = tumKayitlar(gruplar).map((e) => e.id);

  T.ok('Gelecek tarihli ICERIK kaydi elendi', !idler.includes('gelecek'), idler.join(','));
  T.ok('Gecmis tarihli kayit kaldi', idler.includes('gecmis'));
}

{
  // 🔴 Sosyal kayitlar icin gelecek elemesi YOK: `createdAt` cihazin kendi
  // saatiyle olay aninda damgalaniyor. Saat birkac saniye ileri giderse
  // eleme, kullanicinin AZ ONCE aldigi bildirimi yok ederdi.
  const gruplar = buildTimeline([], [sosyal('ileri', simdi + 5000)], simdi);
  T.ok('Sosyal kayit gelecek olsa da ELENMEZ', timelineCount(gruplar) === 1);
}

{
  const bozuk = [
    null,
    icerik('nan', Number.NaN),
    { identifier: 'eksik', categoryId: 'episodeToday' },
    icerik('saglam', simdi - SAAT),
  ];
  const gruplar = buildTimeline(bozuk, [null, sosyal('iyi', simdi - SAAT)], simdi);
  const idler = tumKayitlar(gruplar).map((e) => e.id);

  T.ok('Bozuk kayitlar cokertmedi', idler.length === 2, idler.join(','));
  T.ok('Saglam kayitlar hayatta', idler.includes('saglam') && idler.includes('iyi'));
}

// ─────────────────────────────────────────────────────────────────────────
T.H('🔴 Kimlik carpismasi — iki store bagimsiz kimlik uretiyor');

{
  // Ayni ham kimlik iki kaynakta birden. Onek olmasaydi React `key`
  // carpisir, silme de yanlis satiri hedeflerdi.
  const gruplar = buildTimeline([icerik('42', simdi - SAAT)], [sosyal('42', simdi - 2 * SAAT)], simdi);
  const hepsi = tumKayitlar(gruplar);
  const anahtarlar = hepsi.map((e) => e.key);

  T.ok('Anahtarlar carpismiyor', new Set(anahtarlar).size === 2, anahtarlar.join(' | '));
  T.ok('Icerik oneki "c:"', anahtarlar.some((k) => k === 'c:42'));
  T.ok('Sosyal oneki "s:"', anahtarlar.some((k) => k === 's:42'));
  T.ok(
    'HAM kimlik oneksiz korunuyor (store silmesi icin)',
    hepsi.every((e) => e.id === '42'),
    'silme store\'a oneksiz gider',
  );
}

// ─────────────────────────────────────────────────────────────────────────
T.H('Alan tasima — satirin cizebilmesi icin gereken her sey geliyor');

{
  const gruplar = buildTimeline(
    [icerik('a', simdi - SAAT, { read: true, categoryId: 'movieRelease' })],
    [sosyal('b', simdi - SAAT, { read: true, type: 'requestApproved', name: 'Ad Soyad', avatarUrl: 'http://x/y.png' })],
    simdi,
  );
  const ic = tumKayitlar(gruplar).find((e) => e.kind === 'content');
  const so = tumKayitlar(gruplar).find((e) => e.kind === 'social');

  T.ok('Icerik: deepLink tasindi', ic.deepLink === '/episode/a', ic.deepLink);
  T.ok('Icerik: categoryId tasindi (ikon secimi)', ic.categoryId === 'movieRelease');
  T.ok('Icerik: baslik/govde tasindi', ic.title === 'baslik-a' && ic.body === 'govde-a');
  T.ok('Icerik: okundu bayragi tasindi', ic.read === true);

  T.ok('Sosyal: aktivite tipi tasindi', so.activityType === 'requestApproved');
  T.ok('Sosyal: slug tasindi (profile gidis)', so.slug === 'kullanici-b');
  T.ok('Sosyal: avatar tasindi', so.avatarUrl === 'http://x/y.png');
  T.ok('Sosyal: okundu bayragi tasindi', so.read === true);
  T.ok(
    'Zaman alani tek isimde birlesti (fireAt/createdAt -> at)',
    ic.at === simdi - SAAT && so.at === simdi - SAAT,
  );
}

T.bitir();
