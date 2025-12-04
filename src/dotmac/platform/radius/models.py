"""
RADIUS Database Models

SQLAlchemy models for FreeRADIUS database tables.
These tables are used by FreeRADIUS for authentication, authorization, and accounting.
"""

from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    Column,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    TypeDecorator,
    func,
)
from sqlalchemy.dialects.postgresql import INET as PostgreSQL_INET
from sqlalchemy.orm import relationship

from dotmac.platform.db import Base


class INET(TypeDecorator[str]):
    """
    Cross-database INET type.

    Uses PostgreSQL INET for PostgreSQL, falls back to String(45) for other databases.
    String(45) accommodates both IPv4 (15 chars) and IPv6 (39 chars) addresses.
    """

    impl = String(45)
    cache_ok = True

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PostgreSQL_INET())
        return dialect.type_descriptor(String(45))


if TYPE_CHECKING:
    pass


class RadCheck(Base):
    """
    RADIUS Check Table - Authentication attributes

    Used by FreeRADIUS to validate user credentials and check attributes.
    Common attributes: Cleartext-Password, MD5-Password, User-Name
    """

    __tablename__ = "radcheck"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(
        String(255), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subscriber_id = Column(
        String(255), ForeignKey("subscribers.id", ondelete="CASCADE"), nullable=True, index=True
    )
    username = Column(String(64), nullable=False, index=True)
    attribute = Column(String(64), nullable=False)
    op = Column(String(2), nullable=False, default=":=")  # Operator: :=, ==, +=, etc.
    value = Column(String(253), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    tenant = relationship("Tenant")
    subscriber = relationship("Subscriber", back_populates="radius_checks")

    __table_args__ = (
        Index("idx_radcheck_tenant_username", "tenant_id", "username"),
        Index("idx_radcheck_subscriber", "subscriber_id"),
    )

    def __repr__(self) -> str:
        return f"<RadCheck(id={self.id}, username={self.username}, attribute={self.attribute})>"


class RadReply(Base):
    """
    RADIUS Reply Table - Authorization attributes

    Attributes sent in Access-Accept response.
    Common attributes: Framed-IP-Address, Session-Timeout, Idle-Timeout
    """

    __tablename__ = "radreply"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(
        String(255), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subscriber_id = Column(
        String(255), ForeignKey("subscribers.id", ondelete="CASCADE"), nullable=True, index=True
    )
    username = Column(String(64), nullable=False, index=True)
    attribute = Column(String(64), nullable=False)
    op = Column(String(2), nullable=False, default="=")  # Operator
    value = Column(String(253), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    tenant = relationship("Tenant")
    subscriber = relationship("Subscriber", back_populates="radius_replies")

    __table_args__ = (
        Index("idx_radreply_tenant_username", "tenant_id", "username"),
        Index("idx_radreply_subscriber", "subscriber_id"),
    )

    def __repr__(self) -> str:
        return f"<RadReply(id={self.id}, username={self.username}, attribute={self.attribute})>"


class RadAcct(Base):
    """
    RADIUS Accounting Table

    Records session information and usage data.
    Updated by FreeRADIUS when sessions start, update, and stop.
    """

    __tablename__ = "radacct"

    radacctid = Column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id = Column(
        String(255), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subscriber_id = Column(
        String(255), ForeignKey("subscribers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    acctsessionid = Column(String(64), nullable=False, index=True)
    acctuniqueid = Column(String(32), nullable=False, unique=True)
    username = Column(String(64), nullable=True, index=True)
    groupname = Column(String(64), nullable=True)
    realm = Column(String(64), nullable=True)
    nasipaddress = Column(INET, nullable=False, index=True)
    nasportid = Column(String(15), nullable=True)
    nasporttype = Column(String(32), nullable=True)
    acctstarttime = Column(TIMESTAMP(timezone=True), nullable=True, index=True)
    acctupdatetime = Column(TIMESTAMP(timezone=True), nullable=True)
    acctstoptime = Column(TIMESTAMP(timezone=True), nullable=True, index=True)
    acctinterval = Column(Integer, nullable=True)
    acctsessiontime = Column(BigInteger, nullable=True)  # Seconds
    acctauthentic = Column(String(32), nullable=True)
    connectinfo_start = Column(String(50), nullable=True)
    connectinfo_stop = Column(String(50), nullable=True)
    acctinputoctets = Column(BigInteger, nullable=True)  # Bytes downloaded
    acctoutputoctets = Column(BigInteger, nullable=True)  # Bytes uploaded
    calledstationid = Column(String(50), nullable=True)
    callingstationid = Column(String(50), nullable=True)
    acctterminatecause = Column(String(32), nullable=True)
    servicetype = Column(String(32), nullable=True)
    framedprotocol = Column(String(32), nullable=True)
    framedipaddress = Column(INET, nullable=True)
    framedipv6address = Column(INET, nullable=True)
    framedipv6prefix = Column(INET, nullable=True)
    framedinterfaceid = Column(String(44), nullable=True)
    delegatedipv6prefix = Column(INET, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    tenant = relationship("Tenant")
    subscriber = relationship("Subscriber", back_populates="radius_sessions")

    __table_args__ = (
        Index("idx_radacct_tenant", "tenant_id"),
        Index("idx_radacct_subscriber", "subscriber_id"),
        Index("idx_radacct_username", "username"),
        Index("idx_radacct_sessionid", "acctsessionid"),
        Index("idx_radacct_starttime", "acctstarttime"),
        Index("idx_radacct_stoptime", "acctstoptime"),
        Index("idx_radacct_nasip", "nasipaddress"),
        Index(
            "idx_radacct_active_session",
            "tenant_id",
            "username",
            postgresql_where=acctstoptime.is_(None),
        ),
    )

    def __repr__(self) -> str:
        return f"<RadAcct(id={self.radacctid}, username={self.username}, session={self.acctsessionid})>"

    @property
    def is_active(self) -> bool:
        """Check if session is currently active"""
        return self.acctstoptime is None

    @property
    def total_bytes(self) -> int:
        """Total bytes transferred (upload + download)"""
        upload = int(self.acctoutputoctets) if self.acctoutputoctets is not None else 0
        download = int(self.acctinputoctets) if self.acctinputoctets is not None else 0
        return upload + download


class RadPostAuth(Base):
    """
    RADIUS Post-Auth Table

    Logs all authentication attempts (successful and failed).
    Useful for security auditing and troubleshooting.
    """

    __tablename__ = "radpostauth"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id = Column(
        String(255), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    username = Column(String(64), nullable=False, index=True)
    password = Column(String(64), nullable=True)  # Hashed or omitted for security
    reply = Column(String(32), nullable=True)  # Access-Accept, Access-Reject
    authdate = Column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    nasipaddress = Column(INET, nullable=True)

    # Relationships
    tenant = relationship("Tenant")

    __table_args__ = (
        Index("idx_radpostauth_tenant", "tenant_id"),
        Index("idx_radpostauth_username", "username"),
        Index("idx_radpostauth_date", "authdate"),
    )

    def __repr__(self) -> str:
        return f"<RadPostAuth(id={self.id}, username={self.username}, reply={self.reply})>"


class NAS(Base):
    """
    NAS (Network Access Server) Table

    Defines NAS clients (routers, OLTs, wireless APs) that can communicate with RADIUS.
    Each NAS has a shared secret for authentication.

    Enhanced with vendor-specific metadata for multi-vendor RADIUS support.
    """

    __tablename__ = "nas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(
        String(255), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nasname = Column(String(128), nullable=False, index=True)  # IP address or hostname
    shortname = Column(String(32), nullable=False)  # Human-readable name
    type = Column(String(30), nullable=False, default="other")  # NAS type: cisco, mikrotik, other

    # Vendor-specific fields for multi-vendor support
    vendor = Column(
        String(30),
        nullable=False,
        default="mikrotik",
        comment="NAS vendor: mikrotik, cisco, huawei, juniper, generic",
    )
    model = Column(
        String(64), nullable=True, comment="NAS model/hardware type for vendor-specific features"
    )
    firmware_version = Column(
        String(32), nullable=True, comment="Firmware version for compatibility checks"
    )

    ports = Column(Integer, nullable=True)
    secret = Column(String(60), nullable=False)  # Shared secret for RADIUS auth
    server = Column(String(64), nullable=True)
    community = Column(String(50), nullable=True)  # SNMP community string
    description = Column(String(200), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    tenant = relationship("Tenant")

    __table_args__ = (
        Index("idx_nas_tenant", "tenant_id"),
        Index("idx_nas_name", "nasname"),
        Index("idx_nas_vendor", "vendor"),  # Index for vendor lookups
    )

    def __repr__(self) -> str:
        return f"<NAS(id={self.id}, name={self.shortname}, vendor={self.vendor}, nasname={self.nasname})>"


class RadiusBandwidthProfile(Base):
    """
    Bandwidth Profile Table

    Defines bandwidth limits for subscribers.
    Can be linked to RADIUS reply attributes for rate limiting.
    """

    __tablename__ = "radius_bandwidth_profiles"

    id = Column(String(255), primary_key=True)
    tenant_id = Column(
        String(255), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    download_rate_kbps = Column(Integer, nullable=False)  # Download speed in Kbps
    upload_rate_kbps = Column(Integer, nullable=False)  # Upload speed in Kbps
    download_burst_kbps = Column(Integer, nullable=True)  # Burst speed
    upload_burst_kbps = Column(Integer, nullable=True)  # Burst speed
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    tenant = relationship("Tenant")

    __table_args__ = (Index("idx_bandwidth_profile_tenant", "tenant_id"),)

    def __repr__(self) -> str:
        return f"<RadiusBandwidthProfile(id={self.id}, name={self.name}, down={self.download_rate_kbps}Kbps, up={self.upload_rate_kbps}Kbps)>"
