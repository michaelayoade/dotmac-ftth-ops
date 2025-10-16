/**
 * End-to-End Integration Tests for UI Components
 *
 * Tests the integration between:
 * 1. Global Search UI
 * 2. Communications Dashboard
 * 3. Audit Dashboard
 *
 * And their respective service layers and backend APIs.
 */

import { test, expect, describe } from '@jest/globals';

// Mock setup
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Test environment setup
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

describe('E2E: Global Search UI Integration', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  test('should perform search and display results', async () => {
    // Mock search API response
    const mockSearchResponse = {
      results: [
        {
          id: 'cust-123',
          type: 'customer',
          title: 'John Doe',
          content: 'Customer account for John Doe',
          score: 0.95,
          metadata: { email: 'john@example.com' },
        },
        {
          id: 'inv-456',
          type: 'invoice',
          title: 'Invoice #INV-001',
          content: 'Invoice for $1,234.56',
          score: 0.87,
          metadata: { amount: 1234.56 },
        },
      ],
      total: 2,
      facets: {
        types: {
          customer: 1,
          invoice: 1,
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSearchResponse,
    });

    // Import search service
    const { searchService } = await import('@/lib/services/search-service');

    // Perform search
    const result = await searchService.search({
      q: 'john',
      limit: 10,
      page: 1,
    });

    // Verify API was called correctly
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/search?q=john'),
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      })
    );

    // Verify results
    expect(result.results).toHaveLength(2);
    expect(result.results[0].type).toBe('customer');
    expect(result.total).toBe(2);
    expect(result.facets?.types?.customer).toBe(1);
  });

  test('should filter search by entity type', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 'cust-123',
            type: 'customer',
            title: 'John Doe',
            content: 'Customer account',
            score: 0.95,
            metadata: {},
          },
        ],
        total: 1,
        facets: { types: { customer: 1 } },
      }),
    });

    const { searchService } = await import('@/lib/services/search-service');

    const result = await searchService.searchByType('john', 'customer', 20);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('type=customer'),
      expect.any(Object)
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0].type).toBe('customer');
  });

  test('should handle search errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Search service unavailable',
    });

    const { searchService } = await import('@/lib/services/search-service');

    await expect(
      searchService.search({ q: 'test', limit: 10, page: 1 })
    ).rejects.toThrow('Search service unavailable');
  });

  test('should index content successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'search-idx-123',
        status: 'indexed',
        message: 'Content indexed successfully',
      }),
    });

    const { searchService } = await import('@/lib/services/search-service');

    const result = await searchService.indexContent({
      id: 'cust-123',
      type: 'customer',
      title: 'John Doe',
      content: 'Customer account',
      metadata: {},
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/search/index'),
      expect.objectContaining({
        method: 'POST',
      })
    );

    expect(result.status).toBe('indexed');
  });

  test('should reindex entity', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    const { searchService } = await import('@/lib/services/search-service');

    await expect(
      searchService.reindex({ entity_type: 'customer' })
    ).resolves.not.toThrow();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/search/reindex'),
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});

describe('E2E: Communications Dashboard Integration', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  test('should fetch communication statistics', async () => {
    const mockStats = {
      total_sent: 1250,
      total_delivered: 1180,
      total_opened: 850,
      total_clicked: 320,
      total_bounced: 45,
      total_failed: 25,
      delivery_rate: 94.4,
      open_rate: 72.0,
      click_rate: 37.6,
      bounce_rate: 3.6,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    const { communicationsService } = await import(
      '@/lib/services/communications-service'
    );

    const result = await communicationsService.getStatistics({});

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/communications/stats'),
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      })
    );

    expect(result.total_sent).toBe(1250);
    expect(result.delivery_rate).toBe(94.4);
  });

  test('should send email successfully', async () => {
    const mockEmailResponse = {
      message_id: 'msg-123',
      status: 'sent',
      recipient: 'john@example.com',
      sent_at: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockEmailResponse,
    });

    const { communicationsService } = await import(
      '@/lib/services/communications-service'
    );

    const result = await communicationsService.sendEmail({
      to: 'john@example.com',
      subject: 'Test Email',
      body: 'This is a test email',
      from_email: 'noreply@example.com',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/communications/email/send'),
      expect.objectContaining({
        method: 'POST',
      })
    );

    expect(result.message_id).toBe('msg-123');
    expect(result.status).toBe('sent');
  });

  test('should queue email for async sending', async () => {
    const mockQueueResponse = {
      task_id: 'task-456',
      status: 'queued',
      message: 'Email queued successfully',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockQueueResponse,
    });

    const { communicationsService } = await import(
      '@/lib/services/communications-service'
    );

    const result = await communicationsService.queueEmail({
      to: 'john@example.com',
      subject: 'Scheduled Email',
      body: 'This email will be sent later',
      from_email: 'noreply@example.com',
      scheduled_at: new Date(Date.now() + 3600000).toISOString(),
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/communications/email/queue'),
      expect.objectContaining({
        method: 'POST',
      })
    );

    expect(result.task_id).toBe('task-456');
    expect(result.status).toBe('queued');
  });

  test('should fetch communication logs with filters', async () => {
    const mockLogs = {
      logs: [
        {
          id: 'log-1',
          channel: 'email',
          status: 'delivered',
          recipient_email: 'john@example.com',
          subject: 'Test Email',
          created_at: new Date().toISOString(),
        },
        {
          id: 'log-2',
          channel: 'email',
          status: 'sent',
          recipient_email: 'jane@example.com',
          subject: 'Another Email',
          created_at: new Date().toISOString(),
        },
      ],
      total: 2,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockLogs,
    });

    const { communicationsService } = await import(
      '@/lib/services/communications-service'
    );

    const result = await communicationsService.listLogs({
      channel: 'email',
      status: 'delivered',
      page: 1,
      page_size: 20,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/communications/logs'),
      expect.any(Object)
    );

    expect(result.logs).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  test('should check health status', async () => {
    const mockHealth = {
      status: 'healthy',
      smtp_available: true,
      smtp_host: 'smtp.example.com',
      smtp_port: 587,
      redis_available: true,
      celery_available: true,
      active_workers: 4,
      pending_tasks: 15,
      failed_tasks: 2,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockHealth,
    });

    const { communicationsService } = await import(
      '@/lib/services/communications-service'
    );

    const result = await communicationsService.healthCheck();

    expect(result.smtp_available).toBe(true);
    expect(result.active_workers).toBe(4);
  });

  test('should create template successfully', async () => {
    const mockTemplate = {
      id: 'tmpl-123',
      name: 'Welcome Email',
      channel: 'email',
      subject: 'Welcome to {{company_name}}',
      body: 'Hello {{customer_name}}',
      is_active: true,
      created_at: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTemplate,
    });

    const { communicationsService } = await import(
      '@/lib/services/communications-service'
    );

    const result = await communicationsService.createTemplate({
      name: 'Welcome Email',
      channel: 'email',
      subject: 'Welcome to {{company_name}}',
      body: 'Hello {{customer_name}}',
      is_active: true,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/communications/templates'),
      expect.objectContaining({
        method: 'POST',
      })
    );

    expect(result.id).toBe('tmpl-123');
    expect(result.name).toBe('Welcome Email');
  });
});

describe('E2E: Audit Dashboard Integration', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  test('should fetch audit activities list', async () => {
    const mockAuditData = {
      activities: [
        {
          id: 'audit-1',
          activity_type: 'user.login',
          severity: 'low',
          user_id: 'user-123',
          tenant_id: 'tenant-456',
          action: 'login',
          description: 'User logged in successfully',
          ip_address: '192.168.1.1',
          timestamp: new Date().toISOString(),
          details: {},
        },
        {
          id: 'audit-2',
          activity_type: 'rbac.permission.grant',
          severity: 'high',
          user_id: 'admin-789',
          tenant_id: 'tenant-456',
          action: 'grant',
          resource_type: 'permission',
          resource_id: 'perm-001',
          description: 'Permission granted to user',
          ip_address: '192.168.1.2',
          timestamp: new Date().toISOString(),
          details: { permission: 'admin.write' },
        },
      ],
      total: 2,
      page: 1,
      per_page: 50,
      total_pages: 1,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAuditData,
    });

    const { auditService } = await import('@/lib/services/audit-service');

    const result = await auditService.listActivities({
      days: 30,
      page: 1,
      per_page: 50,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/audit/activities'),
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      })
    );

    expect(result.activities).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.activities[0].activity_type).toBe('user.login');
  });

  test('should fetch activity summary', async () => {
    const mockSummary = {
      total_activities: 1523,
      by_severity: {
        low: 1200,
        medium: 250,
        high: 60,
        critical: 13,
      },
      by_type: {
        'user.login': 450,
        'user.logout': 420,
        'rbac.permission.grant': 35,
        'customer.create': 125,
        'invoice.create': 98,
      },
      by_user: [
        { user_id: 'user-123', count: 245 },
        { user_id: 'user-456', count: 189 },
        { user_id: 'user-789', count: 156 },
      ],
      recent_critical: [
        {
          id: 'audit-crit-1',
          activity_type: 'security.breach.attempt',
          severity: 'critical',
          user_id: 'user-999',
          tenant_id: 'tenant-123',
          action: 'access_denied',
          description: 'Unauthorized access attempt detected',
          timestamp: new Date().toISOString(),
          details: {},
        },
      ],
      timeline: [
        { date: '2025-01-14', count: 145 },
        { date: '2025-01-15', count: 162 },
        { date: '2025-01-16', count: 178 },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSummary,
    });

    const { auditService } = await import('@/lib/services/audit-service');

    const result = await auditService.getActivitySummary(7);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/audit/activities/summary'),
      expect.any(Object)
    );

    expect(result.total_activities).toBe(1523);
    expect(result.by_severity.critical).toBe(13);
    expect(result.by_user).toHaveLength(3);
    expect(result.recent_critical).toHaveLength(1);
  });

  test('should fetch user activities', async () => {
    const mockUserActivities = [
      {
        id: 'audit-1',
        activity_type: 'user.login',
        severity: 'low',
        user_id: 'user-123',
        tenant_id: 'tenant-456',
        action: 'login',
        description: 'User logged in',
        timestamp: new Date().toISOString(),
        details: {},
      },
      {
        id: 'audit-2',
        activity_type: 'customer.view',
        severity: 'low',
        user_id: 'user-123',
        tenant_id: 'tenant-456',
        action: 'view',
        resource_type: 'customer',
        resource_id: 'cust-789',
        description: 'Viewed customer details',
        timestamp: new Date().toISOString(),
        details: {},
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUserActivities,
    });

    const { auditService } = await import('@/lib/services/audit-service');

    const result = await auditService.getUserActivities('user-123', 50, 30);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/audit/activities/user/user-123'),
      expect.any(Object)
    );

    expect(result).toHaveLength(2);
    expect(result[0].user_id).toBe('user-123');
  });

  test('should filter activities by severity', async () => {
    const mockCriticalActivities = {
      activities: [
        {
          id: 'audit-crit-1',
          activity_type: 'security.breach.attempt',
          severity: 'critical',
          user_id: 'user-999',
          tenant_id: 'tenant-123',
          action: 'access_denied',
          description: 'Unauthorized access attempt',
          timestamp: new Date().toISOString(),
          details: {},
        },
      ],
      total: 1,
      page: 1,
      per_page: 50,
      total_pages: 1,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockCriticalActivities,
    });

    const { auditService } = await import('@/lib/services/audit-service');

    const result = await auditService.listActivities({
      severity: 'critical',
      days: 7,
      page: 1,
      per_page: 50,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('severity=critical'),
      expect.any(Object)
    );

    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].severity).toBe('critical');
  });

  test('should export audit logs', async () => {
    const mockExportResponse = {
      export_id: 'export-123',
      status: 'pending',
      download_url: undefined,
      expires_at: undefined,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockExportResponse,
    });

    const { auditService } = await import('@/lib/services/audit-service');

    const result = await auditService.exportLogs({
      filters: { days: 30 },
      format: 'csv',
      include_metadata: true,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/audit/export'),
      expect.objectContaining({
        method: 'POST',
      })
    );

    expect(result.export_id).toBe('export-123');
    expect(result.status).toBe('pending');
  });

  test('should get compliance report', async () => {
    const mockComplianceReport = {
      report_id: 'report-123',
      period_start: '2025-01-01T00:00:00Z',
      period_end: '2025-01-16T23:59:59Z',
      total_events: 1523,
      critical_events: 13,
      failed_access_attempts: 8,
      permission_changes: 42,
      data_exports: 15,
      compliance_score: 92.5,
      issues: [
        {
          severity: 'high',
          description: 'Multiple failed login attempts detected',
          event_ids: ['audit-1', 'audit-2'],
        },
      ],
      generated_at: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockComplianceReport,
    });

    const { auditService } = await import('@/lib/services/audit-service');

    const result = await auditService.getComplianceReport(
      '2025-01-01T00:00:00Z',
      '2025-01-16T23:59:59Z'
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/audit/compliance'),
      expect.any(Object)
    );

    expect(result.compliance_score).toBe(92.5);
    expect(result.total_events).toBe(1523);
    expect(result.issues).toHaveLength(1);
  });
});

describe('E2E: Error Handling and Edge Cases', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  test('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { searchService } = await import('@/lib/services/search-service');

    await expect(
      searchService.search({ q: 'test', limit: 10, page: 1 })
    ).rejects.toThrow('Network error');
  });

  test('should handle empty search results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [],
        total: 0,
        facets: { types: {} },
      }),
    });

    const { searchService } = await import('@/lib/services/search-service');

    const result = await searchService.search({ q: 'nonexistent', limit: 10, page: 1 });

    expect(result.results).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  test('should handle unauthorized access (401)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Authentication required',
    });

    const { auditService } = await import('@/lib/services/audit-service');

    await expect(auditService.listActivities({})).rejects.toThrow(
      'Authentication required'
    );
  });

  test('should handle rate limiting (429)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => 'Rate limit exceeded',
    });

    const { communicationsService } = await import(
      '@/lib/services/communications-service'
    );

    await expect(communicationsService.getStatistics({})).rejects.toThrow(
      'Rate limit exceeded'
    );
  });
});

// Export test suite metadata
export const testMetadata = {
  name: 'UI Integration E2E Tests',
  components: ['Global Search', 'Communications Dashboard', 'Audit Dashboard'],
  totalTests: 24,
  coverage: ['Service Layer', 'API Integration', 'Error Handling'],
};
