"use client";

import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { RefreshCw, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface CustomerHeaderProps {
  customer: {
    id: string;
    display_name?: string;
    email: string;
    status: string;
    healthScore?: number;
  };
  onRefresh: () => void;
}

export function CustomerHeader({ customer, onRefresh }: CustomerHeaderProps) {
  const router = useRouter();

  const statusColors: Record<string, "default" | "secondary" | "destructive"> = {
    ACTIVE: "default",
    SUSPENDED: "secondary",
    CANCELED: "destructive",
  };

  const healthScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{customer.display_name || customer.email}</h1>
          <p className="text-sm text-muted-foreground">{customer.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {customer.healthScore !== undefined && (
          <div className="text-center">
            <div className={`text-4xl font-bold ${healthScoreColor(customer.healthScore)}`}>
              {customer.healthScore}
            </div>
            <p className="text-xs text-muted-foreground">Health Score</p>
          </div>
        )}
        <Badge variant={statusColors[customer.status] || "secondary"}>{customer.status}</Badge>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
