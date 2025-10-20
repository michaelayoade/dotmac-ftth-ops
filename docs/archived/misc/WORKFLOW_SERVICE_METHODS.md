# Workflow Service Methods Reference

This document lists all service methods referenced in built-in workflows and their implementation status.

## Overview

**Total Methods Required**: 26
**Services Involved**: 12

---

## 1. Customer Service (customer_service)

### ✅ create_from_lead(lead_id, tenant_id)
**Used In**: lead_to_customer_onboarding
**Purpose**: Create customer record from qualified lead
**Status**: **NEEDS IMPLEMENTATION**

**Expected Signature**:
```python
async def create_from_lead(
    self,
    lead_id: int,
    tenant_id: str
) -> Dict[str, Any]:
    """
    Returns: {
        "customer_id": int,
        "name": str,
        "email": str
    }
    """
```

### ✅ create_partner_customer(partner_id, customer_data)
**Used In**: partner_customer_provisioning
**Purpose**: Create customer under partner account
**Status**: **NEEDS IMPLEMENTATION**

---

## 2. CRM Service (crm_service)

### ✅ accept_quote(quote_id, accepted_by)
**Used In**: quote_accepted_to_order
**Purpose**: Mark quote as accepted
**Status**: **NEEDS IMPLEMENTATION**

### ✅ create_renewal_quote(customer_id, subscription_id, renewal_term)
**Used In**: customer_renewal_process
**Purpose**: Generate renewal quote
**Status**: **NEEDS IMPLEMENTATION**

### ✅ get_site_survey(customer_id)
**Used In**: isp_ticket_to_deployment
**Purpose**: Retrieve completed site survey data
**Status**: **NEEDS IMPLEMENTATION**

---

## 3. Sales Service (sales_service)

### ✅ create_order_from_quote(quote_id, tenant_id)
**Used In**: quote_accepted_to_order
**Purpose**: Convert accepted quote to order
**Status**: **NEEDS IMPLEMENTATION**

**Expected Return**:
```python
{
    "order_id": int,
    "customer_id": int,
    "customer_email": str,
    "total_amount": Decimal
}
```

---

## 4. Billing Service (billing_service)

### ✅ create_subscription(customer_id, plan_id, tenant_id)
**Used In**: lead_to_customer_onboarding
**Status**: **CHECK IF EXISTS**

### ✅ process_payment(order_id, amount, payment_method)
**Used In**: quote_accepted_to_order
**Status**: **CHECK IF EXISTS**

### ✅ check_renewal_eligibility(customer_id, subscription_id)
**Used In**: customer_renewal_process
**Status**: **NEEDS IMPLEMENTATION**

### ✅ extend_subscription(subscription_id, extension_period)
**Used In**: customer_renewal_process
**Status**: **NEEDS IMPLEMENTATION**

### ✅ process_renewal_payment(customer_id, quote_id)
**Used In**: customer_renewal_process
**Status**: **NEEDS IMPLEMENTATION**

### ✅ activate_service(customer_id, service_id)
**Used In**: isp_ticket_to_deployment
**Status**: **NEEDS IMPLEMENTATION**

---

## 5. License Service (license_service)

### ✅ issue_license(customer_id, license_template_id, tenant_id)
**Used In**: lead_to_customer_onboarding
**Status**: **CHECK IF EXISTS**

**Expected Return**:
```python
{
    "license_key": str,
    "license_id": int
}
```

### ✅ allocate_from_partner(partner_id, customer_id, license_count)
**Used In**: partner_customer_provisioning
**Status**: **NEEDS IMPLEMENTATION**

---

## 6. Deployment Service (deployment_service)

### ✅ provision_tenant(customer_id, license_key, deployment_type)
**Used In**: lead_to_customer_onboarding
**Status**: **CHECK IF EXISTS**

**Expected Return**:
```python
{
    "tenant_url": str,
    "tenant_id": str,
    "deployment_id": int
}
```

### ✅ schedule_deployment(order_id, customer_id, priority, scheduled_date)
**Used In**: quote_accepted_to_order
**Status**: **CHECK IF EXISTS**

### ✅ provision_partner_tenant(customer_id, partner_id, white_label_config)
**Used In**: partner_customer_provisioning
**Status**: **NEEDS IMPLEMENTATION**

---

## 7. Communications Service (communications_service)

### ✅ send_template_email(template, recipient, variables)
**Used In**: All workflows (6 references)
**Status**: **CHECK IF EXISTS**

**Templates Used**:
- customer_welcome
- order_confirmation
- partner_customer_provisioned
- subscription_renewal
- service_activated

---

## 8. Notifications Service (notifications_service)

### ✅ notify_team(team, channel, subject, message, metadata)
**Used In**: quote_accepted_to_order
**Status**: **NEEDS IMPLEMENTATION**

---

## 9. Ticketing Service (ticketing_service)

### ✅ create_ticket(title, description, customer_id, priority, assigned_team)
**Used In**: lead_to_customer_onboarding
**Status**: **CHECK IF EXISTS**

### ✅ schedule_installation(customer_id, installation_address, technician_id, scheduled_date)
**Used In**: isp_ticket_to_deployment
**Status**: **NEEDS IMPLEMENTATION**

---

## 10. Partner Service (partner_service)

### ✅ check_license_quota(partner_id, requested_licenses)
**Used In**: partner_customer_provisioning
**Status**: **NEEDS IMPLEMENTATION**

**Expected Return**:
```python
{
    "available": bool,
    "quota_remaining": int
}
```

### ✅ record_commission(partner_id, customer_id, commission_type, amount)
**Used In**: partner_customer_provisioning
**Status**: **NEEDS IMPLEMENTATION**

---

## 11. Network Service (network_service) - ISP Module

### ⚠️ allocate_resources(customer_id, service_location, bandwidth_plan)
**Used In**: isp_ticket_to_deployment
**Status**: **SERVICE DOESN'T EXIST - CREATE NEW**

**Expected Return**:
```python
{
    "service_id": int,
    "ip_address": str,
    "vlan_id": int,
    "username": str
}
```

**Implementation Priority**: HIGH (blocking ISP workflows)

---

## 12. RADIUS Service (radius_service) - ISP Module

### ✅ create_subscriber(customer_id, username, bandwidth_profile)
**Used In**: isp_ticket_to_deployment
**Status**: **CHECK IF EXISTS**

**Expected Return**:
```python
{
    "radacct_id": int,
    "username": str,
    "password": str
}
```

---

## 13. GenieACS Service (genieacs_service) - ISP Module

### ✅ provision_device(customer_id, device_serial, config_template)
**Used In**: isp_ticket_to_deployment
**Status**: **CHECK IF EXISTS**

---

## Implementation Priority

### Phase 1 - Critical Path (Blocks all workflows)
1. **sales_service.create_order_from_quote** - Blocks quote→order workflow
2. **crm_service.accept_quote** - Blocks quote→order workflow
3. **customer_service.create_from_lead** - Blocks lead→customer workflow

### Phase 2 - Core Workflows
4. **deployment_service methods** - Check existing, add missing
5. **billing_service methods** - Check existing, add missing
6. **license_service methods** - Check existing, add missing
7. **communications_service.send_template_email** - Check existing

### Phase 3 - Partner & ISP Workflows
8. **network_service** - CREATE NEW SERVICE (ISP)
9. **partner_service methods** - Partner workflows
10. **ticketing_service.schedule_installation** - ISP workflows
11. **radius_service.create_subscriber** - Check existing

### Phase 4 - Nice to Have
12. **notifications_service.notify_team** - Internal notifications
13. **Renewal workflow methods** - Subscription lifecycle

---

## Testing Strategy

For each service method:
1. Create unit test with mock data
2. Create integration test with workflow execution
3. Test error handling and retries
4. Document expected payload format

---

## Next Steps

1. ✅ Audit existing service implementations
2. ⏳ Implement Phase 1 critical methods
3. ⏳ Create network_service for ISP workflows
4. ⏳ Create end-to-end workflow integration test
5. ⏳ Update service method signatures to match workflow needs
