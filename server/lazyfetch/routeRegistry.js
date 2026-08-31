// ==========================================================================
// LAZYFETCH — Rota Kayıt Defteri (L2, dosya 1/2)
// ==========================================================================
// TEK İŞİ: "Bu istek cache'lenir mi, hangi aileye ait, TTL/grace sınırları
// ne olmalı?" sorusunun TEK karar noktası olmak.
//
// 🔴 KALIPLAR UYDURULMADI — `services/tmdbApi.ts`'teki (istemci) GERÇEK
// `fetchFromTmdb()` çağrılarından çıkarıldı (2026-08-28 taraması, 8 farklı
// uç): `/tv/:id`, `/movie/:id`, `/tv/:id/images`, `/tv/:id/videos`,
// `/movie/:id/videos`, `/tv/:id/season/:s/episode/:e`, `/:type/:id/credits`,
// `/tv/:id/season/:s/episode/:e/credits`. Buradaki listenin dışında kalan
// HER path otomatik olarak PASSTHRU'dur — beyaz liste mantığı (bilinmeyen
// bir uca "belki cache'lenir" denmez).
//
// 🆕 TTL BURADA SABİT YAZILMAZ (docs/Lazy Down Plan/01_MIMARI.md kural 1 +
// 04_KARARLAR.md A3): TMDB de Trakt gibi HER yanıtta kendi `Cache-Control:
// max-age=N`'ini söylüyor (canlı ölçüldü, 2026-08-28: `/tv/1396` →
// max-age=3760, `/tv/1396/credits` → max-age=10870 — sabit DEĞİL, isteğe
// göre değişiyor). Bu yüzden route registry yalnızca bir GÜVENLİK AĞI
// (taban/tavan `clamp`) taşır — 04_KARARLAR.md A3 kararı (c): sağlayıcı
// anormal bir değer dönerse (çok kısa/çok uzun) kırpılır, normal şartlarda
// sağlayıcının kendi değeri kullanılır. Gerçek TTL kararı orchestrator.js'te
// `clampTtl()` ile, sağlayıcı yanıtının header'ına göre verilir.
//
// 🆕 TMDB'de 304 (`If-None-Match`) ÇALIŞIYOR (canlı ölçüldü, Trakt'ın
// tersine) — bu dosyada henüz KULLANILMIYOR, L5'in (SWR) revalidation'ında
// bant genişliği tasarrufu için değerlendirilecek (04_KARARLAR.md B2 artık
// kapalı: TMDB'de çalışıyor, Trakt'ta çalışmıyor).
//
// `gracePeriodMultiplier` (bayatlık tavanı) bir BAŞLANGIÇ değeridir — kesin
// sayı telemetry olmadan iddia edilmez (04_KARARLAR.md B: "gerçek sayılar
// ölçülmeden belirlenmez"). Amacı yalnızca "taze TTL'in birkaç katı kadar
// bayat veriyi servis etmeye devam et" oranını sabitlemek; L6'da gerçek
// kullanım verisiyle ayarlanacak.

const GUN_MS = 24 * 60 * 60 * 1000;

// ==========================================================================
// 🆕 L8 — KATALOG ÖMRÜ POLİTİKASI (2026-09-01)
// ==========================================================================
// 🔴 BU, L3'TEKİ BİR KARARI BİLİNÇLİ OLARAK TERSİNE ÇEVİRİR.
// Eski kural (`00_BULGULAR.md §2`): *"TTL'i tahmin etmemize gerek yok,
// sağlayıcının kendi beyanı var."* Trakt `s-maxage=43200` (12 sa), TMDB
// `max-age≈3760` (1 sa) diyordu ve biz onlara uyuyorduk.
//
// NEDEN DEĞİŞTİ: sağlayıcının verdiği süre, RASTGELE bir CDN için konulmuş
// muhafazakâr bir varsayılandır. Biz kendi donanımımızdaki paylaşımlı bir
// önbelleğiz ve sakladığımız verinin ne olduğunu biliyoruz: 2008 yapımı
// "Breaking Bad"in bölüm listesi ya da "The Godfather"ın künyesi YILLARCA
// değişmez. İki günlük veriye "süresi dolmuş" muamelesi etmek Pi'yi boşuna
// yorar ve sağlayıcı kotasını gereksiz tüketir.
//
// 🔴 SAĞLAYICI YOK SAYILMIYOR, TABAN OLARAK ALINIYOR: nihai TTL
// `max(sağlayıcının dediği, bizim politikamız)`. Sağlayıcı bizden UZUN bir
// süre söylerse ona uyarız; kısa söylerse kendi bilgimizi kullanırız.
// `no-store`/`private` ise HÂLÂ MUTLAK VETO'dur (providers/cacheControl.js
// `isStorable`) — orada hiçbir şey değişmedi.
//
// Üç bölge (envelope.js'in fresh/stale/expired'ıyla birebir eşleşir):
//   🟢  0-30 gün   TAZE     → SSD'den dön, ağa ÇIKMA
//   🟡 30-180 gün  BAYAT    → SSD'den HEMEN dön + arkada sessiz yenile (SWR)
//   🔴 180 gün+    DOLMUŞ   → ağdan taze veri zorunlu (sağlayıcı çökerse
//                             grace fallback yine eski veriyi döner)
const KATALOG_TAZE_MS = 30 * GUN_MS;
const KATALOG_TOPLAM_MS = 180 * GUN_MS;

// 🔴 YAYINI SÜREN DİZİLER İSTİSNA. "House of the Dragon" haftalık yeni
// bölüm alıyor; sezon listesini 30 gün taze saymak, kullanıcıya bir ay
// boyunca eksik bölüm listesi göstermek olurdu.
const YAYINDA_TAZE_MS = 7 * GUN_MS;

// "Yayını sürüyor" ölçütü — ÖLÇÜLDÜ (2026-09-01, gerçek Trakt verisi):
//   house-of-the-dragon → son bölüm 20 gün ÖNCE
//   the-simpsons        → son bölüm 28 gün SONRA (gelecek tarihli)
//   breaking-bad        → son bölüm 4.660 gün önce
//   severance           → son bölüm 528 gün önce (sezon arası)
// 90 gün eşiği ilk üçünü doğru ayırıyor. Sezon arasındaki bir dizi (severance)
// uzun TTL alır — doğrusu da bu: yeni sezon duyurulana kadar veri değişmez,
// duyurulduğunda da 30 gün içindeki ilk görüntülemede SWR yakalar.
const YAYINDA_ESIK_MS = 90 * GUN_MS;

const TTL_FLOOR_MS = 60 * 1000; // 1 dakika — sağlayıcı anormal derecede kısa bir max-age dönerse taban
// 🆕 L8: 7 gündü. O tavan, 30 günlük tazelik politikasını sessizce 7 güne
// KIRPARDI — yani değişikliğin hiçbir etkisi olmazdı ve testler yeşil kalırdı.
const TTL_CEILING_MS = KATALOG_TOPLAM_MS;
const DEFAULT_TTL_MS = 60 * 60 * 1000; // sağlayıcı hiç Cache-Control döndürmezse (uç durum) kullanılan yedek
const DEFAULT_GRACE_MULTIPLIER = 4; // yalnızca politika DIŞI (beyaz liste dışı) durumlar için

// 🆕 (L5, "grace tavanı sınırlı" — 03_FAZLAR.md): çarpanın MUTLAK tavanı.
// Çarpan tek başına sınırsızdı: `TTL_CEILING_MS` 7 gün olduğu için sağlayıcı
// uzun bir `max-age` dönerse grace 28 güne kadar çıkabiliyordu — yani bir ay
// önceki veriyi "bayat ama sorun değil, arkada yenilerim" diye ANINDA servis
// ederdik. Bu, sessiz bir veri çürümesidir.
//
// 🔴 KESİNTİ DAYANIKLILIĞINI DÜŞÜRMEZ — sık yapılan karıştırma bu. Grace
// penceresi yalnızca "beklemeden servis et + arkada yenile" bölgesini
// tanımlar. Pencere bittiğinde veri SİLİNMEZ: istek sağlayıcıya gider,
// sağlayıcı çökmüşse orchestrator'ın GRACE FALLBACK yolu aynı eski zarfı
// yine döner (orchestrator.js `resolveRequest` catch bloğu). Yani tavan,
// "TMDB 3 gün çökerse kullanıcı boş ekran görür" anlamına GELMEZ; yalnızca
// çok eski veriyi kontrol etmeden dağıtmayı bırakırız.
// 🆕 L8: 24 SAATTİ. Katalog politikası 30 gün taze + 150 gün bayat istiyor;
// 24 saatlik tavan o 150 günü sessizce 1 güne kırpardı. Yeni tavan, toplam
// servis edilebilir pencerenin (180 gün) kendisidir.
//
// ⚠️ Bu, "sessiz veri çürümesi" endişesini geçersiz KILMAZ — yalnızca
// eşiğini bilinçli olarak taşır. Fark şu: 150 günlük bayat pencere, veriyi
// GÖRMEZDEN gelmek değil; her görüntülemede arkada yenileme tetikleniyor
// (SWR). Yani gerçekte hiçbir kayıt 150 gün eski kalmaz — yalnızca
// İSTENMEYEN kayıtlar eskir, onları da süpürücü eler.
const GRACE_CEILING_MS = KATALOG_TOPLAM_MS;

// 🆕 (L4, negatif cache): "kaynak yok" (404) bilgisinin ne kadar saklanacağı.
// Sağlayıcıdan bir `max-age` gelmiyor (404 yanıtının kendi TTL'i yok) — bu
// yüzden route registry'nin normal `resolveTtl()`'inden AYRI, sabit bir
// değer. Lazy_down.txt'teki AI önerisi ("404 için 10 dakika") başlangıç
// noktası — L6 telemetry ile ayarlanabilir. Grace kısa tutuldu (TTL'in
// yalnızca katı) çünkü negatif bir kaydın uzun süre "yok" demeye devam
// etmesi istenmez (TMDB'ye içerik sonradan eklenebilir).
const NEGATIVE_TTL_MS = 10 * 60 * 1000; // 10 dakika
const NEGATIVE_GRACE_MS = 10 * 60 * 1000; // +10 dakika (toplam 20 dakika sonra tamamen düşer)

// Path kalıpları — ID'ler zaten `key.js`'in hash'ine gireceği için burada
// yalnızca "bu path hangi AİLEye ait" ayrımını yapıyoruz, ID'nin kendisini
// yakalamaya gerek yok (`\d+` yeterli, capture group gerekmez).
const TMDB_ROUTES = [
  { family: 'tv_detail', regex: /^\/tv\/\d+$/ },
  { family: 'movie_detail', regex: /^\/movie\/\d+$/ },
  { family: 'tv_images', regex: /^\/tv\/\d+\/images$/ },
  { family: 'tv_videos', regex: /^\/tv\/\d+\/videos$/ },
  { family: 'movie_videos', regex: /^\/movie\/\d+\/videos$/ },
  { family: 'episode_detail', regex: /^\/tv\/\d+\/season\/\d+\/episode\/\d+$/ },
  { family: 'credits', regex: /^\/(tv|movie)\/\d+\/credits$/ },
  { family: 'episode_credits', regex: /^\/tv\/\d+\/season\/\d+\/episode\/\d+\/credits$/ },
];

// 🆕 L7 — TRAKT KATALOG ROTALARI.
//
// 🔴 TEK UÇLA BAŞLANIYOR (03_FAZLAR.md L7 adım 4: "tek uçla başla, sonra
// genişlet"). Sebep: L7 istemci değişikliği gerektiren İLK faz, yani geri
// alması L1-L6 gibi tek satır değil. Yüzeyi dar tutmak, bir sorun çıkarsa
// etkilenen yolu da dar tutar.
//
// Neden ÖNCE `/shows/:id/seasons`: en yüksek getirili uç. Canlı ölçüm
// (2026-08-29, Breaking Bad): 63.627 bayt ham / 12.947 bayt gzip, 0,48 s.
// Üstelik kullanıcının "sezon ve bölüm bilgileri de iniyor mu?" sorusunun
// cevabındaki eksik parça tam olarak buydu (Madde 256).
//
// 🔴 YALNIZCA PUBLIC KATALOG. Bu listeye kullanıcıya özel HİÇBİR uç
// (`/users/*`, `/sync/*`, `/calendars/my/*`) eklenemez — `02_ENVANTER.md`
// gizlilik sınırı. Adaptör zaten `Authorization` göndermediği için böyle
// bir uç eklense de çalışmazdı, ama kural burada da yazılı olsun.
// 🆕 L7+ (2026-08-29) — TEK UÇTAN SEKİZ UCA. L7 bilinçli olarak tek uçla
// (`show_seasons`) başlamıştı; kalıp üretimde kanıtlandıktan sonra
// (18 gerçek kayıt SSD'de, istemci trafiğiyle) yüzey genişletildi.
//
// Liste UYDURULMADI — `services/api/shows.ts` ve `movies.ts`'te bugün
// `getTraktClient()` ile DOĞRUDAN `api.trakt.tv`'ye giden public katalog
// çağrıları tarandı (2026-08-29). Kapsam dışında bilinçli bırakılanlar:
//   • `/search/:type` — her sorgu ayrı anahtar üretir (sonsuz kardinalite),
//     önbellek şişer, isabet oranı düşük kalır. Ölçüm olmadan açılmaz.
//   • yorumlar (`/comments/*`) — sosyal veri, sık değişir, katalog değil.
//   • `/users/*`, `/sync/*`, `/calendars/my/*` — kullanıcıya ÖZEL, bu
//     listeye ASLA giremez (02_ENVANTER.md gizlilik sınırı).
//
// 🔴 ÇIPLAK DETAY UÇLARINDA `:id` YALNIZCA SAYISAL — sebebi bir çakışma:
// `/shows/[A-Za-z0-9-]+` deseni `/shows/trending`, `/shows/popular`,
// `/shows/anticipated` gibi LİSTE uçlarını da yakalardı. O uçlar public
// olduğu için güvenlik açığı değil, ama sessiz bir DOĞRULUK hatası olurdu:
// bir trend listesi `show_detail` ailesine yazılır ve o ailenin TTL'iyle
// (Trakt trending'e `s-maxage=3600`, detaya `43200` diyor) servis edilirdi.
// Sayısal kısıt bu çakışmayı desen düzeyinde İMKÂNSIZ kılar; istemci de
// zaten yalnızca sayısal ID gönderiyor (`useMovieDetail.ts:114` → `traktIdNum`).
// Slug'la gelen bir istek beyaz listeye takılmaz → istemci eski yola düşer.
//
// Alt kaynaklarda (`/related`, `/people`, `/seasons`) slug SERBEST: orada
// çakışacak bir liste ucu yok (`/shows/trending/related` diye bir uç
// Trakt'ta yok, 404 döner → negatif cache, zararsız).
const TRAKT_ROUTES = [
  // --- Diziler ---
  { family: 'show_detail', regex: /^\/shows\/\d+$/ },
  // `:id` hem sayısal Trakt ID hem slug olabilir (`1388` veya `breaking-bad`)
  // — istemci ikisini de kullanıyor. Slug karakter kümesi dar tutuldu.
  { family: 'show_seasons', regex: /^\/shows\/[A-Za-z0-9-]+\/seasons$/ },
  { family: 'show_related', regex: /^\/shows\/[A-Za-z0-9-]+\/related$/ },
  { family: 'show_people', regex: /^\/shows\/[A-Za-z0-9-]+\/people$/ },
  // Trakt'ın yolu ÇOĞUL: `/seasons/1/episodes/1` (TMDB'de `/season/1/episode/1`).
  { family: 'episode_detail', regex: /^\/shows\/[A-Za-z0-9-]+\/seasons\/\d+\/episodes\/\d+$/ },
  // --- Filmler ---
  { family: 'movie_detail', regex: /^\/movies\/\d+$/ },
  { family: 'movie_related', regex: /^\/movies\/[A-Za-z0-9-]+\/related$/ },
  { family: 'movie_people', regex: /^\/movies\/[A-Za-z0-9-]+\/people$/ },
];

const PROVIDER_ROUTES = {
  tmdb: TMDB_ROUTES,
  trakt: TRAKT_ROUTES,
};

/**
 * Bir isteğin cache politikasını çözer.
 *
 * @param {string} provider  'tmdb' (şimdilik tek geçerli değer)
 * @param {string} rawPath   `/tv/1396` gibi normalize edilmemiş path
 * @returns {{ cacheable: boolean, family: string|null }}
 *   `cacheable: false` → PASSTHRU, orchestrator cache'e hiç dokunmadan
 *   doğrudan sağlayıcıya gider. Bilinmeyen provider da PASSTHRU sayılır
 *   (beyaz liste dışına "belki" denmez).
 */
function resolveRoute(provider, rawPath) {
  const routes = PROVIDER_ROUTES[provider];
  if (!routes) return { cacheable: false, family: null };

  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const match = routes.find((r) => r.regex.test(normalizedPath));
  if (!match) return { cacheable: false, family: null };

  return { cacheable: true, family: match.family };
}

/**
 * Sağlayıcının `Cache-Control: max-age=N` değerini (saniye) taban/tavan
 * arasına kırpar ve grace süresini oranlar. Sağlayıcı hiç header
 * vermezse (`providerMaxAgeSeconds` null/undefined) `DEFAULT_TTL_MS` kullanılır.
 */
/**
 * 🆕 L8 — Bu yanıt, yayını SÜREN bir diziye mi ait?
 *
 * İki aile için iki ayrı kanıt kullanılır; ikisi de yanıtın KENDİ İÇİNDE
 * var, ek istek gerekmez:
 *   • `show_detail` → Trakt'ın `status` alanı (ölçüldü: `"ended"`,
 *     `"returning series"`, `"in production"`, `"planned"`)
 *   • `show_seasons` → en SON bölümün yayın tarihi. `status` bu yanıtta YOK
 *     (ölçüldü), ama her bölümün `first_aired`'ı var. Gelecek tarihli ya da
 *     son 90 gün içindeki bir bölüm varsa dizi aktif yayındadır.
 *
 * Tanımadığı her şeyde `false` döner — yani şüphede UZUN TTL değil, güvenli
 * taraf olan kısa TTL'e DEĞİL, varsayılan politikaya düşer. (Yanlış "yayında"
 * demek yalnızca gereksiz yenileme üretir; yanlış "bitmiş" demek kullanıcıya
 * eksik bölüm listesi gösterir — bu yüzden şüphelenilen durumlar kısa
 * tarafta bırakıldı.)
 */
function yayindaMi(family, data, now = Date.now()) {
  if (!data) return false;

  if (family === 'show_detail') {
    const durum = String(data.status || '').toLowerCase();
    return durum === 'returning series' || durum === 'in production' || durum === 'planned';
  }

  if (family === 'show_seasons') {
    if (!Array.isArray(data)) return false;
    let enSon = 0;
    for (const sezon of data) {
      for (const bolum of (sezon && sezon.episodes) || []) {
        if (!bolum || !bolum.first_aired) continue;
        const t = Date.parse(bolum.first_aired);
        if (Number.isFinite(t) && t > enSon) enSon = t;
      }
    }
    if (!enSon) return false;
    // Gelecek tarihli (henüz yayınlanmamış) bölüm de "yayında" sayılır.
    return enSon > now - YAYINDA_ESIK_MS;
  }

  return false;
}

/**
 * TTL ve grace süresini çözer.
 *
 * 🆕 L8: artık yalnızca sağlayıcının `max-age`'ine bakmıyor — aileyi ve
 * yanıtın kendisini de görüyor (dosya başındaki KATALOG ÖMRÜ POLİTİKASI).
 *
 * @param {number|undefined} providerMaxAgeSeconds Sağlayıcının beyanı
 * @param {Object} [ctx]
 * @param {string} [ctx.family] Beyaz listedeki aile adı
 * @param {*}      [ctx.data]   Sağlayıcı yanıtı (yayında mı tespiti için)
 */
function resolveTtl(providerMaxAgeSeconds, { family = null, data = null } = {}) {
  const saglayici =
    typeof providerMaxAgeSeconds === 'number' && providerMaxAgeSeconds > 0
      ? providerMaxAgeSeconds * 1000
      : 0;

  // Politika yalnızca BEYAZ LİSTEDEKİ katalog aileleri için geçerli.
  // Bilinmeyen bir aile (ya da aile bilgisi hiç verilmemişse) eski
  // davranışta kalır — geriye dönük güvenli.
  const politikaVar = !!family;

  if (!politikaVar) {
    const raw = saglayici || DEFAULT_TTL_MS;
    const ttlMs = Math.min(Math.max(raw, TTL_FLOOR_MS), TTL_CEILING_MS);
    return { ttlMs, graceMs: Math.min(ttlMs * DEFAULT_GRACE_MULTIPLIER, GRACE_CEILING_MS) };
  }

  const politikaTaze = yayindaMi(family, data) ? YAYINDA_TAZE_MS : KATALOG_TAZE_MS;

  // 🔴 SAĞLAYICI TABAN, POLİTİKA TABAN — hangisi UZUNSA o. Sağlayıcı bizden
  // uzun bir süre söylerse ona uyarız (o zaman bizden daha emin demektir).
  const ttlMs = Math.min(Math.max(saglayici, politikaTaze, TTL_FLOOR_MS), TTL_CEILING_MS);

  // Bayat pencere: toplam servis edilebilir süreye tamamlar.
  const graceMs = Math.max(0, Math.min(KATALOG_TOPLAM_MS - ttlMs, GRACE_CEILING_MS));

  return { ttlMs, graceMs };
}

module.exports = {
  resolveRoute,
  resolveTtl,
  NEGATIVE_TTL_MS,
  NEGATIVE_GRACE_MS,
  // Yalnızca test/teşhis için dışa veriliyor.
  yayindaMi,
  KATALOG_TAZE_MS,
  KATALOG_TOPLAM_MS,
  YAYINDA_TAZE_MS,
  YAYINDA_ESIK_MS,
  TTL_FLOOR_MS,
  TTL_CEILING_MS,
  DEFAULT_TTL_MS,
  DEFAULT_GRACE_MULTIPLIER,
  GRACE_CEILING_MS,
};
