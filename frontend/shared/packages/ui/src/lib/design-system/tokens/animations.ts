/**
 * Design System - Animation Tokens
 *
 * Portal-specific animations and transitions
 * Each portal has unique animation characteristics matching its personality
 */

import type { PortalType } from "./colors";

/**
 * Animation durations (ms)
 */
export const duration = {
  instant: 0,
  fast: 150,
  normal: 250,
  slow: 350,
  slower: 500,
  slowest: 750,
} as const;

/**
 * Easing functions
 */
export const easing = {
  // Standard easings
  linear: "linear",
  ease: "ease",
  easeIn: "ease-in",
  easeOut: "ease-out",
  easeInOut: "ease-in-out",

  // Custom cubic-bezier easings
  smooth: "cubic-bezier(0.4, 0.0, 0.2, 1)", // Material Design standard
  sharp: "cubic-bezier(0.4, 0.0, 0.6, 1)", // Emphasized deceleration
  snappy: "cubic-bezier(0.0, 0.0, 0.2, 1)", // Sharp entrance
  bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)", // Bounce effect
  elastic: "cubic-bezier(0.175, 0.885, 0.32, 1.275)", // Elastic effect
} as const;

/**
 * Portal-specific animation preferences
 * Each portal has a personality that influences animation style
 */
export const portalAnimations = {
  /**
   * Platform Admin - Fast, efficient, minimal
   * Staff need speed and clarity, not fancy animations
   */
  platformAdmin: {
    duration: duration.fast,
    easing: easing.sharp,
    hoverScale: 1.02, // Subtle hover effects
    activeScale: 0.98, // Quick feedback
    reducedMotion: true, // Respect accessibility more strictly
    pageTransition: "fade", // Simple fade transitions
  },

  /**
   * Platform Resellers - Energetic, responsive, engaging
   * Sales-focused, needs to feel dynamic and exciting
   */
  platformResellers: {
    duration: duration.normal,
    easing: easing.bounce,
    hoverScale: 1.05, // More pronounced hover
    activeScale: 0.95, // Satisfying click feedback
    reducedMotion: false,
    pageTransition: "slideUp",
  },

  /**
   * Platform Tenants - Professional, smooth, polished
   * Business users expect refinement
   */
  platformTenants: {
    duration: duration.normal,
    easing: easing.smooth,
    hoverScale: 1.03,
    activeScale: 0.97,
    reducedMotion: false,
    pageTransition: "slideRight",
  },

  /**
   * ISP Admin - Fast, precise, functional
   * Operational work requires efficiency
   */
  ispAdmin: {
    duration: duration.fast,
    easing: easing.sharp,
    hoverScale: 1.02,
    activeScale: 0.98,
    reducedMotion: true,
    pageTransition: "fade",
  },

  /**
   * ISP Reseller - Playful, mobile-optimized, fun
   * Often on mobile, needs to feel responsive and enjoyable
   */
  ispReseller: {
    duration: duration.normal,
    easing: easing.elastic,
    hoverScale: 1.08, // Exaggerated for mobile
    activeScale: 0.92, // Clear tactile feedback
    reducedMotion: false,
    pageTransition: "scale",
  },

  /**
   * ISP Customer - Gentle, accessible, reassuring
   * Non-technical users need calm, predictable animations
   */
  ispCustomer: {
    duration: duration.slow, // Slower, more gentle
    easing: easing.smooth,
    hoverScale: 1.02, // Very subtle
    activeScale: 0.98,
    reducedMotion: true, // Strongly respect reduced motion
    pageTransition: "fade",
  },
} as const;

/**
 * Page transition variants
 */
export const pageTransitions = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  slideRight: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.05 },
  },
} as const;

/**
 * Skeleton loading animations (portal-aware)
 */
export const skeletonAnimations = {
  pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
  wave: "wave 2s linear infinite",
  shimmer: "shimmer 2s linear infinite",
} as const;

/**
 * Get animation config for a specific portal
 */
export function getPortalAnimations(portal: PortalType) {
  return portalAnimations[portal];
}

/**
 * Create transition string from portal config
 */
export function createTransition(portal: PortalType, properties: string[] = ["all"]): string {
  const config = portalAnimations[portal];
  return properties.map((prop) => `${prop} ${config.duration}ms ${config.easing}`).join(", ");
}

/**
 * Keyframe animations (for Tailwind)
 */
export const keyframes = {
  // Fade animations
  fadeIn: {
    "0%": { opacity: "0" },
    "100%": { opacity: "1" },
  },
  fadeOut: {
    "0%": { opacity: "1" },
    "100%": { opacity: "0" },
  },

  // Slide animations
  slideInUp: {
    "0%": { transform: "translateY(100%)", opacity: "0" },
    "100%": { transform: "translateY(0)", opacity: "1" },
  },
  slideOutDown: {
    "0%": { transform: "translateY(0)", opacity: "1" },
    "100%": { transform: "translateY(100%)", opacity: "0" },
  },

  // Scale animations
  scaleIn: {
    "0%": { transform: "scale(0.9)", opacity: "0" },
    "100%": { transform: "scale(1)", opacity: "1" },
  },
  scaleOut: {
    "0%": { transform: "scale(1)", opacity: "1" },
    "100%": { transform: "scale(0.9)", opacity: "0" },
  },

  // Bounce animation
  bounce: {
    "0%, 100%": { transform: "translateY(0)" },
    "50%": { transform: "translateY(-10px)" },
  },

  // Pulse animation
  pulse: {
    "0%, 100%": { opacity: "1" },
    "50%": { opacity: "0.5" },
  },

  // Shimmer animation (for skeletons)
  shimmer: {
    "0%": { backgroundPosition: "-1000px 0" },
    "100%": { backgroundPosition: "1000px 0" },
  },

  // Wave animation (for skeletons)
  wave: {
    "0%": { transform: "translateX(-100%)" },
    "100%": { transform: "translateX(100%)" },
  },

  // Spin animation
  spin: {
    "0%": { transform: "rotate(0deg)" },
    "100%": { transform: "rotate(360deg)" },
  },

  // Ping animation (notification indicator)
  ping: {
    "0%": { transform: "scale(1)", opacity: "1" },
    "75%, 100%": { transform: "scale(2)", opacity: "0" },
  },
} as const;

/**
 * Reduced motion detection utility
 */
export function shouldReduceMotion(portal: PortalType): boolean {
  // Check user's system preference
  if (typeof window !== "undefined") {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) return true;
  }

  // Some portals default to reduced motion
  return portalAnimations[portal].reducedMotion;
}

/**
 * Get safe animation duration (respects reduced motion)
 */
export function getSafeAnimationDuration(portal: PortalType): number {
  return shouldReduceMotion(portal) ? 0 : portalAnimations[portal].duration;
}

/**
 * Animation presets for common UI patterns
 */
export const animationPresets = {
  // Button interactions
  button: {
    hover: "transform transition-transform duration-150 ease-out hover:scale-105",
    active: "active:scale-95",
    disabled: "disabled:opacity-50 disabled:cursor-not-allowed",
  },

  // Card interactions
  card: {
    hover: "transition-all duration-250 ease-smooth hover:shadow-lg hover:-translate-y-1",
    interactive: "cursor-pointer transition-all duration-250",
  },

  // Modal/Dialog
  modal: {
    overlay: "animate-fadeIn",
    content: "animate-scaleIn",
  },

  // Toast notifications
  toast: {
    enter: "animate-slideInUp",
    exit: "animate-slideOutDown",
  },

  // Skeleton loading
  skeleton: {
    pulse: "animate-pulse",
    shimmer: "animate-shimmer",
  },
} as const;
