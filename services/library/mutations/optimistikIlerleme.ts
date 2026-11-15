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

// `utils/izlemeSayisi.ts` · `bolumIzlemeSayisi` ile AYNI kural. Kopya bilinçli: bu dosya düz Node
// testlerinde (`tests/ilerleme`, `tests/arayuz`) tek başına yükleniyor ve oradaki çözümleyici saf
// dosyalar arası uzantısız içe aktarmayı açamıyor. Eşlik `tests/arayuz/izleme-sayisi.test.mjs`'te.
const bolumIzlemeSayisi = (b: { completed?: boolean; plays?: number } | null | undefined): number => {
  if (!b?.completed) return 0;
  const n = Number(b.plays);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
};

type Bolum = {
  number: number;
  completed?: boolean;
  last_watched_at?: string | null;
  /** 081 · izleme sayısı (sunucu); iyimser artış damgaya bağlı, bkz. `bolumleriIsaretle`. */
  plays?: number;
  title?: string | null;
  first_aired?: string | null;
};

type Sezon = { number: number; aired?: number; completed?: number; episodes?: Bolum[] };

export type Ilerleme = {
  /** Yerel bölüm listesi otoriter yayınlanmış sayısını kapsamıyor. */
  catalogIncomplete?: boolean;
  aired?: number;
  completed?: number;
  last_watched_at?: string | null;
  seasons?: Sezon[];
  next_episode?: { season: number; number: number; title: string | null } | null;
  last_episode?: { season: number; number: number; title: string | null } | null;
  /** 081 · ek tekrar izleme sayısı (sezon 0 dahil); iyimser güncellenir, sunucu turu kesinleştirir. */
  rewatch_plays?: number;
};

/** Ek tekrar sayacını `fark` kadar oynatır; alan hiç yoksa ve fark yoksa dokunmaz. */
const tekrarYamasi = (ilerleme: Ilerleme, fark: number): Partial<Ilerleme> =>
  fark === 0 && ilerleme.rewatch_plays === undefined
    ? {} : { rewatch_plays: Math.max(0, (ilerleme.rewatch_plays ?? 0) + fark) };

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
  let yeniIsaret = 0;
  let degisti = false;
  let ekTekrar = 0;

  const kopya: Ilerleme = {
    ...ilerleme,
    seasons: ilerleme.seasons.map((s) => ({
      ...s,
      episodes: (s.episodes || []).map((b) => {
        if (s.number !== seasonNumber || !hedef.has(b.number)) return { ...b };
        // 🔴 081 · İZLEME SAYISI DAMGAYA BAĞLI, körlemesine artmaz: outbox bekleyen ve yeni onaylanmış
        // işleri SUNUCU verisinin üstüne yeniden yansıtıyor (`outbox/projection.ts`). Sunucu bu izlemeyi
        // zaten içeriyorsa son damga ≥ bu damgadır → sayı aynı kalır (aynı iş iki kez sayılmaz).
        const yeni = !b.last_watched_at || Date.parse(b.last_watched_at) < Date.parse(watchedAt);
        let plays = bolumIzlemeSayisi(b);
        if (!b.completed) {
          degisti = true;
          if (seasonNumber !== OZEL_SEZON) yeniIsaret++;
          plays = 1;
        } else if (yeni) {
          plays += 1;
          ekTekrar++;
        }
        return { ...b, completed: true, last_watched_at: yeni ? watchedAt : b.last_watched_at, plays };
      }),
    })),
  };
  Object.assign(kopya, tekrarYamasi(ilerleme, ekTekrar));
  // M441: sunucu zaten bu tikleri döndürdüyse yalnız tarihi yamala.
  // Kısmi seasons listesinden tekrar hesaplayıp kanonik next/sayaçları bozma.
  if (!degisti && typeof ilerleme.aired === 'number' && typeof ilerleme.completed === 'number') return { ...kopya, last_watched_at:
    !ilerleme.last_watched_at || Date.parse(ilerleme.last_watched_at) < Date.parse(watchedAt)
      ? watchedAt : ilerleme.last_watched_at };
  const hesap = yenidenHesapla(kopya, simdi);
  if (typeof ilerleme.aired === 'number' && ilerleme.aired > (hesap.aired ?? 0)) {
    // Eksik katalogla 7/9'u 1/1'e dönüştürüp sahte %100/konfeti üretme.
    return { ...hesap, catalogIncomplete: true, aired: ilerleme.aired,
      completed: typeof ilerleme.completed === 'number'
        ? Math.min(ilerleme.aired, ilerleme.completed + yeniIsaret) : hesap.completed };
  }
  return hesap;
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
  let silinenTekrar = 0;

  const kopya: Ilerleme = {
    ...ilerleme,
    seasons: ilerleme.seasons.map((s) => ({
      ...s,
      episodes: (s.episodes || []).map((b) => {
        if (s.number !== seasonNumber || !(hepsi || hedef!.has(b.number))) return { ...b };
        silinenTekrar += Math.max(0, bolumIzlemeSayisi(b) - 1);
        return { ...b, completed: false, last_watched_at: null, plays: 0 };
      }),
    })),
  };
  Object.assign(kopya, tekrarYamasi(ilerleme, -silinenTekrar));
  return yenidenHesapla(kopya, simdi);
};

/**
 * 1.0.1 Dal 4 · Bölümün YALNIZ son izlemesini geri alır (3x → 2x). Tek izlemesi kalan bölümde
 * `bolumleriGeriAl` ile aynı sonuç (tik kalkar). Önceki izlemenin damgası yerelde bilinmediği için
 * `last_watched_at` sunucu turuna kadar eski hâliyle kalır (sayaçlar onu kullanmaz).
 */
export const sonIzlemeyiGeriAl = (
  ilerleme: Ilerleme | null | undefined,
  seasonNumber: number,
  episodeNumber: number,
  simdi: number = Date.now(),
): Ilerleme | null => {
  if (!ilerleme?.seasons?.length) return null;
  const b = ilerleme.seasons.find((s) => s.number === seasonNumber)?.episodes?.find((e) => e.number === episodeNumber);
  const plays = bolumIzlemeSayisi(b);
  if (plays <= 1) return bolumleriGeriAl(ilerleme, seasonNumber, [episodeNumber], simdi);
  return {
    ...ilerleme,
    ...tekrarYamasi(ilerleme, -1),
    seasons: ilerleme.seasons.map((s) => ({
      ...s,
      episodes: (s.episodes || []).map((e) =>
        s.number === seasonNumber && e.number === episodeNumber ? { ...e, plays: plays - 1 } : { ...e }),
    })),
  };
};
