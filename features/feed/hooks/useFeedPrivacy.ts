import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getUserProfile } from '../../../services/api/social';
import { getFeedPrivacySettings, updateFeedPrivacy, FeedPrivacySettings } from '../services/feedPrivacy';

const DEFAULT_SETTINGS: FeedPrivacySettings = {
  publishWatches: true,
  publishRatings: true,
};

type SavingKey = keyof FeedPrivacySettings | 'hideAll' | null;

export function useFeedPrivacy() {
  const { accessToken, isGuest } = useAuth();
  const [settings, setSettings] = useState<FeedPrivacySettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<SavingKey>(null);

  useEffect(() => {
    if (!accessToken || isGuest) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const profile = await getUserProfile('me');
        const current = await getFeedPrivacySettings(profile.ids.slug);
        if (!cancelled) setSettings(current);
      } catch (error) {
        console.warn('[Feed] Gizlilik ayarları okunamadı:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, isGuest]);

  // Tek bir alanı (İzlediklerimi Paylaş / Puanlarımı Paylaş) günceller.
  const update = useCallback(
    async (key: keyof FeedPrivacySettings, value: boolean) => {
      if (!accessToken) return;
      const previous = settings;
      setSettings((s) => ({ ...s, [key]: value })); // iyimser (optimistic) güncelleme
      setSavingKey(key);
      try {
        await updateFeedPrivacy(accessToken, { [key]: value });
      } catch (error) {
        setSettings(previous); // başarısızsa geri al
        console.warn('[Feed] Gizlilik ayarı kaydedilemedi:', error);
      } finally {
        setSavingKey(null);
      }
    },
    [accessToken, settings]
  );

  // "Her Şeyi Gizle" — DB'de ayrı bir alan DEĞİL, ikisini birden tek istekte
  // değiştiren bir kısayol. Açılınca ikisini de false yapar; kapanınca
  // ikisini de true'ya döndürür (bkz. kullanıcının istediği simetrik davranış).
  const setHideAll = useCallback(
    async (hide: boolean) => {
      if (!accessToken) return;
      const previous = settings;
      const next: FeedPrivacySettings = { publishWatches: !hide, publishRatings: !hide };
      setSettings(next);
      setSavingKey('hideAll');
      try {
        await updateFeedPrivacy(accessToken, next);
      } catch (error) {
        setSettings(previous);
        console.warn('[Feed] Gizlilik ayarı kaydedilemedi:', error);
      } finally {
        setSavingKey(null);
      }
    },
    [accessToken, settings]
  );

  // Türetilmiş (derived) durum — ikisi de kapalıysa "Her Şeyi Gizle" açık
  // görünür. Ayrı bir DB bayrağı yok, tek gerçek kaynak bu iki alan; biri
  // dışarıdan (ör. başka bir cihazdan) tekrar açılırsa bu değer otomatik
  // güncellenir, senkron dışı kalma riski yok.
  const hideAll = !settings.publishWatches && !settings.publishRatings;

  return { settings, hideAll, isLoading, savingKey, update, setHideAll };
}
