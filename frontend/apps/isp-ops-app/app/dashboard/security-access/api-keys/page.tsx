"use client";

import React, { useMemo, useState } from "react";
import { Plus, Key, Search } from "lucide-react";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { useApiKeys, APIKey } from "@/hooks/useApiKeys";
import { CreateApiKeyModal } from "@/components/api-keys/CreateApiKeyModal";
import { ApiKeyDetailModal } from "@/components/api-keys/ApiKeyDetailModal";
import { RevokeConfirmModal } from "@/components/api-keys/RevokeConfirmModal";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Badge,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@dotmac/ui";
import { format } from "date-fns";

export default function ApiKeysPage() {
  const { apiKeys, loading, error, revokeApiKey } = useApiKeys();
  const [selectedApiKey, setSelectedApiKey] = useState<APIKey | null>(null);
  const [apiKeyToRevoke, setApiKeyToRevoke] = useState<APIKey | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredApiKeys = useMemo(() => {
    if (!searchQuery.trim()) return apiKeys;
    const q = searchQuery.toLowerCase();
    return apiKeys.filter(
      (key) =>
        key.name.toLowerCase().includes(q) ||
        key.id.toLowerCase().includes(q) ||
        (key.description || "").toLowerCase().includes(q),
    );
  }, [apiKeys, searchQuery]);

  const handleCreateApiKey = () => setShowCreateModal(true);
  const handleApiKeyCreated = () => setShowCreateModal(false);

  const handleViewApiKey = (apiKey: APIKey) => setSelectedApiKey(apiKey);
  const handleRevokeApiKey = (apiKey: APIKey) => setApiKeyToRevoke(apiKey);

  const confirmRevoke = async () => {
    if (!apiKeyToRevoke) return;
    await revokeApiKey(apiKeyToRevoke.id);
    setApiKeyToRevoke(null);
  };

  return (
    <RouteGuard permission="security.manage">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-6 w-6 text-blue-500" />
            <div>
              <h1 className="text-2xl font-semibold">API Keys</h1>
              <p className="text-sm text-muted-foreground">
                Issue and manage API keys bound to your tenant.
              </p>
            </div>
          </div>
          <Button onClick={handleCreateApiKey}>
            <Plus className="h-4 w-4 mr-2" />
            New API Key
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <CardTitle>Keys</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search keys..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground">Loading API keys...</div>
            ) : error ? (
              <div className="text-destructive">Failed to load API keys</div>
            ) : filteredApiKeys.length === 0 ? (
              <div className="text-muted-foreground">No API keys found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key ID</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApiKeys.map((apiKey) => (
                    <TableRow key={apiKey.id}>
                      <TableCell className="font-medium">{apiKey.name}</TableCell>
                      <TableCell className="text-muted-foreground">{apiKey.id}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {apiKey.created_at ? format(new Date(apiKey.created_at), "PP") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={!apiKey.is_active ? "secondary" : "default"}>
                          {!apiKey.is_active ? "Disabled" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewApiKey(apiKey)}
                        >
                          View
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevokeApiKey(apiKey)}
                        >
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {showCreateModal && (
          <CreateApiKeyModal
            onClose={() => setShowCreateModal(false)}
            onApiKeyCreated={handleApiKeyCreated}
            editingApiKey={selectedApiKey}
          />
        )}

        {selectedApiKey && (
          <ApiKeyDetailModal
            apiKey={selectedApiKey}
            onClose={() => setSelectedApiKey(null)}
            onEdit={() => setShowCreateModal(true)}
            onRevoke={() => handleRevokeApiKey(selectedApiKey)}
          />
        )}

        {apiKeyToRevoke && (
          <RevokeConfirmModal
            apiKey={apiKeyToRevoke}
            onClose={() => setApiKeyToRevoke(null)}
            onConfirm={confirmRevoke}
          />
        )}
      </div>
    </RouteGuard>
  );
}
