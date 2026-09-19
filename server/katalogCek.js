// ==========================================================================
// POST /api/katalog-cek — Worker'ın "bu yapımı hemen getir" kapısı  (§C30)
// ==========================================================================
// TEK ÇAĞIRANI Worker (`kaymaktv-feedback-worker/src/lib/katalogCek.js`).
// Mantık `server/archive/eksikteCek.js`'te; burası yalnızca KAPI.
//
// 🔒 GÜVENLİK — bu uç Pi'ye Trakt çektirebiliyor, dışarı açık kalamaz:
//   1. SIR: `x-kaymak-sync-secret` = `PI_SYNC_SECRET` (aynanın Worker'a
//      giderken kullandığı sırrın AYNISI; iki yön tek güven alanı).
//      Sabit zamanlı karşılaştırma. Sır yoksa/kısaysa uç KAPALI (503).
//   2. KENDİ SINIRLAYICISI: diğer sınırlayıcılar `cf-connecting-ip`'ye göre
//      sayıyor (`security.js`); Worker'dan gelen TÜM istekler aynı Cloudflare
//      çıkışını taşıyacağı için orada tek kovayı paylaşırdı. Burada anahtar
//      sabit: uç TOPLAMDA dakikada `DAKIKA_SINIRI` istek.
//   3. Girdi dar: yalnızca `{tur, traktId, sezon?, bolumler?}`; yol/sorgu
//      istemciden ALINMAZ (`cekilecekler` sabit kurar).

const crypto = require('crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { eksikteCek, istegiDogrula } = require('./archive/eksikteCek');

const DAKIKA_SINIRI = 60;
const router = express.Router();

const sinirlayici = rateLimit({
  windowMs: 60 * 1000,
  limit: DAKIKA_SINIRI,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: () => 'worker',
  // Anahtar IP değil sabit — IP doğrulamaları burada anlamsız.
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

router.post('/', (req, res, next) => {
  // Sır kontrolü SINIRLAYICIDAN ÖNCE: sırsız istek kovayı tüketemesin.
  if ((process.env.PI_SYNC_SECRET || '').length < 32) return res.status(503).json({ ok: false, durum: 'kapali' });
  if (!sirDogru(req.get('x-kaymak-sync-secret'))) return res.status(401).json({ ok: false, durum: 'yetkisiz' });
  return next();
}, sinirlayici, async (req, res) => {
  const istek = istegiDogrula(req.body);
  if (istek.hata) return res.status(400).json({ ok: false, durum: 'gecersiz', alan: istek.hata });
  try {
    const sonuc = await eksikteCek(istek);
    console.log(`[katalog-cek] ${istek.tur}:${istek.traktId}${istek.sezon !== null ? ` s${istek.sezon}` : ''} -> ${sonuc.durum} (${sonuc.ms} ms)`);
    return res.status(200).json(sonuc);
  } catch (error) {
    console.error('[katalog-cek] beklenmeyen hata:', error?.message || error);
    return res.status(500).json({ ok: false, durum: 'hata' });
  }
});

module.exports = router;
module.exports.DAKIKA_SINIRI = DAKIKA_SINIRI;
