"""
Multi-Factor Authentication (MFA) Service.

Provides TOTP-based two-factor authentication using pyotp.
"""

import base64
import io
import uuid
from datetime import UTC, datetime

import pyotp
import qrcode
import structlog
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import hash_password, verify_password

logger = structlog.get_logger(__name__)


class MFAService:
    """Service for managing two-factor authentication."""

    def __init__(self, issuer: str = "DotMac Platform") -> None:
        """
        Initialize MFA service.

        Args:
            issuer: The issuer name shown in authenticator apps
        """
        self.issuer = issuer

    def generate_secret(self) -> str:
        """
        Generate a new TOTP secret.

        Returns:
            Base32-encoded secret string
        """
        return pyotp.random_base32()

    def get_provisioning_uri(self, secret: str, account_name: str) -> str:
        """
        Generate provisioning URI for QR code.

        Args:
            secret: TOTP secret
            account_name: User's email or username

        Returns:
            Provisioning URI for authenticator apps
        """
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(name=account_name, issuer_name=self.issuer)

    def generate_qr_code(self, provisioning_uri: str) -> str:
        """
        Generate QR code as base64 encoded PNG.

        Args:
            provisioning_uri: TOTP provisioning URI

        Returns:
            Base64-encoded PNG image data
        """
        # Create QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(provisioning_uri)
        qr.make(fit=True)

        # Generate image
        img = qr.make_image(fill_color="black", back_color="white")

        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        img_data = buffer.getvalue()
        img_base64 = base64.b64encode(img_data).decode()

        return f"data:image/png;base64,{img_base64}"

    def verify_token(self, secret: str, token: str) -> bool:
        """
        Verify a TOTP token.

        Args:
            secret: TOTP secret
            token: 6-digit TOTP code

        Returns:
            True if token is valid, False otherwise
        """
        try:
            totp = pyotp.TOTP(secret)
            # Verify with 1 period window tolerance (30s before/after)
            return totp.verify(token, valid_window=1)
        except Exception as e:
            logger.error("Failed to verify TOTP token", error=str(e))
            return False

    def get_current_token(self, secret: str) -> str:
        """
        Get current TOTP token for testing.

        Args:
            secret: TOTP secret

        Returns:
            Current 6-digit TOTP code
        """
        totp = pyotp.TOTP(secret)
        return totp.now()

    def generate_backup_codes(self, count: int = 10) -> list[str]:
        """
        Generate backup codes for account recovery.

        Args:
            count: Number of backup codes to generate

        Returns:
            List of backup codes in plaintext (store hashed!)
        """
        import secrets
        import string

        alphabet = string.ascii_uppercase
        codes = []
        for _ in range(count):
            raw = "".join(secrets.choice(alphabet) for _ in range(8))
            formatted_code = f"{raw[:4]}-{raw[4:]}"
            codes.append(formatted_code)

        return codes

    async def store_backup_codes(
        self, user_id: uuid.UUID | str, codes: list[str], session: AsyncSession, tenant_id: str
    ) -> None:
        """
        Store hashed backup codes in database.

        Args:
            user_id: User ID
            codes: Plaintext backup codes to hash and store
            session: Database session
            tenant_id: Tenant ID for multi-tenancy
        """
        from dotmac.platform.user_management.models import BackupCode

        # Convert user_id to UUID if string
        if isinstance(user_id, str):
            user_id = uuid.UUID(user_id)

        # Delete existing backup codes for user
        await session.execute(delete(BackupCode).where(BackupCode.user_id == user_id))

        # Store new hashed backup codes
        for code in codes:
            hashed_code = hash_password(code)
            backup_code = BackupCode(
                user_id=user_id,
                code_hash=hashed_code,
                used=False,
                tenant_id=tenant_id,
            )
            session.add(backup_code)

        await session.commit()
        logger.info("Stored backup codes", user_id=str(user_id), count=len(codes))

    async def verify_backup_code(
        self,
        user_id: uuid.UUID | str,
        code: str,
        session: AsyncSession,
        ip_address: str | None = None,
    ) -> bool:
        """
        Verify and mark backup code as used.

        Args:
            user_id: User ID
            code: Plaintext backup code to verify
            session: Database session
            ip_address: IP address of verification attempt

        Returns:
            True if code is valid and unused, False otherwise
        """
        from dotmac.platform.user_management.models import BackupCode

        # Convert user_id to UUID if string
        if isinstance(user_id, str):
            user_id = uuid.UUID(user_id)

        # Get all unused backup codes for user
        result = await session.execute(
            select(BackupCode).where(
                BackupCode.user_id == user_id,
                BackupCode.used.is_(False),
            )
        )
        backup_codes = result.scalars().all()

        # Try to match against each unused code
        for backup_code in backup_codes:
            if verify_password(code, backup_code.code_hash):
                # Mark as used
                backup_code.used = True
                backup_code.used_at = datetime.now(UTC)
                backup_code.used_ip = ip_address
                await session.commit()

                logger.info(
                    "Backup code used successfully",
                    user_id=str(user_id),
                    code_id=str(backup_code.id),
                    ip_address=ip_address,
                )
                return True

        logger.warning("Invalid or already used backup code", user_id=str(user_id))
        return False

    async def get_remaining_backup_codes_count(
        self, user_id: uuid.UUID | str, session: AsyncSession
    ) -> int:
        """
        Get count of remaining unused backup codes.

        Args:
            user_id: User ID
            session: Database session

        Returns:
            Number of unused backup codes
        """
        from dotmac.platform.user_management.models import BackupCode

        # Convert user_id to UUID if string
        if isinstance(user_id, str):
            user_id = uuid.UUID(user_id)

        result = await session.execute(
            select(BackupCode).where(
                BackupCode.user_id == user_id,
                BackupCode.used.is_(False),
            )
        )
        return len(result.scalars().all())


# Singleton instance
mfa_service = MFAService()


__all__ = ["MFAService", "mfa_service"]
