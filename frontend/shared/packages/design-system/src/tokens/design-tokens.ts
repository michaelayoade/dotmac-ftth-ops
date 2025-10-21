/**
 * Design System Tokens
 * Centralized design tokens for consistent theming across ISP Framework
 */

// Color palette
export const colors = {
  // Primary brand colors
  primary: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6", // Main brand color
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
    950: "#172554",
  },

  // Secondary colors
  secondary: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
    950: "#020617",
  },

  // Status colors
  success: {
    50: "#f0fdf4",
    100: "#dcfce7",
    200: "#bbf7d0",
    300: "#86efac",
    400: "#4ade80",
    500: "#22c55e",
    600: "#16a34a",
    700: "#15803d",
    800: "#166534",
    900: "#14532d",
    950: "#052e16",
  },

  warning: {
    50: "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
    950: "#451a03",
  },

  error: {
    50: "#fef2f2",
    100: "#fee2e2",
    200: "#fecaca",
    300: "#fca5a5",
    400: "#f87171",
    500: "#ef4444",
    600: "#dc2626",
    700: "#b91c1c",
    800: "#991b1b",
    900: "#7f1d1d",
    950: "#450a0a",
  },

  info: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
    950: "#172554",
  },

  // Neutral grays
  neutral: {
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    900: "#111827",
    950: "#030712",
  },
} as const;

// Typography scale
export const typography = {
  fontFamilies: {
    sans: ["Inter", "system-ui", "sans-serif"],
    serif: ["Georgia", "serif"],
    mono: ["JetBrains Mono", "Consolas", "monospace"],
  },

  fontSizes: {
    xs: "0.75rem", // 12px
    sm: "0.875rem", // 14px
    base: "1rem", // 16px
    lg: "1.125rem", // 18px
    xl: "1.25rem", // 20px
    "2xl": "1.5rem", // 24px
    "3xl": "1.875rem", // 30px
    "4xl": "2.25rem", // 36px
    "5xl": "3rem", // 48px
    "6xl": "3.75rem", // 60px
    "7xl": "4.5rem", // 72px
    "8xl": "6rem", // 96px
    "9xl": "8rem", // 128px
  },

  fontWeights: {
    thin: 100,
    extralight: 200,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },

  lineHeights: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  letterSpacing: {
    tighter: "-0.05em",
    tight: "-0.025em",
    normal: "0",
    wide: "0.025em",
    wider: "0.05em",
    widest: "0.1em",
  },
} as const;

// Spacing scale (based on 4px grid)
export const spacing = {
  0: "0",
  px: "1px",
  0.5: "0.125rem", // 2px
  1: "0.25rem", // 4px
  1.5: "0.375rem", // 6px
  2: "0.5rem", // 8px
  2.5: "0.625rem", // 10px
  3: "0.75rem", // 12px
  3.5: "0.875rem", // 14px
  4: "1rem", // 16px
  5: "1.25rem", // 20px
  6: "1.5rem", // 24px
  7: "1.75rem", // 28px
  8: "2rem", // 32px
  9: "2.25rem", // 36px
  10: "2.5rem", // 40px
  11: "2.75rem", // 44px
  12: "3rem", // 48px
  14: "3.5rem", // 56px
  16: "4rem", // 64px
  20: "5rem", // 80px
  24: "6rem", // 96px
  28: "7rem", // 112px
  32: "8rem", // 128px
  36: "9rem", // 144px
  40: "10rem", // 160px
  44: "11rem", // 176px
  48: "12rem", // 192px
  52: "13rem", // 208px
  56: "14rem", // 224px
  60: "15rem", // 240px
  64: "16rem", // 256px
  72: "18rem", // 288px
  80: "20rem", // 320px
  96: "24rem", // 384px
} as const;

// Border radius
export const borderRadius = {
  none: "0",
  sm: "0.125rem", // 2px
  base: "0.25rem", // 4px
  md: "0.375rem", // 6px
  lg: "0.5rem", // 8px
  xl: "0.75rem", // 12px
  "2xl": "1rem", // 16px
  "3xl": "1.5rem", // 24px
  full: "9999px",
} as const;

// Box shadows
export const boxShadow = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  base: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
  inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
  none: "none",
} as const;

// Z-index layers
export const zIndex = {
  hide: -1,
  auto: "auto",
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const;

// Animation durations and easings
export const animation = {
  durations: {
    none: "0s",
    fast: "150ms",
    base: "250ms",
    slow: "350ms",
    slower: "500ms",
    slowest: "750ms",
  },

  easings: {
    linear: "linear",
    ease: "ease",
    easeIn: "ease-in",
    easeOut: "ease-out",
    easeInOut: "ease-in-out",
    bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
    smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
  },
} as const;

// Breakpoints for responsive design
export const breakpoints = {
  xs: "320px",
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

// Component-specific tokens
export const components = {
  button: {
    heights: {
      xs: spacing[6],
      sm: spacing[8],
      md: spacing[10],
      lg: spacing[12],
      xl: spacing[14],
    },
    paddingX: {
      xs: spacing[2],
      sm: spacing[3],
      md: spacing[4],
      lg: spacing[6],
      xl: spacing[8],
    },
  },

  input: {
    heights: {
      xs: spacing[6],
      sm: spacing[8],
      md: spacing[10],
      lg: spacing[12],
      xl: spacing[14],
    },
    paddingX: spacing[3],
  },

  card: {
    padding: {
      sm: spacing[3],
      md: spacing[4],
      lg: spacing[6],
      xl: spacing[8],
    },
    borderRadius: borderRadius.lg,
  },

  modal: {
    maxWidths: {
      xs: "20rem",
      sm: "24rem",
      md: "28rem",
      lg: "32rem",
      xl: "36rem",
      "2xl": "42rem",
      "3xl": "48rem",
      "4xl": "56rem",
      "5xl": "64rem",
      "6xl": "72rem",
      "7xl": "80rem",
    },
  },
} as const;

// Theme definitions
export const lightTheme = {
  colors: {
    background: colors.neutral[50],
    surface: colors.neutral[0] || "#ffffff",
    surfaceVariant: colors.neutral[100],
    primary: colors.primary[600],
    primaryVariant: colors.primary[700],
    secondary: colors.secondary[500],
    secondaryVariant: colors.secondary[600],
    text: colors.neutral[900],
    textSecondary: colors.neutral[600],
    textMuted: colors.neutral[500],
    border: colors.neutral[200],
    borderLight: colors.neutral[100],
    success: colors.success[600],
    warning: colors.warning[500],
    error: colors.error[600],
    info: colors.info[600],
  },
} as const;

export const darkTheme = {
  colors: {
    background: colors.neutral[900],
    surface: colors.neutral[800],
    surfaceVariant: colors.neutral[700],
    primary: colors.primary[400],
    primaryVariant: colors.primary[300],
    secondary: colors.secondary[400],
    secondaryVariant: colors.secondary[300],
    text: colors.neutral[100],
    textSecondary: colors.neutral[300],
    textMuted: colors.neutral[400],
    border: colors.neutral[600],
    borderLight: colors.neutral[700],
    success: colors.success[400],
    warning: colors.warning[400],
    error: colors.error[400],
    info: colors.info[400],
  },
} as const;

// CSS Custom Properties generator
export const generateCSSCustomProperties = (theme: typeof lightTheme | typeof darkTheme) => {
  const cssVars: Record<string, string> = {};

  // Generate color variables
  Object.entries(theme.colors).forEach(([key, value]) => {
    cssVars[`--color-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`] = value;
  });

  // Generate spacing variables
  Object.entries(spacing).forEach(([key, value]) => {
    cssVars[`--spacing-${key.replace(".", "-")}`] = value;
  });

  // Generate typography variables
  Object.entries(typography.fontSizes).forEach(([key, value]) => {
    cssVars[`--font-size-${key}`] = value;
  });

  Object.entries(typography.fontWeights).forEach(([key, value]) => {
    cssVars[`--font-weight-${key}`] = value.toString();
  });

  Object.entries(typography.lineHeights).forEach(([key, value]) => {
    cssVars[`--line-height-${key}`] = value.toString();
  });

  // Generate border radius variables
  Object.entries(borderRadius).forEach(([key, value]) => {
    cssVars[`--border-radius-${key}`] = value;
  });

  // Generate shadow variables
  Object.entries(boxShadow).forEach(([key, value]) => {
    cssVars[`--shadow-${key}`] = value;
  });

  // Generate z-index variables
  Object.entries(zIndex).forEach(([key, value]) => {
    cssVars[`--z-index-${key}`] = value.toString();
  });

  // Generate animation variables
  Object.entries(animation.durations).forEach(([key, value]) => {
    cssVars[`--duration-${key}`] = value;
  });

  Object.entries(animation.easings).forEach(([key, value]) => {
    cssVars[`--easing-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`] = value;
  });

  return cssVars;
};

// Export complete design system
export const designTokens = {
  colors,
  typography,
  spacing,
  borderRadius,
  boxShadow,
  zIndex,
  animation,
  breakpoints,
  components,
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
  generateCSSCustomProperties,
} as const;

export default designTokens;
