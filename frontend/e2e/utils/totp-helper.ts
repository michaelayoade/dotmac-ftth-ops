import { createHmac } from "crypto";

/**
 * TOTP (Time-based One-Time Password) helper for E2E testing
 * Based on RFC 6238 specification
 */

/**
 * Convert a base32 string to buffer
 */
function base32ToBuffer(base32: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  let buffer = Buffer.alloc(0);

  // Remove any whitespace and convert to uppercase
  base32 = base32.replace(/\s/g, "").toUpperCase();

  // Convert each character to its 5-bit binary representation
  for (const char of base32) {
    const index = alphabet.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid base32 character: ${char}`);
    }
    bits += index.toString(2).padStart(5, "0");
  }

  // Convert bits to bytes
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    const byte = bits.substr(i, 8);
    if (byte.length === 8) {
      bytes.push(parseInt(byte, 2));
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generate HOTP (HMAC-based One-Time Password)
 */
function generateHOTP(secret: Buffer, counter: number, digits: number = 6): string {
  // Convert counter to 8-byte buffer (big-endian)
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter & 0xffffffff, 4);

  // Generate HMAC-SHA1
  const hmac = createHmac("sha1", secret);
  hmac.update(counterBuffer);
  const hash = hmac.digest();

  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0x0f;
  const truncatedHash = hash.subarray(offset, offset + 4);

  // Convert to 31-bit positive integer
  const code =
    (((truncatedHash[0] & 0x7f) << 24) |
      (truncatedHash[1] << 16) |
      (truncatedHash[2] << 8) |
      truncatedHash[3]) >>>
    0;

  // Generate the final OTP
  const otp = (code % Math.pow(10, digits)).toString().padStart(digits, "0");

  return otp;
}

/**
 * Generate TOTP (Time-based One-Time Password)
 */
export function generateTOTP(
  secret: string,
  timeStamp?: number,
  timeStep: number = 30,
  digits: number = 6,
): string {
  // Use current time if not provided
  const time = timeStamp || Date.now();

  // Convert time to counter (number of time steps since epoch)
  const counter = Math.floor(time / 1000 / timeStep);

  // Convert secret from base32 to buffer
  const secretBuffer = base32ToBuffer(secret);

  // Generate HOTP
  return generateHOTP(secretBuffer, counter, digits);
}

/**
 * Verify TOTP code with time window tolerance
 */
export function verifyTOTP(
  secret: string,
  token: string,
  timeStamp?: number,
  window: number = 1,
  timeStep: number = 30,
): boolean {
  const time = timeStamp || Date.now();
  const counter = Math.floor(time / 1000 / timeStep);

  // Check current time and adjacent time windows
  for (let i = -window; i <= window; i++) {
    const testToken = generateTOTP(secret, (counter + i) * timeStep * 1000, timeStep);
    if (testToken === token) {
      return true;
    }
  }

  return false;
}

/**
 * Generate a random base32 secret for testing
 */
export function generateRandomSecret(length: number = 32): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let secret = "";

  for (let i = 0; i < length; i++) {
    secret += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return secret;
}

/**
 * Generate multiple backup codes for testing
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric backup code
    let code = "";
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    for (let j = 0; j < 8; j++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    // Format as XXXX-XXXX
    const formattedCode = code.substring(0, 4) + "-" + code.substring(4);
    codes.push(formattedCode);
  }

  return codes;
}

/**
 * Test helper to simulate different TOTP scenarios
 */
export class TOTPTestHelper {
  private secret: string;

  constructor(secret?: string) {
    this.secret = secret || generateRandomSecret();
  }

  getSecret(): string {
    return this.secret;
  }

  getCurrentCode(): string {
    return generateTOTP(this.secret);
  }

  getCodeAtTime(timestamp: number): string {
    return generateTOTP(this.secret, timestamp);
  }

  getExpiredCode(): string {
    // Generate code from 2 minutes ago
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
    return generateTOTP(this.secret, twoMinutesAgo);
  }

  getFutureCode(): string {
    // Generate code from 2 minutes in the future
    const twoMinutesFromNow = Date.now() + 2 * 60 * 1000;
    return generateTOTP(this.secret, twoMinutesFromNow);
  }

  getInvalidCode(): string {
    // Return a code that will never be valid
    return "000000";
  }

  verify(token: string, timestamp?: number): boolean {
    return verifyTOTP(this.secret, token, timestamp);
  }

  generateQRCodeURL(issuer: string, accountName: string, issuerName?: string): string {
    const label = encodeURIComponent(`${issuer}:${accountName}`);
    const params = new URLSearchParams({
      secret: this.secret,
      issuer: issuerName || issuer,
      algorithm: "SHA1",
      digits: "6",
      period: "30",
    });

    return `otpauth://totp/${label}?${params.toString()}`;
  }
}

/**
 * Mock authenticator app for testing
 */
export class MockAuthenticatorApp {
  private accounts: Map<string, TOTPTestHelper> = new Map();

  addAccount(name: string, secret: string): void {
    this.accounts.set(name, new TOTPTestHelper(secret));
  }

  removeAccount(name: string): void {
    this.accounts.delete(name);
  }

  getCode(accountName: string): string {
    const helper = this.accounts.get(accountName);
    if (!helper) {
      throw new Error(`Account ${accountName} not found`);
    }
    return helper.getCurrentCode();
  }

  getAllCodes(): Record<string, string> {
    const codes: Record<string, string> = {};
    for (const [name, helper] of this.accounts) {
      codes[name] = helper.getCurrentCode();
    }
    return codes;
  }

  getAccountCount(): number {
    return this.accounts.size;
  }

  listAccounts(): string[] {
    return Array.from(this.accounts.keys());
  }
}
