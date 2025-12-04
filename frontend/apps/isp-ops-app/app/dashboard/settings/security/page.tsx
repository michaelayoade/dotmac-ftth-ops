"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Switch } from "@dotmac/ui";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  Shield,
  Lock,
  Smartphone,
  Key,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Copy,
  Download,
  Trash2,
  Eye,
  EyeOff,
  Save,
} from "lucide-react";
import { useToast } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { logger } from "@/lib/logger";
import Image from "next/image";
const toError = (error: unknown) =>
  error instanceof Error ? error : new Error(typeof error === "string" ? error : String(error));

interface Session {
  id: string;
  device: string;
  location: string;
  ip_address: string;
  last_active: string;
  is_current: boolean;
}

interface BackupCode {
  code: string;
  used: boolean;
}

interface SecuritySettings {
  mfa_enabled: boolean;
  password_last_changed: string;
  active_sessions: number;
  backup_codes_remaining: number;
}

function SecuritySettingsContent() {
  const { toast } = useToast();

  // State
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [backupCodes, setBackupCodes] = useState<BackupCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Password change state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // 2FA state
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isEnabling2FA, setIsEnabling2FA] = useState(false);

  // Backup codes state
  const [showBackupCodesDialog, setShowBackupCodesDialog] = useState(false);

  const loadSecuritySettings = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch security settings
      const settingsRes = await apiClient.get("/auth/security/settings").catch(() => ({
        data: {
          mfa_enabled: false,
          password_last_changed: new Date().toISOString(),
          active_sessions: 1,
          backup_codes_remaining: 0,
        },
      }));

      setSettings(settingsRes.data);

      // Fetch active sessions
      const sessionsRes = await apiClient.get("/auth/sessions").catch(() => ({ data: [] }));
      setSessions(sessionsRes.data);
    } catch (error) {
      logger.error("Failed to load security settings", toError(error));
      toast({
        title: "Error",
        description: "Failed to load security settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSecuritySettings();
  }, [loadSecuritySettings]);

  const handleChangePassword = async () => {
    if (!newPassword || !currentPassword) {
      toast({
        title: "Validation Error",
        description: "Please fill in all password fields",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Validation Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsChangingPassword(true);

      await apiClient.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      toast({
        title: "Success",
        description: "Password changed successfully",
      });

      setShowPasswordDialog(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await loadSecuritySettings();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleEnable2FA = async () => {
    try {
      setIsEnabling2FA(true);

      // Request 2FA setup
      const response = await apiClient.post("/auth/2fa/enable");
      setQrCode(response.data.qr_code);
      setBackupCodes(response.data.backup_codes || []);
      setShow2FADialog(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to enable 2FA",
        variant: "destructive",
      });
    } finally {
      setIsEnabling2FA(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid 6-digit code",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiClient.post("/auth/2fa/verify", {
        code: verificationCode,
      });

      toast({
        title: "Success",
        description: "Two-factor authentication enabled successfully",
      });

      setShow2FADialog(false);
      setVerificationCode("");
      setShowBackupCodesDialog(true);
      await loadSecuritySettings();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Invalid verification code",
        variant: "destructive",
      });
    }
  };

  const handleDisable2FA = async () => {
    try {
      await apiClient.post("/auth/2fa/disable");

      toast({
        title: "Success",
        description: "Two-factor authentication disabled",
      });

      await loadSecuritySettings();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to disable 2FA",
        variant: "destructive",
      });
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await apiClient.delete(`/auth/sessions/${sessionId}`);

      toast({
        title: "Success",
        description: "Session revoked successfully",
      });

      await loadSecuritySettings();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to revoke session",
        variant: "destructive",
      });
    }
  };

  const handleDownloadBackupCodes = () => {
    const content = backupCodes.map((code) => code.code).join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "backup-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyBackupCodes = () => {
    const content = backupCodes.map((code) => code.code).join("\n");
    navigator.clipboard.writeText(content);
    toast({
      title: "Copied",
      description: "Backup codes copied to clipboard",
    });
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
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <Shield className="h-8 w-8 text-sky-500" />
          Security Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your password, two-factor authentication, and active sessions
        </p>
      </div>

      {/* Security Status Banner */}
      {!settings?.mfa_enabled && (
        <Card className="border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
              <div>
                <p className="font-medium text-orange-900 dark:text-orange-200">
                  Two-Factor Authentication Disabled
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                  Enable 2FA to add an extra layer of security to your account
                </p>
                <Button
                  size="sm"
                  className="mt-3 bg-orange-600 hover:bg-orange-700"
                  onClick={handleEnable2FA}
                  disabled={isEnabling2FA}
                >
                  {isEnabling2FA ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Shield className="h-4 w-4 mr-2" />
                  )}
                  Enable 2FA Now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="password" className="space-y-4">
        <TabsList>
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="2fa">Two-Factor Auth</TabsTrigger>
          <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
        </TabsList>

        {/* Password Tab */}
        <TabsContent value="password" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Password Management
              </CardTitle>
              <CardDescription>Change your account password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Current Password</p>
                  <p className="text-sm text-muted-foreground">
                    Last changed:{" "}
                    {settings?.password_last_changed
                      ? new Date(settings.password_last_changed).toLocaleDateString()
                      : "Never"}
                  </p>
                </div>
                <Button onClick={() => setShowPasswordDialog(true)}>
                  <Lock className="h-4 w-4 mr-2" />
                  Change Password
                </Button>
              </div>

              <Separator />

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Password Requirements:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• At least 8 characters long</li>
                  <li>• Include uppercase and lowercase letters</li>
                  <li>• Include at least one number</li>
                  <li>• Include at least one special character</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2FA Tab */}
        <TabsContent value="2fa" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Two-Factor Authentication
              </CardTitle>
              <CardDescription>
                Add an extra layer of security using authenticator apps
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-12 w-12 rounded-full flex items-center justify-center ${
                      settings?.mfa_enabled ? "bg-green-500/10" : "bg-muted"
                    }`}
                  >
                    {settings?.mfa_enabled ? (
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">
                      2FA Status: {settings?.mfa_enabled ? "Enabled" : "Disabled"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {settings?.mfa_enabled
                        ? "Your account is protected with 2FA"
                        : "Enable 2FA for enhanced security"}
                    </p>
                  </div>
                </div>
                {settings?.mfa_enabled ? (
                  <Button variant="destructive" onClick={handleDisable2FA}>
                    Disable 2FA
                  </Button>
                ) : (
                  <Button onClick={handleEnable2FA} disabled={isEnabling2FA}>
                    {isEnabling2FA ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Shield className="h-4 w-4 mr-2" />
                    )}
                    Enable 2FA
                  </Button>
                )}
              </div>

              {settings?.mfa_enabled && (
                <>
                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Backup Codes</p>
                      <p className="text-sm text-muted-foreground">
                        {settings.backup_codes_remaining} codes remaining
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => setShowBackupCodesDialog(true)}>
                      <Key className="h-4 w-4 mr-2" />
                      View Backup Codes
                    </Button>
                  </div>
                </>
              )}

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Supported Authenticator Apps:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Google Authenticator</li>
                  <li>• Microsoft Authenticator</li>
                  <li>• Authy</li>
                  <li>• 1Password</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Active Sessions
              </CardTitle>
              <CardDescription>
                Manage devices and browsers where you&apos;re currently logged in
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="text-center py-8">
                  <Smartphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No active sessions</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {session.device}
                            {session.is_current && (
                              <Badge variant="outline" className="text-xs">
                                Current
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{session.location}</TableCell>
                        <TableCell className="font-mono text-sm">{session.ip_address}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(session.last_active).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {!session.is_current && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevokeSession(session.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
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
      </Tabs>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new secure password
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={isChangingPassword}>
              {isChangingPassword ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enable 2FA Dialog */}
      <Dialog open={show2FADialog} onOpenChange={setShow2FADialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app and enter the verification code
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {qrCode && (
              <div className="flex justify-center">
                <Image
                  src={qrCode}
                  alt="QR Code"
                  width={192}
                  height={192}
                  className="w-48 h-48"
                  unoptimized
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="verification-code">Verification Code</Label>
              <Input
                id="verification-code"
                type="text"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter 6-digit code"
                className="text-center text-2xl tracking-widest"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShow2FADialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleVerify2FA}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Verify and Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog open={showBackupCodesDialog} onOpenChange={setShowBackupCodesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Backup Codes</DialogTitle>
            <DialogDescription>
              Save these codes in a secure location. Each code can only be used once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-2">
              {backupCodes.map((code, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className={code.used ? "line-through text-muted-foreground" : ""}>
                    {code.code}
                  </span>
                  {code.used && (
                    <Badge variant="outline" className="text-xs">
                      Used
                    </Badge>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopyBackupCodes} className="flex-1">
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button variant="outline" onClick={handleDownloadBackupCodes} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowBackupCodesDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SecuritySettingsPage() {
  return (
    <RouteGuard permission="settings.security.read">
      <SecuritySettingsContent />
    </RouteGuard>
  );
}
