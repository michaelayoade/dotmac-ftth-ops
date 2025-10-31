import type { ReactNode } from "react";
import { ensurePortalAccess } from "@/lib/portal";

export default function PlatformAdminLayout({ children }: { children: ReactNode }) {
  ensurePortalAccess(["admin"]);
  return <>{children}</>;
}
