"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { AppConfigProvider } from "./AppConfigContext";
import { MSWProvider } from "./MSWProvider";
import { platformConfig } from "@/lib/config";
import { TenantProvider } from "@/lib/contexts/tenant-context";
import { RBACProvider } from "@/contexts/RBACContext";
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
import { useRuntimeConfigState } from "@shared/runtime/RuntimeConfigContext";
import { setupApiFetchInterceptor } from "@/lib/api/fetch-interceptor";

export function ClientProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [queryClient] = useState(() => new QueryClient());
  const { runtimeConfig } = useRuntimeConfigState();

  useEffect(() => {
    setupApiFetchInterceptor();
  }, []);

  const appConfigValue = useMemo(() => {
    return {
      ...platformConfig,
      api: { ...platformConfig.api },
      features: { ...platformConfig.features },
      branding: { ...platformConfig.branding },
      tenant: { ...platformConfig.tenant },
    };
  }, [runtimeConfig?.generatedAt]);

  const shouldWrapWithRBAC =
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/tenant-portal") ||
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
                <TenantProvider>
                  {shouldWrapWithRBAC ? <RBACProvider>{appProviders}</RBACProvider> : appProviders}
                </TenantProvider>
              </ApolloProvider>
            </QueryClientProvider>
          </AccessibilityProvider>
        </PortalThemeProvider>
      </ThemeProvider>
    </MSWProvider>
  );
}
