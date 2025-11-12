/**
 * Communication Detail Modal
 *
 * Wrapper that connects the shared CommunicationDetailModal to app-specific types.
 */

"use client";

import { CommunicationDetailModal as SharedCommunicationDetailModal } from "@dotmac/features/notifications";
import type { CommunicationLog } from "@/hooks/useNotifications";

interface CommunicationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  log: CommunicationLog;
  onRetry?: () => Promise<void>;
}

export function CommunicationDetailModal(props: CommunicationDetailModalProps) {
  return <SharedCommunicationDetailModal {...props} />;
}
