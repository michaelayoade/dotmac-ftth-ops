/**
 * Quote PDF Generation Utility
 * Generates professional PDF quotes using jsPDF
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Utility function for currency formatting
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

interface CompanyInfo {
  name: string;
  address?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  zip?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  website?: string | undefined;
  logo?: string | undefined; // Base64 encoded image or URL
}

interface QuoteData {
  quote_number: string;
  customer_name: string;
  customer_email?: string | undefined;
  customer_phone?: string | undefined;
  customer_address?: string | undefined;
  service_address?: string | undefined;
  plan_name: string;
  bandwidth_up?: string | undefined;
  bandwidth_down?: string | undefined;
  monthly_charge: number;
  installation_fee: number;
  equipment_fee: number;
  deposit?: number | undefined;
  contract_term_months?: number | undefined;
  promotional_discount?: number | undefined;
  promotional_months?: number | undefined;
  valid_until: string;
  created_at: string;
  notes?: string | undefined;
  terms?: string | undefined;
}

export interface QuotePDFOptions {
  company: CompanyInfo;
  quote: QuoteData;
}

export class QuotePDFGenerator {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 20;
  private currentY: number = 20;

  constructor() {
    this.doc = new jsPDF();
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
  }

  /**
   * Generate quote PDF and return as blob
   */
  async generateQuotePDF(options: QuotePDFOptions): Promise<Blob> {
    const { company, quote } = options;

    // Header with company logo and info
    await this.addHeader(company);

    // Quote title
    this.addQuoteTitle(quote);

    // Company and customer info side by side
    this.addCompanyAndCustomerInfo(company, quote);

    // Quote details (dates, numbers, etc.)
    this.addQuoteDetails(quote);

    // Service details
    this.addServiceDetails(quote);

    // Pricing breakdown
    this.addPricingBreakdown(quote);

    // Cost projections
    this.addCostProjections(quote);

    // Terms and notes
    this.addTermsAndNotes(quote);

    // Acceptance section
    this.addAcceptanceSection();

    // Footer with page numbers
    this.addFooter();

    // Return as blob
    return this.doc.output("blob");
  }

  /**
   * Download quote PDF
   */
  async downloadQuotePDF(options: QuotePDFOptions): Promise<void> {
    await this.generateQuotePDF(options);
    this.doc.save(`quote-${options.quote.quote_number}.pdf`);
  }

  /**
   * Add header with company logo and info
   */
  private async addHeader(company: CompanyInfo): Promise<void> {
    // Add logo if available
    if (company.logo) {
      try {
        this.doc.addImage(company.logo, "PNG", this.margin, this.currentY, 40, 40);
      } catch (error) {
        console.warn("Failed to add logo to PDF:", error);
      }
    }

    // Company name and info on the right
    const rightX = this.pageWidth - this.margin;
    this.doc.setFontSize(16);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(company.name, rightX, this.currentY, { align: "right" });

    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    let infoY = this.currentY + 7;

    if (company.address) {
      this.doc.text(company.address, rightX, infoY, { align: "right" });
      infoY += 5;
    }

    if (company.city && company.state && company.zip) {
      this.doc.text(`${company.city}, ${company.state} ${company.zip}`, rightX, infoY, {
        align: "right",
      });
      infoY += 5;
    }

    if (company.phone) {
      this.doc.text(`Phone: ${company.phone}`, rightX, infoY, {
        align: "right",
      });
      infoY += 5;
    }

    if (company.email) {
      this.doc.text(`Email: ${company.email}`, rightX, infoY, {
        align: "right",
      });
      infoY += 5;
    }

    if (company.website) {
      this.doc.text(company.website, rightX, infoY, { align: "right" });
    }

    this.currentY += 50;
  }

  /**
   * Add quote title
   */
  private addQuoteTitle(quote: QuoteData): void {
    this.doc.setFontSize(28);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(59, 130, 246); // Blue color
    this.doc.text("SERVICE QUOTE", this.margin, this.currentY);

    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(0, 0, 0);
    this.currentY += 15;
  }

  /**
   * Add company and customer info side by side
   */
  private addCompanyAndCustomerInfo(company: CompanyInfo, quote: QuoteData): void {
    const leftX = this.margin;
    const rightX = this.pageWidth / 2 + 10;

    // Quote For section
    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Quote For:", leftX, this.currentY);

    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    let leftY = this.currentY + 7;

    this.doc.text(quote.customer_name, leftX, leftY);
    leftY += 5;

    if (quote.customer_email) {
      this.doc.text(`Email: ${quote.customer_email}`, leftX, leftY);
      leftY += 5;
    }

    if (quote.customer_phone) {
      this.doc.text(`Phone: ${quote.customer_phone}`, leftX, leftY);
      leftY += 5;
    }

    if (quote.customer_address) {
      this.doc.text(quote.customer_address, leftX, leftY);
    }

    // Service Address section (right side)
    if (quote.service_address) {
      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Service Address:", rightX, this.currentY);

      this.doc.setFontSize(10);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(quote.service_address, rightX, this.currentY + 7);
    }

    this.currentY += 35;
  }

  /**
   * Add quote details box
   */
  private addQuoteDetails(quote: QuoteData): void {
    const startY = this.currentY;

    // Draw box
    this.doc.setDrawColor(59, 130, 246);
    this.doc.setFillColor(239, 246, 255);
    this.doc.rect(this.margin, startY, this.pageWidth - 2 * this.margin, 30, "FD");

    // Add details
    this.doc.setFontSize(10);
    const detailsY = startY + 8;
    const col1X = this.margin + 5;
    const col2X = this.pageWidth / 2;

    this.doc.setFont("helvetica", "bold");
    this.doc.text("Quote Number:", col1X, detailsY);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(quote.quote_number, col1X + 40, detailsY);

    this.doc.setFont("helvetica", "bold");
    this.doc.text("Quote Date:", col2X, detailsY);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(new Date(quote.created_at).toLocaleDateString(), col2X + 35, detailsY);

    this.doc.setFont("helvetica", "bold");
    this.doc.text("Valid Until:", col1X, detailsY + 10);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(239, 68, 68); // Red for expiration
    this.doc.text(new Date(quote.valid_until).toLocaleDateString(), col1X + 40, detailsY + 10);
    this.doc.setTextColor(0, 0, 0);

    if (quote.contract_term_months) {
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Contract Term:", col2X, detailsY + 10);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(`${quote.contract_term_months} months`, col2X + 35, detailsY + 10);
    }

    this.currentY += 40;
  }

  /**
   * Add service details section
   */
  private addServiceDetails(quote: QuoteData): void {
    // Title
    this.doc.setFontSize(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Service Details", this.margin, this.currentY);
    this.currentY += 10;

    // Service details box
    this.doc.setDrawColor(200, 200, 200);
    this.doc.setFillColor(249, 250, 251);
    const boxHeight = 25;
    this.doc.rect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, boxHeight, "FD");

    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(quote.plan_name, this.margin + 5, this.currentY + 8);

    if (quote.bandwidth_down || quote.bandwidth_up) {
      this.doc.setFontSize(10);
      this.doc.setFont("helvetica", "normal");
      const bandwidthText =
        quote.bandwidth_down && quote.bandwidth_up
          ? `${quote.bandwidth_down} down / ${quote.bandwidth_up} up`
          : quote.bandwidth_down || quote.bandwidth_up || "";
      this.doc.text(bandwidthText, this.margin + 5, this.currentY + 16);
    }

    this.currentY += boxHeight + 10;
  }

  /**
   * Add pricing breakdown table
   */
  private addPricingBreakdown(quote: QuoteData): void {
    this.doc.setFontSize(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Pricing Breakdown", this.margin, this.currentY);
    this.currentY += 10;

    const tableData: string[][] = [];

    // Monthly service
    tableData.push(["Monthly Service", formatCurrency(quote.monthly_charge), "Recurring"]);

    // One-time charges
    if (quote.installation_fee > 0) {
      tableData.push(["Installation Fee", formatCurrency(quote.installation_fee), "One-time"]);
    }

    if (quote.equipment_fee > 0) {
      tableData.push(["Equipment Fee", formatCurrency(quote.equipment_fee), "One-time"]);
    }

    if (quote.deposit && quote.deposit > 0) {
      tableData.push(["Security Deposit", formatCurrency(quote.deposit), "Refundable"]);
    }

    // Promotional discount
    if (quote.promotional_discount && quote.promotional_discount > 0) {
      const discountText = quote.promotional_months
        ? `Promotional Discount (${quote.promotional_months} months)`
        : "Promotional Discount";
      tableData.push([discountText, `-${formatCurrency(quote.promotional_discount)}`, "Monthly"]);
    }

    autoTable(this.doc, {
      startY: this.currentY,
      head: [["Item", "Amount", "Type"]],
      body: tableData,
      theme: "striped",
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      styles: {
        fontSize: 10,
        cellPadding: 5,
      },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { halign: "right", cellWidth: 40 },
        2: { halign: "center", cellWidth: 35 },
      },
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
  }

  /**
   * Add cost projections
   */
  private addCostProjections(quote: QuoteData): void {
    this.doc.setFontSize(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Cost Projections", this.margin, this.currentY);
    this.currentY += 10;

    const upfrontCosts = quote.installation_fee + quote.equipment_fee + (quote.deposit || 0);

    const monthlyCharge = quote.promotional_discount
      ? quote.monthly_charge - quote.promotional_discount
      : quote.monthly_charge;

    const firstYearCost = upfrontCosts + monthlyCharge * 12;

    const rightX = this.pageWidth - this.margin;
    const labelX = rightX - 80;
    const valueX = rightX;

    this.doc.setFontSize(11);

    // Upfront costs
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Initial Setup Costs:", labelX, this.currentY, {
      align: "right",
    });
    this.doc.setFont("helvetica", "bold");
    this.doc.text(formatCurrency(upfrontCosts), valueX, this.currentY, {
      align: "right",
    });
    this.currentY += 8;

    // Monthly charge
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Monthly Service:", labelX, this.currentY, {
      align: "right",
    });
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(59, 130, 246);
    this.doc.setFontSize(14);
    this.doc.text(formatCurrency(monthlyCharge), valueX, this.currentY, {
      align: "right",
    });
    this.doc.setFontSize(11);
    this.doc.setTextColor(0, 0, 0);
    this.currentY += 10;

    // First year total
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(labelX - 5, this.currentY, valueX, this.currentY);
    this.currentY += 7;

    this.doc.setFont("helvetica", "bold");
    this.doc.text("First Year Total:", labelX, this.currentY, {
      align: "right",
    });
    this.doc.setFontSize(13);
    this.doc.text(formatCurrency(firstYearCost), valueX, this.currentY, {
      align: "right",
    });
    this.doc.setFontSize(11);

    this.currentY += 15;

    // Contract total (if contract term specified)
    if (quote.contract_term_months) {
      const contractTotal = upfrontCosts + quote.monthly_charge * quote.contract_term_months;

      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(10);
      this.doc.text(
        `Total over ${quote.contract_term_months}-month contract: ${formatCurrency(contractTotal)}`,
        this.margin,
        this.currentY,
      );
      this.currentY += 10;
    }
  }

  /**
   * Add terms and notes
   */
  private addTermsAndNotes(quote: QuoteData): void {
    if (quote.notes || quote.terms) {
      this.doc.setFontSize(9);
      this.doc.setFont("helvetica", "normal");

      if (quote.notes) {
        this.doc.setFont("helvetica", "bold");
        this.doc.text("Notes:", this.margin, this.currentY);
        this.doc.setFont("helvetica", "normal");
        this.currentY += 5;

        const splitText = this.doc.splitTextToSize(quote.notes, this.pageWidth - 2 * this.margin);
        this.doc.text(splitText, this.margin, this.currentY);
        this.currentY += splitText.length * 5 + 5;
      }

      if (quote.terms) {
        this.doc.setFont("helvetica", "bold");
        this.doc.text("Terms & Conditions:", this.margin, this.currentY);
        this.doc.setFont("helvetica", "normal");
        this.currentY += 5;

        const splitText = this.doc.splitTextToSize(quote.terms, this.pageWidth - 2 * this.margin);
        this.doc.text(splitText, this.margin, this.currentY);
        this.currentY += splitText.length * 5 + 5;
      }
    }
  }

  /**
   * Add acceptance section
   */
  private addAcceptanceSection(): void {
    // Check if we need a new page
    if (this.currentY > this.pageHeight - 80) {
      this.doc.addPage();
      this.currentY = 20;
    }

    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Acceptance", this.margin, this.currentY);
    this.currentY += 10;

    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(
      "By signing below, you agree to the terms and pricing outlined in this quote.",
      this.margin,
      this.currentY,
    );
    this.currentY += 15;

    // Signature line
    this.doc.setDrawColor(0, 0, 0);
    const signatureLineWidth = 80;
    this.doc.line(this.margin, this.currentY, this.margin + signatureLineWidth, this.currentY);
    this.currentY += 5;

    this.doc.setFontSize(8);
    this.doc.text("Customer Signature", this.margin, this.currentY);

    // Date line
    const dateX = this.pageWidth / 2;
    this.doc.line(dateX, this.currentY - 5, dateX + 50, this.currentY - 5);
    this.doc.text("Date", dateX, this.currentY);

    this.currentY += 10;
  }

  /**
   * Add footer with page numbers
   */
  private addFooter(): void {
    const pageCount = (this.doc as any).internal.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "normal");
      this.doc.setTextColor(128, 128, 128);

      const footerText = `Page ${i} of ${pageCount}`;
      const footerY = this.pageHeight - 10;

      this.doc.text(footerText, this.pageWidth / 2, footerY, {
        align: "center",
      });

      this.doc.text(
        "This quote is valid for the period specified above.",
        this.pageWidth / 2,
        footerY - 5,
        { align: "center" },
      );
    }
  }
}

/**
 * Quick helper function to generate and download quote PDF
 */
export async function generateAndDownloadQuotePDF(
  quote: QuoteData,
  companyInfo: CompanyInfo,
): Promise<void> {
  const generator = new QuotePDFGenerator();
  await generator.downloadQuotePDF({
    company: companyInfo,
    quote,
  });
}
