"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import PartnerOnboardingWorkflow from "@/components/partners/PartnerOnboardingWorkflow";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PartnerOnboardingPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href="/dashboard/partners"
          className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Partners
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Partner Onboarding</h1>
        <p className="text-muted-foreground mt-2">
          Complete the full partner onboarding workflow including partner setup, customer creation,
          license allocation, and tenant provisioning
        </p>
      </div>

      <PartnerOnboardingWorkflow />
    </div>
  );
}
