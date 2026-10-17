/**
 * Kimlik Faz 5 (M520) — Worker hata KODU → ekran metni (M490 deseni: kod taşınır, metin burada).
 */
export function girisYontemiHataMetni(t: (k: string) => string, kod: string): string {
  switch (kod) {
    case 'zaten_bagli':
      return t('settings:yontemZatenBagli');
    case 'durum_degisti':
    case 'bilet_gecersiz':
      return t('settings:hesapSecSureDoldu');
    default:
      return t('settings:baglamaHata');
  }
}
