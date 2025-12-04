import { Page, Locator } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly rememberMeCheckbox: Locator;
  readonly forgotPasswordLink: Locator;
  readonly signUpLink: Locator;
  readonly errorMessage: Locator;
  readonly emailError: Locator;
  readonly passwordError: Locator;
  readonly loadingSpinner: Locator;
  readonly sessionExpiredMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[name="email"], input[type="email"]');
    this.passwordInput = page.locator('input[name="password"], input[type="password"]');
    this.loginButton = page.locator(
      'button[type="submit"], button:has-text("Sign in"), button:has-text("Login")',
    );
    this.rememberMeCheckbox = page.locator(
      'input[name="remember"], input[type="checkbox"]:near(:text("Remember"))',
    );
    this.forgotPasswordLink = page.locator('a:has-text("Forgot"), a:has-text("Reset password")');
    this.signUpLink = page.locator(
      'a:has-text("Sign up"), a:has-text("Create account"), a:has-text("Register")',
    );
    this.errorMessage = page.locator('.error-message, .alert-error, [role="alert"]');
    this.emailError = page.locator(
      '.email-error, input[name="email"] + .error, .field-error:near(input[name="email"])',
    );
    this.passwordError = page.locator(
      '.password-error, input[name="password"] + .error, .field-error:near(input[name="password"])',
    );
    this.loadingSpinner = page.locator('.loading, .spinner, [data-testid="loading-spinner"]');
    this.sessionExpiredMessage = page.locator(
      '.session-expired, :text("Session expired"), :text("Please log in again")',
    );
  }

  async goto(): Promise<void> {
    await this.page.goto("/login");
  }

  async fillEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  async toggleRememberMe(): Promise<void> {
    await this.rememberMeCheckbox.check();
  }

  async clickLogin(): Promise<void> {
    await this.loginButton.click();
  }

  async login(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickLogin();
  }

  async getErrorText(): Promise<string> {
    return (await this.errorMessage.textContent()) || "";
  }

  async isLoading(): Promise<boolean> {
    return await this.loadingSpinner.isVisible();
  }

  async waitForError(): Promise<void> {
    await this.errorMessage.waitFor({ state: "visible" });
  }

  async waitForRedirect(): Promise<void> {
    await this.page.waitForURL(/dashboard/, { timeout: 10000 });
  }
}
