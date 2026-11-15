import { useEffect, useState } from 'react';
import { useUpdateProfile } from './useUpdateProfile';
import { gorunenAdDenetle, gorunenAdGirdisi } from '../utils/gorunenAd';

/**
 * Görünen ad düzenleme penceresinin mantığı (`components/modals/EditDisplayNameModal.tsx`).
 * 1.0.1 Dal 1 — kural K2, kaldırma hakkı K4; bağımsız denetim bulgusu 2 (2026-11-15).
 *
 * - Görünmez karakterler yazarken kutudan çıkar ve `gorunmezAyiklandi` ile bildirilir.
 * - 🔴 Kutu YALNIZ ayıklama yüzünden boşaldıysa (ör. mevcut adın üstüne tek BOM yapıştırıldı)
 *   bu «adı kaldır» SAYILMAZ: Kaydet kapalı. Eskiden `null` gidip mevcut ad siliniyordu.
 * - Kutuyu ELLE boşaltmak görünen adı kaldırır (onaylı hesabın hakkı; arayüz @username'e düşer).
 * - Emoji/sembol kutuda kalır, `sorun` ile nedeni gösterilir, Kaydet kapalı.
 */
export function useGorunenAdDuzenle({ visible, currentName }: { visible: boolean; currentName: string | null }) {
  const { save, isSaving, error, clearError } = useUpdateProfile();
  const [value, setValue] = useState(currentName ?? '');
  const [gorunmezAyiklandi, setGorunmezAyiklandi] = useState(false);

  // Pencere her açılışta sunucudaki adla başlar.
  useEffect(() => {
    if (visible) {
      setValue(currentName ?? '');
      setGorunmezAyiklandi(false);
      clearError();
    }
  }, [visible, currentName, clearError]);

  const karar = gorunenAdDenetle(value);
  const yeni = karar.tur === 'yaz' ? karar.deger : null;
  const sorun = karar.tur === 'yaz' || karar.tur === 'temizle' ? null : karar.tur;
  const unchanged = (yeni ?? '') === (currentName ?? '');
  const ayiklamaylaBosaldi = gorunmezAyiklandi && karar.tur === 'temizle';
  const disabled = !!sorun || unchanged || ayiklamaylaBosaldi || isSaving;

  const onChange = (ham: string) => {
    const girdi = gorunenAdGirdisi(ham);
    setValue(girdi.deger);
    setGorunmezAyiklandi(girdi.ayiklandi);
  };

  /** `true` = kaydedildi. Kapalıyken istek atmaz. */
  const kaydet = async (): Promise<boolean> => {
    if (disabled) return false;
    return save({ displayName: yeni });
  };

  return { value, onChange, karar, yeni, sorun, gorunmezAyiklandi, disabled, kaydet, isSaving, error };
}
