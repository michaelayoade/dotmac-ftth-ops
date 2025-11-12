-- Create additional databases for ISP services
-- This script runs after 01-init.sql

-- Create AWX database
CREATE DATABASE awx;
GRANT ALL PRIVILEGES ON DATABASE awx TO dotmac_user;

-- Create NetBox database
CREATE DATABASE netbox;
GRANT ALL PRIVILEGES ON DATABASE netbox TO dotmac_user;

-- Create LibreNMS database
CREATE DATABASE librenms;
GRANT ALL PRIVILEGES ON DATABASE librenms TO dotmac_user;

-- Connect to AWX database and set up required extensions
\c awx
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Connect to NetBox database and set up required extensions
\c netbox
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Connect to LibreNMS database and set up required extensions
\c librenms
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
