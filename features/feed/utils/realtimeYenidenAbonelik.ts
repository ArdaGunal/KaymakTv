/**
 * Realtime kanalı KAPANINCA uygulama düzeyinde yeniden abonelik — saf karar
 * (ISCI-SUPABASE-ISTEMCI). Hook: `useFeedRealtime.ts`.
 *
 * NEDEN YALNIZ `CLOSED`: realtime-js 2.110 (Phoenix) `CHANNEL_ERROR` ve
 * `TIMED_OUT`'ta kanala KENDİSİ yeniden katılır (rejoin zamanlayıcısı, kendi
 * geri çekilmesiyle) — üstüne bir de biz abone olsak aynı konuya iki katılım
 * yarışırdı. `CLOSED` ise (sunucu kanalı kapattı — ör. belge süresi doldu —
 * ya da bağlama uyuşmazlığı) kalıcıdır; kanal istemcinin listesinden de
 * çıkar ve kimse yeniden kurmaz → akış sessizce «canlı» olmaktan çıkardı.
 *
 * SINIRLI: arka arkaya en çok `EN_COK_DENEME` kez (2, 4, 8, 16, 30 sn).
 * Kanal `KARARLI_SURE_MS` boyunca açık kaldıysa sayaç sıfırlanır; açılır
 * açılmaz kapanan bir kanal sonsuz döngüye girmez. Vazgeçilince uygulama
 * öne geldiğinde (AppState) yeniden denenir.
 */

export const EN_COK_DENEME = 5;
export const KARARLI_SURE_MS = 60_000;
const BEKLEMELER_MS = [2_000, 4_000, 8_000, 16_000, 30_000];

/**
 * @param oncekiDeneme  bu kapanıştan önceki ardışık deneme sayısı
 * @param aboneSureMs   kanalın son `SUBSCRIBED`'dan kapanışa kadar açık kaldığı
 *                      süre (hiç abone olamadıysa `null`)
 * @returns `null` → vazgeç; değilse `{ beklemeMs, deneme }` (yeni sayaç)
 */
export function yenidenAbonelikPlani(
  oncekiDeneme: number,
  aboneSureMs: number | null,
): { beklemeMs: number; deneme: number } | null {
  const taban = aboneSureMs != null && aboneSureMs >= KARARLI_SURE_MS ? 0 : Math.max(0, oncekiDeneme);
  if (taban >= EN_COK_DENEME) return null;
  return { beklemeMs: BEKLEMELER_MS[Math.min(taban, BEKLEMELER_MS.length - 1)], deneme: taban + 1 };
}
