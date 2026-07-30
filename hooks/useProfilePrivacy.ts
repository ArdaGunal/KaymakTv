import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getProfilePrivacy, updateProfilePrivacy } from '../services/api/users';
import { notify } from '../utils/confirmDialog';

/**
 * Trakt'ın hesap düzeyindeki Gizli/Açık Hesap ayarı (`user.private`) —
 * `features/feed/hooks/useFeedPrivacy.ts`teki AYNI desen (optimistic update +
 * hata durumunda rollback), ama KaymakTV'nin kendi Supabase tabanlı akış
 * gizliliğinden (publishWatches/publishRatings) TAMAMEN BAĞIMSIZ bir Trakt
 * ayarı olduğu için ayrı bir hook. Global bir Zustand store'a KONULMADI —
 * bu proje zaten kullanıcı ayarları için bu desende (yerel hook state +
 * optimistic + rollback) çalışıyor; tek bir bayrak için paralel bir state
 * yönetimi mimarisi eklemek gereksiz karmaşıklık olurdu.
 */
export function useProfilePrivacy() {
  const { accessToken, isGuest } = useAuth();
  const { t } = useTranslation('common');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!accessToken || isGuest) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const current = await getProfilePrivacy();
        if (!cancelled) setIsPrivate(current);
      } catch (error) {
        console.warn('[useProfilePrivacy] Gizlilik durumu okunamadı:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, isGuest]);

  const toggle = useCallback(
    async (value: boolean) => {
      if (!accessToken) return;
      const previous = isPrivate;
      setIsPrivate(value); // iyimser (optimistic) güncelleme
      setIsSaving(true);
      try {
        await updateProfilePrivacy(value);
      } catch (error) {
        console.warn('[useProfilePrivacy] Gizlilik ayarı kaydedilemedi:', error);
        setIsPrivate(previous); // başarısızsa geri al (rollback)
        notify(
          t('error', 'Hata'),
          t('actionFailedMessage', 'İşlem gerçekleştirilemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.')
        );
      } finally {
        setIsSaving(false);
      }
    },
    [accessToken, isPrivate, t]
  );

  return { isPrivate, isLoading, isSaving, toggle };
}
