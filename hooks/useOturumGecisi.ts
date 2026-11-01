import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Kimlik Faz 5 (M520) — bağlama / Hesap Seç sonrası oturumu BAŞKA bir belgeye geçirir.
 *
 * Neden önce tam çıkış: kalan hesap bugünkünden farklı olabilir (users.id değişir).
 * `removeKeys` kimliğe bağlı her önbelleği, kuyruğu ve görsel önbelleğini temizler (D8);
 * ardından yeni Trakt token'ıyla oturum açılır — eski hesabın hiçbir izi yeni oturuma taşınmaz.
 */
export function useOturumGecisi() {
  const { removeKeys, saveTokens } = useAuth();
  return useCallback(
    async (access: string, kaymakOturum: string, userId?: string) => {
      await removeKeys();
      await saveTokens(access, kaymakOturum, userId);
    },
    [removeKeys, saveTokens]
  );
}
