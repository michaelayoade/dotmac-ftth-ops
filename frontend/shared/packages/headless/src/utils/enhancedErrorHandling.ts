/**
 * Enhanced Error Handling System
 * Addresses context loss, client experience, and debugging concerns
 */

import { ISPError, type ErrorCategory, type ErrorSeverity } from "./errorUtils";

// Enhanced error codes with business context
export enum ErrorCode {
  // Network & Connectivity
  NETWORK_CONNECTION_FAILED = "NET_001",
  NETWORK_TIMEOUT = "NET_002",
  NETWORK_RATE_LIMITED = "NET_003",
  NETWORK_OFFLINE = "NET_004",

  // Authentication & Authorization
  AUTH_TOKEN_EXPIRED = "AUTH_001",
  AUTH_TOKEN_INVALID = "AUTH_002",
  AUTH_LOGIN_FAILED = "AUTH_003",
  AUTH_MFA_REQUIRED = "AUTH_004",
  AUTH_ACCOUNT_LOCKED = "AUTH_005",
  AUTHZ_INSUFFICIENT_PERMISSIONS = "AUTHZ_001",
  AUTHZ_RESOURCE_FORBIDDEN = "AUTHZ_002",
  AUTHZ_TENANT_ACCESS_DENIED = "AUTHZ_003",

  // Validation Errors - Detailed by Domain
  VALIDATION_REQUIRED_FIELD = "VAL_001",
  VALIDATION_INVALID_FORMAT = "VAL_002",
  VALIDATION_OUT_OF_RANGE = "VAL_003",
  VALIDATION_DUPLICATE_VALUE = "VAL_004",
  VALIDATION_BUSINESS_RULE = "VAL_005",
  VALIDATION_FIELD_INVALID = "VAL_006",
  BUSINESS_RULE_VIOLATION = "VAL_007",
  CONFIGURATION_ERROR = "CFG_001",
  BILLING_ERROR = "BILL_999",
  WORKFLOW_ERROR = "WF_001",
  SECURITY_VIOLATION = "SEC_001",

  // Customer Management
  CUSTOMER_NOT_FOUND = "CUST_001",
  CUSTOMER_ALREADY_EXISTS = "CUST_002",
  CUSTOMER_SERVICE_SUSPENDED = "CUST_003",
  CUSTOMER_PAYMENT_OVERDUE = "CUST_004",
  CUSTOMER_INVALID_STATUS = "CUST_005",

  // Billing & Payments
  BILLING_PAYMENT_FAILED = "BILL_001",
  BILLING_INVOICE_NOT_FOUND = "BILL_002",
  BILLING_AMOUNT_INVALID = "BILL_003",
  BILLING_REFUND_FAILED = "BILL_004",
  BILLING_SUBSCRIPTION_EXPIRED = "BILL_005",
  BILLING_CREDIT_LIMIT_EXCEEDED = "BILL_006",

  // Network Operations
  NETWORK_DEVICE_UNREACHABLE = "NET_DEV_001",
  NETWORK_CONFIGURATION_FAILED = "NET_DEV_002",
  NETWORK_SERVICE_UNAVAILABLE = "NET_SVC_001",
  NETWORK_BANDWIDTH_EXCEEDED = "NET_SVC_002",
  NETWORK_MAINTENANCE_MODE = "NET_SVC_003",

  // Service Management
  SERVICE_PROVISIONING_FAILED = "SVC_001",
  SERVICE_DEPROVISIONING_FAILED = "SVC_002",
  SERVICE_CONFIGURATION_INVALID = "SVC_003",
  SERVICE_DEPENDENCY_MISSING = "SVC_004",
  SERVICE_QUOTA_EXCEEDED = "SVC_005",

  // System Errors
  SYSTEM_DATABASE_ERROR = "SYS_001",
  SYSTEM_CACHE_ERROR = "SYS_002",
  SYSTEM_QUEUE_FULL = "SYS_003",
  SYSTEM_RESOURCE_EXHAUSTED = "SYS_004",
  SYSTEM_MAINTENANCE = "SYS_005",

  // Generic
  UNKNOWN_ERROR = "UNKNOWN_001",
}

// Detailed error context for business operations
export interface ErrorContext {
  // Request Context
  operation: string;
  resource?: string;
  resourceId?: string;
  userId?: string;
  tenantId?: string;
  correlationId?: string;
  traceId?: string;

  // Business Context
  businessProcess?: string;
  workflowStep?: string;
  customerImpact?: "none" | "low" | "medium" | "high" | "critical";

  // Technical Context
  service?: string;
  component?: string;
  version?: string;
  environment?: string;

  // Additional metadata
  metadata?: Record<string, any>;
  tags?: string[];
}

// Enhanced error response structure
export interface EnhancedErrorResponse {
  // Core error information
  error: {
    id: string;
    code: ErrorCode;
    message: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    timestamp: string;
    httpStatus: number;
  };

  // User-facing information
  userMessage: string;
  userActions?: string[];
  supportContact?: string;
  documentationUrl?: string;

  // Business context
  context: ErrorContext;

  // Developer information
  details: {
    technicalMessage?: string;
    stackTrace?: string;
    requestId?: string;
    debugInfo?: Record<string, any>;
  };

  // Resolution guidance
  resolution?: {
    retryable: boolean;
    retryAfter?: number;
    escalationRequired?: boolean;
    workaround?: string;
    estimatedResolution?: string;
  };
}

// Error classification with enhanced business context
export class EnhancedISPError extends ISPError {
  public readonly errorCode: ErrorCode;
  public readonly enhancedContext: ErrorContext;
  public readonly userActions: string[];
  public readonly supportContact?: string;
  public readonly documentationUrl?: string;
  public readonly escalationRequired: boolean;
  public readonly workaround?: string;

  constructor(params: {
    code: ErrorCode;
    message: string;
    context: ErrorContext;
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    status?: number;
    userMessage?: string;
    userActions?: string[];
    supportContact?: string;
    documentationUrl?: string;
    retryable?: boolean;
    escalationRequired?: boolean;
    workaround?: string;
    technicalDetails?: Record<string, any>;
  }) {
    const errorCode = params.code || ErrorCode.UNKNOWN_ERROR;
    // Map error code to category and severity if not provided
    const { category, severity } = mapCodeToProperties(errorCode);

    super({
      message: params.message,
      category: params.category || category,
      severity: params.severity || severity,
      status: params.status || mapCodeToHttpStatus(errorCode),
      code: errorCode,
      context: params.context.operation,
      retryable: params.retryable ?? isRetryableByCode(errorCode),
      userMessage: params.userMessage || generateContextualUserMessage(errorCode, params.context),
      technicalDetails: params.technicalDetails,
      correlationId: params.context.correlationId,
    });

    this.errorCode = errorCode;
    this.enhancedContext = params.context;
    this.userActions = params.userActions || generateUserActions(params.code);
    this.supportContact = params.supportContact;
    this.documentationUrl = params.documentationUrl || generateDocumentationUrl(params.code);
    this.escalationRequired =
      params.escalationRequired ?? requiresEscalation(params.code, params.severity || severity);
    this.workaround = params.workaround;
  }

  toEnhancedResponse(): EnhancedErrorResponse {
    return {
      error: {
        id: this.id,
        code: this.errorCode,
        message: this.message,
        category: this.category,
        severity: this.severity,
        timestamp: this.timestamp.toISOString(),
        httpStatus: this.status || 500,
      },
      userMessage: this.userMessage,
      userActions: this.userActions,
      supportContact: this.supportContact,
      documentationUrl: this.documentationUrl,
      context: this.enhancedContext,
      details: {
        technicalMessage: this.message,
        requestId: this.correlationId,
        debugInfo: this.technicalDetails,
      },
      resolution: {
        retryable: this.retryable,
        retryAfter: this.retryable ? calculateBackoffDelay(this.errorCode) : undefined,
        escalationRequired: this.escalationRequired,
        workaround: this.workaround,
      },
    };
  }

  override toJSON() {
    const base = super.toJSON();
    return {
      ...base,
      code: this.errorCode,
      context: this.enhancedContext,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

// Error code mapping utilities
function mapCodeToProperties(code: ErrorCode): {
  category: ErrorCategory;
  severity: ErrorSeverity;
} {
  if (!code) {
    return { category: "system", severity: "medium" };
  }
  const mappings: Record<string, { category: ErrorCategory; severity: ErrorSeverity }> = {
    // Network
    NET_: { category: "network", severity: "medium" },
    CFG_: { category: "system", severity: "medium" },
    WF_: { category: "business", severity: "medium" },
    SEC_: { category: "authorization", severity: "high" },

    // Authentication
    AUTH_: { category: "authentication", severity: "high" },
    AUTHZ_: { category: "authorization", severity: "high" },

    // Validation
    VAL_: { category: "validation", severity: "low" },

    // Business domains
    CUST_: { category: "business", severity: "medium" },
    BILL_: { category: "business", severity: "high" },
    SVC_: { category: "business", severity: "medium" },

    // System
    SYS_: { category: "system", severity: "critical" },
    NET_DEV_: { category: "system", severity: "high" },
    NET_SVC_: { category: "system", severity: "medium" },
  };

  for (const [prefix, mapping] of Object.entries(mappings)) {
    if (code.startsWith(prefix)) {
      return mapping;
    }
  }

  return { category: "unknown", severity: "medium" };
}

function mapCodeToHttpStatus(code: ErrorCode): number {
  const statusMappings: Record<string, number> = {
    // Authentication
    AUTH_TOKEN_EXPIRED: 401,
    AUTH_TOKEN_INVALID: 401,
    AUTH_LOGIN_FAILED: 401,
    AUTH_MFA_REQUIRED: 401,
    AUTH_ACCOUNT_LOCKED: 423,

    // Authorization
    AUTHZ_INSUFFICIENT_PERMISSIONS: 403,
    AUTHZ_RESOURCE_FORBIDDEN: 403,
    AUTHZ_TENANT_ACCESS_DENIED: 403,

    // Validation
    VALIDATION_REQUIRED_FIELD: 400,
    VALIDATION_INVALID_FORMAT: 400,
    VALIDATION_OUT_OF_RANGE: 400,
    VALIDATION_DUPLICATE_VALUE: 409,
    VALIDATION_BUSINESS_RULE: 422,
    VALIDATION_FIELD_INVALID: 400,
    BUSINESS_RULE_VIOLATION: 422,

    // Not Found
    CUSTOMER_NOT_FOUND: 404,
    BILLING_INVOICE_NOT_FOUND: 404,

    // Conflict
    CUSTOMER_ALREADY_EXISTS: 409,

    // Rate Limiting
    NETWORK_RATE_LIMITED: 429,
    CONFIGURATION_ERROR: 500,
    WORKFLOW_ERROR: 500,
    SECURITY_VIOLATION: 403,
    BILLING_ERROR: 500,

    // Service Unavailable
    SYSTEM_MAINTENANCE: 503,
    NETWORK_MAINTENANCE_MODE: 503,
    SYSTEM_RESOURCE_EXHAUSTED: 503,

    // Payment Required
    CUSTOMER_PAYMENT_OVERDUE: 402,
    BILLING_CREDIT_LIMIT_EXCEEDED: 402,
  };

  return statusMappings[code] || 500;
}

function isRetryableByCode(code: ErrorCode): boolean {
  const retryableCodes: ErrorCode[] = [
    ErrorCode.NETWORK_CONNECTION_FAILED,
    ErrorCode.NETWORK_TIMEOUT,
    ErrorCode.NETWORK_RATE_LIMITED,
    ErrorCode.SYSTEM_DATABASE_ERROR,
    ErrorCode.SYSTEM_CACHE_ERROR,
    ErrorCode.SYSTEM_RESOURCE_EXHAUSTED,
    ErrorCode.NETWORK_DEVICE_UNREACHABLE,
    ErrorCode.NETWORK_SERVICE_UNAVAILABLE,
  ];

  return retryableCodes.includes(code);
}

function generateContextualUserMessage(code: ErrorCode, context: ErrorContext): string {
  const baseMessages: Record<ErrorCode, string> = {
    // Network
    [ErrorCode.NETWORK_CONNECTION_FAILED]:
      "Unable to connect to our servers. Please check your internet connection.",
    [ErrorCode.NETWORK_TIMEOUT]: "The request is taking longer than usual. Please try again.",
    [ErrorCode.NETWORK_RATE_LIMITED]:
      "You're making requests too quickly. Please wait a moment before trying again.",
    [ErrorCode.NETWORK_OFFLINE]: "You appear to be offline. Please check your internet connection.",

    // Authentication
    [ErrorCode.AUTH_TOKEN_EXPIRED]: "Your session has expired. Please log in again.",
    [ErrorCode.AUTH_TOKEN_INVALID]: "Authentication failed. Please log in again.",
    [ErrorCode.AUTH_LOGIN_FAILED]: "Login failed. Please check your credentials and try again.",
    [ErrorCode.AUTH_MFA_REQUIRED]: "Multi-factor authentication is required to continue.",
    [ErrorCode.AUTH_ACCOUNT_LOCKED]:
      "Your account has been temporarily locked for security reasons.",

    // Authorization
    [ErrorCode.AUTHZ_INSUFFICIENT_PERMISSIONS]: `You don't have permission to ${context.operation}.`,
    [ErrorCode.AUTHZ_RESOURCE_FORBIDDEN]: `Access to ${context.resource || "this resource"} is not allowed.`,
    [ErrorCode.AUTHZ_TENANT_ACCESS_DENIED]: "You don't have access to this organization.",

    // Validation
    [ErrorCode.VALIDATION_REQUIRED_FIELD]: "Please fill in all required fields.",
    [ErrorCode.VALIDATION_INVALID_FORMAT]: "Please check the format of your input.",
    [ErrorCode.VALIDATION_OUT_OF_RANGE]: "The value is outside the acceptable range.",
    [ErrorCode.VALIDATION_DUPLICATE_VALUE]:
      "This value already exists. Please choose a different one.",
    [ErrorCode.VALIDATION_BUSINESS_RULE]: "This action violates business rules.",
    [ErrorCode.VALIDATION_FIELD_INVALID]: "One or more fields need your attention. Please review the highlighted inputs.",

    // Customer
    [ErrorCode.CUSTOMER_NOT_FOUND]: "Customer not found. Please verify the customer information.",
    [ErrorCode.CUSTOMER_ALREADY_EXISTS]: "A customer with this information already exists.",
    [ErrorCode.CUSTOMER_SERVICE_SUSPENDED]: "Customer service is currently suspended.",
    [ErrorCode.CUSTOMER_PAYMENT_OVERDUE]: "Customer has overdue payments that need to be resolved.",
    [ErrorCode.CUSTOMER_INVALID_STATUS]: "Customer status prevents this operation.",

    // Billing
    [ErrorCode.BILLING_PAYMENT_FAILED]:
      "Payment processing failed. Please check your payment method.",
    [ErrorCode.BILLING_INVOICE_NOT_FOUND]: "Invoice not found. Please verify the invoice number.",
    [ErrorCode.BILLING_AMOUNT_INVALID]: "Payment amount is invalid.",
    [ErrorCode.BILLING_REFUND_FAILED]: "Refund processing failed. Please contact support.",
    [ErrorCode.BILLING_SUBSCRIPTION_EXPIRED]: "Subscription has expired. Please renew to continue.",
    [ErrorCode.BILLING_CREDIT_LIMIT_EXCEEDED]:
      "Credit limit exceeded. Payment is required to continue.",

    // Network Operations
    [ErrorCode.NETWORK_DEVICE_UNREACHABLE]: "Network device is currently unreachable.",
    [ErrorCode.NETWORK_CONFIGURATION_FAILED]: "Network configuration update failed.",
    [ErrorCode.NETWORK_SERVICE_UNAVAILABLE]: "Network service is temporarily unavailable.",
    [ErrorCode.NETWORK_BANDWIDTH_EXCEEDED]: "Bandwidth limit has been exceeded.",
    [ErrorCode.NETWORK_MAINTENANCE_MODE]: "Network is currently in maintenance mode.",

    // Services
    [ErrorCode.SERVICE_PROVISIONING_FAILED]: "Service provisioning failed. Please try again.",
    [ErrorCode.SERVICE_DEPROVISIONING_FAILED]: "Service removal failed. Please contact support.",
    [ErrorCode.SERVICE_CONFIGURATION_INVALID]: "Service configuration is invalid.",
    [ErrorCode.SERVICE_DEPENDENCY_MISSING]: "Required service dependency is missing.",
    [ErrorCode.SERVICE_QUOTA_EXCEEDED]: "Service quota has been exceeded.",

    // System
    [ErrorCode.SYSTEM_DATABASE_ERROR]: "Database error occurred. Please try again later.",
    [ErrorCode.SYSTEM_CACHE_ERROR]: "System cache error. Please refresh and try again.",
    [ErrorCode.SYSTEM_QUEUE_FULL]: "System is busy. Please try again in a few moments.",
    [ErrorCode.SYSTEM_RESOURCE_EXHAUSTED]: "System resources are temporarily unavailable.",
    [ErrorCode.SYSTEM_MAINTENANCE]: "System is under maintenance. Please try again later.",

    [ErrorCode.UNKNOWN_ERROR]: "An unexpected error occurred. Please try again.",
  };

  return baseMessages[code] || "An error occurred. Please try again or contact support.";
}

function generateUserActions(code: ErrorCode): string[] {
  const actionMappings: Record<ErrorCode, string[]> = {
    [ErrorCode.NETWORK_CONNECTION_FAILED]: [
      "Check your internet connection",
      "Try refreshing the page",
      "Contact your IT administrator if the problem persists",
    ],
    [ErrorCode.AUTH_TOKEN_EXPIRED]: [
      "Log in again",
      "Clear your browser cache if the problem persists",
    ],
    [ErrorCode.VALIDATION_REQUIRED_FIELD]: [
      "Fill in all required fields marked with *",
      "Review the form for any missing information",
    ],
    [ErrorCode.BILLING_PAYMENT_FAILED]: [
      "Check your payment method details",
      "Ensure sufficient funds are available",
      "Try a different payment method",
      "Contact your bank if the issue persists",
    ],
    [ErrorCode.CUSTOMER_PAYMENT_OVERDUE]: [
      "Review outstanding invoices",
      "Make a payment to bring account current",
      "Contact billing department for payment arrangements",
    ],
  };

  return actionMappings[code] || ["Try again", "Contact support if the problem persists"];
}

function generateDocumentationUrl(code: ErrorCode): string {
  const baseUrl = "/docs/errors";
  const category = code.split("_")[0].toLowerCase();
  return `${baseUrl}/${category}/${code.toLowerCase()}`;
}

function requiresEscalation(code: ErrorCode, severity: ErrorSeverity): boolean {
  const escalationCodes: ErrorCode[] = [
    ErrorCode.SYSTEM_DATABASE_ERROR,
    ErrorCode.SYSTEM_RESOURCE_EXHAUSTED,
    ErrorCode.BILLING_REFUND_FAILED,
    ErrorCode.SERVICE_PROVISIONING_FAILED,
    ErrorCode.NETWORK_DEVICE_UNREACHABLE,
  ];

  return escalationCodes.includes(code) || severity === "critical";
}

function calculateBackoffDelay(code: ErrorCode): number {
  const delayMappings: Record<ErrorCode, number> = {
    [ErrorCode.NETWORK_RATE_LIMITED]: 60, // 1 minute
    [ErrorCode.SYSTEM_RESOURCE_EXHAUSTED]: 300, // 5 minutes
    [ErrorCode.NETWORK_CONNECTION_FAILED]: 30, // 30 seconds
    [ErrorCode.SYSTEM_MAINTENANCE]: 1800, // 30 minutes
  };

  return delayMappings[code] || 60; // Default 1 minute
}

// Enhanced error factory with business context
export const EnhancedErrorFactory = {
  // Customer Management Errors
  customerNotFound: (customerId: string, context: Partial<ErrorContext> = {}) =>
    new EnhancedISPError({
      code: ErrorCode.CUSTOMER_NOT_FOUND,
      message: `Customer with ID ${customerId} not found`,
      context: {
        operation: "customer_lookup",
        resource: "customer",
        resourceId: customerId,
        businessProcess: "customer_management",
        customerImpact: "medium",
        ...context,
      },
    }),

  customerServiceSuspended: (
    customerId: string,
    reason: string,
    context: Partial<ErrorContext> = {},
  ) =>
    new EnhancedISPError({
      code: ErrorCode.CUSTOMER_SERVICE_SUSPENDED,
      message: `Customer service suspended: ${reason}`,
      context: {
        operation: "service_access",
        resource: "customer_service",
        resourceId: customerId,
        businessProcess: "service_management",
        customerImpact: "high",
        metadata: { suspensionReason: reason, ...(context.metadata || {}) },
        ...context,
      },
      userActions: [
        "Contact customer service",
        "Review account status",
        "Resolve outstanding issues",
      ],
    }),

  // Billing Errors
  paymentFailed: (
    amount: number,
    paymentMethod: string,
    reason: string,
    context: Partial<ErrorContext> = {},
  ) =>
    new EnhancedISPError({
      code: ErrorCode.BILLING_PAYMENT_FAILED,
      message: `Payment of $${amount} failed: ${reason}`,
      context: {
        operation: "process_payment",
        resource: "payment",
        businessProcess: "billing",
        customerImpact: "high",
        metadata: { amount, paymentMethod, failureReason: reason, ...(context.metadata || {}) },
        ...context,
      },
    }),

  // Network Operation Errors
  deviceUnreachable: (deviceId: string, deviceType: string, context: Partial<ErrorContext> = {}) =>
    new EnhancedISPError({
      code: ErrorCode.NETWORK_DEVICE_UNREACHABLE,
      message: `${deviceType} device ${deviceId} is unreachable`,
      context: {
        operation: "network_operation",
        resource: "network_device",
        resourceId: deviceId,
        businessProcess: "network_management",
        customerImpact: "medium",
        metadata: { deviceType, ...(context.metadata || {}) },
        ...context,
      },
      escalationRequired: true,
    }),

  // Service Management Errors
  provisioningFailed: (
    serviceType: string,
    customerId: string,
    reason: string,
    context: Partial<ErrorContext> = {},
  ) =>
    new EnhancedISPError({
      code: ErrorCode.SERVICE_PROVISIONING_FAILED,
      message: `Failed to provision ${serviceType} service: ${reason}`,
      context: {
        operation: "provision_service",
        resource: "service",
        businessProcess: "service_provisioning",
        customerImpact: "high",
        metadata: { serviceType, customerId, failureReason: reason, ...(context.metadata || {}) },
        ...context,
      },
      escalationRequired: true,
    }),

  // Validation Errors with Field Context
  validationError: (field: string, value: any, rule: string, context: Partial<ErrorContext> = {}) =>
    new EnhancedISPError({
      code: ErrorCode.VALIDATION_FIELD_INVALID,
      message: `Validation failed for field ${field}: ${rule}`,
      context: {
        operation: "validate_input",
        resource: "form_field",
        resourceId: field,
        businessProcess: context.businessProcess || "data_entry",
        customerImpact: "low",
        metadata: { field, value, rule, ...(context.metadata || {}) },
        ...context,
      },
      userActions: [`Please correct the ${field} field`, "Review input requirements"],
    }),

  network: (message: string, operation?: string, context: Partial<ErrorContext> = {}) =>
    new EnhancedISPError({
      code: ErrorCode.NETWORK_CONNECTION_FAILED,
      message,
      context: {
        operation: operation || "network_operation",
        resource: "network",
        businessProcess: context.businessProcess || "network_management",
        customerImpact: context.customerImpact || "medium",
        ...context,
      },
      retryable: true,
    }),

  authentication: (operation?: string, context: Partial<ErrorContext> = {}) =>
    new EnhancedISPError({
      code: ErrorCode.AUTH_LOGIN_FAILED,
      message: "Authentication failed",
      context: {
        operation: operation || "authentication",
        resource: "auth",
        businessProcess: context.businessProcess || "identity_management",
        customerImpact: context.customerImpact || "high",
        ...context,
      },
      retryable: false,
    }),

  authorization: (resource: string, operation?: string, context: Partial<ErrorContext> = {}) =>
    new EnhancedISPError({
      code: ErrorCode.AUTHZ_RESOURCE_FORBIDDEN,
      message: `Access denied to ${resource}`,
      context: {
        operation: operation || "authorization",
        resource,
        businessProcess: context.businessProcess || "access_control",
        customerImpact: context.customerImpact || "medium",
        ...context,
      },
      retryable: false,
    }),

  validation: (
    message: string,
    operation?: string,
    details?: Record<string, any>,
    context: Partial<ErrorContext> = {},
  ) =>
    new EnhancedISPError({
      code: ErrorCode.VALIDATION_BUSINESS_RULE,
      message,
      context: {
        operation: operation || "validation",
        resource: "validation_rule",
        businessProcess: context.businessProcess || "data_entry",
        customerImpact: context.customerImpact || "low",
        ...context,
      },
      technicalDetails: details,
      retryable: false,
    }),

  system: (message: string, operation?: string, context: Partial<ErrorContext> = {}) =>
    new EnhancedISPError({
      code: ErrorCode.SYSTEM_DATABASE_ERROR,
      message,
      context: {
        operation: operation || "system_operation",
        resource: "system",
        businessProcess: context.businessProcess || "platform",
        customerImpact: context.customerImpact || "high",
        ...context,
      },
      escalationRequired: true,
      retryable: true,
    }),

  businessRuleViolation: (message: string, context: Partial<ErrorContext> = {}) =>
    new EnhancedISPError({
      code: ErrorCode.BUSINESS_RULE_VIOLATION,
      message,
      context: {
        operation: "business_rule_validation",
        businessProcess: "policy_enforcement",
        customerImpact: "medium",
        metadata: context.metadata || {},
        ...context,
      },
      retryable: false,
    }),

  configurationError: (message: string, configKey: string, context: Partial<ErrorContext> = {}) =>
    new EnhancedISPError({
      code: ErrorCode.CONFIGURATION_ERROR,
      message,
      context: {
        operation: "configuration_update",
        resource: "configuration",
        resourceId: configKey,
        businessProcess: "network_management",
        customerImpact: "medium",
        metadata: context.metadata || {},
        ...context,
      },
    }),

  billingError: (message: string, billingCode: string, context: Partial<ErrorContext> = {}) =>
    new EnhancedISPError({
      code: ErrorCode.BILLING_ERROR,
      message,
      context: {
        operation: "billing_processing",
        resource: "invoice",
        resourceId: billingCode,
        businessProcess: "billing",
        customerImpact: "high",
        metadata: context.metadata || {},
        ...context,
      },
    }),

  workflowError: (
    message: string,
    workflowCode: string,
    process: string,
    context: Partial<ErrorContext> = {},
  ) =>
    new EnhancedISPError({
      code: ErrorCode.WORKFLOW_ERROR,
      message,
      context: {
        operation: process,
        resource: "workflow",
        resourceId: workflowCode,
        businessProcess: process,
        customerImpact: "medium",
        metadata: context.metadata || {},
        ...context,
      },
    }),

  securityViolation: (message: string, violationCode: string, context: Partial<ErrorContext> = {}) =>
    new EnhancedISPError({
      code: ErrorCode.SECURITY_VIOLATION,
      message,
      context: {
        operation: "security_violation",
        resource: "tenant",
        resourceId: violationCode,
        businessProcess: "security",
        customerImpact: "high",
        metadata: context.metadata || {},
        ...context,
      },
      escalationRequired: true,
    }),
};

// Helper to upgrade legacy error objects to enhanced errors
export const ErrorMigrationHelper = {
  upgradeError: (legacyError: any, context: Partial<ErrorContext> = {}): EnhancedISPError => {
    const category = legacyError.category || "unknown";
    let code: ErrorCode = ErrorCode.UNKNOWN_ERROR;

    if (category === "network" && legacyError.status === 429) code = ErrorCode.NETWORK_RATE_LIMITED;
    else if (category === "network") code = ErrorCode.NETWORK_CONNECTION_FAILED;
    else if (category === "authentication") code = ErrorCode.AUTH_TOKEN_EXPIRED;
    else if (category === "authorization") code = ErrorCode.AUTHZ_INSUFFICIENT_PERMISSIONS;
    else if (category === "validation") code = ErrorCode.VALIDATION_BUSINESS_RULE;
    else if (category === "system" && legacyError.status === 503) code = ErrorCode.SYSTEM_MAINTENANCE;

    return new EnhancedISPError({
      code,
      message: legacyError.message || "Unknown error",
      context: {
        operation: context.operation || "legacy_error",
        businessProcess: context.businessProcess || "migration",
        ...context,
        correlationId: legacyError.correlationId,
      } as ErrorContext,
      correlationId: legacyError.correlationId,
      status: legacyError.status,
      userMessage: legacyError.userMessage,
      retryable: legacyError.retryable,
      technicalDetails: legacyError.technicalDetails,
    });
  },

  upgradeBatch: (legacyErrors: any[], contextProvider: (err: any) => Partial<ErrorContext>) =>
    legacyErrors.map((err) => ErrorMigrationHelper.upgradeError(err, contextProvider(err))),
};

// Enhanced error handler for API responses
export function handleApiError(error: any, context: ErrorContext): EnhancedISPError {
  // Check if it's already an enhanced error
  if (error instanceof EnhancedISPError) {
    return error;
  }

  // Extract error details from API response
  const status = error.response?.status || error.status || 500;
  const data = error.response?.data || {};
  const message = data.message || error.message || "API request failed";

  // Map common API errors to enhanced errors
  if (status === 404) {
    return new EnhancedISPError({
      code: ErrorCode.CUSTOMER_NOT_FOUND,
      message,
      context,
      status,
    });
  }

  if (status === 422) {
    return new EnhancedISPError({
      code: ErrorCode.VALIDATION_BUSINESS_RULE,
      message,
      context,
      status,
      technicalDetails: data.errors || data.details,
    });
  }

  if (status >= 500) {
    return new EnhancedISPError({
      code: ErrorCode.SYSTEM_DATABASE_ERROR,
      message,
      context,
      status,
      escalationRequired: true,
    });
  }

  // Default case
  return new EnhancedISPError({
    code: ErrorCode.UNKNOWN_ERROR,
    message,
    context,
    status,
  });
}

export default EnhancedISPError;

// Simple hook facade for enhanced error handling in tests
export function useEnhancedErrorHandler() {
  const handleError = (error: any, context: Partial<ErrorContext>) => {
    const normalizedContext: ErrorContext = {
      operation: context.operation || "unknown_operation",
      resource: context.resource,
      resourceId: context.resourceId,
      userId: context.userId,
      tenantId: context.tenantId,
      businessProcess: context.businessProcess || "general",
      customerImpact: context.customerImpact || "medium",
      metadata: context.metadata || {},
      correlationId: context.correlationId,
    };

    return handleApiError(error, normalizedContext);
  };

  return {
    handleError,
    handleApiError: (error: any, operation: string, resource?: string) =>
      handleApiError(error, {
        operation,
        resource,
        businessProcess: "api_request",
        customerImpact: "medium",
        metadata: {},
      }),
    recover: () => {},
  };
}
