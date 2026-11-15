#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

run_step() {
  local status
  "$@" || {
    status=$?
    echo "Step failed with exit code ${status}: $*" >&2
    exit "${status}"
  }
}

cp .env.example .env

run_step npm install
run_step docker compose --profile dev up -d --build --wait
run_step docker compose --profile dev exec -T api-dev npm run migrate -- up
run_step docker compose --profile dev exec api-dev npm run seed -- --wipe
