# Workflow Email Templates

## Overview

This directory contains production-ready email templates for workflow notifications. All templates are built with HTML/CSS and use Jinja2 templating for dynamic content.

---

## 📧 Available Templates

### 1. Welcome/Onboarding Email
**File:** `welcome_onboarding.html`
**Purpose:** Customer onboarding completion notification
**Theme:** Purple gradient
**Use Case:** Sent when new customer completes onboarding process

**Key Sections:**
- Account details with service plan information
- 4-step onboarding process timeline
- Customer portal access with login credentials
- Quick links to key features
- Support ticket reference
- Installation scheduling information

**Required Variables:**
```python
{
    'customer_name': 'John Doe',
    'company_name': 'DotMac ISP',
    'customer_id': 'uuid',
    'account_number': 'ACC-12345',
    'plan_name': 'Professional Plan',
    'bandwidth_mbps': 200,
    'service_address': '123 Main St, City, State',
    'license_key': 'LIC-XXX-XXX',
    'tenant_url': 'https://customer.dotmac.io',
    'installation_date': '2025-10-20',  # Optional
    'installation_time_window': '9 AM - 5 PM',  # Optional
    'customer_phone': '+1-555-0123',
    'portal_url': 'https://portal.dotmac.io',
    'support_phone': '1-800-SUPPORT',
    'support_email': 'support@company.com',
    'support_url': 'https://support.company.com',
    'ticket_number': 'TCK-12345',  # Optional
    'company_address': '123 Business St, City, State',
    'terms_url': 'https://company.com/terms',
    'privacy_url': 'https://company.com/privacy',
    'current_year': 2025
}
```

---

### 2. License Issued Email
**File:** `license_issued.html`
**Purpose:** License activation notification
**Theme:** Green success
**Use Case:** Sent when software license is issued to customer

**Key Sections:**
- Prominent license key display
- License details and expiration
- Feature list with limits
- Trial period notice (if applicable)
- Activation instructions
- Important information and warnings

**Required Variables:**
```python
{
    'customer_name': 'John Doe',
    'license_key': 'XXXX-XXXX-XXXX-XXXX',
    'product_name': 'Professional ISP License',
    'license_type': 'SUBSCRIPTION',
    'trial_period_days': 14,  # Optional
    'trial_end_date': '2025-10-30',  # If trial
    'issue_date': '2025-10-16',
    'expiry_date': '2026-10-16',
    'auto_renewal': True,
    'max_activations': 5,
    'features': [
        {
            'feature_name': 'Internet Access',
            'limit_value': 200,
            'limit_type': 'bandwidth_mbps'
        }
    ],
    'activation_url': 'https://portal.company.com/activate',
    'installation_required': True,  # Optional
    'support_phone': '1-800-SUPPORT',
    'support_email': 'support@company.com',
    'portal_url': 'https://portal.company.com',
    'company_name': 'DotMac ISP',
    'company_address': '123 Business St',
    'terms_url': 'https://company.com/terms',
    'current_year': 2025
}
```

---

### 3. Deployment Complete Email
**File:** `deployment_complete.html`
**Purpose:** Tenant provisioning completion
**Theme:** Blue technology
**Use Case:** Sent when tenant infrastructure is provisioned and ready

**Key Sections:**
- Tenant URL with prominent display
- Resource allocation summary
- Initial access credentials (warning style)
- Deployment specifications
- Service endpoints
- Available features checklist
- Getting started resources

**Required Variables:**
```python
{
    'customer_name': 'John Doe',
    'tenant_url': 'https://customer.dotmac.io',
    'tenant_id': 'tenant-uuid',
    'allocated_cpu': 4.0,
    'allocated_memory_gb': 8,
    'allocated_storage_gb': 50,
    'status': 'running',
    'initial_credentials': {  # Optional
        'username': 'admin',
        'password': 'temp-password-123'
    },
    'deployment_type': 'kubernetes',
    'environment': 'production',
    'region': 'us-west-2',  # Optional
    'provisioned_at': '2025-10-16T12:00:00Z',
    'endpoints': {  # Optional
        'API': 'https://api.customer.dotmac.io',
        'Database': 'postgres.customer.dotmac.io:5432'
    },
    'installation_required': False,  # Optional
    'docs_url': 'https://docs.company.com',
    'support_phone': '1-800-SUPPORT',
    'support_email': 'support@company.com',
    'support_url': 'https://support.company.com',
    'company_name': 'DotMac ISP',
    'company_address': '123 Business St',
    'current_year': 2025
}
```

---

### 4. Ticket Created Email
**File:** `ticket_created.html`
**Purpose:** Support ticket creation confirmation
**Theme:** Purple support
**Use Case:** Sent when customer or system creates support ticket

**Key Sections:**
- Large ticket number display
- Priority badge (color-coded)
- Ticket details table
- SLA response commitment
- Original message display
- 4-step resolution timeline
- Tracking instructions
- Related help articles

**Required Variables:**
```python
{
    'customer_name': 'John Doe',
    'ticket_number': 'TCK-ABC123DEF456',
    'ticket_subject': 'Internet connectivity issue',
    'ticket_type': 'Technical Support',
    'ticket_status': 'Open',
    'priority': 'high',  # low, normal, high, urgent
    'created_at': '2025-10-16 12:00 PM',
    'assigned_team': 'Network Operations',  # Optional
    'service_address': '123 Main St',  # Optional
    'sla_due_date': '2025-10-16 4:00 PM',  # Optional
    'estimated_response_time': '2 hours',  # Optional
    'ticket_description': 'Customer message here',
    'ticket_url': 'https://portal.company.com/tickets/123',
    'portal_url': 'https://portal.company.com',
    'related_articles': [  # Optional
        {'title': 'Article 1', 'url': 'https://...'},
        {'title': 'Article 2', 'url': 'https://...'}
    ],
    'support_phone': '1-800-SUPPORT',
    'support_email': 'support@company.com',
    'company_name': 'DotMac ISP',
    'company_address': '123 Business St',
    'knowledge_base_url': 'https://kb.company.com',
    'current_year': 2025
}
```

---

### 5. Payment Confirmation Email
**File:** `payment_confirmation.html`
**Purpose:** Payment receipt and confirmation
**Theme:** Green success
**Use Case:** Sent when customer payment is processed successfully

**Key Sections:**
- Large amount display
- Payment details and method
- Invoice summary with line items
- Receipt and invoice download buttons
- Next payment reminder
- Account status (balance, credits)
- Billing management links
- Rewards/loyalty information

**Required Variables:**
```python
{
    'customer_name': 'John Doe',
    'payment_id': 'PAY-123456',
    'transaction_id': 'TXN-ABC123',
    'amount': 99.99,
    'currency_symbol': '$',
    'payment_date': 'October 16, 2025',
    'payment_method': 'Credit Card',
    'payment_method_details': {  # Optional
        'type': 'Visa',
        'last4': '4242',
        'bank_name': 'Chase Bank'
    },
    'invoice_number': 'INV-2025-001',
    'account_number': 'ACC-12345',
    'invoice_items': [
        {
            'description': 'Professional Plan',
            'period': 'Oct 1 - Oct 31, 2025',
            'amount': 99.99
        }
    ],
    'tax_amount': 8.00,  # Optional
    'tax_rate': 8.0,  # Optional
    'receipt_url': 'https://portal.company.com/receipts/123',
    'invoice_url': 'https://portal.company.com/invoices/123',
    'next_payment_date': '2025-11-16',  # Optional
    'next_payment_amount': 99.99,  # Optional
    'auto_pay_enabled': True,  # Optional
    'outstanding_balance': 0.00,
    'credit_available': 10.00,  # Optional
    'loyalty_points': 99,  # Optional
    'referral_credit': 20.00,  # Optional
    'support_phone': '1-800-SUPPORT',
    'billing_email': 'billing@company.com',
    'portal_url': 'https://portal.company.com',
    'support_url': 'https://support.company.com',
    'company_name': 'DotMac ISP',
    'company_address': '123 Business St',
    'current_year': 2025
}
```

---

### 6. Subscription Update Email
**File:** `subscription_update.html`
**Purpose:** Plan upgrade/downgrade notification
**Theme:** Orange update
**Use Case:** Sent when customer changes their subscription plan

**Key Sections:**
- Update type indicator (upgrade/downgrade)
- Old vs new plan comparison
- Feature changes (added/removed)
- Billing impact (proration)
- What happens next timeline
- Modification options

**Required Variables:**
```python
{
    'customer_name': 'John Doe',
    'update_type': 'upgrade',  # upgrade, downgrade, modified
    'old_plan_name': 'Starter Plan',
    'new_plan_name': 'Professional Plan',
    'effective_date': 'October 16, 2025',
    'old_monthly_price': 39.99,
    'new_monthly_price': 99.99,
    'old_bandwidth_mbps': 50,
    'new_bandwidth_mbps': 200,
    'old_device_limit': 1,
    'new_device_limit': 5,
    'old_data_limit': '100 GB',  # Optional
    'new_data_limit': 'Unlimited',  # Optional
    'old_support_level': 'Email Support',
    'new_support_level': 'Priority Support',
    'old_sla': 'Standard',  # Optional
    'new_sla': '99.5%',  # Optional
    'features_added': [  # Optional
        {
            'name': 'Static IP Address',
            'description': '1 dedicated IP'
        }
    ],
    'features_removed': [],  # Optional
    'proration_credit': 10.00,  # Optional
    'proration_charge': 50.00,  # Optional
    'next_billing_date': '2025-11-16',
    'next_billing_amount': 99.99,
    'billing_cycle_changed': False,  # Optional
    'old_billing_cycle': 'monthly',  # If changed
    'new_billing_cycle': 'annual',  # If changed
    'immediate_activation': True,
    'configuration_required': False,  # Optional
    'upgrade_actions': [  # Optional, for upgrades
        'Configure your static IP',
        'Set up SD-WAN'
    ],
    'subscription_url': 'https://portal.company.com/subscription',
    'plans_url': 'https://company.com/plans',
    'addons_url': 'https://portal.company.com/addons',
    'portal_url': 'https://portal.company.com',
    'support_phone': '1-800-SUPPORT',
    'billing_email': 'billing@company.com',
    'company_name': 'DotMac ISP',
    'company_address': '123 Business St',
    'current_year': 2025
}
```

---

## 🚀 Usage

### Basic Setup

```python
from jinja2 import Environment, FileSystemLoader
from datetime import datetime

# Setup Jinja2 environment
template_dir = 'email_templates/workflows'
jinja_env = Environment(loader=FileSystemLoader(template_dir))

# Load template
template = jinja_env.get_template('welcome_onboarding.html')

# Render with data
html_content = template.render(
    customer_name='John Doe',
    company_name='DotMac ISP',
    # ... other variables
    current_year=datetime.now().year
)

# Send email
send_email(to='customer@example.com', subject='Welcome!', html=html_content)
```

### Workflow Integration

```python
# In workflow service
async def send_welcome_email(customer_data):
    """Send welcome email after customer onboarding."""
    from email_service import EmailService
    from template_renderer import render_template

    html = render_template('welcome_onboarding.html', {
        'customer_name': customer_data['name'],
        'company_name': 'DotMac ISP',
        'customer_id': customer_data['id'],
        'account_number': customer_data['account_number'],
        'plan_name': customer_data['plan_name'],
        'bandwidth_mbps': customer_data['bandwidth'],
        'service_address': customer_data['service_address'],
        'license_key': customer_data['license_key'],
        'tenant_url': customer_data['tenant_url'],
        'portal_url': f"https://{customer_data['tenant_subdomain']}.dotmac.io",
        'support_phone': '1-800-DOTMAC',
        'support_email': 'support@dotmac.io',
        'company_address': '123 Tech Street, Silicon Valley, CA',
        'terms_url': 'https://dotmac.io/terms',
        'privacy_url': 'https://dotmac.io/privacy',
        'current_year': datetime.now().year,
    })

    email_service = EmailService()
    await email_service.send(
        to=customer_data['email'],
        subject=f"Welcome to DotMac ISP!",
        html=html
    )
```

---

## 🎨 Customization

### Update Branding

All templates use CSS variables and inline styles. To customize:

```html
<!-- Find the header section -->
<div class="header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">

<!-- Replace with your brand colors -->
<div class="header" style="background: linear-gradient(135deg, #YOUR_COLOR_1 0%, #YOUR_COLOR_2 100%);">
```

### Add Company Logo

```html
<!-- Add after opening header div -->
<div class="header">
    <img src="https://your-domain.com/logo.png" alt="Company Logo" style="max-width: 200px; margin-bottom: 20px;">
    <h1>Welcome!</h1>
</div>
```

### Modify Button Colors

```css
.button {
    background: #667eea;  /* Change this */
}
.button:hover {
    background: #5568d3;  /* And this */
}
```

---

## ✅ Testing Templates

### Test Rendering

```python
def test_template_rendering():
    """Test that template renders without errors."""
    from jinja2 import Environment, FileSystemLoader

    jinja_env = Environment(loader=FileSystemLoader('email_templates/workflows'))
    template = jinja_env.get_template('welcome_onboarding.html')

    # Render with test data
    html = template.render(
        customer_name='Test User',
        company_name='Test Company',
        # ... all required variables
    )

    # Assertions
    assert 'Test User' in html
    assert 'Test Company' in html
    assert len(html) > 1000  # Reasonable size check
```

### Preview in Browser

```python
# Generate preview HTML file
html = template.render({...})

with open('preview.html', 'w') as f:
    f.write(html)

# Open in browser
import webbrowser
webbrowser.open('preview.html')
```

---

## 📱 Responsive Design

All templates are mobile-responsive with:
- Fluid layouts (max-width: 600px)
- Mobile-friendly font sizes
- Touch-friendly buttons
- Collapsible sections on small screens

Test on:
- Desktop email clients (Outlook, Apple Mail)
- Web email (Gmail, Yahoo, Outlook.com)
- Mobile email apps (iOS Mail, Gmail app)

---

## 🔒 Security Best Practices

### Never Include in Emails:
- ❌ Full passwords (use password reset links)
- ❌ Full credit card numbers
- ❌ Social security numbers
- ❌ Internal system IDs (unless needed)

### Always Include:
- ✅ Links to secure portal (HTTPS)
- ✅ Contact information for support
- ✅ Unsubscribe links (for marketing emails)
- ✅ Company physical address
- ✅ Privacy policy link

---

## 📊 Email Metrics

Track these metrics for each template:
- Open rate
- Click-through rate (CTR)
- Conversion rate
- Time to first interaction
- Support ticket creation rate

Use this data to optimize templates over time.

---

## 🛠️ Troubleshooting

### Template Not Found
```python
# Verify path is correct
import os
print(os.path.exists('email_templates/workflows/welcome_onboarding.html'))
```

### Missing Variable Error
```python
# Use Jinja2's meta module to find required variables
from jinja2 import Environment, FileSystemLoader, meta

jinja_env = Environment(loader=FileSystemLoader('email_templates/workflows'))
template_source = jinja_env.loader.get_source(jinja_env, 'welcome_onboarding.html')
parsed_content = jinja_env.parse(template_source[0])
variables = meta.find_undeclared_variables(parsed_content)
print("Required variables:", variables)
```

### Rendering Issues
- Check that all required variables are provided
- Verify HTML syntax is valid
- Test in email testing tool (Litmus, Email on Acid)

---

## 📚 Additional Resources

- [Template Setup Guide](../../docs/TEMPLATE_SETUP_GUIDE.md)
- [Template Implementation Summary](../../docs/TEMPLATE_IMPLEMENTATION_SUMMARY.md)
- [Jinja2 Documentation](https://jinja.palletsprojects.com/)
- [Email HTML Best Practices](https://www.campaignmonitor.com/css/)

---

## 🎯 Template Checklist

When creating new templates:
- [ ] Mobile-responsive design
- [ ] All variables documented
- [ ] Tested in major email clients
- [ ] Includes company branding
- [ ] Contains unsubscribe link (if marketing)
- [ ] Includes support contact info
- [ ] Has clear call-to-action
- [ ] Accessible (WCAG compliant)
- [ ] Tested with real data
- [ ] Added to this README

---

**Last Updated:** 2025-10-16
**Template Count:** 6
**Status:** Production Ready
