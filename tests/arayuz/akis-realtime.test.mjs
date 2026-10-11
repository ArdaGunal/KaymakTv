import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// A-4 (M489): Worker /feed/sync bir kullanıcının 50 izlemesini TEK INSERT ile yazabiliyor →
// takipçide 50 Realtime olayı. Eskiden 50 ayrı fetchActivityById; artık toplanıp tek sorgu.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('AKIS REALTIME TOPLU TAMAMLAMA (A-4)', { kokOneki: 'akis-realtime-' });
const oku = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const { toplayiciKur } = tsLoader(root)('features/feed/utils/realtimeToplayici.ts');
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

let partiler = [];
let t = toplayiciKur((p) => { partiler.push(p); }, 30, 50);
for (let i = 0; i < 40; i++) t.ekle(`id${i}`);
T.ok('Pencere dolmadan istek atilmaz', partiler.length === 0);
await bekle(60);
T.ok('40 olaylik patlama TEK partide (eskiden 40 istek)', partiler.length === 1 && partiler[0].length === 40);

partiler = [];
t.ekle('a'); t.ekle('a'); t.ekle('b');
await bekle(60);
T.ok('Ayni id iki kez gelirse tek kez sorulur', JSON.stringify(partiler) === '[["a","b"]]');

partiler = [];
for (let i = 0; i < 120; i++) t.ekle(`x${i}`);
await bekle(60);
T.ok('Tavan 50: 120 olay 50+50+20 parcada (URL sismez)', partiler.map((p) => p.length).join(',') === '50,50,20');

partiler = [];
t.ekle('kapanis'); t.iptal();
await bekle(60);
T.ok('Abonelik kapaninca bekleyen islenmez', partiler.length === 0);

partiler = [];
t.ekle('tek');
await bekle(60);
T.ok('Tek olay da pencere sonunda gelir (gecikme <= pencere)', JSON.stringify(partiler) === '[["tek"]]');

// Kaynak: hook INSERT'te tekil sorgu atmıyor, toplu sorgu ve temizlik bağlı
const hook = oku('features/feed/hooks/useFeedRealtime.ts');
const insertBlok = hook.slice(hook.indexOf("event: 'INSERT'"), hook.indexOf("event: 'UPDATE'"));
T.ok('INSERT yolunda tekil fetchActivityById YOK, toplayici.ekle VAR', !/fetchActivityById/.test(insertBlok) && /toplayici\.ekle\(row\.id\)/.test(insertBlok));
T.ok('Parti tek fetchActivitiesByIds ile tamamlanir, kimlik bir kez cozulur', /fetchActivitiesByIds\(ids\)/.test(hook) && /Promise\.all\(\[\s*fetchActivitiesByIds/.test(hook));
T.ok('Kapanista toplayici.iptal()', /cancelled = true;\s*toplayici\.iptal\(\);/.test(hook));
const api = oku('features/feed/services/feedApi.ts');
T.ok('Toplu sorgu ayni gorunurluk kilidiyle (in_feed=true)', /\.in\('id', ids\)\s*\.eq\('in_feed', true\)/.test(api));

// B-4 (M489): beğeni/yorum iyimserliği — geri alma GÖRELİ, yorum beğenisinde uçuş kilidi
const eylem = oku('features/feed/hooks/useActivityActions.tsx');
T.ok('Kart begenisi hatada GORELI geri alinir (Realtime kesin sayisi ezilmez)',
  /const simdiki = useFeedStore\.getState\(\)\.activities\.find\(\(a\) => a\.id === activity\.id\)\?\.likeCount \?\? iyimser;/.test(eylem)
  && /likeCount: Math\.max\(0, simdiki - fark\)/.test(eylem) && !/patch\(onceki\)/.test(eylem));
T.ok('Kart begenisi ucus kilidi korunuyor (isLiking)', /isLiking \|\| !isInteractive\) return;/.test(eylem));
const yorum = oku('features/feed/hooks/useFeedComments.ts');
T.ok('Yorum begenisinde yorum basina ucus kilidi + finally ile acilir',
  /if \(begeniUcusta\.current\.has\(commentId\)\) return;/.test(yorum) && /finally \{\s*begeniUcusta\.current\.delete\(commentId\);/.test(yorum));
T.ok('Yorum silme hatasinda sayac KESIN (liste uzunlugu) geri alinir',
  /commentCount: previous\.length/.test(yorum) && !/commentCount: current\.commentCount \}/.test(yorum));
T.bitir();
