import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getMyTraktSlug } from '../../../services/api/myIdentity';

/**
 * Bileşen seviyesinde "bu benim mi?" karşılaştırmaları için (ör. FeedCard'da
 * kendi aktivitene not ekleme butonunu göstermek). `services/api/myIdentity.ts`
 * zaten modül seviyesinde önbellekliyor — bu hook yalnızca onu React state'ine
 * bağlıyor, ek bir ağ isteği yaratmıyor.
 */
export function useMyTraktSlug(): string | null {
  const { accessToken, isGuest } = useAuth();
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || isGuest) {
      setSlug(null);
      return;
    }
    let cancelled = false;
    getMyTraktSlug().then((s) => {
      if (!cancelled) setSlug(s);
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken, isGuest]);

  return slug;
}
