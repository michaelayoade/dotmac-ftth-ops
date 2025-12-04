"""
Root pytest configuration for the DotMac test suite.

Fixture implementations are split across lightweight plugin modules to keep
this file concise and easier to navigate.
"""

# Load .env file BEFORE any fixture modules are imported (opt-in only)
# This guard prevents local developer .env files from overriding pytest defaults
# such as the in-memory SQLite database used by integration suites.
import os
import re
from pathlib import Path

_project_root = Path(__file__).resolve().parents[1]
_default_env = _project_root / ".env"
_preexisting_env_keys = set(os.environ)

_load_env_flag = os.environ.get("DOTMAC_TEST_LOAD_ENV")
if _load_env_flag is None:
    # Auto-enable when dedicated test env files are present (keeps old opt-in behaviour otherwise)
    _load_env_for_tests = any(
        (_project_root / candidate).exists() for candidate in (".env.integration", ".env.testing")
    )
else:
    _load_env_for_tests = _load_env_flag.strip().lower() in {"1", "true", "yes", "on"}

_env_candidates: list[Path] = []
if custom_path := os.environ.get("DOTMAC_TEST_ENV_FILE"):
    _env_candidates.append(_project_root / custom_path)
else:
    _env_candidates.extend(
        [
            _project_root / ".env.integration",
            _project_root / ".env.testing",
            _default_env,
        ]
    )

_selected_env: Path | None = None
for candidate in _env_candidates:
    if candidate.exists():
        _selected_env = candidate
        break

if _load_env_for_tests and _selected_env:
    # First pass: collect all variables
    env_vars = {}
    with open(_selected_env) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip()

            # Remove quotes
            if value.startswith('"') and value.endswith('"'):
                value = value[1:-1]
            elif value.startswith("'") and value.endswith("'"):
                value = value[1:-1]

            if key:
                env_vars[key] = value

    # Second pass: expand variable references (${VAR} syntax)
    def expand_vars(value, env_dict):
        """Expand ${VAR} references in value using env_dict."""
        # Match ${VAR_NAME} pattern
        pattern = r"\$\{([^}]+)\}"

        def replacer(match):
            var_name = match.group(1)
            # Try env_dict first, then os.environ
            return env_dict.get(var_name) or os.environ.get(var_name, match.group(0))

        # Keep expanding until no more ${} patterns (max 10 iterations to prevent infinite loops)
        for _ in range(10):
            new_value = re.sub(pattern, replacer, value)
            if new_value == value:  # No more substitutions
                break
            value = new_value

        return value

    # Expand all values and set in environment
    for key, value in env_vars.items():
        expanded_value = expand_vars(value, env_vars)
        # Only set if not already set (command line takes precedence)
        if key not in os.environ:
            os.environ[key] = expanded_value

# Disable heavy subscription load tests unless explicitly enabled via environment
if (
    "RUN_SUBSCRIPTION_LOAD_TESTS" in os.environ
    and "RUN_SUBSCRIPTION_LOAD_TESTS" not in _preexisting_env_keys
):
    os.environ["RUN_SUBSCRIPTION_LOAD_TESTS"] = "0"
elif "RUN_SUBSCRIPTION_LOAD_TESTS" not in os.environ:
    os.environ["RUN_SUBSCRIPTION_LOAD_TESTS"] = "0"

# Now load fixture plugins (environment vars are already set)
pytest_plugins = [
    "tests.fixtures.environment",
    "tests.fixtures.database",
    "tests.fixtures.mocks",
    "tests.fixtures.async_support",
    "tests.fixtures.cleanup",
    "tests.fixtures.app",
    "tests.fixtures.misc",
    "tests.fixtures.billing_support",
    "tests.fixtures.async_db",
    "tests.fixtures.cache_bypass",
    "tests.conftest_rls_helpers",  # RLS test helpers with auto-bypass
]
