// ==========================================================================
// DİL KAYDI — uygulamanın desteklediği dillerin TEK kaynağı (BASLIK Adım 0 · 2.6.8)
// ==========================================================================
// Kullanıcı (2026-10-30): «ilerde almanca, fransızca ekleyelim dediğimiz zaman
// sorun olmasın.» Yeni dil = `diller.json`'a bir satır + `locales/<kod>/`
// klasörü (+ `resources.ts`'e içe aktarım). Kodun hiçbir yerinde
// `dil === 'tr' ? 'tr-TR' : 'en-US'` gibi İKİ SEÇENEKLİ dal kalmamalı:
//
// 🔴 NEDEN: bu dallar bilinmeyen dilde sessizce TÜRKÇEYE düşüyordu
// (`formatExactDate`: `language === 'en' ? 'en-US' : 'tr-TR'`) — Almanca
// eklendiği gün Alman kullanıcı tarihleri Türkçe görürdü. Burada bilinmeyen
// dil HER ZAMAN varsayılana (İngilizce) düşer.
//
// Kayıt JSON'da duruyor çünkü Pi sunucusu da (CommonJS, TS okuyamaz) ileride
// aynı listeyi okuyacak (arşivin kanonik TMDB dil kümesi — Adım 3).
//
// Alanlar:
//   kod            ISO 639-1 (i18next dili, Trakt `language` ile aynı biçim)
//   ad             dilin KENDİ dilindeki adı (seçicide böyle yazılır)
//   ceviriAnahtari `settings` ad alanında dilin çevrilmiş adının anahtarı
//   etiket         BCP 47 — tarih/sayı biçimi (`toLocale*`) ve TMDB `language`
//   alfabe         ISO 15924 — BASLIK: özgün adın alt satırda gösterilip
//                  gösterilmeyeceği (aynı alfabe şartı)
//   yabanciBaslik  BASLIK: yabancı yapımda ana başlık politikası. Bugün
//                  hepsi 'uluslararasi'; çevrilmiş adın yaygın olduğu bir dil
//                  (ör. Almanca) eklenirse 'ceviri' — kod değişmeden.
// SAF — React Native bağımlılığı yok, Node testinde doğrudan yüklenir.

import kayit from './diller.json';

export type YabanciBaslikPolitikasi = 'uluslararasi' | 'ceviri';

export type DilKaydi = {
  kod: string;
  ad: string;
  ceviriAnahtari: string;
  kisa: string;
  bayrak: string;
  bayrakUlke: string;
  etiket: string;
  alfabe: string;
  yabanciBaslik: YabanciBaslikPolitikasi;
};

export const DILLER: readonly DilKaydi[] = kayit.diller as DilKaydi[];
export const VARSAYILAN_DIL: string = kayit.varsayilan;
export const DESTEKLENEN_DILLER: readonly string[] = DILLER.map((d) => d.kod);

const varsayilanKayit = (): DilKaydi =>
  DILLER.find((d) => d.kod === VARSAYILAN_DIL) as DilKaydi;

/**
 * Herhangi bir dil değerini (`tr`, `tr-TR`, `EN`, `undefined`) desteklenen bir
 * koda çevirir; desteklenmiyorsa varsayılan. Saf.
 */
export function dilKodu(dil?: string | null): string {
  const kok = String(dil || '').split(/[-_]/)[0].toLowerCase();
  return DESTEKLENEN_DILLER.includes(kok) ? kok : VARSAYILAN_DIL;
}

/** Dilin kayıt satırı; bilinmeyen dilde varsayılanın satırı. Saf. */
export function dilBilgisi(dil?: string | null): DilKaydi {
  const kod = dilKodu(dil);
  return DILLER.find((d) => d.kod === kod) ?? varsayilanKayit();
}

/** `toLocaleDateString` / `toLocaleString` / TMDB `language` için BCP 47 etiketi. Saf. */
export function yerelEtiket(dil?: string | null): string {
  return dilBilgisi(dil).etiket;
}
