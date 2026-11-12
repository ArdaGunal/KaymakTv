#!/usr/bin/env bash
# 078 fixture testi — yerel PostgreSQL 17 (Docker) üzerinde `hesap-durumu-078.sql` koşar.
# Kullanım: bash tests/sql/hesap-durumu-078.sh
# Canlıya DOKUNMAZ; geçici bir kapsayıcı açar ve siler. İmaj: postgres:17-alpine (yerelde olmalı).
set -euo pipefail
KOK="$(cd "$(dirname "$0")/../.." && (pwd -W 2>/dev/null || pwd))"
AD="kaymak-078-test"
export MSYS_NO_PATHCONV=1
docker rm -f "$AD" >/dev/null 2>&1 || true
docker run -d --name "$AD" -e POSTGRES_PASSWORD=x -v "$KOK:/depo:ro" postgres:17-alpine >/dev/null
trap 'docker rm -f "$AD" >/dev/null 2>&1 || true' EXIT
for _ in $(seq 1 30); do docker exec "$AD" pg_isready -U postgres -q 2>/dev/null && break; sleep 1; done
sleep 2 # ilk açılışta sunucu bir kez yeniden başlar
CIKTI="$(docker exec "$AD" psql -U postgres -v ON_ERROR_STOP=1 -q -f /depo/tests/sql/hesap-durumu-078.sql 2>&1)" || { echo "$CIKTI"; echo "psql HATA"; exit 1; }
echo "$CIKTI" | grep -E "^(TAMAM|KALDI|OZET)"
if echo "$CIKTI" | grep -q "^KALDI"; then exit 1; fi
echo "$CIKTI" | grep -q "^OZET .* / 0 kaldi" || { echo "OZET satiri beklenen bicimde degil"; exit 1; }
