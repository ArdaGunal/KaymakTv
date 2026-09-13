import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getMySupabaseUserId } from '../services/userBlocks';

/**
 * Bileşen seviyesinde "bu benim mi?" karşılaştırmaları için — `useMyTraktSlug`'ın
 * KİMLİK karşılığı (Faz T · M339 · `BACKLOG` §F6).
 *
 * ⛔ NEDEN slug YERİNE BU: Google-only kullanıcının Trakt slug'ı YOK. Kartlar
 * "kendi içeriğim mi" sorusunu slug'la sorduğunda o kullanıcı KENDİ kartında
 * "Sil" yerine "Engelle" görüyordu (ve basarsa Worker kendini engellemeyi
 * reddediyordu). `users.id` her kullanıcıda var ve değişmez.
 *
 * `getMySupabaseUserId` modül seviyesinde + diskte önbellekli — bu hook ek ağ
 * isteği yaratmıyor, yalnızca değeri React state'ine bağlıyor.
 */
export function useMyUserId(): string | null {
  const { accessToken, isGuest } = useAuth();
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || isGuest) {
      setId(null);
      return;
    }
    let cancelled = false;
    getMySupabaseUserId()
      .then((v) => {
        if (!cancelled) setId(v);
      })
      .catch((error) => {
        // Sessiz değil: kimlik çözülemezse her kart "başkasının" sayılır.
        if (!cancelled) console.warn('[useMyUserId] Kimlik çözülemedi:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, isGuest]);

  return id;
}
