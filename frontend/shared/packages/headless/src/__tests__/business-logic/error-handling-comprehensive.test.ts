/**
 * Enhanced Error Handling Business Logic (active cases only)
 */

import { renderHook } from "@testing-library/react";

import {
  EnhancedISPError,
  ErrorCode,
  ErrorMigrationHelper,
  type ErrorContext,
} from "@dotmac/headless/utils/enhancedErrorHandling";

import { BusinessLogicTestFactory } from "./business-logic-test-factory";

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
        message: "Network down",
        context: {
          operation: "sync_data",
          businessProcess: "data_sync",
        },
      });

      expect(error.context.correlationId).toBeDefined();
      expect(error.context.operation).toBe("sync_data");
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
        { category: "network", status: 429, expected: ErrorCode.NETWORK_RATE_LIMITED },
        { category: "authentication", status: 401, expected: ErrorCode.AUTH_TOKEN_EXPIRED },
        { category: "authorization", status: 403, expected: ErrorCode.AUTHZ_INSUFFICIENT_PERMISSIONS },
        { category: "validation", status: 422, expected: ErrorCode.VALIDATION_INVALID_FORMAT },
        { category: "system", status: 500, expected: ErrorCode.SYSTEM_DATABASE_ERROR },
      ];

      testCases.forEach(({ category, status, expected }) => {
        const legacyError = {
          message: "Legacy error",
          category,
          status,
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

  describe("Business Logic Factory Integration", () => {
    it("should generate realistic errors for ISP operations", () => {
      const factory = new BusinessLogicTestFactory();
      const error = factory.createValidationError();

      expect(error).toBeInstanceOf(EnhancedISPError);
      expect(error.code).toBeDefined();
    });
  });
});
