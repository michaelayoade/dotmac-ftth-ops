"""add_agent_availability_table

Revision ID: agent_availability_001
Revises: 5b5a2281d1e4
Create Date: 2025-11-08 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9d0e1f2g3h4'
down_revision: Union[str, None] = 'b7e8d4f3g2h7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create agent_availability table
    op.create_table(
        'agent_availability',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=100), nullable=True),
        sa.Column(
            'status',
            sa.Enum('available', 'busy', 'offline', 'away', name='agentstatus'),
            nullable=False,
        ),
        sa.Column('status_message', sa.Text(), nullable=True),
        sa.Column('last_activity_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )

    # Create indexes
    op.create_index(op.f('ix_agent_availability_user_id'), 'agent_availability', ['user_id'])
    op.create_index(op.f('ix_agent_availability_tenant_id'), 'agent_availability', ['tenant_id'])
    op.create_index(op.f('ix_agent_availability_status'), 'agent_availability', ['status'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index(op.f('ix_agent_availability_status'), table_name='agent_availability')
    op.drop_index(op.f('ix_agent_availability_tenant_id'), table_name='agent_availability')
    op.drop_index(op.f('ix_agent_availability_user_id'), table_name='agent_availability')

    # Drop table
    op.drop_table('agent_availability')

    # Drop enum type
    op.execute('DROP TYPE agentstatus')
