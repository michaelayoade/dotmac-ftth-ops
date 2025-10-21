/**
 * Error Handling Business Logic Tests - Production Coverage
 * Testing enhanced error handling with ISP-specific scenarios
 */

import {
  EnhancedISPError,
  EnhancedErrorFactory,
  ErrorCode,
  useEnhancedErrorHandler,
  type ErrorContext,
} from "@dotmac/headless/utils/enhancedErrorHandling";
import { ErrorMigrationHelper } from "@dotmac/headless/utils/errorMigrationGuide";
import { BusinessLogicTestFactory } from "./business-logic-test-factory";
import { renderHook } from "@testing-library/react";

describe("Enhanced Error Handling Business Logic", () => {
  describe("EnhancedISPError Creation and Properties", () => {
    it("should create enhanced error with full context", () => {
      const context: ErrorContext = {
        operation: "fetch_customer_data",
        resource: "customer",
        resourceId: "cust_001",
        businessProcess: "customer_management",
        workflowStep: "data_retrieval",
        userId: "user_123",
        tenantId: "tenant_001",
        service: "isp-frontend",
        component: "CustomerService",
        correlationId: "req_abc123",
        customerImpact: "medium",
        metadata: {
          customerType: "business",
          lastLoginDate: "2024-01-15T10:30:00Z",
        },
      };

      const error = new EnhancedISPError({
        code: ErrorCode.CUSTOMER_NOT_FOUND,
        message: "Customer profile not found in system",
        context,
        category: "business",
        severity: "medium",
        status: 404,
        userMessage: "We could not find your account. Please contact support.",
        retryable: false,
        technicalDetails: "Database query returned no results for customer ID",
      });

      expect(error.code).toBe(ErrorCode.CUSTOMER_NOT_FOUND);
      expect(error.context.operation).toBe("fetch_customer_data");
      expect(error.context.businessProcess).toBe("customer_management");
      expect(error.context.customerImpact).toBe("medium");
      expect(error.userMessage).toContain("contact support");
      expect(error.retryable).toBe(false);
      expect(error.metadata.customerType).toBe("business");
    });

    it("should handle missing optional context fields gracefully", () => {
      const minimalContext: ErrorContext = {
        operation: "test_operation",
        correlationId: "test_123",
      };

      const error = new EnhancedISPError({
        code: ErrorCode.UNKNOWN_ERROR,
        message: "Test error",
        context: minimalContext,
      });

      expect(error.context.operation).toBe("test_operation");
      expect(error.context.correlationId).toBe("test_123");
      expect(error.context.userId).toBeUndefined();
      expect(error.context.tenantId).toBeUndefined();
      expect(error.context.metadata).toEqual({});
    });

    it("should generate correlation ID if not provided", () => {
      const error = new EnhancedISPError({
        code: ErrorCode.NETWORK_CONNECTION_FAILED,
        message: "Network error",
        context: {
          operation: "api_call",
        },
      });

      expect(error.context.correlationId).toBeDefined();
      expect(error.context.correlationId).toMatch(/^[a-zA-Z0-9_-]+$/);
    });

    it("should include stack trace and error details", () => {
      const error = new EnhancedISPError({
        code: ErrorCode.SYSTEM_DATABASE_ERROR,
        message: "Database connection failed",
        context: {
          operation: "database_query",
          component: "CustomerRepository",
        },
      });

      expect(error.stack).toBeDefined();
      expect(error.name).toBe("EnhancedISPError");
      expect(error.toJSON()).toEqual(
        expect.objectContaining({
          code: ErrorCode.SYSTEM_DATABASE_ERROR,
          message: "Database connection failed",
          context: expect.objectContaining({
            operation: "database_query",
            component: "CustomerRepository",
          }),
        }),
      );
    });
  });

  describe("EnhancedErrorFactory Business Scenarios", () => {
    it("should create customer not found error with context", () => {
      const error = EnhancedErrorFactory.customerNotFound("cust_001", {
        operation: "fetch_customer_profile",
        businessProcess: "customer_lookup",
        customerImpact: "high",
        userId: "support_123",
        metadata: {
          searchCriteria: "customer_id",
          searchValue: "cust_001",
        },
      });

      expect(error.code).toBe(ErrorCode.CUSTOMER_NOT_FOUND);
      expect(error.context.operation).toBe("fetch_customer_profile");
      expect(error.context.customerImpact).toBe("high");
      expect(error.context.metadata.searchValue).toBe("cust_001");
      expect(error.userMessage).toContain("customer account");
    });

    it("should create payment failed error with business context", () => {
      const error = EnhancedErrorFactory.paymentFailed(
        199.99,
        "credit_card",
        "Insufficient funds",
        {
          operation: "process_monthly_payment",
          businessProcess: "billing",
          customerId: "cust_001",
          tenantId: "isp_east",
        },
      );

      expect(error.code).toBe(ErrorCode.CUSTOMER_PAYMENT_FAILED);
      expect(error.context.operation).toBe("process_monthly_payment");
      expect(error.context.businessProcess).toBe("billing");
      expect(error.message).toContain("199.99");
      expect(error.message).toContain("credit_card");
      expect(error.userMessage).toContain("payment method");
    });

    it("should create device unreachable error for network operations", () => {
      const error = EnhancedErrorFactory.deviceUnreachable("router_001", "core_router", {
        operation: "configure_device",
        businessProcess: "network_management",
        workflowStep: "device_configuration",
        metadata: {
          deviceLocation: "Data Center A",
          lastSeen: "2024-01-15T08:00:00Z",
          configAttempts: 3,
        },
      });

      expect(error.code).toBe(ErrorCode.NET_DEVICE_UNREACHABLE);
      expect(error.context.operation).toBe("configure_device");
      expect(error.context.metadata.deviceLocation).toBe("Data Center A");
      expect(error.context.metadata.configAttempts).toBe(3);
      expect(error.message).toContain("router_001");
      expect(error.message).toContain("core_router");
    });

    it("should create service outage error with customer impact", () => {
      const error = EnhancedErrorFactory.serviceOutage(
        ["internet", "voip"],
        "hardware_failure",
        120, // 2 hours estimated
        {
          operation: "report_service_outage",
          businessProcess: "incident_management",
          customerImpact: "critical",
          metadata: {
            affectedCustomers: 1200,
            outageRegion: "East District",
            maintenanceWindow: false,
          },
        },
      );

      expect(error.code).toBe(ErrorCode.SERVICE_OUTAGE);
      expect(error.context.customerImpact).toBe("critical");
      expect(error.context.metadata.affectedCustomers).toBe(1200);
      expect(error.message).toContain("internet");
      expect(error.message).toContain("voip");
      expect(error.userMessage).toContain("2 hours");
    });

    it("should create validation error with field-specific context", () => {
      const error = EnhancedErrorFactory.validationError(
        "email",
        "invalid-email-format",
        "Email address format is invalid",
        {
          operation: "validate_customer_registration",
          businessProcess: "customer_onboarding",
          metadata: {
            formStep: "contact_information",
            validationRules: ["email_format", "email_domain"],
          },
        },
      );

      expect(error.code).toBe(ErrorCode.VALIDATION_FIELD_INVALID);
      expect(error.context.operation).toBe("validate_customer_registration");
      expect(error.context.metadata.formStep).toBe("contact_information");
      expect(error.message).toContain("email");
      expect(error.userMessage).toContain("email address");
    });
  });

  describe("useEnhancedErrorHandler Hook", () => {
    it("should handle and categorize errors appropriately", () => {
      const { result } = renderHook(() => useEnhancedErrorHandler());

      const rawError = new Error("Network request failed");
      const handledError = result.current.handleError(rawError, {
        operation: "fetch_billing_data",
        resource: "invoice",
        businessProcess: "billing",
      });

      expect(handledError).toBeInstanceOf(EnhancedISPError);
      expect(handledError.context.operation).toBe("fetch_billing_data");
      expect(handledError.context.businessProcess).toBe("billing");
    });

    it("should handle API errors with HTTP status context", () => {
      const { result } = renderHook(() => useEnhancedErrorHandler());

      const apiError = {
        status: 422,
        message: "Validation failed",
        data: {
          field: "phone_number",
          constraint: "format",
        },
      };

      const handledError = result.current.handleApiError(
        apiError,
        "update_customer_contact",
        "customer",
      );

      expect(handledError.status).toBe(422);
      expect(handledError.context.operation).toBe("update_customer_contact");
      expect(handledError.context.resource).toBe("customer");
    });

    it("should provide appropriate recovery actions", () => {
      const { result } = renderHook(() => useEnhancedErrorHandler());

      const networkError = new Error("Connection timeout");
      const handledError = result.current.handleError(networkError, {
        operation: "sync_customer_data",
        businessProcess: "data_synchronization",
      });

      expect(handledError.retryable).toBe(true);
      expect(handledError.userMessage).toContain("try again");
    });

    it("should handle ISP-specific business rule violations", () => {
      const { result } = renderHook(() => useEnhancedErrorHandler());

      const businessError = new Error("Customer exceeded data quota");
      const handledError = result.current.handleError(businessError, {
        operation: "validate_data_usage",
        businessProcess: "service_monitoring",
        resourceId: "cust_001",
        metadata: {
          currentUsage: "2.5TB",
          monthlyLimit: "2TB",
        },
      });

      expect(handledError.category).toBe("business");
      expect(handledError.context.metadata.currentUsage).toBe("2.5TB");
      expect(handledError.userMessage).toContain("data usage");
    });
  });

  describe("Error Migration and Upgrade", () => {
    it("should upgrade legacy ISPError to EnhancedISPError", () => {
      const legacyError = {
        message: "Customer not found",
        category: "business",
        severity: "medium",
        status: 404,
        userMessage: "Account not found",
        retryable: false,
        correlationId: "legacy_123",
        technicalDetails: "Database query failed",
      };

      const upgradedError = ErrorMigrationHelper.upgradeError(legacyError as any, {
        operation: "customer_lookup",
        businessProcess: "customer_management",
        userId: "user_123",
        tenantId: "tenant_001",
      });

      expect(upgradedError).toBeInstanceOf(EnhancedISPError);
      expect(upgradedError.context.operation).toBe("customer_lookup");
      expect(upgradedError.context.businessProcess).toBe("customer_management");
      expect(upgradedError.context.correlationId).toBe("legacy_123");
      expect(upgradedError.message).toBe("Customer not found");
    });

    it("should map legacy categories to appropriate error codes", () => {
      const testCases = [
        {
          category: "network",
          status: 429,
          expected: ErrorCode.NETWORK_RATE_LIMITED,
        },
        {
          category: "authentication",
          status: 401,
          expected: ErrorCode.AUTH_TOKEN_EXPIRED,
        },
        {
          category: "authorization",
          expected: ErrorCode.AUTHZ_INSUFFICIENT_PERMISSIONS,
        },
        {
          category: "validation",
          status: 422,
          expected: ErrorCode.VALIDATION_BUSINESS_RULE,
        },
        {
          category: "system",
          status: 503,
          expected: ErrorCode.SYSTEM_MAINTENANCE,
        },
      ];

      testCases.forEach(({ category, status, expected }) => {
        const legacyError = {
          message: `${category} error`,
          category,
          status,
          severity: "medium",
          userMessage: "Error occurred",
        };

        const upgraded = ErrorMigrationHelper.upgradeError(legacyError as any);
        expect(upgraded.code).toBe(expected);
      });
    });

    it("should handle batch upgrade of multiple errors", () => {
      const legacyErrors = [
        { message: "Network error", category: "network", status: 0 },
        { message: "Auth error", category: "authentication", status: 401 },
        { message: "Validation error", category: "validation", status: 422 },
      ];

      const contextProvider = (error: any) => ({
        operation: `handle_${error.category}_error`,
        userId: "batch_user",
      });

      const upgradedErrors = ErrorMigrationHelper.upgradeBatch(
        legacyErrors as any[],
        contextProvider,
      );

      expect(upgradedErrors).toHaveLength(3);
      upgradedErrors.forEach((error, index) => {
        expect(error).toBeInstanceOf(EnhancedISPError);
        expect(error.context.operation).toBe(`handle_${legacyErrors[index].category}_error`);
        expect(error.context.userId).toBe("batch_user");
      });
    });
  });

  describe("ISP-Specific Error Scenarios", () => {
    it("should handle customer service plan validation errors", () => {
      const error = EnhancedErrorFactory.businessRuleViolation(
        "Customer cannot upgrade to business plan without credit check",
        {
          rule: "business_plan_credit_requirement",
          operation: "validate_plan_upgrade",
          businessProcess: "service_management",
          resourceId: "cust_001",
          metadata: {
            currentPlan: "residential_basic",
            requestedPlan: "business_pro",
            creditScore: 580,
            minimumRequired: 650,
          },
        },
      );

      expect(error.code).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
      expect(error.context.metadata.creditScore).toBe(580);
      expect(error.context.metadata.minimumRequired).toBe(650);
      expect(error.userMessage).toContain("credit check");
    });

    it("should handle network device configuration errors", () => {
      const error = EnhancedErrorFactory.configurationError(
        "VLAN 100 conflicts with existing network configuration",
        "vlan_conflict",
        {
          operation: "apply_device_config",
          businessProcess: "network_provisioning",
          resourceId: "device_001",
          metadata: {
            conflictingVlans: [100, 150],
            affectedCustomers: ["cust_001", "cust_002"],
            configType: "vlan_assignment",
          },
        },
      );

      expect(error.code).toBe(ErrorCode.CONFIGURATION_ERROR);
      expect(error.context.metadata.conflictingVlans).toEqual([100, 150]);
      expect(error.context.metadata.affectedCustomers).toHaveLength(2);
    });

    it("should handle billing and invoice processing errors", () => {
      const error = EnhancedErrorFactory.billingError(
        "Invoice generation failed due to missing service data",
        "missing_service_data",
        {
          operation: "generate_monthly_invoice",
          businessProcess: "billing_cycle",
          customerId: "cust_001",
          metadata: {
            billingPeriod: "2024-01",
            missingServices: ["internet_usage", "static_ip_allocation"],
            totalAmount: 0,
          },
        },
      );

      expect(error.code).toBe(ErrorCode.BILLING_ERROR);
      expect(error.context.metadata.billingPeriod).toBe("2024-01");
      expect(error.context.metadata.missingServices).toContain("internet_usage");
    });

    it("should handle field technician workflow errors", () => {
      const error = EnhancedErrorFactory.workflowError(
        "Cannot complete installation without customer signature",
        "missing_customer_signature",
        "installation_workflow",
        {
          operation: "complete_installation",
          businessProcess: "field_operations",
          userId: "tech_001",
          metadata: {
            workOrderId: "WO-2024-001",
            installationStep: "final_verification",
            requiredDocuments: ["service_agreement", "installation_confirmation"],
          },
        },
      );

      expect(error.code).toBe(ErrorCode.WORKFLOW_ERROR);
      expect(error.context.metadata.workOrderId).toBe("WO-2024-001");
      expect(error.context.metadata.requiredDocuments).toContain("service_agreement");
    });

    it("should handle multi-tenant isolation errors", () => {
      const error = EnhancedErrorFactory.securityViolation(
        "Attempted access to customer data from different tenant",
        "tenant_isolation_violation",
        {
          operation: "fetch_customer_data",
          businessProcess: "data_access",
          userId: "user_123",
          tenantId: "tenant_east",
          metadata: {
            requestedResource: "customer_cust_001",
            resourceTenant: "tenant_west",
            violationType: "cross_tenant_access",
          },
        },
      );

      expect(error.code).toBe(ErrorCode.SECURITY_VIOLATION);
      expect(error.context.tenantId).toBe("tenant_east");
      expect(error.context.metadata.resourceTenant).toBe("tenant_west");
      expect(error.context.metadata.violationType).toBe("cross_tenant_access");
    });
  });

  describe("Error Logging and Metrics", () => {
    it("should provide structured data for logging systems", () => {
      const error = new EnhancedISPError({
        code: ErrorCode.CUSTOMER_PAYMENT_OVERDUE,
        message: "Customer payment is overdue by 30 days",
        context: {
          operation: "validate_account_status",
          businessProcess: "account_management",
          customerId: "cust_001",
          tenantId: "tenant_001",
          metadata: {
            daysPastDue: 30,
            outstandingAmount: 299.97,
            lastPaymentDate: "2023-12-15",
          },
        },
      });

      const logData = error.toJSON();

      expect(logData).toEqual(
        expect.objectContaining({
          code: ErrorCode.CUSTOMER_PAYMENT_OVERDUE,
          message: "Customer payment is overdue by 30 days",
          context: expect.objectContaining({
            customerId: "cust_001",
            tenantId: "tenant_001",
            metadata: expect.objectContaining({
              daysPastDue: 30,
              outstandingAmount: 299.97,
            }),
          }),
          timestamp: expect.any(String),
          correlationId: expect.any(String),
        }),
      );
    });

    it("should support error metrics collection", () => {
      const errors = [
        ErrorCode.CUSTOMER_NOT_FOUND,
        ErrorCode.NETWORK_CONNECTION_FAILED,
        ErrorCode.VALIDATION_FIELD_INVALID,
        ErrorCode.AUTH_TOKEN_EXPIRED,
        ErrorCode.CUSTOMER_NOT_FOUND, // Duplicate for counting
      ];

      const errorCounts = errors.reduce(
        (acc, code) => {
          acc[code] = (acc[code] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      expect(errorCounts[ErrorCode.CUSTOMER_NOT_FOUND]).toBe(2);
      expect(errorCounts[ErrorCode.NETWORK_CONNECTION_FAILED]).toBe(1);
      expect(errorCounts[ErrorCode.VALIDATION_FIELD_INVALID]).toBe(1);
      expect(errorCounts[ErrorCode.AUTH_TOKEN_EXPIRED]).toBe(1);
    });
  });
});
