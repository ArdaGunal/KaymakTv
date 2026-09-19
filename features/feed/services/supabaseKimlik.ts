/**
 * Supabase KİMLİK BELGESİ — §S1/§S2 · yol B (kullanıcı kararı, M402–M403).
 *
 * Uygulama Supabase Auth kullanmıyor; eskiden her istek aynı anon anahtarla
 * gidiyordu ve veritabanı izleyiciyi tanımıyordu. Worker artık doğrulanmış
 * kullanıcıya 1 saatlik bir belge veriyor (`POST /auth/supabase-token`,
 * `sub = users.id`). supabase-js bu fonksiyonu `accessToken` seçeneğiyle her
 * istekte (PostgREST + Realtime) çağırıyor → RLS `auth.uid()`'yi görüyor.
 *
 * 🔑 DÜŞERSE ÇÖKMEZ: belge alınamazsa `null` döner ve supabase-js anon
 * anahtara düşer (misafirle aynı görünürlük). Ağ/Worker arızası akışı BOŞ
 * gösterebilir ama uygulamayı kilitlemez.
 *
 * ⚠️ Bu modül açılış yolunda (`supabaseClient.ts` modül seviyesinde import
 * ediyor) — bilinçli olarak bağımlılıksız: yalnız `fetch`, `errorLog` yok
 * (bkz. `supabaseClient.ts`'teki 2026-08-30 açılış çökmesi notu).
 */

const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

// Belgenin bitişine bu kadar kala yenilenir — istek yolda süresi dolmasın.
const YENILEME_PAYI_SN = 120;
// Başarısız bir denemeden sonra bu süre boyunca yeniden denenmez (her istekte
// Worker'ı dövmesin); bu arada anon anahtar kullanılır.
const HATA_BEKLEMESI_MS = 60_000;

let kaynak: string | null = null;
let onbellek: { token: string; bitis: number } | null = null;
let sonHata = 0;
let yoldaki: Promise<string | null> | null = null;

/**
 * Kimlik değişince (giriş · çıkış · misafir · hesap değişimi) `AuthContext`
 * çağırır. `null` = belge isteme, anon kal (misafir/çıkış).
 */
export function supabaseKimlikKaynaginiAyarla(oturumTokeni: string | null): void {
  if (oturumTokeni === kaynak) return;
  kaynak = oturumTokeni;
  onbellek = null;
  sonHata = 0;
  yoldaki = null;
}

/** supabase-js `accessToken` geri çağrısı. `null` → anon anahtar. */
export async function supabaseErisimTokeni(): Promise<string | null> {
  if (!kaynak || !KAYMAK_WORKER_URL) return null;
  const simdi = Date.now() / 1000;
  if (onbellek && onbellek.bitis - simdi > YENILEME_PAYI_SN) return onbellek.token;
  if (Date.now() - sonHata < HATA_BEKLEMESI_MS) return null;
  if (yoldaki) return yoldaki;

  const istenen = kaynak;
  yoldaki = (async () => {
    try {
      const res = await fetch(`${KAYMAK_WORKER_URL}/auth/supabase-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traktAccessToken: istenen }),
      });
      const veri = await res.json().catch(() => null);
      if (!res.ok || !veri?.success || typeof veri.token !== 'string') {
        throw new Error(`supabase-token ${res.status} ${veri?.code ?? ''}`.trim());
      }
      // Yol üstündeyken kimlik değiştiyse bu belge ESKİ kişinindir — kullanma.
      if (kaynak !== istenen) return null;
      onbellek = { token: veri.token, bitis: Number(veri.expiresAt) || 0 };
      return veri.token as string;
    } catch (error) {
      sonHata = Date.now();
      console.warn('[supabaseKimlik] belge alınamadı, anon anahtara düşülüyor:', error);
      return null;
    } finally {
      yoldaki = null;
    }
  })();
  return yoldaki;
}
