import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = require('../yardimci').baslat('ANDROID APP LINKS (2.6.5 madde 6)', { kokOneki: 'app-links-' });
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const app = JSON.parse(oku('app.json')).expo;
const links = JSON.parse(oku('server/assetlinks.json'));
const server = oku('server.js');
const filtre = (app.android.intentFilters || []).find((f) => f.autoVerify);
const yollar = (filtre?.data || []).map((d) => d.pathPrefix);

T.H('assetlinks.json');
const hedef = links[0]?.target;
T.ok('Paket adi app.json ile ayni', hedef?.package_name === app.android.package);
T.ok('handle_all_urls izni', links[0]?.relation?.includes('delegate_permission/common.handle_all_urls'));
T.ok('SHA-256 bicimi (32 bayt, iki nokta ayrimli, buyuk harf)', /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(hedef?.sha256_cert_fingerprints?.[0] || ''));

T.H('server.js');
const rota = server.indexOf("app.get('/.well-known/assetlinks.json'");
T.ok('Rota var ve express.static ile SPA fallback ONCESINDE', rota > -1 && rota < server.indexOf('express.static(') && rota < server.indexOf("sendFile(path.join(__dirname, 'dist', 'index.html'))"));
T.ok('JSON turuyle donuyor', /type\('application\/json'\)/.test(server.slice(rota, rota + 400)));

T.H('app.json intentFilters');
T.ok('autoVerify filtresi https + kaymaktv.com', !!filtre && filtre.data.every((d) => d.scheme === 'https' && d.host === 'kaymaktv.com'));
T.ok('Kok/indirme sayfasi uygulamaya kapilmaz (yalniz yol onekleri)', filtre.data.every((d) => d.pathPrefix && d.pathPrefix !== '/'));
// Koddaki her paylasim baglantisi filtrede olmali — yeni paylasim yolu eklenirse bu test uyarir.
const kaynaklar = ['components/modals/OptionsModal.tsx', 'components/tracking/TrackingCardMenu.tsx',
  'features/feed/hooks/useActivityActions.tsx', 'hooks/useEpisodeActions.ts'];
const paylasilan = new Set();
for (const f of kaynaklar) {
  for (const m of oku(f).matchAll(/https:\/\/kaymaktv\.com\/([a-z]+|\$\{[a-zA-Z]+\})\//g)) {
    if (m[1].startsWith('${')) { paylasilan.add('/show/'); paylasilan.add('/movie/'); } else paylasilan.add(`/${m[1]}/`);
  }
}
T.ok(`Paylasilan yollar (${[...paylasilan].join(' ')}) filtrede`, paylasilan.size >= 4 && [...paylasilan].every((y) => yollar.includes(y)));
T.ok('Her filtre yolunun uygulamada rotasi var', yollar.every((y) => fs.existsSync(path.join(root, 'app', y.slice(1, -1), '[id].tsx'))));
T.bitir();
