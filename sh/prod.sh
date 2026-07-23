#!/bin/sh

set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(dirname -- "$SCRIPT_DIR")
MONOREPO_DIR="$PROJECT_ROOT/monorepo"
COMPOSE_FILE="$MONOREPO_DIR/compose.prod.yml"
OVERRIDE_FILE="$MONOREPO_DIR/compose.cloudflare.yml"
ENV_FILE="$MONOREPO_DIR/.env"
CLOUDFLARE_ENV_FILE="$MONOREPO_DIR/.env.cloudflare"
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

generate_cloudflare_override() {
  token=$1

  umask 077
  printf 'TUNNEL_TOKEN=%s\n' "$token" >"$CLOUDFLARE_ENV_FILE"
  cat >"$OVERRIDE_FILE" <<'EOF'
services:
  mysql:
    container_name: simas-sra-mysql

  app:
    container_name: simas-sra-app

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: simas-sra-cloudflared
    restart: always
    command: tunnel --no-autoupdate run
    env_file:
      - .env.cloudflare
    depends_on:
      - app
    networks:
      - production
EOF

  pass "Cloudflare override dibuat: $OVERRIDE_FILE"
  pass "Token Cloudflare disimpan: $CLOUDFLARE_ENV_FILE"
}

prompt_cloudflare() {
  while :; do
    printf '\nTambahkan Cloudflare Tunnel? [y/N]: '
    IFS= read -r answer || answer=n

    case $answer in
      y|Y|yes|YES)
        printf 'Masukkan token Cloudflare Tunnel: '
        if [ -t 0 ]; then
          stty -echo
          IFS= read -r token
          stty echo
          printf '\n'
        else
          IFS= read -r token
        fi

        if [ -z "$token" ]; then
          fail "Token Cloudflare Tunnel tidak boleh kosong"
          return
        fi

        generate_cloudflare_override "$token"
        USE_CLOUDFLARE=1
        return
        ;;
      n|N|no|NO|'')
        USE_CLOUDFLARE=0
        return
        ;;
      *)
        printf 'Jawab y atau n.\n' >&2
        ;;
    esac
  done
}

printf 'VALIDASI PRODUCTION\n\n'

check_path directory "$MONOREPO_DIR" "Folder monorepo"
check_path file "$COMPOSE_FILE" "File konfigurasi Docker Compose"
check_path file "$ENV_FILE" "File environment production"

check_env DB_NAME
check_env DB_USER
check_env DB_PASSWORD
check_env DB_ROOT_PASSWORD

check_env BETTER_AUTH_SECRET
check_env BETTER_AUTH_URL
check_env APP_DOMAIN

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

USE_CLOUDFLARE=0
prompt_cloudflare

if [ "$ERRORS" -gt 0 ]; then
  printf '\nKonfigurasi gagal. Deployment belum siap.\n' >&2
  exit 1
fi

if [ "$USE_CLOUDFLARE" -eq 1 ]; then
  if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" config --quiet >/dev/null 2>&1; then
    pass "Konfigurasi Compose dengan Cloudflare Tunnel valid"
  else
    fail "Konfigurasi Compose dengan Cloudflare Tunnel tidak valid"
    exit 1
  fi

  COMPOSE_ARGS="--env-file \"$ENV_FILE\" -f \"$COMPOSE_FILE\" -f \"$OVERRIDE_FILE\""
else
  COMPOSE_ARGS="--env-file \"$ENV_FILE\" -f \"$COMPOSE_FILE\""
fi

cat <<EOF

Semua validasi berhasil. Production siap dijalankan.

Image aplikasi:
  $IMAGE

Network terisolasi antar-service:
  simas-production-net

Jalankan deployment:
  docker compose $COMPOSE_ARGS --profile tools pull app migrate
  docker compose $COMPOSE_ARGS --profile tools run --rm migrate
  docker compose $COMPOSE_ARGS up -d

Periksa status dan log:
  docker compose $COMPOSE_ARGS ps
  docker compose $COMPOSE_ARGS logs -f app

Service aplikasi dan MySQL hanya tersedia di network Docker internal.
Cadangkan volume db_data dan app_files sebelum melakukan update production.
EOF
