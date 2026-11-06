import { create } from 'zustand';
import { LayoutAnimation, Platform, UIManager } from 'react-native';
import { useLibraryStore } from './useLibraryStore';

/**
 * Bitiş anı (2.6.8 BITIS-01). Dizi ya da film bitince araya pencere girmez:
 * kart listede YERİNDE mavi «bitti» görünümüne döner, birkaç saniye kalır,
 * sonra kendi kategorisine (Güncel / İzlenenler) kayar.
 *
 * Bu depo yalnız «hangi kart şu an bitiş anında» bilgisini tutar; listeler
 * (`categorizeShows`, `useMoviesDashboardData`) buna bakıp kartı tutar.
 * Kayıt kendiliğinden silinir; puanlama penceresi açıkken süre durur.
 */

export type BitisTuru = 'show' | 'movie';

export interface BitisKaydi {
  /** Kartın bırakılacağı an; `null` = puanlama açık, süre durdu. */
  bitis: number | null;
  /** Film: iyimser yazımla listeden düşen ham izleme listesi kaydı ve sırası. */
  ham?: any;
  sira?: number;
}

/** Okumaya ve «Puanla»ya yetecek, beklemeyi hissettirmeyecek kadar. */
export const BITIS_TUTMA_MS = 8000;
/** Puan verildikten / pencere kapandıktan sonra kartın kalma süresi. */
export const PUAN_SONRASI_MS = 1500;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Kartın listeden çıkışı yumuşak olsun (yalnız opaklık — Android'de kararlı).
const CIKIS_ANIMASYONU = {
  duration: 260,
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

const anahtar = (tur: BitisTuru, id: number) => `${tur}:${id}`;
const zamanlayicilar = new Map<string, ReturnType<typeof setTimeout>>();

interface BitisAniDurumu {
  kayitlar: Record<string, BitisKaydi>;
  bitir: (tur: BitisTuru, id: number) => void;
  duraklat: (tur: BitisTuru, id: number) => void;
  devam: (tur: BitisTuru, id: number, ms?: number) => void;
  birak: (tur: BitisTuru, id: number) => void;
}

export const useBitisAniStore = create<BitisAniDurumu>((set, get) => {
  const zamanla = (k: string, ms: number) => {
    clearTimeout(zamanlayicilar.get(k));
    zamanlayicilar.set(k, setTimeout(() => sil(k, true), ms));
  };
  const sil = (k: string, animasyonlu: boolean) => {
    clearTimeout(zamanlayicilar.get(k));
    zamanlayicilar.delete(k);
    if (!get().kayitlar[k]) return;
    if (animasyonlu && Platform.OS !== 'web') LayoutAnimation.configureNext(CIKIS_ANIMASYONU);
    const { [k]: _, ...kalan } = get().kayitlar;
    set({ kayitlar: kalan });
  };

  return {
    kayitlar: {},
    bitir: (tur, id) => {
      const k = anahtar(tur, id);
      const kayit: BitisKaydi = { bitis: Date.now() + BITIS_TUTMA_MS };
      // Film: iyimser yazım kaydı izleme listesinden HEMEN siler; kart yerinde
      // kalsın diye kaydı ve sırasını yazımdan ÖNCE saklarız.
      if (tur === 'movie') {
        const liste = useLibraryStore.getState().watchlistMovies || [];
        const sira = liste.findIndex((o: any) => o?.movie?.ids?.trakt === id);
        if (sira >= 0) Object.assign(kayit, { ham: liste[sira], sira });
      }
      set({ kayitlar: { ...get().kayitlar, [k]: kayit } });
      zamanla(k, BITIS_TUTMA_MS);
    },
    duraklat: (tur, id) => {
      const k = anahtar(tur, id);
      const kayit = get().kayitlar[k];
      if (!kayit) return;
      clearTimeout(zamanlayicilar.get(k));
      zamanlayicilar.delete(k);
      set({ kayitlar: { ...get().kayitlar, [k]: { ...kayit, bitis: null } } });
    },
    devam: (tur, id, ms = PUAN_SONRASI_MS) => {
      const k = anahtar(tur, id);
      const kayit = get().kayitlar[k];
      if (!kayit) return;
      set({ kayitlar: { ...get().kayitlar, [k]: { ...kayit, bitis: Date.now() + ms } } });
      zamanla(k, ms);
    },
    birak: (tur, id) => sil(anahtar(tur, id), false),
  };
});

/** Bu türden bitiş anındaki kimlikler (liste hesapları için). */
export function bitenKimlikler(kayitlar: Record<string, BitisKaydi>, tur: BitisTuru): Set<number> {
  const onek = `${tur}:`;
  const s = new Set<number>();
  for (const k of Object.keys(kayitlar)) if (k.startsWith(onek)) s.add(Number(k.slice(onek.length)));
  return s;
}

/** Film: listeden düşmüş ama bitiş anında tutulan ham kayıtlar (geri koymak için). */
export function tutulanFilmler(kayitlar: Record<string, BitisKaydi>): Array<{ id: number; ham: any; sira: number }> {
  const sonuc: Array<{ id: number; ham: any; sira: number }> = [];
  for (const [k, v] of Object.entries(kayitlar)) {
    if (k.startsWith('movie:') && v.ham) sonuc.push({ id: Number(k.slice(6)), ham: v.ham, sira: v.sira ?? 0 });
  }
  return sonuc;
}
