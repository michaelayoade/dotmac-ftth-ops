"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "@dotmac/better-auth";
import type { AxiosResponse } from "axios";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { loginSchema, type LoginFormData } from "@/lib/validations/auth";
import { useBranding } from "@/hooks/useBranding";
import {
  clearOperatorAuthTokens,
  setOperatorAccessToken,
} from "../../../../shared/utils/operatorAuth";

const showTestCredentials =
  process.env["NEXT_PUBLIC_SHOW_TEST_CREDENTIALS"] === "true";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { branding } = useBranding();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const establishLegacySession = useCallback(
    async (
      credentials: LoginFormData,
      existingResponse?: AxiosResponse<any>,
    ): Promise<void> => {
      const response =
        existingResponse ??
        (await apiClient.post("/auth/login", {
          username: credentials.email,
          password: credentials.password,
        }));

      if (!response) {
        throw new Error("No response from legacy login endpoint");
      }

      if (response.status !== 200) {
        throw new Error(`Login failed with status ${response.status}`);
      }

      const defaultHeaders = (apiClient.defaults?.headers as any)?.common;

      if (response.data?.access_token) {
        setOperatorAccessToken(response.data.access_token);
        if (defaultHeaders) {
          defaultHeaders.Authorization = `Bearer ${response.data.access_token}`;
        }
      } else {
        clearOperatorAuthTokens();
        if (defaultHeaders?.Authorization) {
          delete defaultHeaders.Authorization;
        }
      }

      if (response.data?.tenant_id) {
        try {
          localStorage.setItem("tenant_id", response.data.tenant_id);
        } catch (storageError) {
          logger.debug("Unable to persist tenant_id", {
            error:
              storageError instanceof Error ? storageError.message : String(storageError),
          });
        }
      } else {
        try {
          localStorage.removeItem("tenant_id");
        } catch {
          // ignore
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
      window.location.href = "/dashboard";
    },
    [],
  );

  const onSubmit = useCallback(
    async (data: LoginFormData) => {
      setError("");
      setLoading(true);

      try {
        // Use Better Auth for authentication
        logger.info("Starting Better Auth login process", { email: data.email });

        const result = await signIn.email({
          email: data.email,
          password: data.password,
          callbackURL: "/dashboard",
        });

        if (result.error) {
          logger.error("Better Auth login failed", { error: result.error });
          setError(result.error.message || "Login failed");
          return;
        }

        logger.info("Better Auth login successful");
        await establishLegacySession(data);
      } catch (err: any) {
        logger.error("Login request threw an error", err instanceof Error ? err : new Error(String(err)));

        // Extract error message from various possible locations
        let errorMessage = "Login failed";
        if (err?.message) {
          errorMessage = err.message;
        }

        logger.error("Login failed", {
          message: errorMessage,
        });
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [establishLegacySession],
  );

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
            <span className="text-3xl">🌐</span>
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
                errors['email']? "border-red-500" : "border-border"
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
                  },
                )();
                logger.debug("[E2E] Submit result", { result });
              }}
            >
              Test Login Admin
            </button>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-brand hover:text-[var(--brand-primary-hover)] font-medium"
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
