#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(dirname -- "$SCRIPT_DIR")
MONOREPO_DIR="$PROJECT_ROOT/monorepo"
ENV_FILE="$MONOREPO_DIR/.env"
COMPOSE_FILE="$MONOREPO_DIR/compose.prod.yml"
OVERRIDE_FILE="$MONOREPO_DIR/compose.cloudflare.yml"
BACKUP_DIR=${SIMAS_BACKUP_DIR:-"$PROJECT_ROOT/../simas-backups"}
NETWORK_NAME="simas-production-net"

compose() {
  docker compose \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    -f "$OVERRIDE_FILE" \
    "$@"
}

fail() {
  printf '[ERROR] %s\n' "$1" >&2
  exit 1
}

for file in "$ENV_FILE" "$COMPOSE_FILE" "$OVERRIDE_FILE"; do
  [ -f "$file" ] || fail "File tidak ditemukan: $file"
done

command -v docker >/dev/null 2>&1 || fail "Docker tidak terpasang"
docker info >/dev/null 2>&1 || fail "Docker daemon tidak aktif atau tidak dapat diakses"
docker compose version >/dev/null 2>&1 || fail "Docker Compose tidak tersedia"
compose --profile tools config --quiet || fail "Konfigurasi Docker Compose tidak valid"

RUNNING_SERVICES=$(compose ps --status running --services)
if [ -n "$RUNNING_SERVICES" ]; then
  DEPLOY_MODE="redeploy"
  STACK_WAS_RUNNING=1
else
  DEPLOY_MODE="fresh deploy"
  STACK_WAS_RUNNING=0
fi

cat <<EOF
PRODUCTION DEPLOY

Mode terdeteksi: $DEPLOY_MODE

Tindakan yang akan dilakukan:
  1. Backup database jika MySQL sudah berjalan
  2. Pull image aplikasi dan migrator terbaru
  3. Jalankan database migration
  4. Hentikan dan buat ulang stack production
  5. Gunakan network $NETWORK_NAME tanpa published ports
  6. Verifikasi koneksi internal ke http://app:3000

Named volume database dan file aplikasi tidak akan dihapus.
EOF

printf '\nLanjutkan %s? [y/N]: ' "$DEPLOY_MODE"
IFS= read -r answer || answer=n
case $answer in
  y|Y|yes|YES)
    ;;
  *)
    printf 'Dibatalkan. Tidak ada perubahan yang dilakukan.\n'
    exit 0
    ;;
esac

if printf '%s\n' "$RUNNING_SERVICES" | grep -qx mysql; then
  mkdir -p "$BACKUP_DIR"
  BACKUP_FILE="$BACKUP_DIR/simas-$(date +%Y%m%d-%H%M%S).sql"

  printf '\n[1/6] Membuat backup database...\n'
  if compose exec -T mysql sh -c 'exec mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' >"$BACKUP_FILE"; then
    if [ -s "$BACKUP_FILE" ]; then
      printf '[OK] Backup tersimpan: %s\n' "$BACKUP_FILE"
    else
      rm -f "$BACKUP_FILE"
      fail "Backup database kosong"
    fi
  else
    rm -f "$BACKUP_FILE"
    fail "Backup database gagal; redeploy dihentikan"
  fi
else
  printf '\n[1/6] MySQL belum berjalan; backup dilewati untuk fresh deploy.\n'
fi

printf '\n[2/6] Menarik image terbaru...\n'
compose --profile tools pull app migrate cloudflared

printf '\n[3/6] Menjalankan database migration...\n'
compose --profile tools run --rm migrate

if [ "$STACK_WAS_RUNNING" -eq 1 ]; then
  printf '\n[4/6] Menghentikan stack lama...\n'
  compose down
else
  printf '\n[4/6] Tidak ada stack lama; langkah down dilewati.\n'
fi

printf '\n[5/6] Menjalankan stack pada network %s...\n' "$NETWORK_NAME"
compose up -d

printf '\n[6/6] Memverifikasi deployment...\n'
compose ps

docker network inspect "$NETWORK_NAME" >/dev/null 2>&1 || fail "Network $NETWORK_NAME tidak ditemukan"

if docker run --rm --network "$NETWORK_NAME" curlimages/curl:latest \
  --silent --show-error --fail --output /dev/null http://app:3000/; then
  printf '[OK] Aplikasi dapat dijangkau dari network internal\n'
else
  fail "Aplikasi tidak dapat dijangkau melalui http://app:3000"
fi

if docker network inspect simas-sra-production >/dev/null 2>&1; then
  printf '[INFO] Network lama simas-sra-production masih tersedia.\n'
  printf '       Hapus manual setelah memastikan tidak digunakan container lain:\n'
  printf '       docker network rm simas-sra-production\n'
fi

printf '\n%s selesai. Periksa log dengan:\n' "$DEPLOY_MODE"
printf '  docker logs --since 10m simas-sra-app\n'
printf '  docker logs --since 10m simas-sra-cloudflared\n'
