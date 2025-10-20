# Partner Portal Revenue Share Integration Plan

## Executive Summary

This document outlines the plan to mirror the tenant billing portal for the partner portal, enabling partners to view their revenue share, commission earnings, payout history, and referral performance.

**Goals:**
1. Provide partners with transparent visibility into their earnings
2. Display commission events tied to customer invoices
3. Show payout history and outstanding balances
4. Track referral conversion metrics
5. Enable self-service access to revenue reports

**Timeline:** 2-3 weeks (frontend + backend + testing)

---

## Current State Analysis

### Existing Partner Management Infrastructure

**Database Models** (`src/dotmac/platform/partner_management/models.py`):
- ✅ `Partner` - Core partner model with commission tracking
- ✅ `PartnerCommissionEvent` - Individual commission earnings
- ✅ `PartnerAccount` - Partner-customer account relationships
- ✅ `ReferralLead` - Referral tracking with conversion status
- ✅ Commission status flow: PENDING → APPROVED → PAID
- ✅ Payout tracking with `payout_id` and `paid_at` fields

**Existing Metrics** (available on `Partner` model):
```python
total_customers: int                   # Total managed customers
total_revenue_generated: Decimal       # Revenue from partner's customers
total_commissions_earned: Decimal      # Total commissions accrued
total_commissions_paid: Decimal        # Total already paid out
total_referrals: int                   # Total referrals submitted
converted_referrals: int               # Successfully converted referrals

# Computed properties:
outstanding_commission_balance         # Earned - Paid
referral_conversion_rate              # (Converted / Total) * 100
```

**What's Missing:**
- No dedicated partner billing/revenue API endpoints
- No partner-specific invoice/payment aggregation queries
- No payout schedule/batch models
- Frontend partner portal pages don't exist yet

---

## Technical Design

### 1. Backend API Endpoints

**New Router:** `src/dotmac/platform/partner_management/revenue_router.py`

```python
@router.get("/api/v1/partners/revenue/dashboard")
async def get_partner_revenue_dashboard(
    partner_id: UUID,
    current_user: UserInfo = Depends(require_partner_access),
    db: AsyncSession = Depends(get_async_session),
) -> PartnerRevenueDashboard:
    """
    Get partner revenue dashboard with key metrics.

    Returns:
    - Total earnings (lifetime and period-specific)
    - Outstanding balance
    - Recent commission events
    - Payout history
    - Referral conversion metrics
    """

@router.get("/api/v1/partners/revenue/commissions")
async def list_commission_events(
    partner_id: UUID,
    status: CommissionStatus | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user: UserInfo = Depends(require_partner_access),
    db: AsyncSession = Depends(get_async_session),
) -> ListCommissionEventsResponse:
    """
    List commission events for partner with filtering.

    Supports:
    - Filter by status (PENDING, APPROVED, PAID)
    - Date range filtering
    - Pagination
    """

@router.get("/api/v1/partners/revenue/payouts")
async def list_payouts(
    partner_id: UUID,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user: UserInfo = Depends(require_partner_access),
    db: AsyncSession = Depends(get_async_session),
) -> ListPayoutsResponse:
    """
    List payout batches for partner.

    Each payout aggregates multiple commission events.
    """

@router.get("/api/v1/partners/revenue/referrals")
async def list_referrals(
    partner_id: UUID,
    status: ReferralStatus | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user: UserInfo = Depends(require_partner_access),
    db: AsyncSession = Depends(get_async_session),
) -> ListReferralsResponse:
    """
    List referral leads with conversion tracking.
    """

@router.get("/api/v1/partners/revenue/customer-accounts")
async def list_managed_accounts(
    partner_id: UUID,
    is_active: bool = True,
    limit: int = 50,
    offset: int = 0,
    current_user: UserInfo = Depends(require_partner_access),
    db: AsyncSession = Depends(get_async_session),
) -> ListManagedAccountsResponse:
    """
    List customer accounts managed by partner.

    Shows revenue contribution per account.
    """
```

**Response Schemas:** `src/dotmac/platform/partner_management/revenue_schemas.py`

```python
class CommissionEventResponse(BaseModel):
    """Individual commission event."""
    id: UUID
    partner_id: UUID
    invoice_id: UUID | None
    customer_id: UUID | None
    commission_amount: Decimal
    currency: str = "USD"
    base_amount: Decimal | None
    commission_rate: Decimal | None
    status: CommissionStatus
    event_type: str
    event_date: datetime
    payout_id: UUID | None
    paid_at: datetime | None
    notes: str | None

class PayoutSummary(BaseModel):
    """Payout batch summary."""
    payout_id: UUID
    partner_id: UUID
    total_amount: Decimal
    currency: str
    commission_count: int
    payout_date: datetime
    status: PayoutStatus
    payment_reference: str | None

class PartnerRevenueDashboard(BaseModel):
    """Partner revenue dashboard metrics."""
    partner_id: UUID
    company_name: str
    tier: PartnerTier

    # Lifetime metrics
    total_revenue_generated: Decimal
    total_commissions_earned: Decimal
    total_commissions_paid: Decimal
    outstanding_balance: Decimal

    # Current period (MTD)
    current_month_revenue: Decimal
    current_month_commissions: Decimal
    current_month_payouts: Decimal

    # Referral metrics
    total_referrals: int
    converted_referrals: int
    conversion_rate: float
    active_referrals: int

    # Customer metrics
    total_customers: int
    active_customers: int

    # Recent activity
    recent_commissions: list[CommissionEventResponse]
    recent_payouts: list[PayoutSummary]
    pending_commission_events: int
    next_payout_date: datetime | None
```

### 2. Service Layer

**New Service:** `src/dotmac/platform/partner_management/revenue_service.py`

```python
class PartnerRevenueService:
    """Service for partner revenue and commission calculations."""

    async def get_dashboard_metrics(
        self,
        partner_id: UUID,
        tenant_id: str
    ) -> PartnerRevenueDashboard:
        """Calculate comprehensive dashboard metrics."""

        # Get base partner data
        partner = await self._get_partner(partner_id, tenant_id)

        # Calculate current month metrics
        current_month_start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0)
        mtd_commissions = await self._sum_commissions(
            partner_id, tenant_id, start_date=current_month_start
        )

        # Get recent activity
        recent_commissions = await self._get_recent_commissions(partner_id, tenant_id, limit=10)
        recent_payouts = await self._get_recent_payouts(partner_id, tenant_id, limit=10)

        # Count pending
        pending_count = await self._count_pending_commissions(partner_id, tenant_id)

        return PartnerRevenueDashboard(...)

    async def list_commission_events(
        self,
        partner_id: UUID,
        tenant_id: str,
        filters: CommissionFilters,
    ) -> list[PartnerCommissionEvent]:
        """List commission events with tenant isolation."""

        query = select(PartnerCommissionEvent).where(
            PartnerCommissionEvent.partner_id == partner_id,
            PartnerCommissionEvent.tenant_id == tenant_id,  # CRITICAL
        )

        if filters.status:
            query = query.where(PartnerCommissionEvent.status == filters.status)

        if filters.start_date:
            query = query.where(PartnerCommissionEvent.event_date >= filters.start_date)

        # ... more filtering and sorting

        return await self._db.execute(query)

    async def calculate_commission(
        self,
        invoice: InvoiceEntity,
        partner_account: PartnerAccount,
    ) -> PartnerCommissionEvent:
        """
        Calculate commission when invoice is paid.

        This is called by the billing module when invoices are finalized.
        """

        # Determine commission rate (account-specific or partner default)
        rate = partner_account.custom_commission_rate or partner_account.partner.default_commission_rate

        # Calculate commission
        base_amount = invoice.total_amount
        commission_amount = base_amount * rate

        # Create commission event
        event = PartnerCommissionEvent(
            partner_id=partner_account.partner_id,
            tenant_id=invoice.tenant_id,
            invoice_id=invoice.invoice_id,
            customer_id=invoice.customer_id,
            commission_amount=commission_amount,
            base_amount=base_amount,
            commission_rate=rate,
            status=CommissionStatus.PENDING,
            event_type="invoice_paid",
            event_date=datetime.now(UTC),
        )

        self._db.add(event)
        await self._db.commit()

        # Update partner aggregate metrics
        await self._update_partner_metrics(partner_account.partner_id)

        return event
```

### 3. Integration with Billing Module

**Event Handler:** `src/dotmac/platform/partner_management/billing_integration.py`

```python
@event_handler(InvoicePaidEvent)
async def handle_invoice_paid_for_commissions(event: InvoicePaidEvent, db: AsyncSession):
    """
    When an invoice is paid, check if it belongs to a partner-managed account
    and create commission event.
    """

    # Find partner account for this customer
    result = await db.execute(
        select(PartnerAccount)
        .where(PartnerAccount.customer_id == event.customer_id)
        .where(PartnerAccount.is_active == True)
        .where(PartnerAccount.tenant_id == event.tenant_id)
    )
    partner_account = result.scalar_one_or_none()

    if not partner_account:
        # No partner for this customer
        return

    # Get invoice details
    invoice = await get_invoice(event.invoice_id, event.tenant_id, db)

    # Calculate and create commission
    revenue_service = PartnerRevenueService(db)
    await revenue_service.calculate_commission(invoice, partner_account)
```

**Add to Billing Router:**
```python
# In src/dotmac/platform/billing/invoicing/router.py

@router.post("/invoices/{invoice_id}/finalize")
async def finalize_invoice(...):
    """Existing invoice finalization endpoint."""

    # ... existing finalization logic

    # Publish event for partner commission calculation
    await event_bus.publish(InvoicePaidEvent(
        invoice_id=invoice.invoice_id,
        customer_id=invoice.customer_id,
        tenant_id=invoice.tenant_id,
        total_amount=invoice.total_amount,
        paid_at=datetime.now(UTC),
    ))

    return invoice
```

### 4. Payout Management

**New Model:** `src/dotmac/platform/partner_management/models.py` (add to existing file)

```python
class PartnerPayout(Base, TimestampMixin, TenantMixin):
    """
    Payout batches aggregating multiple commission events.
    """
    __tablename__ = "partner_payouts"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    partner_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("partners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Payout details
    total_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    commission_count: Mapped[int] = mapped_column(nullable=False, default=0)

    # Payment reference (Stripe transfer ID, wire reference, etc.)
    payment_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payment_method: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="e.g., stripe_transfer, wire, check"
    )

    # Status
    status: Mapped[PayoutStatus] = mapped_column(
        SQLEnum(PayoutStatus),
        default=PayoutStatus.PENDING,
        nullable=False,
        index=True,
    )

    # Dates
    payout_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Period covered
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Metadata
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_payout_partner_status", "partner_id", "status"),
        Index("ix_payout_dates", "payout_date", "period_start", "period_end"),
    )
```

**Payout Service:** `src/dotmac/platform/partner_management/payout_service.py`

```python
class PayoutService:
    """Service for creating and managing partner payouts."""

    async def create_payout_batch(
        self,
        partner_id: UUID,
        tenant_id: str,
        period_start: datetime,
        period_end: datetime,
    ) -> PartnerPayout:
        """
        Create a payout batch for approved commissions in the period.
        """

        # Get all approved but unpaid commissions
        query = select(PartnerCommissionEvent).where(
            PartnerCommissionEvent.partner_id == partner_id,
            PartnerCommissionEvent.tenant_id == tenant_id,
            PartnerCommissionEvent.status == CommissionStatus.APPROVED,
            PartnerCommissionEvent.event_date >= period_start,
            PartnerCommissionEvent.event_date <= period_end,
            PartnerCommissionEvent.payout_id.is_(None),
        )

        result = await self._db.execute(query)
        events = result.scalars().all()

        if not events:
            raise ValueError("No approved commissions found for payout")

        # Calculate total
        total = sum(event.commission_amount for event in events)

        # Create payout record
        payout = PartnerPayout(
            partner_id=partner_id,
            tenant_id=tenant_id,
            total_amount=total,
            commission_count=len(events),
            payout_date=datetime.now(UTC),
            period_start=period_start,
            period_end=period_end,
            status=PayoutStatus.READY,
        )

        self._db.add(payout)
        await self._db.flush()

        # Link commission events to payout
        for event in events:
            event.payout_id = payout.id
            event.status = CommissionStatus.PAID
            event.paid_at = datetime.now(UTC)

        await self._db.commit()

        return payout
```

---

## Frontend Implementation

### 1. Partner Revenue Page

**File:** `frontend/apps/base-app/app/partners/revenue/page.tsx`

**Structure:** Mirror tenant billing page with partner-specific metrics

```typescript
'use client';

import { useEffect, useState } from 'react';
import { usePartner } from '@/lib/contexts/partner-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Users, Award } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { PartnerRevenueDashboard, CommissionEvent, Payout } from '@/types/partner';
import CommissionEventsTable from '@/components/partner/CommissionEventsTable';
import PayoutsTable from '@/components/partner/PayoutsTable';
import ReferralMetrics from '@/components/partner/ReferralMetrics';
import { formatCurrency } from '@/lib/utils/currency';

export default function PartnerRevenuePage() {
  const { currentPartner } = usePartner();
  const [dashboard, setDashboard] = useState<PartnerRevenueDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentPartner?.id) return;

    const loadDashboard = async () => {
      const response = await apiClient.get<PartnerRevenueDashboard>(
        `/api/v1/partners/revenue/dashboard?partner_id=${currentPartner.id}`
      );

      if (response.success) {
        setDashboard(response.data);
      }
      setLoading(false);
    };

    loadDashboard();
  }, [currentPartner?.id]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Revenue & Commissions</h1>
        <p className="text-sm text-muted-foreground">
          Track your earnings, payouts, and referral performance
        </p>
      </header>

      {/* Summary Cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <RevenueCard
          title="Outstanding balance"
          icon={DollarSign}
          value={formatCurrency(dashboard?.outstanding_balance ?? 0)}
          body="Awaiting next payout"
        />
        <RevenueCard
          title="This month"
          icon={TrendingUp}
          value={formatCurrency(dashboard?.current_month_commissions ?? 0)}
          body={`From ${dashboard?.active_customers ?? 0} active accounts`}
        />
        <RevenueCard
          title="Lifetime earnings"
          icon={Award}
          value={formatCurrency(dashboard?.total_commissions_earned ?? 0)}
          body={`${dashboard?.conversion_rate?.toFixed(1) ?? 0}% referral conversion`}
        />
        <RevenueCard
          title="Managed accounts"
          icon={Users}
          value={`${dashboard?.active_customers ?? 0}`}
          body={`Generating ${formatCurrency(dashboard?.current_month_revenue ?? 0)}/mo`}
        />
      </section>

      {/* Commission Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent commissions</CardTitle>
          <CardDescription>Commission events from your managed accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <CommissionEventsTable partnerId={currentPartner?.id} />
        </CardContent>
      </Card>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle>Payout history</CardTitle>
          <CardDescription>Previous payouts and payment references</CardDescription>
        </CardHeader>
        <CardContent>
          <PayoutsTable partnerId={currentPartner?.id} />
        </CardContent>
      </Card>

      {/* Referral Metrics */}
      <ReferralMetrics partnerId={currentPartner?.id} />
    </div>
  );
}
```

### 2. Commission Events Table Component

**File:** `frontend/apps/base-app/components/partner/CommissionEventsTable.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api/client';
import { formatCurrency } from '@/lib/utils/currency';
import type { CommissionEvent, CommissionStatus } from '@/types/partner';

const statusVariant: Record<CommissionStatus, 'default' | 'secondary' | 'success'> = {
  pending: 'secondary',
  approved: 'default',
  paid: 'success',
  clawback: 'destructive',
  cancelled: 'outline',
};

export default function CommissionEventsTable({ partnerId }: { partnerId: string }) {
  const [events, setEvents] = useState<CommissionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEvents = async () => {
      const response = await apiClient.get<{ events: CommissionEvent[] }>(
        `/api/v1/partners/revenue/commissions?partner_id=${partnerId}&limit=50`
      );

      if (response.success && response.data?.events) {
        setEvents(response.data.events);
      }
      setLoading(false);
    };

    loadEvents();
  }, [partnerId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No commission events yet.</p>;
  }

  return (
    <div className="overflow-x-auto" data-testid="commission-events-table">
      <table className="w-full text-sm">
        <thead className="border-b text-xs uppercase text-muted-foreground">
          <tr className="text-left">
            <th className="px-3 py-2">Event Date</th>
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Base Amount</th>
            <th className="px-3 py-2">Rate</th>
            <th className="px-3 py-2">Commission</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Payout</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {events.map((event) => (
            <tr key={event.id} className="hover:bg-muted/40" data-testid="commission-row">
              <td className="px-3 py-2 text-foreground">
                {format(new Date(event.event_date), 'MMM d, yyyy')}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{event.customer_id}</td>
              <td className="px-3 py-2 text-foreground">
                {formatCurrency(event.base_amount ?? 0, event.currency, 100)}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {event.commission_rate ? `${(event.commission_rate * 100).toFixed(2)}%` : '—'}
              </td>
              <td className="px-3 py-2 font-medium text-foreground">
                {formatCurrency(event.commission_amount, event.currency, 100)}
              </td>
              <td className="px-3 py-2">
                <Badge variant={statusVariant[event.status]}>{event.status}</Badge>
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {event.paid_at ? format(new Date(event.paid_at), 'MMM d, yyyy') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 3. Types

**File:** `frontend/apps/base-app/types/partner.ts`

```typescript
export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'clawback' | 'cancelled';
export type PayoutStatus = 'pending' | 'ready' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type PartnerTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'direct';

export interface CommissionEvent {
  id: string;
  partner_id: string;
  invoice_id: string | null;
  customer_id: string | null;
  commission_amount: number;
  currency: string;
  base_amount: number | null;
  commission_rate: number | null;
  status: CommissionStatus;
  event_type: string;
  event_date: string;
  payout_id: string | null;
  paid_at: string | null;
  notes: string | null;
}

export interface Payout {
  payout_id: string;
  partner_id: string;
  total_amount: number;
  currency: string;
  commission_count: number;
  payout_date: string;
  status: PayoutStatus;
  payment_reference: string | null;
}

export interface PartnerRevenueDashboard {
  partner_id: string;
  company_name: string;
  tier: PartnerTier;
  total_revenue_generated: number;
  total_commissions_earned: number;
  total_commissions_paid: number;
  outstanding_balance: number;
  current_month_revenue: number;
  current_month_commissions: number;
  current_month_payouts: number;
  total_referrals: number;
  converted_referrals: number;
  conversion_rate: number;
  active_referrals: number;
  total_customers: number;
  active_customers: number;
  pending_commission_events: number;
  next_payout_date: string | null;
}
```

---

## Database Migrations

**Migration:** `alembic/versions/xxx_add_partner_payouts.py`

```python
"""Add partner payouts table

Revision ID: xxx
Revises: yyy
Create Date: 2025-01-15
"""

def upgrade():
    op.create_table(
        'partner_payouts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('partner_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('total_amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('currency', sa.String(3), nullable=False, default='USD'),
        sa.Column('commission_count', sa.Integer, nullable=False),
        sa.Column('payment_reference', sa.String(255), nullable=True),
        sa.Column('payment_method', sa.String(50), nullable=False),
        sa.Column('status', sa.Enum('pending', 'ready', 'processing', 'completed', 'failed', 'cancelled', name='payoutstatus'), nullable=False),
        sa.Column('payout_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('period_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('period_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('failure_reason', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['partner_id'], ['partners.id'], ondelete='CASCADE'),
    )

    op.create_index('ix_payout_partner_status', 'partner_payouts', ['partner_id', 'status'])
    op.create_index('ix_payout_dates', 'partner_payouts', ['payout_date', 'period_start', 'period_end'])

def downgrade():
    op.drop_table('partner_payouts')
```

---

## Testing Strategy

### 1. Backend Unit Tests

**File:** `tests/partner_management/test_revenue_service.py`

```python
async def test_get_revenue_dashboard(async_session, test_partner, test_commission_events):
    """Test revenue dashboard calculation."""
    service = PartnerRevenueService(async_session)

    dashboard = await service.get_dashboard_metrics(
        partner_id=test_partner.id,
        tenant_id=test_partner.tenant_id,
    )

    assert dashboard.total_commissions_earned > 0
    assert dashboard.outstanding_balance == (
        dashboard.total_commissions_earned - dashboard.total_commissions_paid
    )

async def test_calculate_commission_on_invoice_paid(async_session, test_partner_account, test_invoice):
    """Test commission calculation when invoice is paid."""
    service = PartnerRevenueService(async_session)

    event = await service.calculate_commission(test_invoice, test_partner_account)

    assert event.commission_amount == test_invoice.total_amount * test_partner_account.custom_commission_rate
    assert event.status == CommissionStatus.PENDING
    assert event.partner_id == test_partner_account.partner_id

async def test_tenant_isolation_in_commission_listing(async_session, test_partner_tenant1, test_partner_tenant2):
    """Test that partners cannot see commissions from other tenants."""
    service = PartnerRevenueService(async_session)

    events = await service.list_commission_events(
        partner_id=test_partner_tenant1.id,
        tenant_id="tenant-1",
        filters=CommissionFilters(),
    )

    # Should only return commissions for tenant-1
    assert all(event.tenant_id == "tenant-1" for event in events)
```

### 2. E2E Test Fixtures

**File:** `tests/partner_management/e2e_revenue_fixtures.py`

```python
@pytest.fixture
async def partner_revenue_data(async_session: AsyncSession):
    """
    Create comprehensive partner revenue data for E2E testing.

    Creates:
    - 1 active partner (Gold tier)
    - 3 managed customer accounts
    - 20 commission events (mixed statuses)
    - 3 completed payouts
    - 5 referral leads (2 converted)
    """
    # Similar pattern to tenant billing fixtures
    # ... implementation
```

### 3. Frontend E2E Tests

**File:** `frontend/apps/base-app/e2e/partner-revenue-portal.spec.ts`

```typescript
test.describe('Partner revenue portal', () => {
  test('shows revenue dashboard with key metrics', async ({ page }) => {
    await loginAsPartner(page);
    await page.goto('/partners/revenue');

    // Verify summary cards
    await expect(page.getByText('Outstanding balance')).toBeVisible();
    await expect(page.getByText('This month')).toBeVisible();
    await expect(page.getByText('Lifetime earnings')).toBeVisible();

    // Verify amounts are formatted correctly
    const balance = await page.locator('text=/\\$[\\d,]+\\.\\d{2}/').first().textContent();
    expect(balance).toMatch(/^\$[\d,]+\.\d{2}$/);
  });

  test('displays commission events table', async ({ page }) => {
    await loginAsPartner(page);
    await page.goto('/partners/revenue');

    const table = page.locator('[data-testid="commission-events-table"]');
    await expect(table).toBeVisible();

    const rows = table.locator('[data-testid="commission-row"]');
    expect(await rows.count()).toBeGreaterThan(0);
  });
});
```

---

## Implementation Phases

### Phase 1: Backend Foundation (Week 1)
- [ ] Add `PartnerPayout` model and migration
- [ ] Implement `PartnerRevenueService` with core methods
- [ ] Create revenue API router with dashboard endpoint
- [ ] Add commission listing endpoint
- [ ] Implement billing integration (invoice paid → commission event)
- [ ] Write unit tests for revenue calculations
- [ ] Test tenant isolation thoroughly

### Phase 2: Payout Management (Week 1-2)
- [ ] Implement `PayoutService` for batch creation
- [ ] Add payout listing endpoint
- [ ] Create admin endpoints for approving commissions
- [ ] Add payout status webhooks (if using Stripe Connect)
- [ ] Write tests for payout batch creation

### Phase 3: Frontend Implementation (Week 2)
- [ ] Create partner revenue page
- [ ] Build `CommissionEventsTable` component
- [ ] Build `PayoutsTable` component
- [ ] Add referral metrics component
- [ ] Create partner context provider
- [ ] Add currency formatting (reuse tenant billing utilities)

### Phase 4: Testing & Polish (Week 2-3)
- [ ] Create E2E test fixtures
- [ ] Write Playwright tests for partner portal
- [ ] Run E2E tests with live backend
- [ ] Add error handling and loading states
- [ ] Document API endpoints
- [ ] Update partner portal navigation

---

## Security Considerations

1. **Partner Access Control:**
   ```python
   async def require_partner_access(
       partner_id: UUID,
       current_user: UserInfo = Depends(get_current_user),
       db: AsyncSession = Depends(get_async_session),
   ):
       """Verify user has access to this partner's data."""

       # Check if user is linked to this partner
       result = await db.execute(
           select(PartnerUser).where(
               PartnerUser.user_id == current_user.user_id,
               PartnerUser.partner_id == partner_id,
               PartnerUser.is_active == True,
           )
       )

       if not result.scalar_one_or_none():
           raise HTTPException(status_code=403, detail="Not authorized for this partner")
   ```

2. **Tenant Isolation:**
   - ALL queries MUST filter by `tenant_id`
   - Partners cannot see data from other tenants
   - Commission events tied to specific tenant

3. **Data Privacy:**
   - Don't expose full customer details in commission listings
   - Redact sensitive customer information
   - Only show aggregated revenue metrics

---

## Success Metrics

**After implementation, measure:**
- Partner satisfaction with transparency (NPS survey)
- Reduction in support tickets about commission inquiries
- Time saved in manual payout reconciliation
- Partner portal engagement (DAU/MAU)
- Commission dispute rate (should decrease)

---

## Future Enhancements

**V2 Features (not in initial scope):**
- [ ] Export commission statements to PDF
- [ ] Email notifications for new payouts
- [ ] Referral tracking dashboard with conversion funnel
- [ ] Custom commission rules builder (UI for tiered/hybrid models)
- [ ] Partner-facing customer list with revenue attribution
- [ ] Multi-currency payout support
- [ ] Stripe Connect integration for automated payouts
- [ ] Commission forecasting based on pipeline

---

## Related Documentation

- [Partner Management Module](./partner-management.md)
- [Billing Module Guide](./billing-module.md)
- [E2E Testing Guide](./e2e-testing-guide.md)
- [Multi-Tenant Architecture](./multi-tenant-architecture.md)
