# Phase 1: Partner Portal Expansion - Data Model Design

**Version:** 1.0
**Date:** 2025-11-07
**Status:** Draft - Design Review

## Executive Summary

This document proposes the data model extensions required to enable multi-account management in the partner portal, allowing MSPs and enterprise headquarters to manage multiple customer tenants from a single interface.

## Current Architecture Analysis

### Existing Models

**Partners** (`partner_management/models.py`):
- Tenant-scoped partner organizations (MSPs, agencies, resellers)
- Commission tracking and payout management
- Referral lead tracking

**PartnerAccount** (Existing Join Table):
- Links `Partner` → `Customer` (individual subscribers)
- Use case: Partners managing individual customer accounts
- **Limitation**: Does not support tenant-level management

**Tenants** (`tenant/models.py`):
- Represents ISP operators/organizations
- Multi-tenant SaaS foundation
- Subscription plans and billing

**Customers** (`customer_management/models.py`):
- Individual subscribers within a tenant/ISP
- Service address, installation tracking
- Network device assignments

### Gap Analysis

The roadmap requires **partner → tenant** linking for:
1. MSPs managing multiple ISP tenant accounts
2. Enterprise HQs overseeing subsidiary ISPs
3. Read-only delegates/auditors accessing multiple tenants

Current `PartnerAccount` only supports **partner → customer** linking at the subscriber level.

## Proposed Schema: PartnerTenantLink

### Model Definition

```python
class PartnerTenantAccessRole(str, Enum):
    """Access roles for partner-tenant relationships."""

    MSP_FULL = "msp_full"              # Full MSP access (billing, support, provisioning)
    MSP_BILLING = "msp_billing"        # Billing and revenue only
    MSP_SUPPORT = "msp_support"        # Support/ticketing only
    ENTERPRISE_HQ = "enterprise_hq"    # Enterprise HQ full access
    AUDITOR = "auditor"                # Read-only audit access
    RESELLER = "reseller"              # Reseller with limited provisioning
    DELEGATE = "delegate"              # Custom delegate role


class PartnerTenantLink(Base, TimestampMixin, AuditMixin):
    """
    Join table linking partners to managed tenant accounts.

    Enables MSPs and enterprise HQs to manage multiple ISP tenants
    with scoped permissions.
    """

    __tablename__ = "partner_tenant_links"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # The partner organization (MSP/enterprise HQ)
    partner_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("partners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # The managed tenant (ISP operator)
    managed_tenant_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Tenant being managed by the partner"
    )

    # Access role and permissions
    access_role: Mapped[PartnerTenantAccessRole] = mapped_column(
        SQLEnum(PartnerTenantAccessRole),
        nullable=False,
        index=True,
        comment="Defines scope of partner access to tenant"
    )

    # Custom permissions override (JSON)
    custom_permissions: Mapped[dict[str, bool]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="""Custom permission overrides: {
            'billing.read': True,
            'billing.write': False,
            'support.create_ticket': True,
            'provisioning.activate_service': False,
            'reports.sla': True
        }"""
    )

    # Relationship metadata
    relationship_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Type: msp_managed, enterprise_subsidiary, reseller_channel, audit_only"
    )

    # Engagement dates
    start_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    end_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="NULL = ongoing relationship"
    )

    # Status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )

    # Notifications configuration
    notify_on_sla_breach: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    notify_on_billing_threshold: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    billing_alert_threshold: Mapped[Decimal | None] = mapped_column(
        Numeric(15, 2),
        nullable=True,
        comment="Alert when AR exceeds this amount"
    )

    # Service Level Agreement
    sla_response_hours: Mapped[int | None] = mapped_column(
        nullable=True,
        comment="Partner's committed response time for this tenant"
    )
    sla_uptime_target: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2),
        nullable=True,
        comment="Partner's uptime commitment (e.g., 99.95)"
    )

    # Metadata
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSON,
        default=dict,
        nullable=False,
    )

    # Foreign key to owning tenant (the partner's tenant)
    # Partners themselves are tenant-scoped
    partner_tenant_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="The partner's own tenant (not the managed tenant)"
    )

    # Relationships
    partner: Mapped["Partner"] = relationship(
        "Partner",
        foreign_keys=[partner_id],
        backref="managed_tenants"
    )

    managed_tenant: Mapped["Tenant"] = relationship(
        "Tenant",
        foreign_keys=[managed_tenant_id],
        backref="managing_partners"
    )

    # Table constraints
    __table_args__ = (
        UniqueConstraint(
            "partner_id",
            "managed_tenant_id",
            name="uq_partner_managed_tenant"
        ),
        Index("ix_partner_tenant_active", "partner_id", "is_active"),
        Index("ix_managed_tenant_active", "managed_tenant_id", "is_active"),
        Index("ix_partner_tenant_role", "partner_id", "access_role"),
        Index("ix_partner_tenant_dates", "start_date", "end_date"),
    )
```

## Permission Scoping Matrix

| Access Role | Billing Read | Billing Write | Support Read | Support Write | Provisioning | SLA Reports |
|-------------|--------------|---------------|--------------|---------------|--------------|-------------|
| MSP_FULL | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MSP_BILLING | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| MSP_SUPPORT | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| ENTERPRISE_HQ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AUDITOR | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| RESELLER | ✅ | ❌ | ✅ | ❌ | ✅ (limited) | ✅ |
| DELEGATE | Custom | Custom | Custom | Custom | Custom | Custom |

## Migration Path

### Step 1: Create New Table

```python
# Migration: 2025_11_07_1200-create_partner_tenant_links.py

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import JSON

def upgrade():
    op.create_table(
        'partner_tenant_links',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('partner_id', UUID(as_uuid=True), nullable=False),
        sa.Column('managed_tenant_id', sa.String(255), nullable=False),
        sa.Column('partner_tenant_id', sa.String(255), nullable=False),
        sa.Column('access_role', sa.String(50), nullable=False),
        sa.Column('custom_permissions', JSON, nullable=False, server_default='{}'),
        sa.Column('relationship_type', sa.String(50), nullable=False),
        sa.Column('start_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('notify_on_sla_breach', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('notify_on_billing_threshold', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('billing_alert_threshold', sa.Numeric(15, 2), nullable=True),
        sa.Column('sla_response_hours', sa.Integer, nullable=True),
        sa.Column('sla_uptime_target', sa.Numeric(5, 2), nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('metadata', JSON, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.Column('updated_by', sa.String(255), nullable=True),
        sa.ForeignKeyConstraint(['partner_id'], ['partners.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['managed_tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['partner_tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('partner_id', 'managed_tenant_id', name='uq_partner_managed_tenant'),
    )

    # Indexes
    op.create_index('ix_partner_tenant_active', 'partner_tenant_links', ['partner_id', 'is_active'])
    op.create_index('ix_managed_tenant_active', 'partner_tenant_links', ['managed_tenant_id', 'is_active'])
    op.create_index('ix_partner_tenant_role', 'partner_tenant_links', ['partner_id', 'access_role'])
    op.create_index('ix_partner_tenant_dates', 'partner_tenant_links', ['start_date', 'end_date'])

def downgrade():
    op.drop_table('partner_tenant_links')
```

### Step 2: Backfill Data (if applicable)

If existing partners should have tenant-level access, create a data migration script.

## Coexistence with PartnerAccount

**Keep Both Models:**

- `PartnerAccount` → Partner-to-Customer links (subscriber management)
- `PartnerTenantLink` → Partner-to-Tenant links (multi-tenant management)

**Use Cases:**
- MSP managing ISP tenant → Use `PartnerTenantLink`
- MSP managing individual subscribers within their own tenant → Use `PartnerAccount`
- Enterprise HQ overseeing subsidiaries → Use `PartnerTenantLink`

## Data Validation Rules

1. **Circular Reference Prevention**: `partner_tenant_id` cannot equal `managed_tenant_id`
2. **Active Link Limit**: One `MSP_FULL` or `ENTERPRISE_HQ` role per managed tenant
3. **Date Validation**: `end_date` must be >= `start_date`
4. **Permission Validation**: Custom permissions must be subset of role's base permissions

## Security Considerations

1. **Audit Trail**: All changes to links tracked via `AuditMixin` (created_by, updated_by)
2. **Soft Delete**: Consider adding `SoftDeleteMixin` for historical tracking
3. **Encryption**: Sensitive metadata should be encrypted at rest
4. **Rate Limiting**: API endpoints accessing multiple tenants should have rate limits

## Next Steps

- [ ] Review and approve schema design
- [ ] Create Alembic migration
- [ ] Update Partner model with relationship
- [ ] Update Tenant model with relationship
- [ ] Create service layer for link management
- [ ] Design RBAC enforcement middleware (Phase 1.3)
- [ ] Draft API contracts (Phase 1.4)

## Open Questions

1. Should we support cascading permissions (sub-partners)?
2. How to handle partner user-level permissions vs partner org-level?
3. Should links support approval workflows before activation?
4. What's the retention policy for inactive links?

---
**Document Owner**: Platform Engineering Team
**Reviewers**: Product, Security, Operations
