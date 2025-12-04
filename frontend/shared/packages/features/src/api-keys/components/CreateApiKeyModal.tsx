import {
  X,
  Key,
  Calendar,
  Shield,
  AlertTriangle,
  Copy,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Plus,
} from "lucide-react";
import { useState, useEffect } from "react";

export interface APIKey {
  id: string;
  name: string;
  description?: string;
  scopes: string[];
  expires_at?: string;
  created_at: string;
  last_used_at?: string;
}

export interface APIKeyCreateRequest {
  name: string;
  description?: string;
  scopes: string[];
  expires_at?: string;
}

export type AvailableScopes = Record<string, { description: string; category?: string }>;

export interface CreateApiKeyModalProps<TApiKey = any> {
  onClose: () => void;
  onApiKeyCreated: () => void;
  editingApiKey?: TApiKey | null;

  // API methods
  createApiKey: (data: APIKeyCreateRequest) => Promise<{ api_key: string; key: TApiKey }>;
  updateApiKey: (id: string, data: Partial<APIKeyCreateRequest>) => Promise<TApiKey>;
  getAvailableScopes: () => Promise<AvailableScopes>;
}

interface FormErrors {
  name?: string;
  scopes?: string;
  expires_at?: string;
  submit?: string;
}

export function CreateApiKeyModal<TApiKey = any>({
  onClose,
  onApiKeyCreated,
  editingApiKey,
  createApiKey,
  updateApiKey,
  getAvailableScopes,
}: CreateApiKeyModalProps<TApiKey>) {
  const [loading, setLoading] = useState(false);
  const [availableScopes, setAvailableScopes] = useState<AvailableScopes>({});
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    scopes: [] as string[],
    expires_at: "",
    never_expires: true,
  });

  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    const loadScopes = async () => {
      try {
        const scopes = await getAvailableScopes();
        setAvailableScopes(scopes);
      } catch (error) {
        console.error("Failed to load available scopes:", error);
      }
    };

    loadScopes();

    // Pre-fill form when editing
    if (editingApiKey) {
      const apiKey = editingApiKey as any;
      setFormData({
        name: apiKey.name,
        description: apiKey.description || "",
        scopes: apiKey.scopes,
        expires_at: apiKey.expires_at
          ? (new Date(apiKey.expires_at).toISOString().split("T")[0] ?? "")
          : "",
        never_expires: !apiKey.expires_at,
      });
    }
  }, [editingApiKey, getAvailableScopes]);

  const validateForm = () => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (formData.scopes.length === 0) {
      newErrors.scopes = "At least one scope is required";
    }

    if (!formData.never_expires && !formData.expires_at) {
      newErrors.expires_at = "Expiration date is required";
    }

    if (!formData.never_expires && formData.expires_at) {
      const expirationDate = new Date(formData.expires_at);
      if (expirationDate <= new Date()) {
        newErrors.expires_at = "Expiration date must be in the future";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const requestData: APIKeyCreateRequest = {
        name: formData.name.trim(),
        scopes: formData.scopes,
        ...(formData.description.trim() && { description: formData.description.trim() }),
        ...(!formData.never_expires && formData.expires_at && { expires_at: formData.expires_at }),
      };

      if (editingApiKey) {
        // Update existing API key
        await updateApiKey((editingApiKey as any).id, requestData);
        onApiKeyCreated();
      } else {
        // Create new API key
        const response = await createApiKey(requestData);
        setCreatedApiKey(response.api_key);
      }
    } catch (error) {
      console.error(
        "Failed to save API key",
        error instanceof Error ? error : new Error(String(error)),
      );
      setErrors({
        submit: error instanceof Error ? error.message : "Failed to save API key",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleScopeToggle = (scope: string) => {
    setFormData((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }));
    // Clear scope errors when user selects scopes
    if (errors.scopes) {
      setErrors((prev) => ({ ...prev, scopes: "" }));
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error(
        "Failed to copy to clipboard",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // If API key was created, show the success screen
  if (createdApiKey) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        onClick={handleBackdropClick}
      >
        <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-2xl">
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-green-500/20 rounded-full">
                <Check className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">API Key Created!</h3>
                <p className="text-slate-400 text-sm">
                  Save this key securely - you won&apos;t see it again
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-400">Important Security Notice</h4>
                  <p className="text-sm text-slate-300 mt-1">
                    This is the only time you&apos;ll see your API key. Store it securely and never
                    share it publicly.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Your API Key</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={createdApiKey}
                    readOnly
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm pr-20 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button
                  onClick={() => copyToClipboard(createdApiKey)}
                  className="flex items-center gap-2 px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Name:</span>
                <span className="text-white ml-2">{formData.name}</span>
              </div>
              <div>
                <span className="text-slate-400">Scopes:</span>
                <span className="text-white ml-2">{formData.scopes.length}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={onApiKeyCreated}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors"
              >
                Continue to API Keys
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="h-6 w-6 text-sky-400" />
              <h3 className="text-lg font-semibold text-white">
                {editingApiKey ? "Edit API Key" : "Create API Key"}
              </h3>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]"
        >
          {errors.submit && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <p className="text-red-400">{errors.submit}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, name: e.target.value }));
                if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
              }}
              className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                errors.name ? "border-red-500" : "border-slate-700"
              }`}
              placeholder="e.g., Production API Key"
            />
            {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Optional description of what this API key will be used for"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Scopes *</label>
            <p className="text-sm text-slate-400 mb-3">
              Select the permissions this API key should have
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto bg-slate-800 rounded-lg p-3">
              {Object.entries(availableScopes).map(([scope, info]) => (
                <label
                  key={scope}
                  className="flex items-start gap-3 p-2 hover:bg-slate-700 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formData.scopes.includes(scope)}
                    onChange={() => handleScopeToggle(scope)}
                    className="mt-1 h-4 w-4 text-sky-600 bg-slate-700 border-slate-600 rounded focus:ring-sky-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-white">{scope}</div>
                    <div className="text-sm text-slate-400">{info.description}</div>
                    {info.category && (
                      <div className="text-xs text-sky-400 font-mono mt-1">{info.category}</div>
                    )}
                  </div>
                </label>
              ))}
            </div>
            {errors.scopes && <p className="text-red-400 text-sm mt-1">{errors.scopes}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Expiration</label>
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={formData.never_expires}
                  onChange={() =>
                    setFormData((prev) => ({
                      ...prev,
                      never_expires: true,
                      expires_at: "",
                    }))
                  }
                  className="h-4 w-4 text-sky-600 bg-slate-700 border-slate-600 focus:ring-sky-500"
                />
                <span className="text-white">Never expires</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={!formData.never_expires}
                  onChange={() => setFormData((prev) => ({ ...prev, never_expires: false }))}
                  className="h-4 w-4 text-sky-600 bg-slate-700 border-slate-600 focus:ring-sky-500"
                />
                <span className="text-white">Set expiration date</span>
              </label>
            </div>

            {!formData.never_expires && (
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <input
                    type="date"
                    value={formData.expires_at}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        expires_at: e.target.value,
                      }));
                      if (errors.expires_at) setErrors((prev) => ({ ...prev, expires_at: "" }));
                    }}
                    min={new Date().toISOString().split("T")[0]}
                    className={`flex-1 px-3 py-2 bg-slate-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      errors.expires_at ? "border-red-500" : "border-slate-700"
                    }`}
                  />
                </div>
                {errors.expires_at && (
                  <p className="text-red-400 text-sm mt-1">{errors.expires_at}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/50 text-white rounded-lg transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {editingApiKey ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>
                  {editingApiKey ? <Shield className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {editingApiKey ? "Update API Key" : "Create API Key"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
