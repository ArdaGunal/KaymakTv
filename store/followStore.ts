import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from '../utils/secureStorage';
import { getMyFollowingSlugs } from '../services/api/social';
import { isKaymakSessionToken } from '../services/api/traktClient';
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

/**
 * Trakt isteği BAŞARISIZ olduktan sonra yeniden denemeden önce beklenecek süre.
 *
 * NEDEN VAR (F6): hata dalı `isFetched`'i `false`, `fetchedAt`'i `0` bırakıyor
 * → `isStale` her zaman `true` → **her `getFollowingSlugs()` çağrısı ölü Trakt
 * isteğini yeniden deniyordu.** Akış sonsuz kaydırmada her sayfa için bu kümeye
 * ihtiyaç duyduğundan, Trakt erişilemezken her sayfa `traktClient` timeout'una
 * (20sn'ye kadar) kadar bloke olabiliyordu. Backoff bu döngüyü kırıyor.
 */
const FAILURE_BACKOFF_MS = 60 * 1000;

interface FollowState {
  connectionStates: Record<string, ConnectionState>;
  isFetched: boolean;
  isLoading: boolean;
  fetchedAt: number;
  /** Son BAŞARISIZ denemenin zamanı; 0 = son deneme başarılı. */
  lastFailedAt: number;
  fetchFollowingSlugs: (force?: boolean) => Promise<void>;
  setOptimisticState: (slug: string, state: ConnectionState) => void;
  reset: () => void;
}

// `fetchedAt` de diske yazılıyor (F6). NEDEN: eskiden yalnızca RAM'deydi, yani
// her SOĞUK AÇILIŞTA zaten kabul edilmiş olan 10 dakikalık tazelik sözleşmesi
// çöpe atılıyor ve akış ağı beklemek zorunda kalıyordu. Diske yazmak yeni bir
// bayatlık penceresi icat etmiyor — var olan sözleşmeyi soğuk açılışa taşıyor.
const persistState = (
  connectionStates: Record<string, ConnectionState>,
  fetchedAt: number
): void => {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ connectionStates, fetchedAt })).catch((error) => {
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
        // `fetchedAt` diskten geliyorsa liste "çekilmiş" sayılır — TTL'i hâlâ
        // tazeyse `fetchFollowingSlugs` ağa HİÇ çıkmaz. Eski kayıtlarda
        // (F6 öncesi yazılmış) bu alan yok; o durumda 0 kalır ve davranış
        // eskisi gibi olur (her açılışta tazele).
        const storedFetchedAt = typeof parsed.fetchedAt === 'number' ? parsed.fetchedAt : 0;
        useFollowStore.setState({
          connectionStates: parsed.connectionStates,
          fetchedAt: storedFetchedAt,
          isFetched: storedFetchedAt > 0,
        });
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
  lastFailedAt: 0,

  fetchFollowingSlugs: async (force = false) => {
    // Hidrasyon bitmeden ağdan gelen sonuç birleştirilmeye BAŞLANAMAZ —
    // aksi halde az sonra tamamlanacak hidrasyon bu birleştirmeyi ezer.
    await ensureHydrated();

    // 🔴 Google-only oturum (`create_new`, Madde 221): bu kullanıcının Trakt
    // hesabı HİÇ YOK, dolayısıyla bir Trakt takip listesi de yok. İstek
    // göndermek 401'den başka bir şey üretmez ve `lastFailedAt`'i doldurup
    // akışın tepesinde "Takip listesi güncellenemedi — son bilinen hâli
    // gösteriliyor" uyarısını çıkarır. Bu uyarı YANLIŞ TEŞHİSTİR: ortada
    // güncellenemeyen bir liste yok, hiç liste yok. Kullanıcı canlı testte
    // (2026-08-22) tam da bunu bildirdi.
    //
    // Boş ama BAŞARILI bir sonuç olarak işaretleniyor — `lastFailedAt` 0
    // kalıyor, dolayısıyla `selectIsFollowingListStale` false döner.
    const token = await SecureStore.getItemAsync('traktAccessToken');
    if (isKaymakSessionToken(token)) {
      set({ isFetched: true, isLoading: false, fetchedAt: Date.now(), lastFailedAt: 0 });
      return;
    }

    const isStale = Date.now() - get().fetchedAt >= CACHE_TTL.SYNC_INTERVAL;
    if (get().isFetched && !force && !isStale) return;

    // HATA BACKOFF'U — az önce başarısız olduysak hemen tekrar deneme.
    // `force` bunu aşar (kullanıcının açık bir eylemi, ör. pull-to-refresh).
    // Bu olmadan Trakt erişilemezken akışın her sayfası ölü isteği yeniden
    // deniyor ve timeout süresince bloke oluyordu.
    const { lastFailedAt } = get();
    if (!force && lastFailedAt > 0 && Date.now() - lastFailedAt < FAILURE_BACKOFF_MS) return;

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

          const now = Date.now();
          persistState(newState, now);
          // `lastFailedAt: 0` → başarı backoff'u temizler.
          return { connectionStates: newState, isFetched: true, fetchedAt: now, lastFailedAt: 0 };
        });
      } catch (error) {
        console.warn('[followStore] Takip durumu okunamadı:', error);
        logError('followStore.fetchFollowingSlugs', error);
        // ⚠️ `connectionStates`'e DOKUNULMUYOR — mevcut (diskten gelen) liste
        // korunur. Trakt kesintisinde akışın çalışmaya devam etmesinin sebebi
        // bu; F6'nın istemci tarafındaki dayanıklılığı buraya yaslanıyor.
        // Kaydedilen tek şey başarısızlık damgası: backoff ve "bayat" rozeti
        // bunu okuyor.
        set({ lastFailedAt: Date.now() });
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
      persistState(newState, prev.fetchedAt);
      return { connectionStates: newState };
    });
  },

  reset: () => {
    // Uçuştaki istek de bırakılmalı: aksi halde çıkış sonrası tamamlanan eski
    // hesabın isteği, az önce temizlenen store'u yeniden doldururdu.
    inFlightFetch = null;
    set({
      connectionStates: {},
      isFetched: false,
      isLoading: false,
      fetchedAt: 0,
      lastFailedAt: 0,
    });
    // 🔴 DİSK KOPYASI DA SİLİNMELİ (F6'da fark edildi). Eskiden yalnızca RAM
    // temizleniyordu; AsyncStorage'daki liste duruyordu. Uygulama yeniden
    // başlatıldığında hidrasyon ÖNCEKİ hesabın takip listesini yüklerdi.
    // F6 ile `fetchedAt` de diske yazıldığı için bu artık daha da tehlikeli:
    // liste "taze" görünüp ağa hiç çıkılmadan kullanılabilirdi.
    // Ayrıca `hydrationPromise` sıfırlanıyor ki bir sonraki `ensureHydrated()`
    // yeni oturum için baştan çalışsın.
    hydrationPromise = null;
    AsyncStorage.removeItem(STORAGE_KEY).catch((error) =>
      logError('followStore.reset.clearStorage', error)
    );
  }
}));

/**
 * Takip listesi "bayat" mı — yani son tazeleme denemesi BAŞARISIZ oldu ve
 * elimizdeki liste TTL'i geçmiş mi?
 *
 * UI bunu okuyup kullanıcıya görünür bir not gösteriyor (AI_RULES §2: sessiz
 * başarısızlık yasak). Liste ekranda çalışmaya devam ediyor ama kullanıcının
 * "bu liste güncel olmayabilir" bilgisine hakkı var.
 *
 * ⚠️ Yalnızca `lastFailedAt` yetmez: 60 saniye önce başarısız olup 3 dakika
 * önce başarıyla çekilmiş bir liste hâlâ tazedir, rozet gösterilmemeli.
 */
export function selectIsFollowingListStale(state: FollowState): boolean {
  if (state.lastFailedAt === 0) return false;
  return Date.now() - state.fetchedAt >= CACHE_TTL.SYNC_INTERVAL;
}

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
