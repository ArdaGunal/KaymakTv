import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMyFollowingSlugs } from '../services/api/social';
// `import type`: yalnızca tip gerekiyor. Düz `import` olduğunda bu satır
// GERÇEK bir çalışma-zamanı bağımlılığı yaratıyordu ve `useFollowState`
// AuthContext + notificationStore'u da içeri çektiği için ortaya
// followStore ↔ useFollowState döngüsü çıkıyordu. Akış artık bu store'u
// kullandığından (bkz. features/feed/services/feedApi.ts) döngü daha erken
// bir yükleme yolunda tetiklenebilirdi — `import type` ile kenar tamamen
// kalkıyor, derleme sonrası hiçbir import kalmıyor.
import type { ConnectionState } from '../hooks/useFollowState';
import { CACHE_TTL } from '../utils/cacheTTL';
import { logError } from '../utils/errorLog';

const STORAGE_KEY = 'kaymak-follow-storage';

interface FollowState {
  connectionStates: Record<string, ConnectionState>;
  isFetched: boolean;
  isLoading: boolean;
  fetchedAt: number;
  fetchFollowingSlugs: (force?: boolean) => Promise<void>;
  setOptimisticState: (slug: string, state: ConnectionState) => void;
  reset: () => void;
}

const persistState = (connectionStates: Record<string, ConnectionState>): void => {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ connectionStates })).catch((error) => {
    // Diskte kalıcılık başarısız olsa bile RAM'deki state doğru — kullanıcıyı
    // bir Alert'le rahatsız etmeye gerek yok, ama sessizce yutmak yerine
    // teşhis edilebilir olsun diye kalıcı hata günlüğüne düşer (bkz.
    // docs/AI_RULES.md § Sessiz başarısızlık).
    logError('followStore.persistState', error);
  });
};

// Uygulama açılışında AsyncStorage'dan TEK seferlik hidrasyon. Bu artık
// `fetchFollowingSlugs`'ın BEKLEYEBİLECEĞİ bir promise olarak saklanıyor —
// ESKİDEN modül yüklenir yüklenmez ateşlenen bağımsız bir IIFE'ydi ve
// `fetchFollowingSlugs`in ağ isteği ile aralarında HİÇBİR sıralama garantisi
// yoktu. Yavaş bir cihazda AsyncStorage okuması ağ isteğinden SONRA biterse,
// hidrasyon `useFollowStore.setState(...)` ile connectionStates'i doğrudan
// eski disk anlık görüntüsüyle DEĞİŞTİRİYOR ve az önce ağdan doğrulanmış
// "following" listesini (ve olası optimistic "pending" durumlarını) sessizce
// siliyordu — kullanıcının "bazen takip etmiyormuş gibi görünüyor" şikayetinin
// kök nedeni buydu. Çözüm: hidrasyon HER ZAMAN önce garanti edilir.
const hydrate = async (): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.connectionStates) {
        useFollowStore.setState({ connectionStates: parsed.connectionStates });
      }
    }
  } catch (error) {
    logError('followStore.hydrate', error);
  }
};

let hydrationPromise: Promise<void> | null = null;
const ensureHydrated = (): Promise<void> => {
  if (!hydrationPromise) hydrationPromise = hydrate();
  return hydrationPromise;
};

// Uçuştaki `fetchFollowingSlugs` isteği — eşzamanlı çağıranlar aynı promise'i
// bekler (bkz. fetchFollowingSlugs içindeki "ESKİ DAVRANIŞ" notu).
let inFlightFetch: Promise<void> | null = null;

export const useFollowStore = create<FollowState>()((set, get) => ({
  connectionStates: {},
  isFetched: false,
  isLoading: false,
  fetchedAt: 0,

  fetchFollowingSlugs: async (force = false) => {
    // Hidrasyon bitmeden ağdan gelen sonuç birleştirilmeye BAŞLANAMAZ —
    // aksi halde az sonra tamamlanacak hidrasyon bu birleştirmeyi ezer.
    await ensureHydrated();

    const isStale = Date.now() - get().fetchedAt >= CACHE_TTL.SYNC_INTERVAL;
    if (get().isFetched && !force && !isStale) return;

    // ESKİ DAVRANIŞ: `|| get().isLoading` koşuluyla, o an başka bir çağrı
    // uçuştaysa bu çağrı BEKLEMEDEN anında dönüyordu. `await
    // fetchFollowingSlugs()` yapıp hemen ardından `connectionStates`i okuyan
    // çağıranlar (Akış, bildirim deposu) bu durumda HENÜZ DOLMAMIŞ bir
    // listeyi okuyup "hiç kimseyi takip etmiyorum" sonucuna varıyordu —
    // soğuk açılışta iki tüketici aynı anda tetiklendiğinde akışın boş
    // görünmesinin sebebi buydu. ÇÖZÜM: uçuştaki promise paylaşılır, ikinci
    // çağıran onu bekler ve güncel listeyi görür.
    const existing = inFlightFetch;
    if (existing) return existing;

    const run = (async () => {
      set({ isLoading: true });
      try {
        const slugs = await getMyFollowingSlugs();

        set((state) => {
          const newState = { ...state.connectionStates };

          // Tüm 'following' olanları önce 'none'a çek
          Object.keys(newState).forEach(key => {
            if (newState[key] === 'following') {
              delete newState[key];
            }
          });

          // Şimdi Trakt'tan dönen 'following' listesini işle
          slugs.forEach(slug => {
            newState[slug] = 'following';
          });

          persistState(newState);
          return { connectionStates: newState, isFetched: true, fetchedAt: Date.now() };
        });
      } catch (error) {
        console.warn('[followStore] Takip durumu okunamadı:', error);
        logError('followStore.fetchFollowingSlugs', error);
      } finally {
        set({ isLoading: false });
        inFlightFetch = null;
      }
    })();

    inFlightFetch = run;
    return run;
  },

  setOptimisticState: (slug, state) => {
    set((prev) => {
      const newState = { ...prev.connectionStates };
      if (state === 'none') {
        delete newState[slug];
      } else {
        newState[slug] = state;
      }
      persistState(newState);
      return { connectionStates: newState };
    });
  },

  reset: () => {
    // Uçuştaki istek de bırakılmalı: aksi halde çıkış sonrası tamamlanan eski
    // hesabın isteği, az önce temizlenen store'u yeniden doldururdu.
    inFlightFetch = null;
    set({ connectionStates: {}, isFetched: false, isLoading: false, fetchedAt: 0 });
  }
}));

/**
 * Takip edilen kullanıcıların slug listesi — bu store'un zaten tuttuğu
 * `connectionStates`'ten türetilir, AYRI bir ağ isteği YAPILMAZ.
 *
 * NEDEN: Akış (`features/feed/services/feedApi.ts`) eskiden her yüklemede
 * doğrudan `getMyFollowingSlugs()` çağırıyordu — yani bu store'un 10 dakikalık
 * TTL ile zaten önbelleklediği veri için Trakt'a FAZLADAN, SIRALI bir istek
 * daha gidiyordu ve Supabase sorgusu onun bitmesini beklemek zorundaydı.
 * Artık tek gerçek kaynak burası; taze veri gerekiyorsa `fetchFollowingSlugs`
 * kendi TTL'ine göre karar verir, taze ise hiç ağa çıkmaz.
 *
 * `pending` (onay bekleyen) durumlar BİLİNÇLİ OLARAK dışarıda — henüz
 * onaylanmamış bir takip isteği, o kişinin aktivitelerini görme hakkı vermez.
 */
export async function getFollowingSlugs(): Promise<string[]> {
  await useFollowStore.getState().fetchFollowingSlugs();
  const { connectionStates } = useFollowStore.getState();
  return Object.keys(connectionStates).filter((slug) => connectionStates[slug] === 'following');
}

// Hidrasyonu uygulama açılışında hemen tetikle (kimse henüz `fetchFollowingSlugs`
// çağırmamış olsa bile) — `ensureHydrated()` idempotent olduğundan ilk
// `fetchFollowingSlugs` çağrısı zaten bitmiş olan bu promise'i anında geçer.
ensureHydrated();
