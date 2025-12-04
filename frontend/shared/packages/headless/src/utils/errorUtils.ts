/**
 * Standardized Error Handling Utilities
 * Provides consistent error handling patterns across the ISP Framework
 */

export type ErrorSeverity = "low" | "medium" | "high" | "critical";
export type ErrorCategory =
  | "network"
  | "validation"
  | "authentication"
  | "authorization"
  | "business"
  | "system"
  | "unknown";

export interface StandardError {
  id: string;
  message: string;
  code?: string;
  status?: number;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context?: string;
  timestamp: Date;
  retryable: boolean;
  userMessage: string;
  technicalDetails?: Record<string, any>;
  correlationId?: string;
}

export interface ErrorHandlingConfig {
  enableLogging: boolean;
  enableTelemetry: boolean;
  enableUserNotifications: boolean;
  maxRetries: number;
  retryDelayMs: number;
  fallbackEnabled: boolean;
}

export class ISPError extends Error {
  public readonly id: string;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly context?: string;
  public readonly timestamp: Date;
  public readonly retryable: boolean;
  public readonly userMessage: string;
  public readonly status?: number;
  public readonly code?: string;
  public readonly technicalDetails?: Record<string, any>;
  public readonly correlationId?: string;

  constructor(params: Partial<StandardError> & { message: string }) {
    super(params.message);
    this.name = "ISPError";
    this.id = params.id || generateErrorId();
    this.category = params.category || "unknown";
    this.severity = params.severity || "medium";
    this.context = params.context;
    this.timestamp = params.timestamp || new Date();
    this.retryable = params.retryable ?? false;
    this.userMessage = params.userMessage || this.generateUserMessage();
    this.status = params.status;
    this.code = params.code;
    this.technicalDetails = params.technicalDetails;
    this.correlationId = params.correlationId || generateCorrelationId();
  }

  private generateUserMessage(): string {
    switch (this.category) {
      case "network":
        return "Connection problem. Please check your internet and try again.";
      case "authentication":
        return "Please log in again to continue.";
      case "authorization":
        return "You don't have permission to perform this action.";
      case "validation":
        return "Please check your input and try again.";
      case "business":
        return "Unable to complete this action. Please try again later.";
      case "system":
        return "System temporarily unavailable. Please try again in a few minutes.";
      default:
        return "Something went wrong. Please try again.";
    }
  }

  toJSON(): StandardError {
    return {
      id: this.id,
      message: this.message,
      code: this.code,
      status: this.status,
      category: this.category,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp,
      retryable: this.retryable,
      userMessage: this.userMessage,
      technicalDetails: this.technicalDetails,
      correlationId: this.correlationId,
    };
  }
}

/**
 * Standardized error classification and transformation
 */
export function classifyError(error: unknown, context?: string): ISPError {
  // If already an ISPError, return as-is
  if (error instanceof ISPError) {
    return error;
  }

  // Handle fetch/network errors
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return new ISPError({
      message: error.message,
      category: "network",
      severity: "medium",
      context,
      retryable: true,
      userMessage: "Network connection failed. Please check your internet connection.",
    });
  }

  // Handle HTTP status errors
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as any).status;

    if (status === 401) {
      return new ISPError({
        message: "Authentication failed",
        status,
        category: "authentication",
        severity: "high",
        context,
        retryable: false,
        userMessage: "Please log in again to continue.",
      });
    }

    if (status === 403) {
      return new ISPError({
        message: "Access denied",
        status,
        category: "authorization",
        severity: "high",
        context,
        retryable: false,
        userMessage: "You don't have permission to perform this action.",
      });
    }

    if (status === 422) {
      return new ISPError({
        message: "Validation failed",
        status,
        category: "validation",
        severity: "low",
        context,
        retryable: false,
        userMessage: "Please check your input and try again.",
      });
    }

    if (status >= 500) {
      return new ISPError({
        message: "Server error",
        status,
        category: "system",
        severity: "critical",
        context,
        retryable: true,
        userMessage: "System temporarily unavailable. Please try again in a few minutes.",
      });
    }

    if (status === 429) {
      return new ISPError({
        message: "Rate limit exceeded",
        status,
        category: "system",
        severity: "medium",
        context,
        retryable: true,
        userMessage: "Too many requests. Please wait a moment before trying again.",
      });
    }
  }

  // Handle timeout errors
  if (error && typeof error === "object" && "name" in error && error.name === "AbortError") {
    return new ISPError({
      message: "Request timeout",
      category: "network",
      severity: "medium",
      context,
      retryable: true,
      userMessage: "Request timed out. Please try again.",
    });
  }

  // Handle generic Error objects
  if (error instanceof Error) {
    return new ISPError({
      message: error.message,
      category: "unknown",
      severity: "medium",
      context,
      retryable: false,
      technicalDetails: { originalError: error.name, stack: error.stack },
    });
  }

  // Handle unknown error types
  return new ISPError({
    message: "An unknown error occurred",
    category: "unknown",
    severity: "medium",
    context,
    retryable: false,
    technicalDetails: { originalError: String(error) },
  });
}

/**
 * Standardized retry logic
 */
export function isRetryableError(error: ISPError): boolean {
  return error.retryable;
}

export function calculateRetryDelay(attempt: number, baseDelay = 1000, maxDelay = 30000): number {
  // Exponential backoff with jitter
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  const jitter = delay * 0.1 * Math.random(); // Add up to 10% jitter
  return Math.floor(delay + jitter);
}

export function shouldRetry(error: ISPError, attempt: number, maxRetries: number): boolean {
  return attempt < maxRetries && isRetryableError(error);
}

/**
 * Error logging and telemetry
 */
export interface ErrorLogEntry {
  error: StandardError;
  userAgent: string;
  url: string;
  userId?: string;
  tenantId?: string;
  sessionId?: string;
}

let errorLogger: ((entry: ErrorLogEntry) => void) | null = null;

export function setErrorLogger(logger: (entry: ErrorLogEntry) => void): void {
  errorLogger = logger;
}

export function logError(error: ISPError, additionalContext?: Partial<ErrorLogEntry>): void {
  if (!errorLogger) return;

  const logEntry: ErrorLogEntry = {
    error: error.toJSON(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Unknown",
    url: typeof window !== "undefined" ? window.location.href : "Unknown",
    ...additionalContext,
  };

  errorLogger(logEntry);
}

/**
 * Error aggregation and deduplication
 */
const errorCache = new Map<string, { count: number; lastSeen: Date }>();

export function deduplicateError(error: ISPError, timeWindow = 60000): boolean {
  const key = `${error.message}-${error.context}-${error.status}`;
  const now = new Date();
  const cached = errorCache.get(key);

  if (cached && now.getTime() - cached.lastSeen.getTime() < timeWindow) {
    cached.count += 1;
    cached.lastSeen = now;
    return false; // Don't log duplicate
  }

  errorCache.set(key, { count: 1, lastSeen: now });
  return true; // Log this error
}

/**
 * Utility functions
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Error boundary helpers
 */
export interface ErrorFallbackProps {
  error: ISPError;
  resetError: () => void;
  context?: string;
}

export function createErrorFallback(
  fallbackComponent: React.ComponentType<ErrorFallbackProps>,
): React.ComponentType<ErrorFallbackProps> {
  return fallbackComponent;
}

/**
 * Business logic error constructors
 */
export const ErrorFactory = {
  network: (message: string, context?: string) =>
    new ISPError({
      message,
      category: "network",
      severity: "medium",
      context,
      retryable: true,
    }),

  validation: (message: string, context?: string, details?: Record<string, any>) =>
    new ISPError({
      message,
      category: "validation",
      severity: "low",
      context,
      retryable: false,
      technicalDetails: details,
    }),

  authentication: (context?: string) =>
    new ISPError({
      message: "Authentication required",
      category: "authentication",
      severity: "high",
      context,
      retryable: false,
    }),

  authorization: (resource: string, context?: string) =>
    new ISPError({
      message: `Access denied to ${resource}`,
      category: "authorization",
      severity: "high",
      context,
      retryable: false,
      userMessage: `You don't have permission to access ${resource}.`,
    }),

  business: (message: string, context?: string, severity: ErrorSeverity = "medium") =>
    new ISPError({
      message,
      category: "business",
      severity,
      context,
      retryable: false,
    }),

  system: (message: string, context?: string, severity: ErrorSeverity = "critical") =>
    new ISPError({
      message,
      category: "system",
      severity,
      context,
      retryable: true,
    }),
};

/**
 * Default error handling configuration
 */
export const DEFAULT_ERROR_CONFIG: ErrorHandlingConfig = {
  enableLogging: true,
  enableTelemetry: true,
  enableUserNotifications: true,
  maxRetries: 3,
  retryDelayMs: 1000,
  fallbackEnabled: true,
};

// Global error handling configuration (legacy support)
export const configureGlobalErrorHandling = (
  config: {
    logger?: (logData: any) => void;
    enableConsoleLogging?: boolean;
  } = {},
) => {
  if (config.logger) {
    setErrorLogger(config.logger);
  }

  if (config.enableConsoleLogging) {
    // Enable console logging for errors in development
    if (process.env["NODE_ENV"] === "development") {
      console.warn("Global error handling configured for development");
    }
  }
};
