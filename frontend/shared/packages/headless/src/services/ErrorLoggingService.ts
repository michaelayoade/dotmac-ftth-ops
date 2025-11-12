/**
 * Enhanced Error Logging and Tracing Service
 * Provides comprehensive error logging, metrics, and distributed tracing
 * Now includes persistent error queue for offline support
 */

import { EnhancedISPError, type ErrorContext, ErrorCode } from "../utils/enhancedErrorHandling";
import { getErrorQueue } from "./PersistentErrorQueue";
import { createStandardError, type StandardErrorResponse } from "../types/error-contract";

// Structured log entry for enhanced error tracking
export interface ErrorLogEntry {
  // Core error information
  errorId: string;
  errorCode: ErrorCode;
  message: string;
  severity: string;
  category: string;
  timestamp: string;

  // Request context
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  requestId?: string;

  // User context
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  userAgent?: string;

  // Application context
  url: string;
  component?: string;
  operation?: string;
  resource?: string;
  resourceId?: string;

  // Business context
  businessProcess?: string;
  workflowStep?: string;
  customerImpact?: string;

  // Technical context
  service?: string;
  version?: string;
  environment?: string;
  stackTrace?: string;
  technicalDetails?: Record<string, any>;

  // Performance metrics
  duration?: number;
  memoryUsage?: number;

  // Additional metadata
  tags?: string[];
  metadata?: Record<string, any>;
}

// Error metrics and aggregation
export interface ErrorMetrics {
  errorCount: number;
  errorRate: number; // errors per minute
  criticalErrorCount: number;
  topErrorCodes: Array<{ code: ErrorCode; count: number }>;
  topErrorCategories: Array<{ category: string; count: number }>;
  customerImpactDistribution: Record<string, number>;
  meanTimeToResolution?: number;
}

// Logging configuration
export interface ErrorLoggingConfig {
  enableConsoleLogging: boolean;
  enableRemoteLogging: boolean;
  enableMetrics: boolean;
  enableTracing: boolean;
  logLevel: "debug" | "info" | "warn" | "error" | "critical";
  batchSize: number;
  flushInterval: number; // milliseconds
  maxRetries: number;
  endpoints: {
    logs?: string;
    metrics?: string;
    traces?: string;
  };
  filters: {
    excludeCategories?: string[];
    excludeCodes?: ErrorCode[];
    minSeverity?: string;
  };
}

class ErrorLoggingService {
  private config: ErrorLoggingConfig;
  private logBuffer: ErrorLogEntry[] = [];
  private metricsBuffer: Map<string, number> = new Map();
  private flushTimer?: NodeJS.Timeout;
  private isOnline: boolean = true;

  constructor(config: Partial<ErrorLoggingConfig> = {}) {
    this.config = {
      enableConsoleLogging: process.env["NODE_ENV"] === "development",
      enableRemoteLogging: true,
      enableMetrics: true,
      enableTracing: true,
      logLevel: "error",
      batchSize: 10,
      flushInterval: 30000, // 30 seconds
      maxRetries: 3,
      endpoints: {},
      filters: {},
      ...config,
    };

    this.setupFlushTimer();
    this.setupNetworkStatusListener();
  }

  /**
   * Log an enhanced error with full context
   */
  logError(error: EnhancedISPError, additionalContext: Partial<ErrorLogEntry> = {}): void {
    if (!this.shouldLog(error)) {
      return;
    }

    const logEntry = this.createLogEntry(error, additionalContext);

    // Console logging for development
    if (this.config.enableConsoleLogging) {
      this.logToConsole(logEntry);
    }

    // Add to buffer for remote logging
    if (this.config.enableRemoteLogging) {
      this.logBuffer.push(logEntry);

      // Immediate flush for critical errors
      if (error.severity === "critical") {
        this.flushLogs();
      }
    }

    // Update metrics
    if (this.config.enableMetrics) {
      this.updateMetrics(error);
    }

    // Send trace if tracing is enabled
    if (this.config.enableTracing && logEntry.traceId) {
      this.sendTrace(logEntry);
    }
  }

  /**
   * Log API request/response for error context
   */
  logApiError(
    url: string,
    method: string,
    status: number,
    error: EnhancedISPError,
    requestDuration: number,
    requestPayload?: any,
    responsePayload?: any,
  ): void {
    const apiContext: Partial<ErrorLogEntry> = {
      operation: `${method} ${url}`,
      resource: "api_endpoint",
      duration: requestDuration,
      metadata: {
        httpMethod: method,
        httpStatus: status,
        requestPayload: this.sanitizePayload(requestPayload),
        responsePayload: this.sanitizePayload(responsePayload),
      },
    };

    this.logError(error, apiContext);
  }

  /**
   * Log business operation errors with workflow context
   */
  logBusinessError(
    error: EnhancedISPError,
    businessProcess: string,
    workflowStep: string,
    customerImpact: "none" | "low" | "medium" | "high" | "critical",
    metadata: Record<string, any> = {},
  ): void {
    const businessContext: Partial<ErrorLogEntry> = {
      businessProcess,
      workflowStep,
      customerImpact,
      metadata: this.sanitizePayload(metadata),
    };

    this.logError(error, businessContext);
  }

  /**
   * Get current error metrics
   */
  getMetrics(): ErrorMetrics {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Filter recent errors for rate calculation
    const recentErrors = this.logBuffer.filter(
      (entry) => new Date(entry.timestamp).getTime() > oneMinuteAgo,
    );

    const errorCounts = new Map<ErrorCode, number>();
    const categoryCounts = new Map<string, number>();
    const impactCounts = new Map<string, number>();
    let criticalCount = 0;

    this.logBuffer.forEach((entry) => {
      if (entry.severity === "critical") criticalCount++;

      errorCounts.set(entry.errorCode, (errorCounts.get(entry.errorCode) || 0) + 1);
      categoryCounts.set(entry.category, (categoryCounts.get(entry.category) || 0) + 1);

      if (entry.customerImpact) {
        impactCounts.set(entry.customerImpact, (impactCounts.get(entry.customerImpact) || 0) + 1);
      }
    });

    return {
      errorCount: this.logBuffer.length,
      errorRate: recentErrors.length,
      criticalErrorCount: criticalCount,
      topErrorCodes: Array.from(errorCounts.entries())
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      topErrorCategories: Array.from(categoryCounts.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      customerImpactDistribution: Object.fromEntries(impactCounts),
    };
  }

  /**
   * Clear old logs to prevent memory issues
   */
  clearOldLogs(maxAge: number = 3600000): void {
    // Default 1 hour
    const cutoff = Date.now() - maxAge;
    this.logBuffer = this.logBuffer.filter((entry) => new Date(entry.timestamp).getTime() > cutoff);
  }

  /**
   * Force flush all pending logs
   */
  async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];

    try {
      if (this.config.endpoints.logs) {
        // Try to send logs to endpoint
        if (this.isOnline) {
          await this.sendLogsToEndpoint(logsToSend, this.config.endpoints.logs);
        } else {
          // Offline - save to persistent queue
          this.saveToPersistentQueue(logsToSend);
        }
      }
    } catch (error) {
      // Failed to send - save to persistent queue for retry
      this.saveToPersistentQueue(logsToSend);
      console.error("Failed to flush error logs, saved to persistent queue:", error);
    }
  }

  /**
   * Save logs to persistent queue for offline support
   */
  private saveToPersistentQueue(logs: ErrorLogEntry[]): void {
    const persistentQueue = getErrorQueue({
      errorEndpoint: this.config.endpoints.logs,
      maxQueueSize: 100,
      autoSync: true,
    });

    // Convert logs to standard error format
    logs.forEach((log) => {
      const standardError: StandardErrorResponse = {
        error_code: log.errorCode,
        message: log.message,
        user_message: log.message, // Use same message for now
        correlation_id: log.correlationId || `err_${Date.now()}`,
        timestamp: log.timestamp,
        status: 500, // Default status for logged errors
        severity: this.mapSeverity(log.severity),
        category: this.mapCategory(log.category),
        retryable: true,
        details: {
          ...log.technicalDetails,
          errorId: log.errorId,
          component: log.component,
          operation: log.operation,
          resource: log.resource,
          businessProcess: log.businessProcess,
          workflowStep: log.workflowStep,
          customerImpact: log.customerImpact,
        },
        trace_id: log.traceId,
        request_id: log.requestId,
      };

      persistentQueue.enqueue(standardError);
    });
  }

  /**
   * Map severity to standard format
   */
  private mapSeverity(severity: string): import("../types/error-contract").ErrorSeverity {
    const { ErrorSeverity } = require("../types/error-contract");
    switch (severity.toLowerCase()) {
      case "low":
        return ErrorSeverity.LOW;
      case "medium":
        return ErrorSeverity.MEDIUM;
      case "high":
        return ErrorSeverity.HIGH;
      case "critical":
        return ErrorSeverity.CRITICAL;
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * Map category to standard format
   */
  private mapCategory(category: string): import("../types/error-contract").ErrorCategory {
    const { ErrorCategory } = require("../types/error-contract");
    switch (category.toLowerCase()) {
      case "network":
        return ErrorCategory.NETWORK;
      case "validation":
        return ErrorCategory.VALIDATION;
      case "authentication":
        return ErrorCategory.AUTHENTICATION;
      case "authorization":
        return ErrorCategory.AUTHORIZATION;
      case "business":
        return ErrorCategory.BUSINESS;
      case "system":
        return ErrorCategory.SYSTEM;
      case "database":
        return ErrorCategory.DATABASE;
      case "external_service":
        return ErrorCategory.EXTERNAL_SERVICE;
      default:
        return ErrorCategory.UNKNOWN;
    }
  }

  /**
   * Generate error report for debugging
   */
  generateErrorReport(timeRange: { start: Date; end: Date }): {
    summary: ErrorMetrics;
    detailedLogs: ErrorLogEntry[];
    insights: string[];
  } {
    const filteredLogs = this.logBuffer.filter((entry) => {
      const timestamp = new Date(entry.timestamp);
      return timestamp >= timeRange.start && timestamp <= timeRange.end;
    });

    const insights: string[] = [];
    const metrics = this.getMetrics();

    // Generate insights
    if (metrics.criticalErrorCount > 0) {
      insights.push(
        `${metrics.criticalErrorCount} critical errors detected requiring immediate attention`,
      );
    }

    if (metrics.errorRate > 10) {
      insights.push(`High error rate detected: ${metrics.errorRate} errors/minute`);
    }

    const customerImpactHigh = metrics.customerImpactDistribution.high || 0;
    const customerImpactCritical = metrics.customerImpactDistribution.critical || 0;
    if (customerImpactHigh + customerImpactCritical > 0) {
      insights.push(
        `${customerImpactHigh + customerImpactCritical} errors with high customer impact`,
      );
    }

    return {
      summary: metrics,
      detailedLogs: filteredLogs,
      insights,
    };
  }

  private createLogEntry(
    error: EnhancedISPError,
    additionalContext: Partial<ErrorLogEntry>,
  ): ErrorLogEntry {
    const errorResponse = error.toEnhancedResponse();

    return {
      errorId: errorResponse.error.id,
      errorCode: errorResponse.error.code,
      message: errorResponse.error.message,
      severity: errorResponse.error.severity,
      category: errorResponse.error.category,
      timestamp: new Date().toISOString(),

      // Context from error
      correlationId: errorResponse.context.correlationId,
      traceId: errorResponse.context.traceId,
      operation: errorResponse.context.operation,
      resource: errorResponse.context.resource,
      resourceId: errorResponse.context.resourceId,
      businessProcess: errorResponse.context.businessProcess,
      workflowStep: errorResponse.context.workflowStep,
      customerImpact: errorResponse.context.customerImpact,
      service: errorResponse.context.service,
      component: errorResponse.context.component,
      version: errorResponse.context.version,
      environment: errorResponse.context.environment,

      // Technical details
      stackTrace: error.stack,
      technicalDetails: errorResponse.details.debugInfo,

      // Browser context
      url: typeof window !== "undefined" ? window.location.href : "unknown",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",

      // Additional context
      tags: errorResponse.context.tags,
      metadata: errorResponse.context.metadata,

      // Override with additional context
      ...additionalContext,
    };
  }

  private shouldLog(error: EnhancedISPError): boolean {
    const { filters } = this.config;

    // Check severity filter
    if (filters.minSeverity) {
      const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
      if (
        severityOrder[error.severity] <
        severityOrder[filters.minSeverity as keyof typeof severityOrder]
      ) {
        return false;
      }
    }

    // Check category filter
    if (filters.excludeCategories?.includes(error.category)) {
      return false;
    }

    // Check error code filter
    if (filters.excludeCodes?.includes(error.errorCode)) {
      return false;
    }

    return true;
  }

  private logToConsole(logEntry: ErrorLogEntry): void {
    const logLevel = logEntry.severity === "critical" ? "error" : "warn";

    console[logLevel]("🚨 Enhanced ISP Error:", {
      id: logEntry.errorId,
      code: logEntry.errorCode,
      message: logEntry.message,
      severity: logEntry.severity,
      context: {
        operation: logEntry.operation,
        resource: logEntry.resource,
        businessProcess: logEntry.businessProcess,
        customerImpact: logEntry.customerImpact,
      },
      technicalDetails: logEntry.technicalDetails,
    });
  }

  private updateMetrics(error: EnhancedISPError): void {
    const metricKey = `error.${error.errorCode}`;
    this.metricsBuffer.set(metricKey, (this.metricsBuffer.get(metricKey) || 0) + 1);

    const categoryKey = `error.category.${error.category}`;
    this.metricsBuffer.set(categoryKey, (this.metricsBuffer.get(categoryKey) || 0) + 1);

    const severityKey = `error.severity.${error.severity}`;
    this.metricsBuffer.set(severityKey, (this.metricsBuffer.get(severityKey) || 0) + 1);
  }

  private async sendLogsToEndpoint(logs: ErrorLogEntry[], endpoint: string): Promise<void> {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ logs }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send logs: ${response.status} ${response.statusText}`);
    }
  }

  private sendTrace(logEntry: ErrorLogEntry): void {
    // Integration with tracing systems like Jaeger, Zipkin, etc.
    if (this.config.endpoints.traces && logEntry.traceId) {
      const traceSpan = {
        traceId: logEntry.traceId,
        spanId: logEntry.spanId || this.generateSpanId(),
        operationName: logEntry.operation || "error",
        startTime: new Date(logEntry.timestamp).getTime() * 1000, // microseconds
        duration: logEntry.duration ? logEntry.duration * 1000 : 0,
        tags: {
          error: true,
          "error.code": logEntry.errorCode,
          "error.severity": logEntry.severity,
          "service.name": logEntry.service || "isp-frontend",
          component: logEntry.component || "unknown",
        },
        logs: [
          {
            timestamp: new Date(logEntry.timestamp).getTime() * 1000,
            fields: [
              { key: "event", value: "error" },
              { key: "error.message", value: logEntry.message },
              { key: "error.stack", value: logEntry.stackTrace },
            ],
          },
        ],
      };

      // Send trace asynchronously
      fetch(this.config.endpoints.traces, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spans: [traceSpan] }),
      }).catch((error) => {
        console.warn("Failed to send trace:", error);
      });
    }
  }

  private sanitizePayload(payload: any): any {
    if (!payload) return payload;

    // Remove sensitive fields
    const sensitiveFields = ["password", "token", "secret", "key", "auth", "credit_card"];

    if (typeof payload === "object") {
      const sanitized = { ...payload };

      for (const key in sanitized) {
        if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
          sanitized[key] = "[REDACTED]";
        } else if (typeof sanitized[key] === "object") {
          sanitized[key] = this.sanitizePayload(sanitized[key]);
        }
      }

      return sanitized;
    }

    return payload;
  }

  private setupFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (
        this.logBuffer.length >= this.config.batchSize ||
        (this.logBuffer.length > 0 && !this.isOnline)
      ) {
        this.flushLogs();
      }
    }, this.config.flushInterval);
  }

  private setupNetworkStatusListener(): void {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.isOnline = true;
        // Flush pending logs when coming back online
        if (this.logBuffer.length > 0) {
          this.flushLogs();
        }
      });

      window.addEventListener("offline", () => {
        this.isOnline = false;
      });

      this.isOnline = navigator.onLine;
    }
  }

  private generateSpanId(): string {
    return Math.random().toString(16).substr(2, 16);
  }
}

// Singleton instance
export const errorLogger = new ErrorLoggingService();

// Configuration helper
export function configureErrorLogging(config: Partial<ErrorLoggingConfig>): void {
  // Create new instance with updated config
  Object.assign(errorLogger, new ErrorLoggingService(config));
}

export default ErrorLoggingService;
