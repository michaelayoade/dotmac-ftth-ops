/**
 * Subresource Integrity (SRI) utilities for securing external resources
 */

import { createHash } from "crypto";
import fetch from "node-fetch";

/**
 * Supported hash algorithms for SRI
 */
export type SRIAlgorithm = "sha256" | "sha384" | "sha512";

/**
 * Generate SRI hash for content
 */
export function generateSRIHash(
  content: string | Buffer,
  algorithm: SRIAlgorithm = "sha384",
): string {
  const hash = createHash(algorithm);
  hash.update(content);
  const digest = hash.digest("base64");
  return `${algorithm}-${digest}`;
}

/**
 * Generate SRI hash from a URL
 */
export async function generateSRIHashFromURL(
  url: string,
  algorithm: SRIAlgorithm = "sha384",
): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch resource: ${response.statusText}`);
    }
    const content = await response.text();
    return generateSRIHash(content, algorithm);
  } catch (error) {
    console.error(`Failed to generate SRI hash for ${url}:`, error);
    throw error;
  }
}

/**
 * Verify SRI hash matches content
 */
export function verifySRIHash(content: string | Buffer, sriHash: string): boolean {
  const [algorithm, expectedHash] = sriHash.split("-") as [SRIAlgorithm, string];
  const actualHash = generateSRIHash(content, algorithm);
  return actualHash === sriHash;
}

/**
 * Generate multiple SRI hashes for fallback
 */
export function generateSRIHashes(
  content: string | Buffer,
  algorithms: SRIAlgorithm[] = ["sha256", "sha384", "sha512"],
): string {
  return algorithms.map((algorithm) => generateSRIHash(content, algorithm)).join(" ");
}

/**
 * Known SRI hashes for common CDN resources
 * These should be updated when upgrading library versions
 */
export const KNOWN_SRI_HASHES = {
  // Google Fonts - Inter font
  "fonts.googleapis.com/css2?family=Inter": {
    hash: "sha384-PLACEHOLDER", // Will be generated at build time
    crossorigin: "anonymous",
  },
  // Add more known resources as needed
} as const;

/**
 * Generate script tag with SRI
 */
export function generateScriptTag(
  src: string,
  integrity: string,
  options?: {
    async?: boolean;
    defer?: boolean;
    crossorigin?: "anonymous" | "use-credentials";
    nonce?: string;
  },
): string {
  const attrs = [
    `src="${src}"`,
    `integrity="${integrity}"`,
    options?.crossorigin ? `crossorigin="${options.crossorigin}"` : 'crossorigin="anonymous"',
    options?.async ? "async" : "",
    options?.defer ? "defer" : "",
    options?.nonce ? `nonce="${options.nonce}"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `<script ${attrs}></script>`;
}

/**
 * Generate link tag with SRI for stylesheets
 */
export function generateLinkTag(
  href: string,
  integrity: string,
  options?: {
    crossorigin?: "anonymous" | "use-credentials";
    media?: string;
  },
): string {
  const attrs = [
    'rel="stylesheet"',
    `href="${href}"`,
    `integrity="${integrity}"`,
    options?.crossorigin ? `crossorigin="${options.crossorigin}"` : 'crossorigin="anonymous"',
    options?.media ? `media="${options.media}"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `<link ${attrs}>`;
}

/**
 * Component props for Next.js Script with SRI
 */
export interface ScriptWithSRIProps {
  src: string;
  integrity?: string;
  strategy?: "beforeInteractive" | "afterInteractive" | "lazyOnload";
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Component props for Next.js Link with SRI
 */
export interface LinkWithSRIProps {
  href: string;
  integrity?: string;
  media?: string;
}

/**
 * Build-time function to generate SRI manifest
 */
export async function generateSRIManifest(
  resources: Array<{ url: string; type: "script" | "style" }>,
): Promise<Record<string, { hash: string; type: string }>> {
  const manifest: Record<string, { hash: string; type: string }> = {};

  for (const resource of resources) {
    try {
      const hash = await generateSRIHashFromURL(resource.url);
      manifest[resource.url] = {
        hash,
        type: resource.type,
      };
    } catch (error) {
      console.warn(`Failed to generate SRI for ${resource.url}:`, error);
    }
  }

  return manifest;
}

/**
 * Validate all SRI hashes in HTML
 */
export function validateSRIInHTML(html: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check script tags
  const scriptRegex = /<script[^>]*integrity="([^"]*)"[^>]*src="([^"]*)"[^>]*>/g;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const [, integrity, src] = match;
    if (!integrity || !integrity.match(/^(sha256|sha384|sha512)-/)) {
      errors.push(`Invalid SRI hash for script: ${src}`);
    }
  }

  // Check link tags
  const linkRegex = /<link[^>]*integrity="([^"]*)"[^>]*href="([^"]*)"[^>]*>/g;
  while ((match = linkRegex.exec(html)) !== null) {
    const [, integrity, href] = match;
    if (!integrity || !integrity.match(/^(sha256|sha384|sha512)-/)) {
      errors.push(`Invalid SRI hash for stylesheet: ${href}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
