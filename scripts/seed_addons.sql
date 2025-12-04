-- Seed data for billing add-ons catalog
-- Run with: docker exec -i dotmac-postgres psql -U dotmac_user -d dotmac -f /dev/stdin < scripts/seed_addons.sql

-- Check if add-ons already exist and insert
DO $$
DECLARE
    addon_count INTEGER;
    tenant_id_var TEXT := 'default_tenant';
BEGIN
    SELECT COUNT(*) INTO addon_count FROM billing_addons WHERE tenant_id = tenant_id_var;

    IF addon_count > 0 THEN
        RAISE NOTICE 'Add-ons already exist for tenant %. Skipping seed.', tenant_id_var;
    ELSE
        -- Insert add-ons
        INSERT INTO billing_addons (
            addon_id, tenant_id, name, description, addon_type, billing_type,
            price, currency, setup_fee, is_quantity_based, min_quantity, max_quantity,
            metered_unit, included_quantity, is_active, is_featured,
            compatible_with_all_plans, compatible_plan_ids, metadata, icon, features,
            created_at, updated_at
        ) VALUES
        -- 1. Additional User Seats
        (
            'addon_' || substr(md5(random()::text), 1, 12),
            tenant_id_var,
            'Additional User Seats (5 seats)',
            'Add 5 additional user seats to your subscription for team collaboration',
            'user_seats',
            'recurring',
            25.00,
            'USD',
            NULL,
            true,
            1,
            10,
            NULL,
            NULL,
            true,
            true,
            true,
            '[]'::jsonb,
            '{"seats_per_unit": 5, "permissions": ["user_management", "team_collaboration"]}'::jsonb,
            'users-plus',
            '["5 additional user accounts", "Full access to platform features", "Team collaboration tools", "Role-based access control"]'::jsonb,
            NOW(),
            NOW()
        ),
        -- 2. Priority Support
        (
            'addon_' || substr(md5(random()::text), 1, 12),
            tenant_id_var,
            'Priority Support',
            '24/7 premium support with dedicated account manager and 1-hour response time',
            'service',
            'recurring',
            99.00,
            'USD',
            50.00,
            false,
            1,
            NULL,
            NULL,
            NULL,
            true,
            true,
            true,
            '[]'::jsonb,
            '{"response_time_sla": "1 hour", "availability": "24/7", "dedicated_manager": true}'::jsonb,
            'headset',
            '["24/7 premium support access", "Dedicated account manager", "1-hour response time SLA", "Priority bug fixes", "Direct phone support"]'::jsonb,
            NOW(),
            NOW()
        ),
        -- 3. Advanced Analytics Dashboard
        (
            'addon_' || substr(md5(random()::text), 1, 12),
            tenant_id_var,
            'Advanced Analytics Dashboard',
            'Real-time analytics, custom reports, and data export capabilities',
            'feature',
            'recurring',
            49.00,
            'USD',
            NULL,
            false,
            1,
            NULL,
            NULL,
            NULL,
            true,
            true,
            false,
            '[]'::jsonb,
            '{"report_retention_days": 365, "custom_reports": true, "api_access": true}'::jsonb,
            'chart-bar',
            '["Real-time analytics dashboard", "Custom report builder", "Data export (CSV, Excel, PDF)", "Historical data (365 days)", "API access for integrations"]'::jsonb,
            NOW(),
            NOW()
        ),
        -- 4. Static IP Address
        (
            'addon_' || substr(md5(random()::text), 1, 12),
            tenant_id_var,
            'Static IP Address',
            'Dedicated static IP address for your connection',
            'resource',
            'recurring',
            10.00,
            'USD',
            25.00,
            true,
            1,
            5,
            NULL,
            NULL,
            true,
            false,
            true,
            '[]'::jsonb,
            '{"ip_type": "static_ipv4", "assignment_type": "dedicated"}'::jsonb,
            'network',
            '["Dedicated static IPv4 address", "Permanent assignment", "Ideal for hosting services", "No additional traffic charges"]'::jsonb,
            NOW(),
            NOW()
        ),
        -- 5. Bandwidth Boost (50 Mbps)
        (
            'addon_' || substr(md5(random()::text), 1, 12),
            tenant_id_var,
            'Bandwidth Boost (50 Mbps)',
            'Increase your connection speed by 50 Mbps',
            'resource',
            'recurring',
            15.00,
            'USD',
            NULL,
            true,
            1,
            10,
            NULL,
            NULL,
            true,
            true,
            true,
            '[]'::jsonb,
            '{"bandwidth_increase_mbps": 50, "applies_to": ["download", "upload"]}'::jsonb,
            'speedometer',
            '["50 Mbps additional bandwidth", "No data caps", "Instant activation", "Can be stacked for more speed"]'::jsonb,
            NOW(),
            NOW()
        ),
        -- 6. Cloud Storage (100 GB)
        (
            'addon_' || substr(md5(random()::text), 1, 12),
            tenant_id_var,
            'Cloud Storage (100 GB)',
            'Secure cloud storage for backups and file sharing',
            'resource',
            'recurring',
            5.00,
            'USD',
            NULL,
            true,
            1,
            50,
            NULL,
            NULL,
            true,
            false,
            true,
            '[]'::jsonb,
            '{"storage_gb": 100, "encryption": "AES-256", "backup_retention_days": 30}'::jsonb,
            'cloud',
            '["100 GB secure cloud storage", "AES-256 encryption", "File sharing capabilities", "30-day backup retention", "Web and mobile access"]'::jsonb,
            NOW(),
            NOW()
        ),
        -- 7. API Access (Metered)
        (
            'addon_' || substr(md5(random()::text), 1, 12),
            tenant_id_var,
            'API Access (Metered)',
            'Pay-per-use API access for custom integrations',
            'integration',
            'metered',
            0.01,
            'USD',
            100.00,
            false,
            1,
            NULL,
            'API calls',
            1000,
            true,
            false,
            false,
            '[]'::jsonb,
            '{"rate_limit_per_minute": 100, "included_calls": 1000, "overage_rate": 0.01}'::jsonb,
            'code',
            '["Full REST API access", "1,000 calls included monthly", "$0.01 per additional call", "100 calls/min rate limit", "Comprehensive documentation", "Webhook support"]'::jsonb,
            NOW(),
            NOW()
        );

        RAISE NOTICE 'Successfully seeded 7 add-ons for tenant %', tenant_id_var;
    END IF;
END $$;

-- Display seeded add-ons
SELECT addon_id, name, addon_type, price, currency, is_active, is_featured
FROM billing_addons
WHERE tenant_id = 'default_tenant'
ORDER BY is_featured DESC, price ASC;
