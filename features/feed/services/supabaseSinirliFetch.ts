/**
 * HIZ-01 Paket 2 (M544) · HIZ-02 (M574) · supabase-js'in `fetch`i — okumaya yedek istek + toplam sınır.
 *
 * Ölçüm (2026-11-04, `docs/design/SUPABASE_LOG_RAPORU_2026-11-03.md` §00): takılma sorguda değil,
 * Cloudflare'in Supabase'e yeni bağlantı kurmasında. Takılan istek 1–12 sn sonra girebiliyor ya da
 * 19 sn'de 522 alıyor; yanına yollanan taze istek çoğu kez hemen dönüyor.
 *
 * KURAL (Worker `lib/supabaseFetch.js` ile aynı mantık):
 *   • Yalnız GET/HEAD (okuma). İlk istek kesilmez; 1 ve 5 sn'de yanına yedek gider, ilk geçerli
 *     cevap kazanır, gerisi iptal. Açık hata (522, ağ) uçan başka deneme yoksa hemen bir kez tekrarlanır.
 *   • Worker'ın 2,5 sn kademesi burada YOK: Android'de `fetch` gövde inince döner, yavaş mobil ağda her yedek
 *     aynı veriyi baştan indirir. Ölçülen 18 soğuk turda 2,5 sn'siz sonuç aynı (17/18, ort. 2,8 sn; eski kapı
 *     «6 sn + 1 tekrar» 15/18, ort. 4,8 sn), istek 2,6'dan 2,1'e iniyor.
 *   • Toplam sınırda vazgeçer. Mobil ağ Worker'dan yavaş olabilir: Worker'ın 8 sn'si yerine 10 sn.
 *   • POST/PATCH/DELETE (yazma, RPC) DOKUNULMAZ — ilk deneme işlenmiş olabilir.
 *   • Çağıranın kendi iptali (`.abortSignal()`) saygı görür: bütün denemeler iptal, tekrar yok.
 *
 * 🔴 Vazgeçişte `AbortError` fırlatılır: supabase-js ağ hatasını 3 kez daha dener, `AbortError`u denemez.
 * Süre zaten harcandı; ağ hatası gibi fırlatılsa toplam bekleme dakikaya yaklaşırdı.
 * Aynı anda uçan yedek sınırlı: Android'de OkHttp ana makine başına 5 eş zamanlı çağrıya izin veriyor,
 * yedekler sıradan okumaların yerini doldurmasın.
 *
 * ⚠️ Bağımlılıksız (yalnız `fetch`) — `supabaseClient.ts` açılış yolunda (bkz. oradaki not).
 */
export const OKUMA_SINIRI_MS = 10_000;
export const OKUMA_YEDEKLERI_MS: readonly number[] = [1000, 5000];
const EN_COK_UCUSTAKI_YEDEK = 3;
const GECICI_DURUMLAR = [502, 503, 504, 520, 521, 522, 523, 524];

type FetchFn = typeof fetch;

function yontemi(input: RequestInfo | URL, init?: RequestInit): string {
  const m = init?.method ?? (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET');
  return String(m || 'GET').toUpperCase();
}

function iptalHatasi(): Error {
  const hata = new Error('Aborted');
  hata.name = 'AbortError';
  return hata;
}

let ucustakiYedek = 0;

function yedekliOku(
  asil: FetchFn,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  sinirMs: number,
  yedeklerMs: readonly number[],
): Promise<Response> {
  return new Promise((coz, reddet) => {
    const cagiran = init?.signal;
    if (cagiran?.aborted) {
      reddet(iptalHatasi());
      return;
    }
    const denetciler: AbortController[] = [];
    const zamanlayicilar: ReturnType<typeof setTimeout>[] = [];
    let bitti = false;
    let acik = 0;
    let sonYanit: Response | null = null;
    let sonHata: unknown = null;

    const kapat = (kazanan: number) => {
      bitti = true;
      zamanlayicilar.forEach(clearTimeout);
      cagiran?.removeEventListener('abort', cagiraniDinle);
      denetciler.forEach((d, i) => {
        if (i !== kazanan) d.abort();
      });
      if (denetciler.length > 1) console.warn(`[supabase] okuma ${denetciler.length} deneme, kazanan ${kazanan + 1}`);
    };
    function cagiraniDinle() {
      if (bitti) return;
      kapat(-1);
      reddet(iptalHatasi());
    }
    const dene = (yedekMi: boolean) => {
      const sira = denetciler.length;
      const denetci = new AbortController();
      denetciler.push(denetci);
      acik += 1;
      if (yedekMi) ucustakiYedek += 1;
      Promise.resolve()
        .then(() => asil(input, { ...init, signal: denetci.signal }))
        .then((res) => {
          if (bitti) return;
          if (GECICI_DURUMLAR.includes(res.status)) {
            sonYanit = res;
            return;
          }
          kapat(sira);
          coz(res);
        })
        .catch((hata) => {
          sonHata = hata;
        })
        .finally(() => {
          acik -= 1;
          if (yedekMi) ucustakiYedek -= 1;
          if (bitti || acik > 0) return;
          if (denetciler.length === 1) {
            dene(true);
            return;
          }
          kapat(-1);
          if (sonYanit) coz(sonYanit);
          else reddet(sonHata);
        });
    };

    cagiran?.addEventListener('abort', cagiraniDinle);
    zamanlayicilar.push(setTimeout(() => {
      if (bitti) return;
      kapat(-1);
      if (sonYanit) coz(sonYanit);
      else reddet(iptalHatasi());
    }, sinirMs));
    for (const ms of yedeklerMs) {
      zamanlayicilar.push(setTimeout(() => {
        if (!bitti && ucustakiYedek < EN_COK_UCUSTAKI_YEDEK) dene(true);
      }, ms));
    }
    dene(false);
  });
}

/** `temel` verilmezse küresel `fetch`. Testte sahte `fetch`, kısa sınır ve kademe verilir. */
export function sinirliFetchKur(
  temel?: FetchFn,
  sinirMs = OKUMA_SINIRI_MS,
  yedeklerMs: readonly number[] = OKUMA_YEDEKLERI_MS,
): FetchFn {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const asil = temel ?? fetch;
    const yontem = yontemi(input, init);
    if (yontem !== 'GET' && yontem !== 'HEAD') return asil(input, init);
    return yedekliOku(asil, input, init, sinirMs, yedeklerMs);
  }) as FetchFn;
}
