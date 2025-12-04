/**
 * Resellers & Channel Management API Client
 * Handles partner relationships, commission tracking, and channel sales
 */

import { BaseApiClient } from "./BaseApiClient";
import type { PaginatedResponse, QueryParams, AddressData } from "../types/api";

export interface ResellerPartner {
  id: string;
  partner_code: string;
  company_name: string;
  legal_name: string;
  partner_type: "AGENT" | "DEALER" | "DISTRIBUTOR" | "VAR" | "REFERRAL" | "FRANCHISE";
  tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_APPROVAL" | "TERMINATED";
  contact_info: PartnerContact;
  business_info: BusinessInformation;
  territories: Territory[];
  service_authorizations: ServiceAuthorization[];
  commission_structure: CommissionStructure;
  performance_metrics: PartnerMetrics;
  contract_info: ContractInformation;
  onboarding_status: OnboardingStatus;
  created_at: string;
  updated_at: string;
}

export interface PartnerContact {
  primary_contact: ContactPerson;
  billing_contact?: ContactPerson;
  technical_contact?: ContactPerson;
  sales_contact?: ContactPerson;
  address: AddressData;
  phone: string;
  email: string;
  website?: string;
}

export interface ContactPerson {
  name: string;
  title: string;
  email: string;
  phone: string;
  mobile?: string;
}

export interface BusinessInformation {
  tax_id: string;
  business_license: string;
  business_type: "CORPORATION" | "LLC" | "PARTNERSHIP" | "SOLE_PROPRIETORSHIP";
  years_in_business: number;
  employee_count: number;
  annual_revenue?: number;
  credit_rating?: string;
  bank_references?: BankReference[];
  insurance_info?: InsuranceInformation;
}

export interface BankReference {
  bank_name: string;
  account_type: string;
  years_with_bank: number;
  contact_person: string;
  contact_phone: string;
}

export interface InsuranceInformation {
  general_liability: InsurancePolicy;
  professional_liability?: InsurancePolicy;
  workers_compensation?: InsurancePolicy;
}

export interface InsurancePolicy {
  provider: string;
  policy_number: string;
  coverage_amount: number;
  expiry_date: string;
}

export interface Territory {
  id: string;
  name: string;
  type: "GEOGRAPHIC" | "VERTICAL" | "ACCOUNT_BASED";
  boundaries: TerritoryBoundary[];
  exclusive: boolean;
  population?: number;
  market_potential?: number;
}

export interface TerritoryBoundary {
  type: "POSTAL_CODE" | "CITY" | "COUNTY" | "STATE" | "COORDINATE";
  values: string[];
  coordinates?: Array<{ latitude: number; longitude: number }>;
}

export interface ServiceAuthorization {
  service_type: "INTERNET" | "VOICE" | "TV" | "BUNDLE" | "ENTERPRISE";
  authorized: boolean;
  training_required: boolean;
  training_completed: boolean;
  certification_level: "BASIC" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";
  authorization_date?: string;
  expiry_date?: string;
}

export interface CommissionStructure {
  commission_type: "PERCENTAGE" | "FLAT_RATE" | "TIERED" | "HYBRID";
  base_commission_rate: number;
  tiers?: CommissionTier[];
  bonus_structures?: BonusStructure[];
  payment_terms: "NET_30" | "NET_45" | "NET_60" | "IMMEDIATE";
  minimum_payout: number;
  effective_date: string;
  expiry_date?: string;
}

export interface CommissionTier {
  tier_name: string;
  sales_threshold: number;
  commission_rate: number;
  bonus_multiplier?: number;
}

export interface BonusStructure {
  bonus_type: "VOLUME" | "RETENTION" | "NEW_CUSTOMER" | "UPSELL" | "REFERRAL";
  threshold: number;
  bonus_amount: number;
  bonus_percentage?: number;
  calculation_period: "MONTHLY" | "QUARTERLY" | "ANNUALLY";
}

export interface PartnerMetrics {
  total_sales: number;
  monthly_sales: number;
  quarterly_sales: number;
  annual_sales: number;
  customer_count: number;
  active_customers: number;
  churned_customers: number;
  average_deal_size: number;
  conversion_rate: number;
  customer_satisfaction: number;
  performance_score: number;
  ranking: number;
  last_sale_date?: string;
}

export interface ContractInformation {
  contract_number: string;
  contract_type: "STANDARD" | "CUSTOM" | "ENTERPRISE";
  start_date: string;
  end_date?: string;
  auto_renewal: boolean;
  renewal_terms: string;
  termination_notice_days: number;
  exclusivity_clause: boolean;
  non_compete_clause: boolean;
  contract_documents: ContractDocument[];
}

export interface ContractDocument {
  document_type: "AGREEMENT" | "AMENDMENT" | "ADDENDUM" | "TERMINATION";
  document_name: string;
  file_url: string;
  signed_date?: string;
  effective_date: string;
  version: string;
}

export interface OnboardingStatus {
  stage: "APPLICATION" | "REVIEW" | "BACKGROUND_CHECK" | "TRAINING" | "CERTIFICATION" | "COMPLETED";
  progress_percentage: number;
  completed_steps: string[];
  pending_steps: string[];
  assigned_onboarding_manager?: string;
  estimated_completion_date?: string;
  notes?: string;
}

export interface Sale {
  id: string;
  sale_number: string;
  partner_id: string;
  customer_id: string;
  customer_name: string;
  sale_type: "NEW_CUSTOMER" | "UPGRADE" | "DOWNGRADE" | "ADD_ON" | "RENEWAL";
  products: SaleProduct[];
  total_value: number;
  commission_amount: number;
  commission_rate: number;
  sale_date: string;
  activation_date?: string;
  status: "PENDING" | "APPROVED" | "ACTIVATED" | "CANCELLED" | "REFUNDED";
  payment_status: "PENDING" | "PAID" | "PARTIALLY_PAID" | "OVERDUE" | "CANCELLED";
  notes?: string;
  created_at: string;
}

export interface SaleProduct {
  product_id: string;
  product_name: string;
  product_type: "SERVICE" | "EQUIPMENT" | "INSTALLATION" | "SUPPORT";
  quantity: number;
  unit_price: number;
  total_price: number;
  commission_rate: number;
  commission_amount: number;
  recurring: boolean;
  billing_cycle?: "MONTHLY" | "QUARTERLY" | "ANNUALLY";
}

export interface CommissionPayment {
  id: string;
  payment_number: string;
  partner_id: string;
  period_start: string;
  period_end: string;
  sales_included: string[];
  gross_commission: number;
  deductions: PaymentDeduction[];
  net_commission: number;
  payment_date?: string;
  payment_method: "ACH" | "WIRE" | "CHECK" | "CREDIT";
  status: "CALCULATED" | "APPROVED" | "PAID" | "DISPUTED" | "CANCELLED";
  payment_reference?: string;
  created_at: string;
}

export interface PaymentDeduction {
  type: "TAX" | "CHARGEBACK" | "ADJUSTMENT" | "FEE" | "PENALTY";
  description: string;
  amount: number;
  reference?: string;
}

export interface PartnerTraining {
  id: string;
  training_name: string;
  training_type: "ONBOARDING" | "PRODUCT" | "SALES" | "TECHNICAL" | "COMPLIANCE";
  description: string;
  required: boolean;
  duration_hours: number;
  delivery_method: "ONLINE" | "IN_PERSON" | "WEBINAR" | "SELF_PACED";
  prerequisites?: string[];
  certification_provided: boolean;
  expiry_period?: number;
  materials: TrainingMaterial[];
}

export interface TrainingMaterial {
  type: "VIDEO" | "DOCUMENT" | "QUIZ" | "PRESENTATION" | "INTERACTIVE";
  title: string;
  description: string;
  url: string;
  duration?: number;
  required: boolean;
}

export interface PartnerTrainingRecord {
  id: string;
  partner_id: string;
  training_id: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED" | "FAILED";
  start_date?: string;
  completion_date?: string;
  score?: number;
  passing_score: number;
  certificate_url?: string;
  expiry_date?: string;
  notes?: string;
}

export class ResellersApiClient extends BaseApiClient {
  constructor(baseURL: string, defaultHeaders: Record<string, string> = {}) {
    super(baseURL, defaultHeaders);
  }

  // Partner Management
  async getPartners(params?: QueryParams): Promise<PaginatedResponse<ResellerPartner>> {
    return this.get("/api/resellers/partners", { params });
  }

  async getPartner(partnerId: string): Promise<{ data: ResellerPartner }> {
    return this.get(`/api/resellers/partners/${partnerId}`);
  }

  async createPartner(
    data: Omit<
      ResellerPartner,
      "id" | "partner_code" | "performance_metrics" | "created_at" | "updated_at"
    >,
  ): Promise<{ data: ResellerPartner }> {
    return this.post("/api/resellers/partners", data);
  }

  async updatePartner(
    partnerId: string,
    data: Partial<ResellerPartner>,
  ): Promise<{ data: ResellerPartner }> {
    return this.put(`/api/resellers/partners/${partnerId}`, data);
  }

  async activatePartner(partnerId: string): Promise<{ data: ResellerPartner }> {
    return this.post(`/api/resellers/partners/${partnerId}/activate`, {});
  }

  async suspendPartner(partnerId: string, reason: string): Promise<{ data: ResellerPartner }> {
    return this.post(`/api/resellers/partners/${partnerId}/suspend`, {
      reason,
    });
  }

  async terminatePartner(
    partnerId: string,
    data: {
      termination_reason: string;
      effective_date: string;
      final_commission_calculation: boolean;
      notice_provided: boolean;
    },
  ): Promise<{ data: ResellerPartner }> {
    return this.post(`/api/resellers/partners/${partnerId}/terminate`, data);
  }

  // Territory Management
  async getPartnerTerritories(partnerId: string): Promise<{ data: Territory[] }> {
    return this.get(`/api/resellers/partners/${partnerId}/territories`);
  }

  async assignTerritory(
    partnerId: string,
    territoryData: Omit<Territory, "id">,
  ): Promise<{ data: Territory }> {
    return this.post(`/api/resellers/partners/${partnerId}/territories`, territoryData);
  }

  async updateTerritory(
    partnerId: string,
    territoryId: string,
    data: Partial<Territory>,
  ): Promise<{ data: Territory }> {
    return this.put(`/api/resellers/partners/${partnerId}/territories/${territoryId}`, data);
  }

  async removeTerritory(partnerId: string, territoryId: string): Promise<{ success: boolean }> {
    return this.delete(`/api/resellers/partners/${partnerId}/territories/${territoryId}`);
  }

  async checkTerritoryConflicts(territoryData: Territory): Promise<{
    data: {
      conflicts: Array<{
        partner_id: string;
        territory_id: string;
        overlap_percentage: number;
      }>;
    };
  }> {
    return this.post("/api/resellers/territories/check-conflicts", territoryData);
  }

  // Sales Management
  async getSales(
    params?: QueryParams & {
      partner_id?: string;
      start_date?: string;
      end_date?: string;
      status?: string;
    },
  ): Promise<PaginatedResponse<Sale>> {
    return this.get("/api/resellers/sales", { params });
  }

  async getSale(saleId: string): Promise<{ data: Sale }> {
    return this.get(`/api/resellers/sales/${saleId}`);
  }

  async createSale(
    data: Omit<Sale, "id" | "sale_number" | "commission_amount" | "commission_rate" | "created_at">,
  ): Promise<{ data: Sale }> {
    return this.post("/api/resellers/sales", data);
  }

  async updateSale(saleId: string, data: Partial<Sale>): Promise<{ data: Sale }> {
    return this.put(`/api/resellers/sales/${saleId}`, data);
  }

  async approveSale(saleId: string, approvalNotes?: string): Promise<{ data: Sale }> {
    return this.post(`/api/resellers/sales/${saleId}/approve`, {
      approval_notes: approvalNotes,
    });
  }

  async cancelSale(saleId: string, cancellationReason: string): Promise<{ data: Sale }> {
    return this.post(`/api/resellers/sales/${saleId}/cancel`, {
      cancellation_reason: cancellationReason,
    });
  }

  async getPartnerSales(partnerId: string, params?: QueryParams): Promise<PaginatedResponse<Sale>> {
    return this.get(`/api/resellers/partners/${partnerId}/sales`, { params });
  }

  // Commission Management
  async calculateCommissions(
    partnerId: string,
    period: { start_date: string; end_date: string },
  ): Promise<{ data: CommissionPayment }> {
    return this.post(`/api/resellers/partners/${partnerId}/calculate-commissions`, period);
  }

  async getCommissionPayments(
    params?: QueryParams & {
      partner_id?: string;
      status?: string;
      start_date?: string;
      end_date?: string;
    },
  ): Promise<PaginatedResponse<CommissionPayment>> {
    return this.get("/api/resellers/commissions", { params });
  }

  async getCommissionPayment(paymentId: string): Promise<{ data: CommissionPayment }> {
    return this.get(`/api/resellers/commissions/${paymentId}`);
  }

  async approveCommissionPayment(
    paymentId: string,
    approvalNotes?: string,
  ): Promise<{ data: CommissionPayment }> {
    return this.post(`/api/resellers/commissions/${paymentId}/approve`, {
      approval_notes: approvalNotes,
    });
  }

  async processCommissionPayment(
    paymentId: string,
    paymentDetails: {
      payment_method: CommissionPayment["payment_method"];
      payment_reference: string;
      payment_date: string;
    },
  ): Promise<{ data: CommissionPayment }> {
    return this.post(`/api/resellers/commissions/${paymentId}/process`, paymentDetails);
  }

  async disputeCommissionPayment(
    paymentId: string,
    disputeReason: string,
  ): Promise<{ data: CommissionPayment }> {
    return this.post(`/api/resellers/commissions/${paymentId}/dispute`, {
      dispute_reason: disputeReason,
    });
  }

  async getPartnerCommissionStatement(
    partnerId: string,
    params: {
      start_date: string;
      end_date: string;
      format?: "PDF" | "CSV" | "JSON";
    },
  ): Promise<{ data: { statement_url: string } }> {
    return this.get(`/api/resellers/partners/${partnerId}/commission-statement`, { params });
  }

  // Training & Certification
  async getTrainingPrograms(params?: QueryParams): Promise<PaginatedResponse<PartnerTraining>> {
    return this.get("/api/resellers/training/programs", { params });
  }

  async getTrainingProgram(trainingId: string): Promise<{ data: PartnerTraining }> {
    return this.get(`/api/resellers/training/programs/${trainingId}`);
  }

  async getPartnerTrainingRecords(
    partnerId: string,
    params?: QueryParams,
  ): Promise<PaginatedResponse<PartnerTrainingRecord>> {
    return this.get(`/api/resellers/partners/${partnerId}/training`, {
      params,
    });
  }

  async enrollPartnerInTraining(
    partnerId: string,
    trainingId: string,
  ): Promise<{ data: PartnerTrainingRecord }> {
    return this.post(`/api/resellers/partners/${partnerId}/training/${trainingId}/enroll`, {});
  }

  async updateTrainingProgress(
    partnerId: string,
    trainingRecordId: string,
    data: {
      progress_percentage?: number;
      completed_materials?: string[];
      quiz_scores?: Record<string, number>;
    },
  ): Promise<{ data: PartnerTrainingRecord }> {
    return this.put(`/api/resellers/training-records/${trainingRecordId}/progress`, data);
  }

  async completeTraining(
    partnerId: string,
    trainingRecordId: string,
    finalScore: number,
  ): Promise<{ data: PartnerTrainingRecord }> {
    return this.post(`/api/resellers/training-records/${trainingRecordId}/complete`, {
      final_score: finalScore,
    });
  }

  // Performance Analytics
  async getPartnerPerformance(
    partnerId: string,
    params?: {
      start_date?: string;
      end_date?: string;
      metrics?: string[];
    },
  ): Promise<{
    data: PartnerMetrics & {
      sales_trend: any[];
      commission_trend: any[];
      customer_acquisition_trend: any[];
    };
  }> {
    return this.get(`/api/resellers/partners/${partnerId}/performance`, {
      params,
    });
  }

  async getChannelPerformance(params?: {
    start_date?: string;
    end_date?: string;
    territory?: string;
    partner_tier?: string;
  }): Promise<{
    data: {
      total_partners: number;
      active_partners: number;
      total_sales: number;
      total_commissions: number;
      top_performers: Array<{
        partner_id: string;
        partner_name: string;
        sales_amount: number;
        ranking: number;
      }>;
      performance_by_tier: any[];
      sales_by_region: any[];
    };
  }> {
    return this.get("/api/resellers/analytics/channel-performance", { params });
  }

  async getPartnerLeaderboard(params?: {
    metric?: "SALES" | "CUSTOMERS" | "COMMISSION" | "SATISFACTION";
    period?: "MONTH" | "QUARTER" | "YEAR";
    territory?: string;
    tier?: string;
    limit?: number;
  }): Promise<{
    data: Array<{
      rank: number;
      partner_id: string;
      partner_name: string;
      metric_value: number;
      change_from_previous: number;
    }>;
  }> {
    return this.get("/api/resellers/analytics/leaderboard", { params });
  }

  // Onboarding Management
  async updateOnboardingStatus(
    partnerId: string,
    data: {
      stage: OnboardingStatus["stage"];
      completed_steps?: string[];
      notes?: string;
    },
  ): Promise<{ data: ResellerPartner }> {
    return this.put(`/api/resellers/partners/${partnerId}/onboarding`, data);
  }

  async assignOnboardingManager(
    partnerId: string,
    managerId: string,
  ): Promise<{ data: ResellerPartner }> {
    return this.post(`/api/resellers/partners/${partnerId}/assign-onboarding-manager`, {
      manager_id: managerId,
    });
  }

  async getOnboardingChecklist(partnerId: string): Promise<{
    data: Array<{
      step_name: string;
      description: string;
      required: boolean;
      completed: boolean;
      completion_date?: string;
      dependencies?: string[];
    }>;
  }> {
    return this.get(`/api/resellers/partners/${partnerId}/onboarding-checklist`);
  }

  // Document Management
  async uploadPartnerDocument(
    partnerId: string,
    file: File,
    documentType: string,
  ): Promise<{ data: ContractDocument }> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", documentType);

    const response = await fetch(`${this.baseURL}/api/resellers/partners/${partnerId}/documents`, {
      method: "POST",
      headers: this.defaultHeaders,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Document upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getPartnerDocuments(partnerId: string): Promise<{ data: ContractDocument[] }> {
    return this.get(`/api/resellers/partners/${partnerId}/documents`);
  }

  async signDocument(
    partnerId: string,
    documentId: string,
    signatureData: {
      signature_method: "ELECTRONIC" | "WET_SIGNATURE" | "DOCUSIGN";
      signer_name: string;
      signature_date: string;
      ip_address?: string;
    },
  ): Promise<{ data: ContractDocument }> {
    return this.post(
      `/api/resellers/partners/${partnerId}/documents/${documentId}/sign`,
      signatureData,
    );
  }
}
