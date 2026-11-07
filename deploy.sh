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

# Under WSL (what a bare `bash` typed in PowerShell resolves to) the Linux ssh
# reads the distro's own ~/.ssh, without the keys and host aliases of
# %USERPROFILE%\.ssh. Windows' ssh.exe authenticates like every other shell.
resolve_ssh_bin() {
  SSH_BIN=ssh
  if [ -n "${WSL_DISTRO_NAME:-}" ] && command -v ssh.exe >/dev/null 2>&1; then
    SSH_BIN=ssh.exe
  fi
  require_command "$SSH_BIN"
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
  "$SSH_BIN" "$VPS_HOST" 'bash -se' <<EOF
set -euo pipefail

# Every docker compose call below reads /dev/null: bash reads this script from
# stdin, and a child that reads it (docker compose exec and run do, even with
# -T) swallows the rest of the script, which then ends early with status 0.
cd "${COMPOSE_DIR}"

# Per-project var (compose reads ${RECUENTO_IMAGE:-...}), never a bare IMAGE.
export RECUENTO_IMAGE="${IMAGE}"

cleanup_old_images() {
  local retention="${DEPLOY_IMAGE_RETENTION}"
  local keep_ids kept=0 removed=0 image_id full_id

  if [ "\$retention" -le 0 ]; then
    echo "== Skip old image cleanup =="
    return
  fi

  echo "== Clean old Docker images =="
  # Newest first, sorted here (the containerd image store does not list them
  # in creation order); the deployed image always stays.
  keep_ids=" \$(docker image inspect --format '{{.Id}}' "${IMAGE}" 2>/dev/null || true) "
  while read -r image_id; do
    [ -n "\$image_id" ] || continue
    full_id="\$(docker image inspect --format '{{.Id}}' "\$image_id")"
    if [[ "\$keep_ids" == *" \$full_id "* ]] || [ "\$kept" -lt "\$retention" ]; then
      kept=\$((kept + 1))
      continue
    fi
    if docker image rm -f "\$image_id" >/dev/null 2>&1; then
      removed=\$((removed + 1))
    fi
  done < <(docker image ls "${IMAGE_NAME}" --format '{{.CreatedAt}}|{{.ID}}' | sort -r | cut -d'|' -f2 | awk '!seen[\$0]++')
  echo "    kept \$kept, removed \$removed"
}

echo "== Pull images =="
docker compose pull "${COMPOSE_APP_SERVICE}" </dev/null

if [ "${APPLY_MIGRATIONS_ON_DEPLOY}" = "true" ]; then
  if docker compose config --services </dev/null | grep -qx "${COMPOSE_POSTGRES_SERVICE}"; then
    echo "== Ensure postgres is running =="
    # Started if stopped, never recreated: on the VPS it is the PostgreSQL
    # shared by every project, and a plain \`up -d\` (or a run/up of the app
    # without --no-deps) recreates it whenever its config drifted.
    docker compose up -d --no-recreate --wait --wait-timeout 120 "${COMPOSE_POSTGRES_SERVICE}" </dev/null
  fi

  echo "== Apply database migrations =="
  docker compose run -T --rm --no-deps "${COMPOSE_APP_SERVICE}" /app/ops/migrate.mjs </dev/null
fi

echo "== Recreate containers =="
docker compose up -d --no-deps "${COMPOSE_APP_SERVICE}" </dev/null

echo "== Wait for the app to be healthy =="
container_id="\$(docker compose ps -q "${COMPOSE_APP_SERVICE}" </dev/null)"
status=missing
for _ in \$(seq 1 50); do
  status="\$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "\$container_id" 2>/dev/null || echo missing)"
  case "\$status" in
    healthy | no-healthcheck | missing) break ;;
  esac
  sleep 3
done
case "\$status" in
  healthy) echo "    healthy" ;;
  no-healthcheck) echo "    no healthcheck defined, not waiting" ;;
  *)
    echo "ERROR: ${COMPOSE_APP_SERVICE} is \$status. Last logs:" >&2
    docker compose logs --tail 80 "${COMPOSE_APP_SERVICE}" </dev/null >&2 || true
    exit 1
    ;;
esac

echo "== Persist RECUENTO_IMAGE in .env =="
# Without this, RECUENTO_IMAGE only exists in this SSH session. Any later bare
# \`docker compose up -d\` (a reboot, a manual restart, bringing up another
# service) would resolve \${RECUENTO_IMAGE:-...} back to its ':latest' fallback
# and silently revert this container to whatever ':latest' is cached locally --
# which can be arbitrarily stale, since deploys pull the sha tag, never
# ':latest'. Compose auto-loads .env from the project dir on every invocation.
# The upsert is anchored on ^RECUENTO_IMAGE= so sibling projects' keys
# (WEB_IMAGE, INTRANET_IMAGE) in the same shared .env are left untouched.
RECUENTO_IMAGE_ENV_LINE="RECUENTO_IMAGE=${IMAGE}"
if [ -f .env ] && grep -q '^RECUENTO_IMAGE=' .env; then
  TMP_ENV="\$(mktemp)"
  sed "s|^RECUENTO_IMAGE=.*|\$RECUENTO_IMAGE_ENV_LINE|" .env > "\$TMP_ENV"
  cat "\$TMP_ENV" > .env
  rm -f "\$TMP_ENV"
else
  # Never glue the line onto another project's last key.
  if [ -s .env ] && [ -n "\$(tail -c1 .env)" ]; then
    printf '\n' >> .env
  fi
  printf '%s\n' "\$RECUENTO_IMAGE_ENV_LINE" >> .env
fi
echo "    \$RECUENTO_IMAGE_ENV_LINE"

services="\$(docker compose config --services </dev/null)"
if grep -qx "${COMPOSE_NGINX_SERVICE}" <<< "\$services"; then
  echo "== Reload NGINX =="
  docker compose exec -T "${COMPOSE_NGINX_SERVICE}" nginx -s reload </dev/null
fi

cleanup_old_images

echo "${REMOTE_DONE_MARKER}"
EOF
}

# The remote side must say it finished: a script cut short (a swallowed stdin,
# a dropped connection) cannot pass for a successful deploy.
REMOTE_DONE_MARKER="== Remote deploy done =="

load_env_file ".env"

: "${VPS_HOST:?ERROR: VPS_HOST is required}"
: "${REMOTE_DIR:?ERROR: REMOTE_DIR is required}"
: "${NUXT_SITE_URL:?ERROR: NUXT_SITE_URL is required}"

require_command docker
resolve_ssh_bin
require_command git

IMAGE_NAME="${IMAGE_NAME:-ghcr.io/creup-dev/recuento}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
IMAGE="${IMAGE:-${IMAGE_NAME}:${IMAGE_TAG}}"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"
APPLY_MIGRATIONS_ON_DEPLOY="${APPLY_MIGRATIONS_ON_DEPLOY:-true}"
COMPOSE_DIR="${COMPOSE_DIR:-$REMOTE_DIR}"
COMPOSE_APP_SERVICE="${COMPOSE_APP_SERVICE:-app}"
COMPOSE_POSTGRES_SERVICE="${COMPOSE_POSTGRES_SERVICE:-postgres}"
COMPOSE_NGINX_SERVICE="${COMPOSE_NGINX_SERVICE:-nginx}"
GHCR_LOGIN="${GHCR_LOGIN:-false}"
DEPLOY_IMAGE_RETENTION="${DEPLOY_IMAGE_RETENTION:-2}"

if ! [[ "$DEPLOY_IMAGE_RETENTION" =~ ^[0-9]+$ ]]; then
  printf 'ERROR: DEPLOY_IMAGE_RETENTION must be a non-negative integer\n' >&2
  exit 1
fi

if [ "$GHCR_LOGIN" = "true" ]; then
  : "${GHCR_USERNAME:?ERROR: GHCR_USERNAME is required when GHCR_LOGIN=true}"
  : "${GHCR_TOKEN:?ERROR: GHCR_TOKEN is required when GHCR_LOGIN=true}"
  log "GHCR login"
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
fi

log "Build and push: $IMAGE"
build_and_push_image

log "Deploy to VPS with docker compose"
remote_log="$(mktemp)"
trap 'rm -f "$remote_log"' EXIT
remote_compose_up | tee "$remote_log"
if ! grep -qxF "$REMOTE_DONE_MARKER" "$remote_log"; then
  printf 'ERROR: the remote deploy stopped before its last step\n' >&2
  exit 1
fi

printf 'Deploy finished successfully\n'
