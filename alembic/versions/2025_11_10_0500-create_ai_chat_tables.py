"""create ai chat tables

Revision ID: 2025_11_10_0500
Revises: cca121d0deaa
Create Date: 2025-11-10 05:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '2025_11_10_0500'
down_revision = 'cca121d0deaa'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create AI Chat tables."""

    # Create ai_chat_sessions table
    op.execute("""
        CREATE TABLE IF NOT EXISTS ai_chat_sessions (
            id SERIAL PRIMARY KEY,
            tenant_id VARCHAR(50) NOT NULL,
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

            -- Session metadata
            session_type VARCHAR(50) NOT NULL DEFAULT 'customer_support',
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            provider VARCHAR(20) NOT NULL DEFAULT 'openai',
            model VARCHAR(50),

            -- Context
            context JSONB,
            metadata JSONB,

            -- Timestamps
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
            completed_at TIMESTAMP WITHOUT TIME ZONE,

            -- Metrics
            message_count INTEGER DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            total_cost INTEGER DEFAULT 0,

            -- Satisfaction
            user_rating INTEGER,
            user_feedback TEXT,

            -- Escalation
            escalated_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            escalation_reason TEXT,

            CONSTRAINT chk_user_rating CHECK (user_rating IS NULL OR (user_rating >= 1 AND user_rating <= 5)),
            CONSTRAINT chk_session_type CHECK (session_type IN ('customer_support', 'admin_assistant', 'network_diagnostics', 'analytics')),
            CONSTRAINT chk_status CHECK (status IN ('active', 'completed', 'escalated', 'abandoned')),
            CONSTRAINT chk_provider CHECK (provider IN ('openai', 'anthropic', 'azure_openai', 'local'))
        );
    """)

    # Create ai_chat_messages table
    op.execute("""
        CREATE TABLE IF NOT EXISTS ai_chat_messages (
            id SERIAL PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,

            -- Message content
            role VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,

            -- Function calling
            function_name VARCHAR(100),
            function_args JSONB,
            function_result JSONB,

            -- Metadata
            metadata JSONB,
            tokens INTEGER,
            cost INTEGER,

            -- Timestamps
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),

            CONSTRAINT chk_role CHECK (role IN ('user', 'assistant', 'system', 'function'))
        );
    """)

    # Create indexes for better performance
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_tenant_id ON ai_chat_sessions(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_id ON ai_chat_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_customer_id ON ai_chat_sessions(customer_id);
        CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_status ON ai_chat_sessions(status);
        CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_created_at ON ai_chat_sessions(created_at);

        CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session_id ON ai_chat_messages(session_id);
        CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_created_at ON ai_chat_messages(created_at);
        CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_role ON ai_chat_messages(role);
    """)

    # Create function to update updated_at timestamp
    op.execute("""
        CREATE OR REPLACE FUNCTION update_ai_chat_session_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW() AT TIME ZONE 'utc';
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Create trigger for auto-updating updated_at
    op.execute("""
        CREATE TRIGGER trg_ai_chat_sessions_updated_at
        BEFORE UPDATE ON ai_chat_sessions
        FOR EACH ROW
        EXECUTE FUNCTION update_ai_chat_session_updated_at();
    """)


def downgrade() -> None:
    """Drop AI Chat tables."""
    op.execute('DROP TRIGGER IF EXISTS trg_ai_chat_sessions_updated_at ON ai_chat_sessions;')
    op.execute('DROP FUNCTION IF EXISTS update_ai_chat_session_updated_at();')
    op.execute('DROP TABLE IF EXISTS ai_chat_messages CASCADE;')
    op.execute('DROP TABLE IF EXISTS ai_chat_sessions CASCADE;')
