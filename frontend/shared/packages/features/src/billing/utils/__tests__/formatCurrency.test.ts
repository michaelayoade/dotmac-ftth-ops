/**
 * Unit tests for formatCurrency utility
 */

import { describe, it, expect } from "vitest";

import { formatCurrency } from "../../utils";

describe("formatCurrency", () => {
  it("should format positive numbers correctly", () => {
    // Function expects amounts in cents (minor units)
    expect(formatCurrency(10000)).toBe("$100.00"); // 10000 cents = $100
    expect(formatCurrency(123456)).toBe("$1,234.56"); // 123456 cents = $1234.56
  });

  it("should format zero correctly", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("should format negative numbers correctly", () => {
    // Negative amounts in cents
    expect(formatCurrency(-10000)).toBe("-$100.00"); // -10000 cents = -$100
  });

  it("should handle decimal places", () => {
    // Amounts in cents
    expect(formatCurrency(9999)).toBe("$99.99"); // 9999 cents = $99.99
    expect(formatCurrency(10000)).toBe("$100.00"); // 10000 cents = $100.00
  });
});
