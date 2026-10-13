-- ════════════════════════════════════════════════════════════════════════════
-- SALT OKUMA · Kimlik Faz 4c denetimi (M516, 2026-10-13)
-- Soru: Google-only bir hesapta (Trakt kimliği YOK) Trakt içe aktarma izi var mı?
-- Kod (M516): `user_import_state`'e yalnız `/import/trakt` yazar; uç Google oturumunu
-- reddeder (`trakt_gerekli`) ve kişiyi Trakt token'ından çözer → iz yalnız Trakt'lı
-- satırda doğar. Bu sorgu canlı veride aynı şeyi doğrular. Hiçbir şey YAZMAZ.
--
-- Beklenen:
--   traktsiz_hesapta_iz   = 0   ← 4c'nin tek tetikleyicisi; 0 ise öneri hiç gerekmez
--   slugsuz_hesapta_iz    = 0   (uuid'li ama adı başkasına geçmiş hesap — Faz 1 T6 — olursa >0 olabilir; o satır yine Trakt hesabıdır)
--   farkli_slug_izi       = bilgi (Trakt'ta ad değiştirenlerde eski ad kalır; zararsız)
--   google_only_hesap     = bilgi (2026-10-12: 1 — @Arda_Gunal)
-- ════════════════════════════════════════════════════════════════════════════
select
  (select count(*) from public.user_import_state s
     join public.users u on u.id = s.user_id
    where u.trakt_slug is null and u.trakt_uuid is null)                       as traktsiz_hesapta_iz,
  (select count(*) from public.user_import_state s
     join public.users u on u.id = s.user_id
    where u.trakt_slug is null)                                                as slugsuz_hesapta_iz,
  (select count(*) from public.user_import_state s
     join public.users u on u.id = s.user_id
    where s.trakt_slug is not null and u.trakt_slug is not null
      and s.trakt_slug <> u.trakt_slug)                                        as farkli_slug_izi,
  (select count(*) from public.users
    where google_sub is not null and trakt_slug is null and trakt_uuid is null) as google_only_hesap;
