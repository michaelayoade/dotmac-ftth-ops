/**
 * Design Token Exporter Component
 *
 * UI for exporting design tokens in various formats
 * Development tool for designers and developers
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePortalTheme, portalMetadata } from "@/lib/design-system/portal-themes";
import type { PortalType } from "@/lib/design-system/tokens/colors";
import { downloadTokens, copyTokensToClipboard } from "@/lib/design-system/figma-export";
import { Download, Copy, FileJson, FileCode, Check } from "lucide-react";

/**
 * Design Token Exporter
 * Development tool for exporting design tokens
 */
export function DesignTokenExporter() {
  const { currentPortal } = usePortalTheme();
  const [copied, setCopied] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const handleDownload = (format: "json" | "css" | "scss", portal?: PortalType) => {
    downloadTokens(format, portal);
  };

  const handleCopy = async (format: "json" | "css" | "scss", portal?: PortalType) => {
    const success = await copyTokensToClipboard(format, portal);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed bottom-32 right-4 z-40 flex gap-2">
      {/* Download Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 shadow-lg border-2 bg-background/95 backdrop-blur"
          >
            <Download className="h-4 w-4" />
            <span className="hidden md:inline">Export Tokens</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Export Design Tokens</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuLabel className="text-xs text-muted-foreground">
            All Portals
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => handleDownload("json")}>
            <FileJson className="h-4 w-4 mr-2" />
            Figma JSON (All Portals)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleDownload("css")}>
            <FileCode className="h-4 w-4 mr-2" />
            CSS Variables (Global)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleDownload("scss")}>
            <FileCode className="h-4 w-4 mr-2" />
            SCSS Variables (Global)
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Current Portal ({portalMetadata[currentPortal].shortName})
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => handleDownload("css", currentPortal)}>
            <FileCode className="h-4 w-4 mr-2" />
            CSS Variables
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleDownload("scss", currentPortal)}>
            <FileCode className="h-4 w-4 mr-2" />
            SCSS Variables
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Copy Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 shadow-lg border-2 bg-background/95 backdrop-blur"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            <span className="hidden md:inline">{copied ? "Copied!" : "Copy"}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Copy to Clipboard</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuLabel className="text-xs text-muted-foreground">
            All Portals
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => handleCopy("json")}>
            <FileJson className="h-4 w-4 mr-2" />
            Figma JSON (All Portals)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCopy("css")}>
            <FileCode className="h-4 w-4 mr-2" />
            CSS Variables (Global)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCopy("scss")}>
            <FileCode className="h-4 w-4 mr-2" />
            SCSS Variables (Global)
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Current Portal ({portalMetadata[currentPortal].shortName})
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => handleCopy("css", currentPortal)}>
            <FileCode className="h-4 w-4 mr-2" />
            CSS Variables
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCopy("scss", currentPortal)}>
            <FileCode className="h-4 w-4 mr-2" />
            SCSS Variables
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
