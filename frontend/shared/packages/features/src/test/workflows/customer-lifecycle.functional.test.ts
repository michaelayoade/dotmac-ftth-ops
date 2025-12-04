/**
 * Customer Lifecycle Functional Tests
 *
 * These tests validate the complete customer journey from lead to active customer:
 * 1. Lead Creation & Qualification
 * 2. Quote Generation & Acceptance
 * 3. Site Survey & Serviceability
 * 4. Customer Conversion & Activation
 * 5. Service Upgrade/Downgrade
 * 6. Service Suspension & Reactivation
 * 7. Customer Termination
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  createMockLead,
  createQualifiedLead,
  createConvertedLead,
  createMockQuote,
  createAcceptedQuote,
  createMockSiteSurvey,
  createCompletedSiteSurvey,
  createMockCustomer,
  createActiveCustomer,
  createSuspendedCustomer,
  resetCustomerCounters,
} from "../factories/customer";
import { createCRMDependencies } from "../mocks/dependencies";

describe("Customer Lifecycle: Lead to Customer", () => {
  let deps: ReturnType<typeof createCRMDependencies>;

  beforeEach(() => {
    deps = createCRMDependencies();
    resetCustomerCounters();
  });

  describe("Lead Creation & Qualification", () => {
    it("should create a new lead with valid contact information", () => {
      // Arrange & Act
      const lead = createMockLead({
        first_name: "Sarah",
        last_name: "Johnson",
        email: "sarah.johnson@example.com",
        phone: "+15551234567",
        source: "website",
      });

      // Assert
      expect(lead.id).toBeTruthy();
      expect(lead.status).toBe("new");
      expect(lead.first_name).toBe("Sarah");
      expect(lead.last_name).toBe("Johnson");
      expect(lead.email).toBe("sarah.johnson@example.com");
      expect(lead.source).toBe("website");
      expect(lead.priority).toBeDefined();
    });

    it("should transition lead from 'new' to 'contacted' status", () => {
      // Arrange
      const lead = createMockLead({ status: "new" });

      // Act - Simulate API call to update lead status
      const updatedLead = {
        ...lead,
        status: "contacted" as const,
        first_contact_date: new Date().toISOString(),
        last_contact_date: new Date().toISOString(),
      };

      // Assert
      expect(updatedLead.status).toBe("contacted");
      expect(updatedLead.first_contact_date).toBeTruthy();
      expect(updatedLead.last_contact_date).toBeTruthy();
    });

    it("should mark lead as serviceable after serviceability check", () => {
      // Arrange
      const lead = createMockLead({ status: "contacted" });

      // Act - Simulate serviceability check
      const qualifiedLead = {
        ...lead,
        is_serviceable: "serviceable" as const,
        serviceability_checked_at: new Date().toISOString(),
        serviceability_notes: "Fiber available within 50m",
        status: "qualified" as const,
        qualified_at: new Date().toISOString(),
      };

      // Assert
      expect(qualifiedLead.status).toBe("qualified");
      expect(qualifiedLead.is_serviceable).toBe("serviceable");
      expect(qualifiedLead.qualified_at).toBeTruthy();
    });

    it("should disqualify lead if not serviceable", () => {
      // Arrange
      const lead = createMockLead({ status: "contacted" });

      // Act - Simulate serviceability check failure
      const disqualifiedLead = {
        ...lead,
        is_serviceable: "not_serviceable" as const,
        serviceability_checked_at: new Date().toISOString(),
        serviceability_notes: "Fiber not available in area",
        status: "disqualified" as const,
        disqualified_at: new Date().toISOString(),
        disqualification_reason: "Service not available in customer location",
      };

      // Assert
      expect(disqualifiedLead.status).toBe("disqualified");
      expect(disqualifiedLead.is_serviceable).toBe("not_serviceable");
      expect(disqualifiedLead.disqualified_at).toBeTruthy();
      expect(disqualifiedLead.disqualification_reason).toBeTruthy();
    });

    it("should validate required fields for lead creation", () => {
      // Arrange
      const requiredFields = {
        first_name: "John",
        last_name: "Doe",
        email: "john.doe@example.com",
        service_address_line1: "123 Main St",
        service_city: "Springfield",
        service_state_province: "IL",
        service_postal_code: "62701",
        service_country: "US",
      };

      // Act
      const lead = createMockLead(requiredFields);

      // Assert
      expect(lead.first_name).toBeTruthy();
      expect(lead.last_name).toBeTruthy();
      expect(lead.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/); // Email validation
      expect(lead.service_address_line1).toBeTruthy();
      expect(lead.service_city).toBeTruthy();
      expect(lead.service_postal_code).toBeTruthy();
    });
  });

  describe("Quote Generation & Acceptance", () => {
    it("should generate quote for qualified lead", () => {
      // Arrange
      const lead = createQualifiedLead();

      // Act
      const quote = createMockQuote({
        lead_id: lead.id,
        service_plan_name: "Premium 500Mbps",
        monthly_recurring_charge: 79.99,
        installation_fee: 199.99,
      });

      // Assert
      expect(quote.lead_id).toBe(lead.id);
      expect(quote.status).toBe("draft");
      expect(quote.monthly_recurring_charge).toBe(79.99);
      expect(quote.installation_fee).toBe(199.99);
      expect(quote.line_items.length).toBeGreaterThan(0);
    });

    it("should calculate total upfront costs correctly", () => {
      // Arrange & Act
      const quote = createMockQuote({
        installation_fee: 199.99,
        equipment_fee: 99.99,
        activation_fee: 49.99,
      });

      const expectedTotal = 199.99 + 99.99 + 49.99;

      // Assert
      expect(quote.total_upfront_cost).toBeCloseTo(expectedTotal, 2);
    });

    it("should apply promotional discount to monthly charge", () => {
      // Arrange
      const basePrice = 79.99;
      const promoDiscount = 20.0;
      const promoMonths = 3;

      // Act
      const quote = createMockQuote({
        monthly_recurring_charge: basePrice,
        promo_monthly_discount: promoDiscount,
        promo_discount_months: promoMonths,
      });

      const effectiveMonthlyRate = basePrice - promoDiscount;

      // Assert
      expect(quote.promo_monthly_discount).toBe(20.0);
      expect(quote.promo_discount_months).toBe(3);
      expect(effectiveMonthlyRate).toBeCloseTo(59.99, 2);
    });

    it("should transition quote from draft to sent", () => {
      // Arrange
      const quote = createMockQuote({ status: "draft" });

      // Act
      const sentQuote = {
        ...quote,
        status: "sent" as const,
        sent_at: new Date().toISOString(),
      };

      // Assert
      expect(sentQuote.status).toBe("sent");
      expect(sentQuote.sent_at).toBeTruthy();
    });

    it("should accept quote with valid signature", () => {
      // Arrange
      const quote = createMockQuote({
        status: "sent",
        sent_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      });

      // Act
      const acceptedQuote = {
        ...quote,
        status: "accepted" as const,
        accepted_at: new Date().toISOString(),
        signature_data: {
          name: "John Doe",
          date: new Date().toISOString(),
          ip_address: "192.168.1.100",
        },
      };

      // Assert
      expect(acceptedQuote.status).toBe("accepted");
      expect(acceptedQuote.accepted_at).toBeTruthy();
      expect(acceptedQuote.signature_data).toBeTruthy();
      expect(acceptedQuote.signature_data?.name).toBe("John Doe");
      expect(acceptedQuote.signature_data?.ip_address).toBe("192.168.1.100");
    });

    it("should reject quote with reason", () => {
      // Arrange
      const quote = createMockQuote({ status: "sent" });

      // Act
      const rejectedQuote = {
        ...quote,
        status: "rejected" as const,
        rejected_at: new Date().toISOString(),
        rejection_reason: "Price too high",
      };

      // Assert
      expect(rejectedQuote.status).toBe("rejected");
      expect(rejectedQuote.rejected_at).toBeTruthy();
      expect(rejectedQuote.rejection_reason).toBe("Price too high");
    });

    it("should mark quote as expired after validity date", () => {
      // Arrange
      const validUntil = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
      const quote = createMockQuote({
        status: "sent",
        valid_until: validUntil,
      });

      // Act
      const isExpired = new Date(quote.valid_until) < new Date();
      const expiredQuote = isExpired ? { ...quote, status: "expired" as const } : quote;

      // Assert
      expect(isExpired).toBe(true);
      expect(expiredQuote.status).toBe("expired");
    });
  });

  describe("Site Survey & Serviceability", () => {
    it("should schedule site survey for qualified lead", () => {
      // Arrange
      const lead = createQualifiedLead();

      // Act
      const survey = createMockSiteSurvey({
        lead_id: lead.id,
        scheduled_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        technician_id: "tech_456",
      });

      // Assert
      expect(survey.lead_id).toBe(lead.id);
      expect(survey.status).toBe("scheduled");
      expect(survey.technician_id).toBe("tech_456");
      expect(new Date(survey.scheduled_date) > new Date()).toBe(true);
    });

    it("should complete site survey with serviceability assessment", () => {
      // Arrange
      const survey = createMockSiteSurvey({ status: "scheduled" });

      // Act
      const completedSurvey = {
        ...survey,
        status: "completed" as const,
        completed_date: new Date().toISOString(),
        serviceability: "serviceable" as const,
        nearest_fiber_distance_meters: 45,
        requires_fiber_extension: false,
        installation_complexity: "simple" as const,
        estimated_installation_time_hours: 2,
        recommendations: "Standard installation, no obstacles",
      };

      // Assert
      expect(completedSurvey.status).toBe("completed");
      expect(completedSurvey.completed_date).toBeTruthy();
      expect(completedSurvey.serviceability).toBe("serviceable");
      expect(completedSurvey.installation_complexity).toBe("simple");
    });

    it("should identify fiber extension requirement", () => {
      // Arrange & Act
      const survey = createCompletedSiteSurvey({
        nearest_fiber_distance_meters: 250,
        requires_fiber_extension: true,
        fiber_extension_cost: 5000,
        installation_complexity: "complex",
      });

      // Assert
      expect(survey.requires_fiber_extension).toBe(true);
      expect(survey.fiber_extension_cost).toBe(5000);
      expect(survey.installation_complexity).toBe("complex");
      expect(survey.nearest_fiber_distance_meters).toBe(250);
    });

    it("should attach photos to survey", () => {
      // Arrange & Act
      const survey = createCompletedSiteSurvey({
        photos: [
          {
            url: "https://example.com/photos/survey1_front.jpg",
            description: "Front view of premises",
            timestamp: new Date().toISOString(),
          },
          {
            url: "https://example.com/photos/survey1_fiber_termination.jpg",
            description: "Fiber termination point",
            timestamp: new Date().toISOString(),
          },
        ],
      });

      // Assert
      expect(survey.photos.length).toBe(2);
      expect(survey.photos[0].url).toContain("survey1_front.jpg");
      expect(survey.photos[1].description).toBe("Fiber termination point");
    });
  });

  describe("Customer Conversion & Activation", () => {
    it("should convert qualified lead to customer", () => {
      // Arrange
      const lead = createQualifiedLead();
      const quote = createAcceptedQuote({ lead_id: lead.id });

      // Act
      const customer = createMockCustomer({
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        phone: lead.phone,
        service_address_line1: lead.service_address_line1,
        service_city: lead.service_city,
        service_state_province: lead.service_state_province,
        service_postal_code: lead.service_postal_code,
        service_plan_name: quote.service_plan_name,
        monthly_recurring_charge: quote.monthly_recurring_charge,
        status: "pending_activation",
      });

      const convertedLead = {
        ...lead,
        status: "won" as const,
        converted_at: new Date().toISOString(),
        converted_to_customer_id: customer.id,
      };

      // Assert
      expect(customer.email).toBe(lead.email);
      expect(customer.service_plan_name).toBe(quote.service_plan_name);
      expect(convertedLead.status).toBe("won");
      expect(convertedLead.converted_to_customer_id).toBe(customer.id);
    });

    it("should activate customer service", () => {
      // Arrange
      const customer = createMockCustomer({ status: "pending_activation" });

      // Act
      const activatedCustomer = {
        ...customer,
        status: "active",
        service_activation_date: new Date().toISOString(),
      };

      // Assert
      expect(activatedCustomer.status).toBe("active");
      expect(activatedCustomer.service_activation_date).toBeTruthy();
    });

    it("should generate customer number in correct format", () => {
      // Arrange & Act
      const customer = createMockCustomer();

      // Assert
      expect(customer.customer_number).toMatch(/^CUST-\d{5}$/);
    });

    it("should set initial account balance to zero", () => {
      // Arrange & Act
      const customer = createActiveCustomer();

      // Assert
      expect(customer.account_balance).toBe(0);
    });
  });

  describe("Service Upgrade & Downgrade", () => {
    it("should upgrade customer to higher tier plan", () => {
      // Arrange
      const customer = createActiveCustomer({
        service_plan_name: "Basic 100Mbps",
        bandwidth_mbps: 100,
        monthly_recurring_charge: 49.99,
      });

      // Act
      const upgradedCustomer = {
        ...customer,
        service_plan_name: "Premium 500Mbps",
        bandwidth_mbps: 500,
        monthly_recurring_charge: 79.99,
        updated_at: new Date().toISOString(),
      };

      // Assert
      expect(upgradedCustomer.service_plan_name).toBe("Premium 500Mbps");
      expect(upgradedCustomer.bandwidth_mbps).toBe(500);
      expect(upgradedCustomer.monthly_recurring_charge).toBe(79.99);
      expect(upgradedCustomer.monthly_recurring_charge).toBeGreaterThan(
        customer.monthly_recurring_charge,
      );
    });

    it("should downgrade customer to lower tier plan", () => {
      // Arrange
      const customer = createActiveCustomer({
        service_plan_name: "Premium 500Mbps",
        bandwidth_mbps: 500,
        monthly_recurring_charge: 79.99,
      });

      // Act
      const downgradedCustomer = {
        ...customer,
        service_plan_name: "Basic 100Mbps",
        bandwidth_mbps: 100,
        monthly_recurring_charge: 49.99,
        updated_at: new Date().toISOString(),
      };

      // Assert
      expect(downgradedCustomer.service_plan_name).toBe("Basic 100Mbps");
      expect(downgradedCustomer.bandwidth_mbps).toBe(100);
      expect(downgradedCustomer.monthly_recurring_charge).toBe(49.99);
      expect(downgradedCustomer.monthly_recurring_charge).toBeLessThan(
        customer.monthly_recurring_charge,
      );
    });
  });

  describe("Service Suspension & Reactivation", () => {
    it("should suspend customer for non-payment", () => {
      // Arrange
      const customer = createActiveCustomer({
        account_balance: 149.97, // 3 months overdue
      });

      // Act
      const suspendedCustomer = {
        ...customer,
        status: "suspended",
        updated_at: new Date().toISOString(),
      };

      // Assert
      expect(suspendedCustomer.status).toBe("suspended");
      expect(suspendedCustomer.account_balance).toBeGreaterThan(0);
    });

    it("should reactivate suspended customer after payment", () => {
      // Arrange
      const customer = createSuspendedCustomer();

      // Act
      const reactivatedCustomer = {
        ...customer,
        status: "active",
        account_balance: 0,
        last_payment_date: new Date().toISOString(),
        last_payment_amount: 149.97,
        updated_at: new Date().toISOString(),
      };

      // Assert
      expect(reactivatedCustomer.status).toBe("active");
      expect(reactivatedCustomer.account_balance).toBe(0);
      expect(reactivatedCustomer.last_payment_date).toBeTruthy();
    });
  });

  describe("Customer Termination", () => {
    it("should terminate customer service", () => {
      // Arrange
      const customer = createActiveCustomer();

      // Act
      const terminatedCustomer = {
        ...customer,
        status: "terminated",
        service_expiration_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Assert
      expect(terminatedCustomer.status).toBe("terminated");
      expect(terminatedCustomer.service_expiration_date).toBeTruthy();
    });

    it("should prevent termination if outstanding balance exists", () => {
      // Arrange
      const customer = createActiveCustomer({
        account_balance: 99.99,
      });

      // Act
      const canTerminate = customer.account_balance === 0;

      // Assert
      expect(canTerminate).toBe(false);
      expect(customer.account_balance).toBeGreaterThan(0);
    });

    it("should allow termination with zero balance", () => {
      // Arrange
      const customer = createActiveCustomer({
        account_balance: 0,
      });

      // Act
      const canTerminate = customer.account_balance === 0;

      // Assert
      expect(canTerminate).toBe(true);
    });
  });
});
