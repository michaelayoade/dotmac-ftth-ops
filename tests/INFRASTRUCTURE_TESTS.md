# Infrastructure Integration Tests

This document describes how to run infrastructure integration tests that interact with Docker services like FreeRADIUS, NetBox, and Vault.

## Overview

Infrastructure tests are designed to work seamlessly both inside and outside Docker containers. They automatically detect the environment and adjust connection parameters accordingly.

### Docker Environment Detection

The test suite includes automatic Docker environment detection:

- **Inside Docker**: Uses Docker service names (`freeradius`, `netbox`, `vault`)
- **Outside Docker**: Uses `localhost` with port forwarding

This is implemented in `tests/helpers/docker_env.py` and provides utilities like:
- `is_running_in_docker()` - Detect if running inside a container
- `get_service_host(service_name)` - Get appropriate hostname
- `get_docker_network_url(service_name, port)` - Build full URLs

## Running Tests

### Prerequisites

Start the ISP infrastructure stack:

```bash
# Start all ISP services (FreeRADIUS, NetBox, Vault, etc.)
docker-compose -f docker-compose.base.yml -f docker-compose.isp.yml up -d

# Verify services are healthy
docker-compose ps
```

### Run Infrastructure Tests

#### All Infrastructure Tests

```bash
# Run all integration tests
pytest tests/ -m integration -v

# Run only infrastructure tests
pytest tests/infra/ tests/netbox/ tests/secrets/ -m integration -v
```

#### Individual Service Tests

##### FreeRADIUS Tests

```bash
# Test RADIUS authentication
pytest tests/infra/test_radius_docker.py -v

# Run from outside Docker (macOS/Linux/Windows)
pytest tests/infra/test_radius_docker.py::test_access_request_roundtrip -v

# Run from inside Docker (recommended for macOS)
docker-compose exec app pytest tests/infra/test_radius_docker.py -v
```

**Note**: On macOS, UDP port forwarding from host to Docker can be unreliable. For best results:
1. Run tests inside the Docker network: `docker-compose exec app pytest ...`
2. Or run on Linux where UDP forwarding works reliably
3. Tests will automatically use the correct connection method

##### NetBox Tests

```bash
# Test NetBox IPAM/DCIM integration
pytest tests/netbox/test_netbox_integration.py -v

# With custom NetBox URL
NETBOX_URL=http://netbox:8080 pytest tests/netbox/test_netbox_integration.py -v
```

Environment variables:
- `NETBOX_URL`: NetBox URL (default: auto-detected)
- `NETBOX_API_TOKEN`: API token (default: test token)

##### Vault Tests

```bash
# Test Vault secret management
RUN_VAULT_E2E=1 pytest tests/secrets/test_vault_e2e.py -v

# With existing Vault instance
VAULT_TOKEN=your-token RUN_VAULT_E2E=1 pytest tests/secrets/test_vault_e2e.py -v
```

Environment variables:
- `RUN_VAULT_E2E`: Set to `1` to enable Vault E2E tests
- `VAULT_TOKEN`: Vault token (default: `dev-token-12345`)

### Running Tests Inside Docker

For the most reliable results, especially on macOS, run tests inside the Docker network:

```bash
# Run all infrastructure tests inside Docker
docker-compose exec app poetry run pytest tests/infra/ tests/netbox/ tests/secrets/ -m integration -v

# Run specific test
docker-compose exec app poetry run pytest tests/infra/test_radius_docker.py -v

# Interactive shell for multiple test runs
docker-compose exec app bash
poetry run pytest tests/infra/test_radius_docker.py -v
poetry run pytest tests/netbox/test_netbox_integration.py -v
```

### Skip Behavior

Tests are designed to gracefully skip when services are unavailable:

#### RADIUS Tests
- ✅ **No longer skips on macOS** - Auto-detects Docker environment
- Skips if FreeRADIUS is not reachable
- Skips if FreeRADIUS connection times out

#### NetBox Tests
- Skips if `NETBOX_URL` not configured and NetBox not found
- Skips if NetBox health check fails
- Skips if API returns 400+ status codes

#### Vault Tests
- Skips if Docker is not available
- Skips if unable to start Vault container
- Skips write tests on existing Vault (permission protection)
- Falls back to in-memory stub if `RUN_VAULT_E2E != 1`

## Environment Variables Reference

### FreeRADIUS
```bash
FREERADIUS_HOST=freeradius        # Override auto-detection
FREERADIUS_AUTH_PORT=1812         # Auth port (default: 1812)
FREERADIUS_SHARED_SECRET=testing123  # Shared secret
```

### NetBox
```bash
NETBOX_URL=http://netbox:8080     # NetBox URL (auto-detected)
NETBOX_API_TOKEN=<token>          # API token
```

### Vault
```bash
RUN_VAULT_E2E=1                   # Enable Vault E2E tests
VAULT_TOKEN=dev-token-12345       # Vault token
```

### Docker Detection Override
```bash
DOCKER_CONTAINER=true             # Force Docker detection
```

## Troubleshooting

### Wrong URL - Docker Service Names From Host

**Problem**: Tests skip with "NetBox health check failed at http://localhost:8080" but NetBox is running
**Root Cause**: Environment variables set to Docker service names (e.g., `NETBOX_URL=http://netbox:8080`)
**Solution**:

```bash
# Check if you have these set
env | grep -E "NETBOX_URL|VAULT_URL|VAULT__URL"

# Option 1: Unset them to enable auto-detection
unset NETBOX_URL VAULT_URL VAULT__URL
pytest tests/netbox/test_netbox_integration.py -v

# Option 2: Use the helper script
./scripts/run-integration-tests.sh tests/netbox/

# Option 3: Run tests inside Docker
docker-compose exec app pytest tests/netbox/test_netbox_integration.py -v
```

### UDP Timeout on macOS

**Problem**: FreeRADIUS tests timeout on macOS
**Solution**: Run tests inside Docker:
```bash
docker-compose exec app pytest tests/infra/test_radius_docker.py -v
```

### NetBox Connection Refused

**Problem**: NetBox tests fail with connection refused
**Solutions**:
1. Verify NetBox is running: `docker-compose ps netbox`
2. Check NetBox health: `curl -H "Authorization: Token YOUR_TOKEN" http://localhost:8080/api/status/`
3. Wait for NetBox to fully start (can take 30-60 seconds)
4. Check NetBox is not unhealthy: `docker ps --filter "name=netbox"`

### Vault Not Found

**Problem**: Vault tests skip with "Docker not available"
**Solutions**:
1. Verify Docker is installed: `docker --version`
2. Verify Vault is running: `docker-compose ps vault`
3. Enable E2E tests: `RUN_VAULT_E2E=1 pytest ...`

### Service Name Resolution

**Problem**: Tests fail with "name not known" or "no such host"
**Solution**: You're likely running outside Docker. Either:
1. Run tests inside Docker: `docker-compose exec app pytest ...`
2. Use environment variables to override hosts:
   ```bash
   FREERADIUS_HOST=localhost pytest tests/infra/
   ```

## CI/CD Configuration

For GitHub Actions or other CI systems, tests automatically work when run inside Docker:

```yaml
# .github/workflows/test.yml
jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Start services
        run: docker-compose up -d
      - name: Run integration tests
        run: |
          docker-compose exec -T app pytest tests/infra/ \
            tests/netbox/ tests/secrets/ -m integration -v
```

## Architecture

### Docker Environment Detection

The detection logic checks multiple indicators:

1. **`/.dockerenv` file** - Most reliable, created by Docker
2. **`DOCKER_CONTAINER` env var** - Can be set in docker-compose
3. **`/proc/1/cgroup`** - Linux-specific, checks cgroup membership

### Service Name Resolution

When inside Docker:
- `freeradius` → FreeRADIUS service in docker-compose
- `netbox` → NetBox service in docker-compose
- `vault` → Vault service in docker-compose

When outside Docker:
- `localhost:1812` → FreeRADIUS via port forwarding
- `localhost:8080` → NetBox via port forwarding
- `localhost:8200` → Vault via port forwarding

## Related Files

- `tests/helpers/docker_env.py` - Docker detection utilities
- `tests/helpers/test_docker_env.py` - Tests for Docker detection
- `tests/infra/test_radius_docker.py` - RADIUS integration tests
- `tests/netbox/test_netbox_integration.py` - NetBox integration tests
- `tests/secrets/test_vault_e2e.py` - Vault E2E tests
- `docker-compose.isp.yml` - ISP services configuration
