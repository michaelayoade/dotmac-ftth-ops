/**
 * @fileoverview Tests for useAnalytics hook
 */

import { renderHook, act } from "@testing-library/react";
import { useAnalytics, type AnalyticsEvent } from "../index";

describe("useAnalytics", () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("track", () => {
    it("should track events with name only", () => {
      const { result } = renderHook(() => useAnalytics());

      act(() => {
        result.current.track({ name: "page_view" });
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Tracking event:",
        expect.objectContaining({ name: "page_view" }),
      );
    });

    it("should track events with name and properties", () => {
      const { result } = renderHook(() => useAnalytics());

      const event = {
        name: "button_click",
        properties: {
          button_id: "submit",
          page: "/checkout",
        },
      };

      act(() => {
        result.current.track(event);
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Tracking event:",
        expect.objectContaining({
          name: "button_click",
          properties: {
            button_id: "submit",
            page: "/checkout",
          },
        }),
      );
    });

    it("should track events with timestamp", () => {
      const { result } = renderHook(() => useAnalytics());

      const timestamp = new Date("2024-01-01T00:00:00Z");
      const event = {
        name: "user_signup",
        timestamp,
      };

      act(() => {
        result.current.track(event);
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Tracking event:",
        expect.objectContaining({
          name: "user_signup",
          timestamp,
        }),
      );
    });

    it("should handle complex property values", () => {
      const { result } = renderHook(() => useAnalytics());

      const event = {
        name: "purchase",
        properties: {
          items: [
            { id: "1", name: "Product A", price: 29.99 },
            { id: "2", name: "Product B", price: 49.99 },
          ],
          total: 79.98,
          currency: "USD",
          metadata: { coupon: "SAVE10", campaign: "spring_sale" },
        },
      };

      act(() => {
        result.current.track(event);
      });

      expect(consoleLogSpy).toHaveBeenCalledWith("Tracking event:", expect.objectContaining(event));
    });
  });

  describe("identify", () => {
    it("should identify user with ID only", () => {
      const { result } = renderHook(() => useAnalytics());

      act(() => {
        result.current.identify("user-123");
      });

      expect(consoleLogSpy).toHaveBeenCalledWith("Identifying user:", "user-123", undefined);
    });

    it("should identify user with ID and traits", () => {
      const { result } = renderHook(() => useAnalytics());

      const traits = {
        email: "user@example.com",
        name: "John Doe",
        plan: "premium",
      };

      act(() => {
        result.current.identify("user-123", traits);
      });

      expect(consoleLogSpy).toHaveBeenCalledWith("Identifying user:", "user-123", traits);
    });

    it("should handle complex trait values", () => {
      const { result } = renderHook(() => useAnalytics());

      const traits = {
        email: "user@example.com",
        profile: {
          firstName: "John",
          lastName: "Doe",
          age: 30,
        },
        preferences: {
          notifications: true,
          theme: "dark",
        },
        tags: ["premium", "early-adopter"],
      };

      act(() => {
        result.current.identify("user-123", traits);
      });

      expect(consoleLogSpy).toHaveBeenCalledWith("Identifying user:", "user-123", traits);
    });
  });

  describe("hook stability", () => {
    it("should return stable functions across re-renders", () => {
      const { result, rerender } = renderHook(() => useAnalytics());

      const firstTrack = result.current.track;
      const firstIdentify = result.current.identify;

      rerender();

      expect(result.current.track).toBe(firstTrack);
      expect(result.current.identify).toBe(firstIdentify);
    });
  });

  describe("error handling", () => {
    it("should handle undefined properties gracefully", () => {
      const { result } = renderHook(() => useAnalytics());

      expect(() => {
        act(() => {
          const unsafeEvent = { name: "test", properties: undefined } as unknown as AnalyticsEvent;
          result.current.track(unsafeEvent);
        });
      }).not.toThrow();
    });

    it("should handle null traits gracefully", () => {
      const { result } = renderHook(() => useAnalytics());

      expect(() => {
        act(() => {
          result.current.identify("user-123", null as any);
        });
      }).not.toThrow();
    });
  });
});
