# Exception Handling Standards

## Overview

This document establishes standardized exception handling patterns across the DotMac FTTH Operations Platform to ensure consistency, maintainability, and proper API error responses.

## Exception Hierarchy

All platform exceptions follow this hierarchy:

```
DotMacError (base)
├── ValidationError
├── AuthError (auth module)
│   ├── TokenError
│   ├── InsufficientScope
│   ├── AuthorizationError
│   └── ...
├── BusinessRuleError
├── RepositoryError
│   ├── EntityNotFoundError
│   └── DuplicateEntityError
├── ConfigurationError
└── Module-specific exceptions
```

## Core Exception Classes

### Base Exception (`src/dotmac/platform/core/exceptions.py`)

```python
class DotMacError(Exception):
    """Base exception for all DotMac Platform errors."""

    def __init__(
        self,
        message: str,
        error_code: str | None = None,
        details: dict[str, Any] | None = None,
        status_code: int = 500,
    ) -> None:
        self.message = message
        self.error_code = error_code or self.__class__.__name__
        self.details = details or {}
        self.status_code = status_code
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        """Convert exception to dictionary for API responses."""
        return {
            "error": self.error_code,
            "message": self.message,
            "details": self.details,
        }
```

### Domain-Specific Exceptions

Each module should define its own exception classes inheriting from appropriate base classes:

```python
# In module exceptions.py
from dotmac.platform.core.exceptions import DotMacError

class BillingError(DotMacError):
    """Base exception for billing module."""
    pass

class InvoiceNotFoundError(BillingError):
    """Invoice not found."""

    def __init__(self, invoice_id: str):
        super().__init__(
            message=f"Invoice not found: {invoice_id}",
            error_code="INVOICE_NOT_FOUND",
            details={"invoice_id": invoice_id},
            status_code=404,
        )

class PaymentFailedError(BillingError):
    """Payment processing failed."""

    def __init__(self, reason: str, payment_id: str | None = None):
        details = {"reason": reason}
        if payment_id:
            details["payment_id"] = payment_id

        super().__init__(
            message=f"Payment failed: {reason}",
            error_code="PAYMENT_FAILED",
            details=details,
            status_code=402,
        )
```

## Exception Handling Patterns

### 1. Service Layer Pattern

Services should raise domain exceptions, not HTTP exceptions:

```python
# ✅ GOOD - Service raises domain exception
class InvoiceService:
    async def get_invoice(self, invoice_id: str) -> Invoice:
        invoice = await self.repository.find_by_id(invoice_id)
        if not invoice:
            raise InvoiceNotFoundError(invoice_id)
        return invoice
```

```python
# ❌ BAD - Service raises HTTP exception
class InvoiceService:
    async def get_invoice(self, invoice_id: str) -> Invoice:
        invoice = await self.repository.find_by_id(invoice_id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        return invoice
```

### 2. Router Layer Pattern

Routers should catch domain exceptions and convert to HTTP responses:

**Option A: Exception Handler (Recommended for module-wide handling)**

```python
# In main.py or module router.py
from fastapi import Request
from fastapi.responses import JSONResponse
from dotmac.platform.billing.exceptions import BillingError

def billing_error_handler(request: Request, exc: BillingError) -> JSONResponse:
    """Handle billing exceptions with proper status codes."""
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict(),
    )

# Register handler
app.add_exception_handler(BillingError, billing_error_handler)
```

**Option B: Try/Except in Route (For specific handling)**

```python
# In router.py
@router.get("/{invoice_id}", response_model=Invoice)
async def get_invoice(
    invoice_id: str,
    service: InvoiceService = Depends(get_invoice_service),
) -> Invoice:
    """Get invoice by ID."""
    try:
        return await service.get_invoice(invoice_id)
    except InvoiceNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except PaymentFailedError as e:
        raise HTTPException(status_code=402, detail=e.message)
```

**Option C: Dependency (For automatic conversion)**

```python
# In dependencies.py
from fastapi import Depends, HTTPException

async def convert_exceptions(func):
    """Decorator to convert domain exceptions to HTTP exceptions."""
    try:
        return await func()
    except DotMacError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail=e.to_dict(),
        )

# In router.py
@router.get("/{invoice_id}", response_model=Invoice)
async def get_invoice(
    invoice_id: str,
    service: InvoiceService = Depends(get_invoice_service),
    _: None = Depends(convert_exceptions),
) -> Invoice:
    """Get invoice by ID."""
    return await service.get_invoice(invoice_id)
```

### 3. Repository Layer Pattern

Repositories should raise repository-specific exceptions:

```python
class InvoiceRepository:
    async def find_by_id(self, invoice_id: str) -> Invoice | None:
        """Find invoice by ID."""
        try:
            result = await self.session.execute(
                select(InvoiceTable).where(InvoiceTable.invoice_id == invoice_id)
            )
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            raise RepositoryError(f"Database error: {e}")
```

## HTTP Status Code Mapping

Use appropriate HTTP status codes for different error types:

| Status Code | Error Type | Example |
|-------------|-----------|---------|
| 400 | Bad Request | Invalid input data, validation errors |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions, authorization failure |
| 404 | Not Found | Entity not found |
| 409 | Conflict | Duplicate entity, constraint violation |
| 422 | Unprocessable Entity | Business rule violation |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected errors, system failures |
| 502 | Bad Gateway | External service unavailable |
| 503 | Service Unavailable | Service temporarily unavailable |
| 504 | Gateway Timeout | External service timeout |

## Logging Exceptions

All exceptions should be logged with structured logging:

```python
import structlog

logger = structlog.get_logger(__name__)

class InvoiceService:
    async def create_invoice(self, data: CreateInvoiceRequest) -> Invoice:
        try:
            invoice = await self.repository.create(data)
            logger.info(
                "invoice.created",
                invoice_id=invoice.invoice_id,
                customer_id=data.customer_id,
                amount=invoice.total_amount,
            )
            return invoice
        except DuplicateEntityError as e:
            logger.warning(
                "invoice.duplicate",
                invoice_id=data.invoice_id,
                error=str(e),
            )
            raise
        except Exception as e:
            logger.error(
                "invoice.creation_failed",
                customer_id=data.customer_id,
                error=str(e),
                error_type=type(e).__name__,
            )
            raise
```

## Error Response Format

All API error responses should follow this format:

```json
{
  "error": "INVOICE_NOT_FOUND",
  "message": "Invoice not found: INV-12345",
  "details": {
    "invoice_id": "INV-12345"
  }
}
```

For validation errors (422):

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid input data",
  "details": {
    "fields": {
      "email": "Invalid email format",
      "amount": "Must be greater than 0"
    }
  }
}
```

## Best Practices

### DO ✅

1. **Use domain-specific exceptions** in service layer
2. **Include error codes** for programmatic error handling
3. **Provide details** for debugging (invoice_id, user_id, etc.)
4. **Log all exceptions** with structured logging
5. **Map exceptions to appropriate HTTP status codes**
6. **Use exception handlers** for module-wide error handling
7. **Include context** in exception messages
8. **Chain exceptions** using `from` keyword when wrapping

### DON'T ❌

1. **Don't raise HTTPException** in service or repository layers
2. **Don't expose internal details** in error messages (stack traces, DB errors)
3. **Don't use generic exceptions** without context
4. **Don't swallow exceptions** without logging
5. **Don't return error codes in success responses**
6. **Don't mix exception types** (e.g., ValidationError for not found)
7. **Don't forget to document** custom exceptions

## Exception Documentation

Document custom exceptions in module docstrings:

```python
"""
Billing module exceptions.

Exceptions:
    BillingError: Base exception for billing module
    InvoiceNotFoundError: Raised when invoice is not found (404)
    PaymentFailedError: Raised when payment processing fails (402)
    InsufficientFundsError: Raised when account has insufficient funds (402)
    DuplicateInvoiceError: Raised when invoice ID already exists (409)
"""
```

## Testing Exceptions

Test exception handling in unit and integration tests:

```python
@pytest.mark.asyncio
async def test_get_invoice_not_found(service: InvoiceService):
    """Test InvoiceNotFoundError is raised for non-existent invoice."""
    with pytest.raises(InvoiceNotFoundError) as exc_info:
        await service.get_invoice("INVALID-ID")

    assert exc_info.value.error_code == "INVOICE_NOT_FOUND"
    assert "INVALID-ID" in exc_info.value.message
    assert exc_info.value.status_code == 404

@pytest.mark.asyncio
async def test_get_invoice_not_found_api(client: TestClient):
    """Test API returns 404 for non-existent invoice."""
    response = client.get("/api/v1/invoices/INVALID-ID")

    assert response.status_code == 404
    assert response.json()["error"] == "INVOICE_NOT_FOUND"
    assert "INVALID-ID" in response.json()["message"]
```

## Migration Path

For existing code that doesn't follow these patterns:

1. **Identify HTTPException usage** in service layers
2. **Create domain exceptions** for each use case
3. **Replace HTTPException** with domain exceptions
4. **Add exception handlers** in routers
5. **Update tests** to verify new exception types
6. **Document** the changes in PR

## Examples by Module

### Auth Module (Reference Implementation)

See `src/dotmac/platform/auth/exceptions.py` for the reference implementation:

- Comprehensive exception hierarchy
- Proper HTTP status code mapping
- Rich error details
- Exception handler registration

### Billing Module

```python
# billing/exceptions.py
class BillingError(DotMacError):
    """Base billing exception."""

class InvoiceNotFoundError(BillingError):
    """Invoice not found."""
    def __init__(self, invoice_id: str):
        super().__init__(
            message=f"Invoice not found: {invoice_id}",
            error_code="INVOICE_NOT_FOUND",
            details={"invoice_id": invoice_id},
            status_code=404,
        )
```

### RADIUS Module

```python
# radius/exceptions.py
class RADIUSError(DotMacError):
    """Base RADIUS exception."""

class SubscriberNotFoundError(RADIUSError):
    """RADIUS subscriber not found."""
    def __init__(self, subscriber_id: str):
        super().__init__(
            message=f"RADIUS subscriber not found: {subscriber_id}",
            error_code="RADIUS_SUBSCRIBER_NOT_FOUND",
            details={"subscriber_id": subscriber_id},
            status_code=404,
        )
```

## References

- Auth exceptions: `src/dotmac/platform/auth/exceptions.py`
- Core exceptions: `src/dotmac/platform/core/exceptions.py`
- FastAPI exception handling: https://fastapi.tiangolo.com/tutorial/handling-errors/
- HTTP status codes: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status

## Changelog

- **2025-01-15**: Initial version based on codebase review
- **2025-01-15**: Added examples and best practices
