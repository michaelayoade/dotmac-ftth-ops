"""
Built-in Workflow Definitions

Pre-configured workflows for common business processes.
"""

# Workflow: Lead to Customer Onboarding
LEAD_TO_CUSTOMER_WORKFLOW = {
    "name": "lead_to_customer_onboarding",
    "description": "Automated end-to-end onboarding from qualified lead to deployed customer",
    "definition": {
        "steps": [
            {
                "name": "create_customer",
                "type": "service_call",
                "description": "Create customer record from qualified lead",
                "service": "customer_service",
                "method": "create_from_lead",
                "params": {
                    "lead_id": "${context.lead_id}",
                    "tenant_id": "${context.tenant_id}",
                },
                "max_retries": 3,
            },
            {
                "name": "create_subscription",
                "type": "service_call",
                "description": "Create billing subscription for customer",
                "service": "billing_service",
                "method": "create_subscription",
                "params": {
                    "customer_id": "${step_create_customer_result.customer_id}",
                    "plan_id": "${context.plan_id}",
                    "tenant_id": "${context.tenant_id}",
                },
                "max_retries": 3,
            },
            {
                "name": "issue_license",
                "type": "service_call",
                "description": "Issue software license to customer",
                "service": "license_service",
                "method": "issue_license",
                "params": {
                    "customer_id": "${step_create_customer_result.customer_id}",
                    "license_template_id": "${context.license_template_id}",
                    "tenant_id": "${context.tenant_id}",
                },
                "max_retries": 3,
            },
            {
                "name": "provision_tenant",
                "type": "service_call",
                "description": "Provision tenant infrastructure",
                "service": "deployment_service",
                "method": "provision_tenant",
                "params": {
                    "customer_id": "${step_create_customer_result.customer_id}",
                    "license_key": "${step_issue_license_result.license_key}",
                    "deployment_type": "${context.deployment_type}",
                },
                "max_retries": 2,
            },
            {
                "name": "send_welcome_email",
                "type": "service_call",
                "description": "Send welcome email with credentials",
                "service": "communications_service",
                "method": "send_template_email",
                "params": {
                    "template": "customer_welcome",
                    "recipient": "${step_create_customer_result.email}",
                    "variables": {
                        "customer_name": "${step_create_customer_result.name}",
                        "tenant_url": "${step_provision_tenant_result.tenant_url}",
                        "license_key": "${step_issue_license_result.license_key}",
                    },
                },
                "max_retries": 3,
            },
            {
                "name": "create_onboarding_ticket",
                "type": "service_call",
                "description": "Create support ticket for customer success team",
                "service": "ticketing_service",
                "method": "create_ticket",
                "params": {
                    "title": "New Customer Onboarding",
                    "description": "Follow up with new customer",
                    "customer_id": "${step_create_customer_result.customer_id}",
                    "priority": "medium",
                    "assigned_team": "customer_success",
                },
                "max_retries": 3,
            },
        ]
    },
    "version": "1.0.0",
    "tags": {"category": "onboarding", "priority": "high", "automated": True},
}

# Workflow: Quote Accepted to Order
QUOTE_ACCEPTED_WORKFLOW = {
    "name": "quote_accepted_to_order",
    "description": "Automated workflow from quote acceptance to order processing and deployment",
    "definition": {
        "steps": [
            {
                "name": "mark_quote_accepted",
                "type": "service_call",
                "description": "Update quote status to accepted",
                "service": "crm_service",
                "method": "accept_quote",
                "params": {
                    "quote_id": "${context.quote_id}",
                    "accepted_by": "${context.accepted_by}",
                },
                "max_retries": 3,
            },
            {
                "name": "create_order",
                "type": "service_call",
                "description": "Create sales order from quote",
                "service": "sales_service",
                "method": "create_order_from_quote",
                "params": {
                    "quote_id": "${context.quote_id}",
                    "tenant_id": "${context.tenant_id}",
                },
                "max_retries": 3,
            },
            {
                "name": "process_payment_if_prepaid",
                "type": "service_call",
                "description": "Process payment for prepaid orders",
                "service": "billing_service",
                "method": "process_payment",
                "params": {
                    "order_id": "${step_create_order_result.order_id}",
                    "amount": "${step_create_order_result.total_amount}",
                    "payment_method": "${context.payment_method}",
                },
                "max_retries": 2,
                "condition": {
                    "operator": "eq",
                    "left": "${context.payment_type}",
                    "right": "prepaid",
                },
            },
            {
                "name": "schedule_deployment",
                "type": "service_call",
                "description": "Schedule tenant deployment",
                "service": "deployment_service",
                "method": "schedule_deployment",
                "params": {
                    "order_id": "${step_create_order_result.order_id}",
                    "customer_id": "${step_create_order_result.customer_id}",
                    "priority": "${context.priority}",
                    "scheduled_date": "${context.deployment_date}",
                },
                "max_retries": 3,
            },
            {
                "name": "notify_operations",
                "type": "service_call",
                "description": "Notify operations team",
                "service": "notifications_service",
                "method": "notify_team",
                "params": {
                    "team": "operations",
                    "channel": "email",
                    "subject": "New Order Ready for Deployment",
                    "message": "Order ${step_create_order_result.order_id} is ready",
                    "metadata": {
                        "order_id": "${step_create_order_result.order_id}",
                        "customer_id": "${step_create_order_result.customer_id}",
                    },
                },
                "max_retries": 3,
            },
            {
                "name": "notify_customer",
                "type": "service_call",
                "description": "Send order confirmation to customer",
                "service": "communications_service",
                "method": "send_template_email",
                "params": {
                    "template": "order_confirmation",
                    "recipient": "${step_create_order_result.customer_email}",
                    "variables": {
                        "order_id": "${step_create_order_result.order_id}",
                        "deployment_date": "${context.deployment_date}",
                    },
                },
                "max_retries": 3,
            },
        ]
    },
    "version": "1.0.0",
    "tags": {"category": "sales", "priority": "high", "automated": True},
}

# Workflow: Partner Customer Provisioning
PARTNER_PROVISIONING_WORKFLOW = {
    "name": "partner_customer_provisioning",
    "description": "Automated provisioning workflow for partner-created customers",
    "definition": {
        "steps": [
            {
                "name": "validate_partner_license_quota",
                "type": "service_call",
                "description": "Validate partner has available license quota",
                "service": "partner_service",
                "method": "check_license_quota",
                "params": {
                    "partner_id": "${context.partner_id}",
                    "requested_licenses": "${context.license_count}",
                },
                "max_retries": 2,
            },
            {
                "name": "create_customer",
                "type": "service_call",
                "description": "Create customer under partner account",
                "service": "customer_service",
                "method": "create_partner_customer",
                "params": {
                    "partner_id": "${context.partner_id}",
                    "customer_data": "${context.customer_data}",
                },
                "max_retries": 3,
            },
            {
                "name": "allocate_licenses",
                "type": "service_call",
                "description": "Allocate licenses from partner quota",
                "service": "license_service",
                "method": "allocate_from_partner",
                "params": {
                    "partner_id": "${context.partner_id}",
                    "customer_id": "${step_create_customer_result.customer_id}",
                    "license_count": "${context.license_count}",
                },
                "max_retries": 3,
            },
            {
                "name": "provision_tenant",
                "type": "service_call",
                "description": "Provision tenant with white-label settings",
                "service": "deployment_service",
                "method": "provision_partner_tenant",
                "params": {
                    "customer_id": "${step_create_customer_result.customer_id}",
                    "partner_id": "${context.partner_id}",
                    "white_label_config": "${context.white_label_config}",
                },
                "max_retries": 2,
            },
            {
                "name": "record_commission",
                "type": "service_call",
                "description": "Record commission for partner",
                "service": "partner_service",
                "method": "record_commission",
                "params": {
                    "partner_id": "${context.partner_id}",
                    "customer_id": "${step_create_customer_result.customer_id}",
                    "commission_type": "new_customer",
                    "amount": "${context.commission_amount}",
                },
                "max_retries": 3,
            },
            {
                "name": "notify_partner",
                "type": "service_call",
                "description": "Notify partner of successful provisioning",
                "service": "communications_service",
                "method": "send_template_email",
                "params": {
                    "template": "partner_customer_provisioned",
                    "recipient": "${context.partner_email}",
                    "variables": {
                        "customer_name": "${step_create_customer_result.name}",
                        "tenant_url": "${step_provision_tenant_result.tenant_url}",
                        "license_count": "${context.license_count}",
                    },
                },
                "max_retries": 3,
            },
        ]
    },
    "version": "1.0.0",
    "tags": {"category": "partner", "priority": "high", "automated": True},
}

# Workflow: Customer Renewal
CUSTOMER_RENEWAL_WORKFLOW = {
    "name": "customer_renewal_process",
    "description": "Automated renewal workflow for subscription customers",
    "definition": {
        "steps": [
            {
                "name": "check_renewal_eligibility",
                "type": "service_call",
                "description": "Verify customer is eligible for renewal",
                "service": "billing_service",
                "method": "check_renewal_eligibility",
                "params": {
                    "customer_id": "${context.customer_id}",
                    "subscription_id": "${context.subscription_id}",
                },
                "max_retries": 2,
            },
            {
                "name": "generate_renewal_quote",
                "type": "service_call",
                "description": "Generate renewal quote with current pricing",
                "service": "crm_service",
                "method": "create_renewal_quote",
                "params": {
                    "customer_id": "${context.customer_id}",
                    "subscription_id": "${context.subscription_id}",
                    "renewal_term": "${context.renewal_term}",
                },
                "max_retries": 3,
            },
            {
                "name": "send_renewal_notification",
                "type": "service_call",
                "description": "Send renewal notification to customer",
                "service": "communications_service",
                "method": "send_template_email",
                "params": {
                    "template": "subscription_renewal",
                    "recipient": "${context.customer_email}",
                    "variables": {
                        "quote_id": "${step_generate_renewal_quote_result.quote_id}",
                        "renewal_amount": "${step_generate_renewal_quote_result.amount}",
                        "expiry_date": "${context.expiry_date}",
                    },
                },
                "max_retries": 3,
            },
            {
                "name": "wait_for_acceptance",
                "type": "wait",
                "description": "Wait period for customer acceptance",
                "duration": 86400,
            },
            {
                "name": "process_renewal_payment",
                "type": "service_call",
                "description": "Process renewal payment",
                "service": "billing_service",
                "method": "process_renewal_payment",
                "params": {
                    "customer_id": "${context.customer_id}",
                    "quote_id": "${step_generate_renewal_quote_result.quote_id}",
                },
                "max_retries": 2,
            },
            {
                "name": "extend_subscription",
                "type": "service_call",
                "description": "Extend subscription period",
                "service": "billing_service",
                "method": "extend_subscription",
                "params": {
                    "subscription_id": "${context.subscription_id}",
                    "extension_period": "${context.renewal_term}",
                },
                "max_retries": 3,
            },
        ]
    },
    "version": "1.0.0",
    "tags": {"category": "retention", "priority": "medium", "automated": True},
}

# Workflow: Ticket to Deployment (ISP-specific)
TICKET_TO_DEPLOYMENT_WORKFLOW = {
    "name": "isp_ticket_to_deployment",
    "description": "ISP-specific workflow from service ticket to network deployment",
    "definition": {
        "steps": [
            {
                "name": "validate_site_survey",
                "type": "service_call",
                "description": "Validate site survey is completed",
                "service": "crm_service",
                "method": "get_site_survey",
                "params": {
                    "customer_id": "${context.customer_id}",
                },
                "max_retries": 2,
            },
            {
                "name": "allocate_network_resources",
                "type": "service_call",
                "description": "Allocate IP addresses and VLAN",
                "service": "network_service",
                "method": "allocate_resources",
                "params": {
                    "customer_id": "${context.customer_id}",
                    "service_location": "${context.service_location}",
                    "bandwidth_plan": "${context.bandwidth_plan}",
                },
                "max_retries": 3,
            },
            {
                "name": "provision_radius_account",
                "type": "service_call",
                "description": "Create RADIUS authentication account",
                "service": "radius_service",
                "method": "create_subscriber",
                "params": {
                    "customer_id": "${context.customer_id}",
                    "username": "${step_allocate_network_resources_result.username}",
                    "bandwidth_profile": "${context.bandwidth_plan}",
                },
                "max_retries": 3,
            },
            {
                "name": "schedule_installation",
                "type": "service_call",
                "description": "Schedule field technician installation",
                "service": "ticketing_service",
                "method": "schedule_installation",
                "params": {
                    "customer_id": "${context.customer_id}",
                    "installation_address": "${context.installation_address}",
                    "technician_id": "${context.technician_id}",
                    "scheduled_date": "${context.installation_date}",
                },
                "max_retries": 3,
            },
            {
                "name": "configure_cpe_device",
                "type": "service_call",
                "description": "Push configuration to CPE via GenieACS",
                "service": "genieacs_service",
                "method": "provision_device",
                "params": {
                    "customer_id": "${context.customer_id}",
                    "device_serial": "${context.cpe_serial}",
                    "config_template": "${context.config_template}",
                },
                "max_retries": 2,
            },
            {
                "name": "activate_service",
                "type": "service_call",
                "description": "Activate customer service in billing",
                "service": "billing_service",
                "method": "activate_service",
                "params": {
                    "customer_id": "${context.customer_id}",
                    "service_id": "${step_allocate_network_resources_result.service_id}",
                },
                "max_retries": 3,
            },
            {
                "name": "notify_customer_activation",
                "type": "service_call",
                "description": "Send service activation notification",
                "service": "communications_service",
                "method": "send_template_email",
                "params": {
                    "template": "service_activated",
                    "recipient": "${context.customer_email}",
                    "variables": {
                        "service_details": "${step_allocate_network_resources_result}",
                        "credentials": "${step_provision_radius_account_result}",
                    },
                },
                "max_retries": 3,
            },
        ]
    },
    "version": "1.0.0",
    "tags": {"category": "isp", "priority": "high", "automated": True},
}


def get_all_builtin_workflows() -> list[dict]:
    """
    Get all built-in workflow definitions.

    Returns:
        List of workflow definition dictionaries
    """
    return [
        LEAD_TO_CUSTOMER_WORKFLOW,
        QUOTE_ACCEPTED_WORKFLOW,
        PARTNER_PROVISIONING_WORKFLOW,
        CUSTOMER_RENEWAL_WORKFLOW,
        TICKET_TO_DEPLOYMENT_WORKFLOW,
    ]


def get_workflow_by_name(name: str) -> dict | None:
    """
    Get a built-in workflow by name.

    Args:
        name: Workflow name

    Returns:
        Workflow definition dictionary or None
    """
    workflows = {
        "lead_to_customer_onboarding": LEAD_TO_CUSTOMER_WORKFLOW,
        "quote_accepted_to_order": QUOTE_ACCEPTED_WORKFLOW,
        "partner_customer_provisioning": PARTNER_PROVISIONING_WORKFLOW,
        "customer_renewal_process": CUSTOMER_RENEWAL_WORKFLOW,
        "isp_ticket_to_deployment": TICKET_TO_DEPLOYMENT_WORKFLOW,
    }
    return workflows.get(name)
