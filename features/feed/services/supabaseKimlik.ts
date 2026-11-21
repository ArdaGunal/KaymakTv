/**
 * Supabase KİMLİK BELGESİ — §S1/§S2 · yol B (kullanıcı kararı, M402–M403).
 *
 * Uygulama Supabase Auth kullanmıyor; eskiden her istek aynı anon anahtarla
 * gidiyordu ve veritabanı izleyiciyi tanımıyordu. Worker artık doğrulanmış
 * kullanıcıya kısa ömürlü bir belge veriyor (`POST /auth/supabase-token`,
 * `sub = users.id`; ömür K-50 ile 60 dk → 15 dk → hedef 5 dk). supabase-js bu
 * fonksiyonu `accessToken` seçeneğiyle her istekte (PostgREST) ve Realtime'ın
 * her heartbeat'inde (25 sn) çağırıyor → RLS `auth.uid()`'yi görüyor.
 *
 * 🔑 DÜŞERSE ÇÖKMEZ: belge alınamazsa `null` döner ve supabase-js anon
 * anahtara düşer (misafirle aynı görünürlük). Ağ/Worker arızası akışı BOŞ
 * gösterebilir ama uygulamayı kilitlemez.
 *
 * 🔑 YENİLEME DÜŞERSE ELDEKİ BELGE KULLANILIR (ISCI-SUPABASE-ISTEMCI): belge
 * bitişe `YENILEME_PAYI_MS` kala yenilenir; yenileme düşerse (522, zaman
 * aşımı, 429, 5xx) belge GERÇEK bitişine kadar (`GUVENLIK_PAYI_MS` payıyla)
 * gönderilmeye devam eder — eskiden hemen `null` dönüp 60 sn anon kalıyordu.
 * İstisna: sunucu oturumu açıkça reddederse (401/403) belge bırakılır.
 * Zaman hesabı cihaz saatinden bağımsız: bkz. `utils/supabaseBelgeZamani.ts`.
 *
 * ⚠️ Bu modül açılış yolunda (`supabaseClient.ts` modül seviyesinde import
 * ediyor) — bilinçli olarak bağımlılıksız: yalnız `fetch` + importsuz saf
 * zaman yardımcısı, `errorLog` yok (bkz. `supabaseClient.ts`'teki 2026-08-30
 * açılış çökmesi notu).
 */

import {
  belgeDurumu,
  belgeOmruMs,
  gecenMs,
  geriCekilmeMs,
  kesinRetMi,
  type BelgeKaydi,
  type Saat,
} from '../utils/supabaseBelgeZamani';

const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

// HIZ-01 (M542): istek ESKİDEN SINIRSIZDI — supabase-js HER istekte (akış, sürüm kontrolü…) bu
// belgeyi beklediği için takılan tek bağlantı tüm Supabase okumalarını ~20 sn kilitliyordu.
// Sınır + geçici hatada (zaman aşımı / ağ / 502-524) bir kez daha.
// HIZ-02 (M574): Worker'ın kimlik okuması en çok 8 sn sürer; Worker'ın cevabını görecek kadar beklenir,
// yoksa onunla yarışıp boşuna ikinci istek atılırdı.
const ISTEK_SINIRI_MS = 10_000;
// 429 BİLİNÇLİ OLARAK yok: hız sınırında hemen ikinci istek sınırı uzatır.
const GECICI_DURUMLAR = [502, 503, 504, 522, 524];

class BelgeHatasi extends Error {
  /** HTTP durumu; ağ hatası / zaman aşımı → null. */
  durum: number | null;
  /** Hemen bir kez daha denemeye değer mi (ağ, 502-524). */
  gecici: boolean;
  constructor(mesaj: string, durum: number | null, gecici: boolean) {
    super(mesaj);
    this.durum = durum;
    this.gecici = gecici;
  }
}

function saatOku(): Saat {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  return { duvar: Date.now(), monoton: typeof perf?.now === 'function' ? perf.now() : null };
}

type AlinanBelge = { token: string; expiresAt: number; alis: Saat };

async function belgeIste(oturumTokeni: string): Promise<AlinanBelge> {
  // Alış anı İSTEĞİN BAŞI: belge sunucuda bu andan sonra basıldı → yolda geçen
  // süre ömürden düşülmüş olur (hata yönü: biraz erken yenilemek).
  const alis = saatOku();
  const denetci = new AbortController();
  const zamanlayici = setTimeout(() => denetci.abort(), ISTEK_SINIRI_MS);
  let res: Response;
  try {
    res = await fetch(`${KAYMAK_WORKER_URL}/auth/supabase-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traktAccessToken: oturumTokeni }),
      signal: denetci.signal,
    });
  } catch (error) {
    // Ağ hatası ya da sınır aşımı → geçici.
    throw new BelgeHatasi(`supabase-token ağ: ${(error as Error)?.message ?? error}`, null, true);
  } finally {
    clearTimeout(zamanlayici);
  }
  const veri = await res.json().catch(() => null);
  if (!res.ok || !veri?.success || typeof veri.token !== 'string') {
    const mesaj = `supabase-token ${res.status} ${veri?.code ?? ''}`.trim();
    throw new BelgeHatasi(mesaj, res.status, GECICI_DURUMLAR.includes(res.status));
  }
  return { token: veri.token, expiresAt: Number(veri.expiresAt) || 0, alis };
}

let kaynak: string | null = null;
let onbellek: BelgeKaydi | null = null;
// Son hata anı + o hatadan sonraki bekleme + kaçıncı ardışık hata.
let hata: { an: Saat; beklemeMs: number; ardisik: number } | null = null;
let yoldaki: Promise<string | null> | null = null;

/**
 * Kimlik değişince (giriş · çıkış · misafir · hesap değişimi) `AuthContext`
 * çağırır. `null` = belge isteme, anon kal (misafir/çıkış).
 */
export function supabaseKimlikKaynaginiAyarla(oturumTokeni: string | null): void {
  if (oturumTokeni === kaynak) return;
  kaynak = oturumTokeni;
  onbellek = null;
  hata = null;
  yoldaki = null;
}

/** Eldeki belge hâlâ gönderilebiliyorsa onu, değilse `null`. */
function kullanilabilirBelge(simdi: Saat): string | null {
  return onbellek && belgeDurumu(onbellek, simdi) !== 'dolmus' ? onbellek.token : null;
}

/** supabase-js `accessToken` geri çağrısı. `null` → anon anahtar. */
export async function supabaseErisimTokeni(): Promise<string | null> {
  if (!kaynak || !KAYMAK_WORKER_URL) return null;
  const simdi = saatOku();
  if (onbellek && belgeDurumu(onbellek, simdi) === 'taze') return onbellek.token;
  // Buradan sonrası: belge yok, yenilenmeli ya da dolmuş.
  const yedek = kullanilabilirBelge(simdi);
  if (hata && gecenMs(hata.an, simdi) < hata.beklemeMs) return yedek;
  // Yenileme zaten yolda: geçerli belge varsa isteği BEKLETME, onu ver.
  if (yoldaki) return yedek ?? yoldaki;

  const istenen = kaynak;
  // `let` + sonradan atama: `finally` bu sözü (await'ten sonra) kendisiyle karşılaştırır.
  let bu: Promise<string | null> | undefined;
  bu = (async () => {
    try {
      let veri: AlinanBelge;
      try {
        veri = await belgeIste(istenen);
      } catch (error) {
        if (!(error instanceof BelgeHatasi) || !error.gecici || kaynak !== istenen) throw error;
        veri = await belgeIste(istenen);
      }
      // Yol üstündeyken kimlik değiştiyse bu belge ESKİ kişinindir — kullanma.
      if (kaynak !== istenen) return null;
      onbellek = { token: veri.token, omurMs: belgeOmruMs(veri.token, veri.expiresAt, veri.alis.duvar), alis: veri.alis };
      hata = null;
      return veri.token;
    } catch (error) {
      if (kaynak !== istenen) return null;
      const durum = error instanceof BelgeHatasi ? error.durum : null;
      if (kesinRetMi(durum)) onbellek = null;
      const ardisik = (hata?.ardisik ?? 0) + 1;
      hata = { an: saatOku(), beklemeMs: geriCekilmeMs(ardisik, durum), ardisik };
      const eldeki = kullanilabilirBelge(saatOku());
      console.warn(
        eldeki
          ? '[supabaseKimlik] belge yenilenemedi, süresi dolmamış eldeki belge kullanılıyor:'
          : '[supabaseKimlik] belge alınamadı, anon anahtara düşülüyor:',
        error,
      );
      return eldeki;
    } finally {
      // Kimlik değişip yeni bir istek başladıysa onunkini silme.
      if (yoldaki === bu) yoldaki = null;
    }
  })();
  yoldaki = bu;
  return bu;
}
