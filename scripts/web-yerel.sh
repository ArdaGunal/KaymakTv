#!/usr/bin/env bash
# Yerel web testi için Pi'de localhost iznini aç / kapat (server/security.js · ALLOW_DEV_ORIGINS).
#
# Neden: localhost:8181'deki web uygulaması TMDB/katalog/arama/Trakt girişi için
# https://kaymaktv.com/api/* adresine gider. Pi'nin CORS kalkanı varsayılan KAPALI
# olduğundan tarayıcı bu yanıtları engeller → yerelde giriş ve içerik çalışmaz.
# (Eski yol `NODE_ENV=development` idi; Madde 233'te ayrıldı, artık KULLANMA.)
#
#   npm run web:yerel-ac       izni açar; Pi 3 saat sonra KENDİSİ kapatır (unutulmaya karşı)
#   npm run web:yerel-kapat    hemen kapatır
#   npm run web:yerel-durum    açık mı + ölçüm
#
# Uygulama: systemd drop-in (/etc/systemd/system/kaymak.service.d/yerel-web.conf) —
# Pi'deki .env'e DOKUNULMAZ. Aç/kapa canlı servisi birkaç saniyeliğine yeniden başlatır
# (Pi zamanlayıcıları servis başlangıcından saydığı için kayar).
set -euo pipefail
export MSYS_NO_PATHCONV=1
PI="${KAYMAK_PI:-GNL@192.168.1.15}"
KEY="${KAYMAK_PI_KEY:-$HOME/.ssh/kaymak_pi}"
SURE="${WEB_YEREL_SURE:-3h}"
DROPIN=/etc/systemd/system/kaymak.service.d/yerel-web.conf
pi() { ssh -o ConnectTimeout=10 -i "$KEY" "$PI" "$@"; }

olc() {
  local acao
  acao=$(curl -s -o /dev/null -D - -H "Origin: http://localhost:8181" https://kaymaktv.com/api/tmdb/configuration \
    | grep -i '^access-control-allow-origin' | tr -d '\r' || true)
  if [[ -n "$acao" ]]; then echo "Olcum: localhost:8181 IZINLI ($acao)"; else echo "Olcum: localhost:8181 REDDEDILIYOR (kalkan kapali)"; fi
}

case "${1:-durum}" in
  ac)
    pi "sudo mkdir -p /etc/systemd/system/kaymak.service.d && \
        printf '[Service]\nEnvironment=ALLOW_DEV_ORIGINS=1\n' | sudo tee $DROPIN >/dev/null && \
        sudo systemctl daemon-reload && sudo systemctl restart kaymak.service && \
        sudo systemctl stop kaymak-yerel-web-kapat.timer 2>/dev/null; \
        sudo systemctl reset-failed kaymak-yerel-web-kapat.service kaymak-yerel-web-kapat.timer 2>/dev/null; \
        sudo systemd-run --unit=kaymak-yerel-web-kapat --on-active=$SURE \
          /bin/sh -c 'rm -f $DROPIN && systemctl daemon-reload && systemctl restart kaymak.service' >/dev/null && \
        echo 'Pi: ALLOW_DEV_ORIGINS=1 ACIK, otomatik kapanis $SURE sonra'"
    sleep 4; olc ;;
  kapat)
    pi "sudo rm -f $DROPIN && sudo systemctl daemon-reload && sudo systemctl restart kaymak.service && \
        sudo systemctl stop kaymak-yerel-web-kapat.timer 2>/dev/null; echo 'Pi: izin KAPATILDI'"
    sleep 4; olc ;;
  durum)
    pi "if [ -f $DROPIN ]; then echo 'Pi: drop-in VAR (izin acik)'; systemctl list-timers kaymak-yerel-web-kapat.timer --no-pager 2>/dev/null | sed -n 2p; else echo 'Pi: drop-in YOK (izin kapali)'; fi"
    olc ;;
  *) echo "kullanim: $0 ac|kapat|durum"; exit 1 ;;
esac
