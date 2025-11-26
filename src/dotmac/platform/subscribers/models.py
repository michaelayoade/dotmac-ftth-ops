"""
Subscriber Management Models for ISP Operations.

Represents RADIUS subscribers, service subscriptions, and network assignments.
A Subscriber is the network-level representation of a service connection,
which may be linked to a Customer (billing entity) but tracks different concerns.
"""

import hashlib
import secrets
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

import bcrypt
from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    text,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from dotmac.platform.db import (
    AuditMixin,
    Base,
    SoftDeleteMixin,
    TenantMixin,
    TimestampMixin,
)
from dotmac.platform.radius.models import INET  # Cross-database INET type
from dotmac.platform.services.lifecycle.models import ServiceType

if TYPE_CHECKING:
    from dotmac.platform.ip_management.models import IPReservation


class PasswordHashingMethod(str, Enum):
    """RADIUS password hashing methods."""

    CLEARTEXT = "cleartext"  # Plain text (not recommended)
    MD5 = "md5"  # MD5 hash
    SHA256 = "sha256"  # SHA-256 hash (recommended)
    BCRYPT = "bcrypt"  # Bcrypt (strongest, but may not be supported by all NAS)


def hash_radius_password(
    password: str, method: PasswordHashingMethod = PasswordHashingMethod.SHA256
) -> str:
    """
    Hash a RADIUS password using the specified method.

    Args:
        password: Plain text password
        method: Hashing method to use

    Returns:
        Hashed password string, prefixed with method identifier

    Note:
        - CLEARTEXT: Returns plain password (insecure, only for testing)
        - MD5: Legacy hash, not recommended but widely supported
        - SHA256: Recommended default, good security and compatibility
        - BCRYPT: Strongest security, but NAS support varies

    Example:
        >>> hash_radius_password("secret123", PasswordHashingMethod.SHA256)
        'sha256:5e88489...'
    """
    if method == PasswordHashingMethod.CLEARTEXT:
        return f"cleartext:{password}"
    elif method == PasswordHashingMethod.MD5:
        # MD5 is legacy only, not for security - nosec B324
        hashed = hashlib.md5(password.encode(), usedforsecurity=False).hexdigest()
        return f"md5:{hashed}"
    elif method == PasswordHashingMethod.SHA256:
        hashed = hashlib.sha256(password.encode()).hexdigest()
        return f"sha256:{hashed}"
    elif method == PasswordHashingMethod.BCRYPT:
        # Bcrypt with salt (recommended for strongest security)
        salt = bcrypt.gensalt(rounds=12)
        hashed_bytes: bytes = bcrypt.hashpw(password.encode(), salt)
        return f"bcrypt:{hashed_bytes.decode('utf-8')}"
    else:
        # Default to SHA256
        hashed = hashlib.sha256(password.encode()).hexdigest()
        return f"sha256:{hashed}"


def verify_radius_password(password: str, hashed_password: str) -> bool:
    """
    Verify a plain text password against a hashed password.

    Args:
        password: Plain text password to verify
        hashed_password: Stored hashed password with method prefix

    Returns:
        True if password matches, False otherwise
    """
    if ":" not in hashed_password:
        # Legacy password without method prefix, assume cleartext
        return password == hashed_password

    method_str, stored_hash = hashed_password.split(":", 1)

    if method_str == "cleartext":
        return password == stored_hash
    elif method_str == "md5":
        # MD5 is legacy only, not for security - nosec B324
        computed_hash = hashlib.md5(password.encode(), usedforsecurity=False).hexdigest()
        return computed_hash == stored_hash
    elif method_str == "sha256":
        computed_hash = hashlib.sha256(password.encode()).hexdigest()
        return computed_hash == stored_hash
    elif method_str == "bcrypt":
        # Bcrypt verification
        try:
            return bcrypt.checkpw(password.encode(), stored_hash.encode("utf-8"))
        except (ValueError, TypeError):
            return False
    else:
        # Unknown method
        return False


def generate_random_password(length: int = 16) -> str:
    """
    Generate a secure random password for RADIUS accounts.

    Args:
        length: Password length (default 16)

    Returns:
        Random alphanumeric password
    """
    import string

    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


class SubscriberStatus(str, Enum):
    """Subscriber service status."""

    PENDING = "pending"  # Awaiting activation
    ACTIVE = "active"  # Service active
    SUSPENDED = "suspended"  # Temporarily suspended (e.g., non-payment)
    DISCONNECTED = "disconnected"  # Administratively disconnected
    TERMINATED = "terminated"  # Service terminated
    QUARANTINED = "quarantined"  # Limited access (security/policy)


class Subscriber(Base, TimestampMixin, TenantMixin, SoftDeleteMixin, AuditMixin):
    """
    Network Subscriber Model.

    Represents a RADIUS subscriber with service profile, credentials,
    and network assignments. This is the core entity for ISP operations.

    Key Concepts:
    - A Customer (billing) may have multiple Subscribers (services/connections)
    - Each Subscriber has unique RADIUS credentials
    - Subscribers are linked to network devices (ONU, CPE)
    - Service lifecycle is tracked independently from Customer account
    """

    __tablename__ = "subscribers"

    # Primary identifier
    id: Mapped[str] = mapped_column(
        String(255),
        primary_key=True,
        default=lambda: str(uuid4()),
        nullable=False,
        comment="Subscriber UUID as string for RADIUS FK compatibility",
    )

    # Link to Customer (billing entity)
    customer_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Link to billing customer record",
    )

    # Optional: Link directly to portal User account
    # This allows a user to manage their subscriber from the portal
    user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Link to portal user account (optional, for self-service)",
    )

    # Subscriber Identification
    username: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default=lambda: f"user-{uuid4().hex[:8]}",
        index=True,
        comment="RADIUS username (unique per tenant when not soft-deleted)",
    )
    password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        default=lambda: hash_radius_password(generate_random_password()),
        comment="RADIUS password - stored with hash method prefix (e.g., 'sha256:abc123...'). "
        "Use set_password() method to hash automatically. "
        "Supports: cleartext (insecure), md5 (legacy), sha256 (recommended), bcrypt (future).",
    )
    password_hash_method: Mapped[str] = mapped_column(
        String(20),
        default="sha256",
        nullable=False,
        comment="Hashing method used for password (cleartext, md5, sha256, bcrypt)",
    )
    subscriber_number: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="",
        index=True,
        comment="Human-readable subscriber ID (empty string if not assigned, unique per tenant when not soft-deleted)",
    )
    full_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="Subscriber full name for contact context",
    )
    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
        comment="Subscriber contact email",
    )
    phone_number: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
        comment="Subscriber contact phone number",
    )

    # Service Status
    status: Mapped[SubscriberStatus] = mapped_column(
        SQLEnum(SubscriberStatus, values_callable=lambda x: [e.value for e in x]),
        default=SubscriberStatus.PENDING,
        nullable=False,
        index=True,
    )
    service_type: Mapped[ServiceType] = mapped_column(
        SQLEnum(ServiceType, values_callable=lambda x: [e.value for e in x]),
        default=ServiceType.FIBER_INTERNET,
        nullable=False,
        index=True,
    )

    # Service Details
    bandwidth_profile_id: Mapped[str | None] = mapped_column(
        String(255),
        ForeignKey("radius_bandwidth_profiles.id", ondelete="SET NULL"),
        nullable=True,
        comment="Link to bandwidth/QoS profile",
    )
    download_speed_kbps: Mapped[int | None] = mapped_column(
        nullable=True,
        comment="Current download speed in Kbps",
    )
    upload_speed_kbps: Mapped[int | None] = mapped_column(
        nullable=True,
        comment="Current upload speed in Kbps",
    )

    # Network Assignments
    static_ipv4: Mapped[str | None] = mapped_column(
        INET,
        nullable=True,
        comment="Static IPv4 address if assigned",
    )
    ipv6_prefix: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="IPv6 prefix delegation",
    )
    vlan_id: Mapped[int | None] = mapped_column(
        nullable=True,
        comment="VLAN assignment",
    )
    nas_identifier: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
        index=True,
        comment="NAS device serving this subscriber",
    )

    # Device Assignments
    onu_serial: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
        comment="ONU serial number (GPON/XGS-PON)",
    )
    cpe_mac_address: Mapped[str | None] = mapped_column(
        String(17),
        nullable=True,
        index=True,
        comment="CPE MAC address (for TR-069)",
    )
    device_metadata: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Additional device info: {olt_id, pon_port, onu_id, etc}",
    )

    # Service Location
    service_address: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Full service address",
    )
    service_coordinates: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="GPS coordinates: {lat: float, lon: float}",
    )
    site_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="Network site/POP identifier",
    )

    # Service Dates
    activation_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Service activation date",
    )
    suspension_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Date service was suspended",
    )
    termination_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Service termination date",
    )

    # Session Limits
    session_timeout: Mapped[int | None] = mapped_column(
        nullable=True,
        comment="Max session duration in seconds (RADIUS attribute)",
    )
    idle_timeout: Mapped[int | None] = mapped_column(
        nullable=True,
        comment="Idle timeout in seconds (RADIUS attribute)",
    )
    simultaneous_use: Mapped[int] = mapped_column(
        default=1,
        nullable=False,
        comment="Max concurrent sessions allowed",
    )

    # Usage Tracking
    last_online: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Last seen online (from RADIUS accounting)",
    )
    total_sessions: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
        comment="Total number of sessions",
    )
    total_upload_bytes: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
        comment="Lifetime upload bytes",
    )
    total_download_bytes: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
        comment="Lifetime download bytes",
    )

    # External System References
    netbox_ip_id: Mapped[int | None] = mapped_column(
        nullable=True,
        comment="NetBox IP Address object ID",
    )
    voltha_onu_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="VOLTHA ONU device ID",
    )
    genieacs_device_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="GenieACS device ID (usually MAC or serial)",
    )

    # Custom Fields
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSON,
        default=dict,
        nullable=False,
        comment="Additional metadata",
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Internal notes",
    )

    # Relationships
    customer = relationship("Customer", foreign_keys=[customer_id], lazy="joined")
    user = relationship("User", foreign_keys=[user_id], lazy="joined")
    bandwidth_profile = relationship(
        "RadiusBandwidthProfile",
        foreign_keys=[bandwidth_profile_id],
        lazy="joined",
    )
    radius_checks = relationship("RadCheck", back_populates="subscriber", lazy="dynamic")
    radius_replies = relationship("RadReply", back_populates="subscriber", lazy="dynamic")
    radius_sessions = relationship("RadAcct", back_populates="subscriber", lazy="dynamic")
    network_profile = relationship(
        "SubscriberNetworkProfile",
        back_populates="subscriber",
        uselist=False,
        lazy="joined",
    )
    ip_reservations: Mapped[list["IPReservation"]] = relationship(
        "IPReservation",
        back_populates="subscriber",
        cascade="all, delete-orphan",
    )

    # Indexes and constraints
    # Note: Partial unique indexes exclude soft-deleted rows to allow re-use
    # of username/subscriber_number after soft-delete
    __table_args__ = (
        # Partial unique index for username (excludes soft-deleted)
        Index(
            "uq_subscriber_tenant_username_active",
            "tenant_id",
            "username",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        # Partial unique index for subscriber_number (excludes soft-deleted and empty)
        Index(
            "uq_subscriber_tenant_number_active",
            "tenant_id",
            "subscriber_number",
            unique=True,
            postgresql_where=text("deleted_at IS NULL AND subscriber_number != ''"),
            sqlite_where=text("deleted_at IS NULL AND subscriber_number != ''"),
        ),
        # Regular indexes for query performance
        Index("ix_subscriber_status", "tenant_id", "status"),
        Index("ix_subscriber_service_type", "tenant_id", "service_type"),
        Index("ix_subscriber_customer", "customer_id"),
        Index("ix_subscriber_nas", "nas_identifier"),
        Index("ix_subscriber_onu", "onu_serial"),
        Index("ix_subscriber_cpe", "cpe_mac_address"),
        Index("ix_subscriber_site", "site_id"),
        # Index for soft-deleted subscribers to enable efficient queries
        Index("ix_subscriber_deleted_at", "deleted_at"),
    )

    def __repr__(self) -> str:
        return f"<Subscriber(id={self.id}, username={self.username}, status={self.status})>"

    @property
    def is_active(self) -> bool:
        """Check if subscriber service is currently active."""
        return self.status == SubscriberStatus.ACTIVE

    @is_active.setter
    def is_active(self, value: bool) -> None:
        """Allow test fixtures to set active flag; maps to status."""
        if value:
            self.status = SubscriberStatus.ACTIVE

    @property
    def total_bytes(self) -> int:
        """Total data transferred (upload + download)."""
        return self.total_upload_bytes + self.total_download_bytes

    @property
    def display_name(self) -> str:
        """Get display name for subscriber."""
        if self.subscriber_number and self.subscriber_number != "":
            return f"{self.username} ({self.subscriber_number})"
        return self.username

    @property
    def is_password_secure(self) -> bool:
        """
        Check if password is stored securely (not cleartext).

        Returns:
            True if password uses hashing, False if cleartext
        """
        return not self.password.startswith("cleartext:")

    def set_password(
        self,
        password: str,
        method: PasswordHashingMethod = PasswordHashingMethod.SHA256,
        auto_hash: bool = True,
    ) -> None:
        """
        Set subscriber password with automatic hashing.

        Args:
            password: Plain text password (or pre-hashed with method prefix)
            method: Hashing method to use if auto_hash is True
            auto_hash: If True, automatically hash the password. If False, store as-is.

        Examples:
            # Recommended: Auto-hash with SHA256 (default)
            subscriber.set_password("mysecret")

            # Legacy: Store cleartext (not recommended)
            subscriber.set_password("mysecret", method=PasswordHashingMethod.CLEARTEXT)

            # Advanced: Store pre-hashed password
            subscriber.set_password("sha256:abc123...", auto_hash=False)

        Warning:
            Using CLEARTEXT or auto_hash=False is insecure and only recommended for
            testing or when required by legacy NAS equipment.
        """
        if auto_hash:
            self.password = hash_radius_password(password, method)
            self.password_hash_method = method.value
        else:
            # Store as-is (for pre-hashed passwords)
            self.password = password
            # Try to detect method from prefix
            if ":" in password:
                method_str = password.split(":", 1)[0]
                if method_str in [m.value for m in PasswordHashingMethod]:
                    self.password_hash_method = method_str
            else:
                # No prefix, assume cleartext
                self.password_hash_method = "cleartext"

    def check_password(self, password: str) -> bool:
        """
        Verify a plain text password against the stored password.

        Args:
            password: Plain text password to verify

        Returns:
            True if password matches, False otherwise

        Example:
            >>> subscriber = Subscriber(username="user123")
            >>> subscriber.set_password("secret")
            >>> subscriber.check_password("secret")
            True
            >>> subscriber.check_password("wrong")
            False
        """
        return verify_radius_password(password, self.password)

    def rotate_password(self, length: int = 16) -> str:
        """
        Generate and set a new random password.

        Args:
            length: Password length (default 16)

        Returns:
            The new plain text password (store securely!)

        Example:
            >>> subscriber = Subscriber(username="user123")
            >>> new_password = subscriber.rotate_password()
            >>> # Send new_password to subscriber via secure channel
            >>> # Password is automatically hashed in the database
        """
        new_password = generate_random_password(length)
        self.set_password(new_password, method=PasswordHashingMethod.SHA256)
        return new_password


__all__ = [
    "Subscriber",
    "SubscriberStatus",
    "ServiceType",
]
