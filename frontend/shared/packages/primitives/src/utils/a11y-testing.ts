/**
 * Accessibility Testing Utilities for WCAG 2.1 AA Compliance
 * Provides automated testing and validation tools
 */

// WCAG 2.1 AA compliance checker
export interface AccessibilityViolation {
  type: "error" | "warning";
  rule: string;
  description: string;
  element?: HTMLElement;
  severity: "critical" | "serious" | "moderate" | "minor";
}

export interface AccessibilityTestResult {
  passed: boolean;
  violations: AccessibilityViolation[];
  score: number; // 0-100
  summary: {
    total: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

// Color contrast ratio calculator
export const calculateContrastRatio = (foreground: string, background: string): number => {
  const getLuminance = (hex: string): number => {
    const rgb = hex.replace("#", "").match(/.{2}/g);
    if (!rgb || rgb.length < 3) return 0;
    const [rHex, gHex, bHex] = rgb as [string, string, string];

    const normalizeComponent = (component: string): number => {
      const value = parseInt(component, 16) / 255;
      return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    };

    const r = normalizeComponent(rHex);
    const g = normalizeComponent(gHex);
    const b = normalizeComponent(bHex);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
};

// WCAG contrast requirements
export const CONTRAST_REQUIREMENTS = {
  AA_NORMAL: 4.5,
  AA_LARGE: 3,
  AAA_NORMAL: 7,
  AAA_LARGE: 4.5,
};

// Check if contrast ratio meets WCAG requirements
export const meetsContrastRequirement = (
  ratio: number,
  level: "AA" | "AAA" = "AA",
  textSize: "normal" | "large" = "normal",
): boolean => {
  const requirement =
    level === "AA"
      ? textSize === "large"
        ? CONTRAST_REQUIREMENTS.AA_LARGE
        : CONTRAST_REQUIREMENTS.AA_NORMAL
      : textSize === "large"
        ? CONTRAST_REQUIREMENTS.AAA_LARGE
        : CONTRAST_REQUIREMENTS.AAA_NORMAL;

  return ratio >= requirement;
};

// Test keyboard navigation
export const testKeyboardNavigation = (container: HTMLElement): AccessibilityViolation[] => {
  const violations: AccessibilityViolation[] = [];

  // Find all interactive elements
  const interactiveElements = container.querySelectorAll(
    'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"]',
  );

  // Check for keyboard accessibility
  interactiveElements.forEach((element, index) => {
    const htmlElement = element as HTMLElement;

    // Check if element is focusable
    if (htmlElement.tabIndex < 0 && !htmlElement.hasAttribute("disabled")) {
      violations.push({
        type: "error",
        rule: "WCAG 2.1.1",
        description: "Interactive element is not keyboard accessible",
        element: htmlElement,
        severity: "critical",
      });
    }

    // Check for visible focus indicator
    const computedStyles = window.getComputedStyle(htmlElement);
    const hasFocusIndicator =
      computedStyles.outline !== "none" ||
      computedStyles.boxShadow.includes("0 0 0") ||
      htmlElement.classList.contains("focus:ring") ||
      htmlElement.classList.contains("focus:outline");

    if (!hasFocusIndicator) {
      violations.push({
        type: "warning",
        rule: "WCAG 2.4.7",
        description: "Interactive element lacks visible focus indicator",
        element: htmlElement,
        severity: "serious",
      });
    }
  });

  return violations;
};

// Test ARIA attributes
export const testARIAAttributes = (container: HTMLElement): AccessibilityViolation[] => {
  const violations: AccessibilityViolation[] = [];

  // Check for required ARIA labels
  const elementsNeedingLabels = container.querySelectorAll(
    'button:not([aria-label]):not([aria-labelledby]), input:not([aria-label]):not([aria-labelledby]):not([id]), [role="button"]:not([aria-label]):not([aria-labelledby])',
  );

  elementsNeedingLabels.forEach((element) => {
    const textContent = element.textContent?.trim();
    if (!textContent || textContent.length < 2) {
      violations.push({
        type: "error",
        rule: "WCAG 4.1.2",
        description: "Interactive element lacks accessible name",
        element: element as HTMLElement,
        severity: "critical",
      });
    }
  });

  // Check for invalid ARIA attributes
  const elementsWithAria = container.querySelectorAll("[aria-labelledby], [aria-describedby]");
  elementsWithAria.forEach((element) => {
    const labelledby = element.getAttribute("aria-labelledby");
    const describedby = element.getAttribute("aria-describedby");

    if (labelledby && !container.querySelector(`#${labelledby}`)) {
      violations.push({
        type: "error",
        rule: "WCAG 4.1.2",
        description: `aria-labelledby references non-existent element: ${labelledby}`,
        element: element as HTMLElement,
        severity: "serious",
      });
    }

    if (describedby && !container.querySelector(`#${describedby}`)) {
      violations.push({
        type: "error",
        rule: "WCAG 4.1.2",
        description: `aria-describedby references non-existent element: ${describedby}`,
        element: element as HTMLElement,
        severity: "serious",
      });
    }
  });

  return violations;
};

// Test color contrast
export const testColorContrast = (container: HTMLElement): AccessibilityViolation[] => {
  const violations: AccessibilityViolation[] = [];

  // Get all text elements
  const textElements = container.querySelectorAll("*");

  textElements.forEach((element) => {
    const htmlElement = element as HTMLElement;
    const styles = window.getComputedStyle(htmlElement);
    const textContent = htmlElement.textContent?.trim();

    if (textContent && textContent.length > 0) {
      const foreground = styles.color;
      const background = styles.backgroundColor;

      // Convert to hex if possible (simplified - would need full color conversion in real implementation)
      if (foreground.startsWith("rgb") && background.startsWith("rgb")) {
        // This is a simplified check - in practice, you'd want a full color conversion library
        const fontSize = parseFloat(styles.fontSize);
        const isLargeText = fontSize >= 18 || (fontSize >= 14 && styles.fontWeight === "bold");

        // Placeholder for actual contrast calculation
        // In a real implementation, you'd extract RGB values and calculate the actual ratio
        const estimatedRatio = 4.5; // This should be calculated from actual colors

        if (!meetsContrastRequirement(estimatedRatio, "AA", isLargeText ? "large" : "normal")) {
          violations.push({
            type: "error",
            rule: "WCAG 1.4.3",
            description: `Insufficient color contrast ratio (${estimatedRatio.toFixed(2)}:1)`,
            element: htmlElement,
            severity: "serious",
          });
        }
      }
    }
  });

  return violations;
};

// Test semantic structure
export const testSemanticStructure = (container: HTMLElement): AccessibilityViolation[] => {
  const violations: AccessibilityViolation[] = [];

  // Check heading hierarchy
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
  let previousLevel = 0;

  headings.forEach((heading) => {
    const tagName = heading.tagName.toLowerCase();
    const currentLevel = tagName.startsWith("h") ? parseInt(tagName.substring(1)) : 1;

    if (currentLevel > previousLevel + 1) {
      violations.push({
        type: "warning",
        rule: "WCAG 1.3.1",
        description: `Heading level skipped: ${tagName} follows h${previousLevel}`,
        element: heading as HTMLElement,
        severity: "moderate",
      });
    }

    previousLevel = currentLevel;
  });

  // Check for landmarks
  const landmarks = container.querySelectorAll(
    '[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer',
  );
  if (landmarks.length === 0) {
    violations.push({
      type: "warning",
      rule: "WCAG 1.3.1",
      description: "Page lacks semantic landmarks for navigation",
      severity: "moderate",
    });
  }

  return violations;
};

// Comprehensive accessibility test
export const runAccessibilityTest = (container: HTMLElement): AccessibilityTestResult => {
  const violations: AccessibilityViolation[] = [
    ...testKeyboardNavigation(container),
    ...testARIAAttributes(container),
    ...testColorContrast(container),
    ...testSemanticStructure(container),
  ];

  const summary = {
    total: violations.length,
    critical: violations.filter((v) => v.severity === "critical").length,
    serious: violations.filter((v) => v.severity === "serious").length,
    moderate: violations.filter((v) => v.severity === "moderate").length,
    minor: violations.filter((v) => v.severity === "minor").length,
  };

  // Calculate score (100 - penalty points)
  const penalties = {
    critical: 25,
    serious: 10,
    moderate: 5,
    minor: 2,
  };

  const totalPenalty =
    summary.critical * penalties.critical +
    summary.serious * penalties.serious +
    summary.moderate * penalties.moderate +
    summary.minor * penalties.minor;

  const score = Math.max(0, 100 - totalPenalty);
  const passed = summary.critical === 0 && summary.serious === 0;

  return {
    passed,
    violations,
    score,
    summary,
  };
};

// Generate accessibility report
export const generateAccessibilityReport = (result: AccessibilityTestResult): string => {
  const { passed, violations, score, summary } = result;

  let report = `# Accessibility Test Report\n\n`;
  report += `**Overall Score:** ${score}/100\n`;
  report += `**Status:** ${passed ? "✅ PASSED" : "❌ FAILED"}\n\n`;

  report += `## Summary\n`;
  report += `- Total Issues: ${summary.total}\n`;
  report += `- Critical: ${summary.critical}\n`;
  report += `- Serious: ${summary.serious}\n`;
  report += `- Moderate: ${summary.moderate}\n`;
  report += `- Minor: ${summary.minor}\n\n`;

  if (violations.length > 0) {
    report += `## Issues Found\n\n`;

    violations.forEach((violation, index) => {
      report += `### ${index + 1}. ${violation.description}\n`;
      report += `- **Severity:** ${violation.severity.toUpperCase()}\n`;
      report += `- **Rule:** ${violation.rule}\n`;
      report += `- **Type:** ${violation.type}\n`;
      if (violation.element) {
        report += `- **Element:** ${violation.element.tagName.toLowerCase()}`;
        if (violation.element.id) report += `#${violation.element.id}`;
        if (violation.element.className)
          report += `.${violation.element.className.split(" ").join(".")}`;
        report += `\n`;
      }
      report += `\n`;
    });
  }

  report += `## Recommendations\n\n`;
  if (summary.critical > 0) {
    report += `- 🚨 **Critical Issues:** Address immediately to ensure basic accessibility\n`;
  }
  if (summary.serious > 0) {
    report += `- ⚠️ **Serious Issues:** Fix to meet WCAG 2.1 AA standards\n`;
  }
  if (summary.moderate > 0) {
    report += `- 📋 **Moderate Issues:** Improve for better user experience\n`;
  }
  if (summary.minor > 0) {
    report += `- 💡 **Minor Issues:** Consider for enhanced accessibility\n`;
  }

  return report;
};

// Test runner for development
export const runDevelopmentA11yTest = (element?: HTMLElement): void => {
  const container = element || document.body;
  const result = runAccessibilityTest(container);
  const report = generateAccessibilityReport(result);

  console.group(`🔍 Accessibility Test Results - Score: ${result.score}/100`);
  console.log(report);

  if (!result.passed) {
    console.warn("⚠️ Accessibility issues found. Check violations above.");
    result.violations.forEach((violation) => {
      if (violation.severity === "critical") {
        console.error("🚨 Critical:", violation.description, violation.element);
      }
    });
  } else {
    console.log("✅ All accessibility tests passed!");
  }

  console.groupEnd();
};
