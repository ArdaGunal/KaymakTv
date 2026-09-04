// ==========================================================================
// LAZYFETCH — Arşiv Geri Düşüşü (A4, dosya 4/5)
// ==========================================================================
// TEK İŞİ: "sağlayıcı çöktü ve elimizde hiçbir cache zarfı yok" durumunda
// son bir yere daha bakmak — arşive — ve bu olayı GÖRÜNÜR kılmak.
//
// Bu dosya `orchestrator.js`'ten ayrıldı (Madde 295). Ayrılma çizgisi
// doğal: buradaki üç iş (arşivden oku · sayacı artır · kesinti uyarısı) tek
// bir soruyu cevaplıyor — *"her şey başarısız olduğunda ne yaparız ve
// bunu kim öğrenir?"* Karar ağacındaki YERİ ise `orchestrator.js`'te
// kalıyor: hangi sırayla denendiği oranın işi.
//
// 🔴 SIRA: bu yol GRACE FALLBACK'İN ARDINDA çağrılır, önünde değil. Eski
// bir cache zarfı arşivdeki kayıttan DAHA TAZE olabilir (cache her istekte
// yazılır, arşiv yalnızca sağlayıcıya gidilen isteklerde + gece backfill'de).
// Gerekçenin tamamı: `04_KARARLAR.md` §A5.

// 🆕 A4 — arşivin OKUMA tarafı. Bağımlılık yönü A2'dekiyle aynı ve hâlâ
// TEK YÖNLÜ: LazyFetch arşivi tanır, arşiv LazyFetch'i tanımaz. Arşiv
// kapalıysa `readCatalogFromArchive` `{ok:false}` döner (throw etmez),
// yani bu require bir çalışma zamanı riski taşımaz.
const { readCatalogFromArchive } = require('../archive/reader');
const { bumpFallback } = require('../archive/stats');
// 🔴 MODÜL NESNESİ OLARAK alınıyor, destructure EDİLMİYOR — ve bu bilinçli.
// `const { reportLazyFetch } = require(...)` bağlantıyı require anında
// KOPYALAR; test o kopyayı değiştiremez. Bu yol YALNIZCA sağlayıcı
// çöktüğünde çalışıyor, yani gerçek hayatta neredeyse hiç gözlenmiyor —
// test edilebilir olması, doğruluğunun tek güvencesi.
// 📏 Bu satır bir testin BOŞA YANMASIYLA bulundu (Madde 293): "istek
// telemetriyi beklemedi" iddiası yeşildi ama telemetri HİÇ çağrılmıyordu;
// casus destructure edilmiş kopyayı göremiyordu.
const telemetri = require('./telemetry');

/**
 * Arşivden servis etmeyi dener.
 *
 * @returns {Promise<{ok: true, data: any} | {ok: false}>}
 *   `ok:false` ise çağıran ORİJİNAL sağlayıcı hatasını fırlatmaya devam
 *   etmeli — bu fonksiyon hatayı ASLA yutmaz veya değiştirmez.
 */
async function tryArchiveFallback({ provider, family, path, query, relativePath, error }) {
  const arsiv = await readCatalogFromArchive({ provider, family, path, query });
  if (!arsiv.ok) return { ok: false };

  // 🔴 SAYAÇ — A4'ün kendi doğurduğu kör noktayı kapatır. A4 öncesi bu
  // durum kullanıcıya HATA olarak görünürdü (gürültülü, fark edilir);
  // artık SESSİZCE eski veri olarak görünüyor. Sayaç olmadan "sistem
  // haftalardır arşivden servis ediyor" durumunu kimse fark etmezdi.
  // Denetçi (`scripts/lazyfetch-inspect.js`) bunu okuyup basıyor.
  const sayim = bumpFallback(family);
  const yasGun = arsiv.fetchedAt ? Math.round((Date.now() - arsiv.fetchedAt) / 86400000) : null;
  const yas = yasGun === null ? '' : ` (arşiv kaydı ${yasGun} gün önce çekilmiş)`;
  console.error(
    `[LazyFetch] Sağlayıcı başarısız + cache boş, ARŞİV geri düşüşü (${relativePath})${yas}: ${error.message}`
  );

  // 🔴🔴 AWAIT YOK — VE BU BİR İHMAL DEĞİL, ZORUNLULUK.
  // `reportLazyFetch` ağa çıkıyor ve 8 SANİYELİK bir zaman aşımı var
  // (`telemetry.js TIMEOUT_MS`). Beklersek, zaten sağlayıcı çöktüğü
  // için yavaşlamış olan kullanıcı isteğine 8 saniye daha eklerdik —
  // yani "kullanıcıyı boş ekrandan kurtaran" yol, kullanıcıyı bekleten
  // yola dönüşürdü. Telemetri bir LÜKS (telemetry.js başlığı); istek
  // onun rehinesi olamaz.
  //
  // 🔴 Uyarı YALNIZCA yeni kesintide: `yeniKesinti` bir DURUM GEÇİŞİ
  // (30 dk sessizlikten sonraki ilk olay). Her geri düşüşte bildirmek
  // bir kesintide yüzlerce mesaj demekti — gerçek uyarı gürültüde
  // kaybolurdu.
  if (sayim.yeniKesinti) {
    telemetri.reportLazyFetch({
      reason: 'archive-fallback',
      text: telemetri.formatFallbackAlarm({
        family, toplam: sayim.toplam, path, yasGun, hata: error.message,
      }),
      tags: { family, toplam: sayim.toplam, yasGun: yasGun ?? -1 },
    }).catch(() => { /* telemetri asla yukari sizmaz */ });
  }

  return { ok: true, data: arsiv.data };
}

module.exports = { tryArchiveFallback };
