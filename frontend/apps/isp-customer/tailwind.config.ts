import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./providers/**/*.{ts,tsx}",
    "../../shared/packages/ui/src/**/*.{ts,tsx}",
    "../../shared/packages/primitives/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Portal-specific colors (injected via CSS variables)
        portal: {
          primary: {
            50: "var(--portal-primary-50)",
            100: "var(--portal-primary-100)",
            200: "var(--portal-primary-200)",
            300: "var(--portal-primary-300)",
            400: "var(--portal-primary-400)",
            500: "var(--portal-primary-500)",
            600: "var(--portal-primary-600)",
            700: "var(--portal-primary-700)",
            800: "var(--portal-primary-800)",
            900: "var(--portal-primary-900)",
            DEFAULT: "var(--portal-primary-500)",
          },
          accent: "var(--portal-accent)",
          success: "var(--portal-success)",
          warning: "var(--portal-warning)",
          error: "var(--portal-error)",
          info: "var(--portal-info)",
        },
        brand: {
          DEFAULT: "var(--brand-primary)",
          foreground: "var(--brand-primary-foreground)",
          hover: "var(--brand-primary-hover)",
        },
        // Theme-aware colors using CSS variables
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "var(--radius-lg, 0.5rem)",
        md: "var(--radius-md, 0.375rem)",
        sm: "var(--radius-sm, 0.25rem)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeOut: {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        fadeIn: "fadeIn 250ms ease-out",
        fadeOut: "fadeOut 250ms ease-out",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
