#!/usr/bin/env node

/**
 * Browser Inspector - Launch frontend apps and capture console logs
 * Usage: node scripts/browser-inspector.mjs [url] [options]
 */

import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const url = args[0] || 'http://localhost:3001';
const headless = args.includes('--headless');
const screenshot = args.includes('--screenshot');

console.log('🌐 Browser Inspector Starting...');
console.log(`📍 Target URL: ${url}`);
console.log(`👁️  Headless: ${headless}`);
console.log('');

(async () => {
  // Launch browser
  const browser = await chromium.launch({
    headless,
    devtools: !headless, // Open DevTools in headed mode
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    // Record console logs
    recordVideo: undefined,
  });

  const page = await context.newPage();

  // Capture console logs
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    const location = msg.location();

    const emoji = {
      log: '📝',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      debug: '🐛',
    }[type] || '💬';

    console.log(`${emoji} [${type.toUpperCase()}] ${text}`);
    if (location.url) {
      console.log(`   └─ ${location.url}:${location.lineNumber}`);
    }
  });

  // Capture page errors
  page.on('pageerror', (error) => {
    console.error('💥 [PAGE ERROR]', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  });

  // Capture request failures
  page.on('requestfailed', (request) => {
    console.error('🚫 [REQUEST FAILED]', request.url());
    console.error('   └─', request.failure()?.errorText);
  });

  // Capture responses for debugging
  page.on('response', (response) => {
    const status = response.status();
    if (status >= 400) {
      console.error(`❌ [${status}] ${response.url()}`);
    }
  });

  try {
    console.log(`🚀 Navigating to ${url}...`);
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 60000
    }).catch(async (error) => {
      console.warn('⚠️  Initial navigation timeout, trying with commit...');
      await page.goto(url, {
        waitUntil: 'commit',
        timeout: 60000
      });
    });

    console.log('✅ Page loaded successfully!');
    console.log('');
    console.log('📊 Page Info:');
    console.log(`   Title: ${await page.title()}`);
    console.log(`   URL: ${page.url()}`);
    console.log('');

    // Take screenshot if requested
    if (screenshot) {
      const screenshotPath = `screenshot-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 Screenshot saved: ${screenshotPath}`);
      console.log('');
    }

    // Get some basic metrics
    const metrics = await page.evaluate(() => {
      return {
        documentReadyState: document.readyState,
        numberOfElements: document.querySelectorAll('*').length,
        numberOfScripts: document.querySelectorAll('script').length,
        numberOfStylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
      };
    });

    console.log('📈 Page Metrics:');
    console.log(`   Ready State: ${metrics.documentReadyState}`);
    console.log(`   Elements: ${metrics.numberOfElements}`);
    console.log(`   Scripts: ${metrics.numberOfScripts}`);
    console.log(`   Stylesheets: ${metrics.numberOfStylesheets}`);
    console.log('');

    // Get console errors from the page
    const consoleErrors = await page.evaluate(() => {
      const errors = [];
      const originalError = console.error;

      // Get stored errors if any
      if (window.__consoleErrors) {
        return window.__consoleErrors;
      }

      return [];
    });

    if (consoleErrors.length > 0) {
      console.log('');
      console.log('🚨 Console Errors Detected:');
      consoleErrors.forEach(err => console.error('  ', err));
    }

    if (!headless) {
      console.log('');
      console.log('🔍 Browser is open! Press Ctrl+C to close.');
      console.log('💡 DevTools is open - you can inspect the page manually.');
      console.log('📝 Check the Console tab in DevTools for the full error details.');
      console.log('');

      // Keep the process running
      await new Promise(() => {});
    } else {
      // In headless mode, wait a bit to capture logs then close
      await page.waitForTimeout(5000);
      await browser.close();
      console.log('✅ Inspection complete!');
    }

  } catch (error) {
    console.error('💥 Error during inspection:', error.message);
    await browser.close();
    process.exit(1);
  }
})();
