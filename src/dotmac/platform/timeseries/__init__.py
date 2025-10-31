"""TimescaleDB Time-Series Database Module.

Provides database connections, models, and utilities for time-series data storage.
"""

from dotmac.platform.timeseries.db import (
    TimeSeriesSessionLocal,
    get_timeseries_session,
    init_timescaledb,
    shutdown_timescaledb,
    timescaledb_engine,
)

__all__ = [
    "TimeSeriesSessionLocal",
    "get_timeseries_session",
    "init_timescaledb",
    "shutdown_timescaledb",
    "timescaledb_engine",
]
