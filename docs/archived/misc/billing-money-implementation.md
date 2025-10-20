# Money-Based Billing Implementation

## Overview

The DotMac Platform Services billing module uses open-source libraries for accurate currency handling and PDF generation.

## Key Components

### 1. Currency Handling (py-moneyed)

**Files:**
- `money_models.py` - Pydantic models with Money fields
- `money_utils.py` - Currency utilities and Money handler
- `money_migration.py` - Legacy to Money migration

**Features:**
- Eliminates floating-point precision errors
- Multi-currency support with locale-aware formatting
- CLDR currency data for all ISO 4217 currencies
- Automatic rounding to currency precision

### 2. PDF Generation (ReportLab)

**Files:**
- `pdf_generator_reportlab.py` - PDF invoice generator

**Features:**
- Pure Python (no system dependencies)
- Works entirely within venv/poetry
- Clean invoice layout
- Batch PDF generation support

### 3. Integration

**Files:**
- `invoicing/money_service.py` - Money-aware invoice service
- `invoicing/money_router.py` - API endpoints with PDF generation

**Endpoints:**
- `POST /billing/money/invoices` - Create Money invoice
- `GET /billing/money/invoices/{id}` - Get Money invoice
- `POST /billing/money/invoices/{id}/pdf` - Generate PDF
- `GET /billing/money/invoices/{id}/pdf/preview` - Preview PDF
- `POST /billing/money/invoices/batch/pdf` - Batch PDFs

## Usage Examples

### Creating a Money Invoice

```python
from dotmac.platform.billing import MoneyInvoice

invoice = MoneyInvoice.create_invoice(
    tenant_id="tenant-123",
    customer_id="cust-001",
    billing_email="customer@example.com",
    line_items=[{
        'description': 'Consulting Services',
        'quantity': 10,
        'unit_price': '150.00',  # Decimal string
        'tax_rate': 0.10,        # 10% tax
        'discount_percentage': 0.20  # 20% discount
    }],
    currency="USD",
    invoice_number="INV-2024-001"
)

# Accurate calculations: (1500 - 300 discount) * 1.10 tax = 1320.00
print(invoice.total_amount.format('en_US'))  # $1,320.00
```

### Generating PDF Invoice

```python
from dotmac.platform.billing import ReportLabInvoiceGenerator

generator = ReportLabInvoiceGenerator()

pdf_bytes = generator.generate_invoice_pdf(
    invoice=invoice,
    company_info={
        "name": "Your Company",
        "address": {...},
        "tax_id": "12-3456789"
    },
    locale="en_US"
)
```

### Migrating Legacy Invoices

```python
from dotmac.platform.billing import InvoiceMigrationAdapter

adapter = InvoiceMigrationAdapter()

# Convert legacy (cents) to Money
money_invoice = adapter.legacy_to_money_invoice(legacy_invoice)

# Convert Money back to legacy (for compatibility)
legacy_invoice = adapter.money_to_legacy_invoice(money_invoice)
```

## Benefits

1. **Accuracy**: No more `$10.6475625` precision errors
2. **Simplicity**: Decimal strings instead of cents calculations
3. **Compatibility**: Full backward compatibility with existing system
4. **Pure Python**: No system dependencies
5. **Clean Output**: Well-formatted PDF invoices

## Migration Path

1. Use `MoneyInvoiceService` for new invoices
2. Migrate existing invoices with `BatchMigrationService`
3. Legacy endpoints continue to work unchanged
4. Gradual transition as needed

## Dependencies

```toml
py-moneyed = "^3.0"    # Currency handling
babel = "^2.17.0"      # Locale formatting
reportlab = "^4.4.4"   # PDF generation
```

All dependencies are pure Python and work within venv/poetry environment.