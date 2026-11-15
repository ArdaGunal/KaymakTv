// ==========================================================================
// PROFİL ADI SATIRLARI — başlıkta ne yazacağına karar verir (SAF)
// ==========================================================================
// 1.0.1 Dal 2 · profil başlığı (kullanıcı kararı, 2026-11-15; plan
// `docs/design/ISIM_TEKRAR_ANALIZ_PLANI.md` §3 Dal 2).
//   - Görünen ad VAR ve kullanıcı adından farklı → «Arda Günal» / «@ArdaGnl».
//   - Görünen ad YOK ya da kullanıcı adıyla aynı (harf büyüklüğü fark etmez) →
//     yalnız «ArdaGnl» (başında @ yok); ikinci satır HİÇ çizilmez. Eskiden aynı
//     ad iki kez yazılıyordu («ArdaGnl» / «@ArdaGnl»).
// Mobil başlık, web masaüstü başlıkları ve «Profilim» ekranı bu tek kuralı kullanır.

export interface ProfilAdSatirlari {
  /** Kalın birinci satır. Boşsa çağıran yedek başlık («Profil») gösterir. */
  baslik: string;
  /** Soluk ikinci satır (`@kullanıcı_adı`); `null` = çizilmez. */
  altSatir: string | null;
}

export function profilAdSatirlari(gorunenAd: string | null | undefined, kullaniciAdi: string | null | undefined): ProfilAdSatirlari {
  const ad = (gorunenAd ?? '').trim();
  const kAdi = (kullaniciAdi ?? '').trim();
  if (ad && kAdi && ad.toLowerCase() !== kAdi.toLowerCase()) return { baslik: ad, altSatir: `@${kAdi}` };
  return { baslik: kAdi || ad, altSatir: null };
}
