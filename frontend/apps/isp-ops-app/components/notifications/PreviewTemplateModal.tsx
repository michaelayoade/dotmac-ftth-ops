/**
 * Preview Template Modal
 *
 * Wrapper that connects the shared PreviewTemplateModal to app-specific hooks.
 */

"use client";

import { PreviewTemplateModal as SharedPreviewTemplateModal } from "@dotmac/features/notifications";
import type { CommunicationTemplate } from "@/hooks/useNotifications";
import { useNotificationTemplates } from "@/hooks/useNotifications";

interface PreviewTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: CommunicationTemplate;
}

export function PreviewTemplateModal(props: PreviewTemplateModalProps) {
  const { renderTemplatePreview } = useNotificationTemplates();

  return (
    <SharedPreviewTemplateModal {...props} renderTemplatePreview={renderTemplatePreview as any} />
  );
}
