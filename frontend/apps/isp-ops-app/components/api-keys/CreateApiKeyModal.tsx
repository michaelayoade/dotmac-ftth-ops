/**
 * Create API Key Modal
 *
 * Wrapper that connects the shared CreateApiKeyModal to app-specific hooks.
 */

import { CreateApiKeyModal as SharedCreateApiKeyModal } from "@dotmac/features/api-keys";
import { useApiKeys, APIKey } from "@/hooks/useApiKeys";
import { logger } from "@/lib/logger";

interface CreateApiKeyModalProps {
  onClose: () => void;
  onApiKeyCreated: () => void;
  editingApiKey?: APIKey | null;
}

export function CreateApiKeyModal(props: CreateApiKeyModalProps) {
  const { createApiKey, updateApiKey, getAvailableScopes } = useApiKeys();

  const handleApiKeyCreated = () => {
    logger.info("API key created/updated successfully");
    props.onApiKeyCreated();
  };

  return (
    <SharedCreateApiKeyModal
      {...props}
      onApiKeyCreated={handleApiKeyCreated}
      createApiKey={createApiKey as any}
      updateApiKey={updateApiKey}
      getAvailableScopes={getAvailableScopes}
    />
  );
}
