/**
 * Unit tests for cn() utility function
 * Tests string, object, array, and mixed argument handling
 */

import { cn } from "@/lib/utils";

describe("cn() utility", () => {
  describe("string arguments", () => {
    it("should combine multiple strings", () => {
      expect(cn("foo", "bar", "baz")).toBe("foo bar baz");
    });

    it("should filter out empty strings", () => {
      expect(cn("foo", "", "bar")).toBe("foo bar");
    });

    it("should handle single string", () => {
      expect(cn("foo")).toBe("foo");
    });
  });

  describe("object arguments", () => {
    it("should include classes when value is true", () => {
      expect(cn({ foo: true, bar: true })).toBe("foo bar");
    });

    it("should exclude classes when value is false", () => {
      expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
    });

    it("should handle empty object", () => {
      expect(cn({})).toBe("");
    });
  });

  describe("array arguments", () => {
    it("should flatten and combine array of strings", () => {
      expect(cn(["foo", "bar"])).toBe("foo bar");
    });

    it("should handle nested arrays", () => {
      expect(cn(["foo", ["bar", "baz"]])).toBe("foo bar baz");
    });

    it("should filter out falsy values in arrays", () => {
      expect(cn(["foo", null, "bar", undefined, "baz"])).toBe("foo bar baz");
    });
  });

  describe("mixed arguments", () => {
    it("should combine strings and objects", () => {
      expect(cn("foo", { bar: true, baz: false })).toBe("foo bar");
    });

    it("should combine strings, objects, and arrays", () => {
      expect(cn("foo", { bar: true }, ["baz", "qux"])).toBe("foo bar baz qux");
    });

    it("should handle complex nested structures", () => {
      expect(
        cn(
          "base-class",
          {
            active: true,
            disabled: false,
            "has-error": true,
          },
          ["extra-class", { nested: true }],
        ),
      ).toBe("base-class active has-error extra-class nested");
    });
  });

  describe("edge cases", () => {
    it("should handle no arguments", () => {
      expect(cn()).toBe("");
    });

    it("should handle all falsy values", () => {
      // Note: 0 is converted to string "0" as it's a valid class name
      expect(cn(null, undefined, false, "")).toBe("");
    });

    it("should handle number arguments", () => {
      expect(cn("foo", 123)).toBe("foo 123");
    });

    it("should handle boolean values directly", () => {
      expect(cn("foo", true, false, "bar")).toBe("foo bar");
    });
  });

  describe("real-world use cases", () => {
    it("should handle button variants", () => {
      const variant: string = "primary";
      const size: string = "large";
      const disabled = false;

      expect(
        cn("btn", {
          "btn-primary": variant === "primary",
          "btn-secondary": variant === "secondary",
          "btn-lg": size === "large",
          "btn-sm": size === "small",
          "btn-disabled": disabled,
        }),
      ).toBe("btn btn-primary btn-lg");
    });

    it("should handle conditional classes", () => {
      const isActive = true;
      const hasError = false;
      const isLoading = true;

      expect(
        cn("form-input", isActive && "active", hasError && "error", isLoading && "loading"),
      ).toBe("form-input active loading");
    });

    it("should handle Tailwind-style conditional classes", () => {
      const darkMode = true;
      const size: string = "md";

      expect(
        cn(
          "p-4 rounded",
          {
            "bg-white text-black": !darkMode,
            "bg-slate-800 text-white": darkMode,
          },
          size === "sm" && "text-sm",
          size === "md" && "text-base",
          size === "lg" && "text-lg",
        ),
      ).toBe("p-4 rounded bg-slate-800 text-white text-base");
    });
  });
});
