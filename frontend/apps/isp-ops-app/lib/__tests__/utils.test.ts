/**
 * Tests for utils utilities
 * Tests utility functions including formatters, debounce, and ID generation
 */

import { cn, formatCurrency, formatDate, truncate, debounce, generateId } from "../utils";

describe("utils", () => {
  describe("cn", () => {
    it("should merge class names", () => {
      const result = cn("foo", "bar");
      expect(result).toBe("foo bar");
    });

    it("should handle conditional classes", () => {
      const result = cn("foo", false && "bar", "baz");
      expect(result).toBe("foo baz");
    });

    it("should handle Tailwind class conflicts", () => {
      const result = cn("px-2 py-1", "px-4");
      // twMerge should prefer the last conflicting class
      expect(result).toContain("px-4");
      expect(result).not.toContain("px-2");
    });

    it("should handle empty inputs", () => {
      expect(cn()).toBe("");
      expect(cn("")).toBe("");
      expect(cn(null, undefined, false)).toBe("");
    });

    it("should handle arrays of classes", () => {
      const result = cn(["foo", "bar"], "baz");
      expect(result).toBe("foo bar baz");
    });

    it("should handle objects with boolean values", () => {
      const result = cn({
        foo: true,
        bar: false,
        baz: true,
      });
      expect(result).toBe("foo baz");
    });
  });

  describe("formatCurrency", () => {
    it("should format USD currency by default", () => {
      const result = formatCurrency(1234.56);
      expect(result).toBe("$1,234.56");
    });

    it("should format with custom currency", () => {
      const result = formatCurrency(1234.56, "EUR");
      expect(result).toContain("1,234.56");
      expect(result).toMatch(/€|EUR/);
    });

    it("should handle zero", () => {
      const result = formatCurrency(0);
      expect(result).toBe("$0.00");
    });

    it("should handle negative numbers", () => {
      const result = formatCurrency(-1234.56);
      expect(result).toContain("-");
      expect(result).toContain("1,234.56");
    });

    it("should handle large numbers", () => {
      const result = formatCurrency(1234567.89);
      expect(result).toBe("$1,234,567.89");
    });

    it("should round to 2 decimal places", () => {
      const result = formatCurrency(10.999);
      expect(result).toBe("$11.00");
    });
  });

  describe("formatDate", () => {
    it("should format date in short format by default", () => {
      const date = new Date("2024-01-15");
      const result = formatDate(date);
      expect(result).toMatch(/1\/15\/2024|15\/1\/2024/);
    });

    it("should format date string", () => {
      const result = formatDate("2024-01-15", "short");
      expect(result).toMatch(/1\/15\/2024|15\/1\/2024/);
    });

    it("should format in long format", () => {
      const date = new Date("2024-01-15");
      const result = formatDate(date, "long");
      expect(result).toContain("January");
      expect(result).toContain("15");
      expect(result).toContain("2024");
    });

    it("should format time only", () => {
      const date = new Date("2024-01-15T14:30:00");
      const result = formatDate(date, "time");
      expect(result).toMatch(/2:30|14:30/);
    });

    it("should fallback to locale string for unknown format", () => {
      const date = new Date("2024-01-15");
      const result = formatDate(date, "unknown" as any);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle Date objects", () => {
      const date = new Date("2024-01-15");
      const result = formatDate(date, "short");
      expect(typeof result).toBe("string");
    });

    it("should handle ISO date strings", () => {
      const result = formatDate("2024-01-15T10:30:00Z", "short");
      expect(typeof result).toBe("string");
    });
  });

  describe("truncate", () => {
    it("should truncate text longer than length", () => {
      const text = "This is a very long text that should be truncated";
      const result = truncate(text, 20);
      expect(result).toBe("This is a very long ...");
      expect(result.length).toBe(23); // 20 chars + "..."
    });

    it("should not truncate text shorter than length", () => {
      const text = "Short text";
      const result = truncate(text, 50);
      expect(result).toBe("Short text");
    });

    it("should use default length of 50", () => {
      const text = "a".repeat(60);
      const result = truncate(text);
      expect(result.length).toBe(53); // 50 + "..."
    });

    it("should handle exact length", () => {
      const text = "a".repeat(50);
      const result = truncate(text, 50);
      expect(result).toBe(text);
    });

    it("should handle empty string", () => {
      const result = truncate("", 10);
      expect(result).toBe("");
    });

    it("should handle single character", () => {
      const result = truncate("a", 0);
      expect(result).toBe("...");
    });
  });

  describe("debounce", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it("should debounce function calls", () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced();
      debounced();

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should pass arguments to debounced function", () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced("arg1", "arg2");
      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith("arg1", "arg2");
    });

    it("should reset timer on subsequent calls", () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      jest.advanceTimersByTime(50);
      debounced();
      jest.advanceTimersByTime(50);

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should handle rapid calls", () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      for (let i = 0; i < 10; i++) {
        debounced();
        jest.advanceTimersByTime(10);
      }

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should allow multiple invocations after delay", () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);

      debounced();
      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe("generateId", () => {
    it("should generate random ID", () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe("string");
      expect(id1.length).toBeGreaterThan(10);
    });

    it("should generate ID with prefix", () => {
      const id = generateId("user");
      expect(id).toMatch(/^user_/);
    });

    it("should generate unique IDs with same prefix", () => {
      const id1 = generateId("user");
      const id2 = generateId("user");

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^user_/);
      expect(id2).toMatch(/^user_/);
    });

    it("should handle empty prefix", () => {
      const id = generateId("");
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("should include timestamp component", () => {
      const before = Date.now();
      const id = generateId();
      const after = Date.now();

      // ID should contain a base36 timestamp
      expect(id).toMatch(/^[a-z0-9]+_[a-z0-9]+$/);
    });

    it("should generate different IDs in sequence", () => {
      const ids = Array.from({ length: 100 }, () => generateId());
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(100);
    });
  });

  describe("Edge cases", () => {
    it("should handle very large numbers in formatCurrency", () => {
      const result = formatCurrency(999999999999.99);
      expect(result).toContain("999,999,999,999.99");
    });

    it("should handle very small numbers in formatCurrency", () => {
      const result = formatCurrency(0.01);
      expect(result).toBe("$0.01");
    });

    it("should handle invalid date strings gracefully", () => {
      const result = formatDate("invalid-date", "short");
      // Should return "Invalid Date" for invalid dates
      expect(result).toBe("Invalid Date");
    });

    it("should handle zero-length truncate", () => {
      const result = truncate("text", 0);
      expect(result).toBe("...");
    });

    it("should handle negative wait time in debounce", () => {
      jest.useFakeTimers();
      const fn = jest.fn();
      const debounced = debounce(fn, -100);

      debounced();
      jest.advanceTimersByTime(1);

      // Should execute quickly with negative timeout
      expect(fn).toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe("Type safety", () => {
    it("should accept ClassValue types in cn", () => {
      const result = cn("string", ["array"], { object: true }, undefined, null, false);
      expect(typeof result).toBe("string");
    });

    it("should preserve function signature in debounce", () => {
      const fn = (a: string, b: number): string => `${a}-${b}`;
      const debounced = debounce(fn, 100);

      // TypeScript should allow calling with correct types
      debounced("test", 42);
    });
  });
});
