require('dotenv').config();

// ⚠️ DNS GECİKMESİ (Madde 234 — ölçüldü, İKİ TURDA teşhis düzeltildi):
// İLK TEŞHİS (curl -6/-4 ile "IPv6 bağlantısı yavaş") YANLIŞ ÇIKTI — o
// bayraklar DNS çözümlemesini atlayıp tek bir aileyi zorluyor, gerçek
// darboğazı gizliyordu. Node'un varsayılan `dns.lookup()`'ı (AF_UNSPEC) HEM
// A HEM AAAA kaydını sorgulayıp İKİSİNİN DE dönmesini bekliyor — Pi'de A
// kaydı 14ms'de dönerken AAAA birkaç saniyede dönüyor (ölçüldü:
// `dns.resolve4` 14ms, `dns.resolve6` 2069ms; muhtemelen upstream DNS
// sunucusunun IPv6 sorgularını yavaş/güvenilmez yanıtlaması). Önceki turda
// denenen `dns.setDefaultResultOrder('ipv4first')` SONUÇLARIN SIRASINI
// değiştiriyor ama SORGUNUN KENDİSİNİ hızlandırmıyor — ölçümle yetersiz
// bulundu. Asıl çözüm AAAA'yı HİÇ SORGULAMAMAK: aşağıdaki axios agent'ında
// `family: 4` (ölçüldü: family:4 ile istek 298ms, olmadan 5+ saniye).
// `setDefaultResultOrder` zararsız ikincil önlem olarak bırakıldı — henüz
// keşfedilmemiş, agent'sız bir dış istek eklenirse yine de IPv4'ü önceler.
// Bilinçli olarak Pi'nin işletim sistemi/ağ ayarına DOKUNULMADI (bu
// makinede başka projeler de çalışıyor) — yalnızca BU Node sürecinin DNS
// davranışı değiştirildi.
const dns = require('dns');
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const express = require('express');
const path = require('path');
const https = require('https');
const axios = require('axios');

// `family: 4` yukarıdaki AAAA gecikmesinin asıl çözümü — bu agent
// üzerinden yapılan bağlantılarda IPv6 kaydı hiç sorgulanmaz. `keepAlive`
// ayrıca sonraki isteklerde TCP+TLS el sıkışmasını da atlar (~0.3s ekstra
// tasarruf, ayrıca ölçüldü). Axios'un varsayılan `httpsAgent`'ını
// değiştirir; her çağrı noktasına ayrı ayrı eklemeye gerek kalmaz.
axios.defaults.httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50, family: 4 });

// Açık proxy koruması (MASTER_PLAN F16 / Y12) — gerekçeler ve beyaz listeler
// `server/security.js` içinde. Ayrı modül olmasının sebebi AI_RULES §1'in
// 400 satır sınırı; bu dosya zaten 361 satırdı.
const {
  corsMiddleware,
  tmdbLimiter,
  traktProxyLimiter,
  traktAuthLimiter,
  traktProxyGuard,
  redirectUriGuard,
  logSecurityMode,
} = require('./server/security');

const app = express();
const PORT = process.env.PORT || 4830;

// ⚠️ ESKİDEN `cors()` idi — yani `Access-Control-Allow-Origin: *`. Artık
// yalnızca kaymaktv.com (ve geliştirmede localhost/exp://) kaynaklı tarayıcı
// istekleri CORS başlığı alır. Native istekler `Origin` göndermediği için
// bundan ETKİLENMEZ (bkz. server/security.js).
app.use(corsMiddleware);
app.use(express.json());

// `/api/trakt-proxy`'nin dört handler'ı da (GET/POST/DELETE/PUT) aynı kapıdan
// geçer: önce dakikalık istek limiti, sonra Trakt uç noktası beyaz listesi.
// Handler tanımlarından ÖNCE bağlanması zorunlu.
app.use('/api/trakt-proxy', traktProxyLimiter, traktProxyGuard);

// ==========================================
// BAŞLANGIÇ ORTAM DEĞİŞKENİ KONTROLÜ
// Eksik/yanlış .env sessizce 500'e düşmesin, terminalde hemen görünsün.
// ==========================================
const REQUIRED_ENV_VARS = ['TRAKT_CLIENT_SECRET', 'EXPO_PUBLIC_TRAKT_CLIENT_ID'];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.warn('==========================================');
  console.warn('⚠️  UYARI: Eksik ortam değişkenleri tespit edildi:');
  missingEnvVars.forEach((key) => console.warn(`   - ${key}`));
  console.warn(`   .env dosyası bu makinede (${__dirname}) mevcut mu ve doğru mu kontrol edin.`);
  console.warn('   /api/trakt istekleri bu değişkenler ayarlanana kadar 500 dönecektir.');
  console.warn('==========================================');
}

// ==========================================
// TMDB PROXY ENDPOINT
// ==========================================
app.get('/api/tmdb', tmdbLimiter, async (req, res) => {
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

    const tmdbResponse = await axios.get(`https://api.themoviedb.org/3${endpoint}`, {
      params: {
        ...queryParams,
        api_key: tmdbApiKey,
      },
      headers: { 'Content-Type': 'application/json' }
    });

    res.json(tmdbResponse.data);
  } catch (error) {
    console.error('Error in TMDB proxy:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data || 'Internal Server Error',
      details: error.message
    });
  }
});

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

    const traktResponse = await axios.post(`https://api.trakt.tv${endpoint}`, req.body, { headers });
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
      headers: { 'Content-Type': 'application/json' }
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

// ==========================================
// STATIC FILES & SPA FALLBACK
// ==========================================
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      // index.html asla önbelleğe alınmamalı, her zaman sunucuya sorulmalı
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      // JS, CSS, resim gibi statik dosyalar kalıcı olarak önbelleğe alınabilir (1 yıl)
      // Çünkü Expo isimlerine hash ekliyor (entry-123.js gibi), değişirse yeni dosya istenir.
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

app.use((req, res) => {
  // ⚠️ KRİTİK (bkz. docs/HISTORY.md Madde 132): Bu fallback ESKİDEN metoda ve
  // yola BAKMADAN her isteğe `200 + index.html` döndürüyordu. Sonucu gerçek ve
  // sinsi bir hataydı: sunucuda karşılığı olmayan bir API isteği (ör. henüz
  // deploy edilmemiş `PUT /api/trakt-proxy`) hata DEĞİL, BAŞARI olarak
  // dönüyordu — axios 2xx gördüğü için istemci "kaydedildi" sanıyor, oysa
  // istek Trakt'a hiç ulaşmamış oluyordu. Kullanıcı "profil açıklamam
  // kaydedilmiyor ama hata da vermiyor" diye bildirdi; kök neden buydu.
  //
  // Artık SPA fallback YALNIZCA gerçek sayfa gezinmelerine (GET/HEAD) hizmet
  // eder ve `/api/*` altındaki hiçbir yolu ASLA yutmaz — eşleşmeyen her API
  // isteği dürüstçe JSON 404 döner (docs/AI_RULES.md § sessiz başarısızlık yasak).
  const isPageNavigation = req.method === 'GET' || req.method === 'HEAD';
  if (!isPageNavigation || req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'Not Found',
      details: `${req.method} ${req.path} bu sunucuda tanımlı değil.`,
    });
  }

  // SPA Fallback (örneğin /settings adresine direkt gidildiğinde)
  // index.html gönderilirken aynı önbellek kuralları geçerli olmalı
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ==========================================
// START SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`==========================================`);
  console.log(`🚀 Kaymak Server is running on port ${PORT}`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  logSecurityMode();
  console.log(`==========================================`);
});
