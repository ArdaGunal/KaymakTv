/**
 * KaymakTV inceleme metni sınırları — TEK kaynak (istemci tarafı).
 *
 * ⚠️ Bu dosya `utils/commentValidation.ts`'in yerini aldı. O dosya Trakt'ın
 * SUNUCU TARAFINDA dayattığı kuralları kodluyordu (`validateComment`,
 * `MIN_COMMENT_WORDS = 5`, `REVIEW_WORD_THRESHOLD = 200`, `MAX_COMMENT_CHARS`)
 * — çünkü yorumlar Trakt'a yazılıyordu ve uymayan istek 422 dönüyordu.
 *
 * Trakt'a yazmayı tamamen bıraktığımız için (bkz. docs/design/REVIEWS_PLAN.md v2) o
 * kuralların hiçbiri artık bizi bağlamıyor; geriye yalnızca KENDİ seçtiğimiz
 * iki sınır kaldı. Dosya adı da bunu yansıtıyor — içinde bir "validation"
 * fonksiyonu yok, yalnızca sınırlar var.
 *
 * ⚠️ ÜÇ YERDE SENKRON OLMALI:
 *   1. DB CHECK `feed_activities_note_length` — **GERÇEK KAYNAK** (020)
 *   2. Worker `MAX_NOTE_LENGTH` / `MIN_REVIEW_CHARS`
 *   3. Burası
 * Biri değişirse üçü birden değişmeli.
 */

/**
 * Üst sınır. `feed_activities.note` kolonunun DB CHECK'iyle AYNI olmak zorunda.
 *
 * 1000'den 5000'e çıkarıldı (020): eski sınır ≈150 kelimeye denk geliyordu ve
 * "inceleme" için dardı — Trakt'ın kendi 200 kelimelik review eşiğinin bile
 * altında kalıyordu.
 */
export const MAX_REVIEW_CHARS = 5000;

/**
 * Alt sınır — tamamen boş/anlamsız girdiyi engelleyen asgari süzgeç.
 *
 * Trakt'ın 5 KELİME minimumunun yerini aldı (o bir sunucu kuralıydı, bu bizim
 * seçimimiz). Spam koruması asıl olarak rate limit + "yapım başına tek
 * inceleme" unique index'iyle sağlanıyor, uzunluk kuralıyla değil.
 */
export const MIN_REVIEW_CHARS = 3;
