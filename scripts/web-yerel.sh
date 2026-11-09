#!/usr/bin/env bash
# Yerel web testi için sunucuda localhost iznini aç / kapat (server/security.js · ALLOW_DEV_ORIGINS).
#
# Neden: localhost:8181'deki web uygulaması TMDB/katalog/arama/Trakt girişi için
# https://kaymaktv.com/api/* adresine gider. Sunucunun CORS kalkanı varsayılan KAPALI
# olduğundan tarayıcı bu yanıtları engeller → yerelde giriş ve içerik çalışmaz.
# (Eski yol `NODE_ENV=development` idi; Madde 233'te ayrıldı, artık KULLANMA.)
#
#   npm run web:yerel-ac       izni açar; sunucu 3 saat sonra KENDİSİ kapatır (unutulmaya karşı)
#   npm run web:yerel-kapat    hemen kapatır
#   npm run web:yerel-durum    açık mı + ölçüm
#
# Uygulama: systemd drop-in (/etc/systemd/system/<birim>.service.d/yerel-web.conf) —
# sunucudaki .env'e DOKUNULMAZ. Aç/kapa canlı servisi birkaç saniyeliğine yeniden başlatır
# (gece zamanlayıcıları servis başlangıcından saydığı için kayar).
#
# Hedef (GNL-SERVER taşıması · D5): varsayılan GNL-SERVER (`gnl@192.168.1.8`, birim `kaymaktv`).
#   KAYMAK_SUNUCU / KAYMAK_SUNUCU_KEY / KAYMAK_BIRIM ile değiştirilir.
#   Eski Pi'yi hedeflemek (geçişe kadar): yalnız KAYMAK_PI=<kullanıcı@adres> ver → anahtar
#   ~/.ssh/kaymak_pi, birim `kaymak` olur (KAYMAK_PI_KEY / KAYMAK_BIRIM yine ezer).
#   WEB_YEREL_KURU=1: SSH/curl ÇALIŞTIRILMAZ, yalnız komutlar yazılır (test ve önizleme).
set -euo pipefail
export MSYS_NO_PATHCONV=1
if [[ -z "${KAYMAK_SUNUCU:-}" && -n "${KAYMAK_PI:-}" ]]; then
  HEDEF="$KAYMAK_PI"
  KEY="${KAYMAK_SUNUCU_KEY:-${KAYMAK_PI_KEY:-$HOME/.ssh/kaymak_pi}}"
  BIRIM="${KAYMAK_BIRIM:-kaymak}"
else
  HEDEF="${KAYMAK_SUNUCU:-gnl@192.168.1.8}"
  KEY="${KAYMAK_SUNUCU_KEY:-$HOME/.ssh/gnl_server}"
  BIRIM="${KAYMAK_BIRIM:-kaymaktv}"
fi
SURE="${WEB_YEREL_SURE:-3h}"
KURU="${WEB_YEREL_KURU:-0}"
DROPIN="/etc/systemd/system/${BIRIM}.service.d/yerel-web.conf"
KAPAT="${BIRIM}-yerel-web-kapat"
sunucu() {
  if [[ "$KURU" == "1" ]]; then printf 'KURU ssh %s -i %s %s\n' "$HEDEF" "$KEY" "$*"; return 0; fi
  ssh -o ConnectTimeout=10 -o IdentitiesOnly=yes -i "$KEY" "$HEDEF" "$@"
}
bekle() { [[ "$KURU" == "1" ]] || sleep "$1"; }

olc() {
  if [[ "$KURU" == "1" ]]; then echo "KURU olcum https://kaymaktv.com/api/tmdb/configuration (Origin: http://localhost:8181)"; return 0; fi
  local acao
  acao=$(curl -s -o /dev/null -D - -H "Origin: http://localhost:8181" https://kaymaktv.com/api/tmdb/configuration \
    | grep -i '^access-control-allow-origin' | tr -d '\r' || true)
  if [[ -n "$acao" ]]; then echo "Olcum: localhost:8181 IZINLI ($acao)"; else echo "Olcum: localhost:8181 REDDEDILIYOR (kalkan kapali)"; fi
}

case "${1:-durum}" in
  ac)
    sunucu "sudo mkdir -p /etc/systemd/system/${BIRIM}.service.d && \
        printf '[Service]\nEnvironment=ALLOW_DEV_ORIGINS=1\n' | sudo tee $DROPIN >/dev/null && \
        sudo systemctl daemon-reload && sudo systemctl restart ${BIRIM}.service && \
        sudo systemctl stop ${KAPAT}.timer 2>/dev/null; \
        sudo systemctl reset-failed ${KAPAT}.service ${KAPAT}.timer 2>/dev/null; \
        sudo systemd-run --unit=${KAPAT} --on-active=$SURE \
          /bin/sh -c 'rm -f $DROPIN && systemctl daemon-reload && systemctl restart ${BIRIM}.service' >/dev/null && \
        echo 'Sunucu: ALLOW_DEV_ORIGINS=1 ACIK, otomatik kapanis $SURE sonra'"
    bekle 4; olc ;;
  kapat)
    sunucu "sudo rm -f $DROPIN && sudo systemctl daemon-reload && sudo systemctl restart ${BIRIM}.service && \
        sudo systemctl stop ${KAPAT}.timer 2>/dev/null; echo 'Sunucu: izin KAPATILDI'"
    bekle 4; olc ;;
  durum)
    sunucu "if [ -f $DROPIN ]; then echo 'Sunucu: drop-in VAR (izin acik)'; systemctl list-timers ${KAPAT}.timer --no-pager 2>/dev/null | sed -n 2p; else echo 'Sunucu: drop-in YOK (izin kapali)'; fi"
    olc ;;
  *) echo "kullanim: $0 ac|kapat|durum"; exit 1 ;;
esac
