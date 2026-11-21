// E-posta bağlantısı dönüşü yeni sekmede açabilir. State ve verifier aynı kökende paylaşılır.
const ANAHTAR = '@kaymak_trakt_oauth_pkce_v1';
const STATE_OMRU_MS = 10 * 60 * 1000;
const STATE_TAVANI = 3;

type Kayit = { state: string; verifier: string; zaman: number };

function kayitlariOku(simdi: number): Kayit[] {
  const ham = window.localStorage.getItem(ANAHTAR);
  if (!ham) return [];
  let liste: unknown;
  try {
    liste = JSON.parse(ham);
  } catch {
    return [];
  }
  if (!Array.isArray(liste)) return [];
  return liste.filter((k) =>
    typeof k?.state === 'string' && k.state.length >= 8 &&
    typeof k.verifier === 'string' && /^[A-Za-z0-9._~-]{43,128}$/.test(k.verifier) &&
    typeof k.zaman === 'number' && simdi - k.zaman >= 0 && simdi - k.zaman < STATE_OMRU_MS);
}

async function depodaIslem<T>(islem: () => T): Promise<T> {
  // Eşzamanlı dönüşlerde iki sekmenin aynı kaydı okumasını önle. Eski
  // tarayıcılarda OAuth yetki kodunun tek kullanımlılığı Trakt'ta uygulanır.
  const kilitler = window.navigator?.locks;
  return kilitler ? kilitler.request(ANAHTAR, islem) : islem();
}

export function oauthStateKaydet(state: string, verifier: string, simdi?: number): Promise<void> {
  return depodaIslem(() => {
    const zaman = simdi ?? Date.now();
    const liste = kayitlariOku(zaman).filter((k) => k.state !== state);
    liste.push({ state, verifier, zaman });
    window.localStorage.setItem(ANAHTAR, JSON.stringify(liste.slice(-STATE_TAVANI)));
  });
}

/** Eşleşen kaydı tek seferde tüketir ve yalnız o isteğin verifier'ını döndürür. */
export async function oauthStateTuket(state: string | null, simdi?: number): Promise<string | null> {
  if (!state) return null;
  return depodaIslem(() => {
    const liste = kayitlariOku(simdi ?? Date.now());
    const eslesen = liste.find((k) => k.state === state);
    const kalan = liste.filter((k) => k.state !== state);
    if (kalan.length) window.localStorage.setItem(ANAHTAR, JSON.stringify(kalan));
    else window.localStorage.removeItem(ANAHTAR);
    return eslesen?.verifier ?? null;
  });
}
