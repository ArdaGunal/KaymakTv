#!/bin/bash
# M469 · Supabase bölge taşıma PROVASI — Singapur → Frankfurt.
#
# CANLIYA YAZMAZ: eski projeden yalnız pg_dump (salt okuma), YENİ BOŞ projeye
# geri yükleme. Worker/APK/Pi hâlâ eski projeye bakar; prova istenildiği kadar
# tekrarlanabilir (yeni projede public şeması baştan kurulur).
#
# Kimlik bilgileri SOHBETE/KOMUTA girmez: `.env.bolge.local` (gitignore'da):
#   ESKI_DB_URL=postgresql://postgres.<ref>:<şifre>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
#   YENI_DB_URL=postgresql://postgres.<ref>:<şifre>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
# (Dashboard → Connect → «Session pooler»; doğrudan db.<ref> adresi IPv6'dır.)
#
# Araç: postgres:17-alpine konteynerindeki pg_dump/psql (yerelde psql yok).
set -euo pipefail
cd "$(dirname "$0")/../.."
[ -f .env.bolge.local ] || { echo "HATA: .env.bolge.local yok (bkz. dosya başı)"; exit 1; }
set -a; . ./.env.bolge.local; set +a
: "${ESKI_DB_URL:?ESKI_DB_URL eksik}" "${YENI_DB_URL:?YENI_DB_URL eksik}"
case "$YENI_DB_URL" in *ap-southeast-1*) echo "HATA: YENI_DB_URL Singapur'u gösteriyor — yanlış proje"; exit 1;; esac
[ "$ESKI_DB_URL" != "$YENI_DB_URL" ] || { echo "HATA: iki adres aynı"; exit 1; }

IS=scratchpad/bolge-tasima; mkdir -p "$IS"
PG="docker run --rm -i -e PGCONNECT_TIMEOUT=15 postgres:17-alpine"
ZAMAN=$(date +%Y%m%d-%H%M%S)

echo "== 1/5 Yeni proje BOŞ mu? (public'te tablo olmamalı; --yeniden ile atlanır)"
TABLO=$($PG psql "$YENI_DB_URL" -Atc "select count(*) from pg_tables where schemaname='public'")
if [ "$TABLO" != "0" ] && [ "${1:-}" != "--yeniden" ]; then
  echo "Yeni projede $TABLO tablo var. Prova tekrarı için: $0 --yeniden"; exit 1
fi

echo "== 2/5 Eski projeden şema + veri (salt okuma)"
$PG pg_dump "$ESKI_DB_URL" --schema=public --no-owner --quote-all-identifiers \
  --schema-only > "$IS/sema-$ZAMAN.sql"
$PG pg_dump "$ESKI_DB_URL" --schema=public --no-owner --quote-all-identifiers \
  --data-only > "$IS/veri-$ZAMAN.sql"
# ↑ --disable-triggers Supabase'de süper kullanıcı ister; resmi rehberdeki gibi
# yükleme `session_replication_role = replica` ile yapılır (adım 3) — bizim
# tetikleyiciler (puan/sayaç/mezar taşı) veri yüklenirken ÇALIŞMAZ.
# Zamanlanmış işler ve realtime yayını CANLIDAKİ tanımlardan üretilir (dosyadan değil).
$PG psql "$ESKI_DB_URL" -At > "$IS/sonrasi-$ZAMAN.sql" <<'SQL'
select 'create extension if not exists pg_cron;';
select format('select cron.unschedule(%L) where exists (select 1 from cron.job where jobname = %L);', jobname, jobname) from cron.job;
select format('select cron.schedule(%L, %L, %L);', jobname, schedule, command) from cron.job order by jobname;
select format('alter publication supabase_realtime add table %I.%I%s;', n.nspname, c.relname,
  case when pr.prattrs is null then '' else ' (' || (select string_agg(quote_ident(a.attname), ', ' order by a.attnum)
    from pg_attribute a where a.attrelid = c.oid and a.attnum = any(pr.prattrs)) || ')' end)
from pg_publication p join pg_publication_rel pr on pr.prpubid = p.oid
join pg_class c on c.oid = pr.prrelid join pg_namespace n on n.oid = c.relnamespace
where p.pubname = 'supabase_realtime' and n.nspname = 'public';
select 'notify pgrst, ''reload schema'';';
SQL
ls -la "$IS"/*-"$ZAMAN".sql
echo "-- sonrasi:"; cat "$IS/sonrasi-$ZAMAN.sql"

echo "== 3/5 Yeni projeye yükle (tek transaction; hata → hiçbir şey kalmaz)"
if [ "${1:-}" = "--yeniden" ]; then
  $PG psql "$YENI_DB_URL" -v ON_ERROR_STOP=1 -c "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;"
fi
{ cat "$IS/sema-$ZAMAN.sql"; echo "SET session_replication_role = replica;";
  cat "$IS/veri-$ZAMAN.sql"; echo "SET session_replication_role = origin;";
  cat "$IS/sonrasi-$ZAMAN.sql"; } \
  | $PG psql "$YENI_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -q

echo "== 4/5 Satır sayısı karşılaştırması"
SAY="select table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::bigint from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1"
$PG psql "$ESKI_DB_URL" -AtF'|' -c "$SAY" > "$IS/sayim-eski-$ZAMAN.txt"
$PG psql "$YENI_DB_URL" -AtF'|' -c "$SAY" > "$IS/sayim-yeni-$ZAMAN.txt"
if diff "$IS/sayim-eski-$ZAMAN.txt" "$IS/sayim-yeni-$ZAMAN.txt"; then echo "SAYIMLAR AYNI ($(wc -l < "$IS/sayim-eski-$ZAMAN.txt") tablo)"; else echo "FARK VAR (yukarıda)"; fi

echo "== 5/5 Yapı karşılaştırması (fonksiyon/tetikleyici/politika/cron/yayın)"
YAPI="select 'fonksiyon', count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
union all select 'tetikleyici', count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal
union all select 'politika', count(*) from pg_policies where schemaname='public'
union all select 'cron', count(*) from cron.job
union all select 'realtime_tablo', count(*) from pg_publication_tables where pubname='supabase_realtime'"
echo "eski:"; $PG psql "$ESKI_DB_URL" -AtF'|' -c "$YAPI"
echo "yeni:"; $PG psql "$YENI_DB_URL" -AtF'|' -c "$YAPI"
echo "Prova bitti. Dökümler: $IS (gitignore'da)."
