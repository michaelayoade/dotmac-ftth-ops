#!/usr/bin/env python3
"""Create agent availability and skills tables manually."""

import asyncio
from sqlalchemy import text

from dotmac.platform.database import get_engine


async def create_tables():
    """Create agent_availability and agent_skills tables."""
    engine = get_engine()

    sql_statements = [
        # Create agent_availability table
        """
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
        """,
        # Create indexes for agent_availability
        "CREATE INDEX IF NOT EXISTS ix_agent_availability_user_id ON agent_availability(user_id);",
        "CREATE INDEX IF NOT EXISTS ix_agent_availability_tenant_id ON agent_availability(tenant_id);",
        "CREATE INDEX IF NOT EXISTS ix_agent_availability_status ON agent_availability(status);",

        # Create agent_skills table
        """
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
        """,
        # Create indexes for agent_skills
        "CREATE INDEX IF NOT EXISTS ix_agent_skills_user_id ON agent_skills(user_id);",
        "CREATE INDEX IF NOT EXISTS ix_agent_skills_tenant_id ON agent_skills(tenant_id);",
        "CREATE INDEX IF NOT EXISTS ix_agent_skills_skill_category ON agent_skills(skill_category);",
    ]

    async with engine.begin() as conn:
        for sql in sql_statements:
            print(f"Executing: {sql[:80]}...")
            await conn.execute(text(sql))

        # Verify tables created
        result = await conn.execute(text("""
            SELECT tablename, schemaname
            FROM pg_tables
            WHERE tablename IN ('agent_availability', 'agent_skills')
            ORDER BY tablename;
        """))

        tables = result.fetchall()
        print("\n✅ Tables created successfully:")
        for table in tables:
            print(f"  - {table.schemaname}.{table.tablename}")

        if not tables:
            print("⚠️  Warning: No tables found after creation")

    await engine.dispose()
    print("\n✅ Database connection closed")


if __name__ == "__main__":
    print("Creating agent_availability and agent_skills tables...\n")
    asyncio.run(create_tables())
    print("\n🎉 Done!")
