/**
 * Tests for portal utilities
 * Tests portal type detection and access control
 */

import { getPortalType, portalAllows } from "../portal";

describe("portal", () => {
  describe("getPortalType", () => {
    it("should return ispAdmin for ISP Operations App", () => {
      expect(getPortalType()).toBe("ispAdmin");
    });
  });

  describe("portalAllows", () => {
    it("should allow all portals when allowedPortals is undefined", () => {
      expect(portalAllows(undefined)).toBe(true);
    });

    it("should allow all portals when allowedPortals is empty", () => {
      expect(portalAllows([])).toBe(true);
    });

    it("should allow portal when it is in the allowed list", () => {
      expect(portalAllows(["ispAdmin"])).toBe(true);
      expect(portalAllows(["ispAdmin", "platformAdmin"])).toBe(true);
    });

    it("should deny portal when it is not in the allowed list", () => {
      expect(portalAllows(["platformAdmin"])).toBe(false);
      expect(portalAllows(["customerPortal"])).toBe(false);
    });

    it("should use provided currentPortal parameter", () => {
      expect(portalAllows(["platformAdmin"], "platformAdmin")).toBe(true);
      expect(portalAllows(["ispAdmin"], "platformAdmin")).toBe(false);
    });

    it("should auto-detect portal when currentPortal not provided", () => {
      // Should use getPortalType() which returns ispAdmin
      expect(portalAllows(["ispAdmin"])).toBe(true);
    });

    it("should handle multiple allowed portals", () => {
      const allowedPortals: ("ispAdmin" | "platformAdmin" | "customerPortal")[] = [
        "ispAdmin",
        "platformAdmin",
        "customerPortal",
      ];

      expect(portalAllows(allowedPortals, "ispAdmin")).toBe(true);
      expect(portalAllows(allowedPortals, "platformAdmin")).toBe(true);
      expect(portalAllows(allowedPortals, "customerPortal")).toBe(true);
    });

    it("should handle single portal restriction", () => {
      expect(portalAllows(["customerPortal"], "customerPortal")).toBe(true);
      expect(portalAllows(["customerPortal"], "ispAdmin")).toBe(false);
    });
  });

  describe("Type Safety", () => {
    it("should work with PortalType values", () => {
      const allowedPortals: Array<"ispAdmin" | "platformAdmin" | "customerPortal"> = ["ispAdmin"];
      expect(portalAllows(allowedPortals)).toBe(true);
    });

    it("should handle null allowedPortals gracefully", () => {
      expect(portalAllows(null as any)).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty string portal", () => {
      expect(portalAllows(["ispAdmin"], "" as any)).toBe(false);
    });

    it("should be case-sensitive", () => {
      expect(portalAllows(["ISPADMIN"] as any)).toBe(false);
      expect(portalAllows(["IspAdmin"] as any)).toBe(false);
    });

    it("should handle array with single element", () => {
      expect(portalAllows(["ispAdmin"])).toBe(true);
    });

    it("should handle large arrays efficiently", () => {
      const manyPortals = Array(1000).fill("otherPortal");
      manyPortals.push("ispAdmin");

      expect(portalAllows(manyPortals as any)).toBe(true);
    });
  });
});
