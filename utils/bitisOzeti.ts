/**
 * Bitiş anı (2.6.8 BITIS-01) — saf hesaplar. Kart yerinde mavi «bitti»
 * görünümüne dönerken altına yazılan kısa özet: «10 bölüm · 9 sa · 6 günde».
 * Veri yalnız eldeki kütüphane kaydından gelir; ağ isteği yok.
 */

export interface BitisOzeti {
  bolum: number | null;
  dakika: number | null;
  /** Kaç takvim gününde bitirildi; toplu işaretlemede `null` (yalan söylemez). */
  gun: number | null;
}

const GUN_MS = 24 * 60 * 60 * 1000;
// Bütün bölümler bu aralıkta işaretlendiyse «izlendi» değil «toplu işaretlendi»
// demektir (sezonu işaretle / öncekileri de işaretle): «1 günde» yazılmaz.
const TOPLU_ESIK_MS = 10 * 60 * 1000;

const gunBasi = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function diziBitisOzeti(progress: any, bolumSuresiDk?: number | null): BitisOzeti {
  const bolum = typeof progress?.completed === 'number' && progress.completed > 0 ? progress.completed : null;
  const izlenen = Number(progress?.watched_minutes);
  const dakika = izlenen > 0
    ? Math.round(izlenen)
    : (bolum && bolumSuresiDk && bolumSuresiDk > 0 ? bolum * bolumSuresiDk : null);

  const anlar: number[] = [];
  for (const sezon of progress?.seasons || []) {
    if (!sezon || sezon.number === 0) continue;
    for (const b of sezon.episodes || []) {
      const ms = b?.completed && b.last_watched_at ? Date.parse(b.last_watched_at) : NaN;
      if (Number.isFinite(ms)) anlar.push(ms);
    }
  }
  let gun: number | null = null;
  if (anlar.length >= 2) {
    const ilk = Math.min(...anlar);
    const son = Math.max(...anlar);
    if (son - ilk >= TOPLU_ESIK_MS) gun = Math.round((gunBasi(son) - gunBasi(ilk)) / GUN_MS) + 1;
  }
  return { bolum, dakika, gun };
}

export function filmBitisOzeti(film: any): BitisOzeti {
  const dk = Number(film?.runtime);
  return { bolum: null, dakika: dk > 0 ? Math.round(dk) : null, gun: null };
}

/** Süre parçaları: 45 → {sa:0, dk:45}; 555 → {sa:9, dk:15}; 10 saatten sonra dakika atılır. */
export function sureParcalari(dakika: number): { sa: number; dk: number } {
  const sa = Math.floor(dakika / 60);
  return { sa, dk: sa >= 10 ? 0 : dakika % 60 };
}

/**
 * Bitiş anında kartı yerinde tutmak için: listeden (iyimser yazımla) düşmüş
 * filmi, işaretlenmeden önceki SIRASINA geri koyar. Liste zaten içeriyorsa dokunmaz.
 */
export function tutulanlariGeriKoy<T>(
  liste: T[],
  tutulanlar: Array<{ id: number; ham: T; sira: number }>,
  kimlik: (o: T) => number | undefined,
): T[] {
  if (!tutulanlar.length) return liste;
  const var_ = new Set(liste.map(kimlik));
  const eklenecek = tutulanlar.filter((k) => !var_.has(k.id)).sort((a, b) => a.sira - b.sira);
  if (!eklenecek.length) return liste;
  const sonuc = [...liste];
  for (const k of eklenecek) sonuc.splice(Math.min(Math.max(k.sira, 0), sonuc.length), 0, k.ham);
  return sonuc;
}
