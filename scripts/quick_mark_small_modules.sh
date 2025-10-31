#!/bin/bash

# Unit tests
echo "Marking unit tests..."
python3 scripts/add_module_markers.py --marker unit \
  tests/cache/test_cache_decorators.py \
  tests/config/test_config_router.py \
  tests/middleware/test_error_handling.py \
  tests/rate_limit/test_rate_limit_service.py \
  tests/unit/test_value_objects.py \
  tests/customer_portal/test_routes.py

# Integration tests
echo "Marking integration tests..."
python3 scripts/add_module_markers.py --marker integration \
  tests/diagnostics/test_service.py \
  tests/network/test_workflow_service.py \
  tests/performance/test_billing_load.py \
  tests/versioning/test_versioning_service.py

# E2E tests  
echo "Marking E2E tests..."
python3 scripts/add_module_markers.py --marker e2e \
  tests/deployment/test_deployment_router.py \
  tests/jobs/test_jobs_router.py \
  tests/licensing/test_licensing_router.py \
  tests/routers/test_app_routers.py \
  tests/subscribers/test_subscribers_router.py \
  tests/ticketing/test_ticketing_router.py

echo "Done!"
