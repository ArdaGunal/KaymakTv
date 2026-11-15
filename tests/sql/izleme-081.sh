#!/usr/bin/env bash
# 081 + 082 yerel sınaması — PostgreSQL 15 ve 17 (Docker). Ayrıntı `izleme-081.mjs` başlığında.
# Kullanım: bash tests/sql/izleme-081.sh
# Canlıya DOKUNMAZ; her sürüm için geçici bir kapsayıcı açar ve siler. İmajlar: postgres:15-alpine, postgres:17-alpine.
# Worker deposu kardeş klasörde olmalı (`../kaymaktv-feedback-worker`): eşlik testi onun `lib/ilerleme.js`'ini çağırır.
set -euo pipefail
cd "$(dirname "$0")/../.."
export MSYS_NO_PATHCONV=1
DURUM=0
for SURUM in 15 17; do
  export KAP="kaymak-081-test-$SURUM"
  docker rm -f "$KAP" >/dev/null 2>&1 || true
  docker run -d --name "$KAP" -e POSTGRES_PASSWORD=x "postgres:$SURUM-alpine" >/dev/null
  for _ in $(seq 1 30); do docker exec "$KAP" pg_isready -U postgres -q 2>/dev/null && break; sleep 1; done
  sleep 2 # ilk açılışta sunucu bir kez yeniden başlar
  echo "── PG $SURUM"
  node tests/sql/izleme-081.mjs | grep -E "^(KALDI|SURE|OZET)" || DURUM=1
  docker rm -f "$KAP" >/dev/null 2>&1 || true
done
exit $DURUM
