// ==========================================================================
// TMDB PROXY ENDPOINT
// ==========================================================================
// `server.js`'ten AYRILDI (LazyFetch L1-L3 entegrasyonu dosyayı 400 satır
// sınırının üzerine çıkardı, AI_RULES §1) — mantığın kendisi DEĞİŞMEDİ,
// yalnızca taşındı. `server/security.js`'in kurduğu desenle aynı: bağımsız
// bir modül, `server.js` yalnızca `app.use('/api/tmdb', require(...))` ile
// bağlar.

const express = require('express');
const { tmdbLimiter } = require('./security');
const { resolveRequest } = require('./lazyfetch/orchestrator');
const { createTmdbFetcher } = require('./lazyfetch/providers/tmdb');
const { CircuitOpenError, RateLimitedError } = require('./lazyfetch/errors');

const router = express.Router();

router.get('/', tmdbLimiter, async (req, res) => {
  try {
    // ⚠️ `EXPO_PUBLIC_TMDB_API_KEY` FALLBACK'İ BİLİNÇLİ OLARAK KALDIRILDI.
    //
    // Expo'da `EXPO_PUBLIC_` önekli HER değişken build zamanında istemci
    // bundle'ına GÖMÜLÜR (bkz. docs/AI_RULES.md §2) — yani o adla tanımlanmış
    // bir TMDB anahtarı, uygulamayı indiren herkes tarafından okunabilir olurdu.
    // Fallback bir sızıntı DEĞİLDİ ama birinin `.env`'e o adı yazmasını DAVET
    // ediyordu; ilk yanlış tanımda sessizce sızardı.
    //
    // Trakt için aynı fallback `ARCHITECTURE.md` §4'te zaten kaldırılmıştı
    // (Madde 25); TMDB'de gözden kaçmıştı. Anahtar YALNIZCA öneksiz
    // `TMDB_API_KEY` ile, yalnızca sunucuda okunur.
    const tmdbApiKey = process.env.TMDB_API_KEY;
    if (!tmdbApiKey) {
      return res.status(500).json({ error: 'Server configuration error (missing TMDB_API_KEY)' });
    }

    let endpoint = req.query.endpoint;
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint is required' });
    }

    if (!endpoint.startsWith('/')) {
      endpoint = '/' + endpoint;
    }

    const queryParams = { ...req.query };
    delete queryParams.endpoint;

    // LazyFetch: rota beyaz listede değilse (server/lazyfetch/routeRegistry.js)
    // veya SSD kapalıysa `resolveRequest` SESSİZCE PASSTHRU'ya düşer — bu
    // durumda içeride tam olarak eski koddaki axios çağrısı (aynı URL, aynı
    // params, aynı header) çalışır; kimliksiz/misafir istekler de dahil
    // TÜM istekler aynı şekilde işlenir (cache kullanıcı kimliğine hiç bakmaz).
    const result = await resolveRequest({
      provider: 'tmdb',
      path: endpoint,
      query: queryParams,
      fetcher: createTmdbFetcher(tmdbApiKey),
    });

    // 🆕 (L4, negatif cache): sağlayıcı "bu kaynak yok" dediğinde (veya
    // negatif cache'ten aynı bilgi geldiğinde) gerçek TMDB 404'üyle AYNI
    // status kodu dönülür — istemcinin 404 işleme mantığı (ör. "içerik
    // bulunamadı" ekranı) farksız çalışmaya devam eder.
    if (result.status === 'not-found') {
      return res.status(404).json({ error: 'Resource not found' });
    }

    res.json(result.data);
  } catch (error) {
    // 🆕 (L4): devre kesici AÇIK veya kendi kota tavanımız dolu — bunlar
    // TMDB'nin kendi hatası DEĞİL, "şu an sağlayıcıya hiç gitmedik" demek.
    // 503 (Service Unavailable) bunu istemciye 500'den daha doğru anlatır.
    if (error instanceof CircuitOpenError || error instanceof RateLimitedError) {
      console.error('Error in TMDB proxy (LazyFetch disiplin katmanı):', error.message);
      return res.status(503).json({ error: error.message });
    }

    console.error('Error in TMDB proxy:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || 'Internal Server Error',
      details: error.message
    });
  }
});

module.exports = router;
