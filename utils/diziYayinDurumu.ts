import { dilBilgisi, yerelEtiket } from '../locales/diller';

export type YayinDurumu = 'devam' | 'bitti' | 'iptal' | 'yapimda' | 'planli' | 'bilinmiyor';

export type DiziYayinBilgisi = {
  yayin_durumu: YayinDurumu | null;
  sonraki_yayin_at?: string | null;
  sonraki_yayin_sezon?: number;
  sonraki_yayin_bolum?: number;
};

export function guncelEtiketi(tarih: string | null, simdi: number, dil: string, zamanDilimi?: string) {
  const an = tarih ? Date.parse(tarih) : NaN;
  if (!Number.isFinite(an)) return { tur: 'bekleniyor' } as const;
  const { etiket, yayinTarihAy } = dilBilgisi(dil);
  const takvim = new Intl.DateTimeFormat(yerelEtiket(), {
    timeZone: zamanDilimi, calendar: 'gregory', numberingSystem: 'latn',
    year: 'numeric', month: 'numeric', day: 'numeric',
  });
  const yerel = (t: number) => {
    const parcalar = takvim.formatToParts(t);
    const bul = (tip: 'year' | 'month' | 'day') => Number(parcalar.find((p) => p.type === tip)?.value);
    return { yil: bul('year'), ay: bul('month'), gun: bul('day') };
  };
  const bugun = yerel(simdi);
  const hedef = yerel(an);
  const gunDamgasi = (d: ReturnType<typeof yerel>) => Date.UTC(d.yil, d.ay - 1, d.gun);
  const gun = (gunDamgasi(hedef) - gunDamgasi(bugun)) / 86_400_000;
  if (gun < 0) return { tur: 'bekleniyor' } as const;
  if (gun === 0) return { tur: 'bugun' } as const;
  if (gun === 1) return { tur: 'yarin' } as const;
  if (gun <= 30) return { tur: 'gun', gun } as const;
  return {
    tur: 'tarih',
    metin: new Intl.DateTimeFormat(etiket, {
      timeZone: zamanDilimi, day: 'numeric', month: yayinTarihAy ?? 'short',
      ...(hedef.yil === bugun.yil ? {} : { year: 'numeric' }),
    }).format(an),
  } as const;
}
