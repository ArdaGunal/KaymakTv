import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('TEK UCUS — ESZAMANLI KOPYA ISTEK (M461)', { kokOneki: 'tek-ucus-' });
const { tekUcus } = tsLoader(root)('utils/tekUcus.ts');
const source = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const ertele = () => { let coz, red; const p = new Promise((a, b) => { coz = a; red = b; }); return { p, coz, red }; };

let cagri = 0; let bekleyen = [];
const fn = tekUcus((k) => k, (k) => { cagri++; const d = ertele(); bekleyen.push(d); return d.p.then((v) => `${k}:${v}`); });

T.H('Birlesme ve tazelik');
const a = fn('A'); const b = fn('A'); const c = fn('B');
T.ok('Ayni anahtar eszamanli → tek istek; farkli anahtar ayri', cagri === 2);
bekleyen[0].coz(1); bekleyen[1].coz(2);
const [ra, rb, rc] = await Promise.all([a, b, c]);
T.ok('Iki cagiran ayni sonucu alir', ra === 'A:1' && rb === 'A:1' && rc === 'B:2');
const d = fn('A');
T.ok('Bitince kayit silinir → sonraki cagri TAZE istek', cagri === 3);
bekleyen[2].coz(3);
T.ok('Taze sonuc', (await d) === 'A:3');

T.H('Hata');
const e1 = fn('E'); const e2 = fn('E');
bekleyen[3].red(new Error('ag'));
const hatalar = await Promise.allSettled([e1, e2]);
T.ok('Hata iki cagirana da iletilir', hatalar.every((h) => h.status === 'rejected' && h.reason.message === 'ag'));
const e3 = fn('E');
T.ok('Hatadan sonra kayit temiz → yeniden denenir', cagri === 5);
bekleyen[4].coz(9); await e3;

T.H('Baglanti');
T.ok('getMyProfile token anahtarli tek ucus', /getMyProfile = tekUcus\(\(token: string\) => token/.test(source('features/feed/services/profile.ts')));
T.ok('fetchKaymakGraph hedef anahtarli tek ucus', source('services/api/kaymakSocial.ts').includes("export const fetchKaymakGraph = tekUcus("));
T.bitir();
