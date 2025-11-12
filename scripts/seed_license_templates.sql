-- License Template Seeding Script
-- Creates production-ready license templates for ISP service plans
-- Run with: psql -U dotmac_user -d dotmac -f scripts/seed_license_templates.sql

-- ============================================================================
-- ISP License Templates
-- ============================================================================

-- 1. Starter ISP License (Budget Tier)
INSERT INTO licensing_license_templates (
    id,
    template_name,
    product_id,
    description,
    tenant_id,
    license_type,
    license_model,
    default_duration,
    max_activations,
    features,
    restrictions,
    pricing,
    auto_renewal_enabled,
    trial_allowed,
    trial_duration_days,
    grace_period_days,
    active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'starter_isp_license',
    'ISP-STARTER-001',
    'Entry-level ISP license for home users and small businesses. Includes basic internet access and customer portal.',
    NULL,  -- Global template (no tenant_id = available to all tenants)
    'SUBSCRIPTION',
    'PER_SEAT',
    365,  -- 1 year duration
    1,    -- Single device/connection
    '{
        "features": [
            {
                "feature_id": "internet_access",
                "feature_name": "Internet Access",
                "enabled": true,
                "limit_value": 50,
                "limit_type": "bandwidth_mbps",
                "expires_at": null
            },
            {
                "feature_id": "customer_portal",
                "feature_name": "Customer Portal",
                "enabled": true,
                "limit_value": null,
                "limit_type": null,
                "expires_at": null
            },
            {
                "feature_id": "basic_support",
                "feature_name": "Email Support",
                "enabled": true,
                "limit_value": null,
                "limit_type": null,
                "expires_at": null
            }
        ]
    }'::jsonb,
    '{
        "restrictions": [
            {
                "restriction_type": "BANDWIDTH",
                "values": ["50_mbps"],
                "operator": "MAX"
            },
            {
                "restriction_type": "DEVICES",
                "values": ["1"],
                "operator": "MAX"
            }
        ]
    }'::jsonb,
    '{
        "monthly": 39.99,
        "annual": 399.99,
        "setup_fee": 49.99,
        "currency": "USD"
    }'::jsonb,
    true,   -- Auto-renewal enabled
    true,   -- Trial allowed
    30,     -- 30 day trial
    15,     -- 15 day grace period
    true,   -- Active
    NOW(),
    NOW()
);

-- 2. Professional ISP License (Mid Tier)
INSERT INTO licensing_license_templates (
    id,
    template_name,
    product_id,
    description,
    tenant_id,
    license_type,
    license_model,
    default_duration,
    max_activations,
    features,
    restrictions,
    pricing,
    auto_renewal_enabled,
    trial_allowed,
    trial_duration_days,
    grace_period_days,
    active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'professional_isp_license',
    'ISP-PRO-001',
    'Professional ISP license for small businesses. Includes faster speeds, static IP, priority support, and SLA guarantee.',
    NULL,
    'SUBSCRIPTION',
    'PER_SEAT',
    365,
    5,    -- Up to 5 devices/connections
    '{
        "features": [
            {
                "feature_id": "internet_access",
                "feature_name": "Internet Access",
                "enabled": true,
                "limit_value": 200,
                "limit_type": "bandwidth_mbps",
                "expires_at": null
            },
            {
                "feature_id": "static_ip",
                "feature_name": "Static IP Address",
                "enabled": true,
                "limit_value": 1,
                "limit_type": "ip_addresses",
                "expires_at": null
            },
            {
                "feature_id": "customer_portal",
                "feature_name": "Customer Portal",
                "enabled": true,
                "limit_value": null,
                "limit_type": null,
                "expires_at": null
            },
            {
                "feature_id": "priority_support",
                "feature_name": "Priority Phone & Email Support",
                "enabled": true,
                "limit_value": null,
                "limit_type": null,
                "expires_at": null
            },
            {
                "feature_id": "sla_99_5",
                "feature_name": "99.5% Uptime SLA",
                "enabled": true,
                "limit_value": null,
                "limit_type": null,
                "expires_at": null
            },
            {
                "feature_id": "usage_analytics",
                "feature_name": "Usage Analytics Dashboard",
                "enabled": true,
                "limit_value": null,
                "limit_type": null,
                "expires_at": null
            }
        ]
    }'::jsonb,
    '{
        "restrictions": [
            {
                "restriction_type": "BANDWIDTH",
                "values": ["200_mbps"],
                "operator": "MAX"
            },
            {
                "restriction_type": "DEVICES",
                "values": ["5"],
                "operator": "MAX"
            }
        ]
    }'::jsonb,
    '{
        "monthly": 99.99,
        "annual": 999.99,
        "setup_fee": 99.99,
        "currency": "USD"
    }'::jsonb,
    true,
    true,
    14,
    30,
    true,
    NOW(),
    NOW()
);

-- 3. Enterprise ISP License (High Tier)
INSERT INTO licensing_license_templates (
    id,
    template_name,
    product_id,
    description,
    tenant_id,
    license_type,
    license_model,
    default_duration,
    max_activations,
    features,
    restrictions,
    pricing,
    auto_renewal_enabled,
    trial_allowed,
    trial_duration_days,
    grace_period_days,
    active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'enterprise_isp_license',
    'ISP-ENT-001',
    'Enterprise ISP license for large businesses. Includes fiber speeds, multiple IPs, dedicated support, 99.9% SLA, and SD-WAN.',
    NULL,
    'SUBSCRIPTION',
    'CONCURRENT',
    365,
    50,   -- Up to 50 concurrent connections
    '{
        "features": [
            {
                "feature_id": "internet_access",
                "feature_name": "Internet Access",
                "enabled": true,
                "limit_value": 1000,
                "limit_type": "bandwidth_mbps",
                "expires_at": null
            },
            {
                "feature_id": "static_ip",
                "feature_name": "Static IP Addresses",
                "enabled": true,
                "limit_value": 5,
                "limit_type": "ip_addresses",
                "expires_at": null
            },
            {
                "feature_id": "customer_portal",
                "feature_name": "Customer Portal",
                "enabled": true,
                "limit_value": null,
                "limit_type": null,
                "expires_at": null
            },
            {
                "feature_id": "dedicated_support",
                "feature_name": "Dedicated Account Manager & 24/7 Support",
                "enabled": true,
                "limit_value": null,
                "limit_type": null,
                "expires_at": null
            },
            {
                "feature_id": "sla_99_9",
                "feature_name": "99.9% Uptime SLA",
                "enabled": true,
                "limit_value": null,
                "limit_type": null,
                "expires_at": null
            },
            {
                "feature_id": "usage_analytics",
                "feature_name": "Advanced Analytics & Reporting",
                "enabled": true,
                "limit_value": null,
                "limit_type": null,
                "expires_at": null
            },
            {
                "feature_id": "sd_wan",
                "feature_name": "SD-WAN Management",
                "enabled": true,
                "limit_value": null,
                "limit_type": null,
                "expires_at": null
            },
            {
                "feature_id": "failover",
                "feature_name": "Automatic Failover",
                "enabled": true,
                "limit_value": null,
                "limit_type": null,
                "expires_at": null
            },
            {
                "feature_id": "vpn",
                "feature_name": "Business VPN",
                "enabled": true,
                "limit_value": 50,
                "limit_type": "vpn_tunnels",
                "expires_at": null
            }
        ]
    }'::jsonb,
    '{
        "restrictions": [
            {
                "restriction_type": "BANDWIDTH",
                "values": ["1000_mbps"],
                "operator": "MAX"
            },
            {
                "restriction_type": "DEVICES",
                "values": ["50"],
                "operator": "MAX"
            }
        ]
    }'::jsonb,
    '{
        "monthly": 299.99,
        "annual": 2999.99,
        "setup_fee": 499.99,
        "currency": "USD"
    }'::jsonb,
    true,
    false,  -- No trial for enterprise
    null,
    30,
    true,
    NOW(),
    NOW()
);

-- 4. Residential Fiber License (Consumer Tier)
INSERT INTO licensing_license_templates (
    id,
    template_name,
    product_id,
    description,
    tenant_id,
    license_type,
    license_model,
    default_duration,
    max_activations,
    features,
    restrictions,
    pricing,
    auto_renewal_enabled,
    trial_allowed,
    trial_duration_days,
    grace_period_days,
    active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'residential_fiber_license',
    'ISP-FIBER-001',
    'High-speed residential fiber internet. Symmetrical speeds, unlimited data, and whole-home WiFi.',
    NULL,
    'SUBSCRIPTION',
    'PER_SEAT',
    365,
    10,   -- Up to 10 devices
    '{
        "features": [
            {
                "feature_id": "internet_access",
                "feature_name": "Fiber Internet Access",
                "enabled": true,
                "limit_value": 500,
                "limit_type": "bandwidth_mbps",
                "expires_at": null
            },
            {
                "feature_id": "symmetrical_upload",
                "feature_name": "Symmetrical Upload/Download",
                "enabled": true,
                "limit_value": 500,
                "limit_type": "bandwidth_mbps",
                "expires_at": null
            },
            {
                "feature_id": "unlimited_data",
                "feature_name": "Unlimited Data",
                "enabled": true,
                "limit_value": null,
                "limit_type": null,
                "expires_at": null
            },
            {
                "feature_id": "customer_portal",
                "feature_name": "Customer Portal",
                "enabled": true,
                "limit_value": null,
                "limit_type": null,
                "expires_at": null
            },
            {
                "feature_id": "wifi_management",
                "feature_name": "Whole-Home WiFi Management",
                "enabled": true,
                "limit_value": null,
                "limit_type": null,
                "expires_at": null
            },
            {
                "feature_id": "parental_controls",
                "feature_name": "Parental Controls",
                "enabled": true,
                "limit_value": null,
                "limit_type": null,
                "expires_at": null
            },
            {
                "feature_id": "standard_support",
                "feature_name": "24/7 Customer Support",
                "enabled": true,
                "limit_value": null,
                "limit_type": null,
                "expires_at": null
            }
        ]
    }'::jsonb,
    '{
        "restrictions": [
            {
                "restriction_type": "BANDWIDTH",
                "values": ["500_mbps"],
                "operator": "MAX"
            },
            {
                "restriction_type": "DEVICES",
                "values": ["10"],
                "operator": "MAX"
            },
            {
                "restriction_type": "SERVICE_TYPE",
                "values": ["residential"],
                "operator": "ALLOW"
            }
        ]
    }'::jsonb,
    '{
        "monthly": 79.99,
        "annual": 799.99,
        "setup_fee": 0,
        "equipment_rental": 10.00,
        "currency": "USD"
    }'::jsonb,
    true,
    true,
    30,
    15,
    true,
    NOW(),
    NOW()
);

-- ============================================================================
-- Display Created Templates
-- ============================================================================

SELECT
    template_name,
    product_id,
    license_type,
    default_duration || ' days' as duration,
    max_activations,
    (pricing->>'monthly')::decimal as monthly_price,
    active
FROM licensing_license_templates
WHERE created_at >= NOW() - INTERVAL '1 minute'
ORDER BY (pricing->>'monthly')::decimal;

-- Success message
\echo ''
\echo '✓ License templates created successfully!'
\echo ''
\echo 'Templates created:'
\echo '  1. Starter ISP License ($39.99/mo) - 50 Mbps, 1 device'
\echo '  2. Professional ISP License ($99.99/mo) - 200 Mbps, 5 devices, Static IP'
\echo '  3. Enterprise ISP License ($299.99/mo) - 1 Gbps, 50 devices, SD-WAN'
\echo '  4. Residential Fiber License ($79.99/mo) - 500 Mbps, 10 devices, Unlimited'
\echo ''
\echo 'Next steps:'
\echo '  1. Test license issuance: SELECT * FROM licensing_license_templates;'
\echo '  2. Use templates in workflows with template_name or product_id'
\echo '  3. Customize templates for your specific ISP offerings'
\echo ''
