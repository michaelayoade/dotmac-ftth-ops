import Link from "next/link";
import { Metadata } from "next";
import { useSearchParams, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@dotmac/ui/alert";
import { Button } from "@dotmac/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui/card";
import { Input } from "@dotmac/ui/input";
import { Label } from "@dotmac/ui/label";

export const metadata: Metadata = {
  title: "Reset Password",
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialToken = searchParams.get("token") || "";
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/password-reset/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, new_password: password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Unable to reset password");
      }

      setMessage("Password updated. You can now sign in with your new password.");
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-md">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>Paste your reset token and choose a new password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <Alert variant="default">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Reset failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="token">Reset token</Label>
              <Input
                id="token"
                name="token"
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste the token from your email link"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update password"}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground text-center">
            Back to{" "}
            <Link href="/login" className="text-primary hover:underline">
              sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
