/**
 * Diagnostics Dashboard Component
 *
 * Wrapper that connects the shared DiagnosticsDashboard to app-specific dependencies.
 */

"use client";

import { DiagnosticsDashboard as SharedDiagnosticsDashboard } from "@dotmac/features/diagnostics";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { logger } from "@/lib/utils/logger";

interface DiagnosticsDashboardProps {
  subscriberId: string;
  hasONU?: boolean;
  hasCPE?: boolean;
}

export function DiagnosticsDashboard(props: DiagnosticsDashboardProps) {
  return (
    <SharedDiagnosticsDashboard
      {...props}
      apiClient={apiClient}
      useToast={useToast}
      logger={logger}
    />
  );
}
