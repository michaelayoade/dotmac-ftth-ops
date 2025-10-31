"""
Tests for search interfaces and data structures.
"""

import pytest

from dotmac.platform.search.interfaces import (
    SearchBackend,
    SearchFilter,
    SearchQuery,
    SearchResponse,
    SearchResult,
    SearchType,
    SortOrder,
)


@pytest.mark.unit
class TestSearchEnums:
    """Test search enumeration types."""

    def test_search_type_values(self):
        """Test SearchType enum values."""
        assert SearchType.FULL_TEXT == "full_text"
        assert SearchType.EXACT == "exact"
        assert SearchType.PREFIX == "prefix"
        assert SearchType.FUZZY == "fuzzy"
        assert SearchType.REGEX == "regex"

    def test_sort_order_values(self):
        """Test SortOrder enum values."""
        assert SortOrder.ASC == "asc"
        assert SortOrder.DESC == "desc"


@pytest.mark.unit
class TestSearchFilter:
    """Test SearchFilter dataclass."""

    def test_search_filter_creation(self):
        """Test SearchFilter creation with required fields."""
        filter_obj = SearchFilter(field="name", value="test")
        assert filter_obj.field == "name"
        assert filter_obj.value == "test"
        assert filter_obj.operator == "eq"  # default value

    def test_search_filter_with_operator(self):
        """Test SearchFilter with custom operator."""
        filter_obj = SearchFilter(field="age", value=25, operator="gte")
        assert filter_obj.field == "age"
        assert filter_obj.value == 25
        assert filter_obj.operator == "gte"

    def test_search_filter_operators(self):
        """Test SearchFilter with different operators."""
        operators = ["eq", "ne", "gt", "lt", "gte", "lte", "in", "contains"]
        for op in operators:
            filter_obj = SearchFilter(field="test", value="value", operator=op)
            assert filter_obj.operator == op

    def test_search_filter_complex_values(self):
        """Test SearchFilter with complex values."""
        # List value
        filter_obj = SearchFilter(field="tags", value=["tag1", "tag2"], operator="in")
        assert filter_obj.value == ["tag1", "tag2"]

        # Dict value
        filter_obj = SearchFilter(field="metadata", value={"key": "value"}, operator="contains")
        assert filter_obj.value == {"key": "value"}


@pytest.mark.unit
class TestSearchQuery:
    """Test SearchQuery dataclass."""

    def test_search_query_minimal(self):
        """Test SearchQuery with minimal required fields."""
        query = SearchQuery(query="test")
        assert query.query == "test"
        assert query.search_type == SearchType.FULL_TEXT
        assert query.filters == []
        assert query.fields is None
        assert query.limit == 10
        assert query.offset == 0
        assert query.sort_by is None
        assert query.sort_order == SortOrder.DESC
        assert query.include_score is False
        assert query.highlight is False

    def test_search_query_full_configuration(self):
        """Test SearchQuery with all fields configured."""
        filters = [SearchFilter(field="status", value="active")]
        query = SearchQuery(
            query="search term",
            search_type=SearchType.FUZZY,
            filters=filters,
            fields=["title", "description"],
            limit=25,
            offset=50,
            sort_by="created_at",
            sort_order=SortOrder.ASC,
            include_score=True,
            highlight=True,
        )
        assert query.query == "search term"
        assert query.search_type == SearchType.FUZZY
        assert query.filters == filters
        assert query.fields == ["title", "description"]
        assert query.limit == 25
        assert query.offset == 50
        assert query.sort_by == "created_at"
        assert query.sort_order == SortOrder.ASC
        assert query.include_score is True
        assert query.highlight is True

    def test_search_query_with_multiple_filters(self):
        """Test SearchQuery with multiple filters."""
        filters = [
            SearchFilter(field="status", value="active"),
            SearchFilter(field="category", value="docs", operator="eq"),
            SearchFilter(field="score", value=5, operator="gte"),
        ]
        query = SearchQuery(query="test", filters=filters)
        assert len(query.filters) == 3
        assert query.filters[0].field == "status"
        assert query.filters[1].field == "category"
        assert query.filters[2].field == "score"

    def test_search_query_pagination(self):
        """Test SearchQuery pagination parameters."""
        query = SearchQuery(query="test", limit=100, offset=200)
        assert query.limit == 100
        assert query.offset == 200

    def test_search_query_search_types(self):
        """Test SearchQuery with different search types."""
        for search_type in SearchType:
            query = SearchQuery(query="test", search_type=search_type)
            assert query.search_type == search_type


@pytest.mark.unit
class TestSearchResult:
    """Test SearchResult dataclass."""

    def test_search_result_minimal(self):
        """Test SearchResult with minimal required fields."""
        result = SearchResult(id="doc1", type="document", data={"title": "Test Document"})
        assert result.id == "doc1"
        assert result.type == "document"
        assert result.data == {"title": "Test Document"}
        assert result.score is None
        assert result.highlights is None

    def test_search_result_with_score(self):
        """Test SearchResult with score."""
        result = SearchResult(id="doc1", type="document", data={"title": "Test"}, score=0.95)
        assert result.score == 0.95

    def test_search_result_with_highlights(self):
        """Test SearchResult with highlights."""
        highlights = {
            "title": ["<em>test</em> document"],
            "content": ["This is a <em>test</em> content"],
        }
        result = SearchResult(
            id="doc1", type="document", data={"title": "Test Document"}, highlights=highlights
        )
        assert result.highlights == highlights

    def test_search_result_complex_data(self):
        """Test SearchResult with complex data structure."""
        complex_data = {
            "title": "Test Document",
            "content": "This is test content",
            "metadata": {
                "author": "John Doe",
                "tags": ["test", "document"],
                "created_at": "2024-01-01T00:00:00Z",
            },
            "stats": {"views": 100, "likes": 25},
        }
        result = SearchResult(id="doc1", type="document", data=complex_data)
        assert result.data == complex_data
        assert result.data["metadata"]["author"] == "John Doe"
        assert result.data["stats"]["views"] == 100


@pytest.mark.unit
class TestSearchResponse:
    """Test SearchResponse dataclass."""

    def test_search_response_minimal(self):
        """Test SearchResponse with minimal data."""
        query = SearchQuery(query="test")
        response = SearchResponse(results=[], total=0, query=query)
        assert response.results == []
        assert response.total == 0
        assert response.query == query
        assert response.took_ms is None

    def test_search_response_with_results(self):
        """Test SearchResponse with results."""
        results = [
            SearchResult(id="1", type="doc", data={"title": "Doc 1"}),
            SearchResult(id="2", type="doc", data={"title": "Doc 2"}),
        ]
        query = SearchQuery(query="test")
        response = SearchResponse(results=results, total=2, query=query, took_ms=150)
        assert len(response.results) == 2
        assert response.total == 2
        assert response.took_ms == 150
        assert response.results[0].id == "1"
        assert response.results[1].id == "2"

    def test_search_response_pagination_info(self):
        """Test SearchResponse with pagination context."""
        query = SearchQuery(query="test", limit=10, offset=20)
        response = SearchResponse(results=[], total=100, query=query)
        assert response.total == 100
        assert response.query.limit == 10
        assert response.query.offset == 20

    def test_search_response_performance_timing(self):
        """Test SearchResponse with performance timing."""
        query = SearchQuery(query="test")
        response = SearchResponse(results=[], total=0, query=query, took_ms=5)
        assert response.took_ms == 5


@pytest.mark.unit
class TestSearchBackend:
    """Test SearchBackend abstract base class."""

    def test_search_backend_is_abstract(self):
        """Test that SearchBackend cannot be instantiated directly."""
        with pytest.raises(TypeError):
            SearchBackend()

    def test_search_backend_abstract_methods(self):
        """Test that SearchBackend has the expected abstract methods."""
        abstract_methods = SearchBackend.__abstractmethods__
        expected_methods = {
            "index",
            "search",
            "delete",
            "update",
            "bulk_index",
            "create_index",
            "delete_index",
        }
        assert abstract_methods == expected_methods

    def test_search_backend_interface_compliance(self):
        """Test that a concrete implementation must implement all methods."""

        class IncompleteBackend(SearchBackend):
            # Missing all abstract methods
            pass

        with pytest.raises(TypeError):
            IncompleteBackend()

    def test_search_backend_concrete_implementation(self):
        """Test that a complete implementation can be instantiated."""

        class ConcreteBackend(SearchBackend):
            async def index(self, index_name: str, doc_id: str, document: dict) -> bool:
                return True

            async def search(self, index_name: str, query: SearchQuery) -> SearchResponse:
                return SearchResponse(results=[], total=0, query=query)

            async def delete(self, index_name: str, doc_id: str) -> bool:
                return True

            async def update(self, index_name: str, doc_id: str, document: dict) -> bool:
                return True

            async def bulk_index(self, index_name: str, documents: list) -> int:
                return len(documents)

            async def create_index(self, index_name: str, mappings=None) -> bool:
                return True

            async def delete_index(self, index_name: str) -> bool:
                return True

        # Should not raise an error
        backend = ConcreteBackend()
        assert isinstance(backend, SearchBackend)


@pytest.mark.unit
class TestDataclassImmutability:
    """Test that dataclasses are properly configured."""

    def test_search_filter_mutability(self):
        """Test SearchFilter mutability."""
        filter_obj = SearchFilter(field="name", value="test")
        # Should be able to modify (dataclasses are mutable by default)
        filter_obj.value = "new_value"
        assert filter_obj.value == "new_value"

    def test_search_query_list_modification(self):
        """Test that modifying lists in SearchQuery works correctly."""
        query = SearchQuery(query="test")
        query.filters.append(SearchFilter(field="status", value="active"))
        assert len(query.filters) == 1
        assert query.filters[0].field == "status"

        query.fields = ["title", "content"]
        query.fields.append("description")
        assert len(query.fields) == 3


@pytest.mark.unit
class TestDataValidation:
    """Test implicit data validation through usage patterns."""

    def test_search_query_with_invalid_enum_values(self):
        """Test behavior with invalid enum values."""
        # This will pass since we're not doing runtime validation
        # But it's good to document expected usage
        valid_query = SearchQuery(
            query="test", search_type=SearchType.FUZZY, sort_order=SortOrder.ASC
        )
        assert valid_query.search_type == SearchType.FUZZY
        assert valid_query.sort_order == SortOrder.ASC

    def test_search_result_edge_cases(self):
        """Test SearchResult with edge case values."""
        # Empty data
        result = SearchResult(id="", type="", data={})
        assert result.id == ""
        assert result.type == ""
        assert result.data == {}

        # Score boundaries
        result_high = SearchResult(id="1", type="doc", data={}, score=1.0)
        result_low = SearchResult(id="2", type="doc", data={}, score=0.0)
        result_negative = SearchResult(id="3", type="doc", data={}, score=-0.5)

        assert result_high.score == 1.0
        assert result_low.score == 0.0
        assert result_negative.score == -0.5
