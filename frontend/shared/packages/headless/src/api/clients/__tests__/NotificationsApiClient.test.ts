/**
 * NotificationsApiClient Tests
 * Critical test suite for multi-channel communication and alert management
 */

import { NotificationsApiClient } from "../NotificationsApiClient";
import type {
  NotificationTemplate,
  Notification,
  NotificationCampaign,
  Alert,
  NotificationPreference,
  TemplateVariable,
  NotificationChannel,
  AudienceFilter,
  CampaignScheduling,
  CampaignMetrics,
  EscalationRule,
} from "../NotificationsApiClient";

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe("NotificationsApiClient", () => {
  let client: NotificationsApiClient;
  const baseURL = "https://api.test.com";
  const defaultHeaders = { Authorization: "Bearer test-token" };

  beforeEach(() => {
    client = new NotificationsApiClient(baseURL, defaultHeaders);
    jest.clearAllMocks();
  });

  const mockResponse = <T>(data: T, status = 200) => {
    mockFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
    } as Response);
  };

  describe("Notification Templates Management", () => {
    const mockVariables: TemplateVariable[] = [
      {
        name: "customer_name",
        type: "STRING",
        description: "Customer full name",
        required: true,
      },
      {
        name: "bill_amount",
        type: "NUMBER",
        description: "Total bill amount",
        required: true,
        format: "currency",
      },
      {
        name: "due_date",
        type: "DATE",
        description: "Payment due date",
        required: true,
        format: "YYYY-MM-DD",
      },
    ];

    const mockChannels: NotificationChannel[] = [
      {
        type: "EMAIL",
        enabled: true,
        priority: 1,
        retry_attempts: 3,
        retry_delay: 300,
        fallback_channel: "SMS",
        configuration: {
          sender_email: "noreply@isp.com",
          sender_name: "ISP Billing",
        },
      },
      {
        type: "SMS",
        enabled: true,
        priority: 2,
        retry_attempts: 2,
        retry_delay: 600,
        configuration: {
          sender_id: "ISP_BILL",
        },
      },
    ];

    const mockTemplate: NotificationTemplate = {
      id: "template_123",
      name: "Monthly Bill Notification",
      description: "Template for monthly billing notifications",
      template_type: "EMAIL",
      category: "BILLING",
      subject: "Your monthly bill is ready - ${bill_amount}",
      content: "Dear ${customer_name}, your monthly bill of ${bill_amount} is due on ${due_date}.",
      variables: mockVariables,
      channels: mockChannels,
      priority: "HIGH",
      active: true,
      version: 1,
      created_by: "billing_admin",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-15T10:30:00Z",
    };

    it("should get templates with category filtering", async () => {
      mockResponse({
        data: [mockTemplate],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getTemplates({
        category: "BILLING",
        template_type: "EMAIL",
        active: true,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/notifications/templates?category=BILLING&template_type=EMAIL&active=true",
        expect.any(Object),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].category).toBe("BILLING");
    });

    it("should create comprehensive notification template", async () => {
      const templateData = {
        name: "Service Outage Alert",
        description: "Template for service outage notifications",
        template_type: "PUSH" as const,
        category: "SERVICE" as const,
        subject: "Service Alert: ${outage_type} in ${affected_area}",
        content:
          "We are experiencing ${outage_type} in ${affected_area}. Estimated resolution: ${eta}. We apologize for the inconvenience.",
        variables: [
          {
            name: "outage_type",
            type: "STRING" as const,
            description: "Type of service outage",
            required: true,
          },
          {
            name: "affected_area",
            type: "STRING" as const,
            description: "Geographic area affected",
            required: true,
          },
          {
            name: "eta",
            type: "STRING" as const,
            description: "Estimated time to resolution",
            required: false,
            default_value: "TBD",
          },
        ],
        channels: [
          {
            type: "PUSH" as const,
            enabled: true,
            priority: 1,
            retry_attempts: 1,
            retry_delay: 0,
            configuration: {
              title: "Service Alert",
              badge: 1,
              sound: "alert.wav",
            },
          },
          {
            type: "SMS" as const,
            enabled: true,
            priority: 2,
            retry_attempts: 2,
            retry_delay: 300,
            configuration: {
              sender_id: "ISP_ALERT",
            },
          },
        ],
        priority: "URGENT" as const,
        active: true,
        created_by: "network_ops",
      };

      mockResponse({
        data: {
          ...templateData,
          id: "template_124",
          version: 1,
          created_at: "2024-01-17T14:00:00Z",
          updated_at: "2024-01-17T14:00:00Z",
        },
      });

      const result = await client.createTemplate(templateData);

      expect(result.data.id).toBe("template_124");
      expect(result.data.category).toBe("SERVICE");
      expect(result.data.variables).toHaveLength(3);
    });

    it("should test template with variables", async () => {
      const testData = {
        recipient: "test@example.com",
        channel: "EMAIL" as const,
        variables: {
          customer_name: "John Doe",
          bill_amount: "$89.99",
          due_date: "2024-02-15",
        },
      };

      mockResponse({
        data: {
          success: true,
          preview: "Dear John Doe, your monthly bill of $89.99 is due on 2024-02-15.",
        },
      });

      const result = await client.testTemplate("template_123", testData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/notifications/templates/template_123/test",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(testData),
        }),
      );

      expect(result.data.success).toBe(true);
      expect(result.data.preview).toContain("John Doe");
    });

    it("should preview template with variable substitution", async () => {
      const variables = {
        customer_name: "Alice Smith",
        bill_amount: "$125.50",
        due_date: "2024-02-20",
      };

      mockResponse({
        data: {
          rendered_content: "Dear Alice Smith, your monthly bill of $125.50 is due on 2024-02-20.",
          rendered_subject: "Your monthly bill is ready - $125.50",
        },
      });

      const result = await client.previewTemplate("template_123", variables);

      expect(result.data.rendered_content).toContain("Alice Smith");
      expect(result.data.rendered_subject).toContain("$125.50");
    });
  });

  describe("Notification Management", () => {
    const mockNotification: Notification = {
      id: "notification_123",
      template_id: "template_123",
      recipient_id: "customer_456",
      recipient_type: "CUSTOMER",
      recipient_contact: {
        email: "customer@example.com",
        phone: "+1-555-0123",
      },
      channel: "EMAIL",
      status: "DELIVERED",
      priority: "HIGH",
      subject: "Your monthly bill is ready - $89.99",
      message: "Dear John Doe, your monthly bill of $89.99 is due on 2024-02-15.",
      data: {
        customer_name: "John Doe",
        bill_amount: "$89.99",
        due_date: "2024-02-15",
      },
      sent_at: "2024-01-17T09:00:00Z",
      delivered_at: "2024-01-17T09:02:30Z",
      retry_count: 0,
      max_retries: 3,
      expires_at: "2024-01-24T09:00:00Z",
      created_at: "2024-01-17T08:58:00Z",
    };

    it("should send single notification with template", async () => {
      const notificationData = {
        template_id: "template_123",
        recipient_id: "customer_456",
        recipient_contact: {
          email: "customer@example.com",
          phone: "+1-555-0123",
        },
        channel: "EMAIL" as const,
        variables: {
          customer_name: "John Doe",
          bill_amount: "$89.99",
          due_date: "2024-02-15",
        },
        priority: "HIGH" as const,
      };

      mockResponse({
        data: {
          ...mockNotification,
          id: "notification_124",
          status: "PENDING",
          sent_at: undefined,
          delivered_at: undefined,
        },
      });

      const result = await client.sendNotification(notificationData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/notifications/send",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(notificationData),
        }),
      );

      expect(result.data.id).toBe("notification_124");
      expect(result.data.status).toBe("PENDING");
    });

    it("should send bulk notifications", async () => {
      const bulkData = {
        template_id: "template_123",
        recipients: [
          {
            recipient_id: "customer_001",
            recipient_contact: { email: "customer1@example.com" },
            variables: { customer_name: "Alice", bill_amount: "$99.99" },
          },
          {
            recipient_id: "customer_002",
            recipient_contact: { email: "customer2@example.com" },
            variables: { customer_name: "Bob", bill_amount: "$79.99" },
          },
        ],
        channel: "EMAIL" as const,
        priority: "MEDIUM" as const,
      };

      mockResponse({
        data: {
          notifications_created: 2,
          batch_id: "batch_789",
        },
      });

      const result = await client.sendBulkNotifications(bulkData);

      expect(result.data.notifications_created).toBe(2);
      expect(result.data.batch_id).toBe("batch_789");
    });

    it("should cancel scheduled notification", async () => {
      mockResponse({
        data: {
          ...mockNotification,
          status: "CANCELLED",
        },
      });

      const result = await client.cancelNotification("notification_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/notifications/notification_123/cancel",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({}),
        }),
      );

      expect(result.data.status).toBe("CANCELLED");
    });

    it("should retry failed notification", async () => {
      mockResponse({
        data: {
          ...mockNotification,
          status: "PENDING",
          retry_count: 1,
        },
      });

      const result = await client.retryNotification("notification_123");

      expect(result.data.retry_count).toBe(1);
      expect(result.data.status).toBe("PENDING");
    });

    it("should mark notification as read", async () => {
      mockResponse({
        data: {
          ...mockNotification,
          read_at: "2024-01-17T10:15:00Z",
        },
      });

      const result = await client.markAsRead("notification_123");

      expect(result.data.read_at).toBe("2024-01-17T10:15:00Z");
    });

    it("should track notification click", async () => {
      mockResponse({
        data: {
          ...mockNotification,
          clicked_at: "2024-01-17T10:20:00Z",
        },
      });

      const result = await client.trackClick("notification_123", "https://portal.isp.com/billing");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/notifications/notification_123/click",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            link_url: "https://portal.isp.com/billing",
          }),
        }),
      );

      expect(result.data.clicked_at).toBe("2024-01-17T10:20:00Z");
    });
  });

  describe("Campaign Management", () => {
    const mockAudience: AudienceFilter = {
      customer_segments: ["premium", "fiber"],
      territories: ["downtown", "suburbs"],
      service_types: ["residential"],
      exclude_opted_out: true,
      max_recipients: 5000,
    };

    const mockScheduling: CampaignScheduling = {
      schedule_type: "SCHEDULED",
      start_date: "2024-01-20T10:00:00Z",
      end_date: "2024-01-20T18:00:00Z",
      time_zone: "America/New_York",
      send_time_optimization: true,
    };

    const mockMetrics: CampaignMetrics = {
      total_recipients: 4850,
      sent_count: 4820,
      delivered_count: 4775,
      failed_count: 45,
      opened_count: 2387,
      clicked_count: 238,
      unsubscribed_count: 12,
      bounce_count: 28,
      delivery_rate: 99.1,
      open_rate: 50.0,
      click_rate: 5.0,
      unsubscribe_rate: 0.3,
    };

    const mockCampaign: NotificationCampaign = {
      id: "campaign_123",
      name: "Winter Promotion Campaign",
      description: "Promote winter service upgrades to premium customers",
      campaign_type: "TARGETED",
      template_id: "template_promo_456",
      target_audience: mockAudience,
      channels: ["EMAIL", "PUSH"],
      scheduling: mockScheduling,
      status: "COMPLETED",
      metrics: mockMetrics,
      created_by: "marketing_manager",
      created_at: "2024-01-15T14:00:00Z",
      started_at: "2024-01-20T10:00:00Z",
      completed_at: "2024-01-20T18:30:00Z",
    };

    it("should create targeted campaign", async () => {
      const campaignData = {
        name: "Service Upgrade Notification",
        description: "Notify customers about available service upgrades",
        campaign_type: "BROADCAST" as const,
        template_id: "template_upgrade_789",
        target_audience: {
          customer_segments: ["standard"],
          territories: ["north_zone"],
          exclude_opted_out: true,
          max_recipients: 10000,
        },
        channels: ["EMAIL"] as const,
        scheduling: {
          schedule_type: "IMMEDIATE" as const,
          time_zone: "America/Chicago",
          send_time_optimization: false,
        },
        created_by: "product_manager",
      };

      mockResponse({
        data: {
          ...campaignData,
          id: "campaign_124",
          status: "DRAFT",
          metrics: {
            total_recipients: 0,
            sent_count: 0,
            delivered_count: 0,
            failed_count: 0,
            opened_count: 0,
            clicked_count: 0,
            unsubscribed_count: 0,
            bounce_count: 0,
            delivery_rate: 0,
            open_rate: 0,
            click_rate: 0,
            unsubscribe_rate: 0,
          },
          created_at: "2024-01-17T15:00:00Z",
        },
      });

      const result = await client.createCampaign(campaignData);

      expect(result.data.id).toBe("campaign_124");
      expect(result.data.campaign_type).toBe("BROADCAST");
      expect(result.data.status).toBe("DRAFT");
    });

    it("should start campaign", async () => {
      mockResponse({
        data: {
          ...mockCampaign,
          status: "RUNNING",
          started_at: "2024-01-17T15:30:00Z",
        },
      });

      const result = await client.startCampaign("campaign_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/notifications/campaigns/campaign_123/start",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({}),
        }),
      );

      expect(result.data.status).toBe("RUNNING");
      expect(result.data.started_at).toBe("2024-01-17T15:30:00Z");
    });

    it("should pause and resume campaign", async () => {
      // Test pause
      mockResponse({
        data: {
          ...mockCampaign,
          status: "PAUSED",
        },
      });

      const pauseResult = await client.pauseCampaign("campaign_123");
      expect(pauseResult.data.status).toBe("PAUSED");

      // Test resume
      mockResponse({
        data: {
          ...mockCampaign,
          status: "RUNNING",
        },
      });

      const resumeResult = await client.resumeCampaign("campaign_123");
      expect(resumeResult.data.status).toBe("RUNNING");
    });

    it("should get campaign metrics", async () => {
      mockResponse({ data: mockMetrics });

      const result = await client.getCampaignMetrics("campaign_123");

      expect(result.data.delivery_rate).toBe(99.1);
      expect(result.data.open_rate).toBe(50.0);
      expect(result.data.click_rate).toBe(5.0);
    });

    it("should get campaign recipients with status", async () => {
      const recipients = [
        {
          recipient_id: "customer_001",
          recipient_contact: { email: "customer1@example.com" },
          status: "DELIVERED" as const,
          sent_at: "2024-01-20T10:05:00Z",
          delivered_at: "2024-01-20T10:07:30Z",
        },
        {
          recipient_id: "customer_002",
          recipient_contact: { email: "customer2@example.com" },
          status: "FAILED" as const,
          sent_at: "2024-01-20T10:05:00Z",
        },
      ];

      mockResponse({
        data: recipients,
        pagination: {
          page: 1,
          limit: 100,
          total: 4850,
          total_pages: 49,
        },
      });

      const result = await client.getCampaignRecipients("campaign_123", {
        status: "DELIVERED",
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].status).toBe("DELIVERED");
    });
  });

  describe("Alert Management", () => {
    const mockEscalationRules: EscalationRule[] = [
      {
        level: 1,
        delay_minutes: 15,
        notify_roles: ["network_ops"],
        notify_users: ["ops_manager"],
        triggered: true,
        triggered_at: "2024-01-17T09:15:00Z",
      },
      {
        level: 2,
        delay_minutes: 30,
        notify_roles: ["senior_ops", "management"],
        notify_users: ["network_director"],
        escalation_message: "Critical alert requires immediate attention",
        triggered: false,
      },
    ];

    const mockAlert: Alert = {
      id: "alert_123",
      alert_type: "NETWORK",
      severity: "CRITICAL",
      title: "Fiber Core Outage Detected",
      message: "Multiple fiber connections down in downtown core network",
      source: "network_monitoring_system",
      affected_entities: ["fiber_core_001", "switch_downtown_main"],
      actions_required: [
        "Dispatch field technician",
        "Notify affected customers",
        "Activate backup routing",
      ],
      auto_resolve: false,
      resolved: false,
      acknowledged: true,
      acknowledged_by: "network_ops_lead",
      acknowledged_at: "2024-01-17T09:10:00Z",
      escalation_rules: mockEscalationRules,
      metadata: {
        affected_customers: 2500,
        estimated_repair_time: "2 hours",
        backup_available: true,
      },
      created_at: "2024-01-17T09:00:00Z",
    };

    it("should create critical alert with escalation rules", async () => {
      const alertData = {
        alert_type: "SERVICE" as const,
        severity: "ERROR" as const,
        title: "Customer Portal Login Issues",
        message: "High rate of login failures detected on customer portal",
        source: "portal_monitoring",
        affected_entities: ["customer_portal", "auth_service"],
        actions_required: [
          "Check authentication service status",
          "Review recent deployments",
          "Monitor error logs",
        ],
        auto_resolve: false,
        escalation_rules: [
          {
            level: 1,
            delay_minutes: 10,
            notify_roles: ["support_team"],
            notify_users: ["support_manager"],
            triggered: false,
          },
        ],
        metadata: {
          error_rate: "15%",
          affected_users: 150,
        },
      };

      mockResponse({
        data: {
          ...alertData,
          id: "alert_124",
          resolved: false,
          acknowledged: false,
          created_at: "2024-01-17T16:00:00Z",
        },
      });

      const result = await client.createAlert(alertData);

      expect(result.data.id).toBe("alert_124");
      expect(result.data.severity).toBe("ERROR");
      expect(result.data.escalation_rules).toHaveLength(1);
    });

    it("should acknowledge alert", async () => {
      mockResponse({
        data: {
          ...mockAlert,
          acknowledged: true,
          acknowledged_by: "network_engineer_456",
          acknowledged_at: "2024-01-17T16:30:00Z",
        },
      });

      const result = await client.acknowledgeAlert(
        "alert_123",
        "Investigating fiber cuts in downtown area",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/notifications/alerts/alert_123/acknowledge",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            note: "Investigating fiber cuts in downtown area",
          }),
        }),
      );

      expect(result.data.acknowledged).toBe(true);
      expect(result.data.acknowledged_by).toBe("network_engineer_456");
    });

    it("should resolve alert with resolution note", async () => {
      mockResponse({
        data: {
          ...mockAlert,
          resolved: true,
          resolved_at: "2024-01-17T18:45:00Z",
        },
      });

      const result = await client.resolveAlert(
        "alert_123",
        "Fiber splice repair completed. Services restored.",
      );

      expect(result.data.resolved).toBe(true);
      expect(result.data.resolved_at).toBe("2024-01-17T18:45:00Z");
    });

    it("should escalate alert to next level", async () => {
      mockResponse({
        data: {
          ...mockAlert,
          escalation_rules: [
            mockEscalationRules[0],
            {
              ...mockEscalationRules[1],
              triggered: true,
              triggered_at: "2024-01-17T09:30:00Z",
            },
          ],
        },
      });

      const result = await client.escalateAlert("alert_123", 2);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/notifications/alerts/alert_123/escalate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ level: 2 }),
        }),
      );

      expect(result.data.escalation_rules[1].triggered).toBe(true);
    });

    it("should snooze alert for specified duration", async () => {
      mockResponse({
        data: {
          ...mockAlert,
          metadata: {
            ...mockAlert.metadata,
            snoozed_until: "2024-01-17T20:00:00Z",
          },
        },
      });

      const result = await client.snoozeAlert("alert_123", "2024-01-17T20:00:00Z");

      expect(result.data.metadata.snoozed_until).toBe("2024-01-17T20:00:00Z");
    });

    it("should get alerts with filtering", async () => {
      mockResponse({
        data: [mockAlert],
        pagination: {
          page: 1,
          limit: 50,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getAlerts({
        alert_type: "NETWORK",
        severity: "CRITICAL",
        resolved: false,
        acknowledged: true,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/notifications/alerts?alert_type=NETWORK&severity=CRITICAL&resolved=false&acknowledged=true",
        expect.any(Object),
      );

      expect(result.data[0].alert_type).toBe("NETWORK");
      expect(result.data[0].resolved).toBe(false);
    });
  });

  describe("User Notification Preferences", () => {
    const mockPreferences: NotificationPreference[] = [
      {
        id: "pref_billing",
        user_id: "user_123",
        category: "BILLING",
        channels: {
          email: { enabled: true, address: "user@example.com" },
          sms: { enabled: true, number: "+1-555-0123" },
          push: { enabled: false },
          in_app: { enabled: true },
        },
        quiet_hours: {
          enabled: true,
          start_time: "22:00",
          end_time: "07:00",
          time_zone: "America/New_York",
        },
        frequency_limits: {
          max_per_hour: 3,
          max_per_day: 10,
        },
        updated_at: "2024-01-15T12:00:00Z",
      },
      {
        id: "pref_service",
        user_id: "user_123",
        category: "SERVICE",
        channels: {
          email: { enabled: true, address: "user@example.com" },
          sms: { enabled: false },
          push: { enabled: true },
          in_app: { enabled: true },
        },
        updated_at: "2024-01-15T12:00:00Z",
      },
    ];

    it("should get user notification preferences", async () => {
      mockResponse({ data: mockPreferences });

      const result = await client.getUserPreferences("user_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/notifications/users/user_123/preferences",
        expect.any(Object),
      );

      expect(result.data).toHaveLength(2);
      expect(result.data[0].category).toBe("BILLING");
      expect(result.data[0].quiet_hours?.enabled).toBe(true);
    });

    it("should update user preferences", async () => {
      const updatedPreferences = [
        {
          id: "pref_billing",
          category: "BILLING" as const,
          channels: {
            email: { enabled: true, address: "newemail@example.com" },
            sms: { enabled: false },
            push: { enabled: true },
            in_app: { enabled: true },
          },
          frequency_limits: {
            max_per_hour: 2,
            max_per_day: 8,
          },
        },
      ];

      mockResponse({
        data: [
          {
            ...mockPreferences[0],
            channels: updatedPreferences[0].channels,
            frequency_limits: updatedPreferences[0].frequency_limits,
            updated_at: "2024-01-17T16:00:00Z",
          },
        ],
      });

      const result = await client.updateUserPreferences("user_123", updatedPreferences);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/notifications/users/user_123/preferences",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ preferences: updatedPreferences }),
        }),
      );

      expect(result.data[0].channels.email.address).toBe("newemail@example.com");
      expect(result.data[0].frequency_limits?.max_per_hour).toBe(2);
    });

    it("should opt user out of categories", async () => {
      mockResponse({ data: { success: true } });

      const result = await client.optOut("user_123", ["MARKETING", "SYSTEM"]);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/notifications/users/user_123/opt-out",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ categories: ["MARKETING", "SYSTEM"] }),
        }),
      );

      expect(result.data.success).toBe(true);
    });

    it("should opt user back in to categories", async () => {
      mockResponse({ data: { success: true } });

      const result = await client.optIn("user_123", ["MARKETING"]);

      expect(result.data.success).toBe(true);
    });
  });

  describe("Channel Management and Analytics", () => {
    it("should get channel status overview", async () => {
      const channelStatus = [
        {
          channel: "EMAIL" as const,
          status: "HEALTHY" as const,
          last_success: "2024-01-17T16:30:00Z",
          error_rate: 0.5,
          throughput: 1200,
        },
        {
          channel: "SMS" as const,
          status: "DEGRADED" as const,
          last_success: "2024-01-17T16:15:00Z",
          error_rate: 8.2,
          throughput: 450,
        },
        {
          channel: "PUSH" as const,
          status: "HEALTHY" as const,
          last_success: "2024-01-17T16:29:00Z",
          error_rate: 1.1,
          throughput: 800,
        },
      ];

      mockResponse({ data: channelStatus });

      const result = await client.getChannelStatus();

      expect(result.data).toHaveLength(3);
      expect(result.data[1].status).toBe("DEGRADED");
      expect(result.data[1].error_rate).toBe(8.2);
    });

    it("should test channel configuration", async () => {
      const testConfig = {
        smtp_server: "smtp.example.com",
        smtp_port: 587,
        username: "notifications@isp.com",
        use_tls: true,
      };

      mockResponse({
        data: {
          success: true,
        },
      });

      const result = await client.testChannelConfiguration("EMAIL", testConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/notifications/channels/test",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            channel: "EMAIL",
            configuration: testConfig,
          }),
        }),
      );

      expect(result.data.success).toBe(true);
    });

    it("should get notification metrics", async () => {
      const metricsData = {
        total_sent: 125000,
        delivery_rate: 98.5,
        open_rate: 42.3,
        click_rate: 5.7,
        bounce_rate: 1.2,
        unsubscribe_rate: 0.3,
        trends: [
          { date: "2024-01-15", sent: 4200, delivered: 4150 },
          { date: "2024-01-16", sent: 4500, delivered: 4425 },
          { date: "2024-01-17", sent: 4800, delivered: 4730 },
        ],
      };

      mockResponse({ data: metricsData });

      const result = await client.getNotificationMetrics({
        start_date: "2024-01-15",
        end_date: "2024-01-17",
        channel: "EMAIL",
      });

      expect(result.data.total_sent).toBe(125000);
      expect(result.data.delivery_rate).toBe(98.5);
      expect(result.data.trends).toHaveLength(3);
    });

    it("should get channel performance comparison", async () => {
      const performanceData = [
        {
          channel: "EMAIL" as const,
          sent_count: 50000,
          delivered_count: 49250,
          failed_count: 750,
          delivery_rate: 98.5,
          average_delivery_time: 45.2,
        },
        {
          channel: "SMS" as const,
          sent_count: 25000,
          delivered_count: 24100,
          failed_count: 900,
          delivery_rate: 96.4,
          average_delivery_time: 12.8,
        },
      ];

      mockResponse({ data: performanceData });

      const result = await client.getChannelPerformance({
        start_date: "2024-01-01",
        end_date: "2024-01-31",
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].delivery_rate).toBe(98.5);
      expect(result.data[1].average_delivery_time).toBe(12.8);
    });

    it("should get engagement analytics", async () => {
      const engagementData = {
        engagement_by_time: [
          { hour: 9, open_rate: 65.2 },
          { hour: 14, open_rate: 72.1 },
          { hour: 18, open_rate: 58.9 },
        ],
        engagement_by_channel: [
          { channel: "EMAIL", engagement_score: 68.5 },
          { channel: "PUSH", engagement_score: 42.3 },
        ],
        top_performing_templates: [
          {
            template_id: "template_123",
            name: "Monthly Bill",
            open_rate: 78.2,
          },
          {
            template_id: "template_456",
            name: "Service Alert",
            open_rate: 89.1,
          },
        ],
        user_engagement_segments: [
          { segment: "high_engagement", users: 2500, avg_open_rate: 85.2 },
          { segment: "low_engagement", users: 800, avg_open_rate: 12.5 },
        ],
      };

      mockResponse({ data: engagementData });

      const result = await client.getEngagementAnalytics({
        start_date: "2024-01-01",
        end_date: "2024-01-31",
      });

      expect(result.data.top_performing_templates).toHaveLength(2);
      expect(result.data.user_engagement_segments[0].avg_open_rate).toBe(85.2);
    });
  });

  describe("Webhooks and Real-time Events", () => {
    it("should subscribe to notification events", async () => {
      const subscriptionData = {
        webhook_url: "https://external-system.com/webhooks/notifications",
        events: [
          "notification.sent",
          "notification.delivered",
          "notification.failed",
          "alert.created",
        ],
      };

      mockResponse({
        data: {
          subscription_id: "webhook_sub_123",
        },
      });

      const result = await client.subscribeToNotificationEvents(
        subscriptionData.webhook_url,
        subscriptionData.events,
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/notifications/webhooks/subscribe",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(subscriptionData),
        }),
      );

      expect(result.data.subscription_id).toBe("webhook_sub_123");
    });

    it("should unsubscribe from notification events", async () => {
      mockResponse({
        data: {
          success: true,
        },
      });

      const result = await client.unsubscribeFromNotificationEvents("webhook_sub_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/notifications/webhooks/subscriptions/webhook_sub_123",
        expect.objectContaining({
          method: "DELETE",
        }),
      );

      expect(result.data.success).toBe(true);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle template not found errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({
          error: {
            code: "TEMPLATE_NOT_FOUND",
            message: "Notification template not found",
          },
        }),
      } as Response);

      await expect(client.getTemplate("invalid_template")).rejects.toThrow("Not Found");
    });

    it("should handle notification send failures", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
        json: async () => ({
          error: {
            code: "INVALID_RECIPIENT",
            message: "Recipient has opted out of this notification category",
          },
        }),
      } as Response);

      await expect(
        client.sendNotification({
          recipient_id: "opted_out_user",
          recipient_contact: { email: "opted@example.com" },
          channel: "EMAIL",
          message: "Test message",
        }),
      ).rejects.toThrow("Unprocessable Entity");
    });

    it("should handle campaign audience size limits", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          error: {
            code: "AUDIENCE_TOO_LARGE",
            message: "Campaign audience exceeds maximum allowed size",
          },
        }),
      } as Response);

      await expect(client.startCampaign("oversized_campaign")).rejects.toThrow("Bad Request");
    });

    it("should handle network connectivity errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network connection failed"));

      await expect(client.getNotifications()).rejects.toThrow("Network connection failed");
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle large notification lists efficiently", async () => {
      const largeNotificationList = Array.from({ length: 5000 }, (_, i) => ({
        ...mockNotification,
        id: `notification_${i}`,
        recipient_id: `customer_${i}`,
      }));

      mockResponse({
        data: largeNotificationList.slice(0, 1000), // Paginated response
        pagination: {
          page: 1,
          limit: 1000,
          total: 5000,
          total_pages: 5,
        },
      });

      const startTime = performance.now();
      const result = await client.getNotifications({ limit: 1000 });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
      expect(result.data).toHaveLength(1000);
      expect(result.pagination?.total).toBe(5000);
    });

    it("should handle bulk notification sending efficiently", async () => {
      const bulkRecipients = Array.from({ length: 1000 }, (_, i) => ({
        recipient_id: `customer_${i}`,
        recipient_contact: { email: `customer${i}@example.com` },
        variables: { customer_name: `Customer ${i}` },
      }));

      mockResponse({
        data: {
          notifications_created: 1000,
          batch_id: "batch_large_123",
        },
      });

      const startTime = performance.now();
      const result = await client.sendBulkNotifications({
        template_id: "template_bulk",
        recipients: bulkRecipients,
        channel: "EMAIL",
      });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(200);
      expect(result.data.notifications_created).toBe(1000);
    });

    it("should handle complex campaign metrics efficiently", async () => {
      const complexMetrics = {
        ...mockMetrics,
        detailed_breakdown: Array.from({ length: 100 }, (_, i) => ({
          segment: `segment_${i}`,
          sent_count: Math.floor(Math.random() * 1000),
          delivery_rate: Math.random() * 100,
        })),
      };

      mockResponse({ data: complexMetrics });

      const result = await client.getCampaignMetrics("complex_campaign");

      expect(result.data.detailed_breakdown).toHaveLength(100);
    });
  });
});
