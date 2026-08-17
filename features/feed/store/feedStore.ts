import { create } from 'zustand';
import { FeedActivity } from '../types';
import type { FeedCursor, FeedPage } from '../services/feedApi';

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
 *
 * ⚠️ ÜST SINIR YOK (eski `MAX_ACTIVITIES = 200` KALDIRILDI): o sınır,
 * sayfalama eklenmeden önce sonsuz büyümeye karşı konmuştu. Sonsuz kaydırmayla
 * BİRLİKTE çalışamaz — `slice(0, 200)` en eski kayıtları kırptığı için,
 * kullanıcı 200. kayda geldiğinde eklenen her yeni sayfa aynı anda düşerdi
 * (liste asla ilerlemez, sonsuz döngüye girerdi). Büyüme artık iki yerden
 * doğal olarak sınırlı: sorgunun 30 günlük penceresi ve sunucudaki
 * kullanıcı-başına-200 retention politikası (bkz. 014_feed_retention.sql).
 */

interface FeedState {
  activities: FeedActivity[];
  /** Sunucudan ilk yükleme yapıldı mı (boş akış ile "henüz yüklenmedi" ayrımı). */
  isHydrated: boolean;
  /** Kullanıcı listenin tepesinde değilken gelen, henüz görülmemiş aktivite sayısı. */
  unseenCount: number;

  // ── Sayfalama ───────────────────────────────────────────────────────────
  /** Bir sonraki sayfanın imleci; `hasMore` false ise null. */
  nextCursor: FeedCursor | null;
  /** Sunucuda daha eski kayıt var mı (sonsuz kaydırma devam etsin mi)? */
  hasMore: boolean;
  /** Alt sayfa yükleniyor mu (liste altındaki spinner bunu okur). */
  isLoadingMore: boolean;
  setLoadingMore: (value: boolean) => void;

  /** İlk sayfa: listeyi TAMAMEN değiştirir (ilk yükleme / pull-to-refresh). */
  setFirstPage: (page: FeedPage) => void;
  /** Sonraki sayfa: mevcut listenin SONUNA ekler, id'ye göre tekilleştirir. */
  appendPage: (page: FeedPage) => void;

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
  /**
   * Koşula uyan aktiviteleri listeden çıkarır.
   *
   * NEDEN VAR: kullanıcı bir gizlilik anahtarını kapattığında Worker o
   * satırları DB'den siliyor, ama ekrandaki liste eski hâliyle kalıyordu —
   * yani "gizle"ye basan kullanıcı gizlemek istediği kartları görmeye devam
   * ediyordu (F4-T12'de bulundu). `reset()` burada YANLIŞ araç: `useFeed`'in
   * yükleme efekti yalnızca mount'ta çalışıyor (sekmeler bellekte kalıyor),
   * dolayısıyla store'u boşaltmak akışı boş bırakırdı.
   */
  removeActivitiesWhere: (predicate: (activity: FeedActivity) => boolean) => void;
  /** Optimistic kartı sunucudan dönen gerçek satırla değiştirir. */
  replaceActivity: (tempId: string, activity: FeedActivity) => void;
  /**
   * Var olan bir aktiviteye KISMİ bir güncelleme uygular (ör. Realtime'dan
   * gelen like_count/comment_count değişimi) — `upsertActivity`'nin aksine
   * TAM bir FeedActivity gerektirmez. Aktivite şu an listede yoksa no-op
   * (ör. henüz yüklenmemiş bir sayfadaysa, bir sonraki fetch zaten güncel
   * sayıyı getirir).
   */
  patchActivity: (id: string, patch: Partial<FeedActivity>) => void;
  clearUnseen: () => void;
  reset: () => void;
}

const sortDesc = (list: FeedActivity[]): FeedActivity[] =>
  [...list].sort((a, b) => {
    const diff = new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime();
    // Damga eşitliğinde (toplu sezon işaretlemesi) `id` ile kesin sıralama —
    // sunucu sorgusunun `.order('activity_at').order('id')` sözleşmesiyle AYNI.
    // Aksi halde yerel sıra ile sayfa sınırları kayar ve kaydırma zıplardı.
    return diff !== 0 ? diff : (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
  });

/** id'ye göre tekilleştirir; SONRAKİ kayıt öncekini ezer (taze veri kazanır). */
const dedupeById = (list: FeedActivity[]): FeedActivity[] => {
  const byId = new Map<string, FeedActivity>();
  for (const item of list) byId.set(item.id, item);
  return Array.from(byId.values());
};

export const useFeedStore = create<FeedState>((set) => ({
  activities: [],
  isHydrated: false,
  unseenCount: 0,
  nextCursor: null,
  hasMore: false,
  isLoadingMore: false,

  setLoadingMore: (value) => set({ isLoadingMore: value }),

  setFirstPage: (page) =>
    set({
      activities: sortDesc(dedupeById(page.items)),
      isHydrated: true,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      isLoadingMore: false,
    }),

  appendPage: (page) =>
    set((state) => ({
      // Tekilleştirme ŞART: Realtime bu sırada yeni bir kayıt eklemiş olabilir
      // ya da imleç sınırında aynı kayıt tekrar dönebilir. `sortDesc` sunucu
      // sıralamasıyla aynı sözleşmeyi kullandığı için sıra bozulmaz.
      activities: sortDesc(dedupeById([...state.activities, ...page.items])),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      isLoadingMore: false,
    })),

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
        activities: sortDesc([activity, ...state.activities]),
        unseenCount: countAsUnseen ? state.unseenCount + 1 : state.unseenCount,
      };
    }),

  removeActivity: (id) =>
    set((state) => ({ activities: state.activities.filter((a) => a.id !== id) })),

  removeActivitiesWhere: (predicate) =>
    set((state) => {
      const next = state.activities.filter((a) => !predicate(a));
      // Hiçbir şey eşleşmediyse yeni dizi döndürme — gereksiz yeniden render
      // (`activities` referansı değişirse tüm liste yeniden çizilir).
      return next.length === state.activities.length ? {} : { activities: next };
    }),

  replaceActivity: (tempId, activity) =>
    set((state) => {
      // Sunucu sürümü zaten başka bir yoldan (Realtime) gelmiş olabilir —
      // o durumda geçiciyi sadece düşür, kopya bırakma.
      const withoutTemp = state.activities.filter((a) => a.id !== tempId);
      if (withoutTemp.some((a) => a.id === activity.id)) {
        return { activities: withoutTemp };
      }
      return { activities: sortDesc([activity, ...withoutTemp]) };
    }),

  patchActivity: (id, patch) =>
    set((state) => {
      const index = state.activities.findIndex((a) => a.id === id);
      if (index === -1) return state; // listede yok, no-op
      const next = [...state.activities];
      next[index] = { ...next[index], ...patch };
      return { activities: next };
    }),

  clearUnseen: () => set({ unseenCount: 0 }),

  // Çıkışta ZORUNLU: store bir modül singleton'ı, uygulama kapatılmadan
  // hesap değiştirilirse önceki kullanıcının akışı yeni oturuma sızardı
  // (followStore.reset / clearMyTraktSlug ile aynı gerekçe).
  reset: () =>
    set({
      activities: [],
      isHydrated: false,
      unseenCount: 0,
      nextCursor: null,
      hasMore: false,
      isLoadingMore: false,
    }),
}));
