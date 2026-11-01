// ==========================================================================
// POST /api/trakt-kopru — Worker'ın Trakt oturum çağrıları için Pi köprüsü
// ==========================================================================
// TEK ÇAĞIRANI Worker (`kaymaktv-feedback-worker/src/lib/traktKopru.js`).
// NEDEN: Trakt, Worker'ın paylaşımlı Cloudflare çıkış IP'sini `429 error code: 1015` ile sınırlıyor
// (M504; canlı tail 2026-11-01). Pi'nin kendi IP'si var. Plan: docs/design/TRAKT_KASA_PLANI.md §6.2.
//
// 🔒 GÜVENLİK (`katalogCek.js` deseni):
//   1. SIR: `x-kaymak-sync-secret` = `PI_SYNC_SECRET`, sabit zamanlı. Sır yoksa/kısaysa uç KAPALI (503).
//   2. KENDİ SINIRLAYICISI: Worker'dan gelen bütün istekler tek kovada.
//   3. Girdi dar: yalnız üç işlem; yol ve sorgu dışarıdan ALINMAZ. Açık vekil DEĞİL.
//   4. Anahtar, kod ve gövde LOG'A YAZILMAZ; yalnız işlem + Trakt durum kodu.
//
// ZARF: Trakt'a gidildiyse cevap her zaman HTTP 200 `{ ok: true, status, veri, metin }`. Worker bununla
// «Pi Trakt'a gitti» ile «Pi'ye ulaşılamadı»yı ayırır: yenileme anahtarı tek kullanımlık olduğu için
// yedek yola yalnız Trakt'a kesin GİDİLMEDİYSE geçilir. `status: 0` = Trakt'tan cevap alınamadı (belirsiz).

const crypto = require('crypto');
const express = require('express');
const axios = require('axios');
const { rateLimit } = require('express-rate-limit');

const DAKIKA_SINIRI = 600;
// Worker'ın Pi'yi bekleme süresinden (10 sn) KISA: Trakt yanıt vermezse Worker zarfı yine alabilsin.
const TRAKT_ZAMAN_ASIMI_MS = 8000;
const TOKEN_ALANLARI = ['grant_type', 'code', 'refresh_token', 'redirect_uri'];
const IZINLI_GRANT = new Set(['authorization_code', 'refresh_token']);

const router = express.Router();

const sinirlayici = rateLimit({
  windowMs: 60 * 1000,
  limit: DAKIKA_SINIRI,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: () => 'worker',
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  message: { ok: false, durum: 'oran_siniri' },
});

function sirDogru(gelen) {
  const beklenen = process.env.PI_SYNC_SECRET || '';
  if (beklenen.length < 32 || typeof gelen !== 'string') return false;
  const a = Buffer.from(gelen);
  const b = Buffer.from(beklenen);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** SAF — gövdeyi Trakt isteğine çevirir; izin dışı her şey `null`. `ortam` = process.env. */
function istegiKur(govde, ortam) {
  const clientId = ortam.TRAKT_CLIENT_ID || ortam.EXPO_PUBLIC_TRAKT_CLIENT_ID;
  const baslik = { 'Content-Type': 'application/json', 'User-Agent': 'KaymakTV-Pi/1.0' };
  if (!clientId || !govde || typeof govde !== 'object') return null;

  if (govde.islem === 'ayarlar') {
    if (typeof govde.erisim !== 'string' || !govde.erisim) return null;
    return {
      method: 'GET',
      url: 'https://api.trakt.tv/users/settings',
      headers: { ...baslik, 'trakt-api-version': '2', 'trakt-api-key': clientId, Authorization: `Bearer ${govde.erisim}` },
    };
  }

  const sir = ortam.TRAKT_CLIENT_SECRET;
  if (!sir) return null;
  const istemci = { client_id: clientId, client_secret: sir };

  if (govde.islem === 'iptal') {
    if (typeof govde.token !== 'string' || !govde.token) return null;
    return { method: 'POST', url: 'https://api.trakt.tv/oauth/revoke', headers: baslik, data: { token: govde.token, ...istemci } };
  }
  if (govde.islem === 'token') {
    if (!IZINLI_GRANT.has(govde.grant_type)) return null;
    const veri = {};
    for (const alan of TOKEN_ALANLARI) if (typeof govde[alan] === 'string') veri[alan] = govde[alan];
    return { method: 'POST', url: 'https://api.trakt.tv/oauth/token', headers: baslik, data: { ...veri, ...istemci } };
  }
  return null;
}

router.post('/', (req, res, next) => {
  // Sır kontrolü SINIRLAYICIDAN ÖNCE: sırsız istek kovayı tüketemesin.
  if ((process.env.PI_SYNC_SECRET || '').length < 32) return res.status(503).json({ ok: false, durum: 'kapali' });
  if (!sirDogru(req.get('x-kaymak-sync-secret'))) return res.status(401).json({ ok: false, durum: 'yetkisiz' });
  return next();
}, sinirlayici, async (req, res) => {
  const istek = istegiKur(req.body, process.env);
  if (!istek) return res.status(400).json({ ok: false, durum: 'gecersiz' });
  try {
    const cevap = await axios.request({
      ...istek,
      timeout: TRAKT_ZAMAN_ASIMI_MS,
      signal: AbortSignal.timeout(TRAKT_ZAMAN_ASIMI_MS),
      validateStatus: () => true,
      responseType: 'text',
      transformResponse: [(ham) => ham],
    });
    if (cevap.status >= 400) console.warn(`[trakt-kopru] ${req.body.islem} -> Trakt ${cevap.status}`);
    let veri = null;
    try {
      veri = JSON.parse(cevap.data);
    } catch {
      // JSON değil (ör. `error code: 1015`) → aşağıda `metin` taşır
    }
    return res.json({ ok: true, status: cevap.status, veri, metin: veri === null ? String(cevap.data ?? '').slice(0, 60) : null });
  } catch (error) {
    console.warn(`[trakt-kopru] ${req.body.islem} -> Trakt'tan cevap yok: ${error?.code || error?.name || 'hata'}`);
    return res.json({ ok: true, status: 0, veri: null, metin: null });
  }
});

module.exports = router;
module.exports.istegiKur = istegiKur;
module.exports.DAKIKA_SINIRI = DAKIKA_SINIRI;
