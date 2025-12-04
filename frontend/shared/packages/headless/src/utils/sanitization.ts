/**
 * Input sanitization and XSS protection utilities
 */

export interface SanitizationOptions {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  stripAll?: boolean;
  maxLength?: number;
}

class InputSanitizer {
  // Default allowed HTML tags for rich text content
  private readonly DEFAULT_ALLOWED_TAGS = [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "pre",
    "code",
  ];

  // Default allowed attributes
  private readonly DEFAULT_ALLOWED_ATTRIBUTES: Record<string, string[]> = {
    a: ["href", "title"],
    img: ["src", "alt", "title", "width", "height"],
    "*": ["class"], // Allow class on all elements
  };

  // Dangerous patterns that should always be removed
  private readonly DANGEROUS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)[^<]*)*<\/embed>/gi,
    /<form\b[^<]*(?:(?!<\/form>)[^<]*)*<\/form>/gi,
    /javascript:/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi, // Event handlers like onclick, onload, etc.
  ];

  // URL validation regex
  private readonly URL_REGEX =
    /^https?:\/\/(?:[-\w.])+(?::[0-9]+)?(?:\/(?:[\w/_.])*(?:\?(?:[\w&%=.]*))?(?:#(?:\w*))?)?$/;

  /**
   * Sanitize HTML content to prevent XSS
   */
  sanitizeHTML(
    input: string,
    options: SanitizationOptions = {
      // Implementation pending
    },
  ): string {
    if (!input || typeof input !== "string") {
      return "";
    }

    const {
      allowedTags = this.DEFAULT_ALLOWED_TAGS,
      allowedAttributes = this.DEFAULT_ALLOWED_ATTRIBUTES,
      stripAll = false,
      maxLength,
    } = options;

    let sanitized = input;

    // Apply length limit first
    if (maxLength && sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    // Remove dangerous patterns first
    for (const pattern of this.DANGEROUS_PATTERNS) {
      sanitized = sanitized.replace(pattern, "");
    }

    if (stripAll) {
      // Remove all HTML tags
      return this.stripAllTags(sanitized);
    }

    // Parse and clean allowed tags
    sanitized = this.cleanAllowedTags(sanitized, allowedTags, allowedAttributes);

    return sanitized.trim();
  }

  /**
   * Sanitize plain text input
   */
  sanitizeText(input: string, maxLength?: number): string {
    if (!input || typeof input !== "string") {
      return "";
    }

    let sanitized = input;

    // Remove HTML tags
    sanitized = this.stripAllTags(sanitized);

    // Decode HTML entities
    sanitized = this.decodeHTMLEntities(sanitized);

    // Apply length limit
    if (maxLength && sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized.trim();
  }

  /**
   * Sanitize URL to prevent XSS and ensure it's safe
   */
  sanitizeURL(url: string): string | null {
    if (!url || typeof url !== "string") {
      return null;
    }

    // Remove whitespace and control characters
    const cleaned = url.trim().replace(/[\x00-\x1F\x7F]/g, "");

    // Check for javascript: or data: URLs
    if (cleaned.match(/^(javascript|data|vbscript):/i)) {
      return null;
    }

    // Validate URL format
    if (!this.URL_REGEX.test(cleaned)) {
      // If it doesn't start with http/https, it might be a relative URL
      if (cleaned.startsWith("/") && !cleaned.includes("..")) {
        return cleaned;
      }
      return null;
    }

    return cleaned;
  }

  /**
   * Sanitize email address
   */
  sanitizeEmail(email: string): string | null {
    if (!email || typeof email !== "string") {
      return null;
    }

    const cleaned = email.trim().toLowerCase();

    // Basic email validation regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(cleaned)) {
      return null;
    }

    return cleaned;
  }

  /**
   * Sanitize phone number
   */
  sanitizePhone(phone: string): string | null {
    if (!phone || typeof phone !== "string") {
      return null;
    }

    // Remove all non-digit characters except + for international numbers
    const cleaned = phone.replace(/[^\d+]/g, "");

    // Basic phone number validation (10-15 digits)
    if (cleaned.length < 10 || cleaned.length > 15) {
      return null;
    }

    return cleaned;
  }

  /**
   * Sanitize SQL input to prevent injection (basic protection)
   */
  sanitizeSQLInput(input: string): string {
    if (!input || typeof input !== "string") {
      return "";
    }

    // Remove SQL injection patterns
    const sqlPatterns = [
      /('|('')|;|--|\||\*|%|<|>|=|\\)/gi,
      /(union|select|insert|update|delete|drop|create|alter|exec|execute)/gi,
    ];

    let sanitized = input;
    for (const pattern of sqlPatterns) {
      sanitized = sanitized.replace(pattern, "");
    }

    return sanitized.trim();
  }

  /**
   * Strip all HTML tags
   */
  private stripAllTags(html: string): string {
    return html.replace(/<[^>]*>/g, "");
  }

  /**
   * Clean and validate allowed HTML tags
   */
  private cleanAllowedTags(
    html: string,
    allowedTags: string[],
    allowedAttributes: Record<string, string[]>,
  ): string {
    // This is a basic implementation. For production, consider using a library like DOMPurify

    // Remove disallowed tags
    const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;

    return html.replace(tagPattern, (match, tagName) => {
      const tag = tagName.toLowerCase();

      if (!allowedTags.includes(tag)) {
        return "";
      }

      // Clean attributes for allowed tags
      return this.cleanAttributes(match, tag, allowedAttributes);
    });
  }

  /**
   * Clean HTML attributes
   */
  private cleanAttributes(
    tagHTML: string,
    tagName: string,
    allowedAttributes: Record<string, string[]>,
  ): string {
    const allowedForTag = allowedAttributes[tagName] || [];
    const allowedForAll = allowedAttributes["*"] || [];
    const allAllowed = [...allowedForTag, ...allowedForAll];

    if (allAllowed.length === 0) {
      // Return tag without attributes
      return tagHTML.replace(/\s+[^>]*/, "");
    }

    // This is a simplified implementation
    // For production, use a proper HTML parser
    return tagHTML.replace(/\s+(\w+)=["'][^"']*["']/g, (match, attrName) => {
      if (allAllowed.includes(attrName.toLowerCase())) {
        return match;
      }
      return "";
    });
  }

  /**
   * Decode HTML entities
   */
  private decodeHTMLEntities(text: string): string {
    const entityMap: Record<string, string> = {
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&#x27;": "'",
      "&#x2F;": "/",
      "&#x60;": "`",
      "&#x3D;": "=",
    };

    return text.replace(/&[#\w]+;/g, (entity) => {
      return entityMap[entity] || entity;
    });
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHTML(text: string): string {
    if (!text || typeof text !== "string") {
      return "";
    }

    const entityMap: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#x27;",
      "/": "&#x2F;",
      "`": "&#x60;",
      "=": "&#x3D;",
    };

    return text.replace(/[&<>"'`=/]/g, (char) => {
      return entityMap[char] || char;
    });
  }

  /**
   * Validate and sanitize JSON input
   */
  sanitizeJSON(input: string): object | null {
    try {
      if (!input || typeof input !== "string") {
        return null;
      }

      // Remove dangerous patterns
      let cleaned = input;
      for (const pattern of this.DANGEROUS_PATTERNS) {
        cleaned = cleaned.replace(pattern, "");
      }

      // Additional validation can be added here
      return JSON.parse(cleaned);
    } catch (_error) {
      return null;
    }
  }

  /**
   * Comprehensive input sanitization for form data
   */
  sanitizeFormData(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {
      // Implementation pending
    };

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string") {
        // Sanitize based on field type (heuristic)
        if (key.toLowerCase().includes("email")) {
          sanitized[key] = this.sanitizeEmail(value);
        } else if (key.toLowerCase().includes("phone")) {
          sanitized[key] = this.sanitizePhone(value);
        } else if (key.toLowerCase().includes("url") || key.toLowerCase().includes("link")) {
          sanitized[key] = this.sanitizeURL(value);
        } else if (key.toLowerCase().includes("html") || key.toLowerCase().includes("content")) {
          sanitized[key] = this.sanitizeHTML(value);
        } else {
          sanitized[key] = this.sanitizeText(value, 1000); // Default max length
        }
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item) =>
          typeof item === "string" ? this.sanitizeText(item, 1000) : item,
        );
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

// Export singleton instance
export const inputSanitizer = new InputSanitizer();

// Convenience functions
export const sanitizeHTML = (input: string, options?: SanitizationOptions) =>
  inputSanitizer.sanitizeHTML(input, options);

export const sanitizeText = (input: string, maxLength?: number) =>
  inputSanitizer.sanitizeText(input, maxLength);

export const sanitizeURL = (url: string) => inputSanitizer.sanitizeURL(url);

export const sanitizeEmail = (email: string) => inputSanitizer.sanitizeEmail(email);

export const escapeHTML = (text: string) => inputSanitizer.escapeHTML(text);
