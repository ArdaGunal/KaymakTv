// M461 · Tek uçuş (single-flight): AYNI ANDA gelen özdeş çağrılar tek ağ
// isteğini paylaşır. ÖNBELLEK DEĞİL — istek bitince (başarı ya da hata) kayıt
// silinir, sonraki çağrı yine taze ister. Tazelik davranışı değişmez; yalnız
// eşzamanlı kopyalar birleşir (profilin ilk açılışında `profile/get` 2× ve
// `social/graph` 3× gidiyordu — YAYIN_ONCESI_TEST H3).
export function tekUcus<A extends unknown[], R>(
  anahtar: (...args: A) => string,
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  const ucan = new Map<string, Promise<R>>();
  return (...args: A) => {
    const k = anahtar(...args);
    const mevcut = ucan.get(k);
    if (mevcut) return mevcut;
    const yeni = fn(...args).finally(() => {
      if (ucan.get(k) === yeni) ucan.delete(k);
    });
    ucan.set(k, yeni);
    return yeni;
  };
}
