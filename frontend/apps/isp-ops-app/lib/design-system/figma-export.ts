/**
 * Figma Design Token Export
 *
 * Exports design tokens in Figma-compatible format
 * Supports both JSON and CSS variable exports
 */

import {
  colorTokens,
  duration,
  easing,
  fontFamily,
  fontWeight,
  portalAnimations,
  portalMetadata,
  portalFontSizes,
  portalSpacing,
  spacing,
  touchTargets,
  type PortalDesignType,
} from "@dotmac/ui";

/**
 * Figma Design Token Format
 * Compatible with Figma Tokens plugin and Design Tokens format
 */
interface FigmaToken {
  value: string | number;
  type: "color" | "dimension" | "fontFamily" | "fontWeight" | "number" | "duration" | "cubicBezier";
  description?: string;
}

interface FigmaTokenSet {
  [key: string]: FigmaToken | FigmaTokenSet;
}

/**
 * Export all design tokens as Figma-compatible JSON
 */
export function exportFigmaTokens(): FigmaTokenSet {
  const tokens: FigmaTokenSet = {
    // Global tokens
    global: {
      spacing: convertSpacingToFigma(spacing),
      fontFamily: {
        sans: {
          value: fontFamily.sans,
          type: "fontFamily",
          description: "Primary font family for UI",
        },
        mono: {
          value: fontFamily.mono,
          type: "fontFamily",
          description: "Monospace font for code",
        },
      },
      fontWeight: convertFontWeightsToFigma(fontWeight),
      duration: convertDurationToFigma(duration),
      easing: convertEasingToFigma(easing),
      touchTargets: {
        minimum: {
          value: touchTargets.minimum,
          type: "dimension",
          description: "WCAG AAA minimum touch target size",
        },
        comfortable: {
          value: touchTargets.comfortable,
          type: "dimension",
          description: "Recommended touch target size",
        },
        generous: {
          value: touchTargets.generous,
          type: "dimension",
          description: "Customer portal touch target size",
        },
      },
    },

    // Semantic colors (shared)
    semantic: {
      success: {
        value: colorTokens.semantic.success,
        type: "color",
        description: "Success state color",
      },
      warning: {
        value: colorTokens.semantic.warning,
        type: "color",
        description: "Warning state color",
      },
      error: {
        value: colorTokens.semantic.error,
        type: "color",
        description: "Error state color",
      },
      info: {
        value: colorTokens.semantic.info,
        type: "color",
        description: "Info state color",
      },
    },

    // Status colors (shared)
    status: {
      online: {
        value: colorTokens.status.online,
        type: "color",
        description: "Device/service online status",
      },
      offline: {
        value: colorTokens.status.offline,
        type: "color",
        description: "Device/service offline status",
      },
      degraded: {
        value: colorTokens.status.degraded,
        type: "color",
        description: "Device/service degraded status",
      },
      unknown: {
        value: colorTokens.status.unknown,
        type: "color",
        description: "Device/service unknown status",
      },
    },
  };

  // Add portal-specific tokens
  const portalTypes: PortalDesignType[] = [
    "platformAdmin",
    "platformResellers",
    "platformTenants",
    "ispAdmin",
    "ispReseller",
    "ispCustomer",
  ];

  portalTypes.forEach((portal) => {
    const meta = portalMetadata[portal];

    tokens[portal] = {
      metadata: {
        name: {
          value: meta.name,
          type: "string" as any,
          description: "Portal display name",
        },
        userType: {
          value: meta.userType,
          type: "string" as any,
          description: "Target user type",
        },
      },
      colors: {
        primary: convertColorScaleToFigma(colorTokens[portal].primary, "Primary color scale"),
        accent: {
          value: colorTokens[portal].accent.DEFAULT,
          type: "color",
          description: "Accent color for highlights",
        },
      },
      fontSize: convertFontSizeToFigma(portalFontSizes[portal]),
      spacing: {
        componentGap: {
          value: portalSpacing[portal].componentGap,
          type: "dimension",
          description: "Gap between components",
        },
        sectionGap: {
          value: portalSpacing[portal].sectionGap,
          type: "dimension",
          description: "Gap between sections",
        },
        pageGutter: {
          value: portalSpacing[portal].pageGutter,
          type: "dimension",
          description: "Page side gutters",
        },
      },
      animations: {
        duration: {
          value: portalAnimations[portal].duration,
          type: "duration",
          description: "Default animation duration",
        },
        easing: {
          value: portalAnimations[portal].easing,
          type: "cubicBezier",
          description: "Default easing function",
        },
        hoverScale: {
          value: portalAnimations[portal].hoverScale,
          type: "number",
          description: "Hover state scale multiplier",
        },
        activeScale: {
          value: portalAnimations[portal].activeScale,
          type: "number",
          description: "Active state scale multiplier",
        },
      },
    };
  });

  return tokens;
}

/**
 * Helper functions to convert tokens to Figma format
 */
function convertSpacingToFigma(spacingScale: typeof spacing): FigmaTokenSet {
  const result: FigmaTokenSet = {};

  Object.entries(spacingScale).forEach(([key, value]) => {
    result[key] = {
      value,
      type: "dimension",
    };
  });

  return result;
}

function convertColorScaleToFigma(
  colorScale: Record<number, string>,
  description: string,
): FigmaTokenSet {
  const result: FigmaTokenSet = {};

  Object.entries(colorScale).forEach(([shade, value]) => {
    result[shade] = {
      value,
      type: "color",
      description: `${description} - shade ${shade}`,
    };
  });

  return result;
}

function convertFontSizeToFigma(fontSizes: any): FigmaTokenSet {
  const result: FigmaTokenSet = {};

  Object.entries(fontSizes).forEach(([size, value]) => {
    const [fontSize, config] = value as [string, { lineHeight: string }];
    result[size] = {
      fontSize: {
        value: fontSize,
        type: "dimension",
      },
      lineHeight: {
        value: config.lineHeight,
        type: "dimension",
      },
    };
  });

  return result;
}

function convertFontWeightsToFigma(weights: typeof fontWeight): FigmaTokenSet {
  const result: FigmaTokenSet = {};

  Object.entries(weights).forEach(([name, value]) => {
    result[name] = {
      value: parseInt(value),
      type: "fontWeight",
    };
  });

  return result;
}

function convertDurationToFigma(durations: typeof duration): FigmaTokenSet {
  const result: FigmaTokenSet = {};

  Object.entries(durations).forEach(([name, value]) => {
    result[name] = {
      value: `${value}ms`,
      type: "duration",
    };
  });

  return result;
}

function convertEasingToFigma(easings: typeof easing): FigmaTokenSet {
  const result: FigmaTokenSet = {};

  Object.entries(easings).forEach(([name, value]) => {
    result[name] = {
      value,
      type: "cubicBezier",
    };
  });

  return result;
}

/**
 * Export tokens as CSS custom properties
 */
export function exportCSSVariables(portal?: PortalDesignType): string {
  const lines: string[] = [
    "/**",
    " * Design System CSS Variables",
    portal ? ` * Portal: ${portal}` : " * All Portals",
    " * Auto-generated - Do not edit manually",
    " */",
    "",
  ];

  if (portal) {
    // Export for specific portal
    lines.push(`:root[data-portal="${portal}"] {`);

    // Colors
    lines.push("  /* Primary Colors */");
    Object.entries(colorTokens[portal].primary).forEach(([shade, value]) => {
      lines.push(`  --portal-primary-${shade}: ${value};`);
    });

    lines.push("");
    lines.push("  /* Accent Color */");
    lines.push(`  --portal-accent: ${colorTokens[portal].accent.DEFAULT};`);

    lines.push("");
    lines.push("  /* Spacing */");
    lines.push(`  --component-gap: ${portalSpacing[portal].componentGap};`);
    lines.push(`  --section-gap: ${portalSpacing[portal].sectionGap};`);
    lines.push(`  --page-gutter: ${portalSpacing[portal].pageGutter};`);

    lines.push("");
    lines.push("  /* Animations */");
    lines.push(`  --animation-duration: ${portalAnimations[portal].duration}ms;`);
    lines.push(`  --animation-easing: ${portalAnimations[portal].easing};`);
    lines.push(`  --hover-scale: ${portalAnimations[portal].hoverScale};`);
    lines.push(`  --active-scale: ${portalAnimations[portal].activeScale};`);

    lines.push("}");
  } else {
    // Export global variables
    lines.push(":root {");

    // Semantic colors
    lines.push("  /* Semantic Colors */");
    Object.entries(colorTokens.semantic).forEach(([name, value]) => {
      lines.push(`  --semantic-${name}: ${value};`);
    });

    lines.push("");
    lines.push("  /* Status Colors */");
    Object.entries(colorTokens.status).forEach(([name, value]) => {
      lines.push(`  --status-${name}: ${value};`);
    });

    lines.push("");
    lines.push("  /* Spacing Scale */");
    Object.entries(spacing).forEach(([key, value]) => {
      lines.push(`  --spacing-${key}: ${value};`);
    });

    lines.push("}");
  }

  return lines.join("\n");
}

/**
 * Export tokens as SCSS variables
 */
export function exportSCSSVariables(portal?: PortalDesignType): string {
  const lines: string[] = [
    "/**",
    " * Design System SCSS Variables",
    portal ? ` * Portal: ${portal}` : " * All Portals",
    " * Auto-generated - Do not edit manually",
    " */",
    "",
  ];

  if (portal) {
    // Export for specific portal
    lines.push(`// ${portalMetadata[portal].name}`);
    lines.push("");

    // Colors
    lines.push("// Primary Colors");
    Object.entries(colorTokens[portal].primary).forEach(([shade, value]) => {
      lines.push(`$portal-primary-${shade}: ${value};`);
    });

    lines.push("");
    lines.push("// Accent Color");
    lines.push(`$portal-accent: ${colorTokens[portal].accent.DEFAULT};`);

    lines.push("");
    lines.push("// Spacing");
    lines.push(`$component-gap: ${portalSpacing[portal].componentGap};`);
    lines.push(`$section-gap: ${portalSpacing[portal].sectionGap};`);
    lines.push(`$page-gutter: ${portalSpacing[portal].pageGutter};`);
  } else {
    // Export global variables
    lines.push("// Semantic Colors");
    Object.entries(colorTokens.semantic).forEach(([name, value]) => {
      lines.push(`$semantic-${name}: ${value};`);
    });

    lines.push("");
    lines.push("// Status Colors");
    Object.entries(colorTokens.status).forEach(([name, value]) => {
      lines.push(`$status-${name}: ${value};`);
    });

    lines.push("");
    lines.push("// Spacing Scale");
    Object.entries(spacing).forEach(([key, value]) => {
      lines.push(`$spacing-${key}: ${value};`);
    });
  }

  return lines.join("\n");
}

/**
 * Download tokens as a file
 */
export function downloadTokens(format: "json" | "css" | "scss", portal?: PortalDesignType) {
  let content: string;
  let filename: string;
  let mimeType: string;

  switch (format) {
    case "json":
      content = JSON.stringify(exportFigmaTokens(), null, 2);
      filename = "design-tokens.json";
      mimeType = "application/json";
      break;

    case "css":
      content = exportCSSVariables(portal);
      filename = portal ? `${portal}-tokens.css` : "design-tokens.css";
      mimeType = "text/css";
      break;

    case "scss":
      content = exportSCSSVariables(portal);
      filename = portal ? `${portal}-tokens.scss` : "design-tokens.scss";
      mimeType = "text/scss";
      break;
  }

  // Create blob and download
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy tokens to clipboard
 */
export async function copyTokensToClipboard(
  format: "json" | "css" | "scss",
  portal?: PortalDesignType,
) {
  let content: string;

  switch (format) {
    case "json":
      content = JSON.stringify(exportFigmaTokens(), null, 2);
      break;
    case "css":
      content = exportCSSVariables(portal);
      break;
    case "scss":
      content = exportSCSSVariables(portal);
      break;
  }

  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}
