// ==========================================================================
// GET /api/health — LazyFetch + Katalog Arşivi sağlık ucu  (K8 · M531)
// ==========================================================================
// NEDEN VAR: LAZYFETCH-01 denetiminde (M530) "sistem şu an sağlıklı mı?"
// sorusunun tek cevabı SSH + `journalctl` + denetçi betiğiydi; `/api/health`
// 404 dönüyordu. Bu uç aynı soruyu tek `curl` ile cevaplar.
//
// 🔒 SÖZLEŞME — SALT OKUMA, SIRSIZ:
//   • Hiçbir şey YAZMAZ: devre kesici ve token kovası durumu DEĞİŞTİRMEDEN
//     okunur (`devreDurumu`, `kovaDurumu`), arşive yalnız SELECT atılır.
//   • Dosya yolu, `.env` değeri, hata metni (yol içerebilir), kullanıcı verisi
//     DÖNMEZ — yalnız sayılar ve durum kelimeleri. Uç herkese açık.
//   • Kendi sınırlayıcısı var (`saglikLimiter`, dakikada 30).
//   • Ağır sayım YOK: arşiv sayıları gecelik sayacın `meta`'ya yazdığı
//     değerlerden okunur (84 bin satırı her çağrıda COUNT etmek Pi'yi yorardı).
//
// HTTP durumu: LazyFetch ve arşiv açıksa 200, biri kapalıysa 503 — böylece
// harici bir izleyici gövdeyi ayrıştırmadan alarm verebilir.

const fs = require('fs');
const express = require('express');
const { saglikLimiter } = require('./security');
const { getLazyFetchStatus } = require('./lazyfetch/paths');
const { devreDurumu } = require('./lazyfetch/circuitBreaker');
const { kovaDurumu } = require('./lazyfetch/tokenBucket');
const { memoryCache, refreshQueue } = require('./lazyfetch/state');
const { getArchiveStatus, getDb } = require('./archive/db');
const { readFallbackStats } = require('./archive/stats');

const SAGLAYICILAR = ['tmdb', 'trakt'];

/** Kökün bulunduğu diskin doluluk yüzdesi — `fs.statfs` yoksa/başarısızsa null. */
async function diskYuzdesi(kok) {
  if (!kok || typeof fs.promises.statfs !== 'function') return null;
  try {
    const s = await fs.promises.statfs(kok);
    if (!s.blocks) return null;
    return Math.round(((s.blocks - s.bavail) / s.blocks) * 1000) / 10;
  } catch (_) {
    return null;
  }
}

/** Gecelik sayacın son değerleri (`sayac.js` → `meta`). Sayaç hiç koşmadıysa null'lar. */
function arsivSayaclari(db) {
  const bos = { entities: null, externalIds: null, payloads: null, olculdu: null };
  if (!db) return bos;
  try {
    const oku = db.prepare('SELECT value FROM meta WHERE key = ?');
    const sayi = (k) => {
      const r = oku.get(k);
      const n = r ? Number(r.value) : NaN;
      return Number.isFinite(n) ? n : null;
    };
    const at = sayi('sayac_at');
    return {
      entities: sayi('sayac_entities'),
      externalIds: sayi('sayac_external_ids'),
      payloads: sayi('sayac_payloads'),
      olculdu: at ? new Date(at).toISOString() : null,
    };
  } catch (_) {
    return bos;
  }
}

/** Uç gövdesi — saf veri, Express'ten bağımsız (testler doğrudan çağırır). */
async function saglikRaporu() {
  const lf = getLazyFetchStatus();
  const arsiv = getArchiveStatus();
  const db = arsiv.enabled ? getDb() : null;
  const geriDusus = db ? readFallbackStats(db) : null;

  const saglayicilar = {};
  for (const p of SAGLAYICILAR) saglayicilar[p] = { devre: devreDurumu(p), kova: kovaDurumu(p) };

  return {
    ok: !!lf.enabled && !!arsiv.enabled,
    at: new Date().toISOString(),
    calismaSuresiSn: Math.round(process.uptime()),
    lazyfetch: {
      etkin: !!lf.enabled,
      diskDolulukYuzde: lf.enabled ? await diskYuzdesi(lf.root) : null,
      bellekKayit: memoryCache.size,
      yenileme: refreshQueue.getStats(),
      saglayicilar,
    },
    arsiv: {
      etkin: !!arsiv.enabled,
      sayac: arsivSayaclari(db),
      geriDusus: geriDusus
        ? {
            toplam: geriDusus.toplam,
            sonAt: geriDusus.sonAt ? new Date(geriDusus.sonAt).toISOString() : null,
            aileler: geriDusus.aileler,
          }
        : null,
    },
  };
}

const router = express.Router();

router.get('/', saglikLimiter, async (req, res) => {
  try {
    const rapor = await saglikRaporu();
    res.setHeader('Cache-Control', 'no-store');
    res.status(rapor.ok ? 200 : 503).json(rapor);
  } catch (error) {
    // Hata metni dışarı verilmez (yol içerebilir) — yalnız sunucu günlüğüne.
    console.error('[saglik] rapor uretilemedi:', error?.message || error);
    res.status(500).json({ ok: false });
  }
});

module.exports = router;
module.exports.saglikRaporu = saglikRaporu;
