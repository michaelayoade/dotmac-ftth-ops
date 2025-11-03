"""
Fake implementations for external services.

Fakes are lightweight, in-memory implementations that behave like real services
but don't make external calls. Use these instead of mocks for better test quality.

Benefits over mocks:
- Maintain the service contract (same interface)
- Stateful (can track calls, verify behavior)
- No mock configuration needed
- Reusable across tests
- Easy to add test-specific helpers
"""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import uuid4


class FakePaymentGateway:
    """
    Fake payment gateway for testing billing flows.

    Simulates Stripe/PayPal-like payment processing without external calls.

    Example:
        gateway = FakePaymentGateway()
        charge = await gateway.charge(Decimal("100.00"), "card_123")
        assert charge["status"] == "success"

        # Test failures
        gateway.simulate_failure()
        with pytest.raises(PaymentError):
            await gateway.charge(Decimal("50.00"), "card_456")
    """

    def __init__(self):
        self.charges: list[dict] = []
        self.refunds: list[dict] = []
        self.payment_methods: dict[str, dict] = {}
        self._should_fail = False
        self._failure_reason = "card_declined"

    async def charge(
        self,
        amount: Decimal,
        payment_method: str,
        currency: str = "USD",
        description: str = "",
        metadata: dict | None = None,
    ) -> dict:
        """
        Charge a payment method.

        Args:
            amount: Amount to charge
            payment_method: Payment method ID
            currency: Currency code
            description: Charge description
            metadata: Additional metadata

        Returns:
            Charge object with id, amount, status

        Raises:
            PaymentError: If simulate_failure() was called
        """
        if self._should_fail:
            from dotmac.platform.billing.exceptions import PaymentError

            raise PaymentError(self._failure_reason)

        charge = {
            "id": f"ch_{uuid4().hex[:16]}",
            "amount": amount,
            "currency": currency,
            "payment_method": payment_method,
            "status": "success",
            "description": description,
            "metadata": metadata or {},
            "created_at": datetime.now(UTC),
        }
        self.charges.append(charge)
        return charge

    async def refund(
        self,
        charge_id: str,
        amount: Decimal | None = None,
        reason: str = "",
    ) -> dict:
        """
        Refund a charge.

        Args:
            charge_id: Charge to refund
            amount: Amount to refund (None = full refund)
            reason: Refund reason

        Returns:
            Refund object with id, charge_id, amount, status
        """
        # Find original charge
        charge = next((c for c in self.charges if c["id"] == charge_id), None)
        if not charge:
            from dotmac.platform.billing.exceptions import PaymentError

            raise PaymentError(f"Charge {charge_id} not found")

        refund_amount = amount or charge["amount"]

        refund = {
            "id": f"ref_{uuid4().hex[:16]}",
            "charge_id": charge_id,
            "amount": refund_amount,
            "status": "success",
            "reason": reason,
            "created_at": datetime.now(UTC),
        }
        self.refunds.append(refund)
        return refund

    async def create_payment_method(
        self,
        customer_id: str,
        card_number: str = "4242424242424242",
        exp_month: int = 12,
        exp_year: int = 2030,
    ) -> dict:
        """Create a payment method for testing."""
        pm_id = f"pm_{uuid4().hex[:16]}"
        payment_method = {
            "id": pm_id,
            "customer_id": customer_id,
            "type": "card",
            "card": {
                "last4": card_number[-4:],
                "exp_month": exp_month,
                "exp_year": exp_year,
                "brand": "visa",
            },
        }
        self.payment_methods[pm_id] = payment_method
        return payment_method

    async def verify_payment_method(self, payment_method_id: str) -> dict:
        """Verify a payment method."""
        pm = self.payment_methods.get(payment_method_id)
        if not pm:
            from dotmac.platform.billing.exceptions import PaymentError

            raise PaymentError(f"Payment method {payment_method_id} not found")

        return {
            "status": "verified",
            "payment_method": pm,
        }

    # Test helpers

    def simulate_failure(self, reason: str = "card_declined"):
        """Make next charge fail."""
        self._should_fail = True
        self._failure_reason = reason

    def reset(self):
        """Reset to normal operation."""
        self._should_fail = False
        self._failure_reason = "card_declined"

    def get_charges(self, payment_method: str | None = None) -> list[dict]:
        """Get all charges, optionally filtered by payment method."""
        if payment_method:
            return [c for c in self.charges if c["payment_method"] == payment_method]
        return self.charges.copy()

    def get_refunds(self, charge_id: str | None = None) -> list[dict]:
        """Get all refunds, optionally filtered by charge."""
        if charge_id:
            return [r for r in self.refunds if r["charge_id"] == charge_id]
        return self.refunds.copy()

    def get_total_charged(self) -> Decimal:
        """Get total amount charged."""
        return sum(c["amount"] for c in self.charges)

    def get_total_refunded(self) -> Decimal:
        """Get total amount refunded."""
        return sum(r["amount"] for r in self.refunds)


class FakeEmailService:
    """
    Fake email service for testing communications.

    Simulates SendGrid/Mailgun without actually sending emails.

    Example:
        email = FakeEmailService()
        await email.send(
            to="user@example.com",
            subject="Welcome",
            body="Hello!"
        )

        # Verify email was sent
        sent = email.get_sent_emails()
        assert len(sent) == 1
        assert sent[0]["to"] == "user@example.com"
    """

    def __init__(self):
        self.sent_emails: list[dict] = []
        self._should_fail = False

    async def send(
        self,
        to: str | list[str],
        subject: str,
        body: str,
        from_email: str = "noreply@dotmac.io",
        cc: list[str] | None = None,
        bcc: list[str] | None = None,
        attachments: list[dict] | None = None,
        template_id: str | None = None,
        template_data: dict | None = None,
    ) -> dict:
        """
        Send an email.

        Args:
            to: Recipient email(s)
            subject: Email subject
            body: Email body (HTML or text)
            from_email: Sender email
            cc: CC recipients
            bcc: BCC recipients
            attachments: Email attachments
            template_id: Template ID (if using template)
            template_data: Template variables

        Returns:
            Email send result with message_id
        """
        if self._should_fail:
            raise Exception("Email service unavailable")

        recipients = [to] if isinstance(to, str) else to

        email = {
            "id": f"msg_{uuid4().hex[:16]}",
            "to": recipients,
            "from": from_email,
            "subject": subject,
            "body": body,
            "cc": cc or [],
            "bcc": bcc or [],
            "attachments": attachments or [],
            "template_id": template_id,
            "template_data": template_data,
            "sent_at": datetime.now(UTC),
        }
        self.sent_emails.append(email)

        return {
            "message_id": email["id"],
            "status": "sent",
        }

    async def send_batch(self, emails: list[dict]) -> dict:
        """Send multiple emails."""
        results = []
        for email in emails:
            result = await self.send(**email)
            results.append(result)
        return {"sent": len(results), "results": results}

    # Test helpers

    def simulate_failure(self):
        """Make next send fail."""
        self._should_fail = True

    def reset(self):
        """Reset to normal operation."""
        self._should_fail = False

    def get_sent_emails(
        self,
        to: str | None = None,
        subject_contains: str | None = None,
    ) -> list[dict]:
        """Get sent emails, optionally filtered."""
        emails = self.sent_emails.copy()

        if to:
            emails = [e for e in emails if to in e["to"]]

        if subject_contains:
            emails = [e for e in emails if subject_contains in e["subject"]]

        return emails

    def clear(self):
        """Clear sent emails."""
        self.sent_emails.clear()


class FakeSMSService:
    """
    Fake SMS service for testing notifications.

    Simulates Twilio without actually sending SMS.

    Example:
        sms = FakeSMSService()
        await sms.send("+1234567890", "Your code is 123456")

        # Verify SMS was sent
        sent = sms.get_sent_messages()
        assert len(sent) == 1
        assert "123456" in sent[0]["body"]
    """

    def __init__(self):
        self.sent_messages: list[dict] = []
        self._should_fail = False

    async def send(
        self,
        to: str,
        body: str,
        from_number: str = "+15555551234",
    ) -> dict:
        """
        Send an SMS message.

        Args:
            to: Recipient phone number
            body: Message body
            from_number: Sender phone number

        Returns:
            Message send result with message_id
        """
        if self._should_fail:
            raise Exception("SMS service unavailable")

        message = {
            "id": f"sms_{uuid4().hex[:16]}",
            "to": to,
            "from": from_number,
            "body": body,
            "sent_at": datetime.now(UTC),
            "status": "sent",
        }
        self.sent_messages.append(message)

        return {
            "message_id": message["id"],
            "status": "sent",
        }

    # Test helpers

    def simulate_failure(self):
        """Make next send fail."""
        self._should_fail = True

    def reset(self):
        """Reset to normal operation."""
        self._should_fail = False

    def get_sent_messages(self, to: str | None = None) -> list[dict]:
        """Get sent messages, optionally filtered by recipient."""
        if to:
            return [m for m in self.sent_messages if m["to"] == to]
        return self.sent_messages.copy()

    def clear(self):
        """Clear sent messages."""
        self.sent_messages.clear()


class FakeStorageClient:
    """
    Fake storage client for testing file operations.

    Simulates S3/MinIO without actual storage.

    Example:
        storage = FakeStorageClient()
        await storage.upload("bucket", "file.txt", b"content")

        # Retrieve file
        content = await storage.download("bucket", "file.txt")
        assert content == b"content"
    """

    def __init__(self):
        self.buckets: dict[str, dict[str, bytes]] = {}

    async def create_bucket(self, bucket_name: str) -> None:
        """Create a bucket."""
        if bucket_name not in self.buckets:
            self.buckets[bucket_name] = {}

    async def bucket_exists(self, bucket_name: str) -> bool:
        """Check if bucket exists."""
        return bucket_name in self.buckets

    async def upload(
        self,
        bucket: str,
        key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
    ) -> dict:
        """Upload a file."""
        if bucket not in self.buckets:
            await self.create_bucket(bucket)

        self.buckets[bucket][key] = data

        return {
            "bucket": bucket,
            "key": key,
            "size": len(data),
            "content_type": content_type,
        }

    async def download(self, bucket: str, key: str) -> bytes:
        """Download a file."""
        if bucket not in self.buckets:
            raise FileNotFoundError(f"Bucket {bucket} not found")

        if key not in self.buckets[bucket]:
            raise FileNotFoundError(f"Key {key} not found in bucket {bucket}")

        return self.buckets[bucket][key]

    async def delete(self, bucket: str, key: str) -> None:
        """Delete a file."""
        if bucket in self.buckets and key in self.buckets[bucket]:
            del self.buckets[bucket][key]

    async def list_objects(self, bucket: str, prefix: str = "") -> list[str]:
        """List objects in bucket."""
        if bucket not in self.buckets:
            return []

        keys = list(self.buckets[bucket].keys())
        if prefix:
            keys = [k for k in keys if k.startswith(prefix)]
        return keys

    # Test helpers

    def get_file_count(self, bucket: str) -> int:
        """Get number of files in bucket."""
        if bucket not in self.buckets:
            return 0
        return len(self.buckets[bucket])

    def clear_bucket(self, bucket: str) -> None:
        """Clear all files from bucket."""
        if bucket in self.buckets:
            self.buckets[bucket].clear()

    def clear_all(self) -> None:
        """Clear all buckets."""
        self.buckets.clear()


class FakeCache:
    """
    Fake cache for testing caching logic.

    Simulates Redis/Memcached without external service.

    Example:
        cache = FakeCache()
        await cache.set("key", "value", ttl=60)
        value = await cache.get("key")
        assert value == "value"
    """

    def __init__(self):
        self.data: dict[str, Any] = {}
        self.ttls: dict[str, datetime] = {}

    async def get(self, key: str) -> Any | None:
        """Get value from cache."""
        # Check TTL
        if key in self.ttls:
            if datetime.now(UTC) > self.ttls[key]:
                del self.data[key]
                del self.ttls[key]
                return None

        return self.data.get(key)

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """Set value in cache."""
        from datetime import timedelta

        self.data[key] = value
        if ttl:
            self.ttls[key] = datetime.now(UTC).replace(microsecond=0) + timedelta(seconds=ttl)

    async def delete(self, key: str) -> None:
        """Delete key from cache."""
        self.data.pop(key, None)
        self.ttls.pop(key, None)

    async def exists(self, key: str) -> bool:
        """Check if key exists."""
        value = await self.get(key)
        return value is not None

    async def clear(self) -> None:
        """Clear all cache."""
        self.data.clear()
        self.ttls.clear()

    # Test helpers

    def get_all_keys(self) -> list[str]:
        """Get all keys in cache."""
        return list(self.data.keys())

    def size(self) -> int:
        """Get number of items in cache."""
        return len(self.data)


# Convenience fixtures (add to conftest.py)
"""
Add these to your tests/conftest.py:

@pytest.fixture
def payment_gateway_fake():
    '''Fake payment gateway for testing billing.'''
    return FakePaymentGateway()

@pytest.fixture
def email_service_fake():
    '''Fake email service for testing communications.'''
    return FakeEmailService()

@pytest.fixture
def sms_service_fake():
    '''Fake SMS service for testing notifications.'''
    return FakeSMSService()

@pytest.fixture
def storage_client_fake():
    '''Fake storage client for testing file operations.'''
    return FakeStorageClient()

@pytest.fixture
def cache_fake():
    '''Fake cache for testing caching logic.'''
    return FakeCache()
"""
