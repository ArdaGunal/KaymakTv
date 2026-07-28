// Kullanıcı ya tam bir Trakt kullanıcı adı yazar ("sertay") ya da profil
// linkini yapıştırır ("https://app.trakt.tv/profile/sertay?mode=media",
// "https://trakt.tv/users/sertay" vb.). Pano (clipboard) izni KULLANILMIYOR —
// kullanıcı metni kendisi elle yapıştırıyor, biz yalnızca gelen metni
// ayrıştırıyoruz.
const TRAKT_URL_PATTERN = /trakt\.tv\/(?:users|profile)\/([a-zA-Z0-9_-]+)/i;

export function extractTraktUsername(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(TRAKT_URL_PATTERN);
  if (urlMatch) return urlMatch[1];
  return trimmed.replace(/^@/, '');
}
