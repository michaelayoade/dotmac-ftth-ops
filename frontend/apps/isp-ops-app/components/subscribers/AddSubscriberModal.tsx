/**
 * AddSubscriberModal Component
 *
 * Wrapper that connects the shared AddSubscriberModal to app-specific hooks.
 */

"use client";

import { AddSubscriberModal as SharedAddSubscriberModal } from "@dotmac/features/subscribers";
import { useSubscriberOperations } from "@/hooks/useSubscribers";

interface AddSubscriberModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (subscriberId: string) => void;
}

export function AddSubscriberModal(props: AddSubscriberModalProps) {
  return <SharedAddSubscriberModal {...props} useSubscriberOperations={useSubscriberOperations} />;
}
