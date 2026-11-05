// ==========================================================================
// TRAKT KÖPRÜ YOLLARI — /api/trakt-proxy (GET/POST/DELETE/PUT) + /api/trakt (OAuth)
// ==========================================================================
// `server.js`'ten taşındı (400 satır kuralı), davranış aynı. Koruyucular (`traktProxyLimiter`,
// `traktProxyGuard`) `server.js`'te yolun önüne bağlı; sıra korunur: bu işlev orada çağrılır.

const axios = require('axios');
const { kopruSecenekleri } = require('./lazyfetch/zamanSiniri');

module.exports = function traktYollariniBagla(app, { traktAuthLimiter, redirectUriGuard }) {
  // ==========================================
  // TRAKT GENERIC PROXY (CORS Köprüsü)
  // ==========================================
  // `/users/hidden/progress_watched` ve `/users/hidden/calendar` tarayıcıdan
  // (web) doğrudan çağrıldığında Trakt CORS preflight'ını reddediyor
  // (Access-Control-Allow-Origin başlığı gelmiyor) — diğer Trakt uç
  // noktalarının çoğu bu sorunu yaşamıyor, yalnızca bunlarda gözlemlendi.
  // Sunucu-sunucu isteği CORS'a hiç tabi olmadığından, /api/trakt (auth) ve
  // /api/tmdb ile AYNI proxy deseni burada da uygulandı. Token, sızıntı
  // riskini azaltmak için URL/query string'e DEĞİL, isteğin kendi
  // Authorization başlığına konur ve olduğu gibi Trakt'a iletilir.
  // K5 (M533) — trend + arama önce LazyFetch önbelleğinden (arama: kesintide arşivden
  // yerel arama). Diğer her yol `next()` ile aşağıdaki saf geçişe AYNEN düşer.
  app.get('/api/trakt-proxy', require('./traktProxyOnbellek'));
  app.get('/api/trakt-proxy', async (req, res) => {
    try {
      const clientId = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID;
      if (!clientId) {
        return res.status(500).json({ error: 'Server configuration error (missing EXPO_PUBLIC_TRAKT_CLIENT_ID)' });
      }

      let endpoint = req.query.endpoint;
      if (!endpoint || typeof endpoint !== 'string') {
        return res.status(400).json({ error: 'Endpoint is required' });
      }
      if (!endpoint.startsWith('/')) {
        endpoint = '/' + endpoint;
      }

      const queryParams = { ...req.query };
      delete queryParams.endpoint;

      const headers = {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': clientId,
      };
      if (req.headers.authorization) {
        headers['Authorization'] = req.headers.authorization;
      }

      const traktResponse = await axios.get(`https://api.trakt.tv${endpoint}`, {
        params: queryParams,
        headers,
        ...kopruSecenekleri(), // Paket B (M548): boşta 15 sn / toplam 60 sn
      });

      // Sayfalama bilgisini (getAllHiddenItems bunu okuyor) yanıt başlığında koru.
      const pageCount = traktResponse.headers['x-pagination-page-count'];
      if (pageCount) res.setHeader('x-pagination-page-count', pageCount);

      res.json(traktResponse.data);
    } catch (error) {
      console.error('Error in Trakt proxy:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        error: error.response?.data || 'Internal Server Error',
        details: error.message,
      });
    }
  });

  // Aynı köprünün POST varyantı — `hideItemTrakt`/`unhideItemTrakt` da
  // `/users/hidden/*` ailesine yazdığından aynı CORS reddiyle karşılaşıyor.
  app.post('/api/trakt-proxy', async (req, res) => {
    try {
      const clientId = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID;
      if (!clientId) {
        return res.status(500).json({ error: 'Server configuration error (missing EXPO_PUBLIC_TRAKT_CLIENT_ID)' });
      }

      let endpoint = req.query.endpoint;
      if (!endpoint || typeof endpoint !== 'string') {
        return res.status(400).json({ error: 'Endpoint is required' });
      }
      if (!endpoint.startsWith('/')) {
        endpoint = '/' + endpoint;
      }

      const headers = {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': clientId,
      };
      if (req.headers.authorization) {
        headers['Authorization'] = req.headers.authorization;
      }

      const traktResponse = await axios.post(`https://api.trakt.tv${endpoint}`, req.body, { headers, ...kopruSecenekleri() });
      res.json(traktResponse.data);
    } catch (error) {
      console.error('Error in Trakt proxy (POST):', error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        error: error.response?.data || 'Internal Server Error',
        details: error.message,
      });
    }
  });

  // Aynı köprünün DELETE varyantı — `unfollowTraktUser` (`DELETE /users/:id/follow`)
  // için. `followTraktUser`/`unfollowTraktUser` ikisi de `/users/:id/follow`
  // ailesine gittiğinden GET/POST'taki `/users/hidden/*` ile AYNI CORS reddine
  // takılıyor (bkz. docs/HISTORY.md Madde 109 ve "Takip isteği gitmiyor" bug'ı).
  app.delete('/api/trakt-proxy', async (req, res) => {
    try {
      const clientId = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID;
      if (!clientId) {
        return res.status(500).json({ error: 'Server configuration error (missing EXPO_PUBLIC_TRAKT_CLIENT_ID)' });
      }

      let endpoint = req.query.endpoint;
      if (!endpoint || typeof endpoint !== 'string') {
        return res.status(400).json({ error: 'Endpoint is required' });
      }
      if (!endpoint.startsWith('/')) {
        endpoint = '/' + endpoint;
      }

      const headers = {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': clientId,
      };
      if (req.headers.authorization) {
        headers['Authorization'] = req.headers.authorization;
      }

      const traktResponse = await axios.delete(`https://api.trakt.tv${endpoint}`, { headers });
      res.status(traktResponse.status).json(traktResponse.data ?? {});
    } catch (error) {
      console.error('Error in Trakt proxy (DELETE):', error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        error: error.response?.data || 'Internal Server Error',
        details: error.message,
      });
    }
  });

  // Aynı köprünün PUT varyantı — GET/POST/DELETE ile aynı genel amaçlı desen.
  //
  // NOT (bkz. docs/HISTORY.md Madde 134): Şu anda istemci tarafında bu handler'ı
  // kullanan HİÇBİR çağrı YOK. Tek kullanıcısı `PUT /users/settings` idi (profil
  // adı/bio/gizlilik yazma) — ama Trakt'ın public API'si o uç noktaya yazmaya
  // izin vermiyor (first-party, üçüncü parti anahtarla her zaman 401), o yüzden
  // istemcideki yazma kodu tamamen kaldırıldı. Handler BİLİNÇLİ olarak duruyor:
  // GET/POST/DELETE kardeşleriyle simetrik, genel amaçlı bir köprü ve ileride
  // Trakt'ın PUT kabul eden başka bir uç noktası (ör. `PUT /users/{id}/lists/{id}`
  // liste güncelleme) proxy'den geçmek isterse hazır. Silmek yerine bırakmanın
  // maliyeti sıfır; yeniden yazmanın maliyeti bir sonraki deploy döngüsü.
  app.put('/api/trakt-proxy', async (req, res) => {
    try {
      const clientId = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID;
      if (!clientId) {
        return res.status(500).json({ error: 'Server configuration error (missing EXPO_PUBLIC_TRAKT_CLIENT_ID)' });
      }

      let endpoint = req.query.endpoint;
      if (!endpoint || typeof endpoint !== 'string') {
        return res.status(400).json({ error: 'Endpoint is required' });
      }
      if (!endpoint.startsWith('/')) {
        endpoint = '/' + endpoint;
      }

      const headers = {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': clientId,
      };
      if (req.headers.authorization) {
        headers['Authorization'] = req.headers.authorization;
      }

      const traktResponse = await axios.put(`https://api.trakt.tv${endpoint}`, req.body, { headers });
      res.status(traktResponse.status).json(traktResponse.data ?? {});
    } catch (error) {
      console.error('Error in Trakt proxy (PUT):', error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        error: error.response?.data || 'Internal Server Error',
        details: error.message,
      });
    }
  });

  // ==========================================
  // TRAKT AUTH ENDPOINT
  // ==========================================
  app.post('/api/trakt', traktAuthLimiter, redirectUriGuard, async (req, res) => {
    try {
      const { code, refresh_token, redirect_uri } = req.body;

      if (!code && !refresh_token) {
        return res.status(400).json({ error: 'Authorization code or refresh token is required' });
      }

      // client_id gizli değildir (OAuth'ta genelde public), bu yüzden EXPO_PUBLIC_ fallback'i güvenlidir.
      const clientId = process.env.TRAKT_CLIENT_ID || process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID;
      // client_secret GİZLİDİR. EXPO_PUBLIC_ önekli bir değişkene ASLA fallback yapılmaz —
      // aksi halde bu değer client bundle'ına gömülür ve bu endpoint'in tüm amacı boşa çıkar.
      const clientSecret = process.env.TRAKT_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'Server configuration error (missing Trakt credentials)' });
      }

      const payload = refresh_token ? {
        refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirect_uri || 'kaymak://settings',
        grant_type: 'refresh_token',
      } : {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirect_uri || 'kaymak://settings',
        grant_type: 'authorization_code',
      };

      const traktResponse = await axios.post('https://api.trakt.tv/oauth/token', payload, {
        headers: { 'Content-Type': 'application/json' },
        ...kopruSecenekleri(),
      });

      res.json(traktResponse.data);
    } catch (error) {
      console.error('Error in Trakt Auth proxy:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json({ 
        error: error.response?.data || 'Internal Server Error',
        details: error.message
      });
    }
  });
};
