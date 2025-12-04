import { WebhookSubscription } from "@/hooks/useWebhooks";

interface CreateWebhookModalProps {
  onClose: () => void;
  onWebhookCreated: () => void;
  editingWebhook: WebhookSubscription | null;
}

export function CreateWebhookModal({
  onClose,
  onWebhookCreated,
  editingWebhook,
}: CreateWebhookModalProps) {
  return <div>CreateWebhookModal Placeholder</div>;
}
