/**
 * Portal Theme Demo Page
 *
 * Visual demonstration of portal theme system
 * Shows how colors, typography, and spacing adapt per portal
 */

"use client";

import Link from "next/link";
import { usePortalTheme, portalMetadata } from "@/lib/design-system/portal-themes";
import { portalRoutes, type PortalType } from "@/lib/design-system/tokens/colors";
import {
  PortalBadge,
  PortalBadgeCompact,
  PortalUserTypeBadge,
  PortalIndicatorDot,
} from "@/components/ui/portal-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Palette } from "lucide-react";

export default function ThemeDemoPage() {
  const { currentPortal, theme } = usePortalTheme();

  const allPortals = Object.keys(portalMetadata) as PortalType[];

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Palette className="h-8 w-8 text-portal-primary" />
          <h1 className="text-4xl font-bold">Portal Theme System</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Visual demonstration of the 6-portal design system with automatic theme switching
        </p>
      </div>

      {/* Current Portal Info */}
      <Card className="border-portal-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>{theme.metadata.icon}</span>
            Current Portal: {theme.metadata.name}
          </CardTitle>
          <CardDescription>{theme.metadata.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Primary Color */}
            <div>
              <h3 className="font-medium mb-2">Primary Color</h3>
              <div className="flex items-center gap-2">
                <div
                  className="w-12 h-12 rounded-lg border-2 border-border shadow-sm"
                  style={{ backgroundColor: theme.colors.primary[500] }}
                />
                <div className="text-sm">
                  <div className="font-mono text-xs">{theme.colors.primary[500]}</div>
                  <div className="text-muted-foreground">Primary 500</div>
                </div>
              </div>
            </div>

            {/* Accent Color */}
            <div>
              <h3 className="font-medium mb-2">Accent Color</h3>
              <div className="flex items-center gap-2">
                <div
                  className="w-12 h-12 rounded-lg border-2 border-border shadow-sm"
                  style={{ backgroundColor: theme.colors.accent.DEFAULT }}
                />
                <div className="text-sm">
                  <div className="font-mono text-xs">{theme.colors.accent.DEFAULT}</div>
                  <div className="text-muted-foreground">Accent</div>
                </div>
              </div>
            </div>

            {/* Typography */}
            <div>
              <h3 className="font-medium mb-2">Base Font Size</h3>
              <div className="text-sm">
                <div className="font-mono text-2xl">{theme.fontSize.base[0]}</div>
                <div className="text-muted-foreground">
                  Line height: {theme.fontSize.base[1].lineHeight}
                </div>
              </div>
            </div>

            {/* Spacing */}
            <div>
              <h3 className="font-medium mb-2">Component Gap</h3>
              <div className="text-sm">
                <div className="font-mono text-2xl">{theme.spacing.componentGap}</div>
                <div className="text-muted-foreground">Standard spacing</div>
              </div>
            </div>

            {/* User Type */}
            <div>
              <h3 className="font-medium mb-2">Target User</h3>
              <PortalUserTypeBadge />
            </div>

            {/* Sidebar Style */}
            <div>
              <h3 className="font-medium mb-2">Sidebar Style</h3>
              <div className="text-sm">
                <div className="font-medium capitalize">{theme.colors.sidebar}</div>
                <div className="text-muted-foreground">Navigation preference</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Badge Variants */}
      <Card>
        <CardHeader>
          <CardTitle>Portal Badge Variants</CardTitle>
          <CardDescription>Different styles of portal indicators</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="text-sm font-medium mb-2">Default</div>
              <PortalBadge />
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Short Name</div>
              <PortalBadge shortName />
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Small</div>
              <PortalBadge size="sm" shortName />
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Large</div>
              <PortalBadge size="lg" />
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Compact</div>
              <PortalBadgeCompact />
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Indicator Dot</div>
              <PortalIndicatorDot />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Portal Color Palette */}
      <Card>
        <CardHeader>
          <CardTitle>Primary Color Scale</CardTitle>
          <CardDescription>Full color palette for {theme.metadata.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
            {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => (
              <div key={shade} className="space-y-1">
                <div
                  className="h-16 rounded-lg border shadow-sm"
                  style={{
                    backgroundColor:
                      theme.colors.primary[shade as keyof typeof theme.colors.primary],
                  }}
                />
                <div className="text-xs text-center font-medium">{shade}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Semantic Colors */}
      <Card>
        <CardHeader>
          <CardTitle>Semantic Colors (Shared)</CardTitle>
          <CardDescription>Consistent across all portals for status indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="h-16 rounded-lg bg-portal-success border shadow-sm" />
              <div className="text-sm font-medium">Success</div>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-lg bg-portal-warning border shadow-sm" />
              <div className="text-sm font-medium">Warning</div>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-lg bg-portal-error border shadow-sm" />
              <div className="text-sm font-medium">Error</div>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-lg bg-portal-info border shadow-sm" />
              <div className="text-sm font-medium">Info</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Colors */}
      <Card>
        <CardHeader>
          <CardTitle>Network Status Colors (Shared)</CardTitle>
          <CardDescription>Standard colors for network/service status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="h-16 rounded-lg bg-status-online border shadow-sm" />
              <div className="text-sm font-medium">Online</div>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-lg bg-status-offline border shadow-sm" />
              <div className="text-sm font-medium">Offline</div>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-lg bg-status-degraded border shadow-sm" />
              <div className="text-sm font-medium">Degraded</div>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-lg bg-status-unknown border shadow-sm" />
              <div className="text-sm font-medium">Unknown</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Portal Navigation */}
      <Card>
        <CardHeader>
          <CardTitle>Navigate to Other Portals</CardTitle>
          <CardDescription>Click to switch portals and see theme changes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allPortals.map((portal) => {
              const meta = portalMetadata[portal];
              const route = portalRoutes[portal];
              const isActive = currentPortal === portal;

              return (
                <Link key={portal} href={route}>
                  <Button
                    variant={isActive ? "default" : "outline"}
                    className="w-full h-auto p-4 flex items-start gap-3"
                    disabled={isActive}
                  >
                    <span className="text-2xl shrink-0">{meta.icon}</span>
                    <div className="flex-1 text-left">
                      <div className="font-semibold">{meta.shortName}</div>
                      <div className="text-xs opacity-80">{meta.userType}</div>
                    </div>
                    {!isActive && <ArrowRight className="h-4 w-4 shrink-0" />}
                  </Button>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Typography Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Typography Scale</CardTitle>
          <CardDescription>Font sizes for {theme.metadata.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">4xl</div>
            <div
              style={{
                fontSize: theme.fontSize["4xl"][0],
                lineHeight: theme.fontSize["4xl"][1].lineHeight,
              }}
            >
              The quick brown fox
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">3xl</div>
            <div
              style={{
                fontSize: theme.fontSize["3xl"][0],
                lineHeight: theme.fontSize["3xl"][1].lineHeight,
              }}
            >
              The quick brown fox
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">2xl</div>
            <div
              style={{
                fontSize: theme.fontSize["2xl"][0],
                lineHeight: theme.fontSize["2xl"][1].lineHeight,
              }}
            >
              The quick brown fox
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">xl</div>
            <div
              style={{
                fontSize: theme.fontSize.xl[0],
                lineHeight: theme.fontSize.xl[1].lineHeight,
              }}
            >
              The quick brown fox jumps over the lazy dog
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">base (body text)</div>
            <div
              style={{
                fontSize: theme.fontSize.base[0],
                lineHeight: theme.fontSize.base[1].lineHeight,
              }}
            >
              The quick brown fox jumps over the lazy dog. This is the standard body text size for
              this portal.
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">sm</div>
            <div
              style={{
                fontSize: theme.fontSize.sm[0],
                lineHeight: theme.fontSize.sm[1].lineHeight,
              }}
            >
              The quick brown fox jumps over the lazy dog
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
