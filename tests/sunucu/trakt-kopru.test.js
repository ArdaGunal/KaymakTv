// ==========================================================================
// Trakt köprüsü — Worker'ın Trakt oturum çağrıları Pi'den çıkar (plan §6.2)
// ==========================================================================
// 🔴 İDDİALAR: sır yoksa kapalı, yanlış sır reddedilir · yalnız üç işlem, yol dışarıdan alınamaz ·
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

const SIR = 's'.repeat(32);
const ortam = { TRAKT_CLIENT_ID: 'cid', TRAKT_CLIENT_SECRET: 'gizli-sir' };
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

  // ── HTTP ───────────────────────────────────────────────────────────────
  const app = express();
  app.use(express.json());
  app.use('/k', kopru);
  const sunucu = http.createServer(app);
  await new Promise((b) => sunucu.listen(0, '127.0.0.1', b));
  const adres = `http://127.0.0.1:${sunucu.address().port}/k`;
  const iste = async (govde, sir) => {
    const res = await fetch(adres, { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close', ...(sir ? { 'x-kaymak-sync-secret': sir } : {}) }, body: JSON.stringify(govde) });
    return { status: res.status, j: await res.json().catch(() => null) };
  };

  delete process.env.PI_SYNC_SECRET;
  T.ok('sır tanımsız → 503 kapalı', (await iste({ islem: 'ayarlar', erisim: 'e' }, SIR)).status === 503);
  process.env.PI_SYNC_SECRET = SIR;
  T.ok('yanlış sır → 401', (await iste({ islem: 'ayarlar', erisim: 'e' }, 'x'.repeat(32))).status === 401);
  sonIstek = null;
  T.ok('sırsız → 401, Trakt\'a gidilmez', (await iste({ islem: 'ayarlar', erisim: 'e' })).status === 401 && sonIstek === null);
  T.ok('geçersiz işlem → 400, zarf yok', (await iste({ islem: 'baska' }, SIR)).status === 400);

  const tamam = await iste({ islem: 'token', grant_type: 'refresh_token', refresh_token: 'y' }, SIR);
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
  console.warn = eskiUyar;
  T.ok('Trakt cevap vermedi → zarf status 0 (belirsiz)', yok.status === 200 && yok.j.ok === true && yok.j.status === 0);
  T.ok('anahtar log\'a yazılmaz; yalnız işlem + durum', yazilanlar.length === 2 && !yazilanlar.join(' ').includes('GIZLI') && yazilanlar[1].includes('ayarlar') && yazilanlar[1].includes('401'));

  sunucu.closeAllConnections();
  await new Promise((b) => sunucu.close(b));
  // Windows: açık zamanlayıcı/bağlantı varken process.exit libuv'u düşürür; bir tur bekle.
  await new Promise((b) => setTimeout(b, 50));
  T.bitir();
})().catch((e) => { console.error(e); process.exit(1); });
