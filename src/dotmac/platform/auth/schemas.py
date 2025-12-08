"""
Auth Request/Response Schemas.

Pydantic models for authentication-related API endpoints.
Extracted from router.py to reduce module size and improve maintainability.
"""

from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


# ========================================
# Constants
# ========================================

PASSWORD_COMPLEXITY_MSG = (
    "Password must be at least 12 characters and include upper, lower, number, and symbol."
)


# ========================================
# Password Validation
# ========================================


def validate_password_strength(password: str) -> str:
    """Enforce a reasonable password complexity policy."""
    if len(password) < 12:
        raise ValueError(PASSWORD_COMPLEXITY_MSG)
    if not re.search(r"[A-Z]", password):
        raise ValueError(PASSWORD_COMPLEXITY_MSG)
    if not re.search(r"[a-z]", password):
        raise ValueError(PASSWORD_COMPLEXITY_MSG)
    if not re.search(r"[0-9]", password):
        raise ValueError(PASSWORD_COMPLEXITY_MSG)
    if not re.search(r"[^A-Za-z0-9]", password):
        raise ValueError(PASSWORD_COMPLEXITY_MSG)

    return password


# ========================================
# Login Request/Response Models
# ========================================


class LoginRequest(BaseModel):
    """Login request model supporting username or email."""

    model_config = ConfigDict(populate_by_name=True)

    username: str | None = Field(
        None,
        description="Username (optional if email provided)",
    )
    email: EmailStr | None = Field(
        None,
        description="Email address (alternative to username)",
    )
    tenant: str | None = Field(
        None,
        description="Tenant slug/ID (optional hint for multi-tenant logins; header is ignored)",
    )
    password: str = Field(..., description="Password")

    @model_validator(mode="after")
    def ensure_identifier(self) -> "LoginRequest":
        identifier = self.username or (self.email and self.email.lower())
        if not identifier:
            raise ValueError("Either username or email must be provided")
        # Normalize to username field for downstream logic
        self.username = identifier
        return self


class Verify2FALoginRequest(BaseModel):
    """2FA verification during login request model."""

    model_config = ConfigDict()

    user_id: str = Field(..., description="User ID from login challenge")
    code: str = Field(
        ..., min_length=6, max_length=9, description="TOTP code or backup code (XXXX-XXXX format)"
    )
    is_backup_code: bool = Field(default=False, description="Whether this is a backup code")


class RegenerateBackupCodesRequest(BaseModel):
    """Request model for regenerating backup codes."""

    model_config = ConfigDict()

    password: str = Field(..., min_length=1, description="User password for verification")


class TokenResponse(BaseModel):
    """Token response model."""

    model_config = ConfigDict()

    access_token: str = Field(..., description="Access token")
    refresh_token: str = Field(..., description="Refresh token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiry in seconds")


class LoginSuccessResponse(BaseModel):
    """Cookie-based login success response."""

    model_config = ConfigDict()

    success: bool = Field(default=True, description="Login successful")
    user_id: str = Field(..., description="User ID")
    username: str = Field(..., description="Username")
    email: str = Field(..., description="Email address")
    roles: list[str] = Field(default_factory=list, description="User roles")
    message: str = Field(default="Login successful", description="Success message")


class RefreshTokenRequest(BaseModel):
    """Refresh token request model."""

    model_config = ConfigDict()

    refresh_token: str = Field(..., description="Refresh token")


# ========================================
# Password Reset Models
# ========================================


class PasswordResetRequest(BaseModel):
    """Password reset request model."""

    model_config = ConfigDict()

    email: EmailStr = Field(..., description="Email address")


class PasswordResetConfirm(BaseModel):
    """Password reset confirmation model."""

    model_config = ConfigDict()

    token: str = Field(..., description="Reset token")
    new_password: str = Field(..., min_length=8, description="New password")

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return validate_password_strength(value)


# ========================================
# Profile Models
# ========================================


class UpdateProfileRequest(BaseModel):
    """Update profile request model."""

    model_config = ConfigDict()

    first_name: str | None = Field(None, max_length=100, description="First name")
    last_name: str | None = Field(None, max_length=100, description="Last name")
    email: EmailStr | None = Field(None, description="Email address")
    username: str | None = Field(None, min_length=3, max_length=50, description="Username")
    phone: str | None = Field(
        None, max_length=20, description="Phone number (E.164 format recommended)"
    )
    location: str | None = Field(None, max_length=255, description="Location")
    timezone: str | None = Field(
        None, max_length=50, description="Timezone (e.g., America/New_York)"
    )
    language: str | None = Field(
        None, min_length=2, max_length=10, description="Language code (e.g., en, en-US)"
    )
    bio: str | None = Field(None, max_length=500, description="Bio (max 500 characters)")
    website: str | None = Field(None, max_length=255, description="Website URL")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        """Validate phone number format."""
        if v is None or v.strip() == "":
            return None

        # Basic validation: allow + and digits, spaces, hyphens, parentheses
        if not re.match(r"^[\+\d\s\-\(\)]+$", v):
            raise ValueError(
                "Phone number can only contain digits, +, spaces, hyphens, and parentheses"
            )

        # Remove formatting for length check
        digits_only = re.sub(r"[\s\-\(\)]", "", v)
        if len(digits_only) < 7 or len(digits_only) > 15:
            raise ValueError("Phone number must contain between 7 and 15 digits")

        return v.strip()

    @field_validator("website")
    @classmethod
    def validate_website(cls, v: str | None) -> str | None:
        """Validate website URL format."""
        if v is None or v.strip() == "":
            return None

        url_pattern = re.compile(
            r"^https?://"  # http:// or https://
            r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|"  # domain...
            r"localhost|"  # localhost...
            r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"  # ...or ip
            r"(?::\d+)?"  # optional port
            r"(?:/?|[/?]\S+)$",
            re.IGNORECASE,
        )

        if not url_pattern.match(v):
            raise ValueError("Invalid URL format. Must start with http:// or https://")

        return v.strip()

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str | None) -> str | None:
        """Validate timezone."""
        if v is None or v.strip() == "":
            return None

        try:
            import pytz

            # Check if timezone exists
            pytz.timezone(v)
            return v.strip()
        except pytz.exceptions.UnknownTimeZoneError:
            raise ValueError(
                f"Unknown timezone: {v}. Use standard timezone names like 'America/New_York'"
            )
        except ImportError:
            # If pytz not available, do basic validation
            if not v.strip():
                return None
            return v.strip()

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str | None) -> str | None:
        """Validate language code."""
        if v is None or v.strip() == "":
            return None

        # Accept ISO 639-1 (2 letters) or with region (e.g., en-US)
        if not re.match(r"^[a-z]{2}(-[A-Z]{2})?$", v):
            raise ValueError("Language must be in ISO 639-1 format (e.g., 'en' or 'en-US')")

        return v.strip()

    @field_validator("bio")
    @classmethod
    def validate_bio(cls, v: str | None) -> str | None:
        """Validate bio."""
        if v is None:
            return None

        v = v.strip()
        if len(v) > 500:
            raise ValueError("Bio must not exceed 500 characters")

        return v if v else None

    @field_validator("first_name", "last_name", "location")
    @classmethod
    def validate_text_fields(cls, v: str | None) -> str | None:
        """Validate text fields - trim whitespace."""
        if v is None:
            return None
        v = v.strip()
        return v if v else None


class ChangePasswordRequest(BaseModel):
    """Change password request model."""

    model_config = ConfigDict()

    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password")

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return validate_password_strength(value)


# ========================================
# Email Verification Models
# ========================================


class SendVerificationEmailRequest(BaseModel):
    """Request model for sending verification email."""

    model_config = ConfigDict()

    email: EmailStr = Field(description="Email address to verify")


class ConfirmEmailRequest(BaseModel):
    """Request model for confirming email verification."""

    model_config = ConfigDict()

    token: str = Field(min_length=32, max_length=255, description="Verification token")


# ========================================
# Two-Factor Authentication (2FA) Models
# ========================================


class Enable2FARequest(BaseModel):
    """Request to enable 2FA."""

    model_config = ConfigDict()

    password: str = Field(..., description="User's current password for verification")


class Enable2FAResponse(BaseModel):
    """Response with 2FA setup information."""

    model_config = ConfigDict()

    secret: str = Field(..., description="TOTP secret (show only once)")
    qr_code: str = Field(..., description="QR code data URL for authenticator app")
    backup_codes: list[str] = Field(..., description="Backup codes for account recovery")
    provisioning_uri: str = Field(..., description="Provisioning URI for manual entry")


class Verify2FARequest(BaseModel):
    """Request to verify 2FA token."""

    model_config = ConfigDict()

    token: str = Field(..., description="6-digit TOTP code", min_length=6, max_length=6)


class Disable2FARequest(BaseModel):
    """Request to disable 2FA."""

    model_config = ConfigDict()

    password: str = Field(..., description="User's current password for verification")
    token: str = Field(
        ..., description="6-digit TOTP code for confirmation", min_length=6, max_length=6
    )


# ========================================
# Exported Symbols
# ========================================

__all__ = [
    # Constants
    "PASSWORD_COMPLEXITY_MSG",
    # Validators
    "validate_password_strength",
    # Login
    "LoginRequest",
    "Verify2FALoginRequest",
    "RegenerateBackupCodesRequest",
    "TokenResponse",
    "LoginSuccessResponse",
    "RefreshTokenRequest",
    # Password Reset
    "PasswordResetRequest",
    "PasswordResetConfirm",
    # Profile
    "UpdateProfileRequest",
    "ChangePasswordRequest",
    # Email Verification
    "SendVerificationEmailRequest",
    "ConfirmEmailRequest",
    # 2FA
    "Enable2FARequest",
    "Enable2FAResponse",
    "Verify2FARequest",
    "Disable2FARequest",
]
