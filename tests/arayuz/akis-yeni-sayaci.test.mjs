import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// HIZ-01 / Faz 4 (M542) — «N yeni gönderi» yalnız bilinen en yeniden YENİ olanları sayar.
// Kullanıcı (2026-10-19): ilk girişte hiçbir şey yeni değilken «40 yeni gönderi».
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const T = yardimci.baslat('AKIS YENI SAYACI (M542)', { kokOneki: 'akis-yeni-sayaci-' });
const yukle = tsLoader(root, { zustand: require('zustand') });
const { useFeedStore } = yukle('features/feed/store/feedStore.ts');
const { yeniSayisi } = yukle('features/feed/store/yeniSayaci.ts');
// Zaman ŞİMDİYE göre (saat): 0 = şimdi, -5 = beş saat önce, +1 = bir saat sonra (taban sonrası yeni).
const SIMDI = Date.now();
const a = (id, saat, kisi = 'baska') => ({
  id, activityAt: new Date(SIMDI + saat * 3600_000).toISOString(), likeCount: 0, user: { id: kisi },
});
const st = useFeedStore.getState;
const sifirla = () => st().setFiltre('tumu', null);

// ── Saf kural ──────────────────────────────────────────────────────────
T.ok('Bos liste, taban yok: hicbir sey sayilmaz', yeniSayisi([], [a('x', 1), a('y', 2)]) === 0);
T.ok('Taban: listeden yeni ama tabandan (−30 dk) eski sayilmaz', yeniSayisi([a('s', -10)], [a('e', -2), a('n', 1)], SIMDI) === 1);
T.ok('Tolerans: 10 dk once izlenip simdi gelen sayilir', yeniSayisi([a('s', -10)], [a('t', -1 / 6)], SIMDI) === 1);
T.ok('Yalniz en yeniden yeniler sayilir', yeniSayisi([a('s10', 10), a('s5', 5)], [a('n11', 11), a('e7', 7), a('e3', 3)]) === 1);
T.ok('Ayni an yeni sayilmaz (kati buyuk)', yeniSayisi([a('s10', 10)], [a('n10', 10)]) === 0);
T.ok('temp- kart olcute girmez', yeniSayisi([a('temp-x', 20), a('s10', 10)], [a('n11', 11)]) === 1);
T.ok('Yalniz temp- varsa bilinen son yok → 0', yeniSayisi([a('temp-x', 20)], [a('n11', 11)]) === 0);

// ── Senaryo 1: ilk giriş, disk boş — Realtime eski geçmişi INSERT olarak getiriyor ─────
sifirla();
st().setFirstPage({ items: [], hasMore: false, nextCursor: null });
// Eskiden yeniye akış (en kötü durum): her satır bir öncekinden yeni.
for (let i = 0; i < 40; i++) st().upsertActivity(a(`eski${i}`, -48 + i), true);
T.ok('Bos akisa gelen 40 eski kayit rozete SAYILMAZ (kullanicinin gordugu hata)', st().unseenCount === 0);
T.ok('...ama listeye eklenir', st().activities.length === 40);

// ── Senaryo 2: liste dolu, Realtime eski backfill + bir gerçek yeni ─────────────────
sifirla();
st().setFirstPage({ items: [a('s10', -1), a('s9', -2)], hasMore: true, nextCursor: { activityAt: 'x', id: 's9' } });
st().upsertActivity(a('geriDolum', -6), true);
T.ok('Bilinen en yeniden eski Realtime kaydi sayilmaz', st().unseenCount === 0);
st().upsertActivity(a('gercekYeni', 0.1), true);
T.ok('Gercekten yeni Realtime kaydi sayilir', st().unseenCount === 1);
st().upsertActivity(a('benim', 0.2, 'ben'), false);
T.ok('Kendi kartim sayilmaz (countAsUnseen=false)', st().unseenCount === 1);

// ── Senaryo 3: uzun aradan sonra taze 1. sayfa (M470) diskte olmayan ESKİLERİ de taşıyor ──
sifirla();
st().hydrateFromDisk([a('d10', -1), a('d9', -2)]);
st().mergeFreshFirstPage({
  items: [a('n12', 0.3), a('n11', 0.2), a('d10', -1), a('eskiAma8', -3), a('eskiAma6', -5)],
  hasMore: true, nextCursor: { activityAt: 'z', id: 'eskiAma6' },
});
T.ok('Taze sayfada yalniz bilinen en yeniden yeniler sayilir (2, 4 degil)', st().unseenCount === 2);

// ── Senaryo 4: sayfalama / eski sayfa doldurma sayacı değiştirmez ───────────────
const once = st().unseenCount;
st().appendPage({ items: [a('p5', -7), a('p4', -8)], hasMore: false, nextCursor: null });
T.ok('appendPage sayaca dokunmaz', st().unseenCount === once);

// ── Senaryo 5: hidrasyon öncesi ilk ağ sayfası (isHydrated=false) sayılmaz ───────
sifirla();
st().mergeFreshFirstPage({ items: [a('i1', 10), a('i2', 9)], hasMore: false, nextCursor: null });
T.ok('Ilk ag sayfasi sayaci 0 birakir', st().unseenCount === 0 && st().activities.length === 2);

// ── geciciseBirKezDaha: yalnız geçici hatada bir kez daha ─────────────────────────
const { geciciseBirKezDaha } = yukle('utils/geciciseTekrarla.ts');
const sus = console.warn;
console.warn = () => {};
let n = 0;
const sonuc = await geciciseBirKezDaha(async () => {
  n += 1;
  if (n === 1) throw Object.assign(new Error('Request failed with status code 502'), { response: { status: 502 } });
  return 'tamam';
}, 0);
T.ok('502 → bir kez daha denenir ve doner', sonuc === 'tamam' && n === 2);

n = 0;
let atildi = null;
try {
  await geciciseBirKezDaha(async () => {
    n += 1;
    throw Object.assign(new Error('timeout of 15000ms exceeded'), { code: 'ECONNABORTED' });
  }, 0);
} catch (e) { atildi = e; }
T.ok('Ikinci deneme de duserse hata yukari cikar (sari uyari ancak o zaman)', n === 2 && atildi?.code === 'ECONNABORTED');

n = 0;
atildi = null;
try {
  await geciciseBirKezDaha(async () => {
    n += 1;
    throw Object.assign(new Error('Request failed with status code 500'), { response: { status: 500 } });
  }, 0);
} catch (e) { atildi = e; }
T.ok('Gercek hata (500) tekrarlanmaz', n === 1 && atildi !== null);
console.warn = sus;

T.bitir();
