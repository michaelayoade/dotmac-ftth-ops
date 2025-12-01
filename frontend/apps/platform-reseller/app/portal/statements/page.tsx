"use client";

import { usePartnerStatements } from "@/hooks/usePlatformPartner";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@dotmac/ui";
import { Button } from "@dotmac/primitives";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  ready: "bg-blue-100 text-blue-800",
  processing: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

export default function StatementsPage() {
  const { data: statements, isLoading, error } = usePartnerStatements();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load statements</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Statements</h2>
        <p className="text-gray-600 mt-1">
          View and download your commission statements
        </p>
      </div>

      {statements && statements.length > 0 ? (
        <div className="grid gap-4">
          {statements.map((statement) => (
            <Card key={statement.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-semibold">
                        {new Date(statement.period_start).toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </h3>
                      <Badge className={statusColors[statement.status] || "bg-gray-100 text-gray-800"}>
                        {statement.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      Period: {new Date(statement.period_start).toLocaleDateString()} -{" "}
                      {new Date(statement.period_end).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      Issued: {new Date(statement.issued_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    {statement.download_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(statement.download_url!, "_blank")}
                      >
                        Download PDF
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Revenue Total</p>
                    <p className="text-lg font-medium">
                      {formatCurrency(statement.revenue_total)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Commission Total</p>
                    <p className="text-lg font-medium text-green-600">
                      {formatCurrency(statement.commission_total)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Adjustments</p>
                    <p className={`text-lg font-medium ${statement.adjustments_total < 0 ? "text-red-600" : ""}`}>
                      {formatCurrency(statement.adjustments_total)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Net Payout</span>
                    <span className="text-xl font-bold text-green-600">
                      {formatCurrency(
                        statement.commission_total + statement.adjustments_total
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No statements yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Statements are generated monthly based on your commission activity
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
