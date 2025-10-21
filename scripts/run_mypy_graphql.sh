#!/usr/bin/env bash

# Run MyPy against the GraphQL package with a consistent configuration.
# Usage: ./scripts/run_mypy_graphql.sh

set -euo pipefail

REPO_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
cd "$REPO_ROOT"

if ! command -v poetry >/dev/null 2>&1; then
  echo "poetry not found on PATH" >&2
  exit 1
fi

poetry run mypy src/dotmac/platform/graphql "$@"
