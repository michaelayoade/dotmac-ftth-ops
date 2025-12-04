"""
Receipt generators for different formats
"""

import logging
from abc import ABC, abstractmethod
from typing import Any

from dotmac.platform.billing.receipts.models import Receipt

logger = logging.getLogger(__name__)


class ReceiptGenerator(ABC):
    """Base class for receipt generators"""

    @abstractmethod
    async def generate(self, receipt: Receipt) -> Any:
        """Generate receipt in specific format"""
        pass


class HTMLReceiptGenerator(ReceiptGenerator):
    """Generate HTML receipts"""

    async def generate_html(self, receipt: Receipt) -> str:
        """Generate HTML receipt"""

        # Build line items HTML
        line_items_html = ""
        for item in receipt.line_items:
            line_items_html += f"""
            <tr>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>${item.unit_price / 100:.2f}</td>
                <td>${item.total_price / 100:.2f}</td>
            </tr>
            """

        # Format addresses
        billing_address_html = ""
        if receipt.billing_address:
            for key, value in receipt.billing_address.items():
                billing_address_html += f"<div>{key.title()}: {value}</div>"

        # Generate full HTML
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Receipt {receipt.receipt_number}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; }}
        .header {{ text-align: center; margin-bottom: 40px; }}
        .receipt-number {{ font-size: 24px; font-weight: bold; }}
        .info-section {{ margin-bottom: 30px; }}
        .info-title {{ font-weight: bold; margin-bottom: 10px; }}
        table {{ width: 100%; border-collapse: collapse; margin-bottom: 30px; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background-color: #f5f5f5; }}
        .total-row {{ font-weight: bold; background-color: #f9f9f9; }}
        .payment-info {{ background-color: #e8f5e8; padding: 15px; border-radius: 5px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Receipt</h1>
        <div class="receipt-number">{receipt.receipt_number}</div>
        <div>Date: {receipt.issue_date.strftime("%B %d, %Y")}</div>
    </div>

    <div class="info-section">
        <div class="info-title">Customer Information</div>
        <div><strong>Name:</strong> {receipt.customer_name}</div>
        <div><strong>Email:</strong> {receipt.customer_email}</div>
        {billing_address_html}
    </div>

    {f'<div class="info-section"><div class="info-title">Payment Information</div><div><strong>Payment ID:</strong> {receipt.payment_id}</div></div>' if receipt.payment_id else ""}

    {f'<div class="info-section"><div class="info-title">Invoice Information</div><div><strong>Invoice ID:</strong> {receipt.invoice_id}</div></div>' if receipt.invoice_id else ""}

    <table>
        <thead>
            <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            {line_items_html}
        </tbody>
    </table>

    <table>
        <tr>
            <td><strong>Subtotal:</strong></td>
            <td><strong>${receipt.subtotal / 100:.2f}</strong></td>
        </tr>
        <tr>
            <td><strong>Tax:</strong></td>
            <td><strong>${receipt.tax_amount / 100:.2f}</strong></td>
        </tr>
        <tr class="total-row">
            <td><strong>Total:</strong></td>
            <td><strong>${receipt.total_amount / 100:.2f} {receipt.currency}</strong></td>
        </tr>
    </table>

    <div class="payment-info">
        <div><strong>Payment Method:</strong> {receipt.payment_method.replace("_", " ").title()}</div>
        <div><strong>Payment Status:</strong> {receipt.payment_status.replace("_", " ").title()}</div>
    </div>

    {f'<div class="info-section"><div class="info-title">Notes</div><div>{receipt.notes}</div></div>' if receipt.notes else ""}

    <div style="margin-top: 40px; text-align: center; color: #666; font-size: 12px;">
        <div>Thank you for your business!</div>
        <div>This is an automatically generated receipt.</div>
    </div>
</body>
</html>
        """

        return html_content.strip()

    async def generate(self, receipt: Receipt) -> str:
        return await self.generate_html(receipt)


class PDFReceiptGenerator(ReceiptGenerator):
    """Generate PDF receipts"""

    async def generate_pdf(self, receipt: Receipt) -> bytes:
        """Generate PDF receipt"""

        # In a real implementation, this would use a PDF library like:
        # - reportlab
        # - weasyprint
        # - wkhtmltopdf
        # - puppeteer/playwright

        # For now, we'll create a simple text-based PDF placeholder
        pdf_content = self._generate_simple_pdf_content(receipt)

        # Convert to bytes (in real implementation this would be actual PDF bytes)
        return pdf_content.encode("utf-8")

    def _generate_simple_pdf_content(self, receipt: Receipt) -> str:
        """Generate simple text content (placeholder for real PDF)"""

        content = f"""
RECEIPT
{receipt.receipt_number}
Date: {receipt.issue_date.strftime("%B %d, %Y")}

CUSTOMER INFORMATION
Name: {receipt.customer_name}
Email: {receipt.customer_email}

"""

        if receipt.billing_address:
            content += "BILLING ADDRESS\n"
            for key, value in receipt.billing_address.items():
                content += f"{key.title()}: {value}\n"
            content += "\n"

        content += "LINE ITEMS\n"
        content += "Description                 Qty    Unit Price    Total\n"
        content += "-" * 60 + "\n"

        for item in receipt.line_items:
            content += f"{item.description[:25]:<25} {item.quantity:>3} "
            content += f"{item.unit_price / 100:>10.2f} {item.total_price / 100:>10.2f}\n"

        content += "-" * 60 + "\n"
        content += f"Subtotal: ${receipt.subtotal / 100:.2f}\n"
        content += f"Tax:      ${receipt.tax_amount / 100:.2f}\n"
        content += f"Total:    ${receipt.total_amount / 100:.2f} {receipt.currency}\n"
        content += "\n"

        content += f"Payment Method: {receipt.payment_method.replace('_', ' ').title()}\n"
        content += f"Payment Status: {receipt.payment_status.replace('_', ' ').title()}\n"

        if receipt.notes:
            content += f"\nNotes: {receipt.notes}\n"

        content += "\nThank you for your business!\n"

        return content

    async def generate(self, receipt: Receipt) -> bytes:
        return await self.generate_pdf(receipt)


class TextReceiptGenerator(ReceiptGenerator):
    """Generate plain text receipts"""

    async def generate_text(self, receipt: Receipt) -> str:
        """Generate plain text receipt"""

        content = f"Receipt: {receipt.receipt_number}\n"
        content += f"Date: {receipt.issue_date.strftime('%Y-%m-%d %H:%M:%S')}\n"
        content += f"Customer: {receipt.customer_name} ({receipt.customer_email})\n"
        content += f"Total: ${receipt.total_amount / 100:.2f} {receipt.currency}\n"
        content += f"Payment: {receipt.payment_method} - {receipt.payment_status}\n"

        if receipt.payment_id:
            content += f"Payment ID: {receipt.payment_id}\n"

        if receipt.invoice_id:
            content += f"Invoice ID: {receipt.invoice_id}\n"

        return content

    async def generate(self, receipt: Receipt) -> str:
        return await self.generate_text(receipt)
