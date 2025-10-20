'use client';

import { useAppConfig } from '@/providers/AppConfigContext';

export function useBranding() {
  const { branding } = useAppConfig();

  return {
    branding,
  };
}
