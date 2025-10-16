"use client";

import { useState } from "react";
import { useCustomerAuth } from "@/lib/auth/CustomerAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Wifi, Lock, Mail, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";

export default function CustomerLoginPage() {
  const { login, loading, error: authError } = useCustomerAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    try {
      await login(email, password);
      toast({
        title: "Login Successful",
        description: "Welcome back to your customer portal!",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border-2 border-primary mb-4">
            <Wifi className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Customer Portal</h1>
          <p className="text-slate-400">Sign in to manage your account</p>
        </div>

        {/* Login Card */}
        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Sign In</CardTitle>
            <CardDescription>Enter your credentials to access your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Alert */}
              {(error || authError) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error || authError}</AlertDescription>
                </Alert>
              )}

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john.doe@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                  autoComplete="email"
                  required
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                  autoComplete="current-password"
                  required
                />
              </div>

              {/* Forgot Password Link */}
              <div className="flex justify-end">
                <Link
                  href="/customer-portal/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-600" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-800 px-2 text-slate-400">Need help?</span>
              </div>
            </div>

            {/* Help Links */}
            <div className="space-y-2 text-center text-sm">
              <p className="text-slate-400">
                Don't have an account?{" "}
                <Link
                  href="/customer-portal/signup"
                  className="text-primary hover:underline font-medium"
                >
                  Sign up
                </Link>
              </p>
              <p className="text-slate-400">
                Need assistance?{" "}
                <Link
                  href="/customer-portal/support"
                  className="text-primary hover:underline font-medium"
                >
                  Contact Support
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-slate-500">
          <p>© 2025 DotMac FTTH Operations. All rights reserved.</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <Link href="/customer-portal/terms" className="hover:text-slate-300">
              Terms
            </Link>
            <span>•</span>
            <Link href="/customer-portal/privacy" className="hover:text-slate-300">
              Privacy
            </Link>
            <span>•</span>
            <Link href="/customer-portal/help" className="hover:text-slate-300">
              Help
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
