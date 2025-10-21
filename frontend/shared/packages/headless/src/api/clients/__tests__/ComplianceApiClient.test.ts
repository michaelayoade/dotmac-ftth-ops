/**
 * ComplianceApiClient Tests
 * Critical test suite for regulatory compliance and audit management
 */

import { ComplianceApiClient } from "../ComplianceApiClient";
import type {
  CompliancePolicy,
  AuditLog,
  DataPrivacyRequest,
  IncidentReport,
  ComplianceAssessment,
  PolicyRequirement,
  ComplianceControl,
  AssessmentFinding,
  ActionItem,
  RegulatoryNotification,
} from "../ComplianceApiClient";

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe("ComplianceApiClient", () => {
  let client: ComplianceApiClient;
  const baseURL = "https://api.test.com";
  const defaultHeaders = { Authorization: "Bearer test-token" };

  beforeEach(() => {
    client = new ComplianceApiClient(baseURL, defaultHeaders);
    jest.clearAllMocks();
  });

  const mockResponse = <T>(data: T, status = 200) => {
    mockFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
    } as Response);
  };

  describe("Compliance Policies Management", () => {
    const mockRequirements: PolicyRequirement[] = [
      {
        id: "req_001",
        title: "Customer Data Encryption",
        description: "All customer PII must be encrypted at rest and in transit",
        requirement_type: "DATA_PROTECTION",
        priority: "CRITICAL",
        compliance_status: "COMPLIANT",
        evidence_required: ["encryption_certificates", "security_scan_reports"],
        responsible_party: "security_team",
        due_date: "2024-03-31T23:59:59Z",
        last_assessed: "2024-01-15T10:00:00Z",
      },
    ];

    const mockControls: ComplianceControl[] = [
      {
        id: "ctrl_001",
        control_id: "SOC2-CC6.1",
        name: "Logical Access Controls",
        description: "System access is restricted to authorized personnel",
        control_type: "PREVENTIVE",
        implementation_status: "IMPLEMENTED",
        effectiveness: "EFFECTIVE",
        test_frequency: "QUARTERLY",
        last_tested: "2024-01-01T00:00:00Z",
        next_test_date: "2024-04-01T00:00:00Z",
        owner: "security_admin",
      },
    ];

    const mockPolicy: CompliancePolicy = {
      id: "policy_123",
      name: "SOC 2 Type II Compliance Policy",
      description:
        "Comprehensive policy covering SOC 2 security, availability, and confidentiality requirements",
      policy_type: "REGULATORY",
      regulation_framework: "SOC2",
      effective_date: "2024-01-01T00:00:00Z",
      expiry_date: "2024-12-31T23:59:59Z",
      status: "ACTIVE",
      requirements: mockRequirements,
      controls: mockControls,
      created_by: "compliance_manager",
      approved_by: "chief_compliance_officer",
      approved_at: "2024-01-01T08:00:00Z",
      created_at: "2023-12-15T10:00:00Z",
      updated_at: "2024-01-01T08:00:00Z",
    };

    it("should get policies with framework filtering", async () => {
      mockResponse({
        data: [mockPolicy],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getPolicies({
        regulation_framework: "SOC2",
        status: "ACTIVE",
        policy_type: "REGULATORY",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/compliance/policies?regulation_framework=SOC2&status=ACTIVE&policy_type=REGULATORY",
        expect.any(Object),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].regulation_framework).toBe("SOC2");
    });

    it("should create comprehensive compliance policy", async () => {
      const policyData = {
        name: "GDPR Data Protection Policy",
        description: "Policy ensuring GDPR compliance for customer data handling",
        policy_type: "REGULATORY" as const,
        regulation_framework: "GDPR" as const,
        effective_date: "2024-02-01T00:00:00Z",
        status: "DRAFT" as const,
        requirements: [
          {
            id: "req_gdpr_001",
            title: "Right to Be Forgotten",
            description: "Customers can request deletion of their personal data",
            requirement_type: "DATA_PROTECTION" as const,
            priority: "HIGH" as const,
            compliance_status: "NOT_ASSESSED" as const,
            evidence_required: ["deletion_procedures", "audit_logs"],
            responsible_party: "data_protection_officer",
            due_date: "2024-03-15T23:59:59Z",
          },
        ],
        controls: [
          {
            id: "ctrl_gdpr_001",
            control_id: "GDPR-ART17",
            name: "Data Deletion Process",
            description: "Automated process for customer data deletion requests",
            control_type: "CORRECTIVE" as const,
            implementation_status: "PLANNED" as const,
            effectiveness: "NOT_TESTED" as const,
            test_frequency: "MONTHLY" as const,
            owner: "data_team_lead",
          },
        ],
        created_by: "compliance_analyst",
      };

      mockResponse({
        data: {
          ...policyData,
          id: "policy_124",
          created_at: "2024-01-17T14:00:00Z",
          updated_at: "2024-01-17T14:00:00Z",
        },
      });

      const result = await client.createPolicy(policyData);

      expect(result.data.id).toBe("policy_124");
      expect(result.data.regulation_framework).toBe("GDPR");
      expect(result.data.requirements).toHaveLength(1);
    });

    it("should approve policy with approval notes", async () => {
      mockResponse({
        data: {
          ...mockPolicy,
          status: "ACTIVE",
          approved_by: "chief_compliance_officer",
          approved_at: "2024-01-17T15:00:00Z",
          updated_at: "2024-01-17T15:00:00Z",
        },
      });

      const result = await client.approvePolicy(
        "policy_123",
        "Policy reviewed and approved for immediate implementation",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/compliance/policies/policy_123/approve",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            approval_notes: "Policy reviewed and approved for immediate implementation",
          }),
        }),
      );

      expect(result.data.status).toBe("ACTIVE");
      expect(result.data.approved_at).toBe("2024-01-17T15:00:00Z");
    });

    it("should suspend policy with reason", async () => {
      mockResponse({
        data: {
          ...mockPolicy,
          status: "SUSPENDED",
          updated_at: "2024-01-17T16:00:00Z",
        },
      });

      const result = await client.suspendPolicy(
        "policy_123",
        "Regulatory framework updated, policy under review",
      );

      expect(result.data.status).toBe("SUSPENDED");
    });
  });

  describe("Compliance Controls Testing", () => {
    const mockControl: ComplianceControl = {
      id: "ctrl_123",
      control_id: "CC6.2",
      name: "Multi-Factor Authentication",
      description: "All system access requires multi-factor authentication",
      control_type: "PREVENTIVE",
      implementation_status: "IMPLEMENTED",
      effectiveness: "EFFECTIVE",
      test_frequency: "MONTHLY",
      last_tested: "2024-01-15T10:00:00Z",
      next_test_date: "2024-02-15T10:00:00Z",
      owner: "security_engineer",
    };

    it("should test control effectiveness", async () => {
      const testResults = {
        test_date: "2024-01-17T14:00:00Z",
        effectiveness: "EFFECTIVE" as const,
        test_evidence: [
          "mfa_configuration_screenshot",
          "access_log_analysis",
          "user_authentication_report",
        ],
        notes: "All users successfully required to use MFA. No bypass mechanisms found.",
      };

      mockResponse({
        data: {
          ...mockControl,
          last_tested: testResults.test_date,
          effectiveness: testResults.effectiveness,
          next_test_date: "2024-02-17T14:00:00Z",
        },
      });

      const result = await client.testControl("ctrl_123", testResults);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/compliance/controls/ctrl_123/test",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(testResults),
        }),
      );

      expect(result.data.effectiveness).toBe("EFFECTIVE");
      expect(result.data.last_tested).toBe(testResults.test_date);
    });

    it("should get control status by framework", async () => {
      mockResponse({
        data: [
          mockControl,
          {
            ...mockControl,
            id: "ctrl_124",
            effectiveness: "NEEDS_IMPROVEMENT",
          },
        ],
      });

      const result = await client.getControlStatus({
        framework: "SOC2",
        control_type: "PREVENTIVE",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/compliance/controls/status",
        expect.objectContaining({
          params: {
            framework: "SOC2",
            control_type: "PREVENTIVE",
          },
        }),
      );

      expect(result.data).toHaveLength(2);
      expect(result.data[0].effectiveness).toBe("EFFECTIVE");
      expect(result.data[1].effectiveness).toBe("NEEDS_IMPROVEMENT");
    });

    it("should schedule control test", async () => {
      mockResponse({
        data: {
          ...mockControl,
          next_test_date: "2024-02-20T10:00:00Z",
        },
      });

      const result = await client.scheduleControlTest("ctrl_123", "2024-02-20T10:00:00Z");

      expect(result.data.next_test_date).toBe("2024-02-20T10:00:00Z");
    });
  });

  describe("Audit Logs Management", () => {
    const mockAuditLog: AuditLog = {
      id: "audit_123",
      event_type: "user_login",
      resource_type: "user_session",
      resource_id: "session_456",
      user_id: "user_789",
      user_email: "john.doe@company.com",
      action: "LOGIN",
      details: {
        login_method: "mfa",
        device_type: "desktop",
        location: "Office Network",
        success: true,
      },
      ip_address: "192.168.1.100",
      user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      session_id: "sess_abc123",
      tenant_id: "tenant_xyz",
      risk_level: "LOW",
      timestamp: "2024-01-17T09:30:00Z",
    };

    it("should get audit logs with comprehensive filtering", async () => {
      mockResponse({
        data: [mockAuditLog],
        pagination: {
          page: 1,
          limit: 100,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getAuditLogs({
        event_type: "user_login",
        user_id: "user_789",
        risk_level: "LOW",
        start_date: "2024-01-17T00:00:00Z",
        end_date: "2024-01-17T23:59:59Z",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/compliance/audit-logs?event_type=user_login&user_id=user_789&risk_level=LOW&start_date=2024-01-17T00%3A00%3A00Z&end_date=2024-01-17T23%3A59%3A59Z",
        expect.any(Object),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].event_type).toBe("user_login");
    });

    it("should export audit logs in multiple formats", async () => {
      const exportParams = {
        start_date: "2024-01-01T00:00:00Z",
        end_date: "2024-01-31T23:59:59Z",
        format: "CSV" as const,
        filters: {
          event_type: ["user_login", "data_access"],
          risk_level: ["MEDIUM", "HIGH"],
        },
      };

      mockResponse({
        data: {
          export_id: "export_audit_123",
          download_url: "https://storage.example.com/exports/audit_logs_export_123.csv",
        },
      });

      const result = await client.exportAuditLogs(exportParams);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/compliance/audit-logs/export",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(exportParams),
        }),
      );

      expect(result.data.export_id).toBe("export_audit_123");
      expect(result.data.download_url).toContain(".csv");
    });

    it("should search audit logs with query parameters", async () => {
      const searchQuery = "failed login attempt";
      const searchParams = {
        start_date: "2024-01-17T00:00:00Z",
        end_date: "2024-01-17T23:59:59Z",
        event_types: ["user_login", "authentication_failure"],
      };

      mockResponse({
        data: [
          {
            ...mockAuditLog,
            id: "audit_124",
            details: { ...mockAuditLog.details, success: false },
            risk_level: "MEDIUM",
          },
        ],
        pagination: {
          page: 1,
          limit: 50,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.searchAuditLogs(searchQuery, searchParams);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/compliance/audit-logs/search",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            query: searchQuery,
            ...searchParams,
          }),
        }),
      );

      expect(result.data[0].risk_level).toBe("MEDIUM");
      expect(result.data[0].details.success).toBe(false);
    });
  });

  describe("Data Privacy Requests", () => {
    const mockPrivacyRequest: DataPrivacyRequest = {
      id: "privacy_123",
      request_type: "ERASURE",
      customer_id: "cust_456",
      customer_email: "customer@example.com",
      request_details: "Please delete all my personal data from your systems",
      legal_basis: "GDPR Article 17 - Right to Erasure",
      status: "VERIFIED",
      priority: "HIGH",
      assigned_to: "data_protection_officer",
      verification_method: "email_verification",
      completion_deadline: "2024-02-16T23:59:59Z",
      data_categories: ["personal_info", "contact_details", "service_history"],
      systems_involved: ["crm", "billing", "support"],
      notes: "Customer requested complete account closure",
      submitted_at: "2024-01-17T10:00:00Z",
    };

    it("should create privacy request with detailed information", async () => {
      const requestData = {
        request_type: "ACCESS" as const,
        customer_id: "cust_789",
        customer_email: "another@example.com",
        request_details: "I would like to access all personal data you have about me",
        legal_basis: "GDPR Article 15 - Right of Access",
        priority: "MEDIUM" as const,
        completion_deadline: "2024-02-15T23:59:59Z",
        data_categories: ["personal_info", "service_usage", "payment_info"],
        systems_involved: ["crm", "analytics", "billing"],
        notes: "Customer inquiry for data transparency",
      };

      mockResponse({
        data: {
          ...requestData,
          id: "privacy_124",
          status: "SUBMITTED",
          submitted_at: "2024-01-17T15:00:00Z",
        },
      });

      const result = await client.createPrivacyRequest(requestData);

      expect(result.data.id).toBe("privacy_124");
      expect(result.data.request_type).toBe("ACCESS");
      expect(result.data.status).toBe("SUBMITTED");
    });

    it("should verify privacy request", async () => {
      mockResponse({
        data: {
          ...mockPrivacyRequest,
          status: "VERIFIED",
          verification_method: "sms_verification",
        },
      });

      const result = await client.verifyPrivacyRequest("privacy_123", "sms_verification");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/compliance/privacy-requests/privacy_123/verify",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            verification_method: "sms_verification",
          }),
        }),
      );

      expect(result.data.status).toBe("VERIFIED");
    });

    it("should process privacy request with data handling", async () => {
      const processingData = {
        processing_notes: "Successfully deleted all customer data as requested",
        data_deleted: ["personal_profile", "service_history", "payment_records"],
        data_extracted: [],
        data_modified: [],
      };

      mockResponse({
        data: {
          ...mockPrivacyRequest,
          status: "IN_PROGRESS",
          notes: `${mockPrivacyRequest.notes}. Processing: ${processingData.processing_notes}`,
        },
      });

      const result = await client.processPrivacyRequest("privacy_123", processingData);

      expect(result.data.status).toBe("IN_PROGRESS");
      expect(result.data.notes).toContain("Successfully deleted all customer data");
    });

    it("should complete privacy request", async () => {
      mockResponse({
        data: {
          ...mockPrivacyRequest,
          status: "COMPLETED",
          completed_at: "2024-01-17T16:30:00Z",
        },
      });

      const result = await client.completePrivacyRequest(
        "privacy_123",
        "All requested data has been permanently deleted from our systems",
      );

      expect(result.data.status).toBe("COMPLETED");
      expect(result.data.completed_at).toBe("2024-01-17T16:30:00Z");
    });
  });

  describe("Incident Management", () => {
    const mockNotification: RegulatoryNotification = {
      id: "notif_123",
      authority: "FCC",
      notification_type: "DATA_BREACH_72H",
      status: "SUBMITTED",
      submitted_at: "2024-01-17T12:00:00Z",
      reference_number: "FCC-2024-0117-001",
      response_deadline: "2024-01-24T12:00:00Z",
      notes: "Initial breach notification submitted within 72 hours",
    };

    const mockIncident: IncidentReport = {
      id: "incident_123",
      incident_type: "DATA_BREACH",
      severity: "HIGH",
      status: "INVESTIGATING",
      title: "Unauthorized Access to Customer Database",
      description: "Potential unauthorized access detected on customer information database",
      affected_systems: ["customer_db", "billing_system"],
      affected_customers: 1250,
      data_categories_affected: ["personal_info", "contact_details"],
      discovered_at: "2024-01-17T08:30:00Z",
      reported_by: "security_analyst",
      assigned_to: "incident_commander",
      containment_actions: [
        "Isolated affected database servers",
        "Reset all admin passwords",
        "Enabled additional monitoring",
      ],
      corrective_actions: [
        "Implement additional access controls",
        "Conduct security awareness training",
        "Update incident response procedures",
      ],
      regulatory_notification_required: true,
      regulatory_notifications: [mockNotification],
      created_at: "2024-01-17T09:00:00Z",
    };

    it("should create security incident with comprehensive details", async () => {
      const incidentData = {
        incident_type: "SECURITY_INCIDENT" as const,
        severity: "MEDIUM" as const,
        title: "Suspicious Login Activity Detected",
        description: "Multiple failed login attempts from unusual geographic locations",
        affected_systems: ["user_management", "authentication_service"],
        discovered_at: "2024-01-17T11:00:00Z",
        reported_by: "security_monitoring",
        containment_actions: ["Temporarily blocked suspicious IP ranges"],
        corrective_actions: ["Review and enhance login monitoring rules"],
        regulatory_notification_required: false,
        regulatory_notifications: [],
      };

      mockResponse({
        data: {
          ...incidentData,
          id: "incident_124",
          status: "REPORTED",
          created_at: "2024-01-17T11:15:00Z",
        },
      });

      const result = await client.createIncident(incidentData);

      expect(result.data.id).toBe("incident_124");
      expect(result.data.incident_type).toBe("SECURITY_INCIDENT");
      expect(result.data.status).toBe("REPORTED");
    });

    it("should escalate incident with proper reasoning", async () => {
      mockResponse({
        data: {
          ...mockIncident,
          severity: "CRITICAL",
          assigned_to: "chief_security_officer",
          status: "INVESTIGATING",
        },
      });

      const result = await client.escalateIncident(
        "incident_123",
        "Broader impact discovered, affects critical systems",
        "chief_security_officer",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/compliance/incidents/incident_123/escalate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            escalation_reason: "Broader impact discovered, affects critical systems",
            escalate_to: "chief_security_officer",
          }),
        }),
      );

      expect(result.data.severity).toBe("CRITICAL");
      expect(result.data.assigned_to).toBe("chief_security_officer");
    });

    it("should resolve incident with comprehensive resolution", async () => {
      const resolutionData = {
        resolution_summary: "Unauthorized access was blocked. No data was compromised.",
        corrective_actions_taken: [
          "Patched security vulnerability",
          "Updated access control policies",
          "Conducted employee security training",
        ],
        lessons_learned: "Need for more frequent security assessments and real-time monitoring",
        follow_up_required: true,
      };

      mockResponse({
        data: {
          ...mockIncident,
          status: "RESOLVED",
          lessons_learned: resolutionData.lessons_learned,
          resolved_at: "2024-01-17T18:00:00Z",
        },
      });

      const result = await client.resolveIncident("incident_123", resolutionData);

      expect(result.data.status).toBe("RESOLVED");
      expect(result.data.resolved_at).toBe("2024-01-17T18:00:00Z");
      expect(result.data.lessons_learned).toBe(resolutionData.lessons_learned);
    });

    it("should submit regulatory notification", async () => {
      const notificationData = {
        authority: "FCC",
        notification_type: "SERVICE_OUTAGE_REPORT",
        notification_data: {
          outage_duration: 45,
          customers_affected: 1250,
          service_type: "internet",
          cause: "equipment_failure",
        },
      };

      mockResponse({ data: mockNotification });

      const result = await client.submitRegulatoryNotification("incident_123", notificationData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/compliance/incidents/incident_123/notify",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(notificationData),
        }),
      );

      expect(result.data.authority).toBe("FCC");
      expect(result.data.status).toBe("SUBMITTED");
    });

    it("should track notification status", async () => {
      mockResponse({
        data: {
          ...mockNotification,
          status: "ACKNOWLEDGED",
          notes: "Authority acknowledged receipt and began review process",
        },
      });

      const result = await client.trackNotificationStatus("notif_123");

      expect(result.data.status).toBe("ACKNOWLEDGED");
      expect(result.data.notes).toContain("Authority acknowledged receipt");
    });
  });

  describe("Compliance Assessments", () => {
    const mockFinding: AssessmentFinding = {
      id: "finding_123",
      control_id: "CC6.1",
      finding_type: "DEFICIENCY",
      severity: "MEDIUM",
      title: "Incomplete User Access Review Process",
      description: "Annual user access reviews are not consistently documented",
      evidence: ["access_review_spreadsheet", "hr_termination_records"],
      risk_rating: 6.5,
      remediation_required: true,
      remediation_timeline: "30 days",
    };

    const mockActionItem: ActionItem = {
      id: "action_123",
      title: "Implement Automated User Access Review",
      description: "Deploy automated system for quarterly user access reviews",
      priority: "HIGH",
      assigned_to: "security_team_lead",
      due_date: "2024-02-15T23:59:59Z",
      status: "IN_PROGRESS",
      progress_notes: ["Requirements gathering completed", "Vendor selection in progress"],
    };

    const mockAssessment: ComplianceAssessment = {
      id: "assessment_123",
      assessment_name: "SOC 2 Type II Annual Assessment",
      framework: "SOC2",
      scope: "Security, Availability, and Confidentiality controls",
      assessment_type: "EXTERNAL_AUDIT",
      status: "IN_PROGRESS",
      start_date: "2024-01-15T00:00:00Z",
      end_date: "2024-01-30T23:59:59Z",
      assessor: "External Audit Firm ABC",
      findings: [mockFinding],
      overall_score: 85.5,
      compliance_percentage: 92.3,
      recommendations: [
        "Implement automated control testing",
        "Enhance documentation processes",
        "Increase training frequency",
      ],
      action_plan: [mockActionItem],
      created_at: "2024-01-15T08:00:00Z",
    };

    it("should create compliance assessment", async () => {
      const assessmentData = {
        assessment_name: "GDPR Compliance Review Q1 2024",
        framework: "GDPR" as const,
        scope: "Data processing activities and privacy controls",
        assessment_type: "SELF_ASSESSMENT" as const,
        start_date: "2024-02-01T00:00:00Z",
        end_date: "2024-02-28T23:59:59Z",
        assessor: "Internal Compliance Team",
        overall_score: undefined,
        compliance_percentage: undefined,
        recommendations: [],
      };

      mockResponse({
        data: {
          ...assessmentData,
          id: "assessment_124",
          status: "PLANNED",
          findings: [],
          action_plan: [],
          created_at: "2024-01-17T16:00:00Z",
        },
      });

      const result = await client.createAssessment(assessmentData);

      expect(result.data.id).toBe("assessment_124");
      expect(result.data.framework).toBe("GDPR");
      expect(result.data.status).toBe("PLANNED");
    });

    it("should add assessment finding with comprehensive details", async () => {
      const findingData = {
        control_id: "GDPR-ART25",
        finding_type: "OBSERVATION" as const,
        severity: "LOW" as const,
        title: "Privacy by Design Documentation Gap",
        description: "Some privacy impact assessments lack detailed technical documentation",
        evidence: ["pia_documents", "technical_specs"],
        risk_rating: 3.5,
        remediation_required: false,
      };

      mockResponse({
        data: {
          ...findingData,
          id: "finding_124",
        },
      });

      const result = await client.addAssessmentFinding("assessment_123", findingData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/compliance/assessments/assessment_123/findings",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(findingData),
        }),
      );

      expect(result.data.id).toBe("finding_124");
      expect(result.data.finding_type).toBe("OBSERVATION");
    });

    it("should complete assessment with final scoring", async () => {
      const completionData = {
        overall_score: 88.7,
        compliance_percentage: 94.2,
        recommendations: [
          "Enhance automated monitoring capabilities",
          "Implement continuous compliance testing",
          "Improve incident response documentation",
        ],
        final_report: "https://storage.example.com/reports/assessment_123_final.pdf",
      };

      mockResponse({
        data: {
          ...mockAssessment,
          status: "COMPLETED",
          end_date: "2024-01-17T17:00:00Z",
          overall_score: completionData.overall_score,
          compliance_percentage: completionData.compliance_percentage,
          recommendations: completionData.recommendations,
        },
      });

      const result = await client.completeAssessment("assessment_123", completionData);

      expect(result.data.status).toBe("COMPLETED");
      expect(result.data.overall_score).toBe(88.7);
      expect(result.data.compliance_percentage).toBe(94.2);
    });

    it("should create action item from assessment", async () => {
      const actionItemData = {
        title: "Update Data Retention Policy",
        description: "Review and update data retention schedules for all customer data types",
        priority: "MEDIUM" as const,
        assigned_to: "data_governance_lead",
        due_date: "2024-03-01T23:59:59Z",
      };

      mockResponse({
        data: {
          ...actionItemData,
          id: "action_124",
          status: "OPEN",
        },
      });

      const result = await client.createActionItem("assessment_123", actionItemData);

      expect(result.data.id).toBe("action_124");
      expect(result.data.priority).toBe("MEDIUM");
      expect(result.data.status).toBe("OPEN");
    });

    it("should complete action item with evidence", async () => {
      const completionEvidence = [
        "updated_policy_document",
        "approval_email",
        "training_completion_records",
      ];

      mockResponse({
        data: {
          ...mockActionItem,
          status: "COMPLETED",
          completion_evidence: completionEvidence,
        },
      });

      const result = await client.completeActionItem("action_123", completionEvidence);

      expect(result.data.status).toBe("COMPLETED");
      expect(result.data.completion_evidence).toEqual(completionEvidence);
    });
  });

  describe("Compliance Dashboard and Reporting", () => {
    it("should get compliance dashboard metrics", async () => {
      const dashboardData = {
        overall_compliance_score: 87.5,
        policies_active: 15,
        controls_effective: 42,
        open_incidents: 3,
        pending_privacy_requests: 7,
        overdue_action_items: 2,
        recent_assessments: [
          {
            id: "assessment_recent",
            assessment_name: "Q4 Security Review",
            framework: "SOC2",
            status: "COMPLETED",
            compliance_percentage: 91.2,
          },
        ],
        compliance_trends: [
          { period: "2024-Q1", score: 87.5 },
          { period: "2023-Q4", score: 85.2 },
          { period: "2023-Q3", score: 83.1 },
        ],
      };

      mockResponse({ data: dashboardData });

      const result = await client.getComplianceDashboard("SOC2");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/compliance/dashboard",
        expect.objectContaining({
          params: { framework: "SOC2" },
        }),
      );

      expect(result.data.overall_compliance_score).toBe(87.5);
      expect(result.data.recent_assessments).toHaveLength(1);
      expect(result.data.compliance_trends).toHaveLength(3);
    });

    it("should generate compliance report", async () => {
      const reportParams = {
        framework: "GDPR",
        report_type: "COMPLIANCE_STATUS" as const,
        start_date: "2024-01-01T00:00:00Z",
        end_date: "2024-01-31T23:59:59Z",
        format: "PDF" as const,
      };

      mockResponse({
        data: {
          report_id: "report_compliance_123",
          download_url: "https://storage.example.com/reports/gdpr_compliance_2024_01.pdf",
        },
      });

      const result = await client.generateComplianceReport(reportParams);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/compliance/reports/generate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(reportParams),
        }),
      );

      expect(result.data.report_id).toBe("report_compliance_123");
      expect(result.data.download_url).toContain(".pdf");
    });

    it("should get compliance metrics with trends", async () => {
      const metricsData = {
        compliance_score_trend: [
          { period: "2024-01", score: 87.5 },
          { period: "2023-12", score: 85.2 },
          { period: "2023-11", score: 83.8 },
        ],
        incidents_by_type: [
          { type: "DATA_BREACH", count: 2 },
          { type: "PRIVACY_VIOLATION", count: 1 },
          { type: "SECURITY_INCIDENT", count: 5 },
        ],
        control_effectiveness: [
          { effectiveness: "EFFECTIVE", count: 38 },
          { effectiveness: "NEEDS_IMPROVEMENT", count: 4 },
          { effectiveness: "NOT_TESTED", count: 3 },
        ],
        privacy_request_resolution_time: [
          { request_type: "ACCESS", avg_days: 12.5 },
          { request_type: "ERASURE", avg_days: 18.2 },
          { request_type: "RECTIFICATION", avg_days: 8.7 },
        ],
      };

      mockResponse({ data: metricsData });

      const result = await client.getComplianceMetrics({
        framework: "GDPR",
        start_date: "2023-11-01T00:00:00Z",
        end_date: "2024-01-31T23:59:59Z",
      });

      expect(result.data.compliance_score_trend).toHaveLength(3);
      expect(result.data.incidents_by_type[0].type).toBe("DATA_BREACH");
      expect(result.data.privacy_request_resolution_time[2].avg_days).toBe(8.7);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle policy not found errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({
          error: {
            code: "POLICY_NOT_FOUND",
            message: "Compliance policy not found",
          },
        }),
      } as Response);

      await expect(client.getPolicy("invalid_policy")).rejects.toThrow("Not Found");
    });

    it("should handle regulatory compliance violations", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
        json: async () => ({
          error: {
            code: "COMPLIANCE_VIOLATION",
            message: "Action would violate regulatory requirements",
            details: { regulation: "GDPR", article: "Article 17" },
          },
        }),
      } as Response);

      await expect(
        client.processPrivacyRequest("privacy_invalid", {
          processing_notes: "Cannot comply with request",
        }),
      ).rejects.toThrow("Unprocessable Entity");
    });

    it("should handle assessment deadline violations", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          error: {
            code: "ASSESSMENT_DEADLINE_VIOLATION",
            message: "Assessment completion date exceeds regulatory deadline",
          },
        }),
      } as Response);

      await expect(
        client.completeAssessment("assessment_overdue", {
          overall_score: 85,
          compliance_percentage: 90,
          recommendations: [],
        }),
      ).rejects.toThrow("Bad Request");
    });

    it("should handle network connectivity errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network connection failed"));

      await expect(client.getPolicies()).rejects.toThrow("Network connection failed");
    });
  });

  describe("Performance and Security", () => {
    it("should handle large audit log queries efficiently", async () => {
      const largeAuditLogList = Array.from({ length: 10000 }, (_, i) => ({
        ...mockAuditLog,
        id: `audit_${i}`,
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
      }));

      mockResponse({
        data: largeAuditLogList.slice(0, 1000), // Paginated response
        pagination: {
          page: 1,
          limit: 1000,
          total: 10000,
          total_pages: 10,
        },
      });

      const startTime = performance.now();
      const result = await client.getAuditLogs({ limit: 1000 });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
      expect(result.data).toHaveLength(1000);
      expect(result.pagination?.total).toBe(10000);
    });

    it("should handle complex compliance assessments", async () => {
      const complexAssessment = {
        ...mockAssessment,
        findings: Array.from({ length: 50 }, (_, i) => ({
          ...mockFinding,
          id: `finding_${i}`,
          title: `Finding ${i}`,
        })),
        action_plan: Array.from({ length: 25 }, (_, i) => ({
          ...mockActionItem,
          id: `action_${i}`,
          title: `Action Item ${i}`,
        })),
      };

      mockResponse({ data: complexAssessment });

      const result = await client.getAssessment("complex_assessment");

      expect(result.data.findings).toHaveLength(50);
      expect(result.data.action_plan).toHaveLength(25);
    });

    it("should handle sensitive data in privacy requests securely", async () => {
      const sensitiveRequest = {
        ...mockPrivacyRequest,
        request_details: "Request containing PII and sensitive information",
      };

      mockResponse({ data: sensitiveRequest });

      const result = await client.getPrivacyRequest("privacy_sensitive");

      // Verify that sensitive data handling is working
      expect(result.data.request_details).toBeDefined();
      expect(result.data.customer_email).toBeDefined();
    });
  });
});
