// ==========================================================================
// GÖRÜNEN AD — istemci kuralı (SAF; 1.0.1 Dal 1, karar K2, 2026-11-15)
// ==========================================================================
// Asıl kural SUNUCUDA: `kaymaktv-feedback-worker/src/lib/profileDisplayName.js`. Bu dosya
// o kuralın BİREBİR kopyası; iki adım (bağımsız denetim düzeltmesi, 2026-11-15):
//   1. `bicimle` — ham girdi → aday değer (NFC, boşluk benzerleri, YALNIZ U+0020 kırpılır).
//   2. `kanonikAdKarari` — yazılacak değerin kuralı. DB CHECK `080` bunun birebir karşılığı;
//      SQL sınıfları `scripts/gorunen-ad-080-uret.mjs` ile BURADAKİ desenlerden üretilir.
// Eşlik: `tests/arayuz/gorunen-ad.test.mjs` (istemci + Worker, aynı vektörler) ve
// `tests/sql/gorunen-ad-080.sh` (gerçek PostgreSQL 15 + 17).
//
// İZİN LİSTESİ: Unicode harf, birleşen işaret, rakam, tek boşluk ve `. - _ '`.
// Emoji, grafik sembol ve görünmez karakter REDDEDİLİR. 2026-11-06'daki «emoji ve
// sembol serbest» kararı K2 ile GEÇERSİZ (plan `docs/design/ISIM_TEKRAR_ANALIZ_PLANI.md`).
//
// Tek istemci farkı `gorunenAdGirdisi`: kullanıcının GÖREMEDİĞİ karakterler yazarken
// kutudan çıkar ve bu BİLDİRİLİR (`ayiklandi`). Kutu yalnız ayıklama yüzünden boşaldıysa
// bu «adı kaldır» SAYILMAZ (denetim bulgusu 2); kaldırma, kutunun elle boşaltılmasıdır.
// Görünen her şey (emoji, sembol) kutuda kalır ve kural metni gösterilir.
// 🔴 Aralıklar sayıyla: kaynakta kaçış dizisi ya da çıplak görünmez karakter YOK.
import type { TFunction } from 'i18next';

/** Worker `AD_EN_COK` ile aynı sınır (kod noktası). */
export const AD_EN_COK = 50;

type Aralik = readonly [number, number];

/** Worker `YASAK_ARALIKLAR` ve DB `080` ile BİREBİR aynı (açıklamalar Worker'da). */
export const YASAK_ARALIKLAR: readonly Aralik[] = [
  [0x0001, 0x001f], [0x0021, 0x0026], [0x0028, 0x002c], [0x002f, 0x002f],
  [0x003a, 0x0040], [0x005b, 0x005e], [0x0060, 0x0060], [0x007b, 0x009f],
  [0x00a0, 0x00a9], [0x00ab, 0x00b4], [0x00b6, 0x00b9], [0x00bb, 0x00bf],
  [0x00d7, 0x00d7], [0x00f7, 0x00f7], [0x034f, 0x034f], [0x0600, 0x0605],
  [0x061c, 0x061c], [0x06dd, 0x06dd], [0x115f, 0x1160], [0x17b4, 0x17b5],
  [0x180b, 0x180f], [0x2000, 0x2bff], [0x2e00, 0x2e7f], [0x3000, 0x3000],
  [0x3164, 0x3164], [0x3200, 0x33ff], [0xe000, 0xf8ff], [0xfe00, 0xfe6f],
  [0xfeff, 0xfeff], [0xffa0, 0xffa0], [0xfff0, 0xffff], [0x1d000, 0x1daff],
  [0x1f000, 0x1fbff], [0xe0000, 0xe0fff], [0xf0000, 0x10ffff],
];

const BOSLUK_BENZERI: readonly Aralik[] = [
  [0x09, 0x0d], [0x85, 0x85], [0xa0, 0xa0], [0x1680, 0x1680], [0x2000, 0x200a],
  [0x2028, 0x2029], [0x202f, 0x202f], [0x205f, 0x205f], [0x3000, 0x3000],
];
const TIPOGRAFIK_KESME: readonly Aralik[] = [[0x2018, 0x2019]];

/** Ekranda hiç iz bırakmayan karakterler (kontrol, yön, sıfır genişlik, dolgu, varyant seçici). */
const GORUNMEZ: readonly Aralik[] = [
  [0x01, 0x08], [0x0e, 0x1f], [0x7f, 0x84], [0x86, 0x9f], [0xad, 0xad], [0x034f, 0x034f],
  [0x061c, 0x061c], [0x115f, 0x1160], [0x17b4, 0x17b5], [0x180b, 0x180f], [0x200b, 0x200f],
  [0x202a, 0x202e], [0x2060, 0x206f], [0x3164, 0x3164], [0xfe00, 0xfe0f], [0xfeff, 0xfeff],
  [0xffa0, 0xffa0], [0xe0000, 0xe0fff],
];

const icinde = (n: number, araliklar: readonly Aralik[]) => araliklar.some(([a, b]) => n >= a && n <= b);
const IZINLI = /^[\p{L}\p{Mn}\p{Mc}\p{Nd} ._'-]+$/u;
// Birleşen işaret harfe bağlı olmalı, en çok 4 üst üste; ayrıştırılmış (NFD) biçimde sayılır.
const YETIM_ISARET = /(^|[^\p{L}\p{Mn}\p{Mc}])[\p{Mn}\p{Mc}]/u;
const ISARET_YIGINI = /[\p{Mn}\p{Mc}]{5,}/u;
const HARF = /\p{L}/u;

/** `scripts/gorunen-ad-080-uret.mjs` DB sınıflarını bu desenlerden üretir (tek kaynak). */
export const KURAL_DESENLERI = { IZINLI, YETIM_ISARET, ISARET_YIGINI, HARF } as const;

/**
 * Ham girdi → aday değer: NFC + tek satır + tek boşluk + kenar boşluğu kırpma.
 * 🔴 YALNIZ U+0020 kırpılır: `trim()` BOM'u da keser ve yalnız BOM «adı kaldır»a dönerdi.
 */
function bicimle(ham: string): string {
  const harfler = Array.from(ham.normalize('NFC'), (c) => {
    const n = c.codePointAt(0) ?? 0;
    if (icinde(n, BOSLUK_BENZERI)) return ' ';
    if (icinde(n, TIPOGRAFIK_KESME)) return "'";
    return c;
  });
  return harfler.join('').replace(/ {2,}/g, ' ').replace(/^ +| +$/g, '');
}

export type GorunenAdSorunu = 'cok_uzun' | 'karakter' | 'harf_yok';
export type KanonikKarar = 'yaz' | 'bos' | GorunenAdSorunu;

/** Yazılacak DEĞER kanonik ve kurala uygun mu? Worker `kanonikAdKarari` ve DB 080 ile birebir. */
export function kanonikAdKarari(deger: string): KanonikKarar {
  const harfler = Array.from(deger);
  if (harfler.length === 0) return 'bos';
  if (harfler.length > AD_EN_COK) return 'cok_uzun';
  if (deger !== deger.normalize('NFC') || /^ | $| {2}/.test(deger)) return 'karakter';
  const yasakVar = harfler.some((c) => icinde(c.codePointAt(0) ?? 0, YASAK_ARALIKLAR));
  const ayrik = deger.normalize('NFD');
  if (yasakVar || !IZINLI.test(deger) || YETIM_ISARET.test(ayrik) || ISARET_YIGINI.test(ayrik)) return 'karakter';
  if (!HARF.test(deger)) return 'harf_yok';
  return 'yaz';
}
export type GorunenAdKarari = { uzunluk: number } & (
  | { tur: 'yaz'; deger: string }
  | { tur: 'temizle' }
  | { tur: GorunenAdSorunu }
);

/**
 * Kutudaki metnin kararı — Worker `displayNameNormalize` ile aynı `tur`.
 * `temizle` = yalnız boşluk (düzenleme penceresinde «adı kaldır»; isim ekranında «Devam» kapalı).
 * `uzunluk` sayaç içindir: biçimlenmiş metnin kod noktası sayısı.
 */
export function gorunenAdDenetle(ham: string): GorunenAdKarari {
  const deger = bicimle(ham);
  const uzunluk = Array.from(deger).length;
  if (uzunluk === 0) return { tur: 'temizle', uzunluk };
  const karar = kanonikAdKarari(deger);
  if (karar === 'yaz') return { tur: 'yaz', deger, uzunluk };
  return { tur: karar === 'bos' ? 'karakter' : karar, uzunluk };
}

/**
 * Yazarken: kutudan görünmez karakterleri çıkarır (görünen hiçbir şeye dokunmaz).
 * `ayiklandi` arayüze bildirilir: kutu YALNIZ ayıklama yüzünden boşaldıysa bu bir kaldırma isteği değildir.
 */
export function gorunenAdGirdisi(ham: string): { deger: string; ayiklandi: boolean } {
  const harfler = Array.from(ham);
  const kalan = harfler.filter((c) => !icinde(c.codePointAt(0) ?? 0, GORUNMEZ));
  return { deger: kalan.join(''), ayiklandi: kalan.length !== harfler.length };
}

/** İstemci sorunu ya da Worker kodu (`ad_karakter`, `ad_harf_yok`, `ad_uzun`, `ad_gecersiz`, `ad_gerekli`) → metin. */
export function gorunenAdHataMetni(t: TFunction, kod: string | null | undefined): string {
  switch ((kod ?? '').replace(/^ad_/, '')) {
    case 'gerekli':
      return t('settings:displayNameRequired', 'Devam etmek için görünen adını yaz.');
    case 'karakter':
    case 'gecersiz':
      return t('settings:displayNameRuleChars', "Görünen adda yalnızca harf, rakam, boşluk ve . - _ ' olabilir. Emoji ve sembol kullanılamaz.");
    case 'harf_yok':
      return t('settings:displayNameRuleLetter', 'Görünen ad en az bir harf içermeli.');
    case 'cok_uzun':
    case 'uzun':
      return t('settings:displayNameTooLong', { max: AD_EN_COK, defaultValue: 'Görünen ad en fazla {{max}} karakter olabilir.' });
    default:
      return t('settings:profileSaveError', 'Kaydedilemedi, tekrar dene.');
  }
}
