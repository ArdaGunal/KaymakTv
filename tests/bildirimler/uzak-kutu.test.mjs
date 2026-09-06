// ==========================================================================
// BILDIRIMLER — B9: UZAK BILDIRIMLERIN KUTUYA GIRISI (F3 dilim 2)
// ==========================================================================
// 🔴 COZULEN IKI ARIZA (Madde 301'de olculdu):
//
// 1. TIKLAMA HICBIR SEY YAPMIYORDU. `useNotificationTap` yukten yalnizca
//    `deepLink` okuyup "/" ile baslamiyorsa SESSIZCE cikiyordu; Worker ise
//    `kind`/`activityId` gonderiyordu.
// 2. SOSYAL PUSH KUTUYA HIC GIRMIYORDU. `ingest()`'in tek cagrisi yerel
//    defter supurmesiydi. Ustelik tepsi temizligi `social`'i bizim
//    kategorimiz sayip siliyordu — bildirim TAMAMEN kayboluyordu.
//
// Cikti ASCII (tests/yardimci.js kurali).

import yardimci from '../yardimci.js';
import {
  resolveDeepLink,
  remoteToEntry,
  remoteEntries,
} from '../../features/notifications/inbox/remoteInbox.ts';

const { baslat } = yardimci;
const T = baslat('UZAK BILDIRIM KUTUSU (B9)', { kokOneki: 'bildirim-uzak-kutu-' });

const simdi = new Date(2026, 8, 15, 12, 0, 0, 0).getTime();
const UZAK = new Set(['social']);
const YEREL_VE_UZAK = new Set(['social']);

const bildirim = (ekstra = {}) => ({
  identifier: 'expo-uuid-1',
  title: 'Yeni yorum',
  body: 'Ayse aktivitene yorum yapti.',
  data: { categoryId: 'social', kind: 'comment', activityId: 'akt-1', deepLink: '/activity/akt-1' },
  receivedAt: simdi - 60000,
  ...ekstra,
});

// ─────────────────────────────────────────────────────────────────────────
T.H('resolveDeepLink — sunucudan gelen yol');

T.ok(
  'Sunucunun gonderdigi deepLink kullanilir',
  resolveDeepLink({ deepLink: '/activity/abc' }) === '/activity/abc',
);
T.ok(
  '"/" ile baslamayan deepLink REDDEDILIR',
  resolveDeepLink({ deepLink: 'https://kotu.site/x' }) === null,
  'acik yonlendirme yuzeyi acilmasin',
);
T.ok('Bos deepLink reddedilir', resolveDeepLink({ deepLink: '' }) === null);
T.ok('data yoksa null', resolveDeepLink(undefined) === null);
T.ok('data nesne degilse null', resolveDeepLink('metin') === null);
T.ok('Bos nesne null', resolveDeepLink({}) === null);

// ─────────────────────────────────────────────────────────────────────────
T.H('🔴 Geriye donuk dal — Worker guncellenmeden ONCE gonderilmis yukler');

T.ok(
  'deepLink yoksa activityId\'den turetilir',
  resolveDeepLink({ categoryId: 'social', kind: 'comment', activityId: 'akt-9' }) === '/activity/akt-9',
);
T.ok(
  'deepLink VARSA activityId\'ye bakilmaz (sunucu otoritedir)',
  resolveDeepLink({ activityId: 'eski', deepLink: '/activity/yeni' }) === '/activity/yeni',
);

{
  // 🔴 EN KRITIK IDDIA: eski BEGENI yuku `targetId` tasiyor ama `targetType`
  // TASIMIYOR. Hedef bir aktivite de olabilir bir YORUM da. Yorumsa
  // `/activity/<targetId>` YANLIS bir yola goturur. Yanlis yere gitmektense
  // hicbir yere gitmemek dogrusu.
  const eskiBegeni = { categoryId: 'social', kind: 'like', targetId: 'hedef-1' };
  T.ok('Eski begeni yuku targetId\'den TUREMEZ', resolveDeepLink(eskiBegeni) === null, 'belirsiz hedef');
}

// ─────────────────────────────────────────────────────────────────────────
T.H('remoteToEntry — kutu kaydina cevrim');

{
  const e = remoteToEntry(bildirim(), UZAK, simdi);
  T.ok('Kayit uretildi', e !== null);
  T.ok('identifier expo kimligi', e.identifier === 'expo-uuid-1');
  T.ok('categoryId tasindi', e.categoryId === 'social');
  T.ok('baslik/govde tasindi', e.title === 'Yeni yorum' && e.body.startsWith('Ayse'));
  T.ok('deepLink cozuldu', e.deepLink === '/activity/akt-1');
  T.ok('fireAt alindi', e.fireAt === simdi - 60000);
}

{
  // 🔴 YEREL KATEGORILER ELENIR: onlar kutuya ZATEN defterden giriyor.
  // Buradan da almak ikinci bir yol acar ve defterin "vakti gecti mi?"
  // mantigini baypas ederdi.
  const yerel = bildirim({ data: { categoryId: 'episodeToday', deepLink: '/episode/1' } });
  T.ok('Yerel kategori ELENIR', remoteToEntry(yerel, UZAK, simdi) === null);
}

{
  const kategorisiz = bildirim({ data: { kind: 'comment' } });
  T.ok('categoryId yoksa elenir', remoteToEntry(kategorisiz, UZAK, simdi) === null);
  const bilinmeyen = bildirim({ data: { categoryId: 'baska-uygulama' } });
  T.ok('Bilinmeyen kategori elenir', remoteToEntry(bilinmeyen, UZAK, simdi) === null);
}

{
  T.ok('identifier yoksa elenir', remoteToEntry(bildirim({ identifier: '' }), UZAK, simdi) === null);
  T.ok('null girdi cokertmez', remoteToEntry(null, UZAK, simdi) === null);
  const bosMetin = bildirim({ title: null, body: undefined });
  T.ok('Baslik VE govde bossa elenir', remoteToEntry(bosMetin, UZAK, simdi) === null, 'bos satir olurdu');
  const sadeceGovde = bildirim({ title: null });
  T.ok('Yalnizca govde varsa KABUL', remoteToEntry(sadeceGovde, UZAK, simdi) !== null);
}

{
  // Hedefi cozulemeyen bildirim yine de LISTEDE gorunmeli — kaybolmasindan iyi.
  const linksiz = bildirim({ data: { categoryId: 'social', kind: 'like', targetId: 'x' } });
  const e = remoteToEntry(linksiz, UZAK, simdi);
  T.ok('Hedefi cozulemeyen bildirim ELENMEZ', e !== null);
  T.ok('deepLink bos dizge (null degil)', e.deepLink === '', 'LedgerEntry.deepLink zorunlu string');
}

// ─────────────────────────────────────────────────────────────────────────
T.H('Tarih normalizasyonu — saniye/ms farki');

{
  const sn = Math.floor(simdi / 1000);
  const e = remoteToEntry(bildirim({ receivedAt: sn }), UZAK, simdi);
  T.ok('Saniye damgasi ms\'e cevrilir', e.fireAt === sn * 1000, String(e.fireAt));
}
{
  const e = remoteToEntry(bildirim({ receivedAt: undefined }), UZAK, simdi);
  T.ok('Tarih yoksa "simdi" kullanilir', e.fireAt === simdi, 'tarihsiz kayit gruplamayi bozardi');
}
{
  const e = remoteToEntry(bildirim({ receivedAt: 'bozuk' }), UZAK, simdi);
  T.ok('Bozuk tarih cokertmez', e !== null && e.fireAt === simdi);
}
{
  const e = remoteToEntry(bildirim({ receivedAt: -5 }), UZAK, simdi);
  T.ok('Negatif tarih reddedilir', e.fireAt === simdi);
}

// ─────────────────────────────────────────────────────────────────────────
T.H('remoteEntries — liste, tekillestirme, siralama');

{
  const liste = [
    bildirim({ identifier: 'a', receivedAt: simdi - 3000 }),
    bildirim({ identifier: 'b', receivedAt: simdi - 1000 }),
    bildirim({ identifier: 'c', receivedAt: simdi - 2000 }),
  ];
  const ciktilar = remoteEntries(liste, UZAK, simdi).map((e) => e.identifier);
  T.ok('En yeni basta', JSON.stringify(ciktilar) === JSON.stringify(['b', 'c', 'a']), ciktilar.join(' > '));
}

{
  // 🔴 UC KAYNAK AYNI TURDA AYNI BILDIRIMI VEREBILIR: on plan dinleyicisi,
  // tepsi supurmesi ve tiklama yaniti. Tekillestirme olmasa store'a mukerrer
  // kayit gonderilir ve gereksiz bir yazma turu doger.
  const liste = [
    bildirim({ identifier: 'ayni', receivedAt: simdi - 1000 }),
    bildirim({ identifier: 'ayni', receivedAt: simdi - 1000 }),
    bildirim({ identifier: 'ayni', receivedAt: simdi - 1000 }),
  ];
  T.ok('Ayni identifier bir kez gecer', remoteEntries(liste, UZAK, simdi).length === 1);
}

{
  const karisik = [
    bildirim({ identifier: 'uzak', receivedAt: simdi - 1000 }),
    bildirim({ identifier: 'yerel', data: { categoryId: 'episodeToday', deepLink: '/episode/5' } }),
    null,
    bildirim({ identifier: '', receivedAt: simdi }),
  ];
  const ciktilar = remoteEntries(karisik, YEREL_VE_UZAK, simdi);
  T.ok('Karisik listeden yalnizca uzak gecer', ciktilar.length === 1, ciktilar.length + ' kayit');
  T.ok('Gecen dogru kayit', ciktilar[0].identifier === 'uzak');
}

T.ok('Bos liste bos sonuc', remoteEntries([], UZAK, simdi).length === 0);

// ─────────────────────────────────────────────────────────────────────────
T.H('🔴 SIRA KISITI — hata iki fonksiyonun ARASINDA olurdu');

// Bu bolum kaynak metnini okuyor, davranisi degil. Sebep somut: kisit iki
// AYRI cagrinin SIRASINDA yasiyor ve ikisi de tek basina dogru. `L8`in uc
// sessiz tuzagi (Madde ...) aynen boyleydi — her test kendi sabitini dogru
// olcuyordu, hata aralarindaydi. `useNotificationSetup.ts` testten
// yuklenemiyor (expo-notifications import ediyor), bu yuzden iliski
// kaynaktan dogrulaniyor.
{
  const fs = await import('node:fs');
  const path = await import('node:path');
  const kok = path.join(T.PROJE_KOKU, 'features', 'notifications');

  // 🪤 YORUMLAR SOYULMAK ZORUNDA. Ilk yazimda duz metin aramasi kullanildi ve
  // iddia YANLIS YERE kaldi: cagri sirasi dogruydu ama `sweepPresentedRemote`
  // uzerindeki aciklama yorumu "clearDeliveredNotifications()" ifadesini
  // GECIRIYORDU, yani arama gercek cagriyi degil yorumu buluyordu. Kod
  // hakkinda iddia kuran bir test, yorumu koddan ayirmak zorunda.
  const yorumSoy = (metin) => metin.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  const kurulum = yorumSoy(fs.readFileSync(path.join(kok, 'hooks', 'useNotificationSetup.ts'), 'utf8'));
  const supurmeIdx = kurulum.indexOf('await sweepPresentedRemote()');
  const temizlikIdx = kurulum.indexOf('clearDeliveredNotifications()');

  T.ok('sweepPresentedRemote CAGRILIYOR', supurmeIdx !== -1);
  T.ok('clearDeliveredNotifications CAGRILIYOR', temizlikIdx !== -1);
  T.ok(
    'Supurme temizlikten ONCE',
    supurmeIdx !== -1 && temizlikIdx !== -1 && supurmeIdx < temizlikIdx,
    'sonra olsaydi sosyal bildirim tepsiden silinip kutuya hic giremezdi',
  );
  T.ok(
    'Supurme AWAIT ediliyor (void degil)',
    /await\s+sweepPresentedRemote\(\)/.test(kurulum),
    'ikisi de beklenmeseydi yaris durumu olurdu',
  );

  // Tiklama yaniti da bir kutu kaynagi: uygulama kapaliyken dusen bildirime
  // dogrudan basilirsa tepsi supurmesi ona yetisemeyebilir.
  const tap = yorumSoy(fs.readFileSync(path.join(kok, 'hooks', 'useNotificationTap.ts'), 'utf8'));
  T.ok('Tiklama yanitinda da ingest var', tap.includes('ingestRemote('));
  T.ok('Tiklama resolveDeepLink kullaniyor', tap.includes('resolveDeepLink('));

  // On plan dinleyicisi ucuncu kaynak.
  const onPlan = yorumSoy(fs.readFileSync(path.join(kok, 'hooks', 'useRemoteInbox.ts'), 'utf8'));
  T.ok(
    'On plan dinleyicisi kurulu',
    onPlan.includes('addNotificationReceivedListener') && onPlan.includes('ingestRemote('),
  );

  // Uzak kategori kumesi registry'den TURETILMELI; elle liste tutulursa
  // yeni bir uzak kategori eklendiginde sessizce disarida kalir.
  const supurme = yorumSoy(fs.readFileSync(path.join(kok, 'inbox', 'remoteSweep.ts'), 'utf8'));
  T.ok(
    'Uzak kategoriler registry\'den turetiliyor',
    /NOTIFICATION_CATEGORIES\s*\.filter\(\s*\(c\)\s*=>\s*c\.kind === 'remote'\s*\)/.test(supurme),
    'elle liste bayatlardi',
  );
}

T.bitir();
