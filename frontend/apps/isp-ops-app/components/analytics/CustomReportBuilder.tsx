/**
 * Custom Report Builder Component
 *
 * Wrapper that connects the shared CustomReportBuilder to app-specific dependencies.
 */

"use client";

import { CustomReportBuilder as SharedCustomReportBuilder } from "@dotmac/features/analytics";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { logger } from "@/lib/logger";

export function CustomReportBuilder() {
  return <SharedCustomReportBuilder apiClient={apiClient} useToast={useToast} logger={logger} />;
}
