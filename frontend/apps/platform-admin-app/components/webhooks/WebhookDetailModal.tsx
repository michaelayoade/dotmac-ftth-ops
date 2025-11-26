import { WebhookSubscription } from "@/hooks/useWebhooks";

interface WebhookDetailModalProps {
  webhook: WebhookSubscription;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
}

export function WebhookDetailModal({
  webhook: _webhook,
  onClose: _onClose,
  onEdit: _onEdit,
  onDelete: _onDelete,
  onTest: _onTest,
}: WebhookDetailModalProps) {
  return <div>WebhookDetailModal Placeholder</div>;
}
