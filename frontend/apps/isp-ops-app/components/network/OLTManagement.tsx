"use client";

import { OLTManagement as SharedOLTManagement } from "@dotmac/features/network";
import { apiClient } from "@/lib/api/client";
import Link from "next/link";

export function OLTManagement() {
  return <SharedOLTManagement apiClient={apiClient} Link={Link as any} />;
}
