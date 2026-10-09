import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// C5 / A-7 · Zaman ayracı + sayfa sınırında kesilen maraton.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('AKIS ZAMAN AYRACI + MARATON SINIRI (C5)', { kokOneki: 'akis-zaman-' });
const as = { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} };
const load = tsLoader(root, { '@react-native-async-storage/async-storage': { default: as, ...as } }, { __DEV__: false });
const { dayLabel, dayLabelsFor } = load('features/feed/utils/dayLabel.ts');
const { marathonSayfaSinirinda } = load('features/feed/utils/marathonSinir.ts');
const { diskSatirlari, AKIS_DISK_SATIR } = load('features/feed/store/feedDiskCache.ts');
const { groupMarathonActivities } = load('features/feed/utils/groupMarathonActivities.ts');

const t = (k) => ({ dayToday: 'Bugün', dayYesterday: 'Dün' }[k]);
const simdi = new Date(2026, 9, 10, 14, 0); // 10 Eki 2026 Cuma 14:00 (yerel)
const gun = (g, s = 12) => new Date(2026, 9, g, s, 0).toISOString();
T.ok('Bugun', dayLabel(gun(10, 1), 'tr', t, simdi) === 'Bugün');
T.ok('Dun (gece yarisi siniri yerel)', dayLabel(new Date(2026, 9, 9, 23, 59).toISOString(), 'tr', t, simdi) === 'Dün');
const haftaIci = dayLabel(gun(7), 'tr', t, simdi);
T.ok(`Son 7 gun: gun adi (${haftaIci})`, /çarşamba/i.test(haftaIci));
const eski = dayLabel(gun(1), 'en', t, simdi);
T.ok(`Daha eski: gun + ay, yil yok (${eski})`, /Oct/.test(eski) && /1/.test(eski) && !/2026/.test(eski));
T.ok('Gecmis yil yazilir', /2025/.test(dayLabel(new Date(2025, 11, 3).toISOString(), 'tr', t, simdi)));
const etiket = dayLabelsFor([{ activityAt: gun(10, 13) }, { activityAt: gun(10, 9) }, { activityAt: gun(9) }, { activityAt: gun(9, 8) }, { activityAt: gun(3) }], 'tr', t, simdi);
T.ok('Ayrac yalniz gun degisince (ilk oge dahil)', JSON.stringify(etiket.map((x) => x !== null)) === '[true,false,true,false,true]');

// Maraton sınırı: kullanıcı A, dizi 5 — 47 bölüm ~30 dk arayla; 40'ta kesilirse sınırda.
const u = (id) => ({ id, username: id, traktSlug: id, avatarUrl: null });
const t0 = new Date(2026, 9, 7, 20, 0).getTime();
const maraton = Array.from({ length: 47 }, (_, i) => ({
  id: `m${i}`, user: u('A'), activityType: 'watched_episode', showId: 5, showTitle: 'Fairy Tail', mediaType: 'show',
  episodeNumber: `S01E${String(48 - i).padStart(2, '0')}`, activityAt: new Date(t0 - i * 30 * 60_000).toISOString(), likeCount: 0, commentCount: 0,
}));
const eskiKayit = { id: 'eski', user: u('B'), activityType: 'watched_movie', showId: 9, mediaType: 'movie', showTitle: 'X', activityAt: new Date(t0 - 5 * 86_400_000).toISOString(), likeCount: 0, commentCount: 0 };
const ilk40 = maraton.slice(0, 40);
T.ok('40 satirda kesilen maraton SINIRDA', marathonSayfaSinirinda(ilk40) === true);
T.ok('Tamami + 24 saatten eski bir satir = sinirda DEGIL', marathonSayfaSinirinda([...maraton, eskiKayit]) === false);
T.ok('Maraton olmayan (2 bolum) sinirda sayilmaz', marathonSayfaSinirinda(maraton.slice(0, 2)) === false);
const say = (liste) => groupMarathonActivities(liste).find((x) => x.type === 'marathon')?.episodeCount;
T.ok(`Kesik liste x${say(ilk40)}, tam liste x${say([...maraton, eskiKayit])} (eski hata: sayi ziplar)`, say(ilk40) === 40 && say([...maraton, eskiKayit]) === 47);
const disk = diskSatirlari([...maraton, eskiKayit]);
T.ok(`Disk kopyasi maratonun ortasinda kesilmez (${disk.length} satir, taban ${AKIS_DISK_SATIR})`, say(disk) === 47);

const kanca = fs.readFileSync(path.join(root, 'features/feed/hooks/useFeed.ts'), 'utf8');
T.ok('Sinirdaki maraton icin sonraki sayfa kendiliginden (en fazla 3, yukleme bayragina bagli)', /MARATON_OTO_SAYFA = 3/.test(kanca) && /marathonSayfaSinirinda\(activities\)/.test(kanca) && /\[activities, hasMore, isLoadingMore, canLoad, loadMoreFailed, doLoadMore\]/.test(kanca));
T.ok('Akis ekrani ayraci ciziyor', /<DaySeparator label=/.test(fs.readFileSync(path.join(root, 'app/(protected)/(tabs)/feed.tsx'), 'utf8')));
T.bitir();
