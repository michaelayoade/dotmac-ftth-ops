"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dotmac/ui";
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
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
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
