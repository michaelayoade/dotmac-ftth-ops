/**
 * Minimal API manager used by tests to coordinate API clients.
 * The real implementation would orchestrate shared clients, but tests mock it.
 */
export class ApiManager {
  constructor() {}

  getIdentityClient() {
    return null;
  }

  getBillingClient() {
    return null;
  }

  getAuthClient() {
    return null;
  }
}
