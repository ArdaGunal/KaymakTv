const PAYLASIM_KOKENI = 'https://kaymaktv.com';
const MEDYA_YOLU = /^([1-9]\d*)(?:-[a-z0-9_-]+)?$/i;
const BOLUM_YOLU = /^([1-9]\d*)-[a-z0-9_-]*-s(\d+)e(\d+)-([1-9]\d*)$/i;
const AKIS_KIMLIGI = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const KAYMAK_NO = /^[1-9]\d{7}$/;

export type PaylasimHedefi =
  | { tur: 'show' | 'movie'; id: number }
  | { tur: 'season'; id: number; season: number }
  | { tur: 'episode' | 'activity'; id: string }
  | { tur: 'u'; id: number | null | undefined };

function pozitifKimlik(id: number): boolean {
  return Number.isSafeInteger(id) && id > 0;
}

function bolumYoluGecerli(id: string): boolean {
  const eslesme = BOLUM_YOLU.exec(id);
  return eslesme !== null && eslesme.slice(1).every((parca) => Number.isSafeInteger(Number(parca)));
}

export function paylasimSezonunuAyristir(deger: string | string[] | undefined): number | null {
  if (typeof deger !== 'string' || !/^(0|[1-9]\d*)$/.test(deger)) return null;
  const sezon = Number(deger);
  return Number.isSafeInteger(sezon) ? sezon : null;
}

export function paylasimUrl(hedef: PaylasimHedefi): string | null {
  const { tur, id } = hedef;
  switch (tur) {
    case 'show':
    case 'movie':
      return pozitifKimlik(id) ? `${PAYLASIM_KOKENI}/${tur}/${id}` : null;
    case 'season':
      return pozitifKimlik(hedef.id) && Number.isSafeInteger(hedef.season) && hedef.season >= 0
        ? `${PAYLASIM_KOKENI}/show/${hedef.id}?season=${hedef.season}`
        : null;
    case 'episode':
      return bolumYoluGecerli(id) ? `${PAYLASIM_KOKENI}/episode/${id}` : null;
    case 'activity':
      return AKIS_KIMLIGI.test(id) ? `${PAYLASIM_KOKENI}/activity/${id.toLowerCase()}` : null;
    case 'u':
      return typeof id === 'number' && KAYMAK_NO.test(String(id)) ? `${PAYLASIM_KOKENI}/u/${id}` : null;
  }
}

/** Eski URL ipuçları ekranlarda okunur. Paylaşım hedefi yalnız kimliği ve sezonu taşır. */
export function paylasimUrlAyristir(deger: string): PaylasimHedefi | null {
  let url: URL;
  try {
    url = new URL(deger);
  } catch {
    return null;
  }
  if (url.origin !== PAYLASIM_KOKENI || url.username || url.password) return null;

  const yol = /^\/(show|movie|episode|activity|u)\/([^/]+)\/?$/.exec(url.pathname);
  if (!yol) return null;
  const [, tur, id] = yol;
  if (tur === 'episode') return bolumYoluGecerli(id) ? { tur, id } : null;
  if (tur === 'activity') return AKIS_KIMLIGI.test(id) ? { tur, id: id.toLowerCase() } : null;
  if (tur === 'u') return KAYMAK_NO.test(id) ? { tur, id: Number(id) } : null;

  const medyaId = Number(MEDYA_YOLU.exec(id)?.[1]);
  if (!pozitifKimlik(medyaId)) return null;
  if (tur === 'movie') return { tur, id: medyaId };
  const sezonlar = url.searchParams.getAll('season');
  const sezon = paylasimSezonunuAyristir(sezonlar.length === 1 ? sezonlar[0] : undefined);
  return sezon === null ? { tur: 'show', id: medyaId } : { tur: 'season', id: medyaId, season: sezon };
}
