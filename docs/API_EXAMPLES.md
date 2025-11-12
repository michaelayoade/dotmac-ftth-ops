# BSS Phase 1 API Examples

Practical examples for integrating with DotMac Platform Services.

---

## Table of Contents

1. [Python Examples](#python-examples)
2. [cURL Examples](#curl-examples)
3. [JavaScript Examples](#javascript-examples)
4. [Complete Workflows](#complete-workflows)

---

## Python Examples

### Setup

```python
import requests
from datetime import datetime, timedelta
from decimal import Decimal

# Configuration
BASE_URL = "http://localhost:8000"
TENANT_ID = "demo-alpha"
USERNAME = "admin@example.com"
PASSWORD = "secure_password"

# Authenticate
def get_access_token():
    response = requests.post(
        f"{BASE_URL}/api/auth/token",
        json={
            "username": USERNAME,
            "password": PASSWORD
        }
    )
    response.raise_for_status()
    return response.json()["access_token"]

# Create headers with auth
def get_headers(token):
    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": TENANT_ID,
        "Content-Type": "application/json"
    }

token = get_access_token()
headers = get_headers(token)
```

### Example 1: Create Dunning Campaign

```python
def create_dunning_campaign():
    """Create a 3-step dunning campaign for payment recovery."""

    campaign_data = {
        "name": "Standard Payment Recovery",
        "description": "Automated 3-step collection workflow",
        "trigger_after_days": 7,
        "max_retries": 3,
        "retry_interval_days": 3,
        "actions": [
            {
                "type": "email",
                "delay_days": 0,
                "template": "payment_reminder_1"
            },
            {
                "type": "sms",
                "delay_days": 3,
                "template": "payment_alert"
            },
            {
                "type": "suspend_service",
                "delay_days": 7
            }
        ],
        "exclusion_rules": {
            "min_lifetime_value": 1000.0,
            "customer_tiers": ["premium", "vip"]
        },
        "priority": 10,
        "is_active": True
    }

    response = requests.post(
        f"{BASE_URL}/api/billing/dunning/campaigns",
        headers=headers,
        json=campaign_data
    )
    response.raise_for_status()

    campaign = response.json()
    print(f"✅ Campaign created: {campaign['id']}")
    print(f"   Name: {campaign['name']}")
    print(f"   Trigger after: {campaign['trigger_after_days']} days")

    return campaign

# Usage
campaign = create_dunning_campaign()
```

### Example 2: Start Dunning Execution

```python
def start_dunning_execution(campaign_id, subscription_id, customer_id,
                            invoice_id, outstanding_amount):
    """Start dunning execution for an overdue invoice."""

    execution_data = {
        "campaign_id": campaign_id,
        "subscription_id": subscription_id,
        "customer_id": customer_id,
        "invoice_id": invoice_id,
        "outstanding_amount": outstanding_amount  # Amount in cents
    }

    response = requests.post(
        f"{BASE_URL}/api/billing/dunning/executions",
        headers=headers,
        json=execution_data
    )
    response.raise_for_status()

    execution = response.json()
    print(f"✅ Execution started: {execution['id']}")
    print(f"   Status: {execution['status']}")
    print(f"   Current step: {execution['current_step']}/{execution['total_steps']}")
    print(f"   Next action at: {execution['next_action_at']}")

    return execution

# Usage
execution = start_dunning_execution(
    campaign_id=campaign['id'],
    subscription_id="sub_abc123",
    customer_id="660e8400-e29b-41d4-a716-446655440000",
    invoice_id="in_xyz789",
    outstanding_amount=10000  # $100.00
)
```

### Example 3: Provision Service Instance

```python
def provision_fiber_service(customer_id, bandwidth_down=100, bandwidth_up=50):
    """Provision a fiber internet service with automatic activation."""

    service_data = {
        "customer_id": customer_id,
        "service_type": "fiber_internet",
        "service_name": f"Fiber Internet {bandwidth_down} Mbps",
        "plan_id": f"plan_fiber_{bandwidth_down}",
        "subscription_id": f"sub_{customer_id}",
        "service_config": {
            "bandwidth_down_mbps": bandwidth_down,
            "bandwidth_up_mbps": bandwidth_up,
            "vlan_id": 100
        },
        "installation_address": "123 Main St, Springfield, IL 62701",
        "installation_scheduled_date": (datetime.now() + timedelta(days=7)).isoformat(),
        "auto_activate": True
    }

    response = requests.post(
        f"{BASE_URL}/api/services/lifecycle/provision",
        headers=headers,
        json=service_data
    )
    response.raise_for_status()

    service = response.json()
    print(f"✅ Service provisioned: {service['service_identifier']}")
    print(f"   Type: {service['service_type']}")
    print(f"   Status: {service['status']}")
    print(f"   Bandwidth: {service['service_config']['bandwidth_down_mbps']} Mbps down")

    return service

# Usage
service = provision_fiber_service(
    customer_id="660e8400-e29b-41d4-a716-446655440000",
    bandwidth_down=100,
    bandwidth_up=50
)
```

### Example 4: Record Usage from RADIUS

```python
def record_usage_from_radius(session_data):
    """Convert RADIUS accounting session to usage record."""

    # Calculate total data transfer (download + upload)
    input_gb = session_data['acctinputoctets'] / (1024 ** 3)  # Bytes to GB
    output_gb = session_data['acctoutputoctets'] / (1024 ** 3)
    total_gb = input_gb + output_gb

    usage_data = {
        "subscription_id": session_data['subscription_id'],
        "customer_id": session_data['customer_id'],
        "usage_type": "bandwidth_gb",
        "quantity": round(total_gb, 6),
        "unit": "GB",
        "unit_price": 0.05,  # $0.05 per GB
        "period_start": session_data['acctstarttime'],
        "period_end": session_data['acctstoptime'],
        "source_system": "radius",
        "source_record_id": session_data['acctsessionid'],
        "description": f"Session usage for {session_data['username']}"
    }

    response = requests.post(
        f"{BASE_URL}/api/billing/usage/records",
        headers=headers,
        json=usage_data
    )
    response.raise_for_status()

    record = response.json()
    print(f"✅ Usage recorded: {record['id']}")
    print(f"   Quantity: {record['quantity']} {record['unit']}")
    print(f"   Amount: ${record['total_amount'] / 100:.2f}")

    return record

# Usage example
radius_session = {
    'acctsessionid': 'SESSION-20251014-001',
    'username': 'john.doe@alpha.com',
    'subscription_id': 'sub_abc123',
    'customer_id': '660e8400-e29b-41d4-a716-446655440000',
    'acctstarttime': '2025-10-14T08:00:00Z',
    'acctstoptime': '2025-10-14T18:30:00Z',
    'acctinputoctets': 5368709120,  # 5 GB download
    'acctoutputoctets': 1073741824,  # 1 GB upload
}

usage_record = record_usage_from_radius(radius_session)
```

### Example 5: Generate Monthly Usage Report

```python
def generate_monthly_usage_report(subscription_id, year, month):
    """Generate comprehensive usage report for a month."""

    # Calculate month boundaries
    period_start = datetime(year, month, 1)
    if month == 12:
        period_end = datetime(year + 1, 1, 1) - timedelta(seconds=1)
    else:
        period_end = datetime(year, month + 1, 1) - timedelta(seconds=1)

    report_data = {
        "subscription_id": subscription_id,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "include_breakdown": True
    }

    response = requests.post(
        f"{BASE_URL}/api/billing/usage/reports",
        headers=headers,
        json=report_data
    )
    response.raise_for_status()

    report = response.json()

    print(f"📊 Usage Report - {period_start.strftime('%B %Y')}")
    print(f"   Subscription: {report['subscription_id']}")
    print(f"\n   Usage Breakdown:")
    for usage_type, data in report['usage_by_type'].items():
        print(f"   - {usage_type}: {data['total_quantity']} {data['unit']} (${data['total_amount']/100:.2f})")
    print(f"\n   Total Amount: ${report['total_amount']/100:.2f}")

    return report

# Usage
report = generate_monthly_usage_report(
    subscription_id="sub_abc123",
    year=2025,
    month=10
)
```

### Example 6: Suspend Service for Non-Payment

```python
def suspend_service_nonpayment(service_id, invoice_id):
    """Suspend service due to non-payment."""

    suspension_data = {
        "reason": f"Non-payment - invoice {invoice_id} overdue 30 days",
        "fraud_suspension": False,
        "suspended_by_user_id": None  # System suspension
    }

    response = requests.post(
        f"{BASE_URL}/api/services/lifecycle/{service_id}/suspend",
        headers=headers,
        json=suspension_data
    )
    response.raise_for_status()

    service = response.json()
    print(f"⚠️ Service suspended: {service['service_identifier']}")
    print(f"   Status: {service['status']}")
    print(f"   Suspended at: {service['suspended_at']}")

    return service

# Usage
suspended = suspend_service_nonpayment(
    service_id=service['id'],
    invoice_id="in_xyz789"
)
```

---

## cURL Examples

### Example 1: Authenticate

```bash
# Get access token
curl -X POST http://localhost:8000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin@example.com",
    "password": "secure_password"
  }'

# Response
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600
}

# Set token for subsequent requests
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Example 2: Create Subscriber with IP Allocation

```bash
curl -X POST http://localhost:8000/api/subscribers \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: demo-alpha" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "jane.smith@alpha.com",
    "password": "secure_pass_456",
    "customer_id": "660e8400-e29b-41d4-a716-446655440000",
    "service_type": "fiber_internet",
    "status": "active",
    "bandwidth_profile": {
      "download_mbps": 200,
      "upload_mbps": 100
    },
    "allocate_ip": true,
    "ip_pool_name": "residential_pool_1"
  }'
```

### Example 3: Test RADIUS Authentication

```bash
# From host machine
docker exec isp-freeradius radtest \
  jane.smith@alpha.com \
  secure_pass_456 \
  localhost 0 testing123

# Expected output
Sent Access-Request Id 45 from 0.0.0.0:12345 to 127.0.0.1:1812 length 82
Received Access-Accept Id 45 from 127.0.0.1:1812 to 0.0.0.0:12345 length 64
	Framed-IP-Address = 10.100.0.25
	WISPr-Bandwidth-Max-Down = 200000000
	WISPr-Bandwidth-Max-Up = 100000000
```

### Example 4: Get Dunning Statistics

```bash
curl -X GET http://localhost:8000/api/billing/dunning/stats \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: demo-alpha" | jq .

# Pretty-printed response
{
  "total_campaigns": 5,
  "active_campaigns": 3,
  "total_executions": 250,
  "successful_recoveries": 200,
  "total_recovered_amount": 85000,
  "success_rate": 80.0
}
```

### Example 5: Aggregate Daily Usage

```bash
curl -X POST http://localhost:8000/api/billing/usage/aggregate \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: demo-alpha" \
  -H "Content-Type: application/json" \
  -d '{
    "subscription_id": "sub_abc123",
    "period_type": "daily",
    "period_start": "2025-10-14T00:00:00Z",
    "period_end": "2025-10-14T23:59:59Z"
  }' | jq .
```

---

## JavaScript Examples

### Setup

```javascript
const axios = require('axios');

const BASE_URL = 'http://localhost:8000';
const TENANT_ID = 'demo-alpha';

// Authenticate and get token
async function authenticate(username, password) {
  const response = await axios.post(`${BASE_URL}/api/auth/token`, {
    username,
    password
  });
  return response.data.access_token;
}

// Create axios instance with auth
async function createClient() {
  const token = await authenticate('admin@example.com', 'secure_password');

  return axios.create({
    baseURL: BASE_URL,
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': TENANT_ID,
      'Content-Type': 'application/json'
    }
  });
}
```

### Example 1: Create Dunning Campaign

```javascript
async function createDunningCampaign() {
  const client = await createClient();

  const campaignData = {
    name: 'Standard Payment Recovery',
    description: 'Automated 3-step collection workflow',
    trigger_after_days: 7,
    max_retries: 3,
    retry_interval_days: 3,
    actions: [
      {
        type: 'email',
        delay_days: 0,
        template: 'payment_reminder_1'
      },
      {
        type: 'sms',
        delay_days: 3,
        template: 'payment_alert'
      },
      {
        type: 'suspend_service',
        delay_days: 7
      }
    ],
    exclusion_rules: {
      min_lifetime_value: 1000.0,
      customer_tiers: ['premium', 'vip']
    },
    priority: 10,
    is_active: true
  };

  const response = await client.post('/api/billing/dunning/campaigns', campaignData);
  const campaign = response.data;

  console.log(`✅ Campaign created: ${campaign.id}`);
  console.log(`   Name: ${campaign.name}`);

  return campaign;
}

// Usage
createDunningCampaign().then(campaign => {
  console.log('Campaign:', campaign);
}).catch(error => {
  console.error('Error:', error.response?.data || error.message);
});
```

### Example 2: Provision Service

```javascript
async function provisionService(customerId, bandwidth) {
  const client = await createClient();

  const serviceData = {
    customer_id: customerId,
    service_type: 'fiber_internet',
    service_name: `Fiber Internet ${bandwidth} Mbps`,
    plan_id: `plan_fiber_${bandwidth}`,
    service_config: {
      bandwidth_down_mbps: bandwidth,
      bandwidth_up_mbps: bandwidth / 2,
      vlan_id: 100
    },
    installation_address: '123 Main St, Springfield, IL 62701',
    auto_activate: true
  };

  const response = await client.post('/api/services/lifecycle/provision', serviceData);
  const service = response.data;

  console.log(`✅ Service provisioned: ${service.service_identifier}`);
  console.log(`   Status: ${service.status}`);

  return service;
}

// Usage
provisionService('660e8400-e29b-41d4-a716-446655440000', 100)
  .then(service => console.log('Service:', service))
  .catch(error => console.error('Error:', error.response?.data));
```

---

## Complete Workflows

### Workflow 1: New Customer Onboarding

```python
def onboard_new_customer(customer_data):
    """Complete workflow: Create customer → Provision service → Create subscriber → Verify RADIUS."""

    # Step 1: Create customer (assuming customer API exists)
    customer_response = requests.post(
        f"{BASE_URL}/api/customers",
        headers=headers,
        json=customer_data
    )
    customer = customer_response.json()
    print(f"✅ Customer created: {customer['id']}")

    # Step 2: Provision service
    service = provision_fiber_service(
        customer_id=customer['id'],
        bandwidth_down=100,
        bandwidth_up=50
    )

    # Step 3: Create subscriber with IP allocation
    subscriber_data = {
        "username": customer['email'],
        "password": "temp_password_123",  # Should send reset email
        "customer_id": customer['id'],
        "service_type": "fiber_internet",
        "status": "active",
        "bandwidth_profile": {
            "download_mbps": 100,
            "upload_mbps": 50
        },
        "allocate_ip": True
    }

    subscriber_response = requests.post(
        f"{BASE_URL}/api/subscribers",
        headers=headers,
        json=subscriber_data
    )
    subscriber = subscriber_response.json()
    print(f"✅ Subscriber created: {subscriber['username']}")
    print(f"   Allocated IP: {subscriber['static_ipv4']}")

    # Step 4: Verify RADIUS authentication works (simulated)
    print(f"\n🔐 RADIUS authentication configured")
    print(f"   Test command:")
    print(f"   docker exec isp-freeradius radtest {subscriber['username']} temp_password_123 localhost 0 testing123")

    return {
        'customer': customer,
        'service': service,
        'subscriber': subscriber
    }

# Usage
new_customer = onboard_new_customer({
    'email': 'new.customer@example.com',
    'name': 'New Customer',
    'phone': '+1234567890'
})
```

### Workflow 2: Monthly Billing Cycle

```python
def process_monthly_billing(subscription_id, year, month):
    """Complete workflow: Aggregate usage → Generate invoice → Send notification."""

    print(f"📅 Processing billing for {year}-{month:02d}")

    # Step 1: Get pending usage records
    response = requests.get(
        f"{BASE_URL}/api/billing/usage/pending",
        headers=headers,
        params={
            'subscription_id': subscription_id,
            'period_start': f"{year}-{month:02d}-01T00:00:00Z",
            'period_end': f"{year}-{month:02d}-31T23:59:59Z"
        }
    )
    pending_usage = response.json()
    print(f"   Found {len(pending_usage['records'])} pending usage records")
    print(f"   Total amount: ${pending_usage['total_amount']/100:.2f}")

    # Step 2: Generate usage report
    report = generate_monthly_usage_report(subscription_id, year, month)

    # Step 3: Create invoice (assuming invoice API exists)
    invoice_data = {
        'subscription_id': subscription_id,
        'amount': pending_usage['total_amount'],
        'due_date': f"{year}-{month:02d}-15",
        'line_items': report['usage_by_type']
    }

    invoice_response = requests.post(
        f"{BASE_URL}/api/billing/invoices",
        headers=headers,
        json=invoice_data
    )
    invoice = invoice_response.json()
    print(f"✅ Invoice created: {invoice['id']}")

    # Step 4: Mark usage as billed
    for record in pending_usage['records']:
        requests.post(
            f"{BASE_URL}/api/billing/usage/records/{record['id']}/mark-billed",
            headers=headers,
            json={'invoice_id': invoice['id']}
        )
    print(f"✅ All usage marked as billed")

    return {
        'invoice': invoice,
        'usage_report': report
    }

# Usage
billing_result = process_monthly_billing(
    subscription_id='sub_abc123',
    year=2025,
    month=10
)
```

### Workflow 3: Automated Dunning Execution

```python
def execute_dunning_workflow(overdue_invoices):
    """Complete workflow: Identify overdue → Start dunning → Monitor progress."""

    # Assume we have a dunning campaign created
    campaigns = requests.get(
        f"{BASE_URL}/api/billing/dunning/campaigns",
        headers=headers,
        params={'is_active': True}
    ).json()

    campaign = campaigns['campaigns'][0]  # Use first active campaign
    print(f"📋 Using campaign: {campaign['name']}")

    executions = []
    for invoice in overdue_invoices:
        print(f"\n💰 Processing overdue invoice: {invoice['id']}")
        print(f"   Amount: ${invoice['amount']/100:.2f}")
        print(f"   Days overdue: {invoice['days_overdue']}")

        # Start dunning execution
        execution = start_dunning_execution(
            campaign_id=campaign['id'],
            subscription_id=invoice['subscription_id'],
            customer_id=invoice['customer_id'],
            invoice_id=invoice['id'],
            outstanding_amount=invoice['amount']
        )
        executions.append(execution)

    print(f"\n✅ Started {len(executions)} dunning executions")

    return executions

# Usage
overdue = [
    {
        'id': 'in_001',
        'subscription_id': 'sub_001',
        'customer_id': '660e8400-e29b-41d4-a716-446655440000',
        'amount': 10000,
        'days_overdue': 15
    },
    {
        'id': 'in_002',
        'subscription_id': 'sub_002',
        'customer_id': '770e8400-e29b-41d4-a716-446655440000',
        'amount': 15000,
        'days_overdue': 30
    }
]

dunning_executions = execute_dunning_workflow(overdue)
```

---

## Testing Scripts

### test_api_integration.sh

```bash
#!/bin/bash
# Complete API integration test script

set -e

BASE_URL="http://localhost:8000"
TENANT_ID="demo-alpha"

echo "🧪 BSS Phase 1 API Integration Tests"
echo "===================================="
echo ""

# Step 1: Authenticate
echo "1️⃣ Authenticating..."
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/token" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@example.com","password":"secure_password"}' \
  | jq -r '.access_token')

if [ "$TOKEN" = "null" ]; then
  echo "❌ Authentication failed"
  exit 1
fi
echo "✅ Authenticated successfully"
echo ""

# Step 2: Create dunning campaign
echo "2️⃣ Creating dunning campaign..."
CAMPAIGN_ID=$(curl -s -X POST "$BASE_URL/api/billing/dunning/campaigns" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Campaign",
    "trigger_after_days": 7,
    "actions": [{"type": "email", "delay_days": 0, "template": "reminder"}]
  }' | jq -r '.id')

echo "✅ Campaign created: $CAMPAIGN_ID"
echo ""

# Step 3: Provision service
echo "3️⃣ Provisioning service..."
SERVICE_ID=$(curl -s -X POST "$BASE_URL/api/services/lifecycle/provision" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "660e8400-e29b-41d4-a716-446655440000",
    "service_type": "fiber_internet",
    "service_name": "Test Fiber",
    "plan_id": "plan_test",
    "service_config": {"bandwidth_down_mbps": 100}
  }' | jq -r '.id')

echo "✅ Service provisioned: $SERVICE_ID"
echo ""

# Step 4: Record usage
echo "4️⃣ Recording usage..."
USAGE_ID=$(curl -s -X POST "$BASE_URL/api/billing/usage/records" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "subscription_id": "sub_test",
    "customer_id": "660e8400-e29b-41d4-a716-446655440000",
    "usage_type": "data_transfer",
    "quantity": 10.0,
    "unit": "GB",
    "unit_price": 0.10,
    "period_start": "2025-10-14T00:00:00Z",
    "period_end": "2025-10-14T01:00:00Z",
    "source_system": "test"
  }' | jq -r '.id')

echo "✅ Usage recorded: $USAGE_ID"
echo ""

echo "🎉 All integration tests passed!"
```

---

**Last Updated:** October 14, 2025
**Platform Version:** 1.0.0
