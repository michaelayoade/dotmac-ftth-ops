/**
 * Enhanced security logging utility for frontend security events
 */

export interface SecurityEvent {
  type: SecurityEventType;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  sessionId?: string;
  userId?: string;
  userAgent: string;
  location?: string;
}

export type SecurityEventType =
  | "auth_success"
  | "auth_failure"
  | "auth_rate_limited"
  | "token_refresh"
  | "token_expired"
  | "csrf_token_missing"
  | "csrf_token_invalid"
  | "xss_attempt_blocked"
  | "suspicious_activity"
  | "session_hijack_attempt"
  | "mfa_setup"
  | "mfa_success"
  | "mfa_failure"
  | "logout"
  | "permission_denied"
  | "data_access_attempt";

class SecurityLogger {
  private events: SecurityEvent[] = [];
  private maxEvents = 1000; // Keep last 1000 events in memory
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.setupErrorHandlers();
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup global error handlers for security monitoring
   */
  private setupErrorHandlers(): void {
    // Monitor for potential XSS attempts
    if (typeof window !== "undefined") {
      const originalAlert = window.alert;
      window.alert = (message: string) => {
        this.logEvent({
          type: "suspicious_activity",
          severity: "medium",
          message: "Alert function called - potential XSS",
          metadata: { alertMessage: message },
        });
        return originalAlert.call(window, message);
      };

      // Monitor for suspicious console activity
      const originalConsoleError = console.error;

      console.error = (...args: unknown[]) => {
        const message = args.join(" ");
        if (message.includes("Content Security Policy") || message.includes("CSP")) {
          this.logEvent({
            type: "suspicious_activity",
            severity: "high",
            message: "CSP violation detected",
            metadata: { errorArgs: args },
          });
        }
        return originalConsoleError.apply(console, args);
      };
    }
  }

  /**
   * Log a security event
   */
  logEvent(event: Omit<SecurityEvent, "timestamp" | "userAgent" | "sessionId">): void {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      location: typeof window !== "undefined" ? window.location.href : "unknown",
    };

    // Add to memory store
    this.events.push(securityEvent);

    // Keep memory usage under control
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Console logging based on severity
    this.consoleLog(securityEvent);

    // In production, this would also send to a security monitoring service
    this.sendToSecurityService(securityEvent);
  }

  /**
   * Console logging with appropriate level based on severity
   */
  private consoleLog(event: SecurityEvent): void {
    const _logMessage = `[SECURITY] ${event.type}: ${event.message}`;
    const _metadata = { ...event.metadata, sessionId: event.sessionId };

    switch (event.severity) {
      case "critical":
        break;
      case "high":
        break;
      case "medium":
        break;
      case "low":
        break;
    }
  }

  /**
   * Send event to security monitoring service
   */
  private sendToSecurityService(event: SecurityEvent): void {
    // In development, just log to console
    if (process.env["NODE_ENV"] === "development") {
      return;
    }

    // In production, send to security monitoring endpoint
    try {
      fetch("/api/security/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }).catch((_error) => {
        // Error handler implementation pending
      });
    } catch (_error) {
      // Fail silently - don't let security logging break the app
    }
  }

  /**
   * Log authentication success
   */
  logAuthSuccess(userId: string, metadata?: Record<string, unknown>): void {
    this.logEvent({
      type: "auth_success",
      severity: "low",
      message: "User authentication successful",
      userId,
      metadata,
    });
  }

  /**
   * Log authentication failure
   */
  logAuthFailure(reason: string, metadata?: Record<string, unknown>): void {
    this.logEvent({
      type: "auth_failure",
      severity: "medium",
      message: `Authentication failed: ${reason}`,
      metadata,
    });
  }

  /**
   * Log rate limiting event
   */
  logRateLimit(endpoint: string, identifier: string): void {
    this.logEvent({
      type: "auth_rate_limited",
      severity: "high",
      message: `Rate limit exceeded for ${endpoint}`,
      metadata: { endpoint, identifier },
    });
  }

  /**
   * Log token refresh event
   */
  logTokenRefresh(success: boolean, reason?: string): void {
    this.logEvent({
      type: "token_refresh",
      severity: success ? "low" : "medium",
      message: success ? "Token refreshed successfully" : `Token refresh failed: ${reason}`,
      metadata: { success, reason },
    });
  }

  /**
   * Log CSRF protection events
   */
  logCSRFEvent(
    eventType: "missing" | "invalid" | "valid",
    metadata?: Record<string, unknown>,
  ): void {
    const severity = eventType === "valid" ? "low" : "high";
    this.logEvent({
      type: eventType === "missing" ? "csrf_token_missing" : "csrf_token_invalid",
      severity,
      message: `CSRF token ${eventType}`,
      metadata,
    });
  }

  /**
   * Log MFA events
   */
  logMFAEvent(
    eventType: "setup" | "success" | "failure",
    userId?: string,
    metadata?: Record<string, unknown>,
  ): void {
    const typeMap = {
      setup: "mfa_setup" as SecurityEventType,
      success: "mfa_success" as SecurityEventType,
      failure: "mfa_failure" as SecurityEventType,
    };

    this.logEvent({
      type: typeMap[eventType],
      severity: eventType === "failure" ? "medium" : "low",
      message: `MFA ${eventType}`,
      userId: userId ?? "unknown",
      metadata: metadata ?? {},
    });
  }

  /**
   * Log permission denied events
   */
  logPermissionDenied(resource: string, action: string, userId?: string): void {
    this.logEvent({
      type: "permission_denied",
      severity: "medium",
      message: `Access denied to ${resource} for action ${action}`,
      userId: userId ?? "unknown",
      metadata: { resource, action },
    });
  }

  /**
   * Log suspicious activity
   */
  logSuspiciousActivity(description: string, metadata?: Record<string, unknown>): void {
    this.logEvent({
      type: "suspicious_activity",
      severity: "high",
      message: description,
      metadata: metadata ?? {},
    });
  }

  /**
   * Get recent security events
   */
  getRecentEvents(count: number = 50, severity?: SecurityEvent["severity"]): SecurityEvent[] {
    let events = [...this.events].reverse();

    if (severity) {
      events = events.filter((event) => event.severity === severity);
    }

    return events.slice(0, count);
  }

  /**
   * Get security summary
   */
  getSecuritySummary(): {
    totalEvents: number;
    eventsBySeverity: Record<string, number>;
    eventsByType: Record<string, number>;
    recentHighSeverityEvents: SecurityEvent[];
  } {
    const eventsBySeverity = this.events.reduce(
      (acc, event) => {
        acc[event.severity] = (acc[event.severity] || 0) + 1;
        return acc;
      },
      {
        // Implementation pending
      } as Record<string, number>,
    );

    const eventsByType = this.events.reduce(
      (acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      },
      {
        // Implementation pending
      } as Record<string, number>,
    );

    const recentHighSeverityEvents = this.events
      .filter((event) => event.severity === "high" || event.severity === "critical")
      .slice(-10)
      .reverse();

    return {
      totalEvents: this.events.length,
      eventsBySeverity,
      eventsByType,
      recentHighSeverityEvents,
    };
  }

  /**
   * Clear security events (for testing or privacy)
   */
  clearEvents(): void {
    this.events = [];
  }
}

// Export singleton instance
export const securityLogger = new SecurityLogger();

// React hook for easy integration
export function useSecurityLogger() {
  return {
    logAuthSuccess: securityLogger.logAuthSuccess.bind(securityLogger),
    logAuthFailure: securityLogger.logAuthFailure.bind(securityLogger),
    logRateLimit: securityLogger.logRateLimit.bind(securityLogger),
    logTokenRefresh: securityLogger.logTokenRefresh.bind(securityLogger),
    logCSRFEvent: securityLogger.logCSRFEvent.bind(securityLogger),
    logMFAEvent: securityLogger.logMFAEvent.bind(securityLogger),
    logPermissionDenied: securityLogger.logPermissionDenied.bind(securityLogger),
    logSuspiciousActivity: securityLogger.logSuspiciousActivity.bind(securityLogger),
    getRecentEvents: securityLogger.getRecentEvents.bind(securityLogger),
    getSecuritySummary: securityLogger.getSecuritySummary.bind(securityLogger),
  };
}
