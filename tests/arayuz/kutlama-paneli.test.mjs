// ==========================================================================
// ARAYUZ — 2.6.8 KUTLAMA-01/02: «dizi bitti» paneli
// ==========================================================================
// Hata (inceleme 2026-11-06): Kaymak ilerlemesinde `next_episode` yalniz
// YAYINLANMIS bolumu gosterir. Haftalik dizide son yayinlanan bolum
// isaretlenince panel cikiyor ve dugme kilitleniyordu. Kural (kullanici):
// duyurulmus bir sonraki bolum varsa (Yaklasanlar'da) panel hic cikmaz.
// Panel sade, mobil + masaustu tek bilesen, metinler TR+EN.
//
// Cikti ASCII (tests/yardimci.js kurali).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const T = yardimci.baslat('ARAYUZ KUTLAMA PANELI (2.6.8 KUTLAMA-01/02)', { kokOneki: 'arayuz-kutlama-' });
const { duyurulmusBolumVarMi } = tsLoader(KOK)('utils/duyurulanBolum.ts');
const oku = (p) => fs.readFileSync(path.join(KOK, p), 'utf8');

const GUN = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-11-06T12:00:00.000Z');
const once = (g) => new Date(now - g * GUN).toISOString();
const sonra = (g) => new Date(now + g * GUN).toISOString();
const var_ = (id, k) => duyurulmusBolumVarMi(id, k, now);

// Haftalik dizi: S1E1-E3 izlendi (yayinlandi), E4 gelecek hafta.
const haftalik = { next_episode: null, seasons: [{ number: 1, episodes: [
  { number: 1, completed: true, first_aired: once(14) },
  { number: 2, completed: true, first_aired: once(7) },
  { number: 3, completed: true, first_aired: once(0.5) },
  { number: 4, completed: false, first_aired: sonra(7) },
] }] };
const bitmis = { next_episode: null, seasons: [{ number: 1, episodes: [
  { number: 1, completed: true, first_aired: once(400) }, { number: 2, completed: true, first_aired: once(393) },
] }] };

T.H('duyurulmusBolumVarMi');
T.ok('haftalik dizi, gelecek hafta bolum var -> DUYURULMUS (panel yok)', var_(7, { progress: haftalik }) === true);
T.ok('gercekten bitmis dizi -> yok (panel cikar)', var_(7, { progress: bitmis }) === false);
T.ok('yalniz ozel sezonda (0) gelecek bolum -> sayilmaz',
  var_(7, { progress: { seasons: [...bitmis.seasons, { number: 0, episodes: [{ number: 1, completed: false, first_aired: sonra(3) }] }] } }) === false);
T.ok('gelecek bolum izlenmis isaretliyse sayilmaz',
  var_(7, { progress: { seasons: [{ number: 1, episodes: [{ number: 1, completed: true, first_aired: sonra(3) }] }] } }) === false);
T.ok('tarihsiz (TBA) bolum Yaklasanlar\'da yok -> sayilmaz',
  var_(7, { progress: { seasons: [{ number: 2, episodes: [{ number: 1, completed: false, first_aired: null }] }] } }) === false);
T.ok('Trakt sekli: next_episode gelecek tarihli -> duyurulmus',
  var_(7, { progress: { next_episode: { season: 2, number: 1, first_aired: sonra(30) } } }) === true);
T.ok('takvimde (calendarShows) bu dizinin gelecek bolumu -> duyurulmus',
  var_(7, { progress: bitmis, calendarShows: [{ show: { ids: { trakt: 7 } }, first_aired: sonra(40) }] }) === true);
T.ok('takvimde BASKA dizi -> etkilemez',
  var_(7, { progress: bitmis, calendarShows: [{ show: { ids: { trakt: 8 } }, first_aired: sonra(40) }] }) === false);
T.ok('takvimde gecmis kayit -> etkilemez',
  var_(7, { progress: bitmis, calendarShows: [{ show: { ids: { trakt: 7 } }, first_aired: once(1) }] }) === false);
T.ok('emniyet turu sezon haritasi -> duyurulmus',
  var_(7, { progress: bitmis, calendarSeasonsMap: { 7: { data: [{ episodes: [{ first_aired: sonra(9) }] }] } } }) === true);
T.ok('bos/eksik girdi cokertmez -> yok', var_(7, {}) === false && var_(7, { progress: null, calendarShows: null }) === false);

T.H('Kapi tek yerde: EpisodeCheckButton');
const dugme = oku('components/EpisodeCheckButton.tsx');
T.ok('bitti karari duyurulmus bolumu soruyor', /!duyurulmusBolumVarMi\(traktId, \{ progress: newProgress, calendarShows, calendarSeasonsMap \}\)/.test(dugme));
T.ok('panel ve kilit AYNI kararin icinde', /duyurulmusBolumVarMi[\s\S]{0,200}setIsFinishedLocal\(true\)[\s\S]{0,120}onShowFinished\(showName, traktId\)/.test(dugme));

T.H('Panel: tek bilesen, sade, TR+EN');
const panel = oku('components/index/CelebrationOverlay.tsx');
const mobil = oku('screens/IndexMobile.tsx');
const masaustu = oku('app/(protected)/(tabs)/shows.web.tsx');
T.ok('Modal + onRequestClose (geri tusu kapatir)', /<Modal[^>]*onRequestClose=\{onClose\}/.test(panel));
T.ok('hafif konfeti: 80 parcacik', /count=\{80\}/.test(panel) && !/count=\{200\}/.test(panel));
T.ok('metin yer tutuculu tek anahtar (ad + ek birlestirme yok)', /t\('showFinishedLine', \{ name: ad \}\)/.test(panel));
T.ok('puan hatasi gorunur (sessiz basarisizlik yok)', /notify\(t\('common:error'\), t\('common:ratingSaveError'\)\)/.test(panel));
// Emulator (2026-11-06): InlineRater ikinci pencere aciyor, «Puanla:» etiketi tekrar ediyordu;
// ad kartin buyuk harfli adiyla («CARRIE dizisini bitirdin») geliyordu.
T.ok('yildizlar panelin icinde (StarSlider), ikinci pencere yok', /<StarSlider onRate=\{puanla\}/.test(panel) && !/InlineRater/.test(panel));
T.ok('cift dokunusta tek kayit (mesgul kilidi)', /if \(mesgul\.current\) return;/.test(panel));
T.ok('ad normal yazimla (gorunenBaslik), buyuk harfli kart adi yalniz yedek', /gorunenBaslik\(dizi, i18n\.language\)\) \|\| finishedShow\.name/.test(panel));
T.ok('kullanilmayan InlineRater silindi', !fs.existsSync(path.join(KOK, 'components/InlineRater.tsx')));
T.ok('mobil ve masaustu ayni bileseni kullaniyor',
  /<CelebrationOverlay/.test(mobil) && /<CelebrationOverlay/.test(masaustu));
T.ok('masaustundeki satir ici kopya kalkti', !/congratsContainer|showFinished'\)/.test(masaustu));
T.ok('iki ekran da puana dizi adini ipucu veriyor', [mobil, masaustu].every((s) => /rateMedia\(finishedShow\.id, 'show', val, \{ title: finishedShow\.name \}\)/.test(s)));
const tr = JSON.parse(oku('locales/tr/media.json'));
const en = JSON.parse(oku('locales/en/media.json'));
T.ok('showFinishedLine TR + EN, {{name}} ikisinde de', /\{\{name\}\}/.test(tr.showFinishedLine) && /\{\{name\}\}/.test(en.showFinishedLine));
T.ok('kullanilmayan eski anahtar (showFinished) iki dilden de silindi', !('showFinished' in tr) && !('showFinished' in en));

T.bitir();
