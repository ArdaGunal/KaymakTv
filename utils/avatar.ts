// ==========================================================================
// Avatar — baş harf ve renk (SAF) · Faz T · T4 (M341)
// ==========================================================================
// `components/Avatar.tsx`'in karar katmanı. Ağ yok, React yok →
// `tests/arayuz/avatar.test.mjs` doğrudan içe aktarıp sınıyor.
//
// Ürün kuralı (kullanıcı, 2026-09-06 — `design/FAZ_T_UYGULAMA_PLANI.md` §T4):
// avatar YÜKLEME YOK. Resim varsa o; yoksa **baş harften renkli daire**.
//
// Palet `components/comments/CommentItem.tsx`'ten taşındı (orada yalnızca
// Trakt yorumları kullanıyordu; diğer 15 ekran gri bir daire çiziyordu).

export const AVATAR_RENKLERI = [
  '#2563eb', '#7c3aed', '#0891b2', '#059669',
  '#d97706', '#dc2626', '#db2777', '#65a30d',
] as const;

/**
 * İlk görünür karakter, büyük harf. Boşsa `?`.
 *
 * `Array.from`: ad bir emojiyle başlıyorsa `charAt(0)` vekil çiftin YARISINI
 * döndürür ve ekranda kırık bir kutu çizilirdi.
 */
export function avatarBasHarfi(ad?: string | null): string {
  const temiz = (ad ?? '').trim().replace(/^@/, '');
  const ilk = Array.from(temiz)[0];
  return ilk ? ilk.toUpperCase() : '?';
}

/**
 * Addan DETERMİNİSTİK renk — aynı kişi her ekranda aynı renkte.
 *
 * 🔑 Büyük/küçük harf duyarsız: kullanıcı adları öyle benzersiz (`030`),
 * `ArdaGnl` ile `ardagnl` aynı kişi — farklı renkte görünmemeli.
 *
 * ⚠️ Eski `CommentItem` yalnızca ilk İKİ karakteri topluyordu; aynı harfle
 * başlayan adların çoğu aynı renge düşüyordu. Tüm ad üzerinden basit bir
 * çarpımsal özet kullanılıyor.
 */
export function avatarRengi(ad?: string | null): string {
  const temiz = (ad ?? '').trim().toLowerCase();
  if (!temiz) return AVATAR_RENKLERI[0];
  let ozet = 0;
  for (const kn of Array.from(temiz)) {
    ozet = (ozet * 31 + (kn.codePointAt(0) ?? 0)) >>> 0;
  }
  return AVATAR_RENKLERI[ozet % AVATAR_RENKLERI.length];
}
