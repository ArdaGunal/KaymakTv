import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// M467 · Her işaretleme yolu akışa TEK temsilci izleme olayı yayınlar.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('SEZON CIFT TIKI AKISA DUSER (M467 / A8)', { kokOneki: 'sezon-akis-' });
const { temsilciBolum } = tsLoader(root)('services/library/outbox/types.ts');
const src = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const esit = (a, b) => JSON.stringify(a) === JSON.stringify(b);

T.H('Eski yollar aynen');
T.ok('Tekil bolum: acik activity korunur', esit(temsilciBolum({ mediaType: 'show', parts: [{ season: 1, episodes: [6] }], activity: { season: 1, episode: 6 } }), { season: 1, episode: 6 }));
T.ok('Oncekileri isaretle: tiklanan bolum (activity) korunur, en buyuk degil',
  esit(temsilciBolum({ mediaType: 'show', parts: [{ season: 1, episodes: [1, 2] }, { season: 4, episodes: [1, 2, 3] }], activity: { season: 4, episode: 3 } }), { season: 4, episode: 3 }));

T.H('Sezon cift tiki (activity yok)');
T.ok('En buyuk bolum secilir', esit(temsilciBolum({ mediaType: 'show', parts: [{ season: 2, episodes: [3, 12, 7] }] }), { season: 2, episode: 12 }));
T.ok('Birden cok parcada en buyuk sezon', esit(temsilciBolum({ mediaType: 'show', parts: [{ season: 3, episodes: [9] }, { season: 1, episodes: [20] }] }), { season: 3, episode: 9 }));
T.ok('Ozel sezon (0) temsilci olamaz', temsilciBolum({ mediaType: 'show', parts: [{ season: 0, episodes: [1, 2] }] }) === null);
T.ok("Genisletilmemis '*' temsilci olamaz", temsilciBolum({ mediaType: 'show', parts: [{ season: 1, episodes: '*' }] }) === null);
T.ok('Film icin bolum yok', temsilciBolum({ mediaType: 'movie', parts: [{}] }) === null);

T.H('Baglanti');
const tr = src('services/library/outbox/transport.ts');
T.ok('publishWatched temsilciBolum kullaniyor', tr.includes('const bolum = temsilciBolum(job);') && !tr.includes("(job.mediaType === 'show' && !job.activity)"));
T.ok('Motor yayindan ONCE bizim yazmalari bitiriyor ('*' genisletilmis olur)',
  src('services/library/outbox/engine.ts').indexOf('ports.expand') < src('services/library/outbox/engine.ts').indexOf('ports.publish'));
T.bitir();
