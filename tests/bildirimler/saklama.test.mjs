// ==========================================================================
// BILDIRIMLER — B10: SAKLAMA SURESI (yas budamasi + sinirsiz alan tamiri)
// ==========================================================================
// Kullanici sorusu (2026-09-06): "bu bildirimler ... birikip zamanla sorun
// cikarmasinlar ... kullanicilar kendi silmeyebilir ... bosuna sismesin."
//
// 🔑 OLCUM ONCE YAPILDI, SONRA KOD YAZILDI. Adet tavanlari ZATEN vardi (iki
// liste de 50) ve en kotu durumda toplam ~48 KB. Yani DISK bir sorun degildi.
// ASIL SORUN BAYATLIK: tavan ADEDE bakiyordu, YASA bakmiyordu — ayda birkac
// bildirim alan kullanici 50'ye hic ulasmaz, 2019'dan kalma kayit sonsuza
// kadar durur.
//
// 🔴 BEKLENMEYEN BULGU: `pendingSentSlugs` GERCEKTEN SINIRSIZDI. Yalnizca
// istek ONAYLANINCA temizleniyordu; gizli bir hesap hic onaylamazsa slug
// sonsuza kadar kaliyordu. Bu store'daki tek sinirsiz alandi.
//
// Cikti ASCII (tests/yardimci.js kurali).

import yardimci from '../yardimci.js';
import {
  pruneByAge,
  budandiMi,
  INBOX_MAX_AGE_MS,
  PENDING_SLUG_MAX_AGE_MS,
  PENDING_SLUG_CAP,
} from '../../features/notifications/inbox/retention.ts';

const { baslat } = yardimci;
const T = baslat('BILDIRIM SAKLAMA SURESI (B10)', { kokOneki: 'bildirim-saklama-' });

const GUN = 24 * 60 * 60 * 1000;
const simdi = new Date(2026, 8, 15, 12, 0, 0, 0).getTime();

const kayit = (id, at) => ({ id, fireAt: at });
const yasAl = (k) => k.fireAt;

// ─────────────────────────────────────────────────────────────────────────
T.H('Sabitler — degerler ve ARALARINDAKI iliski');

T.ok('Kutu omru 60 gun', INBOX_MAX_AGE_MS === 60 * GUN, String(INBOX_MAX_AGE_MS / GUN) + ' gun');
T.ok('Bekleyen istek omru 30 gun', PENDING_SLUG_MAX_AGE_MS === 30 * GUN, String(PENDING_SLUG_MAX_AGE_MS / GUN) + ' gun');
T.ok('Bekleyen istek tavani 200', PENDING_SLUG_CAP === 200);

// 🔴 ILISKI IDDIALARI — L8'in uc sessiz tuzagi (Madde 274) tam olarak
// buradaydi: her sabit tek basina dogru olcuyordu, hata ARALARINDAYDI.
T.ok(
  'Kutu omru AYLIK OZET araligindan uzun',
  INBOX_MAX_AGE_MS > 31 * GUN,
  'kisa olsaydi yeni ozet duser dusmez oncekini silerdi',
);
T.ok(
  'Kutu omru, ekrandaki "bu hafta" penceresinden cok uzun',
  INBOX_MAX_AGE_MS > 7 * GUN,
  '"Daha eski" grubu anlamli kalsin',
);
T.ok(
  'Bekleyen istek omru kutu omrunden KISA',
  PENDING_SLUG_MAX_AGE_MS < INBOX_MAX_AGE_MS,
  'bekleyen istek bir defter kaydi, bildirim degil',
);

// ─────────────────────────────────────────────────────────────────────────
T.H('pruneByAge — temel davranis');

{
  const liste = [
    kayit('taze', simdi - 1 * GUN),
    kayit('sinirda', simdi - 59 * GUN),
    kayit('eski', simdi - 61 * GUN),
    kayit('cok-eski', simdi - 400 * GUN),
  ];
  const kalan = pruneByAge(liste, simdi, yasAl, INBOX_MAX_AGE_MS).map((k) => k.id);
  T.ok('Yasi gecenler elendi', JSON.stringify(kalan) === JSON.stringify(['taze', 'sinirda']), kalan.join(','));
}

{
  // Tam sinir: esik DAHIL kalir (60 gun 0 dakika hala icerde).
  const tamSinir = [kayit('tam', simdi - INBOX_MAX_AGE_MS)];
  T.ok('Tam esik KALIR', pruneByAge(tamSinir, simdi, yasAl, INBOX_MAX_AGE_MS).length === 1);
  const birMsFazla = [kayit('asan', simdi - INBOX_MAX_AGE_MS - 1)];
  T.ok('Esigi 1 ms asan ELENIR', pruneByAge(birMsFazla, simdi, yasAl, INBOX_MAX_AGE_MS).length === 0);
}

T.ok('Bos liste bos doner', pruneByAge([], simdi, yasAl, INBOX_MAX_AGE_MS).length === 0);

// ─────────────────────────────────────────────────────────────────────────
T.H('🔴 Veri KAYBETMEME kurallari');

{
  // Cihaz saati ileri alinmissa ya da plan ileri tarihliyse `now - at`
  // negatif olur. Negatifi "cok eski" saymak YENI kaydi silerdi.
  const gelecek = [kayit('gelecek', simdi + 10 * GUN)];
  T.ok('Gelecek tarihli kayit ELENMEZ', pruneByAge(gelecek, simdi, yasAl, INBOX_MAX_AGE_MS).length === 1);
}

{
  // Zamani okunamayan kaydi atmak, saklamaktan daha kotu: elde tutulan
  // veriyi bir ayristirma hatasi yuzunden silmis oluruz.
  const bozuk = [
    { id: 'yok' },
    { id: 'nan', fireAt: Number.NaN },
    { id: 'metin', fireAt: '2026-01-01' },
    { id: 'sonsuz', fireAt: Infinity },
  ];
  const kalan = pruneByAge(bozuk, simdi, yasAl, INBOX_MAX_AGE_MS).map((k) => k.id);
  T.ok('Zamani okunamayan kayitlar KORUNUR', kalan.length === 4, kalan.join(','));
}

{
  const karisik = [null, undefined, kayit('saglam', simdi - GUN)];
  const kalan = pruneByAge(karisik, simdi, yasAl, INBOX_MAX_AGE_MS);
  T.ok('null/undefined cokertmez ve elenir', kalan.length === 1 && kalan[0].id === 'saglam');
}

{
  // Girdi YERINDE degistirilmemeli — store'lar karsilastirma yapiyor.
  const liste = [kayit('a', simdi - GUN), kayit('b', simdi - 100 * GUN)];
  const kopya = liste.slice();
  pruneByAge(liste, simdi, yasAl, INBOX_MAX_AGE_MS);
  T.ok('Girdi yerinde DEGISTIRILMEZ', liste.length === kopya.length && liste[1].id === 'b');
}

// ─────────────────────────────────────────────────────────────────────────
T.H('budandiMi — gereksiz diske yazmayi onler');

{
  const liste = [kayit('a', simdi - GUN)];
  T.ok('Degisiklik yoksa false', budandiMi(liste, liste) === false, 'her acilista bosuna yazilmasin');
  T.ok('Budama olduysa true', budandiMi([kayit('a', 0), kayit('b', 0)], [kayit('a', 0)]) === true);
  T.ok('Iki bos liste false', budandiMi([], []) === false);
}

// ─────────────────────────────────────────────────────────────────────────
T.H('🔴 SINIRSIZ ALANIN TAMIRI — pendingSentSlugs');

{
  // Gizli bir hesaba gonderilen ve HIC onaylanmayan istek: eskiden sonsuza
  // kadar kalirdi.
  const pending = (slug, at) => ({ slug, at });
  const liste = [
    pending('yeni-istek', simdi - 2 * GUN),
    pending('bir-ay-once', simdi - 31 * GUN),
    pending('bir-yil-once', simdi - 365 * GUN),
  ];
  const kalan = pruneByAge(liste, simdi, (p) => p.at, PENDING_SLUG_MAX_AGE_MS).map((p) => p.slug);
  T.ok(
    'Onaylanmayan eski istekler dusuyor',
    JSON.stringify(kalan) === JSON.stringify(['yeni-istek']),
    kalan.join(','),
  );
}

{
  // Son savunma hatti: yas budamasi tutmasa bile (damgasiz/bozuk kayitlar)
  // adet tavani sert sinir koyuyor.
  const cok = Array.from({ length: 500 }, (_, i) => ({ slug: 's' + i, at: simdi - GUN }));
  const kalan = pruneByAge(cok, simdi, (p) => p.at, PENDING_SLUG_MAX_AGE_MS).slice(0, PENDING_SLUG_CAP);
  T.ok('Adet tavani sert sinir koyuyor', kalan.length === PENDING_SLUG_CAP, kalan.length + ' kayit');
}

// ─────────────────────────────────────────────────────────────────────────
T.H('🔴 Store baglantilari — budama GERCEKTEN cagriliyor mu');

{
  const fs = await import('node:fs');
  const path = await import('node:path');

  // Yorumlari soy: bu dosyalarin aciklamalari fonksiyon adlarini gecirivor
  // ve duz metin aramasi yorumu gercek cagri sanardi (Madde 302'de yasandi).
  const yorumSoy = (m) => m.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const oku = (...p) => yorumSoy(fs.readFileSync(path.join(T.PROJE_KOKU, ...p), 'utf8'));

  // 🪤 BU YARDIMCI BIR HATADAN DOGDU. Ilk yazimda iddialar
  // /const hydrate[\s\S]*?pruneByAge\(/ seklindeydi ve BOSA YANIYORDU:
  // `[\s\S]*?` dosyanin SONUNA kadar yayilip BASKA bir fonksiyondaki
  // `pruneByAge(` cagrisini buluyordu. Budama `hydrate`'ten silindiginde
  // test yine GECTI. Aranan sey bir fonksiyonun ICINDEyse, arama o
  // fonksiyonun govdesine DARALTILMAK zorunda.
  const kesit = (metin, bas, son) => {
    const b = metin.indexOf(bas);
    if (b === -1) return '';
    const k = metin.indexOf(son, b + bas.length);
    return metin.slice(b, k === -1 ? metin.length : k);
  };

  const kutu = oku('features', 'notifications', 'inbox', 'useInboxStore.ts');
  const kutuHydrate = kesit(kutu, 'const hydrate', 'let hydrationPromise');
  const kutuIngest = kesit(kutu, 'ingest: (fired)', 'markAllRead:');
  T.ok('Kesitler bulundu (kutu)', kutuHydrate.length > 0 && kutuIngest.length > 0);
  T.ok('Icerik kutusu ACILISTA buduyor', kutuHydrate.includes('pruneByAge('));
  T.ok('Icerik kutusu EKLERKEN de buduyor', kutuIngest.includes('pruneByAge('));
  T.ok(
    'Acilis budamasi diske YAZILIYOR',
    kutuHydrate.includes('budandiMi(') && kutuHydrate.includes('persist('),
    'yoksa buda ama kaydetme olurdu',
  );

  const sosyal = oku('store', 'notificationStore.ts');
  const sosyalHydrate = kesit(sosyal, 'const hydrate', 'let hydrationPromise');
  const sosyalRefresh = kesit(sosyal, 'refreshActivity: async', 'markAllRead:');
  const sosyalEkle = kesit(sosyal, 'addPendingSentSlug: (slug)', 'refreshActivity: async');
  T.ok(
    'Kesitler bulundu (sosyal)',
    sosyalHydrate.length > 0 && sosyalRefresh.length > 0 && sosyalEkle.length > 0,
  );
  T.ok('Sosyal liste ACILISTA buduyor', sosyalHydrate.includes('pruneByAge('));
  T.ok('Acilista bekleyen istekler de budaniyor', sosyalHydrate.includes('trimPending('));
  T.ok('Sosyal liste YENILEMEDE de buduyor', sosyalRefresh.includes('pruneByAge('));
  T.ok('Yenilemede bekleyen istekler de budaniyor', sosyalRefresh.includes('trimPending('));
  T.ok('Bekleyen istekler damgali', sosyal.includes('PendingSentRequest'));
  T.ok('Bekleyen istekler EKLERKEN budaniyor', sosyalEkle.includes('trimPending('));
  T.ok('Eski duz string sekli goc ediyor', sosyalHydrate.includes('normalizePending('));

  // 🔴 `seenFollowerSlugs` budamaya GIRMEMELI: o bir bildirim listesi degil,
  // "hangi takipcileri gorduk" TABANI. Budansaydi bir sonraki yenileme
  // mevcut tum takipcileri "yeni" sayardi (Madde 301'deki ayni tuzak).
  T.ok(
    'seenFollowerSlugs budanmiyor',
    !/pruneByAge\([^)]*seenFollowerSlugs/.test(sosyal),
    'budansaydi bildirim yagmuru olurdu',
  );
}

T.bitir();
