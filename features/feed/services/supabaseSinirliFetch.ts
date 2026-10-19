/**
 * HIZ-01 Paket 2 (M544) · supabase-js'in `fetch`i — okumaya zaman sınırı + tek yeniden deneme.
 *
 * Canlı ölçüm (2026-10-19, AG test APK, eski sürüm): uygulamanın Supabase'e DOĞRUDAN giden
 * `app_settings` okuması **522 / 20,8 sn** (Supabase'in kenarı kendi sunucusuna bağlanamadı) —
 * Worker'da görülen takılmanın AYNISI istemci yolunda. Akış, bildirimler, profiller de bu
 * istemciden okuyor ve supabase-js'in varsayılan `fetch`inde sınır YOK.
 *
 * KURAL (Worker `supabaseFetch` ile aynı mantık, M542):
 *   • Yalnız GET/HEAD (okuma) — 6 sn'de kesilir; zaman aşımı / ağ hatası / 502-503-504-520…524'te
 *     BİR KEZ taze denenir. Mobil ağ Worker'dan yavaş olabilir: Worker'ın 3 sn'si yerine 6 sn.
 *   • POST/PATCH/DELETE (yazma, RPC) DOKUNULMAZ — ilk deneme işlenmiş olabilir.
 *   • Çağıranın kendi iptali (`.abortSignal()`) saygı görür: iptal edilen istek tekrarlanmaz.
 *
 * ⚠️ Bağımlılıksız (yalnız `fetch`) — `supabaseClient.ts` açılış yolunda (bkz. oradaki not).
 */
export const OKUMA_SINIRI_MS = 6000;
const GECICI_DURUMLAR = [502, 503, 504, 520, 521, 522, 523, 524];

type FetchFn = typeof fetch;

function yontemi(input: RequestInfo | URL, init?: RequestInit): string {
  const m = init?.method ?? (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET');
  return String(m || 'GET').toUpperCase();
}

async function tekDene(
  temel: FetchFn,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  sinirMs: number,
): Promise<{ res?: Response; hata?: unknown; cagiranIptal: boolean }> {
  const denetci = new AbortController();
  const cagiran = init?.signal;
  let cagiranIptal = false;
  const cagiraniDinle = () => {
    cagiranIptal = true;
    denetci.abort();
  };
  if (cagiran) {
    if (cagiran.aborted) return { hata: new Error('Aborted'), cagiranIptal: true };
    cagiran.addEventListener('abort', cagiraniDinle);
  }
  const zamanlayici = setTimeout(() => denetci.abort(), sinirMs);
  try {
    return { res: await temel(input, { ...init, signal: denetci.signal }), cagiranIptal };
  } catch (hata) {
    return { hata, cagiranIptal };
  } finally {
    clearTimeout(zamanlayici);
    cagiran?.removeEventListener('abort', cagiraniDinle);
  }
}

/** `temel` verilmezse küresel `fetch`. Testte sahte `fetch` ve kısa sınır verilir. */
export function sinirliFetchKur(temel?: FetchFn, sinirMs = OKUMA_SINIRI_MS): FetchFn {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const asil = temel ?? fetch;
    const yontem = yontemi(input, init);
    if (yontem !== 'GET' && yontem !== 'HEAD') return asil(input, init);

    const ilk = await tekDene(asil, input, init, sinirMs);
    const ilkGecici = !ilk.res || GECICI_DURUMLAR.includes(ilk.res.status);
    if (!ilkGecici || ilk.cagiranIptal) {
      if (ilk.hata) throw ilk.hata;
      return ilk.res!;
    }
    console.warn(`[supabase] okuma ${ilk.res ? ilk.res.status : 'zaman_asimi/ag'} → bir kez daha`);
    const ikinci = await tekDene(asil, input, init, sinirMs);
    if (ikinci.hata) throw ikinci.hata;
    return ikinci.res!;
  }) as FetchFn;
}
