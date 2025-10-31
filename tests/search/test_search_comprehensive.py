"""
Comprehensive tests for search module.

Tests all search functionality including:
- Search backend factory
- Search backend registry
- In-memory search backend
- Search router endpoints
- Search service integration
- Feature flag integration
- Error handling and edge cases
"""

import os
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from dotmac.platform.search import (
    InMemorySearchBackend,
    SearchBackend,
    SearchQuery,
    SearchResponse,
    SearchResult,
    SearchService,
    create_search_backend_from_env,
)
from dotmac.platform.search.factory import (
    SearchBackendFactory,
    SearchBackendRegistry,
    create_memory_backend,
    create_search_backend,
    get_default_search_backend,
)
from dotmac.platform.search.interfaces import SearchFilter, SortOrder
from dotmac.platform.search.router import search_router


@pytest.mark.integration
class TestSearchBackendRegistry:
    """Test SearchBackendRegistry class."""

    @pytest.fixture
    def registry(self):
        """Create fresh registry for testing."""
        return SearchBackendRegistry()

    def test_registry_initialization(self, registry):
        """Test registry initializes with core backends."""
        backends = registry.list_available_backends()
        assert "memory" in backends
        assert len(backends) >= 1

    def test_register_backend(self, registry):
        """Test registering a new backend."""

        @pytest.mark.integration
        class TestBackend(SearchBackend):
            async def search(self, query):
                pass

            async def index_document(self, doc_id, content):
                pass

            async def delete_document(self, doc_id):
                pass

            async def bulk_index(self, documents):
                pass

            async def delete_index(self):
                pass

        registry.register_backend("test", TestBackend)
        backends = registry.list_available_backends()
        assert "test" in backends

    def test_get_backend_class_exists(self, registry):
        """Test getting existing backend class."""
        backend_class = registry.get_backend_class("memory")
        assert backend_class == InMemorySearchBackend

    def test_get_backend_class_not_exists(self, registry):
        """Test getting non-existent backend class."""
        with pytest.raises(ValueError, match="Unknown search backend 'nonexistent'"):
            registry.get_backend_class("nonexistent")

    def test_list_available_backends(self, registry):
        """Test listing available backends."""
        backends = registry.list_available_backends()
        assert isinstance(backends, list)
        assert "memory" in backends

    @patch("dotmac.platform.search.factory.settings")
    @patch("dotmac.platform.search.factory.DependencyChecker")
    def test_list_enabled_backends_memory_only(self, mock_checker, mock_settings, registry):
        """Test listing enabled backends when only memory is available."""
        mock_settings.features.search_enabled = False

        enabled = registry.list_enabled_backends()
        assert enabled == ["memory"]

    @patch("dotmac.platform.search.factory.settings")
    @patch("dotmac.platform.search.factory.DependencyChecker")
    def test_list_enabled_backends_with_meilisearch(self, mock_checker, mock_settings, registry):
        """Test listing enabled backends with MeiliSearch."""
        mock_settings.features.search_enabled = True
        mock_checker.check_feature_dependency.return_value = True

        enabled = registry.list_enabled_backends()
        assert "memory" in enabled
        assert "meilisearch" in enabled

    @patch("dotmac.platform.search.factory.settings")
    @patch("dotmac.platform.search.factory.DependencyChecker")
    def test_list_enabled_backends_meilisearch_no_deps(self, mock_checker, mock_settings, registry):
        """Test meilisearch not enabled when dependencies missing."""
        mock_settings.features.search_enabled = True
        mock_checker.check_feature_dependency.return_value = False

        enabled = registry.list_enabled_backends()
        assert enabled == ["memory"]


@pytest.mark.integration
class TestSearchBackendFactory:
    """Test SearchBackendFactory class."""

    def test_create_backend_memory(self):
        """Test creating memory backend."""
        backend = SearchBackendFactory.create_backend("memory")
        assert isinstance(backend, InMemorySearchBackend)

    def test_create_backend_auto_select(self):
        """Test auto-selecting backend."""
        backend = SearchBackendFactory.create_backend()
        assert isinstance(backend, SearchBackend)

    @patch("dotmac.platform.search.factory.settings")
    def test_create_backend_meilisearch_disabled(self, mock_settings):
        """Test creating meilisearch when disabled."""
        mock_settings.features.search_enabled = False

        with pytest.raises(ValueError, match="MeiliSearch backend selected but not enabled"):
            SearchBackendFactory.create_backend("meilisearch")

    def test_create_backend_unknown(self):
        """Test creating unknown backend."""
        with pytest.raises(ValueError, match="Unknown search backend 'unknown'"):
            SearchBackendFactory.create_backend("unknown")

    @patch("dotmac.platform.search.factory.settings")
    @patch("dotmac.platform.search.factory.DependencyChecker")
    def test_auto_select_backend_meilisearch(self, mock_checker, mock_settings):
        """Test auto-selecting MeiliSearch when available."""
        mock_settings.features.search_enabled = True
        mock_checker.check_feature_dependency.return_value = True

        backend_type = SearchBackendFactory._auto_select_backend()
        assert backend_type == "meilisearch"

    @patch("dotmac.platform.search.factory.settings")
    @patch("dotmac.platform.search.factory.DependencyChecker")
    def test_auto_select_backend_memory_fallback(self, mock_checker, mock_settings):
        """Test falling back to memory backend."""
        mock_settings.features.search_enabled = False

        backend_type = SearchBackendFactory._auto_select_backend()
        assert backend_type == "memory"

    def test_list_available_backends(self):
        """Test listing available backends."""
        backends = SearchBackendFactory.list_available_backends()
        assert isinstance(backends, list)
        assert "memory" in backends

    def test_list_enabled_backends(self):
        """Test listing enabled backends."""
        backends = SearchBackendFactory.list_enabled_backends()
        assert isinstance(backends, list)
        assert "memory" in backends

    def test_validate_backend_valid(self):
        """Test validating valid backend."""
        assert SearchBackendFactory.validate_backend("memory") is True

    def test_validate_backend_invalid(self):
        """Test validating invalid backend."""
        assert SearchBackendFactory.validate_backend("invalid") is False


@pytest.mark.integration
class TestConvenienceFunctions:
    """Test convenience functions."""

    def test_create_search_backend(self):
        """Test create_search_backend convenience function."""
        backend = create_search_backend("memory")
        assert isinstance(backend, InMemorySearchBackend)

    def test_get_default_search_backend(self):
        """Test get_default_search_backend function."""
        backend = get_default_search_backend()
        assert isinstance(backend, SearchBackend)

    def test_create_memory_backend(self):
        """Test create_memory_backend function."""
        backend = create_memory_backend()
        assert isinstance(backend, InMemorySearchBackend)

    @patch.dict(os.environ, {"SEARCH_BACKEND": "memory"})
    @patch("dotmac.platform.search.factory.settings")
    def test_create_search_backend_from_env_with_env_var(self, mock_settings):
        """Test creating backend from environment variable."""
        mock_settings.features.search_enabled = True

        backend = create_search_backend_from_env()
        assert isinstance(backend, InMemorySearchBackend)

    @patch.dict(os.environ, {}, clear=True)
    @patch("dotmac.platform.search.factory.settings")
    def test_create_search_backend_from_env_default(self, mock_settings):
        """Test creating backend with default when no env var."""
        mock_settings.features.search_enabled = True

        backend = create_search_backend_from_env("memory")
        assert isinstance(backend, InMemorySearchBackend)

    @patch("dotmac.platform.search.factory.settings")
    def test_create_search_backend_from_env_disabled(self, mock_settings):
        """Test creating backend when search disabled."""
        mock_settings.features.search_enabled = False

        backend = create_search_backend_from_env()
        assert isinstance(backend, InMemorySearchBackend)


@pytest.mark.integration
class TestInMemorySearchBackend:
    """Test InMemorySearchBackend implementation."""

    @pytest.fixture
    def backend(self):
        """Create in-memory search backend."""
        return InMemorySearchBackend()

    @pytest.mark.asyncio
    async def test_index_document(self, backend):
        """Test indexing a document."""
        index_name = "test-index"
        doc_id = "test-1"
        content = {"title": "Test Doc", "content": "This is test content"}

        result = await backend.index(index_name, doc_id, content)

        # Verify document was indexed
        assert result is True
        assert index_name in backend.indices
        assert doc_id in backend.indices[index_name]
        assert backend.indices[index_name][doc_id] == content

    @pytest.mark.asyncio
    async def test_delete_document(self, backend):
        """Test deleting a document."""
        index_name = "test-index"
        doc_id = "test-1"
        content = {"title": "Test Doc", "content": "Test content"}

        # Index then delete
        await backend.index(index_name, doc_id, content)
        result = await backend.delete(index_name, doc_id)

        # Verify document was removed
        assert result is True
        assert doc_id not in backend.indices.get(index_name, {})

    @pytest.mark.asyncio
    async def test_delete_nonexistent_document(self, backend):
        """Test deleting non-existent document doesn't error."""
        result = await backend.delete("nonexistent-index", "nonexistent")
        assert result is False  # Should return False, not raise error

    @pytest.mark.asyncio
    async def test_bulk_index(self, backend):
        """Test bulk indexing documents."""
        index_name = "test-index"
        documents = [
            {"id": "doc1", "title": "Document 1", "content": "Content 1"},
            {"id": "doc2", "title": "Document 2", "content": "Content 2"},
        ]

        count = await backend.bulk_index(index_name, documents)

        # Verify all documents were indexed
        assert count == 2
        assert "doc1" in backend.indices[index_name]
        assert "doc2" in backend.indices[index_name]

    @pytest.mark.asyncio
    async def test_delete_index(self, backend):
        """Test deleting entire index."""
        index_name = "test-index"

        # Index some documents
        await backend.index(index_name, "doc1", {"title": "Test 1"})
        await backend.index(index_name, "doc2", {"title": "Test 2"})

        # Delete index
        result = await backend.delete_index(index_name)

        # Verify index was removed
        assert result is True
        assert index_name not in backend.indices

    @pytest.mark.asyncio
    async def test_search_basic(self, backend):
        """Test basic search functionality."""
        index_name = "test-index"

        # Index documents
        await backend.index(
            index_name, "doc1", {"title": "Python Programming", "content": "Learn Python"}
        )
        await backend.index(
            index_name, "doc2", {"title": "Java Development", "content": "Java tutorial"}
        )

        # Create search query
        query = SearchQuery(query="Python")

        # Search
        results = await backend.search(index_name, query)

        # Verify results
        assert isinstance(results, SearchResponse)
        assert len(results.results) == 1
        assert results.results[0].id == "doc1"
        assert "Python" in results.results[0].data["title"]

    @pytest.mark.asyncio
    async def test_search_with_filters(self, backend):
        """Test search with filters."""
        index_name = "test-index"

        # Index documents with different types
        await backend.index(index_name, "doc1", {"title": "Python", "type": "tutorial"})
        await backend.index(index_name, "doc2", {"title": "Python", "type": "reference"})

        # Search with type filter
        query = SearchQuery(query="Python", filters=[SearchFilter(field="type", value="tutorial")])

        results = await backend.search(index_name, query)

        # Verify filtered results
        assert len(results.results) == 1
        assert results.results[0].id == "doc1"

    @pytest.mark.asyncio
    async def test_search_pagination(self, backend):
        """Test search pagination."""
        index_name = "test-index"

        # Index multiple documents
        for i in range(5):
            await backend.index(
                index_name, f"doc{i}", {"title": f"Document {i}", "content": "test"}
            )

        # Search with pagination
        query = SearchQuery(query="test", offset=2, limit=2)
        results = await backend.search(index_name, query)

        # Verify pagination
        assert len(results.results) == 2
        assert results.total == 5

    @pytest.mark.asyncio
    async def test_search_sorting(self, backend):
        """Test search result sorting."""
        index_name = "test-index"

        # Index documents with scores
        await backend.index(index_name, "doc1", {"title": "A Document", "score": 1})
        await backend.index(index_name, "doc2", {"title": "B Document", "score": 3})
        await backend.index(index_name, "doc3", {"title": "C Document", "score": 2})

        # Search with sorting
        query = SearchQuery(query="Document", sort_by="score", sort_order=SortOrder.DESC)

        results = await backend.search(index_name, query)

        # Verify sorted results
        scores = [int(r.data.get("score", 0)) for r in results.results]
        assert scores == [3, 2, 1]  # Descending order

    @pytest.mark.asyncio
    async def test_search_empty_query(self, backend):
        """Test search with empty query returns all documents."""
        index_name = "test-index"

        # Index documents
        await backend.index(index_name, "doc1", {"title": "First"})
        await backend.index(index_name, "doc2", {"title": "Second"})

        # Empty query
        query = SearchQuery(query="")
        results = await backend.search(index_name, query)

        # Should return all documents
        assert len(results.results) == 2

    @pytest.mark.asyncio
    async def test_search_no_results(self, backend):
        """Test search with no matching results."""
        index_name = "test-index"

        await backend.index(index_name, "doc1", {"title": "Python"})

        query = SearchQuery(query="JavaScript")
        results = await backend.search(index_name, query)

        assert len(results.results) == 0
        assert results.total == 0


@pytest.mark.integration
class TestSearchRouter:
    """Test search router endpoints."""

    @pytest.fixture
    def client(self):
        """Create test client with authentication."""
        from dotmac.platform.auth.core import UserInfo
        from dotmac.platform.auth.dependencies import get_current_user

        app = FastAPI()

        def override_get_current_user():
            return UserInfo(
                user_id="test-user",
                email="test@example.com",
                username="testuser",
                tenant_id="test-tenant",
                roles=["user"],
                permissions=["search"],
            )

        app.dependency_overrides[get_current_user] = override_get_current_user
        app.include_router(search_router, prefix="/search")
        return TestClient(app)

    def test_search_endpoint(self, client):
        """Test search endpoint."""
        response = client.get("/search/?q=test")

        assert response.status_code == 200
        data = response.json()
        assert data["query"] == "test"
        assert "results" in data
        assert "total" in data
        assert "page" in data
        assert "facets" in data

    def test_search_endpoint_with_filters(self, client):
        """Test search endpoint with filters."""
        response = client.get("/search/?q=test&type=document&limit=5&page=1")

        assert response.status_code == 200
        data = response.json()
        assert data["query"] == "test"

    def test_search_endpoint_validation(self, client):
        """Test search endpoint parameter validation."""
        # Test invalid limit
        response = client.get("/search/?q=test&limit=0")
        assert response.status_code == 422

        # Test invalid page
        response = client.get("/search/?q=test&page=0")
        assert response.status_code == 422

        # Test limit too high
        response = client.get("/search/?q=test&limit=101")
        assert response.status_code == 422

    def test_index_content_endpoint(self, client):
        """Test content indexing endpoint."""
        content = {"title": "Test Document", "content": "This is test content", "type": "document"}

        response = client.post("/search/index", json=content)

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Content indexed"
        assert "id" in data

    def test_remove_from_index_endpoint(self, client):
        """Test removing content from index."""
        content_id = "test-doc-123"

        client.post(
            "/search/index",
            json={"id": content_id, "title": "Test", "content": "remove me", "type": "document"},
        )

        response = client.delete(f"/search/index/{content_id}")

        assert response.status_code == 200
        data = response.json()
        assert f"Content {content_id} removed from index" in data["message"]

    def test_search_endpoint_missing_query(self, client):
        """Test search endpoint with missing query parameter."""
        response = client.get("/search/")

        assert response.status_code == 422  # Missing required query parameter


@pytest.mark.integration
class TestSearchService:
    """Test SearchService integration."""

    @pytest.fixture
    def search_service(self):
        """Create search service with in-memory backend."""
        backend = InMemorySearchBackend()
        return SearchService(backend)

    @pytest.mark.asyncio
    async def test_search_service_index_business_entity(self, search_service):
        """Test search service business entity indexing."""
        entity_type = "user"
        entity_id = "user-123"
        entity_data = {"name": "John Doe", "email": "john@example.com"}

        result = await search_service.index_business_entity(entity_type, entity_id, entity_data)
        assert result is True

        # Verify document was indexed in the correct index
        expected_index = "business_user"
        assert expected_index in search_service.backend.indices
        assert entity_id in search_service.backend.indices[expected_index]

    @pytest.mark.asyncio
    async def test_search_service_search_business_entities(self, search_service):
        """Test search service business entity searching."""
        # Index some entities
        await search_service.index_business_entity(
            "user", "user1", {"name": "Alice", "role": "admin"}
        )
        await search_service.index_business_entity("user", "user2", {"name": "Bob", "role": "user"})

        # Search
        query = SearchQuery(query="Alice")
        results = await search_service.search_business_entities("user", query)

        assert isinstance(results, SearchResponse)
        assert len(results.results) == 1
        assert results.results[0].id == "user1"

    @pytest.mark.asyncio
    async def test_search_service_with_different_entity_types(self, search_service):
        """Test search service with different entity types."""
        # Index different entity types
        await search_service.index_business_entity("user", "user1", {"name": "Alice"})
        await search_service.index_business_entity("product", "product1", {"name": "Widget"})

        # Should create separate indices
        assert "business_user" in search_service.backend.indices
        assert "business_product" in search_service.backend.indices

        # Verify documents are in correct indices
        assert "user1" in search_service.backend.indices["business_user"]
        assert "product1" in search_service.backend.indices["business_product"]


@pytest.mark.integration
class TestSearchIntegration:
    """Test search module integration."""

    def test_module_imports(self):
        """Test that all expected classes can be imported."""
        from dotmac.platform.search import (
            InMemorySearchBackend,
            SearchBackend,
            SearchQuery,
            SearchResponse,
            SearchService,
            create_search_backend_from_env,
        )

        # Verify imports work
        assert SearchService is not None
        assert SearchQuery is not None
        assert SearchResult is not None
        assert SearchResponse is not None
        assert SearchBackend is not None
        assert InMemorySearchBackend is not None
        assert create_search_backend_from_env is not None

    def test_factory_integration(self):
        """Test factory creates working backends."""
        backend = create_search_backend("memory")
        assert isinstance(backend, InMemorySearchBackend)

    @pytest.mark.asyncio
    async def test_end_to_end_search_flow(self):
        """Test complete search workflow."""
        # Create backend
        backend = create_search_backend("memory")
        index_name = "test-index"

        # Index documents
        await backend.index(
            index_name,
            "doc1",
            {"title": "Python Tutorial", "content": "Learn Python programming", "type": "tutorial"},
        )

        await backend.index(
            index_name,
            "doc2",
            {"title": "Java Guide", "content": "Java programming guide", "type": "guide"},
        )

        # Search for Python
        query = SearchQuery(query="Python")
        results = await backend.search(index_name, query)

        # Verify results
        assert len(results.results) == 1
        assert results.results[0].data["title"] == "Python Tutorial"

        # Search with filters
        query_filtered = SearchQuery(
            query="programming", filters=[SearchFilter(field="type", value="tutorial")]
        )
        filtered_results = await backend.search(index_name, query_filtered)

        assert len(filtered_results.results) == 1
        assert filtered_results.results[0].data["title"] == "Python Tutorial"


@pytest.mark.integration
class TestEdgeCases:
    """Test edge cases and error conditions."""

    @pytest.mark.asyncio
    async def test_search_backend_empty_index(self):
        """Test searching empty index."""
        backend = InMemorySearchBackend()
        index_name = "empty-index"
        query = SearchQuery(query="anything")
        results = await backend.search(index_name, query)

        assert len(results.results) == 0
        assert results.total == 0

    @pytest.mark.asyncio
    async def test_search_with_special_characters(self):
        """Test search with special characters."""
        backend = InMemorySearchBackend()
        index_name = "test-index"
        await backend.index(index_name, "doc1", {"title": "C++ Programming & Design"})

        query = SearchQuery(query="C++")
        results = await backend.search(index_name, query)

        assert len(results.results) >= 0  # Should not error

    @pytest.mark.asyncio
    async def test_bulk_index_empty_documents(self):
        """Test bulk indexing empty document set."""
        backend = InMemorySearchBackend()
        index_name = "test-index"
        count = await backend.bulk_index(index_name, [])

        # Should not error
        assert count == 0

    def test_factory_create_with_kwargs(self):
        """Test factory passes kwargs to backend constructor."""
        # InMemorySearchBackend doesn't accept extra kwargs, so this should raise TypeError
        with pytest.raises(TypeError):
            SearchBackendFactory.create_backend("memory", some_config="value")
