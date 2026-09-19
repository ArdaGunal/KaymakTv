// ==========================================================================
// ANLIK AKTARIM — arşive yazılan yapım → Supabase kataloğu  (§C30)
// ==========================================================================
// TEK İŞİ: arşiv kuyruğu bir yapımı (dizi/film ve alt ağacı) yazdığı AN, o
// yapımı Worker'ın `/catalog/sync` ucu üzerinden Supabase'e taşımak. Gece
// aynasını (07:00) beklemeden.
//
// 🔴 NEDEN VAR (M410/M411): Worker `/library/*` yalnızca Supabase'e bakıyor.
// Pi'nin bugün indirdiği yapım/bölüm ertesi sabaha kadar `katalogda_yok`
// (409) alıyordu → kullanıcının işaretlemesi kayboluyordu.
//
// 🛡️ ÖLÇEKLENME KALKANLARI (kullanıcı şartı):
//   • TEKİLLEŞTİRME — aynı kök pencerede kaç kez gelirse gelsin bir kez gider.
//   • MİKRO PARTİ — ~1 sn pencere ya da `PARTI_KOK` kök, hangisi önce dolarsa.
//     Tek tek istek "taramalı tüfek" olurdu; Worker kotası (Free: günde
//     100 bin istek) boşa yanardı.
//   • EŞZAMANLILIK 1 — aynı anda tek uçuş. Arşiv yazımı gibi Pi'yi yormaz.
//   • ARTAN ARALIKLI YENİDEN DENEME — `DENEME_TAVANI`'ndan sonra bırakır.
//     Kaybolan yok: gece aynası (imleçli) EMNİYET AĞI olarak duruyor.
//   • ÇAKIŞMA — Supabase tarafında `merge-duplicates` (ON CONFLICT DO
//     UPDATE, `catalogSync.js`). Aynı saniyede iki kez gelen yapım zarar vermez.
//
// ⛔ İMLECE DOKUNMAZ. Aynanın `mirror_high_water`'ı yalnızca aynaya ait;
// buradan ilerletilseydi aktarımın ATLADIĞI satırlar gece de atlanırdı.
//
// ⚠️ OKUMA TUTARLILIĞI: fazlar arşivden kurulurken başka bir yazım açık
// transaction'da olabilir (aynı bağlantı). En kötü durumda aynı kökün yarım
// hâli gider; o yazım bitince kendi aktarımını tetikler ve upsert düzeltir.
//
// 🔌 KAPATMA ANAHTARI: `.env` → `ANLIK_AKTARIM=0`. Gece aynası etkilenmez.

const { isArchiveEnabled, getDb } = require('./db');
const { logSync } = require('./store');
const { akisiGonder } = require('./mirror');
const { altAgacFazlari, kokBul } = require('./aynaSatirlari');

const PENCERE_MS = 1000;
const PARTI_KOK = 25;
const DENEME_TAVANI = 4;
const ILK_BEKLEME_MS = 2000;

function yapilandirma() {
  return {
    workerUrl: (process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '').replace(/\/$/, ''),
    secret: process.env.PI_SYNC_SECRET || '',
  };
}

/**
 * Aktarım yapılabilir mi? Worker adresi/sırrı YOKSA kuyruğa hiç alınmaz —
 * alınsaydı her yazım boşuna dört deneme ve bir «bırakıldı» logu üretirdi
 * (testlerde ve yapılandırılmamış kurulumlarda).
 */
function acikMi() {
  if (process.env.ANLIK_AKTARIM === '0' || !isArchiveEnabled()) return false;
  const cfg = yapilandirma();
  return !!cfg.workerUrl && cfg.secret.length >= 32;
}

/** Varsayılan gönderici: fazları sırayla `/catalog/sync`'e yollar. */
async function varsayilanGonder(fazlar) {
  const cfg = yapilandirma();
  if (!cfg.workerUrl) return { ok: false, reason: 'worker_url_yok' };
  if (cfg.secret.length < 32) return { ok: false, reason: 'sir_yok' };
  const sayac = { yazilan: 0, atlanan: 0 };
  for (const { faz, satirlar } of fazlar) {
    const r = await akisiGonder(cfg, faz, satirlar, sayac);
    if (!r.ok) return { ...r, ...sayac };
  }
  return { ok: true, ...sayac };
}

/**
 * @param {Object} [o] test için enjekte edilebilir
 */
function createAnlikAktarim({
  gonder = varsayilanGonder,
  fazlariKur = (kokler) => altAgacFazlari(getDb(), kokler),
  pencereMs = PENCERE_MS,
  partiKok = PARTI_KOK,
  denemeTavani = DENEME_TAVANI,
  ilkBeklemeMs = ILK_BEKLEME_MS,
  acik = acikMi,
} = {}) {
  // kök -> { deneme, bekleyenler: [resolve] }
  const kuyruk = new Map();
  let ucusta = false;
  let zamanlayici = null;
  const istatistik = { alinan: 0, tekillesen: 0, gonderilen: 0, tekrar: 0, birakilan: 0, hata: 0 };

  function planla(ms) {
    if (zamanlayici || ucusta) return;
    // ⚠️ `unref()` YOK, bilinçli: `hemen()` bekleyen bir söz varken süreç
    // bu zamanlayıcıyı "önemsiz" sayıp kapanırsa söz hiç çözülmez (testte
    // yakalandı). Zamanlayıcılar en çok birkaç saniye yaşıyor.
    zamanlayici = setTimeout(() => { zamanlayici = null; calistir().catch(() => {}); }, ms);
  }

  function sonuclandir(kokler, sonuc) {
    for (const k of kokler) {
      const g = kuyruk.get(k);
      if (!g) continue;
      kuyruk.delete(k);
      for (const r of g.bekleyenler) r(sonuc);
    }
  }

  async function calistir() {
    if (ucusta) return;
    const kokler = [...kuyruk.keys()].slice(0, partiKok);
    if (kokler.length === 0) return;
    ucusta = true;
    let sonuc;
    try {
      const fazlar = fazlariKur(kokler);
      sonuc = fazlar.length === 0 ? { ok: true, yazilan: 0, bos: true } : await gonder(fazlar);
    } catch (error) {
      istatistik.hata += 1;
      sonuc = { ok: false, reason: 'exception', detay: String(error?.message || error).slice(0, 200) };
    } finally {
      ucusta = false;
    }

    if (sonuc.ok) {
      istatistik.gonderilen += kokler.length;
      sonuclandir(kokler, sonuc);
    } else {
      // Yeniden dene: deneme sayısı artar, tavanı aşan bırakılır.
      const birakilan = [];
      let enBuyuk = 0;
      for (const k of kokler) {
        const g = kuyruk.get(k);
        if (!g) continue;
        g.deneme += 1;
        if (g.deneme >= denemeTavani) birakilan.push(k);
        else enBuyuk = Math.max(enBuyuk, g.deneme);
      }
      if (birakilan.length) {
        istatistik.birakilan += birakilan.length;
        logSync({
          event: 'error', provider: 'supabase', endpoint: 'anlik_aktarim',
          detail: `birakildi ${birakilan.length} kok (${sonuc.reason}); gece aynasi tasiyacak`,
        });
        sonuclandir(birakilan, sonuc);
      }
      if (kuyruk.size) {
        istatistik.tekrar += 1;
        planla(ilkBeklemeMs * 2 ** Math.max(0, enBuyuk - 1));
        return;
      }
    }
    // Kalan varsa (parti tavanı) hemen sıradakine.
    if (kuyruk.size) planla(0);
  }

  function ekleIc(kok, resolve, acil) {
    istatistik.alinan += 1;
    const g = kuyruk.get(kok);
    if (g) {
      istatistik.tekillesen += 1;
      if (resolve) g.bekleyenler.push(resolve);
    } else {
      kuyruk.set(kok, { deneme: 0, bekleyenler: resolve ? [resolve] : [] });
    }
    if (acil && zamanlayici && !ucusta) {
      clearTimeout(zamanlayici);
      zamanlayici = null;
    }
    planla(acil ? 0 : pencereMs);
    // Uçuş sürerken gelen acil iş: uçuş bitince `planla(0)` onu alır.
  }

  return {
    /** Ateşle-unut. ASLA throw etmez. */
    ekle(kok) {
      try {
        if (!kok || !acik()) return false;
        ekleIc(kok, null, false);
        return true;
      } catch (_) { return false; }
    },

    /** Eksikte çekme için: pencereyi beklemeden gönder, sonucu döndür. */
    hemen(kok) {
      if (!kok) return Promise.resolve({ ok: false, reason: 'kok_yok' });
      if (!acik()) return Promise.resolve({ ok: false, reason: 'kapali' });
      return new Promise((resolve) => ekleIc(kok, resolve, true));
    },

    getStats() {
      return { ...istatistik, bekleyen: kuyruk.size, ucusta };
    },
  };
}

// Modül seviyesinde TEK örnek — eşzamanlılık-1 ancak böyle anlamlı.
const anlikAktarim = createAnlikAktarim();

/**
 * Arşiv kuyruğunun `sonrasi` kancası: yazıcının sonucundan kökü bulur.
 * `show_seasons` → `showKaymakId`; detay/bölüm → `kaymakId` (kökü aranır).
 */
function yazimSonrasi(sonuc) {
  if (!acikMi()) return;
  const id = sonuc && (sonuc.showKaymakId || sonuc.kaymakId);
  if (!id) return;
  const db = getDb();
  if (!db) return;
  const kok = kokBul(db, id);
  if (kok) anlikAktarim.ekle(kok);
}

module.exports = { anlikAktarim, createAnlikAktarim, yazimSonrasi, PENCERE_MS, PARTI_KOK, DENEME_TAVANI };
