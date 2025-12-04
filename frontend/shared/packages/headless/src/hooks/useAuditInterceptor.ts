/**
 * Audit Interceptor Hook
 * Automatically intercepts API calls, form submissions, and user interactions
 * Implements DRY principle by providing centralized audit interception across all components
 */

import { useEffect, useCallback, useRef } from "react";
import { useAudit } from "../components/AuditProvider";
import {
  AuditEventType,
  AuditOutcome,
  FrontendAuditEventType,
  AuditSeverity,
} from "../api/types/audit";

interface AuditInterceptorConfig {
  interceptFetch?: boolean;
  interceptClicks?: boolean;
  interceptForms?: boolean;
  interceptNavigation?: boolean;
  interceptErrors?: boolean;
  excludeUrls?: RegExp[];
  excludeElements?: string[];
}

export function useAuditInterceptor(config: AuditInterceptorConfig = {}) {
  const {
    interceptFetch = true,
    interceptClicks = true,
    interceptForms = true,
    interceptNavigation = true,
    interceptErrors = true,
    excludeUrls = [],
    excludeElements = [".audit-ignore"],
  } = config;

  const { logEvent, logDataAccess, logUIEvent, logError, isEnabled } = useAudit();
  const originalFetchRef = useRef<typeof fetch>();
  const interceptorsSetupRef = useRef<boolean>(false);

  // Check if URL should be excluded from auditing
  const shouldExcludeUrl = useCallback(
    (url: string): boolean => {
      return excludeUrls.some((pattern) => pattern.test(url));
    },
    [excludeUrls],
  );

  // Check if element should be excluded from auditing
  const shouldExcludeElement = useCallback(
    (element: Element): boolean => {
      return excludeElements.some((selector) => element.matches(selector));
    },
    [excludeElements],
  );

  // Intercept fetch API calls
  useEffect(() => {
    if (!interceptFetch || !isEnabled || typeof window === "undefined") return;

    if (!originalFetchRef.current) {
      originalFetchRef.current = window.fetch;
    }

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method || "GET";
      const startTime = performance.now();

      // Skip audit URLs and excluded URLs
      if (url.includes("/audit/") || shouldExcludeUrl(url)) {
        return originalFetchRef.current!(input, init);
      }

      try {
        const response = await originalFetchRef.current!(input, init);
        const duration = performance.now() - startTime;

        // Log successful API call
        await logDataAccess(
          method.toLowerCase(),
          "api_endpoint",
          url,
          response.ok ? AuditOutcome.SUCCESS : AuditOutcome.FAILURE,
          {
            method,
            status_code: response.status,
            duration_ms: Math.round(duration),
            response_size: response.headers.get("content-length"),
          },
        );

        return response;
      } catch (error) {
        const duration = performance.now() - startTime;

        // Log failed API call
        await logDataAccess(method.toLowerCase(), "api_endpoint", url, AuditOutcome.FAILURE, {
          method,
          duration_ms: Math.round(duration),
          error_message: (error as Error).message,
        });

        throw error;
      }
    };

    return () => {
      if (originalFetchRef.current) {
        window.fetch = originalFetchRef.current;
      }
    };
  }, [interceptFetch, isEnabled, logDataAccess, shouldExcludeUrl]);

  // Intercept click events
  useEffect(() => {
    if (!interceptClicks || !isEnabled || typeof document === "undefined") return;

    const handleClick = async (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target || shouldExcludeElement(target)) return;

      const elementInfo = {
        tag: target.tagName.toLowerCase(),
        id: target.id,
        className: target.className,
        text: target.textContent?.slice(0, 100),
        href: target.getAttribute("href"),
        type: target.getAttribute("type"),
      };

      await logUIEvent(FrontendAuditEventType.UI_BUTTON_CLICK, elementInfo.tag, {
        element: elementInfo,
        coordinates: { x: event.clientX, y: event.clientY },
      });
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [interceptClicks, isEnabled, logUIEvent, shouldExcludeElement]);

  // Intercept form submissions
  useEffect(() => {
    if (!interceptForms || !isEnabled || typeof document === "undefined") return;

    const handleSubmit = async (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      if (!form || shouldExcludeElement(form)) return;

      const formData = new FormData(form);
      const fields = Array.from(formData.keys());
      const sensitiveFields = fields.filter((field) =>
        /password|secret|token|key|ssn|credit/i.test(field),
      );

      await logUIEvent(
        FrontendAuditEventType.UI_FORM_SUBMIT,
        form.id || form.className || "unnamed_form",
        {
          form_id: form.id,
          form_action: form.action,
          form_method: form.method,
          field_count: fields.length,
          sensitive_fields: sensitiveFields.length > 0 ? ["[REDACTED]"] : [],
          fields: fields.filter((field) => !sensitiveFields.includes(field)),
        },
      );
    };

    document.addEventListener("submit", handleSubmit, { capture: true });
    return () => document.removeEventListener("submit", handleSubmit, { capture: true });
  }, [interceptForms, isEnabled, logUIEvent, shouldExcludeElement]);

  // Intercept navigation events
  useEffect(() => {
    if (!interceptNavigation || !isEnabled || typeof window === "undefined") return;

    const handlePopState = async () => {
      await logUIEvent(FrontendAuditEventType.UI_PAGE_VIEW, "navigation", {
        url: window.location.href,
        referrer: document.referrer,
        navigation_type: "popstate",
      });
    };

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (state, title, url) {
      originalPushState.apply(history, arguments as any);
      logUIEvent(FrontendAuditEventType.UI_PAGE_VIEW, "navigation", {
        url: url?.toString() || window.location.href,
        navigation_type: "pushstate",
        state,
      });
    };

    history.replaceState = function (state, title, url) {
      originalReplaceState.apply(history, arguments as any);
      logUIEvent(FrontendAuditEventType.UI_PAGE_VIEW, "navigation", {
        url: url?.toString() || window.location.href,
        navigation_type: "replacestate",
        state,
      });
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", handlePopState);
    };
  }, [interceptNavigation, isEnabled, logUIEvent]);

  // Intercept console errors
  useEffect(() => {
    if (!interceptErrors || !isEnabled || typeof console === "undefined") return;

    const originalConsoleError = console.error;
    console.error = (...args) => {
      const message = args
        .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
        .join(" ");

      logError(new Error(message), "console_error", { console_args: args });

      originalConsoleError.apply(console, args);
    };

    return () => {
      console.error = originalConsoleError;
    };
  }, [interceptErrors, isEnabled, logError]);

  // Setup flag to prevent multiple setups
  useEffect(() => {
    interceptorsSetupRef.current = true;
  }, []);

  return {
    isSetup: interceptorsSetupRef.current,
    manualLog: {
      logAPICall: useCallback(
        async (method: string, url: string, outcome: AuditOutcome, metadata?: any) => {
          await logDataAccess(method.toLowerCase(), "api_endpoint", url, outcome, metadata);
        },
        [logDataAccess],
      ),

      logUserAction: useCallback(
        async (action: string, element: string, metadata?: any) => {
          await logUIEvent(FrontendAuditEventType.UI_FEATURE_USED, element, {
            action,
            ...metadata,
          });
        },
        [logUIEvent],
      ),

      logBusinessProcess: useCallback(
        async (workflow: string, outcome: AuditOutcome, metadata?: any) => {
          await logEvent({
            event_type: AuditEventType.BUSINESS_WORKFLOW_START,
            message: `Business process: ${workflow}`,
            outcome,
            severity: AuditSeverity.LOW,
            actor: { id: "system", type: "system" },
            context: {
              source: "business_process",
              environment: process.env["NODE_ENV"] || "development",
            },
            metadata,
          });
        },
        [logEvent],
      ),
    },
  };
}
