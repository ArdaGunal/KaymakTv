import { useEffect, useState } from 'react';
import { useLibraryStore } from '../store/useLibraryStore';

/** Kütüphane takılırsa arka plan işleri sonsuza dek beklemesin. */
const EN_COK_BEKLEME_MS = 10_000;

/** Açılışın ilk kütüphane okuması bitti mi? (HIZ-02 B3: görünen veri önce, kalan istekler sonra.) */
export function useKutuphaneHazir(): boolean {
  const yukleniyor = useLibraryStore((s) => s.isLoading);
  const [sureDoldu, setSureDoldu] = useState(false);

  useEffect(() => {
    setSureDoldu(false);
    if (!yukleniyor) return undefined;
    const zamanlayici = setTimeout(() => setSureDoldu(true), EN_COK_BEKLEME_MS);
    return () => clearTimeout(zamanlayici);
  }, [yukleniyor]);

  return !yukleniyor || sureDoldu;
}
