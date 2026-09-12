// ==========================================================================
// KATALOG ARŞİVİ — Backfill Kaynağı (A3 Adım 2, dosya 1/2)
// ==========================================================================
// TEK İŞİ: "kullanıcılarımız hangi yapımları takip ediyor?" sorusunun
// cevabını Supabase'den okuyup ARŞİVİN ANLADIĞI hedef listesine çevirmek.
//
// 🔴 BU DOSYA ARŞİVİ TANIMAZ. Ne `db.js`'i ne `writer.js`'i require eder —
// yalnızca saf bir hedef dizisi döner. Eksik tespiti ve yazma
// `backfill.js`'in işi. (AI_RULES §1: UI/mantık ayrımının sunucu tarafı
// karşılığı — kaynak katmanı ile karar katmanı ayrı.)
//
// ==========================================================================
// 📏 ÖLÇÜLDÜ (2026-09-03, canlı Supabase)
// ==========================================================================
//   847 görünür aktivite · 6 kullanıcı
//   31 tekil DİZİ · 234 tekil FİLM · `show_id` NULL olan satır YOK
//
// Bu ölçüm planın çerçevesini değiştirdi: `03_FAZLAR.md` A3'ü "gece boyu
// hız sınırlı" bir iş olarak tarif ediyordu; gerçek evren 265 yapım, yani
// tr dilinde 296 uç isteği. Trakt kovası 2/sn — saatler değil, DAKİKALAR.
//
// ==========================================================================
// 🔴 `03_FAZLAR.md` YANLIŞ KOLONU SÖYLÜYOR — DÜZELTME BURADA
// ==========================================================================
// Plan "`feed_activities.tmdb_id`" diyor. Kullanılan kolon `show_id`'dir ve
// o zaten TRAKT ID'sidir (`supabase/schema/001_feed_schema.sql:67`,
// yorumu birebir: "Trakt show ID"). Bu bir ayrıntı değil, YÖN sorusudur:
// `identity.js` başlığı "TMDB yanıtları trakt ID taşımaz, bu yüzden A3
// backfill'in TRAKT tarafından başlaması gerekir" diyor. `show_id` tam
// olarak istediğimiz uçtur; `tmdb_id` üzerinden gitseydik önce Trakt'a
// arama isteği atıp kimliği çözmemiz gerekirdi — ekstra tur, ekstra kota.
//
// ⚠️ `show_id` FİLMLERDE DE KULLANILIYOR (adı yanıltıcı ama şema böyle):
// `media_type` 'movie' olduğunda `show_id` Trakt'ın FİLM kimliğidir.
// Ayrım `media_type` kolonundan yapılır, kimlikten DEĞİL — Trakt'ta dizi
// 1388 ile film 1388 farklı yapımlardır (`identity.js`'in `tmdb:show` /
// `tmdb:movie` ayrımıyla aynı tuzak).
//
// ==========================================================================
// 🔴 GÖRÜNÜRLÜK KÖRLÜĞÜ — BİLİNEN VE KABUL EDİLEN SINIR
// ==========================================================================
// `supabase/schema/027_moderation_visibility_rls.sql` SELECT politikasını
// `USING (is_visible)` yaptı. Anon anahtarla okuyoruz, yani moderasyonla
// gizlenmiş satırlar bu listede GÖRÜNMEZ. Sonuç: gizlenmiş bir aktivitenin
// yapımı arşive girmeyebilir. Kabul ediliyor çünkü alternatif `service_role`
// anahtarını Pi'ye koymaktı — arşiv gibi ikincil bir sistem için tam yetkili
// bir sır taşımak, kazanılan birkaç satıra değmez. (Anahtar zaten Worker'da.)
//
// ⚠️ Bu bir "eksik veri" değil, "eksik TALEP" — gizlenmiş bir yapımı bir
// kullanıcı yeniden açtığında canlı kanca (A2) onu zaten arşive yazar.

const VARSAYILAN_SAYFA = 1000;

/**
 * `feed_activities`'ten tekil (kimlik, tip) çiftlerini çeker.
 *
 * 🔴 SAYFALAMA ZORUNLU. PostgREST varsayılan tavanı 1000 satır ve
 * `Content-Range` başlığı olmadan bu sessizce KIRPILIR — "847 satır var,
 * hepsini aldık" sanıp aslında ilk 1000'i alıyor olurduk. Bugün 847 satır
 * var; tavanı bugünkü sayıya göre "yeterli" saymak, listenin büyüdüğü ilk
 * gün sessizce eksik backfill demekti (Madde 273'ün deseni: bugünkü sabite
 * göre karar verme).
 *
 * @param {Object} opts
 * @param {string} opts.url        Supabase proje URL'i
 * @param {string} opts.anonKey    Anon anahtar (RLS altında okur)
 * @param {Function} [opts.fetchImpl]  Test için enjekte edilebilir `fetch`
 * @param {number} [opts.sayfaBoyu]
 * @returns {Promise<{ok: boolean, items?: Array, satir?: number, reason?: string}>}
 *   items: `[{ traktId: '1388', type: 'show'|'movie' }]`
 */
async function fetchTakipEdilenler({ url, anonKey, fetchImpl = fetch, sayfaBoyu = VARSAYILAN_SAYFA } = {}) {
  if (!url || !anonKey) return { ok: false, reason: 'supabase_yapilandirmasi_eksik' };

  const taban = String(url).replace(/\/+$/, '');
  const gorulen = new Map(); // "show:1388" -> {traktId, type}
  let ofset = 0;
  let satir = 0;

  // Güvenlik freni: sayfalama bir gün ilerlemezse (sunucu `Range`'i yok
  // sayarsa) sonsuz döngüye girmeyelim.
  for (let tur = 0; tur < 100; tur++) {
    const istek = `${taban}/rest/v1/feed_activities?select=show_id,media_type&order=id.asc`;
    let yanit;
    try {
      yanit = await fetchImpl(istek, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          // PostgREST sayfalaması `Range` başlığıyla; `limit/offset` query'si
          // de olurdu ama `Range` `Content-Range` ile birlikte "kaç satır
          // KALDI"yı da söylüyor — kırpılmayı görebilmemizin tek yolu.
          Range: `${ofset}-${ofset + sayfaBoyu - 1}`,
        },
      });
    } catch (error) {
      return { ok: false, reason: `ag: ${error.message}` };
    }

    if (!yanit.ok && yanit.status !== 206) {
      return { ok: false, reason: `http ${yanit.status}` };
    }

    let veri;
    try {
      veri = await yanit.json();
    } catch (error) {
      return { ok: false, reason: `json: ${error.message}` };
    }
    if (!Array.isArray(veri)) return { ok: false, reason: 'beklenmeyen_yanit_bicimi' };

    for (const r of veri) {
      satir++;
      // `posted` tipi aktivitelerde `show_id` NULL olabilir (017'de NOT NULL
      // kaldırıldı) — bunlar bir yapıma bağlı değil, atlanır.
      if (r.show_id === null || r.show_id === undefined) continue;
      const tip = r.media_type === 'movie' ? 'movie' : 'show';
      const traktId = String(r.show_id);
      gorulen.set(`${tip}:${traktId}`, { traktId, type: tip });
    }

    if (veri.length < sayfaBoyu) break;
    ofset += sayfaBoyu;
  }

  return { ok: true, items: [...gorulen.values()], satir };
}

// ==========================================================================
// 🔴 HEDEF ŞEKLİ — İSTEMCİNİN GÖNDERDİĞİNİN BİREBİR AYNISI
// ==========================================================================
// Buradaki `path`/`query` uydurulmadı; `services/api/shows.ts` ve
// `movies.ts`'ten OKUNDU. Sapmanın bedeli somut ve YAŞANMIŞ: Madde 286'da
// dil yanlış etiketlendiği için 523 mükerrer satır yazıldı. Anahtar
// (`payloads` PK'si) `kaymak_id + provider + endpoint + lang`; yanlış
// `lang` = arşivde İKİNCİ, sahte bir kayıt.
//
// 📏 Ölçülen istemci çağrıları:
//   show_detail    /shows/:id                 extended=full & translations=<dil>  -> lang '<dil>'
//   show_seasons   /shows/:id/seasons         extended=full,episodes  (TRANSLATIONS YOK) -> lang '-'
//   movie_detail   /movies/:id                extended=full & translations=<dil>  -> lang '<dil>'
//
// 🔴 `show_seasons`'ın DİLSİZ olması bir hata değil, istemcinin gerçek
// davranışı (`services/api/shows.ts:76`). Buraya `translations` eklemek
// arşivi istemcinin HİÇ İSTEMEDİĞİ bir anahtarla doldururdu — A4'te
// "arşivde var" görünüp aramada bulunamayan bir kayıt.
//
// ⛔ `episode_detail` BİLEREK BACKFILL EDİLMİYOR. Yazıcı destekliyor ama
// bölüm başına bir istek demek: 31 dizi × ort. ~70 bölüm ≈ 2.000+ çağrı.
// Üstelik gereksiz — `show_seasons` yanıtı `extended=...,episodes` ile
// TÜM bölümleri zaten taşıyor ve `archiveShowSeasons` hepsinin entity'sini
// + kimlik haritasını yazıyor (`identity.js`: "tek katalog yanıtı, dizinin
// TÜM hiyerarşisinin kimlik haritasını bedava veriyor"). Bölümün AYRI
// payload'ı yalnızca detay ekranı açıldığında gerekir; onu canlı kanca
// yazar.

/**
 * Bir yapımı, arşivde bulunması gereken uçlara açar.
 *
 * @param {{traktId: string, type: 'show'|'movie'}} item
 * @param {string} dil  'tr' | 'en'
 * @returns {Array<{endpoint, path, query, lang, source, sourceId}>}
 */
function hedefleriUret(item, dil) {
  const { traktId, type } = item;
  const cikti = type === 'movie' ? uretFilm(traktId, dil) : uretDizi(traktId, dil);
  // 🔴 TAZELEME BAYRAĞI — T5.3'ün ASIL TUZAĞI (ölçüldü, M343): eksik bölümü
  // olan 36 dizinin 15'i arşivde ZATEN VAR. `eksikleriBul` "bu hedef arşivde
  // var mı?" deyip onları ATLIYOR → o bölümlerin bekleyen satırları SONSUZA
  // KADAR erimez. `046`'nın `tazele` bayrağı buraya `zorla` olarak geçiyor;
  // `backfill.js` onu görünce arşiv kontrolünü BİLİNÇLİ OLARAK atlıyor.
  //
  // ⚠️ Yalnızca `true` iken EKLENİYOR: akış hedeflerinin (bugünkü kaynak)
  // nesne şekli DEĞİŞMESİN — `zorla: false` yazmak, "her hedefte bir zorlama
  // alanı var" izlenimi verir ve bir gün yanlışlıkla doğruya çevrilir.
  if (item.tazele === true) for (const h of cikti) h.zorla = true;
  return cikti;
}

function uretFilm(traktId, dil) {
  return [{
    endpoint: 'movie_detail',
    path: `/movies/${traktId}`,
    query: { extended: 'full', translations: dil },
    lang: dil,
    source: 'trakt:movie',
    sourceId: traktId,
  }];
}

function uretDizi(traktId, dil) {
  return [
    {
      endpoint: 'show_detail',
      path: `/shows/${traktId}`,
      query: { extended: 'full', translations: dil },
      lang: dil,
      source: 'trakt:show',
      sourceId: traktId,
    },
    {
      endpoint: 'show_seasons',
      path: `/shows/${traktId}/seasons`,
      // 🔴 `translations` YOK — istemci de göndermiyor. lang: '-'
      query: { extended: 'full,episodes' },
      lang: '-',
      source: 'trakt:show',
      sourceId: traktId,
    },
  ];
}

/** Hedefin defterdeki (ve log'daki) tam kimliği. */
function hedefAnahtari(h) {
  return `trakt/${h.endpoint}/${h.sourceId}/${h.lang}`;
}

/** Yapım listesini düz hedef listesine çevirir. */
function hedefListesi(items, dil) {
  const cikti = [];
  for (const item of items) cikti.push(...hedefleriUret(item, dil));
  return cikti;
}


// ==========================================================================
// 📥 İKİNCİ KAYNAK — TRAKT AKTARIMININ ARTIKLARI (Faz T · T5.3)
// ==========================================================================
// Yukarıdaki `fetchTakipEdilenler` BUGÜNKÜ talebi okur (`feed_activities`).
// Buradaki iki çağrı ise GEÇMİŞİN artığını okur: ilk aktarımda arşivde
// olmayan yapımlar yüzünden `user_import_pending`'de bekleyen **875 satır**
// (M348).
//
// 🔴 SUPABASE'E DOĞRUDAN GİDİLMİYOR, WORKER'DAN GEÇİLİYOR. `044`'ün
// tabloları KİŞİSEL İZLEME GEÇMİŞİ taşıyor (kim, neyi, ne zaman) ve RLS'i
// politikasız kapalı — anon anahtarla okunamaz, `service_role` ise Pi'ye
// KONMAZ (`mirror.js`/`catalogSync.js` ile aynı karar: sır sızarsa patlama
// yarıçapı tüm veri olurdu). Worker'ın `/import/eksikler` ucu bize yalnızca
// `(source, source_id)` çiftlerini veriyor — kimin izlediğini DEĞİL.
//
// ⚠️ İki çağrı da ASLA THROW ETMEZ (`mirror.js`'in `partiGonder` sözleşmesi):
// gece zamanlayıcısından çağrılıyorlar.

/** Worker yapılandırması — ikisi de `mirror.js` ile AYNI ortam değişkenleri. */
function workerAyari() {
  const workerUrl = (process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '').replace(/\/+$/, '');
  const secret = process.env.PI_SYNC_SECRET || '';
  if (!workerUrl) return { ok: false, reason: 'worker_url_yok' };
  // Worker 32 karakterin altındaki sırla ucu zaten 503 yapıyor; aynı eşiği
  // burada da uygulayıp boşuna istek atmıyoruz.
  if (secret.length < 32) return { ok: false, reason: 'sir_yok' };
  return { ok: true, workerUrl, secret };
}

/** Ortak POST — JSON gönderir, JSON okur, hata yutmaz ama throw da etmez. */
async function workerCagir(cfg, yol, govde, fetchImpl) {
  try {
    const res = await fetchImpl(`${cfg.workerUrl}${yol}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-kaymak-sync-secret': cfg.secret },
      body: JSON.stringify(govde),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, reason: `http_${res.status}`, detay: String(t).slice(0, 300) };
    }
    const j = await res.json().catch(() => null);
    if (!j || typeof j !== 'object') return { ok: false, reason: 'bicim' };
    return { ok: true, govde: j };
  } catch (error) {
    return { ok: false, reason: 'network', detay: String(error?.message || error).slice(0, 200) };
  }
}

/**
 * Bekleyen satırların eritilmesini TETİKLER (taşıma işi `046`'da, SQL'de).
 *
 * ⚠️ Turdan ÖNCE ve SONRA çağrılır: önce önceki gecelerden kalanlar, sonra
 * BU GECE arşive girenler hemen erisin.
 *
 * @returns {Promise<{ok, tasinan?, kalan?, devam?, reason?}>}
 */
async function tasiBekleyenleri({ limit = 500, fetchImpl = fetch } = {}) {
  const cfg = workerAyari();
  if (!cfg.ok) return cfg;
  const r = await workerCagir(cfg, '/import/bekleyenler', { limit }, fetchImpl);
  if (!r.ok) return r;
  const { tasinan, kalan, devam } = r.govde;
  if (!Number.isFinite(tasinan) || !Number.isFinite(kalan)) return { ok: false, reason: 'bicim' };
  return { ok: true, tasinan, kalan, devam: devam === true };
}

/**
 * Gece indirilecek yapım listesini Worker'dan çeker.
 *
 * Çıktı `fetchTakipEdilenler` ile AYNI ŞEKİLDE (`{traktId, type}`) — böylece
 * `hedefListesi` iki kaynağı da aynı biçimde işliyor, ikinci bir dönüşüm
 * yolu doğmuyor. Fark tek alan: `tazele` (→ hedefte `zorla`).
 *
 * Sıra KORUNUYOR: `046` en çok bekleyen satırı olan yapımı başa koyuyor; dar
 * gecelik bütçeyle en çok satırı eriten hedefe önce gidilsin diye.
 *
 * @returns {Promise<{ok, items?, kalan?, reason?}>}
 */
async function fetchImportHedefleri({ limit = 200, fetchImpl = fetch } = {}) {
  const cfg = workerAyari();
  if (!cfg.ok) return cfg;
  const r = await workerCagir(cfg, '/import/eksikler', { limit }, fetchImpl);
  if (!r.ok) return r;

  const ham = r.govde.hedefler;
  if (!Array.isArray(ham)) return { ok: false, reason: 'bicim' };

  const items = [];
  for (const h of ham) {
    // Worker zaten süzüyor; burada ikinci kez bakılıyor çünkü bu değerler
    // doğrudan Trakt URL'ine giriyor (`hedefleriUret`).
    if (!h || typeof h !== 'object') continue;
    const type = h.source === 'trakt:movie' ? 'movie' : h.source === 'trakt:show' ? 'show' : null;
    if (!type) continue;
    const traktId = String(h.source_id || '');
    if (!/^[0-9]{1,12}$/.test(traktId)) continue;
    items.push({ traktId, type, tazele: h.tazele === true, bekleyen: Number(h.bekleyen) || 0 });
  }
  return { ok: true, items };
}

module.exports = {
  fetchTakipEdilenler,
  fetchImportHedefleri,
  tasiBekleyenleri,
  hedefleriUret,
  hedefListesi,
  hedefAnahtari,
  VARSAYILAN_SAYFA,
};
