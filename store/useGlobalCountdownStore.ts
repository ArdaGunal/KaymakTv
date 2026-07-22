import { create } from 'zustand';

interface GlobalCountdownState {
  /** Paylaşılan "şu an" (ms). useAirCountdown çağıran her bileşen bu değeri
   * okuyup kendi metnini (i18n bağımlı olduğu için yerelde) hesaplar. */
  now: number;
}

export const useGlobalCountdownStore = create<GlobalCountdownState>(() => ({
  now: Date.now(),
}));

// Abone sayısı ve interval kimliği REAKTİF state DEĞİL — traktClient.ts'teki
// isRefreshing/failedQueue ile aynı "modül seviyesi sayaç" deseni: bu ikisinin
// değişimi kendi başına render tetiklemez, yalnızca `now` alanı tetikler.
let intervalId: ReturnType<typeof setInterval> | null = null;
let subscriberCount = 0;

/**
 * useAirCountdown çağıran her bileşen mount olduğunda bunu çağırır.
 * ESKİ DAVRANIŞ: her kart kendi setInterval(60s)'ını açıyordu — ekranda 50-100
 * kart varsa (Explore/Grid, uzun bir liste) aynı anda 50-100 ayrı timer RAM'de
 * birikiyor, özellikle uzun süre kaydırma sonrası cihazı yavaşlatıyordu. Artık
 * kaç bileşen abone olursa olsun yalnızca TEK bir global interval çalışır.
 */
export const subscribeToGlobalCountdown = () => {
  subscriberCount++;
  // Yeni abone olan bileşen (mount anında) her zaman güncel bir "şu an" görsün
  // diye — 60 saniyelik tick'i beklemeden hemen senkronize edilir (eski
  // davranıştaki "İlk hesaplamayı hemen yap" ile aynı garanti).
  useGlobalCountdownStore.setState({ now: Date.now() });

  if (subscriberCount === 1 && !intervalId) {
    intervalId = setInterval(() => {
      useGlobalCountdownStore.setState({ now: Date.now() });
    }, 60 * 1000);
  }
};

/** useAirCountdown çağıran bileşen unmount olduğunda bunu çağırır. */
export const unsubscribeFromGlobalCountdown = () => {
  subscriberCount = Math.max(0, subscriberCount - 1);
  if (subscriberCount === 0 && intervalId) {
    // Son kart da ekrandan kalkınca interval durdurulur — arka planda
    // anlamsız yere çalışmaya devam etmez (örn. kullanıcı geri sayım
    // içermeyen bir sekmeye geçtiğinde).
    clearInterval(intervalId);
    intervalId = null;
  }
};
