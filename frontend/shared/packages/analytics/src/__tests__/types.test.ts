/**
 * @fileoverview Type tests for analytics package
 */

import type { AnalyticsEvent, MetricsData } from "../index";

describe("Analytics Types", () => {
  describe("AnalyticsEvent", () => {
    it("should accept valid event with name only", () => {
      const event: AnalyticsEvent = {
        name: "page_view",
      };

      expect(event.name).toBe("page_view");
      expect(event.properties).toBeUndefined();
      expect(event.timestamp).toBeUndefined();
    });

    it("should accept event with properties", () => {
      const event: AnalyticsEvent = {
        name: "button_click",
        properties: {
          button_id: "submit",
          page: "/checkout",
        },
      };

      expect(event.properties).toEqual({
        button_id: "submit",
        page: "/checkout",
      });
    });

    it("should accept event with timestamp", () => {
      const timestamp = new Date();
      const event: AnalyticsEvent = {
        name: "user_action",
        timestamp,
      };

      expect(event.timestamp).toBe(timestamp);
    });

    it("should accept event with all fields", () => {
      const timestamp = new Date();
      const event: AnalyticsEvent = {
        name: "purchase",
        properties: {
          amount: 99.99,
          currency: "USD",
        },
        timestamp,
      };

      expect(event).toEqual({
        name: "purchase",
        properties: {
          amount: 99.99,
          currency: "USD",
        },
        timestamp,
      });
    });

    it("should accept various property types", () => {
      const event: AnalyticsEvent = {
        name: "complex_event",
        properties: {
          string_prop: "value",
          number_prop: 42,
          boolean_prop: true,
          array_prop: [1, 2, 3],
          object_prop: { nested: "value" },
          null_prop: null,
          undefined_prop: undefined,
        },
      };

      expect(event.properties).toBeDefined();
    });
  });

  describe("MetricsData", () => {
    it("should accept metric with value only", () => {
      const metric: MetricsData = {
        value: 100,
      };

      expect(metric.value).toBe(100);
      expect(metric.unit).toBeUndefined();
      expect(metric.tags).toBeUndefined();
    });

    it("should accept metric with unit", () => {
      const metric: MetricsData = {
        value: 512,
        unit: "MB",
      };

      expect(metric.unit).toBe("MB");
    });

    it("should accept metric with tags", () => {
      const metric: MetricsData = {
        value: 1,
        tags: {
          endpoint: "/api/users",
          method: "GET",
        },
      };

      expect(metric.tags).toEqual({
        endpoint: "/api/users",
        method: "GET",
      });
    });

    it("should accept metric with all fields", () => {
      const metric: MetricsData = {
        value: 45.5,
        unit: "ms",
        tags: {
          query_type: "SELECT",
          database: "production",
        },
      };

      expect(metric).toEqual({
        value: 45.5,
        unit: "ms",
        tags: {
          query_type: "SELECT",
          database: "production",
        },
      });
    });

    it("should accept different numeric values", () => {
      const metrics: MetricsData[] = [
        { value: 0 },
        { value: -100 },
        { value: 99.99 },
        { value: 1000000 },
        { value: Number.MAX_SAFE_INTEGER },
      ];

      metrics.forEach((metric) => {
        expect(typeof metric.value).toBe("number");
      });
    });
  });
});
