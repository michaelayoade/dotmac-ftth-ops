"use client";

import { createContext, useContext } from "react";
import type { PlatformConfig } from "@/lib/config";
import { platformConfig } from "@/lib/config";

const AppConfigContext = createContext<PlatformConfig>(platformConfig);

export const AppConfigProvider = AppConfigContext.Provider;

export function useAppConfig() {
  return useContext(AppConfigContext);
}
