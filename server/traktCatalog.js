// ==========================================================================
// TRAKT KATALOG GEÇİDİ — `/api/trakt-catalog` (LazyFetch L7, dosya 3/3)
// ==========================================================================
// NE İŞE YARAR: dizi/film KATALOG verisini (kimseye ait olmayan, herkese
// ortak bilgi) Pi üzerinden servis eder ve LazyFetch önbelleğine sokar.
// Bugüne kadar istemci bu veriyi DOĞRUDAN `api.trakt.tv`'den alıyordu —
// yani Pi Trakt katalog trafiğinin SIFIRINI görüyordu
// (`00_BULGULAR.md §1`, ölçüldü). L7'nin varlık sebebi budur.
//
// 🔴 NEDEN `/api/trakt-proxy`'YE EKLENMEDİ DE AYRI BİR UÇ AÇILDI:
// İkisinin GÜVENLİK SÖZLEŞMESİ zıt. `/api/trakt-proxy` kullanıcının
// `Authorization` başlığını BİLEREK iletir (işi kullanıcıya özel uçlar).
// Bu uç ise onu ASLA iletmez — hatta okumaz. Aynı handler'a iki zıt
// sözleşme koymak, ileride birinin diğerinin korumasını sessizce
// gevşetmesiyle biterdi. Ayrı dosya = ayrı sözleşme.
//
// 🔴 ÜÇ KADEMELİ KAPI (savunma derinliği):
//   1. `traktCatalogLimiter` — dakikalık istek tavanı
//   2. Bu dosyadaki `GET` + `endpoint` doğrulaması
//   3. `routeRegistry` beyaz listesi — orchestrator, listede olmayan bir
//      path'i PASSTHRU sayar; burada PASSTHRU'ya izin VERMİYORUZ (aşağıda),
//      yani beyaz liste dışı her şey 403 ile reddedilir.
//
// Kademe 3 önemli: TMDB tarafında PASSTHRU zararsızdı (zaten proxy'ydi),
// ama burada PASSTHRU'ya izin vermek `/api/trakt-catalog`'u genel amaçlı
// bir Trakt geçidine çevirirdi — `server/security.js`'in Madde 192'de
// tam olarak kapattığı açık.

const express = require('express');
const { resolveRequest } = require('./lazyfetch/orchestrator');
const { createTraktCatalogFetcher } = require('./lazyfetch/providers/trakt');
const { resolveRoute } = require('./lazyfetch/routeRegistry');
const { CircuitOpenError, RateLimitedError } = require('./lazyfetch/errors');
const { traktCatalogLimiter } = require('./security');

const router = express.Router();

router.get('/', traktCatalogLimiter, async (req, res) => {
  try {
    // `EXPO_PUBLIC_` öneki burada sır sızıntısı DEĞİL: bu Trakt'ın PUBLIC
    // client ID'si (AI_RULES §2'nin izin verdiği "public ID" kategorisi).
    // Client SECRET yalnızca `/api/trakt` token akışında kullanılır ve bu
    // dosyaya hiç uğramaz.
    const clientId = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: 'Server configuration error (missing EXPO_PUBLIC_TRAKT_CLIENT_ID)' });
    }

    let endpoint = req.query.endpoint;
    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({ error: 'Endpoint is required' });
    }
    if (!endpoint.startsWith('/')) endpoint = '/' + endpoint;

    // 🔴 KADEME 3: beyaz liste dışı = 403. `resolveRoute` "cacheable: false"
    // dediğinde orchestrator bunu PASSTHRU sayardı; burada o yola HİÇ
    // girmiyoruz (dosya başlığındaki gerekçe).
    if (!resolveRoute('trakt', endpoint).cacheable) {
      return res.status(403).json({
        error: 'Forbidden',
        details: `GET ${endpoint} bu katalog gecidinden gecmeye izinli degil.`,
      });
    }

    const queryParams = { ...req.query };
    delete queryParams.endpoint;

    const result = await resolveRequest({
      provider: 'trakt',
      path: endpoint,
      query: queryParams,
      fetcher: createTraktCatalogFetcher(clientId),
    });

    if (result.status === 'not-found') {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // İstemcinin cache'ten mi geldiğini görebilmesi için (teşhis; davranışı
    // etkilemez). `x-` öneki standart dışı ama bu başlık yalnızca bizim
    // kendi istemcimiz/denetimimiz için.
    res.setHeader('x-lazyfetch', result.status);
    res.json(result.data);
  } catch (error) {
    if (error instanceof CircuitOpenError || error instanceof RateLimitedError) {
      console.error('Trakt katalog gecidi (LazyFetch disiplin katmani):', error.message);
      return res.status(503).json({ error: error.message });
    }
    console.error('Trakt katalog gecidi hatasi:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || 'Internal Server Error',
      details: error.message,
    });
  }
});

module.exports = router;
