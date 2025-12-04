"""TimescaleDB Time-Series Models."""

from sqlalchemy import TIMESTAMP, BigInteger, Column, Integer, String
from sqlalchemy.dialects.postgresql import INET
from sqlalchemy.ext.declarative import declarative_base

TimeSeriesBase = declarative_base()


class RadAcctTimeSeries(TimeSeriesBase):
    """RADIUS Accounting Time-Series Table (TimescaleDB Hypertable)."""

    __tablename__ = "radacct_timeseries"

    # Time column (primary dimension for hypertable)
    time = Column(TIMESTAMP(timezone=True), primary_key=True, nullable=False)

    # Identifiers
    tenant_id = Column(String(255), primary_key=True, nullable=False, index=True)
    subscriber_id = Column(String(255), index=True)
    username = Column(String(64), index=True)
    session_id = Column(String(64), nullable=False)
    nas_ip_address = Column(INET, nullable=False)

    # Usage metrics
    total_bytes = Column(BigInteger)
    input_octets = Column(BigInteger)
    output_octets = Column(BigInteger)
    session_duration = Column(Integer)

    # Metadata
    framed_ip_address = Column(INET)
    framed_ipv6_address = Column(INET)
    terminate_cause = Column(String(32))

    # Timestamps
    session_start_time = Column(TIMESTAMP(timezone=True), nullable=False, index=True)
    session_stop_time = Column(TIMESTAMP(timezone=True))
