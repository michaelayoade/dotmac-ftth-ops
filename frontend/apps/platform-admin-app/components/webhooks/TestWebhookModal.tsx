import { WebhookSubscription } from "@/hooks/useWebhooks";

interface TestWebhookModalProps {
  webhook: WebhookSubscription;
  onClose: () => void;
}

export function TestWebhookModal({ webhook: _webhook, onClose: _onClose }: TestWebhookModalProps) {
  return <div>TestWebhookModal Placeholder</div>;
}
