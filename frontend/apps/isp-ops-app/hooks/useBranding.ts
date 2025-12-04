"use client";

import { useBrandingContext } from "@/providers/BrandingProvider";

export function useBranding() {
  return useBrandingContext();
}
