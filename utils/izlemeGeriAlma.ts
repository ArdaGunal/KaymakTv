// ==========================================================================
// İZLEME GERİ ALMA SEÇİMİ — 2x ve üzerinde güvenli sunum (1.0.1 Dal 4)
// ==========================================================================
// Kullanıcı (2026-11-15): 2x/3x içerikte izleme işaretine dokunmak hiçbir şeyi doğrudan silmez;
// «Son izlemeyi geri al (3x → 2x)» ve «Tüm izlemeleri kaldır» açıkça sunulur, ikincisi ayrıca onay
// ister (kaç izlemenin silineceği yazılır). 1x içerikte bugünkü davranış aynı: doğrudan kaldırma.

import type { TFunction } from 'i18next';
import { chooseAsync, confirmAsync } from './confirmDialog';

export type GeriAlmaSecimi = 'son' | 'tumu' | null;

/** «Tüm izlemeleri kaldır» onayı — yalnız 2+ izlemede sorulur; 1x'te sormadan `true`. */
export const tumunuKaldirOnayi = (t: TFunction, plays: number): Promise<boolean> =>
  plays < 2
    ? Promise.resolve(true)
    : confirmAsync(
      t('media:unwatchAllTitle', 'Tüm İzlemeleri Kaldır'),
      t('media:unwatchAllMsg', { count: plays, defaultValue: '{{count}} izlemenin hepsi silinecek. Bu işlem geri alınamaz.' }),
      t('media:unwatchAllConfirm', 'Hepsini Kaldır'),
      t('common:cancel', 'İptal'),
      { destructive: true },
    );

/**
 * İşarete dokunulduğunda ne yapılacağı. 1x → `tumu` (soru yok). 2x+ → seçim; «Tümü» ise onay.
 * Dışarı dokunma / Vazgeç / onaydan vazgeçme → `null` (çağıran HİÇBİR ŞEY yapmaz).
 */
export async function geriAlmaSor(t: TFunction, plays: number): Promise<GeriAlmaSecimi> {
  if (plays < 2) return 'tumu';
  const secim = await chooseAsync(
    t('media:unwatchChoiceTitle', 'Bu içeriği {{count}} kez izledin', { count: plays }),
    t('media:unwatchChoiceMsg', 'Yalnız son izlemeyi mi geri almak istiyorsun, yoksa hepsini mi?'),
    t('media:unwatchLastPlay', { from: plays, to: plays - 1, defaultValue: 'Son izlemeyi geri al ({{from}}x → {{to}}x)' }),
    t('media:unwatchAllPlays', 'Tüm izlemeleri kaldır'),
  );
  if (secim === 'primary') return 'son';
  if (secim === 'secondary') return (await tumunuKaldirOnayi(t, plays)) ? 'tumu' : null;
  return null;
}
