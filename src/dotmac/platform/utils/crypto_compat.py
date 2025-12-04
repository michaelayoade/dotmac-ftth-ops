"""
Compatibility helpers for third-party crypto libraries.

Some environments ship a minimal ``bcrypt`` build that omits the ``__about__``
metadata attribute Passlib expects. When Passlib attempts to introspect the
backend it accesses ``_bcrypt.__about__.__version__`` and crashes if that
object is missing.  To avoid depending on a specific wheel layout we inject a
tiny shim before Passlib is imported.
"""

from __future__ import annotations

import logging
from types import SimpleNamespace
from typing import Any

logger = logging.getLogger(__name__)


def ensure_bcrypt_metadata() -> None:
    """
    Ensure the imported ``bcrypt`` module exposes ``__about__.__version__``.

    Passlib relies on this attribute to detect the backend version.  Older or
    nonstandard builds may omit it, which leads to a ``LookupError`` during
    application start-up.  When the attribute is missing we add a lightweight
    ``SimpleNamespace`` that exposes the version information Passlib needs.
    """

    try:
        import bcrypt  # type: ignore
    except Exception as exc:  # pragma: no cover - defensive import guard
        logger.debug("Unable to import bcrypt for compatibility patch: %s", exc)
        return

    about: Any | None = getattr(bcrypt, "__about__", None)
    version = getattr(bcrypt, "__version__", None) or "unknown"

    if about is None:
        bcrypt.__about__ = SimpleNamespace(__version__=version)  # type: ignore[attr-defined]
        logger.debug("Injected __about__ metadata for bcrypt %s", version)
        return

    if not hasattr(about, "__version__"):
        about.__version__ = version
        logger.debug("Supplied missing __version__ attribute for bcrypt %s", version)
