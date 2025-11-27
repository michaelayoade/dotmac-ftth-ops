"use client";

import { ReactNode, useMemo, useState } from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { AppConfigProvider } from "./AppConfigContext";
import { MSWProvider } from "./MSWProvider";
import { platformConfig } from "@/lib/config";
import { TenantProvider } from "@/lib/contexts/tenant-context";
import { RBACProvider } from "@/contexts/RBACContext";
import { PartnerTenantProvider } from "@/contexts/PartnerTenantContext";
import { ToastContainer } from "@dotmac/ui";
import { BrandingProvider } from "@/providers/BrandingProvider";
import { ApolloProvider } from "@/lib/graphql/ApolloProvider";
import { PortalThemeProvider } from "@dotmac/ui";
import {
  AccessibilityProvider,
  LiveRegionAnnouncer,
  SkipToMainContent,
  KeyboardShortcuts,
} from "@/lib/design-system/accessibility";
import { ConfirmDialogProvider } from "@dotmac/ui";
import { AuthProvider } from "@shared/lib/auth";
// import { useRuntimeConfigState } from "@shared/runtime/RuntimeConfigContext";

export function ClientProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [queryClient] = useState(() => new QueryClient());
  // const { runtimeConfig } = useRuntimeConfigState();

  const appConfigValue = useMemo(() => {
    return {
      ...platformConfig,
      api: { ...platformConfig.api },
      features: { ...platformConfig.features },
      branding: { ...platformConfig.branding },
      tenant: { ...platformConfig.tenant },
    };
  }, []);

  const shouldWrapWithRBAC =
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/customer-portal") ||
    pathname?.startsWith("/partner");

  const appProviders = (
    <AppConfigProvider value={appConfigValue}>
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
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <PortalThemeProvider>
          <AccessibilityProvider>
            <QueryClientProvider client={queryClient}>
              <ApolloProvider>
                <AuthProvider>
                  <PartnerTenantProvider>
                    <TenantProvider>
                      {shouldWrapWithRBAC ? (
                        <RBACProvider>{appProviders}</RBACProvider>
                      ) : (
                        appProviders
                      )}
                    </TenantProvider>
                  </PartnerTenantProvider>
                </AuthProvider>
              </ApolloProvider>
            </QueryClientProvider>
          </AccessibilityProvider>
        </PortalThemeProvider>
      </ThemeProvider>
    </MSWProvider>
  );
}
