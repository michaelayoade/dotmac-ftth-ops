#!/bin/bash
set -e

echo "🚀 Setting up DotMac ISP Platform with Multi-Tenancy"
echo "===================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1: Creating Platform Administrator${NC}"
echo "----------------------------------------"

# Create platform admin user (super admin)
docker exec dotmac-ftth-ops-postgres-1 psql -U dotmac_user -d dotmac << 'EOF'
-- Create platform admin (not tied to any tenant)
INSERT INTO users (
    id,
    username,
    email,
    password_hash,
    full_name,
    is_active,
    is_verified,
    is_superuser,
    is_platform_admin,
    roles,
    permissions,
    mfa_enabled,
    phone_verified,
    failed_login_attempts,
    metadata,
    created_at,
    updated_at,
    tenant_id
)
VALUES (
    gen_random_uuid(),
    'platform-admin',
    'admin@dotmac-platform.com',
    -- Password: Admin123! (hashed with bcrypt)
    -- You MUST change this in production!
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqNx0rJK3i',
    'Platform Administrator',
    true,  -- is_active
    true,  -- is_verified
    true,  -- is_superuser
    true,  -- is_platform_admin
    '[]'::json,  -- roles
    '[]'::json,  -- permissions
    false, -- mfa_enabled
    false, -- phone_verified
    0,     -- failed_login_attempts
    '{}'::json, -- metadata
    NOW(),
    NOW(),
    NULL   -- tenant_id (platform admins don't belong to a tenant)
)
ON CONFLICT (email) DO NOTHING;

SELECT '✅ Platform Admin created: admin@dotmac-platform.com' AS status;
EOF

echo ""
echo -e "${BLUE}Step 2: Creating Default ISP Tenant${NC}"
echo "------------------------------------"

# Create default tenant (ISP company)
docker exec dotmac-ftth-ops-postgres-1 psql -U dotmac_user -d dotmac << 'EOF'
-- Create default ISP tenant
INSERT INTO tenants (
    id,
    name,
    slug,
    domain,
    status,
    plan_type,
    email,
    billing_email,
    billing_cycle,
    max_users,
    max_api_calls_per_month,
    max_storage_gb,
    current_users,
    current_api_calls,
    current_storage_gb,
    features,
    settings,
    custom_metadata,
    timezone,
    is_active,
    created_at,
    updated_at
)
VALUES (
    'default-isp',
    'Demo ISP Company',
    'demo-isp',
    'demo-isp.local',
    'active',
    'professional',
    'admin@demo-isp.local',
    'billing@demo-isp.local',
    'monthly',
    100,      -- max_users
    1000000,  -- max_api_calls_per_month
    100,      -- max_storage_gb
    0,        -- current_users
    0,        -- current_api_calls
    0,        -- current_storage_gb
    '["radius", "billing", "ipam", "automation"]'::json,
    '{}'::json,
    '{}'::json,
    'UTC',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

SELECT '✅ Tenant created: Demo ISP Company (demo-isp)' AS status;
EOF

echo ""
echo -e "${BLUE}Step 3: Creating Tenant Administrator${NC}"
echo "--------------------------------------"

# Create tenant admin user
docker exec dotmac-ftth-ops-postgres-1 psql -U dotmac_user -d dotmac << 'EOF'
-- Create tenant admin (belongs to the ISP tenant)
INSERT INTO users (
    id,
    username,
    email,
    password_hash,
    full_name,
    is_active,
    is_verified,
    is_superuser,
    is_platform_admin,
    roles,
    permissions,
    mfa_enabled,
    phone_verified,
    failed_login_attempts,
    metadata,
    created_at,
    updated_at,
    tenant_id
)
VALUES (
    gen_random_uuid(),
    'isp-admin',
    'admin@demo-isp.local',
    -- Password: Admin123! (same as platform admin for demo)
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqNx0rJK3i',
    'ISP Administrator',
    true,  -- is_active
    true,  -- is_verified
    false, -- is_superuser (tenant admin, not platform admin)
    false, -- is_platform_admin
    '["tenant_admin"]'::json,
    '[]'::json,
    false,
    false,
    0,
    '{}'::json,
    NOW(),
    NOW(),
    'default-isp'  -- belongs to tenant
)
ON CONFLICT (email) DO NOTHING;

SELECT '✅ Tenant Admin created: admin@demo-isp.local' AS status;
EOF

echo ""
echo -e "${BLUE}Step 4: Configuring NetBox for Tenant${NC}"
echo "---------------------------------------"

# Configure NetBox OSS integration for tenant
docker exec dotmac-ftth-ops-postgres-1 psql -U dotmac_user -d dotmac << 'EOF'
INSERT INTO tenant_settings (
    tenant_id,
    key,
    value,
    created_at,
    updated_at
)
VALUES (
    'default-isp',
    'oss.netbox',
    '{
        "url": "http://netbox:8080",
        "api_token": "0123456789abcdef0123456789abcdef01234567",
        "verify_ssl": false,
        "timeout_seconds": 30
    }'::json,
    NOW(),
    NOW()
)
ON CONFLICT (tenant_id, key)
DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();

SELECT '✅ NetBox configured for tenant' AS status;
EOF

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}📋 Summary:${NC}"
echo ""
echo "Platform Level (http://localhost:3002):"
echo "  Email:    admin@dotmac-platform.com"
echo "  Password: Admin123!"
echo "  Role:     Platform Administrator (manages all tenants)"
echo ""
echo "Tenant Level (http://localhost:3001):"
echo "  Email:    admin@demo-isp.local"
echo "  Password: Admin123!"
echo "  Role:     ISP Administrator (manages Demo ISP Company)"
echo "  Tenant:   demo-isp"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Change these passwords in production!${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Set tenant ID in browser localStorage:"
echo "   Open DevTools Console (F12) and run:"
echo "   localStorage.setItem('tenant_id', 'default-isp');"
echo "   location.reload();"
echo ""
echo "2. Login to Platform Admin: http://localhost:3002"
echo "3. Login to ISP Ops: http://localhost:3001"
echo ""
