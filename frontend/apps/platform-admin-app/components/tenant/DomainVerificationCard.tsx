"use client";

import { useState } from "react";
import { Button } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { useDomainStatus, useDomainVerification } from "@/hooks/useDomainVerification";
import { DomainVerificationWizard } from "./DomainVerificationWizard";
import { Globe, CheckCircle2, AlertCircle, Trash2, Plus, Shield } from "lucide-react";

interface DomainVerificationCardProps {
  tenantId: string;
}

export function DomainVerificationCard({ tenantId }: DomainVerificationCardProps) {
  const { toast } = useToast();
  const { data: status, isLoading, refetch } = useDomainStatus(tenantId);
  const { removeAsync, isRemoving } = useDomainVerification(tenantId);

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

  const handleRemoveDomain = async () => {
    try {
      await removeAsync();

      toast({
        title: "Domain Removed",
        description: "Custom domain has been removed from your account",
      });

      setIsRemoveDialogOpen(false);
      refetch();
    } catch (error) {
      toast({
        title: "Removal Failed",
        description: error instanceof Error ? error.message : "Failed to remove domain",
        variant: "destructive",
      });
    }
  };

  const handleWizardSuccess = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Custom Domain
          </CardTitle>
          <CardDescription>Verify your custom domain for branded experiences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Custom Domain
          </CardTitle>
          <CardDescription>
            {status?.is_verified
              ? "Your custom domain is verified and active"
              : "Verify your custom domain for branded experiences"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.is_verified && status.domain ? (
            <>
              <div className="flex items-start justify-between p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-start gap-3 flex-1">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-green-900 dark:text-green-100">
                        {status.domain}
                      </span>
                      <Badge variant="secondary" className="bg-green-100 dark:bg-green-900">
                        <Shield className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    </div>
                    {status.verified_at && (
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Verified on {new Date(status.verified_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsWizardOpen(true)} className="flex-1">
                  <Plus className="h-4 w-4 mr-2" />
                  Change Domain
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsRemoveDialogOpen(true)}
                  disabled={isRemoving}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Benefits:</strong> Your custom domain enables branded login pages, email
                  templates, and customer-facing portals.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium mb-1">No domain verified</p>
                  <p className="text-sm text-muted-foreground">
                    Verify a custom domain to enable branded experiences for your organization.
                  </p>
                </div>
              </div>

              <Button onClick={() => setIsWizardOpen(true)} className="w-full">
                <Globe className="h-4 w-4 mr-2" />
                Verify Domain
              </Button>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Why verify a domain?</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Custom branding on login and customer portals</li>
                  <li>• Branded email communications</li>
                  <li>• Professional appearance for your organization</li>
                  <li>• Enhanced trust and credibility</li>
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Domain Verification Wizard */}
      <DomainVerificationWizard
        open={isWizardOpen}
        onOpenChange={setIsWizardOpen}
        tenantId={tenantId}
        onSuccess={handleWizardSuccess}
      />

      {/* Remove Domain Confirmation */}
      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Custom Domain?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{status?.domain}</strong> from your account. The domain can
              be claimed by another tenant afterward.
              <br />
              <br />
              Custom branding features will be disabled until you verify another domain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveDomain}
              className="bg-red-600 hover:bg-red-700"
              disabled={isRemoving}
            >
              {isRemoving ? "Removing..." : "Remove Domain"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
