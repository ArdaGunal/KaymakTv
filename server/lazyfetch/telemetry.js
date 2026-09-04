// ==========================================================================
// LAZYFETCH — Telemetri Hattı (L6, dosya 1/2)
// ==========================================================================
// TEK İŞİ: LazyFetch'in operasyonel durumunu (süpürme sonuçları, disk
// doluluk alarmı) insanın GÖRECEĞİ bir yere iletmek. Pi'de kimse log
// dosyasına bakmıyor — bakılmayan log, olmayan log'dur.
//
// 🔴 YENİ ALTYAPI KURULMADI (bilinçli): Worker'da zaten `/telemetry/error`
// ucu var (istemcinin "kara kutusu", Madde 238) ve arkasında Discord
// webhook'u çalışıyor. Bu dosya AYNI ucu yeniden kullanıyor — tıpkı
// Worker'ın kendi `notifyReportToDiscord`'unun geri bildirim webhook'unu
// yeniden kullanması gibi. Yeni uç = yeni deploy + yeni rate limit + yeni
// bakım yüzeyi; kazanç yok.
//
// 🔴 FAIL-SOFT, HER KOŞULDA: bu dosyadaki hiçbir hata yukarı sızmaz.
// Telemetri gönderilemedi diye bir süpürme turu iptal olmaz, bir istek
// yavaşlamaz, sunucu çökmez. Telemetri bir LÜKSTÜR; önbelleğin kendisi
// zaten bir lükstü (paths.js aynı felsefe).
//
// 🔴 GİZLİLİK SINIRI (02_ENVANTER.md): buradan çıkan gövdede kullanıcıya
// ait HİÇBİR ŞEY yok — ne path, ne query, ne cache anahtarı. Yalnızca
// SAYILAR (kaç kayıt, kaç MB, kaç silindi) ve aile ADLARI gidiyor.
// Cache anahtarları hash'lenmiş olsa bile gönderilmez: hash, "hangi diziye
// bakıldı" sorusunu sözlük saldırısıyla cevaplayabilir.

const WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

// `EXPO_PUBLIC_` öneki burada bir sır sızıntısı DEĞİL — bu bir PUBLIC
// adres (istemci bundle'ında zaten var, AI_RULES §2'nin izin verdiği
// "public ID" kategorisi). Sunucuda ayrıca tanımlamak yerine aynı
// değişkeni okumak, iki yerde ıraksayan adres tutmayı önlüyor.

const TIMEOUT_MS = 8000;

/** İnsan okunur MB — Discord'da "187392000 bayt" kimseye bir şey anlatmıyor. */
function toMb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/**
 * Süpürme/durum özetini telemetri hattına gönderir.
 *
 * @param {Object} summary
 * @param {string} summary.reason  'sweep' | 'disk-alarm' | 'startup'
 * @param {string} summary.text    Discord'da görünecek insan okunur özet
 * @param {Object} [summary.tags]  Sayısal etiketler (Worker `tags` alanına gider)
 * @returns {Promise<boolean>} gönderildi mi (yalnızca teşhis/test için)
 */
async function reportLazyFetch({ reason, text, tags = {} }) {
  if (!WORKER_URL) return false; // yapılandırma yokluğu hata değil (Worker'ın kendi deseni)

  try {
    // `fetch` Node 18+'da yerleşik — axios'a bağımlılık eklemiyoruz, çünkü
    // bu yol sunucunun sıcak kod yolunda DEĞİL (günde birkaç çağrı) ve
    // axios'un global `httpsAgent` ayarları (Madde 234, TMDB için) burada
    // bir kazanç sağlamaz.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${WORKER_URL}/telemetry/error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          // Worker `context` + `message`'ı ZORUNLU tutuyor; `context` embed'de
          // "📍 Bağlam" olarak görünüyor — operatör bunu görünce bunun bir
          // istemci çökmesi DEĞİL, sunucu bakım raporu olduğunu anlamalı.
          context: `lazyfetch/${reason}`,
          message: text,
          platform: 'raspberry-pi/server',
          appVersion: process.env.npm_package_version || 'server',
          tags,
        }),
      });
      return response.ok;
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    // Ağ yok, Worker kapalı, zaman aşımı — hepsi aynı sonuca varır:
    // telemetri gitmedi, hayat devam ediyor. YUKARI SIZMAZ.
    console.error(`[LazyFetch] Telemetri gönderilemedi: ${error?.message || error}`);
    return false;
  }
}

/** Süpürme sonucunu okunabilir bir Discord mesajına çevirir. */
function formatSweepSummary(result) {
  const lines = [
    `Süpürme tamamlandı (${result.durationMs} ms)`,
    `Taranan: ${result.scanned} kayıt · ${toMb(result.totalBytes)} MB`,
    `Silinen: ${result.deleted} kayıt · ${toMb(result.freedBytes)} MB geri alındı`,
  ];

  if (result.deletedByAge) lines.push(`  • yaş sınırı (erişilmeyen): ${result.deletedByAge}`);
  if (result.deletedByQuota) lines.push(`  • aile kotası: ${result.deletedByQuota}`);
  if (result.orphanTmpFiles) {
    // Süpürücü `tmp/`'ye DOKUNMAZ (03_FAZLAR.md L6: "yalnızca cache/ alt
    // ağacı") — ama yetim dosya birikiyorsa operatör bunu BİLMELİ.
    lines.push(`  ⚠️ tmp/ içinde ${result.orphanTmpFiles} yetim dosya (süpürücü dokunmaz, elle bak)`);
  }
  if (result.quarantineFiles) {
    lines.push(`  ⚠️ quarantine/ içinde ${result.quarantineFiles} bozuk kayıt (teşhis bekliyor)`);
  }
  if (result.errors.length) {
    lines.push(`  ❌ ${result.errors.length} hata (ilki: ${result.errors[0]})`);
  }

  return lines.join('\n');
}

/** Disk doluluk alarmı mesajı — eşiği aşınca operatörün ELİNE geçmesi gereken şey. */
function formatDiskAlarm(usage) {
  return [
    `🔴 SSD doluluk eşiği aşıldı: %${usage.usedPercent}`,
    `Toplam: ${toMb(usage.totalBytes)} MB · Boş: ${toMb(usage.freeBytes)} MB`,
    `LazyFetch cache payı: ${toMb(usage.cacheBytes)} MB (${usage.cacheEntries} kayıt)`,
    '',
    'Süpürücü kotaları düşürülmeli veya SSD\'de yer açılmalı.',
    'Runbook: docs/runbook/LAZYFETCH_OPS.md',
  ].join('\n');
}

/**
 * 🆕 A4 — arşiv geri düşüşü uyarısı (Madde 293).
 *
 * NE ZAMAN DÜŞER: yalnızca YENİ BİR KESİNTİ başladığında
 * (`stats.SESSIZLIK_ESIGI_MS` sessizlikten sonraki ilk olay). Her geri
 * düşüşte değil — bir Trakt kesintisi dakikada yüzlerce olay üretebilir ve
 * hepsini bildirmek alarm yorgunluğundan başka bir şey üretmez.
 *
 * 🔴 BU MESAJ BİR ARIZA BİLDİRİMİ DEĞİL, BİR "SESSİZ ÇALIŞIYOR" BİLDİRİMİ.
 * Kullanıcı ekranında her şey normal görünüyor; haber vermezsek kimse
 * fark etmez. Metin bunu açıkça söylemeli, yoksa operatör "sistem çökmüş"
 * sanıp gereksiz panikler.
 */
function formatFallbackAlarm({ family, toplam, path, yasGun, hata }) {
  return [
    '🟠 ARŞİV GERİ DÜŞÜŞÜ BAŞLADI',
    '',
    'Sağlayıcı (Trakt) cevap vermedi ve önbellekte de veri yoktu;',
    'kullanıcıya ARŞİVDEN cevap verildi. **Uygulama çalışmaya devam ediyor** —',
    'ama servis edilen veri güncel değil.',
    '',
    `Uç        : ${family}${path ? '  ' + path : ''}`,
    `Sağlayıcı : ${hata || 'bilinmiyor'}`,
    yasGun === null || yasGun === undefined ? '' : `Veri yaşı : ~${yasGun} gün önce arşivlenmiş`,
    `Toplam    : ${toplam} geri düşüş (arşiv açıldığından beri)`,
    '',
    'Ne yapmalı: Trakt tarafında kesinti var mı bak. Sürüyorsa yapacak bir',
    'şey yok — sistem zaten doğru davranıyor.',
    '  journalctl -u kaymak -n 200 | grep "ARŞİV geri düşüşü"',
    '  npm run arsiv     # sayaçların tamamı',
  ].filter(Boolean).join('\n');
}

module.exports = {
  reportLazyFetch,
  formatSweepSummary,
  formatDiskAlarm,
  formatFallbackAlarm,
  // Yalnızca test için dışa veriliyor.
  toMb,
};
