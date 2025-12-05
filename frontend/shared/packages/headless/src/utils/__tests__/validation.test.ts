/**
 * Validation Utilities Tests
 */

import {
  sanitizeInput,
  validateInput,
  validateFormData,
  createRateLimit,
  VALIDATION_PATTERNS,
  COMMON_SCHEMAS,
} from "../validation";

describe("sanitizeInput", () => {
  describe("text type", () => {
    it("sanitizes plain text", () => {
      const input = "<script>alert(1)</script>Hello";
      const result = sanitizeInput(input, "text");

      expect(result).not.toContain("<script>");
      expect(result).toContain("Hello");
    });

    it("trims whitespace", () => {
      expect(sanitizeInput("  hello  ", "text")).toBe("hello");
    });

    it("handles null/undefined", () => {
      expect(sanitizeInput(null, "text")).toBe("");
      expect(sanitizeInput(undefined, "text")).toBe("");
    });

    it("respects maxLength option", () => {
      const input = "This is a long string";
      const result = sanitizeInput(input, "text", { maxLength: 10 });

      expect(result.length).toBeLessThanOrEqual(10);
    });
  });

  describe("email type", () => {
    it("sanitizes email addresses", () => {
      expect(sanitizeInput("  USER@EXAMPLE.COM  ", "email")).toBe("user@example.com");
    });

    it("returns empty for invalid emails", () => {
      expect(sanitizeInput("not-an-email", "email")).toBe("");
    });
  });

  describe("phone type", () => {
    it("removes non-phone characters", () => {
      const result = sanitizeInput("+1 (555) 123-4567", "phone");

      expect(result).toMatch(/^[\d+\-\s()]+$/);
    });

    it("preserves valid phone characters", () => {
      const result = sanitizeInput("+1-555-123-4567", "phone");

      expect(result).toContain("+");
      expect(result).toContain("-");
    });
  });

  describe("url type", () => {
    it("removes dangerous protocols", () => {
      expect(sanitizeInput("javascript:alert(1)", "url")).not.toContain("javascript:");
      expect(sanitizeInput("data:text/html", "url")).not.toContain("data:");
    });

    it("allows safe URLs", () => {
      const url = "https://example.com/path";
      expect(sanitizeInput(url, "url")).toBe(url);
    });
  });

  describe("html type", () => {
    it("sanitizes HTML by default", () => {
      const input = "<script>alert(1)</script><p>Hello</p>";
      const result = sanitizeInput(input, "html");

      expect(result).not.toContain("<script>");
    });

    it("allows HTML when allowHTML is true", () => {
      const input = "<p>Hello</p>";
      const result = sanitizeInput(input, "html", { allowHTML: true });

      expect(result).toContain("<p>");
    });
  });

  describe("alphanumeric type", () => {
    it("allows only alphanumeric and safe characters", () => {
      const input = "Hello World! 123 @#$%";
      const result = sanitizeInput(input, "alphanumeric");

      expect(result).toContain("Hello");
      expect(result).toContain("World");
      expect(result).toContain("123");
      expect(result).not.toContain("@");
      expect(result).not.toContain("#");
    });
  });
});

describe("validateInput", () => {
  describe("required validation", () => {
    it("fails for empty required fields", () => {
      const result = validateInput("", "text", { required: true });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("required");
    });

    it("passes for non-empty required fields", () => {
      const result = validateInput("value", "text", { required: true });

      expect(result.isValid).toBe(true);
    });

    it("passes for empty non-required fields", () => {
      const result = validateInput("", "text", { required: false });

      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe("");
    });
  });

  describe("length validation", () => {
    it("fails for values below minLength", () => {
      const result = validateInput("ab", "text", { minLength: 3 });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("at least 3");
    });

    it("truncates values above maxLength during sanitization", () => {
      // The validateInput function sanitizes first (which truncates), then validates
      // So the sanitized value will be within maxLength
      const result = validateInput("abcdefghij", "text", { maxLength: 5 });

      // After sanitization, the value is truncated to 5 chars, so it passes
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue?.length).toBeLessThanOrEqual(5);
    });

    it("passes for values within length range", () => {
      const result = validateInput("hello", "text", { minLength: 3, maxLength: 10 });

      expect(result.isValid).toBe(true);
    });
  });

  describe("pattern validation", () => {
    it("fails when pattern does not match", () => {
      const result = validateInput("abc123", "text", { pattern: /^\d+$/ });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid format");
    });

    it("passes when pattern matches", () => {
      const result = validateInput("12345", "text", { pattern: /^\d+$/ });

      expect(result.isValid).toBe(true);
    });
  });

  describe("email validation", () => {
    it("validates email format", () => {
      expect(validateInput("user@example.com", "email").isValid).toBe(true);
      expect(validateInput("invalid-email", "email").isValid).toBe(false);
      expect(validateInput("user@", "email").isValid).toBe(false);
    });

    it("returns sanitized email", () => {
      const result = validateInput("  USER@EXAMPLE.COM  ", "email");

      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe("user@example.com");
    });
  });

  describe("phone validation", () => {
    it("validates phone format", () => {
      expect(validateInput("+1-555-123-4567", "phone").isValid).toBe(true);
      expect(validateInput("abc", "phone").isValid).toBe(false);
    });
  });

  describe("url validation", () => {
    it("validates URL format", () => {
      expect(validateInput("https://example.com", "url").isValid).toBe(true);
      expect(validateInput("not-a-url", "url").isValid).toBe(false);
    });
  });

  describe("password validation", () => {
    it("requires minimum length", () => {
      const result = validateInput("short", "password");

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("8 characters");
    });

    it("requires uppercase, lowercase, and numeric", () => {
      const result = validateInput("alllowercase123", "password");

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("uppercase");
    });

    it("passes for valid passwords", () => {
      const result = validateInput("ValidPass123", "password");

      expect(result.isValid).toBe(true);
    });
  });

  describe("sanitization option", () => {
    it("sanitizes by default", () => {
      const result = validateInput("<script>alert(1)</script>test", "text");

      expect(result.sanitizedValue).not.toContain("<script>");
    });

    it("skips sanitization when sanitize is false", () => {
      const result = validateInput("<b>bold</b>", "text", { sanitize: false });

      expect(result.sanitizedValue).toContain("<b>");
    });
  });
});

describe("validateFormData", () => {
  it("validates all fields in schema", () => {
    const data = {
      email: "user@example.com",
      name: "John Doe",
    };

    const schema = {
      email: { type: "email", required: true },
      name: { type: "text", required: true, minLength: 2 },
    };

    const result = validateFormData(data, schema);

    expect(result.isValid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
    expect(result.sanitizedData.email).toBe("user@example.com");
    expect(result.sanitizedData.name).toBe("John Doe");
  });

  it("collects all validation errors", () => {
    const data = {
      email: "invalid",
      name: "J",
    };

    const schema = {
      email: { type: "email", required: true },
      name: { type: "text", required: true, minLength: 2 },
    };

    const result = validateFormData(data, schema);

    expect(result.isValid).toBe(false);
    expect(result.errors.email).toBeDefined();
    expect(result.errors.name).toBeDefined();
  });

  it("handles missing required fields", () => {
    const data = {};

    const schema = {
      email: { type: "email", required: true },
    };

    const result = validateFormData(data, schema);

    expect(result.isValid).toBe(false);
    expect(result.errors.email).toContain("required");
  });
});

describe("createRateLimit", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("allows requests under the limit", async () => {
    const limiter = createRateLimit({
      windowMs: 60000,
      maxRequests: 5,
    });

    const result = await limiter.checkLimit("user-1");

    expect(result.allowed).toBe(true);
    expect(result.remainingRequests).toBe(4);
  });

  it("blocks requests over the limit", async () => {
    const limiter = createRateLimit({
      windowMs: 60000,
      maxRequests: 3,
    });

    await limiter.checkLimit("user-1");
    await limiter.checkLimit("user-1");
    await limiter.checkLimit("user-1");

    const result = await limiter.checkLimit("user-1");

    expect(result.allowed).toBe(false);
    expect(result.remainingRequests).toBe(0);
  });

  it("resets after time window", async () => {
    const limiter = createRateLimit({
      windowMs: 1000,
      maxRequests: 2,
    });

    await limiter.checkLimit("user-1");
    await limiter.checkLimit("user-1");

    // Advance time past the window
    jest.advanceTimersByTime(1100);

    const result = await limiter.checkLimit("user-1");

    expect(result.allowed).toBe(true);
    expect(result.remainingRequests).toBe(1);
  });

  it("tracks limits per key", async () => {
    const limiter = createRateLimit({
      windowMs: 60000,
      maxRequests: 2,
    });

    await limiter.checkLimit("user-1");
    await limiter.checkLimit("user-1");

    const user1Result = await limiter.checkLimit("user-1");
    const user2Result = await limiter.checkLimit("user-2");

    expect(user1Result.allowed).toBe(false);
    expect(user2Result.allowed).toBe(true);
  });

  it("clears limit for specific key", async () => {
    const limiter = createRateLimit({
      windowMs: 60000,
      maxRequests: 1,
    });

    await limiter.checkLimit("user-1");
    const blockedResult = await limiter.checkLimit("user-1");

    expect(blockedResult.allowed).toBe(false);

    await limiter.clearLimit("user-1");

    const clearedResult = await limiter.checkLimit("user-1");

    expect(clearedResult.allowed).toBe(true);
  });
});

describe("VALIDATION_PATTERNS", () => {
  it("validates emails correctly", () => {
    expect(VALIDATION_PATTERNS.email.test("user@example.com")).toBe(true);
    expect(VALIDATION_PATTERNS.email.test("invalid")).toBe(false);
  });

  it("validates phone numbers correctly", () => {
    expect(VALIDATION_PATTERNS.phone.test("+1-555-123-4567")).toBe(true);
    expect(VALIDATION_PATTERNS.phone.test("123")).toBe(false);
  });

  it("validates passwords correctly", () => {
    expect(VALIDATION_PATTERNS.password.test("ValidPass1")).toBe(true);
    expect(VALIDATION_PATTERNS.password.test("weak")).toBe(false);
  });

  it("validates alphanumeric correctly", () => {
    expect(VALIDATION_PATTERNS.alphanumeric.test("abc123")).toBe(true);
    expect(VALIDATION_PATTERNS.alphanumeric.test("abc 123")).toBe(false);
  });
});

describe("COMMON_SCHEMAS", () => {
  it("has login schema", () => {
    expect(COMMON_SCHEMAS.login.email).toBeDefined();
    expect(COMMON_SCHEMAS.login.password).toBeDefined();
    expect(COMMON_SCHEMAS.login.email.required).toBe(true);
    expect(COMMON_SCHEMAS.login.password.required).toBe(true);
  });

  it("has registration schema", () => {
    expect(COMMON_SCHEMAS.registration.email).toBeDefined();
    expect(COMMON_SCHEMAS.registration.password).toBeDefined();
    expect(COMMON_SCHEMAS.registration.name).toBeDefined();
    expect(COMMON_SCHEMAS.registration.phone).toBeDefined();
  });

  it("has profile schema", () => {
    expect(COMMON_SCHEMAS.profile.name).toBeDefined();
    expect(COMMON_SCHEMAS.profile.phone).toBeDefined();
    expect(COMMON_SCHEMAS.profile.address).toBeDefined();
  });

  it("validates login form with schema", () => {
    const validData = {
      email: "user@example.com",
      password: "ValidPass123",
    };

    const result = validateFormData(validData, COMMON_SCHEMAS.login);

    expect(result.isValid).toBe(true);
  });

  it("rejects invalid login form with schema", () => {
    const invalidData = {
      email: "invalid",
      password: "short",
    };

    const result = validateFormData(invalidData, COMMON_SCHEMAS.login);

    expect(result.isValid).toBe(false);
    expect(result.errors.email).toBeDefined();
    expect(result.errors.password).toBeDefined();
  });
});
