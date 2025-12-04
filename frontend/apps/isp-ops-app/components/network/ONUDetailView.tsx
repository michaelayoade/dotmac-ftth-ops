"use client";

import { ONUDetailView as SharedONUDetailView } from "@dotmac/features/network";
import { apiClient } from "@/lib/api/client";
import { useToast, useConfirmDialog } from "@dotmac/ui";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ONUDetailViewProps {
  onuId: string;
}

export function ONUDetailView({ onuId }: ONUDetailViewProps) {
  const router = useRouter();

  return (
    <SharedONUDetailView
      onuId={onuId}
      apiClient={apiClient}
      useToast={useToast}
      useConfirmDialog={useConfirmDialog}
      router={router}
      Link={Link as any}
    />
  );
}
