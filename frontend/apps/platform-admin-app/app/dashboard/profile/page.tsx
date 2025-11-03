"use client";

import { redirect } from "next/navigation";
import { useEffect } from "react";

export default function ProfilePage() {
  useEffect(() => {
    // Redirect to settings/profile
    redirect("/dashboard/settings/profile");
  }, []);

  // Fallback in case redirect doesn&apos;t work immediately
  if (typeof window !== "undefined") {
    window.location.href = "/dashboard/settings/profile";
  }

  return null;
}
