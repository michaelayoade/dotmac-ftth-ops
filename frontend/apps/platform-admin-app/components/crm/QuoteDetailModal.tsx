"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { QuoteStatusBadge } from "./Badges";
import { type Quote, useQuotes } from "@/hooks/useCRM";
import {
  Send,
  Edit,
  CheckCircle,
  XCircle,
  Trash2,
  Download,
  Printer,
  AlertTriangle,
  Clock,
  DollarSign,
  FileText,
  Calendar,
  User,
  Building,
} from "lucide-react";
import { QuotePDFGenerator } from "@/lib/pdf/quote-pdf";
import { apiClient } from "@/lib/api/client";

interface QuoteDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote: Quote | null;
  onUpdate?: () => void;
  onEdit?: (quote: Quote) => void;
}

export function QuoteDetailModal({
  isOpen,
  onClose,
  quote,
  onUpdate,
  onEdit,
}: QuoteDetailModalProps) {
  const { toast } = useToast();
  const { sendQuote, acceptQuote, rejectQuote, deleteQuote } = useQuotes();
  const [isProcessing, setIsProcessing] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<any>(null);

  // Fetch company info from settings
  useEffect(() => {
    const fetchCompanyInfo = async () => {
      try {
        const response = await apiClient.get("/settings/company");
        if (response.data) {
          setCompanyInfo(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch company info:", error);
        // Use fallback data if API fails
        setCompanyInfo({
          name: "Your ISP Company",
          address: "123 Main Street",
          city: "Your City",
          state: "ST",
          zip: "12345",
          phone: "(555) 123-4567",
          email: "sales@yourisp.com",
          website: "www.yourisp.com",
        });
      }
    };

    if (isOpen && quote) {
      fetchCompanyInfo();
    }
  }, [isOpen, quote]);

  if (!quote) return null;

  const validUntil = quote.valid_until ? new Date(quote.valid_until) : null;
  const daysUntilExpiry = validUntil ? differenceInDays(validUntil, new Date()) : null;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
  const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;

  const handleSend = async () => {
    setIsProcessing(true);
    try {
      await sendQuote(quote.id);
      toast({
        title: "Quote Sent",
        description: `Quote ${quote.quote_number} has been sent to the lead.`,
      });
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Failed to send quote:", error);
      toast({
        title: "Error",
        description: "Failed to send quote. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAccept = async () => {
    const confirmed = confirm(
      `Accept quote ${quote.quote_number}? This will mark it as accepted and ready for conversion.`,
    );
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      await acceptQuote(quote.id, {
        e_signature_name: "Customer Name", // In real app, this would be captured
        e_signature_ip_address: "127.0.0.1",
      });
      toast({
        title: "Quote Accepted",
        description: `Quote ${quote.quote_number} has been accepted! Ready to convert lead.`,
      });
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Failed to accept quote:", error);
      toast({
        title: "Error",
        description: "Failed to accept quote. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt("Please provide a reason for rejection:");
    if (!reason) return;

    setIsProcessing(true);
    try {
      await rejectQuote(quote.id, reason);
      toast({
        title: "Quote Rejected",
        description: `Quote ${quote.quote_number} has been rejected.`,
      });
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Failed to reject quote:", error);
      toast({
        title: "Error",
        description: "Failed to reject quote. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = confirm(
      `Are you sure you want to delete quote ${quote.quote_number}? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      const success = await deleteQuote(quote.id);
      if (success) {
        toast({
          title: "Quote Deleted",
          description: `Quote ${quote.quote_number} has been deleted successfully.`,
        });
        if (onUpdate) onUpdate();
        onClose();
      } else {
        throw new Error("Delete operation failed");
      }
    } catch (error) {
      console.error("Failed to delete quote:", error);
      toast({
        title: "Error",
        description: "Failed to delete quote. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsProcessing(true);
    try {
      const generator = new QuotePDFGenerator();

      // Use fetched company info or fallback
      const company = companyInfo || {
        name: "Your ISP Company",
        address: "123 Main Street",
        city: "Your City",
        state: "ST",
        zip: "12345",
        phone: "(555) 123-4567",
        email: "sales@yourisp.com",
        website: "www.yourisp.com",
      };

      // Map Quote type to QuoteData expected by PDF generator
      const quoteData = {
        quote_number: quote.quote_number,
        customer_name: "N/A",
        customer_email: "N/A",
        customer_phone: "N/A",
        service_address: "N/A",
        plan_name: quote.service_plan_name || "Internet Service",
        bandwidth_down: quote.bandwidth,
        bandwidth_up: quote.bandwidth,
        monthly_charge: quote.monthly_recurring_charge,
        installation_fee: quote.installation_fee,
        equipment_fee: quote.equipment_fee,
        deposit: 0,
        contract_term_months: quote.contract_term_months,
        promotional_discount: quote.promo_monthly_discount,
        promotional_months: quote.promo_discount_months,
        valid_until:
          quote.valid_until || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: quote.created_at,
        notes: quote.notes,
        terms: quote.notes,
      };

      await generator.downloadQuotePDF({
        company: company,
        quote: quoteData,
      });

      toast({
        title: "PDF Downloaded",
        description: `Quote ${quote.quote_number} has been downloaded as PDF.`,
      });
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = () => {
    // In real implementation, this would open print dialog
    window.print();
  };

  // Calculate totals
  const upfrontCost = quote.installation_fee + quote.equipment_fee + quote.activation_fee;

  const lineItemsTotal =
    quote.line_items?.reduce((sum: number, item: any) => sum + (item.total || 0), 0) || 0;

  const totalUpfront = upfrontCost + lineItemsTotal;

  const monthlyWithDiscount =
    quote.promo_monthly_discount &&
    quote.promo_discount_months &&
    quote.promo_monthly_discount > 0 &&
    quote.promo_discount_months > 0
      ? quote.monthly_recurring_charge - quote.promo_monthly_discount
      : quote.monthly_recurring_charge;

  const firstYearCost =
    totalUpfront +
    (quote.promo_discount_months && quote.promo_monthly_discount
      ? monthlyWithDiscount * quote.promo_discount_months +
        quote.monthly_recurring_charge * (12 - quote.promo_discount_months)
      : quote.monthly_recurring_charge * 12);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <FileText className="h-6 w-6" />
                Quote {quote.quote_number}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <QuoteStatusBadge status={quote.status} />
                {isExpiringSoon && (
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                    <Clock className="h-3 w-3 mr-1" />
                    Expires in {daysUntilExpiry} days
                  </Badge>
                )}
                {isExpired && (
                  <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Expired
                  </Badge>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 border-b pb-4">
          {quote.status === "draft" && (
            <>
              <Button size="sm" onClick={handleSend} disabled={isProcessing}>
                <Send className="h-4 w-4 mr-2" />
                Send to Lead
              </Button>
              <Button size="sm" variant="outline" onClick={() => onEdit && onEdit(quote)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Quote
              </Button>
            </>
          )}
          {(quote.status === "sent" || quote.status === "viewed") && (
            <>
              <Button size="sm" onClick={handleAccept} disabled={isProcessing}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Accept (Simulate)
              </Button>
              <Button size="sm" variant="outline" onClick={handleReject} disabled={isProcessing}>
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDelete}
            disabled={isProcessing}
            className="text-red-400 hover:text-red-300"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>

        {/* Quote Content */}
        <div className="space-y-6">
          {/* Service Details */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Building className="h-5 w-5" />
              Service Details
            </h3>
            <div className="border rounded-lg p-4 space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Service Plan</p>
                <p className="font-medium text-lg">{quote.service_plan_name}</p>
              </div>
              {quote.bandwidth && (
                <div>
                  <p className="text-sm text-muted-foreground">Bandwidth</p>
                  <p className="font-medium">{quote.bandwidth}</p>
                </div>
              )}
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Pricing Breakdown
            </h3>
            <div className="border rounded-lg p-4 space-y-4">
              {/* Monthly Charge */}
              <div className="flex items-center justify-between pb-3 border-b">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Recurring Charge</p>
                  {quote.promo_monthly_discount &&
                    quote.promo_discount_months &&
                    quote.promo_monthly_discount > 0 &&
                    quote.promo_discount_months > 0 && (
                      <p className="text-xs text-emerald-400 mt-1">
                        ${monthlyWithDiscount.toFixed(2)}/month for first{" "}
                        {quote.promo_discount_months} months ({quote.notes})
                      </p>
                    )}
                </div>
                <p className="text-2xl font-bold">
                  ${quote.monthly_recurring_charge.toFixed(2)}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
              </div>

              {/* Upfront Costs */}
              <div>
                <p className="text-sm font-medium mb-2">Upfront Costs</p>
                <div className="space-y-2">
                  {quote.installation_fee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Installation Fee</span>
                      <span>${quote.installation_fee.toFixed(2)}</span>
                    </div>
                  )}
                  {quote.equipment_fee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Equipment Fee</span>
                      <span>${quote.equipment_fee.toFixed(2)}</span>
                    </div>
                  )}
                  {quote.activation_fee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Activation Fee</span>
                      <span>${quote.activation_fee.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items */}
              {quote.line_items && quote.line_items.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Additional Items</p>
                  <div className="space-y-2">
                    {quote.line_items.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {item.description} {item.quantity > 1 && `(${item.quantity}x)`}
                        </span>
                        <span>${item.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total Upfront */}
              <div className="flex justify-between pt-3 border-t">
                <span className="font-medium">Total Upfront Cost</span>
                <span className="text-xl font-bold">${totalUpfront.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Contract Terms */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Contract Terms
            </h3>
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Contract Length</span>
                <span className="font-medium">{quote.contract_term_months} months</span>
              </div>
              {quote.early_termination_fee && quote.early_termination_fee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Early Termination Fee</span>
                  <span className="font-medium">${quote.early_termination_fee.toFixed(2)}</span>
                </div>
              )}
              {validUntil && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valid Until</span>
                  <span className="font-medium">{validUntil.toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Cost Projections */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cost Projections
            </h3>
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">First Year Total</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Includes upfront costs + 12 months service
                  </p>
                </div>
                <p className="text-xl font-bold">${firstYearCost.toFixed(2)}</p>
              </div>
              <div className="flex justify-between pt-3 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Full Contract Total</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Includes upfront costs + all {quote.contract_term_months} months
                  </p>
                </div>
                <p className="text-xl font-bold">
                  $
                  {(
                    totalUpfront +
                    (quote.promo_discount_months && quote.promo_monthly_discount
                      ? monthlyWithDiscount * quote.promo_discount_months +
                        quote.monthly_recurring_charge *
                          (quote.contract_term_months - quote.promo_discount_months)
                      : quote.monthly_recurring_charge * quote.contract_term_months)
                  ).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Notes</h3>
              <div className="border rounded-lg p-4">
                <p className="text-sm whitespace-pre-wrap">{quote.notes}</p>
              </div>
            </div>
          )}

          {/* E-Signature (if accepted) */}
          {quote.status === "accepted" &&
            quote.signature_data?.name &&
            quote.signature_data?.date && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                  Electronic Signature
                </h3>
                <div className="border rounded-lg p-4 bg-emerald-500/10">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Signed By</span>
                      <span className="font-medium">{quote.signature_data?.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-medium">
                        {new Date(quote.signature_data?.date).toLocaleString()}
                      </span>
                    </div>
                    {quote.signature_data?.ip_address && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">IP Address</span>
                        <span className="font-mono text-xs">
                          {quote.signature_data?.ip_address}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          {/* Quote Metadata */}
          <div className="border-t pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">
                  {formatDistanceToNow(new Date(quote.created_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>
              {quote.sent_at && (
                <div>
                  <p className="text-muted-foreground">Sent</p>
                  <p className="font-medium">
                    {formatDistanceToNow(new Date(quote.sent_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              )}
              {quote.accepted_at && (
                <div>
                  <p className="text-muted-foreground">Accepted</p>
                  <p className="font-medium">
                    {formatDistanceToNow(new Date(quote.accepted_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              )}
              {quote.rejected_at && (
                <div>
                  <p className="text-muted-foreground">Rejected</p>
                  <p className="font-medium">
                    {formatDistanceToNow(new Date(quote.rejected_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
