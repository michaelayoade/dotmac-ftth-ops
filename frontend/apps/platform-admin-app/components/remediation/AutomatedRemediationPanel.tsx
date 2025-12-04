/**
 * Automated Remediation Panel Component
 *
 * Wrapper that connects the shared AutomatedRemediationPanel to app-specific dependencies.
 */

"use client";

import { AutomatedRemediationPanel as SharedAutomatedRemediationPanel } from "@dotmac/features/remediation";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";

interface AutomatedRemediationPanelProps {
  subscriberId?: string;
}

export function AutomatedRemediationPanel(props: AutomatedRemediationPanelProps) {
  return <SharedAutomatedRemediationPanel {...props} apiClient={apiClient} useToast={useToast} />;
}
