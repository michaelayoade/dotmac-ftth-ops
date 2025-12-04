/**
 * @fileoverview Tests for useNotifications hook
 */

import { renderHook, act } from "@testing-library/react";
import { useNotifications } from "../index";

describe("useNotifications", () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("showToast", () => {
    it("should show toast with string message", () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.showToast("Operation successful");
      });

      expect(consoleLogSpy).toHaveBeenCalledWith("Toast:", "Operation successful");
    });

    it("should show toast with notification config object", () => {
      const { result } = renderHook(() => useNotifications());

      const config = {
        type: "success",
        title: "Success",
        message: "Operation completed successfully",
        duration: 3000,
      };

      act(() => {
        result.current.showToast(config);
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Toast:",
        "Success",
        "Operation completed successfully",
      );
    });

    it("should handle different notification types", () => {
      const { result } = renderHook(() => useNotifications());

      const types = ["success", "error", "warning", "info"] as const;

      types.forEach((type) => {
        act(() => {
          result.current.showToast({
            type,
            title: `${type} notification`,
            message: `This is a ${type} message`,
            duration: 3000,
          });
        });

        expect(consoleLogSpy).toHaveBeenCalledWith(
          "Toast:",
          `${type} notification`,
          `This is a ${type} message`,
        );
      });
    });

    it("should handle custom duration", () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.showToast({
          type: "info",
          title: "Info",
          message: "Custom duration",
          duration: 5000,
        });
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe("addNotification", () => {
    it("should add notification", () => {
      const { result } = renderHook(() => useNotifications());

      const notification = {
        id: "notif-1",
        type: "success",
        title: "New notification",
        message: "This is a notification",
      };

      act(() => {
        result.current.addNotification(notification);
      });

      expect(consoleLogSpy).toHaveBeenCalledWith("Notification:", notification);
    });

    it("should handle notification without id", () => {
      const { result } = renderHook(() => useNotifications());

      const notification = {
        type: "error",
        title: "Error",
        message: "Something went wrong",
      };

      act(() => {
        result.current.addNotification(notification);
      });

      expect(consoleLogSpy).toHaveBeenCalledWith("Notification:", notification);
    });
  });

  describe("removeNotification", () => {
    it("should remove notification by id", () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.removeNotification("notif-1");
      });

      expect(consoleLogSpy).toHaveBeenCalledWith("Remove notification:", "notif-1");
    });

    it("should handle different id formats", () => {
      const { result } = renderHook(() => useNotifications());

      const ids = ["notif-1", "abc-123", "uuid-v4-format", "12345"];

      ids.forEach((id) => {
        act(() => {
          result.current.removeNotification(id);
        });

        expect(consoleLogSpy).toHaveBeenCalledWith("Remove notification:", id);
      });
    });
  });

  describe("clearAll", () => {
    it("should clear all notifications", () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.clearAll();
      });

      expect(consoleLogSpy).toHaveBeenCalledWith("Clear all notifications");
    });

    it("should be callable multiple times", () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.clearAll();
        result.current.clearAll();
        result.current.clearAll();
      });

      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe("hook stability", () => {
    it("should return stable functions across re-renders", () => {
      const { result, rerender } = renderHook(() => useNotifications());

      const firstShowToast = result.current.showToast;
      const firstAddNotification = result.current.addNotification;
      const firstRemoveNotification = result.current.removeNotification;
      const firstClearAll = result.current.clearAll;

      rerender();

      expect(result.current.showToast).toBe(firstShowToast);
      expect(result.current.addNotification).toBe(firstAddNotification);
      expect(result.current.removeNotification).toBe(firstRemoveNotification);
      expect(result.current.clearAll).toBe(firstClearAll);
    });
  });

  describe("error handling", () => {
    it("should handle null values gracefully", () => {
      const { result } = renderHook(() => useNotifications());

      expect(() => {
        act(() => {
          result.current.showToast(null as any);
          result.current.addNotification(null);
          result.current.removeNotification(null as any);
        });
      }).not.toThrow();
    });

    it("should handle undefined values gracefully", () => {
      const { result } = renderHook(() => useNotifications());

      expect(() => {
        act(() => {
          result.current.showToast(undefined as any);
          result.current.addNotification(undefined);
          result.current.removeNotification(undefined as any);
        });
      }).not.toThrow();
    });
  });
});
