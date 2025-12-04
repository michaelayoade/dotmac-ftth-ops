/**
 * LicensingApiClient Tests
 * Critical test suite for software licensing and activation management
 */

import { LicensingApiClient } from "../LicensingApiClient";
import type {
  SoftwareLicense,
  Activation,
  LicenseTemplate,
  LicenseOrder,
  ComplianceAudit,
  LicenseUsageReport,
  LicenseFeature,
  LicenseRestriction,
  UsageMetrics,
  ActivationLocation,
  LicensePricing,
  AuditFinding,
  ComplianceViolation,
} from "../LicensingApiClient";

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe("LicensingApiClient", () => {
  let client: LicensingApiClient;
  const baseURL = "https://api.test.com";
  const defaultHeaders = { Authorization: "Bearer test-token" };

  beforeEach(() => {
    client = new LicensingApiClient(baseURL, defaultHeaders);
    jest.clearAllMocks();
  });

  const mockResponse = <T>(data: T, status = 200) => {
    mockFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
    } as Response);
  };

  describe("License Management", () => {
    const mockFeatures: LicenseFeature[] = [
      {
        feature_id: "advanced_analytics",
        feature_name: "Advanced Analytics Dashboard",
        enabled: true,
        limit_value: 1000,
        limit_type: "COUNT",
        expires_at: "2024-12-31T23:59:59Z",
      },
      {
        feature_id: "api_access",
        feature_name: "REST API Access",
        enabled: true,
        limit_value: 10000,
        limit_type: "COUNT",
      },
      {
        feature_id: "premium_support",
        feature_name: "Premium Technical Support",
        enabled: false,
      },
    ];

    const mockRestrictions: LicenseRestriction[] = [
      {
        restriction_type: "GEOGRAPHIC",
        values: ["US", "CA"],
        operator: "ALLOW",
      },
      {
        restriction_type: "DOMAIN",
        values: ["company.com", "*.subsidiary.com"],
        operator: "ALLOW",
      },
    ];

    const mockLicense: SoftwareLicense = {
      id: "license_123",
      license_key: "ABCD-EFGH-IJKL-MNOP-QRST",
      product_id: "product_network_mgmt",
      product_name: "Network Management Suite Enterprise",
      product_version: "2024.1",
      license_type: "SUBSCRIPTION",
      license_model: "PER_SEAT",
      customer_id: "customer_456",
      reseller_id: "reseller_789",
      issued_to: "TechCorp Solutions Inc.",
      max_activations: 50,
      current_activations: 12,
      features: mockFeatures,
      restrictions: mockRestrictions,
      issued_date: "2024-01-01T00:00:00Z",
      activation_date: "2024-01-02T10:00:00Z",
      expiry_date: "2024-12-31T23:59:59Z",
      maintenance_expiry: "2025-03-31T23:59:59Z",
      status: "ACTIVE",
      auto_renewal: true,
      grace_period_days: 30,
      metadata: {
        purchase_order: "PO-2024-001",
        sales_rep: "john.sales@vendor.com",
        deployment_contact: "admin@techcorp.com",
      },
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-15T14:30:00Z",
    };

    it("should get licenses with comprehensive filtering", async () => {
      mockResponse({
        data: [mockLicense],
        pagination: {
          page: 1,
          limit: 50,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getLicenses({
        customer_id: "customer_456",
        product_id: "product_network_mgmt",
        status: "ACTIVE",
        license_type: "SUBSCRIPTION",
        expiry_date_from: "2024-01-01",
        expiry_date_to: "2024-12-31",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/licensing/licenses?customer_id=customer_456&product_id=product_network_mgmt&status=ACTIVE&license_type=SUBSCRIPTION&expiry_date_from=2024-01-01&expiry_date_to=2024-12-31",
        expect.any(Object),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].current_activations).toBe(12);
      expect(result.data[0].features).toHaveLength(3);
    });

    it("should create enterprise license with comprehensive features", async () => {
      const licenseData = {
        product_id: "product_enterprise_suite",
        product_name: "Enterprise Management Platform",
        product_version: "2024.2",
        license_type: "PERPETUAL" as const,
        license_model: "SITE_LICENSE" as const,
        customer_id: "customer_enterprise",
        issued_to: "Global Enterprise Corp",
        max_activations: 1000,
        features: [
          {
            feature_id: "unlimited_users",
            feature_name: "Unlimited User Access",
            enabled: true,
          },
          {
            feature_id: "advanced_reporting",
            feature_name: "Advanced Reporting Suite",
            enabled: true,
            limit_value: 100,
            limit_type: "COUNT" as const,
          },
          {
            feature_id: "sso_integration",
            feature_name: "Single Sign-On Integration",
            enabled: true,
          },
        ],
        restrictions: [
          {
            restriction_type: "DOMAIN" as const,
            values: ["*.enterprise-corp.com"],
            operator: "ALLOW" as const,
          },
        ],
        issued_date: "2024-01-17T10:00:00Z",
        status: "PENDING" as const,
        auto_renewal: false,
        metadata: {
          contract_number: "ENT-2024-001",
          implementation_partner: "Professional Services Team",
        },
      };

      mockResponse({
        data: {
          ...licenseData,
          id: "license_124",
          license_key: "ENT-WXYZ-ABCD-EFGH-IJKL",
          current_activations: 0,
          created_at: "2024-01-17T10:00:00Z",
          updated_at: "2024-01-17T10:00:00Z",
        },
      });

      const result = await client.createLicense(licenseData);

      expect(result.data.id).toBe("license_124");
      expect(result.data.license_model).toBe("SITE_LICENSE");
      expect(result.data.features).toHaveLength(3);
    });

    it("should get license by key", async () => {
      mockResponse({ data: mockLicense });

      const result = await client.getLicenseByKey("ABCD-EFGH-IJKL-MNOP-QRST");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/licensing/licenses/by-key/ABCD-EFGH-IJKL-MNOP-QRST",
        expect.any(Object),
      );

      expect(result.data.license_key).toBe("ABCD-EFGH-IJKL-MNOP-QRST");
    });

    it("should renew license with feature upgrades", async () => {
      const renewalData = {
        duration_months: 12,
        extend_maintenance: true,
        upgrade_features: [
          {
            feature_id: "premium_support",
            feature_name: "Premium Technical Support",
            enabled: true,
          },
          {
            feature_id: "dedicated_account_manager",
            feature_name: "Dedicated Account Manager",
            enabled: true,
          },
        ],
      };

      mockResponse({
        data: {
          ...mockLicense,
          expiry_date: "2025-12-31T23:59:59Z",
          maintenance_expiry: "2026-03-31T23:59:59Z",
          features: [...mockFeatures, ...renewalData.upgrade_features],
          updated_at: "2024-01-17T11:00:00Z",
        },
      });

      const result = await client.renewLicense("license_123", renewalData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/licensing/licenses/license_123/renew",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(renewalData),
        }),
      );

      expect(result.data.expiry_date).toBe("2025-12-31T23:59:59Z");
      expect(result.data.features).toHaveLength(5);
    });

    it("should suspend license with reason", async () => {
      mockResponse({
        data: {
          ...mockLicense,
          status: "SUSPENDED",
          updated_at: "2024-01-17T12:00:00Z",
        },
      });

      const result = await client.suspendLicense(
        "license_123",
        "Payment overdue - temporary suspension",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/licensing/licenses/license_123/suspend",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            reason: "Payment overdue - temporary suspension",
          }),
        }),
      );

      expect(result.data.status).toBe("SUSPENDED");
    });

    it("should transfer license to new customer", async () => {
      const transferData = {
        new_customer_id: "customer_new_owner",
        new_issued_to: "New Owner Corporation",
        transfer_reason: "Company acquisition",
        deactivate_existing: true,
      };

      mockResponse({
        data: {
          ...mockLicense,
          customer_id: "customer_new_owner",
          issued_to: "New Owner Corporation",
          current_activations: 0,
          updated_at: "2024-01-17T13:00:00Z",
        },
      });

      const result = await client.transferLicense("license_123", transferData);

      expect(result.data.customer_id).toBe("customer_new_owner");
      expect(result.data.issued_to).toBe("New Owner Corporation");
      expect(result.data.current_activations).toBe(0);
    });

    it("should revoke license permanently", async () => {
      mockResponse({
        data: {
          ...mockLicense,
          status: "REVOKED",
          current_activations: 0,
        },
      });

      const result = await client.revokeLicense("license_123", "License violation detected");

      expect(result.data.status).toBe("REVOKED");
      expect(result.data.current_activations).toBe(0);
    });
  });

  describe("Activation Management", () => {
    const mockLocation: ActivationLocation = {
      country: "US",
      region: "California",
      city: "San Francisco",
      timezone: "America/Los_Angeles",
      coordinates: { latitude: 37.7749, longitude: -122.4194 },
    };

    const mockUsageMetrics: UsageMetrics = {
      total_runtime_hours: 1245.5,
      feature_usage: {
        advanced_analytics: 890,
        api_access: 5420,
        reporting: 234,
      },
      api_calls_count: 125000,
      data_processed_mb: 15680,
      last_used_at: "2024-01-17T10:30:00Z",
      peak_concurrent_users: 45,
    };

    const mockActivation: Activation = {
      id: "activation_123",
      license_id: "license_123",
      activation_token: "ACT-TOKEN-ABCD-1234-EFGH-5678",
      device_fingerprint: "fp_abc123def456",
      machine_name: "PROD-SERVER-01",
      hardware_id: "HW-ID-789012",
      mac_address: "00:1B:44:11:3A:B7",
      ip_address: "192.168.1.100",
      operating_system: "Windows Server 2022",
      user_agent: "NetworkMgmt/2024.1 (Windows NT 10.0)",
      application_version: "2024.1.3456",
      activation_type: "ONLINE",
      status: "ACTIVE",
      activated_at: "2024-01-02T10:15:00Z",
      last_heartbeat: "2024-01-17T10:30:00Z",
      location: mockLocation,
      usage_metrics: mockUsageMetrics,
    };

    it("should activate license with device information", async () => {
      const activationData = {
        license_key: "ABCD-EFGH-IJKL-MNOP-QRST",
        device_fingerprint: "fp_new_device_789",
        machine_name: "PROD-SERVER-02",
        hardware_id: "HW-ID-345678",
        activation_type: "ONLINE" as const,
        metadata: {
          department: "IT Operations",
          administrator: "admin@company.com",
          installation_notes: "Primary production server deployment",
        },
      };

      mockResponse({
        data: {
          ...activationData,
          id: "activation_124",
          license_id: "license_123",
          activation_token: "ACT-TOKEN-NEW-WXYZ-9012",
          status: "ACTIVE",
          activated_at: "2024-01-17T14:00:00Z",
        },
      });

      const result = await client.activateLicense(activationData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/licensing/activations",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(activationData),
        }),
      );

      expect(result.data.id).toBe("activation_124");
      expect(result.data.status).toBe("ACTIVE");
    });

    it("should validate activation token", async () => {
      mockResponse({
        data: {
          valid: true,
          activation: mockActivation,
          license: mockLicense,
        },
      });

      const result = await client.validateActivation("ACT-TOKEN-ABCD-1234-EFGH-5678");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/licensing/activations/validate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            activation_token: "ACT-TOKEN-ABCD-1234-EFGH-5678",
          }),
        }),
      );

      expect(result.data.valid).toBe(true);
      expect(result.data.activation?.status).toBe("ACTIVE");
    });

    it("should send heartbeat with usage metrics", async () => {
      const metrics = {
        total_runtime_hours: 1250.0,
        feature_usage: {
          advanced_analytics: 895,
          api_access: 5450,
        },
        api_calls_count: 125500,
        data_processed_mb: 15720,
        last_used_at: "2024-01-17T11:00:00Z",
      };

      mockResponse({
        data: {
          status: "SUCCESS",
          message: "Heartbeat received successfully",
        },
      });

      const result = await client.sendHeartbeat("ACT-TOKEN-ABCD-1234-EFGH-5678", metrics);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/licensing/activations/heartbeat",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            activation_token: "ACT-TOKEN-ABCD-1234-EFGH-5678",
            metrics,
          }),
        }),
      );

      expect(result.data.status).toBe("SUCCESS");
    });

    it("should deactivate license with reason", async () => {
      mockResponse({
        data: {
          ...mockActivation,
          status: "DEACTIVATED",
          deactivated_at: "2024-01-17T15:00:00Z",
          deactivation_reason: "Server decommissioned",
        },
      });

      const result = await client.deactivateLicense("activation_123", "Server decommissioned");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/licensing/activations/activation_123/deactivate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ reason: "Server decommissioned" }),
        }),
      );

      expect(result.data.status).toBe("DEACTIVATED");
      expect(result.data.deactivation_reason).toBe("Server decommissioned");
    });

    it("should handle offline activation flow", async () => {
      // Step 1: Get offline activation request
      mockResponse({
        data: {
          request_code: "REQ-OFFLINE-ABCD1234EFGH5678",
          instructions:
            "Please contact support with this request code to obtain your response code.",
        },
      });

      const requestResult = await client.getOfflineActivationRequest(
        "ABCD-EFGH-IJKL-MNOP-QRST",
        "fp_offline_device_456",
      );

      expect(requestResult.data.request_code).toBe("REQ-OFFLINE-ABCD1234EFGH5678");

      // Step 2: Process offline activation with response code
      mockResponse({
        data: {
          ...mockActivation,
          id: "activation_offline_125",
          activation_type: "OFFLINE",
          device_fingerprint: "fp_offline_device_456",
        },
      });

      const activationResult = await client.processOfflineActivation(
        "REQ-OFFLINE-ABCD1234EFGH5678",
        "RESP-OFFLINE-WXYZ9012IJKL3456",
      );

      expect(activationResult.data.activation_type).toBe("OFFLINE");
    });

    it("should get activations with filtering", async () => {
      mockResponse({
        data: [mockActivation],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getActivations({
        license_id: "license_123",
        status: "ACTIVE",
        device_fingerprint: "fp_abc123def456",
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].usage_metrics?.peak_concurrent_users).toBe(45);
    });
  });

  describe("License Templates", () => {
    const mockPricing: LicensePricing = {
      base_price: 299.0,
      currency: "USD",
      billing_cycle: "ANNUALLY",
      per_seat_price: 29.0,
      volume_discounts: [
        { min_quantity: 10, max_quantity: 49, discount_percentage: 10 },
        { min_quantity: 50, max_quantity: 99, discount_percentage: 20 },
        { min_quantity: 100, discount_percentage: 30 },
      ],
      maintenance_percentage: 20,
    };

    const mockTemplate: LicenseTemplate = {
      id: "template_123",
      template_name: "Enterprise Network Management",
      product_id: "product_network_mgmt",
      description: "Full-featured enterprise network management solution",
      license_type: "SUBSCRIPTION",
      license_model: "PER_SEAT",
      default_duration: 12,
      max_activations: 100,
      features: [
        {
          feature_id: "network_monitoring",
          feature_name: "Real-time Network Monitoring",
          included: true,
          configurable: false,
          required: true,
        },
        {
          feature_id: "advanced_analytics",
          feature_name: "Advanced Analytics",
          included: true,
          default_limit: 1000,
          configurable: true,
          required: false,
        },
        {
          feature_id: "premium_support",
          feature_name: "Premium Support",
          included: false,
          configurable: true,
          required: false,
        },
      ],
      restrictions: [
        {
          restriction_type: "GEOGRAPHIC",
          operator: "ALLOW",
          configurable: true,
          default_values: ["US", "CA", "MX"],
        },
      ],
      pricing: mockPricing,
      auto_renewal_enabled: true,
      trial_allowed: true,
      trial_duration_days: 30,
      grace_period_days: 15,
      active: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
    };

    it("should create license template with comprehensive configuration", async () => {
      const templateData = {
        template_name: "SMB Network Essentials",
        product_id: "product_network_smb",
        description: "Essential network management for small-medium businesses",
        license_type: "SUBSCRIPTION" as const,
        license_model: "PER_DEVICE" as const,
        default_duration: 12,
        max_activations: 25,
        features: [
          {
            feature_id: "basic_monitoring",
            feature_name: "Basic Network Monitoring",
            included: true,
            configurable: false,
            required: true,
          },
          {
            feature_id: "email_alerts",
            feature_name: "Email Alert Notifications",
            included: true,
            default_limit: 100,
            configurable: true,
            required: false,
          },
        ],
        restrictions: [
          {
            restriction_type: "DOMAIN" as const,
            operator: "ALLOW" as const,
            configurable: true,
          },
        ],
        pricing: {
          base_price: 99.0,
          currency: "USD",
          billing_cycle: "MONTHLY" as const,
        },
        auto_renewal_enabled: true,
        trial_allowed: true,
        trial_duration_days: 14,
        grace_period_days: 7,
        active: true,
      };

      mockResponse({
        data: {
          ...templateData,
          id: "template_124",
          created_at: "2024-01-17T16:00:00Z",
          updated_at: "2024-01-17T16:00:00Z",
        },
      });

      const result = await client.createTemplate(templateData);

      expect(result.data.id).toBe("template_124");
      expect(result.data.license_model).toBe("PER_DEVICE");
      expect(result.data.features).toHaveLength(2);
    });

    it("should duplicate template with new name", async () => {
      mockResponse({
        data: {
          ...mockTemplate,
          id: "template_125",
          template_name: "Enterprise Network Management - Custom",
          created_at: "2024-01-17T17:00:00Z",
          updated_at: "2024-01-17T17:00:00Z",
        },
      });

      const result = await client.duplicateTemplate(
        "template_123",
        "Enterprise Network Management - Custom",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/licensing/templates/template_123/duplicate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            new_name: "Enterprise Network Management - Custom",
          }),
        }),
      );

      expect(result.data.template_name).toBe("Enterprise Network Management - Custom");
      expect(result.data.id).toBe("template_125");
    });

    it("should get templates with filtering", async () => {
      mockResponse({
        data: [mockTemplate],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getTemplates({
        product_id: "product_network_mgmt",
        license_type: "SUBSCRIPTION",
        active: true,
      });

      expect(result.data[0].pricing.volume_discounts).toHaveLength(3);
      expect(result.data[0].trial_allowed).toBe(true);
    });
  });

  describe("License Orders", () => {
    const mockOrder: LicenseOrder = {
      id: "order_123",
      order_number: "ORD-2024-001",
      customer_id: "customer_456",
      reseller_id: "reseller_789",
      template_id: "template_123",
      quantity: 50,
      custom_features: [
        {
          feature_id: "premium_support",
          feature_name: "Premium Support",
          enabled: true,
        },
      ],
      custom_restrictions: [
        {
          restriction_type: "IP_RANGE",
          values: ["192.168.1.0/24", "10.0.0.0/16"],
          operator: "ALLOW",
        },
      ],
      duration_override: 24,
      special_instructions: "Staggered deployment over 3 months",
      status: "APPROVED",
      total_amount: 12500.0,
      discount_applied: 2500.0,
      payment_status: "PAID",
      fulfillment_method: "AUTO",
      generated_licenses: ["license_201", "license_202", "license_203"],
      created_at: "2024-01-15T10:00:00Z",
      fulfilled_at: "2024-01-16T14:00:00Z",
    };

    it("should create license order with customizations", async () => {
      const orderData = {
        customer_id: "customer_enterprise",
        template_id: "template_123",
        quantity: 100,
        custom_features: [
          {
            feature_id: "dedicated_support",
            feature_name: "Dedicated Support Engineer",
            enabled: true,
          },
          {
            feature_id: "custom_branding",
            feature_name: "Custom UI Branding",
            enabled: true,
            limit_value: 5,
            limit_type: "COUNT" as const,
          },
        ],
        duration_override: 36,
        special_instructions: "Multi-site deployment across 5 locations",
        fulfillment_method: "MANUAL" as const,
      };

      mockResponse({
        data: {
          ...orderData,
          id: "order_124",
          order_number: "ORD-2024-002",
          status: "PENDING",
          total_amount: 25000.0,
          payment_status: "PENDING",
          generated_licenses: [],
          created_at: "2024-01-17T18:00:00Z",
        },
      });

      const result = await client.createOrder(orderData);

      expect(result.data.id).toBe("order_124");
      expect(result.data.custom_features).toHaveLength(2);
      expect(result.data.duration_override).toBe(36);
    });

    it("should approve order", async () => {
      mockResponse({
        data: {
          ...mockOrder,
          status: "APPROVED",
        },
      });

      const result = await client.approveOrder(
        "order_123",
        "Enterprise customer approved for extended terms",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/licensing/orders/order_123/approve",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            approval_notes: "Enterprise customer approved for extended terms",
          }),
        }),
      );

      expect(result.data.status).toBe("APPROVED");
    });

    it("should fulfill order automatically", async () => {
      mockResponse({
        data: {
          ...mockOrder,
          status: "FULFILLED",
          generated_licenses: ["license_301", "license_302", "license_303"],
          fulfilled_at: "2024-01-17T19:00:00Z",
        },
      });

      const result = await client.fulfillOrder("order_123");

      expect(result.data.status).toBe("FULFILLED");
      expect(result.data.generated_licenses).toHaveLength(3);
    });

    it("should cancel order with reason", async () => {
      mockResponse({
        data: {
          ...mockOrder,
          status: "CANCELLED",
        },
      });

      const result = await client.cancelOrder(
        "order_123",
        "Customer requested cancellation due to budget constraints",
      );

      expect(result.data.status).toBe("CANCELLED");
    });

    it("should get orders with filtering", async () => {
      mockResponse({
        data: [mockOrder],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getOrders({
        customer_id: "customer_456",
        status: "APPROVED",
        payment_status: "PAID",
      });

      expect(result.data[0].discount_applied).toBe(2500.0);
      expect(result.data[0].fulfillment_method).toBe("AUTO");
    });
  });

  describe("Compliance and Auditing", () => {
    const mockFindings: AuditFinding[] = [
      {
        finding_type: "OVER_DEPLOYMENT",
        severity: "HIGH",
        description: "15 unlicensed installations detected on network devices",
        evidence: ["network_scan_report.pdf", "device_inventory.xlsx"],
        affected_licenses: ["license_123", "license_456"],
        impact_assessment: "Potential compliance violation requiring immediate attention",
        recommended_action: "Purchase additional licenses or remove excess installations",
      },
      {
        finding_type: "EXPIRED_LICENSE",
        severity: "MEDIUM",
        description: "3 licenses have expired but software is still in use",
        evidence: ["license_status_report.json"],
        affected_licenses: ["license_789"],
        impact_assessment: "Grace period active, renewal required within 30 days",
        recommended_action: "Renew expired licenses immediately",
      },
    ];

    const mockViolations: ComplianceViolation[] = [
      {
        violation_type: "UNAUTHORIZED_USE",
        severity: "MAJOR",
        license_id: "license_123",
        description: "Software deployed outside authorized geographic region",
        detected_at: "2024-01-15T10:00:00Z",
        evidence: ["geo_location_logs.txt", "activation_audit.pdf"],
        financial_impact: 15000,
        resolution_required: true,
        resolution_deadline: "2024-02-15T23:59:59Z",
        status: "OPEN",
      },
    ];

    const mockAudit: ComplianceAudit = {
      id: "audit_123",
      audit_type: "SCHEDULED",
      customer_id: "customer_456",
      product_ids: ["product_network_mgmt", "product_security_suite"],
      audit_scope: "FULL",
      status: "COMPLETED",
      auditor_id: "auditor_789",
      audit_date: "2024-01-15T09:00:00Z",
      findings: mockFindings,
      violations: mockViolations,
      compliance_score: 72.5,
      recommendations: [
        "Implement automated license tracking system",
        "Conduct quarterly internal compliance reviews",
        "Establish clearer geographic usage policies",
      ],
      follow_up_required: true,
      follow_up_date: "2024-03-15T23:59:59Z",
      report_url: "https://storage.example.com/compliance/audit_123_report.pdf",
      created_at: "2024-01-10T08:00:00Z",
      completed_at: "2024-01-15T17:00:00Z",
    };

    it("should schedule compliance audit", async () => {
      const auditData = {
        customer_id: "customer_enterprise",
        product_ids: ["product_network_mgmt"],
        audit_type: "RANDOM" as const,
        audit_scope: "SPOT_CHECK" as const,
        audit_date: "2024-02-01T10:00:00Z",
        special_instructions: "Focus on recently deployed licenses",
      };

      mockResponse({
        data: {
          ...auditData,
          id: "audit_124",
          status: "SCHEDULED",
          auditor_id: "auditor_456",
          findings: [],
          violations: [],
          compliance_score: 0,
          recommendations: [],
          follow_up_required: false,
          created_at: "2024-01-17T20:00:00Z",
        },
      });

      const result = await client.scheduleComplianceAudit(auditData);

      expect(result.data.id).toBe("audit_124");
      expect(result.data.audit_type).toBe("RANDOM");
      expect(result.data.status).toBe("SCHEDULED");
    });

    it("should submit audit findings", async () => {
      const findings = [
        {
          finding_type: "FEATURE_MISUSE" as const,
          severity: "LOW" as const,
          description: "Advanced features being used without proper licensing",
          evidence: ["feature_usage_logs.json"],
          affected_licenses: ["license_456"],
          impact_assessment: "Minor compliance issue, easily resolved",
          recommended_action: "Upgrade license to include advanced features",
        },
      ];

      mockResponse({
        data: {
          ...mockAudit,
          findings: [...mockFindings, findings[0]],
          compliance_score: 68.2,
        },
      });

      const result = await client.submitAuditFindings("audit_123", findings);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/licensing/compliance/audits/audit_123/findings",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ findings }),
        }),
      );

      expect(result.data.findings).toHaveLength(3);
      expect(result.data.compliance_score).toBe(68.2);
    });

    it("should resolve compliance violation", async () => {
      const resolutionData = {
        resolution_action: "Geographic restrictions updated to include new region",
        resolution_notes:
          "Customer upgraded license to multi-region deployment. All installations now compliant.",
        evidence: ["updated_license_agreement.pdf", "compliance_verification.pdf"],
      };

      mockResponse({
        data: {
          ...mockViolations[0],
          status: "RESOLVED",
        },
      });

      const result = await client.resolveComplianceViolation("violation_123", resolutionData);

      expect(result.data.status).toBe("RESOLVED");
    });

    it("should get compliance status for customer", async () => {
      const complianceStatus = {
        overall_score: 85.5,
        license_compliance: 92.0,
        feature_compliance: 78.5,
        activation_compliance: 86.0,
        violations: [
          {
            violation_type: "OVER_DEPLOYMENT" as const,
            severity: "MINOR" as const,
            license_id: "license_789",
            description: "2 excess activations detected",
            detected_at: "2024-01-16T10:00:00Z",
            evidence: ["activation_count_report.json"],
            resolution_required: true,
            status: "OPEN" as const,
          },
        ],
        recommendations: [
          "Monitor license utilization more closely",
          "Implement automated compliance checking",
        ],
      };

      mockResponse({ data: complianceStatus });

      const result = await client.getComplianceStatus("customer_456");

      expect(result.data.overall_score).toBe(85.5);
      expect(result.data.violations).toHaveLength(1);
      expect(result.data.recommendations).toHaveLength(2);
    });
  });

  describe("Usage Analytics and Reporting", () => {
    const mockUsageReport: LicenseUsageReport = {
      report_id: "report_123",
      customer_id: "customer_456",
      product_id: "product_network_mgmt",
      report_period: {
        start_date: "2024-01-01T00:00:00Z",
        end_date: "2024-01-31T23:59:59Z",
      },
      license_summary: {
        total_licenses: 50,
        active_licenses: 45,
        expired_licenses: 3,
        suspended_licenses: 2,
      },
      activation_summary: {
        total_activations: 178,
        active_activations: 165,
        peak_concurrent_activations: 42,
        average_utilization: 78.5,
      },
      feature_usage: [
        {
          feature_name: "Advanced Analytics",
          total_usage: 1245,
          unique_users: 28,
          peak_usage: 18,
        },
        {
          feature_name: "API Access",
          total_usage: 45680,
          unique_users: 15,
          peak_usage: 8,
        },
      ],
      compliance_status: "COMPLIANT",
      recommendations: [
        "Consider additional licenses for peak usage periods",
        "Optimize feature usage distribution",
      ],
      generated_at: "2024-02-01T08:00:00Z",
    };

    it("should generate comprehensive usage report", async () => {
      const reportParams = {
        customer_id: "customer_456",
        product_id: "product_network_mgmt",
        start_date: "2024-01-01T00:00:00Z",
        end_date: "2024-01-31T23:59:59Z",
        report_format: "JSON" as const,
        include_details: true,
      };

      mockResponse({
        data: {
          report_id: "report_123",
          report_data: mockUsageReport,
        },
      });

      const result = await client.generateUsageReport(reportParams);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/licensing/reports/usage",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(reportParams),
        }),
      );

      expect(result.data.report_id).toBe("report_123");
      expect(result.data.report_data?.feature_usage).toHaveLength(2);
    });

    it("should get license utilization analytics", async () => {
      const utilizationData = {
        total_licenses: 100,
        utilized_licenses: 78,
        utilization_percentage: 78.0,
        peak_utilization: 92.5,
        underutilized_licenses: [
          { license_id: "license_low_001", utilization: 12.5 },
          { license_id: "license_low_002", utilization: 8.2 },
        ],
      };

      mockResponse({ data: utilizationData });

      const result = await client.getLicenseUtilization({
        customer_id: "customer_456",
        time_period: "MONTH",
      });

      expect(result.data.utilization_percentage).toBe(78.0);
      expect(result.data.underutilized_licenses).toHaveLength(2);
    });

    it("should get feature usage analytics", async () => {
      const featureAnalytics = [
        {
          feature_name: "Real-time Monitoring",
          total_usage_hours: 5420,
          unique_licenses: 45,
          average_usage_per_license: 120.4,
          peak_concurrent_usage: 38,
        },
        {
          feature_name: "Advanced Reporting",
          total_usage_hours: 1250,
          unique_licenses: 28,
          average_usage_per_license: 44.6,
          peak_concurrent_usage: 15,
        },
      ];

      mockResponse({ data: featureAnalytics });

      const result = await client.getFeatureUsageAnalytics({
        product_id: "product_network_mgmt",
        start_date: "2024-01-01",
        end_date: "2024-01-31",
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].peak_concurrent_usage).toBe(38);
    });

    it("should get expiry alerts", async () => {
      const expiryAlerts = [
        {
          license_id: "license_exp_001",
          customer_name: "TechCorp Solutions",
          product_name: "Network Management Suite",
          expiry_date: "2024-02-15T23:59:59Z",
          days_remaining: 15,
          auto_renewal_enabled: false,
        },
        {
          license_id: "license_exp_002",
          customer_name: "Global Enterprise",
          product_name: "Security Suite Pro",
          expiry_date: "2024-02-28T23:59:59Z",
          days_remaining: 28,
          auto_renewal_enabled: true,
        },
      ];

      mockResponse({ data: expiryAlerts });

      const result = await client.getExpiryAlerts(30);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/licensing/alerts/expiring",
        expect.objectContaining({
          params: { days_ahead: 30 },
        }),
      );

      expect(result.data).toHaveLength(2);
      expect(result.data[0].auto_renewal_enabled).toBe(false);
    });
  });

  describe("License Validation and Security", () => {
    it("should validate license key", async () => {
      const validationResponse = {
        valid: true,
        license: mockLicense,
        validation_details: {
          key_format_valid: true,
          signature_valid: true,
          not_expired: true,
          activation_limit_ok: true,
          restrictions_satisfied: true,
        },
      };

      mockResponse({ data: validationResponse });

      const result = await client.validateLicenseKey("ABCD-EFGH-IJKL-MNOP-QRST");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/licensing/validate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ license_key: "ABCD-EFGH-IJKL-MNOP-QRST" }),
        }),
      );

      expect(result.data.valid).toBe(true);
      expect(result.data.validation_details.signature_valid).toBe(true);
    });

    it("should check license integrity", async () => {
      mockResponse({
        data: {
          integrity_check: true,
          tampering_detected: false,
        },
      });

      const result = await client.checkLicenseIntegrity(
        "ABCD-EFGH-IJKL-MNOP-QRST",
        "signature_hash_123",
      );

      expect(result.data.integrity_check).toBe(true);
      expect(result.data.tampering_detected).toBe(false);
    });

    it("should generate emergency code", async () => {
      mockResponse({
        data: {
          emergency_code: "EMRG-CODE-ABCD1234EFGH5678",
          valid_until: "2024-01-18T10:00:00Z",
        },
      });

      const result = await client.generateEmergencyCode(
        "ABCD-EFGH-IJKL-MNOP-QRST",
        "Server failure requiring immediate access",
      );

      expect(result.data.emergency_code).toBe("EMRG-CODE-ABCD1234EFGH5678");
      expect(result.data.valid_until).toBe("2024-01-18T10:00:00Z");
    });

    it("should blacklist device", async () => {
      mockResponse({ data: { success: true } });

      const result = await client.blacklistDevice(
        "fp_suspicious_device",
        "Multiple activation violations detected",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/licensing/security/blacklist-device",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            device_fingerprint: "fp_suspicious_device",
            reason: "Multiple activation violations detected",
          }),
        }),
      );

      expect(result.data.success).toBe(true);
    });

    it("should report suspicious activity", async () => {
      const activityData = {
        license_key: "ABCD-EFGH-IJKL-MNOP-QRST",
        activity_type: "MULTIPLE_ACTIVATIONS" as const,
        description:
          "License activated on 15 devices simultaneously from different geographic locations",
        evidence: {
          activation_timestamps: ["2024-01-17T10:00:00Z", "2024-01-17T10:01:00Z"],
          ip_addresses: ["192.168.1.100", "203.0.113.45", "198.51.100.23"],
          geographic_locations: ["US-CA", "DE-BE", "JP-TK"],
        },
      };

      mockResponse({
        data: {
          incident_id: "INC-SECURITY-2024-001",
        },
      });

      const result = await client.reportSuspiciousActivity(activityData);

      expect(result.data.incident_id).toBe("INC-SECURITY-2024-001");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle license not found errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({
          error: {
            code: "LICENSE_NOT_FOUND",
            message: "Software license not found",
          },
        }),
      } as Response);

      await expect(client.getLicense("invalid_license")).rejects.toThrow("Not Found");
    });

    it("should handle activation limit exceeded errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: "Conflict",
        json: async () => ({
          error: {
            code: "ACTIVATION_LIMIT_EXCEEDED",
            message: "Maximum number of activations reached for this license",
            details: { current_activations: 50, max_activations: 50 },
          },
        }),
      } as Response);

      await expect(
        client.activateLicense({
          license_key: "ABCD-EFGH-IJKL-MNOP-QRST",
          device_fingerprint: "fp_over_limit",
        }),
      ).rejects.toThrow("Conflict");
    });

    it("should handle invalid license key format errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          error: {
            code: "INVALID_LICENSE_KEY_FORMAT",
            message: "License key format is invalid",
          },
        }),
      } as Response);

      await expect(client.validateLicenseKey("INVALID-KEY")).rejects.toThrow("Bad Request");
    });

    it("should handle network connectivity errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network connection failed"));

      await expect(client.getLicenses()).rejects.toThrow("Network connection failed");
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle large license collections efficiently", async () => {
      const largeLicenseList = Array.from({ length: 1000 }, (_, i) => ({
        ...mockLicense,
        id: `license_${i}`,
        license_key: `ABCD-EFGH-${String(i).padStart(4, "0")}-MNOP-QRST`,
      }));

      mockResponse({
        data: largeLicenseList,
        pagination: {
          page: 1,
          limit: 1000,
          total: 1000,
          total_pages: 1,
        },
      });

      const startTime = performance.now();
      const result = await client.getLicenses({ limit: 1000 });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
      expect(result.data).toHaveLength(1000);
    });

    it("should handle complex compliance audits efficiently", async () => {
      const complexAudit = {
        ...mockAudit,
        findings: Array.from({ length: 50 }, (_, i) => ({
          ...mockFindings[0],
          description: `Finding ${i}`,
          affected_licenses: [`license_${i}`],
        })),
        violations: Array.from({ length: 20 }, (_, i) => ({
          ...mockViolations[0],
          license_id: `license_${i}`,
          description: `Violation ${i}`,
        })),
      };

      mockResponse({ data: complexAudit });

      const result = await client.getComplianceAudit("complex_audit");

      expect(result.data.findings).toHaveLength(50);
      expect(result.data.violations).toHaveLength(20);
    });

    it("should handle bulk activation scenarios", async () => {
      const bulkActivations = Array.from({ length: 100 }, (_, i) => ({
        ...mockActivation,
        id: `activation_${i}`,
        device_fingerprint: `fp_device_${i}`,
        machine_name: `MACHINE-${String(i).padStart(3, "0")}`,
      }));

      mockResponse({
        data: bulkActivations,
        pagination: {
          page: 1,
          limit: 100,
          total: 100,
          total_pages: 1,
        },
      });

      const result = await client.getActivations({ limit: 100 });

      expect(result.data).toHaveLength(100);
    });
  });
});
