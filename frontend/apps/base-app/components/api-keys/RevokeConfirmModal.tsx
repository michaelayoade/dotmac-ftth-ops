import { useState } from "react";
import { X, AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { APIKey } from "@/hooks/useApiKeys";

interface RevokeConfirmModalProps {
  apiKey: APIKey;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function RevokeConfirmModal({ apiKey, onClose, onConfirm }: RevokeConfirmModalProps) {
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleConfirm = async () => {
    if (confirmText !== "REVOKE") return;

    setLoading(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error("Failed to revoke API key:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const isConfirmValid = confirmText === "REVOKE";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-red-500/20 rounded-full">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Revoke API Key</h3>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-400">Permanent Action</h4>
                <p className="text-sm text-slate-300 mt-1">
                  This action cannot be undone. The API key will be immediately invalidated and any
                  applications using it will lose access.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-2">API Key to Revoke</h4>
            <div className="bg-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">{apiKey.name}</p>
                  <p className="text-sm text-slate-400 font-mono">{apiKey.key_preview}</p>
                </div>
              </div>
              {apiKey.description && (
                <p className="text-sm text-slate-400 mt-2">{apiKey.description}</p>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-2">Affected Permissions</h4>
            <div className="flex flex-wrap gap-1">
              {apiKey.scopes.map((scope) => (
                <span
                  key={scope}
                  className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30"
                >
                  {scope}
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Type <code className="px-1 py-0.5 bg-slate-800 rounded text-red-400">REVOKE</code> to
              confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type REVOKE to confirm"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !isConfirmValid}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white rounded-lg transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Revoking...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Revoke API Key
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
