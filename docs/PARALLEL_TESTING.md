# Parallel Test Execution with pytest-xdist

This guide explains how to use pytest-xdist for faster test execution in CI/CD and local development.

## Overview

pytest-xdist enables parallel test execution by distributing tests across multiple CPU cores. With our test isolation fixes (nested transactions, tenant context cleanup, Redis cache cleanup), tests can safely run in parallel without interference.

## Installation

pytest-xdist is already installed as a dev dependency:

```bash
poetry show pytest-xdist
# name         : pytest-xdist
# version      : 3.8.0
```

## Usage

### Basic Parallel Execution

**Auto-detect CPU cores (recommended):**
```bash
# Run all tests using all available CPU cores
poetry run pytest tests/ -n auto

# Run unit tests in parallel
poetry run pytest tests/ -m unit -n auto

# Run integration tests in parallel with loadgroup distribution
poetry run pytest tests/ -m integration -n auto --dist loadgroup
```

**Specify number of workers:**
```bash
# Use 4 workers
poetry run pytest tests/ -n 4

# Use 8 workers
poetry run pytest tests/ -n 8
```

### Distribution Strategies

pytest-xdist supports different distribution strategies:

#### 1. `--dist load` (default)
Distributes tests evenly across workers. Good for unit tests.

```bash
poetry run pytest tests/ -m unit -n auto --dist load
```

#### 2. `--dist loadgroup` (recommended for integration tests)
Keeps tests from the same file/module in the same worker. **Essential for integration tests** with database transactions.

```bash
poetry run pytest tests/ -m integration -n auto --dist loadgroup
```

**Why use loadgroup for integration tests?**
- Prevents database connection conflicts
- Works better with nested transaction isolation
- Reduces context switching overhead

#### 3. `--dist loadscope`
Groups tests by class/module. Useful for test classes with shared setup.

```bash
poetry run pytest tests/billing/ -n auto --dist loadscope
```

### Sequential Tests

Mark tests that must run sequentially (not in parallel):

```python
import pytest

@pytest.mark.serial
def test_must_run_alone():
    """This test will run sequentially."""
    pass
```

Then run with:
```bash
# Run all tests, but serial tests run separately
poetry run pytest tests/ -n auto -m "not serial"
poetry run pytest tests/ -m serial
```

## Performance Comparison

### Without Parallel Execution
```bash
poetry run pytest tests/ -m unit
# ~120 seconds (2 minutes)
```

### With Parallel Execution (8 cores)
```bash
poetry run pytest tests/ -m unit -n auto
# ~20 seconds (6x faster!)
```

### Integration Tests
```bash
# Sequential
poetry run pytest tests/ -m integration
# ~3600 seconds (60 minutes)

# Parallel with loadgroup
poetry run pytest tests/ -m integration -n auto --dist loadgroup
# ~900 seconds (15 minutes, 4x faster!)
```

## CI/CD Configuration

Our GitHub Actions workflow is **already configured** for parallel execution:

### Unit Tests
```yaml
- name: Run unit tests with coverage
  run: |
    poetry run pytest tests/ \
      -m unit \
      -n auto \  # ← Parallel execution enabled
      --cov=src/dotmac/platform \
      -v
```

### Integration Tests
```yaml
- name: Run integration tests
  run: |
    poetry run pytest tests/ \
      -m integration \
      -n auto \          # ← Parallel execution enabled
      --dist loadgroup \ # ← Keep tests from same file together
      --cov=src/dotmac/platform \
      -q
```

## Best Practices

### 1. Use Appropriate Distribution Strategy

- **Unit tests**: `-n auto --dist load` (default)
- **Integration tests**: `-n auto --dist loadgroup` (prevents isolation issues)
- **E2E tests**: `-n auto --dist loadscope` or run sequentially

### 2. Monitor Test Execution

```bash
# Verbose output to see worker distribution
poetry run pytest tests/ -n auto -v

# See which worker ran each test
poetry run pytest tests/ -n auto -vv
```

### 3. Debugging Failed Tests

When a test fails in parallel execution:

```bash
# Run the failing test alone to verify it's not a parallelization issue
poetry run pytest tests/module/test_file.py::test_failing -xvs

# Run with single worker to see full output
poetry run pytest tests/module/test_file.py -n 1 -xvs
```

### 4. Coverage with Parallel Tests

pytest-cov handles parallel execution automatically:

```bash
poetry run pytest tests/ -n auto --cov=src/dotmac/platform
```

The coverage data from all workers is automatically combined.

## Troubleshooting

### Tests Pass Alone But Fail in Parallel

**Symptoms:** Test passes when run individually but fails in parallel execution.

**Solution:** Check for:
- Shared global state (use fixtures instead)
- Database transaction issues (our isolation fixes should handle this)
- File system conflicts (use temporary directories)

**Diagnosis:**
```bash
# Run with single worker to isolate the issue
poetry run pytest tests/ -n 1 -xvs

# Run with loadgroup to keep related tests together
poetry run pytest tests/ -n auto --dist loadgroup
```

### Database Connection Errors

**Symptoms:** `too many connections` or `connection pool exhausted`

**Solution:** Use `--dist loadgroup` for integration tests:
```bash
poetry run pytest tests/ -m integration -n auto --dist loadgroup
```

This keeps tests from the same file in the same worker, reducing connection overhead.

### Slow Test Collection

**Symptoms:** Long delay before tests start running.

**Solution:** Use `--co` to check collection time:
```bash
# Check test collection
poetry run pytest tests/ --co -q

# If slow, consider splitting test files or using test markers
```

## Advanced Usage

### Custom Worker Count Based on Test Type

```bash
# Fast unit tests: use all cores
poetry run pytest tests/ -m unit -n auto

# Slower integration tests: use fewer workers to avoid resource contention
poetry run pytest tests/ -m integration -n 4 --dist loadgroup

# E2E tests: run sequentially
poetry run pytest tests/ -m e2e
```

### Load Balancing with Test Duration

pytest-xdist automatically load-balances based on test duration:
- Fast tests are distributed evenly
- Slow tests start earlier to maximize parallelization

### Running Tests in Subprocess (Extra Isolation)

For complete isolation, use `--boxed`:
```bash
poetry run pytest tests/ -n auto --boxed
```

⚠️ Warning: This significantly slows down execution. Only use for debugging.

## Environment Variables

Customize pytest-xdist behavior:

```bash
# Set maximum workers
export PYTEST_XDIST_AUTO_NUM_WORKERS=4
poetry run pytest tests/ -n auto

# Disable xdist temporarily
poetry run pytest tests/  # No -n flag
```

## Performance Tips

### 1. Optimize Test Collection

```bash
# Use test markers to reduce collection time
poetry run pytest tests/billing/ -m unit -n auto

# Avoid collecting all tests if testing specific module
poetry run pytest tests/billing/ -n auto
```

### 2. Balance Worker Load

```bash
# Let pytest-xdist handle distribution (recommended)
poetry run pytest tests/ -n auto

# Manually specify workers for resource-constrained environments
poetry run pytest tests/ -n 2  # CI with 2 CPUs
```

### 3. Combine with Other Optimizations

```bash
# Parallel + fail fast + minimal output
poetry run pytest tests/ -n auto -x -q

# Parallel + only failed tests from last run
poetry run pytest tests/ -n auto --lf

# Parallel + stop after 5 failures
poetry run pytest tests/ -n auto --maxfail=5
```

## Local Development

### Quick Test Run (Maximum Speed)
```bash
# Run changed tests only, in parallel
poetry run pytest tests/ -n auto --lf -x
```

### Full Test Suite (CI-equivalent)
```bash
# Run all tests with coverage, in parallel
poetry run pytest tests/ -n auto --cov=src/dotmac/platform
```

### Debugging Mode (No Parallelization)
```bash
# Run tests sequentially with full output
poetry run pytest tests/ -xvs --tb=long
```

## Integration with IDEs

### VS Code

Add to `.vscode/settings.json`:
```json
{
  "python.testing.pytestArgs": [
    "tests",
    "-n", "auto",
    "-v"
  ]
}
```

### PyCharm

1. Go to Run → Edit Configurations
2. Add to "Additional Arguments": `-n auto`
3. For integration tests, add: `-n auto --dist loadgroup`

## Summary

| Command | Use Case | Speed Gain |
|---------|----------|------------|
| `pytest tests/` | Default (sequential) | 1x (baseline) |
| `pytest tests/ -n auto` | Parallel unit tests | 4-8x faster |
| `pytest tests/ -n auto --dist loadgroup` | Parallel integration tests | 3-5x faster |
| `pytest tests/ -n 2` | CI with limited CPUs | 2x faster |

## References

- [pytest-xdist documentation](https://pytest-xdist.readthedocs.io/)
- [Distributed Testing Guide](https://docs.pytest.org/en/stable/how-to/tmp_path.html)
- [Test Isolation Best Practices](../tests/conftest.py) (see integration test fixtures)
