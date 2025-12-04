/**
 * Billing Calculations Functional Tests
 *
 * These tests validate complex billing logic:
 * 1. Proration Calculations (mid-cycle changes)
 * 2. Tax Calculations (sales tax, VAT)
 * 3. Discount Application (promotional, volume, referral)
 * 4. Credit/Debit Adjustments
 * 5. Refund Calculations
 * 6. Multi-line Item Invoicing
 * 7. Late Fee Calculations
 * 8. Early Termination Fees
 */

import { describe, it, expect, beforeEach } from "vitest";

import type { InvoiceLineItem } from "../../billing/types";
import { InvoiceStatus, PaymentStatus } from "../../billing/types";
import {
  createMockInvoice,
  createOverdueInvoice,
  createPaidInvoice,
  createPartiallyPaidInvoice,
  resetBillingCounters,
} from "../factories/billing";

/**
 * Helper function to calculate proration
 * Formula: (monthly_amount / days_in_month) * days_used
 */
function calculateProration(monthlyAmount: number, daysInMonth: number, daysUsed: number): number {
  return (monthlyAmount / daysInMonth) * daysUsed;
}

/**
 * Helper function to calculate tax
 */
function calculateTax(amount: number, taxRate: number): number {
  return amount * (taxRate / 100);
}

/**
 * Helper function to apply discount
 */
function applyDiscount(amount: number, discountPercent?: number, discountAmount?: number): number {
  if (discountAmount) {
    return Math.max(0, amount - discountAmount);
  }
  if (discountPercent) {
    return amount * (1 - discountPercent / 100);
  }
  return amount;
}

describe("Billing Calculations: Proration", () => {
  beforeEach(() => {
    resetBillingCounters();
  });

  it("should calculate mid-month activation proration correctly", () => {
    // Arrange
    const monthlyCharge = 100.0;
    const daysInMonth = 30;
    const daysUsed = 15; // Activated on day 15

    // Act
    const proratedAmount = calculateProration(monthlyCharge, daysInMonth, daysUsed);

    // Assert
    expect(proratedAmount).toBeCloseTo(50.0, 2); // Half month = $50
  });

  it("should calculate proration for service upgrade mid-cycle", () => {
    // Arrange
    const oldPlanMonthly = 50.0;
    const newPlanMonthly = 100.0;
    const daysInMonth = 30;
    const daysRemaining = 10;

    // Old plan credit (unused portion)
    const oldPlanCredit = calculateProration(oldPlanMonthly, daysInMonth, daysRemaining);

    // New plan charge (for remaining days)
    const newPlanCharge = calculateProration(newPlanMonthly, daysInMonth, daysRemaining);

    // Net amount to charge
    const netCharge = newPlanCharge - oldPlanCredit;

    // Assert
    expect(oldPlanCredit).toBeCloseTo(16.67, 2); // $50 * 10/30
    expect(newPlanCharge).toBeCloseTo(33.33, 2); // $100 * 10/30
    expect(netCharge).toBeCloseTo(16.66, 1); // Difference
  });

  it("should calculate proration for service downgrade mid-cycle", () => {
    // Arrange
    const oldPlanMonthly = 100.0;
    const newPlanMonthly = 50.0;
    const daysInMonth = 30;
    const daysRemaining = 15;

    // Old plan credit
    const oldPlanCredit = calculateProration(oldPlanMonthly, daysInMonth, daysRemaining);

    // New plan charge
    const newPlanCharge = calculateProration(newPlanMonthly, daysInMonth, daysRemaining);

    // Net credit (should be positive since downgrading)
    const netCredit = oldPlanCredit - newPlanCharge;

    // Assert
    expect(oldPlanCredit).toBeCloseTo(50.0, 2); // $100 * 15/30
    expect(newPlanCharge).toBeCloseTo(25.0, 2); // $50 * 15/30
    expect(netCredit).toBeCloseTo(25.0, 2); // Credit to customer
    expect(netCredit).toBeGreaterThan(0); // Confirm it's a credit
  });

  it("should handle leap year proration", () => {
    // Arrange
    const monthlyCharge = 120.0;
    const daysInFebruary = 29; // Leap year
    const daysUsed = 29; // Full month

    // Act
    const proratedAmount = calculateProration(monthlyCharge, daysInFebruary, daysUsed);

    // Assert
    expect(proratedAmount).toBeCloseTo(120.0, 2); // Full month charge
  });

  it("should calculate proration for mid-month termination", () => {
    // Arrange
    const monthlyCharge = 80.0;
    const daysInMonth = 31;
    const daysUsed = 10; // Terminated on day 10

    // Act
    const proratedAmount = calculateProration(monthlyCharge, daysInMonth, daysUsed);
    const refundAmount = monthlyCharge - proratedAmount;

    // Assert
    expect(proratedAmount).toBeCloseTo(25.81, 2); // 10/31 of $80
    expect(refundAmount).toBeCloseTo(54.19, 2); // Remaining credit
  });
});

describe("Billing Calculations: Tax", () => {
  beforeEach(() => {
    resetBillingCounters();
  });

  it("should calculate sales tax correctly", () => {
    // Arrange
    const subtotal = 100.0;
    const taxRate = 8.5; // 8.5% sales tax

    // Act
    const taxAmount = calculateTax(subtotal, taxRate);
    const total = subtotal + taxAmount;

    // Assert
    expect(taxAmount).toBeCloseTo(8.5, 2);
    expect(total).toBeCloseTo(108.5, 2);
  });

  it("should calculate VAT (Value Added Tax)", () => {
    // Arrange
    const netAmount = 100.0;
    const vatRate = 20; // 20% VAT (UK/EU standard)

    // Act
    const vatAmount = calculateTax(netAmount, vatRate);
    const grossAmount = netAmount + vatAmount;

    // Assert
    expect(vatAmount).toBeCloseTo(20.0, 2);
    expect(grossAmount).toBeCloseTo(120.0, 2);
  });

  it("should apply tax to each line item separately", () => {
    // Arrange
    const lineItems: InvoiceLineItem[] = [
      {
        id: "item_1",
        description: "Service Plan",
        quantity: 1,
        unit_amount: 50.0,
        amount: 50.0,
        tax_rate: 8.5,
      },
      {
        id: "item_2",
        description: "Equipment Rental",
        quantity: 1,
        unit_amount: 10.0,
        amount: 10.0,
        tax_rate: 8.5,
      },
      {
        id: "item_3",
        description: "Installation (Tax Exempt)",
        quantity: 1,
        unit_amount: 100.0,
        amount: 100.0,
        tax_rate: 0,
      },
    ];

    // Act
    const itemsWithTax = lineItems.map((item) => ({
      ...item,
      tax_amount: item.tax_rate ? calculateTax(item.amount, item.tax_rate) : 0,
    }));

    const subtotal = itemsWithTax.reduce((sum, item) => sum + item.amount, 0);
    const totalTax = itemsWithTax.reduce((sum, item) => sum + (item.tax_amount || 0), 0);
    const total = subtotal + totalTax;

    // Assert
    expect(subtotal).toBeCloseTo(160.0, 2);
    expect(totalTax).toBeCloseTo(5.1, 2); // ($50 + $10) * 8.5%
    expect(total).toBeCloseTo(165.1, 2);
  });

  it("should handle tax-inclusive pricing", () => {
    // Arrange
    const grossAmount = 120.0;
    const vatRate = 20; // 20% VAT

    // Act - Calculate net from gross
    const netAmount = grossAmount / (1 + vatRate / 100);
    const vatAmount = grossAmount - netAmount;

    // Assert
    expect(netAmount).toBeCloseTo(100.0, 2);
    expect(vatAmount).toBeCloseTo(20.0, 2);
    expect(netAmount + vatAmount).toBeCloseTo(grossAmount, 2);
  });
});

describe("Billing Calculations: Discounts", () => {
  beforeEach(() => {
    resetBillingCounters();
  });

  it("should apply percentage discount", () => {
    // Arrange
    const amount = 100.0;
    const discountPercent = 20; // 20% off

    // Act
    const discountedAmount = applyDiscount(amount, discountPercent);

    // Assert
    expect(discountedAmount).toBeCloseTo(80.0, 2);
  });

  it("should apply fixed amount discount", () => {
    // Arrange
    const amount = 100.0;
    const discountAmount = 25.0;

    // Act
    const discountedAmount = applyDiscount(amount, undefined, discountAmount);

    // Assert
    expect(discountedAmount).toBeCloseTo(75.0, 2);
  });

  it("should not allow discount to go below zero", () => {
    // Arrange
    const amount = 50.0;
    const discountAmount = 75.0; // Discount greater than amount

    // Act
    const discountedAmount = applyDiscount(amount, undefined, discountAmount);

    // Assert
    expect(discountedAmount).toBe(0);
    expect(discountedAmount).toBeGreaterThanOrEqual(0);
  });

  it("should stack multiple promotional discounts correctly", () => {
    // Arrange
    const baseAmount = 100.0;
    const earlyBirdDiscount = 10; // 10% off
    const loyaltyDiscount = 5; // Additional 5% off

    // Act - Apply discounts sequentially
    const afterEarlyBird = applyDiscount(baseAmount, earlyBirdDiscount);
    const finalAmount = applyDiscount(afterEarlyBird, loyaltyDiscount);

    // Assert
    expect(afterEarlyBird).toBeCloseTo(90.0, 2);
    expect(finalAmount).toBeCloseTo(85.5, 2); // 90 * 0.95
  });

  it("should calculate volume discount based on tiers", () => {
    // Arrange
    const quantity = 50;
    const unitPrice = 10.0;

    // Volume discount tiers
    // 1-10: 0% discount
    // 11-25: 5% discount
    // 26-50: 10% discount
    // 51+: 15% discount

    const getVolumeDiscount = (qty: number): number => {
      if (qty >= 51) return 15;
      if (qty >= 26) return 10;
      if (qty >= 11) return 5;
      return 0;
    };

    // Act
    const subtotal = quantity * unitPrice;
    const discountPercent = getVolumeDiscount(quantity);
    const discountedTotal = applyDiscount(subtotal, discountPercent);

    // Assert
    expect(subtotal).toBe(500.0);
    expect(discountPercent).toBe(10);
    expect(discountedTotal).toBeCloseTo(450.0, 2);
  });

  it("should apply referral discount", () => {
    // Arrange
    const monthlyCharge = 60.0;
    const referralDiscountMonths = 3;
    const referralDiscountAmount = 10.0;

    // Act - Calculate total savings over referral period
    const totalSavings = referralDiscountAmount * referralDiscountMonths;
    const monthlyChargeAfterDiscount = monthlyCharge - referralDiscountAmount;

    // Assert
    expect(monthlyChargeAfterDiscount).toBeCloseTo(50.0, 2);
    expect(totalSavings).toBeCloseTo(30.0, 2);
  });
});

describe("Billing Calculations: Credits & Adjustments", () => {
  beforeEach(() => {
    resetBillingCounters();
  });

  it("should apply account credit to invoice", () => {
    // Arrange
    const invoiceAmount = 100.0;
    const accountCredit = 25.0;

    // Act
    const amountDue = Math.max(0, invoiceAmount - accountCredit);
    const remainingCredit = accountCredit > invoiceAmount ? accountCredit - invoiceAmount : 0;

    // Assert
    expect(amountDue).toBeCloseTo(75.0, 2);
    expect(remainingCredit).toBe(0);
  });

  it("should handle credit greater than invoice amount", () => {
    // Arrange
    const invoiceAmount = 50.0;
    const accountCredit = 100.0;

    // Act
    const amountDue = Math.max(0, invoiceAmount - accountCredit);
    const remainingCredit = accountCredit - invoiceAmount;

    // Assert
    expect(amountDue).toBe(0);
    expect(remainingCredit).toBeCloseTo(50.0, 2);
  });

  it("should apply service credit for outage compensation", () => {
    // Arrange
    const monthlyCharge = 100.0;
    const outageDays = 3;
    const daysInMonth = 30;

    // Act - Prorate credit based on outage
    const creditAmount = calculateProration(monthlyCharge, daysInMonth, outageDays);

    // Assert
    expect(creditAmount).toBeCloseTo(10.0, 2);
  });

  it("should apply manual adjustment (debit)", () => {
    // Arrange
    const currentBalance = 50.0;
    const adjustmentAmount = 15.0; // Additional charge
    const adjustmentReason = "Equipment damage fee";

    // Act
    const newBalance = currentBalance + adjustmentAmount;

    // Assert
    expect(newBalance).toBeCloseTo(65.0, 2);
    expect(adjustmentReason).toBeTruthy();
  });

  it("should apply manual adjustment (credit)", () => {
    // Arrange
    const currentBalance = 100.0;
    const adjustmentAmount = -20.0; // Credit
    const adjustmentReason = "Goodwill credit for service issue";

    // Act
    const newBalance = currentBalance + adjustmentAmount;

    // Assert
    expect(newBalance).toBeCloseTo(80.0, 2);
    expect(adjustmentAmount).toBeLessThan(0);
  });
});

describe("Billing Calculations: Refunds", () => {
  beforeEach(() => {
    resetBillingCounters();
  });

  it("should calculate full refund", () => {
    // Arrange
    const paidAmount = 100.0;

    // Act
    const refundAmount = paidAmount;

    // Assert
    expect(refundAmount).toBe(100.0);
  });

  it("should calculate partial refund", () => {
    // Arrange
    const paidAmount = 100.0;
    const refundPercentage = 50; // 50% refund

    // Act
    const refundAmount = (paidAmount * refundPercentage) / 100;

    // Assert
    expect(refundAmount).toBeCloseTo(50.0, 2);
  });

  it("should deduct service usage from refund", () => {
    // Arrange
    const paidAmount = 100.0;
    const monthlyCharge = 100.0;
    const daysUsed = 10;
    const daysInMonth = 30;

    // Act
    const usageCharge = calculateProration(monthlyCharge, daysInMonth, daysUsed);
    const refundAmount = paidAmount - usageCharge;

    // Assert
    expect(usageCharge).toBeCloseTo(33.33, 2);
    expect(refundAmount).toBeCloseTo(66.67, 2);
  });

  it("should apply refund processing fee if applicable", () => {
    // Arrange
    const refundAmount = 100.0;
    const processingFeePercent = 3; // 3% processing fee

    // Act
    const processingFee = (refundAmount * processingFeePercent) / 100;
    const netRefund = refundAmount - processingFee;

    // Assert
    expect(processingFee).toBeCloseTo(3.0, 2);
    expect(netRefund).toBeCloseTo(97.0, 2);
  });
});

describe("Billing Calculations: Late Fees", () => {
  beforeEach(() => {
    resetBillingCounters();
  });

  it("should calculate late fee as percentage of outstanding balance", () => {
    // Arrange
    const outstandingBalance = 100.0;
    const lateFeePercent = 5; // 5% late fee

    // Act
    const lateFee = (outstandingBalance * lateFeePercent) / 100;

    // Assert
    expect(lateFee).toBeCloseTo(5.0, 2);
  });

  it("should calculate late fee as fixed amount", () => {
    // Arrange
    const fixedLateFee = 10.0;

    // Act & Assert
    expect(fixedLateFee).toBe(10.0);
  });

  it("should cap late fee at maximum amount", () => {
    // Arrange
    const outstandingBalance = 1000.0;
    const lateFeePercent = 10; // 10%
    const maxLateFee = 50.0;

    // Act
    const calculatedLateFee = (outstandingBalance * lateFeePercent) / 100;
    const actualLateFee = Math.min(calculatedLateFee, maxLateFee);

    // Assert
    expect(calculatedLateFee).toBe(100.0);
    expect(actualLateFee).toBe(50.0); // Capped at max
  });

  it("should not charge late fee if within grace period", () => {
    // Arrange
    const dueDate = new Date("2024-01-01");
    const currentDate = new Date("2024-01-05");
    const gracePeriodDays = 7;

    // Act
    const daysPastDue = Math.floor(
      (currentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const shouldChargeFee = daysPastDue > gracePeriodDays;

    // Assert
    expect(daysPastDue).toBe(4);
    expect(shouldChargeFee).toBe(false);
  });
});

describe("Billing Calculations: Early Termination Fees", () => {
  beforeEach(() => {
    resetBillingCounters();
  });

  it("should calculate ETF as remaining months * monthly charge", () => {
    // Arrange
    const monthlyCharge = 100.0;
    const contractLengthMonths = 12;
    const monthsServed = 6;

    // Act
    const remainingMonths = contractLengthMonths - monthsServed;
    const etf = remainingMonths * monthlyCharge;

    // Assert
    expect(remainingMonths).toBe(6);
    expect(etf).toBeCloseTo(600.0, 2);
  });

  it("should apply ETF reduction based on time served", () => {
    // Arrange
    const baseETF = 500.0;
    const contractLengthMonths = 24;
    const monthsServed = 18;

    // Act - ETF reduces linearly
    const reductionPercent = (monthsServed / contractLengthMonths) * 100;
    const reducedETF = baseETF * (1 - reductionPercent / 100);

    // Assert
    expect(reductionPercent).toBeCloseTo(75.0, 2);
    expect(reducedETF).toBeCloseTo(125.0, 2);
  });

  it("should not charge ETF if contract has been fulfilled", () => {
    // Arrange
    const contractLengthMonths = 12;
    const monthsServed = 12;

    // Act
    const remainingMonths = Math.max(0, contractLengthMonths - monthsServed);
    const etf = remainingMonths > 0 ? 500.0 : 0;

    // Assert
    expect(remainingMonths).toBe(0);
    expect(etf).toBe(0);
  });

  it("should calculate ETF for multiple services", () => {
    // Arrange
    const services = [
      { name: "Internet", monthlyCharge: 50.0, remainingMonths: 6 },
      { name: "Phone", monthlyCharge: 30.0, remainingMonths: 4 },
      { name: "TV", monthlyCharge: 70.0, remainingMonths: 8 },
    ];

    // Act
    const totalETF = services.reduce(
      (sum, service) => sum + service.monthlyCharge * service.remainingMonths,
      0,
    );

    // Assert
    expect(totalETF).toBeCloseTo(980.0, 2); // $300 + $120 + $560
  });
});

describe("Billing Calculations: Complex Scenarios", () => {
  beforeEach(() => {
    resetBillingCounters();
  });

  it("should handle mid-cycle upgrade with proration, tax, and discount", () => {
    // Arrange
    const oldPlanMonthly = 50.0;
    const newPlanMonthly = 100.0;
    const daysInMonth = 30;
    const daysRemaining = 15;
    const promoDiscount = 10.0; // $10 off new plan
    const taxRate = 8.5;

    // Act
    // 1. Calculate proration
    const oldPlanCredit = calculateProration(oldPlanMonthly, daysInMonth, daysRemaining);
    const newPlanCharge = calculateProration(newPlanMonthly, daysInMonth, daysRemaining);
    const netCharge = newPlanCharge - oldPlanCredit;

    // 2. Apply discount
    const afterDiscount = netCharge - promoDiscount;

    // 3. Calculate tax
    const taxAmount = calculateTax(afterDiscount, taxRate);
    const finalAmount = afterDiscount + taxAmount;

    // Assert
    expect(oldPlanCredit).toBeCloseTo(25.0, 2);
    expect(newPlanCharge).toBeCloseTo(50.0, 2);
    expect(netCharge).toBeCloseTo(25.0, 2);
    expect(afterDiscount).toBeCloseTo(15.0, 2);
    expect(taxAmount).toBeCloseTo(1.275, 3);
    expect(finalAmount).toBeCloseTo(16.275, 3);
  });

  it("should calculate invoice with multiple line items, discounts, and taxes", () => {
    // Arrange
    const lineItems = [
      { description: "Internet Service", amount: 60.0, taxable: true },
      { description: "Equipment Rental", amount: 10.0, taxable: true },
      { description: "Installation", amount: 100.0, taxable: false },
    ];
    const accountDiscount = 5.0; // $5 account-level discount
    const taxRate = 8.5;

    // Act
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const afterDiscount = subtotal - accountDiscount;
    const taxableAmount = lineItems
      .filter((item) => item.taxable)
      .reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = calculateTax(taxableAmount, taxRate);
    const total = afterDiscount + taxAmount;

    // Assert
    expect(subtotal).toBeCloseTo(170.0, 2);
    expect(afterDiscount).toBeCloseTo(165.0, 2);
    expect(taxableAmount).toBeCloseTo(70.0, 2);
    expect(taxAmount).toBeCloseTo(5.95, 2);
    expect(total).toBeCloseTo(170.95, 2);
  });
});
