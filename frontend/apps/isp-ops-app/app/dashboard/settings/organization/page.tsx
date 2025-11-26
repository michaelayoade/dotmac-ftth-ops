"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Switch } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@dotmac/ui";
import { Separator } from "@dotmac/ui";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  Users,
  CreditCard,
  Edit,
  MoreHorizontal,
  Mail,
  CheckCircle2,
  AlertCircle,
  Upload,
  Download,
  UserPlus,
  Key,
  Save,
  X,
  Loader2,
  BarChart3,
} from "lucide-react";
import { useToast } from "@dotmac/ui";
import { logger } from "@/lib/logger";
import { useTenant } from "@/lib/contexts/tenant-context";
import {
  tenantService,
  Tenant,
  TenantInvitation,
  TenantStats,
} from "@/lib/services/tenant-service";
import { DomainVerificationCard } from "@/components/tenant/DomainVerificationCard";

export default function OrganizationSettingsPage() {
  const { toast } = useToast();
  const { currentTenant, refreshTenant } = useTenant();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [invitations, setInvitations] = useState<TenantInvitation[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  // Form states
  const [formData, setFormData] = useState<Partial<Tenant>>({});
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Member");

  const loadTenantData = useCallback(async () => {
    if (!currentTenant) return;

    try {
      setIsLoading(true);

      // Fetch tenant details
      const tenantData = await tenantService.getTenant(currentTenant.id);
      setTenant(tenantData);
      setFormData(tenantData);

      // Fetch stats
      const statsData = await tenantService.getStats(currentTenant.id);
      setStats(statsData);

      // Fetch invitations
      const invitationsData = await tenantService.listInvitations(currentTenant.id);
      setInvitations(invitationsData);
    } catch (error) {
      logger.error("Failed to load tenant data", error);
      toast({
        title: "Error",
        description: "Failed to load organization data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant, toast]);

  // Load tenant data
  useEffect(() => {
    if (currentTenant) {
      loadTenantData();
    }
  }, [currentTenant, loadTenantData]);

  const handleSaveOrganization = async () => {
    if (!currentTenant) return;

    try {
      setIsSaving(true);

      const updatePayload = {
        name: formData["name"],
        slug: formData.slug,
        description: formData["description"],
        website: formData.website,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone,
        address: formData.address,
        industry: formData.industry,
        company_size: formData.company_size,
        tax_id: formData.tax_id,
        billing_email: formData.billing_email,
      };

      const sanitizedPayload = Object.fromEntries(
        Object.entries(updatePayload).filter(([, value]) => value !== undefined),
      ) as Partial<Tenant>;

      await tenantService.updateTenant(currentTenant.id, sanitizedPayload);

      await loadTenantData();
      await refreshTenant();

      setIsEditing(false);
      logger.info("Organization settings updated", { tenantId: currentTenant.id });
      toast({
        title: "Success",
        description: "Organization settings updated successfully",
      });
    } catch (error) {
      logger.error("Failed to save organization", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update organization",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (tenant) {
      setFormData(tenant);
    }
    setIsEditing(false);
  };

  const handleInviteMember = async () => {
    if (!currentTenant || !inviteEmail) return;

    try {
      await tenantService.createInvitation(currentTenant.id, {
        email: inviteEmail,
        role: inviteRole,
        expires_in_days: 7,
      });

      await loadTenantData();

      setIsInviteOpen(false);
      setInviteEmail("");
      setInviteRole("Member");

      logger.info("Team invitation sent", { email: inviteEmail, role: inviteRole });
      toast({
        title: "Success",
        description: `Invitation sent to ${inviteEmail}`,
      });
    } catch (error) {
      logger.error("Failed to send invitation", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send invitation",
        variant: "destructive",
      });
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!currentTenant) return;

    try {
      await tenantService.revokeInvitation(currentTenant.id, invitationId);
      await loadTenantData();

      logger.info("Team invitation revoked", { invitationId });
      toast({
        title: "Success",
        description: "Invitation revoked successfully",
      });
    } catch (error) {
      logger.error("Failed to revoke invitation", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to revoke invitation",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      active: {
        color: "bg-green-500/10 text-green-500 dark:bg-green-500/20",
        label: "Active",
      },
      trial: {
        color: "bg-blue-500/10 text-blue-500 dark:bg-blue-500/20",
        label: "Trial",
      },
      suspended: {
        color: "bg-orange-500/10 text-orange-500 dark:bg-orange-500/20",
        label: "Suspended",
      },
      cancelled: {
        color: "bg-red-500/10 text-red-500 dark:bg-red-500/20",
        label: "Cancelled",
      },
      expired: {
        color: "bg-red-500/10 text-red-500 dark:bg-red-500/20",
        label: "Expired",
      },
    };
    const variant = variants[status] || {
      color: "bg-card0/10 text-muted-foreground",
      label: status,
    };
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  const getInvitationStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      pending: {
        color: "bg-yellow-500/10 text-yellow-500 dark:bg-yellow-500/20",
        label: "Pending",
      },
      accepted: {
        color: "bg-green-500/10 text-green-500 dark:bg-green-500/20",
        label: "Accepted",
      },
      revoked: {
        color: "bg-red-500/10 text-red-500 dark:bg-red-500/20",
        label: "Revoked",
      },
      expired: {
        color: "bg-card0/10 text-muted-foreground dark:bg-card0/20",
        label: "Expired",
      },
    };
    const variant = variants[status] || {
      color: "bg-card0/10 text-muted-foreground",
      label: status,
    };
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500 dark:text-sky-400" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-orange-500 dark:text-orange-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground dark:text-white">
            No Organization Found
          </h3>
          <p className="text-foreground dark:text-muted-foreground mt-2">
            Unable to load organization data
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground dark:text-white">
          Organization Settings
        </h1>
        <p className="text-foreground dark:text-muted-foreground mt-2">
          Manage your organization profile, team, and settings
        </p>
      </div>

      {/* Status Banner */}
      {tenant.status !== "active" && (
        <Card className="border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
              <div>
                <p className="font-medium text-orange-900 dark:text-orange-200">
                  Account Status: {getStatusBadge(tenant.status)}
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                  {tenant.status === "trial" &&
                    tenant.trial_ends_at &&
                    `Your trial period ends on ${new Date(tenant.trial_ends_at).toLocaleDateString()}`}
                  {tenant.status === "suspended" &&
                    "Your account has been suspended. Contact support for assistance."}
                  {tenant.status === "cancelled" && "Your account has been cancelled."}
                  {tenant.status === "expired" && "Your subscription has expired."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="bg-muted dark:bg-accent">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="invitations">Team Invitations</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-foreground dark:text-white">
                    Organization Profile
                  </CardTitle>
                  <CardDescription className="text-foreground dark:text-muted-foreground">
                    Basic information about your organization
                  </CardDescription>
                </div>
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button onClick={handleSaveOrganization} disabled={isSaving}>
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo Section */}
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={tenant.logo_url || undefined} />
                  <AvatarFallback className="text-2xl bg-sky-500 dark:bg-sky-600 text-white">
                    {tenant.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <div className="space-y-2">
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Logo
                    </Button>
                    <p className="text-xs text-muted-foreground">PNG, JPG or SVG, max 2MB</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Organization Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input
                    id="org-name"
                    value={formData["name"] || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-slug">URL Slug</Label>
                  <Input
                    id="org-slug"
                    value={formData.slug || ""}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    disabled={!isEditing}
                    placeholder="acme-corp"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="org-description">Description</Label>
                  <Textarea
                    id="org-description"
                    value={formData["description"] || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    disabled={!isEditing}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-website">Website</Label>
                  <Input
                    id="org-website"
                    type="url"
                    value={formData.website || ""}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-email">Contact Email</Label>
                  <Input
                    id="org-email"
                    type="email"
                    value={formData.contact_email || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contact_email: e.target.value,
                      })
                    }
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-phone">Phone Number</Label>
                  <Input
                    id="org-phone"
                    type="tel"
                    value={formData.contact_phone || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contact_phone: e.target.value,
                      })
                    }
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-industry">Industry</Label>
                  <Input
                    id="org-industry"
                    value={formData.industry || ""}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    disabled={!isEditing}
                    placeholder="Technology, Finance, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-size">Company Size</Label>
                  <Input
                    id="org-size"
                    value={formData.company_size || ""}
                    onChange={(e) => setFormData({ ...formData, company_size: e.target.value })}
                    disabled={!isEditing}
                    placeholder="1-10, 11-50, etc."
                  />
                </div>
              </div>

              {/* Address Section */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground dark:text-white">Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="org-street">Street Address</Label>
                    <Input
                      id="org-street"
                      value={formData.address?.street || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: {
                            ...formData.address,
                            street: e.target.value,
                          },
                        })
                      }
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-city">City</Label>
                    <Input
                      id="org-city"
                      value={formData.address?.city || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: {
                            ...formData.address,
                            city: e.target.value,
                          },
                        })
                      }
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-state">State/Province</Label>
                    <Input
                      id="org-state"
                      value={formData.address?.state || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: {
                            ...formData.address,
                            state: e.target.value,
                          },
                        })
                      }
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-zip">ZIP/Postal Code</Label>
                    <Input
                      id="org-zip"
                      value={formData.address?.zip || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: { ...formData.address, zip: e.target.value },
                        })
                      }
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-country">Country</Label>
                    <Input
                      id="org-country"
                      value={formData.address?.country || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: {
                            ...formData.address,
                            country: e.target.value,
                          },
                        })
                      }
                      disabled={!isEditing}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Invitations Tab */}
        <TabsContent value="invitations" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-foreground dark:text-white">
                    Team Invitations
                  </CardTitle>
                  <CardDescription className="text-foreground dark:text-muted-foreground">
                    Manage pending and sent invitations
                  </CardDescription>
                </div>
                <Button onClick={() => setIsInviteOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {invitations.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-foreground dark:text-muted-foreground">
                    No invitations sent yet
                  </p>
                  <Button variant="outline" className="mt-4" onClick={() => setIsInviteOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Send First Invitation
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Invited By</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell className="font-medium">{invitation.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{invitation.role}</Badge>
                        </TableCell>
                        <TableCell>{getInvitationStatusBadge(invitation.status)}</TableCell>
                        <TableCell className="text-sm text-foreground dark:text-muted-foreground">
                          {invitation.invited_by}
                        </TableCell>
                        <TableCell className="text-sm text-foreground dark:text-muted-foreground">
                          {new Date(invitation.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm text-foreground dark:text-muted-foreground">
                          {new Date(invitation.expires_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {invitation.status === "pending" && (
                            <DropdownMenu>
                              <DropdownMenuTrigger>
                                <Button
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  aria-label={`Open actions for invitation ${invitation.email}`}
                                  title={`Open actions for invitation ${invitation.email}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleRevokeInvitation(invitation.id)}
                                  className="text-red-600 dark:text-red-400"
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Revoke
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="stats" className="space-y-4">
          {stats && (
            <>
              {/* Usage Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-foreground dark:text-muted-foreground">
                      Total Users
                    </CardTitle>
                    <Users className="h-4 w-4 text-foreground dark:text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground dark:text-white">
                      {stats.total_users}
                    </div>
                    <p className="text-xs text-foreground dark:text-muted-foreground mt-1">
                      {stats.active_users} active
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-foreground dark:text-muted-foreground">
                      API Calls
                    </CardTitle>
                    <BarChart3 className="h-4 w-4 text-foreground dark:text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground dark:text-white">
                      {stats.total_api_calls.toLocaleString()}
                    </div>
                    <p className="text-xs text-foreground dark:text-muted-foreground mt-1">
                      This period
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-foreground dark:text-muted-foreground">
                      Storage Used
                    </CardTitle>
                    <Upload className="h-4 w-4 text-foreground dark:text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground dark:text-white">
                      {(stats.storage_used / 1024 / 1024 / 1024).toFixed(2)} GB
                    </div>
                    <p className="text-xs text-foreground dark:text-muted-foreground mt-1">
                      Across all files
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-foreground dark:text-muted-foreground">
                      Features Enabled
                    </CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-foreground dark:text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground dark:text-white">
                      {stats.features_enabled}
                    </div>
                    <p className="text-xs text-foreground dark:text-muted-foreground mt-1">
                      Active features
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Plan and Status Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-foreground dark:text-white">
                    Plan Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground dark:text-muted-foreground">
                        Current Plan
                      </p>
                      <p className="text-lg font-semibold text-foreground dark:text-white mt-1">
                        {tenantService.getPlanDisplayName(stats.plan)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-lg px-3 py-1">
                      {tenantService.getPlanDisplayName(stats.plan)}
                    </Badge>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground dark:text-muted-foreground">
                        Account Status
                      </p>
                      <p className="text-lg font-semibold text-foreground dark:text-white mt-1">
                        {tenantService.getStatusDisplayName(stats.status)}
                      </p>
                    </div>
                    {getStatusBadge(stats.status)}
                  </div>

                  {stats.days_until_trial_end !== undefined &&
                    stats.days_until_trial_end !== null && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-sm font-medium text-foreground dark:text-muted-foreground">
                            Trial Period
                          </p>
                          <p className="text-lg font-semibold text-foreground dark:text-white mt-1">
                            {stats.days_until_trial_end > 0
                              ? `${stats.days_until_trial_end} days remaining`
                              : "Expired"}
                          </p>
                        </div>
                      </>
                    )}

                  {stats.days_until_subscription_end !== undefined &&
                    stats.days_until_subscription_end !== null && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-sm font-medium text-foreground dark:text-muted-foreground">
                            Subscription
                          </p>
                          <p className="text-lg font-semibold text-foreground dark:text-white mt-1">
                            {stats.days_until_subscription_end > 0
                              ? `Renews in ${stats.days_until_subscription_end} days`
                              : "Expired"}
                          </p>
                        </div>
                      </>
                    )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground dark:text-white">Billing Information</CardTitle>
              <CardDescription className="text-foreground dark:text-muted-foreground">
                Manage your organization&apos;s billing details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-foreground dark:text-white">Current Plan</p>
                  <p className="text-sm text-foreground dark:text-muted-foreground">
                    You are on the {tenantService.getPlanDisplayName(tenant.plan ?? "free")} plan
                  </p>
                </div>
                <Badge variant="default" className="text-lg px-3 py-1">
                  {tenantService.getPlanDisplayName(tenant.plan ?? "free")}
                </Badge>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="billing-email">Billing Email</Label>
                    <Input
                      id="billing-email"
                      type="email"
                      value={tenant.billing_email || tenant.contact_email || ""}
                      disabled
                      className="bg-card dark:bg-card"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax-id">Tax ID</Label>
                    <Input
                      id="tax-id"
                      value={tenant.tax_id || "Not provided"}
                      disabled
                      className="bg-card dark:bg-card"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing-cycle">Billing Cycle</Label>
                    <Input
                      id="billing-cycle"
                      value={tenant.billing_cycle}
                      disabled
                      className="bg-card dark:bg-card capitalize"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Update Payment Method
                </Button>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download Invoices
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground dark:text-white">Security Settings</CardTitle>
              <CardDescription className="text-foreground dark:text-muted-foreground">
                Configure organization-wide security settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-foreground dark:text-white">
                    Require 2FA for all members
                  </Label>
                  <p className="text-sm text-foreground dark:text-muted-foreground">
                    Enforce two-factor authentication
                  </p>
                </div>
                <Switch />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-foreground dark:text-white">IP allowlist</Label>
                  <p className="text-sm text-foreground dark:text-muted-foreground">
                    Restrict access to specific IP addresses
                  </p>
                </div>
                <Switch />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-foreground dark:text-white">SSO (Single Sign-On)</Label>
                  <p className="text-sm text-foreground dark:text-muted-foreground">
                    Enable SSO with your identity provider
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-foreground dark:text-white">API Keys</CardTitle>
              <CardDescription className="text-foreground dark:text-muted-foreground">
                Manage API keys for programmatic access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <p className="text-sm text-foreground dark:text-muted-foreground">
                  No API keys created yet
                </p>
                <Button variant="outline">
                  <Key className="h-4 w-4 mr-2" />
                  Create API Key
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Domain Verification */}
          {currentTenant && <DomainVerificationCard tenantId={currentTenant.id} />}
        </TabsContent>
      </Tabs>

      {/* Invite Member Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground dark:text-white">
              Invite Team Member
            </DialogTitle>
            <DialogDescription className="text-foreground dark:text-muted-foreground">
              Send an invitation to join your organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Input
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                placeholder="Member, Admin, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInviteMember} disabled={!inviteEmail}>
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
