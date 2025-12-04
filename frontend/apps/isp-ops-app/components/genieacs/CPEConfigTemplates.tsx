"use client";

import { CPEConfigTemplates as SharedCPEConfigTemplates } from "@dotmac/features/cpe";
import { apiClient } from "@/lib/api/client";

/**
 * ISP Ops App wrapper for CPEConfigTemplates
 *
 * Uses /genieacs/mass-config endpoint
 */
export function CPEConfigTemplates() {
  return (
    <SharedCPEConfigTemplates apiClient={apiClient} massConfigEndpoint="/genieacs/mass-config" />
  );
}
