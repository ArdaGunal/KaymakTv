/**
 * Kimlik birliği Faz 3 (M509) — Google `check` yanıtından sonra ne yapılacağı. SAF.
 *   • `oturum`        → Google-only hesap: dönen `sessionToken` ile giriş.
 *   • `trakt_ile_gir` → Trakt'lı hesaba bağlı: oturum YOK, «Trakt ile giriş yap» (D2).
 *   • `yeni`          → bağlı değil: soru sormadan `create_new` (D4).
 * Belge yoksa (`sessionToken` boş) güvenli taraf: Trakt'a yönlendir — Worker artık Trakt'lı
 * satıra belge vermiyor; eski Worker `traktLinked` döndürmese de `?? true` aynı yere düşer.
 */
export type GoogleGirisAdimi = 'oturum' | 'trakt_ile_gir' | 'yeni';

export function googleGirisAdimi(
  kontrol: { status: 'unlinked' } | { status: 'linked'; traktLinked?: boolean; sessionToken?: string },
): GoogleGirisAdimi {
  if (kontrol.status !== 'linked') return 'yeni';
  if (kontrol.traktLinked || !kontrol.sessionToken) return 'trakt_ile_gir';
  return 'oturum';
}
