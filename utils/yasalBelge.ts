/**
 * Yasal belgelerin TEK haritası (YAYIN_ONCESI_PLAN Adım 4a, M609).
 *
 * Üç belge de `legal` çeviri ad alanında durur; sayfa (`components/public/LegalDocument`),
 * pencere (`components/settings/LegalTermsModal`) ve kural onayı aynı anahtarları okur.
 * Yeni madde eklemek için yalnız `locales/<dil>/legal.json` değişir.
 */
export type YasalBelge = 'terms' | 'privacy' | 'rules';

export interface YasalBelgeAnahtarlari {
  baslik: string;
  bolumler: string;
  /** Herkese açık, girişsiz adres (Play Console formlarına bu yazılır). */
  yol: '/(public)/kullanim-kosullari' | '/(public)/gizlilik' | '/(public)/topluluk-kurallari';
}

export const YASAL_BELGELER: Record<YasalBelge, YasalBelgeAnahtarlari> = {
  terms: { baslik: 'legal:title', bolumler: 'legal:sections', yol: '/(public)/kullanim-kosullari' },
  privacy: { baslik: 'legal:privacyTitle', bolumler: 'legal:privacySections', yol: '/(public)/gizlilik' },
  rules: { baslik: 'legal:rulesTitle', bolumler: 'legal:rulesSections', yol: '/(public)/topluluk-kurallari' },
};

/** Giriş ekranındaki onayın kapsadığı sıra: koşullar → kurallar → gizlilik. */
export const ONAY_BELGE_SIRASI: YasalBelge[] = ['terms', 'rules', 'privacy'];

export interface YasalBolum {
  heading: string;
  text: string;
}

/** `t(..., { returnObjects: true })` anahtar yoksa dizgi döndürür; ekran çökmesin diye süzülür. */
export function bolumleriCoz(ham: unknown): YasalBolum[] {
  if (!Array.isArray(ham)) return [];
  return ham.filter(
    (b): b is YasalBolum => !!b && typeof b.heading === 'string' && typeof b.text === 'string',
  );
}
