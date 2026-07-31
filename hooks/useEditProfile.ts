import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../services/api/users';
import { TraktUserProfile } from '../services/api/social';
import { notify } from '../utils/confirmDialog';
import { logError } from '../utils/errorLog';

/**
 * `useProfilePrivacy.ts` ile AYNI desen (yerel hook state, global Zustand
 * store'a KONULMADI — bkz. o dosyadaki gerekçe, burada da geçerli). Form
 * alanları `profile` geldiğinde/değiştiğinde bir kez doldurulur, sonrası
 * tamamen kullanıcı girdisiyle yönetilir.
 */
export function useEditProfile(profile: TraktUserProfile | null) {
  const { accessToken, isGuest } = useAuth();
  const { t } = useTranslation('common');
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? '');
    setAbout(profile.about ?? '');
  }, [profile]);

  const save = async (): Promise<boolean> => {
    if (!accessToken || isGuest) return false;
    setIsSaving(true);
    try {
      await updateProfile({ name: name.trim(), about: about.trim() });
      return true;
    } catch (error) {
      // Kalıcı hata günlüğüne de yazılır (yalnızca console.warn YETMEZ, bkz.
      // docs/AI_RULES.md): `updateProfile` artık yaz-sonra-oku doğrulaması
      // yapıyor ve başarısızlığın SEBEBİNİ mesajında taşıyor — bu ayrıntı
      // Ayarlar > Hata Günlüğü ekranından okunabilsin diye kaydediliyor.
      console.warn('[useEditProfile] Profil kaydedilemedi:', error);
      logError('useEditProfile.save', error);
      notify(t('error', 'Hata'), t('actionFailedMessage', 'İşlem gerçekleştirilemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return { name, setName, about, setAbout, isSaving, save };
}
