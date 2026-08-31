import type { ScheduledPlan } from '../../types';
import type { ResumeCandidate } from '../mapProgress';

/**
 * "Kaldığın Yerden Devam" planlayıcısı (docs/design/notifications.md § 13).
 *
 * 🔴 BU KATEGORİ, SİSTEMİN EN KOLAY RAHATSIZ EDEN PARÇASI. Kullanıcının açık
 * talebi: *"bunun rahatsız edici olmasını istemiyorum, arada bir uygulamaya
 * uzun süre girmiyorsa yapılabilir."* Üç koruma birlikte çalışır:
 *   1. Varsayılan KAPALI (`registry.ts`) — kullanıcı isterse açar
 *   2. En az `awayDays` gün uygulamaya girilmemiş olmalı
 *   3. İki dürtme arasında en az `cooldownDays` gün
 *
 * 🔑 "UYGULAMAYA GİRMEDİ" KONTROLÜ NASIL ÇALIŞIYOR — burada bir tarih
 * karşılaştırması YOK, ve olmasına gerek de yok:
 * planlama HER uygulama açılışında yeniden yapılıyor ve dürtme her seferinde
 * "şu andan `awayDays` gün sonra"ya kuruluyor. Kullanıcı uygulamayı açtıkça
 * bildirim sürekli ileri itiliyor; ancak GERÇEKTEN o kadar süre girmezse
 * düşüyor. Yani koşul, mekanizmanın kendisinden doğuyor.
 *
 * 🔴 SAF: yalnızca `import type`.
 */

export interface ContinueWatchingCopyVars {
  showTitle: string;
  seasonNumber: number;
  episodeNumber: number;
}

export interface ContinueWatchingOptions {
  now: number;
  /** Kaç gün uygulamaya girilmezse dürtülür. */
  awayDays: number;
  /** İki dürtme arasındaki en kısa süre (gün). */
  cooldownDays: number;
  /** Son dürtmenin DÜŞTÜĞÜ an; hiç düşmediyse `null`. */
  lastNudgeFiredAt: number | null;
  /** `scheduling/fireTime.ts` → `snapToPreferredHour`, saati bağlanmış halde. */
  snapToPreferredHour: (targetMs: number) => number;
  renderCopy: (vars: ContinueWatchingCopyVars) => { title: string; body: string };
}

const GUN_MS = 24 * 60 * 60 * 1000;

export function planContinueWatching(
  candidate: ResumeCandidate | null,
  options: ContinueWatchingOptions,
): ScheduledPlan[] {
  if (!candidate) return [];

  const { now, awayDays, cooldownDays, lastNudgeFiredAt, snapToPreferredHour, renderCopy } = options;

  let earliest = now + awayDays * GUN_MS;

  // Soğuma penceresi: son dürtmeden bu yana yeterli zaman geçmediyse, dürtmeyi
  // pencere dolana kadar ötele. Kullanıcı 7 günde bir uygulamaya girip
  // çıkıyorsa her hafta dürtülmemeli.
  if (lastNudgeFiredAt !== null && Number.isFinite(lastNudgeFiredAt)) {
    const cooldownEnd = lastNudgeFiredAt + cooldownDays * GUN_MS;
    if (cooldownEnd > earliest) earliest = cooldownEnd;
  }

  const fireAt = snapToPreferredHour(earliest);
  if (!Number.isFinite(fireAt)) return [];

  const { title, body } = renderCopy({
    showTitle: candidate.showTitle,
    seasonNumber: candidate.seasonNumber,
    episodeNumber: candidate.episodeNumber,
  });

  // Dizi kimliğine bağlı DETERMİNİSTİK kimlik: kullanıcı başka bir diziye
  // geçtiğinde eski dürtme `scheduler`'ın fark hesabında kendiliğinden iptal
  // olur, aynı dizi için ikinci bir dürtme kurulamaz.
  const identifier = `continueWatching:${candidate.showTraktId}`;

  return [
    {
      identifier,
      categoryId: 'continueWatching',
      fireAt,
      title,
      body,
      data: {
        categoryId: 'continueWatching',
        entityId: String(candidate.showTraktId),
        // Sıradaki bölüm biliniyorsa doğrudan oraya; bilinmiyorsa dizi
        // sayfasına. Yarım bilgiyle kırık bir bağlantı üretmiyoruz.
        deepLink:
          candidate.nextEpisodeTraktId !== null
            ? `/episode/${candidate.nextEpisodeTraktId}`
            : `/show/${candidate.showTraktId}`,
        plannedFireAt: fireAt,
      },
    },
  ];
}
