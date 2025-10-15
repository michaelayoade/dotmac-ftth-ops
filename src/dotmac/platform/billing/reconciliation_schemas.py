"""
Pydantic schemas for payment reconciliation and recovery.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ReconciliationStart(BaseModel):
    """Schema for starting a reconciliation session."""

    model_config = ConfigDict(str_strip_whitespace=True)

    bank_account_id: int = Field(description="Bank account ID to reconcile")
    period_start: datetime = Field(description="Start of reconciliation period")
    period_end: datetime = Field(description="End of reconciliation period")
    opening_balance: Decimal = Field(description="Opening balance from previous reconciliation")
    statement_balance: Decimal = Field(description="Balance from bank statement")
    statement_file_url: str | None = Field(None, description="Optional URL to bank statement file")
    notes: str | None = Field(None, description="Optional notes")

    @field_validator("period_start", "period_end")
    @classmethod
    def validate_dates(cls, v: datetime) -> datetime:
        """Validate date is not in future."""
        if v > datetime.now(v.tzinfo):
            raise ValueError("Date cannot be in the future")
        return v


class ReconcilePaymentRequest(BaseModel):
    """Schema for adding a payment to reconciliation."""

    model_config = ConfigDict(str_strip_whitespace=True)

    payment_id: int = Field(description="Payment ID to reconcile")
    notes: str | None = Field(None, description="Optional reconciliation notes")


class ReconciliationComplete(BaseModel):
    """Schema for completing a reconciliation session."""

    model_config = ConfigDict(str_strip_whitespace=True)

    notes: str | None = Field(None, description="Optional completion notes")


class ReconciliationApprove(BaseModel):
    """Schema for approving a reconciliation session."""

    model_config = ConfigDict(str_strip_whitespace=True)

    notes: str | None = Field(None, description="Optional approval notes")


class ReconciledItem(BaseModel):
    """Schema for a reconciled payment item."""

    payment_id: int = Field(description="Payment ID")
    payment_reference: str = Field(description="Payment reference number")
    amount: Decimal = Field(description="Payment amount")
    reconciled_at: datetime = Field(description="When payment was reconciled")
    reconciled_by: str = Field(description="User who reconciled the payment")
    notes: str | None = Field(None, description="Reconciliation notes")

    model_config = ConfigDict(from_attributes=True)


class ReconciliationResponse(BaseModel):
    """Schema for reconciliation session response."""

    id: int = Field(description="Reconciliation ID")
    tenant_id: str = Field(description="Tenant ID")
    reconciliation_date: datetime = Field(description="Date reconciliation was started")
    period_start: datetime = Field(description="Start of reconciliation period")
    period_end: datetime = Field(description="End of reconciliation period")
    bank_account_id: int = Field(description="Bank account ID")

    # Balances
    opening_balance: Decimal = Field(description="Opening balance")
    closing_balance: Decimal = Field(description="Calculated closing balance")
    statement_balance: Decimal = Field(description="Bank statement balance")

    # Totals
    total_deposits: Decimal = Field(description="Total deposits in period")
    total_withdrawals: Decimal = Field(description="Total withdrawals in period")
    unreconciled_count: int = Field(description="Number of unreconciled payments")
    discrepancy_amount: Decimal = Field(description="Discrepancy amount")

    # Status
    status: str = Field(description="Reconciliation status")

    # Approval tracking
    completed_by: str | None = Field(None, description="User who completed reconciliation")
    completed_at: datetime | None = Field(None, description="When reconciliation was completed")
    approved_by: str | None = Field(None, description="User who approved reconciliation")
    approved_at: datetime | None = Field(None, description="When reconciliation was approved")

    # Details
    notes: str | None = Field(None, description="Reconciliation notes")
    statement_file_url: str | None = Field(None, description="Bank statement file URL")
    reconciled_items: list[dict[str, Any]] = Field(
        default_factory=list, description="List of reconciled payment items"
    )
    meta_data: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")

    created_at: datetime = Field(description="Creation timestamp")
    updated_at: datetime = Field(description="Last update timestamp")

    model_config = ConfigDict(from_attributes=True)


class ReconciliationListResponse(BaseModel):
    """Schema for paginated reconciliation list."""

    model_config = ConfigDict()

    reconciliations: list[ReconciliationResponse] = Field(description="List of reconciliations")
    total: int = Field(description="Total number of reconciliations")
    page: int = Field(description="Current page number")
    page_size: int = Field(description="Number of items per page")
    pages: int = Field(description="Total number of pages")


class ReconciliationSummary(BaseModel):
    """Schema for reconciliation summary statistics."""

    model_config = ConfigDict()

    period_days: int = Field(description="Number of days in summary period")
    total_sessions: int = Field(description="Total reconciliation sessions")
    approved_sessions: int = Field(description="Number of approved sessions")
    pending_sessions: int = Field(description="Number of pending sessions")
    total_discrepancies: Decimal = Field(description="Total discrepancy amount")
    total_reconciled_items: int = Field(description="Total number of reconciled items")
    average_discrepancy: Decimal = Field(description="Average discrepancy per session")


class PaymentRetryRequest(BaseModel):
    """Schema for retrying a failed payment."""

    model_config = ConfigDict(str_strip_whitespace=True)

    payment_id: int = Field(description="Payment ID to retry")
    max_attempts: int = Field(default=3, ge=1, le=5, description="Maximum retry attempts")
    notes: str | None = Field(None, description="Optional retry notes")


class PaymentRetryResponse(BaseModel):
    """Schema for payment retry result."""

    model_config = ConfigDict()

    success: bool = Field(description="Whether retry succeeded")
    payment_id: int = Field(description="Payment ID")
    attempts: int = Field(description="Number of attempts made")
    circuit_breaker_state: str = Field(description="Circuit breaker state")
    recovery_context: dict[str, Any] = Field(description="Recovery context details")


class IdempotentOperationRequest(BaseModel):
    """Schema for idempotent operation request."""

    model_config = ConfigDict(str_strip_whitespace=True)

    idempotency_key: str = Field(description="Unique idempotency key")
    operation: str = Field(description="Operation name")
    parameters: dict[str, Any] = Field(default_factory=dict, description="Operation parameters")


class CircuitBreakerStatus(BaseModel):
    """Schema for circuit breaker status."""

    model_config = ConfigDict()

    state: str = Field(description="Circuit breaker state (closed/open/half_open)")
    failure_count: int = Field(description="Current failure count")
    failure_threshold: int = Field(description="Failure threshold")
    last_failure_time: datetime | None = Field(None, description="Last failure timestamp")
    recovery_timeout: float = Field(description="Recovery timeout in seconds")


class RetryStatistics(BaseModel):
    """Schema for retry statistics."""

    model_config = ConfigDict()

    total_retries: int = Field(description="Total retry attempts")
    successful_retries: int = Field(description="Number of successful retries")
    failed_retries: int = Field(description="Number of failed retries")
    average_attempts: float = Field(description="Average attempts per operation")
    max_attempts_used: int = Field(description="Maximum attempts used")
