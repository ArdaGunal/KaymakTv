import type { FeedActivity } from '../types';
import { MARATHON_GAP_MS, MARATHON_MIN_COUNT } from './groupMarathonActivities';

/**
 * C5 / A-7 · Yüklü listenin SONUNDA (sayfa sınırında) süren bir maraton var mı?
 *
 * Maraton = aynı kişinin aynı dizideki bölümleri, ardışık iki bölüm arası < 24 sa
 * (`groupMarathonActivities` ile AYNI kural). Sayfa 40 satırda kesilince zincirin
 * eski ucu bir sonraki sayfada kalıyordu → kart önce «×37», sonraki sayfa gelince
 * «×47» oluyordu (cihazda görüldü). Bu fonksiyon, zaten maraton olan (≥3 farklı
 * bölüm) bir zincirin en eski satırı sınıra 24 saatten yakınsa true döner — yani
 * yüklenmemiş satırlarla büyüyebilir.
 */
export function marathonSayfaSinirinda(activities: FeedActivity[]): boolean {
  const zaman = (a: FeedActivity) => {
    const ms = new Date(a.activityAt).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  };
  if (activities.length === 0) return false;
  const sinir = Math.min(...activities.map(zaman));

  const anahtarlar = new Map<string, FeedActivity[]>();
  for (const a of activities) {
    if (a.activityType !== 'watched_episode' || !a.episodeNumber || a.showId == null) continue;
    const k = `${a.user.id}-${a.showId}`;
    (anahtarlar.get(k) ?? anahtarlar.set(k, []).get(k)!).push(a);
  }

  for (const satirlar of anahtarlar.values()) {
    satirlar.sort((x, y) => zaman(y) - zaman(x));
    // En ESKİ zinciri bul: sondan geriye, boşluk < 24 sa sürdükçe.
    const zincir = [satirlar[satirlar.length - 1]];
    for (let i = satirlar.length - 2; i >= 0; i--) {
      if (zaman(satirlar[i]) - zaman(zincir[zincir.length - 1]) >= MARATHON_GAP_MS) break;
      zincir.push(satirlar[i]);
    }
    const farkli = new Set(zincir.map((a) => a.episodeNumber)).size;
    if (farkli >= MARATHON_MIN_COUNT && zaman(zincir[0]) - sinir < MARATHON_GAP_MS) return true;
  }
  return false;
}
