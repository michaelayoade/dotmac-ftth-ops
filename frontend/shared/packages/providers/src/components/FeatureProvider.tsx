"use client";

import React, { createContext, useContext } from "react";

export interface FeatureFlags {
  notifications?: boolean;
  realtime?: boolean;
  analytics?: boolean;
  offline?: boolean;
}

const FeatureContext = createContext<FeatureFlags>({});

export const useFeatures = () => useContext(FeatureContext);

export function FeatureProvider({
  children,
  features = {},
}: {
  children: React.ReactNode;
  features?: FeatureFlags;
}) {
  return <FeatureContext.Provider value={features}>{children}</FeatureContext.Provider>;
}
