/**
 * Dizi Takip (Tracking) modülünün TEK GERÇEK KAYNAĞI (single source of truth).
 *
 * Buradaki fonksiyonlar tamamen SAF (pure) ve UI'dan bağımsızdır: girdi olarak
 * ham Zustand dilimlerini (watchedShows, watchlistShows, showProgressMap) alır,
 * çıktı olarak her diziyi TAM OLARAK BİR kategoriye koyan deterministik bir
 * sonuç döndürür. Eski `useDashboardData`'daki "aynı dizinin birden fazla
 * listeye sızması / yanlış listeye düşmesi" hatası, kategorizasyonun UI'a
 * dağılmış olmasından kaynaklanıyordu. Artık kategorizasyon burada, tek yerde.
 *
 * Kurallar (bir dizi = bir kova, çakışma imkânsız):
 *   1. İzlenmeye başlanmış AMA şu an izlenmeye hazır (yayınlanmış) bir sonraki
 *      bölüm YOK → hiçbir takip listesinde görünmez. Fark etmez dizi sonsuza
 *      dek bitmiş olsun ya da gelecekte henüz yayınlanmamış bir sezonu/bölümü
 *      olsun — "şu an izlenecek bir şey yok" ikisi için de aynı sonucu doğurur.
 *   2. Kullanıcı manuel "Bırakıldı" işaretlemiş                            → dropped
 *      (tarihten TAMAMEN bağımsız — 3-nokta menüsünden elle yapılan tek işlem).
 *   3. Hiç izlenmemiş (completed===0)                                      → notStarted
 *   4. İzlenmeye başlanmış + şu an yayınlanmış bir sonraki bölüm VAR + son
 *      izlemenin üzerinden `pauseThresholdDays` (varsayılan 45) günden FAZLA
 *      geçmiş                                                              → paused
 *      (Ara Verilenler / Beklemede — otomatik, ama SADECE bu iki kova
 *      arasındaki ayrımı belirler; "Bırakıldı" ile hiçbir ilişkisi yok).
 *   5. İzlenmeye başlanmış + şu an yayınlanmış bir sonraki bölüm VAR + son
 *      izleme `pauseThresholdDays` günden AZ                               → upNext
 *      (Aktif İzlenenler)
 */

export interface TrackingCard {
  id: number;
  showName: string;
  season: number;
  episode: number;
  title: string;
  tags: string[];
  image: null;
  tmdbId: number | undefined;
  slug: string | undefined;
  completedCount: number | null;
  totalCount: number | null;
  isCalculating: boolean;
  /** Şu an izlenmeye hazır (yayınlanmış) bir sıradaki bölüm var mı? */
  readyToWatch: boolean;
  /** Bilinen son izleme tarihi (ISO) — yalnızca sıralama/gösterim amaçlı, kategorizasyon `now` anında hesaplanır. */
  lastWatchedAt?: string;
}

export interface ShowCategories {
  /** Aktif İzlenenler. */
  upNext: TrackingCard[];
  /** Ara Verilenler (Beklemede) — otomatik, `pauseThresholdDays` günden eski. */
  paused: TrackingCard[];
  notStarted: TrackingCard[];
  /** Manuel olarak "Bırakıldı" işaretlenenler. */
  dropped: TrackingCard[];
}

export interface TrackingLabels {
  unnamedShow: string;
  /** Başlanmamış diziler için satır başlığı. */
  notStarted: string;
  /** Aktif ama sıradaki bölümü henüz yayınlanmamış diziler için başlık. */
  caughtUp: string;
}

export interface CategorizeOptions {
  watchedShows: any[];
  watchlistShows: any[];
  showProgressMap: Record<string, any>;
  labels: TrackingLabels;
  /** Kullanıcının manuel olarak "Bırakıldı" işaretlediği dizilerin trakt id'leri. */
  droppedShowIds?: number[] | Set<number>;
  now?: number;
  /** Son izlemenin üzerinden kaç gün geçince "Ara Verilenler"e düşeceği. */
  pauseThresholdDays?: number;
}

export const DEFAULT_PAUSE_THRESHOLD_DAYS = 45;

const toTitle = (raw: string | undefined, fallback: string) => (raw || fallback).toUpperCase();

const hasAired = (firstAired: string | null | undefined, now: number): boolean => {
  if (!firstAired) return true; // Tarih yoksa izlenebilir varsay (temkinli).
  const t = new Date(firstAired).getTime();
  return !isNaN(t) && t <= now;
};

/**
 * Ham dilimleri, ekranın doğrudan gösterebileceği 4 kategoriye ayırır.
 * Her dizi trakt id'siyle tekilleştirilir; watched + watchlist havuzları
 * birleştirilip her kimlik yalnızca BİR kez işlenir.
 */
export function categorizeShows({
  watchedShows,
  watchlistShows,
  showProgressMap,
  labels,
  droppedShowIds = [],
  now = Date.now(),
  pauseThresholdDays = DEFAULT_PAUSE_THRESHOLD_DAYS,
}: CategorizeOptions): ShowCategories {
  const droppedSet = droppedShowIds instanceof Set ? droppedShowIds : new Set(droppedShowIds);
  const pauseThreshold = now - pauseThresholdDays * 24 * 60 * 60 * 1000;

  // 1) Kimliğe göre birleşik havuz: her dizi tek kayıt. watched kaydı önceliklidir
  //    (ilerleme + son izleme tarihini o taşır), watchlist yalnızca havuzda
  //    olmayan dizileri ekler.
  const byId = new Map<number, { show: any; lastWatchedAt?: string; fromWatched: boolean }>();

  for (const item of watchedShows || []) {
    const id = item?.show?.ids?.trakt;
    if (!id || byId.has(id)) continue;
    byId.set(id, { show: item.show, lastWatchedAt: item.last_watched_at, fromWatched: true });
  }
  for (const item of watchlistShows || []) {
    const id = item?.show?.ids?.trakt;
    if (!id || byId.has(id)) continue;
    byId.set(id, { show: item.show, fromWatched: false });
  }

  const upNext: TrackingCard[] = [];
  const paused: TrackingCard[] = [];
  const notStarted: TrackingCard[] = [];
  const dropped: TrackingCard[] = [];

  for (const [id, entry] of byId) {
    const show = entry.show;
    const progress = showProgressMap[id];
    const completed = progress?.completed ?? 0;
    const aired = progress?.aired ?? 0;
    const next = progress?.next_episode ?? null;

    const isCalculating = progress === undefined && entry.fromWatched;
    const hasStarted = completed > 0 || (isCalculating && entry.fromWatched);
    const nextReady = !!next && hasAired(next.first_aired, now);

    // 1. Kullanıcı bu dizide izlemeye başlamış VE elimizde gerçek (hesaplanmakta
    // OLMAYAN) ilerleme verisi varken şu an izlenmeye hazır (yayınlanmış) bir
    // sonraki bölüm yoksa, dizi HİÇBİR takip listesinde görünmez — fark etmez
    // dizi sonsuza dek bitmiş olsun (next yok) ya da gelecekte henüz
    // yayınlanmamış bir sezonu/bölümü olsun (next var ama tarihi gelmemiş):
    // "şu an izlenecek bir şey yok" ikisi için de aynı anlama gelir, dizi
    // "izlenip bitmiş" gibi davranılır (yalnızca profil/istatistiklerde
    // görünmeye devam eder — bu ekranlar watchedShows'tan bağımsız ayrı bir
    // kaynaktan besleniyor, bu listeden çıkarmak onları etkilemez).
    // ESKİ DAVRANIŞ yalnızca "next === null" (sonsuza dek bitmiş) durumunu
    // buraya alıyordu; "yeni sezon duyuruldu ama henüz yayınlanmadı" durumu bu
    // kontrolü atlatıp "Aktif İzlenenler"e SIZIYORDU — üstelik aşağıdaki
    // season/episode hesaplaması `hasStarted && nextReady` şartını
    // sağlayamadığından `: 1` dalına düşüp kartta hep "S1E1" gösteriyordu,
    // izlenmiş sezonlar sanki hiç izlenmemiş gibi görünüyordu. Henüz hiç
    // başlanmamış diziler (hasStarted=false) bu kuraldan MUAF — onlar
    // "Henüz Başlanmadı"da görünmeye devam eder (bilinçli takip edilen,
    // ileride izlenecek içerik). `!!progress` şartı, arka planda ilerlemesi
    // henüz hesaplanmakta olan (isCalculating) dizilerin "hesaplanıyor"
    // spinner kartını göstermeye devam etmesini garanti eder.
    if (!!progress && hasStarted && !nextReady) continue;

    // Ortak görsel alanları
    const base = {
      id,
      showName: toTitle(show?.title, labels.unnamedShow),
      image: null as null,
      tmdbId: show?.ids?.tmdb,
      slug: show?.ids?.slug,
      completedCount: progress ? completed : null,
      totalCount: progress ? (aired || null) : null,
      isCalculating,
      lastWatchedAt: entry.lastWatchedAt,
    };

    const season = hasStarted && nextReady ? next.season : 1;
    const episode = hasStarted && nextReady ? next.number : 1;
    const title = hasStarted ? (nextReady ? (next.title || labels.caughtUp) : labels.caughtUp) : labels.notStarted;

    // 2. Kullanıcı manuel "Bırakıldı" işaretlemiş → dropped (tarihten/ilerlemeden bağımsız).
    if (droppedSet.has(id)) {
      dropped.push({
        ...base,
        season,
        episode,
        title,
        tags: ['BIRAKILDI'],
        readyToWatch: hasStarted && nextReady,
      });
      continue;
    }

    // 3. Hiç başlanmamış → notStarted. completedCount/totalCount BİLİNÇLİ
    // OLARAK null'a sabitlenir — ilerleme çubuğu bu kategoride asla görünmemeli
    // (progress kaydı var ama completed===0 olan uç bir durumda bile).
    if (!hasStarted) {
      notStarted.push({
        ...base,
        completedCount: null,
        totalCount: null,
        season: 1,
        episode: 1,
        title: labels.notStarted,
        tags: ['WATCHLIST'],
        readyToWatch: false,
      });
      continue;
    }

    // 4/5. Başlanmış: son izleme eşikten eskiyse paused, değilse upNext.
    // ESKİ DAVRANIŞ: yalnızca "son izlemenin üzerinden ne kadar zaman geçti"ye
    // bakılıyordu — dizinin şu an izlenebilir (yayınlanmış) bekleyen bir
    // bölümü olup olmadığı hiç sorulmuyordu. Sonuç: bir diziyi bitirip aylar
    // sonra yeni bir sezonu duyurulduğunda (henüz YAYINLANMAMIŞ next_episode),
    // "Ara Verilenler"e düşüyordu — oysa ortada izlenip ihmal edilmiş bir şey
    // yoktu, kullanıcı sadece yeni bölümü bekliyordu. `nextReady` (yayınlanmış,
    // izlenebilir bir sıradaki bölüm var mı) şartı eklenerek "paused" artık
    // yalnızca GERÇEK bir birikmiş-izlenmemiş-bölüm varken anlamlı hale geldi.
    // Son izleme tarihi bilinmiyorsa (yalnızca watchlist'ten gelen, uçtaki bir
    // kayıt) temkinli davranıp aktif sayılır — asla sessizce "eskimiş" varsayılmaz.
    const isPaused = nextReady && entry.lastWatchedAt
      ? new Date(entry.lastWatchedAt).getTime() < pauseThreshold
      : false;

    // Ara Verilenler kendi akordeon bölümünde zaten ayrışıyor — kartın
    // üzerinde ayrıca "BEKLEMEDE" yazısı YOK (kullanıcı tercihi: kategori
    // gruplaması + ilerleme çubuğu rengi yeterli sinyal, metin rozeti fazlalık).
    const card: TrackingCard = {
      ...base,
      season,
      episode,
      title,
      tags: nextReady ? ['EN SON'] : [],
      readyToWatch: nextReady,
    };

    if (isPaused) paused.push(card);
    else upNext.push(card);
  }

  // Aktif olanları "izlenmeye hazır" olanları öne alıp stabil bir sıralama
  // veriyoruz. Ara verilenleri ise en yakın zamanda bırakılan en üstte olacak
  // şekilde (en yeni last_watched_at önce) sıralıyoruz — kullanıcı en çok
  // "az önce ara verdiğim" diziyi görmek ister.
  upNext.sort((a, b) => Number(b.readyToWatch) - Number(a.readyToWatch));
  paused.sort((a, b) => {
    const at = a.lastWatchedAt ? new Date(a.lastWatchedAt).getTime() : 0;
    const bt = b.lastWatchedAt ? new Date(b.lastWatchedAt).getTime() : 0;
    return bt - at;
  });

  return { upNext, paused, notStarted, dropped };
}
