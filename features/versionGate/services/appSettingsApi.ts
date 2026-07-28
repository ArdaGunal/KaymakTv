import { supabase } from '../../feed/services/supabaseClient';

// "Zorunlu Güncelleme" (Force Update) mekanizmasının tek okuma noktası — bkz.
// supabase/schema/009_app_settings.sql. Salt okunur (anon key + RLS SELECT,
// feed'deki `getFeedPrivacySettings` ile aynı desen); yazma yalnızca Supabase
// Dashboard'dan elle yapılır, istemcide hiçbir yazma yolu YOKTUR.
export interface AppSettings {
  minRequiredVersion: string;
  updateUrl: string;
}

/** `app_settings` tablosunun tek satırını (id=1) okur. Satır hiç yoksa/DB
 * erişilemezse `null` döner — çağıran taraf (`useVersionGate`) bunu "kontrol
 * edilemedi, engelleme" olarak yorumlar (fail-open, bkz. o dosyadaki not). */
export async function getAppSettings(): Promise<AppSettings | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('min_required_version, update_url')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.error('Trakt DIŞI hata (getAppSettings):', error);
    return null;
  }
  if (!data?.min_required_version || !data?.update_url) return null;

  return {
    minRequiredVersion: data.min_required_version,
    updateUrl: data.update_url,
  };
}
