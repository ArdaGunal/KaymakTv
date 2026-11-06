import { useEffect, useState } from 'react';
import { useLibraryStore } from '../store/useLibraryStore';

/** Kütüphane takılırsa arka plan işleri sonsuza dek beklemesin. */
const EN_COK_BEKLEME_MS = 10_000;

/** Açılışın ilk kütüphane turu bitti mi? (HIZ-02 B3: görünen veri önce, kalan istekler sonra.) */
export function useKutuphaneHazir(): boolean {
  // `isLoading` DEĞİL: önbellek yüklenince kapanıyor, ağ turundan önce (gece emülatör testi 2026-11-06).
  const yukleniyor = useLibraryStore((s) => !s.ilkTurBitti);
  const [sureDoldu, setSureDoldu] = useState(false);

  useEffect(() => {
    setSureDoldu(false);
    if (!yukleniyor) return undefined;
    const zamanlayici = setTimeout(() => setSureDoldu(true), EN_COK_BEKLEME_MS);
    return () => clearTimeout(zamanlayici);
  }, [yukleniyor]);

  return !yukleniyor || sureDoldu;
}
