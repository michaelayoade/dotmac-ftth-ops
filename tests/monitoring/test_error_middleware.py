"""Tests for error tracking middleware."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.testclient import TestClient

from dotmac.platform.monitoring.error_middleware import (
    ErrorTrackingMiddleware,
)


@pytest.mark.unit
class TestErrorTrackingMiddleware:
    """Test ErrorTrackingMiddleware class."""

    @pytest.fixture
    def app(self):
        """Create test FastAPI application."""
        app = FastAPI()

        @app.get("/success")
        async def success():
            return {"status": "ok"}

        @app.get("/not-found")
        async def not_found():
            return JSONResponse(status_code=404, content={"error": "Not found"})

        @app.get("/server-error")
        async def server_error():
            return JSONResponse(status_code=500, content={"error": "Server error"})

        @app.get("/exception")
        async def exception_route():
            raise ValueError("Test exception")

        # Add middleware
        app.add_middleware(ErrorTrackingMiddleware)
        return app

    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return TestClient(app)

    def test_middleware_initialization(self):
        """Test middleware initializes correctly."""
        app = MagicMock()
        middleware = ErrorTrackingMiddleware(app)
        assert middleware.app == app

    def test_successful_request_no_tracking(self, client):
        """Test successful request doesn't track errors."""
        with patch("dotmac.platform.monitoring.error_middleware.track_http_error") as mock_track:
            response = client.get("/success")
            assert response.status_code == 200
            # Should not track successful requests
            mock_track.assert_not_called()

    def test_404_error_tracking(self, client):
        """Test 404 error is tracked."""
        with patch("dotmac.platform.monitoring.error_middleware.track_http_error") as mock_track:
            response = client.get("/not-found")
            assert response.status_code == 404

            # Verify error was tracked
            mock_track.assert_called_once()
            call_kwargs = mock_track.call_args[1]
            assert call_kwargs["method"] == "GET"
            assert call_kwargs["endpoint"] == "/not-found"
            assert call_kwargs["status_code"] == 404

    def test_500_error_tracking(self, client):
        """Test 500 error is tracked."""
        with patch("dotmac.platform.monitoring.error_middleware.track_http_error") as mock_track:
            response = client.get("/server-error")
            assert response.status_code == 500

            # Verify error was tracked
            mock_track.assert_called_once()
            call_kwargs = mock_track.call_args[1]
            assert call_kwargs["status_code"] == 500

    def test_exception_tracking(self, client):
        """Test unhandled exceptions are tracked."""
        with (
            patch("dotmac.platform.monitoring.error_middleware.track_exception") as mock_track_exc,
        ):
            # Exception should be raised
            with pytest.raises(ValueError, match="Test exception"):
                client.get("/exception")

            # Verify exception was tracked
            mock_track_exc.assert_called_once()
            call_kwargs = mock_track_exc.call_args[1]
            assert isinstance(call_kwargs["exception"], ValueError)
            assert call_kwargs["module"] == "api"
            assert call_kwargs["endpoint"] == "/exception"

    def test_tenant_id_extraction_from_state(self):
        """Test tenant ID is extracted from request state."""
        app = FastAPI()

        @app.get("/test")
        async def test_route(request: Request):
            # Set tenant_id in state
            request.state.tenant_id = "tenant-123"
            return JSONResponse(status_code=404, content={"error": "Not found"})

        app.add_middleware(ErrorTrackingMiddleware)
        client = TestClient(app)

        with patch("dotmac.platform.monitoring.error_middleware.track_http_error") as mock_track:
            response = client.get("/test")
            assert response.status_code == 404

            # Verify tenant_id was passed
            call_kwargs = mock_track.call_args[1]
            assert call_kwargs["tenant_id"] == "tenant-123"

    def test_tenant_id_unknown_when_not_in_state(self, client):
        """Test tenant ID is 'unknown' when not in request state."""
        with patch("dotmac.platform.monitoring.error_middleware.track_http_error") as mock_track:
            response = client.get("/not-found")
            assert response.status_code == 404

            # Verify tenant_id falls back to 'unknown' when not set
            call_kwargs = mock_track.call_args[1]
            assert call_kwargs["tenant_id"] == "unknown"
