"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Copy,
  Edit,
  Eye,
  Filter,
  Key,
  MoreHorizontal,
  Plus,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
import { useApiKeys, APIKey } from "@/hooks/useApiKeys";
import { CreateApiKeyModal } from "@/components/api-keys/CreateApiKeyModal";
import { ApiKeyDetailModal } from "@/components/api-keys/ApiKeyDetailModal";
import { RevokeConfirmModal } from "@/components/api-keys/RevokeConfirmModal";

export default function ApiKeysPage() {
  const { apiKeys, loading, error, revokeApiKey } = useApiKeys();
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState<APIKey | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [apiKeyToRevoke, setApiKeyToRevoke] = useState<APIKey | null>(null);

  const handleCreateApiKey = () => {
    setShowCreateModal(true);
  };

  const handleApiKeyCreated = () => {
    setShowCreateModal(false);
    // Refresh will happen automatically via the hook
  };

  const handleViewApiKey = (apiKey: APIKey) => {
    setSelectedApiKey(apiKey);
    setShowDetailModal(true);
  };

  const handleEditApiKey = (apiKey: APIKey) => {
    setSelectedApiKey(apiKey);
    setShowCreateModal(true);
  };

  const handleRevokeApiKey = (apiKey: APIKey) => {
    setApiKeyToRevoke(apiKey);
    setShowRevokeModal(true);
  };

  const handleConfirmRevoke = async () => {
    if (apiKeyToRevoke) {
      try {
        await revokeApiKey(apiKeyToRevoke.id);
        setShowRevokeModal(false);
        setApiKeyToRevoke(null);
      } catch (error) {
        console.error("Failed to revoke API key:", error);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You might want to show a toast notification here
  };

  // Filter API keys based on search and filters
  const filteredApiKeys = apiKeys.filter((apiKey) => {
    const matchesSearch =
      searchQuery === "" ||
      apiKey.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apiKey['description']?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesScope = scopeFilter === "all" || apiKey.scopes.includes(scopeFilter);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && apiKey.is_active) ||
      (statusFilter === "inactive" && !apiKey.is_active);

    return matchesSearch && matchesScope && matchesStatus;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (apiKey: APIKey) => {
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

  const getStatusText = (apiKey: APIKey) => {
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

  // Get unique scopes for filter dropdown
  const availableScopes = [...new Set(apiKeys.flatMap((key) => key.scopes))];

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <AlertTriangle className="mx-auto h-12 w-12 text-red-400 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Failed to load API keys</h3>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <Key className="h-8 w-8 text-sky-400" />
              API Keys
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage API keys for external integrations and services
            </p>
          </div>
          <button
            onClick={handleCreateApiKey}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create API Key
          </button>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-lg p-6 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search API keys..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-3 py-2 bg-accent border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
                className="px-3 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="all">All Scopes</option>
                {availableScopes.map((scope) => (
                  <option key={scope} value={scope}>
                    {scope}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* API Keys List */}
        <div className="bg-card rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground">Loading API keys...</p>
            </div>
          ) : filteredApiKeys.length === 0 ? (
            <div className="p-8 text-center">
              <Key className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {apiKeys.length === 0 ? "No API keys yet" : "No matching API keys"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {apiKeys.length === 0
                  ? "Create your first API key to start integrating with external services."
                  : "Try adjusting your search criteria or filters."}
              </p>
              {apiKeys.length === 0 && (
                <button
                  onClick={handleCreateApiKey}
                  className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors mx-auto"
                >
                  <Plus className="h-4 w-4" />
                  Create First API Key
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredApiKeys.map((apiKey) => (
                <div key={apiKey.id} className="p-6 hover:bg-accent/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-medium text-foreground">{apiKey.name}</h3>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(apiKey)}`}
                        >
                          {getStatusText(apiKey)}
                        </span>
                      </div>

                      {apiKey.description && (
                        <p className="text-muted-foreground mb-3">{apiKey.description}</p>
                      )}

                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4" />
                          <span className="font-mono">{apiKey.key_preview}</span>
                          <button
                            onClick={() => copyToClipboard(apiKey.key_preview)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          <span>{apiKey.scopes.length} scopes</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>Created {formatDate(apiKey.created_at)}</span>
                        </div>

                        {apiKey.last_used_at && (
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            <span>Last used {formatDate(apiKey.last_used_at)}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1 mt-3">
                        {apiKey.scopes.map((scope) => (
                          <span
                            key={scope}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/20 text-sky-400 border border-sky-500/30"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="relative">
                      <ApiKeyActions
                        apiKey={apiKey}
                        onView={handleViewApiKey}
                        onEdit={handleEditApiKey}
                        onRevoke={handleRevokeApiKey}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modals */}
        {showCreateModal && (
          <CreateApiKeyModal
            onClose={() => {
              setShowCreateModal(false);
              setSelectedApiKey(null);
            }}
            onApiKeyCreated={handleApiKeyCreated}
            editingApiKey={selectedApiKey}
          />
        )}

        {showDetailModal && selectedApiKey && (
          <ApiKeyDetailModal
            apiKey={selectedApiKey}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedApiKey(null);
            }}
            onEdit={() => {
              setShowDetailModal(false);
              setShowCreateModal(true);
            }}
            onRevoke={() => {
              setShowDetailModal(false);
              handleRevokeApiKey(selectedApiKey);
            }}
          />
        )}

        {showRevokeModal && apiKeyToRevoke && (
          <RevokeConfirmModal
            apiKey={apiKeyToRevoke}
            onClose={() => {
              setShowRevokeModal(false);
              setApiKeyToRevoke(null);
            }}
            onConfirm={handleConfirmRevoke}
          />
        )}
      </div>
    </div>
  );
}

interface ApiKeyActionsProps {
  apiKey: APIKey;
  onView: (apiKey: APIKey) => void;
  onEdit: (apiKey: APIKey) => void;
  onRevoke: (apiKey: APIKey) => void;
}

function ApiKeyActions({ apiKey, onView, onEdit, onRevoke }: ApiKeyActionsProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="text-muted-foreground hover:text-foreground transition-colors p-2"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-48 bg-card rounded-md shadow-lg ring-1 ring-border z-10">
          <div className="py-1">
            <button
              onClick={() => {
                onView(apiKey);
                setShowDropdown(false);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-muted w-full text-left"
            >
              <Eye className="h-4 w-4" />
              View Details
            </button>
            <button
              onClick={() => {
                onEdit(apiKey);
                setShowDropdown(false);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-muted w-full text-left"
            >
              <Edit className="h-4 w-4" />
              Edit API Key
            </button>
            <button
              onClick={() => {
                onRevoke(apiKey);
                setShowDropdown(false);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-muted w-full text-left"
            >
              <Trash2 className="h-4 w-4" />
              Revoke API Key
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
