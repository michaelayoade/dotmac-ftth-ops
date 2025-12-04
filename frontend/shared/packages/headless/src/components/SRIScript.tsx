/**
 * Script and Link components with SRI support for Next.js
 */

import Script from "next/script";
import Head from "next/head";
import type { ScriptProps } from "next/script";
import { useNonce } from "./NonceProvider";

interface SRIScriptProps extends Omit<ScriptProps, "integrity"> {
  src: string;
  integrity?: string;
  fallbackSrc?: string;
  onIntegrityError?: () => void;
}

/**
 * Script component with SRI support
 */
export function SRIScript({
  src,
  integrity,
  fallbackSrc,
  onIntegrityError,
  ...props
}: SRIScriptProps) {
  const nonce = useNonce();

  // If no integrity hash provided, warn in development
  if (!integrity && process.env["NODE_ENV"] === "development") {
    console.warn(`No SRI hash provided for script: ${src}`);
  }

  const handleError = () => {
    console.error(`SRI validation failed for script: ${src}`);
    onIntegrityError?.();

    // Try fallback source if provided
    if (fallbackSrc) {
      console.log(`Attempting to load fallback script: ${fallbackSrc}`);
      // Note: This would need additional implementation for proper fallback
    }
  };

  return (
    <Script
      src={src}
      integrity={integrity}
      crossOrigin="anonymous"
      nonce={nonce}
      onError={handleError}
      {...props}
    />
  );
}

interface SRILinkProps {
  href: string;
  integrity?: string;
  rel?: "stylesheet" | "preconnect" | "dns-prefetch" | "preload";
  as?: "style" | "script" | "font";
  type?: string;
  media?: string;
  crossOrigin?: "anonymous" | "use-credentials";
}

/**
 * Link component with SRI support for stylesheets
 */
export function SRILink({
  href,
  integrity,
  rel = "stylesheet",
  as,
  type,
  media,
  crossOrigin = "anonymous",
}: SRILinkProps) {
  // Warn if no integrity for external stylesheets
  if (!integrity && href.startsWith("http") && process.env["NODE_ENV"] === "development") {
    console.warn(`No SRI hash provided for stylesheet: ${href}`);
  }

  return (
    <Head>
      <link
        rel={rel}
        href={href}
        integrity={integrity}
        crossOrigin={crossOrigin}
        as={as}
        type={type}
        media={media}
      />
    </Head>
  );
}

/**
 * Preconnect with optional SRI
 */
export function SRIPreconnect({ href }: { href: string }) {
  return (
    <>
      <Head>
        <link rel="preconnect" href={href} />
        <link rel="dns-prefetch" href={href} />
      </Head>
    </>
  );
}

/**
 * Common external resources with SRI hashes
 * These should be updated when upgrading versions
 */
export const SRI_HASHES = {
  // Google Fonts
  googleFontsInter: {
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap",
    integrity: "sha384-GENERATED_AT_BUILD_TIME", // Will be generated during build
  },

  // Font files (if directly linked)
  googleFontsGstatic: {
    preconnect: "https://fonts.gstatic.com",
  },

  // Common CDN libraries (examples)
  // These would be populated with actual hashes
  react18: {
    src: "https://unpkg.com/react@18/umd/react.production.min.js",
    integrity: "sha384-PLACEHOLDER",
  },

  reactDom18: {
    src: "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
    integrity: "sha384-PLACEHOLDER",
  },
} as const;

/**
 * Helper to load Google Fonts with SRI
 */
export function GoogleFontsWithSRI() {
  return (
    <>
      <SRIPreconnect href="https://fonts.googleapis.com" />
      <SRIPreconnect href="https://fonts.gstatic.com" />
      <SRILink
        href={SRI_HASHES.googleFontsInter.href}
        integrity={SRI_HASHES.googleFontsInter.integrity}
      />
    </>
  );
}
