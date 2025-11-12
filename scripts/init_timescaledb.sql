-- TimescaleDB Initialization Script
-- Run this script to set up time-series tables for RADIUS session history
-- Usage: docker exec -i isp-timescaledb psql -U timescale_user -d metrics < scripts/init_timescaledb.sql

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Verify TimescaleDB is installed
SELECT default_version, installed_version
FROM pg_available_extensions
WHERE name = 'timescaledb';

-- Create RADIUS time-series table
CREATE TABLE IF NOT EXISTS radacct_timeseries (
    time TIMESTAMPTZ NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    subscriber_id VARCHAR(255),
    username VARCHAR(64),
    session_id VARCHAR(64) NOT NULL,
    nas_ip_address INET NOT NULL,

    -- Usage metrics
    total_bytes BIGINT,
    input_octets BIGINT,
    output_octets BIGINT,
    session_duration INTEGER,  -- seconds

    -- Metadata
    framed_ip_address INET,
    framed_ipv6_address INET,
    terminate_cause VARCHAR(32),

    -- Timestamps
    session_start_time TIMESTAMPTZ NOT NULL,
    session_stop_time TIMESTAMPTZ
);

-- Convert to hypertable (partitioned by time)
-- Only execute if not already a hypertable
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'radacct_timeseries'
    ) THEN
        PERFORM create_hypertable(
            'radacct_timeseries',
            'time',
            chunk_time_interval => INTERVAL '1 day',
            if_not_exists => TRUE
        );
    END IF;
END $$;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_radacct_ts_tenant
    ON radacct_timeseries(tenant_id, time DESC);

CREATE INDEX IF NOT EXISTS idx_radacct_ts_subscriber
    ON radacct_timeseries(subscriber_id, time DESC)
    WHERE subscriber_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_radacct_ts_username
    ON radacct_timeseries(username, time DESC)
    WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_radacct_ts_session
    ON radacct_timeseries(session_id);

-- Add compression policy (compress data older than 7 days)
SELECT add_compression_policy(
    'radacct_timeseries',
    INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Add retention policy (keep data for 2 years)
SELECT add_retention_policy(
    'radacct_timeseries',
    INTERVAL '730 days',
    if_not_exists => TRUE
);

-- Create continuous aggregate for hourly bandwidth
CREATE MATERIALIZED VIEW IF NOT EXISTS radacct_hourly_bandwidth
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS hour,
    tenant_id,
    subscriber_id,
    COUNT(*) AS session_count,
    SUM(total_bytes) AS total_bandwidth,
    SUM(session_duration) AS total_duration,
    AVG(session_duration) AS avg_session_duration,
    MAX(total_bytes) AS max_bandwidth_session
FROM radacct_timeseries
GROUP BY hour, tenant_id, subscriber_id;

-- Refresh policy for continuous aggregate (refresh hourly)
SELECT add_continuous_aggregate_policy(
    'radacct_hourly_bandwidth',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- Create daily aggregate view
CREATE MATERIALIZED VIEW IF NOT EXISTS radacct_daily_bandwidth
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS day,
    tenant_id,
    subscriber_id,
    COUNT(*) AS session_count,
    SUM(total_bytes) AS total_bandwidth,
    SUM(session_duration) AS total_duration
FROM radacct_timeseries
GROUP BY day, tenant_id, subscriber_id;

-- Refresh policy for daily aggregate
SELECT add_continuous_aggregate_policy(
    'radacct_daily_bandwidth',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Create helper function to get subscriber usage for date range
CREATE OR REPLACE FUNCTION get_subscriber_usage(
    p_tenant_id VARCHAR,
    p_subscriber_id VARCHAR,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
    total_bandwidth BIGINT,
    total_duration INTEGER,
    session_count BIGINT,
    avg_session_duration NUMERIC,
    peak_bandwidth BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(total_bytes), 0)::BIGINT AS total_bandwidth,
        COALESCE(SUM(session_duration), 0)::INTEGER AS total_duration,
        COUNT(*)::BIGINT AS session_count,
        COALESCE(AVG(session_duration), 0) AS avg_session_duration,
        COALESCE(MAX(total_bytes), 0)::BIGINT AS peak_bandwidth
    FROM radacct_timeseries
    WHERE tenant_id = p_tenant_id
      AND subscriber_id = p_subscriber_id
      AND time >= p_start_date
      AND time < p_end_date;
END;
$$ LANGUAGE plpgsql;

-- Print success message
DO $$
BEGIN
    RAISE NOTICE 'TimescaleDB initialization complete!';
    RAISE NOTICE 'Created: radacct_timeseries hypertable';
    RAISE NOTICE 'Created: radacct_hourly_bandwidth continuous aggregate';
    RAISE NOTICE 'Created: radacct_daily_bandwidth continuous aggregate';
    RAISE NOTICE 'Created: get_subscriber_usage() function';
    RAISE NOTICE 'Policies: 7-day compression, 2-year retention';
END $$;
