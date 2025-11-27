"use client";

/**
 * Two-Factor Authentication Challenge Component
 *
 * Displays the 2FA verification form when required during login.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";

interface TwoFactorChallengeProps {
  userId: string;
  onVerify: (code: string, isBackupCode: boolean) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function TwoFactorChallenge({
  userId,
  onVerify,
  onCancel,
  isLoading = false,
  error,
}: TwoFactorChallengeProps) {
  const [code, setCode] = useState("");
  const [isBackupCode, setIsBackupCode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!code.trim()) return;
      await onVerify(code.trim(), isBackupCode);
    },
    [code, isBackupCode, onVerify]
  );

  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value;

      if (isBackupCode) {
        // Backup codes are alphanumeric with hyphens (e.g., XXXX-XXXX)
        value = value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
      } else {
        // TOTP codes are 6 digits only
        value = value.replace(/\D/g, "").slice(0, 6);
      }

      setCode(value);
    },
    [isBackupCode]
  );

  const toggleBackupCode = useCallback(() => {
    setIsBackupCode((prev) => !prev);
    setCode("");
    inputRef.current?.focus();
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <span className="text-4xl">🔐</span>
        </div>
        <h2 className="text-xl font-bold text-foreground">
          Two-Factor Authentication
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          {isBackupCode
            ? "Enter one of your backup codes"
            : "Enter the 6-digit code from your authenticator app"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="2fa-code"
            className="block text-sm font-medium text-muted-foreground mb-2"
          >
            {isBackupCode ? "Backup Code" : "Verification Code"}
          </label>
          <input
            ref={inputRef}
            id="2fa-code"
            type="text"
            value={code}
            onChange={handleCodeChange}
            placeholder={isBackupCode ? "XXXX-XXXX" : "000000"}
            className={`w-full px-4 py-3 bg-accent border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent text-center text-2xl tracking-widest ${
              isBackupCode ? "font-mono" : ""
            }`}
            autoComplete="one-time-code"
            inputMode={isBackupCode ? "text" : "numeric"}
            disabled={isLoading}
            data-testid="2fa-code-input"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !code.trim()}
          className="w-full px-4 py-2 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed btn-brand"
          data-testid="2fa-submit-button"
        >
          {isLoading ? "Verifying..." : "Verify"}
        </button>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={toggleBackupCode}
            className="text-brand hover:text-[var(--brand-primary-hover)]"
            disabled={isLoading}
          >
            {isBackupCode ? "Use authenticator app" : "Use backup code"}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </form>

      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-xs text-muted-foreground">
          {isBackupCode ? (
            <>
              Backup codes are single-use. After using a code, it will be
              invalidated.
            </>
          ) : (
            <>
              Open your authenticator app (Google Authenticator, Authy, etc.)
              and enter the current code for this account.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export default TwoFactorChallenge;
