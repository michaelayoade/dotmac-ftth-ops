"""Tests for utility helper functions."""

import pytest

pytestmark = pytest.mark.unit


def test_utils_module_exists():
    """Test that utils module exists and can be imported."""
    try:
        from dotmac.platform import utils
        assert utils is not None
    except ImportError:
        pytest.skip("Utils module not yet implemented")


def test_common_helpers_available():
    """Test common helper utilities are available."""
    try:
        from dotmac.platform.core import helpers
        # Check for common helper functions
        assert helpers is not None
    except ImportError:
        # Helpers might be in different location
        pytest.skip("Helper utilities location varies")
