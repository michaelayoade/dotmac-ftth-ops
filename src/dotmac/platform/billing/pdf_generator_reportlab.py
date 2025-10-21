"""
PDF Invoice Generator using ReportLab (Pure Python, no system dependencies).

Provides PDF invoice generation with customizable layouts,
locale-aware formatting, and support for multiple currencies.
"""

import io
import os
from datetime import datetime
from typing import Any, cast

import structlog
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.flowables import HRFlowable

from .money_models import MoneyField, MoneyInvoice

logger = structlog.get_logger(__name__)

# Default settings
DEFAULT_LOCALE = "en_US"
DEFAULT_PAGE_SIZE = A4
DEFAULT_MARGINS = (20 * mm, 20 * mm, 20 * mm, 20 * mm)  # left, top, right, bottom

# Color scheme
PRIMARY_COLOR = colors.HexColor("#2563eb")
SECONDARY_COLOR = colors.HexColor("#6b7280")
SUCCESS_COLOR = colors.HexColor("#065f46")
WARNING_COLOR = colors.HexColor("#d97706")
DANGER_COLOR = colors.HexColor("#dc2626")
LIGHT_GRAY = colors.HexColor("#f3f4f6")
DARK_GRAY = colors.HexColor("#333333")


class ReportLabInvoiceGenerator:
    """Generate PDF invoices using ReportLab (pure Python)."""

    def __init__(
        self,
        page_size: tuple[float, float] = DEFAULT_PAGE_SIZE,
        margins: tuple[float, float, float, float] = DEFAULT_MARGINS,
        logo_path: str | None = None,
    ) -> None:
        """
        Initialize PDF generator with layout configuration.

        Args:
            page_size: Page size (A4, letter, etc.)
            margins: Page margins (left, top, right, bottom)
            logo_path: Optional path to company logo
        """
        self.page_size = page_size
        self.margins = margins
        self.logo_path = logo_path
        self.styles = self._create_styles()

    def _create_styles(self) -> dict[str, Any]:
        """Create custom paragraph styles."""
        styles = getSampleStyleSheet()

        # Custom styles
        custom_styles = {
            "CompanyName": ParagraphStyle(
                "CompanyName",
                parent=styles["Heading1"],
                fontSize=24,
                textColor=PRIMARY_COLOR,
                spaceAfter=6,
                leading=30,
            ),
            "InvoiceTitle": ParagraphStyle(
                "InvoiceTitle",
                parent=styles["Heading1"],
                fontSize=28,
                textColor=DARK_GRAY,
                alignment=2,  # RIGHT
                spaceAfter=12,
            ),
            "SectionTitle": ParagraphStyle(
                "SectionTitle",
                parent=styles["Heading2"],
                fontSize=11,
                textColor=SECONDARY_COLOR,
                spaceAfter=6,
                spaceBefore=12,
                fontName="Helvetica-Bold",
            ),
            "Normal": ParagraphStyle(
                "Normal",
                parent=styles["Normal"],
                fontSize=10,
                textColor=DARK_GRAY,
                leading=14,
            ),
            "BoldText": ParagraphStyle(
                "BoldText",
                parent=styles["Normal"],
                fontSize=11,
                textColor=DARK_GRAY,
                fontName="Helvetica-Bold",
            ),
            "SmallText": ParagraphStyle(
                "SmallText",
                parent=styles["Normal"],
                fontSize=9,
                textColor=SECONDARY_COLOR,
            ),
            "FooterText": ParagraphStyle(
                "FooterText",
                parent=styles["Normal"],
                fontSize=9,
                textColor=SECONDARY_COLOR,
                alignment=1,  # CENTER
                spaceBefore=20,
            ),
        }

        return custom_styles

    def generate_invoice_pdf(
        self,
        invoice: MoneyInvoice,
        company_info: dict[str, Any] | None = None,
        customer_info: dict[str, Any] | None = None,
        payment_instructions: str | None = None,
        locale: str = DEFAULT_LOCALE,
        output_path: str | None = None,
    ) -> bytes:
        """
        Generate PDF invoice from MoneyInvoice model.

        Args:
            invoice: MoneyInvoice instance with line items
            company_info: Company details
            customer_info: Customer details
            payment_instructions: Payment instructions text
            locale: Locale for currency formatting
            output_path: Optional path to save PDF file

        Returns:
            PDF bytes
        """
        # Create buffer
        buffer = io.BytesIO()

        # Create document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=self.page_size,
            leftMargin=self.margins[0],
            topMargin=self.margins[1],
            rightMargin=self.margins[2],
            bottomMargin=self.margins[3],
            title=f"Invoice {invoice.invoice_number}",
            author=company_info.get("name", "Company") if company_info else "Company",
        )

        # Build story (document content)
        story = []

        # Add header
        story.extend(self._create_header(invoice, company_info))

        # Add billing details
        story.extend(self._create_billing_section(invoice, customer_info))

        # Add invoice dates
        story.extend(self._create_dates_section(invoice))

        # Add line items table
        story.extend(self._create_line_items_table(invoice, locale))

        # Add totals
        story.extend(self._create_totals_section(invoice, locale))

        # Add payment instructions if provided
        if payment_instructions:
            story.extend(self._create_payment_instructions(payment_instructions))

        # Add notes if present
        if invoice.notes:
            story.extend(self._create_notes_section(invoice.notes))

        # Add footer
        story.extend(self._create_footer(company_info))

        # Build PDF
        doc.build(story)

        # Get PDF bytes
        pdf_bytes = buffer.getvalue()
        buffer.close()

        # Save to file if path provided
        if output_path:
            with open(output_path, "wb") as f:
                f.write(pdf_bytes)
            logger.info("Invoice PDF saved", path=output_path)

        return pdf_bytes

    def _create_header(
        self, invoice: MoneyInvoice, company_info: dict[str, Any] | None
    ) -> list[Any]:
        """Create invoice header with company info and invoice title."""
        story = []

        if not company_info:
            company_info = self._default_company_info()

        # Create header table with two columns
        header_data = []

        # Left column - Company info
        company_text = f"<b>{company_info['name']}</b><br/>"
        if addr := company_info.get("address"):
            company_text += f"{addr.get('street', '')}<br/>"
            company_text += f"{addr.get('city', '')}, {addr.get('state', '')} {addr.get('postal_code', '')}<br/>"
            company_text += f"{addr.get('country', '')}<br/>"
        if email := company_info.get("email"):
            company_text += f"Email: {email}<br/>"
        if phone := company_info.get("phone"):
            company_text += f"Phone: {phone}<br/>"
        if tax_id := company_info.get("tax_id"):
            company_text += f"Tax ID: {tax_id}"

        # Right column - Invoice info
        status_color = self._get_status_color(invoice.status)
        invoice_text = (
            f"<para align='right'><b>INVOICE</b><br/>"
            f"#{invoice.invoice_number}<br/>"
            f"<font color='{status_color}'><b>{invoice.status.upper()}</b></font></para>"
        )

        header_data = [
            [
                Paragraph(company_text, self.styles["Normal"]),
                Paragraph(invoice_text, self.styles["Normal"]),
            ]
        ]

        header_table = Table(header_data, colWidths=[None, None])
        header_table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("ALIGN", (0, 0), (0, 0), "LEFT"),
                    ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 20),
                ]
            )
        )

        story.append(header_table)
        story.append(HRFlowable(width="100%", thickness=2, color=PRIMARY_COLOR))
        story.append(Spacer(1, 20))

        return story

    def _create_billing_section(
        self, invoice: MoneyInvoice, customer_info: dict[str, Any] | None
    ) -> list[Any]:
        """Create billing details section."""
        story = []

        # Billing details table
        billing_data = []

        # Bill To
        bill_to_text = "<b>BILL TO</b><br/>"
        if customer_info and customer_info.get("name"):
            bill_to_text += f"<b>{customer_info['name']}</b><br/>"
        bill_to_text += f"{invoice.billing_email}<br/>"
        if addr := invoice.billing_address:
            bill_to_text += f"{addr.get('street', '')}<br/>"
            bill_to_text += f"{addr.get('city', '')}, {addr.get('state', '')} {addr.get('postal_code', '')}<br/>"
            bill_to_text += f"{addr.get('country', '')}"

        # Payment Details
        payment_text = "<b>PAYMENT DETAILS</b><br/>"
        payment_text += f"<b>{invoice.total_amount.format()}</b><br/>"
        payment_text += f"Payment Status: {invoice.payment_status}<br/>"
        payment_text += f"Currency: {invoice.currency}"

        billing_data = [
            [
                Paragraph(bill_to_text, self.styles["Normal"]),
                Paragraph(payment_text, self.styles["Normal"]),
            ]
        ]

        billing_table = Table(billing_data, colWidths=[None, None])
        billing_table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 20),
                ]
            )
        )

        story.append(billing_table)

        return story

    def _create_dates_section(self, invoice: MoneyInvoice) -> list[Any]:
        """Create invoice dates section."""
        story = []

        dates_data = [
            [
                "Issue Date",
                "Due Date",
            ],
            [
                invoice.issue_date.strftime("%B %d, %Y"),
                invoice.due_date.strftime("%B %d, %Y") if invoice.due_date else "Upon Receipt",
            ],
        ]

        if invoice.paid_at:
            dates_data[0].append("Paid Date")
            dates_data[1].append(invoice.paid_at.strftime("%B %d, %Y"))

        dates_table = Table(dates_data, colWidths=[None] * len(dates_data[0]))
        dates_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), LIGHT_GRAY),
                    ("TEXTCOLOR", (0, 0), (-1, 0), SECONDARY_COLOR),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 9),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ]
            )
        )

        story.append(dates_table)
        story.append(Spacer(1, 20))

        return story

    def _create_line_items_table(self, invoice: MoneyInvoice, locale: str) -> list[Any]:
        """Create line items table."""
        story = []

        # Table header
        data = [["Description", "Qty", "Unit Price", "Tax", "Amount"]]

        # Add line items
        for item in invoice.line_items:
            data.append(
                [
                    item.description,
                    str(item.quantity),
                    item.unit_price.format(locale),
                    item.tax_amount.format(locale) if item.tax_amount.amount != "0.00" else "—",
                    item.total_price.format(locale),
                ]
            )

        # Create table
        col_widths = [None, 50, 80, 60, 80]  # Adjust column widths

        items_table = Table(data, colWidths=col_widths)
        items_table.setStyle(
            TableStyle(
                [
                    # Header row
                    ("BACKGROUND", (0, 0), (-1, 0), LIGHT_GRAY),
                    ("TEXTCOLOR", (0, 0), (-1, 0), SECONDARY_COLOR),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 9),
                    ("ALIGN", (1, 0), (-1, 0), "RIGHT"),
                    ("ALIGN", (0, 0), (0, 0), "LEFT"),
                    # Data rows
                    ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 1), (-1, -1), 9),
                    ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
                    ("ALIGN", (0, 1), (0, -1), "LEFT"),
                    # Grid
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )

        story.append(items_table)
        story.append(Spacer(1, 30))

        return story

    def _create_totals_section(self, invoice: MoneyInvoice, locale: str) -> list[Any]:
        """Create totals section."""
        story = []

        # Totals data
        totals_data = []

        totals_data.append(["Subtotal:", invoice.subtotal.format(locale)])

        if invoice.discount_amount and invoice.discount_amount.amount != "0.00":
            totals_data.append(["Discount:", f"-{invoice.discount_amount.format(locale)}"])

        if invoice.tax_amount and invoice.tax_amount.amount != "0.00":
            totals_data.append(["Tax:", invoice.tax_amount.format(locale)])

        if invoice.total_credits_applied and invoice.total_credits_applied.amount != "0.00":
            totals_data.append(
                ["Credits Applied:", f"-{invoice.total_credits_applied.format(locale)}"]
            )

        # Add separator row
        totals_data.append(["", ""])

        # Grand total
        net_amount_due_field = cast(MoneyField, invoice.net_amount_due)
        totals_data.append(["TOTAL DUE:", net_amount_due_field.format(locale)])

        # Create table aligned to right
        totals_table = Table(totals_data, colWidths=[100, 100])

        # Style for all rows except grand total
        style = [
            ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
            ("FONTNAME", (0, 0), (-1, -2), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -2), 10),
            # Grand total row
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, -1), (-1, -1), 14),
            ("TEXTCOLOR", (0, -1), (-1, -1), PRIMARY_COLOR),
            ("TOPPADDING", (0, -1), (-1, -1), 10),
            ("LINEABOVE", (0, -1), (-1, -1), 2, PRIMARY_COLOR),
        ]

        totals_table.setStyle(TableStyle(style))

        # Wrap in a table to align to right
        wrapper_data = [[Spacer(1, 1), totals_table]]
        wrapper_table = Table(wrapper_data, colWidths=[None, 200])

        story.append(wrapper_table)
        story.append(Spacer(1, 30))

        return story

    def _create_payment_instructions(self, instructions: str) -> list[Any]:
        """Create payment instructions section."""
        story = []

        story.append(Paragraph("<b>PAYMENT INSTRUCTIONS</b>", self.styles["SectionTitle"]))

        # Create box with instructions
        instructions_data = [[Paragraph(instructions, self.styles["Normal"])]]
        instructions_table = Table(instructions_data)
        instructions_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#eff6ff")),
                    ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#dbeafe")),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ]
            )
        )

        story.append(instructions_table)
        story.append(Spacer(1, 20))

        return story

    def _create_notes_section(self, notes: str) -> list[Any]:
        """Create notes section."""
        story = []

        story.append(Paragraph("<b>NOTES</b>", self.styles["SectionTitle"]))

        # Create box with notes
        notes_data = [[Paragraph(notes, self.styles["Normal"])]]
        notes_table = Table(notes_data)
        notes_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), LIGHT_GRAY),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                    ("LINEBEFORELEFT", (0, 0), (0, -1), 4, PRIMARY_COLOR),
                ]
            )
        )

        story.append(notes_table)
        story.append(Spacer(1, 20))

        return story

    def _create_footer(self, company_info: dict[str, Any] | None) -> list[Any]:
        """Create invoice footer."""
        story = []

        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey))

        footer_text = "Thank you for your business!"
        if company_info and company_info.get("website"):
            footer_text += f"<br/>{company_info['website']}"

        footer_text += f"<br/><font size='8' color='#9ca3af'>This invoice was generated on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</font>"

        story.append(Paragraph(footer_text, self.styles["FooterText"]))

        return story

    def _get_status_color(self, status: str) -> str:
        """Get color for invoice status."""
        status_colors = {
            "draft": SECONDARY_COLOR,
            "pending": WARNING_COLOR,
            "paid": SUCCESS_COLOR,
            "overdue": DANGER_COLOR,
        }
        color = status_colors.get(status.lower(), SECONDARY_COLOR)
        hex_value = getattr(color, "hexval", None)
        if hex_value:
            hex_str = str(hex_value)
            if hex_str.startswith("0x"):
                return f"#{hex_str[2:]}"
        return "#6b7280"

    @staticmethod
    def _default_company_info() -> dict[str, Any]:
        """Provide default company info structure."""
        return {
            "name": "Your Company Name",
            "address": {
                "street": "123 Business St",
                "city": "City",
                "state": "State",
                "postal_code": "12345",
                "country": "Country",
            },
            "email": "billing@company.com",
            "phone": "+1 (555) 123-4567",
            "website": "www.company.com",
            "tax_id": "XX-XXXXXXX",
        }

    def generate_batch_invoices(
        self,
        invoices: list[MoneyInvoice],
        output_dir: str,
        company_info: dict[str, Any] | None = None,
        locale: str = DEFAULT_LOCALE,
    ) -> list[str]:
        """Generate multiple invoice PDFs in batch."""
        output_paths = []
        os.makedirs(output_dir, exist_ok=True)

        for invoice in invoices:
            filename = f"invoice_{invoice.invoice_number}_{invoice.customer_id}.pdf"
            output_path = os.path.join(output_dir, filename)

            self.generate_invoice_pdf(
                invoice=invoice,
                company_info=company_info,
                locale=locale,
                output_path=output_path,
            )
            output_paths.append(output_path)

        logger.info("Batch invoices generated", count=len(invoices), directory=output_dir)
        return output_paths


# Default generator instance
default_reportlab_generator = ReportLabInvoiceGenerator()


# Convenience function
def generate_invoice_pdf_reportlab(
    invoice: MoneyInvoice,
    company_info: dict[str, Any] | None = None,
    customer_info: dict[str, Any] | None = None,
    output_path: str | None = None,
    locale: str = DEFAULT_LOCALE,
) -> bytes:
    """Generate invoice PDF using ReportLab (no system dependencies)."""
    return default_reportlab_generator.generate_invoice_pdf(
        invoice=invoice,
        company_info=company_info,
        customer_info=customer_info,
        locale=locale,
        output_path=output_path,
    )


# Export key classes and functions
__all__ = [
    "ReportLabInvoiceGenerator",
    "default_reportlab_generator",
    "generate_invoice_pdf_reportlab",
]
