/**
 * DISCORD-01 (M529) — geçici ağ/altyapı hatası mı?
 *
 * Kullanıcı (2026-10-18): *«Discord'a GİTMEYECEKLER: İnternet kopması (Network Error), zaman aşımı
 * (timeout / Canceled) ve dış altyapı/Cloudflare kaynaklı geçici ağ kodları (502, 503, 504, 522, 524).
 * Discord'a KESİNLİKLE GELECEKLER: tüm istemci/JS çalışma zamanı hataları, 400/422 vb., gerçek 500 …
 * Yani benim kod yazarak düzeltebileceğim hiçbir gerçek bug filtrelenmemeli.»*
 *
 * Bu yüzden liste DAR ve AÇIK: yalnız aşağıdakiler geçici sayılır, geri kalan HER ŞEY (500 dahil)
 * gerçek hatadır. Sarılmış hatalarda (`KaymakAramaHatasi.neden`, `Error.cause`) kök neden aranır.
 * Dönüş: neden etiketi (yerel günlüğe yazılır) ya da `null` (= gerçek hata, Discord'a gider).
 */
export const GECICI_HTTP_DURUMLARI: readonly number[] = [502, 503, 504, 522, 524];
const GECICI_AXIOS_KODLARI = ['ECONNABORTED', 'ETIMEDOUT', 'ERR_CANCELED', 'ERR_NETWORK'];

export function geciciHataNedeni(hata: unknown, derinlik = 0): string | null {
  if (!hata || typeof hata !== 'object' || derinlik > 3) return null;
  const e = hata as any;
  const durum = e.response?.status ?? (typeof e.status === 'number' ? e.status : undefined);
  if (typeof durum === 'number') {
    // Sunucu yanıt verdiyse karar DURUM KODUNUN: 500/400/422… gerçek hatadır.
    return GECICI_HTTP_DURUMLARI.includes(durum) ? `http_${durum}` : null;
  }
  if (typeof e.code === 'string' && GECICI_AXIOS_KODLARI.includes(e.code)) return e.code;
  const mesaj = typeof e.message === 'string' ? e.message : '';
  if (e.name === 'CanceledError' || /^canceled$/i.test(mesaj)) return 'canceled';
  if (/^Network Error$/i.test(mesaj) || /^Network request failed$/i.test(mesaj)) return 'network';
  if (/^timeout of \d+ms exceeded$/i.test(mesaj)) return 'timeout';
  return geciciHataNedeni(e.neden ?? e.cause, derinlik + 1);
}
