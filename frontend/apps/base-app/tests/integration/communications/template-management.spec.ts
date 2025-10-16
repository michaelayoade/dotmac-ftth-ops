/**
 * Communications Template Management Integration Tests
 *
 * Tests for creating, editing, and managing email templates.
 */

import { test, expect } from '@playwright/test';
import { TemplateListPage } from '../../helpers/page-objects';
import { generateTestUser, generateTestTemplate, generateMultipleTemplates } from '../../fixtures/test-data';
import {
  createTestUser,
  loginUser,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  cleanupTemplates,
} from '../../helpers/api-helpers';

test.describe('Communications Template Management', () => {
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

  test.describe('Template List', () => {
    test('should display empty state when no templates exist', async ({ page }) => {
      // Arrange
      const templateListPage = new TemplateListPage(page);

      // Act
      await templateListPage.navigate();

      // Assert
      await expect(page.locator('text=No templates found')).toBeVisible();
      const count = await templateListPage.getTemplateCount();
      expect(count).toBe(0);
    });

    test('should display list of templates', async ({ page }) => {
      // Arrange - Create test templates
      const templates = generateMultipleTemplates(5);
      for (const template of templates) {
        await createTemplate(template, authToken);
      }

      const templateListPage = new TemplateListPage(page);

      // Act
      await templateListPage.navigate();

      // Assert
      const count = await templateListPage.getTemplateCount();
      expect(count).toBe(5);
    });

    test('should search templates by name', async ({ page }) => {
      // Arrange
      const template1 = generateTestTemplate({ name: 'welcome-email' });
      const template2 = generateTestTemplate({ name: 'password-reset' });
      await createTemplate(template1, authToken);
      await createTemplate(template2, authToken);

      const templateListPage = new TemplateListPage(page);
      await templateListPage.navigate();

      // Act
      await templateListPage.search('welcome');

      // Assert
      await expect(page.locator('text=welcome-email')).toBeVisible();
      await expect(page.locator('text=password-reset')).not.toBeVisible();
    });

    test('should filter templates by channel', async ({ page }) => {
      // Arrange
      const emailTemplate = generateTestTemplate({ channel: 'email' });
      const smsTemplate = generateTestTemplate({ channel: 'sms' });
      await createTemplate(emailTemplate, authToken);
      await createTemplate(smsTemplate, authToken);

      const templateListPage = new TemplateListPage(page);
      await templateListPage.navigate();

      // Act
      await templateListPage.channelFilter.click();
      await page.click('text=Email');

      // Assert
      await expect(page.locator(`text=${emailTemplate.name}`)).toBeVisible();
      await expect(page.locator(`text=${smsTemplate.name}`)).not.toBeVisible();
    });

    test('should show template usage count', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate({ usage_count: 42 });
      await createTemplate(template, authToken);

      // Act
      await page.goto('/dashboard/communications/templates');

      // Assert
      await expect(page.locator('text=42 uses')).toBeVisible();
    });

    test('should show active/inactive status', async ({ page }) => {
      // Arrange
      const activeTemplate = generateTestTemplate({ is_active: true });
      const inactiveTemplate = generateTestTemplate({ is_active: false });
      await createTemplate(activeTemplate, authToken);
      await createTemplate(inactiveTemplate, authToken);

      // Act
      await page.goto('/dashboard/communications/templates');

      // Assert
      await expect(page.locator('[data-status="active"]')).toBeVisible();
      await expect(page.locator('[data-status="inactive"]')).toBeVisible();
    });

    test('should navigate to create page', async ({ page }) => {
      // Arrange
      const templateListPage = new TemplateListPage(page);
      await templateListPage.navigate();

      // Act
      await templateListPage.createButton.click();

      // Assert
      await expect(page).toHaveURL(/\/communications\/templates\/new/);
    });
  });

  test.describe('Template Creation', () => {
    test('should create template with valid data', async ({ page }) => {
      // Arrange
      const templateData = generateTestTemplate();
      await page.goto('/dashboard/communications/templates/new');

      // Act
      await page.fill('[name="name"]', templateData.name);
      await page.fill('[name="description"]', templateData.description!);
      await page.selectOption('[name="channel"]', 'email');
      await page.fill('[name="subject"]', templateData.subject!);
      await page.fill('[name="body_text"]', templateData.body_text!);
      await page.click('button[type="submit"]');

      // Assert
      await expect(page).toHaveURL(/\/communications\/templates\/[a-z0-9-]+$/);
      await expect(page.locator('text=Template created successfully')).toBeVisible();
    });

    test('should show validation error for missing name', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/templates/new');

      // Act
      await page.click('button[type="submit"]');

      // Assert
      await expect(page.locator('text=Template name is required')).toBeVisible();
    });

    test('should show validation error for missing channel', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/templates/new');

      // Act
      await page.fill('[name="name"]', 'test-template');
      await page.click('button[type="submit"]');

      // Assert
      await expect(page.locator('text=Channel is required')).toBeVisible();
    });

    test('should require subject for email templates', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/templates/new');

      // Act
      await page.fill('[name="name"]', 'test-template');
      await page.selectOption('[name="channel"]', 'email');
      await page.fill('[name="body_text"]', 'Body content');
      await page.click('button[type="submit"]');

      // Assert
      await expect(page.locator('text=Subject is required for email templates')).toBeVisible();
    });

    test('should not require subject for SMS templates', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/templates/new');

      // Act
      await page.fill('[name="name"]', 'sms-template');
      await page.selectOption('[name="channel"]', 'sms');
      await page.fill('[name="body_text"]', 'Your code is 123456');
      await page.click('button[type="submit"]');

      // Assert
      await expect(page).toHaveURL(/\/communications\/templates\/[a-z0-9-]+$/);
    });

    test('should detect template variables', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/templates/new');

      // Act
      await page.fill('[name="name"]', 'test-template');
      await page.selectOption('[name="channel"]', 'email');
      await page.fill('[name="subject"]', 'Hello {{ name }}');
      await page.fill('[name="body_text"]', 'Your code is {{ code }} and email is {{ email }}');

      // Assert
      await expect(page.locator('[data-testid="detected-variables"]')).toContainText('name');
      await expect(page.locator('[data-testid="detected-variables"]')).toContainText('code');
      await expect(page.locator('[data-testid="detected-variables"]')).toContainText('email');
    });

    test('should show variable preview', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/templates/new');

      // Act
      await page.fill('[name="name"]', 'test-template');
      await page.selectOption('[name="channel"]', 'email');
      await page.fill('[name="subject"]', 'Hello {{ name }}');
      await page.fill('[name="body_text"]', 'Welcome {{ name }}!');

      await page.click('[data-testid="preview-tab"]');
      await page.fill('[data-testid="preview-variable-name"]', 'John Doe');
      await page.click('[data-testid="render-preview"]');

      // Assert
      await expect(page.locator('[data-testid="preview-subject"]')).toContainText('Hello John Doe');
      await expect(page.locator('[data-testid="preview-body"]')).toContainText('Welcome John Doe!');
    });

    test('should support HTML templates', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/templates/new');

      // Act
      await page.fill('[name="name"]', 'html-template');
      await page.selectOption('[name="channel"]', 'email');
      await page.fill('[name="subject"]', 'HTML Email');
      await page.click('[data-testid="html-mode-toggle"]');
      await page.fill('[name="body_html"]', '<h1>Hello {{ name }}</h1><p>Welcome!</p>');
      await page.click('button[type="submit"]');

      // Assert
      await expect(page).toHaveURL(/\/communications\/templates\/[a-z0-9-]+$/);
    });

    test('should validate HTML syntax', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/templates/new');

      // Act
      await page.fill('[name="name"]', 'html-template');
      await page.selectOption('[name="channel"]', 'email');
      await page.fill('[name="subject"]', 'Test');
      await page.click('[data-testid="html-mode-toggle"]');
      await page.fill('[name="body_html"]', '<h1>Unclosed tag');
      await page.click('button[type="submit"]');

      // Assert
      await expect(page.locator('text=Invalid HTML syntax')).toBeVisible();
    });

    test('should set template as active by default', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/templates/new');

      // Act
      await page.fill('[name="name"]', 'test-template');
      await page.selectOption('[name="channel"]', 'email');
      await page.fill('[name="subject"]', 'Test');
      await page.fill('[name="body_text"]', 'Body');
      await page.click('button[type="submit"]');

      // Assert
      await expect(page.locator('[data-status="active"]')).toBeVisible();
    });

    test('should allow creating inactive template', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/templates/new');

      // Act
      await page.fill('[name="name"]', 'draft-template');
      await page.selectOption('[name="channel"]', 'email');
      await page.fill('[name="subject"]', 'Test');
      await page.fill('[name="body_text"]', 'Body');
      await page.uncheck('[name="is_active"]');
      await page.click('button[type="submit"]');

      // Assert
      await expect(page.locator('[data-status="inactive"]')).toBeVisible();
    });
  });

  test.describe('Template Details', () => {
    test('should display template details', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate();
      const created = await createTemplate(template, authToken);

      // Act
      await page.goto(`/dashboard/communications/templates/${created.id}`);

      // Assert
      await expect(page.locator('h1')).toContainText(template.name);
      await expect(page.locator('text=' + template.subject)).toBeVisible();
      await expect(page.locator('text=' + template.body_text)).toBeVisible();
    });

    test('should display template variables list', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate({
        subject: 'Hello {{ name }}',
        body_text: 'Code: {{ code }}, Email: {{ email }}',
      });
      const created = await createTemplate(template, authToken);

      // Act
      await page.goto(`/dashboard/communications/templates/${created.id}`);

      // Assert
      await expect(page.locator('[data-testid="variable-list"]')).toContainText('name');
      await expect(page.locator('[data-testid="variable-list"]')).toContainText('code');
      await expect(page.locator('[data-testid="variable-list"]')).toContainText('email');
    });

    test('should display usage statistics', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate({ usage_count: 156 });
      const created = await createTemplate(template, authToken);

      // Act
      await page.goto(`/dashboard/communications/templates/${created.id}`);

      // Assert
      await expect(page.locator('[data-testid="usage-count"]')).toContainText('156');
    });

    test('should navigate to edit page', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate();
      const created = await createTemplate(template, authToken);

      await page.goto(`/dashboard/communications/templates/${created.id}`);

      // Act
      await page.click('a:has-text("Edit")');

      // Assert
      await expect(page).toHaveURL(new RegExp(`/communications/templates/${created.id}/edit`));
    });

    test('should allow duplicating template', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate({ name: 'original-template' });
      const created = await createTemplate(template, authToken);

      await page.goto(`/dashboard/communications/templates/${created.id}`);

      // Act
      await page.click('button:has-text("Duplicate")');

      // Assert
      await expect(page).toHaveURL(/\/communications\/templates\/new/);
      await expect(page.locator('[name="name"]')).toHaveValue('original-template (copy)');
    });
  });

  test.describe('Template Update', () => {
    test('should update template details', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate();
      const created = await createTemplate(template, authToken);

      await page.goto(`/dashboard/communications/templates/${created.id}/edit`);

      // Act
      await page.fill('[name="name"]', 'updated-template-name');
      await page.fill('[name="description"]', 'Updated description');
      await page.click('button[type="submit"]');

      // Assert
      await expect(page).toHaveURL(new RegExp(`/communications/templates/${created.id}`));
      await expect(page.locator('text=Template updated successfully')).toBeVisible();
      await expect(page.locator('h1')).toContainText('updated-template-name');
    });

    test('should update template content', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate();
      const created = await createTemplate(template, authToken);

      await page.goto(`/dashboard/communications/templates/${created.id}/edit`);

      // Act
      await page.fill('[name="subject"]', 'Updated Subject {{ name }}');
      await page.fill('[name="body_text"]', 'Updated body with {{ code }}');
      await page.click('button[type="submit"]');

      // Assert
      await expect(page.locator('text=Updated Subject')).toBeVisible();
    });

    test('should toggle template active status', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate({ is_active: true });
      const created = await createTemplate(template, authToken);

      await page.goto(`/dashboard/communications/templates/${created.id}/edit`);

      // Act
      await page.uncheck('[name="is_active"]');
      await page.click('button[type="submit"]');

      // Assert
      await expect(page.locator('[data-status="inactive"]')).toBeVisible();
    });

    test('should prevent using inactive templates', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate({ is_active: false });
      const created = await createTemplate(template, authToken);

      // Act
      await page.goto('/dashboard/communications/send');
      await page.click('[data-testid="use-template"]');

      // Assert
      await expect(page.locator(`[data-template-id="${created.id}"]`)).toBeDisabled();
    });
  });

  test.describe('Template Deletion', () => {
    test('should delete template', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate();
      const created = await createTemplate(template, authToken);

      await page.goto(`/dashboard/communications/templates/${created.id}`);

      // Act
      await page.click('[data-testid="delete-button"]');
      await page.click('text=Confirm'); // Confirmation dialog

      // Assert
      await expect(page).toHaveURL(/\/communications\/templates$/);
      await expect(page.locator('text=Template deleted successfully')).toBeVisible();
    });

    test('should show confirmation before deleting', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate();
      const created = await createTemplate(template, authToken);

      await page.goto(`/dashboard/communications/templates/${created.id}`);

      // Act
      await page.click('[data-testid="delete-button"]');

      // Assert
      await expect(page.locator('text=Are you sure')).toBeVisible();
      await expect(page.locator('text=This action cannot be undone')).toBeVisible();
    });

    test('should warn if template is in use', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate({ usage_count: 50 });
      const created = await createTemplate(template, authToken);

      await page.goto(`/dashboard/communications/templates/${created.id}`);

      // Act
      await page.click('[data-testid="delete-button"]');

      // Assert
      await expect(page.locator('text=has been used 50 times')).toBeVisible();
    });

    test('should cancel template deletion', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate();
      const created = await createTemplate(template, authToken);

      await page.goto(`/dashboard/communications/templates/${created.id}`);

      // Act
      await page.click('[data-testid="delete-button"]');
      await page.click('text=Cancel');

      // Assert - Should still be on details page
      await expect(page).toHaveURL(new RegExp(`/communications/templates/${created.id}`));
    });
  });

  test.describe('Template Testing', () => {
    test('should send test email from template', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate();
      const created = await createTemplate(template, authToken);

      await page.goto(`/dashboard/communications/templates/${created.id}`);

      // Act
      await page.click('button:has-text("Send Test")');
      await page.fill('[data-testid="test-email"]', 'test@example.com');
      await page.fill('[data-testid="test-variable-name"]', 'John');
      await page.click('button:has-text("Send")');

      // Assert
      await expect(page.locator('text=Test email sent successfully')).toBeVisible();
    });

    test('should require test recipient', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate();
      const created = await createTemplate(template, authToken);

      await page.goto(`/dashboard/communications/templates/${created.id}`);

      // Act
      await page.click('button:has-text("Send Test")');
      await page.click('button:has-text("Send")');

      // Assert
      await expect(page.locator('text=Test recipient email is required')).toBeVisible();
    });

    test('should provide default values for test variables', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate({
        subject: 'Hello {{ name }}',
        body_text: 'Your code is {{ code }}',
      });
      const created = await createTemplate(template, authToken);

      await page.goto(`/dashboard/communications/templates/${created.id}`);

      // Act
      await page.click('button:has-text("Send Test")');

      // Assert - Should have default values
      await expect(page.locator('[data-testid="test-variable-name"]')).toHaveValue('Test User');
      await expect(page.locator('[data-testid="test-variable-code"]')).toHaveValue('123456');
    });
  });

  test.describe('Bulk Operations', () => {
    test('should bulk activate templates', async ({ page }) => {
      // Arrange
      const templates = generateMultipleTemplates(3);
      for (const template of templates) {
        template.is_active = false;
        await createTemplate(template, authToken);
      }

      await page.goto('/dashboard/communications/templates');

      // Act
      await page.click('[data-testid="select-all"]');
      await page.click('button:has-text("Activate Selected")');

      // Assert
      await expect(page.locator('text=3 templates activated')).toBeVisible();
    });

    test('should bulk deactivate templates', async ({ page }) => {
      // Arrange
      const templates = generateMultipleTemplates(3);
      for (const template of templates) {
        await createTemplate(template, authToken);
      }

      await page.goto('/dashboard/communications/templates');

      // Act
      await page.click('[data-testid="select-all"]');
      await page.click('button:has-text("Deactivate Selected")');

      // Assert
      await expect(page.locator('text=3 templates deactivated')).toBeVisible();
    });

    test('should bulk delete templates', async ({ page }) => {
      // Arrange
      const templates = generateMultipleTemplates(3);
      for (const template of templates) {
        await createTemplate(template, authToken);
      }

      await page.goto('/dashboard/communications/templates');

      // Act
      await page.click('[data-testid="select-all"]');
      await page.click('button:has-text("Delete Selected")');
      await page.click('text=Confirm');

      // Assert
      await expect(page.locator('text=3 templates deleted')).toBeVisible();
    });
  });
});
