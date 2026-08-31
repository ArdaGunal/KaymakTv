/**
 * Bildirimin GERÇEKTEN gönderileceği anı hesaplar (spoiler koruması).
 *
 * 🔴 BU DOSYANIN HİÇ IMPORT'U YOKTUR VE OLMAYACAKTIR.
 * Sebep ölçüldü: Node 24 TypeScript'i yerel çalıştırıyor ama `.ts` içindeki
 * UZANTISIZ çalışma-zamanı import'larını çözemiyor (`ERR_MODULE_NOT_FOUND`).
 * Kod tabanının tamamı uzantısız import kullandığı için (ve öyle kalmalı),
 * saf katmanın `tests/` altından doğrudan çalıştırılabilmesinin tek yolu
 * girdileri PARAMETRE olarak almaktır. `import type` eridiği için serbesttir.
 *
 * F1'de sessiz saat ARALIĞI (23:00–09:00) da buraya eklenecek — ayrı bir dosya
 * değil, çünkü spoiler saati ve sessiz saatler aynı mekanizmanın parçası
 * (bkz. docs/design/notifications.md § 7).
 */

const GUN_MS = 24 * 60 * 60 * 1000;

/**
 * @param firstAiredUtc Trakt `first_aired` — UTC ISO 8601 dizgesi
 * @param preferredHour Kullanıcının seçtiği YEREL saat (0-23)
 * @param now           Şimdi (epoch ms) — testin zamanı sabitleyebilmesi için parametre
 * @returns Gönderim anı (epoch ms) veya bu bölüm için bildirim kurulmamalıysa `null`
 */
export function resolveFireTime(
  firstAiredUtc: string,
  preferredHour: number,
  now: number,
): number | null {
  const airedAt = new Date(firstAiredUtc);
  const airedMs = airedAt.getTime();

  // Bozuk/eksik tarih tüm zamanlamayı sessizce çökertebilirdi: `Invalid Date`
  // üzerinde yapılan her aritmetik NaN üretir ve NaN bir tetikleyici olarak
  // verilirse bildirim hiç kurulmaz — ama hata da alınmaz.
  if (Number.isNaN(airedMs)) return null;

  // Yayın anının KULLANICININ YEREL takvimindeki günü. `getFullYear/getMonth/
  // getDate` bilinçli olarak yerel — UTC günü kullanmak, Türkiye'de gece
  // 03:00'te yayınlanan bir bölümü "dün" saymak demek olurdu.
  //
  // `new Date(yıl, ay, gün, saat)` yerel duvar saatiyle çözümlenir, yani DST
  // geçişlerini işletim sistemi halleder; elle ofset aritmetiği YAPMA.
  let fireAt = new Date(
    airedAt.getFullYear(),
    airedAt.getMonth(),
    airedAt.getDate(),
    preferredHour,
    0,
    0,
    0,
  ).getTime();

  // 🔑 EN İNCE KURAL: tercih edilen saat, yayın saatinden ÖNCE olabilir.
  // Bölüm salı 23:30'da yayınlanıyorsa ve kullanıcı 20:00 seçtiyse, salı
  // 20:00'de "yeni bölüm yayınlandı" demek DÜPEDÜZ YALAN olurdu — bölüm daha
  // çıkmamıştır. Böyle durumlarda bir sonraki günün tercih saatine kaydırılır.
  if (fireAt < airedMs) {
    fireAt += GUN_MS;
  }

  // Geçmişte kalan bir an için bildirim kurulmaz. Sistem bildirimi anında
  // gönderirdi ve kullanıcı, dün yayınlanmış bir bölüm için bugün "bugün
  // yayında" bildirimi alırdı.
  if (fireAt <= now) return null;

  return fireAt;
}

/**
 * Bir anı, o günün (ya da gerekiyorsa ertesi günün) tercih edilen saatine
 * yaslar.
 *
 * `resolveFireTime`'dan FARKI: orada bir yayın anı vardır ve ona göre karar
 * verilir. Burada yayın diye bir şey yoktur — "şu andan 7 gün sonra" gibi
 * hesaplanmış bir hedef vardır ve yalnızca uygun saate çekilmesi gerekir
 * (ör. "Kaldığın yerden devam" dürtmesi).
 *
 * @param targetMs      Hedef an (epoch ms)
 * @param preferredHour Kullanıcının seçtiği YEREL saat (0-23)
 * @returns Hedefe eşit ya da ondan SONRAKİ ilk tercih saati
 */
export function snapToPreferredHour(targetMs: number, preferredHour: number): number {
  const target = new Date(targetMs);
  if (Number.isNaN(target.getTime())) return targetMs;

  let snapped = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
    preferredHour,
    0,
    0,
    0,
  ).getTime();

  // O günün tercih saati hedefin GERİSİNDE kaldıysa ertesi güne kaydır —
  // aksi halde "7 gün sonra hatırlat" dediğimiz bildirim 6,7 gün sonra
  // giderdi ve bekleme eşiği sessizce kısalırdı.
  if (snapped < targetMs) {
    snapped = new Date(
      target.getFullYear(),
      target.getMonth(),
      target.getDate() + 1,
      preferredHour,
      0,
      0,
      0,
    ).getTime();
  }

  return snapped;
}
