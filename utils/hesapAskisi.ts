/**
 * HESAP ASKISI — istemci tarafının saf çekirdeği (YAYIN_ONCESI_PLAN Adım 4e, M610).
 *
 * Kararı SUNUCU verir (Worker `icerikYazmaKapisi`, şema 078): askıdaki hesap gönderi, not,
 * inceleme, yorum ve profil metni yazamaz; okuma, beğeni, takip, izleme işaretleme ve hesap
 * silme açık kalır. İstemci yalnız `403 hesap_askida` yanıtını tanır ve kullanıcının dilinde
 * açıklar. Burada karar verilmez, kısıt uygulanmaz.
 */
export interface AskiBilgisi {
  /** `aski` = bitiş tarihli; `kapali` = süresiz. */
  durum: 'aski' | 'kapali';
  /** ISO tarih; `kapali` için `null`. */
  bitis: string | null;
  /** İtiraz adresi (sunucudan; yoksa çağıran varsayılanı kullanır). */
  itiraz: string | null;
}

/** HTTP yanıtı askı reddi mi. Değilse `null`. */
export function askiYanitiCoz(durum: number | undefined, govde: any): AskiBilgisi | null {
  if (durum !== 403 || govde?.code !== 'hesap_askida') return null;
  const itiraz = typeof govde.itiraz === 'string' && govde.itiraz.includes('@') ? govde.itiraz : null;
  if (govde.durum === 'kapali') return { durum: 'kapali', bitis: null, itiraz };
  const ms = Date.parse(typeof govde.bitis === 'string' ? govde.bitis : '');
  // Bitişi okunamayan askı da gösterilir (tarihsiz metinle): sunucu reddetti, kullanıcı nedenini bilmeli.
  return { durum: 'aski', bitis: Number.isFinite(ms) ? new Date(ms).toISOString() : null, itiraz };
}

/** Hangi çeviri anahtarı: tarihli askı, tarihsiz askı ya da süresiz kapatma. */
export function askiMetinAnahtari(bilgi: AskiBilgisi): 'legal:suspendedUntil' | 'legal:suspendedNoDate' | 'legal:suspendedClosed' {
  if (bilgi.durum === 'kapali') return 'legal:suspendedClosed';
  return bilgi.bitis ? 'legal:suspendedUntil' : 'legal:suspendedNoDate';
}

/** Bitiş tarihini kullanıcının dilinde yazar; `Intl` yoksa/çökerse GG.AA.YYYY. */
export function askiTarihiYaz(iso: string, dil: string): string {
  const d = new Date(iso);
  try {
    return d.toLocaleDateString(dil, { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    const iki = (n: number) => String(n).padStart(2, '0');
    return `${iki(d.getDate())}.${iki(d.getMonth() + 1)}.${d.getFullYear()}`;
  }
}

/** Aynı reddin art arda gelen kopyaları (yeniden deneme, çift dokunuş) tek kutu açsın. */
export const ASKI_KUTUSU_ARALIGI_MS = 4000;
