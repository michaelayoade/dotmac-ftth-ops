/**
 * @fileoverview Type tests for notifications package
 */

import type {
  NotificationConfig,
  PortalVariant,
  NotificationType,
  NotificationPriority,
} from "../index";

describe("Notification Types", () => {
  describe("NotificationConfig", () => {
    it("should accept valid notification config", () => {
      const config: NotificationConfig = {
        type: "success",
        title: "Success",
        message: "Operation completed",
      };

      expect(config.type).toBe("success");
      expect(config.title).toBe("Success");
      expect(config.message).toBe("Operation completed");
    });

    it("should accept config with duration", () => {
      const config: NotificationConfig = {
        type: "info",
        title: "Info",
        message: "Information message",
        duration: 5000,
      };

      expect(config.duration).toBe(5000);
    });

    it("should accept all notification types", () => {
      const types: NotificationConfig["type"][] = ["success", "error", "warning", "info"];

      types.forEach((type) => {
        const config: NotificationConfig = {
          type,
          title: "Title",
          message: "Message",
        };

        expect(config.type).toBe(type);
      });
    });
  });

  describe("PortalVariant", () => {
    it("should accept valid portal variants", () => {
      const variants: PortalVariant[] = [
        "admin",
        "customer",
        "reseller",
        "technician",
        "management",
      ];

      variants.forEach((variant) => {
        const value: PortalVariant = variant;
        expect(value).toBe(variant);
      });
    });
  });

  describe("NotificationType", () => {
    it("should accept valid notification types", () => {
      const types: NotificationType[] = ["toast", "alert", "inline"];

      types.forEach((type) => {
        const value: NotificationType = type;
        expect(value).toBe(type);
      });
    });
  });

  describe("NotificationPriority", () => {
    it("should accept valid priority levels", () => {
      const priorities: NotificationPriority[] = ["low", "medium", "high", "critical"];

      priorities.forEach((priority) => {
        const value: NotificationPriority = priority;
        expect(value).toBe(priority);
      });
    });
  });

  describe("Type compatibility", () => {
    it("should allow creating notification with all type combinations", () => {
      const configs: NotificationConfig[] = [
        { type: "success", title: "Success", message: "Done" },
        { type: "error", title: "Error", message: "Failed" },
        { type: "warning", title: "Warning", message: "Be careful" },
        { type: "info", title: "Info", message: "FYI" },
      ];

      expect(configs).toHaveLength(4);
    });

    it("should allow optional duration", () => {
      const withDuration: NotificationConfig = {
        type: "success",
        title: "Title",
        message: "Message",
        duration: 3000,
      };

      const withoutDuration: NotificationConfig = {
        type: "success",
        title: "Title",
        message: "Message",
      };

      expect(withDuration.duration).toBeDefined();
      expect(withoutDuration.duration).toBeUndefined();
    });
  });
});
