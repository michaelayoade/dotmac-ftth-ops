"""Tests for error tracking functions."""

from unittest.mock import MagicMock, patch

import pytest
from starlette.requests import Request

from dotmac.platform.monitoring.error_tracking import (
    track_auth_failure,
    track_database_error,
    track_errors,
    track_exception,
    track_external_api_error,
    track_http_error,
    track_minio_error,
    track_rate_limit_violation,
    track_redis_error,
)


@pytest.mark.unit
class TestTrackHTTPError:
    """Test track_http_error function."""

    def test_track_4xx_error(self):
        """Test tracking 4xx client error."""
        with (
            patch("dotmac.platform.monitoring.error_tracking.http_errors_total") as mock_total,
            patch("dotmac.platform.monitoring.error_tracking.http_4xx_errors") as mock_4xx,
        ):
            mock_total.labels.return_value = MagicMock()
            mock_4xx.labels.return_value = MagicMock()

            track_http_error("GET", "/api/users", 404, "tenant-1")

            # Verify both counters were incremented
            mock_total.labels.assert_called_once()
            mock_4xx.labels.assert_called_once()

    def test_track_5xx_error(self):
        """Test tracking 5xx server error."""
        with (
            patch("dotmac.platform.monitoring.error_tracking.http_errors_total") as mock_total,
            patch("dotmac.platform.monitoring.error_tracking.http_5xx_errors") as mock_5xx,
        ):
            mock_total.labels.return_value = MagicMock()
            mock_5xx.labels.return_value = MagicMock()

            track_http_error("POST", "/api/customers", 500, "tenant-2")

            mock_total.labels.assert_called_once()
            mock_5xx.labels.assert_called_once()

    def test_track_error_with_response_time(self):
        """Test tracking error with response time."""
        with (
            patch("dotmac.platform.monitoring.error_tracking.http_errors_total") as mock_total,
            patch("dotmac.platform.monitoring.error_tracking.error_response_time") as mock_time,
        ):
            mock_total.labels.return_value = MagicMock()
            mock_time_obj = MagicMock()
            mock_time.labels.return_value = mock_time_obj

            track_http_error("GET", "/api/test", 500, "tenant-1", response_time=0.5)

            mock_time_obj.observe.assert_called_with(0.5)


@pytest.mark.unit
class TestTrackException:
    """Test track_exception function."""

    def test_track_exception_basic(self):
        """Test basic exception tracking."""
        with patch("dotmac.platform.monitoring.error_tracking.exceptions_total") as mock_counter:
            mock_counter.labels.return_value = MagicMock()

            exc = ValueError("Test error")
            track_exception(exc, module="test_module", tenant_id="tenant-1")

            mock_counter.labels.assert_called_once()
            call_kwargs = mock_counter.labels.call_args[1]
            assert call_kwargs["exception_type"] == "ValueError"
            assert call_kwargs["module"] == "test_module"
            assert call_kwargs["tenant_id"] == "tenant-1"

    def test_track_exception_with_endpoint(self):
        """Test exception tracking with endpoint."""
        with (
            patch("dotmac.platform.monitoring.error_tracking.exceptions_total") as mock_total,
            patch(
                "dotmac.platform.monitoring.error_tracking.exception_by_endpoint"
            ) as mock_endpoint,
        ):
            mock_total.labels.return_value = MagicMock()
            mock_endpoint.labels.return_value = MagicMock()

            exc = RuntimeError("Runtime error")
            track_exception(exc, module="api", endpoint="/api/test", tenant_id="tenant-1")

            # Both counters should be incremented
            mock_total.labels.assert_called_once()
            mock_endpoint.labels.assert_called_once()


@pytest.mark.unit
class TestTrackDatabaseError:
    """Test track_database_error function."""

    def test_track_database_error_basic(self):
        """Test basic database error tracking."""
        with patch(
            "dotmac.platform.monitoring.error_tracking.database_errors_total"
        ) as mock_counter:
            mock_counter.labels.return_value = MagicMock()

            exc = Exception("Database error")
            track_database_error(exc, operation="SELECT", tenant_id="tenant-1")

            mock_counter.labels.assert_called_once()

    def test_track_connection_failure(self):
        """Test tracking database connection failure."""
        with (
            patch("dotmac.platform.monitoring.error_tracking.database_errors_total") as mock_total,
            patch(
                "dotmac.platform.monitoring.error_tracking.database_connection_failures"
            ) as mock_conn,
        ):
            mock_total.labels.return_value = MagicMock()
            mock_conn.labels.return_value = MagicMock()

            # Create a connection error
            class ConnectionError(Exception):
                pass

            exc = ConnectionError("Connection failed")
            track_database_error(exc, operation="CONNECT", tenant_id="tenant-1")

            # Connection failures counter should be incremented
            mock_conn.labels.assert_called_once()

    def test_track_query_timeout(self):
        """Test tracking database query timeout."""
        with (
            patch("dotmac.platform.monitoring.error_tracking.database_errors_total") as mock_total,
            patch(
                "dotmac.platform.monitoring.error_tracking.database_query_timeouts"
            ) as mock_timeout,
        ):
            mock_total.labels.return_value = MagicMock()
            mock_timeout.labels.return_value = MagicMock()

            # Create a timeout error
            class TimeoutError(Exception):
                pass

            exc = TimeoutError("Query timeout")
            track_database_error(exc, operation="SELECT", table="users", tenant_id="tenant-1")

            # Timeout counter should be incremented
            mock_timeout.labels.assert_called_once()


@pytest.mark.unit
class TestTrackAuthFailure:
    """Test track_auth_failure function."""

    def test_track_auth_failure_basic(self):
        """Test basic auth failure tracking."""
        with patch("dotmac.platform.monitoring.error_tracking.auth_failures_total") as mock_counter:
            mock_counter.labels.return_value = MagicMock()

            track_auth_failure("invalid_credentials", tenant_id="tenant-1")

            mock_counter.labels.assert_called_once()

    def test_track_invalid_token(self):
        """Test tracking invalid token attempt."""
        with (
            patch("dotmac.platform.monitoring.error_tracking.auth_failures_total") as mock_failures,
            patch("dotmac.platform.monitoring.error_tracking.invalid_token_attempts") as mock_token,
        ):
            mock_failures.labels.return_value = MagicMock()
            mock_token.labels.return_value = MagicMock()

            track_auth_failure("expired_token", tenant_id="tenant-1", token_type="access")

            # Both counters should be incremented
            mock_failures.labels.assert_called_once()
            mock_token.labels.assert_called_once()


@pytest.mark.unit
class TestTrackRateLimitViolation:
    """Test track_rate_limit_violation function."""

    def test_track_rate_limit(self):
        """Test tracking rate limit violation."""
        with patch("dotmac.platform.monitoring.error_tracking.rate_limit_exceeded") as mock_counter:
            mock_counter.labels.return_value = MagicMock()

            track_rate_limit_violation("/api/users", tenant_id="tenant-1")

            mock_counter.labels.assert_called_once()
            call_kwargs = mock_counter.labels.call_args[1]
            assert call_kwargs["endpoint"] == "/api/users"
            assert call_kwargs["tenant_id"] == "tenant-1"


@pytest.mark.unit
class TestTrackExternalAPIError:
    """Test track_external_api_error function."""

    def test_track_external_api_error(self):
        """Test tracking external API error."""
        with patch("dotmac.platform.monitoring.error_tracking.external_api_errors") as mock_counter:
            mock_counter.labels.return_value = MagicMock()

            exc = Exception("API error")
            track_external_api_error("stripe", exc, tenant_id="tenant-1")

            mock_counter.labels.assert_called_once()
            call_kwargs = mock_counter.labels.call_args[1]
            assert call_kwargs["service"] == "stripe"
            assert call_kwargs["error_type"] == "Exception"


@pytest.mark.unit
class TestTrackRedisError:
    """Test track_redis_error function."""

    def test_track_redis_error(self):
        """Test tracking Redis error."""
        with patch("dotmac.platform.monitoring.error_tracking.redis_errors_total") as mock_counter:
            mock_counter.labels.return_value = MagicMock()

            exc = Exception("Redis connection failed")
            track_redis_error("GET", exc, tenant_id="tenant-1")

            mock_counter.labels.assert_called_once()
            call_kwargs = mock_counter.labels.call_args[1]
            assert call_kwargs["operation"] == "GET"
            assert call_kwargs["tenant_id"] == "tenant-1"


@pytest.mark.unit
class TestTrackMinioError:
    """Test track_minio_error function."""

    def test_track_minio_error(self):
        """Test tracking MinIO error."""
        with patch("dotmac.platform.monitoring.error_tracking.minio_errors_total") as mock_counter:
            mock_counter.labels.return_value = MagicMock()

            exc = Exception("Upload failed")
            track_minio_error("upload", exc, tenant_id="tenant-1")

            mock_counter.labels.assert_called_once()
            call_kwargs = mock_counter.labels.call_args[1]
            assert call_kwargs["operation"] == "upload"
            assert call_kwargs["tenant_id"] == "tenant-1"


@pytest.mark.unit
class TestTrackErrorsDecorator:
    """Test track_errors decorator."""

    def test_decorator_on_async_function(self):
        """Test decorator tracks exceptions in async functions."""
        with patch("dotmac.platform.monitoring.error_tracking.track_exception") as mock_track:

            @track_errors(module="test_module", endpoint="/test")
            async def failing_func():
                raise ValueError("Test error")

            import asyncio

            with pytest.raises(ValueError, match="Test error"):
                asyncio.run(failing_func())

            # Verify exception was tracked
            mock_track.assert_called_once()
            call_kwargs = mock_track.call_args[1]
            assert isinstance(call_kwargs["exception"], ValueError)
            assert call_kwargs["module"] == "test_module"
            assert call_kwargs["endpoint"] == "/test"

    def test_decorator_on_sync_function(self):
        """Test decorator tracks exceptions in sync functions."""
        with patch("dotmac.platform.monitoring.error_tracking.track_exception") as mock_track:

            @track_errors(module="test_module", endpoint="/test")
            def failing_func():
                raise RuntimeError("Sync error")

            with pytest.raises(RuntimeError, match="Sync error"):
                failing_func()

            # Verify exception was tracked
            mock_track.assert_called_once()
            call_kwargs = mock_track.call_args[1]
            assert isinstance(call_kwargs["exception"], RuntimeError)
            assert call_kwargs["module"] == "test_module"

    def test_decorator_extracts_tenant_from_request(self):
        """Test decorator extracts tenant ID from request."""
        with patch("dotmac.platform.monitoring.error_tracking.track_exception") as mock_track:

            @track_errors(module="test_module")
            async def failing_func_with_request(request: Request):
                raise ValueError("Test error")

            # Create mock request with tenant ID in headers
            mock_request = MagicMock(spec=Request)
            mock_request.headers.get.return_value = "tenant-123"

            import asyncio

            with pytest.raises(ValueError):
                asyncio.run(failing_func_with_request(mock_request))

            # Verify tenant_id was extracted
            call_kwargs = mock_track.call_args[1]
            assert call_kwargs["tenant_id"] == "tenant-123"

    def test_decorator_allows_successful_execution(self):
        """Test decorator doesn't interfere with successful execution."""

        @track_errors(module="test_module")
        async def successful_func():
            return "success"

        import asyncio

        result = asyncio.run(successful_func())
        assert result == "success"
