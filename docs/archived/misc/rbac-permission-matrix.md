# RBAC Permission Matrix

## Core Permission Categories

### 1. Customer Management
| Permission | Description | Default Roles |
|------------|-------------|---------------|
| `customer.read` | View customer details | support_agent, billing_manager, admin |
| `customer.create` | Create new customers | sales_rep, admin |
| `customer.update` | Edit customer information | support_agent, admin |
| `customer.delete` | Delete customers | admin |
| `customer.export` | Export customer data | billing_manager, admin |
| `customer.import` | Bulk import customers | admin |

### 2. Ticketing System
| Permission | Description | Default Roles |
|------------|-------------|---------------|
| `ticket.read.own` | View own tickets | customer, all_staff |
| `ticket.read.assigned` | View assigned tickets | support_agent, developer |
| `ticket.read.all` | View all tickets | support_manager, admin |
| `ticket.create` | Create tickets | all_users |
| `ticket.update.own` | Update own tickets | customer |
| `ticket.update.assigned` | Update assigned tickets | support_agent, developer |
| `ticket.update.all` | Update any ticket | support_manager, admin |
| `ticket.assign` | Assign tickets to agents | support_lead, support_manager, admin |
| `ticket.escalate` | Escalate tickets | support_agent, support_lead |
| `ticket.close` | Close tickets | support_agent, admin |
| `ticket.delete` | Delete tickets | admin |
| `ticket.merge` | Merge duplicate tickets | support_lead, admin |
| `ticket.export` | Export ticket data | support_manager, admin |

### 3. Billing & Payments
| Permission | Description | Default Roles |
|------------|-------------|---------------|
| `billing.read` | View billing information | billing_analyst, billing_manager, admin |
| `billing.invoice.create` | Create invoices | billing_agent, billing_manager |
| `billing.invoice.update` | Modify invoices | billing_manager, admin |
| `billing.invoice.void` | Void invoices | billing_manager, admin |
| `billing.payment.process` | Process payments | billing_agent, billing_manager |
| `billing.payment.refund` | Issue refunds | billing_manager, admin |
| `billing.subscription.manage` | Manage subscriptions | billing_manager, admin |
| `billing.export` | Export financial data | billing_manager, finance_admin |

### 4. Security & Secrets
| Permission | Description | Default Roles |
|------------|-------------|---------------|
| `security.secret.read` | Read secrets | developer, devops, admin |
| `security.secret.write` | Create/update secrets | devops, admin |
| `security.secret.delete` | Delete secrets | admin |
| `security.secret.rotate` | Rotate secrets | security_admin, admin |
| `security.audit.read` | View audit logs | security_analyst, admin |
| `security.audit.export` | Export audit logs | security_admin, admin |

### 5. System Administration
| Permission | Description | Default Roles |
|------------|-------------|---------------|
| `admin.user.read` | View user accounts | support_manager, admin |
| `admin.user.create` | Create user accounts | admin |
| `admin.user.update` | Modify user accounts | admin |
| `admin.user.delete` | Delete user accounts | admin |
| `admin.role.manage` | Manage roles/permissions | admin |
| `admin.settings.read` | View system settings | support_manager, admin |
| `admin.settings.update` | Modify system settings | admin |
| `admin.plugin.manage` | Manage plugins | admin |

### 6. Analytics & Reporting
| Permission | Description | Default Roles |
|------------|-------------|---------------|
| `analytics.dashboard.view` | View dashboards | all_staff |
| `analytics.report.create` | Create reports | analyst, manager_roles |
| `analytics.report.export` | Export reports | analyst, manager_roles |
| `analytics.metrics.admin` | Configure metrics | admin |

## Default Role Definitions

### Customer Roles
- **customer**: Basic customer access
  - `ticket.read.own`
  - `ticket.create`
  - `ticket.update.own`

### Support Roles
- **support_agent**: Front-line support
  - Inherits: customer permissions
  - `customer.read`
  - `customer.update`
  - `ticket.read.assigned`
  - `ticket.update.assigned`
  - `ticket.assign` (to self only)
  - `ticket.escalate`
  - `ticket.close`

- **support_lead**: Senior support
  - Inherits: support_agent permissions
  - `ticket.assign` (to team)
  - `ticket.merge`
  - `analytics.report.create`

- **support_manager**: Support management
  - Inherits: support_lead permissions
  - `ticket.read.all`
  - `ticket.update.all`
  - `ticket.export`
  - `admin.user.read`
  - `analytics.report.export`

### Billing Roles
- **billing_analyst**: Read-only billing
  - `billing.read`
  - `customer.read`
  - `analytics.dashboard.view`

- **billing_agent**: Billing operations
  - Inherits: billing_analyst permissions
  - `billing.invoice.create`
  - `billing.payment.process`

- **billing_manager**: Full billing control
  - Inherits: billing_agent permissions
  - `billing.invoice.update`
  - `billing.invoice.void`
  - `billing.payment.refund`
  - `billing.subscription.manage`
  - `billing.export`
  - `customer.export`

### Technical Roles
- **developer**: Development access
  - `security.secret.read`
  - `ticket.read.assigned`
  - `ticket.update.assigned`
  - `analytics.dashboard.view`

- **devops**: Operations access
  - Inherits: developer permissions
  - `security.secret.write`
  - `admin.settings.read`

### Administrative Roles
- **security_admin**: Security administration
  - `security.secret.rotate`
  - `security.audit.read`
  - `security.audit.export`

- **admin**: Full system access
  - All permissions

## Permission Inheritance Rules

1. **Hierarchical Inheritance**: Higher roles inherit lower role permissions
2. **Department Isolation**: Billing permissions don't grant support permissions
3. **Audit Trail**: All permission changes are logged
4. **Time-based Permissions**: Optional expiry for temporary access
5. **Delegation**: Managers can delegate subset of their permissions

## Implementation Priority

### Phase 1 (Core)
- Basic role/permission tables
- User-role assignments
- Token claims with permissions
- Simple permission checks

### Phase 2 (Enhanced)
- Role inheritance
- Permission caching
- Audit logging
- UI for role management

### Phase 3 (Advanced)
- Time-based permissions
- Delegation system
- Dynamic permission rules
- Multi-tenant isolation