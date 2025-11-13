"use client";

import { useAppConfig } from "@/providers/AppConfigContext";
import type { PlatformConfig } from "@/lib/config";

type ApiConfig = PlatformConfig["api"];

export function useApiConfig() {
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl || "";

  return {
    api,
    apiBaseUrl,
    buildApiUrl: api.buildUrl as ApiConfig["buildUrl"],
  };
}
