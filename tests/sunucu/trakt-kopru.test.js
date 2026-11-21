// ==========================================================================
// Trakt köprüsü — Worker'ın Trakt oturum çağrıları Pi'den çıkar (plan §6.2)
// ==========================================================================
// 🔴 İDDİALAR: sır yoksa kapalı, yanlış sır reddedilir · yalnız beş işlem (cihaz kodu ikisi ayrı kovada), yol dışarıdan alınamaz ·
// istemci sırrı Pi'de eklenir · Trakt'ın durum kodu zarfla aynen döner · 1015 metni taşınır ·
// Trakt cevap vermezse status 0 · anahtar ve gövde log'a yazılmaz.
// Ağ YOK: axios bağdaştırıcısı sahte.

const path = require('path');
const http = require('http');
const { baslat } = require('../yardimci');

const T = baslat('TRAKT KOPRUSU', { kokOneki: 'trakt-kopru-' });

const KOK = path.join(__dirname, '..', '..');
const express = require(path.join(KOK, 'node_modules/express'));
const axios = require(path.join(KOK, 'node_modules/axios'));
const kopru = require(path.join(KOK, 'server/traktKopru'));
const { redirectUriGuard } = require(path.join(KOK, 'server/security'));
const traktYollariniBagla = require(path.join(KOK, 'server/traktProxyYollari'));

const SIR = 's'.repeat(32);
const ortam = { TRAKT_CLIENT_ID: 'cid', TRAKT_CLIENT_SECRET: 'gizli-sir' };
const pkce = {
  code: 'kod-1',
  redirect_uri: 'https://kaymaktv.com/settings',
  code_verifier: 'v'.repeat(43),
};
const pkceTokenUrl = 'https://auth.trakt.tv/oauth/token';
process.env.TRAKT_CLIENT_ID = 'cid';
process.env.TRAKT_CLIENT_SECRET = 'gizli-sir';

let sonIstek = null;
let sahteCevap = () => ({ status: 200, data: '{"access_token":"e"}' });
axios.defaults.adapter = async (config) => {
  sonIstek = config;
  const c = sahteCevap(config);
  return { ...c, statusText: '', headers: {}, config };
};

(async () => {
  // ── SAF ────────────────────────────────────────────────────────────────
  const a = kopru.istegiKur({ islem: 'ayarlar', erisim: 'e-1' }, ortam);
  T.ok('ayarlar: GET /users/settings, Bearer + api anahtarı', a.method === 'GET' && a.url === 'https://api.trakt.tv/users/settings' && a.headers.Authorization === 'Bearer e-1' && a.headers['trakt-api-key'] === 'cid');
  const t = kopru.istegiKur({ islem: 'token', grant_type: 'refresh_token', refresh_token: 'y', redirect_uri: 'r', url: 'https://evil.io', client_secret: 'sahte' }, ortam);
  T.ok('token: istemci sırrı Pi\'de eklenir, dışarıdan gelen ezilir, fazla alan atılır', t.data.client_secret === 'gizli-sir' && t.data.refresh_token === 'y' && t.data.url === undefined && t.url === 'https://api.trakt.tv/oauth/token');
  const r = kopru.istegiKur({ islem: 'iptal', token: 'e' }, ortam);
  T.ok('iptal: /oauth/revoke', r.url === 'https://api.trakt.tv/oauth/revoke' && r.data.token === 'e');
  T.ok('izin dışı işlem → null', kopru.istegiKur({ islem: 'sync', yol: '/sync/history' }, ortam) === null);
  T.ok('izin dışı grant → null', kopru.istegiKur({ islem: 'token', grant_type: 'password' }, ortam) === null);
  T.ok('anahtarsız ayarlar → null', kopru.istegiKur({ islem: 'ayarlar' }, ortam) === null);
  T.ok('sır yoksa token/iptal → null', kopru.istegiKur({ islem: 'iptal', token: 'e' }, { TRAKT_CLIENT_ID: 'cid' }) === null);

  // Cihaz kodu girişi (TRAKT_CIHAZ_KODU_PLANI §3.1)
  const ck = kopru.istegiKur({ islem: 'cihaz_kod', client_id: 'sahte', url: 'https://evil.io' }, ortam);
  T.ok('cihaz_kod: POST /oauth/device/code, yalnız sunucunun client_id değeri, sır GİTMEZ', ck.method === 'POST' && ck.url === 'https://api.trakt.tv/oauth/device/code' && ck.data.client_id === 'cid' && ck.data.client_secret === undefined && Object.keys(ck.data).length === 1);
  T.ok('cihaz_kod sırsız ortamda da kurulur', kopru.istegiKur({ islem: 'cihaz_kod' }, { TRAKT_CLIENT_ID: 'cid' }) !== null);
  const ct = kopru.istegiKur({ islem: 'cihaz_token', code: 'LS5b-x_Y', client_secret: 'sahte', grant_type: 'password' }, ortam);
  T.ok('cihaz_token: /oauth/device/token, sır sunucuda eklenir, fazla alan atılır', ct.url === 'https://api.trakt.tv/oauth/device/token' && ct.data.code === 'LS5b-x_Y' && ct.data.client_secret === 'gizli-sir' && ct.data.client_id === 'cid' && ct.data.grant_type === undefined);
  T.ok('cihaz_token kodsuz / string değil / 128 üstü → null', kopru.istegiKur({ islem: 'cihaz_token' }, ortam) === null && kopru.istegiKur({ islem: 'cihaz_token', code: 5 }, ortam) === null && kopru.istegiKur({ islem: 'cihaz_token', code: 'a'.repeat(129) }, ortam) === null);
  T.ok('cihaz_token sırsız → null', kopru.istegiKur({ islem: 'cihaz_token', code: 'k' }, { TRAKT_CLIENT_ID: 'cid' }) === null);
  T.ok('kova: cihaz işlemleri ayrı, diğerleri ortak', kopru.kovaAdi({ islem: 'cihaz_token' }) === 'worker-cihaz' && kopru.kovaAdi({ islem: 'cihaz_kod' }) === 'worker-cihaz' && kopru.kovaAdi({ islem: 'token' }) === 'worker' && kopru.kovaAdi(undefined) === 'worker');
  T.ok('beklenen cevap: yalnız cihaz_token 400/429 susturulur', kopru.beklenenCevap('cihaz_token', 400) && kopru.beklenenCevap('cihaz_token', 429) && !kopru.beklenenCevap('cihaz_token', 410) && !kopru.beklenenCevap('token', 400));

  // ── HTTP ───────────────────────────────────────────────────────────────
  const app = express();
  app.use(express.json());
  app.use('/k', kopru);
  traktYollariniBagla(app, { traktAuthLimiter: (_req, _res, next) => next(), redirectUriGuard });
  const sunucu = http.createServer(app);
  await new Promise((b) => sunucu.listen(0, '127.0.0.1', b));
  const adres = `http://127.0.0.1:${sunucu.address().port}`;
  const iste = async (govde, sir, yol = '/k') => {
    const res = await fetch(adres + yol, { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close', ...(sir ? { 'x-kaymak-sync-secret': sir } : {}) }, body: JSON.stringify(govde) });
    return { status: res.status, j: await res.json().catch(() => null) };
  };

  delete process.env.PI_SYNC_SECRET;
  T.ok('sır tanımsız → 503 kapalı', (await iste({ islem: 'ayarlar', erisim: 'e' }, SIR)).status === 503);
  process.env.PI_SYNC_SECRET = SIR;
  T.ok('yanlış sır → 401', (await iste({ islem: 'ayarlar', erisim: 'e' }, 'x'.repeat(32))).status === 401);
  sonIstek = null;
  T.ok('sırsız → 401, Trakt\'a gidilmez', (await iste({ islem: 'ayarlar', erisim: 'e' })).status === 401 && sonIstek === null);
  T.ok('geçersiz işlem → 400, zarf yok', (await iste({ islem: 'baska' }, SIR)).status === 400);

  T.H('G-10 · PKCE ve tam HTTPS dönüşü');
  const ekspresIstek = (govde) => iste(govde, undefined, '/api/trakt');
  const kopruIstek = (govde) => iste({ islem: 'token_pkce', ...govde }, SIR);
  for (const [adi, gonder] of [['Express /api/trakt', ekspresIstek], ['GNL köprüsü', kopruIstek]]) {
    sonIstek = null;
    const eski = await gonder({ ...pkce, redirect_uri: 'kaymak://settings' });
    T.ok(`${adi}: kaymak:// → 400, upstream yok`, eski.status === 400 && sonIstek === null);
    const diger = await gonder({ ...pkce, redirect_uri: 'https://kaymaktv.com/settings?x=1' });
    const eksikRedirect = await gonder({ ...pkce, redirect_uri: undefined });
    T.ok(`${adi}: farklı veya eksik callback → 400, upstream yok`, diger.status === 400 && eksikRedirect.status === 400 && sonIstek === null);
    const eksikVerifier = await gonder({ ...pkce, code_verifier: undefined });
    const bozukVerifier = await gonder({ ...pkce, code_verifier: 'yetersiz' });
    T.ok(`${adi}: eksik veya hatalı verifier → 400, upstream yok`, eksikVerifier.status === 400 && bozukVerifier.status === 400 && sonIstek === null);
    const izinli = await gonder({ ...pkce, client_secret: 'sahte' });
    const iletilen = JSON.parse(sonIstek?.data ?? '{}');
    T.ok(`${adi}: kayıtlı HTTPS ve verifier → 200; gövdede client_secret yok`, izinli.status === 200
      && sonIstek?.url === pkceTokenUrl && iletilen.code_verifier === pkce.code_verifier
      && iletilen.client_id === 'cid' && !Object.hasOwn(iletilen, 'client_secret'));
  }
  delete process.env.TRAKT_CLIENT_SECRET;
  T.ok('Sunucu sırrı tanımsızken de Express ve GNL PKCE değişimi çalışır',
    (await ekspresIstek(pkce)).status === 200 && (await kopruIstek(pkce)).j?.status === 200);

  const eskiIstek = { islem: 'token', grant_type: 'authorization_code', code: pkce.code, redirect_uri: pkce.redirect_uri };
  const yenilemeIstegi = { islem: 'token', grant_type: 'refresh_token', refresh_token: 'y' };
  sonIstek = null;
  T.ok('Eski değişim ve sunucu yenilemesi için sır gerekli, eksikse Trakt isteği yok',
    (await iste(eskiIstek, SIR)).status === 400 && (await iste(yenilemeIstegi, SIR)).status === 400 && sonIstek === null);
  process.env.TRAKT_CLIENT_SECRET = ortam.TRAKT_CLIENT_SECRET;
  sonIstek = null;
  T.ok('Eski Worker: özel şema, eksik callback ve eski işlemde verifier reddedilir',
    (await iste({ ...eskiIstek, redirect_uri: 'kaymak://settings' }, SIR)).status === 400
    && (await iste({ ...eskiIstek, redirect_uri: undefined }, SIR)).status === 400
    && (await iste({ ...eskiIstek, code_verifier: pkce.code_verifier }, SIR)).status === 400 && sonIstek === null);
  const eskiKopru = await iste({ ...eskiIstek, client_secret: 'sahte' }, SIR);
  const eskiGovde = JSON.parse(sonIstek?.data ?? '{}');
  T.ok('Eski Worker: kayıtlı HTTPS ve verifier olmadan sırlı kod değişimi çalışır',
    eskiKopru.status === 200 && eskiKopru.j.status === 200 && sonIstek?.url === 'https://api.trakt.tv/oauth/token'
    && eskiGovde.code === pkce.code && eskiGovde.redirect_uri === pkce.redirect_uri
    && eskiGovde.grant_type === 'authorization_code' && eskiGovde.client_id === 'cid'
    && eskiGovde.client_secret === 'gizli-sir' && eskiGovde.code_verifier === undefined);

  sonIstek = null;
  const oob = 'urn:ietf:wg:oauth:2.0:oob';
  T.ok('Express OAuth yenileme ve OOB isteklerini Trakt’a göndermeden reddeder',
    (await ekspresIstek({ ...pkce, redirect_uri: oob })).status === 400
    && (await ekspresIstek({ refresh_token: 'y', redirect_uri: oob })).status === 400
    && (await ekspresIstek({ refresh_token: 'y', redirect_uri: pkce.redirect_uri })).status === 400
    && (await ekspresIstek({ ...pkce, refresh_token: 'y' })).status === 400 && sonIstek === null);

  const tamam = await iste(yenilemeIstegi, SIR);
  T.ok('200: zarf + çözülmüş veri', tamam.status === 200 && tamam.j.ok === true && tamam.j.status === 200 && tamam.j.veri.access_token === 'e');

  sahteCevap = () => ({ status: 400, data: '{"error":"invalid_grant"}' });
  const red = await iste({ islem: 'token', grant_type: 'refresh_token', refresh_token: 'y' }, SIR);
  T.ok('Trakt 400 invalid_grant zarfla AYNEN döner', red.status === 200 && red.j.status === 400 && red.j.veri.error === 'invalid_grant');

  sahteCevap = () => ({ status: 429, data: 'error code: 1015' });
  const sinir = await iste({ islem: 'ayarlar', erisim: 'e' }, SIR);
  T.ok('1015: JSON değil, metin taşınır', sinir.j.status === 429 && sinir.j.veri === null && sinir.j.metin === 'error code: 1015');

  const eskiUyar = console.warn;
  const yazilanlar = [];
  console.warn = (...x) => yazilanlar.push(x.join(' '));
  sahteCevap = () => { const e = new Error('zaman'); e.code = 'ETIMEDOUT'; throw e; };
  const yok = await iste({ islem: 'token', grant_type: 'refresh_token', refresh_token: 'GIZLI-YENILEME' }, SIR);
  sahteCevap = () => ({ status: 401, data: '{}' });
  await iste({ islem: 'ayarlar', erisim: 'GIZLI-ERISIM' }, SIR);
  // Trakt bekleyen kodu BOŞ gövdeli 400 ile döner (ölçüldü 2026-11-14): zarf aynen taşır, log'a yazılmaz.
  sahteCevap = () => ({ status: 400, data: '' });
  const bekliyor = await iste({ islem: 'cihaz_token', code: 'GIZLI-CIHAZ' }, SIR);
  console.warn = eskiUyar;
  T.ok('cihaz_token 400 boş gövde → zarf status 400, veri null', bekliyor.status === 200 && bekliyor.j.status === 400 && bekliyor.j.veri === null);
  T.ok('Trakt cevap vermedi → zarf status 0 (belirsiz)', yok.status === 200 && yok.j.ok === true && yok.j.status === 0);
  T.ok('anahtar log\'a yazılmaz; yalnız işlem + durum', yazilanlar.length === 2 && !yazilanlar.join(' ').includes('GIZLI') && yazilanlar[1].includes('ayarlar') && yazilanlar[1].includes('401'));

  sunucu.closeAllConnections();
  await new Promise((b) => sunucu.close(b));
  // Windows: açık zamanlayıcı/bağlantı varken process.exit libuv'u düşürür; bir tur bekle.
  await new Promise((b) => setTimeout(b, 50));
  T.bitir();
})().catch((e) => { console.error(e); process.exit(1); });
