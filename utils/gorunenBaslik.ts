// ==========================================================================
// GÖRÜNEN BAŞLIK — ekranda hangi ad yazar? (BASLIK · 2.6.8, Akıllı Mod)
// ==========================================================================
// Karar kaydı: `docs/testler/2.6.8.md` §0. Kural dilden bağımsız: yapımın özgün dili uygulama diliyse
// yapımın KENDİ adı (Çekiç ve Gül), değilse uluslararası ad (Game of Thrones). Yeni dil = `diller.json`.
// Veri ham kalır (`title` hep Trakt'ın adı); ad, gösterirken çözülür, dil değişince ekran doğru kalır.
// SAF — React Native bağımlılığı yok.

import { dilBilgisi, dilKodu, yerelEtiket } from '../locales/diller';
import { ayniAlfabe, baslikEsit } from '../locales/baslikElemesi.js';

export type BaslikliYapim = {
  title?: string | null;
  language?: string | null;
  original_title?: string | null;
  titles?: Record<string, string> | null;
};

export function gorunenBaslik(oge: BaslikliYapim | null | undefined, dil: string | null | undefined): string {
  const ad = oge?.title ?? '';
  if (!oge) return ad;
  const kod = dilKodu(dil);
  const ceviri = oge.titles?.[kod];
  if (oge.language === kod) return ceviri || oge.original_title || ad;
  return (dilBilgisi(kod).yabanciBaslik === 'ceviri' && ceviri) || ad;
}

/** Karttaki büyük harfli ad: dile duyarlı («ÇEKIÇ» değil «ÇEKİÇ»). */
export function buyukBaslik(oge: BaslikliYapim | null | undefined, dil: string | null | undefined, yedek = ''): string {
  return (gorunenBaslik(oge, dil) || yedek).toLocaleUpperCase(yerelEtiket(dil));
}

/**
 * Detaydaki ikinci satır (§0 madde 3). Yapımın dili uygulama diliyse yok. Yabancıda önce çeviri
 * (etiketsiz); yoksa aynı alfabeyle yazılmış özgün ad (`ozgunMu`, ekran «Özgün ad:» etiketi koyar).
 */
export function ikincilBaslik(
  oge: BaslikliYapim | null | undefined,
  dil: string | null | undefined
): { metin: string; ozgunMu: boolean } | null {
  if (!oge) return null;
  const kod = dilKodu(dil);
  if (oge.language === kod) return null;
  const ana = gorunenBaslik(oge, kod);
  const ceviri = oge.titles?.[kod];
  if (ceviri && !baslikEsit(ceviri, ana)) return { metin: ceviri, ozgunMu: false };
  const ozgun = oge.original_title;
  if (ozgun && !baslikEsit(ozgun, ana) && ayniAlfabe(ozgun, dilBilgisi(kod).alfabe)) {
    return { metin: ozgun, ozgunMu: true };
  }
  return null;
}
