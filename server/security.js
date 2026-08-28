// ==========================================================================
// AÇIK PROXY KORUMASI (MASTER_PLAN F16 / Y12)
// ==========================================================================
// SORUN (denetimde canlıda doğrulandı): `/api/tmdb` ve `/api/trakt-proxy`
// kimliksiz, rate-limit'siz ve CORS `*` ile herkese açıktı. Uygulamayla hiç
// ilgisi olmayan biri bu uçları kendi projesinin ücretsiz TMDB/Trakt geçidi
// olarak kullanabilir. SSRF YOK (host sabit, `api_key` ezilemiyor) — sorun
// KİMLİKSİZ KOTA TÜKETİMİ: Trakt ücretlendirmeye geçtiği için doğrudan fatura
// riski, TMDB tarafında ise anahtarın kota aşımıyla askıya alınması.
//
// ⚠️ BU MODÜL TEK BAŞINA YETMEZ. Cloudflare WAF'taki `/api/*` rate-limit
// kuralı (F16 adım 1) ilk savunma hattıdır; burası ikinci hat. Gerekçesi:
// origin sunucusunun IP'si biliniyorsa Cloudflare atlanabilir, o durumda
// yalnızca bu katman devrededir.
//
// AI_RULES §1 gereği ayrı modül: `server.js` 361 satırdı, bu mantık oraya
// eklenseydi 400 satır sınırı aşılırdı.

const cors = require('cors');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// --------------------------------------------------------------------------
// Geliştirme kaynaklarına izin veriliyor mu?
// --------------------------------------------------------------------------
// 🔴 NEDEN AYRI BİR DEĞİŞKEN (Madde 233): eskiden bu bayrak
// `process.env.NODE_ENV !== 'production'` idi, yani TEK anahtar İKİ ayrı şeyi
// birden kontrol ediyordu: (a) dev origin'lerin kabulü, (b) tüm prod
// davranışları. Geliştirici localhost'tan test edebilmek için (a)'yı açmak
// isteyince (b)'yi de kapatmak ZORUNDA kalıyordu — ve geri almayı unutmak çok
// kolaydı. 2026-08-22'de tam olarak bu oldu: `NODE_ENV` günlerce
// `development`'ta kaldı ve F16 CORS kalkanı yarı açık çalıştı.
//
// Artık ikisi bağımsız: `NODE_ENV=production` KALICI olarak açık kalır,
// geliştirici yalnızca `ALLOW_DEV_ORIGINS=1` ekler/kaldırır.
//
// Varsayılan KAPALI ("güvenli taraf"): değişken hiç set edilmemişse dev
// origin'ler reddedilir. Eski davranış tersineydi (set edilmemişse AÇIK) —
// bilinçli olarak değiştirildi, çünkü o tercih tam da yukarıdaki sessiz
// yarı-açık duruma yol açıyordu. Yalnızca tam olarak '1' değeri açar;
// böylece boş string ya da 'false' gibi değerler kazara kalkanı indirmez.
// Hangi modda çalışıldığı `logSecurityMode()` ile açıkça terminale yazılır.
const ALLOW_DEV_ORIGINS = process.env.ALLOW_DEV_ORIGINS === '1';

const PROD_ORIGINS = ['https://kaymaktv.com'];

const isDevOrigin = (origin) =>
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || origin.startsWith('exp://');

// --------------------------------------------------------------------------
// CORS
// --------------------------------------------------------------------------
// `Origin` başlığı YOKSA `cb(null, false)` dönüyoruz: bu isteği REDDETMEZ,
// yalnızca `Access-Control-Allow-Origin` başlığını basmaz. Native (React
// Native) istekleri ve sunucu-sunucu çağrıları `Origin` göndermez ve CORS'a
// hiç tabi değildir — onları engellemek uygulamayı kırardı. Tarayıcı ise
// başlık gelmediğinde yanıtı kendisi bloke eder, ki istenen budur.
//
// ⚠️ CORS bir KOTA koruması DEĞİLDİR: `curl` `Origin` göndermeden geçer.
// Kota korumasını yapan şey aşağıdaki rate limit'ler ve Cloudflare WAF.
// CORS'un buradaki işi, üçüncü parti bir WEB SİTESİNİN bu proxy'yi kendi
// tarayıcı istemcisinden kullanmasını engellemek.
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, false);
    if (PROD_ORIGINS.includes(origin)) return cb(null, true);
    if (ALLOW_DEV_ORIGINS && isDevOrigin(origin)) return cb(null, true);
    return cb(null, false);
  },
};

const corsMiddleware = cors(corsOptions);

// --------------------------------------------------------------------------
// Rate limit anahtarı — Cloudflare arkasında DOĞRU IP
// --------------------------------------------------------------------------
// KRİTİK: Express varsayılanı (`req.ip`) Cloudflare arkasında EDGE sunucusunun
// IP'sini verir — yani tüm kullanıcılar tek bir anahtar altında toplanır ve
// limit hepsini birlikte keser. `trust proxy` açmak da çözüm DEĞİL: Cloudflare
// `X-Forwarded-For`'a ziyaretçi IP'sini EKLER (üzerine yazmaz), dolayısıyla
// saldırganın gönderdiği sahte değer en solda kalır ve limit atlatılabilir.
// `CF-Connecting-IP` ise Cloudflare tarafından her zaman ÜZERİNE YAZILIR.
const clientIpKey = (req) => {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.length > 0) return cfIp;
  return ipKeyGenerator(req.ip ?? '');
};

const makeLimiter = (max, label) =>
  rateLimit({
    windowMs: 60 * 1000,
    limit: max,
    keyGenerator: clientIpKey,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // `req.ip` yerine `CF-Connecting-IP` kullandığımız için express-rate-limit'in
    // "trust proxy ayarlanmamış" doğrulaması burada yanlış alarm veriyor.
    validate: { xForwardedForHeader: false },
    message: {
      error: 'Too Many Requests',
      details: label + ' icin dakikalik istek siniri asildi.',
    },
  });

// Limitler bilinçli olarak CÖMERT: amaç gerçek kullanıcıyı kesmek değil,
// otomatik kötüye kullanımın maliyetini sınırlamak. Bir dizi/film sayfası
// açılışı onlarca TMDB çağrısı yapabildiği için TMDB payı en yüksek olan.
// (Poster görselleri image.tmdb.org'dan DOĞRUDAN gelir, bu limite girmez.)
const tmdbLimiter = makeLimiter(300, 'TMDB proxy');
const traktProxyLimiter = makeLimiter(120, 'Trakt proxy');
// 🆕 L7 — katalog geçidi (`/api/trakt-catalog`). TMDB'den DÜŞÜK, Trakt
// proxy'sinden yüksek: bir dizi sayfası tek bir `seasons` çağrısı yapar
// (TMDB'deki onlarca çağrının aksine), ama liste ekranlarında arka arkaya
// birkaç dizi açılabilir. Ayrıca bu ucun arkasında LazyFetch var — ikinci
// istek zaten SSD'den dönüyor, yani gerçek origin yükü bu sayıdan çok daha
// düşük. Sayı ölçülmedi, gerekçelendirildi (04_KARARLAR.md B).
const traktCatalogLimiter = makeLimiter(180, 'Trakt katalog gecidi');
// Giriş/token yenileme seyrek bir işlem; burada dar olmak güvenli.
const traktAuthLimiter = makeLimiter(20, 'Trakt auth');

// --------------------------------------------------------------------------
// Trakt uç noktası beyaz listesi
// --------------------------------------------------------------------------
// `/api/trakt-proxy` GENEL AMAÇLI bir köprü olarak yazılmıştı: `endpoint`
// query parametresi ne verilirse api.trakt.tv'ye o yola gidiliyordu. Yani
// Trakt'ın TÜM API'si kimliksiz olarak dışarı açıktı.
//
// Proxy'nin var oluş sebebi dar: yalnızca tarayıcının CORS'a taktığı uçlar
// (bkz. HISTORY Madde 109/120/122/132). Aşağıdaki liste istemci kodundan
// ÖLÇÜLEREK çıkarıldı (services/api/{social,users}.ts) ve derlenmiş
// `dist` bundle'ıyla karşılaştırılarak doğrulandı — tahminle yazılmadı.
//
// Tam eşleşme (`^...$`) kullanılması ayrıca yol geçişini (`..`) ve
// `endpoint`'e query/fragment iliştirmeyi de kapatır.
const TRAKT_ENDPOINT_ALLOWLIST = {
  GET: [
    /^\/users\/hidden\/(progress_watched|calendar)$/, // getHiddenShows / getHiddenMovies
    /^\/users\/requests$/, // getFollowRequests
    /^\/users\/settings$/, // getUserSettings / getProfilePrivacy
    /^\/shows\/trending$/, // getTrendingShows (karşılama ekranı poster duvarı — kimliksiz/public veri)
    /^\/movies\/trending$/, // getTrendingMovies (karşılama ekranı poster duvarı — kimliksiz/public veri)
  ],
  POST: [
    /^\/users\/hidden\/(progress_watched|calendar)$/, // hideItemTrakt
    /^\/users\/hidden\/(progress_watched|calendar)\/remove$/, // unhideItemTrakt
    /^\/users\/[^/]+\/follow$/, // followTraktUser
    /^\/users\/requests\/\d+$/, // approveFollowRequest
  ],
  DELETE: [
    /^\/users\/[^/]+\/follow$/, // unfollowTraktUser
    /^\/users\/requests\/\d+$/, // denyFollowRequest
  ],
  // PUT handler'ı `server.js`'te bilinçli olarak duruyor (GET/POST/DELETE ile
  // simetrik, genel amaçlı köprü) ama BUGÜN hiçbir istemci çağrısı yok —
  // `PUT /users/settings` Trakt'ın public API'sinde 401 döndüğü için istemci
  // kodu kaldırılmıştı (HISTORY Madde 134). Liste bilerek BOŞ: handler ayakta
  // kalır, fakat beyaz listeye bir uç eklenene kadar hiçbir isteği geçirmez.
  PUT: [],
};

const isTraktEndpointAllowed = (method, endpoint) => {
  const patterns = TRAKT_ENDPOINT_ALLOWLIST[method];
  if (!patterns) return false;
  return patterns.some((pattern) => pattern.test(endpoint));
};

/**
 * `/api/trakt-proxy`'nin DÖRT handler'ının (GET/POST/DELETE/PUT) ortak kapısı.
 *
 * Kontrolü tek bir `app.use()` ile bağlamak, aynı beş satırı dört handler'a
 * kopyalamaktan bilinçli olarak tercih edildi (AI_RULES §1). Handler'ların
 * kendi `endpoint` normalizasyonuna DOKUNULMADI — buradaki normalizasyon
 * yalnızca beyaz liste karşılaştırması için yapılır ve `req.query`'yi
 * değiştirmez, yani handler davranışı aynı kalır.
 */
const traktProxyGuard = (req, res, next) => {
  const raw = req.query.endpoint;
  if (!raw || typeof raw !== 'string') {
    // Handler'lar da aynı kontrolü yapıyor; burada erken dönmek beyaz liste
    // testinin `undefined` üzerinde çalışmasını engellemek içindir.
    return res.status(400).json({ error: 'Endpoint is required' });
  }

  const endpoint = raw.startsWith('/') ? raw : '/' + raw;

  if (!isTraktEndpointAllowed(req.method, endpoint)) {
    return res.status(403).json({
      error: 'Forbidden',
      details:
        req.method + ' ' + endpoint + ' bu proxy uzerinden gecmeye izinli degil.',
    });
  }

  return next();
};

// --------------------------------------------------------------------------
// `/api/trakt` (OAuth token) — redirect_uri beyaz listesi
// --------------------------------------------------------------------------
// Bu uç `client_secret` ile token üretir; `redirect_uri` istemciden gelip
// doğrudan Trakt'a iletiliyordu.
//
// ⚠️ `urn:ietf:wg:oauth:2.0:oob` LİSTEDEN ÇIKARILAMAZ: token YENİLEME bu
// değeri kullanıyor (services/api/traktClient.ts, iki çağrı noktası).
// Listeden düşerse hiçbir kullanıcının oturumu yenilenemez ve HERKES oturumdan
// düşer. Aşağıdaki değerler koddan ölçüldü, varsayılmadı.
const isAllowedRedirectUri = (uri) => {
  if (typeof uri !== 'string' || uri.length === 0) return false;
  if (uri === 'urn:ietf:wg:oauth:2.0:oob') return true; // token yenileme
  if (uri.startsWith('kaymak://')) return true; // native derin bağlantı
  if (uri === 'https://kaymaktv.com') return true;
  if (uri.startsWith('https://kaymaktv.com/')) return true; // web (makeRedirectUri)
  if (ALLOW_DEV_ORIGINS) {
    if (uri.startsWith('exp://')) return true;
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(uri)) return true;
  }
  return false;
};

/**
 * `/api/trakt` (OAuth token) kapısı — yalnızca `redirect_uri` GÖNDERİLMİŞSE
 * doğrular.
 *
 * ⚠️ Yokluğu hata DEĞİL: `server.js` gönderilmeyen `redirect_uri` için
 * `kaymak://settings` varsayılanını kullanıyor. Burada yokluğu reddetmek,
 * bugün çalışan bir yolu sebepsiz kırardı.
 */
const redirectUriGuard = (req, res, next) => {
  const redirectUri = req.body?.redirect_uri;
  if (redirectUri === undefined || redirectUri === null) return next();

  if (!isAllowedRedirectUri(redirectUri)) {
    return res.status(400).json({
      error: 'Invalid redirect_uri',
      details: 'Bu redirect_uri bu uygulama icin izinli degil.',
    });
  }

  return next();
};

// Başlangıçta hangi güvenlik modunda çalışıldığını GÖRÜNÜR kıl — sessiz
// yanlış yapılandırma bu projede daha önce pahalıya mal oldu.
const logSecurityMode = () => {
  console.log('🔒 Proxy korumasi: CORS beyaz listesi + rate limit + Trakt uc beyaz listesi');
  console.log(
    '   Gelistirme kaynaklari (localhost / exp://): ' +
      (ALLOW_DEV_ORIGINS
        ? 'ACIK (ALLOW_DEV_ORIGINS=1) -- CANLIDA BOYLE BIRAKMA!'
        : 'KAPALI')
  );
  // NODE_ENV artık CORS kalkanını etkilemiyor (Madde 233), ama Express'in
  // kendi prod optimizasyonlarını hâlâ etkiliyor — o yüzden ayrıca basılıyor.
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || '(set edilmemis)'}`);
};

module.exports = {
  corsMiddleware,
  tmdbLimiter,
  traktProxyLimiter,
  traktCatalogLimiter,
  traktAuthLimiter,
  traktProxyGuard,
  redirectUriGuard,
  logSecurityMode,
  // Yalnızca test/denetim için dışa veriliyor — `server.js` bunları doğrudan
  // kullanmaz, guard'ların içinden çağrılır.
  isTraktEndpointAllowed,
  isAllowedRedirectUri,
};
