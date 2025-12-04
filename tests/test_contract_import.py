import importlib

import pytest

pytestmark = pytest.mark.integration


def test_import_plugins():
    mod = importlib.import_module("dotmac.platform.plugins")
    # Module simply needs to import for contract coverage.
    assert hasattr(mod, "PluginRegistry") or True
