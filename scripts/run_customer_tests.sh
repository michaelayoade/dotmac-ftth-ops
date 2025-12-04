#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SKIP_MIGRATIONS=${SKIP_MIGRATIONS:-0}

export DOTMAC_DATABASE_URL=${DOTMAC_DATABASE_URL:-"postgresql://dotmac_test:dotmac_test@localhost:6543/dotmac_test"}
export DOTMAC_DATABASE_URL_ASYNC=${DOTMAC_DATABASE_URL_ASYNC:-"postgresql+asyncpg://dotmac_test:dotmac_test@localhost:6543/dotmac_test"}

pg_isready -d "${DOTMAC_DATABASE_URL}" >/dev/null 2>&1 || {
  echo "Warning: Unable to connect to ${DOTMAC_DATABASE_URL}. Ensure the test database is running." >&2
}

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
