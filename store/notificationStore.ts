import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchKaymakGraph } from '../services/api/kaymakSocial';
import { takipMutasyonNesli, useFollowStore } from './followStore';
import { logError } from '../utils/errorLog';
import {
  pruneByAge,
  budandiMi,
  INBOX_MAX_AGE_MS,
  PENDING_SLUG_MAX_AGE_MS,
  PENDING_SLUG_CAP,
} from '../features/notifications/inbox/retention';

// Basit, tamamen istemci-tarafı "aktivite" bildirimleri — dış push YOK,
// backend/Supabase YOK (bkz. docs/design/notifications.md Faz 2, bilinçli olarak bu
// kapsamın dışında bırakıldı). `store/followStore.ts`'teki hydrate/persist
// deseninin BİREBİR aynısı: AsyncStorage'a yazılır, uygulama açılışında bir
// kez hidratlanır.
const STORAGE_KEY = 'kaymak-notification-storage';
const MAX_ITEMS = 50;

export type ActivityNotificationType = 'newFollower' | 'requestApproved';

export interface ActivityNotification {
  id: string;
  type: ActivityNotificationType;
  slug: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: number;
  read: boolean;
}

/**
 * Onay bekleyen GÖNDERİLMİŞ takip isteği — artık ZAMAN DAMGALI.
 *
 * 🔴 NEDEN DEĞİŞTİ: eskiden düz `string[]`ti ve bir kayıt yalnızca istek
 * ONAYLANINCA siliniyordu. Gizli bir hesap isteği hiç onaylamazsa slug
 * **sonsuza kadar** kalıyordu — bu store'daki tek gerçekten SINIRSIZ büyüyen
 * alandı (diğer her şeyin adet tavanı var). Damga olmadan "ne zaman
 * vazgeçelim?" sorusu cevaplanamıyordu.
 */
export interface PendingSentRequest {
  /**
   * 🪪 `users.id` — SLUG DEĞİL (M337). `followStore.connectionStates` artık
   * `userId` ile anahtarlı; eşleşme bunun üzerinden yapılıyor. Slug kalsaydı
   * karşılaştırma HİÇ tutmaz ve "isteğin onaylandı" bildirimi **sessizce**
   * hiç üretilmezdi.
   */
  userId: string;
  /**
   * Bildirim metninde gösterilecek ad. 🔑 BURADA SAKLANIYOR çünkü onay
   * tespit edildiği anda profili AĞDAN çekme adımını tamamen kaldırıyor —
   * o adım Trakt'a gidiyordu ve Google-only kullanıcıda ÇALIŞMAZDI.
   */
  username: string;
  /** İsteğin gönderildiği an (epoch ms). */
  at: number;
}

interface PersistedShape {
  items: ActivityNotification[];
  seenFollowerIds: string[] | null;
  pendingSentSlugs: PendingSentRequest[];
}

/**
 * Depodan okunanı bugünkü şekle çevirir.
 *
 * ⚠️ GERİYE DÖNÜK: eski sürüm düz `string[]` yazıyordu. O kayıtlar damgasız
 * olduğu için "şimdi" damgalanıyor — yani mevcut bekleyen istekler bir
 * kereliğine 30 günlük saatlerini SIFIRDAN başlatıyor. Alternatifi onları
 * atmaktı; bekleyen bir isteği sırf damgası yok diye unutmak daha kötü.
 */
const normalizePending = (raw: unknown, now: number): PendingSentRequest[] => {
  if (!Array.isArray(raw)) return [];
  const cikti: PendingSentRequest[] = [];
  const gorulen = new Set<string>();
  for (const item of raw) {
    // 🔴 ESKİ BİÇİMLER (düz `string` ve `{slug, at}`) ARTIK DÜŞÜRÜLÜYOR.
    // İkisi de SLUG taşıyordu; `userId` türetmenin bir yolu yok. Onları
    // "userId sanıp" saklamak, hiç eşleşmeyecek ölü kayıtlar üretirdi.
    // Kaybedilen tek şey: yükseltme anında havada olan takip istekleri için
    // "onaylandı" bildirimi çıkmaması. İstek KAYBOLMUYOR — sunucudaki
    // `follow_requests` satırı duruyor ve düğme `pendingOut` sayesinde doğru
    // durumu göstermeye devam ediyor.
    if (!item || typeof item !== 'object') continue;
    const o = item as { userId?: unknown; username?: unknown; at?: unknown };
    if (typeof o.userId !== 'string' || !o.userId) continue;
    if (typeof o.username !== 'string' || !o.username) continue;
    const kayit: PendingSentRequest = {
      userId: o.userId,
      username: o.username,
      at: typeof o.at === 'number' && Number.isFinite(o.at) ? o.at : now,
    };
    if (gorulen.has(kayit.userId)) continue;
    gorulen.add(kayit.userId);
    cikti.push(kayit);
  }
  return cikti;
};

/** Yaş budaması + son savunma hattı olarak adet tavanı. */
const trimPending = (liste: readonly PendingSentRequest[], now: number): PendingSentRequest[] =>
  pruneByAge(liste, now, (p) => p.at, PENDING_SLUG_MAX_AGE_MS).slice(0, PENDING_SLUG_CAP);

interface NotificationState extends PersistedShape {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  /**
   * BANA gelen bekleyen takip isteği sayısı — zil rozeti (M338). ⚠️ "Okunmamış"
   * DEĞİL, "cevapsız": Bildirimler ekranını açmak onu SIFIRLAMAZ; yalnızca
   * kabul/ret düşürür. Kalıcı değil (her `refreshActivity` sunucudan tazeler).
   */
  incomingRequestCount: number;
  setIncomingRequestCount: (count: number) => void;
  clearUnread: () => void;
  /** `followKaymakUser` `istek` döndürdüğünde çağrılır — onay bekleyen bir
   *  istek gönderdiğimizi hatırlamak için (bkz. hooks/useFollowState.ts). */
  addPendingSentRequest: (userId: string, username: string) => void;
  refreshActivity: () => Promise<void>;
  markAllRead: () => void;
  /** Tek bir aktivite kaydını listeden kaldırır. */
  remove: (id: string) => void;
  /** Listenin tamamını boşaltır ("Tümünü temizle"). */
  clearAll: () => void;
}

const persistState = (state: PersistedShape): void => {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch((error) => {
    logError('notificationStore.persistState', error);
  });
};

const hydrate = async (): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const now = Date.now();
    const okunan: ActivityNotification[] = Array.isArray(parsed?.items) ? parsed.items : [];

    // 🔴 YAŞ BUDAMASI AÇILIŞTA — `MAX_ITEMS` yalnızca ADEDE bakıyor. Nadiren
    // takipçi kazanan bir kullanıcı 50'ye hiç ulaşmaz ve yıllar önceki kayıt
    // listede sonsuza kadar durur. Gerekçe/süre: `notifications/inbox/retention.ts`.
    const items = pruneByAge(okunan, now, (i) => i.createdAt, INBOX_MAX_AGE_MS);

    const okunanPending = normalizePending(parsed?.pendingSentSlugs, now);
    const pendingSentSlugs = trimPending(okunanPending, now);
    // 🪪 ANAHTAR DEĞİŞTİ (M338): eski kayıt Trakt SLUG'ları tutuyordu, yenisi
    // `users.id`. Eski alan BİLİNÇLİ OLARAK okunmuyor → `null` → bir sonraki
    // tur yalnızca TABAN alır. Eski slug'ları kimlik sanıp karşılaştırsaydık
    // hiçbiri eşleşmez ve TÜM mevcut takipçiler bir anda "yeni" bildirimi olurdu.
    const seenFollowerIds = parsed?.seenFollowerIds ?? null;

    // Yalnızca gerçekten değiştiyse yaz (şekil göçü de bir değişikliktir).
    if (
      budandiMi(okunan, items) ||
      budandiMi(okunanPending, pendingSentSlugs) ||
      !Array.isArray(parsed?.pendingSentSlugs) ||
      parsed.pendingSentSlugs.some((x: unknown) => typeof x === 'string')
    ) {
      persistState({ items, seenFollowerIds, pendingSentSlugs });
    }

    useNotificationStore.setState({
      items,
      seenFollowerIds,
      pendingSentSlugs,
      unreadCount: items.filter((i) => !i.read).length,
    });
  } catch (error) {
    logError('notificationStore.hydrate', error);
  }
};

let hydrationPromise: Promise<void> | null = null;
const ensureHydrated = (): Promise<void> => {
  if (!hydrationPromise) hydrationPromise = hydrate();
  return hydrationPromise;
};

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  items: [],
  seenFollowerIds: null,
  pendingSentSlugs: [],

  incomingRequestCount: 0,
  setIncomingRequestCount: (count) => set({ incomingRequestCount: Math.max(0, count) }),
  setUnreadCount: (count) => set({ unreadCount: count }),
  clearUnread: () => set({ unreadCount: 0 }),

  addPendingSentRequest: (userId, username) => {
    set((state) => {
      if (state.pendingSentSlugs.some((p) => p.userId === userId)) return state;
      const now = Date.now();
      // Ekleme anında da budanıyor: bu liste yalnızca burada büyüyor, yani
      // budamanın en doğal yeri burası. Açılıştaki budama, uygulamayı
      // günlerce açık tutan kullanıcı için ikinci hat.
      const pendingSentSlugs = trimPending([...state.pendingSentSlugs, { userId, username, at: now }], now);
      persistState({ items: state.items, seenFollowerIds: state.seenFollowerIds, pendingSentSlugs });
      return { pendingSentSlugs };
    });
  },

  refreshActivity: async () => {
    await ensureHydrated();
    try {
      // ══════════════════════════════════════════════════════════════════
      // 🪪 KAYNAK ARTIK BİZİM GRAF (M338) — TEK istek
      // ══════════════════════════════════════════════════════════════════
      // Eskiden iki ayrı istek vardı: Trakt `getFollowers('me')` + graf. Artık
      // graf yanıtı hem takip durumlarımı (followStore) hem takipçilerimi hem
      // de bekleyen gelen istek sayısını (rozet) taşıyor.
      //
      // 🔴 ESKİ KODDA GİZLİ BİR BİLDİRİM FIRTINASI VARDI: Trakt çağrısı
      // `.catch(() => [])` ile yutuluyordu. Bir kez düşünce boş liste
      // "görülen takipçiler" diye KAYDEDİLİR, sonraki başarılı turda TÜM
      // takipçiler "yeni" sayılırdı. Artık hata dış `catch`'e düşüyor ve
      // HİÇBİR ŞEY yazılmıyor.
      const nesil = takipMutasyonNesli();
      const graf = await fetchKaymakGraph();
      useFollowStore.getState().applyGraf(graf, nesil);

      const state = get();
      const currentFollowerIds = graf.followers.map((f) => f.userId);
      const newItems: ActivityNotification[] = [];

      // Yeni takipçi diff'i — ilk çalıştırmada (seenFollowerIds === null)
      // yalnızca taban alınır, MEVCUT tüm takipçiler "yeni" gibi bildirim
      // yağmuruna dönüşmesin diye bildirim ÜRETİLMEZ.
      // 🔕 PUSH YOK, YALNIZCA UYGULAMA İÇİ — kullanıcı kararı (2026-09-11):
      // açık hesaba doğrudan takip her seferinde push atsaydı popüler hesapta
      // spam olurdu. Bu kayıt rozet + Bildirimler satırı olarak görünür.
      if (state.seenFollowerIds !== null) {
        const seenSet = new Set(state.seenFollowerIds);
        for (const follower of graf.followers) {
          if (seenSet.has(follower.userId)) continue;
          newItems.push({
            id: `newFollower-${follower.userId}-${Date.now()}`,
            type: 'newFollower',
            // ⚠️ `slug` alanı ADRES taşıyor (`username`) — bkz. `BACKLOG` §F4.
            slug: follower.username,
            username: follower.username,
            name: null,
            avatarUrl: follower.avatarUrl,
            createdAt: Date.now(),
            read: false,
          });
        }
      }

      // Onaylanan gönderilmiş takip istekleri diff'i — bir `userId` artık
      // `followStore`'un (bizim graftan az önce yenilenen) following
      // listesindeyse demek ki gizli hesap isteğimizi onaylamış.
      //
      // 🪪 KARŞILAŞTIRMA `userId` ÜZERİNDEN (M337). Slug'la yapılsaydı
      // `connectionStates` artık `userId` anahtarlı olduğu için eşleşme HİÇ
      // tutmaz ve bu bildirim **sessizce** hiç üretilmezdi.
      const followingConnectionStates = useFollowStore.getState().connectionStates;
      const stillPending: PendingSentRequest[] = [];
      for (const bekleyen of state.pendingSentSlugs) {
        if (followingConnectionStates[bekleyen.userId] === 'following') {
          // 🔑 AĞ İSTEĞİ KALDIRILDI. Eskiden burada `getUserProfile(slug)`
          // ile TRAKT'tan profil çekiliyordu; Google-only kullanıcıda o çağrı
          // ÇALIŞMAZDI ve `catch` dalına düşüp kayıt sonsuza kadar "bekliyor"
          // kalırdı. Gösterilecek ad artık isteği gönderirken kaydediliyor.
          newItems.push({
            id: `requestApproved-${bekleyen.userId}-${Date.now()}`,
            type: 'requestApproved',
            // ⚠️ `slug` alanı ADRES taşıyor: "EVRENSEL KAYMAK KİMLİĞİ"
            // ilkesi gereği kanonik adres `username`. Alanın ADI bayat
            // (rename tüm bildirim üreticilerine dokunur → `BACKLOG` §F4).
            slug: bekleyen.username,
            username: bekleyen.username,
            name: null,
            avatarUrl: null,
            createdAt: Date.now(),
            read: false,
          });
        } else {
          stillPending.push(bekleyen);
        }
      }

      // Yenileme turu da buduyor: uygulama günlerce açık kalabilir ve
      // yalnızca açılışta budamak o oturumlarda eskileri biriktirirdi
      // (`useInboxStore.ingest`'teki aynı gerekçe).
      const now = Date.now();
      const eskiler = pruneByAge(state.items, now, (i) => i.createdAt, INBOX_MAX_AGE_MS);
      const items = [...newItems, ...eskiler].slice(0, MAX_ITEMS);
      const unreadCount = items.filter((i) => !i.read).length;
      const pendingSentSlugs = trimPending(stillPending, now);

      persistState({ items, seenFollowerIds: currentFollowerIds, pendingSentSlugs });
      set({
        items,
        seenFollowerIds: currentFollowerIds,
        pendingSentSlugs,
        unreadCount,
        incomingRequestCount: graf.pendingInCount ?? 0,
      });
    } catch (error) {
      console.warn('[notificationStore] Aktivite güncellenemedi:', error);
      logError('notificationStore.refreshActivity', error);
    }
  },

  markAllRead: () => {
    set((state) => {
      if (state.unreadCount === 0) return state;
      const items = state.items.map((i) => ({ ...i, read: true }));
      persistState({ items, seenFollowerIds: state.seenFollowerIds, pendingSentSlugs: state.pendingSentSlugs });
      return { items, unreadCount: 0 };
    });
  },

  // 🔴 AŞAĞIDAKİ İKİ EYLEM `seenFollowerIds`e DOKUNMAZ — kritik.
  // O alan "hangi takipçileri daha önce gördük" tabanıdır; bildirimi silmek
  // onu SIFIRLASAYDI, bir sonraki `refreshActivity` MEVCUT tüm takipçileri
  // "yeni" sayar ve kullanıcı sildiği bildirimlerin hepsini bir anda geri
  // alırdı (satır 107'deki taban alma dalı tam bunun için var).
  // `pendingSentSlugs` de aynı sebeple korunuyor: bekleyen istek takibi
  // bildirim listesinden bağımsız bir defterdir.

  remove: (id) => {
    set((state) => {
      const items = state.items.filter((i) => i.id !== id);
      if (items.length === state.items.length) return state;
      persistState({ items, seenFollowerIds: state.seenFollowerIds, pendingSentSlugs: state.pendingSentSlugs });
      return { items, unreadCount: items.filter((i) => !i.read).length };
    });
  },

  clearAll: () => {
    set((state) => {
      if (state.items.length === 0) return state;
      persistState({ items: [], seenFollowerIds: state.seenFollowerIds, pendingSentSlugs: state.pendingSentSlugs });
      return { items: [], unreadCount: 0 };
    });
  },
}));

ensureHydrated();

/**
 * Çıkışta sosyal bildirim deposunu sıfırlar (`features/notifications/reset.ts`).
 *
 * 🔴 BU FONKSİYON YOKTU (bulundu 2026-09-11, M338). `reset.ts` push
 * tercihlerini ve içerik gelen kutusunu sıfırlıyordu ama BU store o listede
 * değildi — başlığında anlatılan "State Leakage" sınıfının açık kalan son
 * kapısıydı. Zustand singleton RAM'de yaşadığı için uygulama kapatılmadan
 * çıkış-giriş yapılırsa ÖNCEKİ hesabın takipçi bildirimleri, bekleyen istek
 * defteri ve (M338 ile eklenen) cevapsız istek rozeti yeni hesapta görünürdü.
 *
 * ⚠️ `seenFollowerIds` BİLİNÇLİ OLARAK `null`: yeni hesabın ilk turu yalnızca
 * TABAN alır. Önceki hesabın listesiyle karşılaştırsaydık yeni hesabın bütün
 * takipçileri bir anda "yeni" bildirimi olurdu.
 */
export function resetNotificationStoreState(): void {
  // Bir sonraki `ensureHydrated()` yeni oturum için diskten baştan okusun.
  hydrationPromise = null;
  useNotificationStore.setState({
    items: [],
    unreadCount: 0,
    seenFollowerIds: null,
    pendingSentSlugs: [],
    incomingRequestCount: 0,
  });
  AsyncStorage.removeItem(STORAGE_KEY).catch((error) =>
    logError('notificationStore.reset.clearStorage', error)
  );
}
