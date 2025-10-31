"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirect /dashboard/billing → /dashboard/billing-revenue
 *
 * The main billing dashboard is at /dashboard/billing-revenue
 * Billing settings/preferences are at /dashboard/settings/billing
 */
export default function BillingRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/billing-revenue");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 dark:border-sky-400 mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirecting to Billing Dashboard...</p>
      </div>
    </div>
  );
}
