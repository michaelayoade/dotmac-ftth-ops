import pytest

from dotmac.platform.search.models_elasticsearch import (
    INDEX_MAPPINGS,
    SearchableEntity,
    SearchOperator,
    SortOrder,
)

pytestmark = pytest.mark.unit


def test_index_mappings_include_expected_fields() -> None:
    customer_mapping = INDEX_MAPPINGS[SearchableEntity.CUSTOMER]
    assert "customer_id" in customer_mapping["properties"]
    assert customer_mapping["properties"]["name"]["fields"]["keyword"]["type"] == "keyword"


def test_enums_cover_expected_values() -> None:
    assert SearchableEntity.CUSTOMER.value == "customer"
    assert SearchOperator.AND.value == "and"
    assert SortOrder.DESC.value == "desc"
