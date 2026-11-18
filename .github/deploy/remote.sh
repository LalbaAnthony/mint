#!/usr/bin/env bash
set -euo pipefail

readonly published_images=(mint-api mint-web)
declare -A previous_image_ids=()

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

familiar_reference() {
  local reference="${1#docker.io/}"
  printf '%s\n' "${reference#library/}"
}

local_image_id() {
  docker image ls --quiet --no-trunc "$(familiar_reference "$1")"
}

record_previous_image_ids() {
  local references reference image_id
  references="$(next_compose config --images db api web)"
  while IFS= read -r reference; do
    image_id="$(local_image_id "$reference")"
    previous_image_ids["$reference"]="$image_id"
  done <<<"$references"
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

remove_replaced_images() {
  local reference previous_id current_id
  for reference in "${!previous_image_ids[@]}"; do
    previous_id="${previous_image_ids[$reference]}"
    current_id="$(local_image_id "$reference")"
    if [[ -n "$previous_id" && "$previous_id" != "$current_id" ]]; then
      docker image rm "$previous_id" >/dev/null ||
        echo "::warning::could not remove image ${previous_id} replaced under ${reference}"
    fi
  done
}

main() {
  exec </dev/null
  require_variables
  mkdir -p "$DEPLOY_PATH"
  cd "$DEPLOY_PATH"
  trap 'rm -f .env.next docker-compose.next.yml' EXIT
  write_release_files
  record_previous_image_ids

  echo "::group::Pull images ${DEPLOY_SHA}"
  next_compose pull --quiet db api web worker
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
  remove_replaced_images
  echo "::endgroup::"
}

main
