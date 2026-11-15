#!/usr/bin/env bash
# 080 yerel sınaması — PostgreSQL 15 ve 17 (Docker) üzerinde `080_display_name_kurali.sql`.
# Kullanım: bash tests/sql/gorunen-ad-080.sh
# Canlıya DOKUNMAZ; her sürüm için geçici bir kapsayıcı açar ve siler.
# İmajlar: postgres:15-alpine, postgres:17-alpine (yerelde olmalı).
set -euo pipefail
KOK="$(cd "$(dirname "$0")/../.." && (pwd -W 2>/dev/null || pwd))"
cd "$(dirname "$0")/../.."
export MSYS_NO_PATHCONV=1
DENEMELER="$(node tests/sql/gorunen-ad-080-uret.mjs)"
DURUM=0
for SURUM in 15 17; do
  AD="kaymak-080-test-$SURUM"
  docker rm -f "$AD" >/dev/null 2>&1 || true
  docker run -d --name "$AD" -e POSTGRES_PASSWORD=x -v "$KOK:/depo:ro" "postgres:$SURUM-alpine" >/dev/null
  for _ in $(seq 1 30); do docker exec "$AD" pg_isready -U postgres -q 2>/dev/null && break; sleep 1; done
  sleep 2 # ilk açılışta sunucu bir kez yeniden başlar
  CIKTI="$( { cat tests/sql/gorunen-ad-080.sql; echo "$DENEMELER"; cat tests/sql/gorunen-ad-080-son.sql; } \
    | docker exec -i "$AD" psql -U postgres -v ON_ERROR_STOP=1 -q -f - 2>&1)" || { echo "$CIKTI" | tail -20; echo "PG $SURUM: psql HATA"; DURUM=1; }
  docker rm -f "$AD" >/dev/null 2>&1 || true
  echo "── PG $SURUM"
  echo "$CIKTI" | grep -E "^KALDI" || true
  echo "$CIKTI" | grep -E "^OZET" || { echo "OZET satiri yok"; DURUM=1; }
  if echo "$CIKTI" | grep -q "^KALDI"; then DURUM=1; fi
done
exit $DURUM
