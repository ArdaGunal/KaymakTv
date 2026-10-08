import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// M470 · Arka plandan dönüşte kaçan akış olaylarını listeyi bozmadan yakalama.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const T = yardimci.baslat('AKIS ARKA PLAN YAKALAMA (M470)', { kokOneki: 'akis-yakalama-' });
const { useFeedStore } = tsLoader(root, { zustand: require('zustand') })('features/feed/store/feedStore.ts');
const a = (id, saat) => ({ id, activityAt: new Date(Date.UTC(2026, 9, 9, saat)).toISOString(), likeCount: 0 });
const ids = () => useFeedStore.getState().activities.map((x) => x.id);
const st = useFeedStore.getState;

// Başlangıç: 1. sayfa (10–7) + kaydırıp yüklenen 2. sayfa (6–5) + iyimser kart.
st().setFirstPage({ items: [a('s10', 10), a('s9', 9), a('s8', 8), a('s7', 7)], hasMore: true, nextCursor: { activityAt: 'x', id: 's7' } });
st().appendPage({ items: [a('s6', 6), a('s5', 5)], hasMore: true, nextCursor: { activityAt: 'y', id: 's5' } });
st().upsertActivity({ ...a('temp-watched_episode-1--1', 11) }, false);
const imlec = st().nextCursor;

// Yokken: s12, s11 geldi; s9 silindi; s8'in beğenisi arttı. Taze sayfa 12..8 (hasMore).
st().mergeFreshFirstPage({ items: [a('s12', 12), a('s11', 11), a('s10', 10), { ...a('s8', 8), likeCount: 5 }, a('s7', 7)], hasMore: true, nextCursor: { activityAt: 'z', id: 's7' } });
T.ok('Yeniler eklendi ve rozete sayildi', ids().includes('s12') && ids().includes('s11') && st().unseenCount === 2);
T.ok('Yokken silinen (aralik ici) cikti', !ids().includes('s9'));
T.ok('Var olan tazelendi (begeni)', st().activities.find((x) => x.id === 's8').likeCount === 5);
T.ok('Yuklu eski sayfa korundu (kaydirma bozulmaz)', ids().includes('s6') && ids().includes('s5'));
T.ok('Iyimser temp kart korundu', ids().some((x) => x.startsWith('temp-')));
T.ok('Imlec degismedi (sonsuz kaydirma kaldigi yerden)', st().nextCursor === imlec);
T.ok('Sira hala yeniden eskiye', JSON.stringify(ids().filter((x) => !x.startsWith('temp')).slice(0, 3)) === JSON.stringify(['s12', 's11', 's10']));

// Taze sayfa tam degilse (hasMore=false) aralik «her sey»: listede olup sunucuda olmayan cikar.
st().mergeFreshFirstPage({ items: [a('s12', 12)], hasMore: false, nextCursor: null });
T.ok('hasMore=false iken sunucuda olmayanlar cikar, temp kalir', JSON.stringify(ids().filter((x) => !x.startsWith('temp'))) === '["s12"]' && ids().some((x) => x.startsWith('temp-')));

const kanca = fs.readFileSync(path.join(root, 'features/feed/hooks/useFeed.ts'), 'utf8');
T.ok('useFeed one gelince (>=15 sn) taze sayfayi birlestiriyor', /YAKALAMA_ESIGI_MS = 15_000/.test(kanca)
  && /fetchFeedActivities\(null, true\)[\s\S]{0,80}mergeFreshFirstPage\(page\)/.test(kanca));
T.bitir();
