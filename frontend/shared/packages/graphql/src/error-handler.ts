import { GraphQLError } from "./client";

type ToastVariant = "default" | "destructive";

export interface GraphQLToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

export interface GraphQLToastFn {
  (options: GraphQLToastOptions): void;
}

export interface GraphQLErrorHandlerOptions {
  /**
   * Toast dispatcher. Required to surface the error to users.
   */
  toast: GraphQLToastFn;

  /**
   * Optional logger with an error signature compatible with the app logger.
   */
  logger?: {
    error: (message: string, error?: unknown, context?: Record<string, unknown>) => void;
  };

  /**
   * Additional context merged into the log payload.
   */
  context?: Record<string, unknown>;

  /**
   * Friendly fallback description if the error lacks a message.
   * @default "An unexpected error occurred. Please try again."
   */
  fallbackMessage?: string;

  /**
   * GraphQL operation name for logging.
   */
  operationName?: string;

  /**
   * Skip the toast while still logging.
   */
  suppressToast?: boolean;

  /**
   * Optional custom message to show in the toast instead of the server message.
   */
  customMessage?: string;
}

interface NormalizedGraphQLError {
  message: string;
  code?: string;
  path?: Array<string | number>;
  isNetworkError?: boolean;
}

const DEFAULT_FALLBACK_MESSAGE = "An unexpected error occurred. Please try again.";

const ERROR_CODE_TO_TOAST: Record<
  string,
  { title: string; variant: ToastVariant; getDescription?: (message: string) => string }
> = {
  UNAUTHENTICATED: {
    title: "Authentication required",
    variant: "destructive",
    getDescription: () => "Your session has expired. Please sign in again.",
  },
  FORBIDDEN: {
    title: "Access denied",
    variant: "destructive",
    getDescription: () => "You do not have permission to perform this action.",
  },
  NOT_FOUND: {
    title: "Not found",
    variant: "destructive",
  },
  BAD_USER_INPUT: {
    title: "Validation error",
    variant: "destructive",
  },
  VALIDATION_ERROR: {
    title: "Validation error",
    variant: "destructive",
  },
  CONFLICT: {
    title: "Conflict detected",
    variant: "destructive",
  },
  RATE_LIMITED: {
    title: "Too many requests",
    variant: "destructive",
    getDescription: () => "You are sending requests too quickly. Please try again shortly.",
  },
  SERVICE_UNAVAILABLE: {
    title: "Service unavailable",
    variant: "destructive",
  },
  INTERNAL_SERVER_ERROR: {
    title: "Server error",
    variant: "destructive",
    getDescription: () => "The server encountered an unexpected error. Please try again later.",
  },
};

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}

function extractFirstError(errors: any[] | undefined): NormalizedGraphQLError | undefined {
  if (!Array.isArray(errors) || errors.length === 0) {
    return undefined;
  }

  const first = errors[0] ?? {};
  const message =
    typeof first?.message === "string"
      ? first.message
      : typeof first === "string"
        ? first
        : DEFAULT_FALLBACK_MESSAGE;

  const extensions = isRecord(first?.extensions) ? first.extensions : undefined;
  const code = typeof extensions?.code === "string" ? extensions.code : undefined;
  const path = Array.isArray(first?.path) ? first.path : undefined;

  return {
    message,
    code,
    path,
  };
}

function normalizeGraphQLError(error: unknown): NormalizedGraphQLError {
  if (error instanceof GraphQLError) {
    const el = extractFirstError(error.errors);
    return {
      message: el?.message ?? error.message ?? DEFAULT_FALLBACK_MESSAGE,
      ...(el?.code ? { code: el.code } : {}),
      ...(el?.path ? { path: el.path } : {}),
    };
  }

  if (isRecord(error)) {
    // ApolloError & similar shapes
    if (Array.isArray((error as any).graphQLErrors)) {
      const el = extractFirstError((error as any).graphQLErrors);
      const errorMsg =
        typeof (error as any)["message"] === "string"
          ? (error as any)["message"]
          : DEFAULT_FALLBACK_MESSAGE;
      return {
        message: el?.message ?? errorMsg,
        ...(el?.code ? { code: el.code } : {}),
        ...(el?.path ? { path: el.path } : {}),
        isNetworkError: Boolean((error as any).networkError),
      };
    }

    if (Array.isArray((error as any).errors)) {
      const el = extractFirstError((error as any).errors);
      if (el) {
        return el;
      }
    }

    if (typeof (error as any)["message"] === "string") {
      return {
        message: (error as any)["message"],
        ...(typeof (error as any)["code"] === "string" ? { code: (error as any)["code"] } : {}),
      };
    }
  }

  if (typeof error === "string") {
    return {
      message: error,
    };
  }

  return {
    message: DEFAULT_FALLBACK_MESSAGE,
  };
}

function buildToastPayload(
  normalized: NormalizedGraphQLError,
  fallbackMessage: string,
): GraphQLToastOptions {
  const message = normalized.message || fallbackMessage;
  const code = normalized.code ?? "";
  const mapping = ERROR_CODE_TO_TOAST[code];

  if (mapping) {
    return {
      title: mapping.title,
      description: mapping.getDescription ? mapping.getDescription(message) : message,
      variant: mapping.variant,
    };
  }

  if (normalized.isNetworkError) {
    return {
      title: "Network error",
      description: "Unable to reach the server. Check your connection and try again.",
      variant: "destructive",
    };
  }

  return {
    title: "Request failed",
    description: message,
    variant: "destructive",
  };
}

/**
 * Handle GraphQL errors consistently across applications.
 * Logs the error (with context) and surfaces a toast with an appropriate message.
 *
 * @param error - The unknown GraphQL error thrown by a query or mutation
 * @param options - Toast/logger configuration
 */
const SKIP_TOAST_CODES = new Set<string>(["UNAUTHENTICATED", "SESSION_EXPIRED"]);

export enum ErrorSeverity {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

export interface ErrorHandlerContext {
  operation?: string;
  componentName?: string;
  userId?: string;
  tenantId?: string;
  additionalData?: Record<string, unknown>;
}

export interface ErrorHandlerResult {
  message: string;
  severity: ErrorSeverity;
  code?: string;
  shouldToast: boolean;
  shouldLog: boolean;
}

export const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Please log in to continue",
  FORBIDDEN: "You do not have permission to perform this action",
  NOT_FOUND: "The requested resource was not found",
  VALIDATION_ERROR: "Please check your input and try again",
  INTERNAL_SERVER_ERROR: "A server error occurred. Please try again later",
  DATABASE_ERROR: "Unable to access data. Please try again later",
  NETWORK_ERROR: "Network error. Please check your connection",
  TIMEOUT: "Request timed out. Please try again",
};

function getErrorSeverity(code?: string): ErrorSeverity {
  if (!code) return ErrorSeverity.ERROR;

  if (code.includes("INTERNAL_SERVER_ERROR") || code.includes("DATABASE_ERROR")) {
    return ErrorSeverity.CRITICAL;
  }

  if (
    code.includes("VALIDATION_ERROR") ||
    code.includes("BAD_USER_INPUT") ||
    code.includes("NOT_FOUND")
  ) {
    return ErrorSeverity.WARNING;
  }

  if (
    code.includes("UNAUTHENTICATED") ||
    code.includes("FORBIDDEN") ||
    code.includes("UNAUTHORIZED")
  ) {
    return ErrorSeverity.INFO;
  }

  return ErrorSeverity.ERROR;
}

export function handleGraphQLError(error: unknown, options: GraphQLErrorHandlerOptions): void;
export function handleGraphQLError(
  error: unknown,
  context?: ErrorHandlerContext,
): ErrorHandlerResult;
export function handleGraphQLError(
  error: unknown,
  optionsOrContext: GraphQLErrorHandlerOptions | ErrorHandlerContext = {},
): void | ErrorHandlerResult {
  if ("toast" in optionsOrContext) {
    const {
      toast,
      logger,
      context,
      fallbackMessage = DEFAULT_FALLBACK_MESSAGE,
      operationName,
      suppressToast = false,
      customMessage,
    } = optionsOrContext;

    const normalized = normalizeGraphQLError(error);

    if (logger) {
      const logContext: Record<string, unknown> = {
        ...context,
      };

      if (normalized.code) {
        logContext["code"] = normalized.code;
      }

      if (normalized.path) {
        logContext["path"] = normalized.path;
      }

      if (operationName) {
        logContext["operationName"] = operationName;
      }

      const errorObject = error instanceof Error ? error : new Error(String(error));
      logger.error(
        `GraphQL operation failed${operationName ? ` (${operationName})` : ""}`,
        errorObject,
        logContext,
      );
    }

    if (!suppressToast) {
      const toastPayload = customMessage
        ? {
            title: "Request failed",
            description: customMessage,
            variant: "destructive" as const,
          }
        : buildToastPayload(normalized, fallbackMessage);
      toast(toastPayload);
    }

    return;
  }

  const context = optionsOrContext as ErrorHandlerContext;
  const normalized = normalizeGraphQLError(error);
  const severity = getErrorSeverity(normalized.code);
  const message = normalized.message || DEFAULT_FALLBACK_MESSAGE;
  const shouldToast = !normalized.code || !SKIP_TOAST_CODES.has(normalized.code);
  const shouldLog = true;

  if (shouldLog) {
    const logContext = {
      severity,
      code: normalized.code,
      path: normalized.path,
      ...context,
    };
    console.error(`[GraphQL Error] ${message}`, logContext);
  }

  return {
    message,
    severity,
    ...(normalized.code ? { code: normalized.code } : {}),
    shouldToast,
    shouldLog,
  };
}

export function useErrorHandler(
  error: unknown,
  context: ErrorHandlerContext = {},
): ErrorHandlerResult | null {
  if (!error) return null;
  return handleGraphQLError(error, context) as ErrorHandlerResult;
}

export function getUserFriendlyMessage(code?: string): string {
  if (!code) return "An unexpected error occurred";
  return ERROR_MESSAGES[code] || "An error occurred. Please try again";
}

export function handleGraphQLErrorWithFriendlyMessage(
  error: unknown,
  context: ErrorHandlerContext = {},
): ErrorHandlerResult {
  const result = handleGraphQLError(error, context) as ErrorHandlerResult;

  if (result.code) {
    const friendlyMessage = getUserFriendlyMessage(result.code);
    return {
      ...result,
      message: friendlyMessage,
    };
  }

  return result;
}
