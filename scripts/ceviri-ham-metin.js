'use strict';
// Ham (çevrilmemiş) metin denetimi — M490, 2026-10-11.
//
// Neden: `ceviri-denetim.js` yalnız `t('anahtar')` çağrılarına bakıyordu. Ekrana `t()`
// DIŞINDAN giden metinleri hiç görmüyordu: `notify(t('common:error'), 'Puan kaydedilirken…')`,
// «Depolama Alanı Dolu», ve en sinsisi `setHata(error?.message || …)` — servislerin ve
// Worker'ın TÜRKÇE hata metni İngilizce arayüzde olduğu gibi görünüyordu.
//
// KURALLAR
//  (a) HER YERDE: notify / confirmAsync / chooseAsync ve set…Error / setHata / setLoadError /
//      setErrorMessage / setNotesError çağrılarına ÇIPLAK DİZE verilmez — yalnız t() (dilden
//      bağımsız: Türkçe harf içermeyen «Tamam» da yakalanır).
//  (b) ARAYÜZ KATMANINDA: ham `error.message` / `result.message` / sunucu `data.message`
//      okunmaz. Servis metinleri geliştiriciye yönelik İÇ metindir (günlük); kullanıcı t() görür.
//  (c) ARAYÜZ KATMANINDA: yorum, t(), günlük ve `new …Error(…)` dışında Türkçe harfli dize kalmaz.
//
// Kasıtlı istisna: satırın sonuna ya da bir üst satıra `// ceviri-ok: <sebep>` yazılır.
//
// ⚠️ BİLİNEN SINIR: (c) Türkçe ÖZEL harfe bakar — «Kaydedilemedi» gibi yalnız ASCII harfli
// Türkçe kelime (c)'den kaçar. Diyalog/hata durumlarında (a) dilden bağımsız yakalar;
// geri kalanı için kod incelemesi. Sözlük tabanlı tahmin yanlış alarm üretirdi.
const fs = require('fs');
const path = require('path');

const KOK = path.resolve(__dirname, '..');
const DIZINLER = ['app', 'components', 'features', 'screens', 'hooks', 'utils', 'services', 'context'];
const TR_HARF = /[çğıöşüÇĞİÖŞÜ]/;

/** Arayüz katmanı: kullanıcıya metin gösteren dosyalar (servis/yardımcı/depolama DEĞİL). */
const arayuzMu = (rel) =>
  /^(app|components|screens|hooks|context)\//.test(rel) || /^features\/[^/]+\/(components|hooks)\//.test(rel);

function dosyalar(d, out = []) {
  if (!fs.existsSync(d)) return out;
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) dosyalar(p, out);
    else if (/\.(tsx?)$/.test(f) && !/\.test\./.test(f) && !/\.d\.ts$/.test(f)) out.push(p);
  }
  return out;
}

/** Yorumları boşlukla değiştirir (satır/konum korunur); dize ve şablonları atlar. */
function yorumSil(k) {
  const o = k.split('');
  let i = 0;
  while (i < k.length) {
    const c = k[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      i++;
      while (i < k.length && k[i] !== q) {
        if (k[i] === '\\') i++;
        else if (q !== '`' && k[i] === '\n') break;
        i++;
      }
      i++;
      continue;
    }
    if (c === '/' && k[i + 1] === '/') {
      while (i < k.length && k[i] !== '\n') o[i++] = ' ';
      continue;
    }
    if (c === '/' && k[i + 1] === '*') {
      while (i < k.length && !(k[i] === '*' && k[i + 1] === '/')) {
        if (k[i] !== '\n') o[i] = ' ';
        i++;
      }
      o[i] = ' ';
      o[i + 1] = ' ';
      i += 2;
      continue;
    }
    i++;
  }
  return o.join('');
}

/** `bas` konumundaki '(' ile eşleşen ')' konumu (dize farkında). */
function kapanis(k, bas) {
  let d = 0;
  for (let i = bas; i < k.length; i++) {
    const c = k[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      i++;
      while (i < k.length && k[i] !== q) {
        if (k[i] === '\\') i++;
        i++;
      }
      continue;
    }
    if (c === '(') d++;
    else if (c === ')' && --d === 0) return i;
  }
  return k.length - 1;
}

/** Desene uyan çağrıların argümanlarını boşlukla örter (satırlar korunur). */
function cagriOrt(k, desen) {
  const o = k.split('');
  for (const m of k.matchAll(desen)) {
    const ac = m.index + m[0].length - 1;
    const son = kapanis(k, ac);
    for (let i = m.index; i <= son; i++) if (o[i] !== '\n') o[i] = ' ';
  }
  return o.join('');
}

const satirNo = (k, idx) => k.slice(0, idx).split('\n').length;
const istisna = (satirlar, n) => /ceviri-ok/.test(satirlar[n - 1] || '') || /ceviri-ok/.test(satirlar[n - 2] || '');

function hamMetinleriBul() {
  const bulgular = []; // { dosya, satir, kural, metin }
  for (const p of DIZINLER.flatMap((d) => dosyalar(path.join(KOK, d)))) {
    const rel = path.relative(KOK, p).replace(/\\/g, '/');
    if (rel === 'utils/confirmDialog.ts') continue; // kuralın kendisi (yerel yedek diyaloglar)
    bulgular.push(...dosyaTara(rel, fs.readFileSync(p, 'utf8')));
  }
  return tekillestir(bulgular);
}

/** Tek dosya — saf, test edilebilir (bkz. tests/arayuz/ceviri.test.mjs öz-testi). */
function dosyaTara(rel, ham) {
  const bulgular = [];
  {
    const satirlar = ham.split('\n');
    const k = yorumSil(ham);
    const ekle = (idx, kural, metin) => {
      const n = satirNo(k, idx);
      if (!istisna(satirlar, n)) bulgular.push({ dosya: rel, satir: n, kural, metin: metin.trim().slice(0, 110) });
    };

    // (a) diyalog / hata durumu argümanlarında çıplak dize ya da ham .message
    for (const m of k.matchAll(/(?<![\w$.])(notify|confirmAsync|chooseAsync|set\w*(?:Error|Hata)|setErrorMessage)\(/g)) {
      const ac = m.index + m[0].length - 1;
      const arg = k.slice(ac + 1, kapanis(k, ac));
      const tsiz = cagriOrt(arg, /(?<![\w$])(?:i18n\.)?t\(/g);
      // Metin sayılan dize: boşluk, Türkçe harf ya da büyük harfle başlıyor. `'not_found'`,
      // `'genel'` gibi durum KODLARI metin değildir (ekranda t() ile karşılanır).
      const metinler = [...tsiz.matchAll(/(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g)]
        .map((x) => x[2].replace(/\$\{[^}]*\}/g, ''))
        .filter((x) => /\s|^[A-ZÇĞİÖŞÜ]/.test(x.trim()) || TR_HARF.test(x));
      if (metinler.length) {
        ekle(m.index, 'a: cagrida ciplak dize', k.slice(m.index, m.index + 90).replace(/\s+/g, ' '));
      }
    }

    if (!arayuzMu(rel)) return bulgular;

    // (b) ham hata/sunucu metni
    // Günlük satırları (console/logError…) ekrana gitmez → örtülü kopyada aranır.
    const gunluksuz = cagriOrt(k, /\bconsole\.\w+\(|\b(?:logError|logWarning|captureError)\(/g);
    for (const m of gunluksuz.matchAll(/\b(error|err|e|hata|result|sonuc|res|response|data|yanit)\b(\s+as\s+any\))?\??\.(response\??\.data\??\.)?(message|mesaj)\b/g)) {
      ekle(m.index, 'b: ham hata metni ekrana', satirlar[satirNo(k, m.index) - 1]);
    }

    // (c) t()/günlük/Error dışında Türkçe harfli dize
    let ortulu = cagriOrt(k, /(?<![\w$])(?:i18n\.)?t\(/g);
    ortulu = cagriOrt(ortulu, /\bconsole\.\w+\(|\b(?:logError|logWarning|recordPerfMark|agIsaret|timeSupabaseCall)\(|\bnew\s+\w*(?:Error|Hatasi)\(/g);
    for (const m of ortulu.matchAll(/(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)) {
      if (TR_HARF.test(m[2])) ekle(m.index, 'c: ceviri disi Turkce metin', m[0]);
    }
    // JSX çıplak metin (> Türkçe <) — çok satırlı metin de (download sayfasında kaçmıştı).
    for (const m of ortulu.matchAll(/>([^<>{}'"`]*[çğıöşüÇĞİÖŞÜ][^<>{}'"`]*)</g)) {
      ekle(m.index, 'c: ciplak JSX metni', m[1]);
    }
  }
  return bulgular;
}

function tekillestir(bulgular) {
  // Aynı satırda aynı kural tekrarlanmasın
  const g = new Set();
  return bulgular.filter((b) => {
    const a = `${b.dosya}:${b.satir}:${b.kural[0]}`;
    if (g.has(a)) return false;
    g.add(a);
    return true;
  });
}

if (require.main === module) {
  const b = hamMetinleriBul();
  for (const x of b) console.log(`${x.dosya}:${x.satir}  [${x.kural}]  ${x.metin}`);
  console.log(`\n${b.length} ham metin bulgusu`);
  process.exit(b.length ? 1 : 0);
}

module.exports = { hamMetinleriBul, dosyaTara };
