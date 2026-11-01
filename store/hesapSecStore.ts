import { create } from 'zustand';
import type { HesapOzeti } from '../services/api/girisYontemi';

/**
 * Kimlik Faz 5 (M520) — çakışma anından «Hesap Seç» ekranına taşınan durum.
 * 🔴 YALNIZ BELLEKTE: yeni Trakt erişimi ve biletler diske YAZILMAZ (uygulama kapanırsa
 * kişi bağlamayı baştan yapar — Hesap Seç bileti 10 dk, kasa bileti 15 dk geçerli).
 */
export type HesapSecDurumu = {
  bilet: string;
  yontem: 'trakt' | 'google';
  hesaplar: { mevcut: HesapOzeti; diger: HesapOzeti };
  /** Trakt bağlamasında az önce alınan erişim + kasa bileti — seçimden sonra oturum bunlardan açılır. */
  yeniTrakt?: { access: string; kasaBileti: string };
};

export const useHesapSecStore = create<{ durum: HesapSecDurumu | null }>(() => ({ durum: null }));

export const hesapSecDurumuKoy = (durum: HesapSecDurumu) => useHesapSecStore.setState({ durum });
export const hesapSecDurumuTemizle = () => useHesapSecStore.setState({ durum: null });
