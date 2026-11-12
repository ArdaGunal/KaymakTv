import { yapiNumarasi } from './appSettingsApi';

// M458 · Sürüm kapısının saklanan son sonucu. Açılışta AĞI BEKLEMEDEN karar
// vermek için cihazda tutulur (bkz. useVersionGate.ts): her açılışta 1–5 sn boş
// ekran (Geliştirici Paneli, 2026-10-08) yerine anında açılış.
//
// YAYIN_ONCESI_PLAN Adım 1 · v2: karar yapı numarasıyla (versionCode). v1 sürüm ADINI
// («2.6.8») tutuyordu; 2.6.8 üzerine kurulan 1.0.0 onu okusaydı ağı beklemeden kilitlenirdi.
// 🔴 v1 HİÇ OKUNMAZ; kanca açılışta siler.
export const SURUM_ONBELLEK_ANAHTARI = '@kaymak_surum_kapisi_v2';
export const ESKI_SURUM_ONBELLEK_ANAHTARI = '@kaymak_surum_kapisi_v1';

export interface SurumOnbellegi {
  /** `null` → sunucuda sınır yok (önceki engel de kalkar). */
  minRequiredBuild: number | null;
  /** Kanala göre çözülmüş güncelleme adresi (`dagitim.ts`). */
  updateUrl: string | null;
}

export type SurumKarari =
  | { durum: 'ok' }
  | { durum: 'blocked'; updateUrl: string | null };

/** Cihazdaki ham yapı numarası (`Application.nativeBuildVersion`, metin) → sayı ya da `null`. */
export const kuruluYapiNumarasi = (ham: string | null | undefined): number | null => yapiNumarasi(ham);

/** Saf karar: kurulu yapı numarası sınırdan KESİNLİKLE küçükse engel.
 * Kurulu numara bilinmiyorsa ya da sınır yoksa `ok` (fail-open — useVersionGate.ts notu).
 * 🔴 Sürüm ADINA geri düşülmez: ada bakan bir yedek yol 1.0.0'ı yine kilitler. */
export function surumKarari(kuruluYapi: number | null, kayit: SurumOnbellegi | null): SurumKarari {
  if (kuruluYapi === null || !kayit?.minRequiredBuild) return { durum: 'ok' };
  return kuruluYapi < kayit.minRequiredBuild
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

/** AsyncStorage'dan okunan ham metni doğrular; şekil yanlışsa `null` (= sınır yok). */
export function onbellegiCoz(ham: string | null): SurumOnbellegi | null {
  if (!ham) return null;
  try {
    const v = JSON.parse(ham);
    const sinir = yapiNumarasi(v?.minRequiredBuild);
    if (sinir === null) return null;
    return { minRequiredBuild: sinir, updateUrl: typeof v.updateUrl === 'string' ? v.updateUrl : null };
  } catch {
    return null;
  }
}
