// ==========================================================================
// GECE İŞLERİ ANAHTARI — `GECE_ISLERI` (GNL-SERVER taşıması · D1)
// ==========================================================================
// NEDEN VAR: açılışta beş gece zamanlayıcısı KOŞULSUZ kuruluyordu (süpürücü 04-06, yedek 05-07,
// backfill 02-04, ayna 07-09, sayaç 09-11). Ayna ve backfill Worker üzerinden Supabase'e yazar.
// Taşımanın provasında ikinci bir sunucu Pi ile AYNI ANDA çalışacak; onun Supabase'e yazması
// katalog kimliğini böler (arşiv `kaymak_id`'si rastgele — `archive/identity.js`). Prova sunucusu
// bu anahtarla gece işlerini hiç kurmaz.
//
// 🔴 VARSAYILAN AÇIK: yalnız TAM `'0'` kapatır. Değişken yoksa, boşsa ya da yazım hatalıysa
// (`'false'`, `'kapali'`) davranış bugünkü gibidir — Pi'nin `.env`'sine dokunmadan aynı kod Pi'de
// de çalışır. Kapatmak bilinçli bir eylem olmalı; yanlışlıkla kapanmış bir gece yedeği sessizce
// kaybolurdu.
//
// Kapsam: yalnız bu beş ZAMANLAYICI. `initLazyFetchPaths`/`initArchive` (açılış görünürlüğü) ve
// Supabase ısındırması (salt okuma) bu anahtarın DIŞINDA kalır. Anlık aktarımın kendi anahtarı
// var (`ANLIK_AKTARIM`, `archive/anlikAktarim.js`).

/** Gece işleri açık mı? Yalnız `GECE_ISLERI === '0'` kapatır. */
function geceIsleriAcikMi(ortam = process.env) {
  return String(ortam.GECE_ISLERI ?? '').trim() !== '0';
}

/**
 * Beş gece zamanlayıcısını sırayla kurar ya da (kapalıysa) hiçbirini kurmaz.
 *
 * @param {{ ortam?: object, baslaticilar: Array<[string, Function]> }} p
 *   `baslaticilar`: `[ad, işlev]` çiftleri — sıra korunur (pencereler `server.js`'te açıklı).
 * @returns {{ acik: boolean, kurulan: string[] }}
 */
function geceIsleriniBaslat({ ortam = process.env, baslaticilar }) {
  if (!geceIsleriAcikMi(ortam)) {
    console.warn(`[Gece isleri] KAPALI (GECE_ISLERI=0) — ${baslaticilar.length} zamanlayici kurulmadi: ${baslaticilar.map(([ad]) => ad).join(', ')}`);
    return { acik: false, kurulan: [] };
  }
  const kurulan = [];
  for (const [ad, baslat] of baslaticilar) {
    baslat();
    kurulan.push(ad);
  }
  return { acik: true, kurulan };
}

module.exports = { geceIsleriAcikMi, geceIsleriniBaslat };
