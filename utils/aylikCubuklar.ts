// ==========================================================================
// AYLIK GRAFİK ÇUBUKLARI — sunucu dönem satırlarından (SAF · 1.0.1 Dal 4)
// ==========================================================================
// Girdi `/library/donemler` (082): her izleme kendi ayında, cihazın saat diliminde. Son N ayın
// iskeleti önce kurulur: veri olmayan aylar 0 değeriyle yer alır, zaman ekseni kesintisiz görünür.

type DonemSatiri = { donem: string; tur: 'episode' | 'movie'; izleme: number };
export type AylikCubuk = { key: string; label: string; value: number };

const ayAnahtari = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function aylikCubuklar(
  satirlar: DonemSatiri[] | null | undefined,
  tur: 'episode' | 'movie',
  aySayisi: number,
  locale: string,
  simdi: Date = new Date(),
): AylikCubuk[] {
  const cubuklar: AylikCubuk[] = [];
  const sira = new Map<string, number>();
  for (let geri = aySayisi - 1; geri >= 0; geri--) {
    const d = new Date(simdi.getFullYear(), simdi.getMonth() - geri, 1);
    sira.set(ayAnahtari(d), cubuklar.length);
    cubuklar.push({ key: ayAnahtari(d), label: d.toLocaleDateString(locale, { month: 'short' }), value: 0 });
  }
  for (const s of satirlar || []) {
    if (s?.tur !== tur) continue;
    const i = sira.get(s.donem);
    const n = Number(s.izleme);
    if (i !== undefined && Number.isFinite(n) && n > 0) cubuklar[i].value += n;
  }
  return cubuklar;
}
