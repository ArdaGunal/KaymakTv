// ==========================================================================
// DUYURULMUŞ BÖLÜM — dizi «bitti» mi, yoksa sıradaki bölümü mü bekleniyor? (SAF)
// ==========================================================================
// 2.6.8 KUTLAMA-01 (kullanıcı kararı 2026-11-06): dizinin duyurulmuş bir sonraki
// bölümü varsa (Yaklaşanlar'da) «dizi bitti» paneli hiç çıkmaz.
//
// 🔴 NEDEN `next_episode` YETMİYOR: Kaymak ilerlemesinde `next_episode` yalnız
// YAYINLANMIŞ bölümü gösterir (Worker `lib/ilerleme.js`). Haftalık dizide son
// yayınlanan bölüm işaretlenince `next_episode` null olur ve eskiden konfeti
// çıkıyordu — oysa gelecek hafta yeni bölüm var.
//
// Kaynaklar, Yaklaşanlar sekmesinin (`hooks/useDashboardData.ts`) kaynaklarıyla
// aynı: ilerlemedeki gelecek tarihli bölümler, takvim (`calendarShows`) ve
// emniyet turunun sezon haritası (`calendarSeasonsMap`).

interface Kaynaklar {
  progress?: any;
  calendarShows?: any[] | null;
  calendarSeasonsMap?: Record<string, any> | null;
}

const gelecekAn = (raw: unknown, now: number): number | null => {
  const t = raw ? new Date(raw as string).getTime() : NaN;
  return Number.isFinite(t) && t > now ? t : null;
};

/**
 * Dizinin duyurulmuş (gelecek tarihli) EN YAKIN bölümünün yayın anı (ms) ya da `null`.
 * BITIS-01: «Yeni bölüm X gün sonra» bu tarihten yazılır.
 */
export function duyurulanBolumAni(
  showId: number,
  { progress, calendarShows, calendarSeasonsMap }: Kaynaklar,
  now: number = Date.now(),
): number | null {
  const adaylar: Array<number | null> = [gelecekAn(progress?.next_episode?.first_aired, now)];
  // Kaymak biçimi: her bölüm `first_aired` taşır; özel sezon (0) sayılmaz.
  for (const sezon of progress?.seasons || []) {
    if (!sezon || sezon.number === 0) continue;
    for (const b of sezon.episodes || []) if (!b?.completed) adaylar.push(gelecekAn(b?.first_aired, now));
  }
  for (const k of calendarShows || []) if (k?.show?.ids?.trakt === showId) adaylar.push(gelecekAn(k?.first_aired, now));
  const sezonlar = calendarSeasonsMap?.[showId]?.data;
  if (Array.isArray(sezonlar)) {
    for (const s of sezonlar) for (const b of s?.episodes || []) adaylar.push(gelecekAn(b?.first_aired, now));
  }
  const gecerli = adaylar.filter((a): a is number => a !== null);
  return gecerli.length ? Math.min(...gecerli) : null;
}

export function duyurulmusBolumVarMi(showId: number, kaynaklar: Kaynaklar, now: number = Date.now()): boolean {
  return duyurulanBolumAni(showId, kaynaklar, now) !== null;
}
