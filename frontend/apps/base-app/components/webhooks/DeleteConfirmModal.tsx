import { WebhookSubscription } from "@/hooks/useWebhooks";

interface DeleteConfirmModalProps {
  webhook: WebhookSubscription;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteConfirmModal({ webhook, onClose, onConfirm }: DeleteConfirmModalProps) {
  return <div>DeleteConfirmModal Placeholder</div>;
}
