"""Tests for core domain exceptions."""

import pytest

from dotmac.platform.core.exceptions import (
    AuthorizationError,
    BusinessRuleError,
    ConfigurationError,
    DotMacError,
    DuplicateEntityError,
    EntityNotFoundError,
    RepositoryError,
    ValidationError,
)


@pytest.mark.unit
class TestDotMacError:
    """Test base DotMacError exception."""

    def test_dotmac_error_creation(self):
        """Test creating a DotMacError."""
        error = DotMacError("Test error message")
        assert str(error) == "Test error message"
        assert isinstance(error, Exception)

    def test_dotmac_error_inheritance(self):
        """Test that DotMacError is an Exception."""
        error = DotMacError("Test")
        assert isinstance(error, Exception)

    def test_dotmac_error_raise_and_catch(self):
        """Test raising and catching DotMacError."""
        with pytest.raises(DotMacError) as exc_info:
            raise DotMacError("Test error")
        assert str(exc_info.value) == "Test error"


@pytest.mark.unit
class TestValidationError:
    """Test ValidationError exception."""

    def test_validation_error_creation(self):
        """Test creating a ValidationError."""
        error = ValidationError("Invalid data")
        assert str(error) == "Invalid data"
        assert isinstance(error, DotMacError)
        assert isinstance(error, Exception)

    def test_validation_error_raise_and_catch(self):
        """Test raising and catching ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            raise ValidationError("Field 'name' is required")
        assert "Field 'name' is required" in str(exc_info.value)

    def test_validation_error_caught_as_dotmac_error(self):
        """Test that ValidationError can be caught as DotMacError."""
        with pytest.raises(DotMacError):
            raise ValidationError("Test")


@pytest.mark.unit
class TestAuthorizationError:
    """Test AuthorizationError exception."""

    def test_authorization_error_creation(self):
        """Test creating an AuthorizationError."""
        error = AuthorizationError("Access denied")
        assert str(error) == "Access denied"
        assert isinstance(error, DotMacError)

    def test_authorization_error_raise_and_catch(self):
        """Test raising and catching AuthorizationError."""
        with pytest.raises(AuthorizationError) as exc_info:
            raise AuthorizationError("Insufficient permissions")
        assert "Insufficient permissions" in str(exc_info.value)


@pytest.mark.unit
class TestConfigurationError:
    """Test ConfigurationError exception."""

    def test_configuration_error_creation(self):
        """Test creating a ConfigurationError."""
        error = ConfigurationError("Invalid config")
        assert str(error) == "Invalid config"
        assert isinstance(error, DotMacError)

    def test_configuration_error_raise_and_catch(self):
        """Test raising and catching ConfigurationError."""
        with pytest.raises(ConfigurationError) as exc_info:
            raise ConfigurationError("Missing required setting: DATABASE_URL")
        assert "Missing required setting" in str(exc_info.value)


@pytest.mark.unit
class TestBusinessRuleError:
    """Test BusinessRuleError exception."""

    def test_business_rule_error_creation(self):
        """Test creating a BusinessRuleError."""
        error = BusinessRuleError("Business rule violated")
        assert str(error) == "Business rule violated"
        assert isinstance(error, DotMacError)

    def test_business_rule_error_raise_and_catch(self):
        """Test raising and catching BusinessRuleError."""
        with pytest.raises(BusinessRuleError) as exc_info:
            raise BusinessRuleError("Cannot delete active user")
        assert "Cannot delete active user" in str(exc_info.value)


@pytest.mark.unit
class TestRepositoryError:
    """Test RepositoryError base exception."""

    def test_repository_error_creation(self):
        """Test creating a RepositoryError."""
        error = RepositoryError("Repository error")
        assert str(error) == "Repository error"
        assert isinstance(error, DotMacError)

    def test_repository_error_raise_and_catch(self):
        """Test raising and catching RepositoryError."""
        with pytest.raises(RepositoryError) as exc_info:
            raise RepositoryError("Database connection failed")
        assert "Database connection failed" in str(exc_info.value)


@pytest.mark.unit
class TestEntityNotFoundError:
    """Test EntityNotFoundError exception."""

    def test_entity_not_found_error_creation(self):
        """Test creating an EntityNotFoundError."""
        error = EntityNotFoundError("Entity not found")
        assert str(error) == "Entity not found"
        assert isinstance(error, RepositoryError)
        assert isinstance(error, DotMacError)

    def test_entity_not_found_error_raise_and_catch(self):
        """Test raising and catching EntityNotFoundError."""
        with pytest.raises(EntityNotFoundError) as exc_info:
            raise EntityNotFoundError("User with ID 'abc123' not found")
        assert "User with ID 'abc123' not found" in str(exc_info.value)

    def test_entity_not_found_error_caught_as_repository_error(self):
        """Test that EntityNotFoundError can be caught as RepositoryError."""
        with pytest.raises(RepositoryError):
            raise EntityNotFoundError("Test")


@pytest.mark.unit
class TestDuplicateEntityError:
    """Test DuplicateEntityError exception."""

    def test_duplicate_entity_error_creation(self):
        """Test creating a DuplicateEntityError."""
        error = DuplicateEntityError("Duplicate entity")
        assert str(error) == "Duplicate entity"
        assert isinstance(error, RepositoryError)
        assert isinstance(error, DotMacError)

    def test_duplicate_entity_error_raise_and_catch(self):
        """Test raising and catching DuplicateEntityError."""
        with pytest.raises(DuplicateEntityError) as exc_info:
            raise DuplicateEntityError("User with email 'test@example.com' already exists")
        assert "already exists" in str(exc_info.value)

    def test_duplicate_entity_error_caught_as_repository_error(self):
        """Test that DuplicateEntityError can be caught as RepositoryError."""
        with pytest.raises(RepositoryError):
            raise DuplicateEntityError("Test")


@pytest.mark.unit
class TestExceptionHierarchy:
    """Test exception hierarchy relationships."""

    def test_all_exceptions_inherit_from_dotmac_error(self):
        """Test that all domain exceptions inherit from DotMacError."""
        exceptions = [
            ValidationError,
            AuthorizationError,
            ConfigurationError,
            BusinessRuleError,
            RepositoryError,
            EntityNotFoundError,
            DuplicateEntityError,
        ]

        for exc_class in exceptions:
            assert issubclass(exc_class, DotMacError)

    def test_repository_exceptions_inherit_from_repository_error(self):
        """Test that repository-specific exceptions inherit from RepositoryError."""
        exceptions = [EntityNotFoundError, DuplicateEntityError]

        for exc_class in exceptions:
            assert issubclass(exc_class, RepositoryError)

    def test_catch_all_with_dotmac_error(self):
        """Test that all custom exceptions can be caught with DotMacError."""
        exceptions_to_test = [
            ValidationError("test"),
            AuthorizationError("test"),
            ConfigurationError("test"),
            BusinessRuleError("test"),
            RepositoryError("test"),
            EntityNotFoundError("test"),
            DuplicateEntityError("test"),
        ]

        for exc in exceptions_to_test:
            with pytest.raises(DotMacError):
                raise exc
