#!/usr/bin/env bash
set -euo pipefail

# Test runner for dotmac-platform-services using the local .venv
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -f .venv/bin/activate ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
else
  echo "Warning: .venv not found in $REPO_ROOT; attempting system pytest" >&2
fi

echo "Running pytest in $(pwd) ..."
pytest "$@"

