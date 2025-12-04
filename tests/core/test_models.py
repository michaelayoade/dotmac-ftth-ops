"""Tests for core domain models."""

import pytest
from pydantic import ValidationError

from dotmac.platform.core.models import BaseModel, TenantContext


@pytest.mark.unit
class TestBaseModel:
    """Test BaseModel configuration and behavior."""

    def test_base_model_from_attributes(self):
        """Test that BaseModel supports from_attributes."""

        class TestModel(BaseModel):
            name: str
            value: int

        # Simulate ORM object with attributes
        class FakeORMObject:
            name = "test"
            value = 42

        # Should be able to create from ORM-like object
        model = TestModel.model_validate(FakeORMObject(), from_attributes=True)
        assert model.name == "test"
        assert model.value == 42

    def test_base_model_validate_assignment(self):
        """Test that BaseModel validates on assignment."""

        class TestModel(BaseModel):
            name: str
            value: int

        model = TestModel(name="test", value=42)
        assert model.name == "test"
        assert model.value == 42

        # Change value
        model.value = 100
        assert model.value == 100

        # Invalid assignment should raise error
        with pytest.raises(ValidationError):
            model.value = "not an int"

    def test_base_model_str_strip_whitespace(self):
        """Test that BaseModel strips whitespace from strings."""

        class TestModel(BaseModel):
            name: str

        model = TestModel(name="  test  ")
        assert model.name == "test"

    def test_base_model_extra_forbid(self):
        """Test that BaseModel forbids extra fields."""

        class TestModel(BaseModel):
            name: str

        # Should raise ValidationError for extra field
        with pytest.raises(ValidationError) as exc_info:
            TestModel(name="test", extra_field="not allowed")

        assert "extra_field" in str(exc_info.value).lower()


@pytest.mark.unit
class TestTenantContext:
    """Test TenantContext model."""

    def test_tenant_context_creation_minimal(self):
        """Test creating TenantContext with minimal required fields."""
        context = TenantContext(tenant_id="tenant-123")

        assert context.tenant_id == "tenant-123"
        assert context.tenant_name is None
        assert context.domain is None
        assert context.is_active is True
        assert context.metadata == {}

    def test_tenant_context_creation_full(self):
        """Test creating TenantContext with all fields."""
        context = TenantContext(
            tenant_id="tenant-123",
            tenant_name="Test Tenant",
            domain="test.example.com",
            is_active=True,
            metadata={"plan": "premium", "region": "us-west"},
        )

        assert context.tenant_id == "tenant-123"
        assert context.tenant_name == "Test Tenant"
        assert context.domain == "test.example.com"
        assert context.is_active is True
        assert context.metadata == {"plan": "premium", "region": "us-west"}

    def test_tenant_context_default_values(self):
        """Test TenantContext default values."""
        context = TenantContext(tenant_id="tenant-123")

        assert context.is_active is True
        assert context.metadata == {}
        assert isinstance(context.metadata, dict)

    def test_tenant_context_is_active_false(self):
        """Test TenantContext with is_active=False."""
        context = TenantContext(tenant_id="tenant-123", is_active=False)

        assert context.is_active is False

    def test_tenant_context_str_strip_whitespace(self):
        """Test that TenantContext strips whitespace from string fields."""
        context = TenantContext(
            tenant_id="  tenant-123  ",
            tenant_name="  Test Tenant  ",
            domain="  test.example.com  ",
        )

        assert context.tenant_id == "tenant-123"
        assert context.tenant_name == "Test Tenant"
        assert context.domain == "test.example.com"

    def test_tenant_context_extra_fields_forbidden(self):
        """Test that TenantContext forbids extra fields."""
        with pytest.raises(ValidationError) as exc_info:
            TenantContext(tenant_id="tenant-123", extra_field="not allowed")

        assert "extra_field" in str(exc_info.value).lower()

    def test_tenant_context_required_field_missing(self):
        """Test that TenantContext requires tenant_id."""
        with pytest.raises(ValidationError) as exc_info:
            TenantContext()

        assert "tenant_id" in str(exc_info.value).lower()

    def test_tenant_context_metadata_mutation(self):
        """Test that metadata can be modified after creation."""
        context = TenantContext(tenant_id="tenant-123")

        assert context.metadata == {}

        # Add metadata
        context.metadata["key"] = "value"
        assert context.metadata == {"key": "value"}

    def test_tenant_context_validate_assignment(self):
        """Test that TenantContext validates on assignment."""
        context = TenantContext(tenant_id="tenant-123", is_active=True)

        # Valid assignment
        context.is_active = False
        assert context.is_active is False

        # Invalid assignment should raise error
        with pytest.raises(ValidationError):
            context.is_active = "not a bool"


@pytest.mark.unit
class TestTenantContextCreateDefault:
    """Test TenantContext.create_default() class method."""

    def test_create_default_returns_tenant_context(self):
        """Test that create_default returns a TenantContext instance."""
        context = TenantContext.create_default()

        assert isinstance(context, TenantContext)

    def test_create_default_sets_required_fields(self):
        """Test that create_default sets all required fields."""
        context = TenantContext.create_default()

        assert context.tenant_id is not None
        assert context.tenant_id != ""
        assert context.tenant_name == "Test Tenant"
        assert context.domain == "test.example.com"
        assert context.is_active is True

    def test_create_default_generates_unique_ids(self):
        """Test that create_default generates unique tenant IDs."""
        context1 = TenantContext.create_default()
        context2 = TenantContext.create_default()

        assert context1.tenant_id != context2.tenant_id

    def test_create_default_tenant_id_format(self):
        """Test that create_default generates valid UUID tenant IDs."""
        context = TenantContext.create_default()

        # Check that tenant_id is a valid UUID string
        import uuid

        try:
            uuid.UUID(context.tenant_id)
        except ValueError:
            pytest.fail("tenant_id is not a valid UUID")

    def test_create_default_immutable_values(self):
        """Test that create_default returns consistent non-UUID values."""
        context1 = TenantContext.create_default()
        context2 = TenantContext.create_default()

        # These should be the same across instances
        assert context1.tenant_name == context2.tenant_name
        assert context1.domain == context2.domain
        assert context1.is_active == context2.is_active


@pytest.mark.unit
class TestModelInteraction:
    """Test interactions between BaseModel and TenantContext."""

    def test_tenant_context_inherits_base_model_config(self):
        """Test that TenantContext inherits BaseModel configuration."""
        context = TenantContext(tenant_id="  tenant-123  ")

        # Should strip whitespace (from BaseModel config)
        assert context.tenant_id == "tenant-123"

        # Should forbid extra fields (from BaseModel config)
        with pytest.raises(ValidationError):
            TenantContext(tenant_id="tenant-123", extra="not allowed")

    def test_tenant_context_model_dump(self):
        """Test that TenantContext can be serialized."""
        context = TenantContext(
            tenant_id="tenant-123",
            tenant_name="Test Tenant",
            domain="test.example.com",
            metadata={"key": "value"},
        )

        dumped = context.model_dump()

        assert dumped["tenant_id"] == "tenant-123"
        assert dumped["tenant_name"] == "Test Tenant"
        assert dumped["domain"] == "test.example.com"
        assert dumped["is_active"] is True
        assert dumped["metadata"] == {"key": "value"}

    def test_tenant_context_model_dump_json(self):
        """Test that TenantContext can be serialized to JSON."""
        context = TenantContext(
            tenant_id="tenant-123", tenant_name="Test Tenant", metadata={"key": "value"}
        )

        json_str = context.model_dump_json()

        assert isinstance(json_str, str)
        assert "tenant-123" in json_str
        assert "Test Tenant" in json_str

    def test_tenant_context_model_validate(self):
        """Test that TenantContext can be validated from dict."""
        data = {
            "tenant_id": "tenant-123",
            "tenant_name": "Test Tenant",
            "domain": "test.example.com",
        }

        context = TenantContext.model_validate(data)

        assert context.tenant_id == "tenant-123"
        assert context.tenant_name == "Test Tenant"
        assert context.domain == "test.example.com"
