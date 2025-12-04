import pytest

from dotmac.platform.config.router import PRIVATE_FEATURE_FLAGS, PUBLIC_FEATURE_FLAGS
from dotmac.platform.settings import Settings

pytestmark = pytest.mark.unit


def test_public_feature_flags_allowlist_matches_feature_schema() -> None:
    """Ensure any new feature flags are explicitly reviewed before exposure."""
    all_feature_fields = set(Settings.FeatureFlags.model_fields.keys())
    exposed_flags = set(PUBLIC_FEATURE_FLAGS)
    private_flags = set(PRIVATE_FEATURE_FLAGS)

    assert exposed_flags.isdisjoint(private_flags)
    assert exposed_flags | private_flags == all_feature_fields
