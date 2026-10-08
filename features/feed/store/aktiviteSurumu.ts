import { create } from 'zustand';

/**
 * M468 · A1 — «Kendi aktivitem değişti» sinyali.
 *
 * `useActivityFeed` veriyi yalnız bileşen AÇILIRKEN çekiyor. Profil sekmesi
 * arka planda açık kaldığı için geçmiş silme / puan kaldırma / izleme geri
 * alma sonrası önbellek temizlense bile liste uygulama kapanana kadar eski
 * olayları gösteriyordu (M451, M455). `retractLocalActivity` sunucu yanıtından
 * SONRA sürümü artırır; açık listeler sessizce (iskelet göstermeden) tazelenir.
 */
interface AktiviteSurumuState {
  surum: number;
  artir: () => void;
}

export const useAktiviteSurumu = create<AktiviteSurumuState>((set) => ({
  surum: 0,
  artir: () => set((s) => ({ surum: s.surum + 1 })),
}));
