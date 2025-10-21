"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, Timer, KeyRound, ArrowLeft, Loader2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useVerify2FA } from "@/hooks/useProfile";

const RESEND_INTERVAL_SECONDS = 30;

export default function MfaVerifyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const verify2FA = useVerify2FA();

  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(RESEND_INTERVAL_SECONDS);
  const [resendCount, setResendCount] = useState(0);
  const isSubmitting = verify2FA.isPending;

  useEffect(() => {
    if (timeLeft === 0) {
      return;
    }

    const interval = window.setInterval(() => {
      setTimeLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [timeLeft, resendCount]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const token = useBackupCode ? backupCode.trim() : code.trim();
    if (!token) {
      setError("Enter the verification code to continue.");
      return;
    }

    if (!useBackupCode && token.length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    try {
      await verify2FA.mutateAsync({ token });
      toast({
        title: "Verification successful",
        description: "Multi-factor authentication is enabled.",
      });
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed. Try again.";
      setError(message);
      toast({
        title: "Verification failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleResend = () => {
    setTimeLeft(RESEND_INTERVAL_SECONDS);
    setResendCount((count) => count + 1);
    toast({
      title: "Code resent",
      description: "If SMS is enabled you will receive a new verification code shortly.",
    });
  };

  const toggleBackupCode = () => {
    setUseBackupCode((current) => !current);
    setError(null);
    setCode("");
    setBackupCode("");
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background/80 px-6 py-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-10">
        <div className="flex flex-col gap-2 text-center">
          <Link
            href="/login"
            className="mx-auto flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
          <Badge variant="outline" className="mx-auto w-fit">
            Two Factor Authentication
          </Badge>
          <h1 className="text-3xl font-semibold text-foreground">Verify your identity</h1>
          <p className="text-muted-foreground">
            Enter the six-digit verification code from your authenticator app or a backup code to
            finish enabling MFA.
          </p>
        </div>

        <Card className="border-primary/30 shadow-lg shadow-primary/5">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-xl font-semibold text-foreground">
              Multi-factor challenge
            </CardTitle>
            <CardDescription>
              This additional step keeps your administrator account secure. Codes refresh every 30
              seconds.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <form className="space-y-5" onSubmit={handleSubmit}>
              {!useBackupCode ? (
                <div className="space-y-2">
                  <Label
                    htmlFor="verification-code"
                    className="text-sm font-medium text-foreground"
                  >
                    Verification code
                  </Label>
                  <Input
                    id="verification-code"
                    inputMode="numeric"
                    pattern="\d*"
                    autoFocus
                    maxLength={6}
                    name="code"
                    value={code}
                    data-testid="mfa-code-input"
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="text-center text-lg tracking-widest"
                    aria-describedby="verification-help"
                  />
                  <div
                    id="verification-help"
                    className="flex items-center justify-between text-xs text-muted-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <Timer className="h-3.5 w-3.5" />
                      Code expires in {timeLeft}s
                    </span>
                    <button
                      type="button"
                      className="text-primary hover:underline disabled:opacity-40"
                      onClick={handleResend}
                      disabled={timeLeft > 0 && timeLeft < RESEND_INTERVAL_SECONDS}
                    >
                      Resend code
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="backup-code" className="text-sm font-medium text-foreground">
                    Backup recovery code
                  </Label>
                  <Input
                    id="backup-code"
                    name="backup_code"
                    data-testid="backup-code-input"
                    placeholder="Enter backup code"
                    value={backupCode}
                    onChange={(event) => setBackupCode(event.target.value.trim())}
                    className="text-center text-base tracking-wider"
                  />
                  <p className="text-xs text-muted-foreground">
                    Backup codes can only be used once. Generate new codes from the security
                    settings after logging in.
                  </p>
                </div>
              )}

              <div className="text-left">
                <button
                  type="button"
                  onClick={toggleBackupCode}
                  data-testid="use-backup-code"
                  className="text-xs font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  {useBackupCode ? "Use authenticator code instead" : "Use a backup code"}
                </button>
              </div>

              {error && (
                <div
                  className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-left text-sm text-red-200"
                  data-testid="mfa-error"
                >
                  <KeyRound className="mt-0.5 h-4 w-4 text-red-200" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                data-testid="verify-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  "Confirm and continue"
                )}
              </Button>
            </form>

            <div className="space-y-3 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Can&apos;t access your device?</p>
              <ul className="space-y-2 text-sm leading-relaxed">
                <li>• Use one of the one-time recovery codes you saved during setup.</li>
                <li>• Switch to backup SMS delivery if you still have your phone number.</li>
                <li>
                  • Contact{" "}
                  <Link href="/support" className="text-primary underline underline-offset-4">
                    support
                  </Link>{" "}
                  for administrator reset options.
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
