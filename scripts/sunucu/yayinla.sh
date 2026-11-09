#!/usr/bin/env bash
# ==========================================================================
# KaymakTV yayın betiği — GNL-SERVER (taşıma D7; Pi'deki `kaymakbaslat`ın karşılığı)
# ==========================================================================
# Sunucuda `gnl` kullanıcısıyla: bash /srv/projeler/kaymaktv/app/scripts/sunucu/yayinla.sh [seçenek]
#
#   1. git pull --ff-only
#   2. npm ci — YALNIZ package.json / package-lock.json / patches/ değiştiyse (ya da --npm, ya da
#      node_modules yoksa). 🔴 npm ci node_modules'u TÜMDEN silip kurar; çalışan süreç sonradan
#      tembel `require` yaparsa düşer → npm ci çalıştıysa servis HEMEN ve HER ZAMAN yeniden başlar
#      (danışman 002 §3.3).
#   3. Web paketi `dist.yeni`'ye derlenir; başarılıysa `dist` ile yer değiştirir. Derleme düşerse
#      `dist`'e DOKUNULMAZ (eski paket yayında kalır) ve betik hata verir.
#      YAYIN_DERLEME_ENV=<dosya>: EXPO_PUBLIC_* değerleri bu dosyadan (scripts/sunucu/derleme-env.js).
#   4. server.js / server/ / package*.json değiştiyse (ya da --yeniden) servis yeniden başlar.
#   5. http://127.0.0.1:<port>/api/health 200 beklenir (en çok YAYIN_SAGLIK_SN sn).
#
# Seçenekler: --yeniden (servisi her durumda yeniden başlat) · --npm (npm ci zorla) ·
#             --derle (değişiklik olmasa da web paketini derle)
# Ortam: KAYMAK_APP (/srv/projeler/kaymaktv/app) · KAYMAK_BIRIM (kaymaktv) · KAYMAK_PORT (4830) ·
#        KAYMAK_NODE_BIN (varsayılan: /usr/local/bin/kaymak-node'un gerçek dizini) ·
#        YAYIN_DERLEME_ENV · YAYIN_SAGLIK_SN (60) ·
#        YAYIN_KURU=1 → hiçbir şey değiştirmez, yalnız adımları yazar (değişen dosyalar son
#        `git fetch`e göre `HEAD..@{upstream}`).
#
# 🔴 Gövde main() içinde ve EN SONDA çağrılır: bash betiği okurken çalıştırır; `git pull` bu dosyayı
# değiştirirse yarım okunmuş eski/yeni karışımı çalışmasın diye önce bütün dosya ayrıştırılır.
set -euo pipefail

main() {
  : "${RES_OPTIONS:=single-request-reopen}"   # sunucuda DNS 5 sn (glibc A+AAAA); npm/git hızlansın
  export RES_OPTIONS
  local APP="${KAYMAK_APP:-/srv/projeler/kaymaktv/app}"
  local BIRIM="${KAYMAK_BIRIM:-kaymaktv}"
  local PORT="${KAYMAK_PORT:-4830}"
  local KURU="${YAYIN_KURU:-0}"
  local SAGLIK_SN="${YAYIN_SAGLIK_SN:-60}"
  local DERLEME_ENV="${YAYIN_DERLEME_ENV:-}"
  local BETIK_DIZINI
  BETIK_DIZINI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local ZORLA_YENIDEN=0 ZORLA_NPM=0 ZORLA_DERLE=0 a
  for a in "$@"; do
    case "$a" in
      --yeniden) ZORLA_YENIDEN=1 ;;
      --npm) ZORLA_NPM=1 ;;
      --derle) ZORLA_DERLE=1 ;;
      -h|--help) sed -n '2,27p' "${BASH_SOURCE[0]}"; return 0 ;;
      *) echo "bilinmeyen secenek: $a (--yeniden | --npm | --derle)" >&2; return 2 ;;
    esac
  done

  if [[ "$(id -u)" == "0" ]]; then echo "root olarak calistirma — gnl kullanicisiyla calistir." >&2; return 2; fi

  # Node yalnız /opt altında; PATH'te `node` olmayabilir (npm/npx `#!/usr/bin/env node`).
  local NODE_BIN="${KAYMAK_NODE_BIN:-}"
  if [[ -z "$NODE_BIN" && -e /usr/local/bin/kaymak-node ]]; then NODE_BIN="$(dirname "$(readlink -f /usr/local/bin/kaymak-node)")"; fi
  if [[ -n "$NODE_BIN" ]]; then export PATH="$NODE_BIN:$PATH"; fi
  local arac
  for arac in git node npm npx curl; do
    command -v "$arac" >/dev/null || { echo "bulunamadi: $arac (KAYMAK_NODE_BIN?)" >&2; return 2; }
  done
  if [[ -n "$DERLEME_ENV" && ! -r "$DERLEME_ENV" ]]; then echo "YAYIN_DERLEME_ENV okunamiyor: $DERLEME_ENV" >&2; return 2; fi

  calistir() { if [[ "$KURU" == "1" ]]; then echo "KURU $*"; else "$@"; fi; }
  yeniden_baslat() { echo "==> servis yeniden baslatiliyor: $BIRIM ($1)"; calistir sudo -n systemctl restart "$BIRIM"; }

  cd "$APP"
  local ONCE SONRA DEGISEN
  ONCE="$(git rev-parse HEAD)"
  echo "==> git pull --ff-only (once ${ONCE:0:7})"
  calistir git pull --ff-only
  if [[ "$KURU" == "1" ]]; then
    SONRA="$ONCE"
    DEGISEN="$(git diff --name-only HEAD '@{upstream}' 2>/dev/null || true)"
  else
    SONRA="$(git rev-parse HEAD)"
    DEGISEN="$(git diff --name-only "$ONCE" "$SONRA")"
  fi
  echo "==> commit ${ONCE:0:7} -> ${SONRA:0:7}; degisen dosya: $(printf '%s' "$DEGISEN" | grep -c . || true)"

  local NPM=$ZORLA_NPM YENIDEN=$ZORLA_YENIDEN DERLE=$ZORLA_DERLE YENIDEN_YAPILDI=0
  if grep -qE '^(package\.json|package-lock\.json|patches/)' <<<"$DEGISEN"; then NPM=1; fi
  [[ -d node_modules ]] || NPM=1
  if grep -qE '^(server\.js|server/|package\.json|package-lock\.json)' <<<"$DEGISEN"; then YENIDEN=1; fi
  [[ -n "$DEGISEN" ]] && DERLE=1
  [[ -d dist ]] || DERLE=1

  if [[ "$NPM" == "1" ]]; then
    echo "==> npm ci"
    calistir npm ci
    yeniden_baslat "npm ci node_modules'u yeniledi"
    YENIDEN_YAPILDI=1
  fi

  if [[ "$DERLE" == "1" ]]; then
    echo "==> web paketi derleniyor -> dist.yeni${DERLEME_ENV:+ (EXPO_PUBLIC_* : $DERLEME_ENV)}"
    calistir rm -rf dist.yeni
    local derle_kod=0
    if [[ -n "$DERLEME_ENV" ]]; then
      calistir node "$BETIK_DIZINI/derleme-env.js" "$DERLEME_ENV" -- npx expo export --platform web --output-dir dist.yeni || derle_kod=$?
    else
      calistir npx expo export --platform web --output-dir dist.yeni || derle_kod=$?
    fi
    if [[ "$derle_kod" != "0" ]] || { [[ "$KURU" != "1" ]] && [[ ! -f dist.yeni/index.html ]]; }; then
      calistir rm -rf dist.yeni
      echo "!! DERLEME DUSTU (kod $derle_kod) — dist'e DOKUNULMADI, eski paket yayinda." >&2
      return 1
    fi
    if [[ -d dist ]]; then calistir mv dist dist.eski; fi
    calistir mv dist.yeni dist
    calistir rm -rf dist.eski
    echo "==> dist yenilendi"
  fi

  if [[ "$YENIDEN" == "1" && "$YENIDEN_YAPILDI" == "0" ]]; then yeniden_baslat "sunucu kodu degisti"; fi

  if [[ "$KURU" == "1" ]]; then echo "KURU saglik http://127.0.0.1:$PORT/api/health"; return 0; fi
  echo "==> saglik bekleniyor: http://127.0.0.1:$PORT/api/health (en cok ${SAGLIK_SN} sn)"
  local kod="" bas=$SECONDS
  while (( SECONDS - bas < SAGLIK_SN )); do
    kod="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$PORT/api/health" || true)"
    [[ "$kod" == "200" ]] && break
    sleep 2
  done
  if [[ "$kod" != "200" ]]; then
    echo "!! saglik ${kod:-yanitsiz} — journalctl -u $BIRIM -n 80 --no-pager" >&2
    return 1
  fi
  echo "==> TAMAM: ${SONRA:0:7} · npm ci=$NPM · derleme=$DERLE · yeniden baslatma=$(( YENIDEN || YENIDEN_YAPILDI )) · saglik 200"
}

main "$@"
