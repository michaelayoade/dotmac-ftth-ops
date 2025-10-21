import { Page, Locator } from "@playwright/test";

export class MFAPage {
  readonly page: Page;
  readonly setupTitle: Locator;
  readonly verificationTitle: Locator;
  readonly qrCode: Locator;
  readonly manualEntryKey: Locator;
  readonly totpInput: Locator;
  readonly verifyButton: Locator;
  readonly backupCodeInput: Locator;
  readonly verifyBackupCodeButton: Locator;
  readonly useBackupCodeLink: Locator;
  readonly backupCodeTitle: Locator;
  readonly errorMessage: Locator;
  readonly formatError: Locator;
  readonly rememberDeviceCheckbox: Locator;
  readonly lostDeviceLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.setupTitle = page.locator('h1:has-text("Set up"), h2:has-text("Two-Factor")');
    this.verificationTitle = page.locator(
      'h1:has-text("Enter"), h2:has-text("Authentication Code")',
    );
    this.qrCode = page.locator('.qr-code, canvas, img[alt*="QR"]');
    this.manualEntryKey = page.locator('.manual-entry, .secret-key, [data-testid="secret-key"]');
    this.totpInput = page.locator(
      'input[name="totp"], input[name="code"], input[placeholder*="6"], input[maxlength="6"]',
    );
    this.verifyButton = page.locator(
      'button:has-text("Verify"), button:has-text("Continue"), button[type="submit"]',
    );
    this.backupCodeInput = page.locator('input[name="backup"], input[placeholder*="backup"]');
    this.verifyBackupCodeButton = page.locator(
      'button:has-text("Verify backup"), button:has-text("Use backup code")',
    );
    this.useBackupCodeLink = page.locator('a:has-text("backup"), button:has-text("backup code")');
    this.backupCodeTitle = page.locator('h1:has-text("Backup"), h2:has-text("Backup Code")');
    this.errorMessage = page.locator('.error-message, .alert-error, [role="alert"]');
    this.formatError = page.locator(".format-error, .validation-error");
    this.rememberDeviceCheckbox = page.locator(
      'input[name="remember"], input:near(:text("Remember device"))',
    );
    this.lostDeviceLink = page.locator(
      'a:has-text("lost"), a:has-text("Lost device"), a:has-text("Can\'t access")',
    );
  }

  async fillTOTPCode(code: string): Promise<void> {
    await this.totpInput.fill(code);
  }

  async fillBackupCode(code: string): Promise<void> {
    await this.backupCodeInput.fill(code);
  }

  async clickVerify(): Promise<void> {
    await this.verifyButton.click();
  }

  async clickVerifyBackupCode(): Promise<void> {
    await this.verifyBackupCodeButton.click();
  }

  async clickUseBackupCode(): Promise<void> {
    await this.useBackupCodeLink.click();
  }

  async toggleRememberDevice(): Promise<void> {
    await this.rememberDeviceCheckbox.check();
  }

  async getSecretKey(): Promise<string> {
    const text = await this.manualEntryKey.textContent();
    return text?.trim() || "";
  }

  async getErrorText(): Promise<string> {
    return (await this.errorMessage.textContent()) || "";
  }

  async waitForQRCode(): Promise<void> {
    await this.qrCode.waitFor({ state: "visible" });
  }

  async waitForVerificationForm(): Promise<void> {
    await this.totpInput.waitFor({ state: "visible" });
  }

  async waitForBackupCodeForm(): Promise<void> {
    await this.backupCodeInput.waitFor({ state: "visible" });
  }
}
