import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logError } from '../../../utils/errorLog';
import { buildDefaultPrefs, reconcilePrefs } from '../registry';
import type { NotificationCategoryId, NotificationPrefs } from '../types';

/**
 * Bildirim tercihleri — `store/followStore.ts` ve `store/notificationStore.ts`
 * ile BİREBİR aynı hydrate/persist deseni (docs/design/notifications.md § 6).
 *
 * 🔴 TERCİHLER SUPABASE'E GİTMEZ. F0–F2 tamamen cihaz-yerel bir sistemdir ve
 * tercihlerin cihaz başına farklı olması (telefonda açık, tablette kapalı)
 * doğru davranıştır. F3'te yalnızca SOSYAL kategoriler sunucuya taşınacak.
 *
 * 🔴 BU STORE ZAMANLAYICIYI ÇAĞIRMAZ. Tercih değişince yeniden planlamayı
 * `useNotificationSetup` üstlenir. Store'dan zamanlayıcıya bağımlılık
 * kurmak, `store/followStore.ts` başlığında anlatılan
 * `followStore ↔ useFollowState` döngüsünün aynısını üretirdi.
 */

/**
 * ⚠️ ANAHTAR ÇAKIŞMASI UYARISI: `store/notificationStore.ts`
 * `'kaymak-notification-storage'` kullanıyor (uygulama-içi aktivite
 * bildirimleri — TAMAMEN BAŞKA bir sistem). Bu anahtar bilinçli olarak
 * farklıdır; aynı olsaydı iki store birbirinin verisini ezerdi.
 */
const STORAGE_KEY = 'kaymak-notification-prefs';

interface PushPrefsState {
  prefs: NotificationPrefs;
  /**
   * Diskten okuma tamamlandı mı? Ayarlar ekranı bunu beklemeden çizim
   * yaparsa, kullanıcı kendi kapattığı bir anahtarı bir an AÇIK görür ve
   * ekran gözünün önünde "zıplar".
   */
  isHydrated: boolean;
  setMasterEnabled: (enabled: boolean) => void;
  setCategoryEnabled: (id: NotificationCategoryId, enabled: boolean) => void;
  setPreferredHour: (hour: number) => void;
  /**
   * "İzin diyaloğunu bir kez otomatik gösterdik" izini kalıcı olarak yazar.
   * Sonuç (verildi/reddedildi) BİLİNÇLİ olarak kaydedilmez — tek soru
   * "sorduk mu?" (bkz. types.ts `permissionPromptedAt`).
   */
  markPermissionPrompted: () => void;
  /** "Bildirimleri aç" şeridini kapatır; `promptBanner.ts` erteleme süresince gizler. */
  dismissPromptBanner: () => void;
  /** Dürtme düştüğünde çağrılır; soğuma penceresini başlatır. */
  markNudgeFired: (firedAt: number) => void;
}

const persist = (prefs: NotificationPrefs): void => {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)).catch((error) => {
    logError('usePushPrefsStore.persist', error);
  });
};

const hydrate = async (): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    // Kayıt yoksa varsayılanlar zaten yerinde; yalnızca bayrağı kaldır.
    if (!raw) {
      usePushPrefsStore.setState({ isHydrated: true });
      return;
    }
    // `reconcilePrefs` şart: v1'de kaydedilmiş bir nesne, v2'de eklenen
    // kategoriyi içermez. Ham JSON'u doğrudan state'e koymak, o kategoriyi
    // Ayarlar'da "açık" gösterip aslında kapalı çalıştırırdı.
    usePushPrefsStore.setState({ prefs: reconcilePrefs(JSON.parse(raw)), isHydrated: true });
  } catch (error) {
    // Bozuk JSON tüm bildirim sistemini kilitlemesin: varsayılanlarla devam
    // edilir ama hata sessizce yutulmaz (AI_RULES).
    logError('usePushPrefsStore.hydrate', error);
    usePushPrefsStore.setState({ isHydrated: true });
  }
};

let hydrationPromise: Promise<void> | null = null;
export const ensurePushPrefsHydrated = (): Promise<void> => {
  if (!hydrationPromise) hydrationPromise = hydrate();
  return hydrationPromise;
};

/** Tek yerden güncelle + diske yaz — üç setter'da kopyalanmasın diye. */
const commit = (
  set: (partial: Partial<PushPrefsState>) => void,
  prefs: NotificationPrefs,
): void => {
  persist(prefs);
  set({ prefs });
};

export const usePushPrefsStore = create<PushPrefsState>((set, get) => ({
  prefs: buildDefaultPrefs(),
  isHydrated: false,

  /**
   * Ana anahtar. Kapatıldığında `categories` BİLİNÇLİ OLARAK KORUNUR —
   * kullanıcı tekrar açtığında eski ayarlarını bulur. Sıfırlayan sistemler
   * kullanıcıyı ikinci kez ayar yapmaya zorlar.
   */
  setMasterEnabled: (enabled) => {
    commit(set, { ...get().prefs, masterEnabled: enabled });
  },

  setCategoryEnabled: (id, enabled) => {
    const current = get().prefs;
    commit(set, { ...current, categories: { ...current.categories, [id]: enabled } });
  },

  markPermissionPrompted: () => {
    // Zaten işaretliyse yeniden yazma: gereksiz disk yazması ve render.
    if (get().prefs.permissionPromptedAt !== null) return;
    commit(set, { ...get().prefs, permissionPromptedAt: Date.now() });
  },

  dismissPromptBanner: () => {
    commit(set, { ...get().prefs, bannerDismissedAt: Date.now() });
  },

  markNudgeFired: (firedAt) => {
    if (!Number.isFinite(firedAt)) return;
    // Daha ESKİ bir damga yazmayalım: süpürme birden fazla düşmüş kayıt
    // getirebilir, en yenisi kazanmalı.
    const current = get().prefs.lastNudgeFiredAt;
    if (current !== null && current >= firedAt) return;
    commit(set, { ...get().prefs, lastNudgeFiredAt: firedAt });
  },

  setPreferredHour: (hour) => {
    // Sınır dışı bir değer tüm zamanlamayı bozardı (bkz. registry.reconcilePrefs).
    // Kaynak UI olsa bile kontrol burada: store'un sözleşmesi çağıranın
    // dikkatine emanet edilmez.
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      logError('usePushPrefsStore.setPreferredHour', new Error(`Gecersiz saat: ${hour}`));
      return;
    }
    commit(set, { ...get().prefs, preferredHour: hour });
  },
}));

/**
 * Çıkışta çağrılır (bkz. `features/notifications/reset.ts`).
 *
 * 🔴 `AsyncStorage.clear()` YETMEZ: bu store RAM'de bir singleton, yani
 * uygulama tamamen kapatılmadan çıkış-giriş yapılırsa önceki hesabın
 * tercihleri hafızada kalır. Projede aynı hata `followStore`, `useLibraryStore`
 * ve `feedStore` için ayrı ayrı yaşanmıştı ("State Leakage", 2026-08-21).
 *
 * Hidratlama sözü de sıfırlanır; aksi halde yeni oturum diski hiç okumaz.
 */
export function resetPushPrefsState(): void {
  hydrationPromise = null;
  // Disk zaten `AsyncStorage.clear()` ile boşaltıldığı için varsayılanlar
  // TAM OLARAK doğru hidratlanmış durumdur — `isHydrated: false` bırakmak
  // Ayarlar ekranını sonsuz spinner'da bırakırdı.
  usePushPrefsStore.setState({ prefs: buildDefaultPrefs(), isHydrated: true });
}

// `store/notificationStore.ts` ile aynı desen: modül yüklenirken bir kez
// hidratlanır, çağıranların ayrıca tetiklemesi gerekmez.
ensurePushPrefsHydrated();
