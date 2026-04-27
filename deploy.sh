#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '== %s ==\n' "$1"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'ERROR: %s is not available locally\n' "$1" >&2
    exit 1
  }
}

load_env_file() {
  local env_file="$1"

  if [ -f "$env_file" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$env_file"
    set +a
  fi
}

build_and_push_image() {
  local latest_image="${IMAGE_NAME}:latest"
  local build_site_url="${NUXT_DEPLOY_SITE_URL:-$NUXT_SITE_URL}"

  if docker buildx version >/dev/null 2>&1; then
    docker buildx build \
      --platform "$DOCKER_PLATFORM" \
      --build-arg "NUXT_SITE_URL=$build_site_url" \
      --build-arg "NUXT_UMAMI_HOST=${NUXT_UMAMI_HOST:-}" \
      --build-arg "NUXT_UMAMI_ID=${NUXT_UMAMI_ID:-}" \
      --build-arg "NUXT_UMAMI_TAG=${NUXT_UMAMI_TAG:-}" \
      -t "$IMAGE" \
      -t "$latest_image" \
      --push \
      .
    return
  fi

  docker build \
    --platform "$DOCKER_PLATFORM" \
    --build-arg "NUXT_SITE_URL=$build_site_url" \
    --build-arg "NUXT_UMAMI_HOST=${NUXT_UMAMI_HOST:-}" \
    --build-arg "NUXT_UMAMI_ID=${NUXT_UMAMI_ID:-}" \
    --build-arg "NUXT_UMAMI_TAG=${NUXT_UMAMI_TAG:-}" \
    -t "$IMAGE" \
    -t "$latest_image" \
    .
  docker push "$IMAGE"
  docker push "$latest_image"
}

remote_compose_up() {
  ssh "$VPS_HOST" 'bash -se' <<EOF
set -euo pipefail

cd "${COMPOSE_DIR}"

export IMAGE="${IMAGE}"

echo "== Pull images =="
docker compose pull

if [ "${APPLY_MIGRATIONS_ON_DEPLOY}" = "true" ]; then
  if docker compose config --services | grep -qx "${COMPOSE_POSTGRES_SERVICE}"; then
    echo "== Ensure postgres is running =="
    docker compose up -d "${COMPOSE_POSTGRES_SERVICE}"
  fi

  echo "== Apply database migrations =="
  docker compose run -T --rm "${COMPOSE_APP_SERVICE}" /app/ops/migrate.mjs </dev/null
fi

echo "== Recreate containers =="
docker compose up -d
EOF
}

load_env_file ".env"

: "${VPS_HOST:?ERROR: VPS_HOST is required}"
: "${REMOTE_DIR:?ERROR: REMOTE_DIR is required}"
: "${NUXT_SITE_URL:?ERROR: NUXT_SITE_URL is required}"

require_command docker
require_command ssh
require_command git

IMAGE_NAME="${IMAGE_NAME:-ghcr.io/creup-dev/recuento}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
IMAGE="${IMAGE:-${IMAGE_NAME}:${IMAGE_TAG}}"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"
APPLY_MIGRATIONS_ON_DEPLOY="${APPLY_MIGRATIONS_ON_DEPLOY:-true}"
COMPOSE_DIR="${COMPOSE_DIR:-$REMOTE_DIR}"
COMPOSE_APP_SERVICE="${COMPOSE_APP_SERVICE:-app}"
COMPOSE_POSTGRES_SERVICE="${COMPOSE_POSTGRES_SERVICE:-postgres}"
GHCR_LOGIN="${GHCR_LOGIN:-false}"

if [ "$GHCR_LOGIN" = "true" ]; then
  : "${GHCR_USERNAME:?ERROR: GHCR_USERNAME is required when GHCR_LOGIN=true}"
  : "${GHCR_TOKEN:?ERROR: GHCR_TOKEN is required when GHCR_LOGIN=true}"
  log "GHCR login"
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
fi

log "Build and push: $IMAGE"
build_and_push_image

log "Deploy to VPS with docker compose"
remote_compose_up

printf 'Deploy finished successfully\n'
