import { useState } from "react";
import { logger } from "@/lib/logger";
import {
  X,
  Key,
  Calendar,
  Shield,
  Eye,
  Copy,
  Check,
  Edit,
  Trash2,
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { APIKey } from "@/hooks/useApiKeys";

interface ApiKeyDetailModalProps {
  apiKey: APIKey;
  onClose: () => void;
  onEdit: () => void;
  onRevoke: () => void;
}

export function ApiKeyDetailModal({ apiKey, onClose, onEdit, onRevoke }: ApiKeyDetailModalProps) {
  const [copied, setCopied] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      logger.error(
        "Failed to copy to clipboard",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  };

  const getStatusColor = () => {
    if (!apiKey.is_active) return "text-red-400 bg-red-500/20 border-red-500/30";

    const now = new Date();
    const expiresAt = apiKey.expires_at ? new Date(apiKey.expires_at) : null;

    if (expiresAt && expiresAt < now) {
      return "text-red-400 bg-red-500/20 border-red-500/30";
    }

    if (expiresAt && expiresAt.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return "text-yellow-400 bg-yellow-500/20 border-yellow-500/30";
    }

    return "text-green-400 bg-green-500/20 border-green-500/30";
  };

  const getStatusText = () => {
    if (!apiKey.is_active) return "Inactive";

    const now = new Date();
    const expiresAt = apiKey.expires_at ? new Date(apiKey.expires_at) : null;

    if (expiresAt && expiresAt < now) {
      return "Expired";
    }

    if (expiresAt && expiresAt.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return "Expiring Soon";
    }

    return "Active";
  };

  const getStatusIcon = () => {
    if (!apiKey.is_active) return AlertTriangle;

    const now = new Date();
    const expiresAt = apiKey.expires_at ? new Date(apiKey.expires_at) : null;

    if (expiresAt && expiresAt < now) {
      return AlertTriangle;
    }

    return CheckCircle;
  };

  const StatusIcon = getStatusIcon();

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="h-6 w-6 text-sky-400" />
              <div>
                <h3 className="text-lg font-semibold text-white">{apiKey.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor()}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {getStatusText()}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onEdit}
                className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
              >
                <Edit className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={onRevoke}
                className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Revoke
              </button>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white transition-colors p-2"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Key Information */}
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-3">API Key</h4>
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300">
                {apiKey.key_preview}
              </div>
              <button
                onClick={() => copyToClipboard(apiKey.key_preview)}
                className="flex items-center gap-2 px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              This is a masked preview. The full key was only shown when created.
            </p>
          </div>

          {/* Description */}
          {apiKey.description && (
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-2">Description</h4>
              <p className="text-slate-300 text-sm bg-slate-800 rounded-lg p-3">
                {apiKey.description}
              </p>
            </div>
          )}

          {/* Scopes */}
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-3">Permissions</h4>
            <div className="flex flex-wrap gap-2">
              {apiKey.scopes.map((scope) => (
                <span
                  key={scope}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-500/20 text-sky-400 border border-sky-500/30"
                >
                  <Shield className="h-3 w-3" />
                  {scope}
                </span>
              ))}
            </div>
            {apiKey.scopes.length === 0 && (
              <p className="text-slate-500 text-sm">No scopes assigned</p>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Creation Date */}
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Created
              </h4>
              <p className="text-slate-300 text-sm">{formatDate(apiKey.created_at)}</p>
            </div>

            {/* Expiration */}
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Expires
              </h4>
              <p className="text-slate-300 text-sm">
                {apiKey.expires_at ? formatDate(apiKey.expires_at) : "Never"}
              </p>
            </div>

            {/* Last Used */}
            {apiKey.last_used_at && (
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Last Used
                </h4>
                <p className="text-slate-300 text-sm">{formatDate(apiKey.last_used_at)}</p>
              </div>
            )}

            {/* Status */}
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Status
              </h4>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor()}`}
              >
                <StatusIcon className="h-3 w-3" />
                {getStatusText()}
              </span>
            </div>
          </div>

          {/* Expiration Warning */}
          {apiKey.expires_at &&
            (() => {
              const now = new Date();
              const expiresAt = new Date(apiKey.expires_at);
              const daysUntilExpiry = Math.ceil(
                (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
              );

              if (daysUntilExpiry <= 0) {
                return (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-red-400">API Key Expired</h4>
                        <p className="text-sm text-slate-300 mt-1">
                          This API key expired on {formatDate(apiKey.expires_at!)}. It will no
                          longer work for API requests.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              } else if (daysUntilExpiry <= 7) {
                return (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-yellow-400">API Key Expiring Soon</h4>
                        <p className="text-sm text-slate-300 mt-1">
                          This API key will expire in {daysUntilExpiry} day
                          {daysUntilExpiry !== 1 ? "s" : ""} on {formatDate(apiKey.expires_at!)}.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

          {/* Security Notice */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-slate-300">Security Best Practices</h4>
                <ul className="text-sm text-slate-400 mt-2 space-y-1">
                  <li>• Keep your API keys secure and never share them publicly</li>
                  <li>• Rotate your keys regularly, especially for production use</li>
                  <li>• Use the minimum required scopes for your application</li>
                  <li>• Monitor your key usage and revoke unused keys</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
