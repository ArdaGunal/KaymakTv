/**
 * usePublicProfile — başkasının TRAKT profilinden ZENGİNLEŞTİRME: isim,
 * biyografi, (Trakt) avatarı.
 *
 * ⛔ M338'DEN BERİ KİMLİK KAYNAĞI DEĞİL. Kimlik, takipçi sayıları ve takip
 * ilişkisi `usePublicProfileIdentity` → `/social/profile`'dan geliyor. Bu hook
 * YALNIZCA sunucunun döndürdüğü gerçek `traktSlug` ile çağrılmalı — rota
 * parametresiyle (KaymakTV `username`) DEĞİL; gerekçe o dosyanın başlığında.
 *
 * ⛔ Takipçi/takip sayıları BURADAN KALDIRILDI (artık bizim graftan). Eskiden
 * her profil açılışı Trakt'a 3 istek atıyordu (profil + iki liste) ve iki
 * liste yalnızca `.length` için indiriliyordu. Şimdi 1.
 *
 * Trakt'ın `/users/:id` ucu herkese açık (auth gerektirmiyor) — misafir de
 * başkasının profilini görebilir, bu yüzden token koruması YOK.
 */

import { useEffect, useState } from 'react';
import { getUserProfile, TraktUserProfile } from '../../../services/api/social';

export type PublicProfileError = 'not_found' | 'generic';

export function usePublicProfile(traktSlug: string | null) {
  const [profile, setProfile] = useState<TraktUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<PublicProfileError | null>(null);

  useEffect(() => {
    // Anahtar değişince önceki kişinin Trakt verisi bir an bile kalmasın.
    setProfile(null);
    if (!traktSlug) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const result = await getUserProfile(traktSlug);
        if (!cancelled) setProfile(result);
      } catch (err: any) {
        if (cancelled) return;
        console.warn('[PublicProfile] Trakt profili yüklenemedi:', err);
        setError(err?.response?.status === 404 ? 'not_found' : 'generic');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [traktSlug]);

  return { profile, isLoading, error };
}
