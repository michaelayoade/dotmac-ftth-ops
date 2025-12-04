"""
Tests for customer management Pydantic schemas.

Tests schema validation, serialization, and all Pydantic features.
"""

from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError

from dotmac.platform.customer_management.models import (
    ActivityType,
    CommunicationChannel,
    CustomerStatus,
    CustomerTier,
    CustomerType,
)
from dotmac.platform.customer_management.schemas import (
    CustomerActivityCreate,
    CustomerActivityResponse,
    CustomerBase,
    CustomerCreate,
    CustomerListResponse,
    CustomerMetrics,
    CustomerNoteCreate,
    CustomerNoteResponse,
    CustomerResponse,
    CustomerSearchParams,
    CustomerSegmentCreate,
    CustomerSegmentResponse,
    CustomerUpdate,
)


@pytest.mark.unit
class TestCustomerBaseSchema:
    """Test base customer schema."""

    def test_customer_base_valid_data(self):
        """Test CustomerBase with valid data."""
        data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
            "phone": "+1234567890",
            "customer_type": CustomerType.INDIVIDUAL,
            "tier": CustomerTier.BASIC,
        }

        schema = CustomerBase(**data)

        assert schema.first_name == "John"
        assert schema.last_name == "Doe"
        assert schema.email == "john.doe@example.com"
        assert schema.customer_type == CustomerType.INDIVIDUAL
        assert schema.tier == CustomerTier.BASIC

    def test_customer_base_email_validation(self):
        """Test email field validation."""
        # Valid email
        data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
        }
        schema = CustomerBase(**data)
        assert schema.email == "john.doe@example.com"

        # Invalid email
        with pytest.raises(ValidationError) as exc_info:
            CustomerBase(
                first_name="John",
                last_name="Doe",
                email="invalid-email",
            )

        errors = exc_info.value.errors()
        assert any(error["loc"] == ("email",) for error in errors)

    def test_customer_base_string_trimming(self):
        """Test string field trimming."""
        data = {
            "first_name": "  John  ",
            "last_name": "  Doe  ",
            "email": "john.doe@example.com",
        }

        schema = CustomerBase(**data)

        assert schema.first_name == "John"
        assert schema.last_name == "Doe"

    def test_customer_base_required_fields(self):
        """Test required field validation."""
        # Missing required fields
        with pytest.raises(ValidationError) as exc_info:
            CustomerBase()

        errors = exc_info.value.errors()
        required_fields = {"first_name", "last_name", "email"}
        error_fields = {error["loc"][0] for error in errors if error["type"] == "missing"}

        assert required_fields.issubset(error_fields)

    def test_customer_base_field_length_validation(self):
        """Test field length constraints."""
        # Too long first name
        with pytest.raises(ValidationError) as exc_info:
            CustomerBase(
                first_name="a" * 101,  # Max length is 100
                last_name="Doe",
                email="john.doe@example.com",
            )

        errors = exc_info.value.errors()
        assert any(
            error["loc"] == ("first_name",) and "at most 100 characters" in str(error["msg"])
            for error in errors
        )

        # Empty first name
        with pytest.raises(ValidationError) as exc_info:
            CustomerBase(
                first_name="",
                last_name="Doe",
                email="john.doe@example.com",
            )

        errors = exc_info.value.errors()
        assert any(
            error["loc"] == ("first_name",) and "at least 1 character" in str(error["msg"])
            for error in errors
        )


@pytest.mark.unit
class TestCustomerCreateSchema:
    """Test customer creation schema."""

    def test_customer_create_minimal_data(self):
        """Test CustomerCreate with minimal required data."""
        data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
        }

        schema = CustomerCreate(**data)

        assert schema.first_name == "John"
        assert schema.last_name == "Doe"
        assert schema.email == "john.doe@example.com"
        assert schema.customer_type == CustomerType.INDIVIDUAL  # Default
        assert schema.tier == CustomerTier.FREE  # Default

    def test_customer_create_full_data(self):
        """Test CustomerCreate with full data."""
        data = {
            "first_name": "John",
            "last_name": "Doe",
            "middle_name": "Michael",
            "display_name": "Johnny",
            "company_name": "Acme Corp",
            "email": "john.doe@example.com",
            "phone": "+1234567890",
            "mobile": "+0987654321",
            "customer_type": CustomerType.BUSINESS,
            "tier": CustomerTier.PREMIUM,
            "address_line1": "123 Main St",
            "address_line2": "Suite 100",
            "city": "Anytown",
            "state_province": "CA",
            "postal_code": "12345",
            "country": "US",
            "preferred_channel": CommunicationChannel.EMAIL,
            "preferred_language": "en",
            "timezone": "America/Los_Angeles",
            "opt_in_marketing": True,
            "opt_in_updates": False,
            "tags": ["vip", "priority"],
            "metadata": {"source": "web", "campaign": "summer2024"},
            "custom_fields": {"referred_by": "friend", "notes": "Important customer"},
        }

        schema = CustomerCreate(**data)

        assert schema.first_name == "John"
        assert schema.middle_name == "Michael"
        assert schema.company_name == "Acme Corp"
        assert schema.customer_type == CustomerType.BUSINESS
        assert schema.tier == CustomerTier.PREMIUM
        assert schema.country == "US"
        assert schema.preferred_channel == CommunicationChannel.EMAIL
        assert schema.tags == ["vip", "priority"]
        assert schema.metadata["source"] == "web"
        assert schema.custom_fields["referred_by"] == "friend"

    def test_customer_create_enum_validation(self):
        """Test enum field validation."""
        # Valid enums
        data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
            "customer_type": "business",  # String that converts to enum
            "tier": "premium",
            "preferred_channel": "sms",
        }

        schema = CustomerCreate(**data)
        assert schema.customer_type == CustomerType.BUSINESS
        assert schema.tier == CustomerTier.PREMIUM
        assert schema.preferred_channel == CommunicationChannel.SMS

        # Invalid enum
        with pytest.raises(ValidationError) as exc_info:
            CustomerCreate(
                first_name="John",
                last_name="Doe",
                email="john.doe@example.com",
                customer_type="invalid_type",
            )

        errors = exc_info.value.errors()
        assert any(error["loc"] == ("customer_type",) for error in errors)

    def test_customer_create_country_code_validation(self):
        """Test country code validation (should be 2 characters)."""
        # Valid country code
        data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
            "country": "US",
        }

        schema = CustomerCreate(**data)
        assert schema.country == "US"

        # Invalid country code (too long)
        with pytest.raises(ValidationError) as exc_info:
            CustomerCreate(
                first_name="John",
                last_name="Doe",
                email="john.doe@example.com",
                country="USA",  # Should be 2 characters
            )

        errors = exc_info.value.errors()
        assert any(error["loc"] == ("country",) for error in errors)


@pytest.mark.unit
class TestCustomerUpdateSchema:
    """Test customer update schema."""

    def test_customer_update_partial_data(self):
        """Test CustomerUpdate allows partial updates."""
        # Should work with just one field
        schema = CustomerUpdate(first_name="Jane")
        assert schema.first_name == "Jane"
        assert schema.last_name is None

        # Should work with multiple fields
        schema2 = CustomerUpdate(
            first_name="Jane",
            tier=CustomerTier.PREMIUM,
            opt_in_marketing=True,
        )
        assert schema2.first_name == "Jane"
        assert schema2.tier == CustomerTier.PREMIUM
        assert schema2.opt_in_marketing is True

    def test_customer_update_empty_data(self):
        """Test CustomerUpdate with no data."""
        # Should be valid (empty update)
        schema = CustomerUpdate()
        assert schema.first_name is None
        assert schema.email is None


@pytest.mark.unit
class TestCustomerResponseSchema:
    """Test customer response schema."""

    def test_customer_response_from_model(self):
        """Test CustomerResponse creation from model data."""
        # Simulate model data with all required fields
        now = datetime.now(UTC)
        model_data = {
            "id": uuid4(),
            "customer_number": "CUST001",
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
            "customer_type": CustomerType.INDIVIDUAL,
            "tier": CustomerTier.BASIC,
            "status": CustomerStatus.ACTIVE,
            # Required verification fields
            "email_verified": True,
            "phone_verified": False,
            # Required metrics
            "lifetime_value": Decimal("500.00"),
            "total_purchases": 5,
            "average_order_value": Decimal("100.00"),
            # Required scoring
            "risk_score": 10,
            # Required dates
            "acquisition_date": now,
            "created_at": now,
            "updated_at": now,
            # Optional but included
            "tags": ["customer", "active"],
            "metadata": {"source": "web"},
            "custom_fields": {"notes": "Good customer"},
        }

        schema = CustomerResponse.model_validate(model_data)

        assert str(schema.id) == str(model_data["id"])
        assert schema.customer_number == "CUST001"
        assert schema.first_name == "John"
        assert schema.customer_type == CustomerType.INDIVIDUAL
        assert schema.lifetime_value == Decimal("500.00")
        assert schema.tags == ["customer", "active"]


@pytest.mark.unit
class TestCustomerSearchParamsSchema:
    """Test customer search parameters schema."""

    def test_search_params_minimal(self):
        """Test search params with minimal data."""
        schema = CustomerSearchParams()

        assert schema.page == 1  # Default
        assert schema.page_size == 20  # Default
        assert schema.query is None
        assert schema.status is None

    def test_search_params_full(self):
        """Test search params with all fields."""
        data = {
            "query": "john doe",
            "status": CustomerStatus.ACTIVE,
            "customer_type": CustomerType.BUSINESS,
            "tier": CustomerTier.PREMIUM,
            "country": "US",
            "tags": ["vip", "priority"],
            "page": 2,
            "page_size": 25,
        }

        schema = CustomerSearchParams(**data)

        assert schema.query == "john doe"
        assert schema.status == CustomerStatus.ACTIVE
        assert schema.customer_type == CustomerType.BUSINESS
        assert schema.tier == CustomerTier.PREMIUM
        assert schema.country == "US"
        assert schema.tags == ["vip", "priority"]
        assert schema.page == 2
        assert schema.page_size == 25

    def test_search_params_validation(self):
        """Test search params validation."""
        # Invalid page (must be >= 1)
        with pytest.raises(ValidationError) as exc_info:
            CustomerSearchParams(page=0)

        errors = exc_info.value.errors()
        assert any(error["loc"] == ("page",) for error in errors)

        # Invalid page_size (must be 1-200)
        with pytest.raises(ValidationError) as exc_info:
            CustomerSearchParams(page_size=300)

        errors = exc_info.value.errors()
        assert any(error["loc"] == ("page_size",) for error in errors)


@pytest.mark.unit
class TestCustomerActivitySchemas:
    """Test customer activity schemas."""

    def test_customer_activity_create(self):
        """Test CustomerActivityCreate schema."""
        data = {
            "activity_type": ActivityType.CONTACT_MADE,
            "title": "Phone call made",
            "description": "Follow-up call with customer",
            "metadata": {"duration": 300, "outcome": "positive"},
        }

        schema = CustomerActivityCreate(**data)

        assert schema.activity_type == ActivityType.CONTACT_MADE
        assert schema.title == "Phone call made"
        assert schema.description == "Follow-up call with customer"
        assert schema.metadata["duration"] == 300

    def test_customer_activity_create_minimal(self):
        """Test CustomerActivityCreate with minimal data."""
        data = {
            "activity_type": ActivityType.UPDATED,
            "title": "Customer updated",
        }

        schema = CustomerActivityCreate(**data)

        assert schema.activity_type == ActivityType.UPDATED
        assert schema.title == "Customer updated"
        assert schema.description is None
        assert schema.metadata == {}  # Default

    def test_customer_activity_response(self):
        """Test CustomerActivityResponse schema."""
        model_data = {
            "id": uuid4(),
            "customer_id": uuid4(),
            "activity_type": ActivityType.PURCHASE,
            "title": "Purchase made",
            "description": "Customer made a purchase",
            "metadata": {"amount": 100.50},
            "performed_by": uuid4(),
            "created_at": datetime.now(UTC),
        }

        schema = CustomerActivityResponse.model_validate(model_data)

        assert str(schema.id) == str(model_data["id"])
        assert str(schema.customer_id) == str(model_data["customer_id"])
        assert schema.activity_type == ActivityType.PURCHASE
        assert schema.title == "Purchase made"
        assert schema.metadata["amount"] == 100.50


@pytest.mark.unit
class TestCustomerNoteSchemas:
    """Test customer note schemas."""

    def test_customer_note_create(self):
        """Test CustomerNoteCreate schema."""
        data = {
            "subject": "Follow-up needed",
            "content": "Customer requested information about premium features",
            "is_internal": True,
        }

        schema = CustomerNoteCreate(**data)

        assert schema.subject == "Follow-up needed"
        assert schema.content.startswith("Customer requested")
        assert schema.is_internal is True

    def test_customer_note_create_defaults(self):
        """Test CustomerNoteCreate default values."""
        data = {
            "subject": "Test note",
            "content": "Test content",
        }

        schema = CustomerNoteCreate(**data)

        assert schema.is_internal is True  # Default

    def test_customer_note_response(self):
        """Test CustomerNoteResponse schema."""
        model_data = {
            "id": uuid4(),
            "customer_id": uuid4(),
            "subject": "Important note",
            "content": "This is an important note about the customer",
            "is_internal": False,
            "created_by_id": uuid4(),
            "created_at": datetime.now(UTC),
            "updated_at": datetime.now(UTC),
        }

        schema = CustomerNoteResponse.model_validate(model_data)

        assert str(schema.id) == str(model_data["id"])
        assert str(schema.customer_id) == str(model_data["customer_id"])
        assert schema.subject == "Important note"
        assert schema.is_internal is False


@pytest.mark.unit
class TestCustomerSegmentSchemas:
    """Test customer segment schemas."""

    def test_customer_segment_create(self):
        """Test CustomerSegmentCreate schema."""
        data = {
            "name": "High Value Customers",
            "description": "Customers with high lifetime value",
            "criteria": {"min_ltv": 1000, "tier": "premium"},
            "is_dynamic": True,
        }

        schema = CustomerSegmentCreate(**data)

        assert schema.name == "High Value Customers"
        assert schema.description == "Customers with high lifetime value"
        assert schema.criteria["min_ltv"] == 1000
        assert schema.is_dynamic is True

    def test_customer_segment_create_defaults(self):
        """Test CustomerSegmentCreate default values."""
        data = {
            "name": "Test Segment",
        }

        schema = CustomerSegmentCreate(**data)

        assert schema.name == "Test Segment"
        assert schema.description is None
        assert schema.criteria == {}  # Default
        assert schema.is_dynamic is False  # Default

    def test_customer_segment_response(self):
        """Test CustomerSegmentResponse schema."""
        model_data = {
            "id": uuid4(),
            "name": "VIP Customers",
            "description": "Very important customers",
            "criteria": {"tier": "premium"},
            "is_dynamic": True,
            "member_count": 25,
            "priority": 1,
            "created_at": datetime.now(UTC),
            "updated_at": datetime.now(UTC),
        }

        schema = CustomerSegmentResponse.model_validate(model_data)

        assert str(schema.id) == str(model_data["id"])
        assert schema.name == "VIP Customers"
        assert schema.is_dynamic is True
        assert schema.member_count == 25


@pytest.mark.unit
class TestCustomerListResponseSchema:
    """Test customer list response schema."""

    def test_customer_list_response(self):
        """Test CustomerListResponse schema."""
        now = datetime.now(UTC)
        customers_data = [
            {
                "id": uuid4(),
                "customer_number": "CUST001",
                "first_name": "John",
                "last_name": "Doe",
                "email": "john.doe@example.com",
                "customer_type": CustomerType.INDIVIDUAL,
                "tier": CustomerTier.BASIC,
                "status": CustomerStatus.ACTIVE,
                # Required verification fields
                "email_verified": True,
                "phone_verified": False,
                # Required metrics
                "lifetime_value": Decimal("100.00"),
                "total_purchases": 2,
                "average_order_value": Decimal("50.00"),
                # Required scoring
                "risk_score": 10,
                # Required dates
                "acquisition_date": now,
                "created_at": now,
                "updated_at": now,
                # Optional collections
                "tags": [],
                "metadata": {},
                "custom_fields": {},
            }
        ]

        data = {
            "customers": customers_data,
            "total": 1,
            "page": 1,
            "page_size": 20,
            "has_next": False,
            "has_prev": False,
        }

        schema = CustomerListResponse(**data)

        assert len(schema.customers) == 1
        assert schema.total == 1
        assert schema.page == 1
        assert schema.has_next is False
        assert schema.has_prev is False


@pytest.mark.unit
class TestCustomerMetricsSchema:
    """Test customer metrics schema."""

    def test_customer_metrics(self):
        """Test CustomerMetrics schema."""
        data = {
            "total_customers": 1000,
            "active_customers": 850,
            "new_customers_this_month": 50,
            "churn_rate": 5.5,
            "average_lifetime_value": 750.25,
            "total_revenue": 500000.00,
            "customers_by_status": {
                "active": 850,
                "inactive": 100,
                "churned": 50,
            },
            "customers_by_tier": {
                "free": 400,
                "basic": 300,
                "premium": 200,
                "enterprise": 100,
            },
            "customers_by_type": {
                "individual": 700,
                "business": 250,
                "enterprise": 50,
            },
            "top_segments": [
                {"name": "High Value", "count": 100},
                {"name": "Active Users", "count": 500},
            ],
        }

        schema = CustomerMetrics(**data)

        assert schema.total_customers == 1000
        assert schema.active_customers == 850
        assert schema.churn_rate == 5.5
        assert schema.customers_by_status["active"] == 850
        assert schema.customers_by_tier["premium"] == 200
        assert len(schema.top_segments) == 2


@pytest.mark.unit
class TestSchemaEdgeCases:
    """Test edge cases and error conditions."""

    def test_extra_fields_forbidden(self):
        """Test that extra fields are forbidden."""
        with pytest.raises(ValidationError) as exc_info:
            CustomerCreate(
                first_name="John",
                last_name="Doe",
                email="john.doe@example.com",
                extra_field="not allowed",  # This should be rejected
            )

        errors = exc_info.value.errors()
        assert any("extra_forbidden" in str(error["type"]) for error in errors)

    def test_none_handling(self):
        """Test handling of None values."""
        # Optional fields should accept None
        data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
            "phone": None,  # Optional field
            "middle_name": None,  # Optional field
        }

        schema = CustomerCreate(**data)

        assert schema.phone is None
        assert schema.middle_name is None

    def test_type_coercion(self):
        """Test automatic type coercion."""
        # String enum should be converted
        data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
            "customer_type": "individual",  # String should convert to enum
            "tier": "basic",  # String should convert to enum
        }

        schema = CustomerCreate(**data)

        assert schema.customer_type == CustomerType.INDIVIDUAL
        assert schema.tier == CustomerTier.BASIC
