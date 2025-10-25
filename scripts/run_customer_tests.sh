#!/usr/bin/env bash

set -euo pipefail

COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.test-db.yml}
SERVICE_NAME=${SERVICE_NAME:-db-test}
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER_ID=""
SKIP_COMPOSE=${SKIP_COMPOSE:-0}
SKIP_MIGRATIONS=${SKIP_MIGRATIONS:-0}

export DOTMAC_DATABASE_URL=${DOTMAC_DATABASE_URL:-"postgresql://dotmac_test:dotmac_test@localhost:6543/dotmac_test"}
export DOTMAC_DATABASE_URL_ASYNC=${DOTMAC_DATABASE_URL_ASYNC:-"postgresql+asyncpg://dotmac_test:dotmac_test@localhost:6543/dotmac_test"}

cleanup() {
  if [[ "${SKIP_COMPOSE}" -ne 1 && -n "${CONTAINER_ID}" ]]; then
    docker compose -f "${COMPOSE_FILE}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ "${SKIP_COMPOSE}" -ne 1 ]]; then
  docker compose -f "${COMPOSE_FILE}" up -d "${SERVICE_NAME}"
  CONTAINER_ID=$(docker compose -f "${COMPOSE_FILE}" ps -q "${SERVICE_NAME}")

  echo "Waiting for ${SERVICE_NAME} to become healthy..."
  for _ in {1..30}; do
    status=$(docker inspect --format='{{.State.Health.Status}}' "${CONTAINER_ID}" 2>/dev/null || echo "starting")
    if [[ "${status}" == "healthy" ]]; then
      break
    fi
    sleep 1
  done

  status=$(docker inspect --format='{{.State.Health.Status}}' "${CONTAINER_ID}" 2>/dev/null || echo "unhealthy")
  if [[ "${status}" != "healthy" ]]; then
    echo "PostgreSQL test database did not become healthy (status: ${status})." >&2
    exit 1
  fi
else
  echo "SKIP_COMPOSE=1 set; assuming PostgreSQL is available at ${DOTMAC_DATABASE_URL}."
fi

if [[ "${SKIP_MIGRATIONS}" -ne 1 ]]; then
  echo "Applying database migrations..."
  (
    cd "${PROJECT_DIR}"
    poetry run alembic upgrade head
  )
else
  echo "SKIP_MIGRATIONS=1 set; skipping Alembic upgrade."
fi

echo "Running customer management test suite..."
(
  cd "${PROJECT_DIR}"
  poetry run pytest tests/customer_management "$@"
)
