import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// M476 · Gönderi yayınının kararlılığı (C2 cihaz testinde bulundu, 2026-10-10).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const T = yardimci.baslat('AKIS YAYIN KARARLILIGI (M476)', { kokOneki: 'akis-yayin-' });
const load = tsLoader(root, { zustand: require('zustand') });
const { useFeedStore } = load('features/feed/store/feedStore.ts');
const { formatRelativeTime } = load('utils/formatRelativeTime.ts');
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const st = useFeedStore.getState;
const a = (id, ek = {}) => ({ id, user: { id: 'ben' }, activityType: 'posted', activityAt: '2026-10-10T10:00:00.000Z', likeCount: 0, commentCount: 0, ...ek });

// Store: iyimser kart gerçek id ile yerleşir; gerçek önce geldiyse kopya kalmaz.
st().setFirstPage({ items: [], hasMore: false, nextCursor: null });
st().upsertActivity(a('temp-posted--1', { isPending: true }), false);
st().replaceActivity('temp-posted--1', a('gercek-1'));
T.ok('Iyimser kart gercek satirla degisir', JSON.stringify(st().activities.map((x) => x.id)) === '["gercek-1"]');
st().upsertActivity(a('temp-posted--2', { isPending: true }), false);
st().upsertActivity(a('gercek-2'), false); // Realtime yankısı önce geldi
st().replaceActivity('temp-posted--2', a('gercek-2'));
T.ok('Yanki once geldiyse gecici kart yalniz duser (kopya yok)', st().activities.filter((x) => x.id === 'gercek-2').length === 1 && !st().activities.some((x) => x.id === 'temp-posted--2'));

// Gelecek damga (saat kayması) → «şimdi», «-1 days ago» değil.
const t = (k) => ({ 'common:justNow': 'Just now' }[k] ?? k);
T.ok('Birkac saniye ileri damga = Just now', formatRelativeTime(new Date(Date.now() + 4000).toISOString(), t) === 'Just now');

// Kaynak bağlantıları.
const yayin = oku('features/feed/services/feedPublish.ts');
T.ok('Gonderi damgasi sunucuya gidiyor', /showTitle: input\.show\?\.showTitle,[\s\S]{0,400}activityAt,\s*\n\s*\},/.test(yayin));
T.ok('Basarida gercek id ile yerlestiriliyor', /settleOptimistic\(optimistic\.id, response\.data\?\.activity\?\.id\)/.test(yayin));
T.ok('Realtime: kendi etkinligim rozete sayilmaz', /upsertActivity\(activity, activity\.user\.id !== myId\)/.test(oku('features/feed/hooks/useFeedRealtime.ts')));
const yorum = oku('features/feed/hooks/useFeedComments.ts');
T.ok('Yorum sayaci KESIN deger (+1 yarisi yok)', /commentCount: count/.test(yorum) && !/commentCount \?\? 0\) \+ 1/.test(yorum));
const worker = path.join(root, '../kaymaktv-feedback-worker/src/routes/feedPost.js');
if (fs.existsSync(worker)) {
  const w = fs.readFileSync(worker, 'utf8');
  T.ok('Worker /feed/post hala activity.id donduruyor ve activityAt kabul ediyor', /activity: \{ id: inserted\.id/.test(w) && /resolveClientStamp\(body\.activityAt\)/.test(w));
}
// C37 (M489): var olan hesaba Google ile giriste ad/foto yerelde yoktu → iyimser kart
// «Kaymak Kullanicisi», gonderi kutusu «?». AuthContext sunucudan tamamlar; yedek ad onbelleklenmez.
const auth = fs.readFileSync(path.join(root, 'context/AuthContext.tsx'), 'utf8');
T.ok('Google oturumunda yerel ad/foto yoksa sunucudan tamamlanir (acilis + giris)',
  /providerRaw === 'google' && \(!usernameRaw \|\| !avatarUrlRaw\)\) yerelProfiliTamamla\(token\)/.test(auth)
  && /if \(!profile\?\.username\) yerelProfiliTamamla\(sessionToken\)/.test(auth));
const yayinSrv = fs.readFileSync(path.join(root, 'features/feed/services/feedPublish.ts'), 'utf8');
T.ok('Yedek ad oturum boyunca onbelleklenmez', /if \(username\) cachedMe = me;/.test(yayinSrv));
const feedSatir = fs.readFileSync(path.join(root, 'features/feed/hooks/useFeed.ts'), 'utf8').split(String.fromCharCode(10)).length;
T.ok(`useFeed.ts 400 satir altinda (${feedSatir})`, feedSatir < 400);
T.bitir();
