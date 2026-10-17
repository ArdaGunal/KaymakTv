// ==========================================================================
// /api/trakt-proxy GET — trend ve arama ÖNBELLEKTEN  (K5 · M533)
// ==========================================================================
// NEDEN BURADA (istemcide değil): trend (`/shows|movies/trending`) ve arama
// (`/search/show|movie`) istemciden `/api/trakt-proxy` ile geliyor; saf geçişti,
// her istek Trakt'a gidiyordu. Bu katman AYNI ucun önüne girer — istemci
// değişmez, ESKİ APK'lar da önbellekten yararlanır. Diğer bütün proxy yolları
// (kullanıcıya özel `/users/*`) `next()` ile eski işleyiciye AYNEN geçer.
//
// 🔒 Bu iki uç PUBLIC: `Authorization` okunmaz, Trakt'a gönderilmez
// (`createTraktCatalogFetcher` yapısal olarak gönderemez). Önbellek anahtarına
// yalnız izinli parametreler girer; arama metninin yalnız BOŞLUKLARI sadeleşir.
// 🔴 M535: harf KÜÇÜLTÜLMEZ. İlk sürüm «Trakt büyük/küçük harf ayırmıyor» diye
// küçültüyordu («Dark»/«dark» ölçümü tesadüfen aynıydı). Canlı turda yakalandı:
// Trakt «Severance» → 1, «severance» → 0, «SEVERANCE» → 1 sonuç döndürüyor —
// küçültmek, kullanıcının «Severance» aramasını «Sonuç Bulunamadı» yapıyordu.
// Kural: Trakt'a kullanıcının yazdığı metin AYNEN gider.
//
// 🔴 BAŞARISIZLIK MERDİVENİ:
//   1. LazyFetch (bellek → SSD → Trakt; Trakt çökerse 24 saate kadar eski liste)
//   2. KENDİ kapımız kapalıysa (Trakt kovası 2/sn doldu ya da devre açık) →
//      bugünkü davranış: doğrudan Trakt. K3'ün dersi — kendi sınırımız yüzünden
//      kullanıcıya hata vermeyiz (hızlı yazılan arama kovayı doldurabilir).
//   3. Hâlâ başarısızsa ve ARAMA ise → arşivden yerel başlık araması
//      (`x-lazyfetch: archive-search`).
//   4. Hiçbiri yoksa hata, eski işleyiciyle aynı biçimde.

const axios = require('axios');
const { resolveRequest } = require('./lazyfetch/orchestrator');
const { createTraktCatalogFetcher } = require('./lazyfetch/providers/trakt');
const { CircuitOpenError, RateLimitedError } = require('./lazyfetch/errors');
const { yerelAra } = require('./archive/yerelArama');

const ONBELLEKLI = /^\/(?:(shows|movies)\/trending|search\/(show|movie))$/;
const IZINLI_PARAMETRE = ['extended', 'page', 'limit', 'query'];

/** Önbellek anahtarına girecek sade sorgu — bilinmeyen parametre anahtarı şişiremez. */
function sadeSorgu(query) {
  const sade = {};
  for (const k of IZINLI_PARAMETRE) {
    const v = query[k];
    if (typeof v !== 'string' || !v.length) continue;
    sade[k] = k === 'query' ? v.trim().replace(/\s+/g, ' ') : v;
  }
  return sade;
}

/**
 * 🔴 M535 — BOŞ ARAMA SONUCU SAKLANMAZ. Trakt aynı sorguya zaman zaman boş liste
 * döndürüyor (canlı: «severance» 0, «Severance» 1). Boş listeyi 24 saat «sonuç yok»
 * diye servis etmek, geçici bir boşluğu kalıcılaştırırdı. `storable:false` →
 * orkestratör yazmaz (`x-lazyfetch: no-store`), sonraki arama Trakt'a yeniden sorar.
 */
function bosAramayiSaklama(fetcher) {
  return async (yol, sorgu) => {
    const sonuc = await fetcher(yol, sorgu);
    if (Array.isArray(sonuc.data) && sonuc.data.length === 0) return { ...sonuc, storable: false };
    return sonuc;
  };
}

async function dogrudanTrakt(endpoint, sorgu, clientId) {
  const yanit = await axios.get(`https://api.trakt.tv${endpoint}`, {
    params: sorgu,
    headers: { 'Content-Type': 'application/json', 'trakt-api-version': '2', 'trakt-api-key': clientId },
    timeout: 15000,
  });
  return yanit.data;
}

async function onbellekliTraktGet(req, res, next) {
  const ham = req.query.endpoint;
  const endpoint = typeof ham === 'string' ? (ham.startsWith('/') ? ham : `/${ham}`) : '';
  const eslesme = ONBELLEKLI.exec(endpoint);
  const clientId = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID;
  if (!eslesme || !clientId) return next();

  const sorgu = sadeSorgu(req.query);
  const aramaTuru = eslesme[2] || null;
  if (aramaTuru && !sorgu.query) return res.json([]);

  let hata;
  try {
    const sonuc = await resolveRequest({
      provider: 'trakt', path: endpoint, query: sorgu,
      fetcher: aramaTuru ? bosAramayiSaklama(createTraktCatalogFetcher(clientId)) : createTraktCatalogFetcher(clientId),
    });
    if (sonuc.status === 'not-found') return res.status(404).json({ error: 'Resource not found' });
    res.setHeader('x-lazyfetch', sonuc.status);
    return res.json(sonuc.data);
  } catch (error) {
    hata = error;
  }

  if (hata instanceof RateLimitedError || hata instanceof CircuitOpenError) {
    try {
      const veri = await dogrudanTrakt(endpoint, sorgu, clientId);
      res.setHeader('x-lazyfetch', 'passthru-kapi');
      return res.json(veri);
    } catch (error) {
      hata = error;
    }
  }

  if (aramaTuru) {
    const yerel = await yerelAra(aramaTuru, sorgu.query);
    if (yerel.length) {
      console.error(`[trakt-proxy] Trakt aramasi basarisiz, ARSIVDEN yerel arama (${aramaTuru}, ${yerel.length} sonuc): ${hata.message}`);
      res.setHeader('x-lazyfetch', 'archive-search');
      return res.json(yerel);
    }
  }

  console.error('Error in Trakt proxy (onbellekli):', hata.response?.data || hata.message);
  return res.status(hata.response?.status || 503).json({
    error: hata.response?.data || 'Service Unavailable',
    details: hata.message,
  });
}

module.exports = onbellekliTraktGet;
module.exports.sadeSorgu = sadeSorgu;
module.exports.ONBELLEKLI = ONBELLEKLI;
