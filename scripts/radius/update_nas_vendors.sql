-- ============================================================================
-- NAS Vendor Migration Script
--
-- This script updates existing NAS records with correct vendor types based
-- on their names, types, and patterns.
--
-- Usage:
--   psql -d dotmac_db -f scripts/radius/update_nas_vendors.sql
--
-- Or run specific sections for your deployment.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Mikrotik Devices
-- ============================================================================

-- Identify Mikrotik devices by name patterns
UPDATE nas
SET
    vendor = 'mikrotik',
    updated_at = NOW()
WHERE
    vendor = 'mikrotik'  -- Only update if still default
    AND (
        shortname ILIKE '%mikrotik%'
        OR shortname ILIKE '%mtk%'
        OR shortname ILIKE '%rb%'  -- RouterBoard
        OR shortname ILIKE '%ccr%'  -- Cloud Core Router
        OR type ILIKE '%mikrotik%'
        OR nasname ILIKE '%mikrotik%'
    );

-- Set model for known Mikrotik series
UPDATE nas
SET model = CASE
    WHEN shortname ILIKE '%ccr%' THEN 'CCR Series'
    WHEN shortname ILIKE '%rb%' THEN 'RouterBoard'
    WHEN shortname ILIKE '%hap%' THEN 'hAP Series'
    WHEN shortname ILIKE '%hex%' THEN 'hEX Series'
    ELSE model
END
WHERE vendor = 'mikrotik' AND model IS NULL;

-- ============================================================================
-- 2. Cisco Devices
-- ============================================================================

-- Identify Cisco devices
UPDATE nas
SET
    vendor = 'cisco',
    updated_at = NOW()
WHERE
    (vendor = 'mikrotik' OR vendor = 'generic')  -- Only update if not already set
    AND (
        shortname ILIKE '%cisco%'
        OR shortname ILIKE '%asr%'
        OR shortname ILIKE '%isr%'
        OR shortname ILIKE '%ncs%'
        OR shortname ILIKE '%cat%'  -- Catalyst
        OR type ILIKE '%cisco%'
        OR nasname ILIKE '%cisco%'
    );

-- Set model for known Cisco series
UPDATE nas
SET model = CASE
    WHEN shortname ILIKE '%asr9%' THEN 'ASR9000'
    WHEN shortname ILIKE '%asr1%' THEN 'ASR1000'
    WHEN shortname ILIKE '%isr4%' THEN 'ISR4000'
    WHEN shortname ILIKE '%ncs%' THEN 'NCS Series'
    WHEN shortname ILIKE '%cat%' THEN 'Catalyst'
    WHEN shortname ILIKE '%me%' THEN 'ME Series'
    ELSE model
END
WHERE vendor = 'cisco' AND model IS NULL;

-- ============================================================================
-- 3. Huawei Devices
-- ============================================================================

-- Identify Huawei devices
UPDATE nas
SET
    vendor = 'huawei',
    updated_at = NOW()
WHERE
    (vendor = 'mikrotik' OR vendor = 'generic')
    AND (
        shortname ILIKE '%huawei%'
        OR shortname ILIKE '%ma%'  -- MA series OLT
        OR shortname ILIKE '%ne%'  -- NE series router
        OR shortname ILIKE '%cx%'  -- CX series switch
        OR shortname ILIKE '%s%'   -- S series switch
        OR type ILIKE '%huawei%'
        OR nasname ILIKE '%huawei%'
        OR description ILIKE '%huawei%'
    );

-- Set model for known Huawei series
UPDATE nas
SET model = CASE
    WHEN shortname ILIKE '%ma5800%' THEN 'MA5800-X Series'
    WHEN shortname ILIKE '%ma5600%' THEN 'MA5600T'
    WHEN shortname ILIKE '%ne40%' THEN 'NE40E'
    WHEN shortname ILIKE '%ne5%' THEN 'NE5000E'
    WHEN shortname ILIKE '%cx600%' THEN 'CX600'
    ELSE model
END
WHERE vendor = 'huawei' AND model IS NULL;

-- ============================================================================
-- 4. Juniper Devices
-- ============================================================================

-- Identify Juniper devices
UPDATE nas
SET
    vendor = 'juniper',
    updated_at = NOW()
WHERE
    (vendor = 'mikrotik' OR vendor = 'generic')
    AND (
        shortname ILIKE '%juniper%'
        OR shortname ILIKE '%mx%'   -- MX series
        OR shortname ILIKE '%ex%'   -- EX series
        OR shortname ILIKE '%qfx%'  -- QFX series
        OR shortname ILIKE '%srx%'  -- SRX series
        OR type ILIKE '%juniper%'
        OR type ILIKE '%junos%'
        OR nasname ILIKE '%juniper%'
    );

-- Set model for known Juniper series
UPDATE nas
SET model = CASE
    WHEN shortname ILIKE '%mx960%' THEN 'MX960'
    WHEN shortname ILIKE '%mx480%' THEN 'MX480'
    WHEN shortname ILIKE '%mx240%' THEN 'MX240'
    WHEN shortname ILIKE '%mx%' THEN 'MX Series'
    WHEN shortname ILIKE '%ex%' THEN 'EX Series'
    WHEN shortname ILIKE '%qfx%' THEN 'QFX Series'
    WHEN shortname ILIKE '%srx%' THEN 'SRX Series'
    ELSE model
END
WHERE vendor = 'juniper' AND model IS NULL;

-- ============================================================================
-- 5. Generic/Unknown Devices
-- ============================================================================

-- Mark remaining devices as generic if vendor detection failed
UPDATE nas
SET vendor = 'generic'
WHERE vendor = 'mikrotik'
  AND shortname NOT ILIKE '%mikrotik%'
  AND shortname NOT ILIKE '%rb%'
  AND shortname NOT ILIKE '%ccr%'
  AND type = 'other';

-- ============================================================================
-- 6. Summary Report
-- ============================================================================

-- Show vendor distribution after migration
SELECT
    vendor,
    COUNT(*) as count,
    COUNT(DISTINCT model) as unique_models,
    array_agg(DISTINCT model) FILTER (WHERE model IS NOT NULL) as models
FROM nas
GROUP BY vendor
ORDER BY count DESC;

-- Show NAS without models (may need manual review)
SELECT
    id,
    tenant_id,
    shortname,
    nasname,
    vendor,
    model,
    type
FROM nas
WHERE model IS NULL
ORDER BY vendor, shortname;

-- ============================================================================
-- 7. Validation Checks
-- ============================================================================

-- Check for potential misclassifications
SELECT
    'REVIEW: Possible misclassification' as warning,
    id,
    shortname,
    nasname,
    vendor,
    type
FROM nas
WHERE
    -- Cisco marked as Mikrotik
    (vendor = 'mikrotik' AND (shortname ILIKE '%cisco%' OR type ILIKE '%cisco%'))
    OR
    -- Huawei marked as Mikrotik
    (vendor = 'mikrotik' AND (shortname ILIKE '%huawei%' OR type ILIKE '%huawei%'))
    OR
    -- Juniper marked as Mikrotik
    (vendor = 'mikrotik' AND (shortname ILIKE '%juniper%' OR type ILIKE '%juniper%'));

COMMIT;

-- ============================================================================
-- Post-Migration Notes
-- ============================================================================

-- After running this script:
-- 1. Review devices marked as 'generic' and update manually if needed
-- 2. Review devices without models and add model information
-- 3. Test RADIUS authentication on each vendor type
-- 4. Test CoA operations on each vendor type
-- 5. Update any custom scripts/dashboards that reference NAS types

-- Manual updates can be done with:
-- UPDATE nas SET vendor = 'cisco', model = 'ASR9000' WHERE id = 123;
