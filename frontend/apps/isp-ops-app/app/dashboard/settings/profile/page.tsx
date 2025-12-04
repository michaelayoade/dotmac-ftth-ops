"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Switch } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@dotmac/ui";
import { Separator } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  User,
  Shield,
  Smartphone,
  Eye,
  EyeOff,
  Camera,
  Save,
  X,
  AlertCircle,
  LogOut,
  Trash2,
  Download,
  Clock,
} from "lucide-react";
import { useToast } from "@dotmac/ui";
import { useSession } from "@shared/lib/auth";
import type { UserInfo } from "@shared/lib/auth";
import {
  useUpdateProfile,
  useChangePassword,
  useVerifyPhone,
  useEnable2FA,
  useVerify2FA,
  useDisable2FA,
  useUploadAvatar,
  useDeleteAccount,
  useExportData,
  useListSessions,
  useRevokeSession,
  useRevokeAllSessions,
} from "@/hooks/useProfile";
import { logger } from "@/lib/logger";

type DisplayUser = Pick<
  UserInfo,
  | "id"
  | "email"
  | "username"
  | "first_name"
  | "last_name"
  | "mfa_enabled"
  | "mfa_backup_codes_remaining"
>;

// Migrated from sonner to useToast hook
// Note: toast options have changed:
// - sonner: toast.success('msg') -> useToast: toast({ title: 'Success', description: 'msg' })
// - sonner: toast.error('msg') -> useToast: toast({ title: 'Error', description: 'msg', variant: 'destructive' })
// - For complex options, refer to useToast documentation

export default function ProfileSettingsPage() {
  const { toast } = useToast();
  const { user: sessionUser, refreshUser } = useSession();
  const user = sessionUser as DisplayUser | undefined;
  const { data: sessionsData, isLoading: sessionsLoading } = useListSessions();
  const revokeSession = useRevokeSession();
  const revokeAllSessions = useRevokeAllSessions();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const verifyPhone = useVerifyPhone();
  const deleteAccount = useDeleteAccount();
  const exportData = useExportData();
  const enable2FA = useEnable2FA();
  const verify2FA = useVerify2FA();
  const disable2FA = useDisable2FA();
  const uploadAvatar = useUploadAvatar();
  const [isEditing, setIsEditing] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [isSetup2FAOpen, setIsSetup2FAOpen] = useState(false);
  const [isDisable2FAOpen, setIsDisable2FAOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState<boolean>(Boolean(user?.mfa_enabled));
  const [twoFactorSetup, setTwoFactorSetup] = useState({
    step: "password" as "password" | "verify",
    password: "",
    token: "",
    qrCode: "",
    secret: "",
    backupCodes: [] as string[],
    provisioningUri: "",
  });
  const [disable2FAForm, setDisable2FAForm] = useState({
    password: "",
    token: "",
  });

  // Form states
  const [formData, setFormData] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
    username: user?.username || "",
    phone: "",
    location: "",
    timezone: "America/Los_Angeles",
    language: "en-US",
    bio: "",
    website: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    new: "",
    confirm: "",
  });

  // Update formData when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        username: user.username || "",
        phone: "",
        location: "",
        timezone: "America/Los_Angeles",
        language: "en-US",
        bio: "",
        website: "",
      });
    }
  }, [user]);

  useEffect(() => {
    setMfaEnabled(Boolean(user?.mfa_enabled));
  }, [user?.mfa_enabled]);

  useEffect(() => {
    if (!isSetup2FAOpen) {
      setTwoFactorSetup({
        step: "password",
        password: "",
        token: "",
        qrCode: "",
        secret: "",
        backupCodes: [],
        provisioningUri: "",
      });
    }
  }, [isSetup2FAOpen]);

  useEffect(() => {
    if (!isDisable2FAOpen) {
      setDisable2FAForm({ password: "", token: "" });
    }
  }, [isDisable2FAOpen]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image file (JPG, PNG, or GIF)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 2MB",
        variant: "destructive",
      });
      return;
    }

    setAvatarFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      logger.info("Saving profile", { formData });

      // Upload avatar if changed
      if (avatarFile) {
        try {
          await uploadAvatar.mutateAsync(avatarFile);
          logger.info("Avatar uploaded successfully");
        } catch (avatarError) {
          logger.error(
            "Failed to upload avatar",
            avatarError instanceof Error ? avatarError : new Error(String(avatarError)),
          );
          toast({
            title: "Avatar upload failed",
            description: "Your profile was updated but the avatar upload failed. Please try again.",
            variant: "destructive",
          });
        }
      }

      // Update profile
      await updateProfile.mutateAsync(formData);
      await refreshUser();

      // Reset avatar state
      setAvatarFile(null);
      setAvatarPreview(null);
      setIsEditing(false);

      toast({ title: "Success", description: "Profile updated successfully" });
    } catch (error) {
      logger.error(
        "Failed to save profile",
        error instanceof Error ? error : new Error(String(error)),
      );
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    if (user) {
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        username: user.username || "",
        phone: "",
        location: "",
        timezone: "America/Los_Angeles",
        language: "en-US",
        bio: "",
        website: "",
      });
    }
    // Reset avatar state
    setAvatarFile(null);
    setAvatarPreview(null);
    setIsEditing(false);
  };

  const handleChangePassword = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      logger.info("Changing password");
      await changePassword.mutateAsync({
        current_password: passwordForm.current,
        new_password: passwordForm.new,
      });
      setIsChangePasswordOpen(false);
      setPasswordForm({ current: "", new: "", confirm: "" });
      toast({ title: "Success", description: "Password changed successfully" });
    } catch (error) {
      logger.error(
        "Failed to change password",
        error instanceof Error ? error : new Error(String(error)),
      );
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnable2FA = () => {
    setTwoFactorSetup({
      step: "password",
      password: "",
      token: "",
      qrCode: "",
      secret: "",
      backupCodes: [],
      provisioningUri: "",
    });
    setIsSetup2FAOpen(true);
  };

  const handleGenerate2FASetup = async () => {
    const password = twoFactorSetup.password.trim();
    if (!password) {
      toast({
        title: "Password required",
        description: "Enter your current password to continue.",
        variant: "destructive",
      });
      return;
    }

    try {
      const data = await enable2FA.mutateAsync({ password });
      setTwoFactorSetup((prev) => ({
        ...prev,
        step: "verify",
        qrCode: data.qr_code,
        secret: data.secret,
        backupCodes: data.backup_codes,
        provisioningUri: data.provisioning_uri,
        token: "",
        password,
      }));
      toast({
        title: "Verification required",
        description: "Scan the QR code and enter the code from your authenticator app.",
      });
    } catch (error) {
      logger.error(
        "Failed to initiate 2FA setup",
        error instanceof Error ? error : new Error(String(error)),
      );
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unable to start 2FA setup",
        variant: "destructive",
      });
    }
  };

  const handleComplete2FASetup = async () => {
    if (twoFactorSetup.token.trim().length !== 6) {
      toast({
        title: "Invalid code",
        description: "Enter the 6-digit code from your authenticator app.",
        variant: "destructive",
      });
      return;
    }

    try {
      await verify2FA.mutateAsync({ token: twoFactorSetup.token.trim() });
      toast({
        title: "Success",
        description: "Two-factor authentication enabled",
      });
      setMfaEnabled(true);
      setIsSetup2FAOpen(false);
      await refreshUser();
    } catch (error) {
      logger.error(
        "Failed to verify 2FA",
        error instanceof Error ? error : new Error(String(error)),
      );
      toast({
        title: "Verification failed",
        description: error instanceof Error ? error.message : "Invalid verification code",
        variant: "destructive",
      });
    }
  };

  const handleDisable2FA = () => {
    setDisable2FAForm({ password: "", token: "" });
    setIsDisable2FAOpen(true);
  };

  const handleConfirmDisable2FA = async () => {
    if (!disable2FAForm.password || disable2FAForm.token.trim().length !== 6) {
      toast({
        title: "Incomplete form",
        description: "Enter your password and a valid 6-digit code.",
        variant: "destructive",
      });
      return;
    }

    try {
      await disable2FA.mutateAsync({
        password: disable2FAForm.password,
        token: disable2FAForm.token.trim(),
      });
      toast({
        title: "Success",
        description: "Two-factor authentication disabled",
      });
      setMfaEnabled(false);
      setIsDisable2FAOpen(false);
      await refreshUser();
    } catch (error) {
      logger.error(
        "Failed to disable 2FA",
        error instanceof Error ? error : new Error(String(error)),
      );
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unable to disable 2FA",
        variant: "destructive",
      });
    }
  };

  const handleCopyBackupCodes = async () => {
    if (
      !twoFactorSetup.backupCodes.length ||
      typeof navigator === "undefined" ||
      !navigator.clipboard
    ) {
      return;
    }
    try {
      await navigator.clipboard.writeText(twoFactorSetup.backupCodes.join("\n"));
      toast({
        title: "Copied",
        description: "Backup codes copied to clipboard",
      });
    } catch (error) {
      logger.error(
        "Failed to copy backup codes",
        error instanceof Error ? error : new Error(String(error)),
      );
      toast({
        title: "Copy failed",
        description: "Unable to copy backup codes. Copy them manually instead.",
        variant: "destructive",
      });
    }
  };

  const handleVerifyPhone = async () => {
    try {
      logger.info("Verifying phone number", { phone: formData["phone"] });
      await verifyPhone.mutateAsync(formData["phone"]);
      await refreshUser();
      toast({
        title: "Success",
        description: "Phone number verified successfully",
      });
    } catch (error) {
      logger.error(
        "Failed to verify phone",
        error instanceof Error ? error : new Error(String(error)),
      );
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to verify phone",
        variant: "destructive",
      });
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await revokeSession.mutateAsync(sessionId);
      toast({ title: "Success", description: "Session revoked successfully" });
    } catch (error) {
      logger.error(
        "Failed to revoke session",
        error instanceof Error ? error : new Error(String(error)),
      );
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to revoke session",
        variant: "destructive",
      });
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      await revokeAllSessions.mutateAsync();
      toast({
        title: "Success",
        description: "All other sessions revoked successfully",
      });
    } catch (error) {
      logger.error(
        "Failed to revoke all sessions",
        error instanceof Error ? error : new Error(String(error)),
      );
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to revoke sessions",
        variant: "destructive",
      });
    }
  };

  const handleExportData = async () => {
    try {
      await exportData.mutateAsync();
      toast({
        title: "Success",
        description: "Profile data exported successfully",
      });
    } catch (error) {
      logger.error(
        "Failed to export data",
        error instanceof Error ? error : new Error(String(error)),
      );
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to export data",
        variant: "destructive",
      });
    }
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    if (!firstName || !lastName) return "U";
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your personal information and account settings
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your personal details and public profile</CardDescription>
                </div>
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)}>
                    <User className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleCancelEdit}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button onClick={handleSaveProfile} disabled={isLoading}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarPreview || undefined} />
                  <AvatarFallback>{getInitials(user.first_name, user.last_name)}</AvatarFallback>
                </Avatar>
                {isEditing && (
                  <div className="space-y-2">
                    <input
                      type="file"
                      id="avatar-upload"
                      className="hidden"
                      accept="image/jpeg,image/png,image/gif"
                      onChange={handleAvatarChange}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("avatar-upload")?.click()}
                      type="button"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      {avatarPreview ? "Change Photo" : "Upload Photo"}
                    </Button>
                    <p className="text-xs text-muted-foreground">JPG, PNG or GIF, max 2MB</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Personal Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData["email"]}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="font-semibold">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="flex gap-2">
                      <Input
                        id="phone"
                        type="tel"
                        value={formData["phone"]}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        disabled={!isEditing}
                        placeholder="Enter phone number"
                      />
                      {isEditing && formData["phone"] && (
                        <Button size="sm" variant="outline" onClick={handleVerifyPhone}>
                          Verify
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <h3 className="font-semibold">Additional Information</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      disabled={!isEditing}
                      rows={3}
                      placeholder="Tell us about yourself..."
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        disabled={!isEditing}
                        placeholder="City, Country"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        type="url"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        disabled={!isEditing}
                        placeholder="https://example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <select
                        id="timezone"
                        value={formData.timezone}
                        onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                        disabled={!isEditing}
                        className="h-10 w-full rounded-md border border-border bg-accent px-3 text-sm text-white"
                      >
                        <option value="America/Los_Angeles">Pacific Time (PT)</option>
                        <option value="America/Denver">Mountain Time (MT)</option>
                        <option value="America/Chicago">Central Time (CT)</option>
                        <option value="America/New_York">Eastern Time (ET)</option>
                        <option value="Europe/London">London (GMT)</option>
                        <option value="Europe/Paris">Paris (CET)</option>
                        <option value="Asia/Tokyo">Tokyo (JST)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="language">Language</Label>
                      <select
                        id="language"
                        value={formData.language}
                        onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                        disabled={!isEditing}
                        className="h-10 w-full rounded-md border border-border bg-accent px-3 text-sm text-white"
                      >
                        <option value="en-US">English (US)</option>
                        <option value="en-GB">English (UK)</option>
                        <option value="es-ES">Español</option>
                        <option value="fr-FR">Français</option>
                        <option value="de-DE">Deutsch</option>
                        <option value="ja-JP">日本語</option>
                        <option value="zh-CN">中文</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Password</CardTitle>
              <CardDescription>Manage your password and authentication settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">Password</p>
                  <p className="text-sm text-muted-foreground">Last changed 3 months ago</p>
                </div>
                <Button variant="outline" onClick={() => setIsChangePasswordOpen(true)}>
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>Add an extra layer of security to your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      mfaEnabled ? "bg-emerald-100 dark:bg-emerald-950/20" : "bg-muted"
                    }`}
                  >
                    <Shield
                      className={`h-5 w-5 ${
                        mfaEnabled ? "text-emerald-500" : "text-muted-foreground"
                      }`}
                    />
                  </div>
                  <div>
                    <p className="font-medium">
                      {mfaEnabled ? "2FA is enabled" : "2FA is not enabled"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {mfaEnabled
                        ? `Backup codes remaining: ${user?.mfa_backup_codes_remaining ?? 0}`
                        : "Secure your account with two-factor authentication"}
                    </p>
                  </div>
                </div>
                {mfaEnabled ? (
                  <Button variant="outline" onClick={handleDisable2FA}>
                    Disable 2FA
                  </Button>
                ) : (
                  <Button onClick={handleEnable2FA}>Enable 2FA</Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Security</CardTitle>
              <CardDescription>Additional security options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Login alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified of new sign-ins</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require password for sensitive actions</Label>
                  <p className="text-sm text-muted-foreground">
                    Ask for password when changing critical settings
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Manage your active sessions across devices</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sessionsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading sessions...</div>
              ) : sessionsData?.sessions && sessionsData.sessions.length > 0 ? (
                <>
                  {sessionsData.sessions.map((session) => (
                    <div
                      key={session.session_id}
                      className="flex justify-between items-start p-4 border rounded-lg"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-muted rounded-full">
                          <Smartphone className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">{session.user_agent || "Unknown Device"}</p>
                          <p className="text-sm text-muted-foreground">
                            {session.ip_address || "Unknown IP"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <Clock className="h-3 w-3 inline mr-1" />
                            Created {new Date(session.created_at).toLocaleString()}
                          </p>
                          {session.last_accessed && (
                            <p className="text-xs text-muted-foreground">
                              Last active {new Date(session.last_accessed).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevokeSession(session.session_id)}
                        disabled={revokeSession.isPending}
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Revoke
                      </Button>
                    </div>
                  ))}
                  <div className="pt-4">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleRevokeAllSessions}
                      disabled={revokeAllSessions.isPending}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out All Other Sessions
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No active sessions found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Privacy Settings</CardTitle>
              <CardDescription>Control your privacy and data sharing preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Profile visibility</Label>
                  <p className="text-sm text-muted-foreground">
                    Make your profile visible to others
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show email address</Label>
                  <p className="text-sm text-muted-foreground">Allow others to see your email</p>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show activity status</Label>
                  <p className="text-sm text-muted-foreground">
                    Let others see when you&apos;re online
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>Manage your personal data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">Export your data</p>
                  <p className="text-sm text-muted-foreground">
                    Download all your profile information
                  </p>
                </div>
                <Button variant="outline" onClick={handleExportData}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-red-600 dark:text-red-400">Delete account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and data
                  </p>
                </div>
                <Button variant="destructive" onClick={() => setIsDeleteAccountOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User ID</span>
                  <span className="font-mono">{user.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Username</span>
                  <span>{user.username}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Change Password Dialog */}
      <Dialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter your current password and choose a new one</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showPassword ? "text" : "password"}
                  value={passwordForm.current}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      current: e.target.value,
                    })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={passwordForm.new}
                onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChangePasswordOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={isLoading}>
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <Dialog open={isDisable2FAOpen} onOpenChange={setIsDisable2FAOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Enter your password and a code from your authenticator app to disable 2FA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="disable-2fa-password">Current password</Label>
              <Input
                id="disable-2fa-password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                value={disable2FAForm.password}
                onChange={(e) =>
                  setDisable2FAForm((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disable-2fa-token">Authenticator code</Label>
              <Input
                id="disable-2fa-token"
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                value={disable2FAForm.token}
                onChange={(e) =>
                  setDisable2FAForm((prev) => ({
                    ...prev,
                    token: e.target.value.replace(/\D/g, "").slice(0, 6),
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDisable2FAOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDisable2FA}
              disabled={
                disable2FA.isPending ||
                !disable2FAForm.password ||
                disable2FAForm.token.length !== 6
              }
            >
              {disable2FA.isPending ? "Disabling…" : "Disable 2FA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2FA Setup Dialog */}
      <Dialog open={isSetup2FAOpen} onOpenChange={setIsSetup2FAOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {twoFactorSetup.step === "password"
                ? "Enable Two-Factor Authentication"
                : "Verify Two-Factor Authentication"}
            </DialogTitle>
            <DialogDescription>
              {twoFactorSetup.step === "password"
                ? "Enter your password to generate a QR code for your authenticator app."
                : "Scan the QR code and enter the 6-digit code from your authenticator app."}
            </DialogDescription>
          </DialogHeader>

          {twoFactorSetup.step === "password" ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="2fa-password">Current password</Label>
                <Input
                  id="2fa-password"
                  type="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={twoFactorSetup.password}
                  onChange={(e) =>
                    setTwoFactorSetup((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="bg-card p-4 rounded-lg flex justify-center">
                {twoFactorSetup.qrCode ? (
                  <Image
                    unoptimized
                    src={twoFactorSetup.qrCode}
                    alt="2FA QR code"
                    width={192}
                    height={192}
                    className="h-48 w-48"
                  />
                ) : (
                  <div className="h-48 w-48 bg-muted rounded flex items-center justify-center">
                    <span className="text-muted-foreground">QR Code unavailable</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Manual entry key</Label>
                <code className="block rounded bg-muted px-3 py-2 text-sm">
                  {twoFactorSetup.secret || "—"}
                </code>
                {twoFactorSetup.provisioningUri && (
                  <p className="text-xs text-muted-foreground break-all">
                    {twoFactorSetup.provisioningUri}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  If you cannot scan the QR code, enter this key manually in your authenticator app.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Backup codes</Label>
                <div className="grid grid-cols-2 gap-2 rounded border border-border/60 bg-card/40 p-3 text-sm font-mono">
                  {twoFactorSetup.backupCodes.map((code) => (
                    <span key={code}>{code}</span>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={handleCopyBackupCodes}>
                    Copy backup codes
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Store these backup codes securely. They will not be shown again.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="2fa-code">Verification code</Label>
                <Input
                  id="2fa-code"
                  placeholder="000000"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={twoFactorSetup.token}
                  onChange={(e) =>
                    setTwoFactorSetup((prev) => ({
                      ...prev,
                      token: e.target.value.replace(/\D/g, "").slice(0, 6),
                    }))
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSetup2FAOpen(false)}>
              Cancel
            </Button>
            {twoFactorSetup.step === "password" ? (
              <Button
                onClick={handleGenerate2FASetup}
                disabled={!twoFactorSetup.password || enable2FA.isPending}
              >
                {enable2FA.isPending ? "Generating…" : "Continue"}
              </Button>
            ) : (
              <Button
                onClick={handleComplete2FASetup}
                disabled={twoFactorSetup.token.length !== 6 || verify2FA.isPending}
              >
                {verify2FA.isPending ? "Enabling…" : "Enable 2FA"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={isDeleteAccountOpen} onOpenChange={setIsDeleteAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              This action cannot be undone. All your data will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-red-100 dark:bg-red-950/20 border border-red-200 dark:border-red-900/20 rounded-md p-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-3" />
                <div className="text-sm text-red-800 dark:text-red-300">
                  <p className="font-semibold">Warning:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>All your data will be permanently deleted</li>
                    <li>You will lose access to all services</li>
                    <li>This action cannot be reversed</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="delete-password">Password</Label>
                <Input
                  id="delete-password"
                  type="password"
                  placeholder="Enter your password"
                  value={passwordForm.current}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      current: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-delete">
                  Type <span className="font-mono font-semibold">DELETE</span> to confirm
                </Label>
                <Input
                  id="confirm-delete"
                  placeholder="Type DELETE"
                  value={passwordForm.confirm}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirm: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteAccountOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteAccount.isPending}
              onClick={async () => {
                try {
                  await deleteAccount.mutateAsync({
                    confirmation: passwordForm.confirm,
                    password: passwordForm.current,
                  });
                } catch (error) {
                  toast({
                    title: "Error",
                    description:
                      error instanceof Error ? error.message : "Failed to delete account",
                    variant: "destructive",
                  });
                }
              }}
            >
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
