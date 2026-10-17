// ==========================================================================
// GET /api/afis-yedek?tur=show|movie&tmdb=<id>  (K1(b) · M532)
// ==========================================================================
// İstemci TMDB'den afiş yolu alamazsa (TMDB'de yok, 503, kesinti) buraya sorar;
// cevap arşivdeki Trakt afiş adresidir (`archive/traktAfis.js`). SALT OKUMA:
// Trakt'a ya da TMDB'ye istek ATMAZ, hiçbir şey yazmaz — bu yüzden TMDB kovası
// dolu ya da TMDB çökmüşken de çalışır. Afiş yoksa `{url: null}` (200).

const express = require('express');
const { afisYedekLimiter } = require('./security');
const { traktAfisYedegi } = require('./archive/traktAfis');

const router = express.Router();

router.get('/', afisYedekLimiter, async (req, res) => {
  const tur = req.query.tur;
  const tmdb = req.query.tmdb;
  if ((tur !== 'show' && tur !== 'movie') || typeof tmdb !== 'string' || !/^\d{1,9}$/.test(tmdb)) {
    return res.status(400).json({ error: 'tur (show|movie) ve sayisal tmdb gerekli' });
  }
  const url = await traktAfisYedegi(tur, tmdb);
  // Arşiv kaydı nadiren değişir; aynı yapımı soran cihazlar kısa süre önbellekten alsın.
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.json({ url });
});

module.exports = router;
