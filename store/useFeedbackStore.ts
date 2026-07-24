import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { create } from 'zustand';

// `zustand/middleware`'in ESM build'i (`zustand/esm/middleware.mjs`) `devtools`
// middleware'i için `import.meta.env` kullanıyor — Metro bu dosyayı web statik
// export'unda `type="module"` OLMAYAN bir script olarak paketleyince
// "Cannot use 'import.meta' outside a module" hatasıyla TÜM uygulamayı
// (parse zamanında) çökertiyordu. Bu yüzden `persist` middleware yerine,
// projede zaten `utils/errorLog.ts`'te kullanılan manuel AsyncStorage
// okuma/yazma deseni tercih edildi.
const STORAGE_KEY = '@kaymak_feedback_v1';

interface StoredFeedbackData {
  anonymousId: string;
  lastSentAt: number | null;
}

interface FeedbackState extends StoredFeedbackData {
  setLastSentAt: (timestamp: number) => void;
}

const persistState = (data: StoredFeedbackData): void => {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {
    // Kalıcı yazma başarısız olursa sessizce yutulur — cooldown/anonim ID
    // bir sonraki açılışta sıfırlanır, ana akışı asla etkilemez.
  });
};

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
  /** Kalıcı, kimliksiz cihaz tanımlayıcı — Supabase auth yok (Trakt OAuth
   * kullanılıyor), misafir modu da dahil her durumda çalışsın diye.
   * AsyncStorage hidrasyonu tamamlanana kadar geçici bir değerle başlar. */
  anonymousId: Crypto.randomUUID(),
  lastSentAt: null,
  setLastSentAt: (timestamp) => {
    set({ lastSentAt: timestamp });
    persistState({ anonymousId: get().anonymousId, lastSentAt: timestamp });
  },
}));

// Uygulama açılışında tek seferlik hidrasyon — daha önce kaydedilmiş bir
// anonymousId/lastSentAt varsa (gerçek cihaz) onu yükler, yoksa (ilk açılış)
// az önce üretilen anonymousId'yi kalıcı hale getirir.
(async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: StoredFeedbackData = JSON.parse(raw);
      useFeedbackStore.setState({
        anonymousId: parsed.anonymousId || useFeedbackStore.getState().anonymousId,
        lastSentAt: parsed.lastSentAt ?? null,
      });
    } else {
      persistState({ anonymousId: useFeedbackStore.getState().anonymousId, lastSentAt: null });
    }
  } catch {
    // yoksay — yeni bir anonim ID + boş cooldown ile devam eder.
  }
})();
