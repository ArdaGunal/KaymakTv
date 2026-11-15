// ==========================================================================
// ARAYUZ — Gorunen ad kurali, uc katman (1.0.1 Dal 1, karar K2, 2026-11-15)
// ==========================================================================
// Kural: Unicode harf + birlesen isaret + rakam + tek bosluk + `. - _ '`. Emoji, sembol,
// gorunmez karakter REDDEDILIR (2026-11-06 «emoji serbest» karari K2 ile gecersiz).
// Iki adim: ham girdi -> aday deger (`bicimle`), aday deger -> kural (`kanonikAdKarari`).
// Bu takim:
//   1. istemci  utils/gorunenAd.ts            — ortak vektorler (sozlesme, elle yazilmis)
//   2. Worker   src/lib/profileDisplayName.js  — AYNI vektorler, ayni yasak liste
//   3. DB       supabase/schema/080            — dosya, istemci desenlerinden guncel uretimle
//               birebir ayni (DB'nin kendi davranisi: tests/sql/gorunen-ad-080.sh, PG 15 + 17)
// Bagimsiz denetim (2026-11-15) bulgulari 1 ve 2 burada; pencere/isim ekrani davranisi
// `isim-davranis.test.mjs`. Plan: docs/design/ISIM_TEKRAR_ANALIZ_PLANI.md §3 Dal 1.
// Cikti ASCII (tests/yardimci.js kurali).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const T = yardimci.baslat('ARAYUZ GORUNEN AD (1.0.1 Dal 1)', { kokOneki: 'arayuz-gorunen-ad-' });
const oku = (p) => fs.readFileSync(path.join(KOK, p), 'utf8');
const k = (...n) => String.fromCodePoint(...n);
const istemci = tsLoader(KOK)('utils/gorunenAd.ts');
const v = JSON.parse(oku('tests/arayuz/gorunen-ad-vektorleri.json'));
const asc = (s) => JSON.stringify(s).replace(/[^\x20-\x7e]/g, (c) => `<${c.codePointAt(0).toString(16)}>`);

/** Ham girdi vektorleri: uygulama (girdi -> {tur, deger?}). */
function hamVektorler(denetle) {
  const kalan = [];
  for (const [g, b, a] of v.kabul) { const r = denetle(g); if (r.tur !== 'yaz' || r.deger !== b) kalan.push(`kabul: ${a} -> ${asc(r)}`); }
  for (const [g, b, a] of v.ret) { const r = denetle(g); if (r.tur !== b) kalan.push(`ret: ${a} -> ${asc(r)}`); }
  for (const [g, a] of v.temizle) { const r = denetle(g); if (r.tur !== 'temizle') kalan.push(`temizle: ${a} -> ${asc(r)}`); }
  return kalan;
}
/** Kanonik deger vektorleri (DB'nin sozlesmesi): uygulama (deger -> karar). */
function kanonikVektorler(karar) {
  const kalan = [];
  for (const [, deger, a] of v.kabul) if (karar(deger) !== 'yaz') kalan.push(`kanonik kabul: ${a} -> ${karar(deger)}`);
  for (const [deger, a] of v.kanonik_ret) if (karar(deger) === 'yaz') kalan.push(`kanonik ret: ${a}`);
  return kalan;
}
const HAM = v.kabul.length + v.ret.length + v.temizle.length;
const KANONIK = v.kabul.length + v.kanonik_ret.length;

T.H('1 · Istemci kurali ortak vektorlerle');
const istemciHam = hamVektorler(istemci.gorunenAdDenetle);
T.ok(`istemci ${HAM} ham vektorun hepsini gecer`, istemciHam.length === 0, istemciHam.slice(0, 5).join(' | '));
const istemciKanonik = kanonikVektorler(istemci.kanonikAdKarari);
T.ok(`istemci ${KANONIK} kanonik vektorun hepsini gecer (bulgu 1)`, istemciKanonik.length === 0, istemciKanonik.slice(0, 5).join(' | '));
T.ok('uzunluk sayaci kod noktasi sayar (astral harf 1)', istemci.gorunenAdDenetle(k(0x20000).repeat(3)).uzunluk === 3);
T.ok('bulgu 2: BOM basta/ortada/sonda/yalniz -> karakter (trim BOM u kirpmaz)',
  [k(0xfeff), `Arda${k(0xfeff)}`, `${k(0xfeff)}Arda`, `Ar${k(0xfeff)}da`].every((s) => istemci.gorunenAdDenetle(s).tur === 'karakter'));

T.H('2 · Worker ayni kurali uygular (kaynaktan)');
const workerYolu = path.join(KOK, '../kaymaktv-feedback-worker/src/lib/profileDisplayName.js');
if (fs.existsSync(workerYolu)) {
  const worker = await import(pathToFileURL(workerYolu).href);
  const workerHam = hamVektorler(worker.displayNameNormalize);
  T.ok(`Worker ${HAM} ham vektorun hepsini gecer`, workerHam.length === 0, workerHam.slice(0, 5).join(' | '));
  const workerKanonik = kanonikVektorler(worker.kanonikAdKarari);
  T.ok(`Worker ${KANONIK} kanonik vektorun hepsini gecer`, workerKanonik.length === 0, workerKanonik.slice(0, 5).join(' | '));
  T.ok('yasak liste istemci = Worker (birebir)', JSON.stringify(istemci.YASAK_ARALIKLAR) === JSON.stringify(worker.YASAK_ARALIKLAR));
  T.ok('ust sinir ayni (50 kod noktasi)', istemci.AD_EN_COK === worker.AD_EN_COK && worker.AD_EN_COK === 50);
  // Iki kopyanin kanonik karari genis bir orneklemde ayni (vektor disi kod noktalari).
  const ayrisan = [];
  for (let n = 0x20; n <= 0x10ffff; n += n < 0x30000 ? 7 : 997) {
    if (n >= 0xd800 && n <= 0xdfff) continue;
    const s = `a${k(n)}`;
    if (istemci.kanonikAdKarari(s) !== worker.kanonikAdKarari(s)) ayrisan.push(n.toString(16));
  }
  T.ok('istemci ve Worker kanonik karari orneklemde ayni', ayrisan.length === 0, ayrisan.slice(0, 10).join(','));
  T.ok('Worker alan durumlari: undefined dokunma, null temizle, metin disi gecersiz',
    worker.displayNameNormalize(undefined).tur === 'dokunma' && worker.displayNameNormalize(null).tur === 'temizle'
    && worker.displayNameNormalize(42).tur === 'gecersiz');
} else {
  T.ok('Worker deposu yok (yan klasor) - esik atlandi', true);
}

T.H('3 · DB 080 istemci desenlerinden uretilmis ve guncel');
// `supabase/schema/` git disinda (.gitignore) — klasoru olmayan makinede bu bolum atlanir.
const sqlYolu = path.join(KOK, 'supabase/schema/080_display_name_kurali.sql');
if (fs.existsSync(sqlYolu)) {
  const { uret } = await import(pathToFileURL(path.join(KOK, 'scripts/gorunen-ad-080-uret.mjs')).href);
  const sql = fs.readFileSync(sqlYolu, 'utf8');
  T.ok('080 dosyasi guncel uretimle birebir ayni (kural degistiyse: node scripts/gorunen-ad-080-uret.mjs)', sql === uret());
  T.ok('080: NFC, izin listesi, harf sarti, NFD isaret kurallari, 053 kosullari',
    /IS NFC NORMALIZED/.test(sql) && /display_name ~ '\^\[/.test(sql) && /normalize\(display_name, NFD\) !~ '\(\^\|/.test(sql)
    && /\]\{5\}'/.test(sql) && /BETWEEN 1 AND 50/.test(sql) && /display_name = btrim\(display_name\)/.test(sql));
} else {
  T.ok('supabase/schema yok (git disi) - 080 esligi atlandi', true);
}

T.H('4 · Degismez: kabul edilen ad kanonik ve yasak karakter tasimaz');
// Yasak araliklardaki HER kod noktasi icin (~151 bin): «a<c>b» kabul edilirse cikti kanonik olmali
// (bosluk benzerleri ve tipografik kesme donusturulerek kabul edilir).
const yasakMi = (n) => istemci.YASAK_ARALIKLAR.some(([a, b]) => n >= a && n <= b);
let denenen = 0;
const ihlal = [];
for (const [a, b] of istemci.YASAK_ARALIKLAR) {
  for (let n = a; n <= b; n++) {
    denenen++;
    const r = istemci.gorunenAdDenetle(`a${k(n)}b`);
    if (r.tur !== 'yaz') continue;
    if (Array.from(r.deger).some((c) => yasakMi(c.codePointAt(0))) || istemci.kanonikAdKarari(r.deger) !== 'yaz') ihlal.push(n.toString(16));
  }
}
T.ok(`${denenen} yasak kod noktasinin hicbiri ciktiya sizmaz`, ihlal.length === 0, ihlal.slice(0, 10).join(','));

T.H('5 · Gorunmez karakterler kutudan ayiklanir ve BILDIRILIR (yalniz istemci)');
const gir = istemci.gorunenAdGirdisi;
T.ok('ZWSP, BOM, yon degistirici, ZWJ, varyant secici cikar; ayiklandi=true',
  gir(`Ar${k(0x200b)}d${k(0xfeff)}a${k(0x202e)}${k(0x200d)}${k(0xfe0f)}`).deger === 'Arda' && gir(`A${k(0x200b)}`).ayiklandi);
T.ok('yumusak tire ve Hangul dolgu cikar', gir(`Ar${k(0xad)}da${k(0x3164)}`).deger === 'Arda');
T.ok('gorunen hicbir seye dokunmaz; ayiklandi=false', gir('Arda ★ 李明').deger === 'Arda ★ 李明' && !gir('Arda ★ 李明').ayiklandi && gir(k(0x1f600)).deger === k(0x1f600));
T.ok('yalniz gorunmez -> bos kutu AMA ayiklandi=true (kaldirma istegi sayilmaz)', gir(k(0xfeff)).deger === '' && gir(k(0xfeff)).ayiklandi);
T.ok('satir sonu ve sekme ayiklanmaz (bosluga doner)', gir('a\nb\tc').deger === 'a\nb\tc');

T.H('6 · Ret kodu -> metin (istemci sorunu + Worker kodu)');
const tt = (anahtar) => anahtar;
const m = istemci.gorunenAdHataMetni;
T.ok('karakter / ad_karakter / ad_gecersiz -> kural metni',
  ['karakter', 'ad_karakter', 'ad_gecersiz'].every((c) => m(tt, c) === 'settings:displayNameRuleChars'));
T.ok('harf_yok / ad_harf_yok -> harf metni', m(tt, 'harf_yok') === 'settings:displayNameRuleLetter' && m(tt, 'ad_harf_yok') === 'settings:displayNameRuleLetter');
T.ok('cok_uzun / ad_uzun -> uzunluk metni', m(tt, 'cok_uzun') === 'settings:displayNameTooLong' && m(tt, 'ad_uzun') === 'settings:displayNameTooLong');
T.ok('ad_gerekli (bulgu 3, sunucu kapisi) -> zorunluluk metni', m(tt, 'ad_gerekli') === 'settings:displayNameRequired');
T.ok('bilinmeyen -> genel kayit hatasi', m(tt, 'baska') === 'settings:profileSaveError' && m(tt, undefined) === 'settings:profileSaveError');

T.H('7 · Kaynak denetimi');
const modal = oku('components/modals/EditDisplayNameModal.tsx');
T.ok('pencere yalniz cizer: mantik useGorunenAdDuzenle te (davranisi isim-davranis takiminda)',
  /useGorunenAdDuzenle\(\{ visible, currentName \}\)/.test(modal) && !/useUpdateProfile/.test(modal));
const eskiKullanim = ['components', 'app', 'hooks', 'screens', 'features', 'utils']
  .flatMap((d) => fs.readdirSync(path.join(KOK, d), { recursive: true }).filter((f) => /\.tsx?$/.test(f)).map((f) => path.join(d, f)))
  .filter((f) => /\b(adOnizle|gorunmezleriAyikla)\b/.test(oku(f)));
T.ok('eski adOnizle / gorunmezleriAyikla hicbir yerde kalmadi', eskiKullanim.length === 0, eskiKullanim.join(','));
T.ok('kullanici adi kurali degismedi (3-30, A-Z 0-9 _)',
  /usernameRuleLength/.test(oku('utils/kullaniciAdiHataMetni.ts')) && /usernameRuleChars/.test(oku('utils/kullaniciAdiHataMetni.ts')));

T.bitir();
