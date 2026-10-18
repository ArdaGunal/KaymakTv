import * as SecureStore from '../../utils/secureStorage';

/**
 * M525 · Oturum bütünlüğü yardımcıları.
 *
 * (a) `oturumHalaBuMu` — arka plan turu başladığı token hâlâ cihazın oturumu mu? Çıkış ya da
 *     hesap geçişi sırasında SecureStore boşalır/değişir; eski token'la Trakt'a giden tur 401
 *     üretiyordu (`fetchers.syncHiddenLists.movies`). Okunamazsa `true` (eski davranış).
 * (b) `hesapGecersizBildir` / `onHesapGecersiz` — Worker bir KaymakTV oturum belgesine
 *     `invalid_token` derse (hesap silindi — ör. başka cihazda «Hesap Seç»), uygulama hayalet
 *     oturumda kalmasın: AuthContext tam çıkış yapar. Aynı anda gelen 401'ler tek çıkışa iner.
 * (f) M538 · `oturumKusagi` — çıkış/hesap silme anında ilerleyen sayaç. `oturumHalaBuMu` turun
 *     BAŞINDA bakar; istek yoldayken çıkış olursa geç gelen yanıt temizlenmiş diske yazıyordu
 *     (canlı: `@trakt_lib_calendarShows/Movies` = `[]` + hata günlüğü, D8 ihlali). Uzun süren iş
 *     kuşağı başta yakalar, her `await` sonrasında yazmadan önce karşılaştırır.
 */
export async function oturumHalaBuMu(token: string): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync('traktAccessToken')) === token;
  } catch {
    return true;
  }
}

let kusak = 0;
export const oturumKusagi = (): number => kusak;
/** Senkron — `removeKeys`in ilk satırı; ondan sonra çözülen eski istekler hiçbir şey yazmaz. */
export function oturumKusaginiIlerlet(): void { kusak++; }

type Dinleyici = () => void;
let dinleyiciler: Dinleyici[] = [];
let isleniyor = false;

export function onHesapGecersiz(d: Dinleyici): () => void {
  dinleyiciler.push(d);
  return () => { dinleyiciler = dinleyiciler.filter((x) => x !== d); };
}

/** Tek seferlik: çıkış sürerken gelen diğer 401'ler (ör. çıkışın kendi push silme isteği) yok sayılır. */
export function hesapGecersizBildir(): void {
  if (isleniyor) return;
  isleniyor = true;
  dinleyiciler.forEach((d) => {
    try { d(); } catch (e) { console.warn('[oturum] dinleyici hatası:', e); }
  });
  setTimeout(() => { isleniyor = false; }, 5000);
}
