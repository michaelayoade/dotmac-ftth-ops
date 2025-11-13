/**
 * Invoice PDF Generation Utility
 * Generates professional PDF invoices using jsPDF
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { type Invoice } from "@/types/billing";
import { formatCurrency } from "@/lib/utils";

interface CompanyInfo {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string; // Base64 encoded image or URL
}

export interface InvoicePDFOptions {
  company: CompanyInfo;
  invoice: Invoice;
  customerName?: string;
  customerAddress?: string;
  customerPhone?: string;
}

export class InvoicePDFGenerator {
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
   * Generate invoice PDF and return as blob
   */
  async generateInvoicePDF(options: InvoicePDFOptions): Promise<Blob> {
    const { company, invoice, customerName, customerAddress, customerPhone } = options;

    // Header with company logo and info
    await this.addHeader(company);

    // Invoice title
    this.addInvoiceTitle(invoice);

    // Company and customer info side by side
    const customerInfo: { name: string; address?: string; phone?: string; email?: string } = {
      name: customerName || `Customer ${invoice.customer_id}`,
    };
    if (customerAddress) customerInfo.address = customerAddress;
    if (customerPhone) customerInfo.phone = customerPhone;
    if (invoice.billing_email) customerInfo.email = invoice.billing_email;

    this.addCompanyAndCustomerInfo(company, customerInfo);

    // Invoice details (dates, numbers, etc.)
    this.addInvoiceDetails(invoice);

    // Line items table
    this.addLineItemsTable(invoice);

    // Totals section
    this.addTotalsSection(invoice);

    // Payment terms and notes
    this.addFooterInfo(invoice);

    // Footer with page numbers
    this.addFooter();

    // Return as blob
    return this.doc.output("blob");
  }

  /**
   * Download invoice PDF
   */
  async downloadInvoicePDF(options: InvoicePDFOptions): Promise<void> {
    await this.generateInvoicePDF(options);
    this.doc.save(`invoice-${options.invoice.invoice_number}.pdf`);
  }

  /**
   * Add header with company logo and info
   */
  private async addHeader(company: CompanyInfo): Promise<void> {
    // Add logo if available
    if (company.logo) {
      try {
        // For base64 images or URLs
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
   * Add invoice title
   */
  private addInvoiceTitle(invoice: Invoice): void {
    this.doc.setFontSize(24);
    this.doc.setFont("helvetica", "bold");

    const statusColors: Record<string, [number, number, number]> = {
      draft: [128, 128, 128],
      finalized: [59, 130, 246],
      paid: [34, 197, 94],
      void: [239, 68, 68],
      uncollectible: [251, 191, 36],
    };

    const color = statusColors[invoice.status] || [0, 0, 0];
    this.doc.setTextColor(color[0], color[1], color[2]);

    this.doc.text("INVOICE", this.margin, this.currentY);

    // Status badge
    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(invoice.status.toUpperCase(), this.margin + 50, this.currentY);

    this.doc.setTextColor(0, 0, 0);
    this.currentY += 15;
  }

  /**
   * Add company and customer info side by side
   */
  private addCompanyAndCustomerInfo(
    company: CompanyInfo,
    customer: {
      name: string;
      address?: string;
      phone?: string;
      email?: string;
    },
  ): void {
    const leftX = this.margin;
    const rightX = this.pageWidth / 2 + 10;

    // Bill To section
    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Bill To:", leftX, this.currentY);

    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    let leftY = this.currentY + 7;

    this.doc.text(customer.name, leftX, leftY);
    leftY += 5;

    if (customer.address) {
      this.doc.text(customer.address, leftX, leftY);
      leftY += 5;
    }

    if (customer.phone) {
      this.doc.text(`Phone: ${customer.phone}`, leftX, leftY);
      leftY += 5;
    }

    if (customer.email) {
      this.doc.text(`Email: ${customer.email}`, leftX, leftY);
    }

    this.currentY += 35;
  }

  /**
   * Add invoice details box
   */
  private addInvoiceDetails(invoice: Invoice): void {
    const startY = this.currentY;

    // Draw box
    this.doc.setDrawColor(200, 200, 200);
    this.doc.setFillColor(249, 250, 251);
    this.doc.rect(this.margin, startY, this.pageWidth - 2 * this.margin, 30, "FD");

    // Add details
    this.doc.setFontSize(10);
    const detailsY = startY + 8;
    const col1X = this.margin + 5;
    const col2X = this.pageWidth / 2;

    this.doc.setFont("helvetica", "bold");
    this.doc.text("Invoice Number:", col1X, detailsY);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(invoice.invoice_number, col1X + 40, detailsY);

    this.doc.setFont("helvetica", "bold");
    this.doc.text("Invoice Date:", col2X, detailsY);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(new Date(invoice.created_at).toLocaleDateString(), col2X + 35, detailsY);

    this.doc.setFont("helvetica", "bold");
    this.doc.text("Due Date:", col1X, detailsY + 10);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(new Date(invoice.due_date).toLocaleDateString(), col1X + 40, detailsY + 10);

    if (invoice.paid_date) {
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Paid Date:", col2X, detailsY + 10);
      this.doc.setFont("helvetica", "normal");
      this.doc.setTextColor(34, 197, 94);
      this.doc.text(new Date(invoice.paid_date).toLocaleDateString(), col2X + 35, detailsY + 10);
      this.doc.setTextColor(0, 0, 0);
    }

    this.currentY += 40;
  }

  /**
   * Add line items table
   */
  private addLineItemsTable(invoice: Invoice): void {
    const tableData = invoice.line_items.map((item) => [
      item.description,
      item.quantity.toString(),
      formatCurrency(item.unit_price),
      formatCurrency(item.total_price || item.quantity * item.unit_price),
    ]);

    autoTable(this.doc, {
      startY: this.currentY,
      head: [["Description", "Quantity", "Unit Price", "Total"]],
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
        1: { halign: "center", cellWidth: 30 },
        2: { halign: "right", cellWidth: 35 },
        3: { halign: "right", cellWidth: 35 },
      },
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
  }

  /**
   * Add totals section
   */
  private addTotalsSection(invoice: Invoice): void {
    const rightX = this.pageWidth - this.margin;
    const labelX = rightX - 60;
    const valueX = rightX;

    this.doc.setFontSize(10);

    // Subtotal
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Subtotal:", labelX, this.currentY, { align: "right" });
    this.doc.text(formatCurrency(invoice.subtotal), valueX, this.currentY, {
      align: "right",
    });
    this.currentY += 7;

    // Discount (if any)
    if (invoice.discount_amount > 0) {
      this.doc.setTextColor(34, 197, 94);
      this.doc.text("Discount:", labelX, this.currentY, { align: "right" });
      this.doc.text(`-${formatCurrency(invoice.discount_amount)}`, valueX, this.currentY, {
        align: "right",
      });
      this.doc.setTextColor(0, 0, 0);
      this.currentY += 7;
    }

    // Tax (if any)
    if (invoice.tax_amount > 0) {
      this.doc.text("Tax:", labelX, this.currentY, { align: "right" });
      this.doc.text(formatCurrency(invoice.tax_amount), valueX, this.currentY, {
        align: "right",
      });
      this.currentY += 7;
    }

    // Draw line above total
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(labelX - 5, this.currentY, valueX, this.currentY);
    this.currentY += 7;

    // Total
    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Total:", labelX, this.currentY, { align: "right" });
    this.doc.text(formatCurrency(invoice.total_amount), valueX, this.currentY, {
      align: "right",
    });
    this.currentY += 10;

    // Amount Paid (if any)
    if (invoice.amount_paid > 0) {
      this.doc.setFontSize(10);
      this.doc.setFont("helvetica", "normal");
      this.doc.setTextColor(34, 197, 94);
      this.doc.text("Amount Paid:", labelX, this.currentY, { align: "right" });
      this.doc.text(`-${formatCurrency(invoice.amount_paid)}`, valueX, this.currentY, {
        align: "right",
      });
      this.doc.setTextColor(0, 0, 0);
      this.currentY += 7;

      // Draw line above amount due
      this.doc.setDrawColor(200, 200, 200);
      this.doc.line(labelX - 5, this.currentY, valueX, this.currentY);
      this.currentY += 7;

      // Amount Due
      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Amount Due:", labelX, this.currentY, { align: "right" });

      if (invoice.amount_due > 0) {
        this.doc.setTextColor(239, 68, 68);
      } else {
        this.doc.setTextColor(34, 197, 94);
      }

      this.doc.text(formatCurrency(invoice.amount_due), valueX, this.currentY, {
        align: "right",
      });
      this.doc.setTextColor(0, 0, 0);
      this.currentY += 15;
    } else {
      this.currentY += 10;
    }
  }

  /**
   * Add footer info (payment terms, notes)
   */
  private addFooterInfo(invoice: Invoice): void {
    if (invoice.payment_terms || invoice.notes || invoice.terms) {
      this.doc.setFontSize(9);
      this.doc.setFont("helvetica", "normal");

      if (invoice.payment_terms) {
        this.doc.setFont("helvetica", "bold");
        this.doc.text("Payment Terms:", this.margin, this.currentY);
        this.doc.setFont("helvetica", "normal");
        this.currentY += 5;

        const splitText = this.doc.splitTextToSize(
          invoice.payment_terms,
          this.pageWidth - 2 * this.margin,
        );
        this.doc.text(splitText, this.margin, this.currentY);
        this.currentY += splitText.length * 5 + 5;
      }

      if (invoice.notes) {
        this.doc.setFont("helvetica", "bold");
        this.doc.text("Notes:", this.margin, this.currentY);
        this.doc.setFont("helvetica", "normal");
        this.currentY += 5;

        const splitText = this.doc.splitTextToSize(invoice.notes, this.pageWidth - 2 * this.margin);
        this.doc.text(splitText, this.margin, this.currentY);
        this.currentY += splitText.length * 5 + 5;
      }

      if (invoice.terms) {
        this.doc.setFont("helvetica", "bold");
        this.doc.text("Terms & Conditions:", this.margin, this.currentY);
        this.doc.setFont("helvetica", "normal");
        this.currentY += 5;

        const splitText = this.doc.splitTextToSize(invoice.terms, this.pageWidth - 2 * this.margin);
        this.doc.text(splitText, this.margin, this.currentY);
        this.currentY += splitText.length * 5;
      }
    }
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

      this.doc.text("Thank you for your business!", this.pageWidth / 2, footerY - 5, {
        align: "center",
      });
    }
  }
}

/**
 * Quick helper function to generate and download invoice PDF
 */
export async function generateAndDownloadInvoicePDF(
  invoice: Invoice,
  companyInfo: CompanyInfo,
  customerInfo?: {
    name?: string;
    address?: string;
    phone?: string;
  },
): Promise<void> {
  const generator = new InvoicePDFGenerator();
  const options: InvoicePDFOptions = {
    company: companyInfo,
    invoice,
  };
  if (customerInfo?.name) options.customerName = customerInfo.name;
  if (customerInfo?.address) options.customerAddress = customerInfo.address;
  if (customerInfo?.phone) options.customerPhone = customerInfo.phone;

  await generator.downloadInvoicePDF(options);
}
