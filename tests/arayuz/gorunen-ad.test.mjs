// ==========================================================================
// ARAYUZ — 2.6.8 AD-01: gorunen ad istemci temizligi
// ==========================================================================
// Soru (kullanici, 2026-11-06): gorunen ad Turkce harf, emoji, sembol kabul
// ediyor mu, gorunmez karakterleri temizliyor mu? Kural sunucuda; istemci ayni
// temizligi + ek uc adimi yapip temiz degeri gonderir (utils/gorunenAd.ts).
// Kullanici adi kuralina DOKUNULMAZ (bu test onu da denetler).
//
// Cikti ASCII (tests/yardimci.js kurali).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const T = yardimci.baslat('ARAYUZ GORUNEN AD (2.6.8 AD-01)', { kokOneki: 'arayuz-gorunen-ad-' });
const { adOnizle, AD_EN_COK } = tsLoader(KOK)('utils/gorunenAd.ts');
const d = (s) => adOnizle(s).deger;

T.H('Kabul: Turkce harf, emoji, sembol');
T.ok('Turkce harfler aynen kalir', d('Şükrü Çağlayan Öğüt İı') === 'Şükrü Çağlayan Öğüt İı');
T.ok('emoji kalir', d('Arda 🍿') === 'Arda 🍿');
T.ok('ZWJ korunur: aile emojisi bolunmez', d('👨\u200D👩\u200D👧') === '👨\u200D👩\u200D👧');
T.ok('bayrak ve ten rengi emojisi kalir', d('🇹🇷 👍🏽') === '🇹🇷 👍🏽');
T.ok('semboller kalir', d('★ Arda ★ #1 & Co.') === '★ Arda ★ #1 & Co.');

T.H('Gorunmez karakterler silinir (sunucu listesi)');
T.ok('yon degistirici (RLO) silinir - ad taklidi', d('\u202Eadra') === 'adra');
T.ok('ZWSP silinir', d('Ar\u200Bda') === 'Arda');
T.ok('BOM ve kontrol karakteri silinir', d('\uFEFFAr\u0007da') === 'Arda');
T.ok('LRI..PDI silinir', d('\u2066Arda\u2069') === 'Arda');

T.H('Sunucuda olmayan ek temizlik (karar 2026-11-06)');
T.ok('yumusak tire (U+00AD) silinir', d('Ar\u00ADda') === 'Arda');
T.ok('U+061C ve U+180E silinir', d('Ar\u061Cd\u180Ea') === 'Arda');
T.ok('NBSP normal bosluga doner, ardisik bosluk teke iner', d('Arda\u00A0\u00A0Gunal') === 'Arda Gunal');
T.ok('ideografik bosluk ve U+2000-200A bosluga doner', d('Arda\u3000\u2003Gunal') === 'Arda Gunal');
T.ok('U+2028/2029 tek satir kuralini delmez', d('Arda\u2028Gunal\u2029') === 'Arda Gunal');
T.ok('satir sonu ve sekme bosluga doner', d(' Arda\n\tGunal ') === 'Arda Gunal');

T.H('Yalniz dolgu karakterinden olusan ad bos sayilir');
T.ok('Hangul dolgu (U+3164) -> bos', d('\u3164\u3164') === '');
T.ok('U+115F + U+1160 + U+FFA0 -> bos', d('\u115F\u1160\uFFA0') === '');
T.ok('bos Braille (U+2800) + bosluk -> bos', d(' \u2800 \u2800 ') === '');
T.ok('yalniz gorunmez karakter -> bos', d('\u200B\u200E\uFEFF') === '');
T.ok('harf iceren ad dolgu yuzunden silinmez', d('Ali\u3164') === 'Ali\u3164');

T.H('Uzunluk: kod noktasi, temizlikten SONRA');
T.ok(`${AD_EN_COK} emoji = ${AD_EN_COK}`, adOnizle('🍿'.repeat(AD_EN_COK)).uzunluk === AD_EN_COK);
T.ok('gorunmez karakter sayaca girmez', adOnizle('Arda' + '\u200B'.repeat(60)).uzunluk === 4);
T.ok('bos ad uzunlugu 0', adOnizle('\u3164').uzunluk === 0);

T.H('Kaynak denetimi');
const oku = (p) => fs.readFileSync(path.join(KOK, p), 'utf8');
const modal = oku('components/modals/EditDisplayNameModal.tsx');
T.ok('pencere temizligi utils/gorunenAd.ts ten aliyor', /from '..\/..\/utils\/gorunenAd'/.test(modal));
T.ok('kayitta temiz deger gider (onizleme.deger)', /const yeni = onizleme\.deger \|\| null/.test(modal));
T.ok('eski kopya profile.ts te kalmadi', !/export function adOnizle/.test(oku('features/feed/services/profile.ts')));
T.ok('kullanici adi kurali degismedi (3-30, A-Z 0-9 _)',
  /usernameRuleLength/.test(oku('utils/kullaniciAdiHataMetni.ts')) && /usernameRuleChars/.test(oku('utils/kullaniciAdiHataMetni.ts')));

T.bitir();
