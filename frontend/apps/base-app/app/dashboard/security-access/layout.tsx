import type { ReactNode } from "react";
import { ensurePortalAccess } from "@/lib/portal";

export default function SecurityAccessLayout({ children }: { children: ReactNode }) {
  ensurePortalAccess(["admin"]);
  return <>{children}</>;
}
