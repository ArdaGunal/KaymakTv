/**
 * ==========================================================================
 * İYİMSER İLERLEME YAMASI — SAF, ağ yok, yan etki yok
 * ==========================================================================
 * Faz T · M321.
 *
 * 🔴 NEDEN VAR — ÜÇ TURDUR YANLIŞ YERE BAKILDI:
 * `markEpisodeAsWatched`'ın iyimser güncellemesi YALNIZCA
 * `next_episode.number`'ı artırıyordu. `seasons[].episodes[].completed`'a
 * hiç dokunmuyordu. Oysa o alanı ÜÇ ayrı tüketici okuyor:
 *
 *   1. `useShowDetail.ts:212`      → bölüm listesindeki yeşil tik
 *   2. `useEpisodeActions.ts:54`   → "bu bölüm izlendi mi"
 *   3. `useEpisodeActions.ts:103`  → 🔴 "ATLANAN BÖLÜM VAR MI" kontrolü
 *
 * Üçüncüsü kullanıcının bildirdiği hatanın kaynağı: arka arkaya bölüm
 * işaretleyen kullanıcı, bir önceki işaretlemenin sunucu turu (~1 sn) daha
 * dönmeden sonrakine basıyor; kontrol `completed: false` görüyor ve
 * "atladın mı?" diye soruyor — hâlbuki kullanıcı az önce işaretledi.
 *
 * ⚠️ SUNUCU TURU BU YARIŞI ÇÖZMEZ, yalnızca penceresini daraltır. Doğru
 * çözüm iyimser durumun EKSİKSİZ olması: kullanıcı bastığı anda ekran ve
 * kontroller doğru veriyi görmeli, sunucu turu sonradan ONAYLAR.
 *
 * 🔑 BU BİR "İKİNCİ GERÇEK KAYNAĞI" DEĞİL: üretilen değer geçicidir ve
 * `kaymakIlerlemeTazele` dönünce sunucunun hesabıyla DEĞİŞTİRİLİR. Kalıcı
 * gerçek tek yerde (Worker + katalog) kalmaya devam ediyor.
 */

/** Trakt ilerlemeyi özel bölümleri (sezon 0) saymaz — sunucu da saymıyor. */
const OZEL_SEZON = 0;

type Bolum = {
  number: number;
  completed?: boolean;
  last_watched_at?: string | null;
  title?: string | null;
  first_aired?: string | null;
};

type Sezon = { number: number; aired?: number; completed?: number; episodes?: Bolum[] };

export type Ilerleme = {
  aired?: number;
  completed?: number;
  last_watched_at?: string | null;
  seasons?: Sezon[];
  next_episode?: { season: number; number: number; title: string | null } | null;
  last_episode?: { season: number; number: number; title: string | null } | null;
};

/** Bölüm yayınlandı mı — `null` "bilinmiyor" demek ve YAYINLANDI sayılır (039). */
const yayinda = (b: Bolum, simdi: number) => {
  if (!b.first_aired) return true;
  const t = Date.parse(b.first_aired);
  return !Number.isFinite(t) || t <= simdi;
};

/**
 * Sayaçları ve `next_episode`/`last_episode`'u sezon dizisinden YENİDEN
 * türetir. Elle artırmak yerine yeniden hesaplamak, tekrar işaretleme
 * (aynı bölüme iki kez basma) durumunda sayacın şişmesini önlüyor.
 */
const yenidenHesapla = (ilerleme: Ilerleme, simdi: number): Ilerleme => {
  let aired = 0;
  let completed = 0;
  let sonraki: Ilerleme['next_episode'] = null;
  let sonuncu: Ilerleme['last_episode'] = null;
  let sonDamga: string | null = null;

  const sezonlar = [...(ilerleme.seasons || [])].sort((a, b) => a.number - b.number);

  for (const s of sezonlar) {
    const bolumler = [...(s.episodes || [])].sort((a, b) => a.number - b.number);
    let sAired = 0;
    let sCompleted = 0;

    for (const b of bolumler) {
      const yayinlandi = yayinda(b, simdi);
      if (yayinlandi) {
        sAired++;
        if (s.number !== OZEL_SEZON) aired++;
      }
      if (b.completed) {
        sCompleted++;
        if (s.number !== OZEL_SEZON) {
          completed++;
          sonuncu = { season: s.number, number: b.number, title: b.title ?? null };
        }
        if (b.last_watched_at && (!sonDamga || b.last_watched_at > sonDamga)) {
          sonDamga = b.last_watched_at;
        }
      }
      if (!sonraki && !b.completed && yayinlandi && s.number !== OZEL_SEZON) {
        sonraki = { season: s.number, number: b.number, title: b.title ?? null };
      }
    }
    s.aired = sAired;
    s.completed = sCompleted;
    s.episodes = bolumler;
  }

  return {
    ...ilerleme,
    seasons: sezonlar,
    aired,
    completed,
    last_watched_at: sonDamga ?? ilerleme.last_watched_at ?? null,
    next_episode: sonraki,
    last_episode: sonuncu,
  };
};

/**
 * Ekranın katalog verisinden İSKELET ilerleme kurar (M422).
 *
 * 🔴 NEDEN GEREKLİ: `bolumleriIsaretle` elde ilerleme YOKSA `null` dönüyor ve
 * iyimser güncelleme yapılamıyordu. Dizi ilk kez işaretlendiğinde (özellikle
 * "öncekileri de işaretle" ile ONLARCA bölüm) ekran sunucu turunu bekliyordu:
 * kullanıcı "5x3'ü işaretledim, yalnız o bölüm tikli göründü; gir-çık yapınca
 * hepsi tikli" diye bildirdi. Uzun dizide bu bekleme saniyeler sürüyor.
 *
 * ⚠️ BU UYDURMA DEĞİL: bölüm listesi ekranın ZATEN çizdiği katalog verisi
 * (`useShowDetail` → `computedSeasons`). Sunucu turu dönünce kanonik hesapla
 * değiştirilir; `yenidenHesapla` sayaçları ve `next_episode`'u buradan türetir.
 */
export const iskeletKur = (
  sezonlar: { number: number; episodes?: { number: number; first_aired?: string | null; title?: string | null }[] }[] | null | undefined,
  simdi: number = Date.now(),
): Ilerleme | null => {
  if (!Array.isArray(sezonlar) || sezonlar.length === 0) return null;
  const kopya: Ilerleme = {
    seasons: sezonlar
      .filter((s) => typeof s?.number === 'number')
      .map((s) => ({
        number: s.number,
        episodes: (s.episodes || [])
          .filter((b) => typeof b?.number === 'number')
          .map((b) => ({
            number: b.number,
            completed: false,
            last_watched_at: null,
            title: b.title ?? null,
            first_aired: b.first_aired ?? null,
          })),
      })),
  };
  if (!kopya.seasons?.some((s) => (s.episodes || []).length > 0)) return null;
  return yenidenHesapla(kopya, simdi);
};

/**
 * Bir veya birden çok bölümü İZLENDİ olarak iyimser işaretler.
 *
 * ⚠️ `null` DÖNEBİLİR: elde ilerleme yoksa (kullanıcı diziyi ilk kez
 * açıyorsa) uyduramayız — bölüm listesini bilmiyoruz. O durumda çağıran
 * eskisi gibi sunucu turunu bekler. Sahte bir iskelet üretmek, olmayan
 * bölümleri varmış gibi göstermek olurdu.
 */
export const bolumleriIsaretle = (
  ilerleme: Ilerleme | null | undefined,
  seasonNumber: number,
  episodeNumbers: number[],
  watchedAt: string,
  simdi: number = Date.now(),
): Ilerleme | null => {
  if (!ilerleme?.seasons?.length) return null;
  const hedef = new Set(episodeNumbers);

  const kopya: Ilerleme = {
    ...ilerleme,
    seasons: ilerleme.seasons.map((s) => ({
      ...s,
      episodes: (s.episodes || []).map((b) =>
        s.number === seasonNumber && hedef.has(b.number)
          ? { ...b, completed: true, last_watched_at: watchedAt }
          : { ...b },
      ),
    })),
  };
  return yenidenHesapla(kopya, simdi);
};

/** Sezonun TÜM bölümlerini iyimser işaretler ("sezonu izledim"). */
export const sezonuIsaretle = (
  ilerleme: Ilerleme | null | undefined,
  seasonNumber: number,
  watchedAt: string,
  simdi: number = Date.now(),
): Ilerleme | null => {
  if (!ilerleme?.seasons?.length) return null;
  const sezon = ilerleme.seasons.find((s) => s.number === seasonNumber);
  if (!sezon) return null;
  // ⚠️ YAYINLANMAMIŞ bölüm işaretlenmez — sunucu da `watched_at` gelecek
  // tarihli olamaz diye reddederdi ve iki taraf ıraksardı.
  const numaralar = (sezon.episodes || []).filter((b) => yayinda(b, simdi)).map((b) => b.number);
  return bolumleriIsaretle(ilerleme, seasonNumber, numaralar, watchedAt, simdi);
};

/** Bölüm(ler)i İZLENMEDİ'ye çevirir. */
export const bolumleriGeriAl = (
  ilerleme: Ilerleme | null | undefined,
  seasonNumber: number,
  episodeNumbers: number[] | 'tumu',
  simdi: number = Date.now(),
): Ilerleme | null => {
  if (!ilerleme?.seasons?.length) return null;
  const hepsi = episodeNumbers === 'tumu';
  const hedef = hepsi ? null : new Set(episodeNumbers as number[]);

  const kopya: Ilerleme = {
    ...ilerleme,
    seasons: ilerleme.seasons.map((s) => ({
      ...s,
      episodes: (s.episodes || []).map((b) =>
        s.number === seasonNumber && (hepsi || hedef!.has(b.number))
          ? { ...b, completed: false, last_watched_at: null }
          : { ...b },
      ),
    })),
  };
  return yenidenHesapla(kopya, simdi);
};
