import { paylasimUrl, paylasimUrlAyristir } from '../../../utils/paylasimUrl.ts';
import { katalogMetasiniDogrula, ogEkle } from './og.mjs';

const OZET_YOLU = 'https://kaymaktv.com/api/paylasim/ozet';

async function katalogMetasi(kanonik, dil, env, ctx) {
  if (!env.OG_ORIGIN_KEY) return null;
  const ozetUrl = new URL(OZET_YOLU);
  ozetUrl.searchParams.set('url', kanonik);
  ozetUrl.searchParams.set('dil', dil);
  const onbellekAnahtari = new Request(ozetUrl);

  try {
    const onbellek = await caches.open('kaymaktv-og-ozet-v1');
    const kayit = await onbellek.match(onbellekAnahtari);
    if (kayit) return katalogMetasiniDogrula(await kayit.json());

    const yanit = await fetch(ozetUrl, {
      headers: { 'X-Kaymak-OG-Key': env.OG_ORIGIN_KEY, Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(3200),
    });
    if (!yanit.ok || !yanit.headers.get('content-type')?.startsWith('application/json')) {
      await yanit.body?.cancel();
      return null;
    }
    const meta = katalogMetasiniDogrula(await yanit.json());
    if (!meta) return null;
    const ttl = meta.gorsel ? 3600 : 30;
    ctx.waitUntil(onbellek.put(onbellekAnahtari, Response.json(meta, {
      headers: { 'Cache-Control': `public, max-age=${ttl}` },
    })).catch(() => {}));
    return meta;
  } catch {
    return null;
  }
}

export default {
  async fetch(istek, env, ctx) {
    const hedef = istek.method === 'GET' && istek.url.length <= 400
      ? paylasimUrlAyristir(istek.url)
      : null;
    const origin = new Request(istek, { redirect: 'manual' });
    if (!hedef) return fetch(origin);

    for (const ad of ['if-none-match', 'if-modified-since', 'if-range', 'range']) origin.headers.delete(ad);
    const yanit = await fetch(origin);
    if (yanit.status !== 200 || !yanit.headers.get('content-type')?.startsWith('text/html')) return yanit;

    const kanonik = paylasimUrl(hedef);
    const ilkDil = istek.headers.get('Accept-Language')?.split(/[,;-]/, 1)[0].trim().toLowerCase();
    const dil = ilkDil === 'tr' ? 'tr' : 'en';
    const meta = hedef.tur === 'u' || hedef.tur === 'activity'
      ? null
      : await katalogMetasi(kanonik, dil, env, ctx);
    return ogEkle(yanit, kanonik, dil, meta);
  },
};
