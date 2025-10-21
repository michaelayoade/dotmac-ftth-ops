/**
 * Error Handling Migration Guide
 * Provides utilities and examples for migrating from basic to enhanced error handling
 */

import { ISPError } from "./errorUtils";
import {
  EnhancedISPError,
  EnhancedErrorFactory,
  ErrorCode,
  type ErrorContext,
} from "./enhancedErrorHandling";
import { errorLogger } from "../services/ErrorLoggingService";

// Migration utilities to help transition existing error handling
export class ErrorMigrationHelper {
  /**
   * Convert legacy ISPError to EnhancedISPError
   */
  static upgradeError(
    legacyError: ISPError,
    businessContext: Partial<ErrorContext> = {},
  ): EnhancedISPError {
    // Map legacy categories to error codes
    const errorCode = this.mapCategoryToCode(legacyError.category, legacyError.status);

    const context: ErrorContext = {
      operation: businessContext.operation || "legacy_operation",
      correlationId: legacyError.correlationId,
      userId: businessContext.userId,
      tenantId: businessContext.tenantId,
      service: "isp-frontend",
      component: "migration-helper",
      ...businessContext,
    };

    return new EnhancedISPError({
      code: errorCode,
      message: legacyError.message,
      context,
      category: legacyError.category,
      severity: legacyError.severity,
      status: legacyError.status,
      userMessage: legacyError.userMessage,
      retryable: legacyError.retryable,
      technicalDetails: legacyError.technicalDetails,
    });
  }

  /**
   * Map legacy error categories to specific error codes
   */
  private static mapCategoryToCode(category: string, status?: number): ErrorCode {
    switch (category) {
      case "network":
        if (status === 429) return ErrorCode.NETWORK_RATE_LIMITED;
        if (status === 0) return ErrorCode.NETWORK_OFFLINE;
        return ErrorCode.NETWORK_CONNECTION_FAILED;

      case "authentication":
        if (status === 401) return ErrorCode.AUTH_TOKEN_EXPIRED;
        return ErrorCode.AUTH_LOGIN_FAILED;

      case "authorization":
        return ErrorCode.AUTHZ_INSUFFICIENT_PERMISSIONS;

      case "validation":
        if (status === 409) return ErrorCode.VALIDATION_DUPLICATE_VALUE;
        if (status === 422) return ErrorCode.VALIDATION_BUSINESS_RULE;
        return ErrorCode.VALIDATION_REQUIRED_FIELD;

      case "business":
        return ErrorCode.UNKNOWN_ERROR; // Need specific business context

      case "system":
        if (status === 503) return ErrorCode.SYSTEM_MAINTENANCE;
        return ErrorCode.SYSTEM_DATABASE_ERROR;

      default:
        return ErrorCode.UNKNOWN_ERROR;
    }
  }

  /**
   * Batch upgrade multiple legacy errors
   */
  static upgradeBatch(
    errors: ISPError[],
    contextProvider: (error: ISPError) => Partial<ErrorContext> = () => ({}),
  ): EnhancedISPError[] {
    return errors.map((error) => this.upgradeError(error, contextProvider(error)));
  }
}

// Migration examples and patterns
export const MigrationExamples = {
  /**
   * BEFORE: Basic error handling
   */
  basicErrorHandling: () => {
    try {
      // Some operation that might fail
      throw new Error("API call failed");
    } catch (error) {
      // Basic handling - loses context
      console.error("Error:", error);
      return { error: "Something went wrong" };
    }
  },

  /**
   * AFTER: Enhanced error handling
   */
  enhancedErrorHandling: () => {
    try {
      // Some operation that might fail
      throw new Error("API call failed");
    } catch (error) {
      // Enhanced handling with business context
      const enhancedError = EnhancedErrorFactory.network(
        error instanceof Error ? error.message : String(error),
        "customer_data_fetch",
      );

      // Log with full context
      errorLogger.logError(enhancedError, {
        operation: "fetch_customer_data",
        resource: "customer",
        businessProcess: "customer_management",
        customerImpact: "medium",
      });

      return { enhancedError };
    }
  },

  /**
   * Customer Management Error Patterns
   */
  customerManagementErrors: {
    // BEFORE: Generic not found
    before: (customerId: string) => {
      throw new ISPError({
        message: "Not found",
        category: "business",
        severity: "medium",
        status: 404,
      });
    },

    // AFTER: Specific customer context
    after: (customerId: string) => {
      return EnhancedErrorFactory.customerNotFound(customerId, {
        operation: "fetch_customer_details",
        businessProcess: "customer_lookup",
        workflowStep: "data_retrieval",
      });
    },
  },

  /**
   * Billing Error Patterns
   */
  billingErrors: {
    // BEFORE: Generic payment error
    before: () => {
      throw new ISPError({
        message: "Payment failed",
        category: "business",
        severity: "high",
        status: 402,
      });
    },

    // AFTER: Specific payment context with recovery actions
    after: (amount: number, paymentMethod: string, reason: string) => {
      return EnhancedErrorFactory.paymentFailed(amount, paymentMethod, reason, {
        operation: "process_payment",
        businessProcess: "billing",
        workflowStep: "payment_processing",
        userId: "user123", // from context
        tenantId: "tenant456", // from context
      });
    },
  },

  /**
   * Network Operation Error Patterns
   */
  networkErrors: {
    // BEFORE: Generic device error
    before: () => {
      throw new ISPError({
        message: "Device unreachable",
        category: "network",
        severity: "high",
        retryable: true,
      });
    },

    // AFTER: Specific device context with escalation
    after: (deviceId: string, deviceType: string) => {
      return EnhancedErrorFactory.deviceUnreachable(deviceId, deviceType, {
        operation: "configure_device",
        businessProcess: "network_management",
        workflowStep: "device_configuration",
        metadata: {
          deviceLocation: "Building A, Floor 2",
          lastSeen: "2023-12-01T10:30:00Z",
        },
      });
    },
  },
};

// Step-by-step migration guide
export const MigrationSteps = {
  step1_identifyErrorPatterns: `
    1. Identify Error Patterns in Your Codebase
    ==========================================
    
    Search for these patterns:
    - try/catch blocks with generic error handling
    - throw new Error() or throw new ISPError()
    - HTTP status code mappings (400, 401, 403, 404, 422, 500)
    - Business logic errors without context
    
    Use this command to find error patterns:
    grep -r "throw new" src/ | grep -E "(Error|ISPError)"
  `,

  step2_categorizeErrors: `
    2. Categorize Your Errors by Business Domain
    ==========================================
    
    Group errors by:
    - Customer Management (CUST_*)
    - Billing & Payments (BILL_*)
    - Network Operations (NET_DEV_*, NET_SVC_*)
    - Service Management (SVC_*)
    - System & Infrastructure (SYS_*)
    
    For each error, identify:
    - What business operation was being performed?
    - What resource was being accessed?
    - What's the customer impact?
    - Is it retryable?
  `,

  step3_addBusinessContext: `
    3. Add Business Context to Error Creation
    ========================================
    
    Replace this:
      throw new ISPError({ message: 'Failed', category: 'business' });
    
    With this:
      throw EnhancedErrorFactory.customerNotFound(customerId, {
        operation: 'fetch_customer_profile',
        businessProcess: 'customer_management',
        customerImpact: 'medium'
      });
  `,

  step4_updateErrorHandlers: `
    4. Update Error Handlers to Use Enhanced Errors
    ==============================================
    
    Replace basic error handlers:
      catch (error) {
        console.error(error);
        showToast('Error occurred');
      }
    
    With enhanced handlers:
      catch (error) {
        const enhancedError = useEnhancedErrorHandler().handleError(error, {
          operation: 'save_customer_data',
          resource: 'customer'
        });
        
        // Display contextual error with recovery options
        showEnhancedErrorToast(enhancedError);
      }
  `,

  step5_implementLogging: `
    5. Implement Comprehensive Error Logging
    =======================================
    
    Configure error logging:
      configureErrorLogging({
        enableRemoteLogging: true,
        enableMetrics: true,
        endpoints: {
          logs: '/api/errors',
          metrics: '/api/metrics'
        }
      });
    
    Errors will automatically be logged with full context.
  `,

  step6_updateUIComponents: `
    6. Update UI Components for Better Error Display
    ==============================================
    
    Replace basic error displays:
      {error && <div className="error">{error.message}</div>}
    
    With enhanced error displays:
      {error && (
        <EnhancedErrorDisplay 
          error={error}
          onRetry={handleRetry}
          onContactSupport={handleSupport}
        />
      )}
  `,
};

// Code transformation examples
export const CodeTransformations = {
  /**
   * API Client Error Handling
   */
  apiClient: {
    before: `
      // BEFORE: Basic API error handling
      async function fetchCustomer(id: string) {
        try {
          const response = await fetch(\`/api/customers/\${id}\`);
          if (!response.ok) {
            throw new Error(\`HTTP \${response.status}\`);
          }
          return await response.json();
        } catch (error) {
          console.error('API error:', error);
          throw error;
        }
      }
    `,
    after: `
      // AFTER: Enhanced API error handling
      async function fetchCustomer(id: string) {
        const { handleApiError } = useEnhancedErrorHandler();
        
        try {
          const response = await fetch(\`/api/customers/\${id}\`);
          if (!response.ok) {
            throw { status: response.status, message: response.statusText };
          }
          return await response.json();
        } catch (error) {
          throw handleApiError(error, 'fetch_customer', 'customer');
        }
      }
    `,
  },

  /**
   * Form Validation Error Handling
   */
  formValidation: {
    before: `
      // BEFORE: Basic form validation
      function validateCustomerForm(data: any) {
        const errors: string[] = [];
        
        if (!data.email) {
          errors.push('Email is required');
        }
        
        if (errors.length > 0) {
          throw new Error(errors.join(', '));
        }
      }
    `,
    after: `
      // AFTER: Enhanced form validation with business context
      function validateCustomerForm(data: any) {
        if (!data.email) {
          throw EnhancedErrorFactory.validationError(
            'email',
            data.email,
            'Email is required for customer communication',
            {
              operation: 'validate_customer_form',
              businessProcess: 'customer_registration',
              customerImpact: 'low'
            }
          );
        }
      }
    `,
  },

  /**
   * Business Logic Error Handling
   */
  businessLogic: {
    before: `
      // BEFORE: Basic business rule validation
      function processPayment(customerId: string, amount: number) {
        const customer = getCustomer(customerId);
        
        if (customer.balance < 0) {
          throw new Error('Payment required');
        }
        
        // Process payment...
      }
    `,
    after: `
      // AFTER: Enhanced business rule validation
      function processPayment(customerId: string, amount: number) {
        const customer = getCustomer(customerId);
        
        if (customer.balance < 0) {
          throw new EnhancedISPError({
            code: ErrorCode.CUSTOMER_PAYMENT_OVERDUE,
            message: 'Customer has outstanding balance that must be paid',
            context: {
              operation: 'process_service_payment',
              resource: 'customer',
              resourceId: customerId,
              businessProcess: 'payment_processing',
              customerImpact: 'high',
              metadata: {
                outstandingBalance: Math.abs(customer.balance),
                requestedAmount: amount
              }
            }
          });
        }
        
        // Process payment...
      }
    `,
  },
};

// Migration checklist
export const MigrationChecklist = [
  "✅ Identify all error throwing locations in codebase",
  "✅ Categorize errors by business domain and impact",
  "✅ Replace generic Error/ISPError with EnhancedISPError",
  "✅ Add business context (operation, resource, process)",
  "✅ Update error handlers to use useEnhancedErrorHandler",
  "✅ Replace basic error UI with EnhancedErrorDisplay components",
  "✅ Configure error logging and metrics collection",
  "✅ Add error recovery and retry mechanisms",
  "✅ Test error scenarios with enhanced error handling",
  "✅ Monitor error metrics and customer impact",
];

export default {
  ErrorMigrationHelper,
  MigrationExamples,
  MigrationSteps,
  CodeTransformations,
  MigrationChecklist,
};
