#!/bin/bash
# Test tenant isolation

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyODZjNDg5OS1mYjQxLTRjZTAtOWQ3NS03ZjJkNDYwYjdiNGYiLCJ0eXBlIjoiYWNjZXNzIiwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsImVtYWlsIjoidGVzdHVzZXJAZGVtby1hbHBoYS5jb20iLCJyb2xlcyI6W10sInBlcm1pc3Npb25zIjpbXSwidGVuYW50X2lkIjoiZGVtby1hbHBoYSIsImlzX3BsYXRmb3JtX2FkbWluIjpmYWxzZSwiZXhwIjoxNzYwODkyMzYzLCJpYXQiOjE3NjA4OTA1NjMsImp0aSI6InEtRFFWbllGT3ZIV2x1UFZhWFlRVkEifQ.hjKxjlwd9OsKqoPNvjg0U7ilC7wkoSkzf8YzeFfvQxQ"

echo "============================================"
echo "Tenant Isolation Testing"
echo "============================================"
echo ""

echo "Step 1: Create customer in demo-alpha tenant"
RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/customers/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: demo-alpha" \
  -H "Content-Type: application/json" \
  -d '{"email": "isolation-test@example.com", "first_name": "Isolation", "last_name": "Test", "customer_type": "individual"}')

CUSTOMER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "✅ Customer created: $CUSTOMER_ID"
echo ""

echo "Step 2: Try to access with WRONG tenant ID (test-beta)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/customers/$CUSTOMER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: test-beta")

if [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "403" ]; then
    echo "✅ PASS: Cross-tenant access blocked (HTTP $HTTP_CODE)"
else
    echo "❌ FAIL: Cross-tenant access allowed (HTTP $HTTP_CODE)"
fi
echo ""

echo "Step 3: Verify access with CORRECT tenant ID (demo-alpha)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/customers/$CUSTOMER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: demo-alpha")

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ PASS: Same-tenant access allowed (HTTP $HTTP_CODE)"
else
    echo "❌ FAIL: Same-tenant access denied (HTTP $HTTP_CODE)"
fi
echo ""

echo "============================================"
echo "Tenant Isolation Test Complete"
echo "============================================"
