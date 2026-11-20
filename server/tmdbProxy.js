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
const { resolveRoute } = require('./lazyfetch/routeRegistry');

const router = express.Router();

// 🆕 G-11 (v1.0.2 Paket 1): YOL + PARAMETRE İZİN LİSTESİ. Eskiden yol normalize edilip kalan
// her query TMDB'ye gidiyordu; rota listesinde olmayan yol PASSTHRU oluyordu ve `session_id` gibi
// parametreler upstream'e giderken önbellek anahtarından siliniyordu (anahtar çakışması).
// Liste istemcinin GERÇEK çağrılarından (`services/tmdbApi.ts`, `tmdbPerson.ts`, `tmdbBasliklari.ts`):
// 9 yol biçiminin hepsi `routeRegistry` TMDB rotalarında, tek parametre `language`.
// `append_to_response` istemcide kullanılmıyor → izinli değil. İzin dışı her şey 400 (Trakt
// katalog geçidiyle aynı desen; gövde kısa, ayrıntı yok).
const IZINLI_PARAMETRE = new Set(['endpoint', 'language']);
// BCP 47 dil etiketi (`en-US`, `tr-TR`; ileride `pt-BR`, `zh-Hant`). Ayraç karakteri giremez.
const DIL_DESENI = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;
const YOL_UZUNLUK_TAVANI = 200;

/**
 * İstemci sorgusunu izin listesine göre denetler. Saf; ağ ve önbelleğe dokunmaz.
 * @returns {{ ok: true, endpoint: string, query: Object } | { ok: false }}
 */
function tmdbIstegiDenetle(sorgu) {
  if (!sorgu || typeof sorgu !== 'object') return { ok: false };
  for (const ad of Object.keys(sorgu)) {
    if (!IZINLI_PARAMETRE.has(ad)) return { ok: false };
  }
  let endpoint = sorgu.endpoint;
  if (typeof endpoint !== 'string' || !endpoint || endpoint.length > YOL_UZUNLUK_TAVANI) return { ok: false };
  if (!endpoint.startsWith('/')) endpoint = '/' + endpoint;
  if (!resolveRoute('tmdb', endpoint).cacheable) return { ok: false };

  const query = {};
  if (sorgu.language !== undefined) {
    if (typeof sorgu.language !== 'string' || !DIL_DESENI.test(sorgu.language)) return { ok: false };
    query.language = sorgu.language;
  }
  return { ok: true, endpoint, query };
}

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

    // 🆕 M558 · D-9: TİP kontrolü — `?endpoint=a&endpoint=b` dizi olarak gelir; `startsWith` TypeError →
    // 500 ve iç hata mesajı dışarı sızıyordu. Diğer köprüler gibi yalnız dize kabul edilir.
    if (!req.query.endpoint || typeof req.query.endpoint !== 'string') {
      return res.status(400).json({ error: 'Endpoint is required' });
    }

    // 🆕 G-11: izin dışı yol/parametre upstream'e ve önbelleğe HİÇ ulaşmaz.
    const denetim = tmdbIstegiDenetle(req.query);
    if (!denetim.ok) {
      return res.status(400).json({ error: 'Bad request' });
    }

    // LazyFetch: yol artık her zaman rota listesinde (yukarıdaki denetim). SSD
    // kapalıysa `resolveRequest` SESSİZCE sağlayıcıya gider; kimliksiz/misafir
    // istekler de dahil TÜM istekler aynı şekilde işlenir (cache kullanıcı
    // kimliğine hiç bakmaz — kimlik parametresi zaten buraya giremez).
    const result = await resolveRequest({
      provider: 'tmdb',
      path: denetim.endpoint,
      query: denetim.query,
      fetcher: createTmdbFetcher(tmdbApiKey),
    });

    // 🆕 (L4, negatif cache): sağlayıcı "bu kaynak yok" dediğinde (veya
    // negatif cache'ten aynı bilgi geldiğinde) gerçek TMDB 404'üyle AYNI
    // status kodu dönülür — istemcinin 404 işleme mantığı (ör. "içerik
    // bulunamadı" ekranı) farksız çalışmaya devam eder.
    if (result.status === 'not-found') {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // 🆕 Teşhis başlığı — `/api/trakt-catalog` ile SİMETRİ (Madde 261).
    // Bu başlık olmadığı için TMDB tarafında "önbellek isabet etti mi"
    // sorusu yalnızca süreyle ölçülebiliyordu; internet üzerinden yapılan
    // ölçümde ağ gecikmesi 2 ms'lik kazancı tamamen gizliyor ve YANLIŞ
    // sonuca götürüyor (bu tam olarak yaşandı). Davranışı etkilemez.
    res.setHeader('x-lazyfetch', result.status);
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
// Yalnız test/denetim için — `server.js` yalnız router'ı bağlar.
module.exports.tmdbIstegiDenetle = tmdbIstegiDenetle;
