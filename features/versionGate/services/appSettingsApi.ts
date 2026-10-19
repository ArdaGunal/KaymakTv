const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
export const SURUM_ISTEGI_SINIRI_MS = 5000;

// "Zorunlu Güncelleme" (Force Update) mekanizmasının tek okuma noktası — bkz.
// supabase/schema/009_app_settings.sql. Salt okunur (anon key + RLS SELECT,
// feed'deki `getFeedPrivacySettings` ile aynı desen); yazma yalnızca Supabase
// Dashboard'dan elle yapılır, istemcide hiçbir yazma yolu YOKTUR.
export interface AppSettings {
  minRequiredVersion: string;
  latestVersion: string;
  updateUrl: string;
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
      `${SUPABASE_URL}/rest/v1/app_settings?id=eq.1&select=min_required_version,latest_version,update_url`,
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

/** Saf — sınanır. Eksik satır/alan → `null`. */
export function ayarlariCoz(data: any): AppSettings | null {
  if (!data?.min_required_version || !data?.update_url) return null;
  return {
    minRequiredVersion: data.min_required_version,
    latestVersion: data.latest_version || data.min_required_version,
    updateUrl: data.update_url,
  };
}
