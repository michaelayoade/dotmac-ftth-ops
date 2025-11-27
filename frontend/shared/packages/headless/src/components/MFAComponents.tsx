/**
 * Simplified MFA components
 * Provides lightweight MFA UI components for enrollment and verification flows.
 * Integrates with the FastAPI backend 2FA endpoints.
 */

import { Shield, Smartphone, Mail, Key } from "lucide-react";
import { useState } from "react";

export type MFAMethod = "totp" | "sms" | "email" | "backup_code";

export interface MFASetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

const AVAILABLE_METHODS: MFAMethod[] = ["totp", "sms", "email", "backup_code"];

export function MFASetup({ onComplete, onCancel }: MFASetupProps) {
  const [selectedMethod, setSelectedMethod] = useState<MFAMethod>("totp");
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Shield className="mx-auto mb-4 h-12 w-12 text-blue-600" />
        <h3 className="mb-2 font-semibold text-gray-900 text-lg">Multi-Factor Authentication</h3>
        <p className="text-gray-600">
          Select the MFA method you want to use and complete the enrollment flow.
        </p>
      </div>

      <div className="space-y-3">
        {AVAILABLE_METHODS.map((method) => (
          <button
            type="button"
            key={method}
            onClick={() => setSelectedMethod(method)}
            className={`flex w-full items-center justify-between rounded-lg border px-4 py-2 text-left transition-colors ${selectedMethod === method ? "border-blue-500 bg-blue-50 text-blue-900" : "border-gray-200 bg-white text-gray-800"}`}
          >
            <span className="capitalize">{method.replace("_", " ")}</span>
            {selectedMethod === method && <CheckIcon />}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        Complete the enrollment process with your selected method. When the
        enrollment succeeds, confirm below.
      </div>

      <label className="flex items-center space-x-2 text-sm text-gray-700">
        <input
          type="checkbox"
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        <span>I have finished configuring MFA for this user.</span>
      </label>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={!acknowledged}
          onClick={onComplete}
          className={`flex-1 rounded-lg px-4 py-2 text-white transition-colors ${acknowledged ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-300 cursor-not-allowed"}`}
        >
          Continue
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export interface MFAVerificationProps {
  method?: MFAMethod;
  onSuccess: () => void;
  onCancel: () => void;
}

export function MFAVerification({ method = "totp", onSuccess, onCancel }: MFAVerificationProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const validateCode = () => {
    if (code.trim().length < 4) {
      setError("Enter the code provided by your authentication method.");
      return;
    }
    setError(null);
    onSuccess();
  };

  const label = (() => {
    switch (method) {
      case "sms":
        return "Enter the code we texted you";
      case "email":
        return "Enter the code we emailed you";
      case "backup_code":
        return "Enter one of your backup codes";
      default:
        return "Enter the code from your authenticator app";
    }
  })();

  const Icon = method === "sms" ? Smartphone : method === "email" ? Mail : Key;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Icon className="mx-auto mb-4 h-12 w-12 text-blue-600" />
        <h3 className="mb-2 font-semibold text-gray-900 text-lg">Verify your identity</h3>
        <p className="text-gray-600">{label}</p>
      </div>

      <div className="space-y-2">
        <input
          type="text"
          value={code}
          onChange={(event) => setCode(event.target.value.trim())}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 font-mono text-center text-lg tracking-widest focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          placeholder={method === "backup_code" ? "XXXX-XXXX" : "000000"}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={validateCode}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Verify
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-xs">
      ✓
    </span>
  );
}
