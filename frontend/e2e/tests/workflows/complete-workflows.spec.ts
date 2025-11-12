/**
 * Complete Workflow Testing Suite
 *
 * Tests all major user workflows end-to-end
 */

import { test, expect, Page } from '@playwright/test';

const ISP_OPS_URL = process.env.ISP_OPS_URL || 'http://localhost:3001';
const PLATFORM_ADMIN_URL = process.env.PLATFORM_ADMIN_URL || 'http://localhost:3002';
const NAV_TIMEOUT = parseInt(process.env.E2E_NAV_TIMEOUT || '120000', 10);
const SELECTOR_TIMEOUT = parseInt(process.env.E2E_SELECTOR_TIMEOUT || '15000', 10);

// Test credentials (these should be created in test setup)
const TEST_CREDENTIALS = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'TestPass123!',
};

// Helper to login (if not already logged in)
async function ensureLoggedIn(page: Page, baseUrl: string) {
  await page.goto(baseUrl);

  // Check if we're on login page
  const isLoginPage = await page.locator('input[type="email"], input[type="password"]').count() > 0;

  if (isLoginPage) {
    // Try to login
    try {
      await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
      await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
      await page.click('button[type="submit"]');

      // Wait for navigation
      await page.waitForURL(/dashboard|home/, { timeout: 10000 });
    } catch (e) {
      console.log('Login not available or already logged in');
    }
  }
}

// Helper to check page loads without critical errors
async function checkPageHealth(page: Page, pageName: string) {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error' &&
        !msg.text().includes('401') &&
        !msg.text().includes('favicon')) {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  // Check page loaded
  await expect(page).toHaveTitle(/DotMac|ISP|Platform/i);

  // Log any errors
  if (errors.length > 0) {
    console.warn(`⚠️  ${pageName} has ${errors.length} errors:`, errors.slice(0, 3));
  }

  return errors.length === 0;
}

async function expectAnyVisible(page: Page, selectors: string[], errorMessage: string) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) {
      continue;
    }
    const visible = await locator.isVisible({ timeout: SELECTOR_TIMEOUT }).catch(() => false);
    if (visible) {
      return;
    }
  }
  throw new Error(errorMessage);
}

async function visit(page: Page, path: string, label: string, baseUrl = ISP_OPS_URL) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await checkPageHealth(page, label);
}

test.describe('Workflow: Subscriber Lifecycle', () => {
  test('Complete subscriber provisioning flow', async ({ page }) => {
    await visit(page, '/dashboard/subscribers', 'Subscribers List');
    await expectAnyVisible(
      page,
      [
        'button:has-text("Add")',
        'button:has-text("New")',
        'a:has-text("New Subscriber")',
        'button:has-text("Import")',
      ],
      'Subscriber creation controls missing',
    );
  });

  test('Subscriber search and filter', async ({ page }) => {
    await visit(page, '/dashboard/subscribers', 'Subscribers List');
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    await expect(searchInput).toBeVisible({ timeout: SELECTOR_TIMEOUT });
    await expectAnyVisible(
      page,
      ['button:has-text("Filter")', 'button:has-text("Segment")', 'text=/Filters/i'],
      'Subscriber filter controls missing',
    );
  });

  test('Subscriber detail view', async ({ page }) => {
    await visit(page, '/dashboard/subscribers', 'Subscribers List');
    await expectAnyVisible(
      page,
      [
        'a[href*="/subscribers/"]',
        'tr[role="row"]',
        '[data-testid="empty-state"]',
        'text=/No subscribers/i',
      ],
      'Subscriber table or empty state not visible',
    );
  });
});

test.describe('Workflow: RADIUS Management', () => {
  test('RADIUS dashboard accessibility', async ({ page }) => {
    await visit(page, '/dashboard/radius', 'RADIUS Dashboard');
    await expectAnyVisible(
      page,
      ['text=/RADIUS/i', 'text=/Authentication/i', 'text=/Accounting/i'],
      'RADIUS overview metrics missing',
    );
  });

  test('Active sessions monitoring', async ({ page }) => {
    await visit(page, '/dashboard/radius/sessions', 'RADIUS Sessions');
    await expectAnyVisible(
      page,
      ['table', '[role="table"]', '[data-testid*="session"]', 'text=/No sessions/i'],
      'Session table not visible',
    );
  });

  test('NAS device management', async ({ page }) => {
    await visit(page, '/dashboard/radius/nas', 'NAS Management');
    await expectAnyVisible(
      page,
      ['table', '[data-testid="nas-table"]', 'button:has-text("Add NAS")'],
      'NAS table or creation controls missing',
    );
  });

  test('Bandwidth profile management', async ({ page }) => {
    await visit(page, '/dashboard/radius/bandwidth-profiles', 'Bandwidth Profiles');
    await expectAnyVisible(
      page,
      ['button:has-text("New Profile")', 'table', '[data-testid="bandwidth-profile-card"]'],
      'Bandwidth profile UI missing',
    );
  });
});

test.describe('Workflow: Billing Cycle', () => {
  test('Invoice generation flow', async ({ page }) => {
    await visit(page, '/dashboard/billing-revenue/invoices', 'Invoices');
    await expectAnyVisible(
      page,
      ['button:has-text("Generate")', 'button:has-text("Create")', 'button:has-text("New Invoice")'],
      'Invoice generation CTA missing',
    );
  });

  test('Payment recording', async ({ page }) => {
    await visit(page, '/dashboard/billing-revenue/payments', 'Payments');
    await expectAnyVisible(
      page,
      ['table', '[data-testid="payments-table"]', 'text=/Payments/i'],
      'Payments table missing',
    );
  });

  test('Receipt management', async ({ page }) => {
    await visit(page, '/dashboard/billing-revenue/receipts', 'Receipts');
    await expectAnyVisible(
      page,
      ['table', 'button:has-text("New Receipt")', 'text=/Receipts/i'],
      'Receipt UI missing',
    );
  });

  test('Subscription management', async ({ page }) => {
    await visit(page, '/dashboard/billing-revenue/subscriptions', 'Subscriptions');
    await expectAnyVisible(
      page,
      ['table', 'button:has-text("New Subscription")', 'text=/Subscriptions/i'],
      'Subscription UI missing',
    );
  });

  test('Credit note issuance', async ({ page }) => {
    await visit(page, '/dashboard/billing-revenue/credit-notes', 'Credit Notes');
    await expectAnyVisible(
      page,
      ['button:has-text("New Credit Note")', 'table', 'text=/Credit Notes/i'],
      'Credit note UI missing',
    );
  });
});

test.describe('Workflow: Network Management', () => {
  test('Network monitoring dashboard', async ({ page }) => {
    await visit(page, '/dashboard/network', 'Network Dashboard');
    await expectAnyVisible(
      page,
      ['text=/Network/i', 'canvas', '[data-testid="network-summary"]'],
      'Network monitoring widgets missing',
    );
  });

  test('Fault management', async ({ page }) => {
    await visit(page, '/dashboard/network/faults', 'Fault Management');
    await expectAnyVisible(
      page,
      ['table', '[data-testid="fault-list"]', 'text=/Fault/i'],
      'Fault management UI missing',
    );
  });

  test('Live session monitoring', async ({ page }) => {
    await visit(page, '/dashboard/network/sessions/live', 'Live Sessions');
    await expectAnyVisible(
      page,
      ['table', '[data-testid="session-chart"]', 'text=/Live Sessions/i'],
      'Live session telemetry missing',
    );
  });

  test('Fiber infrastructure management', async ({ page }) => {
    await visit(page, '/dashboard/network/fiber', 'Fiber Management');
    await expectAnyVisible(
      page,
      ['text=/Fiber Infrastructure/i', 'a[href="/dashboard/network/fiber/cables"]', 'a[href="/dashboard/network/fiber/distribution-points"]'],
      'Fiber management dashboard is missing navigation cards',
    );
  });
});

test.describe('Workflow: Device Management (TR-069)', () => {
  test('Device list and monitoring', async ({ page }) => {
    await visit(page, '/dashboard/devices', 'Devices');
    await expectAnyVisible(
      page,
      ['table', '[data-testid="device-list"]', 'button:has-text("Provision Device")'],
      'Device list missing',
    );
  });

  test('Device provisioning', async ({ page }) => {
    await visit(page, '/dashboard/devices/provision', 'Device Provisioning');
    await expectAnyVisible(
      page,
      ['form', 'button:has-text("Provision")', 'text=/Provision/i'],
      'Provisioning form missing',
    );
  });

  test('Device presets management', async ({ page }) => {
    await visit(page, '/dashboard/devices/presets', 'Device Presets');
    await expectAnyVisible(
      page,
      ['[data-testid="device-preset-card"]', 'button:has-text("Create Preset")', 'text=/Presets/i'],
      'Device presets UI missing',
    );
  });
});

test.describe('Workflow: PON/GPON Management', () => {
  test('OLT management', async ({ page }) => {
    await visit(page, '/dashboard/pon/olts', 'OLT Management');
    await expectAnyVisible(
      page,
      ['table', 'button:has-text("Add OLT")', 'text=/OLT/i'],
      'OLT management UI missing',
    );
  });

  test('ONU management', async ({ page }) => {
    await visit(page, '/dashboard/pon/onus', 'ONU Management');
    await expectAnyVisible(
      page,
      ['table', 'button:has-text("Add ONU")', 'text=/ONU/i'],
      'ONU management UI missing',
    );
  });

  test('ONU discovery', async ({ page }) => {
    await visit(page, '/dashboard/pon/onus/discover', 'ONU Discovery');
    await expectAnyVisible(
      page,
      ['button:has-text("Discover")', 'form', 'text=/Discovery/i'],
      'ONU discovery UI missing',
    );
  });
});

test.describe('Workflow: Projects & Field Service Planning', () => {
  test('Project workspace surfaces pipeline and creation CTA', async ({ page }) => {
    await visit(page, '/dashboard/projects', 'Projects Dashboard');

    await expectAnyVisible(page, ['button:has-text("New Project")', 'button:has-text("Create Project")'], 'Project creation CTA missing');
    await expectAnyVisible(
      page,
      ['text=/Projects/i', 'text=/Active Projects/i', 'text=/Total Projects/i'],
      'Project metrics failed to render',
    );
  });

  test('Project template gallery is available', async ({ page }) => {
    await visit(page, '/dashboard/projects/templates', 'Project Templates');

    await expectAnyVisible(page, ['text=/Template Builder/i'], 'Template builder heading missing');
    await expectAnyVisible(page, ['button:has-text("Save Template")', 'button:has-text("Add Task")'], 'Template actions missing');
  });

  test('Fiber network map renders interactive layers', async ({ page }) => {
    await visit(page, '/dashboard/network/fiber/map', 'Fiber Network Map');

    await expectAnyVisible(
      page,
      ['.leaflet-container', 'canvas.leaflet-zoom-animated'],
      'Leaflet map container not rendered',
    );
    await expect(page.locator('button:has-text("Filters")')).toBeVisible({
      timeout: SELECTOR_TIMEOUT,
    });
    await expectAnyVisible(
      page,
      ['button:has-text("Real-time")', 'button:has-text("Polling")'],
      'Map live toggle missing',
    );
  });
});

test.describe('Workflow: Communications', () => {
  test('Send communications', async ({ page }) => {
    await visit(page, '/dashboard/communications/send', 'Send Communications');
    await expectAnyVisible(
      page,
      ['form', 'textarea', 'input[type="text"]'],
      'Communication form missing',
    );
  });

  test('Template management', async ({ page }) => {
    await visit(page, '/dashboard/communications/templates', 'Communication Templates');
    await expectAnyVisible(
      page,
      ['table', 'button:has-text("Create Template")', 'text=/Templates/i'],
      'Template list missing',
    );
  });
});

test.describe('Workflow: CRM', () => {
  test('Contact management', async ({ page }) => {
    await visit(page, '/dashboard/crm/contacts', 'CRM Contacts');
    await expectAnyVisible(
      page,
      ['button:has-text("New Contact")', 'table', 'text=/Contacts/i'],
      'CRM contacts UI missing',
    );
  });

  test('Lead management', async ({ page }) => {
    await visit(page, '/dashboard/crm/leads', 'CRM Leads');
    await expectAnyVisible(
      page,
      ['button:has-text("New Lead")', 'table', 'text=/Leads/i'],
      'CRM leads UI missing',
    );
  });

  test('Quote generation', async ({ page }) => {
    await visit(page, '/dashboard/crm/quotes', 'CRM Quotes');
    await expectAnyVisible(
      page,
      ['button:has-text("New Quote")', 'table', 'text=/Quotes/i'],
      'CRM quote UI missing',
    );
  });

  test('Site surveys', async ({ page }) => {
    await visit(page, '/dashboard/crm/site-surveys', 'Site Surveys');
    await expectAnyVisible(
      page,
      ['table', 'button:has-text("New Survey")', 'text=/Site Survey/i'],
      'Site survey UI missing',
    );
  });
});

test.describe('Workflow: Support & Ticketing', () => {
  test('Support ticket list', async ({ page }) => {
    await visit(page, '/dashboard/support', 'Support Tickets');
    await expectAnyVisible(
      page,
      ['button:has-text("New Ticket")', 'table', 'text=/Tickets/i'],
      'Support ticket list missing',
    );
  });

  test('Create support ticket', async ({ page }) => {
    await visit(page, '/dashboard/support/new', 'New Support Ticket');
    await expectAnyVisible(
      page,
      ['form', 'button:has-text("Submit Ticket")', 'input[name*="subject"]'],
      'Support ticket form missing',
    );
  });

  test('Ticketing system', async ({ page }) => {
    await visit(page, '/dashboard/ticketing', 'Ticketing System');
    await expectAnyVisible(
      page,
      ['table', 'text=/Ticketing/i', 'button:has-text("New Ticket")'],
      'Ticketing workspace missing',
    );
  });
});

test.describe('Workflow: Automation (Ansible)', () => {
  test('Playbook management', async ({ page }) => {
    await visit(page, '/dashboard/automation/playbooks', 'Automation Playbooks');
    await expectAnyVisible(
      page,
      ['button:has-text("New Playbook")', 'table', 'text=/Playbooks/i'],
      'Playbook list missing',
    );
  });

  test('Job monitoring', async ({ page }) => {
    await visit(page, '/dashboard/automation/jobs', 'Automation Jobs');
    await expectAnyVisible(
      page,
      ['table', '[data-testid="job-list"]', 'text=/Jobs/i'],
      'Automation jobs list missing',
    );
  });

  test('Inventory management', async ({ page }) => {
    await visit(page, '/dashboard/automation/inventory', 'Automation Inventory');
    await expectAnyVisible(
      page,
      ['table', 'button:has-text("Add Asset")', 'text=/Inventory/i'],
      'Automation inventory UI missing',
    );
  });
});

test.describe('Workflow: Analytics & Reporting', () => {
  test('Analytics dashboard', async ({ page }) => {
    await visit(page, '/dashboard/analytics', 'Analytics');
    await expectAnyVisible(
      page,
      ['canvas', 'svg[class*="recharts"]', '[class*="chart"]'],
      'Analytics visualizations missing',
    );
  });

  test('Advanced analytics', async ({ page }) => {
    await visit(page, '/dashboard/analytics/advanced', 'Advanced Analytics');
    await expectAnyVisible(
      page,
      ['canvas', 'svg', 'text=/Advanced Analytics/i'],
      'Advanced analytics UI missing',
    );
  });
});

test.describe('Workflow: Settings & Configuration', () => {
  test('Organization settings', async ({ page }) => {
    await visit(page, '/dashboard/settings/organization', 'Organization Settings');
    await expectAnyVisible(
      page,
      ['form', 'input', 'button:has-text("Save")'],
      'Organization settings form missing',
    );
  });

  test('Integration configuration', async ({ page }) => {
    await visit(page, '/dashboard/settings/integrations', 'Integrations');
    await expectAnyVisible(
      page,
      ['table', 'button:has-text("Add Integration")', 'text=/Integration/i'],
      'Integrations list missing',
    );
  });

  test('Security settings', async ({ page }) => {
    await visit(page, '/dashboard/settings/security', 'Security Settings');
    await expectAnyVisible(
      page,
      ['form', 'text=/Security/i', 'button:has-text("Rotate")'],
      'Security settings UI missing',
    );
  });

  test('Notification preferences', async ({ page }) => {
    await visit(page, '/dashboard/settings/notifications', 'Notification Settings');
    await expectAnyVisible(
      page,
      ['form', 'input[type="checkbox"]', 'text=/Notifications/i'],
      'Notification settings UI missing',
    );
  });
});

test.describe('Workflow: Customer Portal', () => {
  test('Customer dashboard', async ({ page }) => {
    await visit(page, '/customer-portal', 'Customer Portal');
    await expectAnyVisible(
      page,
      ['text=/Customer Portal/i', 'text=/Usage/i', 'text=/Billing/i'],
      'Customer dashboard summary missing',
    );
  });

  test('Customer billing view', async ({ page }) => {
    await visit(page, '/customer-portal/billing', 'Customer Billing');
    await expectAnyVisible(
      page,
      ['table', 'text=/Invoices/i', 'button:has-text("Pay")'],
      'Customer billing UI missing',
    );
  });

  test('Customer usage stats', async ({ page }) => {
    await visit(page, '/customer-portal/usage', 'Customer Usage');
    await expectAnyVisible(
      page,
      ['canvas', 'text=/Usage/i', 'text=/Bandwidth/i'],
      'Customer usage charts missing',
    );
  });

  test('Customer support', async ({ page }) => {
    await visit(page, '/customer-portal/support', 'Customer Support');
    await expectAnyVisible(
      page,
      ['form', 'button:has-text("Submit Request")', 'text=/Support/i'],
      'Customer support UI missing',
    );
  });
});

test.describe('Platform Admin: Tenant Management', () => {
  test('Tenant list and management', async ({ page }) => {
    await visit(page, '/dashboard/platform-admin/tenants', 'Tenant Management', PLATFORM_ADMIN_URL);
    await expectAnyVisible(
      page,
      ['table', 'button:has-text("New Tenant")', 'text=/Tenants/i'],
      'Tenant list missing',
    );
  });

  test('Audit log viewing', async ({ page }) => {
    await visit(page, '/dashboard/platform-admin/audit', 'Audit Logs', PLATFORM_ADMIN_URL);
    await expectAnyVisible(
      page,
      ['table', 'text=/Audit/i', 'button:has-text("Export")'],
      'Audit log UI missing',
    );
  });

  test('System configuration', async ({ page }) => {
    await visit(page, '/dashboard/platform-admin/system', 'System Configuration', PLATFORM_ADMIN_URL);
    await expectAnyVisible(
      page,
      ['form', 'button:has-text("Save Changes")', 'text=/System/i'],
      'System configuration UI missing',
    );
  });
});

test.describe('Platform Admin: Security & Access', () => {
  test('User management', async ({ page }) => {
    await visit(page, '/dashboard/security-access/users', 'User Management', PLATFORM_ADMIN_URL);
    await expectAnyVisible(
      page,
      ['button:has-text("Invite User")', 'table', 'text=/Users/i'],
      'Platform user management UI missing',
    );
  });

  test('Role management', async ({ page }) => {
    await visit(page, '/dashboard/security-access/roles', 'Role Management', PLATFORM_ADMIN_URL);
    await expectAnyVisible(
      page,
      ['button:has-text("New Role")', 'table', 'text=/Roles/i'],
      'Role management UI missing',
    );
  });

  test('Permission configuration', async ({ page }) => {
    await visit(page, '/dashboard/security-access/permissions', 'Permissions', PLATFORM_ADMIN_URL);
    await expectAnyVisible(
      page,
      ['table', 'text=/Permissions/i'],
      'Permissions matrix missing',
    );
  });

  test('API key management', async ({ page }) => {
    await visit(page, '/dashboard/security-access/api-keys', 'API Keys', PLATFORM_ADMIN_URL);
    await expectAnyVisible(
      page,
      ['button:has-text("Create API Key")', 'table', 'text=/API Key/i'],
      'API key management UI missing',
    );
  });
});

test.describe('Platform Admin: Licensing', () => {
  test('License dashboard', async ({ page }) => {
    await visit(page, '/dashboard/licensing', 'Licensing', PLATFORM_ADMIN_URL);
    await expectAnyVisible(
      page,
      ['text=/Licensing/i', 'table', 'button:has-text("Assign License")'],
      'License dashboard missing',
    );
  });

  test('Platform admin licensing', async ({ page }) => {
    await visit(page, '/dashboard/platform-admin/licensing', 'Platform Licensing', PLATFORM_ADMIN_URL);
    await expectAnyVisible(
      page,
      ['text=/Platform Licensing/i', 'table'],
      'Platform licensing UI missing',
    );
  });
});

test.describe('Platform Admin: Partner Management', () => {
  test('Partner list', async ({ page }) => {
    await visit(page, '/dashboard/partners', 'Partners', PLATFORM_ADMIN_URL);
    await expectAnyVisible(
      page,
      ['table', 'button:has-text("New Partner")', 'text=/Partners/i'],
      'Partner list missing',
    );
  });

  test('Partner onboarding', async ({ page }) => {
    await visit(page, '/dashboard/partners/onboarding', 'Partner Onboarding', PLATFORM_ADMIN_URL);
    await expectAnyVisible(
      page,
      ['form', 'button:has-text("Start Onboarding")', 'text=/Onboarding/i'],
      'Partner onboarding UI missing',
    );
  });

  test('Partner revenue', async ({ page }) => {
    await visit(page, '/dashboard/partners/revenue', 'Partner Revenue', PLATFORM_ADMIN_URL);
    await expectAnyVisible(
      page,
      ['canvas', 'text=/Revenue/i', '[data-testid="revenue-summary"]'],
      'Partner revenue dashboard missing',
    );
  });
});

test.describe('Platform Admin: Tenant Portal', () => {
  test('Tenant portal dashboard', async ({ page }) => {
    await visit(page, '/tenant-portal', 'Tenant Portal', PLATFORM_ADMIN_URL);
    await expectAnyVisible(
      page,
      ['text=/Tenant Portal/i', 'text=/Revenue/i', 'text=/Subscribers/i'],
      'Tenant portal summary missing',
    );
  });

  test('Tenant billing', async ({ page }) => {
    await visit(page, '/tenant-portal/billing', 'Tenant Billing', PLATFORM_ADMIN_URL);
    await expectAnyVisible(
      page,
      ['table', 'text=/Billing/i'],
      'Tenant billing UI missing',
    );
  });

  test('Tenant customers', async ({ page }) => {
    await visit(page, '/tenant-portal/customers', 'Tenant Customers', PLATFORM_ADMIN_URL);
    await expectAnyVisible(
      page,
      ['table', 'text=/Customers/i'],
      'Tenant customer list missing',
    );
  });

  test('Tenant users', async ({ page }) => {
    await visit(page, '/tenant-portal/users', 'Tenant Users', PLATFORM_ADMIN_URL);
    await expectAnyVisible(
      page,
      ['table', 'button:has-text("Invite")', 'text=/Users/i'],
      'Tenant user list missing',
    );
  });
});

test.describe('Cross-Functional Workflows', () => {
  test('Complete subscriber onboarding to billing', async ({ page }) => {
    await visit(page, '/dashboard/subscribers', 'Subscriber Onboarding');
    await expectAnyVisible(
      page,
      ['button:has-text("New Subscriber")', 'button:has-text("Create Service")'],
      'Subscriber onboarding CTA missing',
    );
    await visit(page, '/dashboard/billing-revenue/invoices', 'Invoices');
    await expectAnyVisible(
      page,
      ['button:has-text("Generate")', 'table'],
      'Invoice generation entry point missing',
    );
  });

  test('Network fault to support ticket', async ({ page }) => {
    await visit(page, '/dashboard/network/faults', 'Fault Management');
    await expectAnyVisible(
      page,
      ['table', 'text=/Fault/i'],
      'Fault list missing',
    );
    await visit(page, '/dashboard/support/new', 'New Support Ticket');
    await expectAnyVisible(
      page,
      ['form', 'button:has-text("Submit Ticket")'],
      'Support ticket creation missing',
    );
  });

  test('Device provisioning to service activation', async ({ page }) => {
    await visit(page, '/dashboard/devices/provision', 'Device Provisioning');
    await expectAnyVisible(
      page,
      ['form', 'button:has-text("Provision")'],
      'Provisioning form missing',
    );
    await visit(page, '/dashboard/services', 'Service Activation');
    await expectAnyVisible(
      page,
      ['button:has-text("Activate Service")', 'text=/Services/i'],
      'Service activation UI missing',
    );
  });
});
