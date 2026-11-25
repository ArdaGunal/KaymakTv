import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { miniReact, sahteZaman, bosalt } from '../mini-react.mjs';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const T = yardimci.baslat('FILTRE-GUNCEL', { kokOneki: 'filtre-guncel-' });
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const future = '2999-01-01T00:00:00Z';
const past = '2000-01-01T00:00:00Z';
const nextEpisode = (first_aired) => ({ season: 2, number: 1, title: 'S2E1', first_aired });
const complete = (next_episode = null) => ({
  aired: 1, completed: 1, last_watched_at: new Date().toISOString(),
  seasons: [], next_episode, last_episode: { season: 1, number: 1, title: 'S1E1' },
});
const katalogBilgisi = (durum, tarih = null) => ({ yayin_durumu: durum, sonraki_yayin_at: tarih });
const watched = (id, durum) => ({
  show: { ids: { trakt: id, tmdb: id + 100 }, title: `Show ${id}`, ...katalogBilgisi(durum ?? 'bilinmiyor') },
});
const asItems = (shows) => shows.map(({ show }) => ({
  key: `show-${show.ids.trakt}`, id: show.ids.trakt, title: show.title, tmdbId: show.ids.tmdb,
}));
const ids = (result) => result.filteredData.map(({ id }) => id).join(',');
const locale = (lang) => JSON.parse(read(`locales/${lang}/media.json`));

function setup({ provider, slices, katalog = [], lang = 'tr' }) {
  const R = miniReact();
  R.useMemo = (factory, deps) => R.useCallback({ value: factory() }, deps).value;
  R.memo = (component) => component;
  R.createElement = (type, props, ...children) => ({ type, props, children });
  const timer = sahteZaman();
  const calls = [];
  const messages = locale(lang);
  const translation = {
    i18n: { language: lang },
    t: (key, options) => {
      const text = messages[key.split(':')[1]];
      return text?.replace('{{count}}', String(options?.count)) ?? options;
    },
  };
  const load = tsLoader(root, {
    react: { ...R, default: R },
    'react-i18next': { useTranslation: () => translation },
    '../context/AuthContext': { useAuth: () => ({ authProvider: provider }) },
    '../context/LibraryContext': { useLibrarySelector: (select) => select(slices) },
    '../services/api/library': {
      fetchDiziYayinBilgileri: async (ids) => {
        calls.push(ids);
        return katalog.filter(({ traktId }) => ids.includes(traktId));
      },
    },
    '../../constants/mobilePalette': { nativeColor: (_, color) => color },
    'react-native': {
      View: 'View', Text: 'Text', TextInput: 'TextInput', TouchableOpacity: 'TouchableOpacity',
      StyleSheet: { create: (styles) => styles }, Platform: { OS: 'web' },
    },
    '../icons': { Search: 'Search', SlidersHorizontal: 'SlidersHorizontal', X: 'X' },
  }, { setTimeout: timer.setTimeout, clearTimeout: timer.clearTimeout });
  const { useLibraryFilters } = load('hooks/useLibraryFilters.ts');
  return {
    load, calls,
    mount(type, data, initialStatuses) {
      return R.baglan(() => useLibraryFilters(data, type, initialStatuses));
    },
  };
}

function badgeValue(node) {
  if (node?.props?.style?.fontSize === 10) return node.children[0];
  return node?.children?.map(badgeValue).find((value) => value !== undefined);
}

T.H('Trakt + ortak filtre menusu');
{
  const watchedShows = [
    watched(1, 'bitti'), watched(2, 'devam'), { show: { ...watched(3, 'bitti').show, sonraki_yayin_at: future } },
    watched(4), watched(5, 'iptal'), watched(6, 'bitti'), watched(7, 'bitti'),
  ];
  const showProgressMap = {
    1: complete(), 2: complete(), 3: complete(nextEpisode(future)), 4: complete(),
    5: complete(), 6: complete(nextEpisode(past)), 7: complete(),
  };
  const slices = { watchedShows, showProgressMap, hiddenShowIds: [7], watchlistShows: [watched(8, 'bitti')] };
  const env = setup({ provider: 'trakt', slices });
  const data = asItems(watchedShows);
  const result = env.mount('shows', data, ['caughtUp']);
  const keys = 'upNext,paused,upToDate,notStarted,finished,hidden';
  T.ok('menu sirasi ve TR etiketleri', result().options.map(({ key }) => key).join(',') === keys
    && result().options[2].label === 'Güncel' && result().options[4].label === 'Bitirilenler');
  T.ok('eski caughtUp URL secimi iki yeni kategoriyi acar', ids(result()) === '1,2,3,4,5');
  result().applyStatuses(['finished']);
  T.ok('ended ve canceled + hepsi izlendi -> Bitirilenler', ids(result()) === '1,5');
  result().applyStatuses(['upToDate']);
  T.ok('returning, gelecek bolum ve bilinmeyen durum -> Guncel', ids(result()) === '2,3,4');
  result().applyStatuses(['upNext', 'notStarted', 'hidden']);
  T.ok('izlenebilir, baslanmamis ve gizli kovalar korunur', ids(result()) === '6,7,8');

  const Bar = env.load('components/library/LibraryFilterBar.tsx').default;
  const badge = () => badgeValue(Bar({ value: '', activeFilterCount: result().activeStatuses.length }));
  result().applyStatuses(['upToDate']);
  T.ok('Guncel seciliyken rozet 1', badge() === 1);
  result().applyStatuses(['finished', 'upToDate', 'upToDate']);
  T.ok('iki farkli filtre rozet 2, secim menu sirasinda', badge() === 2
    && result().activeStatuses.join(',') === 'upToDate,finished');
  result().applyStatuses([]);
  T.ok('secim temizlenince rozet yok ve tam liste gorunur', badge() === undefined && result().filteredData === data);
  T.ok('masaustu ve mobil ayni secim sayisini rozete verir', [
    'app/(protected)/library/[type].web.tsx', 'screens/LibraryMobile.tsx',
  ].every((file) => /activeFilterCount=\{activeStatuses\.length\}/.test(read(file))));
  T.ok('Trakt verisi ag sorgusu acmaz', env.calls.length === 0);

  const en = setup({ provider: 'trakt', slices, lang: 'en' });
  T.ok('EN etiketi Up to date', en.mount('shows', data)().options[2].label === 'Up to date');
  const movies = setup({ provider: 'trakt', slices, lang: 'en' });
  T.ok('film filtreleri ayni', movies.mount('movies', [])().options.map(({ key }) => key).join(',') === 'watched,watchlist,hidden');
}

T.H('Trakt baglanmamis Google hesabi');
{
  const shape = tsLoader(root)('services/library/kaymakSekil.ts').yanitiSekillendir;
  const bilgi = {
    1: katalogBilgisi('bitti'), 2: katalogBilgisi('devam'),
    3: katalogBilgisi('bitti', future), 7: katalogBilgisi('bitti'),
  };
  const slices = shape({
    diziler: [1, 2, 3, 4, 5, 6, 7].map((id) => ({
      traktId: id, tmdbId: id === 5 ? null : id + 100, title: `Show ${id}`,
      year: 2000, runtime: null, genres: null,
      ilerleme: complete(id === 6 ? { season: 2, number: 1, title: 'S2E1' } : null),
      ...bilgi[id],
    })),
  });
  slices.hiddenShowIds = [7];
  const env = setup({ provider: 'google', slices, katalog: [{ traktId: 5, ...katalogBilgisi('iptal') }] });
  const result = env.mount('shows', asItems(slices.watchedShows));
  T.ok('secim yokken katalog sorgusu yok', env.calls.length === 0);
  result().applyStatuses(['upNext']);
  await bosalt();
  T.ok('Aktif filtresi katalog sorgusu acmaz', ids(result()) === '6' && env.calls.length === 0);
  result().applyStatuses(['finished']);
  await bosalt();
  T.ok('Google-only katalogdan biten ve iptal edilen dizi', ids(result()) === '1,5');
  result().applyStatuses(['upToDate']);
  T.ok('devam, duyurulan bolum ve bilinmeyen durum Guncel', ids(result()) === '2,3,4');
  const etiketler = result().filteredData.map(({ yayinEtiketi }) => yayinEtiketi);
  T.ok('tarih varsa yerel tarih, yoksa yeni sezon etiketi', etiketler[0] === 'Yeni sezon bekleniyor'
    && etiketler[1]?.includes('2999') && etiketler[2] === 'Yeni sezon bekleniyor');
  T.ok('yalniz eksik caughtUp satirlari Worker katalog ucuna gider', env.calls.length === 1 && env.calls[0].join(',') === '4,5');
  result().applyStatuses([]);
  result().applyStatuses(['finished']);
  await bosalt();
  T.ok('ayni filtre acilirsa sonuc yeniden kullanilir', ids(result()) === '1,5' && env.calls.length === 1);
}

T.H('Katalog tarihi guncelleme ve yayin gecisi');
{
  const { categorizeShows } = tsLoader(root)('store/tracking/trackingLogic.ts');
  const date = '2026-11-26T10:00:00Z';
  const an = Date.parse(date);
  const ertelenmis = (now, number = 1) => categorizeShows({
    watchedShows: [{ show: { ...watched(10, 'devam').show, sonraki_yayin_at: date,
      sonraki_yayin_sezon: 2, sonraki_yayin_bolum: 1 } }],
    watchlistShows: [], showProgressMap: { 10: complete({ ...nextEpisode('2026-11-26T09:00:00Z'), number }) },
    hiddenShowIds: [], labels: {}, now,
    yayinBilgileri: new Map([[10, katalogBilgisi('bitti', '2026-11-26T08:00:00Z')]]),
  });
  T.ok('yeni senkron katalog tarihi eski Trakt ve ekran onbelleginden ustun',
    ertelenmis(an - 2 * 3_600_000).upToDate[0]?.sonrakiYayinAt === date);
  T.ok('ertelenen ayni bolum erken aktif olmaz, farkli yayinlanmis bolum aktif kalir',
    ertelenmis(an - 30_000).upToDate[0]?.id === 10 && ertelenmis(an - 30_000, 2).upNext[0]?.id === 10);
  const classify = (now) => categorizeShows({
    watchedShows: [{ show: { ...watched(11, 'devam').show, sonraki_yayin_at: date } }],
    watchlistShows: [], hiddenShowIds: [], labels: {}, now,
    showProgressMap: { 11: { ...complete(), last_watched_at: '2026-11-26T08:00:00Z',
      seasons: [{ number: 2, episodes: [{ number: 1, first_aired: date, completed: false }] }] } },
  });
  T.ok('Google sezon verisi katalog aninda Guncel listesinden Aktife gecer',
    classify(an - 1).upToDate[0]?.id === 11 && classify(an).upNext[0]?.id === 11);
}

T.H('Guncel tarihi yerel takvim ve esikler');
{
  const { guncelEtiketi } = tsLoader(root)('utils/diziYayinDurumu.ts');
  const now = Date.parse('2026-03-08T04:30:00Z');
  const label = (date, lang = 'en') => guncelEtiketi(date, now, lang, 'America/New_York');
  T.ok('DST ve iki farkli UTC gunu ayni yerel gun', label('2026-03-08T04:59:00Z').tur === 'bugun');
  T.ok('24 saat dolmadan yerel yarin', label('2026-03-08T05:00:00Z').tur === 'yarin');
  const count = label('2026-04-06T12:00:00Z');
  T.ok('tam 30 gun sayac', count.tur === 'gun' && count.gun === 30);
  const date = label('2026-04-07T12:00:00Z', 'tr');
  const nextYear = label('2027-01-14T12:00:00Z');
  T.ok('31. gun tam tarih, yil yalniz degistiginde', date.metin === '7 Nisan' && nextYear.metin === 'Jan 14, 2027');
  T.ok('bos ve gecersiz tarih bekleniyor', label(null).tur === 'bekleniyor' && label('bad').tur === 'bekleniyor');
}

T.bitir();
