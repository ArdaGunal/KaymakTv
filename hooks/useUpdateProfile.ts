import { useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfile, ProfileUpdateError, UpdateProfilePatch } from '../features/feed/services/profile';

export interface UpdateProfileErrorState {
  code?: 'taken' | 'cooldown';
  message: string;
  retryAt?: string;
}

/**
 * `updateProfile`'ın (kullanıcı adı + Google fotoğrafı) ortak kaydetme
 * mantığı — hem onboarding ekranı (`app/(public)/profil-olustur.tsx`) hem
 * Ayarlar'daki `EditProfileModal` bunu kullanır. Sunucu hatasını
 * (`taken`/`cooldown`, `useFeedPrivacy.ts`'teki Y18 deseninin aynısı —
 * sessiz geri alma GERİ BİLDİRİM DEĞİLDİR, AI_RULES §2) ve başarı sonrası
 * `AuthContext`'in yerel kopyasını güncellemeyi TEK yerde topluyor.
 */
export function useUpdateProfile() {
  const { accessToken, updateMyProfile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<UpdateProfileErrorState | null>(null);

  const save = useCallback(
    async (patch: UpdateProfilePatch): Promise<boolean> => {
      if (!accessToken) return false;
      setError(null);
      setIsSaving(true);
      try {
        await updateProfile(accessToken, patch);
        await updateMyProfile(patch);
        return true;
      } catch (e) {
        const err = e as ProfileUpdateError;
        setError({ code: err.code, message: err.message, retryAt: err.retryAt });
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [accessToken, updateMyProfile]
  );

  const clearError = useCallback(() => setError(null), []);

  return { save, isSaving, error, clearError };
}
