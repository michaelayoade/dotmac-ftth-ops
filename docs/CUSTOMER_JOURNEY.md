# Customer Journey Documentation

This document outlines the complete customer lifecycle journey for the FTTH platform, from initial registration through service cancellation.

## Table of Contents

- [Journey Stages](#journey-stages)
- [API Endpoints](#api-endpoints)
- [Timing Estimates](#timing-estimates)
- [Success Metrics](#success-metrics)
- [Failure Scenarios](#failure-scenarios)
- [External Integrations](#external-integrations)
- [Customer Notifications](#customer-notifications)

---

## Journey Stages

The customer journey consists of 11 distinct stages:

###  1. Registration
- **Description**: User creates account
- **API Endpoint**: `POST /auth/register`
- **Duration**: 2-5 minutes
- **Success Criteria**: User account created, verification email sent

### 2. Verification
- **Description**: User verifies email
- **API Endpoint**: `POST /auth/verify-email`
- **Duration**: 1 minute
- **Success Criteria**: Email verified, account activated

### 3. Profile Setup
- **Description**: Create customer profile
- **API Endpoint**: `POST /customers`
- **Duration**: 3-5 minutes
- **Success Criteria**: Customer record created with contact info

### 4. Plan Selection
- **Description**: Select service plan
- **API Endpoint**: `POST /subscriptions`
- **Duration**: 2-3 minutes
- **Success Criteria**: Subscription created, payment processed

### 5. Service Activation
- **Description**: Provision and activate service
- **API Endpoint**: `POST /services/provision`
- **Duration**: 15-30 minutes
- **Success Criteria**: Service active, customer can use internet

### 6. Ongoing Usage
- **Description**: Customer uses service
- **API Endpoint**: `GET /subscriptions/{id}/usage`
- **Duration**: Monthly cycle
- **Success Criteria**: Usage tracked, data caps monitored

### 7. Billing Renewal
- **Description**: Monthly billing cycle
- **API Endpoint**: `POST /subscriptions/{id}/renew`
- **Duration**: Automatic
- **Success Criteria**: Invoice generated, payment processed

### 8. Plan Change
- **Description**: Upgrade/downgrade plan
- **API Endpoint**: `POST /subscriptions/{id}/change-plan`
- **Duration**: Instant
- **Success Criteria**: Plan changed, proration calculated

### 9. Suspension
- **Description**: Suspend for non-payment
- **API Endpoint**: `POST /services/{id}/suspend`
- **Duration**: Automatic after grace period
- **Success Criteria**: Service suspended, customer notified

### 10. Resumption
- **Description**: Resume after payment
- **API Endpoint**: `POST /services/{id}/resume`
- **Duration**: 1-5 minutes
- **Success Criteria**: Service restored, customer can use internet

### 11. Cancellation
- **Description**: Cancel subscription
- **API Endpoint**: `POST /subscriptions/{id}/cancel`
- **Duration**: Immediate or end of period
- **Success Criteria**: Subscription cancelled, services terminated

---

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user account
- `POST /auth/login` - User login
- `POST /auth/verify-email` - Email verification
- `POST /auth/enable-2fa` - Enable two-factor authentication
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - User logout

### Customer Management
- `POST /customers` - Create customer profile
- `GET /customers` - List all customers
- `GET /customers/{id}` - Get customer details
- `PATCH /customers/{id}` - Update customer info
- `DELETE /customers/{id}` - Delete customer

### Subscriptions
- `POST /subscriptions` - Create new subscription
- `GET /subscriptions` - List all subscriptions
- `GET /subscriptions/{id}` - Get subscription details
- `POST /subscriptions/{id}/cancel` - Cancel subscription
- `POST /subscriptions/{id}/change-plan` - Change subscription plan
- `POST /subscriptions/{id}/renew` - Renew subscription
- `GET /subscriptions/{id}/proration` - Calculate proration for plan change

### Services
- `POST /services/provision` - Provision new service
- `POST /services/{id}/activate` - Activate service
- `POST /services/{id}/suspend` - Suspend service
- `POST /services/{id}/resume` - Resume suspended service
- `POST /services/{id}/terminate` - Terminate service
- `POST /services/{id}/health-check` - Check service health

### Billing
- `GET /invoices` - List all invoices
- `GET /invoices/{id}` - Get invoice details
- `POST /invoices/{id}/pay` - Pay invoice
- `GET /invoices/{id}/pdf` - Download invoice PDF
- `GET /invoices/upcoming` - Preview upcoming invoice

### Support
- `POST /tickets` - Create support ticket
- `GET /tickets` - List all tickets
- `GET /tickets/{id}` - Get ticket details
- `POST /tickets/{id}/messages` - Add message to ticket
- `POST /tickets/{id}/resolve` - Resolve ticket

---

## Timing Estimates

### Fast Operations (< 1 minute)
- Login/Logout
- Email verification
- Plan selection
- Plan changes (calculation)
- Invoice viewing

### Medium Operations (1-5 minutes)
- User registration
- Profile setup
- Payment processing
- Service resumption
- Ticket creation

### Slow Operations (5-30 minutes)
- Service provisioning
- Service activation
- Complex diagnostics

### Automated Operations
- Monthly billing cycle
- Usage tracking
- Renewal reminders
- Dunning (suspension for non-payment)

---

## Success Metrics

### Registration Success
- **Metric**: Account created and verified
- **Measurement**: % of registrations that complete verification
- **Target**: 90%+

### Onboarding Completion
- **Metric**: Time from registration to active service
- **Measurement**: Average duration in minutes
- **Target**: < 60 minutes (automated), < 24 hours (manual)

### Payment Success
- **Metric**: First payment success rate
- **Measurement**: % of first invoices paid successfully
- **Target**: 95%+

### Service Uptime
- **Metric**: Service availability
- **Measurement**: % uptime over 30 days
- **Target**: 99.9%+

### Renewal Rate
- **Metric**: Monthly renewal success
- **Measurement**: % of subscriptions that renew
- **Target**: 95%+

### Churn Rate
- **Metric**: Customer cancellations
- **Measurement**: % of customers who cancel per month
- **Target**: < 5%

---

## Failure Scenarios

### Payment Failure

**Trigger**: Credit card declined

**Immediate Action**: Retry payment with different card

**Recovery Steps**:
1. Send payment failure notification
2. Provide 7-day grace period
3. Send reminder emails (day 3, 5, 7)
4. Suspend service after grace period
5. Allow resumption upon payment

**Prevention**: Validate payment method during signup

### Service Provisioning Failure

**Trigger**: Network error, CPE offline, ONU not found

**Immediate Action**: Retry provisioning, escalate to NOC

**Recovery Steps**:
1. Log error details
2. Create support ticket automatically
3. Notify customer of delay
4. Retry with exponential backoff
5. Manual intervention if retries fail

**Prevention**: Pre-validate network availability

### Email Verification Timeout

**Trigger**: User doesn't verify email within 24 hours

**Immediate Action**: Resend verification email

**Recovery Steps**:
1. Send reminder email after 12 hours
2. Provide manual verification option
3. Expire unverified accounts after 7 days

**Prevention**: Clear instructions, prominent call-to-action

---

## External Integrations

### RADIUS
**Purpose**: Internet authentication and session management

**Journey Stages**: Service Activation, Ongoing Usage

**Operations**:
- Create subscriber account
- Set bandwidth limits
- Track session data
- Disconnect sessions

### VOLTHA
**Purpose**: ONU (fiber equipment) management

**Journey Stages**: Service Provisioning, Diagnostics

**Operations**:
- Provision ONU
- Check optical signal
- Monitor equipment status
- Reboot ONU

### GenieACS
**Purpose**: CPE (router) management via TR-069

**Journey Stages**: Service Provisioning, Support

**Operations**:
- Configure CPE
- Update firmware
- Reboot device
- Diagnose issues

### NetBox
**Purpose**: Network inventory and IPAM

**Journey Stages**: Service Provisioning

**Operations**:
- Assign IP addresses
- Track network resources
- Validate network topology

### Payment Gateway
**Purpose**: Process credit card payments

**Journey Stages**: Registration, Billing Cycle

**Operations**:
- Tokenize payment method
- Process payments
- Handle refunds
- Manage payment methods

---

## Customer Notifications

### Welcome Email
- **Trigger**: Account created
- **Timing**: Immediately
- **Content**: Welcome message, verification link

### Email Verified
- **Trigger**: Email verification completed
- **Timing**: Immediately
- **Content**: Next steps, profile setup link

### Service Activated
- **Trigger**: Service successfully provisioned
- **Timing**: Within 5 minutes
- **Content**: Login credentials, getting started guide

### Invoice Generated
- **Trigger**: Billing cycle completed
- **Timing**: Monthly
- **Content**: Invoice PDF, payment link, due date

### Payment Received
- **Trigger**: Payment processed successfully
- **Timing**: Immediately
- **Content**: Receipt, next billing date

### Payment Failed
- **Trigger**: Payment declined
- **Timing**: Immediately
- **Content**: Failure reason, update payment link, grace period info

### Service Suspended
- **Trigger**: Non-payment after grace period
- **Timing**: Immediately
- **Content**: Suspension notice, pay now link, reactivation steps

### Service Resumed
- **Trigger**: Payment received, service reactivated
- **Timing**: Within 5 minutes
- **Content**: Restoration confirmation, thank you message

### Cancellation Confirmed
- **Trigger**: Subscription cancelled
- **Timing**: Immediately
- **Content**: Cancellation date, final bill estimate, feedback request

---

## Related Documentation

- [API Documentation](./API_DOCUMENTATION.md)
- [API Examples](./API_EXAMPLES.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [Exception Handling Guide](./EXCEPTION_HANDLING_GUIDE.md)

---

*Last Updated: 2025-10-25*
