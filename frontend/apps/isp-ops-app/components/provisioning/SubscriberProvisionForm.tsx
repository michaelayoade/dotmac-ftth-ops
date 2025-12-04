/**
 * Subscriber Provision Form - ISP Ops App Wrapper
 *
 * Wrapper that connects the shared SubscriberProvisionForm to app-specific form components.
 */

"use client";

import { SubscriberProvisionForm } from "@dotmac/features/provisioning";
import type { FormData } from "@dotmac/features/provisioning";
import { DualStackIPInput } from "@/components/forms/DualStackIPInput";
import { IPCIDRInput } from "@/components/forms/IPCIDRInput";

interface SubscriberProvisionFormWrapperProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
  availablePrefixes?: Array<{
    id: number;
    prefix: string;
    family: "ipv4" | "ipv6";
  }>;
  availableProfiles?: Array<{ id: string; name: string }>;
  availableWireGuardServers?: Array<{ id: string; name: string }>;
}

export function SubscriberProvisionFormWrapper(props: SubscriberProvisionFormWrapperProps) {
  return (
    <SubscriberProvisionForm
      {...props}
      DualStackIPInput={DualStackIPInput}
      IPCIDRInput={IPCIDRInput}
    />
  );
}

// Re-export types
export type { FormData };
