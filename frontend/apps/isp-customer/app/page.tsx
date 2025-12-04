"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCustomerAuth } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useCustomerAuth();

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        router.push("/portal");
      } else {
        router.push("/login");
      }
    }
  }, [isAuthenticated, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
