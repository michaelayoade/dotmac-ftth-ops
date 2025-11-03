"""
Test that factories catch typos and invalid values early.
"""

import pytest

pytestmark = pytest.mark.unit


@pytest.mark.asyncio
async def test_invoice_factory_raises_on_invalid_status(async_db_session, invoice_factory):
    """Verify invoice_factory raises on typo in status."""
    with pytest.raises(ValueError, match="Invalid invoice status: 'opne'"):
        await invoice_factory(status="opne")  # Typo for "open"


@pytest.mark.asyncio
async def test_invoice_factory_raises_on_unknown_status(async_db_session, invoice_factory):
    """Verify invoice_factory raises on completely unknown status."""
    with pytest.raises(ValueError, match="Invalid invoice status: 'cancelled'"):
        await invoice_factory(status="cancelled")  # Not a valid invoice status


@pytest.mark.asyncio
async def test_invoice_factory_error_message_shows_valid_options(async_db_session, invoice_factory):
    """Verify error message lists valid status options."""
    with pytest.raises(
        ValueError, match="Valid options: draft, open, paid, void, overdue, partially_paid"
    ):
        await invoice_factory(status="invalid")
