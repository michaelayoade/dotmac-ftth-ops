import Cookies from "js-cookie";
import type { TenantConfig } from "./types";

export class TenantResolver {
  private config: TenantConfig;

  constructor(config: TenantConfig) {
    this.config = config;
  }

  getTenantId(): string | null {
    const { source, tenantId } = this.config;

    switch (source) {
      case "header":
        return tenantId;

      case "subdomain":
        return this.extractTenantFromSubdomain();

      case "query":
        return this.extractTenantFromQuery();

      case "cookie":
        return this.extractTenantFromCookie();

      default:
        return tenantId || null;
    }
  }

  private extractTenantFromSubdomain(): string | null {
    if (typeof window === "undefined") return null;

    const hostname = window.location.hostname;
    const parts = hostname.split(".");

    // Extract tenant from subdomain (e.g., tenant.example.com -> tenant)
    if (parts.length > 2) {
      return parts[0];
    }

    return null;
  }

  private extractTenantFromQuery(): string | null {
    if (typeof window === "undefined") return null;

    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("tenant") || urlParams.get("tenantId");
  }

  private extractTenantFromCookie(): string | null {
    return Cookies.get("tenant-id") || Cookies.get("tenantId") || null;
  }

  static fromHostname(): TenantResolver {
    const tenantId = typeof window !== "undefined" ? window.location.hostname.split(".")[0] : "";

    return new TenantResolver({
      tenantId,
      source: "subdomain",
    });
  }

  static fromConfig(tenantId: string): TenantResolver {
    return new TenantResolver({
      tenantId,
      source: "header",
    });
  }
}
