"""Lightweight symmetric encryption helpers used in tests and legacy code."""

# mypy: ignore-errors

from __future__ import annotations

import base64
import hashlib
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Any

try:  # pragma: no cover - optional dependency
    from cryptography.fernet import Fernet
    from cryptography.fernet import InvalidToken as FernetInvalidToken
except Exception:  # pragma: no cover - cryptography may be absent
    Fernet = None  # type: ignore
    FernetInvalidToken = Exception  # type: ignore


class DataClassification(str, Enum):
    """Simple data-classification levels used by the encryption service."""

    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


@dataclass
class EncryptedField:
    """Container for encrypted payloads."""

    algorithm: str
    encrypted_data: str
    classification: DataClassification
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    metadata: dict[str, Any] = field(default_factory=dict)


class SymmetricEncryptionService:
    """Very small symmetric encryption helper.

    The service prefers Fernet (if the ``cryptography`` package is available)
    and falls back to simple base64 encoding with an HMAC-style key fingerprint
    when Fernet cannot be used. The implementation intentionally keeps a narrow
    surface area because the tests only require round-trip encryption and basic
    metadata.
    """

    def __init__(self, secret: str, *, prefer_fernet: bool = True) -> None:
        if not secret:
            raise ValueError("secret must be a non-empty string")

        self._secret = secret.encode()
        self._prefer_fernet = prefer_fernet
        self._fernet: Fernet | None = None

        if prefer_fernet and Fernet is not None:  # pragma: no branch
            key_material = hashlib.sha256(self._secret).digest()
            fernet_key = base64.urlsafe_b64encode(key_material)
            try:
                self._fernet = Fernet(fernet_key)
            except Exception:  # pragma: no cover - guard against invalid key
                self._fernet = None

    # ------------------------------------------------------------------
    # Public helpers
    # ------------------------------------------------------------------
    def encrypt(
        self,
        plaintext: str,
        classification: DataClassification = DataClassification.INTERNAL,
        *,
        algorithm: str | None = None,
    ) -> EncryptedField:
        if not isinstance(plaintext, str):
            raise TypeError("plaintext must be a string")

        algorithm = (algorithm or "fernet").lower()
        metadata: dict[str, Any] = {
            "classification": classification.value,
            "fingerprint": hashlib.sha1(self._secret, usedforsecurity=False).hexdigest(),  # nosec B324 - SHA1 for fingerprint only,
        }

        if algorithm == "fernet" and self._fernet is not None:
            token = self._fernet.encrypt(plaintext.encode())
            encrypted = token.decode()
            used_algorithm = "fernet"
        else:
            # Fallback to reversible base64 encoding with XOR obfuscation.
            obfuscated = self._xor_bytes(plaintext.encode(), self._secret)
            encrypted = base64.b64encode(obfuscated).decode()
            used_algorithm = "base64"

        return EncryptedField(
            algorithm=used_algorithm,
            encrypted_data=encrypted,
            classification=classification,
            metadata=metadata,
        )

    def decrypt(self, field: EncryptedField) -> str:
        if field.algorithm == "fernet" and self._fernet is not None:
            try:
                result = self._fernet.decrypt(field.encrypted_data.encode())
            except FernetInvalidToken as exc:  # pragma: no cover - defensive guard
                raise ValueError("invalid fernet token") from exc
            return result.decode()

        if field.algorithm in {"base64", "fallback"}:
            raw = base64.b64decode(field.encrypted_data)
            plain = self._xor_bytes(raw, self._secret)
            return plain.decode()

        raise ValueError(f"Unsupported algorithm '{field.algorithm}'")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _xor_bytes(data: bytes, key: bytes) -> bytes:
        if not key:
            raise ValueError("key must not be empty")
        key_len = len(key)
        return bytes(b ^ key[i % key_len] for i, b in enumerate(data))


__all__ = [
    "DataClassification",
    "EncryptedField",
    "SymmetricEncryptionService",
]
