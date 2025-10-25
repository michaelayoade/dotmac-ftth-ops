import { WebhookSubscription } from "@/hooks/useWebhooks";

interface WebhookDetailModalProps {
  webhook: WebhookSubscription;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
}

export function WebhookDetailModal({
  webhook,
  onClose,
  onEdit,
  onDelete,
  onTest,
}: WebhookDetailModalProps) {
  return <div>WebhookDetailModal Placeholder</div>;
}
