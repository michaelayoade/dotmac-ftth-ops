-- Deployment Orchestration Layer Database Migration
-- Version: 1.0.0
-- Description: Creates tables for multi-tenant deployment orchestration

-- Deployment Templates
CREATE TABLE deployment_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Configuration
    backend VARCHAR(50) NOT NULL CHECK (backend IN ('kubernetes', 'awx_ansible', 'docker_compose', 'terraform', 'manual')),
    deployment_type VARCHAR(50) NOT NULL CHECK (deployment_type IN ('cloud_shared', 'cloud_dedicated', 'on_prem', 'hybrid', 'edge')),
    version VARCHAR(50) NOT NULL,

    -- Resource specifications
    cpu_cores INTEGER CHECK (cpu_cores > 0),
    memory_gb INTEGER CHECK (memory_gb > 0),
    storage_gb INTEGER CHECK (storage_gb > 0),
    max_users INTEGER CHECK (max_users > 0),

    -- Configuration schemas
    config_schema JSONB,
    default_config JSONB,
    required_secrets JSONB,
    feature_flags JSONB,

    -- Execution artifacts
    helm_chart_url VARCHAR(500),
    helm_chart_version VARCHAR(50),
    ansible_playbook_path VARCHAR(500),
    terraform_module_path VARCHAR(500),
    docker_compose_path VARCHAR(500),

    -- Metadata
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    requires_approval BOOLEAN DEFAULT FALSE,
    estimated_provision_time_minutes INTEGER,
    tags JSONB,

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for templates
CREATE INDEX idx_deployment_templates_name ON deployment_templates(name);
CREATE INDEX idx_deployment_templates_backend ON deployment_templates(backend);
CREATE INDEX idx_deployment_templates_type ON deployment_templates(deployment_type);
CREATE INDEX idx_deployment_templates_active ON deployment_templates(is_active) WHERE is_active = TRUE;

-- Deployment Instances
CREATE TABLE deployment_instances (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL REFERENCES deployment_templates(id),

    -- Environment
    environment VARCHAR(50) NOT NULL,
    region VARCHAR(50),
    availability_zone VARCHAR(50),

    -- State
    state VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (state IN (
        'pending', 'provisioning', 'active', 'degraded', 'suspended',
        'failed', 'destroying', 'destroyed', 'upgrading', 'rolling_back'
    )),
    state_reason TEXT,
    last_state_change TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Configuration
    config JSONB NOT NULL DEFAULT '{}',
    secrets_path VARCHAR(500),
    version VARCHAR(50) NOT NULL,

    -- Topology
    endpoints JSONB,
    namespace VARCHAR(255),
    cluster_name VARCHAR(255),
    backend_job_id VARCHAR(255),

    -- Resources
    allocated_cpu INTEGER CHECK (allocated_cpu > 0),
    allocated_memory_gb INTEGER CHECK (allocated_memory_gb > 0),
    allocated_storage_gb INTEGER CHECK (allocated_storage_gb > 0),

    -- Health
    health_check_url VARCHAR(500),
    last_health_check TIMESTAMP,
    health_status VARCHAR(50),
    health_details JSONB,

    -- Metadata
    tags JSONB,
    notes TEXT,
    deployed_by INTEGER REFERENCES "user"(id),
    approved_by INTEGER REFERENCES "user"(id),

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT uq_tenant_environment UNIQUE (tenant_id, environment)
);

-- Indexes for instances
CREATE INDEX idx_deployment_instances_tenant ON deployment_instances(tenant_id);
CREATE INDEX idx_deployment_instances_template ON deployment_instances(template_id);
CREATE INDEX idx_deployment_instances_state ON deployment_instances(state);
CREATE INDEX idx_deployment_instances_environment ON deployment_instances(environment);
CREATE INDEX idx_deployment_instances_namespace ON deployment_instances(namespace);
CREATE INDEX idx_deployment_instances_health ON deployment_instances(health_status);

-- Deployment Executions
CREATE TABLE deployment_executions (
    id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL REFERENCES deployment_instances(id) ON DELETE CASCADE,

    -- Execution details
    operation VARCHAR(50) NOT NULL,
    state VARCHAR(50) NOT NULL DEFAULT 'running',
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    duration_seconds INTEGER,

    -- Backend execution
    backend_job_id VARCHAR(255),
    backend_job_url VARCHAR(500),
    backend_logs TEXT,

    -- Configuration
    operation_config JSONB,
    from_version VARCHAR(50),
    to_version VARCHAR(50),

    -- Results
    result VARCHAR(50),
    error_message TEXT,
    rollback_execution_id INTEGER REFERENCES deployment_executions(id),

    -- Audit
    triggered_by INTEGER REFERENCES "user"(id),
    trigger_type VARCHAR(50),

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for executions
CREATE INDEX idx_deployment_executions_instance ON deployment_executions(instance_id);
CREATE INDEX idx_deployment_executions_operation ON deployment_executions(operation);
CREATE INDEX idx_deployment_executions_state ON deployment_executions(state);
CREATE INDEX idx_deployment_executions_job_id ON deployment_executions(backend_job_id);
CREATE INDEX idx_deployment_executions_started ON deployment_executions(started_at DESC);

-- Deployment Health
CREATE TABLE deployment_health (
    id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL REFERENCES deployment_instances(id) ON DELETE CASCADE,

    -- Health check details
    check_type VARCHAR(50) NOT NULL,
    endpoint VARCHAR(500),
    status VARCHAR(50) NOT NULL,
    response_time_ms INTEGER,

    -- Metrics
    cpu_usage_percent INTEGER CHECK (cpu_usage_percent >= 0 AND cpu_usage_percent <= 100),
    memory_usage_percent INTEGER CHECK (memory_usage_percent >= 0 AND memory_usage_percent <= 100),
    disk_usage_percent INTEGER CHECK (disk_usage_percent >= 0 AND disk_usage_percent <= 100),
    active_connections INTEGER CHECK (active_connections >= 0),
    request_rate INTEGER CHECK (request_rate >= 0),
    error_rate INTEGER CHECK (error_rate >= 0),

    -- Details
    details JSONB,
    error_message TEXT,
    alerts_triggered JSONB,

    -- Timestamp
    checked_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for health
CREATE INDEX idx_deployment_health_instance ON deployment_health(instance_id);
CREATE INDEX idx_deployment_health_status ON deployment_health(status);
CREATE INDEX idx_deployment_health_checked ON deployment_health(checked_at DESC);
CREATE INDEX idx_deployment_health_recent ON deployment_health(instance_id, checked_at DESC);

-- Functions for updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_deployment_templates_updated_at BEFORE UPDATE ON deployment_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deployment_instances_updated_at BEFORE UPDATE ON deployment_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deployment_executions_updated_at BEFORE UPDATE ON deployment_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deployment_health_updated_at BEFORE UPDATE ON deployment_health
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically update instance state when execution completes
CREATE OR REPLACE FUNCTION update_instance_state_on_execution_complete()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.state IN ('succeeded', 'failed') AND OLD.state = 'running' THEN
        IF NEW.operation = 'provision' AND NEW.state = 'succeeded' THEN
            UPDATE deployment_instances
            SET state = 'active',
                last_state_change = NOW(),
                version = NEW.to_version
            WHERE id = NEW.instance_id;
        ELSIF NEW.operation = 'upgrade' AND NEW.state = 'succeeded' THEN
            UPDATE deployment_instances
            SET state = 'active',
                last_state_change = NOW(),
                version = NEW.to_version
            WHERE id = NEW.instance_id;
        ELSIF NEW.operation = 'suspend' AND NEW.state = 'succeeded' THEN
            UPDATE deployment_instances
            SET state = 'suspended',
                last_state_change = NOW()
            WHERE id = NEW.instance_id;
        ELSIF NEW.operation = 'destroy' AND NEW.state = 'succeeded' THEN
            UPDATE deployment_instances
            SET state = 'destroyed',
                last_state_change = NOW()
            WHERE id = NEW.instance_id;
        ELSIF NEW.state = 'failed' THEN
            UPDATE deployment_instances
            SET state = 'failed',
                state_reason = NEW.error_message,
                last_state_change = NOW()
            WHERE id = NEW.instance_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_instance_on_execution_complete
    AFTER UPDATE ON deployment_executions
    FOR EACH ROW EXECUTE FUNCTION update_instance_state_on_execution_complete();

-- Insert sample deployment templates
INSERT INTO deployment_templates (name, display_name, description, backend, deployment_type, version, cpu_cores, memory_gb, storage_gb, max_users, helm_chart_url, helm_chart_version, is_active, requires_approval, estimated_provision_time_minutes)
VALUES
    ('isp-ops-standard', 'ISP Operations - Standard', 'Standard ISP operations deployment with RADIUS, billing, and ticketing', 'kubernetes', 'cloud_dedicated', '1.0.0', 4, 16, 100, 50, 'https://charts.dotmac.com/isp-ops', '1.0.0', TRUE, FALSE, 15),
    ('isp-ops-enterprise', 'ISP Operations - Enterprise', 'Enterprise ISP operations with advanced analytics and multi-region support', 'kubernetes', 'cloud_dedicated', '1.0.0', 8, 32, 500, 200, 'https://charts.dotmac.com/isp-ops', '1.0.0', TRUE, TRUE, 30),
    ('isp-ops-onprem', 'ISP Operations - On-Premises', 'On-premises ISP operations deployment via AWX/Ansible', 'awx_ansible', 'on_prem', '1.0.0', 4, 16, 200, 100, NULL, NULL, TRUE, TRUE, 45),
    ('isp-ops-edge', 'ISP Operations - Edge', 'Lightweight edge deployment using Docker Compose', 'docker_compose', 'edge', '1.0.0', 2, 8, 50, 20, NULL, NULL, TRUE, FALSE, 10);

-- Comments
COMMENT ON TABLE deployment_templates IS 'Reusable deployment configuration templates';
COMMENT ON TABLE deployment_instances IS 'Active tenant deployment instances';
COMMENT ON TABLE deployment_executions IS 'Deployment operation execution history';
COMMENT ON TABLE deployment_health IS 'Deployment health monitoring records';

COMMENT ON COLUMN deployment_instances.state IS 'Current lifecycle state of deployment';
COMMENT ON COLUMN deployment_instances.namespace IS 'Kubernetes namespace or deployment identifier';
COMMENT ON COLUMN deployment_executions.operation IS 'Type of operation: provision, upgrade, suspend, resume, destroy, scale, rollback';
COMMENT ON COLUMN deployment_health.check_type IS 'Type of health check: http, tcp, grpc, icmp, custom';
