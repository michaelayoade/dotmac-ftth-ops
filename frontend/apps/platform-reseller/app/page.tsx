"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePartnerAuth } from "@/lib/auth/PartnerAuthContext";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = usePartnerAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace("/portal");
      } else {
        router.replace("/login");
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}
