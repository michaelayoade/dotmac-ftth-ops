"""
License Models

Defines the license token structure and related types.
"""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any

import jwt


class OveragePolicy(Enum):
    """Policy for handling subscriber cap overages."""
    BLOCK = "block"           # Hard block at cap
    WARN = "warn"             # Allow but warn
    ALLOW_AND_BILL = "allow_and_bill"  # Allow and charge overage


@dataclass
class LicenseToken:
    """
    Signed license blob from Control Plane.

    Contains tenant limits, features, and enforcement policies.
    Issued by Control Plane, validated by ISP App.
    """

    tenant_id: str
    max_subscribers: int
    overage_policy: OveragePolicy
    features: dict[str, bool]
    issued_at: datetime
    expires_at: datetime
    nonce: str
    version: int

    # Thresholds
    warn_threshold_percent: int = 80
    critical_threshold_percent: int = 90
    grace_period_hours: int = 24

    def to_jwt(self, secret_key: str) -> str:
        """Sign license as JWT."""
        payload = {
            "tenant_id": self.tenant_id,
            "max_subscribers": self.max_subscribers,
            "overage_policy": self.overage_policy.value,
            "features": self.features,
            "iat": int(self.issued_at.timestamp()),
            "exp": int(self.expires_at.timestamp()),
            "nonce": self.nonce,
            "version": self.version,
            "warn_threshold": self.warn_threshold_percent,
            "critical_threshold": self.critical_threshold_percent,
            "grace_hours": self.grace_period_hours,
        }
        return jwt.encode(payload, secret_key, algorithm="HS256")

    @classmethod
    def from_jwt(cls, token: str, secret_key: str) -> "LicenseToken":
        """Verify and decode license JWT."""
        try:
            payload = jwt.decode(token, secret_key, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            raise LicenseExpiredError("License token has expired")
        except jwt.InvalidTokenError as e:
            raise LicenseInvalidError(f"Invalid license token: {e}")

        return cls(
            tenant_id=payload["tenant_id"],
            max_subscribers=payload["max_subscribers"],
            overage_policy=OveragePolicy(payload["overage_policy"]),
            features=payload["features"],
            issued_at=datetime.fromtimestamp(payload["iat"]),
            expires_at=datetime.fromtimestamp(payload["exp"]),
            nonce=payload["nonce"],
            version=payload["version"],
            warn_threshold_percent=payload.get("warn_threshold", 80),
            critical_threshold_percent=payload.get("critical_threshold", 90),
            grace_period_hours=payload.get("grace_hours", 24),
        )

    def is_feature_enabled(self, feature: str) -> bool:
        """Check if a feature is enabled in this license."""
        return self.features.get(feature, False)

    def get_usage_status(self, current_subscribers: int) -> dict[str, Any]:
        """Get current usage status relative to limits."""
        usage_percent = (current_subscribers / self.max_subscribers) * 100 if self.max_subscribers > 0 else 0

        status = "ok"
        if usage_percent >= self.critical_threshold_percent:
            status = "critical"
        elif usage_percent >= self.warn_threshold_percent:
            status = "warning"

        return {
            "current_subscribers": current_subscribers,
            "max_subscribers": self.max_subscribers,
            "usage_percent": round(usage_percent, 1),
            "status": status,
            "overage_policy": self.overage_policy.value,
            "warn_threshold": self.warn_threshold_percent,
            "critical_threshold": self.critical_threshold_percent,
        }


# Exceptions
class LicenseError(Exception):
    """Base exception for license errors."""
    pass


class LicenseExpiredError(LicenseError):
    """License has expired."""
    pass


class LicenseInvalidError(LicenseError):
    """License is invalid or tampered."""
    pass


class SubscriberCapExceededError(LicenseError):
    """Subscriber cap has been exceeded."""
    pass


class FeatureNotLicensedError(LicenseError):
    """Feature is not included in the license."""
    pass
