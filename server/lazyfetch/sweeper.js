// ==========================================================================
// LAZYFETCH — Süpürücü (L6, dosya 2/2)
// ==========================================================================
// TEK İŞİ: SSD'nin sonsuza büyümesini engellemek. Cache'in TANIMI silmektir
// (01_MIMARI.md "cache ≠ arşiv") — bu dosya o tanımı uygulayan yer.
//
// 🔴🔴 EN KRİTİK KURAL (03_FAZLAR.md L6): **YALNIZCA `cache/` ALT AĞACI.**
// `tmp/` ve `quarantine/` ASLA silinmez:
//   • `quarantine/` bozuk kayıtların KANIT deposudur (diskStore.js) — silmek
//     teşhis imkânını yok eder.
//   • `tmp/` atomik yazmanın çalışma alanı; süpürme anında yazılmakta olan
//     bir dosyayı silmek, `rename()` atomikliğini bozar.
// Bu yüzden süpürücü kökten DEĞİL, `getLazyFetchDir('cache')`'ten başlar ve
// her silmeden önce yolun cache kökünün altında kaldığını YENİDEN doğrular
// (diskStore.js'in `resolveSafePath` deseniyle aynı savunma derinliği).
//
// 🔴 NEDEN `mtime` KULLANILIYOR (envelope.js "mtime'a güvenilmez" der!):
// Orada yasaklanan şey mtime'a bakıp "bu veri TAZE Mİ" kararı vermek —
// çünkü yanlış karar KULLANICIYA BOZUK VERİ servis eder. Burada verilen
// karar ise "bu dosyayı silelim mi": yanlış karar en fazla bir cache
// kaydını erken siler, o da bir sonraki istekte yeniden çekilir. Zarar
// asimetrik, bu yüzden ucuz yöntem meşru. Alternatif (her dosyayı açıp
// gunzip'leyip zarfı okumak) 30.000 kayıtta Pi'yi dakikalarca meşgul
// ederdi — süpürücünün kendisi bir yük kaynağı olmamalı.
// Not: dosya kopyalanınca mtime YENİLENİR, yani hata yönü her zaman
// "daha uzun sakla" tarafındadır — güvenli yön.
//
// 🔴 SİLME POLİTİKASI İKİ AŞAMALI:
//   1. YAŞ: `maxAgeMs`'ten uzun süredir DOKUNULMAMIŞ kayıtlar. `mtime`
//      her başarılı yenilemede tazelendiği için bu "kimsenin istemediği
//      içerik" demektir. Grace fallback sigortasını kaybetmiyoruz: 30
//      gündür istenmemiş bir kaydı, sağlayıcı çöktüğünde de kimse
//      istemeyecek.
//   2. KOTA: yaş elemesinden sonra bir aile hâlâ tavanın üstündeyse, en
//      eski `mtime`'lılar tavana inene kadar silinir. Aile bazlı olması
//      önemli — `tv_images` (~22 KB/kayıt) tek başına diski yiyebilirken
//      `tv_videos` (~1 KB) hiç sorun değil; tek bir global sayı ikisine de
//      yanlış davranırdı.
//
// ⚠️ SAYILAR BAŞLANGIÇ DEĞERİ (04_KARARLAR.md B). Ölçülen gerçek ayak izi:
// kayıt başına ortalama 6,4 KB; 10.000 başlık ≈ 188 MB. Yani bu tavanlar
// bugün BOL — amaçları felaketi (kontrolsüz büyüme) önlemek, yer kazanmak
// değil. Telemetri gerçek sayıları gösterdiğinde daraltılır.

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { getLazyFetchDir, isLazyFetchEnabled } = require('./paths');
const { reportLazyFetch, formatSweepSummary, formatDiskAlarm } = require('./telemetry');

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_CONFIG = {
  maxAgeMs: 30 * DAY_MS,        // 30 gündür istenmemiş kayıt gider
  maxEntriesPerFamily: 20000,   // ~128 MB (6,4 KB × 20k) — aile başına tavan
  diskAlarmPercent: 80,         // 03_FAZLAR.md L6: "disk %80 alarmı"
};

/** `cache/` altındaki TÜM `.json.gz` dosyalarını aile bazında toplar. */
async function scanCache(cacheDir) {
  const families = new Map(); // 'tmdb/tv_detail' -> [{ path, mtimeMs, size }]
  let totalBytes = 0;
  let scanned = 0;
  const errors = [];

  // provider/family/shard/dosya — dört seviye. Derinliğe göre yazmak yerine
  // özyinelemeli yürüyoruz ki gelecekte (L7 Trakt, farklı shard derinliği)
  // bu dosya değişmesin.
  async function walk(dir, familyKey) {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch (error) {
      errors.push(`readdir ${path.basename(dir)}: ${error.message}`);
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // İlk iki seviye (provider/family) aile anahtarını oluşturur;
        // altındaki shard klasörleri aynı aileye sayılır.
        const nextKey = familyKey === null ? entry.name : (familyKey.includes('/') ? familyKey : `${familyKey}/${entry.name}`);
        await walk(full, nextKey);
        continue;
      }
      if (!entry.name.endsWith('.json.gz')) continue;

      try {
        const stat = await fsp.stat(full);
        const record = { path: full, mtimeMs: stat.mtimeMs, size: stat.size };
        if (!families.has(familyKey)) families.set(familyKey, []);
        families.get(familyKey).push(record);
        totalBytes += stat.size;
        scanned += 1;
      } catch (error) {
        errors.push(`stat: ${error.message}`);
      }
    }
  }

  await walk(cacheDir, null);
  return { families, totalBytes, scanned, errors };
}

/** Bir dosyayı SİLER — ama önce cache kökünün altında olduğunu yeniden doğrular. */
async function safeDelete(cacheDir, filePath, errors) {
  const base = path.resolve(cacheDir) + path.sep;
  if (!path.resolve(filePath).startsWith(base)) {
    // Buraya asla gelinmemeli; gelindiyse yürüyüşte bir kusur var demektir.
    errors.push(`GÜVENLİK: cache dışı yol silinmedi: ${path.basename(filePath)}`);
    return 0;
  }
  try {
    const stat = await fsp.stat(filePath);
    await fsp.unlink(filePath);
    return stat.size;
  } catch (error) {
    errors.push(`unlink: ${error.message}`);
    return 0;
  }
}

/** `tmp/` ve `quarantine/` yalnızca SAYILIR — asla silinmez (dosya başlığı). */
async function countOnly(dirName) {
  const dir = getLazyFetchDir(dirName);
  if (!dir) return 0;
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).length;
  } catch {
    return 0;
  }
}

/**
 * SSD doluluk oranı. `fs.statfs` Node 18.15+ gerektirir — YOKSA hata
 * fırlatmaz, `available: false` döner ve alarm sessizce atlanır
 * (paths.js'in "eksik yetenek sistemi çökertmez" felsefesi).
 */
async function getDiskUsage(root, cacheBytes, cacheEntries) {
  try {
    if (typeof fsp.statfs !== 'function') return { available: false };
    const stats = await fsp.statfs(root);
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bavail * stats.bsize;
    if (!totalBytes) return { available: false };
    return {
      available: true,
      totalBytes,
      freeBytes,
      usedPercent: Math.round(((totalBytes - freeBytes) / totalBytes) * 100),
      cacheBytes,
      cacheEntries,
    };
  } catch {
    return { available: false };
  }
}

/**
 * Bir süpürme turu çalıştırır.
 *
 * Cache kapalıysa hiçbir şey yapmaz. Hiçbir koşulda throw ETMEZ —
 * zamanlayıcıdan çağrıldığı için bir hata sunucuyu düşürmemeli.
 *
 * @returns {Promise<Object|null>} özet (cache kapalıysa null)
 */
async function runSweep(config = {}) {
  if (!isLazyFetchEnabled()) return null;

  const { maxAgeMs, maxEntriesPerFamily, diskAlarmPercent } = { ...DEFAULT_CONFIG, ...config };
  const cacheDir = getLazyFetchDir('cache');
  if (!cacheDir) return null;

  const startedAt = Date.now();
  const { families, totalBytes, scanned, errors } = await scanCache(cacheDir);

  let deletedByAge = 0;
  let deletedByQuota = 0;
  let freedBytes = 0;
  const ageCutoff = startedAt - maxAgeMs;

  for (const [, records] of families) {
    // 1) YAŞ elemesi
    const survivors = [];
    for (const record of records) {
      if (record.mtimeMs < ageCutoff) {
        freedBytes += await safeDelete(cacheDir, record.path, errors);
        deletedByAge += 1;
      } else {
        survivors.push(record);
      }
    }

    // 2) KOTA elemesi — en eski `mtime` önce gider
    if (survivors.length > maxEntriesPerFamily) {
      survivors.sort((a, b) => a.mtimeMs - b.mtimeMs);
      const excess = survivors.length - maxEntriesPerFamily;
      for (let i = 0; i < excess; i++) {
        freedBytes += await safeDelete(cacheDir, survivors[i].path, errors);
        deletedByQuota += 1;
      }
    }
  }

  const result = {
    durationMs: Date.now() - startedAt,
    scanned,
    totalBytes,
    deleted: deletedByAge + deletedByQuota,
    deletedByAge,
    deletedByQuota,
    freedBytes,
    families: families.size,
    orphanTmpFiles: await countOnly('tmp'),
    quarantineFiles: await countOnly('quarantine'),
    errors,
  };

  // Disk alarmı — süpürmeden SONRA bakılır (süpürme yer açmış olabilir).
  const usage = await getDiskUsage(cacheDir, totalBytes - freedBytes, scanned - result.deleted);
  result.diskUsage = usage;
  if (usage.available && usage.usedPercent >= diskAlarmPercent) {
    await reportLazyFetch({
      reason: 'disk-alarm',
      text: formatDiskAlarm(usage),
      tags: { usedPercent: usage.usedPercent, cacheEntries: usage.cacheEntries },
    });
  }

  return result;
}

/**
 * Süpürme turunu çalıştırıp SONUCU TELEMETRİYE bildirir.
 *
 * 🔴 SESSİZ TURLAR BİLDİRİLMEZ: hiçbir şey silinmediyse ve hata yoksa
 * Discord'a mesaj GİTMEZ. Aksi halde kanal her gece "0 silindi" gürültüsüyle
 * dolar ve insanlar kanalı susturur — o noktadan sonra GERÇEK alarm da
 * görülmez. (MASTER_PLAN §0'daki telemetri notunun aynı dersi.)
 */
async function sweepAndReport(config) {
  try {
    const result = await runSweep(config);
    if (!result) return null;

    const worthReporting = result.deleted > 0 || result.errors.length > 0 || result.quarantineFiles > 0;
    console.log(
      `[LazyFetch] Süpürme: ${result.scanned} tarandı, ${result.deleted} silindi (${result.durationMs} ms)`
    );
    if (worthReporting) {
      await reportLazyFetch({
        reason: 'sweep',
        text: formatSweepSummary(result),
        tags: {
          scanned: result.scanned,
          deleted: result.deleted,
          freedMb: Number((result.freedBytes / 1048576).toFixed(1)),
          errors: result.errors.length,
        },
      });
    }
    return result;
  } catch (error) {
    // Süpürücü ASLA sunucuyu düşürmez.
    console.error(`[LazyFetch] Süpürme turu çöktü: ${error?.message || error}`);
    return null;
  }
}

// ==========================================================================
// ZAMANLAYICI
// ==========================================================================
// 03_FAZLAR.md L6: "gece düşük trafikte çalışır". `node-cron` gibi bir paket
// EKLENMEDİ (03_FAZLAR.md "Paket önerisi": ilk sürümde harici paket yok) —
// saatlik bir `setInterval` + saat kontrolü aynı işi görüyor.
//
// ⚠️ Saat dilimi: Pi'nin YEREL saati kullanılıyor (sunucu Türkiye'de).
// UTC'ye çevirmek burada bir kazanç sağlamaz, tersine "gece" tanımını
// operatörün gördüğü saatten koparırdı.

const SWEEP_WINDOW_START_HOUR = 4; // 04:00–05:59 arası
const SWEEP_WINDOW_END_HOUR = 6;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // saatte bir bak

let lastSweepDay = null;
let timer = null;

/**
 * Zamanlayıcıyı başlatır. `server.js` açılışta BİR kez çağırır.
 * Cache kapalıysa hiç kurulmaz — boşuna uyanan bir timer bırakmayız.
 */
function startSweeperSchedule(config) {
  if (!isLazyFetchEnabled()) {
    console.log('[LazyFetch] Süpürücü kurulmadı — cache devre dışı.');
    return null;
  }
  if (timer) return timer; // çift çağrı zararsız olsun

  timer = setInterval(() => {
    const now = new Date();
    const hour = now.getHours();
    const dayKey = now.toDateString();

    if (hour < SWEEP_WINDOW_START_HOUR || hour >= SWEEP_WINDOW_END_HOUR) return;
    if (lastSweepDay === dayKey) return; // günde bir kez yeter
    lastSweepDay = dayKey;

    sweepAndReport(config);
  }, CHECK_INTERVAL_MS);

  // `unref()` — bu timer Node'un kapanmasını ENGELLEMEZ. Olmasaydı
  // `Ctrl+C` sonrası süreç bir saate kadar takılı kalabilirdi.
  if (typeof timer.unref === 'function') timer.unref();

  console.log(
    `[LazyFetch] Süpürücü kuruldu — her gün ${SWEEP_WINDOW_START_HOUR}:00-${SWEEP_WINDOW_END_HOUR}:00 arası bir tur.`
  );
  return timer;
}

/** Test/kapanış için — zamanlayıcıyı durdurur. */
function stopSweeperSchedule() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  lastSweepDay = null;
}

module.exports = {
  runSweep,
  sweepAndReport,
  startSweeperSchedule,
  stopSweeperSchedule,
  DEFAULT_CONFIG,
  // Yalnızca test için dışa veriliyor.
  scanCache,
  getDiskUsage,
};
