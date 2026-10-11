import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { tsLoader } from '../ts-test-loader.mjs';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = require('../yardimci').baslat('ARA VERILENLER SAATI (2.6.5 madde 7)', { kokOneki: 'ara-verilenler-' });
const { categorizeShows } = tsLoader(root)('store/tracking/trackingLogic.ts');

const GUN = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-10-12T12:00:00.000Z');
const once = (gun) => new Date(now - gun * GUN).toISOString();
const media = { ids: { trakt: 7 }, title: 'Fixture' };
const labels = { unnamedShow: '?', notStarted: 'Baslamadi', caughtUp: 'Guncel' };

// Kaymak kaynaklarinin (Worker / RPC 063 / iyimser) gercek sekli: `next_episode`
// yayin tarihi TASIMAZ, tarih yalniz `seasons[].episodes[].first_aired`'da.
const ilerleme = (sonrakiYayin, ekstra = {}) => ({
  aired: 11, completed: 10,
  next_episode: { season: 2, number: 1, title: 'S2E1' },
  seasons: [
    { number: 1, episodes: [{ number: 10, completed: true, first_aired: once(400) }] },
    { number: 2, episodes: [{ number: 1, completed: false, first_aired: sonrakiYayin }] },
  ],
  ...ekstra,
});
const kova = (progress, sonIzleme) => {
  const c = categorizeShows({ watchedShows: [{ show: media, last_watched_at: sonIzleme }], watchlistShows: [],
    showProgressMap: { 7: progress }, now, labels });
  return c.paused.length ? 'paused' : c.upNext.length ? 'upNext' : c.caughtUp.length ? 'caughtUp' : 'yok';
};

T.H('Aylarca beklenen dizinin yeni bolumu cikti');
T.ok('Son izleme 300 gun once, S2E1 3 gun once yayinlandi -> Aktif (upNext)', kova(ilerleme(once(3)), once(300)) === 'upNext');
T.ok('Ayni dizi, yeni bolum 44 gundur izlenmedi -> hala Aktif', kova(ilerleme(once(44)), once(300)) === 'upNext');
T.ok('Yeni bolum 46 gundur izlenmedi -> Ara Verilenler', kova(ilerleme(once(46)), once(300)) === 'paused');
T.ok('next_episode.first_aired varsa (Trakt sekli) o da sayilir', kova(ilerleme(null, { next_episode: { season: 2, number: 1, title: 'S2E1', first_aired: once(3) } }), once(300)) === 'upNext');

T.H('Eski davranis korunur');
T.ok('Yarim birakilan dizi: sonraki bolum yillar once yayinlandi -> Ara Verilenler', kova(ilerleme(once(900)), once(300)) === 'paused');
T.ok('Yakin zamanda izlenen dizi -> Aktif', kova(ilerleme(once(900)), once(5)) === 'upNext');
T.ok('Yayin tarihi bilinmiyorsa son izlemeye bakilir (eski kural)', kova(ilerleme(null), once(300)) === 'paused');
T.ok('Henuz yayinlanmamis sonraki bolum -> Guncel (paused degil)', kova(ilerleme(null, { next_episode: { season: 2, number: 1, title: 'S2E1', first_aired: new Date(now + 5 * GUN).toISOString() } }), once(300)) === 'caughtUp');
T.ok('Son izleme tarihi yoksa paused varsayilmaz', kova(ilerleme(once(900)), undefined) === 'upNext');

T.bitir();
