/**
 * Supabase belgesinin ZAMAN HESABI — saf, bağımlılıksız (ISCI-SUPABASE-ISTEMCI, K-50).
 *
 * ⚠️ `supabaseKimlik.ts` açılış yolunda ve bu dosyayı içe aktarıyor → burada
 * HİÇBİR import yok (bkz. `supabaseClient.ts` 2026-08-30 açılış çökmesi notu).
 *
 * NEDEN CİHAZ SAATİYLE KARŞILAŞTIRILMIYOR: Worker mutlak bir bitiş (`expiresAt`,
 * sunucu saati) veriyor. Eskiden bu doğrudan cihazın `Date.now()`'uyla
 * karşılaştırılıyordu: saat ≥ (ömür − pay) ileriyse belge hiç önbelleğe
 * girmiyor, her istek Worker'a gidiyordu (IP başı 30/dk → 429 → anon); saat
 * pay'dan çok geriyse süresi dolmuş belge gönderiliyordu (PostgREST 401).
 * Şimdi GÖRELİ hesap: ömür = belgenin kendi `exp − iat`'ı (ikisi de sunucu
 * saati, fark sapmadan bağımsız), geçen süre = yerel saatte isteğin
 * BAŞINDAN beri geçen süre. Sabit bir sapma iki ölçümde de aynı olduğu için
 * sadeleşir.
 *
 * NEDEN İKİ SAAT (duvar + monoton) VE `max`: duvar saati (`Date.now`) cihaz
 * uyurken de ilerler ama kullanıcı/NTP onu geri alabilir; monoton saat
 * (`performance.now`) geri gitmez ama Android'de derin uykuda DURUR. Hangisi
 * daha çok süre geçtiğini söylüyorsa ona inanılır → belge hiçbir durumda
 * gerçek bitişinden sonra kullanılmaz (hata yönü: biraz erken yenilemek).
 */

/** Belgenin bitişine bu kadar kala yenilenir (kısa ömürde ömrün yarısı). */
export const YENILEME_PAYI_MS = 120_000;
/** Belge bitişe bundan az kalınca artık hiç gönderilmez (istek yolda dolmasın). */
export const GUVENLIK_PAYI_MS = 15_000;
/** Belgeden ömür okunamazsa varsayılan (K-50'nin hedeflediği en kısa ömür). */
export const YEDEK_OMUR_MS = 300_000;
const EN_UZUN_OMUR_MS = 24 * 3_600_000;

/** Ardışık hatalarda üstel geri çekilme: 5 sn, 10, 20, 40, 80, 120 (tavan). */
export const GERI_CEKILME_TABANI_MS = 5_000;
export const GERI_CEKILME_TAVANI_MS = 120_000;
/** Worker'ın IP sınırı 60 sn'lik kayan pencere — 429'dan sonra en az bu kadar. */
export const HIZ_SINIRI_BEKLEMESI_MS = 60_000;

/** Bir an: duvar saati (ms) + varsa monoton saat (ms). */
export type Saat = { duvar: number; monoton: number | null };
export type BelgeKaydi = { token: string; omurMs: number; alis: Saat };
export type BelgeDurumu = 'taze' | 'yenilenmeli' | 'dolmus';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// `atob` her çalışma zamanında yok sayılmasın diye küçük bir base64url çözücü.
function base64UrlCoz(parca: string): string | null {
  let bitler = 0;
  let tampon = 0;
  let cikti = '';
  for (const ch of parca.replace(/=+$/, '')) {
    const deger = B64.indexOf(ch === '+' ? '-' : ch === '/' ? '_' : ch);
    if (deger < 0) return null;
    tampon = (tampon << 6) | deger;
    bitler += 6;
    if (bitler >= 8) {
      bitler -= 8;
      cikti += String.fromCharCode((tampon >> bitler) & 0xff);
    }
  }
  return cikti;
}

/** JWT'nin `exp − iat`'ı (ms). İmza DOĞRULANMAZ — yalnız zamanlama için. */
export function jwtOmruMs(token: string): number | null {
  const parcalar = typeof token === 'string' ? token.split('.') : [];
  if (parcalar.length !== 3) return null;
  const metin = base64UrlCoz(parcalar[1]);
  if (metin == null) return null;
  try {
    const { iat, exp } = JSON.parse(metin) ?? {};
    if (!Number.isFinite(iat) || !Number.isFinite(exp)) return null;
    const ms = (exp - iat) * 1000;
    return ms > 0 && ms <= EN_UZUN_OMUR_MS ? ms : null;
  } catch {
    return null;
  }
}

/**
 * Belgenin ömrü (ms). Önce belgenin kendi `exp − iat`'ı; okunamazsa sunucunun
 * `expiresAt`'ı ile cihaz saati (sapmaya açık) — en çok `YEDEK_OMUR_MS`.
 */
export function belgeOmruMs(token: string, expiresAtSn: number, simdiDuvarMs: number): number {
  const jwt = jwtOmruMs(token);
  if (jwt != null) return jwt;
  const kalan = Number(expiresAtSn) * 1000 - simdiDuvarMs;
  return Number.isFinite(kalan) && kalan > 0 ? Math.min(kalan, YEDEK_OMUR_MS) : YEDEK_OMUR_MS;
}

/** `alis`tan beri geçen süre (ms) — iki saatten büyüğü, en az 0. */
export function gecenMs(alis: Saat, simdi: Saat): number {
  const duvar = simdi.duvar - alis.duvar;
  const monoton =
    alis.monoton != null && simdi.monoton != null ? simdi.monoton - alis.monoton : Number.NEGATIVE_INFINITY;
  return Math.max(duvar, monoton, 0);
}

export function kalanMs(kayit: BelgeKaydi, simdi: Saat): number {
  return kayit.omurMs - gecenMs(kayit.alis, simdi);
}

export function yenilemePayiMs(omurMs: number): number {
  return Math.min(YENILEME_PAYI_MS, omurMs / 2);
}

/**
 * `taze`: olduğu gibi kullan · `yenilenmeli`: yenilemeyi dene, olmazsa HÂLÂ
 * kullanılabilir · `dolmus`: gönderme (anon'a düş ya da yenisini bekle).
 */
export function belgeDurumu(kayit: BelgeKaydi, simdi: Saat): BelgeDurumu {
  const kalan = kalanMs(kayit, simdi);
  if (kalan <= GUVENLIK_PAYI_MS) return 'dolmus';
  if (kalan <= yenilemePayiMs(kayit.omurMs)) return 'yenilenmeli';
  return 'taze';
}

/**
 * `ardisikHata`. hatadan sonra yeniden denemeden önce beklenecek süre.
 * ±%20 sapma: aynı anda düşen istemciler Worker'a aynı saniyede dönmesin.
 */
export function geriCekilmeMs(
  ardisikHata: number,
  durumKodu: number | null,
  rastgele: () => number = Math.random,
): number {
  const n = Math.max(1, Math.floor(ardisikHata) || 1);
  const ussel = Math.min(GERI_CEKILME_TAVANI_MS, GERI_CEKILME_TABANI_MS * 2 ** Math.min(n - 1, 20));
  const sapmali = Math.min(GERI_CEKILME_TAVANI_MS, ussel * (0.8 + 0.4 * rastgele()));
  const taban = durumKodu === 429 ? HIZ_SINIRI_BEKLEMESI_MS : 0;
  return Math.round(Math.max(taban, sapmali));
}

/**
 * Sunucu oturumun GEÇERSİZ olduğunu söyledi (401 `invalid_token` — iptal
 * edilmiş/süresi dolmuş oturum dahil; 403 `google_unlinked`). Bu durumda
 * eldeki belgeyi bitişine kadar kullanmak iptali (K-50) boşa çıkarır →
 * bırakılır. Diğer her hata (ağ, 429, 5xx, 522) geçici sayılır.
 */
export function kesinRetMi(durumKodu: number | null): boolean {
  return durumKodu === 401 || durumKodu === 403;
}
