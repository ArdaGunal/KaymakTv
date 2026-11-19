// Yerel HTTP testi. Calistir.js takimlari gibi tek surecte ve yardimci.js ile kosar.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { baslat, PROJE_KOKU } = require('../yardimci');

const T = baslat('WEB GUVENLIK BASLIKLARI (G-09)', { kokOneki: 'web-g09-' });
const HTML = '<!doctype html><title>Kaymak test</title>';
const JS = 'globalThis.kaymak = true;';
const headerValues = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'strict-transport-security': 'max-age=15552000',
};
const reportOnly = 'content-security-policy-report-only';
const csp = 'content-security-policy';

// Gercek server.js, gecici dist dizini ve sahte upstream'lerle calisir.
// Uretim dosyalarinin require cozumlemesi ve Express yonlendirmesi normal kalir.
const startScript = `
  const fs = require('node:fs');
  const { createRequire } = require('node:module');
  const { compileFunction } = require('node:vm');
  const entry = process.env.TEST_SERVER_ENTRY;
  const resolve = createRequire(entry);
  const axios = resolve('axios');
  const urls = new Map([
    ['https://api.themoviedb.org/3/tv/7', { id: 7, name: 'Fixture' }],
    ['https://api.trakt.tv/shows/trending', [{ watchers: 1, show: { title: 'Fixture' } }]],
  ]);
  axios.defaults.adapter = async (config) => {
    if (!urls.has(config.url)) throw new Error('Unexpected upstream: ' + config.url);
    return { data: urls.get(config.url), status: 200, headers: { 'cache-control': 'public, max-age=1200' }, config };
  };
  compileFunction(fs.readFileSync(entry, 'utf8'), ['require', '__dirname'], { filename: entry })(resolve, process.cwd());
`;

function waitForPort(child, errors) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => finish(new Error('Yerel sunucu dinlemeye baslamadi: ' + errors())), 10000);

    function finish(error, port) {
      clearTimeout(timeout);
      child.off('exit', exited);
      child.stdout.off('data', read);
      if (error) reject(error);
      else resolve(port);
    }
    function exited(code) {
      finish(new Error('Yerel sunucu kapandi: ' + code + ' ' + errors()));
    }
    function read(chunk) {
      output += chunk;
      const match = /Local URL: http:\/\/127\.0\.0\.1:(\d+)/.exec(output);
      if (match) finish(null, Number(match[1]));
    }

    child.once('exit', exited);
    child.once('error', finish);
    child.stdout.on('data', read);
  });
}

function checkWebHeaders(label, response, existingCsp = null) {
  for (const [name, value] of Object.entries(headerValues)) {
    T.ok(label + ' ' + name, response.headers.get(name) === value, response.headers.get(name));
  }
  T.ok(label + ' Report-Only ve mevcut CSP', response.headers.has(reportOnly) && response.headers.get(csp) === existingCsp);
}

function checkApiHeaders(label, response) {
  const browserHeaders = [...Object.keys(headerValues), reportOnly, csp];
  T.ok(label + ' HTML guvenlik basliklari yok', browserHeaders.every((header) => !response.headers.has(header)));
}

async function run() {
  fs.mkdirSync(path.join(T.kok, 'dist', '_expo'), { recursive: true });
  fs.mkdirSync(path.join(T.kok, 'server'));
  fs.writeFileSync(path.join(T.kok, 'dist', 'index.html'), HTML);
  fs.writeFileSync(path.join(T.kok, 'dist', '_expo', 'entry-test.js'), JS);
  fs.copyFileSync(path.join(PROJE_KOKU, 'server', 'assetlinks.json'), path.join(T.kok, 'server', 'assetlinks.json'));

  let stderr = '';
  const child = spawn(process.execPath, ['--no-warnings', '-e', startScript], {
    cwd: T.kok,
    env: {
      ...process.env,
      TEST_SERVER_ENTRY: path.join(PROJE_KOKU, 'server.js'),
      HOST: '127.0.0.1', PORT: '0', GECE_ISLERI: '0',
      LAZYFETCH_ROOT: path.join(T.kok, 'cache'), ARCHIVE_ROOT: path.join(T.kok, 'archive'),
      TRAKT_CLIENT_SECRET: 'test-only', EXPO_PUBLIC_TRAKT_CLIENT_ID: 'test-only', TMDB_API_KEY: 'test-only',
      EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_KAYMAK_WORKER_URL: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.resume();
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  try {
    const port = await waitForPort(child, () => stderr);
    const get = (urlPath, options) => fetch(`http://127.0.0.1:${port}${urlPath}`, {
      signal: AbortSignal.timeout(5000), ...options,
    });

    for (const urlPath of ['/', '/index.html', '/settings', '/download']) {
      const response = await get(urlPath);
      T.ok(urlPath + ' SPA HTML 200', response.status === 200 && await response.text() === HTML);
      T.ok(urlPath + ' no-store', response.headers.get('cache-control') === 'no-cache, no-store, must-revalidate');
      checkWebHeaders(urlPath, response);
    }

    const head = await get('/download', { method: 'HEAD' });
    T.ok('HEAD /download 200 ve bos govde', head.status === 200 && await head.text() === '');
    checkWebHeaders('HEAD /download', head);
    const policy = head.headers.get(reportOnly) || '';
    const directives = new Map(policy.split(';').map((part) => {
      const [key, ...values] = part.trim().split(/\s+/);
      return [key, values];
    }));
    for (const [name, sources] of Object.entries({
      'default-src': ["'self'"],
      'script-src': ["'self'", 'https://accounts.google.com/gsi/client'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://accounts.google.com/gsi/style'],
      'frame-src': ["'self'", 'https://accounts.google.com/gsi/'],
      'img-src': ['data:', 'https://image.tmdb.org', 'https://img.youtube.com', 'https://flagcdn.com'],
      'font-src': ["'self'"],
      'connect-src': [
        "'self'", 'https://kaymaktv.com', 'https://accounts.google.com/gsi/',
        'https://omgjrsgginbiwyndvlxo.supabase.co', 'wss://omgjrsgginbiwyndvlxo.supabase.co',
        'https://kaymaktv-feedback-worker.kaymaktv-feedback.workers.dev',
        'https://api.trakt.tv',
      ],
    })) {
      T.ok('CSP ' + name + ' kaynaklari', sources.every((source) => directives.get(name)?.includes(source)));
    }
    T.ok('CSP connect-src GitHub API izni yok', !directives.get('connect-src')?.includes('https://api.github.com'));

    const bundle = await get('/_expo/entry-test.js');
    T.ok('Statik JS MIME ve govde', bundle.status === 200 && /javascript/.test(bundle.headers.get('content-type')) && await bundle.text() === JS);
    T.ok('Statik cache immutable', bundle.headers.get('cache-control') === 'public, max-age=31536000, immutable');
    checkWebHeaders('Statik JS', bundle);
    const cached = await get('/_expo/entry-test.js', {
      cache: 'force-cache', headers: { 'If-None-Match': bundle.headers.get('etag') },
    });
    T.ok('Statik ETag ile 304', cached.status === 304, cached.status);
    checkWebHeaders('Statik 304', cached);
    const redirect = await get('/_expo', { redirect: 'manual' });
    T.ok('Statik dizin yonlendirmesi', redirect.status === 301 && redirect.headers.get('location') === '/_expo/');
    // serve-static kendi yonlendirme HTML'inde zaten bu CSP'yi gonderir.
    checkWebHeaders('Statik 301', redirect, "default-src 'none'");

    const assetlinks = await get('/.well-known/assetlinks.json');
    T.ok('App Links JSON ve cache', assetlinks.status === 200 && Array.isArray(await assetlinks.json())
      && assetlinks.headers.get('cache-control') === 'public, max-age=3600');
    checkWebHeaders('App Links', assetlinks);

    const tmdbPath = '/api/tmdb?endpoint=/tv/7';
    const tmdb = await get(tmdbPath, { headers: { Origin: 'https://kaymaktv.com' } });
    T.ok('TMDB JSON, CORS ve LazyFetch miss', tmdb.status === 200 && (await tmdb.json()).id === 7
      && tmdb.headers.get('access-control-allow-origin') === 'https://kaymaktv.com'
      && tmdb.headers.get('x-lazyfetch') === 'miss', tmdb.headers.get('x-lazyfetch'));
    checkApiHeaders('TMDB miss', tmdb);
    const tmdbHit = await get(tmdbPath);
    T.ok('TMDB LazyFetch fresh', tmdbHit.status === 200 && (await tmdbHit.json()).id === 7
      && tmdbHit.headers.get('x-lazyfetch') === 'fresh', tmdbHit.headers.get('x-lazyfetch'));
    checkApiHeaders('TMDB fresh', tmdbHit);

    const trakt = await get('/api/trakt-proxy?endpoint=/shows/trending');
    T.ok('Trakt proxy JSON ve LazyFetch miss', trakt.status === 200 && (await trakt.json())[0]?.watchers === 1
      && trakt.headers.get('x-lazyfetch') === 'miss', trakt.headers.get('x-lazyfetch'));
    checkApiHeaders('Trakt proxy', trakt);

    const missing = await get('/api/missing');
    T.ok('Eslesmeyen API JSON 404', missing.status === 404 && (await missing.json()).error === 'Not Found');
    checkApiHeaders('API 404', missing);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGKILL');
      await exited;
    }
  }
}

run().catch((error) => T.ok('Yerel HTTP testi tamamlandi', false, error.stack)).finally(() => T.bitir());
