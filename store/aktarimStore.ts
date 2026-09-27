import { create } from 'zustand';

import type { MotorDurumu } from '../services/import/aktarimMotoru';

/**
 * Otomatik Trakt aktarımının arayüze görünen durumu (§C33).
 *
 * TEK YAZAN motor (`aktarimBaglanti.ts` → `yayinla`). Ekranlar yalnızca
 * OKUR: bant (`AktarimBandi`) ve "kütüphanen boş" yerine dürüst metin
 * (`useAktarimGorunumu`). Kalıcı DEĞİL — gerçek durum sunucuda; her açılışta
 * motor `/import/durum`'dan yeniden kurar.
 */
interface AktarimStore extends MotorDurumu {
  /** Bu oturumda bitmiş aktarımın bandı kullanıcı tarafından kapatıldı mı. */
  kapatildi: boolean;
  kapat: () => void;
}

export const useAktarimStore = create<AktarimStore>((set) => ({
  faz: 'bos',
  islenen: 0,
  toplam: 0,
  bekleyen: 0,
  bitenAile: 0,
  toplamAile: 0,
  yuzde: null,
  kapatildi: false,
  kapat: () => set({ kapatildi: true }),
}));

/** Motorun yayını. Yeni bir koşu başlarken (`kontrol`) kapatma bayrağı sıfırlanır. */
export const aktarimDurumunuYaz = (d: MotorDurumu): void => {
  useAktarimStore.setState(d.faz === 'kontrol' ? { ...d, kapatildi: false } : d);
};
