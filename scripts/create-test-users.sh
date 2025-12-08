#!/bin/bash

###############################################################################
# Create Test Users via API
###############################################################################

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

API_URL="${API_URL:-http://localhost:8000}"

echo -e "${CYAN}🔧 Creating Test Users for E2E Testing${NC}"
echo ""

# Registration endpoint has been removed. Provide a clear message and exit.
echo -e "${YELLOW}Registration via API is disabled. Use an admin user creation flow instead.${NC}"
exit 1
