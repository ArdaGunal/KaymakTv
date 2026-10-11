/**
 * A-4 · Realtime INSERT patlamalarını tek isteğe toplayan küçük kuyruk.
 *
 * Ölçüldü (M489): Worker `/feed/sync` bir Trakt'lı kullanıcının son 50 izlemesini TEK
 * INSERT ile yazabiliyor → takipçilerin her cihazında 50 ayrı Realtime olayı. Eskiden her
 * olay için ayrı `fetchActivityById` atılıyordu (50 istek, aynı anda). Artık olaylar kısa
 * bir pencerede (`beklemeMs`) birikir ve tek `in(id, …)` sorgusuyla tamamlanır.
 *
 * Saf mantık — zamanlayıcı dışında bağımlılık yok, test edilebilir.
 */
export interface Toplayici<T> {
  ekle: (oge: T) => void;
  /** Bekleyenleri hemen işle (test / kapanış). */
  bosalt: () => void;
  /** Bekleyenleri at (abonelik kapanırken). */
  iptal: () => void;
}

export function toplayiciKur<T>(
  isle: (parti: T[]) => void | Promise<void>,
  beklemeMs = 250,
  enFazla = 50
): Toplayici<T> {
  let kuyruk: T[] = [];
  let zaman: ReturnType<typeof setTimeout> | null = null;

  const bosalt = () => {
    if (zaman) {
      clearTimeout(zaman);
      zaman = null;
    }
    if (kuyruk.length === 0) return;
    // Aynı öğe iki kez gelirse (yeniden bağlanma vb.) tek kez işlenir.
    const parti = [...new Set(kuyruk)];
    kuyruk = [];
    void isle(parti);
  };

  return {
    ekle: (oge) => {
      kuyruk.push(oge);
      // Tavan: PostgREST URL'i şişmesin, çok büyük patlama parça parça gelsin.
      if (kuyruk.length >= enFazla) bosalt();
      else if (!zaman) zaman = setTimeout(bosalt, beklemeMs);
    },
    bosalt,
    iptal: () => {
      if (zaman) clearTimeout(zaman);
      zaman = null;
      kuyruk = [];
    },
  };
}
