"""Tests for core module."""

from uuid import UUID

import pytest

from dotmac.platform.core import (  # Exceptions; Models
    AuthorizationError,
    BaseModel,
    BusinessRuleError,
    ConfigurationError,
    DotMacError,
    DuplicateEntityError,
    EntityNotFoundError,
    RepositoryError,
    TenantContext,
    ValidationError,
)


@pytest.mark.unit
class TestCoreExceptions:
    """Test core exception classes."""

    def test_dotmac_error_base(self):
        """Test base DotMacError exception."""
        error = DotMacError("Test error")
        assert str(error) == "Test error"
        assert isinstance(error, Exception)

    def test_validation_error(self):
        """Test ValidationError inherits from DotMacError."""
        error = ValidationError("Invalid input")
        assert str(error) == "Invalid input"
        assert isinstance(error, DotMacError)
        assert isinstance(error, Exception)

    def test_authorization_error(self):
        """Test AuthorizationError."""
        error = AuthorizationError("Access denied")
        assert str(error) == "Access denied"
        assert isinstance(error, DotMacError)

    def test_configuration_error(self):
        """Test ConfigurationError."""
        error = ConfigurationError("Config invalid")
        assert str(error) == "Config invalid"
        assert isinstance(error, DotMacError)

    def test_business_rule_error(self):
        """Test BusinessRuleError."""
        error = BusinessRuleError("Business rule violated")
        assert str(error) == "Business rule violated"
        assert isinstance(error, DotMacError)

    def test_repository_error(self):
        """Test RepositoryError."""
        error = RepositoryError("Database error")
        assert str(error) == "Database error"
        assert isinstance(error, DotMacError)

    def test_entity_not_found_error(self):
        """Test EntityNotFoundError inherits from RepositoryError."""
        error = EntityNotFoundError("User not found")
        assert str(error) == "User not found"
        assert isinstance(error, RepositoryError)
        assert isinstance(error, DotMacError)

    def test_duplicate_entity_error(self):
        """Test DuplicateEntityError inherits from RepositoryError."""
        error = DuplicateEntityError("User already exists")
        assert str(error) == "User already exists"
        assert isinstance(error, RepositoryError)
        assert isinstance(error, DotMacError)

    def test_exception_raising(self):
        """Test that exceptions can be raised and caught properly."""
        with pytest.raises(ValidationError, match="Invalid data"):
            raise ValidationError("Invalid data")

        with pytest.raises(DotMacError):
            raise AuthorizationError("No access")

    def test_exception_chaining(self):
        """Test exception chaining."""
        try:
            try:
                raise ValueError("Original error")
            except ValueError as e:
                raise ValidationError("Validation failed") from e
        except ValidationError as e:
            assert str(e) == "Validation failed"
            assert isinstance(e.__cause__, ValueError)
            assert str(e.__cause__) == "Original error"


@pytest.mark.unit
class TestBaseModel:
    """Test BaseModel class."""

    def test_base_model_creation(self):
        """Test creating a BaseModel instance."""

        @pytest.mark.unit
        class TestModel(BaseModel):
            name: str
            value: int

        model = TestModel(name="test", value=42)
        assert model.name == "test"
        assert model.value == 42

    def test_base_model_from_attributes(self):
        """Test BaseModel with from_attributes config."""

        @pytest.mark.unit
        class TestModel(BaseModel):
            name: str
            value: int

        class DataClass:
            def __init__(self):
                self.name = "from_attr"
                self.value = 100

        data = DataClass()
        model = TestModel.model_validate(data, from_attributes=True)
        assert model.name == "from_attr"
        assert model.value == 100

    def test_base_model_validate_assignment(self):
        """Test BaseModel with validate_assignment config."""

        @pytest.mark.unit
        class TestModel(BaseModel):
            name: str
            value: int

        model = TestModel(name="test", value=42)

        # Assignment should trigger validation
        with pytest.raises((ValueError, TypeError)):  # Pydantic will raise validation error
            model.value = "not an int"

    def test_base_model_dict_export(self):
        """Test exporting BaseModel to dict."""

        @pytest.mark.unit
        class TestModel(BaseModel):
            name: str
            value: int

        model = TestModel(name="test", value=42)
        data = model.model_dump()
        assert data == {"name": "test", "value": 42}

    def test_base_model_json_export(self):
        """Test exporting BaseModel to JSON."""

        @pytest.mark.unit
        class TestModel(BaseModel):
            name: str
            value: int

        model = TestModel(name="test", value=42)
        json_str = model.model_dump_json()
        assert '"name":"test"' in json_str
        assert '"value":42' in json_str


@pytest.mark.unit
class TestTenantContext:
    """Test TenantContext model."""

    def test_tenant_context_creation(self):
        """Test creating TenantContext with required fields."""
        context = TenantContext(
            tenant_id="tenant-123",
            tenant_name="Test Tenant",
            domain="test.example.com",
            is_active=True,
            metadata={"key": "value"},
        )
        assert context.tenant_id == "tenant-123"
        assert context.tenant_name == "Test Tenant"
        assert context.domain == "test.example.com"
        assert context.is_active is True
        assert context.metadata == {"key": "value"}

    def test_tenant_context_minimal(self):
        """Test creating TenantContext with only required field."""
        context = TenantContext(tenant_id="tenant-456")
        assert context.tenant_id == "tenant-456"
        assert context.tenant_name is None
        assert context.domain is None
        assert context.is_active is True  # Default value
        assert context.metadata == {}  # Default empty dict

    def test_tenant_context_defaults(self):
        """Test TenantContext default values."""
        context = TenantContext(tenant_id="tenant-789", tenant_name="Test")
        assert context.is_active is True
        assert context.metadata == {}

    def test_tenant_context_create_default(self):
        """Test create_default class method."""
        context = TenantContext.create_default()

        # Check it has a valid UUID
        uuid_obj = UUID(context.tenant_id)
        assert uuid_obj.version == 4

        # Check other defaults
        assert context.tenant_name == "Test Tenant"
        assert context.domain == "test.example.com"
        assert context.is_active is True
        assert context.metadata == {}

    def test_tenant_context_different_defaults(self):
        """Test that create_default creates different IDs."""
        context1 = TenantContext.create_default()
        context2 = TenantContext.create_default()

        assert context1.tenant_id != context2.tenant_id
        assert context1.tenant_name == context2.tenant_name

    def test_tenant_context_to_dict(self):
        """Test converting TenantContext to dictionary."""
        context = TenantContext(
            tenant_id="tenant-123",
            tenant_name="Test Tenant",
            domain="test.example.com",
            is_active=False,
            metadata={"env": "test"},
        )

        data = context.model_dump()
        assert data == {
            "tenant_id": "tenant-123",
            "tenant_name": "Test Tenant",
            "domain": "test.example.com",
            "is_active": False,
            "metadata": {"env": "test"},
        }

    def test_tenant_context_from_dict(self):
        """Test creating TenantContext from dictionary."""
        data = {
            "tenant_id": "tenant-999",
            "tenant_name": "Dict Tenant",
            "domain": "dict.example.com",
            "is_active": True,
            "metadata": {"source": "dict"},
        }

        context = TenantContext(**data)
        assert context.tenant_id == "tenant-999"
        assert context.tenant_name == "Dict Tenant"
        assert context.metadata == {"source": "dict"}

    def test_tenant_context_metadata_types(self):
        """Test metadata accepts various types."""
        context = TenantContext(
            tenant_id="test-meta",
            metadata={
                "string": "value",
                "number": 42,
                "bool": True,
                "list": [1, 2, 3],
                "nested": {"key": "value"},
            },
        )

        assert context.metadata["string"] == "value"
        assert context.metadata["number"] == 42
        assert context.metadata["bool"] is True
        assert context.metadata["list"] == [1, 2, 3]
        assert context.metadata["nested"] == {"key": "value"}

    def test_tenant_context_validation(self):
        """Test TenantContext field validation."""
        from pydantic import ValidationError

        # tenant_id is required
        with pytest.raises(ValidationError):
            TenantContext()

        # tenant_id must be a string
        with pytest.raises(ValidationError):
            TenantContext(tenant_id=123)

        # Pydantic will coerce string "yes" to bool, so test with invalid type
        with pytest.raises(ValidationError):
            TenantContext(tenant_id="test", metadata="not a dict")


@pytest.mark.unit
class TestCoreIntegration:
    """Test integration between core components."""

    def test_model_with_exception_handling(self):
        """Test using models with exception handling."""

        class UserModel(BaseModel):
            id: str
            name: str
            tenant_id: str

        def create_user(data: dict) -> UserModel:
            if not data.get("name"):
                raise ValidationError("Name is required")

            if data.get("id") == "duplicate":
                raise DuplicateEntityError("User already exists")

            return UserModel(**data)

        # Test successful creation
        user = create_user({"id": "user-1", "name": "Test", "tenant_id": "tenant-1"})
        assert user.name == "Test"

        # Test validation error
        with pytest.raises(ValidationError, match="Name is required"):
            create_user({"id": "user-2", "tenant_id": "tenant-1"})

        # Test duplicate error
        with pytest.raises(DuplicateEntityError, match="User already exists"):
            create_user({"id": "duplicate", "name": "Test", "tenant_id": "tenant-1"})

    def test_tenant_context_with_models(self):
        """Test using TenantContext with other models."""

        class ResourceModel(BaseModel):
            id: str
            name: str
            tenant_context: TenantContext

        context = TenantContext(tenant_id="tenant-abc")
        resource = ResourceModel(id="resource-1", name="Test Resource", tenant_context=context)

        assert resource.tenant_context.tenant_id == "tenant-abc"
        assert resource.tenant_context.is_active is True
