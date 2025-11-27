"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { apiClient } from "@/lib/api/client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Label,
  Alert,
  AlertDescription,
} from "@dotmac/ui";

type SetupResponse = {
  secret: string;
  qr_code: string;
  provisioning_uri: string;
  backup_codes?: string[];
};

export default function MFAPage() {
  const [setupData, setSetupData] = useState<SetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableToken, setDisableToken] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startSetup = async () => {
    setError(null);
    setStatusMessage(null);
    try {
      const res = await apiClient.post<SetupResponse>("/auth/2fa/enable", { password });
      setSetupData(res.data);
      setBackupCodes(res.data.backup_codes || null);
    } catch {
      setError("Failed to start MFA setup. Check password and try again.");
    }
  };

  const verify = async () => {
    setError(null);
    try {
      await apiClient.post("/auth/2fa/verify", { token: code });
      setStatusMessage("MFA enabled");
    } catch {
      setError("Invalid code, please try again.");
    }
  };

  const disable = async () => {
    setError(null);
    try {
      await apiClient.post("/auth/2fa/disable", { password: disablePassword, token: disableToken });
      setStatusMessage("MFA disabled");
      setSetupData(null);
      setBackupCodes(null);
      setCode("");
    } catch {
      setError("Failed to disable MFA");
    }
  };

  const regenerate = async () => {
    setError(null);
    try {
      const res = await apiClient.post<{ backup_codes: string[] }>(
        "/auth/2fa/regenerate-backup-codes",
      );
      setBackupCodes(res.data?.backup_codes || []);
      setStatusMessage("Backup codes regenerated");
    } catch {
      setError("Failed to regenerate backup codes");
    }
  };

  useEffect(() => {
    // optional: prefetch backup codes? leave empty
  }, []);

  return (
    <RouteGuard permission="security.manage">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-blue-500" />
          <div>
            <h1 className="text-2xl font-semibold">MFA / 2FA</h1>
            <p className="text-sm text-muted-foreground">
              Protect your account with TOTP and backup codes.
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {statusMessage && (
          <Alert>
            <AlertDescription>{statusMessage}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Step 1: Generate Secret</CardTitle>
            <Button variant="outline" size="sm" onClick={startSetup}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Start Setup
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="password">Current Password (setup)</Label>
              <Input
                id="password"
                type="password"
                aria-label="Setup current password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-64"
              />
            </div>
            {setupData ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Scan the QR code in your authenticator app.
                </p>
                <Image
                  src={setupData.qr_code}
                  alt="MFA QR code"
                  width={192}
                  height={192}
                  className="border rounded"
                />
                <p className="text-sm">Secret: {setupData.secret}</p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Click start to generate a TOTP secret.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 2: Verify Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="totp">Authenticator Code (verify)</Label>
            <Input
              id="totp"
              aria-label="Authenticator code to verify"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="w-40"
            />
            <Button onClick={verify}>Verify & Enable</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Backup Codes</CardTitle>
            <Button variant="outline" size="sm" onClick={regenerate}>
              Regenerate
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {backupCodes ? (
              <div className="grid gap-2 md:grid-cols-2">
                {backupCodes.map((code) => (
                  <code key={code} className="rounded bg-muted px-2 py-1 text-sm">
                    {code}
                  </code>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Generate backup codes after enabling MFA.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Disable MFA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="disable-password">Current Password (disable)</Label>
                <Input
                  id="disable-password"
                  type="password"
                  aria-label="Disable current password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-64"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="disable-token">Authenticator Code (disable)</Label>
                <Input
                  id="disable-token"
                  aria-label="Authenticator code to disable"
                  value={disableToken}
                  onChange={(e) => setDisableToken(e.target.value)}
                  placeholder="123456 to disable"
                  className="w-40"
                />
              </div>
              <Button variant="destructive" onClick={disable}>
                Disable MFA
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </RouteGuard>
  );
}
