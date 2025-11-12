import {
  CUSTOMER_PORTAL_TOKEN_KEY,
  setPortalAuthToken,
} from "./operatorAuth";

interface ImpersonationOptions {
  customerId: string;
  baseUrl?: string;
  buildHeaders: () => Record<string, string>;
  fetchImpl?: typeof fetch;
}

const normalizeBaseUrl = (value?: string | null) => {
  if (!value) {
    return "";
  }
  return value.replace(/\/+$/, "");
};

/**
 * Request an impersonation token for a customer and persist it to session storage.
 */
export async function impersonateCustomer({
  customerId,
  baseUrl,
  buildHeaders,
  fetchImpl = fetch,
}: ImpersonationOptions): Promise<string> {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const url = `${normalizedBase}/api/v1/customers/${customerId}/impersonate`;

  const response = await fetchImpl(url, {
    method: "POST",
    credentials: "include",
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to generate impersonation token");
  }

  const data = await response.json();
  const token = data?.access_token;
  if (!token) {
    throw new Error("Received empty impersonation token");
  }

  setPortalAuthToken(token, CUSTOMER_PORTAL_TOKEN_KEY);
  return token;
}
