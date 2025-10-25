import type { ReactNode } from "react";
import { ensurePortalAccess } from "@/lib/portal";

export default function PluginsLayout({ children }: { children: ReactNode }) {
  ensurePortalAccess(["admin"]);
  return <>{children}</>;
}
