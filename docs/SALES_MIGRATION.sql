-- ============================================================================
-- Sales-to-Activation Automation - Database Migration
-- ============================================================================
-- Version: 1.0.0
-- Date: 2025-10-16
-- Description: Order processing and service activation tables
--
-- Tables:
--   1. orders - Service orders
--   2. order_items - Order line items
--   3. service_activations - Service activation tracking
--   4. activation_workflows - Activation workflow templates
--
-- This migration should be run after the deployment orchestration migration.
-- ============================================================================

-- ============================================================================
-- Enums
-- ============================================================================

CREATE TYPE order_status AS ENUM (
    'draft',
    'submitted',
    'validating',
    'approved',
    'provisioning',
    'activating',
    'active',
    'failed',
    'cancelled',
    'refunded'
);

CREATE TYPE order_type AS ENUM (
    'new_tenant',
    'upgrade',
    'addon',
    'renewal'
);

CREATE TYPE activation_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'failed',
    'skipped'
);

-- ============================================================================
-- Table: orders
-- ============================================================================

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,

    -- Order details
    order_type order_type NOT NULL,
    status order_status NOT NULL DEFAULT 'draft',
    status_message TEXT,

    -- Customer information
    customer_email VARCHAR(255) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    company_name VARCHAR(255) NOT NULL,

    -- Organization details
    organization_slug VARCHAR(100),
    organization_name VARCHAR(255),
    billing_address JSONB,
    tax_id VARCHAR(100),

    -- Service configuration
    deployment_template_id INTEGER REFERENCES deployment_templates(id),
    deployment_region VARCHAR(50),
    deployment_type VARCHAR(50),

    -- Selected services
    selected_services JSONB,
    service_configuration JSONB,
    features_enabled JSONB,

    -- Pricing
    currency VARCHAR(3) DEFAULT 'USD',
    subtotal NUMERIC(10, 2) DEFAULT 0,
    tax_amount NUMERIC(10, 2) DEFAULT 0,
    total_amount NUMERIC(10, 2) NOT NULL,
    billing_cycle VARCHAR(20),

    -- Processing metadata
    tenant_id INTEGER REFERENCES tenant(id),
    deployment_instance_id INTEGER REFERENCES deployment_instances(id),
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    approved_at TIMESTAMP,
    approved_by INTEGER REFERENCES "user"(id),

    -- External references
    external_order_id VARCHAR(255),
    payment_reference VARCHAR(255),
    contract_reference VARCHAR(255),

    -- Notifications
    notification_email VARCHAR(255),
    send_welcome_email BOOLEAN DEFAULT TRUE,
    send_activation_email BOOLEAN DEFAULT TRUE,

    -- Metadata
    source VARCHAR(50),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    notes TEXT,
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Table: order_items
-- ============================================================================

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

    -- Item details
    item_type VARCHAR(50) NOT NULL,
    service_code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Pricing
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL,
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    tax_amount NUMERIC(10, 2) DEFAULT 0,
    total_amount NUMERIC(10, 2) NOT NULL,

    -- Configuration
    configuration JSONB,
    billing_cycle VARCHAR(20),
    trial_days INTEGER DEFAULT 0,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    activated_at TIMESTAMP,

    -- Metadata
    product_id VARCHAR(100),
    sku VARCHAR(100),
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Table: service_activations
-- ============================================================================

CREATE TABLE service_activations (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    tenant_id INTEGER NOT NULL REFERENCES tenant(id),

    -- Service details
    service_code VARCHAR(100) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    activation_status activation_status NOT NULL DEFAULT 'pending',

    -- Activation tracking
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_seconds INTEGER,

    -- Results
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Service-specific data
    activation_data JSONB,
    configuration JSONB,

    -- Dependencies
    depends_on JSONB,
    blocks JSONB,

    -- Order in activation sequence
    sequence_number INTEGER DEFAULT 0,

    -- Metadata
    activated_by INTEGER REFERENCES "user"(id),
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Table: activation_workflows
-- ============================================================================

CREATE TABLE activation_workflows (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,

    -- Workflow definition
    deployment_template_id INTEGER REFERENCES deployment_templates(id),
    service_sequence JSONB NOT NULL,
    parallel_groups JSONB,

    -- Configuration
    auto_activate BOOLEAN DEFAULT TRUE,
    require_approval BOOLEAN DEFAULT FALSE,
    rollback_on_failure BOOLEAN DEFAULT TRUE,
    max_duration_minutes INTEGER DEFAULT 60,

    -- Conditions
    activation_conditions JSONB,
    skip_conditions JSONB,

    -- Metadata
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version VARCHAR(20) DEFAULT '1.0.0',
    tags JSONB,

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Orders indexes
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
CREATE INDEX idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX idx_orders_deployment_instance_id ON orders(deployment_instance_id);
CREATE INDEX idx_orders_external_order_id ON orders(external_order_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Order items indexes
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_service_code ON order_items(service_code);

-- Service activations indexes
CREATE INDEX idx_service_activations_order_id ON service_activations(order_id);
CREATE INDEX idx_service_activations_tenant_id ON service_activations(tenant_id);
CREATE INDEX idx_service_activations_service_code ON service_activations(service_code);
CREATE INDEX idx_service_activations_status ON service_activations(activation_status);
CREATE INDEX idx_service_activations_sequence ON service_activations(order_id, sequence_number);

-- Activation workflows indexes
CREATE INDEX idx_activation_workflows_name ON activation_workflows(name);
CREATE INDEX idx_activation_workflows_template_id ON activation_workflows(deployment_template_id);
CREATE INDEX idx_activation_workflows_is_active ON activation_workflows(is_active);

-- ============================================================================
-- Triggers
-- ============================================================================

-- Updated_at trigger for orders
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_updated_at();

-- Updated_at trigger for order_items
CREATE OR REPLACE FUNCTION update_order_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_order_items_updated_at
    BEFORE UPDATE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_order_items_updated_at();

-- Updated_at trigger for service_activations
CREATE OR REPLACE FUNCTION update_service_activations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_service_activations_updated_at
    BEFORE UPDATE ON service_activations
    FOR EACH ROW
    EXECUTE FUNCTION update_service_activations_updated_at();

-- Calculate duration for service activations
CREATE OR REPLACE FUNCTION calculate_activation_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.completed_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
        NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at))::INTEGER;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_activation_duration
    BEFORE UPDATE ON service_activations
    FOR EACH ROW
    WHEN (NEW.completed_at IS NOT NULL)
    EXECUTE FUNCTION calculate_activation_duration();

-- ============================================================================
-- Sample Data
-- ============================================================================

-- Sample activation workflows
INSERT INTO activation_workflows (name, description, deployment_template_id, service_sequence, auto_activate, is_active)
VALUES
    (
        'Standard ISP Activation',
        'Standard service activation workflow for ISP deployments',
        1, -- Assumes deployment_template id 1 exists
        '[
            {"service": "subscriber-provisioning", "sequence": 1, "depends_on": []},
            {"service": "billing-invoicing", "sequence": 2, "depends_on": ["subscriber-provisioning"]},
            {"service": "radius-aaa", "sequence": 3, "depends_on": ["subscriber-provisioning"]},
            {"service": "network-monitoring", "sequence": 4, "depends_on": ["radius-aaa"]}
        ]'::jsonb,
        TRUE,
        TRUE
    ),
    (
        'Enterprise ISP Activation',
        'Enhanced activation workflow with analytics and automation',
        2, -- Assumes deployment_template id 2 exists
        '[
            {"service": "subscriber-provisioning", "sequence": 1, "depends_on": []},
            {"service": "billing-invoicing", "sequence": 2, "depends_on": ["subscriber-provisioning"]},
            {"service": "radius-aaa", "sequence": 3, "depends_on": ["subscriber-provisioning"]},
            {"service": "network-monitoring", "sequence": 4, "depends_on": ["radius-aaa"]},
            {"service": "analytics-reporting", "sequence": 5, "depends_on": ["network-monitoring"]},
            {"service": "automation-workflows", "sequence": 6, "depends_on": ["analytics-reporting"]}
        ]'::jsonb,
        TRUE,
        TRUE
    );

-- Sample order (draft state)
INSERT INTO orders (
    order_number,
    order_type,
    status,
    customer_email,
    customer_name,
    company_name,
    organization_slug,
    deployment_template_id,
    deployment_region,
    selected_services,
    currency,
    subtotal,
    tax_amount,
    total_amount,
    billing_cycle,
    source
)
VALUES (
    'ORD-20251016-1001',
    'new_tenant',
    'draft',
    'admin@example-isp.com',
    'John Smith',
    'Example ISP Inc.',
    'example-isp',
    1,
    'us-east-1',
    '[
        {"service_code": "subscriber-provisioning", "name": "Subscriber Management", "quantity": 1},
        {"service_code": "billing-invoicing", "name": "Billing & Invoicing", "quantity": 1},
        {"service_code": "radius-aaa", "name": "RADIUS AAA", "quantity": 1}
    ]'::jsonb,
    'USD',
    347.00,
    0.00,
    347.00,
    'monthly',
    'public_api'
);

-- Sample order items for the order
INSERT INTO order_items (order_id, item_type, service_code, name, quantity, unit_price, total_amount, billing_cycle)
VALUES
    (1, 'service', 'subscriber-provisioning', 'Subscriber Management', 1, 99.00, 99.00, 'monthly'),
    (1, 'service', 'billing-invoicing', 'Billing & Invoicing', 1, 149.00, 149.00, 'monthly'),
    (1, 'service', 'radius-aaa', 'RADIUS AAA', 1, 99.00, 99.00, 'monthly');

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to get order statistics
CREATE OR REPLACE FUNCTION get_order_statistics()
RETURNS TABLE (
    total_orders BIGINT,
    active_orders BIGINT,
    failed_orders BIGINT,
    total_revenue NUMERIC,
    avg_processing_time INTERVAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE status = 'active') as active_orders,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_orders,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'active'), 0) as total_revenue,
        AVG(processing_completed_at - processing_started_at) FILTER (
            WHERE processing_completed_at IS NOT NULL
            AND processing_started_at IS NOT NULL
        ) as avg_processing_time
    FROM orders;
END;
$$ LANGUAGE plpgsql;

-- Function to get activation progress for an order
CREATE OR REPLACE FUNCTION get_activation_progress(p_order_id INTEGER)
RETURNS TABLE (
    total_services INTEGER,
    completed INTEGER,
    in_progress INTEGER,
    failed INTEGER,
    pending INTEGER,
    progress_percent INTEGER
) AS $$
DECLARE
    v_total INTEGER;
    v_completed INTEGER;
    v_in_progress INTEGER;
    v_failed INTEGER;
    v_pending INTEGER;
BEGIN
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE activation_status = 'completed'),
        COUNT(*) FILTER (WHERE activation_status = 'in_progress'),
        COUNT(*) FILTER (WHERE activation_status = 'failed'),
        COUNT(*) FILTER (WHERE activation_status = 'pending')
    INTO v_total, v_completed, v_in_progress, v_failed, v_pending
    FROM service_activations
    WHERE order_id = p_order_id;

    RETURN QUERY
    SELECT
        v_total,
        v_completed,
        v_in_progress,
        v_failed,
        v_pending,
        CASE
            WHEN v_total > 0 THEN (v_completed::NUMERIC / v_total * 100)::INTEGER
            ELSE 0
        END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE orders IS 'Service orders for platform provisioning';
COMMENT ON TABLE order_items IS 'Line items in service orders';
COMMENT ON TABLE service_activations IS 'Tracks activation status of individual services';
COMMENT ON TABLE activation_workflows IS 'Workflow templates defining service activation sequences';

COMMENT ON COLUMN orders.order_number IS 'Unique order reference number for customer communication';
COMMENT ON COLUMN orders.deployment_template_id IS 'Links to deployment template to provision';
COMMENT ON COLUMN orders.selected_services IS 'JSON array of services to activate';
COMMENT ON COLUMN orders.tenant_id IS 'Links to created tenant (null until provisioned)';
COMMENT ON COLUMN orders.deployment_instance_id IS 'Links to deployed instance (null until provisioned)';

COMMENT ON COLUMN service_activations.depends_on IS 'JSON array of service codes this activation depends on';
COMMENT ON COLUMN service_activations.activation_data IS 'JSON object containing service endpoints, credentials, etc.';
COMMENT ON COLUMN service_activations.sequence_number IS 'Order in which this service should be activated';

COMMENT ON COLUMN activation_workflows.service_sequence IS 'JSON array defining activation order and dependencies';
COMMENT ON COLUMN activation_workflows.parallel_groups IS 'JSON array of service groups that can activate in parallel';

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Verify tables created
SELECT
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
    AND table_name IN ('orders', 'order_items', 'service_activations', 'activation_workflows')
ORDER BY table_name;

-- Verify indexes created
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('orders', 'order_items', 'service_activations', 'activation_workflows')
ORDER BY tablename, indexname;

-- Verify sample data
SELECT
    'orders' as table_name, COUNT(*) as row_count FROM orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL
SELECT 'service_activations', COUNT(*) FROM service_activations
UNION ALL
SELECT 'activation_workflows', COUNT(*) FROM activation_workflows;

-- ============================================================================
-- Rollback Script
-- ============================================================================

/*
-- To rollback this migration, run:

DROP TRIGGER IF EXISTS trigger_calculate_activation_duration ON service_activations;
DROP TRIGGER IF EXISTS trigger_service_activations_updated_at ON service_activations;
DROP TRIGGER IF EXISTS trigger_order_items_updated_at ON order_items;
DROP TRIGGER IF EXISTS trigger_orders_updated_at ON orders;

DROP FUNCTION IF EXISTS calculate_activation_duration();
DROP FUNCTION IF EXISTS update_service_activations_updated_at();
DROP FUNCTION IF EXISTS update_order_items_updated_at();
DROP FUNCTION IF EXISTS update_orders_updated_at();
DROP FUNCTION IF EXISTS get_activation_progress(INTEGER);
DROP FUNCTION IF EXISTS get_order_statistics();

DROP TABLE IF EXISTS service_activations CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS activation_workflows CASCADE;

DROP TYPE IF EXISTS activation_status;
DROP TYPE IF EXISTS order_type;
DROP TYPE IF EXISTS order_status;
*/
