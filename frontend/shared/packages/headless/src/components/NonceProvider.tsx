/**
 * NonceProvider - Client-side nonce utilities
 */

import Script from "next/script";
import type React from "react";

/**
 * Hook to get nonce on client side (for dynamic script injection)
 */
export function useNonce(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const meta = document.querySelector('meta[name="csp-nonce"]');
  return meta?.getAttribute("content") || "";
}

/**
 * Script component with nonce support for client components
 */
export function NonceScript({
  children,
  nonce,
  ...props
}: {
  children?: React.ReactNode;
  nonce?: string;
  id?: string;
  strategy?: "beforeInteractive" | "afterInteractive" | "lazyOnload";
  src?: string;
}) {
  const currentNonce = nonce || useNonce();

  if (props.src) {
    // External script
    return <Script nonce={currentNonce} {...props} />;
  }

  // Inline script
  return (
    <script
      nonce={currentNonce}
      dangerouslySetInnerHTML={{
        __html: children as string,
      }}
      {...props}
    />
  );
}

/**
 * Simple provider component for client-side usage
 */
export function NonceProvider({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <>
      {nonce && <meta name="csp-nonce" content={nonce} />}
      {children}
    </>
  );
}
