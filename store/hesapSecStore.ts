import { create } from 'zustand';
import type { HesapOzeti } from '../services/api/girisYontemi';

/**
 * Kimlik Faz 5 (M520) — çakışma anından «Hesap Seç» ekranına taşınan durum.
 * 🔴 YALNIZ BELLEKTE: yeni Trakt token'ları ve bilet diske YAZILMAZ (uygulama kapanırsa
 * kişi bağlamayı baştan yapar — bilet zaten 10 dk geçerli).
 */
export type HesapSecDurumu = {
  bilet: string;
  yontem: 'trakt' | 'google';
  hesaplar: { mevcut: HesapOzeti; diger: HesapOzeti };
  /** Trakt bağlamasında az önce alınan token'lar — seçimden sonra oturum bunlara geçer. */
  yeniTrakt?: { access: string; refresh: string };
};

export const useHesapSecStore = create<{ durum: HesapSecDurumu | null }>(() => ({ durum: null }));

export const hesapSecDurumuKoy = (durum: HesapSecDurumu) => useHesapSecStore.setState({ durum });
export const hesapSecDurumuTemizle = () => useHesapSecStore.setState({ durum: null });
