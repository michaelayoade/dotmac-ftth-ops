/**
 * Design System - Spacing Tokens
 *
 * Consistent spacing scale across all portals
 * Based on 4px grid system
 */

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

/**
 * Portal-specific spacing adjustments
 * Customer portal uses more generous spacing for accessibility
 */
export const portalSpacing = {
  platformAdmin: {
    componentGap: spacing[4], // 16px - Dense
    sectionGap: spacing[6], // 24px
    pageGutter: spacing[6], // 24px
  },
  platformResellers: {
    componentGap: spacing[4], // 16px
    sectionGap: spacing[8], // 32px
    pageGutter: spacing[8], // 32px
  },
  platformTenants: {
    componentGap: spacing[4], // 16px
    sectionGap: spacing[8], // 32px
    pageGutter: spacing[8], // 32px
  },
  ispAdmin: {
    componentGap: spacing[4], // 16px - Dense
    sectionGap: spacing[6], // 24px
    pageGutter: spacing[6], // 24px
  },
  ispReseller: {
    componentGap: spacing[6], // 24px - Mobile-friendly
    sectionGap: spacing[8], // 32px
    pageGutter: spacing[4], // 16px on mobile
  },
  ispCustomer: {
    componentGap: spacing[8], // 32px - Very generous
    sectionGap: spacing[12], // 48px
    pageGutter: spacing[6], // 24px
  },
} as const;

/**
 * Touch target sizes (especially for mobile portals)
 */
export const touchTargets = {
  minimum: spacing[11], // 44px - WCAG AAA
  comfortable: spacing[12], // 48px - Recommended
  generous: spacing[14], // 56px - Customer portal
} as const;
