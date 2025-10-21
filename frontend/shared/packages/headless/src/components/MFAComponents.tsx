/**
 * Multi-Factor Authentication UI Components
 */

import {
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  Key,
  Mail,
  RefreshCw,
  Shield,
  Smartphone,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

import {
  formatBackupCode,
  isValidBackupCode,
  isValidTOTPCode,
  type MFAMethod,
  useMFA,
} from "../hooks/useMFA";

export interface MFASetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

// Helper components to reduce complexity
function MFALoadingState() {
  return (
    <div className="py-8 text-center">
      <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-blue-600 border-b-2" />
      <p className="text-gray-600">Setting up Multi-Factor Authentication...</p>
    </div>
  );
}

function MFACompleteState() {
  return (
    <div className="py-8 text-center">
      <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-600" />
      <h3 className="mb-2 font-semibold text-gray-900 text-lg">MFA Setup Complete</h3>
      <p className="text-gray-600">Your account is now secured with multi-factor authentication.</p>
    </div>
  );
}

function MFAErrorMessage({ error }: { error: string }) {
  return (
    <div className="mb-4 flex items-center rounded-lg border border-red-200 bg-red-50 p-3">
      <AlertCircle className="mr-2 h-4 w-4 text-red-600" />
      <span className="text-red-800 text-sm">{error}</span>
    </div>
  );
}

// Helper component for QR code step
function MFAQRCodeStep({ setupData, onNext }: { setupData: unknown; onNext: () => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <Shield className="mx-auto mb-4 h-12 w-12 text-blue-600" />
        <h3 className="mb-2 font-semibold text-gray-900 text-lg">Set Up Authenticator App</h3>
        <p className="text-gray-600">Scan this QR code with your authenticator app</p>
      </div>

      <div className="flex justify-center rounded-lg bg-white p-4 shadow-inner">
        <QRCodeCanvas value={setupData.qrCode} size={200} />
      </div>

      <div className="rounded-lg bg-gray-50 p-4">
        <p className="mb-2 text-gray-600 text-sm">Can't scan? Enter this code manually:</p>
        <p className="break-all font-mono font-semibold text-gray-900 text-sm">
          {setupData.secret}
        </p>
      </div>

      <button
        type="button"
        onClick={onNext}
        onKeyDown={(e) => e.key === "Enter" && onNext}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        I've Added the Secret
      </button>
    </div>
  );
}

// Helper component for backup codes step
function _MFABackupCodesStep({
  backupCodes,
  backupCodesDownloaded,
  onDownload,
  onComplete,
  onCancel,
}: {
  backupCodes: string[];
  backupCodesDownloaded: boolean;
  onDownload: () => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <Key className="mx-auto mb-4 h-12 w-12 text-amber-600" />
        <h3 className="mb-2 font-semibold text-gray-900 text-lg">Save Your Backup Codes</h3>
        <p className="text-gray-600">
          Store these codes safely. You'll need them if you lose access to your authenticator.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="grid grid-cols-2 gap-2">
          {backupCodes.map((code, index) => (
            <div
              key={`item-${index}`}
              className="rounded border border-gray-200 bg-white px-3 py-2 font-mono text-sm"
            >
              {code}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center rounded-lg border border-amber-200 bg-amber-50 p-3">
        <AlertCircle className="mr-2 h-4 w-4 flex-shrink-0 text-amber-600" />
        <p className="text-amber-800 text-sm">
          Each backup code can only be used once. After using a code, it will be permanently
          invalidated.
        </p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={onDownload}
          onKeyDown={(e) => e.key === "Enter" && onDownload}
          className="flex w-full items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700"
        >
          <Download className="mr-2 h-4 w-4" />
          Download Backup Codes
        </button>

        {backupCodesDownloaded ? (
          <button
            type="button"
            onClick={onComplete}
            onKeyDown={(e) => e.key === "Enter" && onComplete}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Complete Setup
          </button>
        ) : (
          <button
            type="button"
            onClick={onCancel}
            onKeyDown={(e) => e.key === "Enter" && onCancel}
            className="w-full rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// MFA Setup step components using composition
const MFASetupSteps = {
  verify: ({
    verificationCode,
    setVerificationCode,
    handleVerifyCode,
    isLoading,
    setStep,
  }: {
    verificationCode: string;
    setVerificationCode: (code: string) => void;
    handleVerifyCode: () => Promise<void>;
    isLoading: boolean;
    setStep: (step: string) => void;
  }) => (
    <div className="space-y-6">
      <div className="text-center">
        <Smartphone className="mx-auto mb-4 h-12 w-12 text-blue-600" />
        <h3 className="mb-2 font-semibold text-gray-900 text-lg">Verify Setup</h3>
        <p className="text-gray-600">Enter the 6-digit code from your authenticator app</p>
      </div>
      <div>
        <input
          type="text"
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="w-full rounded-lg border border-gray-300 p-3 text-center font-mono text-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          maxLength={6}
        />
      </div>
      <div className="flex space-x-3">
        <button
          type="button"
          onClick={() => setStep("scan")}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleVerifyCode}
          onKeyDown={(e) => e.key === "Enter" && handleVerifyCode}
          disabled={!isValidTOTPCode(verificationCode) || isLoading}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? "Verifying..." : "Verify"}
        </button>
      </div>
    </div>
  ),

  backup: ({
    backupCodes,
    downloadBackupCodes,
    handleComplete,
    backupCodesDownloaded,
  }: {
    backupCodes: string[];
    downloadBackupCodes: () => void;
    handleComplete: () => void;
    backupCodesDownloaded: boolean;
  }) => (
    <div className="space-y-6">
      <div className="text-center">
        <Key className="mx-auto mb-4 h-12 w-12 text-orange-600" />
        <h3 className="mb-2 font-semibold text-gray-900 text-lg">Save Backup Codes</h3>
        <p className="text-gray-600">
          Store these codes safely. Use them if you lose access to your authenticator app.
        </p>
      </div>
      <div className="rounded-lg bg-gray-50 p-4">
        <div className="grid grid-cols-2 gap-2 text-center">
          {backupCodes.map((code, index) => (
            <div key={`item-${index}`} className="rounded border bg-white p-2 font-mono text-sm">
              {code}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <button
          type="button"
          onClick={downloadBackupCodes}
          onKeyDown={(e) => e.key === "Enter" && downloadBackupCodes}
          className="flex w-full items-center justify-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />
          <span>Download Backup Codes</span>
        </button>
        <button
          type="button"
          onClick={handleComplete}
          onKeyDown={(e) => e.key === "Enter" && handleComplete}
          disabled={!backupCodesDownloaded}
          className="w-full rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
        >
          I've Saved My Backup Codes
        </button>
      </div>
      {!backupCodesDownloaded && (
        <p className="text-center text-amber-600 text-sm">
          Please download your backup codes before continuing
        </p>
      )}
    </div>
  ),
};

// MFA Setup helper functions
const MFASetupHelpers = {
  createFileDownload: (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  generateBackupFileContent: (backupCodes: string[]) =>
    `DotMac Backup Codes\nGenerated: ${new Date().toLocaleDateString()}\n\n${backupCodes.join("\n")}\n\nKeep these codes safe and secure. Each code can only be used once.`,

  initializeSetup: async (
    initializeMFASetup: () => Promise<unknown>,
    setStep: (step: string) => void,
  ) => {
    const data = await initializeMFASetup();
    if (data) {
      setStep("scan");
    }
  },

  verifyAndGenerateBackup: async (
    verificationCode: string,
    verifyMFASetup: (code: string) => Promise<boolean>,
    generateBackupCodes: () => Promise<string[] | undefined>,
    setStep: (step: string) => void,
    setBackupCodes: (codes: string[]) => void,
  ) => {
    if (!isValidTOTPCode(verificationCode)) {
      return;
    }

    const success = await verifyMFASetup(verificationCode);
    if (success) {
      setStep("backup");
      const codes = await generateBackupCodes();
      if (codes) {
        setBackupCodes(codes);
      }
    }
  },
};

export function MFASetup({ onComplete, onCancel }: MFASetupProps) {
  const { isLoading, error, setupData, initializeMFASetup, verifyMFASetup, generateBackupCodes } =
    useMFA();

  const [step, setStep] = useState<"init" | "scan" | "verify" | "backup" | "complete">("init");
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [backupCodesDownloaded, setBackupCodesDownloaded] = useState(false);

  useEffect(() => {
    if (step === "init") {
      MFASetupHelpers.initializeSetup(initializeMFASetup, setStep);
    }
  }, [step, initializeMFASetup]);

  const handleVerifyCode = () =>
    MFASetupHelpers.verifyAndGenerateBackup(
      verificationCode,
      verifyMFASetup,
      generateBackupCodes,
      setStep,
      setBackupCodes,
    );

  const downloadBackupCodes = () => {
    const content = MFASetupHelpers.generateBackupFileContent(backupCodes);
    MFASetupHelpers.createFileDownload(content, "dotmac-backup-codes.txt");
    setBackupCodesDownloaded(true);
  };

  const handleComplete = () => {
    setStep("complete");
    setTimeout(onComplete, 1500);
  };

  // Early returns for loading and complete states
  if (isLoading && step === "init") {
    return <MFALoadingState />;
  }
  if (step === "complete") {
    return <MFACompleteState />;
  }

  return (
    <div className="mx-auto max-w-md">
      {error && <MFAErrorMessage error={error} />}

      {step === "scan" && setupData && (
        <MFAQRCodeStep setupData={setupData} onNext={() => setStep("verify")} />
      )}

      {step === "verify" &&
        MFASetupSteps.verify({
          verificationCode,
          setVerificationCode,
          handleVerifyCode,
          isLoading,
          setStep,
        })}

      {step === "backup" &&
        MFASetupSteps.backup({
          backupCodes,
          downloadBackupCodes,
          handleComplete,
          backupCodesDownloaded,
        })}

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={onCancel}
          onKeyDown={(e) => e.key === "Enter" && onCancel}
          className="text-gray-600 text-sm hover:text-gray-800"
        >
          Cancel Setup
        </button>
      </div>
    </div>
  );
}

export interface MFAVerificationProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

// Helper functions for MFAVerification
function getMethodIcon(method: MFAMethod) {
  const icons = {
    totp: <Smartphone className="h-4 w-4" />,
    sms: <Smartphone className="h-4 w-4" />,
    email: <Mail className="h-4 w-4" />,
    backup_code: <Key className="h-4 w-4" />,
  };
  return icons[method];
}

function getMethodLabel(method: MFAMethod) {
  const labels = {
    totp: "Authenticator App",
    sms: "SMS Code",
    email: "Email Code",
    backup_code: "Backup Code",
  };
  return labels[method];
}

function getPlaceholder(method: MFAMethod) {
  return method === "backup_code" ? "XXXXXXXX-XXXXXXXX" : "000000";
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// MFA Verification composition helpers
const MFAVerificationHelpers = {
  setupTimer: (
    getChallengeTimeRemaining: () => number,
    setTimeRemaining: (time: number) => void,
    intervalRef: React.MutableRefObject<NodeJS.Timeout | undefined>,
  ) => {
    useEffect(() => {
      const updateTimer = () => {
        const remaining = getChallengeTimeRemaining();
        setTimeRemaining(remaining);
        if (remaining <= 0) {
          clearInterval(intervalRef.current);
        }
      };

      updateTimer();
      intervalRef.current = setInterval(updateTimer, 1000);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }, [getChallengeTimeRemaining, intervalRef, setTimeRemaining]);
  },

  setupDefaultMethod: (
    challenge: { methods: MFAMethod[] } | null,
    selectedMethod: MFAMethod,
    setSelectedMethod: (method: MFAMethod) => void,
  ) => {
    useEffect(() => {
      if (challenge?.methods.length && !challenge.methods.includes(selectedMethod)) {
        const firstMethod = challenge.methods[0];
        if (firstMethod) {
          setSelectedMethod(firstMethod);
        }
      }
    }, [challenge, selectedMethod, setSelectedMethod]);
  },

  validateCode: (verificationCode: string, selectedMethod: MFAMethod): string | null => {
    if (selectedMethod === "backup_code") {
      const formatted = formatBackupCode(verificationCode);
      return isValidBackupCode(formatted) ? formatted : null;
    }
    if (selectedMethod === "totp") {
      return isValidTOTPCode(verificationCode) ? verificationCode : null;
    }
    return verificationCode;
  },

  createVerifyHandler:
    (
      challenge: { challengeId: string } | null,
      verificationCode: string,
      selectedMethod: MFAMethod,
      verifyMFAChallenge: (
        id: string,
        code: string,
        method: MFAMethod,
      ) => Promise<{ success: boolean }>,
      onSuccess: () => void,
    ) =>
    async () => {
      if (!challenge) {
        return;
      }
      const codeToVerify = MFAVerificationHelpers.validateCode(verificationCode, selectedMethod);
      if (!codeToVerify) {
        return;
      }

      const result = await verifyMFAChallenge(challenge.challengeId, codeToVerify, selectedMethod);
      if (result.success) {
        onSuccess();
      }
    },

  createSendCodeHandler:
    (
      selectedMethod: MFAMethod,
      sendSMSCode: () => Promise<unknown>,
      sendEmailCode: () => Promise<unknown>,
    ) =>
    async () => {
      if (selectedMethod === "sms") {
        await sendSMSCode();
      } else if (selectedMethod === "email") {
        await sendEmailCode();
      }
    },
};

export function MFAVerification({ onSuccess, onCancel }: MFAVerificationProps) {
  const {
    isLoading,
    error,
    challenge,
    verifyMFAChallenge,
    sendSMSCode,
    sendEmailCode,
    getChallengeTimeRemaining,
  } = useMFA();

  const [selectedMethod, setSelectedMethod] = useState<MFAMethod>("totp");
  const [verificationCode, setVerificationCode] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout>();

  // Setup effects using composition helpers
  MFAVerificationHelpers.setupTimer(getChallengeTimeRemaining, setTimeRemaining, intervalRef);
  MFAVerificationHelpers.setupDefaultMethod(challenge, selectedMethod, setSelectedMethod);

  // Create handlers using composition
  const handleVerify = MFAVerificationHelpers.createVerifyHandler(
    challenge,
    verificationCode,
    selectedMethod,
    verifyMFAChallenge,
    onSuccess,
  );

  const handleSendCode = MFAVerificationHelpers.createSendCodeHandler(
    selectedMethod,
    sendSMSCode,
    sendEmailCode,
  );

  // Removed these functions as they are now defined outside the component

  if (!challenge) {
    return (
      <div className="py-8 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-amber-600" />
        <p className="text-gray-600">No MFA challenge available</p>
      </div>
    );
  }

  if (timeRemaining <= 0) {
    return (
      <div className="py-8 text-center">
        <Clock className="mx-auto mb-4 h-12 w-12 text-red-600" />
        <h3 className="mb-2 font-semibold text-gray-900 text-lg">Verification Expired</h3>
        <p className="mb-4 text-gray-600">Please try logging in again</p>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            onKeyDown={(e) => e.key === "Enter" && onCancel}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Try Again
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <Shield className="mx-auto mb-4 h-12 w-12 text-blue-600" />
        <h3 className="mb-2 font-semibold text-gray-900 text-lg">Verification Required</h3>
        <p className="text-gray-600">Complete two-factor authentication to continue</p>

        <div className="mt-2 flex items-center justify-center space-x-2 text-gray-500 text-sm">
          <Clock className="h-4 w-4" />
          <span>Expires in {formatTime(timeRemaining)}</span>
        </div>
      </div>

      {error ? (
        <div className="flex items-center rounded-lg border border-red-200 bg-red-50 p-3">
          <AlertCircle className="mr-2 h-4 w-4 text-red-600" />
          <span className="text-red-800 text-sm">{error}</span>
        </div>
      ) : null}

      {/* Method Selection */}
      {challenge.methods.length > 1 && (
        <div className="space-y-2">
          <label
            htmlFor="input-1755609778629-2hef7k1c7"
            className="block font-medium text-gray-700 text-sm"
          >
            Choose verification method:
          </label>
          <div className="grid grid-cols-2 gap-2">
            {challenge.methods.map((method) => (
              <button
                type="button"
                key={method}
                onClick={() => setSelectedMethod(method)}
                className={`flex items-center justify-center space-x-2 rounded-lg border p-3 ${
                  selectedMethod === method
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                {getMethodIcon(method)}
                <span className="text-sm">{getMethodLabel(method)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Code Input */}
      <div className="space-y-2">
        <label
          htmlFor="input-1755609778629-86whzc9n4"
          className="block font-medium text-gray-700 text-sm"
        >
          {selectedMethod === "backup_code" ? "Backup Code" : "Verification Code"}
        </label>
        <input
          type="text"
          value={verificationCode}
          onChange={(e) => {
            let value = e.target.value;
            if (selectedMethod === "backup_code") {
              value = value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
              if (value.length === 8 && !value.includes("-")) {
                value = `${value.slice(0, 8)}-`;
              }
              setVerificationCode(value.slice(0, 17));
            } else {
              setVerificationCode(value.replace(/\D/g, "").slice(0, 6));
            }
          }}
          placeholder={getPlaceholder(selectedMethod)}
          className="w-full rounded-lg border border-gray-300 p-3 text-center font-mono text-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Send Code Button (for SMS/Email) */}
      {(selectedMethod === "sms" || selectedMethod === "email") && (
        <button
          type="button"
          onClick={handleSendCode}
          onKeyDown={(e) => e.key === "Enter" && handleSendCode}
          disabled={isLoading}
          className="flex w-full items-center justify-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          <span>{isLoading ? "Sending..." : `Send ${getMethodLabel(selectedMethod)}`}</span>
        </button>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            onKeyDown={(e) => e.key === "Enter" && onCancel}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleVerify}
          onKeyDown={(e) => e.key === "Enter" && handleVerify}
          disabled={!verificationCode || isLoading}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? "Verifying..." : "Verify"}
        </button>
      </div>
    </div>
  );
}
