"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useState } from "react";
import { useTenant } from "@/lib/contexts/tenant-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Download, FileText, Mail, RefreshCw } from "lucide-react";
import ReceiptList from "@/components/billing/ReceiptList";
import ReceiptDetailModal from "@/components/billing/ReceiptDetailModal";
import { apiClient } from "@/lib/api/client";
import type { Receipt } from "@/types";

export default function ReceiptsPage() {
  const { currentTenant } = useTenant();
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleReceiptSelect = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedReceipt(null);
  };

  const handleDownloadPDF = async (receipt: Receipt) => {
    try {
      const response = await apiClient.get(`/api/isp/v1/billing/receipts/${receipt.receipt_id}/pdf`, {
        responseType: "blob",
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `receipt_${receipt.receipt_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download receipt:", err);
      // eslint-disable-next-line no-alert
      alert("Failed to download receipt. Please try again.");
    }
  };

  const handleEmailReceipt = async (receipt: Receipt) => {
    try {
      await apiClient.post(`/api/isp/v1/billing/receipts/${receipt.receipt_id}/email`);
      // eslint-disable-next-line no-alert
      alert(`Receipt ${receipt.receipt_number} sent to ${receipt.customer_email}`);
    } catch (err) {
      console.error("Failed to email receipt:", err);
      // eslint-disable-next-line no-alert
      alert("Failed to email receipt. Please try again.");
    }
  };

  const handlePrintReceipt = (receipt: Receipt) => {
    const printWindow = window.open(
      `/api/isp/v1/billing/receipts/${receipt.receipt_id}/html`,
      "_blank",
    );
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Receipts</h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            View and manage payment receipts. Download PDFs, email receipts to customers, and track
            all transactions.
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </header>

      {/* Quick Actions */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Receipt Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Access detailed receipt information, view line items, and verify payment details
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Download className="h-4 w-4 text-muted-foreground" />
              Bulk Downloads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Select multiple receipts and download them as a ZIP file for batch processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Email Delivery
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Send receipts directly to customers via email with professional formatting
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Receipts List */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>All Receipts</CardTitle>
            <CardDescription>
              Complete history of payment receipts for your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReceiptList
              key={refreshKey}
              tenantId={currentTenant?.id ?? "default-tenant"}
              onReceiptSelect={handleReceiptSelect}
            />
          </CardContent>
        </Card>
      </section>

      {/* Receipt Detail Modal */}
      <ReceiptDetailModal
        receipt={selectedReceipt}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onDownload={handleDownloadPDF}
        onEmail={handleEmailReceipt}
        onPrint={handlePrintReceipt}
      />
    </div>
  );
}
