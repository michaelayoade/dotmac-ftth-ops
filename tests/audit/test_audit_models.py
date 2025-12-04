"""
Tests for audit models and database operations.

This test file applies the fake implementation pattern by:
1. Actually importing the module being tested
2. Testing real Pydantic validators and model behavior
3. Avoiding over-mocking that produces 0% coverage
"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

# Import the entire module to ensure it's loaded for coverage
from dotmac.platform.audit.models import (
    ActivitySeverity,
    ActivityType,
    AuditActivity,
    AuditActivityCreate,
    AuditActivityList,
    AuditActivityResponse,
    AuditFilterParams,
    FrontendLogEntry,
    FrontendLogLevel,
    FrontendLogsRequest,
    FrontendLogsResponse,
)


@pytest.mark.unit
class TestAuditModels:
    """Test audit model definitions and validation."""

    def test_audit_activity_model_creation(self):
        """Test creating an AuditActivity model instance."""
        activity = AuditActivity(
            id=uuid4(),
            activity_type=ActivityType.USER_LOGIN,
            severity=ActivitySeverity.LOW,
            user_id="user123",
            tenant_id="tenant456",
            action="login",
            description="User logged in",
            timestamp=datetime.now(UTC),
        )

        assert activity.activity_type == ActivityType.USER_LOGIN
        assert activity.severity == ActivitySeverity.LOW
        assert activity.user_id == "user123"
        assert activity.tenant_id == "tenant456"

    def test_audit_activity_create_validation(self):
        """Test AuditActivityCreate Pydantic model validation."""
        # Valid data
        valid_data = AuditActivityCreate(
            activity_type=ActivityType.SECRET_CREATED,
            severity=ActivitySeverity.MEDIUM,
            user_id="user123",
            tenant_id="tenant456",
            action="create_secret",
            description="Created new secret",
            resource_type="secret",
            resource_id="secret/path/key",
        )

        assert valid_data.activity_type == ActivityType.SECRET_CREATED
        assert valid_data.severity == ActivitySeverity.MEDIUM

        # Test default severity
        default_severity = AuditActivityCreate(
            activity_type=ActivityType.API_REQUEST,
            action="api_call",
            description="API request",
        )
        assert default_severity.severity == ActivitySeverity.LOW

    def test_audit_activity_response_model(self):
        """Test AuditActivityResponse model serialization."""
        activity = AuditActivity(
            id=uuid4(),
            activity_type=ActivityType.FILE_UPLOADED,
            severity=ActivitySeverity.LOW,
            user_id="user123",
            tenant_id="tenant456",
            action="upload",
            description="File uploaded",
            timestamp=datetime.now(UTC),
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        response = AuditActivityResponse.model_validate(activity)
        assert response.activity_type == ActivityType.FILE_UPLOADED
        assert response.user_id == "user123"

    def test_activity_type_enum_values(self):
        """Test ActivityType enum contains expected values."""
        expected_types = [
            "user.login",
            "user.logout",
            "user.created",
            "secret.created",
            "secret.accessed",
            "file.uploaded",
            "api.request",
        ]

        for expected in expected_types:
            assert expected in [t.value for t in ActivityType]

    def test_severity_enum_values(self):
        """Test ActivitySeverity enum values."""
        assert ActivitySeverity.LOW == "low"
        assert ActivitySeverity.MEDIUM == "medium"
        assert ActivitySeverity.HIGH == "high"
        assert ActivitySeverity.CRITICAL == "critical"

    @pytest.mark.asyncio
    async def test_audit_activity_database_constraints(self, async_db_session):
        """Test database constraints on audit_activities table."""
        # Test required fields
        with pytest.raises((TypeError, ValueError)):  # Should fail without required fields
            activity = AuditActivity(
                id=uuid4(),
                activity_type=ActivityType.USER_LOGIN,
                # Missing required tenant_id, action, description
            )
            async_db_session.add(activity)
            await async_db_session.commit()

        await async_db_session.rollback()

        # Test with all required fields
        activity = AuditActivity(
            id=uuid4(),
            activity_type=ActivityType.USER_LOGIN,
            severity=ActivitySeverity.LOW,
            tenant_id="tenant123",  # Required by StrictTenantMixin
            action="login",
            description="User login",
            timestamp=datetime.now(UTC),
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        async_db_session.add(activity)
        await async_db_session.commit()

        assert activity.id is not None

    def test_tenant_id_validator_explicit_value(self):
        """Test tenant_id validator accepts explicit value."""
        # When tenant_id explicitly provided, should use that value
        activity = AuditActivityCreate(
            activity_type=ActivityType.USER_LOGIN,
            tenant_id="explicit-tenant-456",
            action="login",
            description="User login",
        )
        assert activity.tenant_id == "explicit-tenant-456"

    def test_tenant_id_can_be_none(self):
        """Test tenant_id can be None (will be set at service layer)."""
        activity = AuditActivityCreate(
            activity_type=ActivityType.USER_LOGIN,
            action="login",
            description="User login",
        )
        # tenant_id can be None - it's optional at model level
        assert activity.tenant_id is None

    def test_audit_activity_list_model(self):
        """Test AuditActivityList model."""
        activities = [
            AuditActivityResponse(
                id=uuid4(),
                activity_type=ActivityType.USER_LOGIN.value,
                severity=ActivitySeverity.LOW.value,
                user_id="user123",
                tenant_id="tenant456",
                timestamp=datetime.now(UTC),
                resource_type=None,
                resource_id=None,
                action="login",
                description="User logged in",
                details=None,
                ip_address=None,
                user_agent=None,
                request_id=None,
            )
        ]

        activity_list = AuditActivityList(
            activities=activities,
            total=100,
            page=1,
            per_page=50,
            has_next=True,
            has_prev=False,
        )

        assert len(activity_list.activities) == 1
        assert activity_list.total == 100
        assert activity_list.has_next is True

    def test_audit_filter_params_validation(self):
        """Test AuditFilterParams model validation."""
        # Valid filter params
        params = AuditFilterParams(
            tenant_id="tenant123",
            user_id="user456",
            activity_type=ActivityType.SECRET_ACCESSED,
            severity=ActivitySeverity.HIGH,
            page=2,
            per_page=100,
        )

        assert params.tenant_id == "tenant123"
        assert params.user_id == "user456"
        assert params.page == 2
        assert params.per_page == 100

        # Test page validation
        with pytest.raises(ValueError):
            AuditFilterParams(tenant_id="tenant123", page=0)  # page must be >= 1

        # Test per_page validation
        with pytest.raises(ValueError):
            AuditFilterParams(tenant_id="tenant123", per_page=0)  # must be >= 1

        with pytest.raises(ValueError):
            AuditFilterParams(tenant_id="tenant123", per_page=2000)  # must be <= 1000

    def test_frontend_log_entry_model(self):
        """Test FrontendLogEntry model."""
        log = FrontendLogEntry(
            level=FrontendLogLevel.ERROR,
            message="Frontend error occurred",
            service="frontend",
            metadata={"componentName": "LoginForm", "errorCode": "AUTH_001"},
        )

        assert log.level == FrontendLogLevel.ERROR
        assert log.message == "Frontend error occurred"
        assert log.service == "frontend"
        assert log.metadata["componentName"] == "LoginForm"

        # Test message length validation
        with pytest.raises(ValueError):
            FrontendLogEntry(
                level=FrontendLogLevel.ERROR,
                message="",  # Empty message should fail
            )

        # Test message max length
        with pytest.raises(ValueError):
            FrontendLogEntry(
                level=FrontendLogLevel.ERROR,
                message="x" * 1001,  # Over 1000 chars should fail
            )

    def test_frontend_log_metadata_flexibility(self):
        """Test that metadata accepts arbitrary keys (real browser events)."""
        # Simulate various real-world metadata patterns from useAuditLogger and browser events

        # Pattern 1: Error with stack trace
        log1 = FrontendLogEntry(
            level=FrontendLogLevel.ERROR,
            message="Uncaught TypeError",
            metadata={
                "filename": "app.tsx",
                "lineno": 42,
                "colno": 15,
                "stackTrace": "Error: Uncaught TypeError\n  at App.tsx:42:15",
                "errorMessage": "Cannot read property 'foo' of undefined",
            },
        )
        assert log1.metadata["filename"] == "app.tsx"
        assert log1.metadata["lineno"] == 42

        # Pattern 2: User action with visibility
        log2 = FrontendLogEntry(
            level=FrontendLogLevel.INFO,
            message="Button clicked",
            metadata={
                "visible": True,
                "action": "click",
                "buttonId": "submit-btn",
                "timestamp": "2025-11-07T12:00:00Z",
            },
        )
        assert log2.metadata["visible"] is True

        # Pattern 3: Navigation with reason
        log3 = FrontendLogEntry(
            level=FrontendLogLevel.INFO,
            message="Route changed",
            metadata={
                "reason": "user_navigation",
                "from": "/dashboard",
                "to": "/settings",
                "pathname": "/settings",
            },
        )
        assert log3.metadata["reason"] == "user_navigation"

        # Pattern 4: Performance metrics
        log4 = FrontendLogEntry(
            level=FrontendLogLevel.INFO,
            message="Page load complete",
            metadata={
                "duration": 1234,
                "performanceMetrics": {
                    "FCP": 800,
                    "LCP": 1200,
                    "TTI": 1234,
                },
                "url": "https://app.example.com/dashboard",
            },
        )
        assert log4.metadata["duration"] == 1234

    def test_frontend_log_metadata_size_limits(self):
        """Test metadata size/depth/length validation."""
        # Test nesting depth limit (max 5 levels)
        with pytest.raises(ValueError, match="nesting depth exceeds maximum"):
            FrontendLogEntry(
                level=FrontendLogLevel.ERROR,
                message="Deep nesting",
                metadata={
                    "level1": {"level2": {"level3": {"level4": {"level5": {"level6": "too deep"}}}}}
                },
            )

        # Test string length limit (max 2000 chars per value)
        with pytest.raises(ValueError, match="string exceeds maximum length"):
            FrontendLogEntry(
                level=FrontendLogLevel.ERROR,
                message="Long string",
                metadata={"longString": "x" * 2001},
            )

        # Test total payload size (max 10KB)
        with pytest.raises(ValueError, match="payload size.*exceeds maximum"):
            large_metadata = {f"key{i}": "x" * 100 for i in range(200)}  # ~20KB
            FrontendLogEntry(
                level=FrontendLogLevel.ERROR,
                message="Large payload",
                metadata=large_metadata,
            )

    def test_frontend_logs_request_model(self):
        """Test FrontendLogsRequest batch model."""
        logs = [
            FrontendLogEntry(
                level=FrontendLogLevel.ERROR,
                message="Error 1",
            ),
            FrontendLogEntry(
                level=FrontendLogLevel.WARNING,
                message="Warning 1",
            ),
        ]

        request = FrontendLogsRequest(logs=logs)
        assert len(request.logs) == 2
        assert request.logs[0].level == FrontendLogLevel.ERROR

        # Test min_length validation
        with pytest.raises(ValueError):
            FrontendLogsRequest(logs=[])  # Empty list should fail

        # Test max_length validation
        too_many_logs = [
            FrontendLogEntry(level=FrontendLogLevel.INFO, message=f"Log {i}") for i in range(101)
        ]
        with pytest.raises(ValueError):
            FrontendLogsRequest(logs=too_many_logs)  # Over 100 logs should fail

    def test_frontend_logs_response_model(self):
        """Test FrontendLogsResponse model."""
        response = FrontendLogsResponse(
            status="success",
            logs_received=10,
            logs_stored=8,
        )

        assert response.status == "success"
        assert response.logs_received == 10
        assert response.logs_stored == 8

        # Test default status
        response2 = FrontendLogsResponse(logs_received=5, logs_stored=5)
        assert response2.status == "success"

    def test_frontend_log_level_enum(self):
        """Test FrontendLogLevel enum values."""
        assert FrontendLogLevel.ERROR == "ERROR"
        assert FrontendLogLevel.WARNING == "WARNING"
        assert FrontendLogLevel.INFO == "INFO"
        assert FrontendLogLevel.DEBUG == "DEBUG"

    def test_all_activity_types_defined(self):
        """Test that all activity type categories are covered."""
        activity_types = [t.value for t in ActivityType]

        # Auth activities
        assert "user.login" in activity_types
        assert "user.logout" in activity_types
        assert "user.created" in activity_types

        # RBAC activities
        assert "rbac.role.created" in activity_types
        assert "rbac.permission.granted" in activity_types

        # Secret activities
        assert "secret.created" in activity_types
        assert "secret.accessed" in activity_types

        # File activities
        assert "file.uploaded" in activity_types
        assert "file.downloaded" in activity_types

        # API activities
        assert "api.request" in activity_types
        assert "api.error" in activity_types

        # System activities
        assert "system.startup" in activity_types
        assert "system.shutdown" in activity_types

        # Frontend activities
        assert "frontend.log" in activity_types

    def test_pydantic_model_config(self):
        """Test Pydantic model configuration settings."""
        # Test AuditActivityCreate config
        create_config = AuditActivityCreate.model_config
        assert create_config["str_strip_whitespace"] is True
        assert create_config["validate_assignment"] is True
        assert create_config["extra"] == "forbid"

        # Test AuditFilterParams config
        filter_config = AuditFilterParams.model_config
        assert filter_config["str_strip_whitespace"] is True
        assert filter_config["validate_assignment"] is True
        assert filter_config["extra"] == "forbid"

        # Test AuditActivityResponse config
        response_config = AuditActivityResponse.model_config
        assert response_config["from_attributes"] is True

    def test_audit_activity_create_field_constraints(self):
        """Test field constraints on AuditActivityCreate."""
        # Test action min_length
        with pytest.raises(ValueError):
            AuditActivityCreate(
                activity_type=ActivityType.USER_LOGIN,
                tenant_id="tenant123",
                action="",  # Empty action should fail
                description="Test",
            )

        # Test description min_length
        with pytest.raises(ValueError):
            AuditActivityCreate(
                activity_type=ActivityType.USER_LOGIN,
                tenant_id="tenant123",
                action="login",
                description="",  # Empty description should fail
            )
