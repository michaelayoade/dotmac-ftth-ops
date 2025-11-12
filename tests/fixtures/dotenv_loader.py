"""
Pytest plugin to automatically load .env file for tests.

This ensures environment variables from .env are available when running:
    poetry run pytest tests/billing -m integration

Without needing to manually export them or use the shell script.
"""

import os
from pathlib import Path


def pytest_configure(config):
    """Load .env file at the start of pytest session."""
    # Find project root (where .env file is located)
    project_root = Path(__file__).resolve().parents[2]
    env_file = project_root / ".env"

    if not env_file.exists():
        return

    # Load .env file and set environment variables
    # Only set if not already set (command line takes precedence)
    with open(env_file) as f:
        for line in f:
            line = line.strip()

            # Skip empty lines and comments
            if not line or line.startswith("#"):
                continue

            # Skip lines that don't contain '='
            if "=" not in line:
                continue

            # Parse key=value
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip()

            # Remove quotes if present
            if value.startswith('"') and value.endswith('"'):
                value = value[1:-1]
            elif value.startswith("'") and value.endswith("'"):
                value = value[1:-1]

            # Only set if not already set (preserves command line overrides)
            if key and key not in os.environ:
                os.environ[key] = value
