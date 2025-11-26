"use client";

import { useState } from "react";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { useDomainVerification, useDomainValidation } from "@/hooks/useDomainVerification";
import {
  Globe,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Clock,
  Terminal,
} from "lucide-react";
import type {
  VerificationMethod,
  DomainVerificationResponse,
} from "@/lib/services/domain-verification-service";

interface DomainVerificationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  onSuccess?: () => void;
}

type WizardStep = "input" | "instructions" | "verify" | "complete";

const VERIFICATION_METHODS: Array<{
  value: VerificationMethod;
  label: string;
  description: string;
  recommended?: boolean;
}> = [
  {
    value: "dns_txt",
    label: "DNS TXT Record",
    description: "Add a TXT record to your DNS settings (recommended)",
    recommended: true,
  },
  {
    value: "dns_cname",
    label: "DNS CNAME Record",
    description: "Add a CNAME record to your DNS settings",
  },
  {
    value: "meta_tag",
    label: "HTML Meta Tag",
    description: "Add a meta tag to your website homepage (coming soon)",
  },
  {
    value: "file_upload",
    label: "File Upload",
    description: "Upload a verification file to your domain (coming soon)",
  },
];

export function DomainVerificationWizard({
  open,
  onOpenChange,
  tenantId,
  onSuccess,
}: DomainVerificationWizardProps) {
  const { toast } = useToast();
  const { initiateAsync, checkAsync, isInitiating, isChecking, reset } =
    useDomainVerification(tenantId);
  const { validateDomain } = useDomainValidation();

  const [currentStep, setCurrentStep] = useState<WizardStep>("input");
  const [domain, setDomain] = useState("");
  const [method, setMethod] = useState<VerificationMethod>("dns_txt");
  const [verificationData, setVerificationData] = useState<DomainVerificationResponse | null>(null);

  const handleDomainChange = (value: string) => {
    // Convert to lowercase and trim
    setDomain(value.toLowerCase().trim());
  };

  const handleInitiate = async () => {
    // Validate domain
    const validation = validateDomain(domain);
    if (!validation.valid) {
      toast({
        title: "Invalid Domain",
        description: validation.error ?? "Please enter a valid domain.",
        variant: "destructive",
      });
      return;
    }

    // Check if method is available
    const selectedMethod = VERIFICATION_METHODS.find((m) => m.value === method);
    if (selectedMethod?.value === "meta_tag" || selectedMethod?.value === "file_upload") {
      toast({
        title: "Method Not Available",
        description: "This verification method is coming soon. Please use DNS verification.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await initiateAsync({ domain, method });
      setVerificationData(result);
      setCurrentStep("instructions");

      toast({
        title: "Verification Initiated",
        description: "Follow the instructions to verify your domain",
      });
    } catch (error) {
      toast({
        title: "Initiation Failed",
        description: error instanceof Error ? error.message : "Failed to initiate verification",
        variant: "destructive",
      });
    }
  };

  const handleCheck = async () => {
    if (!verificationData?.token) return;

    try {
      const result = await checkAsync({
        domain,
        token: verificationData.token,
        method,
      });

      setVerificationData(result);

      if (result.status === "verified") {
        setCurrentStep("complete");
        toast({
          title: "Domain Verified!",
          description: `${domain} has been successfully verified`,
        });
        onSuccess?.();
      } else if (result.status === "failed") {
        toast({
          title: "Verification Failed",
          description:
            result.error_message ||
            "Could not verify domain. Please check your DNS settings and try again.",
          variant: "destructive",
        });
      } else if (result.status === "expired") {
        toast({
          title: "Token Expired",
          description: "Verification token has expired. Please start over.",
          variant: "destructive",
        });
        handleReset();
      }
    } catch (error) {
      toast({
        title: "Check Failed",
        description: error instanceof Error ? error.message : "Failed to check verification",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setCurrentStep("input");
    setDomain("");
    setMethod("dns_txt");
    setVerificationData(null);
    reset();
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: `${label} has been copied`,
    });
  };

  const getExpirationTime = () => {
    if (!verificationData?.expires_at) return null;
    const expiresAt = new Date(verificationData.expires_at);
    const now = new Date();
    const hoursLeft = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
    return hoursLeft;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Verify Custom Domain
          </DialogTitle>
          <DialogDescription>
            Verify ownership of your custom domain to enable custom branding
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Input Domain */}
        {currentStep === "input" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Domain Information</CardTitle>
                <CardDescription>
                  Enter the domain you want to verify and select a verification method
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="domain">
                    Domain Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="domain"
                    value={domain}
                    onChange={(e) => handleDomainChange(e.target.value)}
                    placeholder="example.com"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter your domain without http:// or www
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="method">Verification Method</Label>
                  <Select value={method} onValueChange={(v) => setMethod(v as VerificationMethod)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VERIFICATION_METHODS.map((m) => (
                        <SelectItem
                          key={m.value}
                          value={m.value}
                          disabled={m.value === "meta_tag" || m.value === "file_upload"}
                        >
                          <div className="flex items-center gap-2">
                            {m.label}
                            {m.recommended && (
                              <Badge variant="secondary" className="ml-1">
                                Recommended
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {VERIFICATION_METHODS.find((m) => m.value === method)?.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Instructions */}
        {currentStep === "instructions" && verificationData && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Verification Instructions</CardTitle>
                <CardDescription>
                  Follow these steps to verify ownership of {domain}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {verificationData.instructions && (
                  <>
                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-900 dark:text-blue-100">
                            {verificationData.instructions.type}
                          </h4>
                          <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                            {verificationData.instructions.description}
                          </p>
                        </div>
                      </div>
                    </div>

                    {verificationData.instructions.dns_record && (
                      <div className="space-y-3">
                        <h4 className="font-medium">DNS Record Configuration</h4>
                        <div className="bg-muted p-4 rounded-lg space-y-2 font-mono text-sm">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <span className="text-muted-foreground">Type:</span>
                              <div className="font-semibold">
                                {verificationData.instructions.dns_record.type}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Name:</span>
                              <div className="font-semibold">
                                {verificationData.instructions.dns_record.name}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">TTL:</span>
                              <div className="font-semibold">
                                {verificationData.instructions.dns_record.ttl}
                              </div>
                            </div>
                          </div>
                          {verificationData.instructions.dns_record.value && (
                            <div>
                              <span className="text-muted-foreground">Value:</span>
                              <div className="flex items-center gap-2 mt-1">
                                <code className="flex-1 bg-background px-3 py-2 rounded border break-all">
                                  {verificationData.instructions.dns_record.value}
                                </code>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    copyToClipboard(
                                      verificationData.instructions!.dns_record!.value!,
                                      "DNS record value",
                                    )
                                  }
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                          {verificationData.instructions.dns_record.target && (
                            <div>
                              <span className="text-muted-foreground">Target:</span>
                              <div className="flex items-center gap-2 mt-1">
                                <code className="flex-1 bg-background px-3 py-2 rounded border">
                                  {verificationData.instructions.dns_record.target}
                                </code>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    copyToClipboard(
                                      verificationData.instructions!.dns_record!.target!,
                                      "DNS record target",
                                    )
                                  }
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="font-medium">Steps to Verify</h4>
                      <ol className="list-decimal list-inside space-y-2 text-sm">
                        {verificationData.instructions.steps.map((step, index) => (
                          <li key={index} className="text-muted-foreground">
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>

                    {verificationData.instructions.verification_command && (
                      <div className="space-y-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <Terminal className="h-4 w-4" />
                          Test DNS Propagation
                        </h4>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 bg-muted px-3 py-2 rounded border font-mono text-sm">
                            {verificationData.instructions.verification_command}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              copyToClipboard(
                                verificationData.instructions!.verification_command!,
                                "Verification command",
                              )
                            }
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-yellow-900 dark:text-yellow-100">
                            DNS Propagation Time
                          </h4>
                          <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                            DNS changes may take 5-10 minutes to propagate. If verification fails,
                            please wait a few minutes and try again.
                          </p>
                          {getExpirationTime() !== null && (
                            <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-2">
                              Verification token expires in {getExpirationTime()} hours
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Verification Result */}
        {currentStep === "verify" && verificationData && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Verification Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {verificationData.status === "pending" && (
                  <div className="text-center py-8">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-lg font-medium">Checking verification...</p>
                    <p className="text-sm text-muted-foreground mt-2">This may take a moment</p>
                  </div>
                )}

                {verificationData.status === "failed" && (
                  <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-6 rounded-lg text-center">
                    <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
                    <h4 className="font-medium text-red-900 dark:text-red-100 text-lg">
                      Verification Failed
                    </h4>
                    <p className="text-sm text-red-800 dark:text-red-200 mt-2">
                      {verificationData.error_message ||
                        "Could not verify domain. Please check your DNS settings."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Complete */}
        {currentStep === "complete" && verificationData && (
          <div className="space-y-4">
            <Card className="border-green-500">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  Domain Verified Successfully!
                </CardTitle>
                <CardDescription>
                  Your custom domain has been verified and is now active
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-6 rounded-lg text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <div className="space-y-2">
                    <h4 className="font-medium text-green-900 dark:text-green-100 text-lg">
                      {domain}
                    </h4>
                    <p className="text-sm text-green-800 dark:text-green-200">
                      Verified on{" "}
                      {verificationData.verified_at
                        ? new Date(verificationData.verified_at).toLocaleString()
                        : "just now"}
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                    What&apos;s Next?
                  </h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• Your domain is now associated with your tenant</li>
                    <li>• You can configure custom branding settings</li>
                    <li>• Custom domain will be used for branded experiences</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between">
          <div>
            {currentStep === "instructions" && (
              <Button variant="outline" onClick={() => setCurrentStep("input")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            {currentStep === "complete" ? (
              <Button onClick={handleClose}>Close</Button>
            ) : currentStep === "input" ? (
              <>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleInitiate} disabled={isInitiating || !domain}>
                  {isInitiating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Initiating...
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </>
            ) : currentStep === "instructions" ? (
              <>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleCheck} disabled={isChecking}>
                  {isChecking ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    "Check Verification"
                  )}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setCurrentStep("instructions")}>
                Try Again
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
