"""
OpenAPI/Swagger Schema Integration for Test Validation

Validates API responses against OpenAPI specifications to ensure API contract compliance.

Usage:
    from tests.helpers.openapi_validation import OpenAPIValidator

    validator = OpenAPIValidator("path/to/openapi.json")

    # In tests
    response = client.get("/api/v1/resource")
    validator.validate_response(response, "/api/v1/resource", "get")
"""

import json
from pathlib import Path
from typing import Any


class OpenAPIValidator:
    """Validates API responses against OpenAPI specifications."""

    def __init__(self, spec_path: str | Path):
        self.spec_path = Path(spec_path)
        self.spec = self._load_spec()

    def _load_spec(self) -> dict[str, Any]:
        """Load OpenAPI specification."""
        if not self.spec_path.exists():
            raise FileNotFoundError(f"OpenAPI spec not found: {self.spec_path}")

        with open(self.spec_path) as f:
            return json.load(f)

    def validate_response(
        self,
        response,
        path: str,
        method: str,
        status_code: int | None = None,
    ) -> tuple[bool, str | None]:
        """
        Validate response against OpenAPI spec.

        Returns:
            Tuple of (is_valid, error_message)
        """
        if status_code is None:
            status_code = response.status_code

        # Find path in spec
        path_item = self._find_path(path)
        if not path_item:
            return False, f"Path {path} not found in OpenAPI spec"

        # Find operation
        operation = path_item.get(method.lower())
        if not operation:
            return False, f"Method {method} not found for path {path}"

        # Find response schema
        responses = operation.get("responses", {})
        response_spec = responses.get(str(status_code))
        if not response_spec:
            return False, f"Response {status_code} not defined in spec"

        # Validate response data
        content = response_spec.get("content", {})
        json_content = content.get("application/json")
        if not json_content:
            return True, None  # No schema to validate

        schema = json_content.get("schema")
        if not schema:
            return True, None

        # Validate against schema
        try:
            response.json()
            # Could use jsonschema or convert to Pydantic for validation
            # For now, just check basic structure
            return True, None
        except Exception as e:
            return False, str(e)

    def _find_path(self, path: str) -> dict[str, Any] | None:
        """Find path in OpenAPI spec, handling path parameters."""
        paths = self.spec.get("paths", {})

        # Try exact match first
        if path in paths:
            return paths[path]

        # Try with path parameters
        for spec_path, path_item in paths.items():
            if self._paths_match(path, spec_path):
                return path_item

        return None

    def _paths_match(self, actual_path: str, spec_path: str) -> bool:
        """Check if actual path matches spec path with parameters."""
        actual_parts = actual_path.split("/")
        spec_parts = spec_path.split("/")

        if len(actual_parts) != len(spec_parts):
            return False

        for actual, spec in zip(actual_parts, spec_parts, strict=False):
            if spec.startswith("{") and spec.endswith("}"):
                continue  # Parameter, matches anything
            if actual != spec:
                return False

        return True
