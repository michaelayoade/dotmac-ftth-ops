declare module "@dotmac/utils/a11y-dev-warnings" {
  export function warnMissingLabel(
    componentName: string,
    props: Record<string, unknown>,
    requiredProps?: string[],
  ): void;
  export function warnMissingAlt(
    src: string | undefined,
    alt: string | undefined,
    isDecorative?: boolean,
  ): void;
  export function warnMissingFormLabel(
    inputId: string | undefined,
    labelProps: {
      "aria-label"?: string;
      "aria-labelledby"?: string;
      htmlFor?: string;
    },
  ): void;
  export function warnMissingButtonType(
    type: "button" | "submit" | "reset" | undefined,
    isInsideForm: boolean,
  ): void;
  export function warnSkippedHeadingLevel(currentLevel: number, previousLevel: number | null): void;
  export function warnNotKeyboardAccessible(
    element: string,
    hasOnClick: boolean,
    hasTabIndex: boolean,
    hasRole: boolean,
  ): void;
  export function warnMissingAltTextForBackgroundImages(element: string, hasAltText: boolean): void;
}
