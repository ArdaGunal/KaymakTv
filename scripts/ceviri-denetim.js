#!/usr/bin/env node
// Çeviri denetimi — koddaki SİSTEM metinlerinin TR ve EN dosyalarında karşılığı var mı?
//
// Neden (2026-10-10, DIL-01/DIL-03): metinler `t('anahtar', 'Türkçe yedek')` ile
// yazılıyordu ama anahtar `locales/en/*.json`'da YOKTU → İngilizce arayüzde Türkçe
// yedek görünüyordu («Puanı Kaydet», «Aktiviteler», «Gerçekten İyi»). Kod gözden
// kaçırıyor; bu betik her `t('...')` çağrısını dosyanın `useTranslation(...)`
// ad alanlarına göre çözer ve iki dilde eksikleri listeler.
//
// Kullanıcının YAZDIĞI metin (yorum, gönderi) çeviri kapsamında DEĞİL — yalnız
// koddaki sabit anahtarlar denetlenir.
//
//   node scripts/ceviri-denetim.js          → rapor, eksik varsa çıkış 1
//   node scripts/ceviri-denetim.js --json   → makine okunur
'use strict';
const fs = require('fs');
const path = require('path');

const KOK = path.resolve(__dirname, '..');
const DIZINLER = ['app', 'components', 'features', 'screens', 'hooks', 'utils', 'services', 'context'];
const DILLER = ['tr', 'en'];

function sozluk(dil) {
  const d = path.join(KOK, 'locales', dil);
  const s = {};
  for (const f of fs.readdirSync(d)) if (f.endsWith('.json')) s[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'));
  return s;
}

/** i18next anahtarı: düz ya da noktalı iç içe; çoğul ekleri (_one/_other) de sayılır. */
function varMi(ns, anahtar, s) {
  const kume = s[ns];
  if (!kume) return false;
  const bul = (k) => {
    if (Object.prototype.hasOwnProperty.call(kume, k)) return true;
    let o = kume;
    for (const p of k.split('.')) {
      if (o && typeof o === 'object' && p in o) o = o[p];
      else return false;
    }
    return o !== undefined;
  };
  return bul(anahtar) || bul(`${anahtar}_one`) || bul(`${anahtar}_other`);
}

function dosyalar(d, out = []) {
  if (!fs.existsSync(d)) return out;
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) dosyalar(p, out);
    else if (/\.(tsx?|jsx?)$/.test(f) && !/\.test\./.test(f)) out.push(p);
  }
  return out;
}

function nsListesi(kod) {
  const ns = new Set();
  for (const m of kod.matchAll(/useTranslation\(\s*([^)]*)\)/g)) {
    const arg = m[1].trim();
    if (!arg) ns.add('translation');
    for (const s of arg.matchAll(/['"]([\w-]+)['"]/g)) ns.add(s[1]);
  }
  for (const m of kod.matchAll(/getFixedT\([^,]*,\s*['"]([\w-]+)['"]/g)) ns.add(m[1]);
  return [...ns];
}

function denetle() {
  const s = Object.fromEntries(DILLER.map((d) => [d, sozluk(d)]));
  const eksik = []; // { dosya, satir, ns, anahtar, diller[] }
  const belirsiz = [];
  for (const p of DIZINLER.flatMap((d) => dosyalar(path.join(KOK, d)))) {
    const kod = fs.readFileSync(p, 'utf8');
    const nsler = nsListesi(kod);
    const satirlar = kod.split('\n');
    satirlar.forEach((l, i) => {
      // Yorum satırları atlanır; `i18n.t(` ve dinamik (şablon) anahtarlar kapsam dışı.
      if (/^\s*(\/\/|\*)/.test(l)) return;
      for (const m of l.matchAll(/(?<![\w.])t\(\s*(['"])([^'"`$]+?)\1/g)) {
        const ham = m[2];
        let ns, anahtar;
        if (ham.includes(':')) [ns, anahtar] = [ham.slice(0, ham.indexOf(':')), ham.slice(ham.indexOf(':') + 1)];
        if (ns) {
          const yok = DILLER.filter((d) => !varMi(ns, anahtar, s[d]));
          if (yok.length) eksik.push({ dosya: path.relative(KOK, p), satir: i + 1, ns, anahtar, diller: yok });
          continue;
        }
        if (nsler.length === 0) {
          belirsiz.push({ dosya: path.relative(KOK, p), satir: i + 1, anahtar: ham });
          continue;
        }
        const yok = DILLER.filter((d) => !nsler.some((n) => varMi(n, ham, s[d])));
        if (yok.length) eksik.push({ dosya: path.relative(KOK, p), satir: i + 1, ns: nsler[0], anahtar: ham, diller: yok });
      }
    });
  }
  return { eksik, belirsiz };
}

if (require.main === module) {
  const { eksik, belirsiz } = denetle();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ eksik, belirsiz }, null, 2));
  } else {
    for (const e of eksik) console.log(`${e.dosya}:${e.satir}  ${e.ns}:${e.anahtar}  eksik: ${e.diller.join(',')}`);
    console.log(`\n${eksik.length} eksik anahtar (${new Set(eksik.map((e) => e.ns + ':' + e.anahtar)).size} farklı), ${belirsiz.length} ad alanı belirsiz çağrı`);
  }
  process.exit(eksik.length ? 1 : 0);
}

module.exports = { denetle };
