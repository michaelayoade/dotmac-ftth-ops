/**
 * MSW Handlers for Domain Verification API
 * Mocks domain verification workflow endpoints
 */

import { http, HttpResponse } from "msw";

// Types
type VerificationMethod = "dns_txt" | "dns_cname" | "meta_tag" | "file_upload";
type VerificationStatus = "pending" | "verified" | "failed" | "expired";

interface DomainStatus {
  tenant_id: string;
  domain: string | null;
  is_verified: boolean;
  verified_at?: string;
  status?: VerificationStatus;
  method?: VerificationMethod;
  token?: string;
  expires_at?: string;
}

// In-memory storage
let domainStatuses: Map<string, DomainStatus> = new Map();
let tokenCounter = 1;

// Factory functions
function createMockDNSInstruction(method: VerificationMethod, token: string) {
  switch (method) {
    case "dns_txt":
      return {
        type: "TXT",
        name: "_dotmac-verify",
        value: token,
        ttl: 300,
      };
    case "dns_cname":
      return {
        type: "CNAME",
        name: "_dotmac-verify",
        target: `verify-${token}.dotmac.cloud`,
        ttl: 300,
      };
    default:
      return {
        type: "TXT",
        name: "_dotmac-verify",
        value: token,
        ttl: 300,
      };
  }
}

function createMockVerificationInstructions(method: VerificationMethod, token: string) {
  switch (method) {
    case "dns_txt":
      return {
        type: "DNS TXT Record",
        description: "Add the following TXT record to your DNS configuration",
        steps: [
          "Log in to your DNS provider's control panel",
          "Add a new TXT record with the details below",
          "Wait for DNS propagation (usually 5-30 minutes)",
          "Click 'Verify' to check the record",
        ],
        dns_record: createMockDNSInstruction(method, token),
        verification_command: `dig TXT _dotmac-verify.yourdomain.com`,
      };
    case "dns_cname":
      return {
        type: "DNS CNAME Record",
        description: "Add the following CNAME record to your DNS configuration",
        steps: [
          "Log in to your DNS provider's control panel",
          "Add a new CNAME record with the details below",
          "Wait for DNS propagation (usually 5-30 minutes)",
          "Click 'Verify' to check the record",
        ],
        dns_record: createMockDNSInstruction(method, token),
        verification_command: `dig CNAME _dotmac-verify.yourdomain.com`,
      };
    case "meta_tag":
      return {
        type: "HTML Meta Tag",
        description: "Add the following meta tag to your website's homepage",
        steps: [
          "Open your website's homepage HTML file",
          "Add the meta tag in the <head> section",
          "Deploy the changes to your server",
          "Click 'Verify' to check the tag",
        ],
        verification_command: `<meta name="dotmac-domain-verification" content="${token}" />`,
      };
    case "file_upload":
      return {
        type: "File Upload",
        description: "Upload a verification file to your website",
        steps: [
          "Download the verification file",
          "Upload it to your website's root directory",
          "Ensure the file is accessible at /.well-known/dotmac-verify.txt",
          "Click 'Verify' to check the file",
        ],
        verification_command: `curl https://yourdomain.com/.well-known/dotmac-verify.txt`,
      };
    default:
      return {
        type: "DNS TXT Record",
        description: "Add the following TXT record to your DNS configuration",
        steps: ["Add DNS record", "Wait for propagation", "Click verify"],
        dns_record: createMockDNSInstruction(method, token),
      };
  }
}

function createMockVerificationResponse(
  domain: string,
  method: VerificationMethod,
  status: VerificationStatus = "pending",
  data: Partial<any> = {},
) {
  const token = data.token || `dotmac-verify-${tokenCounter++}-${Date.now()}`;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const response: any = {
    domain,
    status,
    method,
    ...data,
  };

  if (status === "pending") {
    response.token = token;
    response.expires_at = expiresAt;
    response.instructions = createMockVerificationInstructions(method, token);
  }

  if (status === "verified") {
    response.verified_at = data.verified_at || now;
  }

  if (status === "failed") {
    response.error_message =
      data.error_message || "Verification failed. Please check your DNS records.";
  }

  if (status === "expired") {
    response.error_message =
      data.error_message || "Verification token has expired. Please initiate verification again.";
  }

  return response;
}

function createMockStatusResponse(
  tenantId: string,
  data: Partial<DomainStatus> = {},
): DomainStatus {
  return {
    tenant_id: tenantId,
    domain: data.domain || null,
    is_verified: data.is_verified || false,
    verified_at: data.verified_at,
    status: data.status,
    method: data.method,
    token: data.token,
    expires_at: data.expires_at,
  };
}

// Seed functions
export function seedDomainStatus(tenantId: string, status: Partial<DomainStatus>): void {
  domainStatuses.set(tenantId, createMockStatusResponse(tenantId, status));
}

export function seedDomainStatuses(
  statuses: Array<{ tenantId: string; status: Partial<DomainStatus> }>,
): void {
  statuses.forEach(({ tenantId, status }) => {
    seedDomainStatus(tenantId, status);
  });
}

export function clearDomainStatuses(): void {
  domainStatuses.clear();
  tokenCounter = 1;
}

export const domainVerificationHandlers = [
  // POST /api/v1/tenants/:tenantId/domains/verify - Initiate verification
  http.post("*/api/v1/tenants/:tenantId/domains/verify", async (req) => {
    const { tenantId } = req.params;
    const body = await req.json<{ domain: string; method: VerificationMethod }>();

    const method = body.method || "dns_txt";
    const response = createMockVerificationResponse(body.domain, method, "pending");

    // Store in domain statuses
    domainStatuses.set(tenantId as string, {
      tenant_id: tenantId as string,
      domain: body.domain,
      is_verified: false,
      status: "pending",
      method,
      token: response.token,
      expires_at: response.expires_at,
    });

    return HttpResponse.json(response);
  }),

  // POST /api/v1/tenants/:tenantId/domains/check - Check verification
  http.post("*/api/v1/tenants/:tenantId/domains/check", async (req) => {
    const { tenantId } = req.params;
    const body = await req.json<{ domain: string; token: string; method: VerificationMethod }>();
    const existing = domainStatuses.get(tenantId as string);

    // Check if token matches and hasn't expired
    const tokenMatches = existing?.token === body.token;
    const now = Date.now();
    const expiresAt = existing?.expires_at ? new Date(existing.expires_at).getTime() : now + 1000;
    const isExpired = now > expiresAt;

    let status: VerificationStatus = "verified";
    let errorMessage: string | undefined;

    if (isExpired) {
      status = "expired";
      errorMessage = "Verification token has expired. Please initiate verification again.";
    } else if (!tokenMatches) {
      status = "failed";
      errorMessage = "Invalid verification token or DNS record not found.";
    }

    const method = body.method || existing?.method || "dns_txt";
    const response = createMockVerificationResponse(body.domain, method, status, {
      token: body.token,
      error_message: errorMessage,
    });

    // Update domain status
    if (status === "verified") {
      domainStatuses.set(tenantId as string, {
        tenant_id: tenantId as string,
        domain: body.domain,
        is_verified: true,
        verified_at: response.verified_at,
        status: "verified",
        method,
      });
    } else {
      // Keep existing status but update the status field
      if (existing) {
        domainStatuses.set(tenantId as string, {
          ...existing,
          status,
        });
      }
    }

    return HttpResponse.json(response);
  }),

  // DELETE /api/v1/tenants/:tenantId/domains - Remove domain
  http.delete("*/api/v1/tenants/:tenantId/domains", ({ params }) => {
    const tenantId = params.tenantId as string;
    const existing = domainStatuses.get(tenantId as string);

    const response = {
      domain: existing?.domain || "unknown.com",
      status: "removed",
      removed_at: new Date().toISOString(),
    };

    domainStatuses.delete(tenantId as string);
    return HttpResponse.json(response);
  }),

  // GET /api/v1/tenants/:tenantId/domains/status - Get status
  http.get("*/api/v1/tenants/:tenantId/domains/status", ({ params }) => {
    const tenantId = params.tenantId as string;
    const status =
      domainStatuses.get(tenantId as string) || createMockStatusResponse(tenantId as string);
    return HttpResponse.json(status);
  }),
];
