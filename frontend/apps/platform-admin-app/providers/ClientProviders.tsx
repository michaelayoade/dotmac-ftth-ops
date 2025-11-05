"use client";

import { ReactNode, useState } from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { AppConfigProvider } from "./AppConfigContext";
import { MSWProvider } from "./MSWProvider";
import { platformConfig } from "@/lib/config";
import { TenantProvider } from "@/lib/contexts/tenant-context";
import { RBACProvider } from "@/contexts/RBACContext";
import { AuthProvider } from "@/hooks/useAuth";
import { ToastContainer } from "@/components/ui/toast";
import { BrandingProvider } from "@/providers/BrandingProvider";
import { ApolloProvider } from "@/lib/graphql/ApolloProvider";
import { PortalThemeProvider } from "@/lib/design-system/portal-themes";
import {
  AccessibilityProvider,
  LiveRegionAnnouncer,
  SkipToMainContent,
  KeyboardShortcuts,
} from "@/lib/design-system/accessibility";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog-provider";

export function ClientProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [queryClient] = useState(() => new QueryClient());

  const shouldWrapWithRBAC =
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/tenant-portal") ||
    pathname?.startsWith("/partner");

  const appProviders = (
    <AppConfigProvider value={platformConfig}>
      <ConfirmDialogProvider>
        <BrandingProvider>
          <SkipToMainContent />
          {children}
          <LiveRegionAnnouncer />
          <KeyboardShortcuts />
        </BrandingProvider>
        <ToastContainer />
      </ConfirmDialogProvider>
    </AppConfigProvider>
  );

  return (
    <MSWProvider>
      <PortalThemeProvider>
        <AccessibilityProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <QueryClientProvider client={queryClient}>
              <ApolloProvider>
                <TenantProvider>
                  <AuthProvider>
                    {shouldWrapWithRBAC ? (
                      <RBACProvider>{appProviders}</RBACProvider>
                    ) : (
                      appProviders
                    )}
                  </AuthProvider>
                </TenantProvider>
              </ApolloProvider>
            </QueryClientProvider>
          </ThemeProvider>
        </AccessibilityProvider>
      </PortalThemeProvider>
    </MSWProvider>
  );
}
