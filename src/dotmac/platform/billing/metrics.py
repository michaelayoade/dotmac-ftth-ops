"""
Billing module metrics and monitoring
"""

import contextlib
import logging
from contextlib import AbstractContextManager
from types import ModuleType
from typing import TYPE_CHECKING, Any

from dotmac.platform.billing.core.enums import PaymentStatus
from dotmac.platform.telemetry import get_meter, get_tracer

metrics: ModuleType | None
trace: ModuleType | None

try:
    from opentelemetry import metrics as _otel_metrics
    from opentelemetry import trace as _otel_trace

    metrics = _otel_metrics
    trace = _otel_trace
    OTEL_AVAILABLE = True
except ImportError:  # pragma: no cover - optional dependency
    metrics = None
    trace = None
    OTEL_AVAILABLE = False

if TYPE_CHECKING:
    from opentelemetry.metrics import Counter as CounterT
    from opentelemetry.metrics import Histogram as HistogramT
    from opentelemetry.metrics import Meter as MeterT
    from opentelemetry.trace import Span as SpanT
    from opentelemetry.trace import SpanKind as SpanKindT
    from opentelemetry.trace import Status as StatusT
    from opentelemetry.trace import StatusCode as StatusCodeT
    from opentelemetry.trace import Tracer as TracerT
else:  # pragma: no cover - typing fallback
    type CounterT = Any
    type HistogramT = Any
    type MeterT = Any
    type SpanT = Any
    type SpanKindT = Any
    type StatusT = Any
    type StatusCodeT = Any
    type TracerT = Any

logger = logging.getLogger(__name__)


class _NoopInstrument:
    """Minimal no-op instrument used when OpenTelemetry is unavailable."""

    def add(self, *args: Any, **kwargs: Any) -> None:  # pragma: no cover - trivial
        return None

    def record(self, *args: Any, **kwargs: Any) -> None:  # pragma: no cover - trivial
        return None


type CounterInstrument = CounterT | _NoopInstrument
type HistogramInstrument = HistogramT | _NoopInstrument
type SpanContextManager = AbstractContextManager[SpanT | None]


def _get_span_kind(kind_name: str) -> SpanKindT | None:
    """Resolve a SpanKind attribute when OpenTelemetry is available."""

    if trace is None:
        return None
    span_kind = getattr(trace, "SpanKind", None)
    if span_kind is None:
        return None
    return getattr(span_kind, kind_name, None)


class BillingMetrics:
    """Billing metrics collector"""

    def __init__(
        self,
        meter: MeterT | None = None,
        tracer: TracerT | None = None,
    ) -> None:
        """Initialize billing metrics"""

        self.meter: MeterT | None
        try:
            self.meter = meter or get_meter("billing")
        except Exception as exc:  # pragma: no cover - optional dependency path
            logger.debug("billing.metrics.meter_unavailable: %s", exc)
            self.meter = None

        self.tracer: TracerT | None
        try:
            self.tracer = tracer or get_tracer("billing")
        except Exception as exc:  # pragma: no cover - optional dependency path
            logger.debug("billing.metrics.tracer_unavailable: %s", exc)
            self.tracer = None

        # Invoice metrics
        self.invoice_created_counter = self._create_counter(
            name="billing.invoice.created",
            description="Number of invoices created",
        )
        self.invoice_finalized_counter = self._create_counter(
            name="billing.invoice.finalized",
            description="Number of invoices finalized",
        )
        self.invoice_paid_counter = self._create_counter(
            name="billing.invoice.paid",
            description="Number of invoices paid",
        )
        self.invoice_voided_counter = self._create_counter(
            name="billing.invoice.voided",
            description="Number of invoices voided",
        )
        self.invoice_amount_histogram = self._create_histogram(
            name="billing.invoice.amount",
            description="Invoice amounts",
            unit="cents",
        )

        # Payment metrics
        self.payment_initiated_counter = self._create_counter(
            name="billing.payment.initiated",
            description="Number of payments initiated",
        )
        self.payment_succeeded_counter = self._create_counter(
            name="billing.payment.succeeded",
            description="Number of successful payments",
        )
        self.payment_failed_counter = self._create_counter(
            name="billing.payment.failed",
            description="Number of failed payments",
        )
        self.payment_refunded_counter = self._create_counter(
            name="billing.payment.refunded",
            description="Number of refunds processed",
        )
        self.payment_amount_histogram = self._create_histogram(
            name="billing.payment.amount",
            description="Payment amounts",
            unit="cents",
        )
        self.payment_duration_histogram = self._create_histogram(
            name="billing.payment.duration",
            description="Payment processing duration",
            unit="ms",
        )

        # Webhook metrics
        self.webhook_received_counter = self._create_counter(
            name="billing.webhook.received",
            description="Number of webhooks received",
        )
        self.webhook_processed_counter = self._create_counter(
            name="billing.webhook.processed",
            description="Number of webhooks processed successfully",
        )
        self.webhook_failed_counter = self._create_counter(
            name="billing.webhook.failed",
            description="Number of webhook processing failures",
        )
        self.webhook_duration_histogram = self._create_histogram(
            name="billing.webhook.duration",
            description="Webhook processing duration",
            unit="ms",
        )

        # Revenue metrics
        self.revenue_counter = self._create_counter(
            name="billing.revenue.total",
            description="Total revenue collected",
            unit="cents",
        )
        self.refund_counter = self._create_counter(
            name="billing.refund.total",
            description="Total refunds issued",
            unit="cents",
        )

        # Credit note metrics
        self.credit_note_created_counter = self._create_counter(
            name="billing.credit_note.created",
            description="Number of credit notes created",
        )
        self.credit_note_issued_counter = self._create_counter(
            name="billing.credit_note.issued",
            description="Number of credit notes issued",
        )
        self.credit_note_voided_counter = self._create_counter(
            name="billing.credit_note.voided",
            description="Number of credit notes voided",
        )
        self.credit_note_amount_histogram = self._create_histogram(
            name="billing.credit_note.amount",
            description="Credit note amounts",
            unit="cents",
        )

        # Receipt metrics
        self.receipt_generated_counter = self._create_counter(
            name="billing.receipt.generated",
            description="Number of receipts generated",
        )

    # Invoice metrics
    def record_invoice_created(
        self,
        tenant_id: str,
        amount: int,
        currency: str,
        customer_id: str,
    ) -> None:
        """Record invoice creation"""
        attributes = {
            "tenant_id": tenant_id,
            "currency": currency,
            "customer_id": customer_id,
        }
        self.invoice_created_counter.add(1, attributes)
        self.invoice_amount_histogram.record(amount, attributes)
        logger.info(f"Invoice created - tenant: {tenant_id}, amount: {amount} {currency}")

    def record_invoice_finalized(self, tenant_id: str, invoice_id: str) -> None:
        """Record invoice finalization"""
        attributes = {"tenant_id": tenant_id, "invoice_id": invoice_id}
        self.invoice_finalized_counter.add(1, attributes)
        logger.info(f"Invoice finalized - tenant: {tenant_id}, invoice: {invoice_id}")

    def record_invoice_paid(
        self, tenant_id: str, invoice_id: str, amount: int, currency: str
    ) -> None:
        """Record invoice payment"""
        attributes = {
            "tenant_id": tenant_id,
            "invoice_id": invoice_id,
            "currency": currency,
        }
        self.invoice_paid_counter.add(1, attributes)
        self.revenue_counter.add(amount, attributes)
        logger.info(
            f"Invoice paid - tenant: {tenant_id}, invoice: {invoice_id}, "
            f"amount: {amount} {currency}"
        )

    def record_invoice_voided(self, tenant_id: str, invoice_id: str) -> None:
        """Record invoice void"""
        attributes = {"tenant_id": tenant_id, "invoice_id": invoice_id}
        self.invoice_voided_counter.add(1, attributes)
        logger.info(f"Invoice voided - tenant: {tenant_id}, invoice: {invoice_id}")

    # Payment metrics
    def record_payment_initiated(
        self,
        tenant_id: str,
        payment_id: str,
        amount: int,
        currency: str,
        provider: str,
    ) -> None:
        """Record payment initiation"""
        attributes = {
            "tenant_id": tenant_id,
            "payment_id": payment_id,
            "currency": currency,
            "provider": provider,
        }
        self.payment_initiated_counter.add(1, attributes)
        self.payment_amount_histogram.record(amount, attributes)
        logger.info(
            f"Payment initiated - tenant: {tenant_id}, payment: {payment_id}, "
            f"amount: {amount} {currency}, provider: {provider}"
        )

    def record_payment_completed(
        self,
        tenant_id: str,
        payment_id: str,
        status: PaymentStatus,
        duration_ms: float,
        provider: str,
    ) -> None:
        """Record payment completion"""
        attributes = {
            "tenant_id": tenant_id,
            "payment_id": payment_id,
            "status": status.value,
            "provider": provider,
        }

        if status == PaymentStatus.SUCCEEDED:
            self.payment_succeeded_counter.add(1, attributes)
        elif status == PaymentStatus.FAILED:
            self.payment_failed_counter.add(1, attributes)

        self.payment_duration_histogram.record(duration_ms, attributes)
        logger.info(
            f"Payment completed - tenant: {tenant_id}, payment: {payment_id}, "
            f"status: {status.value}, duration: {duration_ms}ms"
        )

    def record_payment_refunded(
        self,
        tenant_id: str,
        payment_id: str,
        amount: int,
        currency: str,
    ) -> None:
        """Record payment refund"""
        attributes = {
            "tenant_id": tenant_id,
            "payment_id": payment_id,
            "currency": currency,
        }
        self.payment_refunded_counter.add(1, attributes)
        self.refund_counter.add(amount, attributes)
        logger.info(
            f"Payment refunded - tenant: {tenant_id}, payment: {payment_id}, "
            f"amount: {amount} {currency}"
        )

    # Webhook metrics
    def record_webhook_received(self, provider: str, event_type: str) -> None:
        """Record webhook receipt"""
        attributes = {"provider": provider, "event_type": event_type}
        self.webhook_received_counter.add(1, attributes)
        logger.debug(f"Webhook received - provider: {provider}, type: {event_type}")

    def record_webhook_processed(
        self,
        provider: str,
        event_type: str,
        success: bool,
        duration_ms: float,
    ) -> None:
        """Record webhook processing result"""
        attributes = {
            "provider": provider,
            "event_type": event_type,
            "success": str(success),
        }

        if success:
            self.webhook_processed_counter.add(1, attributes)
        else:
            self.webhook_failed_counter.add(1, attributes)

        self.webhook_duration_histogram.record(duration_ms, attributes)
        logger.info(
            f"Webhook processed - provider: {provider}, type: {event_type}, "
            f"success: {success}, duration: {duration_ms}ms"
        )

    # Credit note metrics
    def record_credit_note_created(
        self,
        tenant_id: str,
        amount: int,
        currency: str,
        reason: str,
    ) -> None:
        """Record credit note creation"""
        attributes = {
            "tenant_id": tenant_id,
            "currency": currency,
            "reason": reason,
        }
        self.credit_note_created_counter.add(1, attributes)
        self.credit_note_amount_histogram.record(amount, attributes)
        logger.info(
            f"Credit note created - tenant: {tenant_id}, amount: {amount} {currency}, reason: {reason}"
        )

    def record_credit_note_issued(self, tenant_id: str, credit_note_id: str) -> None:
        """Record credit note issuance"""
        attributes = {"tenant_id": tenant_id, "credit_note_id": credit_note_id}
        self.credit_note_issued_counter.add(1, attributes)
        logger.info(f"Credit note issued - tenant: {tenant_id}, credit_note: {credit_note_id}")

    def record_credit_note_voided(self, tenant_id: str, credit_note_id: str) -> None:
        """Record credit note void"""
        attributes = {"tenant_id": tenant_id, "credit_note_id": credit_note_id}
        self.credit_note_voided_counter.add(1, attributes)
        logger.info(f"Credit note voided - tenant: {tenant_id}, credit_note: {credit_note_id}")

    def record_receipt_generated(
        self,
        tenant_id: str,
        amount: int,
        currency: str,
        payment_id: str | None = None,
    ) -> None:
        """Record receipt generation"""
        attributes = {"tenant_id": tenant_id, "currency": currency}
        if payment_id is not None:
            attributes["payment_id"] = payment_id
        self.receipt_generated_counter.add(1, attributes)
        self.payment_amount_histogram.record(amount, attributes)

    # Internal helpers -----------------------------------------------------

    def _create_counter(self, name: str, description: str, unit: str = "1") -> CounterInstrument:
        if not self.meter:
            return _NoopInstrument()
        try:
            return self.meter.create_counter(name=name, description=description, unit=unit)
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("billing.metrics.counter_unavailable (%s): %s", name, exc)
            return _NoopInstrument()

    def _create_histogram(
        self, name: str, description: str, unit: str = "1"
    ) -> HistogramInstrument:
        if not self.meter:
            return _NoopInstrument()
        try:
            return self.meter.create_histogram(name=name, description=description, unit=unit)
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("billing.metrics.histogram_unavailable (%s): %s", name, exc)
            return _NoopInstrument()

    # Tracing helpers
    def trace_invoice_operation(
        self,
        operation: str,
        tenant_id: str,
        invoice_id: str,
    ) -> SpanContextManager:
        """Create a trace span for invoice operations"""
        span_kind = _get_span_kind("INTERNAL")
        if not self.tracer or span_kind is None:
            return contextlib.nullcontext(None)
        return self.tracer.start_as_current_span(
            f"billing.invoice.{operation}",
            kind=span_kind,
            attributes={
                "tenant_id": tenant_id,
                "invoice_id": invoice_id,
                "operation": operation,
            },
        )

    def trace_payment_operation(
        self,
        operation: str,
        tenant_id: str,
        payment_id: str,
        provider: str,
    ) -> SpanContextManager:
        """Create a trace span for payment operations"""
        span_kind = _get_span_kind("INTERNAL")
        if not self.tracer or span_kind is None:
            return contextlib.nullcontext(None)
        return self.tracer.start_as_current_span(
            f"billing.payment.{operation}",
            kind=span_kind,
            attributes={
                "tenant_id": tenant_id,
                "payment_id": payment_id,
                "provider": provider,
                "operation": operation,
            },
        )

    def trace_webhook_processing(
        self,
        provider: str,
        event_type: str,
    ) -> SpanContextManager:
        """Create a trace span for webhook processing"""
        span_kind = _get_span_kind("SERVER")
        if not self.tracer or span_kind is None:
            return contextlib.nullcontext(None)
        return self.tracer.start_as_current_span(
            "billing.webhook.process",
            kind=span_kind,
            attributes={
                "provider": provider,
                "event_type": event_type,
            },
        )


# Global metrics instance
_billing_metrics: BillingMetrics | None = None


def get_billing_metrics() -> BillingMetrics:
    """Get the global billing metrics instance"""
    global _billing_metrics
    if _billing_metrics is None:
        _billing_metrics = BillingMetrics()
    return _billing_metrics


def set_billing_metrics(metrics: BillingMetrics) -> None:
    """Set the global billing metrics instance"""
    global _billing_metrics
    _billing_metrics = metrics
