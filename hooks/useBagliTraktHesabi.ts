import { useEffect, useState } from 'react';
import { getMyTraktSlug } from '../services/api/myIdentity';

/**
 * PROFIL-AD-01 (M519) — Trakt kullanıcı adı YALNIZ Ayarlar'da, «Bağlı Trakt hesabı» bilgisi
 * olarak görünür. Kullanıcı (2026-10-15): *«Trakt artık kullanıcının profil kimliğini
 * belirleyen ana kaynak değil, sadece arkada çalışan bir senkronizasyon eklentisidir.»*
 * Profil başlığı ve rotalar KaymakTV adını (`users.username`) kullanır.
 *
 * `getMyTraktSlug` disk-öncelikli ve Google-only/misafirde ağa çıkmadan `null` döner.
 */
export function useBagliTraktHesabi(bagli: boolean): string | null {
  const [slug, setSlug] = useState<string | null>(null);
  useEffect(() => {
    if (!bagli) { setSlug(null); return; }
    let canli = true;
    getMyTraktSlug()
      .then((s) => canli && setSlug(s))
      .catch(() => canli && setSlug(null));
    return () => { canli = false; };
  }, [bagli]);
  return slug;
}
