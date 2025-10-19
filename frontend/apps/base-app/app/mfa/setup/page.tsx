"use client";

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ShieldCheck, MessageSquare, QrCode, ArrowLeft, Loader2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useEnable2FA, useVerifyPhone, type Enable2FAResponse } from "@/hooks/useProfile";

type FactorMethod = "authenticator" | "sms";

const METHOD_COPY: Record<FactorMethod, { title: string; description: string }> = {
  authenticator: {
    title: "Authenticator App",
    description: "Scan the QR code using Authy, Google Authenticator or any TOTP compatible app.",
  },
  sms: {
    title: "SMS Backup Codes",
    description: "Receive a six digit verification code via text message when you sign in.",
  },
};

export default function MfaSetupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const enable2FA = useEnable2FA();
  const verifyPhone = useVerifyPhone();
  const [method, setMethod] = useState<FactorMethod>("authenticator");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [setupData, setSetupData] = useState<Enable2FAResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);

  const handleVerificationMethodChange = (nextMethod: FactorMethod) => {
    setMethod(nextMethod);
    setSetupData(null);
  };

  const handleGenerateAuthenticator = async () => {
    if (!password) {
      toast({
        title: "Password required",
        description: "Enter your current password to generate MFA secrets.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await enable2FA.mutateAsync({ password });
      if (!response) {
        throw new Error("Unable to generate verification secret.");
      }
      setSetupData(response);
      toast({
        title: "Authenticator ready",
        description: "Scan the QR code and verify your first code to finish setup.",
      });
    } catch (error) {
      setSetupData(null);
      toast({
        title: "Unable to start MFA",
        description: error instanceof Error ? error.message : "Failed to enable multi-factor authentication.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendSms = async () => {
    if (!phoneNumber.trim()) {
      toast({
        title: "Phone number required",
        description: "Enter a mobile number before requesting an SMS code.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingSms(true);
    try {
      await verifyPhone.mutateAsync(phoneNumber.trim());
      toast({
        title: "Verification SMS sent",
        description: "Enter the code you receive on the verification step.",
      });
    } catch (error) {
      toast({
        title: "Failed to send SMS",
        description: error instanceof Error ? error.message : "Could not send verification message.",
        variant: "destructive",
      });
    } finally {
      setIsSendingSms(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background/60 px-6 py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="flex w-fit items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <Badge variant="outline" className="w-fit">
            Security
          </Badge>
          <h1 className="text-3xl font-semibold text-foreground">Set up multi-factor authentication</h1>
          <p className="text-muted-foreground">
            Add an extra layer of protection to your account. Once enabled, you&apos;ll be asked for a verification
            code in addition to your password.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
          <Card className="border-primary/20 shadow-lg shadow-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Choose your verification method
              </CardTitle>
              <CardDescription>
                Switch between authenticator app or SMS backup codes. You can change this preference at any time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{METHOD_COPY[method].title}</p>
                  <p className="text-xs text-muted-foreground">{METHOD_COPY[method].description}</p>
                </div>
                <Switch
                  checked={method === "authenticator"}
                  onCheckedChange={(checked) =>
                    handleVerificationMethodChange(checked ? "authenticator" : "sms")
                  }
                  aria-label="Toggle verification method"
                />
              </div>

              {method === "authenticator" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="mfa-password" className="text-sm font-medium text-foreground">
                      Confirm your password
                    </Label>
                    <Input
                      id="mfa-password"
                      type="password"
                      name="password"
                      data-testid="mfa-password-input"
                      placeholder="Enter current password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <Button
                      type="button"
                      onClick={handleGenerateAuthenticator}
                      data-testid="generate-qr-button"
                      className="w-full"
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating secrets…
                        </>
                      ) : (
                        "Generate authenticator setup"
                      )}
                    </Button>
                  </div>

                  <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-6 text-center">
                    {setupData?.qr_code ? (
                      <Image
                        src={setupData.qr_code}
                        alt="MFA QR code"
                        width={144}
                        height={144}
                        unoptimized
                        className="mx-auto h-36 w-36 rounded-md border border-primary/20 bg-background p-2 shadow-sm"
                        data-testid="mfa-qr-code"
                      />
                    ) : (
                      <QrCode className="mx-auto h-16 w-16 text-primary" data-testid="qr-code-placeholder" />
                    )}
                    <p className="mt-4 text-sm text-muted-foreground">
                      Scan the QR code with your authenticator app. If you can&apos;t scan it, enter the setup key
                      manually.
                    </p>
                    <code className="mt-4 inline-block rounded bg-background px-3 py-1 text-sm font-mono tracking-widest text-foreground">
                      {setupData?.secret ?? "•••• •••• •••• ••••"}
                    </code>
                  </div>

                  <div className="space-y-2" data-testid="backup-codes">
                    <Label className="text-sm font-medium text-foreground">One-time recovery codes</Label>
                    <p className="text-xs text-muted-foreground">
                      Store these codes in a secure location. Each code can only be used once.
                    </p>
                    <div className="rounded-lg border border-border bg-card p-3 text-sm font-mono leading-6 text-foreground">
                      {(setupData?.backup_codes ?? ["815 392", "467 028", "982 140", "053 771", "622 904"]).map(
                        (code) => (
                          <div key={code}>{code}</div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-100">
                    <MessageSquare className="h-5 w-5 text-blue-300" />
                    SMS is best used as a backup option. We recommend enabling an authenticator app for stronger
                    security.
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium text-foreground">
                      Mobile number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      name="phone"
                      data-testid="sms-phone-input"
                      placeholder="+1 (555) 123-4567"
                      value={phoneNumber}
                      onChange={(event) => setPhoneNumber(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      We&apos;ll send a test message to confirm delivery. Message and data rates may apply.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      className="mt-2 w-full"
                      onClick={handleSendSms}
                      data-testid="sms-send-button"
                      disabled={isSendingSms}
                    >
                      {isSendingSms ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending SMS…
                        </>
                      ) : (
                        "Send verification SMS"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">How it works</CardTitle>
              <CardDescription>Follow these steps to finish enabling multi-factor authentication.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">1. Configure your device</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Install an authenticator app or ensure your mobile number is accurate if you&apos;re using SMS codes.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">2. Verify a test code</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    After scanning or adding the code, enter a current six-digit token to confirm everything is working.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">3. Save recovery options</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Download or copy the one-time recovery codes. These let you access your account if you lose your
                    device.
                  </p>
                </div>
              </div>
              <Button
                size="lg"
                className="w-full"
                onClick={() => router.push("/mfa/verify")}
                data-testid="continue-to-verify"
              >
                Continue to verification
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-card/40 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Need help?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Read the{" "}
            <Link href="/docs/security/mfa" className="text-primary underline underline-offset-4">
              MFA setup guide
            </Link>{" "}
            or contact support if you&apos;re unable to access your account.
          </p>
        </div>
      </div>
    </main>
  );
}
