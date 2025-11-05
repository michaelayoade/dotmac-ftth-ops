"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { loginSchema, type LoginFormData } from "@/lib/validations/auth";
import { useBranding } from "@/hooks/useBranding";
import {
  clearOperatorAuthTokens,
  setOperatorAccessToken,
} from "../../../../shared/utils/operatorAuth";

export default function LoginPage() {
  const router = useRouter();
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

  const onSubmit = useCallback(
    async (data: LoginFormData) => {
      setError("");
      setLoading(true);

      try {
        logger.info("Starting login process", { email: data.email });

        const response = await apiClient.post("/auth/login", {
          username: data.email, // Backend expects username field
          password: data.password,
        });
        console.log("[LOGIN] Response received:", {
          status: response.status,
          data: response.data,
        });
        logger.debug("Login response received", { status: response.status });

        if (response.status === 200) {
          console.log("[LOGIN] Login successful, redirecting to dashboard...");
          logger.info("Login successful, cookies should be set by server");
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

          // Store tenant ID if provided
          if (response.data?.tenant_id) {
            try {
              localStorage.setItem("tenant_id", response.data.tenant_id);
            } catch (error) {
              logger.debug("Unable to persist tenant_id", { error: error instanceof Error ? error.message : String(error) });
            }
          }

          // Small delay to ensure cookies are set
          await new Promise((resolve) => setTimeout(resolve, 100));

          logger.info("Redirecting to dashboard");
          // Use window.location for hard redirect to ensure cookies are picked up
          window.location.href = "/dashboard";
        } else {
          console.log("[LOGIN] Unexpected status:", response.status);
          setError(`Login failed with status ${response.status}`);
        }
      } catch (err: any) {
        clearOperatorAuthTokens();
        const defaultHeaders = (apiClient.defaults?.headers as any)?.common;
        if (defaultHeaders?.Authorization) {
          delete defaultHeaders.Authorization;
        }
        console.error("[LOGIN] Error caught:", err);
        console.error("[LOGIN] Error response:", err?.response);

        // Extract error message from various possible locations
        let errorMessage = "Login failed";
        if (err?.response?.data) {
          errorMessage =
            err.response.data.detail ||
            err.response.data.error ||
            err.response.data.message ||
            JSON.stringify(err.response.data);
        } else if (err?.message) {
          errorMessage = err.message;
        }

        console.error("[LOGIN] Error message:", errorMessage);
        logger.error("Login error", err instanceof Error ? err : new Error(String(err)));
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [router],
  ); // Only depends on router which is stable

  // Expose login function for E2E tests
  React.useEffect(() => {
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      (window as any).__e2e_login = async (username: string, password: string) => {
        console.log("[E2E] __e2e_login called with username:", username);
        setValue("email", username, { shouldValidate: true });
        setValue("password", password, { shouldValidate: true });
        // Call handleSubmit and pass onSubmit directly each time
        await handleSubmit(onSubmit)();
      };
      console.log("[E2E] __e2e_login function registered on window");
    }
  }, [setValue, handleSubmit, onSubmit]); // Added onSubmit to dependencies

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
          {process.env.NODE_ENV === "development" && (
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs text-blue-300 font-medium">Test Credentials:</p>
              <p className="text-xs text-blue-200 mt-1">admin / admin123</p>
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
                errors.email ? "border-red-500" : "border-border"
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
          {process.env.NODE_ENV !== "production" && (
            <button
              type="button"
              data-testid="test-login-admin"
              style={{ position: "absolute", left: "-9999px", opacity: 0 }}
              onClick={async () => {
                console.log("[E2E] Test login button clicked");
                setValue("email", "admin", { shouldValidate: true });
                setValue("password", "admin123", { shouldValidate: true });
                console.log("[E2E] Form values set, submitting...");
                console.log("[E2E] Form errors:", errors);
                const result = await handleSubmit(
                  (data) => {
                    console.log("[E2E] Form submitted with data:", data);
                    return onSubmit(data);
                  },
                  (validationErrors) => {
                    console.error("[E2E] Form validation failed:", validationErrors);
                  },
                )();
                console.log("[E2E] Submit result:", result);
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
