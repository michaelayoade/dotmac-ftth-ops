import Link from "next/link";
import { Metadata } from "next";
import { FormEvent, useState } from "react";
import { Button } from "@dotmac/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui/card";
import { Input } from "@dotmac/ui/input";
import { Label } from "@dotmac/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@dotmac/ui/alert";

export const metadata: Metadata = {
  title: "Forgot Password",
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/password-reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        // API intentionally returns 200 for unknown emails; treat non-200 as error
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Unable to request password reset");
      }

      setMessage("If the email exists, a password reset link has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request password reset");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-md">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>Enter your email and we&apos;ll send reset instructions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <Alert variant="default">
              <AlertTitle>Request received</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Request failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send reset link"}
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
