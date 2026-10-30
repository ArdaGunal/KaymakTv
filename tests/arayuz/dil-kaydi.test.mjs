import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// BASLIK Adım 0 (2.6.8) · Dil kaydı: desteklenen diller tek kaynakta; bilinmeyen dil
// TÜRKÇEYE DEĞİL varsayılana düşer; yeni dil (sahte Almanca) kod değişmeden çalışır;
// istemci kodunda iki seçenekli dil dalı kalmaz.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('DIL KAYDI (BASLIK Adim 0)', { kokOneki: 'dil-kaydi-' });
const kayit = JSON.parse(fs.readFileSync(path.join(root, 'locales/diller.json'), 'utf8'));

// ── 1. Kayıt bütünlüğü ────────────────────────────────────────────────────
const ALANLAR = ['kod', 'ad', 'ceviriAnahtari', 'kisa', 'bayrak', 'bayrakUlke', 'etiket', 'alfabe', 'yabanciBaslik'];
const kodlar = kayit.diller.map((d) => d.kod);
T.ok('Kodlar tekil', new Set(kodlar).size === kodlar.length);
T.ok('Varsayilan dil kayitta', kodlar.includes(kayit.varsayilan));
for (const d of kayit.diller) {
  T.ok(`${d.kod}: tum alanlar dolu`, ALANLAR.every((a) => typeof d[a] === 'string' && d[a].length > 0));
  T.ok(`${d.kod}: kod ISO 639-1 (2 kucuk harf)`, /^[a-z]{2}$/.test(d.kod));
  T.ok(`${d.kod}: etiket BCP 47 ve kodla basliyor`, new RegExp(`^${d.kod}-[A-Z]{2}$`).test(d.etiket));
  T.ok(`${d.kod}: alfabe ISO 15924`, /^[A-Z][a-z]{3}$/.test(d.alfabe));
  T.ok(`${d.kod}: baslik politikasi gecerli`, ['uluslararasi', 'ceviri'].includes(d.yabanciBaslik));
  T.ok(`${d.kod}: Intl bu etiketi taniyor`, Intl.DateTimeFormat.supportedLocalesOf([d.etiket]).length === 1);
}
const dosyalar = (kod) => fs.readdirSync(path.join(root, 'locales', kod)).filter((f) => f.endsWith('.json')).sort();
for (const kod of kodlar) {
  T.ok(`${kod}: locales/${kod}/ klasoru varsayilanla ayni dosyalari tasiyor`,
    JSON.stringify(dosyalar(kod)) === JSON.stringify(dosyalar(kayit.varsayilan)));
}
const resources = fs.readFileSync(path.join(root, 'locales/resources.ts'), 'utf8');
for (const kod of kodlar) {
  T.ok(`${kod}: resources.ts dili yukluyor`, new RegExp(`^\\s+${kod}: \\{`, 'm').test(resources));
}
const anahtarlar = JSON.parse(fs.readFileSync(path.join(root, `locales/${kayit.varsayilan}/settings.json`), 'utf8'));
for (const d of kayit.diller) T.ok(`${d.kod}: ceviriAnahtari settings ad alaninda var`, typeof anahtarlar[d.ceviriAnahtari] === 'string');

// ── 2. Yardımcılar: bilinmeyen dil varsayılana düşer ──────────────────────
// `import kayit from './diller.json'` CommonJS'e `.default` ile iner (Metro bunu kendisi çözer).
const yukle = (json = kayit) => tsLoader(root, { './diller.json': { default: json } });
const gercek = yukle()('locales/diller.ts');
T.ok('dilKodu tr-TR -> tr', gercek.dilKodu('tr-TR') === 'tr');
T.ok('dilKodu EN -> en', gercek.dilKodu('EN') === 'en');
T.ok('dilKodu en_US -> en', gercek.dilKodu('en_US') === 'en');
T.ok('dilKodu undefined -> varsayilan', gercek.dilKodu(undefined) === kayit.varsayilan);
T.ok('dilKodu de (desteklenmiyor) -> varsayilan, Turkce DEGIL', gercek.dilKodu('de') === 'en');
T.ok('yerelEtiket de -> en-US (eskiden tr-TR\'ye dusuyordu)', gercek.yerelEtiket('de') === 'en-US');
T.ok('yerelEtiket tr -> tr-TR', gercek.yerelEtiket('tr') === 'tr-TR');
T.ok('dilBilgisi bilinmeyen dilde varsayilan satiri', gercek.dilBilgisi('xx').kod === 'en');
T.ok('DESTEKLENEN_DILLER kayitla ayni', JSON.stringify(gercek.DESTEKLENEN_DILLER) === JSON.stringify(kodlar));

// Tarih biçimleyicileri — bugünkü tr/en çıktıları değişmedi, bilinmeyen dil İngilizce
const simdi = new Date('2026-10-30T12:00:00');
const iso = '2026-10-10T21:14:00';
const { formatExactDate } = yukle()('utils/formatExactDate.ts');
T.ok('formatExactDate tr ayni', formatExactDate(iso, 'tr', simdi) === `${new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} · 21:14`);
T.ok('formatExactDate en ayni', formatExactDate(iso, 'en', simdi) === `${new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} · 21:14`);
T.ok('formatExactDate de -> Ingilizce bicim', formatExactDate(iso, 'de', simdi) === formatExactDate(iso, 'en', simdi));
const { dayLabel } = yukle()('features/feed/utils/dayLabel.ts');
const tt = (k) => k;
T.ok('dayLabel bilinmeyen dil -> Ingilizce bicim', dayLabel(iso, 'fr', tt, simdi) === dayLabel(iso, 'en', tt, simdi));

// ── 3. Sahte Almanca kaydı: yeni dil kod değişmeden çalışır ───────────────
const almanca = {
  varsayilan: 'en',
  diller: [...kayit.diller, { kod: 'de', ad: 'Deutsch', ceviriAnahtari: 'german', kisa: 'DE', bayrak: '🇩🇪', bayrakUlke: 'DE', etiket: 'de-DE', alfabe: 'Latn', yabanciBaslik: 'ceviri' }],
};
const de = yukle(almanca)('locales/diller.ts');
T.ok('Sahte de: desteklenir', de.dilKodu('de-AT') === 'de');
T.ok('Sahte de: etiket de-DE', de.yerelEtiket('de') === 'de-DE');
T.ok('Sahte de: politika kayittan', de.dilBilgisi('de').yabanciBaslik === 'ceviri');
const { formatExactDate: deTarih } = yukle(almanca)('utils/formatExactDate.ts');
T.ok('Sahte de: tarih Almanca bicimde (Okt.)', deTarih(iso, 'de', simdi).startsWith(new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })));

// ── 4. İstemci kodunda iki seçenekli dil dalı / gömülü etiket kalmadı ─────
const TARANAN = ['app', 'components', 'features', 'hooks', 'services', 'utils', 'context', 'store'];
// Bilinçli istisna: arama katlaması, iki tarafı da aynı kuralla küçülttüğü için dil seçimi değil.
const ISTISNA = new Set(['hooks/libraryFilterCore.ts']);
const ihlaller = [];
const gez = (d) => {
  if (!fs.existsSync(d)) return;
  for (const a of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, a.name);
    if (a.isDirectory()) { if (a.name !== 'node_modules') gez(p); continue; }
    if (!/\.(ts|tsx)$/.test(a.name)) continue;
    const goreli = path.relative(root, p).replace(/\\/g, '/');
    if (ISTISNA.has(goreli)) continue;
    fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
      if (/'(tr-TR|en-US)'|"(tr-TR|en-US)"|[!=]== ?'(tr|en)' ?\?/.test(l)) ihlaller.push(`${goreli}:${i + 1}`);
    });
  }
};
for (const k of TARANAN) gez(path.join(root, k));
T.ok(`Iki secenekli dil dali / gomulu etiket yok${ihlaller.length ? ' — ' + ihlaller.join(', ') : ''}`, ihlaller.length === 0);

T.bitir();
