#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(dirname -- "$SCRIPT_DIR")
MONOREPO_DIR="$PROJECT_ROOT/monorepo"
DOCKERFILE="$MONOREPO_DIR/Dockerfile"

TAG=${1:-latest}
DOCKERHUB_NAMESPACE=${DOCKERHUB_NAMESPACE:-iyedeh}
APP_REPOSITORY=${APP_REPOSITORY:-simas-sra}
MIGRATOR_REPOSITORY=${MIGRATOR_REPOSITORY:-simas-sra-migrate}
APP_IMAGE="$DOCKERHUB_NAMESPACE/$APP_REPOSITORY:$TAG"
MIGRATOR_IMAGE="$DOCKERHUB_NAMESPACE/$MIGRATOR_REPOSITORY:$TAG"

fail() {
  printf '[ERROR] %s\n' "$1" >&2
  exit 1
}

case $TAG in
  ""|*[!A-Za-z0-9_.-]*)
    fail "Tag Docker tidak valid: $TAG"
    ;;
esac

[ -f "$DOCKERFILE" ] || fail "Dockerfile tidak ditemukan: $DOCKERFILE"
command -v docker >/dev/null 2>&1 || fail "Docker tidak terpasang"
docker info >/dev/null 2>&1 || fail "Docker daemon tidak aktif atau tidak dapat diakses"

cat <<EOF
BUILD DAN PUSH IMAGE SIMAS

Build context : $MONOREPO_DIR
Application   : $APP_IMAGE
Migrator      : $MIGRATOR_IMAGE
EOF

printf '\n[1/4] Build image aplikasi...\n'
docker build \
  --file "$DOCKERFILE" \
  --target runner \
  --tag "$APP_IMAGE" \
  "$MONOREPO_DIR"

printf '\n[2/4] Build image migrator...\n'
docker build \
  --file "$DOCKERFILE" \
  --target migrator \
  --tag "$MIGRATOR_IMAGE" \
  "$MONOREPO_DIR"

printf '\n[3/4] Push image aplikasi ke Docker Hub...\n'
docker push "$APP_IMAGE"

printf '\n[4/4] Push image migrator ke Docker Hub...\n'
docker push "$MIGRATOR_IMAGE"

cat <<EOF

[OK] Build dan push selesai.

Image yang tersedia:
  $APP_IMAGE
  $MIGRATOR_IMAGE
EOF

if [ "$TAG" != "latest" ]; then
  cat <<EOF

Catatan: compose.prod.yml menggunakan tag latest.
Jalankan ulang dengan tag latest atau ubah referensi image production
sebelum menjalankan redeploy.
EOF
fi
