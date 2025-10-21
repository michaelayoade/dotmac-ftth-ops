/**
 * @jest-environment node
 */

import { generateNonce, generateCSP, extractNonce, isValidNonce } from "../csp";

describe("CSP Utilities", () => {
  describe("generateNonce", () => {
    it("should generate a valid base64 nonce", () => {
      const nonce = generateNonce();
      expect(nonce).toBeDefined();
      expect(typeof nonce).toBe("string");
      // Base64 encoded 16 bytes = 24 chars with padding
      expect(nonce.length).toBe(24);
      expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    });

    it("should generate unique nonces", () => {
      const nonces = new Set();
      for (let i = 0; i < 100; i++) {
        nonces.add(generateNonce());
      }
      // All 100 nonces should be unique
      expect(nonces.size).toBe(100);
    });

    it("should generate cryptographically random nonces", () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      expect(nonce1).not.toBe(nonce2);
    });
  });

  describe("generateCSP", () => {
    it("should generate CSP with nonce in production", () => {
      const nonce = "test-nonce-123456789012==";
      const csp = generateCSP(nonce, false);

      expect(csp).toContain(`script-src 'self' 'nonce-${nonce}'`);
      expect(csp).not.toContain("unsafe-eval");
      expect(csp).toContain(`default-src 'self'`);
      expect(csp).toContain(`frame-ancestors 'none'`);
      expect(csp).toContain(`object-src 'none'`);
      expect(csp).toContain(`upgrade-insecure-requests`);
    });

    it("should include unsafe-eval in development", () => {
      const nonce = "test-nonce-123456789012==";
      const csp = generateCSP(nonce, true);

      expect(csp).toContain(`script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`);
    });

    it("should include all required directives", () => {
      const nonce = "test-nonce";
      const csp = generateCSP(nonce);

      const requiredDirectives = [
        "default-src",
        "script-src",
        "style-src",
        "font-src",
        "img-src",
        "connect-src",
        "frame-ancestors",
        "base-uri",
        "form-action",
        "object-src",
        "upgrade-insecure-requests",
      ];

      requiredDirectives.forEach((directive) => {
        expect(csp).toContain(directive);
      });
    });

    it("should properly format the CSP string", () => {
      const nonce = "test-nonce";
      const csp = generateCSP(nonce);

      // Should be semicolon-separated directives
      const directives = csp.split("; ");
      expect(directives.length).toBeGreaterThan(5);

      // Each directive should have a name and value
      directives.forEach((directive) => {
        expect(directive).toMatch(/^[a-z-]+ /);
      });
    });
  });

  describe("extractNonce", () => {
    it("should extract nonce from CSP header", () => {
      const nonce = "test-nonce-123456789012==";
      const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'unsafe-eval'; style-src 'self'`;

      const extracted = extractNonce(csp);
      expect(extracted).toBe(nonce);
    });

    it("should return null if no nonce found", () => {
      const csp = `default-src 'self'; script-src 'self' 'unsafe-inline'`;

      const extracted = extractNonce(csp);
      expect(extracted).toBeNull();
    });

    it("should handle multiple nonces (return first)", () => {
      const nonce1 = "first-nonce";
      const nonce2 = "second-nonce";
      const csp = `script-src 'self' 'nonce-${nonce1}'; style-src 'nonce-${nonce2}'`;

      const extracted = extractNonce(csp);
      expect(extracted).toBe(nonce1);
    });
  });

  describe("isValidNonce", () => {
    it("should validate correct nonce format", () => {
      const validNonce = generateNonce();
      expect(isValidNonce(validNonce)).toBe(true);
    });

    it("should reject invalid nonce formats", () => {
      const invalidNonces = [
        "too-short",
        "invalid-characters!@#",
        "wronglengthbutvalidchars",
        "1234567890123456789012", // No padding
        "12345678901234567890123=", // Wrong padding
        "", // Empty
      ];

      invalidNonces.forEach((nonce) => {
        expect(isValidNonce(nonce)).toBe(false);
      });
    });

    it("should accept standard base64 nonce", () => {
      // Standard 16-byte nonce in base64
      const nonce = "abcdefghijklmnopqrstuv==";
      expect(isValidNonce(nonce)).toBe(true);
    });
  });

  describe("CSP Security", () => {
    it("should not allow unsafe-inline for scripts", () => {
      const nonce = generateNonce();
      const csp = generateCSP(nonce, false);

      expect(csp).not.toContain("'unsafe-inline'");
    });

    it("should block object and embed tags", () => {
      const nonce = generateNonce();
      const csp = generateCSP(nonce);

      expect(csp).toContain("object-src 'none'");
    });

    it("should prevent framing attacks", () => {
      const nonce = generateNonce();
      const csp = generateCSP(nonce);

      expect(csp).toContain("frame-ancestors 'none'");
    });

    it("should restrict form actions", () => {
      const nonce = generateNonce();
      const csp = generateCSP(nonce);

      expect(csp).toContain("form-action 'self'");
    });

    it("should upgrade insecure requests", () => {
      const nonce = generateNonce();
      const csp = generateCSP(nonce);

      expect(csp).toContain("upgrade-insecure-requests");
    });
  });
});
