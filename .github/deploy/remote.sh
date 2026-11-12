#!/usr/bin/env bash
set -euo pipefail

readonly published_images=(mint-api mint-web)

require_variables() {
  local name
  for name in DEPLOY_PATH DEPLOY_SHA DEPLOY_IMAGE_NAMESPACE DEPLOY_API_PORT \
    DEPLOY_WEB_PORT DEPLOY_ENV_FILE_BASE64 DEPLOY_COMPOSE_FILE_BASE64; do
    if [[ -z "${!name:-}" ]]; then
      echo "::error::remote deploy variable ${name} is missing"
      exit 1
    fi
  done
}

write_release_files() {
  umask 077
  printf '%s' "$DEPLOY_ENV_FILE_BASE64" | base64 -d >.env.next
  printf '%s' "$DEPLOY_COMPOSE_FILE_BASE64" | base64 -d >docker-compose.next.yml
}

next_compose() {
  docker compose --file docker-compose.next.yml --env-file .env.next "$@"
}

check_health() {
  local curl_options=(--fail --silent --show-error --retry 5
    --retry-connrefused --retry-delay 2)
  curl "${curl_options[@]}" "http://127.0.0.1:${DEPLOY_API_PORT}/api/v1/health"
  echo
  curl "${curl_options[@]}" --output /dev/null \
    "http://127.0.0.1:${DEPLOY_WEB_PORT}/"
  echo "web answered on 127.0.0.1:${DEPLOY_WEB_PORT}"
}

remove_previous_images() {
  local image repository reference
  for image in "${published_images[@]}"; do
    repository="${DEPLOY_IMAGE_NAMESPACE}/${image}"
    while IFS= read -r reference; do
      if [[ "$reference" != "${repository}:${DEPLOY_SHA}" ]]; then
        docker image rm "$reference" >/dev/null ||
          echo "::warning::could not remove image ${reference}"
      fi
    done < <(docker image ls --filter dangling=false \
      --format '{{.Repository}}:{{.Tag}}' "$repository")
  done
}

main() {
  exec </dev/null
  require_variables
  mkdir -p "$DEPLOY_PATH"
  cd "$DEPLOY_PATH"
  trap 'rm -f .env.next docker-compose.next.yml' EXIT
  write_release_files

  echo "::group::Pull images ${DEPLOY_SHA}"
  next_compose pull --quiet api web
  echo "::endgroup::"

  echo "::group::Run migrations"
  next_compose run --rm --no-TTY --quiet-pull api node dist/db/migrate.js up
  echo "::endgroup::"

  mv -f .env.next .env
  mv -f docker-compose.next.yml docker-compose.yml

  echo "::group::Restart services"
  docker compose up --detach --no-build --quiet-pull --wait --wait-timeout 180
  echo "::endgroup::"

  echo "::group::Health check"
  check_health
  echo "::endgroup::"

  echo "::group::Remove previous images"
  remove_previous_images
  echo "::endgroup::"
}

main
