import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchKaymakGraph, type KaymakGraf } from '../services/api/kaymakSocial';
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

/**
 * ==========================================================================
 * 🪪 ANAHTAR ARTIK `users.id` — TRAKT SLUG'I DEĞİL (Faz T · T3.3, M337)
 * ==========================================================================
 * "EVRENSEL KAYMAK KİMLİĞİ" ilkesi (MASTER_PLAN): `trakt_slug` sosyal kimlik
 * DEĞİLDİR. Google-only kullanıcının slug'ı YOK, dolayısıyla slug anahtarlı
 * bir store onu HİÇ temsil edemiyordu.
 *
 * ⛔ ESKİ KAYNAK TRAKT'TI (`getMyFollowingSlugs`). Artık `/social/graph` —
 * takip grafının tek otoritesi bizim veritabanımız (karar §5.1).
 *
 * 🔴 `STORAGE_KEY` v2'YE ÇEKİLDİ — BU SATIRI GERİ ALMA. Diskteki eski kayıt
 * SLUG anahtarlıydı; aynı anahtarla okunsaydı hidrasyon o slug'ları `userId`
 * sanıp herkesi "takip ediliyor" gösterirdi. Eski kayıt artık okunmuyor,
 * ilk açılışta graf ağdan bir kez çekiliyor.
 */
const STORAGE_KEY = 'kaymak-follow-storage-v2';

/**
 * Ağ isteği BAŞARISIZ olduktan sonra yeniden denemeden önce beklenecek süre.
 *
 * NEDEN VAR (F6): hata dalı `isFetched`'i `false`, `fetchedAt`'i `0` bırakıyor
 * → `isStale` her zaman `true` → **her `getFollowingUserIds()` çağrısı ölü
 * isteği yeniden deniyordu.** Akış sonsuz kaydırmada her sayfa için bu kümeye
 * ihtiyaç duyduğundan, sunucu erişilemezken her sayfa timeout'a kadar bloke
 * olabiliyordu. Backoff bu döngüyü kırıyor.
 */
const FAILURE_BACKOFF_MS = 60 * 1000;

interface FollowState {
  /** 🔑 Anahtar `users.id` (UUID). Slug DEĞİL. */
  connectionStates: Record<string, ConnectionState>;
  isFetched: boolean;
  isLoading: boolean;
  fetchedAt: number;
  /** Son BAŞARISIZ denemenin zamanı; 0 = son deneme başarılı. */
  lastFailedAt: number;
  fetchFollowGraph: (force?: boolean) => Promise<void>;
  /** Hazır bir graf yanıtını uygular (bildirim deposu AYRI istek atmasın diye). */
  applyGraf: (graf: KaymakGraf, baslangicNesli?: number) => void;
  setOptimisticState: (userId: string, state: ConnectionState) => void;
  reset: () => void;
}

// `fetchedAt` de diske yazılıyor (F6). NEDEN: eskiden yalnızca RAM'deydi, yani
// her SOĞUK AÇILIŞTA zaten kabul edilmiş olan tazelik sözleşmesi çöpe atılıyor
// ve akış ağı beklemek zorunda kalıyordu. Diske yazmak yeni bir bayatlık
// penceresi icat etmiyor — var olan sözleşmeyi soğuk açılışa taşıyor.
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
// `fetchFollowGraph`'ın BEKLEYEBİLECEĞİ bir promise olarak saklanıyor —
// ESKİDEN modül yüklenir yüklenmez ateşlenen bağımsız bir IIFE'ydi ve
// `fetchFollowGraph`in ağ isteği ile aralarında HİÇBİR sıralama garantisi
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
        // tazeyse `fetchFollowGraph` ağa HİÇ çıkmaz. Eski kayıtlarda bu alan
        // yok; o durumda 0 kalır ve davranış "her açılışta tazele" olur.
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

// Uçuştaki `fetchFollowGraph` isteği — eşzamanlı çağıranlar aynı promise'i
// bekler (bkz. fetchFollowGraph içindeki "ESKİ DAVRANIŞ" notu).
let inFlightFetch: Promise<void> | null = null;

// ══════════════════════════════════════════════════════════════════════════
// 🔴 YARIŞ KORUMASI — NESİL SAYACI (M321/M322'nin dersi, M338'de buraya)
// ══════════════════════════════════════════════════════════════════════════
// Senaryo: graf isteği uçuştayken kullanıcı "Takip Et"e basar → iyimser
// 'following'. Graf yanıtı takip sunucuya ulaşmadan ÖNCE okunmuşsa, geç gelip
// o durumu SİLER ve düğme "Takip Et"e geri döner — kullanıcı "bir şey olmadı"
// sanır (canlıda tam bu cümle raporlandı, 2026-09-11). 10 dakikalık TTL
// yüzünden düzelmesi de gecikir.
// 🎓 "Yarış koşulu 'daha hızlı yap' ile çözülmez" (M322). Her iyimser değişim
// bir nesil alır; bir graf yanıtı, isteği BAŞLADIKTAN sonra yapılmış
// değişimleri EZEMEZ, üstüne yeniden uygular.
let mutasyonNesli = 0;
const sonMutasyonlar = new Map<string, { nesil: number; durum: ConnectionState }>();

/** Graf isteği başlamadan önce okunur, yanıtla birlikte `applyGraf`'a verilir. */
export const takipMutasyonNesli = (): number => mutasyonNesli;

export const useFollowStore = create<FollowState>()((set, get) => ({
  connectionStates: {},
  isFetched: false,
  isLoading: false,
  fetchedAt: 0,
  lastFailedAt: 0,

  fetchFollowGraph: async (force = false) => {
    // Hidrasyon bitmeden ağdan gelen sonuç birleştirilmeye BAŞLANAMAZ —
    // aksi halde az sonra tamamlanacak hidrasyon bu birleştirmeyi ezer.
    await ensureHydrated();

    // ⛔ ESKİDEN BURADA BİR "KAYMAK OTURUMU → BOŞ DÖN" ERKEN ÇIKIŞI VARDI.
    // Gerekçesi doğruydu: Google-only kullanıcının Trakt takip listesi YOKTU,
    // istek 401'den başka bir şey üretmiyordu. Artık graf BİZDE ve o
    // kullanıcının da grafı var — erken çıkış onu kalıcı olarak "kimseyi
    // takip etmiyor" durumunda bırakırdı. KALDIRILDI (M337).

    const isStale = Date.now() - get().fetchedAt >= CACHE_TTL.SYNC_INTERVAL;
    if (get().isFetched && !force && !isStale) return;

    // HATA BACKOFF'U — az önce başarısız olduysak hemen tekrar deneme.
    // `force` bunu aşar (kullanıcının açık bir eylemi, ör. pull-to-refresh).
    const { lastFailedAt } = get();
    if (!force && lastFailedAt > 0 && Date.now() - lastFailedAt < FAILURE_BACKOFF_MS) return;

    // ESKİ DAVRANIŞ: `|| get().isLoading` koşuluyla, o an başka bir çağrı
    // uçuştaysa bu çağrı BEKLEMEDEN anında dönüyordu. `await
    // fetchFollowGraph()` yapıp hemen ardından `connectionStates`i okuyan
    // çağıranlar (Akış, bildirim deposu) bu durumda HENÜZ DOLMAMIŞ bir
    // listeyi okuyup "hiç kimseyi takip etmiyorum" sonucuna varıyordu —
    // soğuk açılışta iki tüketici aynı anda tetiklendiğinde akışın boş
    // görünmesinin sebebi buydu. ÇÖZÜM: uçuştaki promise paylaşılır.
    const existing = inFlightFetch;
    if (existing) return existing;

    const run = (async () => {
      set({ isLoading: true });
      try {
        const baslangicNesli = mutasyonNesli;
        const graf = await fetchKaymakGraph();
        get().applyGraf(graf, baslangicNesli);
      } catch (error) {
        console.warn('[followStore] Takip grafı okunamadı:', error);
        logError('followStore.fetchFollowGraph', error);
        // ⚠️ `connectionStates`'e DOKUNULMUYOR — mevcut (diskten gelen) liste
        // korunur. Sunucu kesintisinde akışın çalışmaya devam etmesinin
        // sebebi bu. Kaydedilen tek şey başarısızlık damgası: backoff ve
        // "bayat" rozeti bunu okuyor.
        set({ lastFailedAt: Date.now() });
      } finally {
        set({ isLoading: false });
        inFlightFetch = null;
      }
    })();

    inFlightFetch = run;
    return run;
  },

  applyGraf: (graf, baslangicNesli = mutasyonNesli) => {
    set((state) => {
      const newState = { ...state.connectionStates };

      // Sunucudan gelen liste OTORİTE: önce sunucunun yönettiği iki durumu
      // temizle, sonra taze hâlini yaz.
      Object.keys(newState).forEach((key) => {
        if (newState[key] === 'following' || newState[key] === 'pending') {
          delete newState[key];
        }
      });
      graf.following.forEach((kisi) => {
        newState[kisi.userId] = 'following';
      });
      // 🔑 GİZLİ HESAPLARA GÖNDERİLMİŞ İSTEKLER. Bunlar olmadan takip düğmesi
      // "İstek gönderildi" durumunu gösteremez.
      (graf.pendingOut ?? []).forEach((userId) => {
        newState[userId] = 'pending';
      });

      // 🔴 İSTEK BAŞLADIKTAN SONRAKİ İYİMSER DEĞİŞİMLER EZİLMEZ (üstteki not).
      // Daha eski değişimleri sunucu zaten görmüş sayılır → defterden düşer.
      for (const [userId, m] of sonMutasyonlar) {
        if (m.nesil > baslangicNesli) {
          if (m.durum === 'none') delete newState[userId];
          else newState[userId] = m.durum;
        } else {
          sonMutasyonlar.delete(userId);
        }
      }

      const now = Date.now();
      persistState(newState, now);
      // `lastFailedAt: 0` → başarı backoff'u temizler.
      return { connectionStates: newState, isFetched: true, fetchedAt: now, lastFailedAt: 0 };
    });
  },

  setOptimisticState: (userId, state) => {
    sonMutasyonlar.set(userId, { nesil: ++mutasyonNesli, durum: state });
    set((prev) => {
      const newState = { ...prev.connectionStates };
      if (state === 'none') {
        delete newState[userId];
      } else {
        newState[userId] = state;
      }
      persistState(newState, prev.fetchedAt);
      return { connectionStates: newState };
    });
  },

  reset: () => {
    // Uçuştaki istek de bırakılmalı: aksi halde çıkış sonrası tamamlanan eski
    // hesabın isteği, az önce temizlenen store'u yeniden doldururdu.
    inFlightFetch = null;
    // Önceki hesabın iyimser defteri yeni hesaba sızmasın.
    sonMutasyonlar.clear();
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
    // F6 ile `fetchedAt` de diske yazıldığı için bu daha da tehlikeli:
    // liste "taze" görünüp ağa hiç çıkılmadan kullanılabilirdi.
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
 * Takip edilen kullanıcıların **`users.id`** listesi — bu store'un zaten
 * tuttuğu `connectionStates`'ten türetilir, AYRI bir ağ isteği YAPILMAZ.
 *
 * 🪪 ESKİ ADI `getFollowingSlugs` İDİ. Slug döndürmediği için adı da
 * değişti: `feedApi` artık dönen değeri DOĞRUDAN `feed_activities.user_id`
 * filtresinde kullanıyor, arada bir slug→uuid çevirisi YOK (o adım M337'de
 * silindi).
 *
 * `pending` (onay bekleyen) durumlar BİLİNÇLİ OLARAK dışarıda — henüz
 * onaylanmamış bir takip isteği, o kişinin aktivitelerini görme hakkı vermez.
 */
export async function getFollowingUserIds(): Promise<string[]> {
  await useFollowStore.getState().fetchFollowGraph();
  const { connectionStates } = useFollowStore.getState();
  return Object.keys(connectionStates).filter((id) => connectionStates[id] === 'following');
}

// Hidrasyonu uygulama açılışında hemen tetikle (kimse henüz `fetchFollowGraph`
// çağırmamış olsa bile) — `ensureHydrated()` idempotent olduğundan ilk
// `fetchFollowGraph` çağrısı zaten bitmiş olan bu promise'i anında geçer.
ensureHydrated();
