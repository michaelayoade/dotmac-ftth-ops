"""
Tests for search API router.
"""

from typing import Any
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.search.interfaces import SearchBackend
from dotmac.platform.search.router import SearchResponse, SearchResult, search_router

pytestmark = pytest.mark.integration


@pytest.fixture
def app():
    """Create FastAPI app with search router."""
    app = FastAPI()
    app.include_router(search_router, prefix="/search")
    return app


@pytest.fixture
def client(app):
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def mock_user():
    """Create mock user."""
    return UserInfo(
        user_id="test-user-123",
        username="testuser",
        email="test@example.com",
        tenant_id="test-tenant",
        roles=["user"],
        permissions=["read", "write"],
    )


class TestSearchRouter:
    """Test search router endpoints."""

    def test_search_endpoint_success(self, client, mock_user):
        """Test successful search request."""
        # Need to mock as a dependency override
        from dotmac.platform.search.router import get_current_user

        client.app.dependency_overrides[get_current_user] = lambda: mock_user

        response = client.get("/search/?q=test+query&limit=5&page=1")

        assert response.status_code == 200
        data = response.json()

        # Validate response structure
        assert "query" in data
        assert "results" in data
        assert "total" in data
        assert "page" in data
        assert "facets" in data

        assert data["query"] == "test query"
        assert data["page"] == 1
        assert isinstance(data["results"], list)
        assert isinstance(data["total"], int)
        assert isinstance(data["facets"], dict)

        # Check mock result
        if data["results"]:
            result = data["results"][0]
            assert "id" in result
            assert "type" in result
            assert "title" in result
            assert "content" in result
            assert "score" in result
            assert "metadata" in result

    def test_search_endpoint_with_type_filter(self, client, mock_user):
        """Test search with type filter."""
        from dotmac.platform.search.router import get_current_user

        client.app.dependency_overrides[get_current_user] = lambda: mock_user

        response = client.get("/search/?q=test&type=document&limit=10")

        assert response.status_code == 200
        data = response.json()
        assert data["query"] == "test"

    def test_search_endpoint_pagination_limits(self, client, mock_user):
        """Test search pagination limits."""
        from dotmac.platform.search.router import get_current_user

        client.app.dependency_overrides[get_current_user] = lambda: mock_user

        # Test minimum limit
        response = client.get("/search/?q=test&limit=1&page=1")
        assert response.status_code == 200

        # Test maximum limit
        response = client.get("/search/?q=test&limit=100&page=1")
        assert response.status_code == 200

        # Test limit too high (should fail validation)
        response = client.get("/search/?q=test&limit=101")
        assert response.status_code == 422

        # Test limit too low (should fail validation)
        response = client.get("/search/?q=test&limit=0")
        assert response.status_code == 422

        # Test page too low (should fail validation)
        response = client.get("/search/?q=test&page=0")
        assert response.status_code == 422

    def test_search_endpoint_missing_query(self, client, mock_user):
        """Test search without required query parameter."""
        from dotmac.platform.search.router import get_current_user

        client.app.dependency_overrides[get_current_user] = lambda: mock_user

        response = client.get("/search/")
        assert response.status_code == 422  # Missing required 'q' parameter

    def test_search_endpoint_default_values(self, client, mock_user):
        """Test search with default parameter values."""
        from dotmac.platform.search.router import get_current_user

        client.app.dependency_overrides[get_current_user] = lambda: mock_user

        response = client.get("/search/?q=test")

        assert response.status_code == 200
        data = response.json()

        # Should use default values: limit=10, page=1
        assert data["page"] == 1

    def test_search_endpoint_unauthorized(self, client):
        """Test search endpoint without authentication."""
        # No mock for get_current_user - should fail authentication
        response = client.get("/search/?q=test")

        # Depending on auth implementation, this might be 401 or 403
        assert response.status_code in [401, 403]

    @patch("dotmac.platform.search.router.logger")
    def test_search_endpoint_logging(self, mock_logger, client, mock_user):
        """Test that search requests are logged."""
        from dotmac.platform.search.router import get_current_user

        client.app.dependency_overrides[get_current_user] = lambda: mock_user

        response = client.get("/search/?q=important+search&limit=5")

        assert response.status_code == 200

        # Verify logging was called
        mock_logger.info.assert_called_once()
        _, kwargs = mock_logger.info.call_args
        assert kwargs["user_id"] == "test-user-123"
        assert kwargs["query"] == "important search"

    def test_index_content_authenticated(self, client, mock_user):
        """Test indexing content with authenticated user."""
        from dotmac.platform.search.router import get_current_user

        client.app.dependency_overrides[get_current_user] = lambda: mock_user

        content = {
            "title": "Test Document",
            "content": "This is test content for indexing",
            "category": "test",
        }

        response = client.post("/search/index", json=content)

        assert response.status_code == 200
        data = response.json()

        assert data["message"] == "Content indexed"
        assert isinstance(data["id"], str)
        assert data["type"] == "document"

        # Verify the indexed document is searchable
        search_response = client.get("/search/?q=Test")
        assert search_response.status_code == 200
        search_data = search_response.json()
        assert search_data["total"] >= 1
        assert any(result["id"] == data["id"] for result in search_data["results"])

    def test_index_content_anonymous(self, client):
        """Test indexing content without authentication."""
        content = {"title": "Test Document", "content": "This is test content"}

        # This endpoint requires authentication, so should return 401
        response = client.post("/search/index", json=content)

        assert response.status_code == 401

    def test_index_content_logging_anonymous(self, client):
        """Test indexing content logging for anonymous user."""
        content = {"title": "Test Document"}

        # This endpoint requires authentication, so should return 401
        response = client.post("/search/index", json=content)

        assert response.status_code == 401

    @patch("dotmac.platform.search.router.logger")
    def test_index_content_logging_authenticated(self, mock_logger, client, mock_user):
        """Test indexing content logging for authenticated user."""
        from dotmac.platform.search.router import get_current_user

        client.app.dependency_overrides[get_current_user] = lambda: mock_user
        content = {"title": "Test Document", "type": "document"}

        response = client.post("/search/index", json=content)

        assert response.status_code == 200
        mock_logger.info.assert_called_once()
        log_args, log_kwargs = mock_logger.info.call_args
        assert log_args[0] == "search.index.request"
        assert log_kwargs["user_id"] == "test-user-123"
        assert log_kwargs["index"].endswith("_test-tenant")

    def test_index_content_invalid_json(self, client):
        """Test indexing with invalid JSON."""
        response = client.post(
            "/search/index", content="invalid json", headers={"Content-Type": "application/json"}
        )

        assert response.status_code == 422

    def test_remove_from_index_authenticated(self, client, mock_user):
        """Test removing content from index with authenticated user."""
        from dotmac.platform.search.router import get_current_user

        client.app.dependency_overrides[get_current_user] = lambda: mock_user

        # Index a document first
        index_response = client.post(
            "/search/index",
            json={"id": "test-content-id", "title": "To be removed", "type": "document"},
        )
        assert index_response.status_code == 200

        response = client.delete("/search/index/test-content-id")

        assert response.status_code == 200
        data = response.json()

        assert data["message"] == "Content test-content-id removed from index"
        assert data["removed_from"]

    def test_remove_from_index_anonymous(self, client):
        """Test removing content from index without authentication."""
        response = client.delete("/search/index/test-content-id")

        # This endpoint requires authentication, so should return 401
        assert response.status_code == 401

    def test_remove_from_index_logging_anonymous(self, client):
        """Test removing content logging for anonymous user."""
        response = client.delete("/search/index/test-id")

        # This endpoint requires authentication, so should return 401
        assert response.status_code == 401

    @patch("dotmac.platform.search.router.logger")
    def test_remove_from_index_logging_authenticated(self, mock_logger, client, mock_user):
        """Test removing content logging for authenticated user."""
        from dotmac.platform.search.router import get_current_user

        client.app.dependency_overrides[get_current_user] = lambda: mock_user

        client.post(
            "/search/index",
            json={"id": "test-id", "title": "To be removed", "type": "document"},
        )

        response = client.delete("/search/index/test-id")

        assert response.status_code == 200
        assert mock_logger.info.call_count >= 1
        log_args, log_kwargs = mock_logger.info.call_args
        assert log_args[0] == "search.index.remove"
        assert log_kwargs["user_id"] == "test-user-123"
        assert log_kwargs["doc_id"] == "test-id"

    def test_remove_from_index_special_characters(self, client, mock_user):
        """Test removing content with special characters in ID."""
        from dotmac.platform.search.router import get_current_user

        client.app.dependency_overrides[get_current_user] = lambda: mock_user

        content_id = "test-id-with-special@chars"  # Some special chars get URL encoded
        client.post(
            "/search/index",
            json={"id": content_id, "title": "Special", "type": "document"},
        )
        response = client.delete(f"/search/index/{content_id}")

        assert response.status_code == 200
        data = response.json()
        assert content_id in data["message"]

    def test_remove_from_index_not_found(self, client, mock_user):
        """Deleting a non-existent document should return 404."""
        from dotmac.platform.search.router import get_current_user

        client.app.dependency_overrides[get_current_user] = lambda: mock_user

        response = client.delete("/search/index/does-not-exist")
        assert response.status_code == 404

    @patch("dotmac.platform.search.router.logger")
    def test_index_content_fallback_to_memory(self, mock_logger, client, mock_user, monkeypatch):
        """When backend communication fails, router should fall back to in-memory backend."""
        from dotmac.platform.search.interfaces import SearchQuery, SearchResponse
        from dotmac.platform.search.router import (
            _COMMUNICATION_ERRORS,
            _backend_state,
            get_current_user,
        )

        class FailingBackend(SearchBackend):
            async def index(self, index_name: str, doc_id: str, document: dict[str, Any]) -> bool:
                raise RuntimeError("backend down")

            async def search(self, index_name: str, query: SearchQuery) -> SearchResponse:
                raise RuntimeError("backend down")

            async def delete(self, index_name: str, doc_id: str) -> bool:
                raise RuntimeError("backend down")

            async def update(self, index_name: str, doc_id: str, document: dict[str, Any]) -> bool:
                raise RuntimeError("backend down")

            async def bulk_index(self, index_name: str, documents: list[dict[str, Any]]) -> int:
                raise RuntimeError("backend down")

            async def create_index(
                self, index_name: str, mappings: dict[str, Any] | None = None
            ) -> bool:
                raise RuntimeError("backend down")

            async def delete_index(self, index_name: str) -> bool:
                raise RuntimeError("backend down")

        client.app.dependency_overrides[get_current_user] = lambda: mock_user

        original_backend = _backend_state._backend
        original_types = set(_backend_state.known_types)
        original_comm_errors = _COMMUNICATION_ERRORS

        try:
            _backend_state._backend = FailingBackend()
            monkeypatch.setattr(
                "dotmac.platform.search.router._COMMUNICATION_ERRORS",
                original_comm_errors + (RuntimeError,),
                raising=False,
            )

            response = client.post(
                "/search/index",
                json={"title": "Fallback Document", "content": "resilient"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["message"] == "Content indexed"

            # Ensure fallback logger captured communication error and request
            logged_events = [call[0][0] for call in mock_logger.warning.call_args_list]
            assert any("fallback_to_memory" in event for event in logged_events)

            # Indexed document should now be searchable via the in-memory backend
            search_response = client.get("/search/?q=Fallback")
            assert search_response.status_code == 200
            results = search_response.json()["results"]
            assert any(result["title"] == "Fallback Document" for result in results)
        finally:
            _backend_state._backend = original_backend
            _backend_state.known_types = original_types
            monkeypatch.setattr(
                "dotmac.platform.search.router._COMMUNICATION_ERRORS",
                original_comm_errors,
                raising=False,
            )


class TestSearchResponseModels:
    """Test search response models."""

    def test_search_result_model(self):
        """Test SearchResult model validation."""
        result_data = {
            "id": "test-123",
            "type": "document",
            "title": "Test Document",
            "content": "This is test content snippet",
            "score": 0.95,
            "metadata": {"category": "test", "tags": ["python", "search"]},
        }

        result = SearchResult(**result_data)

        assert result.id == "test-123"
        assert result.type == "document"
        assert result.title == "Test Document"
        assert result.content == "This is test content snippet"
        assert result.score == 0.95
        assert result.metadata == {"category": "test", "tags": ["python", "search"]}

    def test_search_result_model_defaults(self):
        """Test SearchResult model with default values."""
        result_data = {
            "id": "test-123",
            "type": "document",
            "title": "Test Document",
            "content": "Test content",
            "score": 0.85,
            # metadata should use default empty dict
        }

        result = SearchResult(**result_data)

        assert result.metadata == {}

    def test_search_response_model(self):
        """Test SearchResponse model validation."""
        result = SearchResult(id="1", type="doc", title="Test", content="Content", score=0.9)

        response_data = {
            "query": "test search",
            "results": [result],
            "total": 1,
            "page": 1,
            "facets": {"types": {"document": 1}, "categories": {"tech": 1}},
        }

        response = SearchResponse(**response_data)

        assert response.query == "test search"
        assert len(response.results) == 1
        assert response.results[0] == result
        assert response.total == 1
        assert response.page == 1
        assert response.facets == {"types": {"document": 1}, "categories": {"tech": 1}}

    def test_search_response_model_defaults(self):
        """Test SearchResponse model with default values."""
        response_data = {
            "query": "test",
            "results": [],
            "total": 0,
            "page": 1,
            # facets should use default empty dict
        }

        response = SearchResponse(**response_data)

        assert response.facets == {}

    def test_search_result_model_validation_errors(self):
        """Test SearchResult model validation errors."""
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            SearchResult()  # Missing required fields

        # Test that all required fields work when provided
        result = SearchResult(id="test-123", type="doc", title="Test", content="Content", score=0.9)
        assert result.id == "test-123"

    def test_search_response_model_validation_errors(self):
        """Test SearchResponse model validation errors."""
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            SearchResponse()  # Missing required fields

        with pytest.raises(ValidationError):
            SearchResponse(query="test", results="not a list", total=0, page=1)  # Should be list


class TestRouterIntegration:
    """Integration tests for search router."""

    def test_complete_search_flow(self, client, mock_user):
        """Test complete search workflow."""
        from dotmac.platform.search.router import get_current_user

        client.app.dependency_overrides[get_current_user] = lambda: mock_user

        # Index some content
        content1 = {"title": "Python Tutorial", "content": "Learn Python programming"}
        content2 = {"title": "Web Development", "content": "Build web applications"}

        response1 = client.post("/search/index", json=content1)
        response2 = client.post("/search/index", json=content2)

        assert response1.status_code == 200
        assert response2.status_code == 200
        doc_id = response1.json()["id"]

        # Search for content
        search_response = client.get("/search/?q=Python&limit=10")

        assert search_response.status_code == 200
        search_data = search_response.json()
        assert search_data["query"] == "Python"
        assert any(result["id"] == doc_id for result in search_data["results"])

        # Remove content from index
        remove_response = client.delete(f"/search/index/{doc_id}")

        assert remove_response.status_code == 200
        remove_data = remove_response.json()
        assert "removed from index" in remove_data["message"]

    def test_router_exports(self):
        """Test that router exports are correct."""
        from dotmac.platform.search.router import __all__

        assert "search_router" in __all__
        assert len(__all__) == 1

    def test_search_query_encoding(self, client, mock_user):
        """Test search with URL-encoded queries."""
        from dotmac.platform.search.router import get_current_user

        client.app.dependency_overrides[get_current_user] = lambda: mock_user

        # Test with spaces and special characters
        query = "python programming & web development"
        encoded_query = query.replace(" ", "+").replace("&", "%26")

        response = client.get(f"/search/?q={encoded_query}")

        assert response.status_code == 200
        data = response.json()
        assert data["query"] == query

    def test_search_edge_cases(self, client, mock_user):
        """Test search edge cases."""
        from dotmac.platform.search.router import get_current_user

        client.app.dependency_overrides[get_current_user] = lambda: mock_user

        # Empty query
        response = client.get("/search/?q=")
        assert response.status_code == 200

        # Very long query
        long_query = "a" * 1000
        response = client.get(f"/search/?q={long_query}")
        assert response.status_code == 200

        # Special characters in query
        special_query = "test@#$%^&*()_+{}|:<>?[]\\;'\",./"
        response = client.get(f"/search/?q={special_query}")
        assert response.status_code == 200

    def test_search_pagination_across_indices(self, client, mock_user):
        """Pagination should work across multiple entity indices."""
        from dotmac.platform.search.router import get_current_user

        client.app.dependency_overrides[get_current_user] = lambda: mock_user

        client.post(
            "/search/index",
            json={
                "id": "doc-1",
                "title": "Doc One",
                "content": "First document",
                "type": "customer",
            },
        )
        client.post(
            "/search/index",
            json={
                "id": "doc-2",
                "title": "Doc Two",
                "content": "Second document",
                "type": "ticket",
            },
        )

        first_page = client.get("/search/?q=Doc&limit=1&page=1")
        second_page = client.get("/search/?q=Doc&limit=1&page=2")

        assert first_page.status_code == 200
        assert second_page.status_code == 200

        first_ids = [result["id"] for result in first_page.json()["results"]]
        second_ids = [result["id"] for result in second_page.json()["results"]]

        assert first_ids
        assert second_ids
        assert first_ids != second_ids
