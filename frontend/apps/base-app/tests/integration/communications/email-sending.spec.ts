/**
 * Communications Email Sending Integration Tests
 *
 * Tests for email composition, sending, and queueing functionality.
 */

import { test, expect } from '@playwright/test';
import { EmailComposerPage, CommunicationsDashboard } from '../../helpers/page-objects';
import { generateTestUser, generateTestEmail, generateTestTemplate } from '../../fixtures/test-data';
import {
  createTestUser,
  loginUser,
  sendEmail,
  queueEmail,
  createTemplate,
  cleanupTemplates,
  waitForToast,
} from '../../helpers/api-helpers';

test.describe('Communications Email Sending', () => {
  let authToken: string;

  test.beforeEach(async ({ page }) => {
    // Create and login user
    const testUser = generateTestUser();
    await createTestUser(testUser);
    authToken = await loginUser(page, testUser.email, testUser.password);
  });

  test.afterEach(async () => {
    // Cleanup
    await cleanupTemplates(authToken);
  });

  test.describe('Email Composition', () => {
    test('should compose and send email with valid data', async ({ page }) => {
      // Arrange
      const emailData = generateTestEmail();
      const composerPage = new EmailComposerPage(page);
      await composerPage.navigate();

      // Act
      await composerPage.composeEmail(emailData);
      await composerPage.send();

      // Assert
      await expect(page.locator('text=Email sent successfully')).toBeVisible();
    });

    test('should show validation error for empty recipient', async ({ page }) => {
      // Arrange
      const composerPage = new EmailComposerPage(page);
      await composerPage.navigate();

      // Act
      await composerPage.subjectInput.fill('Test Subject');
      await composerPage.bodyTextarea.fill('Test Body');
      await composerPage.send();

      // Assert
      await expect(page.locator('text=Recipient email is required')).toBeVisible();
    });

    test('should show validation error for invalid email format', async ({ page }) => {
      // Arrange
      const composerPage = new EmailComposerPage(page);
      await composerPage.navigate();

      // Act
      await composerPage.toInput.fill('invalid-email');
      await composerPage.subjectInput.fill('Test Subject');
      await composerPage.bodyTextarea.fill('Test Body');
      await composerPage.send();

      // Assert
      await expect(page.locator('text=Invalid email format')).toBeVisible();
    });

    test('should show validation error for empty subject', async ({ page }) => {
      // Arrange
      const composerPage = new EmailComposerPage(page);
      await composerPage.navigate();

      // Act
      await composerPage.toInput.fill('test@example.com');
      await composerPage.bodyTextarea.fill('Test Body');
      await composerPage.send();

      // Assert
      await expect(page.locator('text=Subject is required')).toBeVisible();
    });

    test('should show validation error for empty body', async ({ page }) => {
      // Arrange
      const composerPage = new EmailComposerPage(page);
      await composerPage.navigate();

      // Act
      await composerPage.toInput.fill('test@example.com');
      await composerPage.subjectInput.fill('Test Subject');
      await composerPage.send();

      // Assert
      await expect(page.locator('text=Email body is required')).toBeVisible();
    });

    test('should allow multiple recipients', async ({ page }) => {
      // Arrange
      const composerPage = new EmailComposerPage(page);
      await composerPage.navigate();

      // Act
      await composerPage.toInput.fill('user1@example.com, user2@example.com, user3@example.com');
      await composerPage.subjectInput.fill('Test Subject');
      await composerPage.bodyTextarea.fill('Test Body');
      await composerPage.send();

      // Assert
      await expect(page.locator('text=Email sent successfully')).toBeVisible();
    });

    test('should validate all recipients in multiple recipient list', async ({ page }) => {
      // Arrange
      const composerPage = new EmailComposerPage(page);
      await composerPage.navigate();

      // Act
      await composerPage.toInput.fill('valid@example.com, invalid-email, another@example.com');
      await composerPage.send();

      // Assert
      await expect(page.locator('text=Invalid email format: invalid-email')).toBeVisible();
    });

    test('should allow CC recipients', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/send');

      // Act
      await page.fill('[name="to"]', 'primary@example.com');
      await page.fill('[name="cc"]', 'cc@example.com');
      await page.fill('[name="subject"]', 'Test Subject');
      await page.fill('[name="body_text"]', 'Test Body');
      await page.click('button:has-text("Send Now")');

      // Assert
      await expect(page.locator('text=Email sent successfully')).toBeVisible();
    });

    test('should allow BCC recipients', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/send');

      // Act
      await page.fill('[name="to"]', 'primary@example.com');
      await page.fill('[name="bcc"]', 'bcc@example.com');
      await page.fill('[name="subject"]', 'Test Subject');
      await page.fill('[name="body_text"]', 'Test Body');
      await page.click('button:has-text("Send Now")');

      // Assert
      await expect(page.locator('text=Email sent successfully')).toBeVisible();
    });
  });

  test.describe('Email Queueing', () => {
    test('should queue email for later delivery', async ({ page }) => {
      // Arrange
      const emailData = generateTestEmail();
      await page.goto('/dashboard/communications/send');

      // Act
      await page.fill('[name="to"]', emailData.to);
      await page.fill('[name="subject"]', emailData.subject);
      await page.fill('[name="body_text"]', emailData.body_text!);
      await page.click('button:has-text("Queue for Later")');

      // Assert
      await expect(page.locator('text=Email queued successfully')).toBeVisible();
    });

    test('should allow scheduling email for specific time', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/send');
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 2);

      // Act
      await page.fill('[name="to"]', 'test@example.com');
      await page.fill('[name="subject"]', 'Scheduled Email');
      await page.fill('[name="body_text"]', 'This will be sent later');
      await page.click('[data-testid="schedule-toggle"]');
      await page.fill('[name="scheduled_at"]', futureDate.toISOString().slice(0, 16));
      await page.click('button:has-text("Schedule")');

      // Assert
      await expect(page.locator('text=Email scheduled successfully')).toBeVisible();
    });

    test('should not allow scheduling in the past', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/send');
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 2);

      // Act
      await page.fill('[name="to"]', 'test@example.com');
      await page.fill('[name="subject"]', 'Test');
      await page.fill('[name="body_text"]', 'Body');
      await page.click('[data-testid="schedule-toggle"]');
      await page.fill('[name="scheduled_at"]', pastDate.toISOString().slice(0, 16));
      await page.click('button:has-text("Schedule")');

      // Assert
      await expect(page.locator('text=Scheduled time must be in the future')).toBeVisible();
    });
  });

  test.describe('Template Usage', () => {
    test('should send email using template', async ({ page }) => {
      // Arrange - Create template
      const template = generateTestTemplate();
      const createdTemplate = await createTemplate(template, authToken);

      await page.goto('/dashboard/communications/send');

      // Act
      await page.fill('[name="to"]', 'test@example.com');
      await page.click('[data-testid="use-template"]');
      await page.click(`[data-template-id="${createdTemplate.id}"]`);
      await page.click('button:has-text("Send Now")');

      // Assert
      await expect(page.locator('text=Email sent successfully')).toBeVisible();
    });

    test('should populate subject and body from template', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate({
        subject: 'Welcome {{ name }}',
        body_text: 'Hello {{ name }}, welcome to our service!',
      });
      const createdTemplate = await createTemplate(template, authToken);

      await page.goto('/dashboard/communications/send');

      // Act
      await page.click('[data-testid="use-template"]');
      await page.click(`[data-template-id="${createdTemplate.id}"]`);

      // Assert
      await expect(page.locator('[name="subject"]')).toHaveValue('Welcome {{ name }}');
      await expect(page.locator('[name="body_text"]')).toContainText('Hello {{ name }}');
    });

    test('should show template variable inputs', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate({
        subject: 'Hello {{ name }}',
        body_text: 'Your code is {{ code }}',
      });
      const createdTemplate = await createTemplate(template, authToken);

      await page.goto('/dashboard/communications/send');

      // Act
      await page.click('[data-testid="use-template"]');
      await page.click(`[data-template-id="${createdTemplate.id}"]`);

      // Assert
      await expect(page.locator('[data-testid="variable-input-name"]')).toBeVisible();
      await expect(page.locator('[data-testid="variable-input-code"]')).toBeVisible();
    });

    test('should require template variables', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate({
        subject: 'Hello {{ name }}',
        body_text: 'Welcome!',
      });
      const createdTemplate = await createTemplate(template, authToken);

      await page.goto('/dashboard/communications/send');

      // Act
      await page.fill('[name="to"]', 'test@example.com');
      await page.click('[data-testid="use-template"]');
      await page.click(`[data-template-id="${createdTemplate.id}"]`);
      await page.click('button:has-text("Send Now")');

      // Assert
      await expect(page.locator('text=Variable "name" is required')).toBeVisible();
    });

    test('should substitute template variables', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate({
        subject: 'Hello {{ name }}',
        body_text: 'Your account: {{ account_id }}',
      });
      const createdTemplate = await createTemplate(template, authToken);

      await page.goto('/dashboard/communications/send');

      // Act
      await page.fill('[name="to"]', 'test@example.com');
      await page.click('[data-testid="use-template"]');
      await page.click(`[data-template-id="${createdTemplate.id}"]`);
      await page.fill('[data-testid="variable-input-name"]', 'John Doe');
      await page.fill('[data-testid="variable-input-account_id"]', 'ACC-12345');

      // Click preview
      await page.click('button:has-text("Preview")');

      // Assert
      await expect(page.locator('[data-testid="preview-subject"]')).toContainText('Hello John Doe');
      await expect(page.locator('[data-testid="preview-body"]')).toContainText('Your account: ACC-12345');
    });
  });

  test.describe('Email Preview', () => {
    test('should preview email before sending', async ({ page }) => {
      // Arrange
      const composerPage = new EmailComposerPage(page);
      await composerPage.navigate();

      await composerPage.toInput.fill('test@example.com');
      await composerPage.subjectInput.fill('Test Subject');
      await composerPage.bodyTextarea.fill('Test Body Content');

      // Act
      await composerPage.preview();

      // Assert
      await expect(page.locator('[data-testid="email-preview"]')).toBeVisible();
      await expect(page.locator('[data-testid="preview-to"]')).toContainText('test@example.com');
      await expect(page.locator('[data-testid="preview-subject"]')).toContainText('Test Subject');
      await expect(page.locator('[data-testid="preview-body"]')).toContainText('Test Body Content');
    });

    test('should render HTML in preview', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/send');

      // Act
      await page.fill('[name="to"]', 'test@example.com');
      await page.fill('[name="subject"]', 'HTML Test');
      await page.fill('[name="body_html"]', '<h1>Hello</h1><p>This is <strong>bold</strong></p>');
      await page.click('button:has-text("Preview")');

      // Assert
      const preview = page.locator('[data-testid="preview-body"]');
      await expect(preview.locator('h1')).toContainText('Hello');
      await expect(preview.locator('strong')).toContainText('bold');
    });

    test('should allow editing after preview', async ({ page }) => {
      // Arrange
      const composerPage = new EmailComposerPage(page);
      await composerPage.navigate();

      await composerPage.toInput.fill('test@example.com');
      await composerPage.subjectInput.fill('Original Subject');
      await composerPage.bodyTextarea.fill('Original Body');

      // Act
      await composerPage.preview();
      await page.click('button:has-text("Edit")');

      await composerPage.subjectInput.fill('Updated Subject');

      // Assert
      await expect(composerPage.subjectInput).toHaveValue('Updated Subject');
    });
  });

  test.describe('Attachments', () => {
    test('should allow uploading attachments', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/send');

      // Act
      await page.fill('[name="to"]', 'test@example.com');
      await page.fill('[name="subject"]', 'Email with Attachment');
      await page.fill('[name="body_text"]', 'Please see attached file');

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test-document.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('PDF content'),
      });

      // Assert
      await expect(page.locator('text=test-document.pdf')).toBeVisible();
    });

    test('should show file size for attachments', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/send');

      // Act
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'large-file.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.alloc(1024 * 1024 * 2), // 2 MB
      });

      // Assert
      await expect(page.locator('text=/2(\\.0)?\\s*MB/i')).toBeVisible();
    });

    test('should allow removing attachments', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/send');

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('content'),
      });

      await expect(page.locator('text=test.pdf')).toBeVisible();

      // Act
      await page.click('[data-testid="remove-attachment-0"]');

      // Assert
      await expect(page.locator('text=test.pdf')).not.toBeVisible();
    });

    test('should validate attachment file size limit', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/send');

      // Act
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'huge-file.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.alloc(1024 * 1024 * 11), // 11 MB (over 10 MB limit)
      });

      // Assert
      await expect(page.locator('text=File size exceeds maximum allowed (10 MB)')).toBeVisible();
    });

    test('should allow multiple attachments', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/send');

      // Act
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([
        {
          name: 'file1.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('content1'),
        },
        {
          name: 'file2.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('content2'),
        },
      ]);

      // Assert
      await expect(page.locator('text=file1.pdf')).toBeVisible();
      await expect(page.locator('text=file2.pdf')).toBeVisible();
    });
  });

  test.describe('Rich Text Editor', () => {
    test('should support basic text formatting', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/send');

      // Act
      await page.click('[data-testid="rich-text-toggle"]');
      await page.click('[data-testid="format-bold"]');
      await page.fill('[contenteditable="true"]', 'Bold text');

      // Assert
      await expect(page.locator('[contenteditable="true"] strong')).toContainText('Bold text');
    });

    test('should support inserting links', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/send');

      // Act
      await page.click('[data-testid="rich-text-toggle"]');
      await page.fill('[contenteditable="true"]', 'Click here');
      await page.selectText('[contenteditable="true"]');
      await page.click('[data-testid="insert-link"]');
      await page.fill('[data-testid="link-url"]', 'https://example.com');
      await page.click('button:has-text("Insert")');

      // Assert
      await expect(page.locator('[contenteditable="true"] a[href="https://example.com"]')).toBeVisible();
    });

    test('should toggle between plain text and HTML', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/send');

      await page.click('[data-testid="rich-text-toggle"]');
      await page.fill('[contenteditable="true"]', 'Formatted content');

      // Act
      await page.click('[data-testid="plain-text-toggle"]');

      // Assert
      await expect(page.locator('textarea[name="body_text"]')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network error during send', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/send');

      await page.fill('[name="to"]', 'test@example.com');
      await page.fill('[name="subject"]', 'Test');
      await page.fill('[name="body_text"]', 'Body');

      // Mock network error
      await page.route('**/api/v1/communications/email/send', route => route.abort('failed'));

      // Act
      await page.click('button:has-text("Send Now")');

      // Assert
      await expect(page.locator('text=Network error')).toBeVisible();
      await expect(page.locator('button:has-text("Retry")')).toBeVisible();
    });

    test('should handle SMTP error', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/send');

      await page.fill('[name="to"]', 'test@example.com');
      await page.fill('[name="subject"]', 'Test');
      await page.fill('[name="body_text"]', 'Body');

      // Mock SMTP error
      await page.route('**/api/v1/communications/email/send', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'SMTP server unavailable' }),
        });
      });

      // Act
      await page.click('button:has-text("Send Now")');

      // Assert
      await expect(page.locator('text=SMTP server unavailable')).toBeVisible();
    });

    test('should handle invalid recipient error', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/send');

      await page.fill('[name="to"]', 'invalid@invalid-domain-that-does-not-exist.com');
      await page.fill('[name="subject"]', 'Test');
      await page.fill('[name="body_text"]', 'Body');

      // Mock invalid recipient error
      await page.route('**/api/v1/communications/email/send', route => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Invalid recipient email address' }),
        });
      });

      // Act
      await page.click('button:has-text("Send Now")');

      // Assert
      await expect(page.locator('text=Invalid recipient email address')).toBeVisible();
    });
  });

  test.describe('Success Feedback', () => {
    test('should show success message after sending', async ({ page }) => {
      // Arrange
      const composerPage = new EmailComposerPage(page);
      await composerPage.navigate();

      // Act
      await composerPage.composeEmail(generateTestEmail());
      await composerPage.send();

      // Assert
      await waitForToast(page, 'Email sent successfully');
    });

    test('should clear form after successful send', async ({ page }) => {
      // Arrange
      const composerPage = new EmailComposerPage(page);
      await composerPage.navigate();

      // Act
      await composerPage.composeEmail(generateTestEmail());
      await composerPage.send();

      await page.waitForSelector('text=Email sent successfully');

      // Assert
      await expect(composerPage.toInput).toHaveValue('');
      await expect(composerPage.subjectInput).toHaveValue('');
      await expect(composerPage.bodyTextarea).toHaveValue('');
    });

    test('should allow sending another email after success', async ({ page }) => {
      // Arrange
      const composerPage = new EmailComposerPage(page);
      await composerPage.navigate();

      // Act - Send first email
      await composerPage.composeEmail(generateTestEmail());
      await composerPage.send();
      await page.waitForSelector('text=Email sent successfully');

      // Send second email
      await composerPage.composeEmail(generateTestEmail({ to: 'another@example.com' }));
      await composerPage.send();

      // Assert
      await waitForToast(page, 'Email sent successfully');
    });
  });
});
