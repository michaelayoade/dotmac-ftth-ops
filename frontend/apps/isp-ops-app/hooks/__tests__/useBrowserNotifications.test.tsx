/**
 * Tests for useBrowserNotifications hooks
 * Tests browser notification management, geofence, job, and technician notifications
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useBrowserNotifications,
  useGeofenceNotifications,
  useJobNotifications,
  useTechnicianNotifications,
} from "../useBrowserNotifications";

// Mock Notification API
class MockNotification {
  title: string;
  options: any;
  onclick: (() => void) | null = null;

  constructor(title: string, options: any) {
    this.title = title;
    this.options = options;
    MockNotification.instances.push(this);
  }

  close() {
    MockNotification.closedInstances.push(this);
  }

  static instances: MockNotification[] = [];
  static closedInstances: MockNotification[] = [];
  private static _permission: NotificationPermission = "default";
  static requestPermission = jest.fn();

  static get permission(): NotificationPermission {
    return MockNotification._permission;
  }

  static set permission(value: NotificationPermission) {
    MockNotification._permission = value;
  }

  static reset() {
    MockNotification.instances = [];
    MockNotification.closedInstances = [];
    MockNotification._permission = "default";
    MockNotification.requestPermission.mockClear();
  }
}

describe("useBrowserNotifications", () => {
  let originalNotification: any;
  const storageKey = "browser_notifications_enabled";
  const grantPermission = () => {
    MockNotification.permission = "granted";
  };

  beforeAll(() => {
    originalNotification = (global as any).Notification;
    (global as any).Notification = MockNotification;
  });

  afterAll(() => {
    (global as any).Notification = originalNotification;
  });

  beforeEach(() => {
    MockNotification.reset();
    grantPermission();
    jest.clearAllMocks();
    jest.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    window.localStorage.clear();
  });

  describe("initialization", () => {
    it("should initialize with default permission", () => {
      MockNotification.permission = "default";

      const { result } = renderHook(() => useBrowserNotifications());

      expect(result.current.isSupported).toBe(true);
      expect(result.current.permission).toBe("default");
    });

    it("should load enabled state from localStorage", () => {
      window.localStorage.setItem(storageKey, "false");
      MockNotification.permission = "default";

      const { result } = renderHook(() => useBrowserNotifications());

      expect(result.current.isEnabled).toBe(false);
    });

    it("should default to enabled when no localStorage value", () => {
      MockNotification.permission = "default";

      const { result } = renderHook(() => useBrowserNotifications());

      expect(result.current.isEnabled).toBe(true);
    });

    it("should save enabled state to localStorage", () => {
      MockNotification.permission = "default";
      const storagePrototype = Object.getPrototypeOf(window.localStorage);
      const setItemSpy = jest.spyOn(storagePrototype, "setItem");

      const { result } = renderHook(() => useBrowserNotifications());

      act(() => {
        result.current.setIsEnabled(false);
      });

      expect(setItemSpy).toHaveBeenCalledWith(storageKey, "false");
    });
  });

  describe("requestPermission", () => {
    it("should request permission successfully", async () => {
      MockNotification.permission = "default";
      MockNotification.requestPermission.mockResolvedValue("granted");

      const { result } = renderHook(() => useBrowserNotifications());

      let permission: NotificationPermission;
      await act(async () => {
        permission = await result.current.requestPermission();
      });

      expect(permission!).toBe("granted");
      expect(MockNotification.requestPermission).toHaveBeenCalled();
    });

    it("should return granted if already granted", async () => {
      const { result } = renderHook(() => useBrowserNotifications());

      let permission: NotificationPermission;
      await act(async () => {
        permission = await result.current.requestPermission();
      });

      expect(permission!).toBe("granted");
      expect(MockNotification.requestPermission).not.toHaveBeenCalled();
    });

    it("should handle permission request error", async () => {
      MockNotification.permission = "default";
      MockNotification.requestPermission.mockRejectedValue(new Error("Permission denied"));

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useBrowserNotifications());

      let permission: NotificationPermission;
      await act(async () => {
        permission = await result.current.requestPermission();
      });

      expect(permission!).toBe("denied");
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe("showNotification", () => {
    it("should show notification when permitted", async () => {
      grantPermission();
      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

      const { result } = renderHook(() => useBrowserNotifications());

      await act(async () => {
        await result.current.showNotification({
          title: "Test Notification",
          body: "Test body",
        });
      });

      expect(MockNotification.instances).toHaveLength(1);
      expect(MockNotification.instances[0].title).toBe("Test Notification");
      expect(MockNotification.instances[0].options.body).toBe("Test body");
      expect(consoleLogSpy).toHaveBeenCalledWith("[Notifications] Shown:", "Test Notification");

      consoleLogSpy.mockRestore();
    });

    it("should not show when disabled by user", async () => {
      MockNotification.permission = "default";
      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

      const { result } = renderHook(() => useBrowserNotifications());

      act(() => {
        result.current.setIsEnabled(false);
      });

      await act(async () => {
        await result.current.showNotification({
          title: "Test",
          body: "Test",
        });
      });

      expect(MockNotification.instances).toHaveLength(0);
      expect(consoleLogSpy).toHaveBeenCalledWith("[Notifications] Disabled by user");

      consoleLogSpy.mockRestore();
    });

    it("should not show when permission not granted", async () => {
      MockNotification.permission = "default";
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

      const { result } = renderHook(() => useBrowserNotifications());

      await act(async () => {
        await result.current.showNotification({
          title: "Test",
          body: "Test",
        });
      });

      expect(MockNotification.instances).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith("[Notifications] Permission not granted");

      consoleWarnSpy.mockRestore();
    });

    it("should use custom icon", async () => {
      grantPermission();

      const { result } = renderHook(() => useBrowserNotifications());

      await act(async () => {
        await result.current.showNotification({
          title: "Test",
          body: "Test",
          icon: "/custom-icon.png",
        });
      });

      expect(MockNotification.instances[0].options.icon).toBe("/custom-icon.png");
    });

    it("should default to favicon when no icon provided", async () => {
      grantPermission();

      const { result } = renderHook(() => useBrowserNotifications());

      await act(async () => {
        await result.current.showNotification({
          title: "Test",
          body: "Test",
        });
      });

      expect(MockNotification.instances[0].options.icon).toBe("/favicon.ico");
    });

    it("should handle click event", async () => {
      grantPermission();
      const onClickMock = jest.fn();
      const windowFocusSpy = jest.spyOn(window, "focus").mockImplementation();

      const { result } = renderHook(() => useBrowserNotifications());

      await act(async () => {
        await result.current.showNotification({
          title: "Test",
          body: "Test",
          onClick: onClickMock,
        });
      });

      const notification = MockNotification.instances[0];
      notification.onclick?.();

      expect(windowFocusSpy).toHaveBeenCalled();
      expect(onClickMock).toHaveBeenCalled();
      expect(MockNotification.closedInstances).toContain(notification);

      windowFocusSpy.mockRestore();
    });

    it("should auto-close after 10 seconds when not requiring interaction", async () => {
      grantPermission();

      const { result } = renderHook(() => useBrowserNotifications());

      await act(async () => {
        await result.current.showNotification({
          title: "Test",
          body: "Test",
          requireInteraction: false,
        });
      });

      expect(MockNotification.closedInstances).toHaveLength(0);

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(MockNotification.closedInstances).toHaveLength(1);
    });

    it("should not auto-close when requiring interaction", async () => {
      grantPermission();

      const { result } = renderHook(() => useBrowserNotifications());

      await act(async () => {
        await result.current.showNotification({
          title: "Test",
          body: "Test",
          requireInteraction: true,
        });
      });

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(MockNotification.closedInstances).toHaveLength(0);
    });

    it("should handle notification error", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      // Make Notification constructor throw
      const OriginalMockNotification = MockNotification;
      (global as any).Notification = class {
        static permission = "granted";
        constructor() {
          throw new Error("Notification error");
        }
      };

      const { result } = renderHook(() => useBrowserNotifications());

      await act(async () => {
        await result.current.showNotification({
          title: "Test",
          body: "Test",
        });
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Notifications] Failed to show:",
        expect.any(Error),
      );

      (global as any).Notification = OriginalMockNotification;
      consoleErrorSpy.mockRestore();
    });
  });

  describe("useGeofenceNotifications", () => {
    it("should handle geofence arrival event", async () => {
      grantPermission();

      const { result } = renderHook(() => useGeofenceNotifications());

      await act(async () => {
        await result.current.handleGeofenceEvent({
          technician_name: "John Doe",
          job_id: "job-123",
          event_type: "enter",
          message: "Location: Building A",
        });
      });

      expect(MockNotification.instances).toHaveLength(1);
      expect(MockNotification.instances[0].title).toContain("Arrived");
      expect(MockNotification.instances[0].options.body).toContain("John Doe");
      expect(MockNotification.instances[0].options.body).toContain("arrived at");
      expect(MockNotification.instances[0].options.requireInteraction).toBe(true);
    });

    it("should handle geofence departure event", async () => {
      grantPermission();

      const { result } = renderHook(() => useGeofenceNotifications());

      await act(async () => {
        await result.current.handleGeofenceEvent({
          technician_name: "John Doe",
          job_id: "job-123",
          event_type: "exit",
          message: "Location: Building A",
        });
      });

      expect(MockNotification.instances).toHaveLength(1);
      expect(MockNotification.instances[0].title).toContain("Departed");
      expect(MockNotification.instances[0].options.body).toContain("left");
      expect(MockNotification.instances[0].options.requireInteraction).toBe(false);
    });

    it("should not show when disabled", async () => {
      const { result } = renderHook(() => useGeofenceNotifications(false));

      await act(async () => {
        await result.current.handleGeofenceEvent({
          technician_name: "John Doe",
          job_id: "job-123",
          event_type: "enter",
          message: "Test",
        });
      });

      expect(MockNotification.instances).toHaveLength(0);
    });
  });

  describe("useJobNotifications", () => {
    it("should handle job status change to completed", async () => {
      grantPermission();

      const { result } = renderHook(() => useJobNotifications());

      await act(async () => {
        await result.current.handleJobStatusChange({
          job_id: "job-123",
          job_title: "Install Fiber",
          old_status: "running",
          new_status: "completed",
        });
      });

      expect(MockNotification.instances).toHaveLength(1);
      expect(MockNotification.instances[0].title).toContain("COMPLETED");
      expect(MockNotification.instances[0].options.body).toContain("Install Fiber");
      expect(MockNotification.instances[0].options.requireInteraction).toBe(false);
    });

    it("should handle job status change to failed", async () => {
      grantPermission();

      const { result } = renderHook(() => useJobNotifications());

      await act(async () => {
        await result.current.handleJobStatusChange({
          job_id: "job-123",
          job_title: "Install Fiber",
          old_status: "running",
          new_status: "failed",
        });
      });

      expect(MockNotification.instances).toHaveLength(1);
      expect(MockNotification.instances[0].title).toContain("FAILED");
      expect(MockNotification.instances[0].options.requireInteraction).toBe(true);
    });

    it("should use correct emojis for different statuses", async () => {
      const statuses = [
        { status: "pending", emoji: "⏳" },
        { status: "assigned", emoji: "👤" },
        { status: "running", emoji: "🔧" },
        { status: "completed", emoji: "✅" },
        { status: "failed", emoji: "❌" },
        { status: "cancelled", emoji: "🚫" },
      ];

      for (const { status, emoji } of statuses) {
        MockNotification.reset();
        grantPermission();

        const { result } = renderHook(() => useJobNotifications());

        await act(async () => {
          await result.current.handleJobStatusChange({
            job_id: "job-123",
            job_title: "Test Job",
            old_status: "pending",
            new_status: status,
          });
        });

        expect(MockNotification.instances[0].title).toContain(emoji);
      }
    });

    it("should not show when disabled", async () => {
      const { result } = renderHook(() => useJobNotifications(false));

      await act(async () => {
        await result.current.handleJobStatusChange({
          job_id: "job-123",
          job_title: "Test",
          old_status: "pending",
          new_status: "completed",
        });
      });

      expect(MockNotification.instances).toHaveLength(0);
    });
  });

  describe("useTechnicianNotifications", () => {
    it("should handle technician status change", async () => {
      grantPermission();

      const { result } = renderHook(() => useTechnicianNotifications());

      await act(async () => {
        await result.current.handleTechnicianStatusChange({
          technician_id: "tech-123",
          technician_name: "John Doe",
          old_status: "available",
          new_status: "on_job",
        });
      });

      expect(MockNotification.instances).toHaveLength(1);
      expect(MockNotification.instances[0].title).toContain("John Doe");
      expect(MockNotification.instances[0].options.body).toContain("available → on_job");
      expect(MockNotification.instances[0].options.requireInteraction).toBe(false);
    });

    it("should use correct emojis for technician statuses", async () => {
      const statuses = [
        { status: "available", emoji: "✅" },
        { status: "on_job", emoji: "🔧" },
        { status: "on_break", emoji: "☕" },
        { status: "off_duty", emoji: "🏠" },
        { status: "unavailable", emoji: "❌" },
      ];

      for (const { status, emoji } of statuses) {
        MockNotification.reset();
        grantPermission();

        const { result } = renderHook(() => useTechnicianNotifications());

        await act(async () => {
          await result.current.handleTechnicianStatusChange({
            technician_id: "tech-123",
            technician_name: "John Doe",
            old_status: "available",
            new_status: status,
          });
        });

        expect(MockNotification.instances[0].title).toContain(emoji);
      }
    });

    it("should not show when disabled", async () => {
      const { result } = renderHook(() => useTechnicianNotifications(false));

      await act(async () => {
        await result.current.handleTechnicianStatusChange({
          technician_id: "tech-123",
          technician_name: "John Doe",
          old_status: "available",
          new_status: "on_job",
        });
      });

      expect(MockNotification.instances).toHaveLength(0);
    });
  });
});
