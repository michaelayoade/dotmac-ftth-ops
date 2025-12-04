/**
 * @jest-environment node
 */

import {
  generateSRIHash,
  verifySRIHash,
  generateSRIHashes,
  generateScriptTag,
  generateLinkTag,
  validateSRIInHTML,
} from "../sri";

describe("SRI Utilities", () => {
  describe("generateSRIHash", () => {
    it("should generate SHA-384 hash by default", () => {
      const content = 'console.log("Hello World");';
      const hash = generateSRIHash(content);

      expect(hash).toMatch(/^sha384-[A-Za-z0-9+/]+=*$/);
      expect(hash).toContain("sha384-");
    });

    it("should generate SHA-256 hash when specified", () => {
      const content = 'console.log("Hello World");';
      const hash = generateSRIHash(content, "sha256");

      expect(hash).toMatch(/^sha256-[A-Za-z0-9+/]+=*$/);
      expect(hash).toContain("sha256-");
    });

    it("should generate SHA-512 hash when specified", () => {
      const content = 'console.log("Hello World");';
      const hash = generateSRIHash(content, "sha512");

      expect(hash).toMatch(/^sha512-[A-Za-z0-9+/]+=*$/);
      expect(hash).toContain("sha512-");
    });

    it("should generate consistent hash for same content", () => {
      const content = 'const foo = "bar";';
      const hash1 = generateSRIHash(content);
      const hash2 = generateSRIHash(content);

      expect(hash1).toBe(hash2);
    });

    it("should generate different hashes for different content", () => {
      const content1 = 'const foo = "bar";';
      const content2 = 'const bar = "foo";';

      const hash1 = generateSRIHash(content1);
      const hash2 = generateSRIHash(content2);

      expect(hash1).not.toBe(hash2);
    });

    it("should handle Buffer input", () => {
      const content = Buffer.from('console.log("Hello");', "utf-8");
      const hash = generateSRIHash(content);

      expect(hash).toMatch(/^sha384-[A-Za-z0-9+/]+=*$/);
    });
  });

  describe("verifySRIHash", () => {
    it("should verify valid hash", () => {
      const content = 'console.log("test");';
      const hash = generateSRIHash(content);

      const isValid = verifySRIHash(content, hash);
      expect(isValid).toBe(true);
    });

    it("should reject invalid hash", () => {
      const content = 'console.log("test");';
      const invalidHash = "sha384-invalidhash123";

      const isValid = verifySRIHash(content, invalidHash);
      expect(isValid).toBe(false);
    });

    it("should reject hash for different content", () => {
      const content1 = 'console.log("test1");';
      const content2 = 'console.log("test2");';
      const hash = generateSRIHash(content1);

      const isValid = verifySRIHash(content2, hash);
      expect(isValid).toBe(false);
    });

    it("should verify with different algorithms", () => {
      const content = "const x = 1;";
      const sha256Hash = generateSRIHash(content, "sha256");
      const sha512Hash = generateSRIHash(content, "sha512");

      expect(verifySRIHash(content, sha256Hash)).toBe(true);
      expect(verifySRIHash(content, sha512Hash)).toBe(true);
    });
  });

  describe("generateSRIHashes", () => {
    it("should generate multiple hashes", () => {
      const content = 'console.log("multi");';
      const hashes = generateSRIHashes(content);

      expect(hashes).toContain("sha256-");
      expect(hashes).toContain("sha384-");
      expect(hashes).toContain("sha512-");

      const hashArray = hashes.split(" ");
      expect(hashArray).toHaveLength(3);
    });

    it("should generate specific algorithms only", () => {
      const content = 'console.log("specific");';
      const hashes = generateSRIHashes(content, ["sha256", "sha384"]);

      const hashArray = hashes.split(" ");
      expect(hashArray).toHaveLength(2);
      expect(hashes).toContain("sha256-");
      expect(hashes).toContain("sha384-");
      expect(hashes).not.toContain("sha512-");
    });
  });

  describe("generateScriptTag", () => {
    it("should generate basic script tag with SRI", () => {
      const tag = generateScriptTag("https://example.com/script.js", "sha384-abc123");

      expect(tag).toContain('src="https://example.com/script.js"');
      expect(tag).toContain('integrity="sha384-abc123"');
      expect(tag).toContain('crossorigin="anonymous"');
    });

    it("should include async attribute", () => {
      const tag = generateScriptTag("https://example.com/script.js", "sha384-abc123", {
        async: true,
      });

      expect(tag).toContain("async");
    });

    it("should include defer attribute", () => {
      const tag = generateScriptTag("https://example.com/script.js", "sha384-abc123", {
        defer: true,
      });

      expect(tag).toContain("defer");
    });

    it("should include nonce", () => {
      const tag = generateScriptTag("https://example.com/script.js", "sha384-abc123", {
        nonce: "test-nonce-123",
      });

      expect(tag).toContain('nonce="test-nonce-123"');
    });

    it("should support use-credentials crossorigin", () => {
      const tag = generateScriptTag("https://example.com/script.js", "sha384-abc123", {
        crossorigin: "use-credentials",
      });

      expect(tag).toContain('crossorigin="use-credentials"');
    });
  });

  describe("generateLinkTag", () => {
    it("should generate basic link tag with SRI", () => {
      const tag = generateLinkTag("https://example.com/styles.css", "sha384-def456");

      expect(tag).toContain('rel="stylesheet"');
      expect(tag).toContain('href="https://example.com/styles.css"');
      expect(tag).toContain('integrity="sha384-def456"');
      expect(tag).toContain('crossorigin="anonymous"');
    });

    it("should include media attribute", () => {
      const tag = generateLinkTag("https://example.com/print.css", "sha384-ghi789", {
        media: "print",
      });

      expect(tag).toContain('media="print"');
    });

    it("should support use-credentials crossorigin", () => {
      const tag = generateLinkTag("https://example.com/styles.css", "sha384-jkl012", {
        crossorigin: "use-credentials",
      });

      expect(tag).toContain('crossorigin="use-credentials"');
    });
  });

  describe("validateSRIInHTML", () => {
    it("should validate HTML with proper SRI", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <script src="app.js" integrity="sha384-valid123"></script>
            <link rel="stylesheet" href="styles.css" integrity="sha256-valid456">
          </head>
        </html>
      `;

      const result = validateSRIInHTML(html);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing SRI hash", () => {
      const html = `
        <script src="app.js" integrity=""></script>
      `;

      const result = validateSRIInHTML(html);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid SRI hash for script: app.js");
    });

    it("should detect invalid SRI format", () => {
      const html = `
        <script src="app.js" integrity="invalid-hash"></script>
      `;

      const result = validateSRIInHTML(html);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid SRI hash for script: app.js");
    });

    it("should validate multiple resources", () => {
      const html = `
        <script src="lib1.js" integrity="sha384-valid1"></script>
        <script src="lib2.js" integrity="invalid"></script>
        <link href="style1.css" integrity="sha256-valid2">
        <link href="style2.css" integrity="">
      `;

      const result = validateSRIInHTML(html);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain("Invalid SRI hash for script: lib2.js");
      expect(result.errors).toContain("Invalid SRI hash for stylesheet: style2.css");
    });

    it("should accept all valid hash algorithms", () => {
      const html = `
        <script src="a.js" integrity="sha256-valid1"></script>
        <script src="b.js" integrity="sha384-valid2"></script>
        <script src="c.js" integrity="sha512-valid3"></script>
      `;

      const result = validateSRIInHTML(html);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
