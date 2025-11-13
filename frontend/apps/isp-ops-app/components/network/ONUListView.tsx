"use client";

import { ONUListView as SharedONUListView } from "@dotmac/features/network";
import { apiClient } from "@/lib/api/client";
import { useToast, useConfirmDialog } from "@dotmac/ui";
import Link from "next/link";

export function ONUListView() {
  return (
    <SharedONUListView
      apiClient={apiClient}
      useToast={useToast}
      useConfirmDialog={useConfirmDialog}
      Link={Link as any}
    />
  );
}
