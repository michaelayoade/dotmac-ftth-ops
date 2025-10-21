"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setError("");
    setLoading(true);

    try {
      // Mock password reset for now
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Reset your password</h1>
          <p className="text-muted-foreground">
            Enter your email address and we&apos;ll send you a link to reset your password
          </p>
        </div>

        {success ? (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 text-center">
            <p className="text-green-400 mb-4" data-testid="reset-success-message">
              Password reset link sent! Check your email for instructions.
            </p>
            <Link
              href="/login"
              className="inline-block text-sky-400 hover:text-sky-300 text-sm font-medium"
            >
              Back to login
            </Link>
          </div>
        ) : (
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
              <label
                htmlFor="email"
                className="block text-sm font-medium text-muted-foreground mb-2"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                {...register("email")}
                className={`w-full px-3 py-2 bg-accent border ${
                  errors.email ? "border-red-500" : "border-border"
                } rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent`}
                placeholder="you@example.com"
                data-testid="email-input"
              />
              {errors.email && <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sky-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="reset-password-button"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>

            <div className="text-center">
              <Link
                href="/login"
                className="text-sm text-muted-foreground hover:text-muted-foreground"
              >
                Back to login
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
