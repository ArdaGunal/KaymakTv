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
const watched = (id, status) => ({ show: { ids: { trakt: id, tmdb: id + 100 }, title: `Show ${id}`, status } });
const asItems = (shows) => shows.map(({ show }) => ({
  key: `show-${show.ids.trakt}`, id: show.ids.trakt, title: show.title, tmdbId: show.ids.tmdb,
}));
const ids = (result) => result.filteredData.map(({ id }) => id).join(',');
const locale = (lang) => JSON.parse(read(`locales/${lang}/media.json`));

function setup({ provider, slices, tmdb = {}, trakt = {}, lang = 'tr' }) {
  const R = miniReact();
  R.useMemo = (factory, deps) => R.useCallback({ value: factory() }, deps).value;
  R.memo = (component) => component;
  R.createElement = (type, props, ...children) => ({ type, props, children });
  const timer = sahteZaman();
  const calls = { tmdb: [], trakt: [] };
  const disk = new Map();
  const messages = locale(lang);
  const translation = { i18n: { language: lang }, t: (key, fallback) => messages[key.split(':')[1]] ?? fallback };
  const load = tsLoader(root, {
    react: { ...R, default: R },
    'react-i18next': { useTranslation: () => translation },
    '../context/AuthContext': { useAuth: () => ({ authProvider: provider }) },
    '../context/LibraryContext': { useLibrarySelector: (select) => select(slices) },
    '../tmdbApi': {
      fetchFromTmdb: async (endpoint) => {
        const id = +endpoint.split('/').at(-1);
        calls.tmdb.push(id);
        if (!(id in tmdb)) throw new Error('TMDB unavailable');
        return { data: tmdb[id] };
      },
    },
    '../api/shows': {
      getShowSummary: async (id) => {
        calls.trakt.push(id);
        if (!(id in trakt)) throw new Error('Summary unavailable');
        return trakt[id];
      },
    },
    '../../utils/cacheManager': {
      cacheManager: {
        get: async (key) => disk.get(key) ?? null,
        set: async (key, value) => { disk.set(key, value); },
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
    watched(1, 'ended'), watched(2, 'returning series'), watched(3, 'ended'),
    watched(4), watched(5, 'canceled'), watched(6, 'ended'), watched(7, 'ended'),
  ];
  const showProgressMap = {
    1: complete(), 2: complete(), 3: complete(nextEpisode(future)), 4: complete(),
    5: complete(), 6: complete(nextEpisode(past)), 7: complete(),
  };
  const slices = { watchedShows, showProgressMap, hiddenShowIds: [7], watchlistShows: [watched(8, 'ended')] };
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
  T.ok('Trakt verisi ag sorgusu acmaz', env.calls.tmdb.length === 0 && env.calls.trakt.length === 0);

  const en = setup({ provider: 'trakt', slices, lang: 'en' });
  T.ok('EN etiketi Up to date', en.mount('shows', data)().options[2].label === 'Up to date');
  const movies = setup({ provider: 'trakt', slices, lang: 'en' });
  T.ok('film filtreleri ayni', movies.mount('movies', [])().options.map(({ key }) => key).join(',') === 'watched,watchlist,hidden');
}

T.H('Trakt baglanmamis Google hesabi');
{
  // /library/sync dizileri status tasimaz. Uretimdeki sekillendiriciyi calistir.
  const shape = tsLoader(root)('services/library/kaymakSekil.ts').yanitiSekillendir;
  const slices = shape({
    diziler: [1, 2, 3, 4, 5, 6, 7].map((id) => ({
      traktId: id, tmdbId: id === 5 ? null : id + 100, title: `Show ${id}`,
      year: 2000, runtime: null, genres: null,
      ilerleme: complete(id === 6 ? { season: 2, number: 1, title: 'S2E1' } : null),
    })),
  });
  slices.hiddenShowIds = [7];
  const env = setup({
    provider: 'google', slices,
    tmdb: {
      101: { status: 'Ended' },
      102: { status: 'Returning Series' },
      103: { status: 'Ended', next_episode_to_air: { air_date: future.slice(0, 10) } },
    },
    trakt: { 5: { status: 'canceled' } },
  });
  const data = asItems(slices.watchedShows);
  const result = env.mount('shows', data);
  T.ok('secim yokken katalog sorgusu yok ve Google kaydinda status yok', env.calls.tmdb.length === 0
    && env.calls.trakt.length === 0 && slices.watchedShows.every(({ show }) => show.status === undefined));
  result().applyStatuses(['upNext']);
  await bosalt();
  T.ok('Aktif filtresi katalog sorgusu acmaz', ids(result()) === '6' && env.calls.tmdb.length === 0);
  result().applyStatuses(['finished']);
  await bosalt();
  T.ok('TMDB Ended ve TMDB kimligi yokken Trakt canceled -> Bitirilenler', ids(result()) === '1,5');
  result().applyStatuses(['upToDate']);
  T.ok('TMDB Returning Series, duyurulan bolum ve bilinmeyen durum -> Guncel', ids(result()) === '2,3,4');
  T.ok('yalniz caughtUp dizileri icin katalog sorgusu', env.calls.tmdb.join(',') === '101,102,103,104'
    && env.calls.trakt.join(',') === '5,4');
  result().applyStatuses([]);
  result().applyStatuses(['finished']);
  await bosalt();
  T.ok('katalog onbellegi bilinen durumlari yeniden cekmez, hata yeniden denenebilir',
    ids(result()) === '1,5' && env.calls.tmdb.join(',') === '101,102,103,104,104'
      && env.calls.trakt.join(',') === '5,4,4');
}

T.bitir();
