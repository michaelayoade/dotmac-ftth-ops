"use client";

import { CPEConfigTemplates as SharedCPEConfigTemplates } from "@dotmac/features/cpe";
import { apiClient } from "@/lib/api/client";

/**
 * Platform Admin App wrapper for CPEConfigTemplates
 *
 * Uses /api/v1/genieacs/mass-config endpoint
 */
export function CPEConfigTemplates() {
  return (
    <SharedCPEConfigTemplates
      apiClient={apiClient}
      massConfigEndpoint="/api/v1/genieacs/mass-config"
    />
  );
}
