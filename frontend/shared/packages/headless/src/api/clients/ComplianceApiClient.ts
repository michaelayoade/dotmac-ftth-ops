/**
 * Compliance & Regulatory API Client
 * Handles regulatory compliance, audit trails, and policy management
 */

import { BaseApiClient } from "./BaseApiClient";
import type { PaginatedResponse, QueryParams } from "../types/api";

export interface CompliancePolicy {
  id: string;
  name: string;
  description: string;
  policy_type: "REGULATORY" | "INTERNAL" | "INDUSTRY" | "CONTRACTUAL";
  regulation_framework:
    | "FCC"
    | "GDPR"
    | "CCPA"
    | "SOX"
    | "HIPAA"
    | "ISO27001"
    | "SOC2"
    | "PCI_DSS"
    | "CUSTOM";
  effective_date: string;
  expiry_date?: string;
  status: "DRAFT" | "ACTIVE" | "SUSPENDED" | "EXPIRED";
  requirements: PolicyRequirement[];
  controls: ComplianceControl[];
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PolicyRequirement {
  id: string;
  title: string;
  description: string;
  requirement_type:
    | "DATA_PROTECTION"
    | "ACCESS_CONTROL"
    | "AUDIT_LOGGING"
    | "INCIDENT_RESPONSE"
    | "DOCUMENTATION"
    | "TRAINING";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  compliance_status: "COMPLIANT" | "NON_COMPLIANT" | "PARTIAL" | "NOT_ASSESSED";
  evidence_required: string[];
  responsible_party: string;
  due_date?: string;
  last_assessed?: string;
}

export interface ComplianceControl {
  id: string;
  control_id: string;
  name: string;
  description: string;
  control_type: "PREVENTIVE" | "DETECTIVE" | "CORRECTIVE" | "COMPENSATING";
  implementation_status: "NOT_IMPLEMENTED" | "PLANNED" | "IN_PROGRESS" | "IMPLEMENTED" | "TESTED";
  effectiveness: "EFFECTIVE" | "INEFFECTIVE" | "NEEDS_IMPROVEMENT" | "NOT_TESTED";
  test_frequency: "CONTINUOUS" | "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUALLY";
  last_tested?: string;
  next_test_date?: string;
  owner: string;
}

export interface AuditLog {
  id: string;
  event_type: string;
  resource_type: string;
  resource_id: string;
  user_id?: string;
  user_email?: string;
  action: "CREATE" | "READ" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "ACCESS" | "EXPORT";
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  tenant_id?: string;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  timestamp: string;
}

export interface DataPrivacyRequest {
  id: string;
  request_type:
    | "ACCESS"
    | "RECTIFICATION"
    | "ERASURE"
    | "PORTABILITY"
    | "RESTRICTION"
    | "OBJECTION";
  customer_id: string;
  customer_email: string;
  request_details: string;
  legal_basis?: string;
  status: "SUBMITTED" | "VERIFIED" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assigned_to?: string;
  verification_method?: string;
  completion_deadline: string;
  data_categories: string[];
  systems_involved: string[];
  notes?: string;
  submitted_at: string;
  completed_at?: string;
}

export interface IncidentReport {
  id: string;
  incident_type:
    | "DATA_BREACH"
    | "PRIVACY_VIOLATION"
    | "SECURITY_INCIDENT"
    | "COMPLIANCE_VIOLATION"
    | "SYSTEM_FAILURE";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "REPORTED" | "INVESTIGATING" | "CONTAINED" | "RESOLVED" | "CLOSED";
  title: string;
  description: string;
  affected_systems: string[];
  affected_customers?: number;
  data_categories_affected?: string[];
  discovered_at: string;
  reported_by: string;
  assigned_to?: string;
  containment_actions: string[];
  corrective_actions: string[];
  regulatory_notification_required: boolean;
  regulatory_notifications: RegulatoryNotification[];
  lessons_learned?: string;
  created_at: string;
  resolved_at?: string;
}

export interface RegulatoryNotification {
  id: string;
  authority: string;
  notification_type: string;
  status: "PENDING" | "SUBMITTED" | "ACKNOWLEDGED" | "UNDER_REVIEW" | "CLOSED";
  submitted_at?: string;
  reference_number?: string;
  response_deadline?: string;
  notes?: string;
}

export interface ComplianceAssessment {
  id: string;
  assessment_name: string;
  framework: CompliancePolicy["regulation_framework"];
  scope: string;
  assessment_type: "SELF_ASSESSMENT" | "INTERNAL_AUDIT" | "EXTERNAL_AUDIT" | "CERTIFICATION";
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  start_date: string;
  end_date?: string;
  assessor: string;
  findings: AssessmentFinding[];
  overall_score?: number;
  compliance_percentage?: number;
  recommendations: string[];
  action_plan: ActionItem[];
  created_at: string;
}

export interface AssessmentFinding {
  id: string;
  control_id: string;
  finding_type: "DEFICIENCY" | "OBSERVATION" | "STRENGTH" | "RECOMMENDATION";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  evidence: string[];
  risk_rating: number;
  remediation_required: boolean;
  remediation_timeline?: string;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  assigned_to: string;
  due_date: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE";
  progress_notes?: string[];
  completion_evidence?: string[];
}

export class ComplianceApiClient extends BaseApiClient {
  constructor(baseURL: string, defaultHeaders: Record<string, string> = {}) {
    super(baseURL, defaultHeaders);
  }

  // Compliance Policies
  async getPolicies(params?: QueryParams): Promise<PaginatedResponse<CompliancePolicy>> {
    return this.get("/api/compliance/policies", { params });
  }

  async getPolicy(policyId: string): Promise<{ data: CompliancePolicy }> {
    return this.get(`/api/compliance/policies/${policyId}`);
  }

  async createPolicy(
    data: Omit<CompliancePolicy, "id" | "created_at" | "updated_at">,
  ): Promise<{ data: CompliancePolicy }> {
    return this.post("/api/compliance/policies", data);
  }

  async updatePolicy(
    policyId: string,
    data: Partial<CompliancePolicy>,
  ): Promise<{ data: CompliancePolicy }> {
    return this.put(`/api/compliance/policies/${policyId}`, data);
  }

  async approvePolicy(
    policyId: string,
    approvalNotes?: string,
  ): Promise<{ data: CompliancePolicy }> {
    return this.post(`/api/compliance/policies/${policyId}/approve`, {
      approval_notes: approvalNotes,
    });
  }

  async suspendPolicy(policyId: string, reason: string): Promise<{ data: CompliancePolicy }> {
    return this.post(`/api/compliance/policies/${policyId}/suspend`, {
      reason,
    });
  }

  // Compliance Controls
  async testControl(
    controlId: string,
    testResults: {
      test_date: string;
      effectiveness: ComplianceControl["effectiveness"];
      test_evidence: string[];
      notes?: string;
    },
  ): Promise<{ data: ComplianceControl }> {
    return this.post(`/api/compliance/controls/${controlId}/test`, testResults);
  }

  async getControlStatus(params?: {
    framework?: string;
    control_type?: string;
  }): Promise<{ data: ComplianceControl[] }> {
    return this.get("/api/compliance/controls/status", { params });
  }

  async scheduleControlTest(
    controlId: string,
    scheduledDate: string,
  ): Promise<{ data: ComplianceControl }> {
    return this.post(`/api/compliance/controls/${controlId}/schedule-test`, {
      scheduled_date: scheduledDate,
    });
  }

  // Audit Logs
  async getAuditLogs(
    params?: QueryParams & {
      event_type?: string;
      user_id?: string;
      resource_type?: string;
      start_date?: string;
      end_date?: string;
      risk_level?: string;
    },
  ): Promise<PaginatedResponse<AuditLog>> {
    return this.get("/api/compliance/audit-logs", { params });
  }

  async getAuditLog(logId: string): Promise<{ data: AuditLog }> {
    return this.get(`/api/compliance/audit-logs/${logId}`);
  }

  async exportAuditLogs(params: {
    start_date: string;
    end_date: string;
    format: "CSV" | "JSON" | "PDF";
    filters?: Record<string, any>;
  }): Promise<{ data: { export_id: string; download_url: string } }> {
    return this.post("/api/compliance/audit-logs/export", params);
  }

  async searchAuditLogs(
    query: string,
    params?: {
      start_date?: string;
      end_date?: string;
      event_types?: string[];
    },
  ): Promise<PaginatedResponse<AuditLog>> {
    return this.post("/api/compliance/audit-logs/search", { query, ...params });
  }

  // Data Privacy Requests
  async getPrivacyRequests(params?: QueryParams): Promise<PaginatedResponse<DataPrivacyRequest>> {
    return this.get("/api/compliance/privacy-requests", { params });
  }

  async getPrivacyRequest(requestId: string): Promise<{ data: DataPrivacyRequest }> {
    return this.get(`/api/compliance/privacy-requests/${requestId}`);
  }

  async createPrivacyRequest(
    data: Omit<DataPrivacyRequest, "id" | "status" | "submitted_at">,
  ): Promise<{ data: DataPrivacyRequest }> {
    return this.post("/api/compliance/privacy-requests", data);
  }

  async verifyPrivacyRequest(
    requestId: string,
    verificationMethod: string,
  ): Promise<{ data: DataPrivacyRequest }> {
    return this.post(`/api/compliance/privacy-requests/${requestId}/verify`, {
      verification_method: verificationMethod,
    });
  }

  async processPrivacyRequest(
    requestId: string,
    data: {
      processing_notes: string;
      data_extracted?: any[];
      data_deleted?: string[];
      data_modified?: any[];
    },
  ): Promise<{ data: DataPrivacyRequest }> {
    return this.post(`/api/compliance/privacy-requests/${requestId}/process`, data);
  }

  async completePrivacyRequest(
    requestId: string,
    completionNotes: string,
  ): Promise<{ data: DataPrivacyRequest }> {
    return this.post(`/api/compliance/privacy-requests/${requestId}/complete`, {
      completion_notes: completionNotes,
    });
  }

  // Incident Management
  async getIncidents(params?: QueryParams): Promise<PaginatedResponse<IncidentReport>> {
    return this.get("/api/compliance/incidents", { params });
  }

  async getIncident(incidentId: string): Promise<{ data: IncidentReport }> {
    return this.get(`/api/compliance/incidents/${incidentId}`);
  }

  async createIncident(
    data: Omit<IncidentReport, "id" | "status" | "created_at">,
  ): Promise<{ data: IncidentReport }> {
    return this.post("/api/compliance/incidents", data);
  }

  async updateIncident(
    incidentId: string,
    data: Partial<IncidentReport>,
  ): Promise<{ data: IncidentReport }> {
    return this.put(`/api/compliance/incidents/${incidentId}`, data);
  }

  async escalateIncident(
    incidentId: string,
    escalationReason: string,
    escalateTo: string,
  ): Promise<{ data: IncidentReport }> {
    return this.post(`/api/compliance/incidents/${incidentId}/escalate`, {
      escalation_reason: escalationReason,
      escalate_to: escalateTo,
    });
  }

  async resolveIncident(
    incidentId: string,
    resolution: {
      resolution_summary: string;
      corrective_actions_taken: string[];
      lessons_learned: string;
      follow_up_required: boolean;
    },
  ): Promise<{ data: IncidentReport }> {
    return this.post(`/api/compliance/incidents/${incidentId}/resolve`, resolution);
  }

  // Regulatory Notifications
  async submitRegulatoryNotification(
    incidentId: string,
    notification: {
      authority: string;
      notification_type: string;
      notification_data: Record<string, any>;
    },
  ): Promise<{ data: RegulatoryNotification }> {
    return this.post(`/api/compliance/incidents/${incidentId}/notify`, notification);
  }

  async trackNotificationStatus(notificationId: string): Promise<{ data: RegulatoryNotification }> {
    return this.get(`/api/compliance/notifications/${notificationId}`);
  }

  // Compliance Assessments
  async getAssessments(params?: QueryParams): Promise<PaginatedResponse<ComplianceAssessment>> {
    return this.get("/api/compliance/assessments", { params });
  }

  async getAssessment(assessmentId: string): Promise<{ data: ComplianceAssessment }> {
    return this.get(`/api/compliance/assessments/${assessmentId}`);
  }

  async createAssessment(
    data: Omit<ComplianceAssessment, "id" | "status" | "findings" | "action_plan" | "created_at">,
  ): Promise<{ data: ComplianceAssessment }> {
    return this.post("/api/compliance/assessments", data);
  }

  async addAssessmentFinding(
    assessmentId: string,
    finding: Omit<AssessmentFinding, "id">,
  ): Promise<{ data: AssessmentFinding }> {
    return this.post(`/api/compliance/assessments/${assessmentId}/findings`, finding);
  }

  async updateAssessmentFinding(
    assessmentId: string,
    findingId: string,
    data: Partial<AssessmentFinding>,
  ): Promise<{ data: AssessmentFinding }> {
    return this.put(`/api/compliance/assessments/${assessmentId}/findings/${findingId}`, data);
  }

  async completeAssessment(
    assessmentId: string,
    data: {
      overall_score: number;
      compliance_percentage: number;
      recommendations: string[];
      final_report?: string;
    },
  ): Promise<{ data: ComplianceAssessment }> {
    return this.post(`/api/compliance/assessments/${assessmentId}/complete`, data);
  }

  // Action Items
  async createActionItem(
    assessmentId: string,
    actionItem: Omit<ActionItem, "id" | "status">,
  ): Promise<{ data: ActionItem }> {
    return this.post(`/api/compliance/assessments/${assessmentId}/action-items`, actionItem);
  }

  async updateActionItem(
    actionItemId: string,
    data: Partial<ActionItem>,
  ): Promise<{ data: ActionItem }> {
    return this.put(`/api/compliance/action-items/${actionItemId}`, data);
  }

  async completeActionItem(
    actionItemId: string,
    completionEvidence: string[],
  ): Promise<{ data: ActionItem }> {
    return this.post(`/api/compliance/action-items/${actionItemId}/complete`, {
      completion_evidence: completionEvidence,
    });
  }

  // Compliance Dashboard & Reporting
  async getComplianceDashboard(framework?: string): Promise<{
    data: {
      overall_compliance_score: number;
      policies_active: number;
      controls_effective: number;
      open_incidents: number;
      pending_privacy_requests: number;
      overdue_action_items: number;
      recent_assessments: ComplianceAssessment[];
      compliance_trends: any[];
    };
  }> {
    return this.get("/api/compliance/dashboard", { params: { framework } });
  }

  async generateComplianceReport(params: {
    framework: string;
    report_type: "COMPLIANCE_STATUS" | "AUDIT_SUMMARY" | "INCIDENT_ANALYSIS" | "RISK_ASSESSMENT";
    start_date?: string;
    end_date?: string;
    format: "PDF" | "HTML" | "JSON";
  }): Promise<{ data: { report_id: string; download_url: string } }> {
    return this.post("/api/compliance/reports/generate", params);
  }

  async getComplianceMetrics(params?: {
    framework?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<{
    data: {
      compliance_score_trend: any[];
      incidents_by_type: any[];
      control_effectiveness: any[];
      privacy_request_resolution_time: any[];
    };
  }> {
    return this.get("/api/compliance/metrics", { params });
  }
}
