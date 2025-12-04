"""
Tests for payment service private helper methods.
"""

import pytest

from dotmac.platform.billing.core.entities import TransactionEntity
from dotmac.platform.billing.core.enums import TransactionType
from tests.billing.payments.conftest import setup_mock_db_result

pytestmark = pytest.mark.asyncio


@pytest.mark.unit
class TestPrivateHelperMethods:
    """Test private helper methods"""

    async def test_get_payment_entity(
        self, payment_service, mock_payment_db_session, sample_payment_entity
    ):
        """Test _get_payment_entity helper"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_entity)

        # Execute
        result = await payment_service._get_payment_entity("test-tenant", "payment_123")

        # Verify
        assert result == sample_payment_entity

    async def test_get_payment_by_idempotency_key(
        self, payment_service, mock_payment_db_session, sample_payment_entity
    ):
        """Test _get_payment_by_idempotency_key helper"""
        # Setup
        sample_payment_entity.idempotency_key = "idempotent_123"
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_entity)

        # Execute
        result = await payment_service._get_payment_by_idempotency_key(
            "test-tenant", "idempotent_123"
        )

        # Verify
        assert result == sample_payment_entity

    async def test_count_payment_methods(
        self, payment_service, mock_payment_db_session, sample_payment_method_entity
    ):
        """Test _count_payment_methods helper"""
        # Setup
        mock_payment_db_session.execute.return_value.scalars.return_value.all.return_value = [
            sample_payment_method_entity,
            sample_payment_method_entity,
        ]

        # Execute
        result = await payment_service._count_payment_methods("test-tenant", "customer_456")

        # Verify
        assert result == 2

    async def test_clear_default_payment_methods(
        self, payment_service, mock_payment_db_session, sample_payment_method_entity
    ):
        """Test _clear_default_payment_methods helper"""
        # Setup
        sample_payment_method_entity.is_default = True
        mock_payment_db_session.execute.return_value.scalars.return_value.all.return_value = [
            sample_payment_method_entity
        ]

        # Execute
        await payment_service._clear_default_payment_methods("test-tenant", "customer_456")

        # Verify
        assert sample_payment_method_entity.is_default is False
        mock_payment_db_session.commit.assert_called()

    async def test_create_transaction(
        self, payment_service, mock_payment_db_session, sample_payment_entity
    ):
        """Test _create_transaction helper"""
        # Execute
        await payment_service._create_transaction(sample_payment_entity, TransactionType.PAYMENT)

        # Verify
        mock_payment_db_session.add.assert_called_once()
        add_call = mock_payment_db_session.add.call_args[0][0]
        assert isinstance(add_call, TransactionEntity)
        assert add_call.amount == 1000
        assert add_call.transaction_type == TransactionType.PAYMENT

    async def test_link_payment_to_invoices(
        self, payment_service, mock_payment_db_session, sample_payment_entity
    ):
        """Test _link_payment_to_invoices helper"""
        # Setup
        invoice_ids = ["invoice_001", "invoice_002", "invoice_003"]

        # Execute
        await payment_service._link_payment_to_invoices(sample_payment_entity, invoice_ids)

        # Verify
        assert mock_payment_db_session.add.call_count == 3
        mock_payment_db_session.commit.assert_called_once()
