"""
Integration tests for Paystack payment plugin.

Tests the complete payment workflow including:
- Plugin configuration
- Payment initialization
- Transaction verification
- Webhook signature validation
- Refund processing
"""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from dotmac.platform.plugins.builtin.paystack_plugin import PaystackPaymentPlugin


@pytest.mark.integration
class TestPaystackPluginConfiguration:
    """Test plugin configuration and initialization"""

    @pytest.mark.asyncio
    async def test_configure_with_valid_live_keys(self):
        """Test configuration with valid live keys"""
        plugin = PaystackPaymentPlugin()

        config = {
            "secret_key": "sk_live_1234567890abcdef",
            "public_key": "pk_live_1234567890abcdef",
        }

        result = await plugin.configure(config)

        assert result is True
        assert plugin.configured is True
        assert plugin.secret_key == config["secret_key"]
        assert plugin.public_key == config["public_key"]

    @pytest.mark.asyncio
    async def test_configure_with_valid_test_keys(self):
        """Test configuration with valid test keys"""
        plugin = PaystackPaymentPlugin()

        config = {
            "secret_key": "sk_test_1234567890abcdef",
            "public_key": "pk_test_1234567890abcdef",
        }

        result = await plugin.configure(config)

        assert result is True
        assert plugin.configured is True

    @pytest.mark.asyncio
    async def test_configure_with_invalid_secret_key_format(self):
        """Test configuration fails with invalid secret key format"""
        plugin = PaystackPaymentPlugin()

        config = {
            "secret_key": "invalid_key_format",
            "public_key": "pk_live_1234567890abcdef",
        }

        with pytest.raises(ValueError, match="Invalid Paystack secret_key format"):
            await plugin.configure(config)

    @pytest.mark.asyncio
    async def test_configure_with_invalid_public_key_format(self):
        """Test configuration fails with invalid public key format"""
        plugin = PaystackPaymentPlugin()

        config = {
            "secret_key": "sk_live_1234567890abcdef",
            "public_key": "invalid_key_format",
        }

        with pytest.raises(ValueError, match="Invalid Paystack public_key format"):
            await plugin.configure(config)

    @pytest.mark.asyncio
    async def test_configure_with_missing_secret_key(self):
        """Test configuration fails with missing secret key"""
        plugin = PaystackPaymentPlugin()

        config = {"public_key": "pk_live_1234567890abcdef"}

        with pytest.raises(ValueError, match="Paystack secret_key is required"):
            await plugin.configure(config)

    @pytest.mark.asyncio
    async def test_configure_with_missing_public_key(self):
        """Test configuration fails with missing public key"""
        plugin = PaystackPaymentPlugin()

        config = {"secret_key": "sk_live_1234567890abcdef"}

        with pytest.raises(ValueError, match="Paystack public_key is required"):
            await plugin.configure(config)

    @pytest.mark.asyncio
    async def test_process_payment_without_configuration(self):
        """Test payment fails if plugin not configured"""
        plugin = PaystackPaymentPlugin()

        with pytest.raises(RuntimeError, match="Paystack plugin not configured"):
            await plugin.process_payment(
                amount=100.00,
                currency="NGN",
                payment_method="card",
                metadata={"customer_email": "test@example.com"},
            )


@pytest.mark.integration
class TestPaystackPaymentInitialization:
    """Test payment initialization and transaction creation"""

    @pytest.mark.asyncio
    async def test_initialize_payment_success(self):
        """Test successful payment initialization"""
        plugin = PaystackPaymentPlugin()
        await plugin.configure(
            {
                "secret_key": "sk_test_1234567890abcdef",
                "public_key": "pk_test_1234567890abcdef",
            }
        )

        # Mock Paystack API response
        mock_response = {
            "status": True,
            "message": "Authorization URL created",
            "data": {
                "authorization_url": "https://checkout.paystack.com/abc123",
                "access_code": "abc123",
                "reference": "ref_1234567890",
            },
        }

        with patch.object(
            plugin.paystack_client.transactions, "initialize", return_value=mock_response
        ):
            result = await plugin.process_payment(
                amount=100.00,
                currency="NGN",
                payment_method="card",
                metadata={
                    "customer_email": "test@example.com",
                    "customer_name": "John Doe",
                    "subscription_id": str(uuid4()),
                },
            )

        assert result["status"] == "pending"
        assert result["payment_id"].startswith("pay_")  # Plugin generates reference
        assert result["authorization_url"] == mock_response["data"]["authorization_url"]
        assert "reference" in result
        assert result["provider"] == "paystack"

    @pytest.mark.asyncio
    async def test_initialize_payment_converts_amount_to_kobo(self):
        """Test that amount is correctly converted to kobo"""
        plugin = PaystackPaymentPlugin()
        await plugin.configure(
            {
                "secret_key": "sk_test_1234567890abcdef",
                "public_key": "pk_test_1234567890abcdef",
            }
        )

        mock_initialize = MagicMock(
            return_value={
                "status": True,
                "message": "Authorization URL created",
                "data": {
                    "authorization_url": "https://checkout.paystack.com/abc123",
                    "access_code": "abc123",
                    "reference": "ref_1234567890",
                },
            }
        )

        with patch.object(plugin.paystack_client.transactions, "initialize", mock_initialize):
            await plugin.process_payment(
                amount=150.50,  # NGN 150.50
                currency="NGN",
                payment_method="card",
                metadata={"customer_email": "test@example.com"},
            )

        # Verify amount was converted to kobo (150.50 NGN = 15050 kobo)
        mock_initialize.assert_called_once()
        call_args = mock_initialize.call_args[1]
        assert call_args["amount"] == 15050

    @pytest.mark.asyncio
    async def test_initialize_payment_with_metadata(self):
        """Test payment initialization includes metadata"""
        plugin = PaystackPaymentPlugin()
        await plugin.configure(
            {
                "secret_key": "sk_test_1234567890abcdef",
                "public_key": "pk_test_1234567890abcdef",
            }
        )

        metadata = {
            "customer_email": "test@example.com",
            "customer_name": "John Doe",
            "subscription_id": "sub_12345",
            "invoice_id": "inv_67890",
        }

        mock_initialize = MagicMock(
            return_value={
                "status": True,
                "data": {
                    "authorization_url": "https://checkout.paystack.com/abc123",
                    "access_code": "abc123",
                    "reference": "ref_1234567890",
                },
            }
        )

        with patch.object(plugin.paystack_client.transactions, "initialize", mock_initialize):
            await plugin.process_payment(
                amount=100.00,
                currency="NGN",
                payment_method="card",
                metadata=metadata,
            )

        # Verify metadata was passed (plugin adds source and payment_method)
        call_args = mock_initialize.call_args[1]
        passed_metadata = call_args["metadata"]
        assert passed_metadata["customer_email"] == metadata["customer_email"]
        assert passed_metadata["customer_name"] == metadata["customer_name"]
        assert passed_metadata["subscription_id"] == metadata["subscription_id"]
        assert passed_metadata["invoice_id"] == metadata["invoice_id"]

    @pytest.mark.asyncio
    async def test_initialize_payment_api_error(self):
        """Test handling of Paystack API errors"""
        plugin = PaystackPaymentPlugin()
        await plugin.configure(
            {
                "secret_key": "sk_test_1234567890abcdef",
                "public_key": "pk_test_1234567890abcdef",
            }
        )

        with patch.object(
            plugin.paystack_client.transactions,
            "initialize",
            side_effect=Exception("API Error: Invalid email address"),
        ):
            with pytest.raises(RuntimeError, match="Payment processing failed: API Error"):
                await plugin.process_payment(
                    amount=100.00,
                    currency="NGN",
                    payment_method="card",
                    metadata={"customer_email": "invalid-email"},
                )


@pytest.mark.integration
class TestPaystackTransactionVerification:
    """Test transaction verification"""

    @pytest.mark.asyncio
    async def test_verify_payment_success(self):
        """Test successful payment verification"""
        plugin = PaystackPaymentPlugin()
        await plugin.configure(
            {
                "secret_key": "sk_test_1234567890abcdef",
                "public_key": "pk_test_1234567890abcdef",
            }
        )

        mock_response = {
            "status": True,
            "message": "Verification successful",
            "data": {
                "id": 123456,
                "domain": "test",
                "status": "success",
                "reference": "ref_1234567890",
                "amount": 10000,  # 100.00 NGN in kobo
                "currency": "NGN",
                "channel": "card",
                "paid_at": "2025-10-17T12:00:00.000Z",
                "customer": {
                    "id": 789,
                    "email": "test@example.com",
                },
            },
        }

        with patch.object(
            plugin.paystack_client.transactions, "verify", return_value=mock_response
        ):
            result = await plugin.verify_payment("ref_1234567890")

        assert result["status"] == "completed"
        assert result["payment_id"] == "pay_ref_1234567890"
        assert result["amount"] == 100.00  # Converted from kobo
        assert result["currency"] == "NGN"
        assert result["provider"] == "paystack"
        assert "transaction_id" in result

    @pytest.mark.asyncio
    async def test_verify_payment_failed(self):
        """Test verification of failed payment"""
        plugin = PaystackPaymentPlugin()
        await plugin.configure(
            {
                "secret_key": "sk_test_1234567890abcdef",
                "public_key": "pk_test_1234567890abcdef",
            }
        )

        mock_response = {
            "status": True,
            "message": "Verification successful",
            "data": {
                "id": 123456,
                "domain": "test",
                "status": "failed",
                "reference": "ref_1234567890",
                "amount": 10000,
                "currency": "NGN",
                "gateway_response": "Insufficient funds",
            },
        }

        with patch.object(
            plugin.paystack_client.transactions, "verify", return_value=mock_response
        ):
            result = await plugin.verify_payment("ref_1234567890")

        assert result["status"] == "failed"
        assert "gateway_response" in result

    @pytest.mark.asyncio
    async def test_verify_payment_not_found(self):
        """Test verification of non-existent transaction"""
        plugin = PaystackPaymentPlugin()
        await plugin.configure(
            {
                "secret_key": "sk_test_1234567890abcdef",
                "public_key": "pk_test_1234567890abcdef",
            }
        )

        with patch.object(
            plugin.paystack_client.transactions,
            "verify",
            side_effect=Exception("Transaction not found"),
        ):
            with pytest.raises(RuntimeError, match="Payment verification failed"):
                await plugin.verify_payment("invalid_ref")


@pytest.mark.integration
class TestPaystackWebhookValidation:
    """Test webhook signature validation"""

    @pytest.mark.asyncio
    async def test_validate_webhook_valid_signature(self):
        """Test webhook validation with valid signature"""
        import hashlib
        import hmac
        import json

        plugin = PaystackPaymentPlugin()
        await plugin.configure(
            {
                "secret_key": "sk_test_1234567890abcdef",
                "public_key": "pk_test_1234567890abcdef",
            }
        )

        webhook_data = {
            "event": "charge.success",
            "data": {
                "id": 123456,
                "reference": "ref_1234567890",
                "status": "success",
                "amount": 10000,
            },
        }

        # Generate valid HMAC-SHA512 signature
        payload_json = json.dumps(webhook_data, separators=(",", ":"))
        signature = hmac.new(
            b"sk_test_1234567890abcdef",
            payload_json.encode("utf-8"),
            hashlib.sha512,
        ).hexdigest()

        headers = {"X-Paystack-Signature": signature}

        result = await plugin.validate_webhook(webhook_data, headers)

        assert result is True

    @pytest.mark.asyncio
    async def test_process_webhook_charge_success(self):
        """Test processing successful charge webhook"""
        plugin = PaystackPaymentPlugin()
        await plugin.configure(
            {
                "secret_key": "sk_test_1234567890abcdef",
                "public_key": "pk_test_1234567890abcdef",
            }
        )

        webhook_data = {
            "event": "charge.success",
            "data": {
                "id": 123456,
                "reference": "ref_1234567890",
                "status": "success",
                "amount": 10000,
                "currency": "NGN",
                "customer": {"email": "test@example.com"},
                "paid_at": "2025-10-17T12:00:00.000Z",
            },
        }

        result = await plugin.process_webhook(webhook_data)

        assert result["event"] == "charge.success"
        assert result["payment_id"] == "pay_ref_1234567890"
        assert result["status"] == "completed"
        assert result["amount"] == 100.00  # Converted from kobo


@pytest.mark.integration
class TestPaystackRefunds:
    """Test refund processing"""

    @pytest.mark.asyncio
    async def test_refund_payment_success(self):
        """Test successful refund processing"""
        plugin = PaystackPaymentPlugin()
        await plugin.configure(
            {
                "secret_key": "sk_test_1234567890abcdef",
                "public_key": "pk_test_1234567890abcdef",
            }
        )

        mock_response = {
            "status": True,
            "message": "Refund has been queued for processing",
            "data": {
                "transaction": {
                    "id": 123456,
                    "reference": "ref_1234567890",
                },
                "refund": {
                    "id": 456789,
                    "transaction": 123456,
                    "amount": 10000,
                    "currency": "NGN",
                    "status": "pending",
                    "refunded_at": "2025-10-17T12:00:00.000Z",
                },
            },
        }

        with patch.object(plugin.paystack_client.refunds, "create", return_value=mock_response):
            result = await plugin.refund_payment(
                payment_id="pay_ref_1234567890",
                amount=100.00,
                reason="Customer request",
            )

        assert result["status"] == "pending"
        assert result["refund_id"] == "refund_456789"
        assert result["amount"] == 100.00
        assert result["reason"] == "Customer request"

    @pytest.mark.asyncio
    async def test_refund_payment_partial(self):
        """Test partial refund processing"""
        plugin = PaystackPaymentPlugin()
        await plugin.configure(
            {
                "secret_key": "sk_test_1234567890abcdef",
                "public_key": "pk_test_1234567890abcdef",
            }
        )

        mock_response = {
            "status": True,
            "message": "Refund has been queued for processing",
            "data": {
                "refund": {
                    "id": 456789,
                    "transaction": 123456,
                    "amount": 5000,  # Partial refund
                    "currency": "NGN",
                    "status": "pending",
                },
            },
        }

        with patch.object(plugin.paystack_client.refunds, "create", return_value=mock_response):
            result = await plugin.refund_payment(
                payment_id="pay_ref_1234567890",
                amount=50.00,  # Partial amount
                reason="Partial refund",
            )

        assert result["amount"] == 50.00

    @pytest.mark.asyncio
    async def test_refund_payment_api_error(self):
        """Test handling of refund API errors"""
        plugin = PaystackPaymentPlugin()
        await plugin.configure(
            {
                "secret_key": "sk_test_1234567890abcdef",
                "public_key": "pk_test_1234567890abcdef",
            }
        )

        with patch.object(
            plugin.paystack_client.refunds,
            "create",
            side_effect=Exception("Transaction not eligible for refund"),
        ):
            with pytest.raises(RuntimeError, match="Refund processing failed"):
                await plugin.refund_payment(
                    payment_id="pay_invalid",
                    amount=100.00,
                    reason="Test refund",
                )


@pytest.mark.integration
class TestPaystackEdgeCases:
    """Test edge cases and error handling"""

    @pytest.mark.asyncio
    async def test_payment_with_zero_amount(self):
        """Test payment initialization with zero amount"""
        plugin = PaystackPaymentPlugin()
        await plugin.configure(
            {
                "secret_key": "sk_test_1234567890abcdef",
                "public_key": "pk_test_1234567890abcdef",
            }
        )

        with pytest.raises(ValueError, match="Amount must be greater than zero"):
            await plugin.process_payment(
                amount=0.00,
                currency="NGN",
                payment_method="card",
                metadata={"customer_email": "test@example.com"},
            )

    @pytest.mark.asyncio
    async def test_payment_with_negative_amount(self):
        """Test payment initialization with negative amount"""
        plugin = PaystackPaymentPlugin()
        await plugin.configure(
            {
                "secret_key": "sk_test_1234567890abcdef",
                "public_key": "pk_test_1234567890abcdef",
            }
        )

        with pytest.raises(ValueError, match="Amount must be greater than zero"):
            await plugin.process_payment(
                amount=-100.00,
                currency="NGN",
                payment_method="card",
                metadata={"customer_email": "test@example.com"},
            )

    @pytest.mark.asyncio
    async def test_payment_with_unsupported_currency(self):
        """Test payment with unsupported currency"""
        plugin = PaystackPaymentPlugin()
        await plugin.configure(
            {
                "secret_key": "sk_test_1234567890abcdef",
                "public_key": "pk_test_1234567890abcdef",
            }
        )

        mock_initialize = MagicMock(
            return_value={
                "status": True,
                "data": {
                    "authorization_url": "https://checkout.paystack.com/abc123",
                    "reference": "ref_1234567890",
                },
            }
        )

        with patch.object(plugin.paystack_client.transactions, "initialize", mock_initialize):
            await plugin.process_payment(
                amount=100.00,
                currency="USD",  # Paystack supports USD
                payment_method="card",
                metadata={"customer_email": "test@example.com"},
            )

        # Verify currency was uppercased
        call_args = mock_initialize.call_args[1]
        assert call_args["currency"] == "USD"

    @pytest.mark.asyncio
    async def test_payment_without_customer_email(self):
        """Test payment fails without customer email"""
        plugin = PaystackPaymentPlugin()
        await plugin.configure(
            {
                "secret_key": "sk_test_1234567890abcdef",
                "public_key": "pk_test_1234567890abcdef",
            }
        )

        with pytest.raises(ValueError, match="customer_email is required"):
            await plugin.process_payment(
                amount=100.00,
                currency="NGN",
                payment_method="card",
                metadata={},  # Missing customer_email
            )
