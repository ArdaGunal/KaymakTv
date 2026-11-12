import { create } from 'zustand';

/**
 * Kural onayı penceresinin köprüsü (Adım 4b, M609) — `store/dialogStore.ts` ile aynı desen.
 *
 * `services/kuralOnayiKapisi.ts` her yerden (servis, kanca) `iste()` çağırır ve bir Promise
 * alır; pencereyi kökteki `components/rules/KuralOnayiHost.tsx` çizer.
 *
 * 🔴 Aynı anda TEK pencere: pencere açıkken gelen ikinci istek aynı sonucu bekler
 * (iki yorum aynı anda gönderilirse iki pencere açılmaz).
 * 🔴 Host bağlı değilse (`hostlar === 0`) `iste()` hemen `false` döner: çizilemeyen bir
 * pencere çağıranı sonsuza dek bekletmesin.
 */
interface KuralOnayiState {
  acik: boolean;
  hostlar: number;
  bekleyenler: Array<(kabul: boolean) => void>;
  iste: () => Promise<boolean>;
  sonuclandir: (kabul: boolean) => void;
  hostBaglandi: () => () => void;
}

export const useKuralOnayiStore = create<KuralOnayiState>((set, get) => ({
  acik: false,
  hostlar: 0,
  bekleyenler: [],
  iste: () =>
    new Promise<boolean>((resolve) => {
      if (get().hostlar === 0) {
        resolve(false);
        return;
      }
      set((s) => ({ acik: true, bekleyenler: [...s.bekleyenler, resolve] }));
    }),
  sonuclandir: (kabul) => {
    const bekleyenler = get().bekleyenler;
    set({ acik: false, bekleyenler: [] });
    bekleyenler.forEach((coz) => coz(kabul));
  },
  hostBaglandi: () => {
    set((s) => ({ hostlar: s.hostlar + 1 }));
    return () => {
      set((s) => ({ hostlar: Math.max(0, s.hostlar - 1) }));
      // Host söküldüyse bekleyen kalmasın.
      if (get().hostlar === 0 && get().bekleyenler.length > 0) get().sonuclandir(false);
    };
  },
}));
