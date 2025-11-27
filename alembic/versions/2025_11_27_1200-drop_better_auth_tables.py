"""drop better auth tables

This migration removes the Better Auth tables that were created but never used.
The application uses FastAPI JWT auth with the existing 'users' table (plural).

Revision ID: 2025_11_27_1200
Revises: 2025_11_27_0800
Create Date: 2025-11-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '2025_11_27_1200'
down_revision = '2025_11_27_0800'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop unused Better Auth tables.

    These tables were created for a Better Auth integration that was
    subsequently removed in favor of FastAPI JWT authentication.
    The application uses the existing 'users' table (plural) not the
    Better Auth 'user' table (singular).
    """
    # Drop indexes first
    op.execute('DROP INDEX IF EXISTS idx_two_factor_user_id;')
    op.execute('DROP INDEX IF EXISTS idx_verification_identifier;')
    op.execute('DROP INDEX IF EXISTS idx_organization_invitation_token;')
    op.execute('DROP INDEX IF EXISTS idx_organization_invitation_org_id;')
    op.execute('DROP INDEX IF EXISTS idx_organization_member_user_id;')
    op.execute('DROP INDEX IF EXISTS idx_organization_member_org_id;')
    op.execute('DROP INDEX IF EXISTS idx_account_user_id;')
    op.execute('DROP INDEX IF EXISTS idx_session_expires_at;')
    op.execute('DROP INDEX IF EXISTS idx_session_user_id;')
    op.execute('DROP INDEX IF EXISTS idx_session_token;')

    # Drop tables in dependency order (children first)
    op.execute('DROP TABLE IF EXISTS "two_factor" CASCADE;')
    op.execute('DROP TABLE IF EXISTS "verification" CASCADE;')
    op.execute('DROP TABLE IF EXISTS "organization_invitation" CASCADE;')
    op.execute('DROP TABLE IF EXISTS "organization_member" CASCADE;')
    op.execute('DROP TABLE IF EXISTS "organization" CASCADE;')
    op.execute('DROP TABLE IF EXISTS "account" CASCADE;')
    op.execute('DROP TABLE IF EXISTS "session" CASCADE;')
    op.execute('DROP TABLE IF EXISTS "user" CASCADE;')


def downgrade() -> None:
    """Recreate Better Auth tables (if needed for rollback).

    WARNING: This will recreate empty tables. Any data that existed
    before the upgrade will NOT be restored.
    """
    # Create user table
    op.execute("""
        CREATE TABLE IF NOT EXISTS "user" (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255),
            email_verified BOOLEAN DEFAULT FALSE,
            image VARCHAR(500),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Create session table
    op.execute("""
        CREATE TABLE IF NOT EXISTS "session" (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
            token VARCHAR(500) UNIQUE NOT NULL,
            ip_address VARCHAR(45),
            user_agent TEXT,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Create account table (for OAuth providers)
    op.execute("""
        CREATE TABLE IF NOT EXISTS "account" (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
            provider VARCHAR(100) NOT NULL,
            provider_account_id VARCHAR(255) NOT NULL,
            refresh_token TEXT,
            access_token TEXT,
            expires_at TIMESTAMP WITH TIME ZONE,
            token_type VARCHAR(100),
            scope TEXT,
            id_token TEXT,
            session_state VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (provider, provider_account_id)
        );
    """)

    # Create organization table
    op.execute("""
        CREATE TABLE IF NOT EXISTS "organization" (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) UNIQUE,
            logo VARCHAR(500),
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Create organization_member table
    op.execute("""
        CREATE TABLE IF NOT EXISTS "organization_member" (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
            role VARCHAR(100) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (organization_id, user_id)
        );
    """)

    # Create organization_invitation table
    op.execute("""
        CREATE TABLE IF NOT EXISTS "organization_invitation" (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
            email VARCHAR(255) NOT NULL,
            role VARCHAR(100) NOT NULL,
            inviter_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
            token VARCHAR(500) UNIQUE NOT NULL,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Create verification table (for email verification)
    op.execute("""
        CREATE TABLE IF NOT EXISTS "verification" (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            identifier VARCHAR(255) NOT NULL,
            value VARCHAR(500) NOT NULL,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Create two_factor table (for 2FA)
    op.execute("""
        CREATE TABLE IF NOT EXISTS "two_factor" (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
            secret VARCHAR(255) NOT NULL,
            backup_codes TEXT[],
            enabled BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (user_id)
        );
    """)

    # Create indexes for better performance
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_session_token ON "session"(token);
        CREATE INDEX IF NOT EXISTS idx_session_user_id ON "session"(user_id);
        CREATE INDEX IF NOT EXISTS idx_session_expires_at ON "session"(expires_at);
        CREATE INDEX IF NOT EXISTS idx_account_user_id ON "account"(user_id);
        CREATE INDEX IF NOT EXISTS idx_organization_member_org_id ON "organization_member"(organization_id);
        CREATE INDEX IF NOT EXISTS idx_organization_member_user_id ON "organization_member"(user_id);
        CREATE INDEX IF NOT EXISTS idx_organization_invitation_org_id ON "organization_invitation"(organization_id);
        CREATE INDEX IF NOT EXISTS idx_organization_invitation_token ON "organization_invitation"(token);
        CREATE INDEX IF NOT EXISTS idx_verification_identifier ON "verification"(identifier);
        CREATE INDEX IF NOT EXISTS idx_two_factor_user_id ON "two_factor"(user_id);
    """)
