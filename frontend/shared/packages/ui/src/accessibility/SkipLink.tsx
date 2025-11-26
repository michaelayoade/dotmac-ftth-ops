/**
 * SkipLink Component
 *
 * Allows keyboard users to skip navigation and jump to main content
 * WCAG 2.4.1 Level A requirement
 */

"use client";

import { useTranslations } from "next-intl";

interface SkipLinkProps {
  /** Target element ID to skip to */
  href: string;
  /** Custom label (defaults to translated "Skip to main content") */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SkipLink - Accessible skip navigation link
 *
 * @example
 * ```tsx
 * // In your layout
 * export function Layout({ children }) {
 *   return (
 *     <>
 *       <SkipLink href="#main-content" />
 *       <nav>...</nav>
 *       <main id="main-content" tabIndex={-1}>
 *         {children}
 *       </main>
 *     </>
 *   );
 * }
 * ```
 */
export function SkipLink({ href, children, className }: SkipLinkProps) {
  const t = useTranslations("accessibility");

  return (
    <a
      href={href}
      className={`
        sr-only
        focus:not-sr-only
        focus:absolute
        focus:top-4
        focus:left-4
        focus:z-50
        focus:px-4
        focus:py-2
        focus:bg-primary
        focus:text-primary-foreground
        focus:rounded
        focus:outline-none
        focus:ring-2
        focus:ring-ring
        focus:ring-offset-2
        ${className || ""}
      `.trim()}
    >
      {children || t("skipToMainContent")}
    </a>
  );
}

/**
 * Multiple skip links for complex layouts
 *
 * @example
 * ```tsx
 * <SkipLinks
 *   links={[
 *     { href: '#main-content', label: 'Skip to main content' },
 *     { href: '#search', label: 'Skip to search' },
 *     { href: '#footer', label: 'Skip to footer' },
 *   ]}
 * />
 * ```
 */
export function SkipLinks({ links }: { links: Array<{ href: string; label: string }> }) {
  return (
    <div className="skip-links">
      {links.map((link) => (
        <SkipLink key={link.href} href={link.href}>
          {link.label}
        </SkipLink>
      ))}
    </div>
  );
}
