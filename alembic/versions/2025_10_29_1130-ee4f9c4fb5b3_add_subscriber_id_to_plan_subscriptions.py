"""add_subscriber_id_to_plan_subscriptions

Revision ID: ee4f9c4fb5b3
Revises: c64d9a16fa9d
Create Date: 2025-10-29 11:30:00.000000

"""


from alembic import op

# revision identifiers, used by Alembic.
revision = "ee4f9c4fb5b3"
down_revision = "c64d9a16fa9d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add subscriber_id column to plan_subscriptions table for deterministic subscriber-subscription mapping."""

    # Add subscriber_id column with FK to subscribers table
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'plan_subscriptions' AND column_name = 'subscriber_id'
            ) THEN
                ALTER TABLE plan_subscriptions
                ADD COLUMN subscriber_id VARCHAR(255),
                ADD CONSTRAINT fk_plan_subscriptions_subscriber_id
                    FOREIGN KEY (subscriber_id) REFERENCES subscribers(id) ON DELETE SET NULL;

                CREATE INDEX IF NOT EXISTS idx_plan_subscriptions_subscriber_id
                    ON plan_subscriptions(subscriber_id);

                COMMENT ON COLUMN plan_subscriptions.subscriber_id IS 'Link to RADIUS subscriber for usage tracking';
            END IF;
        END $$;
    """)


def downgrade() -> None:
    """Remove subscriber_id column from plan_subscriptions table."""

    # Drop subscriber_id column and its constraints
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'plan_subscriptions' AND column_name = 'subscriber_id'
            ) THEN
                DROP INDEX IF EXISTS idx_plan_subscriptions_subscriber_id;
                ALTER TABLE plan_subscriptions DROP CONSTRAINT IF EXISTS fk_plan_subscriptions_subscriber_id;
                ALTER TABLE plan_subscriptions DROP COLUMN subscriber_id;
            END IF;
        END $$;
    """)
