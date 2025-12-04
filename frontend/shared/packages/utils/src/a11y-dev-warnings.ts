/**
 * Accessibility Development Warnings
 *
 * Runtime warnings for common accessibility issues (development only)
 */

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Warn if interactive element lacks accessible label
 */
export function warnMissingLabel(
  componentName: string,
  props: Record<string, unknown>,
  requiredProps: string[] = ["aria-label", "aria-labelledby", "children"],
): void {
  if (!isDevelopment) return;

  const hasLabel = requiredProps.some((prop) => {
    const value = props[prop];
    if (prop === "children") {
      // Check if children contains text
      return value != null && value !== "";
    }
    return value != null && value !== "";
  });

  if (!hasLabel) {
    console.warn(
      `[a11y] <${componentName}> is missing an accessible label. ` +
        `Provide one of: ${requiredProps.join(", ")}.`,
      "\nProps:",
      props,
    );
  }
}

/**
 * Warn if image lacks alt text
 */
export function warnMissingAlt(
  src: string | undefined,
  alt: string | undefined,
  isDecorative: boolean = false,
): void {
  if (!isDevelopment) return;

  if (src && alt === undefined && !isDecorative) {
    console.warn(
      `[a11y] Image is missing alt text: "${src}". ` +
        'Provide alt text or use alt="" for decorative images.',
    );
  }
}

/**
 * Warn if form input lacks label
 */
export function warnMissingFormLabel(
  inputId: string | undefined,
  labelProps: {
    "aria-label"?: string;
    "aria-labelledby"?: string;
    htmlFor?: string;
  },
): void {
  if (!isDevelopment) return;

  const hasLabel =
    labelProps["aria-label"] || labelProps["aria-labelledby"] || labelProps.htmlFor === inputId;

  if (!hasLabel) {
    console.warn(
      `[a11y] Form input lacks associated label. ` +
        'Use <label htmlFor="id">, aria-label, or aria-labelledby.',
      "\nInput ID:",
      inputId,
    );
  }
}

/**
 * Warn if button type is not specified
 */
export function warnMissingButtonType(
  type: "button" | "submit" | "reset" | undefined,
  isInsideForm: boolean,
): void {
  if (!isDevelopment) return;

  if (isInsideForm && !type) {
    console.warn(
      "[a11y] Button inside form is missing explicit type. " +
        'Specify type="button" or type="submit" to avoid unintended form submission.',
    );
  }
}

/**
 * Warn if heading levels are skipped
 */
export function warnSkippedHeadingLevel(currentLevel: number, previousLevel: number | null): void {
  if (!isDevelopment) return;

  if (previousLevel !== null && currentLevel > previousLevel + 1) {
    console.warn(
      `[a11y] Heading level skipped from h${previousLevel} to h${currentLevel}. ` +
        "Use sequential heading levels for proper document structure.",
    );
  }
}

/**
 * Warn if interactive element is not keyboard accessible
 */
export function warnNotKeyboardAccessible(
  element: string,
  hasOnClick: boolean,
  hasTabIndex: boolean,
  hasRole: boolean,
): void {
  if (!isDevelopment) return;

  const nonInteractiveElements = ["div", "span", "p", "img"];

  if (nonInteractiveElements.includes(element) && hasOnClick && !hasTabIndex && !hasRole) {
    console.warn(
      `[a11y] <${element}> with onClick is not keyboard accessible. ` +
        "Use <button> instead, or add tabIndex={0} and onKeyDown handler.",
    );
  }
}

/**
 * Warn if color contrast may be insufficient
 */
export function warnLowContrast(
  foreground: string,
  background: string,
  ratio: number,
  isLargeText: boolean = false,
): void {
  if (!isDevelopment) return;

  const minRatio = isLargeText ? 3 : 4.5; // WCAG AA standards

  if (ratio < minRatio) {
    console.warn(
      `[a11y] Low color contrast detected (${ratio.toFixed(2)}:1). ` +
        `Minimum ${minRatio}:1 required for ${isLargeText ? "large" : "normal"} text.`,
      `\nForeground: ${foreground}`,
      `\nBackground: ${background}`,
    );
  }
}

/**
 * Warn if ARIA attributes are used incorrectly
 */
export function warnInvalidAria(
  elementType: string,
  ariaAttributes: Record<string, unknown>,
): void {
  if (!isDevelopment) return;

  // Check for common ARIA mistakes
  const invalidCombos: Record<string, string[]> = {
    button: ["aria-pressed", "aria-expanded", "aria-haspopup"],
    input: ["aria-placeholder"], // Use placeholder attribute instead
    img: ["aria-label"], // Should use alt instead
  };

  Object.entries(ariaAttributes).forEach(([attr, value]) => {
    if (attr.startsWith("aria-") && value === undefined) {
      console.warn(
        `[a11y] ARIA attribute "${attr}" is undefined on <${elementType}>. ` +
          "Remove it or provide a value.",
      );
    }
  });
}

/**
 * Warn if focus indicator is removed
 */
export function warnRemovedFocusIndicator(styles: Record<string, unknown>): void {
  if (!isDevelopment) return;

  if (styles.outline === "none" || styles.outline === "0" || styles.outline === 0) {
    console.warn(
      "[a11y] Focus outline removed without providing alternative focus indicator. " +
        "Ensure visible focus state for keyboard users.",
    );
  }
}

/**
 * Warn if table lacks headers
 */
export function warnTableWithoutHeaders(hasHeaders: boolean, cellCount: number): void {
  if (!isDevelopment) return;

  if (!hasHeaders && cellCount > 0) {
    console.warn(
      "[a11y] Table is missing <th> headers. " +
        'Use <th scope="col"> or <th scope="row"> for accessibility.',
    );
  }
}

/**
 * Warn if list is not properly structured
 */
export function warnImproperList(parentType: string, childType: string): void {
  if (!isDevelopment) return;

  const validCombos: Record<string, string[]> = {
    ul: ["li"],
    ol: ["li"],
    dl: ["dt", "dd"],
  };

  if (validCombos[parentType] && !validCombos[parentType].includes(childType)) {
    console.warn(
      `[a11y] Invalid list structure: <${parentType}> should only contain <${validCombos[parentType].join(" or ")}>. ` +
        `Found: <${childType}>`,
    );
  }
}

/**
 * Warn if modal is not properly trapped
 */
export function warnModalWithoutFocusTrap(
  isOpen: boolean,
  hasFocusTrap: boolean,
  hasAriaModal: boolean,
): void {
  if (!isDevelopment) return;

  if (isOpen && !hasFocusTrap) {
    console.warn(
      "[a11y] Modal dialog is open but focus trap is not implemented. " +
        "Use useFocusTrap hook or implement focus management.",
    );
  }

  if (isOpen && !hasAriaModal) {
    console.warn(
      '[a11y] Modal dialog is missing aria-modal="true". ' +
        "Add aria-modal to indicate this is a modal dialog.",
    );
  }
}

/**
 * Warn if landmark regions are missing
 */
export function warnMissingLandmarks(documentStructure: {
  hasMain: boolean;
  hasNav: boolean;
  hasHeader: boolean;
  hasFooter: boolean;
}): void {
  if (!isDevelopment) return;

  if (!documentStructure.hasMain) {
    console.warn(
      "[a11y] Page is missing <main> landmark. " +
        "Add <main> element to identify primary content.",
    );
  }

  if (!documentStructure.hasNav) {
    console.warn(
      "[a11y] Page is missing <nav> landmark. " +
        "Add <nav> element to identify navigation regions.",
    );
  }
}

/**
 * Create comprehensive accessibility report
 */
export function createA11yReport(issues: {
  missingLabels: number;
  missingAlt: number;
  lowContrast: number;
  keyboardIssues: number;
  ariaIssues: number;
  structureIssues: number;
}): void {
  if (!isDevelopment) return;

  const total = Object.values(issues).reduce((sum, count) => sum + count, 0);

  if (total > 0) {
    console.groupCollapsed(
      `%c[a11y] Found ${total} accessibility issue${total === 1 ? "" : "s"}`,
      "color: orange; font-weight: bold",
    );
    console.table(issues);
    console.log("Check console for detailed warnings.");
    console.groupEnd();
  }
}
