import { isVersionBelow } from '../../../utils/semver';

// M458 · Sürüm kapısının saklanan son sonucu. Açılışta AĞI BEKLEMEDEN karar
// vermek için cihazda tutulur (bkz. useVersionGate.ts): her açılışta 1–5 sn boş
// ekran (Geliştirici Paneli, 2026-10-08) yerine anında açılış.
export const SURUM_ONBELLEK_ANAHTARI = '@kaymak_surum_kapisi_v1';

export interface SurumOnbellegi {
  minRequiredVersion: string;
  updateUrl: string | null;
}

export type SurumKarari =
  | { durum: 'ok' }
  | { durum: 'blocked'; updateUrl: string | null };

/** Saf karar: önbellek/sunucu sonucu ile kurulu sürümü karşılaştırır.
 * Önbellek yoksa ya da bozuksa `ok` (fail-open — dosya başı notu). */
export function surumKarari(kurulu: string | null, kayit: SurumOnbellegi | null): SurumKarari {
  if (!kurulu || !kayit?.minRequiredVersion) return { durum: 'ok' };
  return isVersionBelow(kurulu, kayit.minRequiredVersion)
    ? { durum: 'blocked', updateUrl: kayit.updateUrl }
    : { durum: 'ok' };
}

/**
 * 2.6.5 madde 8 · Oturum içindeki sunucu sonucu kapıyı yalnız GEVŞETEBİLİR.
 * Uygulamayı kullanan kişinin ağacı oturum ortasında engel ekranına
 * çevrilmez (kasma); yeni engel önbelleğe yazılır, bir sonraki soğuk açılışta
 * uygulanır — o ana kadar üstte güncelleme bandı görünür (`useSoftUpdate`).
 */
export function oturumIciKarar(mevcut: SurumKarari, sunucu: SurumKarari): SurumKarari {
  return mevcut.durum === 'ok' ? { durum: 'ok' } : sunucu;
}

/** AsyncStorage'dan okunan ham metni doğrular; şekil yanlışsa `null`. */
export function onbellegiCoz(ham: string | null): SurumOnbellegi | null {
  if (!ham) return null;
  try {
    const v = JSON.parse(ham);
    if (typeof v?.minRequiredVersion !== 'string' || !v.minRequiredVersion) return null;
    return { minRequiredVersion: v.minRequiredVersion, updateUrl: typeof v.updateUrl === 'string' ? v.updateUrl : null };
  } catch {
    return null;
  }
}
