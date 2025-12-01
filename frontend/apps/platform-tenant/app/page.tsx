"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isTenantAuthenticated } from "@/lib/auth/token-utils";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (isTenantAuthenticated()) {
      router.replace("/portal");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}
