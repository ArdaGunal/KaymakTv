/**
 * Yorum/cevap metni doğrulama — TEK kaynak.
 *
 * Neden burada: `WriteCommentSheet` (yorum yazma) ve `CommentReplies` (cevap
 * yazma) daha önce aynı kuralı kendi içlerinde, birbirinden BAĞIMSIZ ve zamanla
 * birbirinden SAPMIŞ şekilde kopyalıyordu. Kural Trakt'ın sunucu tarafından
 * dayatıldığı için tek yerde tutulmalı.
 *
 * ⚠️ Trakt'ın GERÇEK kuralı (kendi FAQ'ından, forums.trakt.tv/t/what-are-the-rules-for-posting-comments/22155):
 * bir yorum **en az 5 KELİME** olmak zorunda. Bu sunucu tarafında zorlanır —
 * uymayan istek `422 Unprocessable Entity` ile geri döner. Yani istemcide bu
 * kuralı gevşetmek mümkün DEĞİL; gevşetirsek kullanıcı butona basar ve isteği
 * Trakt reddeder. Bu yüzden gönder butonu, istek Trakt tarafından KESİN kabul
 * edilecek duruma gelene kadar pasif tutulur.
 *
 * Ek bilgi (hata değil): Trakt 200 kelimeyi aşan yorumları otomatik olarak
 * "inceleme (review)" olarak işaretler — bu bir kısıtlama değil, sadece
 * sınıflandırma.
 */

/** Trakt'ın sunucu tarafında dayattığı gerçek minimum. Gevşetilemez. */
export const MIN_COMMENT_WORDS = 5;

/**
 * Ek istemci-içi minimum. Pratikte 5 kelime şartı bunu zaten kapsar, ama çok
 * kısa girdilerde ("aaaa") kullanıcıya kelime sayısından daha anlaşılır bir
 * ilk geri bildirim vermeyi sağlıyor.
 */
export const MIN_COMMENT_CHARS = 5;

/**
 * Üst sınır bilinçli olarak ÇOK yüksek: Trakt uzun incelemelere izin veriyor ve
 * belgelenmiş bir karakter tavanı yok. Bu yalnızca kazara devasa payload
 * göndermeyi engelleyen bir emniyet supabı — normal kullanımda asla tetiklenmez.
 */
export const MAX_COMMENT_CHARS = 10000;

/** Trakt'ın "bundan sonrası review sayılır" eşiği — kısıtlama değil, bilgi. */
export const REVIEW_WORD_THRESHOLD = 200;

export type CommentInvalidReason = 'empty' | 'tooShort' | 'tooFewWords' | 'tooLong';

export interface CommentValidation {
  /** `trim()` sonrası karakter sayısı. */
  charCount: number;
  /** `trim()` sonrası kelime sayısı. */
  wordCount: number;
  /** Trakt'ın kabul edeceği duruma gelmiş mi — gönder butonunun aktifliği buna bağlı. */
  isValid: boolean;
  /** Geçersizse ilk ihlal edilen kural; geçerliyse `null`. */
  reason: CommentInvalidReason | null;
  /** 200 kelimeyi aştı mı (Trakt bunu "review" olarak etiketler). Hata DEĞİL. */
  isReviewLength: boolean;
}

/**
 * Metni doğrular. Gönderilecek gerçek gövde için `text.trim()` kullanılmalı —
 * sayımlar da trim edilmiş metin üzerinden yapılır ki baştaki/sondaki boşluklar
 * kullanıcıyı yanıltmasın.
 */
export function validateComment(raw: string): CommentValidation {
  const trimmed = raw.trim();
  const charCount = trimmed.length;
  // Boş string'de `''.split(/\s+/)` -> `['']` döner (uzunluk 1) — bu yüzden
  // filtre şart, aksi halde boş metin "1 kelime" sayılırdı.
  const wordCount = charCount === 0 ? 0 : trimmed.split(/\s+/).filter((w) => w.length > 0).length;

  let reason: CommentInvalidReason | null = null;
  if (charCount === 0) reason = 'empty';
  else if (charCount < MIN_COMMENT_CHARS) reason = 'tooShort';
  else if (wordCount < MIN_COMMENT_WORDS) reason = 'tooFewWords';
  else if (charCount > MAX_COMMENT_CHARS) reason = 'tooLong';

  return {
    charCount,
    wordCount,
    isValid: reason === null,
    reason,
    isReviewLength: wordCount > REVIEW_WORD_THRESHOLD,
  };
}
