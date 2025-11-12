-- PostgreSQL Initialization Script
-- Creates extensions and initial setup for DotMac Platform

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For GIN indexes

-- Create application schema (optional, using public by default)
-- CREATE SCHEMA IF NOT EXISTS dotmac;

-- Set default permissions
-- GRANT ALL PRIVILEGES ON SCHEMA public TO dotmac_user;

-- Performance tuning for production
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET min_wal_size = '1GB';
ALTER SYSTEM SET max_wal_size = '4GB';

-- Connection pooling settings
ALTER SYSTEM SET max_connections = 200;

-- Logging
ALTER SYSTEM SET log_destination = 'stderr';
ALTER SYSTEM SET logging_collector = on;
ALTER SYSTEM SET log_directory = 'log';
ALTER SYSTEM SET log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log';
ALTER SYSTEM SET log_rotation_age = '1d';
ALTER SYSTEM SET log_rotation_size = '100MB';
ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';
ALTER SYSTEM SET log_checkpoints = on;
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_duration = off;
ALTER SYSTEM SET log_lock_waits = on;
ALTER SYSTEM SET log_statement = 'ddl';

-- Reload configuration
SELECT pg_reload_conf();

-- Create read-only user for reporting (optional)
-- DO $$
-- BEGIN
--     IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'dotmac_readonly') THEN
--         CREATE USER dotmac_readonly WITH PASSWORD 'readonly_password';
--         GRANT CONNECT ON DATABASE dotmac_prod TO dotmac_readonly;
--         GRANT USAGE ON SCHEMA public TO dotmac_readonly;
--         GRANT SELECT ON ALL TABLES IN SCHEMA public TO dotmac_readonly;
--         ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO dotmac_readonly;
--     END IF;
-- END
-- $$;
