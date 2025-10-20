# Tenant Context Documentation

## Overview

The DotMac Platform Services supports both single-tenant and multi-tenant deployments. Tenant context is automatically managed by middleware, ensuring proper data isolation and security.

## How Tenant Context Works

### 1. Automatic Tenant Resolution

The `TenantMiddleware` automatically resolves tenant context from requests using the following priority:

1. **Single-Tenant Mode** (default): Always uses the configured default tenant ID
2. **Multi-Tenant Mode**: Resolves from (in order):
   - `X-Tenant-ID` header
   - `tenant_id` query parameter
   - Request state (set by upstream middleware)

### 2. Middleware Configuration

The tenant middleware is automatically added to the FastAPI application:

```python
# src/dotmac/platform/main.py
app.add_middleware(TenantMiddleware)
```

### 3. Configuration

Tenant mode is configured via environment variables:

```bash
# Single-tenant mode (default)
TENANT__MODE=single
TENANT__DEFAULT_TENANT_ID=default

# Multi-tenant mode
TENANT__MODE=multi
TENANT__REQUIRE_TENANT_HEADER=true
TENANT__TENANT_HEADER_NAME=X-Tenant-ID
TENANT__TENANT_QUERY_PARAM=tenant_id
```

## API Usage

### Client Requirements

#### Single-Tenant Mode
No special headers required - tenant context is automatically set.

#### Multi-Tenant Mode
Clients MUST provide tenant identification via one of:

1. **HTTP Header** (recommended):
```http
X-Tenant-ID: tenant-123
```

2. **Query Parameter**:
```http
GET /api/v1/invoices?tenant_id=tenant-123
```

### Frontend Integration

For frontend applications, set the tenant header for all API requests:

```typescript
// Example: React/Next.js
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'X-Tenant-ID': getCurrentTenantId(), // Your tenant resolution logic
  }
});

// Example: Using fetch
const response = await fetch(`${API_URL}/api/v1/customers`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-Tenant-ID': tenantId,
  }
});
```

### Backend Integration

For service-to-service communication:

```python
# Python client example
import httpx

client = httpx.AsyncClient(
    base_url="http://api.example.com",
    headers={"X-Tenant-ID": tenant_id}
)

response = await client.get("/api/v1/invoices")
```

## Billing Module Specifics

All billing endpoints require tenant context. The billing module provides convenience utilities:

### Using Dependency Injection

```python
from dotmac.platform.billing.dependencies import get_tenant_id

@router.post("/invoices")
async def create_invoice(
    tenant_id: str = Depends(get_tenant_id),
    # ... other parameters
):
    # tenant_id is automatically resolved
    pass
```

### Using BillingServiceDeps

```python
from dotmac.platform.billing.dependencies import BillingServiceDeps

@router.post("/payments")
async def create_payment(
    deps: BillingServiceDeps = Depends(),
    # ... other parameters
):
    # Access both DB and tenant context
    service = PaymentService(deps.db)
    payment = await service.create_payment(
        tenant_id=deps.tenant_id,
        # ...
    )
```

## Error Handling

### Missing Tenant Context

If tenant context cannot be determined in multi-tenant mode:

```json
{
  "detail": "Tenant ID is required. Provide via X-Tenant-ID header or tenant_id query param.",
  "status_code": 400
}
```

### Invalid Tenant ID

If an invalid tenant ID is provided:

```json
{
  "detail": "Invalid tenant ID: tenant-xyz",
  "status_code": 403
}
```

## Exempt Paths

The following paths do not require tenant context:

- `/health` - Health check
- `/health/live` - Liveness probe
- `/health/ready` - Readiness probe
- `/metrics` - Prometheus metrics
- `/docs` - API documentation
- `/redoc` - ReDoc documentation
- `/openapi.json` - OpenAPI schema
- `/api/v1/auth/login` - Authentication
- `/api/v1/auth/register` - Registration

## Testing

### Unit Tests

```python
# Test with explicit tenant context
async def test_create_invoice():
    request = Mock(spec=Request)
    request.state.tenant_id = "test-tenant"

    # Test your endpoint
    response = await create_invoice(request=request, ...)
```

### Integration Tests

```python
# Test with headers
async def test_api_with_tenant():
    async with httpx.AsyncClient(app=app) as client:
        response = await client.post(
            "/api/v1/invoices",
            headers={"X-Tenant-ID": "test-tenant"},
            json={...}
        )
        assert response.status_code == 201
```

## Migration Guide

### From Manual Tenant Resolution

If you have existing code that manually resolves tenant ID:

**Before:**
```python
def get_tenant_id_from_request(request: Request) -> str:
    # Manual resolution logic
    if hasattr(request.state, "tenant_id"):
        return request.state.tenant_id
    # ... more checks
```

**After:**
```python
from dotmac.platform.billing.dependencies import get_tenant_id

async def my_endpoint(
    tenant_id: str = Depends(get_tenant_id),
    # ...
):
    # tenant_id is automatically injected
```

## Best Practices

1. **Always use dependency injection** for tenant context in new code
2. **Set tenant headers at the API client level** in frontend applications
3. **Include tenant ID in logs** for debugging multi-tenant issues
4. **Test both single and multi-tenant modes** in your test suite
5. **Document tenant requirements** in your API documentation

## Troubleshooting

### Common Issues

1. **"Tenant ID is required" error**
   - Ensure `X-Tenant-ID` header is being sent
   - Check if middleware is properly configured
   - Verify tenant mode configuration

2. **Wrong tenant data returned**
   - Verify correct tenant ID is being sent
   - Check for tenant ID override in code
   - Ensure proper middleware ordering

3. **Tenant context lost in async operations**
   - Use `contextvars` for maintaining context
   - Pass tenant ID explicitly to background tasks

### Debug Logging

Enable debug logging to trace tenant resolution:

```python
import logging
logging.getLogger("dotmac.platform.tenant").setLevel(logging.DEBUG)
```

## Security Considerations

1. **Validate tenant access**: Ensure users can only access their authorized tenants
2. **Audit tenant switches**: Log when users switch between tenants
3. **Encrypt tenant IDs**: Consider encrypting tenant IDs in transit
4. **Rate limit per tenant**: Apply rate limits at the tenant level
5. **Isolate tenant data**: Ensure proper database-level isolation

## API Documentation

When using tools like Swagger UI or ReDoc, you can set default headers:

### Swagger UI
Click "Authorize" and add custom headers:
```
X-Tenant-ID: your-tenant-id
```

### cURL Examples
```bash
# GET request with tenant header
curl -H "X-Tenant-ID: tenant-123" \
     -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/invoices

# POST request with tenant header
curl -X POST \
     -H "X-Tenant-ID: tenant-123" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"customer_id": "cust-456"}' \
     http://localhost:8000/api/v1/invoices
```

## Additional Resources

- [Tenant Configuration Reference](./configuration.md#tenant-configuration)
- [API Authentication](./auth.md)
- [Database Isolation Strategies](./database.md#tenant-isolation)