"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { requestPasswordReset } from "@shared/lib/auth";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = useCallback(async (data: ForgotPasswordFormData) => {
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      const result = await requestPasswordReset(data.email);

      if (!result.success) {
        setError(result.error || "Failed to send reset email");
        return;
      }

      setSuccess(true);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error?.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <span className="text-3xl">✉️</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Check your email</h1>
            <p className="text-muted-foreground">
              If an account exists with that email, we&apos;ve sent password reset instructions.
            </p>
          </div>

          <div className="bg-card/50 backdrop-blur border border-border rounded-lg p-8 space-y-6">
            <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-lg text-sm">
              <p className="font-medium mb-2">Reset email sent!</p>
              <p>Please check your inbox and follow the instructions to reset your password.</p>
            </div>

            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Didn&apos;t receive the email? Check your spam folder or try again.
              </p>
              <Link
                href="/login"
                className="inline-block text-sm text-brand hover:text-[var(--brand-primary-hover)]"
              >
                ← Back to login
              </Link>
            </div>
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
            href="/login"
            className="inline-block text-sm text-muted-foreground hover:text-muted-foreground mb-4"
          >
            ← Back to login
          </Link>
          <div className="flex items-center justify-center mb-4">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Forgot password?</h1>
          <p className="text-muted-foreground">
            Enter your email address and we&apos;ll send you instructions to reset your password.
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-card/50 backdrop-blur border border-border rounded-lg p-8 space-y-6"
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-2">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
              className={`w-full px-3 py-2 bg-accent border ${
                errors.email ? "border-red-500" : "border-border"
              } rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent`}
              placeholder="you@example.com"
            />
            {errors.email && <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed btn-brand"
          >
            {loading ? "Sending..." : "Send reset instructions"}
          </button>

          <div className="text-center">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Remember your password? Sign in
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
