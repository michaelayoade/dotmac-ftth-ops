/**
 * Accessibility Development Warnings Tests
 *
 * Note: The a11y module checks NODE_ENV at module load time,
 * so we test based on the environment being "test" which makes
 * isDevelopment = false. We use jest.isolateModules to reload
 * the module with different environment settings.
 */

describe("a11y-dev-warnings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe("in development mode", () => {
    let warnMissingLabel: typeof import("../a11y-dev-warnings").warnMissingLabel;
    let warnMissingAlt: typeof import("../a11y-dev-warnings").warnMissingAlt;
    let warnMissingFormLabel: typeof import("../a11y-dev-warnings").warnMissingFormLabel;
    let warnMissingButtonType: typeof import("../a11y-dev-warnings").warnMissingButtonType;
    let warnSkippedHeadingLevel: typeof import("../a11y-dev-warnings").warnSkippedHeadingLevel;
    let warnNotKeyboardAccessible: typeof import("../a11y-dev-warnings").warnNotKeyboardAccessible;
    let warnLowContrast: typeof import("../a11y-dev-warnings").warnLowContrast;
    let warnInvalidAria: typeof import("../a11y-dev-warnings").warnInvalidAria;
    let warnRemovedFocusIndicator: typeof import("../a11y-dev-warnings").warnRemovedFocusIndicator;
    let warnTableWithoutHeaders: typeof import("../a11y-dev-warnings").warnTableWithoutHeaders;
    let warnImproperList: typeof import("../a11y-dev-warnings").warnImproperList;
    let warnModalWithoutFocusTrap: typeof import("../a11y-dev-warnings").warnModalWithoutFocusTrap;
    let warnMissingLandmarks: typeof import("../a11y-dev-warnings").warnMissingLandmarks;
    let createA11yReport: typeof import("../a11y-dev-warnings").createA11yReport;

    beforeEach(() => {
      // Set NODE_ENV before importing the module
      process.env.NODE_ENV = "development";

      // Re-import module after env change
      jest.isolateModules(() => {
        const module = require("../a11y-dev-warnings");
        warnMissingLabel = module.warnMissingLabel;
        warnMissingAlt = module.warnMissingAlt;
        warnMissingFormLabel = module.warnMissingFormLabel;
        warnMissingButtonType = module.warnMissingButtonType;
        warnSkippedHeadingLevel = module.warnSkippedHeadingLevel;
        warnNotKeyboardAccessible = module.warnNotKeyboardAccessible;
        warnLowContrast = module.warnLowContrast;
        warnInvalidAria = module.warnInvalidAria;
        warnRemovedFocusIndicator = module.warnRemovedFocusIndicator;
        warnTableWithoutHeaders = module.warnTableWithoutHeaders;
        warnImproperList = module.warnImproperList;
        warnModalWithoutFocusTrap = module.warnModalWithoutFocusTrap;
        warnMissingLandmarks = module.warnMissingLandmarks;
        createA11yReport = module.createA11yReport;
      });
    });

    describe("warnMissingLabel", () => {
      it("warns when no accessible label is provided", () => {
        warnMissingLabel("Button", {});

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("missing an accessible label"),
          expect.anything(),
          expect.anything()
        );
      });

      it("does not warn when aria-label is provided", () => {
        warnMissingLabel("Button", { "aria-label": "Submit form" });

        expect(console.warn).not.toHaveBeenCalled();
      });

      it("does not warn when aria-labelledby is provided", () => {
        warnMissingLabel("Button", { "aria-labelledby": "label-id" });

        expect(console.warn).not.toHaveBeenCalled();
      });

      it("does not warn when children is provided", () => {
        warnMissingLabel("Button", { children: "Click me" });

        expect(console.warn).not.toHaveBeenCalled();
      });
    });

    describe("warnMissingAlt", () => {
      it("warns when image has no alt text", () => {
        warnMissingAlt("/image.png", undefined, false);

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("missing alt text")
        );
      });

      it("does not warn when alt is provided", () => {
        warnMissingAlt("/image.png", "Description", false);

        expect(console.warn).not.toHaveBeenCalled();
      });

      it("does not warn for decorative images", () => {
        warnMissingAlt("/image.png", undefined, true);

        expect(console.warn).not.toHaveBeenCalled();
      });

      it("does not warn when no src", () => {
        warnMissingAlt(undefined, undefined, false);

        expect(console.warn).not.toHaveBeenCalled();
      });
    });

    describe("warnMissingFormLabel", () => {
      it("warns when form input lacks label", () => {
        warnMissingFormLabel("input-1", {});

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("lacks associated label"),
          expect.anything(),
          expect.anything()
        );
      });

      it("does not warn when aria-label is provided", () => {
        warnMissingFormLabel("input-1", { "aria-label": "Username" });

        expect(console.warn).not.toHaveBeenCalled();
      });

      it("does not warn when aria-labelledby is provided", () => {
        warnMissingFormLabel("input-1", { "aria-labelledby": "label-id" });

        expect(console.warn).not.toHaveBeenCalled();
      });

      it("does not warn when htmlFor matches id", () => {
        warnMissingFormLabel("input-1", { htmlFor: "input-1" });

        expect(console.warn).not.toHaveBeenCalled();
      });
    });

    describe("warnMissingButtonType", () => {
      it("warns when button in form has no type", () => {
        warnMissingButtonType(undefined, true);

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("missing explicit type")
        );
      });

      it("does not warn when type is specified", () => {
        warnMissingButtonType("button", true);

        expect(console.warn).not.toHaveBeenCalled();
      });

      it("does not warn when not inside form", () => {
        warnMissingButtonType(undefined, false);

        expect(console.warn).not.toHaveBeenCalled();
      });
    });

    describe("warnSkippedHeadingLevel", () => {
      it("warns when heading level is skipped", () => {
        warnSkippedHeadingLevel(4, 2);

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("Heading level skipped from h2 to h4")
        );
      });

      it("does not warn for sequential headings", () => {
        warnSkippedHeadingLevel(2, 1);

        expect(console.warn).not.toHaveBeenCalled();
      });

      it("does not warn for same level", () => {
        warnSkippedHeadingLevel(2, 2);

        expect(console.warn).not.toHaveBeenCalled();
      });

      it("does not warn when previous is null", () => {
        warnSkippedHeadingLevel(3, null);

        expect(console.warn).not.toHaveBeenCalled();
      });
    });

    describe("warnNotKeyboardAccessible", () => {
      it("warns for div with onClick but no tabIndex or role", () => {
        warnNotKeyboardAccessible("div", true, false, false);

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("not keyboard accessible")
        );
      });

      it("warns for span with onClick", () => {
        warnNotKeyboardAccessible("span", true, false, false);

        expect(console.warn).toHaveBeenCalled();
      });

      it("does not warn when tabIndex is present", () => {
        warnNotKeyboardAccessible("div", true, true, false);

        expect(console.warn).not.toHaveBeenCalled();
      });

      it("does not warn when role is present", () => {
        warnNotKeyboardAccessible("div", true, false, true);

        expect(console.warn).not.toHaveBeenCalled();
      });

      it("does not warn for native interactive elements", () => {
        warnNotKeyboardAccessible("button", true, false, false);

        expect(console.warn).not.toHaveBeenCalled();
      });

      it("does not warn when no onClick", () => {
        warnNotKeyboardAccessible("div", false, false, false);

        expect(console.warn).not.toHaveBeenCalled();
      });
    });

    describe("warnLowContrast", () => {
      it("warns when contrast is below minimum for normal text", () => {
        warnLowContrast("#777", "#fff", 3.5, false);

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("Low color contrast"),
          expect.anything(),
          expect.anything()
        );
      });

      it("does not warn when contrast meets AA for normal text", () => {
        warnLowContrast("#000", "#fff", 21, false);

        expect(console.warn).not.toHaveBeenCalled();
      });

      it("warns when contrast is below minimum for large text", () => {
        warnLowContrast("#888", "#fff", 2.5, true);

        expect(console.warn).toHaveBeenCalled();
      });

      it("does not warn when contrast meets AA for large text", () => {
        warnLowContrast("#777", "#fff", 3.5, true);

        expect(console.warn).not.toHaveBeenCalled();
      });
    });

    describe("warnInvalidAria", () => {
      it("warns when aria attribute is undefined", () => {
        warnInvalidAria("button", { "aria-pressed": undefined });

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('ARIA attribute "aria-pressed" is undefined')
        );
      });

      it("does not warn when aria attribute has value", () => {
        warnInvalidAria("button", { "aria-pressed": true });

        expect(console.warn).not.toHaveBeenCalled();
      });

      it("ignores non-aria attributes", () => {
        warnInvalidAria("button", { className: undefined });

        expect(console.warn).not.toHaveBeenCalled();
      });
    });

    describe("warnRemovedFocusIndicator", () => {
      it("warns when outline is none", () => {
        warnRemovedFocusIndicator({ outline: "none" });

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("Focus outline removed")
        );
      });

      it("warns when outline is 0", () => {
        warnRemovedFocusIndicator({ outline: 0 });

        expect(console.warn).toHaveBeenCalled();
      });

      it("warns when outline is string 0", () => {
        warnRemovedFocusIndicator({ outline: "0" });

        expect(console.warn).toHaveBeenCalled();
      });

      it("does not warn when outline is present", () => {
        warnRemovedFocusIndicator({ outline: "2px solid blue" });

        expect(console.warn).not.toHaveBeenCalled();
      });
    });

    describe("warnTableWithoutHeaders", () => {
      it("warns when table has cells but no headers", () => {
        warnTableWithoutHeaders(false, 10);

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("missing <th> headers")
        );
      });

      it("does not warn when table has headers", () => {
        warnTableWithoutHeaders(true, 10);

        expect(console.warn).not.toHaveBeenCalled();
      });

      it("does not warn when table is empty", () => {
        warnTableWithoutHeaders(false, 0);

        expect(console.warn).not.toHaveBeenCalled();
      });
    });

    describe("warnImproperList", () => {
      it("warns when ul contains non-li element", () => {
        warnImproperList("ul", "div");

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("Invalid list structure")
        );
      });

      it("warns when ol contains non-li element", () => {
        warnImproperList("ol", "span");

        expect(console.warn).toHaveBeenCalled();
      });

      it("does not warn for valid ul > li", () => {
        warnImproperList("ul", "li");

        expect(console.warn).not.toHaveBeenCalled();
      });

      it("does not warn for valid dl > dt", () => {
        warnImproperList("dl", "dt");

        expect(console.warn).not.toHaveBeenCalled();
      });

      it("does not warn for non-list parents", () => {
        warnImproperList("div", "span");

        expect(console.warn).not.toHaveBeenCalled();
      });
    });

    describe("warnModalWithoutFocusTrap", () => {
      it("warns when modal is open without focus trap", () => {
        warnModalWithoutFocusTrap(true, false, true);

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("focus trap is not implemented")
        );
      });

      it("warns when modal is open without aria-modal", () => {
        warnModalWithoutFocusTrap(true, true, false);

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('missing aria-modal="true"')
        );
      });

      it("does not warn when modal is closed", () => {
        warnModalWithoutFocusTrap(false, false, false);

        expect(console.warn).not.toHaveBeenCalled();
      });

      it("does not warn when modal has focus trap and aria-modal", () => {
        warnModalWithoutFocusTrap(true, true, true);

        expect(console.warn).not.toHaveBeenCalled();
      });
    });

    describe("warnMissingLandmarks", () => {
      it("warns when main landmark is missing", () => {
        warnMissingLandmarks({
          hasMain: false,
          hasNav: true,
          hasHeader: true,
          hasFooter: true,
        });

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("missing <main> landmark")
        );
      });

      it("warns when nav landmark is missing", () => {
        warnMissingLandmarks({
          hasMain: true,
          hasNav: false,
          hasHeader: true,
          hasFooter: true,
        });

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("missing <nav> landmark")
        );
      });

      it("does not warn when all landmarks present", () => {
        warnMissingLandmarks({
          hasMain: true,
          hasNav: true,
          hasHeader: true,
          hasFooter: true,
        });

        expect(console.warn).not.toHaveBeenCalled();
      });
    });

    describe("createA11yReport", () => {
      it("creates report when issues exist", () => {
        createA11yReport({
          missingLabels: 5,
          missingAlt: 3,
          lowContrast: 2,
          keyboardIssues: 1,
          ariaIssues: 0,
          structureIssues: 1,
        });

        expect(console.groupCollapsed).toHaveBeenCalledWith(
          expect.stringContaining("12 accessibility issues"),
          expect.anything()
        );
        expect(console.table).toHaveBeenCalled();
        expect(console.groupEnd).toHaveBeenCalled();
      });

      it("handles single issue pluralization", () => {
        createA11yReport({
          missingLabels: 1,
          missingAlt: 0,
          lowContrast: 0,
          keyboardIssues: 0,
          ariaIssues: 0,
          structureIssues: 0,
        });

        expect(console.groupCollapsed).toHaveBeenCalledWith(
          expect.stringContaining("1 accessibility issue"),
          expect.anything()
        );
      });

      it("does not create report when no issues", () => {
        createA11yReport({
          missingLabels: 0,
          missingAlt: 0,
          lowContrast: 0,
          keyboardIssues: 0,
          ariaIssues: 0,
          structureIssues: 0,
        });

        expect(console.groupCollapsed).not.toHaveBeenCalled();
      });
    });
  });

  describe("in production mode", () => {
    let warnMissingLabel: typeof import("../a11y-dev-warnings").warnMissingLabel;
    let warnMissingAlt: typeof import("../a11y-dev-warnings").warnMissingAlt;
    let createA11yReport: typeof import("../a11y-dev-warnings").createA11yReport;

    beforeEach(() => {
      process.env.NODE_ENV = "production";

      jest.isolateModules(() => {
        const module = require("../a11y-dev-warnings");
        warnMissingLabel = module.warnMissingLabel;
        warnMissingAlt = module.warnMissingAlt;
        createA11yReport = module.createA11yReport;
      });
    });

    it("warnMissingLabel does not run in production", () => {
      warnMissingLabel("Button", {});

      expect(console.warn).not.toHaveBeenCalled();
    });

    it("warnMissingAlt does not run in production", () => {
      warnMissingAlt("/image.png", undefined, false);

      expect(console.warn).not.toHaveBeenCalled();
    });

    it("createA11yReport does not run in production", () => {
      createA11yReport({
        missingLabels: 5,
        missingAlt: 3,
        lowContrast: 2,
        keyboardIssues: 1,
        ariaIssues: 0,
        structureIssues: 1,
      });

      expect(console.groupCollapsed).not.toHaveBeenCalled();
    });
  });
});
