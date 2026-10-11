-- ==========================================================================
-- HESAP SİLME ENVANTERİ — SALT OKUMA (hiçbir şeyi değiştirmez) · M491, 2026-10-11
-- ==========================================================================
-- Supabase › SQL Editor'de çalıştırın. Silmeden ÖNCE ve SONRA aynı sorgu → sonuçları karşılaştırın.
-- Şema dosyalarına değil CANLI kataloğa bakar (dosyalar ile canlı arasında kayma görülmüştü, S22).
--
-- Bölümler:
--   0  Kullanıcı satırı — SİLMEDEN ÖNCE username'in «Test Kullanıcısı» olduğunu GÖZLE doğrulayın.
--   1  users'a doğrudan bağlı her tablo/kolon + silinince ne olur (CASCADE/SET NULL/RESTRICT)
--   2  Dolaylı: bu kişinin içeriğine bağlı başkalarının satırları (beğeni/yorum vb.)
--   3  FK'SIZ «kullanıcıya benzeyen» kolonlar — silmede GERİDE KALABİLECEK veri
--   4  Depolama (storage.objects) içinde kimliği geçen dosyalar
--
-- Kimlik tek yerde: aşağıdaki uuid (Test Kullanıcısı, Google-only).
-- ==========================================================================
with u as (select 'dee49a99-2799-415d-be03-ebce6a5c3153'::uuid as id),
fk as (
  select c.conrelid::regclass::text as tablo,
         a.attname::text as kolon,
         case c.confdeltype
           when 'c' then 'CASCADE (silinir)'
           when 'n' then 'SET NULL (kalir, anonim)'
           when 'd' then 'SET DEFAULT'
           when 'r' then 'RESTRICT (SILMEYI ENGELLER)'
           else 'NO ACTION (SILMEYI ENGELLER)'
         end as silinince
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
  where c.contype = 'f' and c.confrelid = 'public.users'::regclass
),
sayim as (
  select tablo, kolon, silinince,
         (xpath('/row/n/text()', query_to_xml(
            format('select count(*) as n from %s where %I = %L::uuid', tablo, kolon, (select id from u)),
            false, true, '')))[1]::text::int as satir
  from fk
)
select '0-KULLANICI' as bolum, 'users' as tablo,
       coalesce(x.j->>'username', '?') as kolon,
       'trakt_slug=' || coalesce(x.j->>'trakt_slug', 'YOK') || ' · google=' ||
         case when x.j->>'google_sub' is null then 'YOK' else 'VAR' end ||
         ' · olusturma=' || coalesce(x.j->>'created_at', '?') as silinince,
       1 as satir
from (select to_jsonb(us) as j from public.users us where us.id = (select id from u)) x

union all
select '1-DOGRUDAN', tablo, kolon, silinince, satir from sayim

union all
-- 2) Dolaylı: users'a bağlı bir tabloya (ör. feed_activities) FK ile bağlı çocuk tablolar,
--    YALNIZ bu kişinin satırlarına işaret edenler (başkasının beğenisi/yorumu bu kişinin gönderisinde).
select '2-DOLAYLI', c.conrelid::regclass::text, a.attname::text || ' -> ' || c.confrelid::regclass::text,
       case c.confdeltype when 'c' then 'CASCADE (silinir)' when 'n' then 'SET NULL (kalir, anonim)'
            when 'r' then 'RESTRICT (SILMEYI ENGELLER)' else 'NO ACTION (SILMEYI ENGELLER)' end,
       (xpath('/row/n/text()', query_to_xml(
          format('select count(*) as n from %s where %I in (select %I from %s where %I = %L::uuid)',
                 c.conrelid::regclass, a.attname, pa.attname, c.confrelid::regclass, f.kolon, (select id from u)),
          false, true, '')))[1]::text::int
from pg_constraint c
join pg_attribute a  on a.attrelid  = c.conrelid  and a.attnum  = c.conkey[1]
join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = c.confkey[1]
join fk f on f.tablo = c.confrelid::regclass::text
where c.contype = 'f' and c.confrelid <> 'public.users'::regclass

union all
-- 3) FK'sız ama adı kullanıcıya benzeyen kolonlar (uuid/metin) — silmede GERİDE kalabilir.
select '3-FK YOK (geride kalabilir)', col.table_name::text, col.column_name::text, 'FK YOK',
       (xpath('/row/n/text()', query_to_xml(
          format('select count(*) as n from public.%I where %I::text = %L', col.table_name, col.column_name, (select id from u)::text),
          false, true, '')))[1]::text::int
from information_schema.columns col
join information_schema.tables t on t.table_schema = col.table_schema and t.table_name = col.table_name and t.table_type = 'BASE TABLE'
where col.table_schema = 'public'
  and col.data_type in ('uuid', 'text', 'character varying')
  and col.column_name ~ '(^|_)(user|actor|author|owner|requester|target|blocker|blocked|follower|following|reporter|recipient|sender|kullanici)(_id|_user_id)?$'
  and col.table_name <> 'users'
  and not exists (select 1 from fk where fk.tablo in (col.table_name, 'public.' || col.table_name) and fk.kolon = col.column_name)

union all
-- 5) BAŞKALARININ gönderilerinde bu kişinin izi: o gönderilerin sayaçları silmeden sonra düşmeli.
--    (satir = gönderinin şu anki like_count + comment_count toplamı; kolon = gönderi id + sahibi)
select '5-BASKASININ GONDERISI (sayac kontrol)', 'feed_activities',
       fa.id::text || ' · sahibi=' || coalesce(ow.username, '?'),
       'begeni=' || fa.like_count || ' yorum=' || fa.comment_count,
       fa.like_count + fa.comment_count
from public.feed_activities fa
left join public.users ow on ow.id = fa.user_id
where fa.user_id <> (select id from u)
  and (exists (select 1 from public.feed_activity_likes l where l.activity_id = fa.id and l.user_id = (select id from u))
    or exists (select 1 from public.comments cm where cm.activity_id = fa.id and cm.user_id = (select id from u)))

union all
-- 4) Depolama: dosya adında kimlik geçen nesneler (avatar yükleme vb.)
select '4-DEPOLAMA', 'storage.objects', 'name ~ uuid', '-',
       (select count(*)::int from storage.objects o where o.name ilike '%' || (select id from u)::text || '%')

order by 1, 2, 3;
