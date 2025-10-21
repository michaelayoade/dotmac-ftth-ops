/**
 * Accessibility Testing Setup
 *
 * Configures jest-axe for automated accessibility testing
 */

import { configureAxe, toHaveNoViolations } from "jest-axe";

// Extend Jest matchers
expect.extend(toHaveNoViolations());

// Configure axe with WCAG 2.1 AA rules
export const axe = configureAxe({
  rules: {
    // WCAG 2.1 Level A & AA rules
    "html-has-lang": { enabled: true },
    "html-lang-valid": { enabled: true },
    "image-alt": { enabled: true },
    "input-image-alt": { enabled: true },
    label: { enabled: true },
    "button-name": { enabled: true },
    "link-name": { enabled: true },
    "document-title": { enabled: true },
    "duplicate-id": { enabled: true },
    "frame-title": { enabled: true },
    "heading-order": { enabled: true },
    "landmark-one-main": { enabled: true },
    "page-has-heading-one": { enabled: true },
    region: { enabled: true },
    "skip-link": { enabled: true },

    // Form accessibility
    "label-title-only": { enabled: true },
    "form-field-multiple-labels": { enabled: true },

    // Keyboard accessibility
    "focus-order-semantics": { enabled: true },
    tabindex: { enabled: true },

    // ARIA
    "aria-allowed-attr": { enabled: true },
    "aria-required-attr": { enabled: true },
    "aria-required-children": { enabled: true },
    "aria-required-parent": { enabled: true },
    "aria-roles": { enabled: true },
    "aria-valid-attr": { enabled: true },
    "aria-valid-attr-value": { enabled: true },

    // Disable rules that are too strict for development
    "color-contrast": { enabled: false }, // Can be flaky in tests
  },
});

/**
 * Common test utilities
 */
export const a11yTestUtils = {
  /**
   * Test keyboard navigation through focusable elements
   */
  async testKeyboardNavigation(container: HTMLElement) {
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    expect(focusableElements.length).toBeGreaterThan(0);

    // Test that all elements are keyboard accessible
    focusableElements.forEach((element) => {
      expect(element.tabIndex).toBeGreaterThanOrEqual(-1);
    });

    return focusableElements;
  },

  /**
   * Test that all buttons have accessible labels
   */
  async testButtonLabels(container: HTMLElement) {
    const buttons = container.querySelectorAll("button");

    buttons.forEach((button) => {
      const hasTextContent = button.textContent && button.textContent.trim().length > 0;
      const hasAriaLabel = button.getAttribute("aria-label");
      const hasAriaLabelledBy = button.getAttribute("aria-labelledby");
      const hasTitle = button.getAttribute("title");

      expect(hasTextContent || hasAriaLabel || hasAriaLabelledBy || hasTitle).toBeTruthy();
    });
  },

  /**
   * Test that all images have alt text
   */
  async testImageAltText(container: HTMLElement) {
    const images = container.querySelectorAll("img");

    images.forEach((img) => {
      expect(img.hasAttribute("alt")).toBeTruthy();
    });
  },

  /**
   * Test form field labels
   */
  async testFormLabels(container: HTMLElement) {
    const inputs = container.querySelectorAll("input, select, textarea");

    inputs.forEach((input) => {
      const id = input.getAttribute("id");
      const ariaLabel = input.getAttribute("aria-label");
      const ariaLabelledBy = input.getAttribute("aria-labelledby");

      // Must have id + corresponding label, OR aria-label/aria-labelledby
      if (id) {
        const label = container.querySelector(`label[for="${id}"]`);
        expect(label || ariaLabel || ariaLabelledBy).toBeTruthy();
      } else {
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    });
  },

  /**
   * Test that landmarks are present
   */
  async testLandmarks(container: HTMLElement) {
    const landmarks = {
      main: container.querySelector('main, [role="main"]'),
      nav: container.querySelector('nav, [role="navigation"]'),
      header: container.querySelector('header, [role="banner"]'),
    };

    // At least main should be present
    expect(landmarks.main).toBeTruthy();

    return landmarks;
  },

  /**
   * Test heading hierarchy
   */
  async testHeadingHierarchy(container: HTMLElement) {
    const headings = Array.from(container.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((h) =>
      parseInt(h.tagName[1] || "1", 10),
    );

    // Should have at least one h1
    expect(headings).toContain(1);

    // Check for skipped levels
    for (let i = 1; i < headings.length; i++) {
      const prevHeading = headings[i - 1];
      const currHeading = headings[i];
      if (prevHeading !== undefined && currHeading !== undefined) {
        const diff = currHeading - prevHeading;
        // Should not skip more than 1 level
        expect(Math.abs(diff)).toBeLessThanOrEqual(1);
      }
    }

    return headings;
  },
};

/**
 * Custom matchers for accessibility testing
 */
export const customMatchers = {
  toHaveAriaLabel(element: HTMLElement) {
    const hasAriaLabel =
      element.hasAttribute("aria-label") || element.hasAttribute("aria-labelledby");

    return {
      pass: hasAriaLabel,
      message: () =>
        hasAriaLabel
          ? `Expected element not to have aria-label`
          : `Expected element to have aria-label or aria-labelledby`,
    };
  },

  toBeKeyboardAccessible(element: HTMLElement) {
    const isAccessible = element.tabIndex >= -1 && !element.hasAttribute("disabled");

    return {
      pass: isAccessible,
      message: () =>
        isAccessible
          ? `Expected element not to be keyboard accessible`
          : `Expected element to be keyboard accessible (tabindex >= -1 and not disabled)`,
    };
  },
};
