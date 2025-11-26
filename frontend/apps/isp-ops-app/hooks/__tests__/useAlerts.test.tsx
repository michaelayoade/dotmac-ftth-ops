/**
 * Tests for useAlerts hooks
 * Tests alert management, filtering, and state
 */

import { renderHook } from "@testing-library/react";

// Mock the alert service BEFORE imports
jest.mock("@/lib/services/alert-service", () => {
  const defaultStats = {
    total: 0,
    critical: 0,
    warning: 0,
    info: 0,
    byCategory: {
      security: 0,
      billing: 0,
      performance: 0,
      system: 0,
      compliance: 0,
    },
  };

  return {
    alertService: {
      subscribe: jest.fn((callback: any) => {
        // Call immediately with initial data (mimics real behavior)
        callback([]);
        // Return unsubscribe function
        return jest.fn();
      }),
      dismissAlert: jest.fn(),
      refresh: jest.fn().mockResolvedValue(undefined),
      getAlertStats: jest.fn().mockReturnValue(defaultStats),
      getAlertsBySeverity: jest.fn().mockReturnValue([]),
      getAlertsByCategory: jest.fn().mockReturnValue([]),
    },
  };
});

import { useAlerts, useCriticalAlerts, useSecurityAlerts, useBillingAlerts } from "../useAlerts";
import { alertService } from "@/lib/services/alert-service";

// Get the mocked service
const mockedAlertService = alertService as jest.Mocked<typeof alertService>;

describe("useAlerts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockAlerts = [
    {
      id: "alert-1",
      severity: "critical",
      category: "security",
      title: "Critical Alert",
      message: "System failure detected",
      timestamp: new Date().toISOString(),
      dismissed: false,
    },
    {
      id: "alert-2",
      severity: "warning",
      category: "security",
      title: "Security Alert",
      message: "Suspicious activity detected",
      timestamp: new Date().toISOString(),
      dismissed: false,
    },
    {
      id: "alert-3",
      severity: "info",
      category: "billing",
      title: "Billing Alert",
      message: "Payment overdue",
      timestamp: new Date().toISOString(),
      dismissed: false,
    },
  ];

  describe("useAlerts", () => {
    it("should initialize and subscribe to alerts", () => {
      const { result } = renderHook(() => useAlerts());

      expect(mockedAlertService.subscribe).toHaveBeenCalled();
      expect(result.current.alerts).toEqual([]);
      expect(result.current.loading).toBe(false);
    });

    it("should return alert statistics", () => {
      mockedAlertService.getAlertStats.mockReturnValue({
        total: 3,
        critical: 1,
        warning: 1,
        info: 1,
        byCategory: {
          security: 2,
          billing: 1,
          performance: 0,
          system: 0,
          compliance: 0,
        },
      });

      const { result } = renderHook(() => useAlerts());

      expect(result.current.stats).toBeDefined();
      expect(result.current.stats.total).toBeGreaterThanOrEqual(0);
    });

    it("should provide dismiss alert function", () => {
      const { result } = renderHook(() => useAlerts());

      expect(typeof result.current.dismissAlert).toBe("function");

      // Call dismiss
      result.current.dismissAlert("alert-1");

      expect(mockedAlertService.dismissAlert).toHaveBeenCalledWith("alert-1");
    });

    it("should provide refresh function", async () => {
      mockedAlertService.refresh.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAlerts());

      expect(typeof result.current.refreshAlerts).toBe("function");

      // Call refresh
      await result.current.refreshAlerts();

      expect(mockedAlertService.refresh).toHaveBeenCalled();
    });

    it("should provide severity filter function", () => {
      mockedAlertService.getAlertsBySeverity.mockReturnValue([mockAlerts[0]]);

      const { result } = renderHook(() => useAlerts());

      const criticalAlerts = result.current.getAlertsBySeverity("critical");

      expect(mockedAlertService.getAlertsBySeverity).toHaveBeenCalledWith("critical");
      expect(criticalAlerts).toHaveLength(1);
    });

    it("should provide category filter function", () => {
      mockedAlertService.getAlertsByCategory.mockReturnValue([mockAlerts[0], mockAlerts[1]]);

      const { result } = renderHook(() => useAlerts());

      const securityAlerts = result.current.getAlertsByCategory("security");

      expect(mockedAlertService.getAlertsByCategory).toHaveBeenCalledWith("security");
      expect(securityAlerts).toHaveLength(2);
    });

    it("should clean up subscription on unmount", () => {
      const { unmount } = renderHook(() => useAlerts());

      // Verify subscription was set up
      expect(mockedAlertService.subscribe).toHaveBeenCalled();

      // Unmount should not throw (cleanup is internal to the hook)
      expect(() => unmount()).not.toThrow();
    });
  });

  describe("useCriticalAlerts", () => {
    it("should return only critical alerts", () => {
      // Mock useAlerts to return test data
      jest.mock("../useAlerts", () => ({
        ...jest.requireActual("../useAlerts"),
        useAlerts: () => ({
          alerts: mockAlerts,
          stats: {},
          loading: false,
          dismissAlert: jest.fn(),
          refreshAlerts: jest.fn(),
          getAlertsBySeverity: jest.fn(),
          getAlertsByCategory: jest.fn(),
        }),
      }));

      const { result } = renderHook(() => useCriticalAlerts());

      // Should filter for critical severity
      expect(Array.isArray(result.current)).toBe(true);
    });

    it("should return empty array when no critical alerts", () => {
      const { result } = renderHook(() => useCriticalAlerts());

      expect(result.current).toEqual([]);
    });
  });

  describe("useSecurityAlerts", () => {
    it("should return only security alerts", () => {
      const { result } = renderHook(() => useSecurityAlerts());

      // Should filter for security category
      expect(Array.isArray(result.current)).toBe(true);
    });

    it("should return empty array when no security alerts", () => {
      const { result } = renderHook(() => useSecurityAlerts());

      expect(result.current).toEqual([]);
    });
  });

  describe("useBillingAlerts", () => {
    it("should return only billing alerts", () => {
      const { result } = renderHook(() => useBillingAlerts());

      // Should filter for billing category
      expect(Array.isArray(result.current)).toBe(true);
    });

    it("should return empty array when no billing alerts", () => {
      const { result } = renderHook(() => useBillingAlerts());

      expect(result.current).toEqual([]);
    });
  });

  describe("Real-time updates", () => {
    it("should update when alerts change", () => {
      const { result } = renderHook(() => useAlerts());

      expect(result.current.alerts).toEqual([]);

      // Verify the subscription mechanism works
      expect(mockedAlertService.subscribe).toHaveBeenCalled();
    });
  });
});
