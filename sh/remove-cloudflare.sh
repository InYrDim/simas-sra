#!/bin/sh

set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(dirname -- "$SCRIPT_DIR")
MONOREPO_DIR="$PROJECT_ROOT/monorepo"
OVERRIDE_FILE="$MONOREPO_DIR/compose.cloudflare.yml"
CLOUDFLARE_ENV_FILE="$MONOREPO_DIR/.env.cloudflare"
CONTAINER_NAME="simas-sra-cloudflared"

printf 'HAPUS CLOUDFLARE TUNNEL\n\n'
printf 'Tindakan ini akan:\n'
printf '  - Menghapus container %s\n' "$CONTAINER_NAME"
printf '  - Menghapus %s\n' "$OVERRIDE_FILE"
printf '  - Menghapus file token %s\n' "$CLOUDFLARE_ENV_FILE"
printf '  - Membiarkan container aplikasi dan MySQL tetap berjalan\n\n'
printf 'Lanjutkan? [y/N]: '
IFS= read -r answer || answer=n

case $answer in
  y|Y|yes|YES)
    ;;
  *)
    printf 'Dibatalkan. Tidak ada perubahan yang dilakukan.\n'
    exit 0
    ;;
esac

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    if docker rm --force "$CONTAINER_NAME" >/dev/null; then
      printf '[OK] Container %s dihapus\n' "$CONTAINER_NAME"
    else
      printf '[ERROR] Container %s gagal dihapus\n' "$CONTAINER_NAME" >&2
      exit 1
    fi
  else
    printf '[INFO] Container %s tidak ditemukan\n' "$CONTAINER_NAME"
  fi
else
  printf '[ERROR] Docker tidak tersedia atau daemon tidak aktif\n' >&2
  printf 'File konfigurasi tidak dihapus untuk mencegah tunnel aktif menjadi yatim.\n' >&2
  exit 1
fi

if [ -f "$OVERRIDE_FILE" ]; then
  rm -f "$OVERRIDE_FILE"
  printf '[OK] Cloudflare Compose override dihapus\n'
else
  printf '[INFO] Cloudflare Compose override tidak ditemukan\n'
fi

if [ -f "$CLOUDFLARE_ENV_FILE" ]; then
  rm -f "$CLOUDFLARE_ENV_FILE"
  printf '[OK] File token Cloudflare dihapus\n'
else
  printf '[INFO] File token Cloudflare tidak ditemukan\n'
fi

printf '\nCloudflare Tunnel sudah dihapus. Aplikasi dan MySQL tidak dihentikan.\n'
