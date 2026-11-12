const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
export const SURUM_ISTEGI_SINIRI_MS = 5000;

// "Zorunlu Güncelleme" (Force Update) mekanizmasının tek okuma noktası — bkz.
// supabase/schema/009_app_settings.sql. Salt okunur (anon key + RLS SELECT,
// feed'deki `getFeedPrivacySettings` ile aynı desen); yazma yalnızca Supabase
// Dashboard'dan elle yapılır, istemcide hiçbir yazma yolu YOKTUR.
//
// YAYIN_ONCESI_PLAN Adım 1 (076): kapı sürüm ADINA değil yapı numarasına (versionCode) bakar.
// Mağaza adı 1.0.0 olunca ad karşılaştırması 1.0.0'ı 2.6.8'den eski sayıp kilitlerdi.
// `min_required_version` / `latest_version` canlıda DURUR: sahadaki 2.6.x APK'lar onları okur.
// Bu istemci onlara hiç bakmaz.
export interface AppSettings {
  /** Bundan küçük yapı numarası açılışta engellenir. `null` → engel yok. */
  minRequiredBuild: number | null;
  /** Bundan küçük yapı numarasına «yeni sürüm var» bandı. `null` → bant yok. */
  latestBuild: number | null;
  /** Yan yüklenen APK'nın güncelleme adresi (indirme sayfası). */
  updateUrl: string | null;
  /** Play paketinin güncelleme adresi. */
  storeUpdateUrl: string | null;
}

/** `app_settings` tablosunun tek satırını (id=1) okur. Satır hiç yoksa/DB
 * erişilemezse `null` döner — çağıran taraf (`useVersionGate`) bunu "kontrol
 * edilemedi, engelleme" olarak yorumlar (fail-open, bkz. o dosyadaki not). */
export async function getAppSettings(): Promise<AppSettings | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  // ⏱️ HIZ-01 (M542): supabase-js İSTEMCİSİ KULLANILMIYOR. O istemci her istekte önce kullanıcı
  // belgesini (`/auth/supabase-token`) bekliyor; belge isteği takılınca sürüm kontrolü de
  // takılıyordu (panelde iki kez 20,5 sn). `app_settings` anon okunabilir (RLS SELECT, `009`) —
  // kimlik gerekmez. Düz REST + 5 sn sınır; aşılırsa `null` (fail-open, kapı engellemez).
  const denetci = new AbortController();
  const zamanlayici = setTimeout(() => denetci.abort(), SURUM_ISTEGI_SINIRI_MS);
  try {
    const res = await fetch(
      // 🔴 `select=*`, kolon adı sayılmaz: sayılan bir kolon canlıda yoksa PostgREST 400 döner ve
      // kapı sessizce «açık» kalırdı (fail-open hatayı gizler).
      `${SUPABASE_URL}/rest/v1/app_settings?id=eq.1&select=*`,
      {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        signal: denetci.signal,
      },
    );
    if (!res.ok) {
      console.error('Trakt DIŞI hata (getAppSettings):', res.status);
      return null;
    }
    const satirlar = await res.json().catch(() => null);
    return ayarlariCoz(Array.isArray(satirlar) ? satirlar[0] : null);
  } catch (error) {
    console.warn('[getAppSettings] okunamadı (fail-open):', (error as Error)?.message ?? error);
    return null;
  } finally {
    clearTimeout(zamanlayici);
  }
}

/** Saf — pozitif tam sayı ya da `null` (metin «13» de kabul; 0, negatif, kesirli, bozuk → `null`). */
export function yapiNumarasi(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const metinYaDaNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

/** Saf — sınanır. Satır yoksa `null`; alanlar tek tek doğrulanır, bozuk alan `null` olur. */
export function ayarlariCoz(data: any): AppSettings | null {
  if (!data || typeof data !== 'object') return null;
  return {
    minRequiredBuild: yapiNumarasi(data.min_required_build),
    latestBuild: yapiNumarasi(data.latest_build),
    updateUrl: metinYaDaNull(data.update_url),
    storeUpdateUrl: metinYaDaNull(data.store_update_url),
  };
}
