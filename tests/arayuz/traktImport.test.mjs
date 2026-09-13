// ==========================================================================
// ARAYUZ — T5.4: TRAKT AKTARIM YURUTUCUSUNUN SAF KARARLARI
// ==========================================================================
// Risk: yanlis siniflandirilmis bir hata ya sonsuz yeniden denemeye ya da
// aktarimin sessizce durmasina yol acar. Trakt'in 429'unda erken donmek
// kullanicinin Trakt kotasini yer (kimlikli GET 1000/5 dk).
//
// Cikti ASCII (tests/yardimci.js kurali).

import yardimci from '../yardimci.js';
import {
  AKTARIM_SIRASI,
  FARK_AILELERI,
  FARK_ARALIGI_MS,
  farkTuruZamani,
  KAPANIS_AILELERI,
  supurmeOzeti,
  ARDISIK_HATA_TAVANI,
  aileIlerlemesi,
  hataTuruCoz,
  ilerlemeYuzdesi,
  sonrakiBeklemeMs,
  tumunuDurdurur,
  yenidenDenenebilir,
} from '../../services/api/traktImportCekirdek.ts';

const { baslat } = yardimci;
const T = baslat('ARAYUZ TRAKT AKTARIMI (T5.4)', { kokOneki: 'arayuz-import-' });

// ─────────────────────────────────────────────────────────────────────────
T.H('Hata siniflandirmasi — Worker kodlariyla birebir');

T.ok('trakt_yetki -> yetki (DUR)', hataTuruCoz(401, { code: 'trakt_yetki', message: 'x' }).tur === 'yetki');
T.ok('trakt_gerekli -> trakt_gerekli (DUR)', hataTuruCoz(400, { code: 'trakt_gerekli', message: 'x' }).tur === 'trakt_gerekli');
T.ok('katalog_gecici -> gecici (DEVAM)', hataTuruCoz(503, { code: 'katalog_gecici', message: 'x' }).tur === 'gecici');
T.ok('trakt_ag -> gecici', hataTuruCoz(502, { code: 'trakt_ag', message: 'x' }).tur === 'gecici');
T.ok('cok_istek (429) -> gecici', hataTuruCoz(429, { code: 'cok_istek', message: 'x' }).tur === 'gecici');
T.ok('500 -> gecici', hataTuruCoz(500, { message: 'x' }).tur === 'gecici');
T.ok('aglamadi (status yok) -> gecici', hataTuruCoz(undefined, { message: 'Network Error' }).tur === 'gecici');
T.ok('aile_desteklenmiyor (400) -> genel (DUR)', hataTuruCoz(400, { code: 'aile_desteklenmiyor', message: 'x' }).tur === 'genel');

const limit = hataTuruCoz(429, { code: 'trakt_limit', message: 'x', retryAfter: 42 });
T.ok('trakt_limit retryAfter tasiniyor', limit.tur === 'trakt_limit' && limit.retryAfter === 42);
T.ok('bozuk retryAfter dusuruluyor', hataTuruCoz(429, { code: 'trakt_limit', retryAfter: 'abc' }).retryAfter === undefined);

// 🔴 Sunucunun mesaji korunur; "bir seyler ters gitti" YOK.
T.ok('sunucu mesaji korunuyor', hataTuruCoz(400, { code: 'genel', message: 'Aktarim durumu bozuk.' }).mesaj === 'Aktarim durumu bozuk.');
T.ok('mesaj yoksa anlasilir varsayilan', hataTuruCoz(400, {}).mesaj.length > 10);

T.ok('yenidenDenenebilir: gecici/limit EVET, digerleri HAYIR',
  yenidenDenenebilir('gecici') && yenidenDenenebilir('trakt_limit')
  && !yenidenDenenebilir('yetki') && !yenidenDenenebilir('genel') && !yenidenDenenebilir('trakt_gerekli'));

// ─────────────────────────────────────────────────────────────────────────
T.H('Bekleme suresi');

T.ok('hatasiz adimlar arasi kisa nefes', sonrakiBeklemeMs(null, 0) === 250);
T.ok('🔴 Trakt Retry-After AYNEN uygulanir (429 dongusu olmasin)',
  sonrakiBeklemeMs({ tur: 'trakt_limit', mesaj: 'x', retryAfter: 30 }, 1) === 30000);
T.ok('Retry-After tavani 1 saat', sonrakiBeklemeMs({ tur: 'trakt_limit', mesaj: 'x', retryAfter: 99999 }, 1) === 3600000);
T.ok('gecici hatada ustel geri cekilme', sonrakiBeklemeMs({ tur: 'gecici', mesaj: 'x' }, 1) === 2000
  && sonrakiBeklemeMs({ tur: 'gecici', mesaj: 'x' }, 2) === 4000
  && sonrakiBeklemeMs({ tur: 'gecici', mesaj: 'x' }, 3) === 8000);
T.ok('geri cekilme tavani 30 sn', sonrakiBeklemeMs({ tur: 'gecici', mesaj: 'x' }, 20) === 30000);
T.ok('kalici hatada beklenmez (dongu zaten durur)', sonrakiBeklemeMs({ tur: 'yetki', mesaj: 'x' }, 1) === 0);
T.ok('ardisik hata tavani 3', ARDISIK_HATA_TAVANI === 3);

// ─────────────────────────────────────────────────────────────────────────
T.H('Ilerleme yuzdesi');

const s = (aktarilan, bekleyen, reddedilen, toplam) => ({ aktarilan, bekleyen, reddedilen, toplam });

T.ok('toplam bilinmiyorsa null (belirsiz cubuk)', ilerlemeYuzdesi(s(10, 0, 0, null)) === null);
T.ok('sonuc yoksa null', ilerlemeYuzdesi(null) === null);
T.ok('yarisi islendi -> 50', ilerlemeYuzdesi(s(3000, 500, 0, 7000)) === 50);
T.ok(
  '🔴 payda ISLENEN satir: bekleyen ve reddedilen de sayilir (cubuk %100e ulasabilsin)',
  ilerlemeYuzdesi(s(6000, 1000, 349, 7349)) === 100,
);
T.ok('yalnizca aktarilan sayilsaydi %100 olmazdi', Math.round((6000 / 7349) * 100) === 82);
T.ok('tavan 100', ilerlemeYuzdesi(s(9000, 0, 0, 7349)) === 100);
T.ok('olcolen hesap: ilk sayfa sonrasi ~3', ilerlemeYuzdesi(s(210, 40, 0, 7349)) === 3);

// ─────────────────────────────────────────────────────────────────────────
T.H('Aile sirasi (T5 kalan aileler)');

T.ok('on iki aile var', AKTARIM_SIRASI.length === 12, String(AKTARIM_SIRASI.length));
T.ok('🔑 gecmis ILK (en buyuk aile, 7.349 satir)', AKTARIM_SIRASI[0] === 'gecmis');
T.ok('tekrarlanan aile YOK', new Set(AKTARIM_SIRASI).size === AKTARIM_SIRASI.length);
T.ok(
  'dort puan ailesi de listede',
  ['puan_dizi', 'puan_sezon', 'puan_bolum', 'puan_film'].every((a) => AKTARIM_SIRASI.includes(a)),
);
T.ok(
  'gizlenenler ve birakilan listede',
  ['gizli_dizi', 'gizli_film', 'birakilan'].every((a) => AKTARIM_SIRASI.includes(a)),
);
T.ok(
  '⛔ favori_dizi/favori_film YOK (gizli Trakt listesi, ayri dilim)',
  !AKTARIM_SIRASI.includes('favori_dizi') && !AKTARIM_SIRASI.includes('favori_film'),
);

// ─────────────────────────────────────────────────────────────────────────
T.H('Hata kapsami — tek aile mi, tum aktarim mi');

T.ok('🔴 yetki hatasi TUM aktarimi durdurur (token gecersiz)', tumunuDurdurur('yetki') === true);
T.ok('trakt_gerekli de durdurur', tumunuDurdurur('trakt_gerekli') === true);
T.ok('genel hata yalnizca O AILEYI atlar', tumunuDurdurur('genel') === false);
T.ok('gecici hata durdurmaz', tumunuDurdurur('gecici') === false);
T.ok('trakt_limit durdurmaz', tumunuDurdurur('trakt_limit') === false);
T.ok(
  '🔑 ILISKI: durduran hatalar yeniden denenebilir OLMAYANLARIN alt kumesi',
  ['yetki', 'trakt_gerekli'].every((t) => tumunuDurdurur(t) && !yenidenDenenebilir(t)),
);

// ─────────────────────────────────────────────────────────────────────────
T.H('Aile ilerlemesi');

T.ok('bastaki durum 0/12', aileIlerlemesi(0).biten === 0 && aileIlerlemesi(0).toplam === 12);
T.ok('ucuncu aile bitince 3', aileIlerlemesi(3).biten === 3);
T.ok('tavan asilmaz', aileIlerlemesi(99).biten === 12);
T.ok('negatif 0a kenetlenir', aileIlerlemesi(-5).biten === 0);
T.ok('toplam AKTARIM_SIRASI ile ayni', aileIlerlemesi(0).toplam === AKTARIM_SIRASI.length);

// ─────────────────────────────────────────────────────────────────────────
T.H('Fark turu (D15) — Trakt ta sonradan yapilan ekleme');

T.ok('on bir aile fark turuna acik', FARK_AILELERI.length === 11, String(FARK_AILELERI.length));
T.ok('🔴 gecmis fark turunda YOK (7.349 satir, K3 e birakildi)', !FARK_AILELERI.includes('gecmis'));
T.ok(
  'gecmis disindaki TUM aileler dahil (yeni aile eklenince unutulmasin)',
  FARK_AILELERI.length === AKTARIM_SIRASI.length - 1
    && FARK_AILELERI.every((a) => AKTARIM_SIRASI.includes(a)),
);

T.ok('hic kosmadiysa KOSAR', farkTuruZamani(null) === true);
T.ok('az once kostuysa KOSMAZ', farkTuruZamani(Date.now() - 60_000) === false);
T.ok('alti saat gecmisse KOSAR', farkTuruZamani(Date.now() - FARK_ARALIGI_MS - 1) === true);
T.ok('tam sinirda KOSAR', farkTuruZamani(1_000_000, 1_000_000 + FARK_ARALIGI_MS) === true);
T.ok('sinirin bir ms altinda KOSMAZ', farkTuruZamani(1_000_000, 1_000_000 + FARK_ARALIGI_MS - 1) === false);
T.ok(
  '🔴 GELECEK damga (cihaz saati oynatilmis) KILITLEMEZ',
  farkTuruZamani(Date.now() + 30 * 24 * 3600 * 1000) === true,
);
T.ok('bozuk damga KOSAR (sessizce kilitlenmez)', farkTuruZamani(Number.NaN) === true);
T.ok('alti saatlik aralik', FARK_ARALIGI_MS === 6 * 60 * 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────
T.H('K3 kapanis turu — fark + Traktan silinenlerin supurulmesi');

T.ok('🔑 kapanis turu ON IKI ailenin HEPSINI gezer', KAPANIS_AILELERI.length === 12);
T.ok(
  '🔴 gecmis DAHIL — fark turunda disaridaydi, kapanista start_at ile dar pencere',
  KAPANIS_AILELERI.includes('gecmis'),
);
T.ok('fark turu gecmisi hala DISARIDA birakiyor (ikisi ayri kavram)',
  !FARK_AILELERI.includes('gecmis'));

T.ok('sayi dogrudan okunur', supurmeOzeti(7).silinen === 7 && supurmeOzeti(7).atlandi === null);
T.ok('sifir silme gecerli sonuc', supurmeOzeti(0).silinen === 0 && supurmeOzeti(0).atlandi === null);
T.ok('🔴 ATLANDI sebebi KAYBOLMAZ ("0 silindi" ile ayni sey degil)',
  supurmeOzeti({ atlandi: 'cok_sayfa' }).atlandi === 'cok_sayfa');
T.ok('kapsam paylasimli atlamasi da gorunur',
  supurmeOzeti({ atlandi: 'kapsam_paylasimli' }).atlandi === 'kapsam_paylasimli');
T.ok('hata etiketlenir', supurmeOzeti({ hata: 'ag' }).atlandi === 'hata:ag');
T.ok('bozuk/eksik deger cokme yapmaz',
  supurmeOzeti(undefined).silinen === 0 && supurmeOzeti(null).silinen === 0
  && supurmeOzeti('x').silinen === 0 && supurmeOzeti(NaN).silinen === 0);
T.ok('negatif sayi 0a kenetlenir', supurmeOzeti(-5).silinen === 0);

// ─────────────────────────────────────────────────────────────────────────
T.H('cok_istek — DAKIKALIK pencere, saniyelik geri cekilme YETMEZ');
// Cihazda olculdu (2026-09-13): kapanis turu 41 istek atiyor, Worker siniri
// 40 idi; `gecmis` 429 alip 2/4/8 sn bekleyerek uc ardisik hatada ATLANDI.
// Sinir 90'a cikarildi; bu bekleme IKINCI savunma hatti.

const cok = { tur: 'gecici', mesaj: 'x', kod: 'cok_istek' };
const duz = { tur: 'gecici', mesaj: 'x' };

T.ok('🔴 cok_istek DAKIKALIK bekler', sonrakiBeklemeMs(cok, 1) === 60_000);
T.ok('ardisik hata sayisi cok_istek beklemesini DEGISTIRMEZ',
  sonrakiBeklemeMs(cok, 3) === 60_000 && sonrakiBeklemeMs(cok, 9) === 60_000);
T.ok('duz gecici hata hala ustel (2 sn)', sonrakiBeklemeMs(duz, 1) === 2000);
T.ok('duz gecici hata tavani 30 sn', sonrakiBeklemeMs(duz, 9) === 30_000);
T.ok('🔑 cok_istek beklemesi tavani ASIYOR — ozel olmasinin sebebi bu',
  sonrakiBeklemeMs(cok, 1) > sonrakiBeklemeMs(duz, 9));
T.ok('trakt_limit hala sunucunun Retry-After ini onceler',
  sonrakiBeklemeMs({ tur: 'trakt_limit', mesaj: 'x', retryAfter: 5 }, 1) === 5000);
T.ok('hataTuruCoz cok_istek kodunu KORUYOR (yoksa bekleme secilemez)',
  hataTuruCoz(429, { code: 'cok_istek', message: 'x' }).kod === 'cok_istek');
T.ok('cok_istek yine de yeniden denenebilir',
  yenidenDenenebilir(hataTuruCoz(429, { code: 'cok_istek', message: 'x' }).tur) === true);

T.bitir();
