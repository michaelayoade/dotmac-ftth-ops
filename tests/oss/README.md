# OSS Integration Test Suite

This directory contains comprehensive integration tests for the Operations Support Systems (OSS) module of the DotMac FTTH Operations Platform.

## Overview

The OSS test suite validates the integration between the platform and external network management systems:

- **RADIUS** - Authentication, authorization, and accounting (AAA)
- **NetBox** - IP Address Management (IPAM) and network resource tracking
- **GenieACS** - CPE device management via TR-069/CWMP protocol
- **Service Lifecycle** - End-to-end service orchestration workflows

## Test Architecture

### Directory Structure

```
tests/oss/
├── __init__.py                              # Package initialization
├── conftest.py                              # Shared fixtures and mock utilities
├── test_radius_integration.py               # RADIUS service tests (18 tests)
├── test_netbox_ipam_integration.py          # NetBox IPAM tests (21 tests)
├── test_genieacs_tr069_integration.py       # GenieACS TR-069 tests (22 tests)
├── test_service_lifecycle_automation.py     # Lifecycle orchestration tests (10 tests)
└── README.md                                # This file
```

**Total Test Coverage**: 71 comprehensive integration tests

### Test Organization

Each test file is organized into logical test classes covering specific functionality areas:

| File | Test Classes | Total Tests | Coverage Areas |
|------|-------------|-------------|----------------|
| `test_radius_integration.py` | 6 classes | 18 tests | Subscriber lifecycle, sessions, bandwidth profiles, NAS config, usage monitoring |
| `test_netbox_ipam_integration.py` | 6 classes | 21 tests | IP allocation, prefix management, VLANs, device interfaces, resource lifecycle |
| `test_genieacs_tr069_integration.py` | 7 classes | 22 tests | Device management, parameter config, firmware upgrades, diagnostics, bulk operations |
| `test_service_lifecycle_automation.py` | 6 classes | 10 tests | End-to-end provisioning, modifications, suspension, termination, health checks |

## Running the Tests

### Prerequisites

1. Install development dependencies:
   ```bash
   poetry install --with dev
   ```

2. Ensure the database models are up to date:
   ```bash
   poetry run alembic upgrade head
   ```

### Run All OSS Tests

```bash
poetry run pytest tests/oss/ -v
```

### Run Specific Test Files

```bash
# RADIUS integration tests only
poetry run pytest tests/oss/test_radius_integration.py -v

# NetBox IPAM tests only
poetry run pytest tests/oss/test_netbox_ipam_integration.py -v

# GenieACS TR-069 tests only
poetry run pytest tests/oss/test_genieacs_tr069_integration.py -v

# Service lifecycle tests only
poetry run pytest tests/oss/test_service_lifecycle_automation.py -v
```

### Run Specific Test Classes

```bash
# Run only RADIUS subscriber lifecycle tests
poetry run pytest tests/oss/test_radius_integration.py::TestRADIUSSubscriberLifecycle -v

# Run only end-to-end service provisioning tests
poetry run pytest tests/oss/test_service_lifecycle_automation.py::TestEndToEndServiceProvisioning -v
```

### Run Specific Test Cases

```bash
# Run single test for full provisioning workflow
poetry run pytest tests/oss/test_service_lifecycle_automation.py::TestEndToEndServiceProvisioning::test_full_fiber_service_provisioning_workflow -v
```

### Run with Coverage Reporting

```bash
poetry run pytest tests/oss/ --cov=dotmac.oss --cov-report=html --cov-report=term
```

### Run in Parallel (Faster)

```bash
poetry run pytest tests/oss/ -v -n auto
```

## Test Fixtures and Mocks

### Shared Fixtures (conftest.py)

All tests use shared fixtures defined in `tests/oss/conftest.py`:

#### Database Fixtures

- `async_session` - Async SQLite in-memory database session
- `test_tenant_id` - Test tenant identifier ("test-tenant-oss")
- `test_user_id` - Test user UUID for audit trails
- `test_customer_id` - Test customer UUID
- `test_subscription_id` - Test subscription identifier

#### RADIUS Fixtures

- `sample_radius_subscriber_data` - Sample subscriber creation data
- `sample_bandwidth_profile` - Sample bandwidth profile (100 Mbps)
- `sample_nas_server` - Sample NAS server configuration
- `sample_radius_session` - Sample active RADIUS session

#### NetBox/IPAM Fixtures

- `sample_ip_allocation` - Sample IP address allocation
- `sample_vlan_assignment` - Sample VLAN assignment
- `sample_prefix_allocation` - Sample IP prefix pool
- `sample_device_interface` - Sample network device interface

#### GenieACS/TR-069 Fixtures

- `sample_cpe_device` - Sample CPE device (Huawei EG8145V5 ONT)
- `sample_tr069_parameters` - Sample TR-069 configuration parameters
- `sample_tr069_task` - Sample TR-069 provisioning task
- `sample_firmware_upgrade` - Sample firmware upgrade task

#### Service Lifecycle Fixtures

- `sample_service_provisioning_request` - Sample service provisioning request
- `sample_provisioning_workflow` - Sample multi-step provisioning workflow

### Mock Objects

The test suite uses realistic mock objects to simulate external systems without requiring actual infrastructure:

#### MockRADIUSServer

Simulates a RADIUS server for AAA operations:

```python
class MockRADIUSServer:
    def authenticate(self, username: str, password: str) -> bool
    def start_session(self, username: str, session_data: dict) -> str
    def record_accounting(self, session_id: str, acct_data: dict) -> None
```

**Usage**:
```python
def test_radius_authentication(mock_radius_server, sample_radius_subscriber_data):
    mock_radius_server.subscribers["testuser@isp.com"] = sample_radius_subscriber_data
    result = mock_radius_server.authenticate("testuser@isp.com", "SecurePassword123!")
    assert result is True
```

#### MockNetBoxClient

Simulates NetBox API for IPAM operations:

```python
class MockNetBoxClient:
    def allocate_ip(self, prefix: str, tenant: str) -> dict
    def assign_vlan(self, vid: int, tenant: str) -> dict
```

**Usage**:
```python
def test_ip_allocation(mock_netbox_client, test_tenant_id):
    ip_data = mock_netbox_client.allocate_ip("10.0.0.0/24", test_tenant_id)
    assert ip_data["address"] is not None
    assert ip_data["tenant"] == test_tenant_id
```

#### MockGenieACSClient

Simulates GenieACS API for TR-069 device management:

```python
class MockGenieACSClient:
    def get_device(self, device_id: str) -> dict | None
    def set_parameters(self, device_id: str, parameters: dict) -> str
    def trigger_firmware_upgrade(self, device_id: str, firmware_url: str) -> str
```

**Usage**:
```python
def test_cpe_configuration(mock_genieacs_client, sample_cpe_device):
    mock_genieacs_client.devices[sample_cpe_device["device_id"]] = sample_cpe_device
    task_id = mock_genieacs_client.set_parameters(
        sample_cpe_device["device_id"],
        {"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID": "MyWiFi"}
    )
    assert task_id is not None
```

## Test Coverage Details

### 1. RADIUS Integration Tests (test_radius_integration.py)

**File Location**: `tests/oss/test_radius_integration.py:1`

#### TestRADIUSSubscriberLifecycle

Complete subscriber lifecycle management:

- `test_create_subscriber_full_workflow` - Create subscriber with bandwidth profile
- `test_update_subscriber_bandwidth` - Upgrade bandwidth from 100 Mbps to 500 Mbps
- `test_suspend_and_resume_subscriber` - Suspend for non-payment, then resume
- `test_terminate_subscriber` - Delete subscriber and cleanup

#### TestRADIUSSessionManagement

RADIUS session and accounting:

- `test_start_radius_session` - Start new authentication session
- `test_update_session_accounting` - Update accounting data (usage stats)
- `test_stop_radius_session` - Terminate active session
- `test_get_active_sessions` - List all active sessions

#### TestRADIUSBandwidthProfiles

Bandwidth profile management:

- `test_create_bandwidth_profile` - Create 100 Mbps profile
- `test_list_bandwidth_profiles` - List all available profiles
- `test_apply_bandwidth_profile_to_subscriber` - Apply profile to subscriber

#### TestRADIUSNASConfiguration

NAS (Network Access Server) configuration:

- `test_create_nas_server` - Register NAS server (BRAS)
- `test_update_nas_secret` - Update RADIUS shared secret
- `test_list_nas_servers` - List all NAS servers

#### TestRADIUSUsageMonitoring

Usage tracking and reporting:

- `test_get_subscriber_usage` - Get individual subscriber usage stats
- `test_get_tenant_usage_summary` - Aggregate usage across all subscribers

#### TestRADIUSIntegrationWithLifecycle

Integration with service lifecycle:

- `test_provision_service_creates_radius_subscriber` - Verify RADIUS subscriber created during provisioning
- `test_suspend_service_suspends_radius_access` - Verify RADIUS access suspended with service

### 2. NetBox IPAM Integration Tests (test_netbox_ipam_integration.py)

**File Location**: `tests/oss/test_netbox_ipam_integration.py:1`

#### TestNetBoxIPAddressManagement

IP address allocation and management:

- `test_allocate_ip_from_pool` - Allocate IP from prefix pool
- `test_allocate_specific_ip` - Reserve specific IP address
- `test_update_ip_metadata` - Update IP metadata (DNS name, description)
- `test_release_ip_address` - Release IP back to pool
- `test_bulk_ip_allocation` - Allocate 10 IPs simultaneously

#### TestNetBoxPrefixManagement

IP prefix and subnet management:

- `test_create_prefix_pool` - Create prefix pool (10.0.0.0/24)
- `test_get_available_prefixes` - Find available subnets
- `test_allocate_prefix_from_parent` - Hierarchical prefix allocation
- `test_prefix_utilization_tracking` - Track IP utilization percentage

#### TestNetBoxVLANManagement

VLAN management:

- `test_create_vlan` - Create customer VLAN
- `test_assign_vlan_to_interface` - Assign VLAN to device interface
- `test_get_available_vlans` - Find available VLAN IDs

#### TestNetBoxDeviceInterfaces

Network device interface management:

- `test_create_device_interface` - Create OLT interface
- `test_assign_ip_to_interface` - Assign IP to interface
- `test_configure_interface_for_customer` - Complete interface configuration

#### TestNetBoxServiceIntegration

Integration with service lifecycle:

- `test_provision_network_resources_for_service` - Provision IP + VLAN for new service
- `test_reclaim_network_resources_on_termination` - Cleanup resources on service termination
- `test_track_network_resource_lifecycle` - Track resource states through lifecycle

#### TestNetBoxReporting

Network resource reporting:

- `test_get_ip_utilization_report` - IP utilization statistics
- `test_get_vlan_usage_report` - VLAN usage statistics
- `test_get_interface_status_report` - Interface status overview

### 3. GenieACS TR-069 Integration Tests (test_genieacs_tr069_integration.py)

**File Location**: `tests/oss/test_genieacs_tr069_integration.py:1`

#### TestGenieACSDeviceManagement

CPE device discovery and management:

- `test_discover_cpe_device` - Discover and register new CPE device
- `test_get_device_info` - Retrieve device information
- `test_list_devices_by_tenant` - List all tenant devices
- `test_delete_device` - Remove device from management

#### TestGenieACSParameterConfiguration

TR-069 parameter configuration:

- `test_configure_wifi_parameters` - Configure WiFi SSID and password
- `test_configure_wan_connection` - Configure WAN/PPPoE connection
- `test_configure_management_server` - Configure TR-069 management settings
- `test_get_device_parameters` - Retrieve device parameters

#### TestGenieACSFirmwareManagement

Firmware upgrade management:

- `test_trigger_firmware_upgrade` - Immediate firmware upgrade
- `test_schedule_firmware_upgrade` - Schedule upgrade for later
- `test_bulk_firmware_upgrade` - Upgrade 10 devices simultaneously

#### TestGenieACSDiagnostics

Remote diagnostics:

- `test_ping_diagnostic` - Run ping test from CPE
- `test_traceroute_diagnostic` - Run traceroute from CPE
- `test_speed_test_diagnostic` - Run speed test from CPE

#### TestGenieACSBulkOperations

Bulk device operations:

- `test_bulk_parameter_update` - Update parameters on multiple devices
- `test_bulk_reboot` - Reboot multiple devices
- `test_bulk_factory_reset` - Factory reset multiple devices

#### TestGenieACSServiceIntegration

Integration with service lifecycle:

- `test_provision_ont_for_new_service` - Configure ONT during service provisioning
- `test_update_ont_on_service_modification` - Update ONT configuration on service changes
- `test_reset_ont_on_service_termination` - Factory reset ONT on service termination

#### TestGenieACSMonitoring

Device monitoring:

- `test_check_device_online_status` - Check if device is online
- `test_get_device_statistics` - Retrieve device statistics

### 4. Service Lifecycle Automation Tests (test_service_lifecycle_automation.py)

**File Location**: `tests/oss/test_service_lifecycle_automation.py:1`

#### TestEndToEndServiceProvisioning

Complete end-to-end provisioning workflows:

- `test_full_fiber_service_provisioning_workflow` - **COMPREHENSIVE END-TO-END TEST**
  - Validates complete integration of RADIUS + NetBox + GenieACS
  - Steps: Initiate → Allocate Resources → Create RADIUS Subscriber → Configure CPE → Activate → Verify → Health Check
- `test_service_provisioning_with_validation_failure` - Handle validation errors gracefully

#### TestServiceModificationWorkflows

Service modification workflows:

- `test_upgrade_service_bandwidth` - Upgrade from 100 Mbps to 500 Mbps
- `test_enable_managed_wifi` - Add managed WiFi to existing service

#### TestServiceSuspensionWorkflows

Service suspension and resumption:

- `test_suspend_service_for_nonpayment` - Suspend service and RADIUS access
- `test_resume_service_after_payment` - Resume service and restore access

#### TestServiceTerminationWorkflows

Service termination and cleanup:

- `test_terminate_service_with_full_cleanup` - Complete resource cleanup:
  - Delete RADIUS subscriber
  - Release IP address
  - Factory reset ONT

#### TestServiceLifecycleHealthChecks

Automated health monitoring:

- `test_automated_health_check_all_services` - Run health checks on 5 services
- `test_detect_service_degradation` - Detect and report service degradation

#### TestBulkServiceOperations

Bulk service operations:

- `test_bulk_service_suspension` - Suspend 5 services simultaneously

## Key Testing Patterns

### 1. Async Testing Pattern

All tests use pytest's async testing support:

```python
@pytest.mark.asyncio
async def test_example(async_session, test_tenant_id):
    service = RADIUSService(async_session, test_tenant_id)
    result = await service.create_subscriber(data)
    assert result is not None
```

### 2. Mock Integration Pattern

Tests use mock objects to simulate external systems:

```python
async def test_with_mocks(
    async_session, test_tenant_id,
    mock_radius_server, mock_netbox_client, mock_genieacs_client
):
    # Set up mock data
    mock_radius_server.subscribers["user@isp.com"] = {...}

    # Run test
    service = RADIUSService(async_session, test_tenant_id)
    result = await service.authenticate("user@isp.com", "password")

    # Verify mock interactions
    assert "user@isp.com" in mock_radius_server.subscribers
```

### 3. End-to-End Integration Pattern

Lifecycle tests validate complete workflows across multiple systems:

```python
async def test_end_to_end_provisioning(
    async_session, test_tenant_id,
    mock_radius_server, mock_netbox_client, mock_genieacs_client
):
    # Step 1: Allocate network resources (NetBox)
    netbox_service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)
    ip_allocation = await netbox_service.allocate_ip(...)

    # Step 2: Create RADIUS subscriber
    radius_service = RADIUSService(async_session, test_tenant_id)
    subscriber = await radius_service.create_subscriber(...)

    # Step 3: Configure CPE (GenieACS)
    genieacs_service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)
    task_id = await genieacs_service.set_parameters(...)

    # Step 4: Verify complete integration
    assert ip_allocation["address"] is not None
    assert subscriber.username is not None
    assert task_id is not None
```

### 4. Fixture-Based Data Setup

Tests use pytest fixtures for consistent test data:

```python
@pytest.fixture
def sample_bandwidth_profile():
    return {
        "name": "100 Mbps Fiber",
        "download_rate_kbps": 100000,
        "upload_rate_kbps": 50000,
    }

async def test_with_fixture(async_session, test_tenant_id, sample_bandwidth_profile):
    service = RADIUSService(async_session, test_tenant_id)
    profile = await service.create_bandwidth_profile(
        BandwidthProfileCreate(**sample_bandwidth_profile)
    )
    assert profile.name == "100 Mbps Fiber"
```

## Test Data Management

### In-Memory Database

Tests use SQLite in-memory database for fast, isolated testing:

```python
engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
```

**Benefits**:
- Fast execution (no disk I/O)
- Isolated (each test gets fresh database)
- No cleanup required (automatically disposed)

### Test Data Isolation

Each test function gets:
- Fresh database session
- Unique tenant ID
- Unique UUIDs for customers, users, subscriptions
- Clean mock objects

This ensures tests never interfere with each other.

## Continuous Integration

### GitHub Actions Integration

Add to `.github/workflows/test.yml`:

```yaml
- name: Run OSS Integration Tests
  run: |
    poetry run pytest tests/oss/ -v --cov=dotmac.oss --cov-report=xml

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage.xml
    flags: oss-integration
```

### Pre-commit Hook

Add to `.pre-commit-config.yaml`:

```yaml
- repo: local
  hooks:
    - id: oss-tests
      name: Run OSS Integration Tests
      entry: poetry run pytest tests/oss/ -v
      language: system
      pass_filenames: false
      always_run: true
```

## Troubleshooting

### Common Issues

#### 1. Import Errors

**Error**: `ModuleNotFoundError: No module named 'dotmac.oss'`

**Solution**: Ensure you're running tests from the project root and have installed dependencies:
```bash
poetry install --with dev
cd /Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops
poetry run pytest tests/oss/ -v
```

#### 2. Fixture Not Found

**Error**: `fixture 'mock_radius_server' not found`

**Solution**: Ensure `conftest.py` is in the `tests/oss/` directory and contains the fixture definition.

#### 3. Async Test Not Running

**Error**: `RuntimeWarning: coroutine 'test_example' was never awaited`

**Solution**: Add `@pytest.mark.asyncio` decorator:
```python
@pytest.mark.asyncio
async def test_example():
    result = await some_async_function()
    assert result is not None
```

#### 4. Database Connection Issues

**Error**: `sqlalchemy.exc.OperationalError: no such table`

**Solution**: Ensure `Base.metadata.create_all()` is called in the `async_session` fixture:
```python
async with engine.begin() as conn:
    await conn.run_sync(Base.metadata.create_all)
```

## Contributing

When adding new OSS integration tests:

1. **Add tests to appropriate file** - Keep RADIUS, NetBox, GenieACS, and Lifecycle tests separate
2. **Use existing fixtures** - Reuse fixtures from `conftest.py` when possible
3. **Create new fixtures** - Add new fixtures to `conftest.py` if needed by multiple tests
4. **Follow naming conventions** - Use descriptive test names starting with `test_`
5. **Document complex tests** - Add docstrings explaining what the test validates
6. **Use async/await** - All tests should be async and use `@pytest.mark.asyncio`
7. **Mock external systems** - Never call real RADIUS/NetBox/GenieACS in tests

### Example Test Contribution

```python
# tests/oss/test_radius_integration.py

class TestRADIUSNewFeature:
    """Tests for new RADIUS feature."""

    @pytest.mark.asyncio
    async def test_new_feature_workflow(
        self, async_session, test_tenant_id, mock_radius_server
    ):
        """Test complete workflow for new RADIUS feature.

        This test validates:
        1. Feature initialization
        2. Configuration updates
        3. Result verification
        """
        # Arrange
        service = RADIUSService(async_session, test_tenant_id)
        mock_radius_server.subscribers["test@isp.com"] = {...}

        # Act
        result = await service.new_feature_method(...)

        # Assert
        assert result.success is True
        assert result.data is not None
```

## Test Maintenance

### Updating Fixtures

When OSS system schemas change, update fixtures in `conftest.py`:

```python
@pytest.fixture
def sample_radius_subscriber_data():
    """Sample RADIUS subscriber creation data.

    Updated: 2025-01-15 - Added new field 'service_tier'
    """
    return {
        "subscriber_id": "sub_radius_001",
        "username": "testuser@isp.com",
        "password": "SecurePassword123!",
        "service_tier": "premium",  # New field
        # ... other fields
    }
```

### Updating Mock Objects

When external system APIs change, update mock classes:

```python
class MockRADIUSServer:
    """Mock RADIUS server for testing.

    Updated: 2025-01-15 - Added support for new authentication method
    """

    def authenticate_with_token(self, token: str) -> bool:
        """New authentication method using tokens."""
        # Implementation
        pass
```

## Performance Considerations

### Test Execution Time

Current test suite performance (approximate):

- RADIUS tests: ~2-3 seconds (18 tests)
- NetBox tests: ~3-4 seconds (21 tests)
- GenieACS tests: ~3-4 seconds (22 tests)
- Lifecycle tests: ~2-3 seconds (10 tests)

**Total**: ~10-14 seconds for all 71 tests

### Optimization Tips

1. **Run tests in parallel**:
   ```bash
   poetry run pytest tests/oss/ -n auto
   ```

2. **Run only changed tests**:
   ```bash
   poetry run pytest tests/oss/ --lf  # Last failed
   poetry run pytest tests/oss/ --ff  # Failed first
   ```

3. **Skip slow tests during development**:
   ```python
   @pytest.mark.slow
   async def test_long_running_operation():
       pass
   ```

   Then run without slow tests:
   ```bash
   poetry run pytest tests/oss/ -m "not slow"
   ```

## Resources

### External Documentation

- **RADIUS Protocol**: RFC 2865 (Authentication), RFC 2866 (Accounting)
- **TR-069/CWMP**: Broadband Forum TR-069 specification
- **NetBox API**: https://netbox.readthedocs.io/
- **GenieACS**: https://docs.genieacs.com/

### Internal Documentation

- **Service Lifecycle**: See `docs/service_lifecycle.md`
- **OSS Architecture**: See `docs/oss_architecture.md`
- **API Documentation**: See `docs/api/oss.md`

## License

These tests are part of the DotMac FTTH Operations Platform and are subject to the same license as the main project.

## Support

For questions or issues with the OSS test suite:

1. Check this documentation first
2. Review existing test examples
3. Check the project's main documentation
4. Open an issue in the project repository

---

**Last Updated**: 2025-01-15
**Test Suite Version**: 1.0.0
**Total Tests**: 71
**Test Files**: 4
**Mock Objects**: 3
