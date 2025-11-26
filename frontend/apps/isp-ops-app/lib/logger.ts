/**
 * Logger Utility
 *
 * Centralized logging for the frontend application.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === "development";
  }

  /**
   * Sanitize context to remove sensitive data
   * Never log passwords, tokens, cookies, or other credentials
   */
  private sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> {
    if (!context) return {};

    const sanitized = { ...context };
    const sensitiveKeys = [
      "password",
      "token",
      "secret",
      "apiKey",
      "apikey",
      "cookie",
      "cookies",
      "authorization",
      "auth",
      "accessToken",
      "refreshToken",
      "sessionId",
      "sessionid",
    ];

    Object.keys(sanitized).forEach((key) => {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = "[REDACTED]";
      }
    });

    return sanitized;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    const sanitizedContext = this.sanitizeContext(context);

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: sanitizedContext,
    };

    // In development, use console directly for better formatting
    if (this.isDevelopment) {
      const consoleMethod = level === "error" || level === "warn" ? level : "log";
      console[consoleMethod](`[${level.toUpperCase()}]`, message, sanitizedContext || "");
    } else {
      // In production, could send to logging service
      // Handle circular references gracefully
      try {
        console.log(JSON.stringify(entry));
      } catch (error) {
        // Fallback for circular references
        console.log(
          JSON.stringify({
            ...entry,
            context: "[Circular Reference]",
          }),
        );
      }
    }
  }

  debug(message: string, context?: Record<string, unknown>) {
    if (this.isDevelopment) {
      this.log("debug", message, context);
    }
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log("warn", message, context);
  }

  error(message: string, error?: Error | unknown, context?: Record<string, unknown>) {
    const errorContext = {
      ...context,
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error,
    };

    this.log("error", message, errorContext);
  }
}

export const logger = new Logger();

export default logger;
