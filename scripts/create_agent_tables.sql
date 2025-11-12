-- Agent & Reporting Enhancements - Manual Table Creation
-- Run this if alembic migrations have conflicts

-- Create agent_availability table
CREATE TABLE IF NOT EXISTS agent_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    tenant_id VARCHAR(100),
    status VARCHAR(20) NOT NULL CHECK (status IN ('available', 'busy', 'offline', 'away')) DEFAULT 'available',
    status_message TEXT,
    last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for agent_availability
CREATE INDEX IF NOT EXISTS ix_agent_availability_user_id ON agent_availability(user_id);
CREATE INDEX IF NOT EXISTS ix_agent_availability_tenant_id ON agent_availability(tenant_id);
CREATE INDEX IF NOT EXISTS ix_agent_availability_status ON agent_availability(status);

-- Create agent_skills table
CREATE TABLE IF NOT EXISTS agent_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tenant_id VARCHAR(100),
    skill_category VARCHAR(100) NOT NULL,
    skill_level INTEGER NOT NULL DEFAULT 1 CHECK (skill_level BETWEEN 1 AND 4),
    can_handle_escalations BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for agent_skills
CREATE INDEX IF NOT EXISTS ix_agent_skills_user_id ON agent_skills(user_id);
CREATE INDEX IF NOT EXISTS ix_agent_skills_tenant_id ON agent_skills(tenant_id);
CREATE INDEX IF NOT EXISTS ix_agent_skills_skill_category ON agent_skills(skill_category);

-- Insert sample data for testing (optional)
-- Uncomment if you want test data

-- INSERT INTO agent_availability (user_id, tenant_id, status, status_message)
-- SELECT
--     id,
--     tenant_id,
--     'available'::VARCHAR,
--     'Ready for tickets'::TEXT
-- FROM users
-- WHERE tenant_id IS NOT NULL
-- LIMIT 5
-- ON CONFLICT (user_id) DO NOTHING;

-- Verify tables created
SELECT
    tablename,
    schemaname
FROM pg_tables
WHERE tablename IN ('agent_availability', 'agent_skills')
ORDER BY tablename;
