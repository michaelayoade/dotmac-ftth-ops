"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { login, isAuthBypassEnabled } from "@shared/lib/auth";
import type { LoginResult } from "@shared/lib/auth";
import { TwoFactorChallenge } from "../../../../shared/components/auth/TwoFactorChallenge";
import { logger } from "@/lib/logger";
import { loginSchema, type LoginFormData } from "@/lib/validations/auth";

const showTestCredentials = false;
const authBypassEnabled = isAuthBypassEnabled();

// Default branding for bypass mode
const defaultBranding = { productName: "DotMac" };
const envBrandName = process.env["NEXT_PUBLIC_BRAND_NAME"];
const envBrandLogoUrl = process.env["NEXT_PUBLIC_BRAND_LOGO_URL"];
const branding = {
  productName: envBrandName || defaultBranding.productName,
  logoUrl: envBrandLogoUrl || null,
};

function resolveBypassTenantId(): string {
  return (
    process.env["TENANT_ID"] ||
    process.env["NEXT_PUBLIC_TENANT_ID"] ||
    process.env["TENANT_SLUG"] ||
    "default-tenant"
  );
}

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [twoFAError, setTwoFAError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    // Auto-complete login in bypass mode without user interaction for e2e/local dev
    // Note: tenant_id is set by login() in loginService.ts for bypass mode
    if (authBypassEnabled) {
      try {
        localStorage.setItem("tenant_id", resolveBypassTenantId());
      } catch {
        // Ignore storage errors in bypass mode
      }
      window.location.replace("/dashboard");
    }
  }, []);

  const handleLoginSuccess = useCallback(() => {
    logger.info("Login successful, redirecting to dashboard");
    window.location.href = "/dashboard";
  }, []);

  const onSubmit = useCallback(async (data: LoginFormData) => {
    setError("");
    setLoading(true);
    setRequires2FA(false);
    setPendingUserId(null);

    try {
      if (authBypassEnabled) {
        logger.info("Auth bypass enabled - skipping authentication", { email: data.email });
        // Note: tenant_id is set by login() in loginService.ts for bypass mode
        window.location.href = "/dashboard";
        return;
      }

      logger.info("Starting login process", { email: data.email });

      const result: LoginResult = await login(data.email, data.password);

      if (result.success) {
        handleLoginSuccess();
        return;
      }

      if (result.requires2FA && result.userId) {
        logger.info("2FA required", { userId: result.userId });
        setRequires2FA(true);
        setPendingUserId(result.userId);
        return;
      }

      logger.error("Login failed", { error: result.error });
      setError(result.error || "Login failed");
    } catch (err: unknown) {
      logger.error(
        "Login request threw an error",
        err instanceof Error ? err : new Error(String(err))
      );

      const errorMessage = err instanceof Error ? err.message : "Login failed";
      logger.error("Login failed", { message: errorMessage });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [handleLoginSuccess]);

  const handle2FAVerify = useCallback(
    async (code: string, isBackupCode: boolean) => {
      if (!pendingUserId) return;

      setTwoFAError(null);
      setLoading(true);

      try {
        // Import verify2FA dynamically to avoid circular deps
        const { verify2FA } = await import("@shared/lib/auth");
        const result = await verify2FA(pendingUserId, code, isBackupCode);

        if (result.success) {
          handleLoginSuccess();
        } else {
          setTwoFAError(result.error || "Verification failed");
        }
      } catch (err) {
        setTwoFAError(err instanceof Error ? err.message : "Verification failed");
      } finally {
        setLoading(false);
      }
    },
    [pendingUserId, handleLoginSuccess]
  );

  const handle2FACancel = useCallback(() => {
    setRequires2FA(false);
    setPendingUserId(null);
    setTwoFAError(null);
  }, []);

  // Show 2FA challenge if required
  if (requires2FA && pendingUserId) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-md">
          <div className="bg-card/50 backdrop-blur border border-border rounded-lg p-8">
            <TwoFactorChallenge
              userId={pendingUserId}
              onVerify={handle2FAVerify}
              onCancel={handle2FACancel}
              isLoading={loading}
              error={twoFAError}
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-block text-sm text-muted-foreground hover:text-muted-foreground mb-4"
          >
            ← Back to home
          </Link>
          <div className="flex items-center justify-center mb-4">
            {branding.logoUrl ? (
              <Image
                src={branding.logoUrl}
                alt={`${branding.productName} logo`}
                width={48}
                height={48}
                className="h-12 w-auto"
                unoptimized
              />
            ) : (
              <span className="text-3xl">🌐</span>
            )}
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Network Operations Portal</h1>
          <p className="text-muted-foreground">
            Access your {branding.productName} management dashboard
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Manage subscribers, network, billing, and operations
          </p>
          {showTestCredentials && (
            <div className="mt-4 space-y-2">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-xs text-blue-300 font-medium">Test Credentials:</p>
                <p className="text-xs text-blue-200 mt-1">admin / admin123</p>
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-card/50 backdrop-blur border border-border rounded-lg p-8 space-y-6"
          data-testid="login-form"
        >
          {error && (
            <div
              className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm"
              data-testid="error-message"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-2">
              Username or Email
            </label>
            <input
              id="email"
              type="text"
              autoComplete="username"
              {...register("email")}
              className={`w-full px-3 py-2 bg-accent border ${
                errors["email"] ? "border-red-500" : "border-border"
              } rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent`}
              placeholder="username or email"
              data-testid="email-input"
            />
            {errors.email && <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-muted-foreground mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
              className={`w-full px-3 py-2 bg-accent border ${
                errors.password ? "border-red-500" : "border-border"
              } rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent`}
              placeholder="••••••••"
              data-testid="password-input"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                className="h-4 w-4 rounded border-border bg-accent text-[var(--brand-primary)] focus:ring-[var(--brand-primary)] focus:ring-offset-background"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-muted-foreground">
                Remember me
              </label>
            </div>

            <Link
              href="/forgot-password"
              className="text-sm text-brand hover:text-[var(--brand-primary-hover)]"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed btn-brand"
            data-testid="submit-button"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          {/* E2E Test Helper - Hidden button for automated tests */}
          {process.env["NODE_ENV"] !== "production" && (
            <button
              type="button"
              data-testid="test-login-admin"
              style={{ position: "absolute", left: "-9999px", opacity: 0 }}
              onClick={async () => {
                logger.debug("[E2E] Test login button clicked");
                setValue("email", "admin", { shouldValidate: true });
                setValue("password", "admin123", { shouldValidate: true });
                logger.debug("[E2E] Form values set, submitting...");
                logger.debug("[E2E] Form errors", { errors });
                const result = await handleSubmit(
                  (data) => {
                    logger.debug("[E2E] Form submitted with data", { data });
                    return onSubmit(data);
                  },
                  (validationErrors) => {
                    logger.warn("[E2E] Form validation failed", { validationErrors });
                  }
                )();
                logger.debug("[E2E] Submit result", { result });
              }}
            >
              Test Login Admin
            </button>
          )}
        </form>
      </div>
    </main>
  );
}
