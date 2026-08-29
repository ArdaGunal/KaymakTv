// ==========================================================================
// LAZYFETCH — Ortak `Cache-Control` Çözümleyici (L7, dosya 1/3)
// ==========================================================================
// TEK İŞİ: sağlayıcının `Cache-Control` başlığından "bu yanıt kaç saniye
// taze sayılabilir" değerini çıkarmak. İki sağlayıcı (TMDB, Trakt) da aynı
// soruyu soruyor — parser'ı iki dosyaya kopyalamak yerine burada.
//
// 🔴 `s-maxage` ÖNCELİKLİDİR — ve bu bir tercih değil, ŞARTNAME (RFC 9111
// §5.2.2.10): `s-maxage`, PAYLAŞIMLI önbellekler için `max-age`'i EZER.
// Pi'deki LazyFetch tam olarak paylaşımlı bir önbellektir (tek kopya, tüm
// kullanıcılara servis eder) — yani `s-maxage` bize SÖYLENMİŞ değerdir.
//
// Bunun somut karşılığı ölçüldü (2026-08-29, canlı):
//   Trakt  /shows/:id/seasons → `public, max-age=3600, s-maxage=43200`
//   TMDB   /tv/:id            → `public, max-age=6550`  (s-maxage YOK)
//
// Yani Trakt bize "sen paylaşımlı bir cache'sin, 1 saat değil 12 SAAT
// saklayabilirsin" diyor. `max-age`'i okusaydık origin trafiğini gereksiz
// yere 12 KAT fazla üretecektik. TMDB'de `s-maxage` olmadığı için orada
// davranış hiç değişmiyor (geriye dönük güvenli).

// 🆕 (L7+) SAĞLAYICININ "SAKLAMA" DEDİĞİ HAL — eskiden GÖZ ARDI EDİLİYORDU.
//
// Bulunduğu tur: 2026-08-29 devir denetimi. `parseSharedMaxAge` bir sayı
// bulamayınca `undefined` dönüyordu ve `resolveTtl()` bunu "header yok"
// sanıp varsayılan 1 SAATE düşüyordu. Yani `Cache-Control: no-store`
// diyen bir yanıt, tam tersi yapılıp bir saat saklanıyordu.
//
// Bugünkü beyaz listede erişilebilir DEĞİLDİ (TMDB ve Trakt katalog uçları
// ölçülen her yanıtta `public, max-age=N` dönüyor) — ama L7+ beyaz listeyi
// 1 uçtan 8 uca çıkardığı için "hiç gelmez" varsayımı artık taşınamaz.
//
// 🔴 `private` NEDEN BURADA: LazyFetch PAYLAŞIMLI bir önbellek. `private`,
// "bunu yalnızca tek kullanıcının tarayıcısı saklayabilir" demektir; bizim
// saklamamız o yanıtı DİĞER kullanıcılara servis etmek olurdu — 02_ENVANTER
// .md'nin gizlilik sınırının tam ihlali. Sağlayıcı bunu söylüyorsa dinleriz.
//
// ⚠️ `no-cache` tam olarak "saklama" DEĞİL, "kullanmadan önce doğrula"
// demektir (RFC 9111 §5.2.2.4). LazyFetch'te henüz koşullu istek
// (`If-None-Match`) yok — doğrulayamadığımız bir kaydı saklamak, onu
// doğrulanmış gibi servis etmek olur. Doğrulama L5'in 304 desteğiyle
// geldiğinde bu satır yeniden değerlendirilmeli.
const NO_STORE_DIRECTIVES = /(?:^|[\s,])(no-store|no-cache|private)(?:\s*(?:,|$))/i;

/**
 * Bu yanıt PAYLAŞIMLI bir önbellekte saklanabilir mi?
 *
 * @param {string|undefined} header  Ham `Cache-Control` başlığı
 * @returns {boolean} `false` ise orchestrator yanıtı döner ama DİSKE/BELLEĞE
 *   YAZMAZ (bkz. orchestrator.js `fetchAndStore`). Header hiç yoksa `true` —
 *   "sağlayıcı bir şey söylemedi" ile "saklama dedi" AYNI ŞEY DEĞİLDİR;
 *   susan sağlayıcıda eski davranış (varsayılan TTL) korunur.
 */
function isStorable(header) {
  if (!header || typeof header !== 'string') return true;
  return !NO_STORE_DIRECTIVES.test(header);
}

/**
 * @param {string|undefined} header  Ham `Cache-Control` başlığı
 * @returns {number|undefined} saniye — bulunamazsa `undefined`
 *   (orchestrator bu durumda `routeRegistry.resolveTtl()` varsayılanına düşer)
 */
function parseSharedMaxAge(header) {
  if (!header || typeof header !== 'string') return undefined;

  // Önce paylaşımlı cache'e özel direktif.
  const shared = /s-maxage=(\d+)/i.exec(header);
  if (shared) return parseInt(shared[1], 10);

  // `s-maxage` içindeki "maxage" parçasının yanlışlıkla eşleşmemesi için
  // `max-age`'de tire ZORUNLU ve öncesinde kelime sınırı aranıyor.
  const priv = /(?:^|[\s,])max-age=(\d+)/i.exec(header);
  return priv ? parseInt(priv[1], 10) : undefined;
}

module.exports = { parseSharedMaxAge, isStorable };
