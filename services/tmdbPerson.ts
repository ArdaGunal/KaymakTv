import i18n from '../locales/index';
import { fetchFromTmdb } from './tmdbApi';

/**
 * 2.6.5 madde 9 · Oyuncu bilgisi — TMDB `/person/{id}` (proxy üzerinden, anahtar
 * sunucuda). Kullanıcı: «uygulama dışına çıkmasın» — veri burada, gösterim
 * `components/person/PersonSheet.tsx`'te. Ekranda TMDB atfı zorunlu (o bileşende).
 */
export interface TmdbPerson {
  id: number;
  name: string;
  biography: string;
  profilePath: string | null;
}

// Oturum boyu bellek önbelleği: aynı oyuncuya ikinci dokunuş ağa çıkmaz.
const onbellek = new Map<string, TmdbPerson>();

const sekillendir = (d: any): TmdbPerson => ({
  id: Number(d?.id),
  name: typeof d?.name === 'string' ? d.name : '',
  biography: typeof d?.biography === 'string' ? d.biography.trim() : '',
  profilePath: typeof d?.profile_path === 'string' ? d.profile_path : null,
});

/** Biyografi uygulama dilinde; TMDB'de o dilde yoksa İngilizcesi. Hata fırlatır. */
export async function getTmdbPerson(personId: number): Promise<TmdbPerson> {
  const dil = i18n.language === 'tr' ? 'tr-TR' : 'en-US';
  const anahtar = `${personId}_${dil}`;
  const kayitli = onbellek.get(anahtar);
  if (kayitli) return kayitli;

  let kisi = sekillendir((await fetchFromTmdb(`/person/${personId}`, { language: dil })).data);
  if (!kisi.biography && dil !== 'en-US') {
    try {
      const en = sekillendir((await fetchFromTmdb(`/person/${personId}`, { language: 'en-US' })).data);
      if (en.biography) kisi = { ...kisi, biography: en.biography };
    } catch {
      // İngilizce yedek dekoratif — düşerse boş biyografi metni gösterilir.
    }
  }
  onbellek.set(anahtar, kisi);
  return kisi;
}

/** Pencere için büyük profil fotoğrafı (kart `getPersonPhoto` küçük kırpımı kullanır). */
export const getPersonProfileLarge = (profilePath: string | null): string | null =>
  profilePath ? `https://image.tmdb.org/t/p/h632${profilePath}` : null;
