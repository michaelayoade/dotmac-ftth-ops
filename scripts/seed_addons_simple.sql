-- Seed data for billing add-ons catalog
-- Run with: docker exec -i dotmac-postgres psql -U dotmac_user -d dotmac < scripts/seed_addons_simple.sql

INSERT INTO billing_addons (
    id, addon_id, name, description, addon_type, billing_type,
    price, currency, setup_fee, is_quantity_based, min_quantity, max_quantity,
    metered_unit, included_quantity, is_active, is_featured,
    compatible_with_all_plans, compatible_plan_ids, metadata, icon, features
) VALUES
(gen_random_uuid(), 'addon_user_seats_5', 'Additional User Seats (5 seats)', 'Add 5 additional user seats to your subscription for team collaboration', 'user_seats', 'recurring', 25.00, 'USD', NULL, true, 1, 10, NULL, NULL, true, true, true, '{}', '{"seats_per_unit": 5}'::jsonb, 'users-plus', ARRAY['5 additional user accounts', 'Full access to platform features']),
(gen_random_uuid(), 'addon_priority_support', 'Priority Support', '24/7 premium support with dedicated account manager and 1-hour response time', 'service', 'recurring', 99.00, 'USD', 50.00, false, 1, NULL, NULL, NULL, true, true, true, '{}', '{"response_time_sla": "1 hour"}'::jsonb, 'headset', ARRAY['24/7 premium support access', 'Dedicated account manager']),
(gen_random_uuid(), 'addon_analytics', 'Advanced Analytics Dashboard', 'Real-time analytics, custom reports, and data export capabilities', 'feature', 'recurring', 49.00, 'USD', NULL, false, 1, NULL, NULL, NULL, true, true, false, '{}', '{"report_retention_days": 365}'::jsonb, 'chart-bar', ARRAY['Real-time analytics dashboard', 'Custom report builder']),
(gen_random_uuid(), 'addon_static_ip', 'Static IP Address', 'Dedicated static IP address for your connection', 'resource', 'recurring', 10.00, 'USD', 25.00, true, 1, 5, NULL, NULL, true, false, true, '{}', '{"ip_type": "static_ipv4"}'::jsonb, 'network', ARRAY['Dedicated static IPv4 address', 'Permanent assignment']),
(gen_random_uuid(), 'addon_bandwidth_50', 'Bandwidth Boost (50 Mbps)', 'Increase your connection speed by 50 Mbps', 'resource', 'recurring', 15.00, 'USD', NULL, true, 1, 10, NULL, NULL, true, true, true, '{}', '{"bandwidth_increase_mbps": 50}'::jsonb, 'speedometer', ARRAY['50 Mbps additional bandwidth', 'No data caps']),
(gen_random_uuid(), 'addon_storage_100gb', 'Cloud Storage (100 GB)', 'Secure cloud storage for backups and file sharing', 'resource', 'recurring', 5.00, 'USD', NULL, true, 1, 50, NULL, NULL, true, false, true, '{}', '{"storage_gb": 100}'::jsonb, 'cloud', ARRAY['100 GB secure cloud storage', 'AES-256 encryption']),
(gen_random_uuid(), 'addon_api_metered', 'API Access (Metered)', 'Pay-per-use API access for custom integrations', 'integration', 'metered', 0.01, 'USD', 100.00, false, 1, NULL, 'API calls', 1000, true, false, false, '{}', '{"rate_limit_per_minute": 100}'::jsonb, 'code', ARRAY['Full REST API access', '1,000 calls included monthly'])
ON CONFLICT (addon_id) DO NOTHING;

SELECT addon_id, name, addon_type, price, currency, is_active, is_featured
FROM billing_addons
ORDER BY is_featured DESC, price ASC;
