import type { FeedActivity } from '../types';

/**
 * HIZ-01 / Faz 4 (M542) — «N yeni gönderi» rozetine NE sayılır?
 *
 * Kullanıcı (2026-10-19, arkadaşıyla test): ilk girişte hiçbir şey yeni değilken «40 yeni gönderi».
 * Sebep: rozet «listede olmayan» her kaydı yeni sayıyordu. Listede olmamak yeni olmak değil —
 * ilk girişte Worker kişinin eski Trakt geçmişini akış tablosuna yazıyor, Realtime her satırı
 * INSERT olarak getiriyor; uzun aradan sonra taze 1. sayfa da diskte olmayan eskileri taşıyor.
 *
 * KURAL: bir kayıt ancak İKİ tabandan da yeniyse sayılır:
 *   1. Listede BİLİNEN EN YENİ gönderi (`activityAt`).
 *   2. Listenin bu oturumda ilk kurulduğu an (`sayacTabani`) eksi `TABAN_TOLERANSI_MS`. Yalnız
 *      1. yetmiyor: boş akışa eski geçmiş ESKİDEN YENİYE akarsa her satır bir öncekinden yenidir
 *      (birim testi yakaladı). Tolerans: arkadaşın birkaç dakika önce izleyip ancak şimdi
 *      eşitlenen kaydı hâlâ «yeni» sayılsın.
 *   • İkisi de yoksa (liste hiç kurulmadı) hiçbir şey sayılmaz.
 *   • İyimser `temp-` kartlar (benim henüz sunucuya ulaşmamış kartım) ölçüte girmez.
 *   • Eski sayfa doldurma (`appendPage`) zaten saymaz; bu yardımcı oraya hiç bağlanmaz.
 */
const zaman = (a: FeedActivity): number => {
  const t = new Date(a.activityAt).getTime();
  return Number.isFinite(t) ? t : -Infinity;
};

export function bilinenEnYeni(mevcut: readonly FeedActivity[]): number {
  let enYeni = -Infinity;
  for (const a of mevcut) {
    if (a.id.startsWith('temp-')) continue;
    const t = zaman(a);
    if (t > enYeni) enYeni = t;
  }
  return enYeni;
}

export const TABAN_TOLERANSI_MS = 30 * 60 * 1000;

/** `adaylar` içinden rozete sayılacak olanların adedi. Saf — sınanır. `sayacTabani` 0 = yok. */
export function yeniSayisi(
  mevcut: readonly FeedActivity[],
  adaylar: readonly FeedActivity[],
  sayacTabani = 0,
): number {
  const taban = sayacTabani > 0 ? sayacTabani - TABAN_TOLERANSI_MS : -Infinity;
  const sinir = Math.max(bilinenEnYeni(mevcut), taban);
  if (sinir === -Infinity) return 0;
  return adaylar.filter((a) => zaman(a) > sinir).length;
}
