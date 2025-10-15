"""Tests for the search service abstractions and in-memory backend."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.search.interfaces import (
    SearchFilter,
    SearchQuery,
    SearchType,
    SortOrder,
)
from dotmac.platform.search.service import (
    InMemorySearchBackend,
    MeilisearchBackend,
    SearchService,
    _search_span,
)


@pytest.mark.asyncio
async def test_inmemory_backend_filters_sorting_and_pagination():
    backend = InMemorySearchBackend()
    await backend.index("business_customer", "1", {"name": "Alice", "status": "active"})
    await backend.index("business_customer", "2", {"name": "Bob", "status": "inactive"})
    await backend.index("business_customer", "3", {"name": "Charlie", "status": "active"})

    query = SearchQuery(
        query="",
        filters=[SearchFilter(field="status", value="active", operator="eq")],
        sort_by="name",
        sort_order=SortOrder.ASC,
        limit=1,
        offset=0,
    )

    first_page = await backend.search("business_customer", query)

    assert first_page.total == 2
    assert [result.id for result in first_page.results] == ["1"]

    query.offset = 1
    second_page = await backend.search("business_customer", query)
    assert [result.id for result in second_page.results] == ["3"]


@pytest.mark.asyncio
async def test_inmemory_backend_scoring_orders_results():
    backend = InMemorySearchBackend()
    await backend.index(
        "business_article",
        "a",
        {"title": "alpha alpha", "body": "alpha beta"},
    )
    await backend.index(
        "business_article",
        "b",
        {"title": "alpha", "body": "gamma"},
    )

    query = SearchQuery(
        query="alpha",
        search_type=SearchType.FULL_TEXT,
        include_score=True,
        fields=["title", "body"],
    )

    response = await backend.search("business_article", query)

    assert response.total == 2
    assert [res.id for res in response.results] == ["a", "b"]
    assert response.results[0].score >= response.results[1].score


@pytest.mark.asyncio
async def test_search_service_delegates_to_backend():
    backend = AsyncMock()
    backend.index = AsyncMock(return_value=True)
    backend.search = AsyncMock(return_value="results")
    backend.delete = AsyncMock(return_value=True)

    service = SearchService(backend=backend)

    await service.index_business_entity("customer", "42", {"name": "Alice"})
    backend.index.assert_awaited_once_with("business_customer", "42", {"name": "Alice"})

    query = SearchQuery(query="alice")
    await service.search_business_entities("customer", query)
    backend.search.assert_awaited_once_with("business_customer", query)

    await service.delete_business_entity("customer", "42")
    backend.delete.assert_awaited_once_with("business_customer", "42")


@pytest.mark.asyncio
async def test_inmemory_backend_bulk_and_delete_index():
    backend = InMemorySearchBackend()
    payloads = [
        {"id": "1", "name": "one"},
        {"id": "2", "name": "two"},
    ]

    count = await backend.bulk_index("business_order", payloads)
    assert count == 2

    query = SearchQuery(query="", limit=10, offset=0)
    response = await backend.search("business_order", query)
    assert response.total == 2

    await backend.delete_index("business_order")
    empty = await backend.search("business_order", query)
    assert empty.total == 0


@pytest.mark.asyncio
async def test_service_initialization_with_string():
    """Test SearchService initialization with string backend type."""
    with patch("dotmac.platform.search.factory.create_search_backend_from_env") as mock_create:
        mock_backend = AsyncMock()
        mock_create.return_value = mock_backend

        service = SearchService(backend="memory")
        mock_create.assert_called_once_with("memory")
        assert service.backend == mock_backend


@pytest.mark.asyncio
async def test_service_initialization_with_none():
    """Test SearchService initialization with None (default backend)."""
    with patch("dotmac.platform.search.factory.create_search_backend_from_env") as mock_create:
        mock_backend = AsyncMock()
        mock_create.return_value = mock_backend

        service = SearchService(backend=None)
        mock_create.assert_called_once_with()
        assert service.backend == mock_backend


@pytest.mark.asyncio
async def test_update_business_entity():
    """Test updating a business entity."""
    backend = AsyncMock()
    backend.update = AsyncMock(return_value=True)
    service = SearchService(backend=backend)

    result = await service.update_business_entity(
        entity_type="customer", entity_id="cust-123", entity_data={"email": "new@example.com"}
    )

    assert result is True
    backend.update.assert_awaited_once_with(
        "business_customer", "cust-123", {"email": "new@example.com"}
    )


@pytest.mark.asyncio
async def test_reindex_entity_type():
    """Test reindexing all entities of a type."""
    backend = AsyncMock()
    backend.delete_index = AsyncMock(return_value=True)
    backend.create_index = AsyncMock(return_value=True)
    backend.bulk_index = AsyncMock(return_value=3)

    service = SearchService(backend=backend)
    service.index_mappings["customer"] = {"searchableAttributes": ["name", "email"]}

    entities = [
        {"id": "1", "name": "Alice"},
        {"id": "2", "name": "Bob"},
        {"id": "3", "name": "Charlie"},
    ]

    count = await service.reindex_entity_type("customer", entities)

    assert count == 3
    backend.delete_index.assert_awaited_once_with("business_customer")
    backend.create_index.assert_awaited_once_with(
        "business_customer", {"searchableAttributes": ["name", "email"]}
    )
    backend.bulk_index.assert_awaited_once_with("business_customer", entities)


@pytest.mark.asyncio
async def test_setup_indices():
    """Test setting up all business entity indices."""
    backend = AsyncMock()
    backend.create_index = AsyncMock(return_value=True)

    service = SearchService(backend=backend)
    service.index_mappings["customer"] = {"searchableAttributes": ["name"]}
    service.index_mappings["invoice"] = {"searchableAttributes": ["number"]}

    await service.setup_indices()

    # Should create indices for all entity types
    assert backend.create_index.call_count == 8
    expected_indices = [
        "business_customer",
        "business_invoice",
        "business_subscription",
        "business_payment",
        "business_workflow",
        "business_task",
        "business_notification",
        "business_audit",
    ]
    for index_name in expected_indices:
        backend.create_index.assert_any_call(
            index_name, service.index_mappings.get(index_name.replace("business_", ""))
        )


@pytest.mark.asyncio
async def test_inmemory_backend_update():
    """Test updating a document in InMemorySearchBackend."""
    backend = InMemorySearchBackend()
    await backend.index("test", "doc-1", {"title": "Old", "status": "draft"})

    # Update existing document
    result = await backend.update("test", "doc-1", {"status": "published"})
    assert result is True
    assert backend.indices["test"]["doc-1"]["status"] == "published"
    assert backend.indices["test"]["doc-1"]["title"] == "Old"  # Preserved

    # Update non-existent document
    result = await backend.update("test", "doc-999", {"status": "published"})
    assert result is False


@pytest.mark.asyncio
async def test_inmemory_backend_delete():
    """Test deleting a document from InMemorySearchBackend."""
    backend = InMemorySearchBackend()
    await backend.index("test", "doc-1", {"title": "Test"})

    # Delete existing document
    result = await backend.delete("test", "doc-1")
    assert result is True
    assert "doc-1" not in backend.indices["test"]

    # Delete non-existent document
    result = await backend.delete("test", "doc-999")
    assert result is False


@pytest.mark.asyncio
async def test_inmemory_backend_create_index():
    """Test creating an index in InMemorySearchBackend."""
    backend = InMemorySearchBackend()

    result = await backend.create_index("new_index", {"mappings": "test"})
    assert result is True
    assert "new_index" in backend.indices


@pytest.mark.asyncio
async def test_inmemory_backend_search_types():
    """Test different search types in InMemorySearchBackend."""
    backend = InMemorySearchBackend()
    await backend.index("test", "1", {"text": "hello world"})
    await backend.index("test", "2", {"text": "hello python"})
    await backend.index("test", "3", {"text": "goodbye world"})

    # Exact search
    query = SearchQuery(query="hello", search_type=SearchType.EXACT)
    response = await backend.search("test", query)
    assert response.total == 2

    # Prefix search
    query = SearchQuery(query="hel", search_type=SearchType.PREFIX)
    response = await backend.search("test", query)
    assert response.total == 2

    # Regex search
    query = SearchQuery(query="w.*ld", search_type=SearchType.REGEX)
    response = await backend.search("test", query)
    assert response.total == 2


@pytest.mark.asyncio
async def test_inmemory_backend_filter_operators():
    """Test all filter operators in InMemorySearchBackend."""
    backend = InMemorySearchBackend()
    await backend.index("test", "1", {"age": 25, "name": "John", "tags": ["python", "java"]})
    await backend.index("test", "2", {"age": 30, "name": "Jane", "tags": ["ruby"]})
    await backend.index("test", "3", {"age": 25, "name": "Bob", "tags": ["python"]})

    # Test gt operator
    query = SearchQuery(query="", filters=[SearchFilter(field="age", operator="gt", value=25)])
    response = await backend.search("test", query)
    assert response.total == 1

    # Test lt operator
    query = SearchQuery(query="", filters=[SearchFilter(field="age", operator="lt", value=30)])
    response = await backend.search("test", query)
    assert response.total == 2

    # Test gte operator
    query = SearchQuery(query="", filters=[SearchFilter(field="age", operator="gte", value=25)])
    response = await backend.search("test", query)
    assert response.total == 3

    # Test lte operator
    query = SearchQuery(query="", filters=[SearchFilter(field="age", operator="lte", value=25)])
    response = await backend.search("test", query)
    assert response.total == 2

    # Test ne operator
    query = SearchQuery(query="", filters=[SearchFilter(field="age", operator="ne", value=25)])
    response = await backend.search("test", query)
    assert response.total == 1

    # Test in operator
    query = SearchQuery(
        query="", filters=[SearchFilter(field="age", operator="in", value=[25, 35])]
    )
    response = await backend.search("test", query)
    assert response.total == 2

    # Test contains operator
    query = SearchQuery(
        query="", filters=[SearchFilter(field="name", operator="contains", value="oh")]
    )
    response = await backend.search("test", query)
    assert response.total == 1


@pytest.mark.asyncio
async def test_inmemory_backend_search_with_fields():
    """Test searching specific fields in InMemorySearchBackend."""
    backend = InMemorySearchBackend()
    doc = {"title": "Python Guide", "author": "John Doe", "content": "Learn Python programming"}
    await backend.index("books", "1", doc)

    # Search only in title field
    query = SearchQuery(query="python", fields=["title"])
    response = await backend.search("books", query)
    assert response.total == 1

    # Search only in author field (should not match)
    query = SearchQuery(query="python", fields=["author"])
    response = await backend.search("books", query)
    assert response.total == 0

    # Search in multiple fields
    query = SearchQuery(query="python", fields=["title", "content"])
    response = await backend.search("books", query)
    assert response.total == 1


class TestMeilisearchBackend:
    """Test MeilisearchBackend implementation."""

    @pytest.fixture
    def mock_meilisearch(self):
        """Mock meilisearch module."""
        with patch("dotmac.platform.search.service.require_meilisearch") as mock_require:
            mock_module = MagicMock()
            mock_client = MagicMock()
            mock_module.Client.return_value = mock_client
            mock_require.return_value = mock_module
            yield mock_module, mock_client

    def test_initialization(self, mock_meilisearch):
        """Test MeilisearchBackend initialization."""
        mock_module, mock_client = mock_meilisearch

        backend = MeilisearchBackend(
            host="http://search.example.com", api_key="test-key", primary_key="custom_id"
        )

        assert backend.host == "http://search.example.com"
        assert backend.api_key == "test-key"
        assert backend.primary_key == "custom_id"
        mock_module.Client.assert_called_once_with("http://search.example.com", "test-key")

    @pytest.mark.asyncio
    async def test_meilisearch_index(self, mock_meilisearch):
        """Test indexing a document in Meilisearch."""
        mock_module, mock_client = mock_meilisearch
        mock_index = MagicMock()
        mock_client.get_index.return_value = mock_index

        backend = MeilisearchBackend()
        result = await backend.index("test_index", "doc-1", {"title": "Test"})

        assert result is True
        mock_client.get_index.assert_called_once_with("test_index")
        mock_index.add_documents.assert_called_once()

    @pytest.mark.asyncio
    async def test_meilisearch_search(self, mock_meilisearch):
        """Test searching documents in Meilisearch."""
        mock_module, mock_client = mock_meilisearch
        mock_index = MagicMock()
        mock_client.get_index.return_value = mock_index

        # Mock search response
        mock_index.search.return_value = {
            "hits": [{"id": "1", "title": "Test", "_rankingScore": 0.95}],
            "estimatedTotalHits": 1,
            "processingTimeMs": 10,
        }

        backend = MeilisearchBackend()
        query = SearchQuery(query="test", limit=10)
        response = await backend.search("test_index", query)

        assert response.total == 1
        assert len(response.results) == 1
        assert response.results[0].id == "1"
        assert response.results[0].score == 0.95
        assert response.took_ms == 10

    @pytest.mark.asyncio
    async def test_meilisearch_delete(self, mock_meilisearch):
        """Test deleting a document from Meilisearch."""
        mock_module, mock_client = mock_meilisearch
        mock_index = MagicMock()
        mock_client.get_index.return_value = mock_index

        backend = MeilisearchBackend()
        result = await backend.delete("test_index", "doc-1")

        assert result is True
        mock_index.delete_document.assert_called_once_with("doc-1")

    @pytest.mark.asyncio
    async def test_meilisearch_update(self, mock_meilisearch):
        """Test updating a document in Meilisearch."""
        mock_module, mock_client = mock_meilisearch
        mock_index = MagicMock()
        mock_client.get_index.return_value = mock_index

        backend = MeilisearchBackend()
        result = await backend.update("test_index", "doc-1", {"status": "updated"})

        assert result is True
        mock_index.update_documents.assert_called_once()

    @pytest.mark.asyncio
    async def test_meilisearch_bulk_index(self, mock_meilisearch):
        """Test bulk indexing documents in Meilisearch."""
        mock_module, mock_client = mock_meilisearch
        mock_index = MagicMock()
        mock_client.get_index.return_value = mock_index

        backend = MeilisearchBackend()
        documents = [
            {"id": "1", "title": "Doc 1"},
            {"id": "2", "title": "Doc 2"},
        ]

        count = await backend.bulk_index("test_index", documents)

        assert count == 2
        mock_index.add_documents.assert_called_once()

    @pytest.mark.asyncio
    async def test_meilisearch_create_index(self, mock_meilisearch):
        """Test creating an index in Meilisearch."""
        mock_module, mock_client = mock_meilisearch

        backend = MeilisearchBackend()
        result = await backend.create_index("new_index", {"searchableAttributes": ["title"]})

        assert result is True
        mock_client.create_index.assert_called_once()

    @pytest.mark.asyncio
    async def test_meilisearch_delete_index(self, mock_meilisearch):
        """Test deleting an index in Meilisearch."""
        mock_module, mock_client = mock_meilisearch

        backend = MeilisearchBackend()
        result = await backend.delete_index("old_index")

        assert result is True
        mock_client.delete_index.assert_called_once_with("old_index")

    def test_meilisearch_filters_to_expression(self, mock_meilisearch):
        """Test converting filters to Meilisearch filter expression."""
        backend = MeilisearchBackend()

        # Test various operators
        filters = [
            SearchFilter(field="status", operator="eq", value="active"),
            SearchFilter(field="age", operator="ne", value=25),
            SearchFilter(field="category", operator="in", value=["tech", "science"]),
            SearchFilter(field="title", operator="contains", value="python"),
        ]

        expression = backend._filters_to_expression(filters)

        assert 'status = "active"' in expression
        assert 'age != "25"' in expression
        assert 'category IN ["tech", "science"]' in expression
        assert 'title CONTAINS "python"' in expression

    @pytest.mark.asyncio
    async def test_meilisearch_search_with_filters_and_sort(self, mock_meilisearch):
        """Test search with filters and sorting in Meilisearch."""
        mock_module, mock_client = mock_meilisearch
        mock_index = MagicMock()
        mock_client.get_index.return_value = mock_index
        mock_index.search.return_value = {"hits": [], "estimatedTotalHits": 0}

        backend = MeilisearchBackend()
        query = SearchQuery(
            query="test",
            filters=[SearchFilter(field="status", operator="eq", value="active")],
            sort_by="created_at",
            sort_order=SortOrder.DESC,
            fields=["title", "content"],
            include_score=True,
        )

        await backend.search("test_index", query)

        # Verify search was called with correct params
        call_args = mock_index.search.call_args
        assert call_args[0][0] == "test"  # search term
        params = call_args[0][1]
        assert "filter" in params
        assert "sort" in params
        assert params["sort"] == ["created_at:desc"]
        assert params["attributesToSearchOn"] == ["title", "content"]
        assert params["showMatchesPosition"] is True


def test_search_span_without_tracer():
    """Test _search_span when tracer is not available."""
    with patch("dotmac.platform.search.service.search_tracer", None):
        with _search_span("test.operation", index="test"):
            # Should be nullcontext
            pass


def test_search_span_with_tracer():
    """Test _search_span when tracer is available."""
    mock_tracer = MagicMock()
    mock_span = MagicMock()
    mock_tracer.start_as_current_span.return_value = mock_span

    with patch("dotmac.platform.search.service.search_tracer", mock_tracer):
        with _search_span("test.operation", index="test", query="search"):
            pass

        mock_tracer.start_as_current_span.assert_called_once_with(
            "test.operation", attributes={"index": "test", "query": "search"}
        )
