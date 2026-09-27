// ==========================================================================
// AKTARIM KİLİDİ — cihaz içinde AYNI ANDA TEK aktarım döngüsü (§C33)
// ==========================================================================
// 🔴 NEDEN MODÜL DÜZEYİNDE: `useTraktImport` iki ayrı yerde çağrılıyordu
// (Ayarlar bölümü + `_layout`'taki otomatik tur) ve her örneğin KENDİ
// `calisiyorRef`'i vardı. Kullanıcı Ayarlar'da düğmeye basarken arka plandaki
// tur da koşuyorsa aynı cihaz iki döngüyle aynı aileyi sürüyordu. Veri
// bozulmazdı (sunucu koşullu yama ile korunuyor) ama Trakt kotası ve Worker'ın
// IP sınırı iki kat yenirdi.
//
// Kilit kimin elinde olduğunu da söyler: arayüz "motor sürüyor, elle başlatma
// düğmesini gizle" kararını buradan verir.

export type KilitSahibi = 'motor' | 'elle';

let sahip: KilitSahibi | null = null;

/** Kilidi almayı dener. Başkası tutuyorsa `false` — çağıran BEKLEMEZ, vazgeçer. */
export function kilitAl(kim: KilitSahibi): boolean {
  if (sahip !== null) return false;
  sahip = kim;
  return true;
}

/** Yalnızca sahibi bırakabilir — yanlış sıralı bir `finally` başkasının kilidini açmasın. */
export function kilitBirak(kim: KilitSahibi): void {
  if (sahip === kim) sahip = null;
}

export const kilitSahibi = (): KilitSahibi | null => sahip;
