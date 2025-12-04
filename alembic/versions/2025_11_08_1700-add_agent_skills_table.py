"""add_agent_skills_table

Revision ID: agent_skills_001
Revises: agent_availability_001
Create Date: 2025-11-08 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd0e1f2g3h4i5'
down_revision: Union[str, None] = 'c9d0e1f2g3h4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create agent_skills table
    op.create_table(
        'agent_skills',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=100), nullable=True),
        sa.Column('skill_category', sa.String(length=100), nullable=False),
        sa.Column('skill_level', sa.Integer(), nullable=False),
        sa.Column('can_handle_escalations', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create indexes
    op.create_index(op.f('ix_agent_skills_user_id'), 'agent_skills', ['user_id'])
    op.create_index(op.f('ix_agent_skills_tenant_id'), 'agent_skills', ['tenant_id'])
    op.create_index(op.f('ix_agent_skills_skill_category'), 'agent_skills', ['skill_category'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index(op.f('ix_agent_skills_skill_category'), table_name='agent_skills')
    op.drop_index(op.f('ix_agent_skills_tenant_id'), table_name='agent_skills')
    op.drop_index(op.f('ix_agent_skills_user_id'), table_name='agent_skills')

    # Drop table
    op.drop_table('agent_skills')
