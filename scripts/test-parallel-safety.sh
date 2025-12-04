#!/bin/bash
# Test execution profiles for parallel safety

set -e

echo "🧪 Parallel Test Safety Profiles"
echo "================================"

# Profile 1: Serial database-heavy tests
test_serial() {
    echo "📊 Running serial database-heavy tests..."
    poetry run pytest -m "integration and serial_only" -v --tb=short
}

# Profile 2: Parallel-safe tests
test_parallel() {
    echo "⚡ Running parallel-safe tests..."
    poetry run pytest -m "integration and parallel_safe" -n auto -v --tb=short
}

# Profile 3: CI with tuned pool
test_ci() {
    echo "🔧 Running CI with tuned connection pool..."
    PG_POOL_SIZE=20 PG_MAX_OVERFLOW=40 \
        poetry run pytest -m integration --dist loadgroup -n 4 -v --tb=short
}

# Profile 4: CI split execution (serial then parallel)
test_ci_split() {
    echo "🎯 Running CI split execution..."
    echo "  Step 1: Serial tests..."
    PG_POOL_SIZE=15 PG_MAX_OVERFLOW=30 \
        poetry run pytest -m "integration and serial_only" -v --tb=short

    echo "  Step 2: Parallel tests..."
    PG_POOL_SIZE=20 PG_MAX_OVERFLOW=40 \
        poetry run pytest -m "integration and parallel_safe" -n 4 -v --tb=short
}

# Parse command
case "${1:-help}" in
    serial)
        test_serial
        ;;
    parallel)
        test_parallel
        ;;
    ci)
        test_ci
        ;;
    ci-split)
        test_ci_split
        ;;
    help|*)
        echo "Usage: $0 {serial|parallel|ci|ci-split}"
        echo ""
        echo "Profiles:"
        echo "  serial     - Run serial_only tests sequentially"
        echo "  parallel   - Run parallel_safe tests with -n auto"
        echo "  ci         - Run all integration tests with tuned pool"
        echo "  ci-split   - Run serial then parallel (recommended for CI)"
        exit 1
        ;;
esac
