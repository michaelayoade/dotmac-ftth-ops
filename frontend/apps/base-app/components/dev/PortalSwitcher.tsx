/**
 * Portal Switcher Component (Development Tool)
 *
 * Allows developers to quickly switch between portals for testing
 * Only visible in development mode
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { portalRoutes, type PortalType } from "@/lib/design-system/tokens/colors";
import { Palette, ChevronDown } from "lucide-react";

/**
 * Portal Switcher - Development tool for testing portal themes
 *
 * @example
 * ```tsx
 * // In a dev-only sidebar or settings panel
 * {process.env.NODE_ENV === 'development' && <PortalSwitcher />}
 * ```
 */
export function PortalSwitcher() {
  const router = useRouter();
  const { currentPortal, theme } = usePortalTheme();
  const [isOpen, setIsOpen] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const handlePortalSwitch = (portal: PortalType) => {
    const route = portalRoutes[portal];
    router.push(route);
    setIsOpen(false);
  };

  const currentMetadata = portalMetadata[currentPortal];

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 shadow-lg border-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
            aria-label="Open portal switcher"
          >
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">{currentMetadata.icon}</span>
            <span className="hidden md:inline">{currentMetadata.shortName}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Switch Portal (Dev Only)
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Platform Portals */}
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Platform Portals
          </DropdownMenuLabel>
          {(["platformAdmin", "platformResellers", "platformTenants"] as const).map((portal) => {
            const meta = portalMetadata[portal];
            const isActive = currentPortal === portal;

            return (
              <DropdownMenuItem
                key={portal}
                onClick={() => handlePortalSwitch(portal)}
                className={isActive ? "bg-accent" : ""}
              >
                <div className="flex items-center gap-3 w-full">
                  <span className="text-lg">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{meta.shortName}</div>
                    <div className="text-xs text-muted-foreground truncate">{meta.userType}</div>
                  </div>
                  {isActive && <div className="w-2 h-2 rounded-full bg-portal-primary shrink-0" />}
                </div>
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator />

          {/* ISP Portals */}
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            ISP Portals
          </DropdownMenuLabel>
          {(["ispAdmin", "ispReseller", "ispCustomer"] as const).map((portal) => {
            const meta = portalMetadata[portal];
            const isActive = currentPortal === portal;

            return (
              <DropdownMenuItem
                key={portal}
                onClick={() => handlePortalSwitch(portal)}
                className={isActive ? "bg-accent" : ""}
              >
                <div className="flex items-center gap-3 w-full">
                  <span className="text-lg">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{meta.shortName}</div>
                    <div className="text-xs text-muted-foreground truncate">{meta.userType}</div>
                  </div>
                  {isActive && <div className="w-2 h-2 rounded-full bg-portal-primary shrink-0" />}
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * Portal Theme Debug Panel - Shows current theme values
 */
export function PortalThemeDebug() {
  const { currentPortal, theme } = usePortalTheme();

  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className="fixed bottom-16 right-4 z-40 max-w-xs">
      <details className="bg-background border-2 rounded-lg shadow-lg p-3 text-xs">
        <summary className="cursor-pointer font-medium flex items-center gap-2">
          <Palette className="h-3 w-3" />
          Theme Debug
        </summary>
        <div className="mt-2 space-y-2">
          <div>
            <div className="font-medium text-muted-foreground">Portal:</div>
            <div className="font-mono">{currentPortal}</div>
          </div>
          <div>
            <div className="font-medium text-muted-foreground">Primary Color:</div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border"
                style={{ backgroundColor: theme.colors.primary[500] }}
              />
              <div className="font-mono text-xs">{theme.colors.primary[500]}</div>
            </div>
          </div>
          <div>
            <div className="font-medium text-muted-foreground">Accent Color:</div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border"
                style={{ backgroundColor: theme.colors.accent.DEFAULT }}
              />
              <div className="font-mono text-xs">{theme.colors.accent.DEFAULT}</div>
            </div>
          </div>
          <div>
            <div className="font-medium text-muted-foreground">Font Base:</div>
            <div className="font-mono">{theme.fontSize.base[0]}</div>
          </div>
          <div>
            <div className="font-medium text-muted-foreground">Component Gap:</div>
            <div className="font-mono">{theme.spacing.componentGap}</div>
          </div>
        </div>
      </details>
    </div>
  );
}
