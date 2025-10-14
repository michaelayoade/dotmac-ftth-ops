#!/bin/bash
# Initialize FreeRADIUS Database Tables
# Creates RADIUS tables in PostgreSQL for multi-tenant ISP operations

set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

POSTGRES_HOST=${POSTGRES_HOST:-postgres}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_DB=${POSTGRES_DB:-dotmac}
POSTGRES_USER=${POSTGRES_USER:-dotmac_user}

echo "Creating RADIUS tables in database: $POSTGRES_DB"

# SQL script to create RADIUS tables
cat <<'SQL' | docker compose exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB

-- RADIUS Check Table (Authentication)
CREATE TABLE IF NOT EXISTS radcheck (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    subscriber_id VARCHAR(255),
    username VARCHAR(64) NOT NULL,
    attribute VARCHAR(64) NOT NULL,
    op VARCHAR(2) NOT NULL DEFAULT ':=',
    value VARCHAR(253) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT radcheck_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT radcheck_unique UNIQUE (tenant_id, username, attribute)
);
CREATE INDEX IF NOT EXISTS radcheck_tenant_username_idx ON radcheck(tenant_id, username);
CREATE INDEX IF NOT EXISTS radcheck_subscriber_idx ON radcheck(subscriber_id);

-- RADIUS Reply Table (Authorization)
CREATE TABLE IF NOT EXISTS radreply (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    subscriber_id VARCHAR(255),
    username VARCHAR(64) NOT NULL,
    attribute VARCHAR(64) NOT NULL,
    op VARCHAR(2) NOT NULL DEFAULT '=',
    value VARCHAR(253) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT radreply_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS radreply_tenant_username_idx ON radreply(tenant_id, username);
CREATE INDEX IF NOT EXISTS radreply_subscriber_idx ON radreply(subscriber_id);

-- RADIUS Group Check Table
CREATE TABLE IF NOT EXISTS radgroupcheck (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    groupname VARCHAR(64) NOT NULL,
    attribute VARCHAR(64) NOT NULL,
    op VARCHAR(2) NOT NULL DEFAULT ':=',
    value VARCHAR(253) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT radgroupcheck_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT radgroupcheck_unique UNIQUE (tenant_id, groupname, attribute)
);
CREATE INDEX IF NOT EXISTS radgroupcheck_tenant_groupname_idx ON radgroupcheck(tenant_id, groupname);

-- RADIUS Group Reply Table
CREATE TABLE IF NOT EXISTS radgroupreply (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    groupname VARCHAR(64) NOT NULL,
    attribute VARCHAR(64) NOT NULL,
    op VARCHAR(2) NOT NULL DEFAULT '=',
    value VARCHAR(253) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT radgroupreply_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS radgroupreply_tenant_groupname_idx ON radgroupreply(tenant_id, groupname);

-- RADIUS User Group Table
CREATE TABLE IF NOT EXISTS radusergroup (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    username VARCHAR(64) NOT NULL,
    groupname VARCHAR(64) NOT NULL,
    priority INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT radusergroup_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT radusergroup_unique UNIQUE (tenant_id, username, groupname)
);
CREATE INDEX IF NOT EXISTS radusergroup_tenant_username_idx ON radusergroup(tenant_id, username);

-- RADIUS Accounting Table
CREATE TABLE IF NOT EXISTS radacct (
    radacctid BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    subscriber_id VARCHAR(255),
    acctsessionid VARCHAR(64) NOT NULL,
    acctuniqueid VARCHAR(32) NOT NULL UNIQUE,
    username VARCHAR(64),
    groupname VARCHAR(64),
    realm VARCHAR(64),
    nasipaddress INET NOT NULL,
    nasportid VARCHAR(15),
    nasporttype VARCHAR(32),
    acctstarttime TIMESTAMPTZ,
    acctupdatetime TIMESTAMPTZ,
    acctstoptime TIMESTAMPTZ,
    acctinterval INT,
    acctsessiontime BIGINT,
    acctauthentic VARCHAR(32),
    connectinfo_start VARCHAR(50),
    connectinfo_stop VARCHAR(50),
    acctinputoctets BIGINT,
    acctoutputoctets BIGINT,
    calledstationid VARCHAR(50),
    callingstationid VARCHAR(50),
    acctterminatecause VARCHAR(32),
    servicetype VARCHAR(32),
    framedprotocol VARCHAR(32),
    framedipaddress INET,
    framedipv6address INET,
    framedipv6prefix INET,
    framedinterfaceid VARCHAR(44),
    delegatedipv6prefix INET,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT radacct_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS radacct_tenant_idx ON radacct(tenant_id);
CREATE INDEX IF NOT EXISTS radacct_subscriber_idx ON radacct(subscriber_id);
CREATE INDEX IF NOT EXISTS radacct_username_idx ON radacct(username);
CREATE INDEX IF NOT EXISTS radacct_acctsessionid_idx ON radacct(acctsessionid);
CREATE INDEX IF NOT EXISTS radacct_acctstarttime_idx ON radacct(acctstarttime);
CREATE INDEX IF NOT EXISTS radacct_acctstoptime_idx ON radacct(acctstoptime);
CREATE INDEX IF NOT EXISTS radacct_nasipaddress_idx ON radacct(nasipaddress);
CREATE INDEX IF NOT EXISTS radacct_active_session_idx ON radacct(tenant_id, username) WHERE acctstoptime IS NULL;

-- RADIUS Post-Auth Table (Login attempts)
CREATE TABLE IF NOT EXISTS radpostauth (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    username VARCHAR(64) NOT NULL,
    pass VARCHAR(64),
    reply VARCHAR(32),
    authdate TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    nasipaddress INET,
    CONSTRAINT radpostauth_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS radpostauth_tenant_idx ON radpostauth(tenant_id);
CREATE INDEX IF NOT EXISTS radpostauth_username_idx ON radpostauth(username);
CREATE INDEX IF NOT EXISTS radpostauth_authdate_idx ON radpostauth(authdate);

-- NAS (Network Access Server) Table
CREATE TABLE IF NOT EXISTS nas (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    nasname VARCHAR(128) NOT NULL,
    shortname VARCHAR(32) NOT NULL,
    type VARCHAR(30) NOT NULL DEFAULT 'other',
    ports INT,
    secret VARCHAR(60) NOT NULL,
    server VARCHAR(64),
    community VARCHAR(50),
    description VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT nas_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT nas_unique UNIQUE (tenant_id, nasname)
);
CREATE INDEX IF NOT EXISTS nas_tenant_idx ON nas(tenant_id);
CREATE INDEX IF NOT EXISTS nas_nasname_idx ON nas(nasname);

-- Bandwidth Profiles Table
CREATE TABLE IF NOT EXISTS radius_bandwidth_profiles (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    download_rate_kbps INT NOT NULL,
    upload_rate_kbps INT NOT NULL,
    download_burst_kbps INT,
    upload_burst_kbps INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT bandwidth_profile_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT bandwidth_profile_unique UNIQUE (tenant_id, name)
);
CREATE INDEX IF NOT EXISTS bandwidth_profile_tenant_idx ON radius_bandwidth_profiles(tenant_id);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dotmac_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dotmac_user;

-- Success message
SELECT 'RADIUS tables created successfully!' AS status;

SQL

echo "✓ RADIUS tables created successfully"
echo ""
echo "Next steps:"
echo "1. Configure FreeRADIUS to use PostgreSQL (config/radius/sql.conf)"
echo "2. Add NAS devices via API or directly to 'nas' table"
echo "3. Create subscriber authentication entries in 'radcheck' table"
echo "4. Test RADIUS authentication: radtest username password localhost 0 testing123"
