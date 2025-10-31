#!/bin/bash
#
# Test script for Alertmanager webhook authentication
# Usage: ./scripts/test_alertmanager_webhook.sh [webhook_url] [token]
#
# Examples:
#   ./scripts/test_alertmanager_webhook.sh http://localhost:8000 test-secret
#   ./scripts/test_alertmanager_webhook.sh https://platform.example.com <vault-token>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WEBHOOK_URL="${1:-http://localhost:8000/api/v1/alerts/webhook}"
TOKEN="${2:-test-secret}"

echo -e "${BLUE}=== Alertmanager Webhook Authentication Test ===${NC}\n"

# Test 1: Authentication with valid token (X-Alertmanager-Token header)
echo -e "${YELLOW}Test 1: Valid token via X-Alertmanager-Token header${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST "${WEBHOOK_URL}" \
  -H "X-Alertmanager-Token: ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "4",
    "groupKey": "{}:{severity=\"critical\"}",
    "status": "firing",
    "receiver": "test",
    "groupLabels": {"severity": "critical"},
    "commonLabels": {"alertname": "TestAlert", "severity": "critical"},
    "commonAnnotations": {"summary": "Test alert for webhook authentication"},
    "externalURL": "http://alertmanager.local",
    "alerts": [
      {
        "status": "firing",
        "labels": {
          "alertname": "TestAlert",
          "severity": "critical",
          "instance": "test-instance"
        },
        "annotations": {
          "summary": "Test alert",
          "description": "This is a test alert to verify webhook authentication"
        },
        "startsAt": "2025-10-28T10:00:00Z",
        "endsAt": "0001-01-01T00:00:00Z",
        "generatorURL": "http://prometheus.local/graph",
        "fingerprint": "test123456789"
      }
    ]
  }')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" -eq 202 ]; then
  echo -e "${GREEN}✅ PASS: HTTP $http_code (Expected: 202 Accepted)${NC}"
else
  echo -e "${RED}❌ FAIL: HTTP $http_code (Expected: 202)${NC}"
  echo -e "Response: $body"
fi
echo ""

# Test 2: Authentication with invalid token
echo -e "${YELLOW}Test 2: Invalid token (should fail)${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST "${WEBHOOK_URL}" \
  -H "X-Alertmanager-Token: invalid-token-12345" \
  -H "Content-Type: application/json" \
  -d '{"version": "4", "alerts": []}')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" -eq 401 ]; then
  echo -e "${GREEN}✅ PASS: HTTP $http_code (Expected: 401 Unauthorized)${NC}"
else
  echo -e "${RED}❌ FAIL: HTTP $http_code (Expected: 401)${NC}"
  echo -e "Response: $body"
fi
echo ""

# Test 3: Authentication with no token
echo -e "${YELLOW}Test 3: No token (should fail)${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d '{"version": "4", "alerts": []}')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" -eq 401 ]; then
  echo -e "${GREEN}✅ PASS: HTTP $http_code (Expected: 401 Unauthorized)${NC}"
else
  echo -e "${RED}❌ FAIL: HTTP $http_code (Expected: 401)${NC}"
  echo -e "Response: $body"
fi
echo ""

# Test 4: Authentication via Bearer token
echo -e "${YELLOW}Test 4: Valid token via Authorization Bearer${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST "${WEBHOOK_URL}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"version": "4", "alerts": []}')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" -eq 202 ]; then
  echo -e "${GREEN}✅ PASS: HTTP $http_code (Expected: 202 Accepted)${NC}"
else
  echo -e "${RED}❌ FAIL: HTTP $http_code (Expected: 202)${NC}"
  echo -e "Response: $body"
fi
echo ""

# Test 5: Authentication via query parameter
echo -e "${YELLOW}Test 5: Valid token via query parameter${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST "${WEBHOOK_URL}?token=${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"version": "4", "alerts": []}')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" -eq 202 ]; then
  echo -e "${GREEN}✅ PASS: HTTP $http_code (Expected: 202 Accepted)${NC}"
else
  echo -e "${RED}❌ FAIL: HTTP $http_code (Expected: 202)${NC}"
  echo -e "Response: $body"
fi
echo ""

# Test 6: Rate limiting (optional - may take a while)
echo -e "${YELLOW}Test 6: Rate limiting (sending 15 requests rapidly)${NC}"
success_count=0
rate_limit_count=0

for i in {1..15}; do
  http_code=$(curl -s -w "%{http_code}" -o /dev/null -X POST "${WEBHOOK_URL}" \
    -H "X-Alertmanager-Token: ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"version": "4", "alerts": []}')

  if [ "$http_code" -eq 202 ]; then
    ((success_count++))
  elif [ "$http_code" -eq 429 ]; then
    ((rate_limit_count++))
  fi
done

echo -e "  Successful: $success_count"
echo -e "  Rate limited: $rate_limit_count"

if [ "$rate_limit_count" -gt 0 ]; then
  echo -e "${GREEN}✅ PASS: Rate limiting is enforced${NC}"
else
  echo -e "${YELLOW}⚠️  WARNING: Rate limiting not enforced (may need configuration)${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}=== Test Summary ===${NC}"
echo -e "Webhook URL: $WEBHOOK_URL"
echo -e "Token: ${TOKEN:0:8}... (hidden)"
echo ""
echo -e "${GREEN}All authentication tests completed!${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. Check application logs for structured events:"
echo -e "     ${BLUE}grep 'alertmanager.webhook' /var/log/dotmac-platform/app.log${NC}"
echo -e "  2. Configure Alertmanager with the webhook URL and token"
echo -e "  3. Trigger a real alert from Prometheus to verify end-to-end flow"
echo ""
