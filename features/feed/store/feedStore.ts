import { create } from 'zustand';
import { FeedActivity } from '../types';

/**
 * Akış'ın PAYLAŞILAN durumu.
 *
 * NEDEN STORE: Akış eskiden `useFeed` hook'unun içinde `useState` ile
 * tutuluyordu — yani yalnızca o bileşen ağacından erişilebiliyordu. Bir sosyal
 * akışta veri UI DIŞINDAN da değişir:
 *   1. Kullanıcı bir bölüm işaretlediğinde (mutasyon katmanı) kart ANINDA
 *      akışa girmeli — ekranın açık olup olmadığından bağımsız.
 *   2. Supabase Realtime, başkalarının aktivitesini WebSocket üzerinden
 *      itiyor — bu da bir React olayı değil.
 * Bu iki yazıcı bir hook'un yerel state'ine erişemezdi; store zorunlu.
 *
 * Ham `FeedActivity[]` tutulur, GRUPLANMIŞ hali değil: maraton gruplaması
 * (groupMarathonActivities) tüm veri toplandıktan SONRA, render öncesi
 * yapılmalı (bkz. o dosyanın başlığı). Yeni bir aktivite geldiğinde ham
 * listeye eklenip yeniden gruplanır — böylece "3 bölüm izledi" kartı
 * kendiliğinden "4 bölüm izledi"ye dönüşür.
 */

/** En fazla kaç ham aktivite bellekte tutulur — sonsuz büyümeyi engeller. */
const MAX_ACTIVITIES = 200;

interface FeedState {
  activities: FeedActivity[];
  /** Sunucudan ilk yükleme yapıldı mı (boş akış ile "henüz yüklenmedi" ayrımı). */
  isHydrated: boolean;
  /** Kullanıcı listenin tepesinde değilken gelen, henüz görülmemiş aktivite sayısı. */
  unseenCount: number;

  /** Sunucudan gelen tam liste ile değiştirir (ilk yükleme / pull-to-refresh). */
  setActivities: (activities: FeedActivity[]) => void;
  /**
   * Tek bir aktiviteyi listeye ekler (anında yayın veya Realtime).
   * Aynı id zaten varsa GÜNCELLER — Realtime, optimistic olarak eklenmiş
   * kendi kartımızın sunucu sürümünü getirdiğinde çift kart oluşmasın diye.
   * `countAsUnseen`: başkasının aktivitesi için true, kendiminki için false
   * (kendi eylemimi "yeni gönderi" rozetiyle bildirmek anlamsız).
   */
  upsertActivity: (activity: FeedActivity, countAsUnseen?: boolean) => void;
  /** Yayın başarısız olduğunda optimistic kartı geri alır. */
  removeActivity: (id: string) => void;
  /** Optimistic kartı sunucudan dönen gerçek satırla değiştirir. */
  replaceActivity: (tempId: string, activity: FeedActivity) => void;
  clearUnseen: () => void;
  reset: () => void;
}

const sortDesc = (list: FeedActivity[]): FeedActivity[] =>
  [...list].sort((a, b) => new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime());

export const useFeedStore = create<FeedState>((set) => ({
  activities: [],
  isHydrated: false,
  unseenCount: 0,

  setActivities: (activities) =>
    set({ activities: sortDesc(activities).slice(0, MAX_ACTIVITIES), isHydrated: true }),

  upsertActivity: (activity, countAsUnseen = false) =>
    set((state) => {
      const index = state.activities.findIndex((a) => a.id === activity.id);
      if (index !== -1) {
        // Zaten var → güncelle, "yeni" saymayı ATLA (aynı olay iki kez
        // sayılmasın: örn. optimistic ekleme + Realtime yankısı).
        const next = [...state.activities];
        next[index] = activity;
        return { activities: next };
      }
      return {
        activities: sortDesc([activity, ...state.activities]).slice(0, MAX_ACTIVITIES),
        unseenCount: countAsUnseen ? state.unseenCount + 1 : state.unseenCount,
      };
    }),

  removeActivity: (id) =>
    set((state) => ({ activities: state.activities.filter((a) => a.id !== id) })),

  replaceActivity: (tempId, activity) =>
    set((state) => {
      // Sunucu sürümü zaten başka bir yoldan (Realtime) gelmiş olabilir —
      // o durumda geçiciyi sadece düşür, kopya bırakma.
      const withoutTemp = state.activities.filter((a) => a.id !== tempId);
      if (withoutTemp.some((a) => a.id === activity.id)) {
        return { activities: withoutTemp };
      }
      return { activities: sortDesc([activity, ...withoutTemp]).slice(0, MAX_ACTIVITIES) };
    }),

  clearUnseen: () => set({ unseenCount: 0 }),

  // Çıkışta ZORUNLU: store bir modül singleton'ı, uygulama kapatılmadan
  // hesap değiştirilirse önceki kullanıcının akışı yeni oturuma sızardı
  // (followStore.reset / clearMyTraktSlug ile aynı gerekçe).
  reset: () => set({ activities: [], isHydrated: false, unseenCount: 0 }),
}));
