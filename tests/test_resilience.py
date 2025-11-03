"""Tests for resilience module using tenacity."""

import pytest
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential


@pytest.mark.integration
class TestResilience:
    def test_tenacity_import(self):
        """Test that tenacity components are available."""
        # Basic imports work
        assert retry is not None
        assert stop_after_attempt is not None
        assert wait_exponential is not None
        assert retry_if_exception_type is not None

    def test_basic_resilience_pattern(self):
        """Test basic retry pattern for resilience."""
        attempts = 0

        @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=0.1, max=1))
        def resilient_operation():
            nonlocal attempts
            attempts += 1
            if attempts < 3:
                raise ConnectionError("Temporary failure")
            return "success"

        result = resilient_operation()
        assert result == "success"
        assert attempts == 3
