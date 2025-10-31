"""
Centralized version utilities for dotmac-isp-ops.

Provides a single source of truth for the application version, working both
when the package is installed and when running from a source checkout.
"""

from __future__ import annotations

from functools import lru_cache
from importlib import metadata
from pathlib import Path

try:  # Python 3.11+
    import tomllib  # type: ignore[attr-defined]
except ModuleNotFoundError:  # pragma: no cover - compatibility fallback
    try:
        import tomli as tomllib  # type: ignore[no-redef]
    except ModuleNotFoundError:  # pragma: no cover - final fallback
        tomllib = None  # type: ignore[assignment]

PACKAGE_NAME = "dotmac-isp-ops"


@lru_cache(maxsize=1)
def get_version() -> str:
    """Return the package version.

    Tries to read the version from installed package metadata first. If the
    package isn't installed (e.g., running from source), it falls back to
    parsing pyproject.toml.
    """
    try:
        return metadata.version(PACKAGE_NAME)
    except metadata.PackageNotFoundError:
        try:
            if tomllib is None:
                raise RuntimeError("tomllib/tomli unavailable")

            version_file = next(
                (
                    candidate
                    for candidate in (
                        parent / "pyproject.toml" for parent in Path(__file__).resolve().parents
                    )
                    if candidate.is_file()
                ),
                None,
            )

            if version_file is None:
                raise FileNotFoundError("pyproject.toml not found in parent directories")

            with version_file.open("rb") as fp:
                data = tomllib.load(fp)
            return data["tool"]["poetry"]["version"]
        except Exception:  # pragma: no cover - defensive fallback
            return "0.0.0"


__all__ = ["get_version", "PACKAGE_NAME"]
