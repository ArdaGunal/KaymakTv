import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import worker from '../src/index.mjs';

const SITE = 'https://kaymaktv.com';
const AFIS = '/api/paylasim/afis/' + '1'.repeat(64) + '.jpg';

function kur(t, ozet) {
  const yazilan = new Map();
  const istekler = [];
  const bekleyen = [];
  t.mock.method(globalThis, 'fetch', async (girdi, secenek) => {
    const url = new URL(girdi.url ?? girdi);
    istekler.push({ url, girdi, secenek });
    if (url.pathname === '/api/paylasim/ozet') {
      if (typeof ozet === 'function') return ozet();
      return Response.json(ozet);
    }
    if (url.pathname.endsWith('/css')) return new Response('body {}', { headers: { 'Content-Type': 'text/css' } });
    return new Response('<html><head><meta property="og:title" content="eski"><title>SPA</title></head><body>Uygulama</body></html>', {
      headers: { 'Content-Type': 'text/html', ETag: '"orijinal"', 'Set-Cookie': 'test=1' },
    });
  });
  t.after(() => { delete globalThis.caches; delete globalThis.HTMLRewriter; });
  globalThis.caches = { async open() {
    return {
      async match(istek) { return yazilan.get(istek.url)?.clone(); },
      async put(istek, yanit) { yazilan.set(istek.url, yanit); },
    };
  } };
  globalThis.HTMLRewriter = class {
    isleyiciler = new Map();
    on(secici, duyucu) {
      this.isleyiciler.set(secici, duyucu);
      return this;
    }
    transform(yanit) {
      const baslik = this.isleyiciler.get('head');
      const meta = this.isleyiciler.get('head meta');
      const akis = yanit.body.pipeThrough(new TextDecoderStream()).pipeThrough(new TransformStream({
        transform(html, controller) {
          let eskiKaldirildi = false;
          meta.element({
            getAttribute: (ad) => ad === 'property' ? 'og:title' : null,
            remove: () => { eskiKaldirildi = true; },
          });
          if (eskiKaldirildi) html = html.replace('<meta property="og:title" content="eski">', '');
          baslik.element({ prepend: (etiketler) => { html = html.replace('<head>', '<head>' + etiketler); } });
          controller.enqueue(html);
        },
      })).pipeThrough(new TextEncoderStream());
      return new Response(akis, yanit);
    }
  };
  return {
    istekler, yazilan,
    async ac(yol, secenek = {}, env = { OG_ORIGIN_KEY: 'test-key' }) {
      const yanit = await worker.fetch(new Request(SITE + yol, secenek), env, { waitUntil: (is) => bekleyen.push(is) });
      const html = await yanit.text();
      await Promise.all(bekleyen.splice(0));
      return { yanit, html };
    },
  };
}

test('e237 OG rotaları paylaşılabilir yollarla sınırlı', async () => {
  const ayar = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.match(ayar.account_id, /^e237/);
  assert.equal(ayar.name, 'kaymaktv-og');
  assert.equal(ayar.workers_dev, false);
  assert.equal(ayar.preview_urls, false);
  assert.deepEqual(ayar.routes.map(r => r.pattern), ['show', 'movie', 'episode', 'activity', 'u'].map(tur => `kaymaktv.com/${tur}/*`));
});

test('eski URL kanonik sezon anahtarına döner, dil ve cache doğru, SPA ve etiketler sağlam', async (t) => {
  const sistem = kur(t, { baslik: 'Dizi "A" <b>&', aciklama: '3. sezon', gorsel: AFIS });
  const { html, yanit } = await sistem.ac('/show/1390-dizi?tmdbId=22&season=3', {
    headers: { 'Accept-Language': 'tr-TR,en;q=0.8', 'If-None-Match': '"eski"', Cookie: 'test=1' },
  });
  assert.match(html, /Dizi &quot;A&quot; &lt;b&gt;&amp;/);
  assert.match(html, /og:url" content="https:\/\/kaymaktv\.com\/show\/1390\?season=3"/);
  assert.match(html, /og:image:width" content="360"/);
  assert.match(html, /og:image:height" content="360"/);
  assert.match(html, /name="twitter:card" content="summary"/);
  assert.ok(html.includes(SITE + AFIS));
  assert.ok(html.includes('<title>SPA</title></head><body>Uygulama'));
  assert.equal((html.match(/property="og:title"/g) ?? []).length, 1);
  assert.equal(yanit.headers.get('etag'), null);
  assert.equal(yanit.headers.get('set-cookie'), 'test=1');
  assert.equal(yanit.headers.get('cache-control'), 'private, no-store');

  const [origin, meta] = sistem.istekler;
  assert.equal(origin.girdi.headers.get('if-none-match'), null);
  assert.equal(meta.url.searchParams.get('url'), SITE + '/show/1390?season=3');
  assert.equal(meta.url.searchParams.get('dil'), 'tr');
  assert.equal(meta.secenek.headers['X-Kaymak-OG-Key'], 'test-key');
  assert.equal(meta.secenek.redirect, 'manual');
  assert.equal(meta.secenek.headers.Cookie, undefined);
  const cache = [...sistem.yazilan.values()][0];
  assert.equal(cache.headers.get('cache-control'), 'public, max-age=3600');
  await sistem.ac('/show/1390?season=3', { headers: { 'Accept-Language': 'tr' } });
  assert.equal(sistem.istekler.filter(({ url }) => url.pathname === '/api/paylasim/ozet').length, 1);
  await sistem.ac('/show/1390?season=3', { headers: { 'Accept-Language': 'en' } });
  await sistem.ac('/show/1390?season=4', { headers: { 'Accept-Language': 'tr' } });
  assert.equal(sistem.istekler.filter(({ url }) => url.pathname === '/api/paylasim/ozet').length, 3);
});

test('profil, akış ve eşleşmeyen yollar özet isteği başlatmaz', async (t) => {
  const sistem = kur(t, () => assert.fail('Bu rotalar katalogdan okumamalı'));
  for (const yol of ['/u/10337897', '/activity/12345678-1234-4abc-8def-abcdef123456']) {
    const { html } = await sistem.ac(yol);
    assert.match(html, /og:title" content="KaymakTV"/);
    assert.match(html, /kaymaktv-360\.jpg/);
  }
  for (const [yol, secenek] of [['/settings'], ['/show/hatalı'], ['/show/1390', { method: 'HEAD' }], ['/show/css']]) {
    const { html } = await sistem.ac(yol, secenek);
    assert.doesNotMatch(html, /name="twitter:card"/);
  }
  assert.equal(sistem.istekler.length, 6);
  assert.equal(sistem.yazilan.size, 0);
});

test('özet hataları genel karta döner ve kişiselleştirilmiş HTML önbelleğe alınmaz', async (t) => {
  const sistem = kur(t, () => { throw new DOMException('Zaman doldu', 'TimeoutError'); });
  const { html } = await sistem.ac('/movie/12');
  assert.match(html, /og:title" content="KaymakTV"/);
  assert.match(html, /kaymaktv-360\.jpg/);
  assert.equal(sistem.yazilan.size, 0);
});

test('harici görsel reddedilir, katalog başlığı genel kareyle gösterilir', async (t) => {
  const sistem = kur(t, { baslik: 'Film', gorsel: 'https://example.org/afis.jpg' });
  const { html } = await sistem.ac('/movie/12');
  assert.match(html, /og:title" content="Film"/);
  assert.match(html, /kaymaktv-360\.jpg/);
  assert.doesNotMatch(html, /example\.org/);
  assert.equal([...sistem.yazilan.values()][0].headers.get('cache-control'), 'public, max-age=30');
});
