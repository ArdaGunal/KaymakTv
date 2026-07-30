/**
 * usePublicProfile — Public Profile ekranının üst bilgi bloğu (avatar, isim,
 * kullanıcı adı, takipçi/takip edilen sayıları) için. `getUserProfile`/
 * `getFollowers`/`getFollowing` zaten `services/api/social.ts`'te GENEL
 * fonksiyonlardı (yalnızca "me" değil, herhangi bir slug/username kabul
 * ediyor — bkz. hooks/useMyTraktProfile.ts'in "me" için aynı üçlüyü kullanan
 * mevcut deseni) — yeni bir servis fonksiyonu gerekmedi. Trakt'ın bu üç uç
 * noktası da herkese açık (auth gerektirmiyor, bkz. docs/feed.md), bu yüzden
 * `useMyTraktProfile.ts`'teki gibi bir accessToken/isGuest koruması burada
 * YOK — misafir bir kullanıcı bile başkasının profilini görebilir.
 */

import { useEffect, useState } from 'react';
import { getFollowers, getFollowing, getUserProfile, TraktUserProfile } from '../../../services/api/social';

export type PublicProfileError = 'not_found' | 'generic';

export function usePublicProfile(slug: string | null) {
  const [profile, setProfile] = useState<TraktUserProfile | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<PublicProfileError | null>(null);

  useEffect(() => {
    if (!slug) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const [result, followers, following] = await Promise.all([
          getUserProfile(slug),
          getFollowers(slug).catch(() => []),
          getFollowing(slug).catch(() => []),
        ]);
        if (cancelled) return;
        setProfile(result);
        setFollowersCount(followers.length);
        setFollowingCount(following.length);
      } catch (err: any) {
        if (cancelled) return;
        console.warn('[PublicProfile] Profil yüklenemedi:', err);
        setError(err?.response?.status === 404 ? 'not_found' : 'generic');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { profile, followersCount, followingCount, isLoading, error };
}
