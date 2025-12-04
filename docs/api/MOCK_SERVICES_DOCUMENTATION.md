# Mock Services Documentation

## Overview
This document provides a comprehensive list of all mock services, mocks, and fallback implementations in the DotMac Platform Services codebase.

## Production Code Mock Services

### 1. User Management Service
**Location**: `src/dotmac/platform/user_management/router.py:76-132`
**Class**: `MockUserService`
**Purpose**: Provides user CRUD operations when real user service is not implemented
**Features**:
- In-memory user storage
- Basic CRUD operations (create, read, update, delete)
- User enable/disable functionality
- Password change simulation

**Usage**:
```python
user_service = MockUserService()  # Line 132
```

### 2. Analytics Service
**Location**: `src/dotmac/platform/analytics/router.py:35-51`
**Class**: `MockAnalyticsService` (inline class)
**Purpose**: Fallback when AnalyticsService or MetricsCollector are not available
**Trigger**: ImportError or TypeError when importing real service
**Features**:
- `track_event()`: Returns mock event ID
- `record_metric()`: No-op
- `query_events()`: Returns empty results
- `get_dashboard()`: Returns empty dashboard
- `create_dashboard()`: Returns mock dashboard ID

**Usage**:
```python
try:
    from dotmac.platform.analytics.service import AnalyticsService
    from dotmac.platform.analytics.collectors import MetricsCollector
    _analytics_service = AnalyticsService(collector=MetricsCollector())
except (ImportError, TypeError):
    class MockAnalyticsService:
        # ... mock implementation
    _analytics_service = MockAnalyticsService()
```

### 3. File Processor
**Location**: `src/dotmac/platform/file_processing/router.py:23-31`
**Class**: `FileProcessor` (mock implementation)
**Purpose**: Provides file processing endpoints when real processor is missing
**Trigger**: ImportError when importing FileProcessor
**Features**:
- `process()`: Returns mock job ID
- `get_job_status()`: Returns mock job status with progress

### 4. File Storage Manager
**Location**: `src/dotmac/platform/file_storage/router.py:25-36`
**Class**: `FileStorageManager` (mock implementation)
**Purpose**: Handles file storage operations when real storage manager is missing
**Trigger**: ImportError when importing FileStorageManager
**Features**:
- `upload()`: Returns mock file metadata
- `get()`: Returns mock file info
- `list()`: Returns empty file list
- `delete()`: Returns success

### 5. Search Results
**Location**: `src/dotmac/platform/search/router.py:40-47`
**Type**: Mock data (not a class)
**Purpose**: Returns sample search results
**Features**: Hardcoded search results for demonstration

## Test Fixtures and Mocks

### Core Test Mocks
**Location**: `tests/conftest.py`

1. **Database Mocks** (lines 118-132):
   - `mock_async_session`: AsyncMock for async database operations
   - `mock_sync_session`: Mock for sync database operations
   - Mock methods: commit, rollback, close

2. **Service Mocks**:
   - `mock_provider` (line 138): Generic async provider mock
   - `mock_config` (line 145): Configuration mock
   - `mock_api_key_service` (line 154): API key operations mock
   - `mock_secrets_manager` (line 164): Secrets management mock

3. **Infrastructure Mocks**:
   - Redis client mock (line 187): Fallback when fakeredis not available
   - Database engine mock (line 284)
   - FastAPI app mock (line 310)
   - Test client mock (line 315)

### GraphQL Test Mocks
**Location**: `tests/graphql/conftest.py`

1. **Authentication Mocks**:
   - `mock_claims` (line 40): User claims for auth testing
   - `mock_auth_context` (line 62): Complete auth context with request mock

2. **Service Mocks**:
   - `mock_jwt_service` (line 176): JWT verification and token operations
   - `mock_feature_service` (line 199): Feature flag management
   - `mock_secrets_service` (line 212): Secrets operations
   - `mock_metrics_registry` (line 221): Metrics retrieval

## Mock Service Patterns

### Pattern 1: Conditional Import with Fallback
```python
try:
    from real.module import RealService
    SERVICE_AVAILABLE = True
except ImportError:
    SERVICE_AVAILABLE = False

    class RealService:  # Mock with same interface
        def method(self):
            return "mock-result"
```

### Pattern 2: Lazy Initialization with Mock Fallback
```python
_service = None

def get_service():
    global _service
    if _service is None:
        try:
            from real.module import RealService
            _service = RealService()
        except ImportError:
            class MockService:
                # mock implementation
            _service = MockService()
    return _service
```

### Pattern 3: Direct Mock Instance
```python
class MockService:
    """Mock service for demonstration."""
    # implementation

service = MockService()  # Used directly in module
```

## When Mocks Are Used

1. **Missing Dependencies**: When optional dependencies are not installed
2. **Development Mode**: For rapid prototyping without full infrastructure
3. **Testing**: Extensive use in test suites for isolation
4. **Demo/Documentation**: MockUserService serves as API documentation

## Migration Path

To replace a mock with real implementation:

1. **For MockUserService**:
   - Implement proper UserService class
   - Connect to user database/identity provider
   - Replace line 132 initialization

2. **For MockAnalyticsService**:
   - Ensure AnalyticsService and MetricsCollector are properly implemented
   - Fix any initialization issues (missing collector parameter)
   - The real service will automatically be used when imports succeed

3. **For File Processing/Storage**:
   - Implement the actual FileProcessor and FileStorageManager classes
   - Ensure they're importable from expected locations
   - The conditional imports will automatically use real implementations

## Notes

- All production mocks follow the same interface as their real counterparts
- Mock services log warnings when used (check for "Mock" in logs)
- Test mocks use `unittest.mock.Mock` and `AsyncMock` for flexibility
- Production mocks return realistic-looking data for UI testing