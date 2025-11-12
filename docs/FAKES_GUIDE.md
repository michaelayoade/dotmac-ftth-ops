# Fakes Guide - Testing Without Mocks

**Purpose:** Use fake implementations instead of mocks for better test quality

**Location:** `tests/helpers/fakes.py`

**Fixtures:** Available in `tests/conftest.py`

---

## What Are Fakes?

**Fakes** are lightweight, in-memory implementations that behave like real services but don't make external calls.

### Fakes vs Mocks

| Aspect | Fakes | Mocks |
|--------|-------|-------|
| **Contract** | Implements real interface | No contract |
| **Behavior** | Behaves like real service | Returns canned responses |
| **State** | Stateful (tracks history) | Usually stateless |
| **Validation** | Validates inputs | No validation |
| **Reusability** | Highly reusable | Usually one-off |
| **Maintenance** | Low (single implementation) | High (configured per test) |
| **Type Safety** | Full type checking | Limited (MagicMock) |
| **Refactoring** | Safe (breaks if API changes) | Brittle (breaks on internals) |

---

## Available Fakes

### 1. FakePaymentGateway

**Use for:** Testing billing flows without real payment processing

**Interface:** Matches Stripe/PayPal-like payment gateways

```python
async def test_payment_processing(payment_gateway_fake):
    # Charge payment method
    charge = await payment_gateway_fake.charge(
        amount=Decimal("100.00"),
        payment_method="pm_123",
        currency="USD",
        description="Service subscription"
    )

    assert charge["status"] == "success"
    assert charge["amount"] == Decimal("100.00")

    # Refund
    refund = await payment_gateway_fake.refund(
        charge_id=charge["id"],
        amount=Decimal("50.00")
    )

    # Verify operations
    charges = payment_gateway_fake.get_charges()
    assert len(charges) == 1

    refunds = payment_gateway_fake.get_refunds()
    assert len(refunds) == 1
```

**Test Helpers:**

```python
# Simulate failures
payment_gateway_fake.simulate_failure(reason="card_declined")
with pytest.raises(PaymentError):
    await payment_gateway_fake.charge(Decimal("100.00"), "pm_123")

# Query history
total_charged = payment_gateway_fake.get_total_charged()
total_refunded = payment_gateway_fake.get_total_refunded()

# Reset state
payment_gateway_fake.reset()
```

---

### 2. FakeEmailService

**Use for:** Testing email notifications without sending real emails

```python
async def test_welcome_email(email_service_fake):
    # Send email
    result = await email_service_fake.send(
        to="user@example.com",
        subject="Welcome to DotMac",
        body="<h1>Welcome!</h1>",
        from_email="noreply@dotmac.io"
    )

    assert result["status"] == "sent"

    # Verify email was sent
    sent = email_service_fake.get_sent_emails(to="user@example.com")
    assert len(sent) == 1
    assert sent[0]["subject"] == "Welcome to DotMac"
    assert "<h1>Welcome!</h1>" in sent[0]["body"]
```

**Test Helpers:**

```python
# Search emails
welcome_emails = email_service_fake.get_sent_emails(
    subject_contains="Welcome"
)

# Simulate failures
email_service_fake.simulate_failure()
with pytest.raises(Exception):
    await email_service_fake.send(...)

# Clear history
email_service_fake.clear()
```

**Advanced Usage:**

```python
async def test_templated_email(email_service_fake):
    # Send with template
    await email_service_fake.send(
        to="user@example.com",
        subject="Password Reset",
        body="",  # Template will render
        template_id="password_reset",
        template_data={"reset_link": "https://app.com/reset/abc123"}
    )

    # Verify template data
    sent = email_service_fake.get_sent_emails()
    assert sent[0]["template_id"] == "password_reset"
    assert sent[0]["template_data"]["reset_link"] == "https://app.com/reset/abc123"
```

---

### 3. FakeSMSService

**Use for:** Testing SMS notifications without sending real messages

```python
async def test_2fa_code(sms_service_fake):
    # Send SMS
    result = await sms_service_fake.send(
        to="+1234567890",
        body="Your 2FA code is: 123456",
        from_number="+15555551234"
    )

    assert result["status"] == "sent"

    # Verify SMS
    messages = sms_service_fake.get_sent_messages(to="+1234567890")
    assert len(messages) == 1
    assert "123456" in messages[0]["body"]
```

**Test Helpers:**

```python
# Simulate failures
sms_service_fake.simulate_failure()

# Clear history
sms_service_fake.clear()
```

---

### 4. FakeStorageClient

**Use for:** Testing file operations without real S3/MinIO

```python
async def test_file_upload(storage_client_fake):
    # Create bucket
    await storage_client_fake.create_bucket("uploads")

    # Upload file
    result = await storage_client_fake.upload(
        bucket="uploads",
        key="documents/invoice.pdf",
        data=b"PDF content here",
        content_type="application/pdf"
    )

    assert result["size"] == len(b"PDF content here")

    # Download file
    content = await storage_client_fake.download("uploads", "documents/invoice.pdf")
    assert content == b"PDF content here"

    # List files
    files = await storage_client_fake.list_objects("uploads", prefix="documents/")
    assert "documents/invoice.pdf" in files
```

**Test Helpers:**

```python
# Check file count
count = storage_client_fake.get_file_count("uploads")

# Clear bucket
storage_client_fake.clear_bucket("uploads")

# Clear all
storage_client_fake.clear_all()
```

---

### 5. FakeCache

**Use for:** Testing caching logic without Redis/Memcached

```python
async def test_caching(cache_fake):
    # Set value
    await cache_fake.set("user:123", {"name": "John"}, ttl=60)

    # Get value
    user = await cache_fake.get("user:123")
    assert user["name"] == "John"

    # Check existence
    exists = await cache_fake.exists("user:123")
    assert exists is True

    # Delete
    await cache_fake.delete("user:123")
    assert await cache_fake.get("user:123") is None
```

**Test Helpers:**

```python
# Get all keys
keys = cache_fake.get_all_keys()

# Get cache size
size = cache_fake.size()

# Clear cache
await cache_fake.clear()
```

**TTL Testing:**

```python
async def test_cache_expiration(cache_fake):
    from datetime import datetime, timezone, timedelta

    # Set with TTL
    await cache_fake.set("temp_key", "temp_value", ttl=2)  # 2 seconds

    # Immediately available
    assert await cache_fake.exists("temp_key") is True

    # Wait for expiration (or manipulate cache_fake.ttls directly for instant testing)
    import asyncio
    await asyncio.sleep(3)

    # Should be expired
    assert await cache_fake.get("temp_key") is None
```

---

## Creating Custom Fakes

When you need a fake for a service not in `fakes.py`:

### 1. Implement the Service Interface

```python
# tests/helpers/fakes.py

class FakeNetBoxClient:
    """
    Fake NetBox client for testing network operations.

    Simulates NetBox API without external calls.
    """

    def __init__(self):
        self.devices: dict[str, dict] = {}
        self.ip_addresses: dict[str, dict] = {}
        self._should_fail = False

    async def get_device(self, device_id: str) -> dict:
        """Get device by ID."""
        if self._should_fail:
            raise ConnectionError("NetBox unavailable")

        if device_id not in self.devices:
            raise KeyError(f"Device {device_id} not found")

        return self.devices[device_id]

    async def create_device(
        self,
        name: str,
        device_type: str,
        site: str,
        **kwargs
    ) -> dict:
        """Create a device."""
        if self._should_fail:
            raise ConnectionError("NetBox unavailable")

        device_id = f"dev_{len(self.devices)}"
        device = {
            "id": device_id,
            "name": name,
            "device_type": device_type,
            "site": site,
            **kwargs
        }
        self.devices[device_id] = device
        return device

    async def assign_ip_address(
        self,
        device_id: str,
        ip_address: str,
        interface: str
    ) -> dict:
        """Assign IP address to device."""
        if device_id not in self.devices:
            raise KeyError(f"Device {device_id} not found")

        ip_id = f"ip_{len(self.ip_addresses)}"
        ip_record = {
            "id": ip_id,
            "address": ip_address,
            "device_id": device_id,
            "interface": interface
        }
        self.ip_addresses[ip_id] = ip_record
        return ip_record

    # Test helpers

    def simulate_failure(self):
        """Simulate NetBox being unavailable."""
        self._should_fail = True

    def reset(self):
        """Reset to normal operation."""
        self._should_fail = False

    def get_all_devices(self) -> list[dict]:
        """Get all devices (test helper)."""
        return list(self.devices.values())

    def clear(self):
        """Clear all data (test helper)."""
        self.devices.clear()
        self.ip_addresses.clear()
```

### 2. Add Fixture to conftest.py

```python
# tests/conftest.py

from tests.helpers.fakes import FakeNetBoxClient

@pytest.fixture
def netbox_client_fake():
    """
    Fake NetBox client for testing network operations.

    Example:
        async def test_device_provisioning(netbox_client_fake):
            device = await netbox_client_fake.create_device(
                name="router-01",
                device_type="Cisco ISR",
                site="datacenter-1"
            )

            devices = netbox_client_fake.get_all_devices()
            assert len(devices) == 1
    """
    return FakeNetBoxClient()
```

### 3. Use in Tests

```python
async def test_device_provisioning(netbox_client_fake):
    """Test device provisioning workflow"""

    # Create device in NetBox
    device = await netbox_client_fake.create_device(
        name="router-01",
        device_type="Cisco ISR 4451",
        site="datacenter-1",
        role="edge-router"
    )

    # Assign IP
    ip = await netbox_client_fake.assign_ip_address(
        device_id=device["id"],
        ip_address="10.0.1.1/24",
        interface="GigabitEthernet0/0/0"
    )

    # Verify
    assert device["name"] == "router-01"
    assert ip["address"] == "10.0.1.1/24"

    # Verify via test helpers
    devices = netbox_client_fake.get_all_devices()
    assert len(devices) == 1
```

---

## Guidelines for Fakes

### Do's ✅

1. **Match the real interface**
   ```python
   # Good - same signature as real service
   async def charge(self, amount: Decimal, payment_method: str) -> dict:
       ...
   ```

2. **Implement validation**
   ```python
   async def charge(self, amount: Decimal, payment_method: str) -> dict:
       if amount <= 0:
           raise ValueError("Amount must be positive")
       ...
   ```

3. **Track history/state**
   ```python
   def __init__(self):
       self.charges = []  # Track all operations
   ```

4. **Provide test helpers**
   ```python
   def get_charges(self) -> list[dict]:
       """Test helper to verify charges"""
       return self.charges.copy()

   def simulate_failure(self):
       """Test helper to test error handling"""
       self._should_fail = True
   ```

5. **Be stateful but resettable**
   ```python
   def reset(self):
       """Reset to initial state"""
       self.charges.clear()
       self._should_fail = False
   ```

### Don'ts ❌

1. **Don't make real external calls**
   ```python
   # Bad
   async def charge(self, amount, payment_method):
       response = await httpx.post("https://api.stripe.com/...")  # ❌
   ```

2. **Don't use complex logic**
   ```python
   # Bad - fake is too complex
   async def charge(self, amount, payment_method):
       # 100 lines of business logic  # ❌
   ```

3. **Don't require configuration**
   ```python
   # Bad - should work without setup
   def __init__(self, api_key: str, endpoint: str):  # ❌
       self.api_key = api_key
       self.endpoint = endpoint
   ```

4. **Don't couple to specific tests**
   ```python
   # Bad - test-specific behavior
   async def charge(self, amount, payment_method):
       if payment_method == "pm_test_123":  # ❌
           return special_test_result
   ```

---

## Migration Checklist

When replacing mocks with fakes:

- [ ] Identify the external service being mocked
- [ ] Check if fake already exists in `tests/helpers/fakes.py`
- [ ] If not, create fake implementing the service interface
- [ ] Add fixture to `tests/conftest.py`
- [ ] Replace mock with fake in tests
- [ ] Remove mock imports
- [ ] Run tests to verify
- [ ] Update `scripts/count_mocks.sh` to track progress

---

## Examples by Service Type

### Payment Processing

```python
# DON'T
mock_stripe = AsyncMock()
mock_stripe.charge.return_value = {"id": "ch_123"}

# DO
charge = await payment_gateway_fake.charge(Decimal("100.00"), "pm_123")
```

### Email Sending

```python
# DON'T
mock_sendgrid = AsyncMock()
mock_sendgrid.send.return_value = {"status": "sent"}

# DO
await email_service_fake.send("user@test.com", "Subject", "Body")
emails = email_service_fake.get_sent_emails()
```

### File Storage

```python
# DON'T
mock_s3 = AsyncMock()
mock_s3.upload_file.return_value = None

# DO
await storage_client_fake.upload("bucket", "key", b"data")
content = await storage_client_fake.download("bucket", "key")
```

### Caching

```python
# DON'T
mock_redis = AsyncMock()
mock_redis.get.return_value = "cached_value"

# DO
await cache_fake.set("key", "value", ttl=60)
value = await cache_fake.get("key")
```

---

## Benefits Summary

**For Test Quality:**
- ✅ Catches contract violations
- ✅ Tests actual behavior
- ✅ Type-safe
- ✅ Refactoring-safe

**For Development:**
- ✅ Less mock configuration
- ✅ Reusable across tests
- ✅ Clear test intentions
- ✅ Easier to maintain

**For Coverage:**
- ✅ Better integration testing
- ✅ Tests service interactions
- ✅ Catches real bugs
- ✅ Reduces false confidence

---

## Further Reading

- `/docs/MOCK_REDUCTION_EXAMPLES.md` - Concrete refactoring examples
- `/tests/helpers/fakes.py` - Available fake implementations
- `/tests/conftest.py` - Fake fixtures
- `/scripts/count_mocks.sh` - Track mock usage
