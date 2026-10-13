import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// M472 · B-2: akışın son 1. sayfası diskte; soğuk açılışta ağ beklenmeden gösterilir.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const T = yardimci.baslat('AKIS DISK KOPYASI (M472 · B-2)', { kokOneki: 'akis-disk-' });

const disk = new Map();
const as = {
  getItem: async (k) => disk.get(k) ?? null,
  setItem: async (k, v) => { disk.set(k, v); },
  removeItem: async (k) => { disk.delete(k); },
};
const load = tsLoader(root, {
  zustand: require('zustand'),
  '@react-native-async-storage/async-storage': { default: as, ...as },
});
const { useFeedStore } = load('features/feed/store/feedStore.ts');
const D = load('features/feed/store/feedDiskCache.ts');
const st = useFeedStore.getState;
const a = (id, saat, ek = {}) => ({ id, user: { id: 'u1' }, activityAt: new Date(Date.UTC(2026, 9, 9, saat)).toISOString(), likeCount: 0, commentCount: 0, ...ek });

// ── Disk kopyası: yaz / oku / sahip / yaş / bozuk ──
const liste = [a('temp-x', 13, { isPending: true }), a('s12', 12, { isLikedByMe: true }), a('s11', 11)];
for (let i = 0; i < 50; i++) liste.push(a(`e${i}`, 1));
await D.akisiDiskeYaz('benim-id', liste);
const okunan = await D.akisiDisktenOku('benim-id');
T.ok('Yazilan kopya ayni hesapla okunuyor', okunan && okunan[0].id === 's12' && okunan[0].isLikedByMe === true);
T.ok('Iyimser/gecici kartlar diske gitmez', !okunan.some((x) => x.id.startsWith('temp-') || x.isPending));
T.ok(`En fazla ${D.AKIS_DISK_SATIR} satir`, okunan.length === D.AKIS_DISK_SATIR);
T.ok('BASKA hesap kopyayi goremez', (await D.akisiDisktenOku('baska-id')) === null);
T.ok('...ve baska hesap okuyunca kopya silinir', !disk.has(D.AKIS_DISK_ANAHTARI));

await D.akisiDiskeYaz('benim-id', [a('s1', 1)]);
T.ok('7 gunden eski kopya gosterilmez', (await D.akisiDisktenOku('benim-id', Date.now() + D.AKIS_DISK_MAX_YAS_MS + 1)) === null);
disk.set(D.AKIS_DISK_ANAHTARI, '{bozuk');
T.ok('Bozuk JSON cokmez, null ve silinir', (await D.akisiDisktenOku('benim-id')) === null && !disk.has(D.AKIS_DISK_ANAHTARI));
T.ok('Sahip yoksa okunmaz', (await D.akisiDisktenOku('')) === null);

// ── Store: disk yalnız boşken, ağ her zaman kazanır ──
T.ok('Bos store diskten doluyor', st().hydrateFromDisk([a('d2', 2), a('d1', 1)]) === true && st().kaynak === 'disk');
T.ok('Disk durumunda imlec yok (sonsuz kaydirma beklemede), hasMore acik (Hepsi bu kadar yazmaz)', st().nextCursor === null && st().hasMore === true);
st().setFirstPage({ items: [a('n3', 3), a('d2', 2, { likeCount: 4 })], hasMore: true, nextCursor: { activityAt: 'c', id: 'd2' } });
T.ok('Taze sayfa diski TAMAMEN degistirir (silinen d1 gitti, begeni tazelendi)', JSON.stringify(st().activities.map((x) => x.id)) === '["n3","d2"]' && st().activities[1].likeCount === 4 && st().kaynak === 'ag');
T.ok('Ag once geldiyse gec gelen disk kopyasi YOK sayilir', st().hydrateFromDisk([a('eski', 0)]) === false && !st().activities.some((x) => x.id === 'eski'));
st().reset();
T.ok('Cikis (reset) kaynagi sifirlar — gecikmeli yazma kapisi kapanir', st().kaynak === 'yok' && st().isHydrated === false);

// ── Kaynak kontrolü: kanca bağlantıları ──
const kanca = fs.readFileSync(path.join(root, 'features/feed/hooks/useFeed.ts'), 'utf8');
T.ok('useFeed soguk acilista diski agla YARISTIRIYOR', /akisiDisktenOku\(sahip\)[\s\S]{0,200}hydrateFromDisk\(satirlar\)/.test(kanca) && /hydrateFromDisk[\s\S]{0,400}loadFirstPage\(false\)/.test(kanca));
T.ok('Diske yalniz sunucu gercegi (kaynak ag) yaziliyor, yazma aninda yeniden denetleniyor', (kanca.match(/kaynak !== 'ag'/g) || []).length >= 2);
const auth = fs.readFileSync(path.join(root, 'context/AuthContext.tsx'), 'utf8');
T.ok('Cikis tum AsyncStorage anahtarlarini siliyor (akis kopyasi dahil; D8/M517)', /await cihazAnahtarlariniSil\(\);/.test(auth) && /useFeedStore.getState\(\).reset\(\)/.test(auth));
T.bitir();
