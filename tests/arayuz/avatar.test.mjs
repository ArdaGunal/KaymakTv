// ==========================================================================
// ARAYUZ — T4: AVATAR (bas harf, deterministik renk, kopya denetimi)
// ==========================================================================
// Faz T · T4 madde 3 (M341). Iki kisim:
//   1. `utils/avatar.ts` SAF kararlari.
//   2. KAYNAK DENETIMI: avatar mantigi 16 dosyada kopyalanmisti. Tek bilesene
//      toplandiktan sonra bir ekranin yeniden kendi "gri daire + harf"ini
//      yazmasi sessiz bir geri donus olur — burada yakalanir.
//
// Istemci kodu: `.mjs` + Node'un yerel TypeScript soymasi (bkz. bildirimler/).
// Cikti ASCII (tests/yardimci.js kurali).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yardimci from '../yardimci.js';
import { AVATAR_RENKLERI, avatarBasHarfi, avatarRengi } from '../../utils/avatar.ts';

const { baslat } = yardimci;
const T = baslat('ARAYUZ AVATAR (T4)', { kokOneki: 'arayuz-avatar-' });

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ─────────────────────────────────────────────────────────────────────────
T.H('Bas harf');

T.ok('Bos ad -> ?', avatarBasHarfi('') === '?' && avatarBasHarfi(null) === '?' && avatarBasHarfi(undefined) === '?');
T.ok('Yalnizca bosluk -> ?', avatarBasHarfi('   ') === '?');
T.ok('Ilk harf buyuk', avatarBasHarfi('ardagnl') === 'A');
T.ok('Bastaki bosluk atlanir', avatarBasHarfi('  zeynep') === 'Z');
T.ok('Bastaki @ atlanir', avatarBasHarfi('@kaymak') === 'K');
T.ok('Turkce harf buyutulur', avatarBasHarfi('şule') === 'Ş');
T.ok(
  'Emoji ile baslayan ad YARIM vekil cift dondurmez',
  avatarBasHarfi('😀abc') === '😀',
  'charAt(0) kirik kutu cizerdi',
);

// ─────────────────────────────────────────────────────────────────────────
T.H('Renk');

T.ok('Bos ad paletin ilk rengi', avatarRengi('') === AVATAR_RENKLERI[0] && avatarRengi(null) === AVATAR_RENKLERI[0]);
T.ok('Deterministik — ayni ad ayni renk', avatarRengi('ardagnl') === avatarRengi('ardagnl'));
T.ok(
  'Buyuk/kucuk harf duyarsiz (kullanici adlari oyle benzersiz, 030)',
  avatarRengi('ArdaGnl') === avatarRengi('ardagnl'),
);
T.ok('Bosluk rengi degistirmez', avatarRengi('  ardagnl ') === avatarRengi('ardagnl'));

const adlar = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'u'];
T.ok('Her sonuc palette', adlar.every((a) => AVATAR_RENKLERI.includes(avatarRengi(a))));

// 🔴 Eski CommentItem ilk IKI karakteri topluyordu — ayni harfle baslayan
// adlar cogunlukla ayni renge dusuyordu. Tum adin ozeti bunu dagitmali.
const ayniBas = ['ali', 'alper', 'aslı', 'ayse', 'arda', 'ahmet', 'asli', 'aylin'].map(avatarRengi);
T.ok(
  'Ayni harfle baslayan adlar TEK renge yigilmiyor',
  new Set(ayniBas).size >= 4,
  String(new Set(ayniBas).size) + ' farkli renk',
);

// ─────────────────────────────────────────────────────────────────────────
T.H('Kaynak denetimi — kopya avatar mantigi geri gelmesin');

const TARANAN = ['app', 'components', 'features', 'screens'];
const IZINLI = new Set([path.join('components', 'Avatar.tsx')]);

function dosyalar(dizin) {
  const sonuc = [];
  for (const g of fs.readdirSync(dizin, { withFileTypes: true })) {
    const tam = path.join(dizin, g.name);
    if (g.isDirectory()) sonuc.push(...dosyalar(tam));
    else if (/\.(tsx?|jsx?)$/.test(g.name)) sonuc.push(tam);
  }
  return sonuc;
}

const ihlaller = [];
for (const kok of TARANAN) {
  for (const tam of dosyalar(path.join(KOK, kok))) {
    const goreli = path.relative(KOK, tam);
    if (IZINLI.has(goreli)) continue;
    const icerik = fs.readFileSync(tam, 'utf8');
    const kurallar = [
      [/\.avatar(Text|Harf|Fallback|Image|Bos)\b/, 'yerel avatar stili'],
      [/\bAVATAR_COLORS\b|\bfunction getInitials\b|\bfunction avatarColor\b/, 'yerel renk/bas harf yardimcisi'],
      [/\.charAt\(0\)\.toUpperCase\(\)/, 'charAt(0) ile bas harf'],
    ];
    for (const [desen, neden] of kurallar) {
      if (desen.test(icerik)) ihlaller.push(goreli + ' -> ' + neden);
    }
  }
}
T.ok('Hicbir ekran kendi avatarini cizmiyor', ihlaller.length === 0, ihlaller.join(' | '));

// Olumsuz denetim bos gecmesin (M340 dersi): taranan agacta Avatar gercekten
// kullaniliyor mu?
const kullananSayisi = TARANAN.flatMap((k) => dosyalar(path.join(KOK, k))).filter((f) =>
  fs.readFileSync(f, 'utf8').includes('<Avatar'),
).length;
T.ok('Avatar en az 16 dosyada kullaniliyor', kullananSayisi >= 16, String(kullananSayisi) + ' dosya');

T.bitir();
