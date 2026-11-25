const { timingSafeEqual } = require('node:crypto');
const { join } = require('node:path');
const express = require('express');
const { paylasimUrlAyristir } = require('../../utils/paylasimUrl.ts');
const { OG_AFIS_YOLU, OG_KARE_DOSYASI, OG_YEDEK_DOSYA } = require('../../utils/paylasimGorseli.mjs');
const { katalogOku } = require('./katalogOku');
const { afisOnbellegi } = require('./afis');

const ESKI_YEDEK_DOSYA = 'kaymaktv-360.jpg';

function ayniYetki(gelen, beklenen) {
  if (!gelen || !beklenen) return false;
  const a = Buffer.from(gelen);
  const b = Buffer.from(beklenen);
  return a.length === b.length && timingSafeEqual(a, b);
}

function paylasimRouter({ afisDizini, ogSir, okuKatalog = katalogOku, afisler = afisOnbellegi({ dizin: afisDizini }) }) {
  const router = express.Router();

  router.get('/ozet', async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    if (!ayniYetki(req.get('X-Kaymak-OG-Key'), ogSir)) return res.sendStatus(404);
    const { url, dil } = req.query;
    const hedef = typeof url === 'string' && url.length <= 400 ? paylasimUrlAyristir(url) : null;
    if (!hedef || hedef.tur === 'u' || hedef.tur === 'activity' || (dil !== 'tr' && dil !== 'en')) {
      return res.sendStatus(404);
    }
    try {
      const ozet = await okuKatalog(hedef, dil);
      if (!ozet) return res.sendStatus(404);
      const dosya = await afisler.hazirla(ozet.afis);
      return res.json({
        baslik: Array.from(ozet.baslik).slice(0, 120).join(''),
        aciklama: Array.from(ozet.aciklama ?? '').slice(0, 160).join(''),
        gorsel: dosya ? OG_AFIS_YOLU + dosya : null,
      });
    } catch {
      return res.sendStatus(503);
    }
  });

  for (const dosya of [OG_YEDEK_DOSYA, ESKI_YEDEK_DOSYA]) {
    router.get(`/afis/${dosya}`, (_req, res) => {
      return res.sendFile(join(__dirname, 'assets', dosya), { maxAge: '1h' });
    });
  }

  router.get('/afis/:dosya', async (req, res) => {
    const yedek = OG_KARE_DOSYASI.test(req.params.dosya) ? OG_YEDEK_DOSYA : ESKI_YEDEK_DOSYA;
    const jpeg = await afisler.oku(req.params.dosya).catch(() => null);
    if (!jpeg) {
      res.set('Cache-Control', 'no-store');
      return res.redirect(302, OG_AFIS_YOLU + yedek);
    }
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    return res.type('jpeg').send(jpeg);
  });

  return router;
}

module.exports = { paylasimRouter };
