import type { Config } from "tailwindcss";
import { keyframes } from "../../shared/packages/ui/src/lib/design-system/tokens/animations";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../shared/packages/ui/src/**/*.{ts,tsx}",
    "../../shared/packages/design-system/src/**/*.{ts,tsx}",
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
        // Network status colors
        status: {
          online: "var(--portal-status-online)",
          offline: "var(--portal-status-offline)",
          degraded: "var(--portal-status-degraded)",
          unknown: "var(--portal-status-unknown)",
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
        "brand-accent": "var(--brand-accent)",
        "brand-accent-foreground": "var(--brand-accent-foreground)",
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
      },
      keyframes,
      animation: {
        // Fade animations
        fadeIn: "fadeIn 250ms ease-smooth",
        fadeOut: "fadeOut 250ms ease-smooth",
        // Slide animations
        slideInUp: "slideInUp 350ms ease-smooth",
        slideOutDown: "slideOutDown 350ms ease-smooth",
        // Scale animations
        scaleIn: "scaleIn 250ms ease-smooth",
        scaleOut: "scaleOut 250ms ease-smooth",
        // Utility animations
        bounce: "bounce 1s infinite",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        spin: "spin 1s linear infinite",
        ping: "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite",
        shimmer: "shimmer 2s linear infinite",
        wave: "wave 2s linear infinite",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0.0, 0.2, 1)",
        sharp: "cubic-bezier(0.4, 0.0, 0.6, 1)",
        snappy: "cubic-bezier(0.0, 0.0, 0.2, 1)",
        bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        elastic: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      },
    },
  },
  plugins: [],
};

export default config;
