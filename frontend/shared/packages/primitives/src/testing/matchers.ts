import { axe } from "jest-axe";

type MatchableNode = Element | Document | null;

const EVENT_HANDLER_ATTR = /^on[a-z]+/i;
const JAVASCRIPT_URL = /^\s*javascript:/i;

const normalizeElement = (received: MatchableNode): Element | null => {
  if (!received) {
    return null;
  }

  if (received instanceof Document) {
    return received.documentElement;
  }

  return received;
};

export const detectSecurityViolations = (root: Element): string[] => {
  const issues: string[] = [];
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];

  const scriptCount = root.querySelectorAll("script").length;
  if (scriptCount > 0) {
    issues.push(`Found ${scriptCount} <script> tag${scriptCount > 1 ? "s" : ""}`);
  }

  elements.forEach((el) => {
    el.getAttributeNames().forEach((attr) => {
      const value = el.getAttribute(attr) ?? "";
      if (EVENT_HANDLER_ATTR.test(attr)) {
        issues.push(`Inline event handler "${attr}" detected on <${el.tagName.toLowerCase()}>`);
      }

      if (JAVASCRIPT_URL.test(value)) {
        issues.push(
          `Navigational attribute "${attr}" contains javascript: URL on <${el.tagName.toLowerCase()}>`,
        );
      }

      if (attr.toLowerCase() === "srcdoc" && value.trim().length > 0) {
        issues.push(`Found srcdoc iframe content on <${el.tagName.toLowerCase()}>`);
      }
    });
  });

  return issues;
};

let matchersRegistered = false;

export const ensureTestingMatchers = () => {
  if (matchersRegistered) {
    return;
  }

  matchersRegistered = true;

  expect.extend({
    async toBeAccessible(received: MatchableNode) {
      const element = normalizeElement(received);
      if (!element) {
        return {
          pass: false,
          message: () => "Expected DOM element but received null",
        };
      }

      const results = await axe(element, {
        rules: {
          "nested-interactive": { enabled: false },
        },
      });

      const { violations } = results;
      const pass = violations.length === 0;

      return {
        pass,
        message: () =>
          pass
            ? "Expected accessibility violations but none were detected"
            : `Accessibility violations: ${violations
                .map((v) => `${v.id} (${v.nodes.length} node${v.nodes.length > 1 ? "s" : ""})`)
                .join(", ")}`,
      };
    },
    toHaveNoSecurityViolations(received: MatchableNode) {
      const element = normalizeElement(received);
      if (!element) {
        return {
          pass: false,
          message: () => "Expected DOM element but received null",
        };
      }

      const issues = detectSecurityViolations(element);
      const pass = issues.length === 0;

      return {
        pass,
        message: () =>
          pass
            ? "Expected security violations but none were detected"
            : `Detected potential security violations:\n- ${issues.join("\n- ")}`,
      };
    },
    toBePerformant(received: { duration?: number; threshold?: number }, threshold = 16) {
      const duration = received?.duration ?? 0;
      const limit = threshold ?? received?.threshold ?? 16;
      const buffer = limit + 10;
      const pass = duration <= buffer;
      return {
        pass,
        message: () =>
          pass
            ? `Expected rendering to exceed ${buffer}ms but it completed in ${duration.toFixed(2)}ms`
            : `Expected rendering to complete within ${buffer}ms but took ${duration.toFixed(2)}ms`,
      };
    },
    toHaveValidMarkup(received: MatchableNode) {
      const element = normalizeElement(received);
      if (!element) {
        return {
          pass: false,
          message: () => "Expected DOM element but received null",
        };
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(element.outerHTML, "text/html");
      const hasParserErrors = doc.getElementsByTagName("parsererror").length > 0;

      return {
        pass: !hasParserErrors,
        message: () =>
          hasParserErrors
            ? "Detected invalid markup (DOMParser reported parsererror nodes)"
            : "Expected invalid markup but DOMParser reported none",
      };
    },
  });
};

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeAccessible(): R;
      toHaveNoSecurityViolations(): R;
      toBePerformant(threshold?: number): R;
      toHaveValidMarkup(): R;
      toHaveNoViolations(): R;
    }
  }
}
