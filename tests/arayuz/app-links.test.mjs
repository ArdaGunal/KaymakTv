import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { tsLoader } from '../ts-test-loader.mjs';
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
const { paylasimUrl, paylasimUrlAyristir, paylasimSezonunuAyristir } = tsLoader(root, {}, { URL })('utils/paylasimUrl.ts');
const koken = 'https://kaymaktv.com';
const uuid = '12345678-1234-4abc-8def-abcdef123456';
const ornekler = [
  [{ tur: 'show', id: 1390 }, '/show/1390'],
  [{ tur: 'season', id: 1390, season: 3 }, '/show/1390?season=3'],
  [{ tur: 'season', id: 1390, season: 0 }, '/show/1390?season=0'],
  [{ tur: 'movie', id: 12 }, '/movie/12'],
  [{ tur: 'episode', id: '1390-dizi-adi-s3e5-123' }, '/episode/1390-dizi-adi-s3e5-123'],
  [{ tur: 'activity', id: uuid }, `/activity/${uuid}`],
  [{ tur: 'u', id: 10337897 }, '/u/10337897'],
];
const paylasilan = new Set(ornekler.map(([hedef]) => new URL(paylasimUrl(hedef)).pathname.split('/')[1]));
T.ok('Her kanonik hedefin yolu Android filtresinde', paylasilan.size === 5 && [...paylasilan].every((y) => yollar.includes(`/${y}/`)));
T.ok('Her filtre yolunun uygulamada rotasi var', yollar.every((y) => fs.existsSync(path.join(root, 'app', y.slice(1, -1), '[id].tsx'))));

T.H('Kanonik URL birim testleri');
for (const [hedef, yol] of ornekler) {
  const url = koken + yol;
  T.ok(`Uretim ${yol}`, paylasimUrl(hedef) === url);
  T.ok(`Ayristirma ${yol}`, JSON.stringify(paylasimUrlAyristir(url)) === JSON.stringify(hedef));
}

const eskiAdresler = [
  ['/show/1390-dizi-adi?tmdbId=12', '/show/1390'],
  ['/show/1390-dizi-adi?tmdbId=12&season=3', '/show/1390?season=3'],
  ['/movie/12-film-adi?tmdbId=23', '/movie/12'],
  ['/episode/1390-dizi-adi-s3e5-123?showTmdbId=12', '/episode/1390-dizi-adi-s3e5-123'],
  [`/activity/${uuid.toUpperCase()}?yorum=37`, `/activity/${uuid}`],
];
for (const [eskiYol, kanonikYol] of eskiAdresler) {
  const hedef = paylasimUrlAyristir(koken + eskiYol);
  T.ok(`Eski adres ${eskiYol}`, hedef && paylasimUrl(hedef) === koken + kanonikYol);
}

const gecersizAdresler = [
  'http://kaymaktv.com/show/1390',
  'https://kaymaktv.com.example.com/show/1390',
  'https://kullanici@kaymaktv.com/show/1390',
  koken + '/show/12abc',
  koken + '/show/9007199254740992',
  koken + '/episode/1390-dizi-adi-yanlis-123',
  koken + '/activity/taslak',
  koken + '/u/123',
];
T.ok('Gecersiz adresler hedef uretmez', gecersizAdresler.every((url) => paylasimUrlAyristir(url) === null));
T.ok('Gecersiz hedefler URL uretmez', [
  { tur: 'show', id: 0 },
  { tur: 'movie', id: Number.MAX_SAFE_INTEGER + 1 },
  { tur: 'season', id: 1390, season: -1 },
  { tur: 'episode', id: '1390-dizi-adi-s3e5-123/ek' },
  { tur: 'activity', id: 'taslak' },
  { tur: 'u', id: 123 },
].every((hedef) => paylasimUrl(hedef) === null));
T.ok('Sezon odagi normal sezon ve ozel bolumleri kabul eder', paylasimSezonunuAyristir('3') === 3 && paylasimSezonunuAyristir('0') === 0);
T.ok('Gecersiz veya tekrarlanan sezon dizi ana sayfasina duser',
  ['', ' 3', '3.0', '-1', '9007199254740992', ['3', '4'], undefined].every((deger) => paylasimSezonunuAyristir(deger) === null) &&
  paylasimUrlAyristir(koken + '/show/1390?season=3&season=4')?.tur === 'show');
T.bitir();
