import { portalAllows } from "../lib/portal";

describe("portalAllows", () => {
  it("allows when no portals provided", () => {
    expect(portalAllows(undefined, "isp")).toBe(true);
  });

  it("allows base portal access", () => {
    expect(portalAllows(["admin"], "base")).toBe(true);
  });

  it("respects allowed list", () => {
    expect(portalAllows(["admin"], "admin")).toBe(true);
    expect(portalAllows(["admin"], "isp")).toBe(false);
  });
});
