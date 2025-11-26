import { WebhookSubscription } from "@/hooks/useWebhooks";

interface CreateWebhookModalProps {
  onClose: () => void;
  onWebhookCreated: () => void;
  editingWebhook: WebhookSubscription | null;
}

export function CreateWebhookModal({
  onClose: _onClose,
  onWebhookCreated: _onWebhookCreated,
  editingWebhook: _editingWebhook,
}: CreateWebhookModalProps) {
  return <div>CreateWebhookModal Placeholder</div>;
}
