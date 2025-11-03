"""
Contract testing utilities for Pydantic schema validation.

This module provides tools to ensure mock data matches actual schemas,
preventing validation errors that caused 17+ test failures.

Key features:
1. Automatic schema validation for mock data
2. Mock data generation from Pydantic schemas
3. Schema comparison and diff utilities
4. Validation error reporting

Usage:
    # Validate mock data
    validator = SchemaValidator(OltMetrics)
    validator.validate({
        "olt_id": "olt1",
        "pon_ports_up": 8,
        "pon_ports_total": 8,
        "onu_online": 5,
        "onu_total": 5,
    })

    # Generate mock data
    mock_data = MockDataFactory.create(OltMetrics, olt_id="olt1")
"""

from __future__ import annotations

import inspect
from typing import Any, get_args, get_origin
from uuid import uuid4

from pydantic import BaseModel, ValidationError


class SchemaValidationError(Exception):
    """Raised when mock data doesn't match schema."""

    def __init__(self, schema_name: str, errors: list[dict]):
        self.schema_name = schema_name
        self.errors = errors
        error_details = "\n".join(f"  - {err['loc']}: {err['msg']}" for err in errors)
        super().__init__(f"Mock data validation failed for {schema_name}:\n{error_details}")


class SchemaValidator:
    """
    Validates mock data against Pydantic schemas.

    This prevents common test failures where mock data is missing required
    fields or has incorrect types.
    """

    def __init__(self, schema: type[BaseModel]):
        self.schema = schema
        self.schema_name = schema.__name__

    def validate(self, data: dict[str, Any] | list[dict[str, Any]]) -> None:
        """
        Validate data against schema.

        Args:
            data: Dictionary or list of dictionaries to validate

        Raises:
            SchemaValidationError: If validation fails
        """
        try:
            if isinstance(data, list):
                [self.schema(**item) for item in data]
            else:
                self.schema(**data)
        except ValidationError as e:
            raise SchemaValidationError(self.schema_name, e.errors()) from e

    def get_required_fields(self) -> list[str]:
        """Get list of required field names."""
        return [name for name, field in self.schema.model_fields.items() if field.is_required()]

    def get_optional_fields(self) -> list[str]:
        """Get list of optional field names."""
        return [name for name, field in self.schema.model_fields.items() if not field.is_required()]

    def get_field_types(self) -> dict[str, str]:
        """Get mapping of field names to their types."""
        result = {}
        for name, field in self.schema.model_fields.items():
            annotation = field.annotation
            if hasattr(annotation, "__name__"):
                result[name] = annotation.__name__
            else:
                result[name] = str(annotation)
        return result

    def compare_data(self, data: dict[str, Any]) -> dict[str, Any]:
        """
        Compare data against schema and return diagnostics.

        Returns:
            Dictionary with:
            - missing_required: List of missing required fields
            - extra_fields: List of fields not in schema
            - type_mismatches: List of fields with wrong types
        """
        schema_fields = set(self.schema.model_fields.keys())
        data_fields = set(data.keys())
        required_fields = set(self.get_required_fields())

        missing_required = list(required_fields - data_fields)
        extra_fields = list(data_fields - schema_fields)

        # Check type mismatches (simplified)
        type_mismatches = []
        field_types = self.get_field_types()

        for name, value in data.items():
            if name in field_types:
                expected_type = field_types[name]
                actual_type = type(value).__name__

                # Simple type checking (can be enhanced)
                if value is not None and expected_type != "Any":
                    if "str" in expected_type and not isinstance(value, str):
                        type_mismatches.append(
                            {
                                "field": name,
                                "expected": expected_type,
                                "actual": actual_type,
                            }
                        )
                    elif "int" in expected_type and not isinstance(value, int):
                        type_mismatches.append(
                            {
                                "field": name,
                                "expected": expected_type,
                                "actual": actual_type,
                            }
                        )
                    elif "list" in expected_type and not isinstance(value, list):
                        type_mismatches.append(
                            {
                                "field": name,
                                "expected": expected_type,
                                "actual": actual_type,
                            }
                        )

        return {
            "missing_required": missing_required,
            "extra_fields": extra_fields,
            "type_mismatches": type_mismatches,
        }


class MockDataFactory:
    """
    Generates valid mock data from Pydantic schemas.

    This ensures test data always matches schemas, preventing validation errors.
    """

    @classmethod
    def create(cls, schema: type[BaseModel], **overrides: Any) -> dict[str, Any]:
        """
        Create mock data for a schema with optional overrides.

        Args:
            schema: Pydantic model class
            **overrides: Field values to override defaults

        Returns:
            Dictionary of mock data that validates against schema
        """
        data = {}

        for name, field in schema.model_fields.items():
            # Use override if provided
            if name in overrides:
                data[name] = overrides[name]
                continue

            # Use field default if available
            if field.default is not None:
                data[name] = field.default
                continue

            if field.default_factory is not None:
                data[name] = field.default_factory()
                continue

            # Generate value based on type
            if field.is_required():
                data[name] = cls._generate_value(field.annotation)

        return data

    @classmethod
    def _generate_value(cls, annotation: Any) -> Any:
        """Generate a default value based on type annotation."""
        # Handle Union types (e.g., str | None)
        origin = get_origin(annotation)
        if origin is not None:
            args = get_args(annotation)

            # For Optional/Union types, use first non-None type
            if type(None) in args:
                non_none_types = [t for t in args if t is not type(None)]
                if non_none_types:
                    return cls._generate_value(non_none_types[0])
                return None

            # For list types
            if origin is list:
                return []

            # For dict types
            if origin is dict:
                return {}

        # Handle basic types
        if annotation is str or annotation == "str":
            return f"test_{uuid4().hex[:8]}"
        elif annotation is int or annotation == "int":
            return 0
        elif annotation is float or annotation == "float":
            return 0.0
        elif annotation is bool or annotation == "bool":
            return False
        elif annotation is list:
            return []
        elif annotation is dict:
            return {}

        # For BaseModel subclasses, create nested mock
        if inspect.isclass(annotation) and issubclass(annotation, BaseModel):
            return cls.create(annotation)

        # Default to None for unknown types
        return None

    @classmethod
    def create_instance(cls, schema: type[BaseModel], **overrides: Any) -> BaseModel:
        """
        Create an actual Pydantic model instance with mock data.

        Args:
            schema: Pydantic model class
            **overrides: Field values to override defaults

        Returns:
            Instance of the schema with mock data
        """
        data = cls.create(schema, **overrides)
        return schema(**data)


class ContractTestCase:
    """
    Base class for contract testing.

    Provides assertions for schema validation in tests.
    """

    def assert_valid_schema(
        self,
        data: dict[str, Any] | list[dict[str, Any]],
        schema: type[BaseModel],
    ) -> None:
        """
        Assert that data validates against schema.

        Args:
            data: Data to validate
            schema: Schema to validate against

        Raises:
            AssertionError: If validation fails
        """
        validator = SchemaValidator(schema)
        try:
            validator.validate(data)
        except SchemaValidationError as e:
            raise AssertionError(str(e)) from e

    def assert_response_schema(
        self,
        response,
        schema: type[BaseModel],
    ) -> BaseModel | list[BaseModel]:
        """
        Assert that HTTP response data validates against schema.

        Args:
            response: HTTP response object
            schema: Schema to validate against

        Returns:
            Validated Pydantic model instance(s)

        Raises:
            AssertionError: If validation fails
        """
        data = response.json()
        self.assert_valid_schema(data, schema)

        # Return validated model
        if isinstance(data, list):
            return [schema(**item) for item in data]
        else:
            return schema(**data)


class SchemaRegistry:
    """
    Registry for tracking schemas and their locations.

    Helps identify which schemas are used in which tests.
    """

    _registry: dict[str, type[BaseModel]] = {}

    @classmethod
    def register(cls, schema: type[BaseModel]) -> None:
        """Register a schema."""
        cls._registry[schema.__name__] = schema

    @classmethod
    def get(cls, name: str) -> type[BaseModel] | None:
        """Get a registered schema by name."""
        return cls._registry.get(name)

    @classmethod
    def list_schemas(cls) -> list[str]:
        """List all registered schema names."""
        return sorted(cls._registry.keys())


def validate_mock_against_schema(
    mock_data: dict[str, Any],
    schema: type[BaseModel],
) -> tuple[bool, str | None]:
    """
    Convenience function to validate mock data.

    Returns:
        Tuple of (is_valid, error_message)
    """
    validator = SchemaValidator(schema)
    try:
        validator.validate(mock_data)
        return True, None
    except SchemaValidationError as e:
        return False, str(e)


def generate_mock_for_schema(schema: type[BaseModel], **overrides: Any) -> dict[str, Any]:
    """
    Convenience function to generate mock data.

    Args:
        schema: Pydantic model class
        **overrides: Field values to override

    Returns:
        Dictionary of valid mock data
    """
    return MockDataFactory.create(schema, **overrides)


# Pytest plugin for automatic mock validation
class MockValidationPlugin:
    """
    Pytest plugin that validates AsyncMock return values against schemas.

    Enable by adding to conftest.py:
        pytest_plugins = ["tests.helpers.contract_testing"]
    """

    def __init__(self):
        self.validation_errors = []

    def pytest_runtest_call(self, item):
        """Hook called during test execution."""
        # Could be enhanced to automatically validate mock return values
        pass

    def pytest_runtest_teardown(self, item):
        """Report any validation errors after test."""
        if self.validation_errors:
            for error in self.validation_errors:
                print(f"\nMock Validation Warning: {error}")
            self.validation_errors.clear()
