'use client';

import { ReactNode, useEffect } from 'react';
import { useAppConfig } from './AppConfigContext';
import { applyBrandingConfig, applyThemeTokens } from '@/lib/theme';

interface BrandingProviderProps {
  children: ReactNode;
}

export function BrandingProvider({ children }: BrandingProviderProps) {
  const { branding } = useAppConfig();

  useEffect(() => {
    // Apply primary/secondary theme tokens derived from branding colors
    applyThemeTokens({
      'brand-primary': branding.colors?.primary,
      'brand-primary-hover': branding.colors?.primaryHover,
      'brand-primary-foreground': branding.colors?.primaryForeground,
      'brand-secondary': branding.colors?.secondary,
      'brand-secondary-hover': branding.colors?.secondaryHover,
      'brand-secondary-foreground': branding.colors?.secondaryForeground,
      'brand-accent': branding.colors?.accent,
      'brand-background': branding.colors?.background,
      'brand-foreground': branding.colors?.foreground,
    });
  }, [branding]);

  useEffect(() => {
    applyBrandingConfig(branding);
  }, [branding]);

  return <>{children}</>;
}
