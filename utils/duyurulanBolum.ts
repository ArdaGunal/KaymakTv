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

const gelecekte = (raw: unknown, now: number) => {
  const t = raw ? new Date(raw as string).getTime() : NaN;
  return Number.isFinite(t) && t > now;
};

export function duyurulmusBolumVarMi(
  showId: number,
  { progress, calendarShows, calendarSeasonsMap }: Kaynaklar,
  now: number = Date.now(),
): boolean {
  // Trakt biçimi (emniyet turu): sıradaki bölüm tarihiyle gelir.
  if (gelecekte(progress?.next_episode?.first_aired, now)) return true;
  // Kaymak biçimi: her bölüm `first_aired` taşır; özel sezon (0) sayılmaz.
  for (const sezon of progress?.seasons || []) {
    if (!sezon || sezon.number === 0) continue;
    if ((sezon.episodes || []).some((b: any) => !b?.completed && gelecekte(b?.first_aired, now))) return true;
  }
  if ((calendarShows || []).some((k: any) => k?.show?.ids?.trakt === showId && gelecekte(k?.first_aired, now))) return true;
  const sezonlar = calendarSeasonsMap?.[showId]?.data;
  return Array.isArray(sezonlar)
    && sezonlar.some((s: any) => (s?.episodes || []).some((b: any) => gelecekte(b?.first_aired, now)));
}
