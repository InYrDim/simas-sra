#!/bin/sh

set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(dirname -- "$SCRIPT_DIR")
MONOREPO_DIR="$PROJECT_ROOT/monorepo"
COMPOSE_FILE="$MONOREPO_DIR/compose.prod.yml"
ENV_FILE="$MONOREPO_DIR/.env"
IMAGE="iyedeh/simas-sra:latest"
ERRORS=0

pass() {
  printf '[OK] %s\n' "$1"
}

fail() {
  printf '[ERROR] %s\n' "$1" >&2
  ERRORS=$((ERRORS + 1))
}

check_path() {
  if [ "$1" = "directory" ] && [ -d "$2" ]; then
    pass "$3"
  elif [ "$1" = "file" ] && [ -f "$2" ]; then
    pass "$3"
  else
    fail "$3 tidak ditemukan: $2"
  fi
}

check_env() {
  key=$1

  if [ ! -f "$ENV_FILE" ]; then
    return
  fi

  if grep -Eq "^[[:space:]]*$key=.+" "$ENV_FILE"; then
    pass "Variabel $key tersedia"
  else
    fail "Variabel $key belum diisi di $ENV_FILE"
  fi
}

printf 'VALIDASI PRODUCTION\n\n'

check_path directory "$MONOREPO_DIR" "Folder monorepo"
check_path file "$COMPOSE_FILE" "File konfigurasi Docker Compose"
check_path file "$ENV_FILE" "File environment production"

check_env DB_NAME
check_env DB_USER
check_env DB_PASSWORD
check_env DB_ROOT_PASSWORD
check_env DB_PORT
check_env BETTER_AUTH_SECRET
check_env BETTER_AUTH_URL

if command -v docker >/dev/null 2>&1; then
  pass "Docker tersedia"

  if docker info >/dev/null 2>&1; then
    pass "Docker daemon aktif"
  else
    fail "Docker daemon tidak aktif atau tidak dapat diakses"
  fi

  if docker compose version >/dev/null 2>&1; then
    pass "Docker Compose tersedia"
  else
    fail "Plugin Docker Compose tidak tersedia"
  fi
else
  fail "Docker tidak terpasang"
fi

if [ -f "$COMPOSE_FILE" ] && [ -f "$ENV_FILE" ] && command -v docker >/dev/null 2>&1; then
  if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet >/dev/null 2>&1; then
    pass "Konfigurasi Docker Compose valid"
  else
    fail "Konfigurasi Docker Compose tidak valid"
  fi
fi

if [ "$ERRORS" -gt 0 ]; then
  printf '\nValidasi gagal dengan %s masalah. Deployment belum siap.\n' "$ERRORS" >&2
  exit 1
fi

cat <<EOF

Semua validasi berhasil. Production siap dijalankan.

Image aplikasi:
  $IMAGE

Jalankan deployment:
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d

Periksa status dan log:
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs -f app

Pastikan port 3000 dan DB_PORT tersedia, serta cadangkan volume db_data dan
app_files sebelum melakukan update production.
EOF
