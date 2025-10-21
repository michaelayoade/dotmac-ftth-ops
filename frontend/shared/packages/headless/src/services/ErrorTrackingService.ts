/**
 * Comprehensive Error Tracking Service
 * Provides client-side error tracking, monitoring, and reporting
 */

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  tenantId?: string;
  route?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export interface ErrorBreadcrumb {
  timestamp: Date;
  category: "navigation" | "user" | "network" | "console" | "error";
  message: string;
  level: "info" | "warn" | "error" | "debug";
  data?: Record<string, any>;
}

export interface TrackedError {
  id: string;
  message: string;
  stack?: string;
  type: "javascript" | "react" | "network" | "custom";
  level: "error" | "warning" | "info";
  timestamp: Date;
  url: string;
  userAgent: string;
  context: ErrorContext;
  breadcrumbs: ErrorBreadcrumb[];
  fingerprint: string;
  tags: Record<string, string>;
  extra: Record<string, any>;
}

export interface ErrorTrackingConfig {
  enabled: boolean;
  environment: "development" | "staging" | "production";
  maxBreadcrumbs: number;
  captureConsole: boolean;
  captureNetwork: boolean;
  captureUnhandledRejections: boolean;
  sampleRate: number;
  beforeSend?: (error: TrackedError) => TrackedError | null;
  endpoints: {
    errors: string;
    performance: string;
  };
}

class ErrorTrackingService {
  private config: ErrorTrackingConfig;
  private breadcrumbs: ErrorBreadcrumb[] = [];
  private context: ErrorContext = {};
  private isInitialized = false;

  constructor(config: Partial<ErrorTrackingConfig> = {}) {
    this.config = {
      enabled: true,
      environment: "production",
      maxBreadcrumbs: 100,
      captureConsole: true,
      captureNetwork: true,
      captureUnhandledRejections: true,
      sampleRate: 1.0,
      endpoints: {
        errors: "/api/errors",
        performance: "/api/performance",
      },
      ...config,
    };
  }

  initialize(): void {
    if (this.isInitialized || !this.config.enabled || typeof window === "undefined") {
      return;
    }

    this.setupGlobalErrorHandlers();
    this.setupNetworkMonitoring();
    this.setupConsoleCapture();
    this.setupNavigationTracking();

    this.isInitialized = true;
    this.addBreadcrumb({
      category: "error",
      message: "Error tracking initialized",
      level: "info",
    });
  }

  setContext(context: Partial<ErrorContext>): void {
    this.context = { ...this.context, ...context };
  }

  addBreadcrumb(breadcrumb: Omit<ErrorBreadcrumb, "timestamp">): void {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: new Date(),
    });

    if (this.breadcrumbs.length > this.config.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  captureError(error: Error | string, context?: Partial<ErrorContext>): string {
    if (!this.config.enabled || Math.random() > this.config.sampleRate) {
      return "";
    }

    const errorId = this.generateErrorId();
    const trackedError: TrackedError = this.createTrackedError(error, "custom", context, errorId);

    if (this.config.beforeSend) {
      const processedError = this.config.beforeSend(trackedError);
      if (!processedError) return errorId;
      this.sendError(processedError);
    } else {
      this.sendError(trackedError);
    }

    return errorId;
  }

  captureException(error: Error, context?: Partial<ErrorContext>): string {
    return this.captureError(error, context);
  }

  captureMessage(
    message: string,
    level: "error" | "warning" | "info" = "info",
    context?: Partial<ErrorContext>,
  ): string {
    const errorId = this.generateErrorId();
    const trackedError: TrackedError = {
      id: errorId,
      message,
      type: "custom",
      level,
      timestamp: new Date(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      context: { ...this.context, ...context },
      breadcrumbs: [...this.breadcrumbs],
      fingerprint: this.generateFingerprint(message, "custom"),
      tags: this.extractTags(context),
      extra: {},
    };

    this.sendError(trackedError);
    return errorId;
  }

  private setupGlobalErrorHandlers(): void {
    // JavaScript runtime errors
    window.addEventListener("error", (event) => {
      const trackedError = this.createTrackedError(event.error || event.message, "javascript", {
        component: event.filename,
        metadata: {
          line: event.lineno,
          column: event.colno,
        },
      });
      this.sendError(trackedError);
    });

    // Unhandled promise rejections
    if (this.config.captureUnhandledRejections) {
      window.addEventListener("unhandledrejection", (event) => {
        const error =
          event.reason instanceof Error ? event.reason : new Error(String(event.reason));
        const trackedError = this.createTrackedError(error, "javascript", {
          metadata: { type: "unhandled_promise_rejection" },
        });
        this.sendError(trackedError);
      });
    }
  }

  private setupNetworkMonitoring(): void {
    if (!this.config.captureNetwork) return;

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const [resource, config] = args;
      const url = typeof resource === "string" ? resource : resource.url;

      this.addBreadcrumb({
        category: "network",
        message: `Fetch ${config?.method || "GET"} ${url}`,
        level: "info",
        data: { url, method: config?.method || "GET" },
      });

      try {
        const response = await originalFetch(...args);

        if (!response.ok) {
          this.addBreadcrumb({
            category: "network",
            message: `HTTP ${response.status} ${url}`,
            level: response.status >= 500 ? "error" : "warn",
            data: {
              url,
              status: response.status,
              statusText: response.statusText,
            },
          });

          if (response.status >= 500) {
            this.captureError(`HTTP ${response.status}: ${url}`, {
              metadata: {
                status: response.status,
                statusText: response.statusText,
                url,
              },
            });
          }
        }

        return response;
      } catch (error) {
        this.addBreadcrumb({
          category: "network",
          message: `Network error: ${url}`,
          level: "error",
          data: { url, error: error.message },
        });

        this.captureError(error, {
          metadata: { url, type: "network_error" },
        });

        throw error;
      }
    };
  }

  private setupConsoleCapture(): void {
    if (!this.config.captureConsole) return;

    const originalConsole = { ...console };

    ["error", "warn", "info", "debug"].forEach((level) => {
      console[level] = (...args) => {
        this.addBreadcrumb({
          category: "console",
          message: args.join(" "),
          level: level as any,
          data: { args },
        });

        if (level === "error") {
          const error = args.find((arg) => arg instanceof Error);
          if (error) {
            this.captureError(error);
          }
        }

        originalConsole[level](...args);
      };
    });
  }

  private setupNavigationTracking(): void {
    this.addBreadcrumb({
      category: "navigation",
      message: `Navigation to ${window.location.pathname}`,
      level: "info",
      data: { url: window.location.href },
    });

    // Track navigation changes
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(history, args);
      ErrorTrackingService.getInstance().addBreadcrumb({
        category: "navigation",
        message: `Navigation to ${location.pathname}`,
        level: "info",
        data: { url: location.href },
      });
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(history, args);
      ErrorTrackingService.getInstance().addBreadcrumb({
        category: "navigation",
        message: `Navigation to ${location.pathname}`,
        level: "info",
        data: { url: location.href },
      });
    };

    window.addEventListener("popstate", () => {
      this.addBreadcrumb({
        category: "navigation",
        message: `Navigation to ${location.pathname}`,
        level: "info",
        data: { url: location.href },
      });
    });
  }

  private createTrackedError(
    error: Error | string,
    type: TrackedError["type"],
    context?: Partial<ErrorContext>,
    errorId?: string,
  ): TrackedError {
    const message = typeof error === "string" ? error : error.message;
    const stack = error instanceof Error ? error.stack : undefined;

    return {
      id: errorId || this.generateErrorId(),
      message,
      stack,
      type,
      level: "error",
      timestamp: new Date(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      context: { ...this.context, ...context },
      breadcrumbs: [...this.breadcrumbs],
      fingerprint: this.generateFingerprint(message, type, stack),
      tags: this.extractTags(context),
      extra: this.extractExtra(error),
    };
  }

  private generateErrorId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFingerprint(message: string, type: string, stack?: string): string {
    const content = stack || message;
    // Simple hash function for fingerprinting
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `${type}-${Math.abs(hash).toString(36)}`;
  }

  private extractTags(context?: Partial<ErrorContext>): Record<string, string> {
    const tags: Record<string, string> = {
      environment: this.config.environment,
    };

    if (context?.tenantId) tags.tenant = context.tenantId;
    if (context?.userId) tags.user = context.userId;
    if (context?.component) tags.component = context.component;

    return tags;
  }

  private extractExtra(error: any): Record<string, any> {
    const extra: Record<string, any> = {};

    if (error && typeof error === "object") {
      Object.keys(error).forEach((key) => {
        if (key !== "message" && key !== "stack" && key !== "name") {
          extra[key] = error[key];
        }
      });
    }

    return extra;
  }

  private async sendError(error: TrackedError): Promise<void> {
    try {
      await fetch(this.config.endpoints.errors, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(error),
      });
    } catch (sendError) {
      console.error("Failed to send error to tracking service:", sendError);

      // Store in localStorage as fallback
      try {
        const storedErrors = JSON.parse(localStorage.getItem("errorTracking") || "[]");
        storedErrors.push(error);

        // Keep only last 10 errors
        if (storedErrors.length > 10) {
          storedErrors.splice(0, storedErrors.length - 10);
        }

        localStorage.setItem("errorTracking", JSON.stringify(storedErrors));
      } catch (storageError) {
        console.error("Failed to store error in localStorage:", storageError);
      }
    }
  }

  // React Error Boundary integration
  captureComponentError(error: Error, errorInfo: { componentStack: string }): string {
    return this.captureError(error, {
      component: "React Error Boundary",
      metadata: { componentStack: errorInfo.componentStack },
    });
  }

  // Singleton pattern
  private static instance: ErrorTrackingService;

  static getInstance(config?: Partial<ErrorTrackingConfig>): ErrorTrackingService {
    if (!ErrorTrackingService.instance) {
      ErrorTrackingService.instance = new ErrorTrackingService(config);
    }
    return ErrorTrackingService.instance;
  }
}

export default ErrorTrackingService;

// Export singleton instance
export const errorTracker = ErrorTrackingService.getInstance();
