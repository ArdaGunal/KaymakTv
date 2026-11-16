// ==========================================================================
// ARAYUZ — 2.6.8 SEZON-01/02: sezon dugmesi (onceki sezonlar + bu sezon), renk
// ==========================================================================
// Kullanici (2026-11-06): «sezonu isaretle butonu ... onceki sezonlari isaretle,
// ve bu sezonu isaretle secenekleri olsun. ayrica bura neden kirmizi? ...
// cidden ise yarayan buton yap, teyit et.»
// Hook GERCEK govdesiyle kosar; React/i18n/kutuphane/diyalog sahte. Her secimde
// HANGI islevin HANGI planla cagrildigi dogrulanir.
//
// Cikti ASCII (tests/yardimci.js kurali).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const T = yardimci.baslat('ARAYUZ SEZON ISARETLE (2.6.8 SEZON-01/02)', { kokOneki: 'arayuz-sezon-' });
const esit = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const oku = (p) => fs.readFileSync(path.join(KOK, p), 'utf8');

// ── 1 · saf yardimcilar ─────────────────────────────────────────────────
const { oncekiSezonPlani, bolumYayinlandiMi, sezonIzlemeOzeti } = tsLoader(KOK)('utils/atlananBolumler.ts');
const ilerleme = {
  seasons: [
    { number: 0, episodes: [{ number: 1, completed: false }] },
    { number: 1, episodes: [1, 2, 3, 4].map((n) => ({ number: n, completed: n <= 2 })) },
    { number: 2, episodes: [1, 2, 3].map((n) => ({ number: n, completed: false })) },
    { number: 3, episodes: [1, 2].map((n) => ({ number: n, completed: false })) },
  ],
};
const evren = [{ sezon: 0, bolumler: [1] }, { sezon: 1, bolumler: [1, 2, 3, 4] }, { sezon: 2, bolumler: [1, 2, 3] }, { sezon: 3, bolumler: [1, 2] }];

T.H('oncekiSezonPlani');
T.ok('S3: S1 kalanlari + S2 tumu (ozel sezon yok)', esit(oncekiSezonPlani(ilerleme, 3, evren), [{ sezon: 1, bolumler: [3, 4] }, { sezon: 2, bolumler: [1, 2, 3] }]));
T.ok('S2: yalniz S1 kalanlari', esit(oncekiSezonPlani(ilerleme, 2, evren), [{ sezon: 1, bolumler: [3, 4] }]));
T.ok('S1: onceki sezon yok -> bos', esit(oncekiSezonPlani(ilerleme, 1, evren), []));
T.ok('Ozel sezon (0) -> bos', esit(oncekiSezonPlani(ilerleme, 0, evren), []));
const bitmis = { seasons: [{ number: 1, episodes: [1, 2].map((n) => ({ number: n, completed: true })) }] };
T.ok('onceki sezon tamamen izliyse -> bos', esit(oncekiSezonPlani(bitmis, 2, [{ sezon: 1, bolumler: [1, 2] }, { sezon: 2, bolumler: [1] }]), []));
T.ok('evren yayinlanmislari verir: yayinlanmamis bolum plana girmez', esit(oncekiSezonPlani(ilerleme, 3, [{ sezon: 1, bolumler: [1, 2, 3] }, { sezon: 2, bolumler: [1] }]), [{ sezon: 1, bolumler: [3] }, { sezon: 2, bolumler: [1] }]));
T.ok('ilerleme yokken: evrendeki onceki sezonlarin hepsi', esit(oncekiSezonPlani(undefined, 2, [{ sezon: 1, bolumler: [1, 2] }]), [{ sezon: 1, bolumler: [1, 2] }]));

T.H('bolumYayinlandiMi');
const simdi = Date.parse('2026-11-06T12:00:00Z');
T.ok('gecmis tarih -> yayinlandi', bolumYayinlandiMi({ first_aired: '2026-11-01T00:00:00Z', number: 9 }, 0, simdi));
T.ok('gelecek tarih -> yayinlanmadi', !bolumYayinlandiMi({ first_aired: '2026-11-13T00:00:00Z', number: 1 }, 99, simdi));
T.ok('tarih yok: numara <= yayinlanan sayisi', bolumYayinlandiMi({ number: 3 }, 3, simdi) && !bolumYayinlandiMi({ number: 4 }, 3, simdi));

// ── 2 · hook: dugmeye basma ─────────────────────────────────────────────
function kur({ secim = null, onay = true, ilerlemeMap = { 7: ilerleme }, guest = false } = {}) {
  const cagri = [];
  const diyalog = [];
  const eylem = (ad) => async (...a) => { cagri.push([ad, ...a.slice(0, 2)]); };
  const mocks = {
    react: { useRef: (v) => ({ current: v }), useState: (v) => [v, (x) => { durum.menu = x; }] },
    'react-i18next': { useTranslation: () => ({ t: (k, o) => (o && typeof o === 'object' ? `${k}|${JSON.stringify(o)}` : k) }) },
    '../context/LibraryContext': { useLibraryActions: () => ({
      markSeasonAsWatched: eylem('markSeasonAsWatched'), planiIsaretle: eylem('planiIsaretle'),
      unwatchSeason: eylem('unwatchSeason'), rewatchSeason: eylem('rewatchSeason'),
    }) },
    '../context/AuthContext': { useAuth: () => ({ isGuest: guest }) },
    '../store/useLibraryStore': { useLibraryStore: { getState: () => ({ showProgressMap: ilerlemeMap }) } },
    '../utils/confirmDialog': {
      notify: (...a) => diyalog.push(['notify', ...a]),
      chooseAsync: async (...a) => { diyalog.push(['choose', ...a]); return secim; },
      confirmAsync: async (...a) => { diyalog.push(['confirm', ...a]); return onay; },
    },
  };
  const durum = { menu: false };
  const { useSezonIsaretleme } = tsLoader(KOK, mocks)('hooks/useSezonIsaretleme.ts');
  return { useSezonIsaretleme, cagri, diyalog, durum };
}
const gecmis = '2026-01-01T00:00:00Z';
const sezon3 = { number: 3, aired_episodes: 2, episodes: [{ number: 1, first_aired: gecmis }, { number: 2, first_aired: gecmis }] };
const girdi = (ek = {}) => ({ season: sezon3, showTraktId: 7, seasonLabel: '3. Sezon', isSeasonWatched: false, tumSezonlar: evren, showMedia: { id: 7 }, iskeletSezonlar: [], ...ek });
const bekle = () => new Promise((r) => setTimeout(r, 0));

T.H('Izlenmemis sezon, oncekilerde eksik var -> iki eylem');
{
  const k = kur({ secim: 'primary' });
  await k.useSezonIsaretleme(girdi()).sezonDugmesi(); await bekle();
  const c = k.diyalog.find((d) => d[0] === 'choose');
  T.ok('soru: «Oncekileri de Isaretle» / «Yalnizca Bu Sezon»', !!c && c[3] === 'common:markPreviousToo' && c[4] === 'markOnlyThisSeason');
  T.ok('mesaj sayilari: bu sezon 2, onceki 5', !!c && /"count":2/.test(c[2]) && /"prev":5/.test(c[2]));
  T.ok('kirmizi onay YOK (confirm cagrilmadi)', !k.diyalog.some((d) => d[0] === 'confirm'));
  T.ok('«Oncekileri de»: tek planiIsaretle, plan S1[3,4] + S2[1,2,3] + S3[1,2]',
    k.cagri.length === 1 && k.cagri[0][0] === 'planiIsaretle' && k.cagri[0][1] === 7
    && esit(k.cagri[0][2], [{ sezon: 1, bolumler: [3, 4] }, { sezon: 2, bolumler: [1, 2, 3] }, { sezon: 3, bolumler: [1, 2] }]));
}
{
  const k = kur({ secim: 'secondary' });
  await k.useSezonIsaretleme(girdi()).sezonDugmesi(); await bekle();
  T.ok('«Yalnizca Bu Sezon» (hepsi yayinlandi): markSeasonAsWatched(7, 3)', esit(k.cagri, [['markSeasonAsWatched', 7, 3]]));
}
{
  const k = kur({ secim: null });
  await k.useSezonIsaretleme(girdi()).sezonDugmesi(); await bekle();
  T.ok('disari dokunma / geri tusu: hicbir sey isaretlenmez', k.cagri.length === 0);
}
{
  const k = kur({ secim: 'secondary' });
  const kismi = { ...sezon3, episodes: [...sezon3.episodes, { number: 3, first_aired: '2099-01-01T00:00:00Z' }] };
  await k.useSezonIsaretleme(girdi({ season: kismi })).sezonDugmesi(); await bekle();
  T.ok('«Yalnizca Bu Sezon» kismi yayin: yalniz yayinlananlar (S3[1,2]), gelecek bolum yok',
    k.cagri.length === 1 && k.cagri[0][0] === 'planiIsaretle' && esit(k.cagri[0][2], [{ sezon: 3, bolumler: [1, 2] }]));
}

T.H('Yarim izlenmis sezon: izlenmis bolum yeniden gonderilmez (1.0.1 Dal 5)');
{
  // S3: E1 izlendi, E2 izlenmedi, E3 gelecekte. Eskiden plan S3[1,2] idi → E1 sunucuda sahte 2x.
  const yarimMap = { 7: { seasons: [...ilerleme.seasons.filter((s) => s.number !== 3), { number: 3, episodes: [{ number: 1, completed: true }, { number: 2, completed: false }] }] } };
  const kismi = { ...sezon3, episodes: [...sezon3.episodes, { number: 3, first_aired: '2099-01-01T00:00:00Z' }] };
  const k = kur({ secim: 'secondary', ilerlemeMap: yarimMap });
  await k.useSezonIsaretleme(girdi({ season: kismi })).sezonDugmesi(); await bekle();
  T.ok('«Yalnizca Bu Sezon»: yalniz S3[2]', k.cagri.length === 1 && k.cagri[0][0] === 'planiIsaretle' && esit(k.cagri[0][2], [{ sezon: 3, bolumler: [2] }]));
  const c = k.diyalog.find((d) => d[0] === 'choose');
  T.ok('«N bolum isaretlenecek» sayisi yeni yazilacak bolum (1)', !!c && /"count":1/.test(c[2]));
  const k2 = kur({ secim: 'primary', ilerlemeMap: yarimMap });
  await k2.useSezonIsaretleme(girdi({ season: kismi })).sezonDugmesi(); await bekle();
  const plan = k2.cagri[0]?.[2] || [];
  T.ok('«Oncekileri de»: bu sezondan yalniz S3[2]', esit(plan[plan.length - 1], { sezon: 3, bolumler: [2] }));
}

T.H('Oncekilerde eksik yok -> tek, kirmizi OLMAYAN onay');
{
  const k = kur({ onay: true, ilerlemeMap: { 7: { seasons: [1, 2].map((s) => ({ number: s, episodes: [1, 2, 3, 4].map((n) => ({ number: n, completed: true })) })) } } });
  await k.useSezonIsaretleme(girdi()).sezonDugmesi(); await bekle();
  const c = k.diyalog.find((d) => d[0] === 'confirm');
  T.ok('iki eylem sorulmadi', !k.diyalog.some((d) => d[0] === 'choose'));
  T.ok('onay destructive:false (mavi)', !!c && c[5] && c[5].destructive === false);
  T.ok('onaydan sonra markSeasonAsWatched(7, 3)', esit(k.cagri, [['markSeasonAsWatched', 7, 3]]));
}
{
  const k = kur({ onay: true });
  await k.useSezonIsaretleme(girdi({ season: { number: 1, aired_episodes: 4, episodes: [1, 2, 3, 4].map((n) => ({ number: n, first_aired: gecmis })) } })).sezonDugmesi(); await bekle();
  T.ok('1. sezon: onceki yok -> tek onay, iki eylem yok', k.diyalog.some((d) => d[0] === 'confirm') && !k.diyalog.some((d) => d[0] === 'choose'));
}

T.H('Onay metinleri gercek sayiyi soyler (1.0.1 IZ-6)');
{
  const yarim = { seasons: [{ number: 1, episodes: [{ number: 1, completed: true, plays: 2 }, { number: 2, completed: true }, { number: 3, completed: false, plays: 0 }, { number: 4, completed: false }] }] };
  const o = sezonIzlemeOzeti(yarim, 1);
  T.ok('sezonIzlemeOzeti: izlenen {1,2}, izleme 3 (2x + plays siz eski kayit 1)', esit([...o.izlenen], [1, 2]) && o.izleme === 3);
  T.ok('sezonIzlemeOzeti: ilerleme/sezon yok -> bos, 0', sezonIzlemeOzeti(undefined, 1).izleme === 0 && sezonIzlemeOzeti(yarim, 9).izlenen.size === 0);
  const sezon1 = { number: 1, aired_episodes: 4, episodes: [1, 2, 3, 4].map((n) => ({ number: n, first_aired: gecmis })) };

  const k = kur({ onay: true, ilerlemeMap: { 7: yarim } });
  await k.useSezonIsaretleme(girdi({ season: sezon1 })).sezonDugmesi(); await bekle();
  const c = k.diyalog.find((d) => d[0] === 'confirm');
  T.ok('yarim sezon: «kalan 2 bolum» (toplam 4 degil)', !!c && c[2].startsWith('markSeasonRemainingMsg|') && /"count":2/.test(c[2]));

  const k2 = kur({ onay: true, ilerlemeMap: {} });
  await k2.useSezonIsaretleme(girdi({ season: sezon1 })).sezonDugmesi(); await bekle();
  const c2 = k2.diyalog.find((d) => d[0] === 'confirm');
  T.ok('hic izlenmemis sezon: «4 bolumun tamami»', !!c2 && c2[2].startsWith('markSeasonMsg|') && /"count":4/.test(c2[2]));

  const k3 = kur({ onay: true, ilerlemeMap: { 7: yarim } });
  await k3.useSezonIsaretleme(girdi({ season: sezon1, isSeasonWatched: true })).sezonuGeriAl(); await bekle();
  const c3 = k3.diyalog.find((d) => d[0] === 'confirm');
  T.ok('sezonu geri al: silinecek izleme sayisi yazilir (3)', !!c3 && c3[2].startsWith('unwatchSeasonMsg|') && /"count":3/.test(c3[2]));
  T.ok('sezonu geri al: onaydan sonra unwatchSeason(7, 1)', esit(k3.cagri, [['unwatchSeason', 7, 1]]));
  const k4 = kur({ onay: false, ilerlemeMap: { 7: yarim } });
  await k4.useSezonIsaretleme(girdi({ season: sezon1, isSeasonWatched: true })).sezonuGeriAl(); await bekle();
  T.ok('sezonu geri al: vazgecince hicbir sey silinmez', k4.cagri.length === 0);
}

T.H('Korumalar');
{
  const k = kur({ guest: true, secim: 'primary' });
  await k.useSezonIsaretleme(girdi()).sezonDugmesi(); await bekle();
  T.ok('misafir: uyari, hicbir sey isaretlenmez', k.cagri.length === 0 && k.diyalog[0]?.[0] === 'notify');
}
{
  const k = kur({ secim: 'primary' });
  const yok = { number: 3, aired_episodes: 0, episodes: [{ number: 1, first_aired: '2099-01-01T00:00:00Z' }] };
  await k.useSezonIsaretleme(girdi({ season: yok })).sezonDugmesi(); await bekle();
  T.ok('hic yayinlanmamis sezon: bilgi, isaretleme yok', k.cagri.length === 0 && k.diyalog.some((d) => d[0] === 'notify' && d[1] === 'seasonNotAiredTitle'));
}
{
  const k = kur();
  await k.useSezonIsaretleme(girdi({ isSeasonWatched: true })).sezonDugmesi(); await bekle();
  T.ok('tamamen izli sezon: menu acilir, soru/isaretleme yok', k.durum.menu === true && k.cagri.length === 0 && k.diyalog.length === 0);
}

T.H('Kaynak denetimi');
const bilesen = oku('components/SeasonAccordion.tsx');
const hook = oku('hooks/useSezonIsaretleme.ts');
T.ok('SeasonAccordion mantigi hook a devretti (confirm/notify yok)', /useSezonIsaretleme\(/.test(bilesen) && !/confirmAsync|notify\(/.test(bilesen));
T.ok('menu: «Onceki Sezonlari Isaretle» satiri (yalniz eksik varsa)', /sezon\.menuOncekiSayisi > 0 &&/.test(bilesen) && /t\('markPrevSeasons'/.test(bilesen));
T.ok('hook: isaretleme onayi destructive:false', /t\('markAsWatched'\),\s*t\('common:cancel', 'Vazgeç'\),\s*\{ destructive: false \}/.test(hook));
T.ok('sezonu geri al KIRMIZI kalir (yikici)', /sezonuGeriAl[\s\S]{0,300}confirmAsync\([\s\S]{0,200}t\('common:delete', 'Geri Al'\),\s*t\('common:cancel', 'Vazgeç'\),\s*\);/.test(hook));
T.ok('engeli kaldir kirmizi degil (iki yer)', /\{ destructive: false \}/.test(oku('app/(protected)/blocked-users.tsx'))
  && /\{ destructive: !didIBlockThem \}/.test(oku('features/publicProfile/components/ProfilMenusu.tsx')));
const tr = JSON.parse(oku('locales/tr/media.json')); const en = JSON.parse(oku('locales/en/media.json'));
T.ok('film menusunde «Izlemeyi Birak» yok (yalniz dizi)', oku('components/modals/OptionsModal.tsx').includes("{type === 'show' && onHideFromProgress && ("));
T.ok('yeni metinler TR + EN', ['markOnlyThisSeason', 'markPrevSeasons', 'markSeasonWithPrevMsg', 'markSeasonRemainingMsg_one', 'markSeasonRemainingMsg_other', 'unwatchSeasonMsg_one', 'unwatchSeasonMsg_other'].every((k) => tr[k] && en[k]));

T.bitir();
