import type { NotificationCategoryId, ScheduledPlan } from '../../types';

/**
 * Bölüm tabanlı planlayıcılar — "Bugün Yayında" ve "Sezon Prömiyeri".
 * (docs/design/notifications.md § 1)
 *
 * 🔴 SAF: yalnızca `import type`. `resolveFireTime` ve `renderCopy` parametre
 * olarak gelir (gerekçe: `scheduling/fireTime.ts` başlığı).
 *
 * ⚠️ İKİSİ NEDEN AYNI DOSYADA: saf modüllerde çalışma zamanı import'u yasak
 * olduğu için iki ayrı dosya ortak yardımcıyı PAYLAŞAMAZDI ve seçim mantığı
 * kopyalanırdı. Kopyalanan mantık ıraksar (AI_RULES §2.5). Tek dosya, tek
 * `planEpisodes` çekirdeği, iki ince sarmalayıcı.
 */

/** Planlayıcının ihtiyaç duyduğu MİNİMUM bölüm bilgisi. */
export interface UpcomingEpisode {
  showTitle: string;
  /**
   * 🔴 DİZİNİN Trakt kimliği — bölümünkiyle KARIŞTIRMA.
   *
   * Deep link için ZORUNLU ve bu alan sonradan eklendi: eskiden yalnızca
   * `episodeTraktId` taşınıyordu ve bağlantı `/episode/<bölüm id>` diye
   * kuruluyordu. `app/episode/[id].tsx` ise bir SLUG bekliyor
   * (`{diziId}-{diziSlug}-s{S}e{B}-{bölümId}`) ve çıplak bir sayıyı
   * ayrıştırınca **bölüm kimliğini DİZİ kimliği sanıyordu** → ekran
   * "içerik yüklenemedi" veriyordu (kullanıcı cihazda bildirdi).
   */
  showTraktId: number;
  /** Trakt dizi slug'ı; yoksa başlıktan üretilir (bkz. `buildEpisodeLink`). */
  showSlug: string | null;
  /** Trakt bölüm kimliği — `identifier` ve deep link bundan türer. */
  episodeTraktId: number;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  /** Trakt `first_aired` — UTC ISO 8601. */
  firstAiredUtc: string;
  /**
   * Kullanıcı bu bölümü ZATEN izlediyse bildirim kurulmaz.
   * Bu kontrol olmadan sistem yalancı çıkar: "yeni bölüm!" diye haber verdiği
   * bölümü kullanıcı dün gece izlemiştir.
   */
  alreadyWatched: boolean;
}

/**
 * Deep link üretimi için gereken alanlar.
 *
 * 🔴 NEDEN ENJEKSİYON, NEDEN `utils/slugHelper` DOĞRUDAN IMPORT EDİLMİYOR:
 * bu dosya SAF ve testler onu `.ts` uzantısıyla doğrudan yüklüyor; Node'un
 * tür soyma özelliği **uzantısız çalışma-zamanı import'larını çözemiyor**
 * (bu dosyanın "saf modüller birbirini import edemez" notuyla aynı kısıt).
 * Slug biçimini burada ELLE kurmak da olurdu ama o zaman biçim iki yerde
 * yaşardı ve biri değişince diğeri sessizce bozulurdu. `resolveFireTime` ve
 * `renderCopy` ile AYNI desen: kararı saf katman verir, üretimi adaptör.
 */
export interface EpisodeLinkVars {
  showTraktId: number;
  showSlug: string | null;
  showTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTraktId: number;
}

/** Metin havuzuna geçirilecek değişkenler. */
export interface EpisodeCopyVars {
  showTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
}

export interface EpisodePlannerOptions {
  now: number;
  /** Kaç günlük ufuk planlanacak (yuvarlanan pencere). */
  horizonDays: number;
  /** `scheduling/fireTime.ts` → `resolveFireTime`, saati bağlanmış halde. */
  resolveFireTime: (firstAiredUtc: string) => number | null;
  /** i18n + metin havuzu (`copy/picker.ts`). */
  renderCopy: (vars: EpisodeCopyVars) => { title: string; body: string };
  /** `utils/slugHelper.ts` → `generateEpisodeSlug`, bağlanmış halde. */
  buildEpisodeLink: (vars: EpisodeLinkVars) => string;
}

const GUN_MS = 24 * 60 * 60 * 1000;

function planEpisodes(
  episodes: readonly UpcomingEpisode[],
  options: EpisodePlannerOptions,
  categoryId: NotificationCategoryId,
  accepts: (episode: UpcomingEpisode) => boolean,
): ScheduledPlan[] {
  const { now, horizonDays, resolveFireTime, renderCopy, buildEpisodeLink } = options;
  const horizonEnd = now + horizonDays * GUN_MS;

  const plans: ScheduledPlan[] = [];
  // Trakt takvimi aynı bölümü birden fazla kez döndürebilir (çoklu ağ/bölge
  // kayıtları). Aynı `identifier` iki kez üretilirse `scheduler` fark
  // hesabında onu "değişmiş" sanıp gereksiz iş yapardı.
  const seen = new Set<number>();

  for (const episode of episodes) {
    if (episode.alreadyWatched) continue;
    if (!accepts(episode)) continue;
    if (seen.has(episode.episodeTraktId)) continue;

    const fireAt = resolveFireTime(episode.firstAiredUtc);
    // `null`: tarih bozuk ya da an geçmişte kalmış (bkz. fireTime.ts).
    if (fireAt === null) continue;
    if (fireAt > horizonEnd) continue;

    seen.add(episode.episodeTraktId);

    const { title, body } = renderCopy({
      showTitle: episode.showTitle,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      episodeTitle: episode.episodeTitle,
    });

    plans.push({
      // DETERMİNİSTİK: aynı bölüm için ikinci bir bildirim kurmak yapısal
      // olarak imkânsız (bkz. types.ts `ScheduledPlan.identifier`).
      identifier: `${categoryId}:${episode.episodeTraktId}`,
      categoryId,
      fireAt,
      title,
      body,
      data: {
        categoryId,
        entityId: String(episode.episodeTraktId),
        // 🔴 SLUG, çıplak kimlik DEĞİL. `app/episode/[id].tsx` parçalı bir
        // slug ayrıştırıyor; çıplak sayı verilince bölüm kimliğini DİZİ
        // kimliği sanıp "içerik yüklenemedi" veriyordu (`UpcomingEpisode`
        // başlığındaki gerekçe).
        deepLink: buildEpisodeLink({
          showTraktId: episode.showTraktId,
          showSlug: episode.showSlug,
          showTitle: episode.showTitle,
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          episodeTraktId: episode.episodeTraktId,
        }),
        plannedFireAt: fireAt,
      },
    });
  }

  return plans;
}

/** "Bugün Yayında" — takip edilen dizinin her yeni bölümü. */
export function planEpisodeToday(
  episodes: readonly UpcomingEpisode[],
  options: EpisodePlannerOptions,
): ScheduledPlan[] {
  return planEpisodes(episodes, options, 'episodeToday', () => true);
}

/**
 * "Sezon Prömiyeri" — yalnızca sezonun İLK bölümü.
 *
 * ⚠️ Bu bölümler `planEpisodeToday`'in de kapsamına girer; aynı bölüm için iki
 * bildirim kurulmasını `retention/dedupe.ts` engeller (prömiyer önceliği
 * daha yüksek olduğu için o kazanır).
 *
 * `seasonNumber > 0` kontrolü şart: Trakt'ta 0. sezon "Specials"tır ve her
 * special'ın 1. bölümü prömiyer sayılırdı — kullanıcıya sezon başlıyormuş
 * gibi yanlış haber giderdi.
 */
export function planSeasonPremiere(
  episodes: readonly UpcomingEpisode[],
  options: EpisodePlannerOptions,
): ScheduledPlan[] {
  return planEpisodes(
    episodes,
    options,
    'seasonPremiere',
    (episode) => episode.episodeNumber === 1 && episode.seasonNumber > 0,
  );
}
