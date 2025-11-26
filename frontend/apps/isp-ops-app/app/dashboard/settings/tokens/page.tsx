"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@dotmac/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@dotmac/ui";
import {
  Key,
  Plus,
  Copy,
  MoreVertical,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
} from "lucide-react";
import { useToast } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { logger } from "@/lib/logger";
const toError = (error: unknown) =>
  error instanceof Error ? error : new Error(typeof error === "string" ? error : String(error));

interface APIToken {
  id: string;
  name: string;
  description?: string;
  token_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at?: string;
  expires_at?: string;
  is_active: boolean;
}

interface CreateTokenResponse {
  token: string;
  token_id: string;
  name: string;
}

function APITokensContent() {
  const { toast } = useToast();

  // State
  const [tokens, setTokens] = useState<APIToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [newTokenData, setNewTokenData] = useState<CreateTokenResponse | null>(null);

  // Form state
  const [tokenName, setTokenName] = useState("");
  const [tokenDescription, setTokenDescription] = useState("");
  const [tokenExpiry, setTokenExpiry] = useState<number>(30); // days
  const [isCreating, setIsCreating] = useState(false);
  const [showNewToken, setShowNewToken] = useState(true);

  const loadTokens = useCallback(async () => {
    try {
      setIsLoading(true);

      const response = await apiClient.get("/auth/tokens").catch(() => ({ data: [] }));
      setTokens(response.data);
    } catch (error) {
      logger.error("Failed to load API tokens", toError(error));
      toast({
        title: "Error",
        description: "Failed to load API tokens",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  const handleCreateToken = async () => {
    if (!tokenName) {
      toast({
        title: "Validation Error",
        description: "Please provide a token name",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreating(true);

      const response = await apiClient.post("/auth/tokens", {
        name: tokenName,
        description: tokenDescription,
        expires_in_days: tokenExpiry,
      });

      setNewTokenData(response.data);
      setShowCreateDialog(false);
      setShowTokenDialog(true);

      // Reset form
      setTokenName("");
      setTokenDescription("");
      setTokenExpiry(30);

      toast({
        title: "Success",
        description: "API token created successfully",
      });

      await loadTokens();
    } catch (error: any) {
      logger.error("Failed to create API token", toError(error));
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create API token",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    try {
      await apiClient.delete(`/auth/tokens/${tokenId}`);

      toast({
        title: "Success",
        description: "API token revoked successfully",
      });

      await loadTokens();
    } catch (error: any) {
      logger.error("Failed to revoke API token", toError(error), { tokenId });
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to revoke token",
        variant: "destructive",
      });
    }
  };

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast({
      title: "Copied",
      description: "Token copied to clipboard",
    });
  };

  const getExpiryStatus = (expiresAt?: string) => {
    if (!expiresAt) return { label: "Never", color: "bg-green-500/10 text-green-500" };

    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilExpiry < 0) {
      return { label: "Expired", color: "bg-red-500/10 text-red-500" };
    } else if (daysUntilExpiry <= 7) {
      return {
        label: `${daysUntilExpiry} days`,
        color: "bg-orange-500/10 text-orange-500",
      };
    } else {
      return {
        label: `${daysUntilExpiry} days`,
        color: "bg-green-500/10 text-green-500",
      };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Key className="h-8 w-8 text-sky-500" />
            API Tokens
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage personal access tokens for API authentication
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Token
        </Button>
      </div>

      {/* Info Banner */}
      <Card className="border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-200">
                Keep your tokens secure
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Tokens provide full access to your account via the API. Treat them like passwords
                and never share them in publicly accessible areas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tokens Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Tokens</CardTitle>
          <CardDescription>
            Tokens you have created for API access. Click the menu to revoke a token.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <div className="text-center py-12">
              <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No API tokens yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Create a token to get started with the API
              </p>
              <Button variant="outline" className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Token
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Token Prefix</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => {
                  const expiryStatus = getExpiryStatus(token.expires_at);
                  return (
                    <TableRow key={token.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{token.name}</p>
                          {token.description && (
                            <p className="text-sm text-muted-foreground">{token.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="px-2 py-1 bg-muted rounded text-xs">
                          {token.token_prefix}•••
                        </code>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(token.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {token.last_used_at
                          ? new Date(token.last_used_at).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell>
                        <Badge className={expiryStatus.color}>{expiryStatus.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleRevokeToken(token.id)}
                              className="text-red-600 dark:text-red-400"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Revoke Token
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Usage Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Using API Tokens</CardTitle>
          <CardDescription>How to authenticate with your API tokens</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">HTTP Header Authentication</h4>
            <code className="block bg-muted p-4 rounded-lg text-sm">
              curl -H &quot;Authorization: Bearer YOUR_TOKEN&quot;
              https://api.example.com/v1/endpoint
            </code>
          </div>
          <div>
            <h4 className="font-medium mb-2">JavaScript/TypeScript</h4>
            <code className="block bg-muted p-4 rounded-lg text-sm overflow-x-auto">
              {`fetch('https://api.example.com/v1/endpoint', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
})`}
            </code>
          </div>
          <div>
            <h4 className="font-medium mb-2">Python</h4>
            <code className="block bg-muted p-4 rounded-lg text-sm overflow-x-auto">
              {`import requests
headers = {'Authorization': 'Bearer YOUR_TOKEN'}
response = requests.get('https://api.example.com/v1/endpoint', headers=headers)`}
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Create Token Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Token</DialogTitle>
            <DialogDescription>
              Generate a new token for API authentication. Make sure to copy it - you won&apos;t be
              able to see it again!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="token-name">Token Name</Label>
              <Input
                id="token-name"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="My API Token"
              />
              <p className="text-xs text-muted-foreground">
                A descriptive name to help you remember what this token is for
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="token-description">Description (Optional)</Label>
              <Textarea
                id="token-description"
                value={tokenDescription}
                onChange={(e) => setTokenDescription(e.target.value)}
                placeholder="Used for automated deployments..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token-expiry">Expires In</Label>
              <div className="flex gap-2">
                <Input
                  id="token-expiry"
                  type="number"
                  min={1}
                  max={365}
                  value={tokenExpiry}
                  onChange={(e) => setTokenExpiry(parseInt(e.target.value) || 30)}
                  className="w-24"
                />
                <span className="flex items-center text-sm text-muted-foreground">days</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Choose between 1-365 days. Shorter lifetimes are more secure.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateToken} disabled={isCreating}>
              {isCreating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Display New Token Dialog */}
      <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Token Created Successfully
            </DialogTitle>
            <DialogDescription>
              Copy your new token now. For security reasons, you won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {newTokenData && (
              <>
                <div className="space-y-2">
                  <Label>Token Name</Label>
                  <p className="font-medium">{newTokenData.name}</p>
                </div>
                <div className="space-y-2">
                  <Label>Your New Token</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      type={showNewToken ? "text" : "password"}
                      value={newTokenData.token}
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNewToken(!showNewToken)}
                    >
                      {showNewToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyToken(newTokenData.token)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg p-4">
                  <div className="flex gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0" />
                    <div className="text-sm text-orange-900 dark:text-orange-200">
                      <p className="font-medium">Make sure to copy your token now!</p>
                      <p className="mt-1">
                        You won&apos;t be able to see this token again. Store it somewhere safe.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowTokenDialog(false)}>I&apos;ve Saved My Token</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function APITokensPage() {
  return (
    <RouteGuard permission="settings.tokens.read">
      <APITokensContent />
    </RouteGuard>
  );
}
