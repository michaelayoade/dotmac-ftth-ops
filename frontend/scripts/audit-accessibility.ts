#!/usr/bin/env ts-node

/**
 * Accessibility Audit Script
 *
 * Scans codebase for common accessibility issues
 *
 * Usage:
 *   pnpm audit:a11y
 *   pnpm audit:a11y --fix
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface A11yIssue {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  rule: string;
  message: string;
  code?: string;
}

const issues: A11yIssue[] = [];

/**
 * Check for missing alt text on images
 */
function checkMissingAlt(content: string, filePath: string): void {
  const lines = content.split('\n');

  // Pattern: <img src="..." (without alt attribute)
  const imgRegex = /<img\s+[^>]*src=["'][^"']+["'][^>]*>/g;
  const altRegex = /alt=["'][^"']*["']/;

  lines.forEach((line, index) => {
    const matches = line.match(imgRegex);
    if (matches) {
      matches.forEach((match) => {
        if (!altRegex.test(match)) {
          issues.push({
            file: filePath,
            line: index + 1,
            column: line.indexOf(match),
            severity: 'error',
            rule: 'missing-alt-text',
            message: 'Image is missing alt attribute',
            code: match.trim(),
          });
        }
      });
    }
  });

  // Pattern: <Image src="..." (without alt attribute)
  const nextImageRegex = /<Image\s+[^>]*src=["'][^"']+["'][^>]*\/>/g;

  lines.forEach((line, index) => {
    const matches = line.match(nextImageRegex);
    if (matches) {
      matches.forEach((match) => {
        if (!altRegex.test(match) && !match.includes('decorative')) {
          issues.push({
            file: filePath,
            line: index + 1,
            column: line.indexOf(match),
            severity: 'error',
            rule: 'missing-alt-text',
            message: 'Image component is missing alt attribute',
            code: match.trim(),
          });
        }
      });
    }
  });
}

/**
 * Check for missing button labels
 */
function checkMissingButtonLabels(content: string, filePath: string): void {
  const lines = content.split('\n');

  // Pattern: <button> with only icon (no text)
  const buttonIconRegex = /<button[^>]*>\s*<[^>]*Icon[^>]*\/>\s*<\/button>/g;
  const ariaLabelRegex = /aria-label=["'][^"']+["']/;

  lines.forEach((line, index) => {
    const matches = line.match(buttonIconRegex);
    if (matches) {
      matches.forEach((match) => {
        if (!ariaLabelRegex.test(match)) {
          issues.push({
            file: filePath,
            line: index + 1,
            column: line.indexOf(match),
            severity: 'error',
            rule: 'missing-button-label',
            message: 'Icon button is missing aria-label',
            code: match.trim(),
          });
        }
      });
    }
  });
}

/**
 * Check for missing form labels
 */
function checkMissingFormLabels(content: string, filePath: string): void {
  const lines = content.split('\n');

  // Pattern: <input without id or aria-label
  const inputRegex = /<input\s+[^>]*>/g;
  const idRegex = /id=["'][^"']+["']/;
  const ariaLabelRegex = /aria-label=["'][^"']+["']/;

  lines.forEach((line, index) => {
    const matches = line.match(inputRegex);
    if (matches) {
      matches.forEach((match) => {
        if (
          !idRegex.test(match) &&
          !ariaLabelRegex.test(match) &&
          !match.includes('type="hidden"')
        ) {
          issues.push({
            file: filePath,
            line: index + 1,
            column: line.indexOf(match),
            severity: 'warning',
            rule: 'missing-form-label',
            message: 'Input is missing id or aria-label for label association',
            code: match.trim(),
          });
        }
      });
    }
  });
}

/**
 * Check for improper onClick on non-interactive elements
 */
function checkNonInteractiveClick(content: string, filePath: string): void {
  const lines = content.split('\n');

  // Pattern: <div onClick=... (without role, tabIndex, or onKeyDown)
  const clickRegex = /<(div|span|p|img)[^>]*onClick=/g;
  const roleRegex = /role=["'][^"']+["']/;
  const tabIndexRegex = /tabIndex=/;

  lines.forEach((line, index) => {
    const matches = line.match(clickRegex);
    if (matches) {
      matches.forEach((match) => {
        if (!roleRegex.test(match) && !tabIndexRegex.test(match)) {
          issues.push({
            file: filePath,
            line: index + 1,
            column: line.indexOf(match),
            severity: 'warning',
            rule: 'non-interactive-click',
            message:
              'Non-interactive element has onClick but missing role/tabIndex',
            code: match.trim(),
          });
        }
      });
    }
  });
}

/**
 * Check for skipped heading levels
 */
function checkHeadingLevels(content: string, filePath: string): void {
  const lines = content.split('\n');
  let previousLevel: number | null = null;

  const headingRegex = /<h([1-6])[^>]*>/g;

  lines.forEach((line, index) => {
    const matches = Array.from(line.matchAll(headingRegex));
    matches.forEach((match) => {
      const level = parseInt(match[1], 10);

      if (previousLevel !== null && level > previousLevel + 1) {
        issues.push({
          file: filePath,
          line: index + 1,
          column: match.index || 0,
          severity: 'warning',
          rule: 'skipped-heading-level',
          message: `Heading level skipped from h${previousLevel} to h${level}`,
          code: match[0],
        });
      }

      previousLevel = level;
    });
  });
}

/**
 * Check for missing modal aria attributes
 */
function checkModalAttributes(content: string, filePath: string): void {
  const lines = content.split('\n');

  // Pattern: role="dialog" without aria-modal or aria-labelledby
  const dialogRegex = /role=["']dialog["']/;
  const ariaModalRegex = /aria-modal=["']true["']/;
  const ariaLabelledbyRegex = /aria-labelledby=["'][^"']+["']/;

  lines.forEach((line, index) => {
    if (dialogRegex.test(line)) {
      // Check for aria-modal within next 5 lines
      const contextLines = lines.slice(index, index + 5).join('\n');

      if (!ariaModalRegex.test(contextLines)) {
        issues.push({
          file: filePath,
          line: index + 1,
          column: line.indexOf('role="dialog"'),
          severity: 'error',
          rule: 'missing-aria-modal',
          message: 'Dialog is missing aria-modal="true"',
          code: line.trim(),
        });
      }

      if (!ariaLabelledbyRegex.test(contextLines)) {
        issues.push({
          file: filePath,
          line: index + 1,
          column: line.indexOf('role="dialog"'),
          severity: 'warning',
          rule: 'missing-aria-labelledby',
          message: 'Dialog should have aria-labelledby attribute',
          code: line.trim(),
        });
      }
    }
  });
}

/**
 * Scan file for accessibility issues
 */
async function scanFile(filePath: string): Promise<void> {
  const content = fs.readFileSync(filePath, 'utf-8');

  checkMissingAlt(content, filePath);
  checkMissingButtonLabels(content, filePath);
  checkMissingFormLabels(content, filePath);
  checkNonInteractiveClick(content, filePath);
  checkHeadingLevels(content, filePath);
  checkModalAttributes(content, filePath);
}

/**
 * Main audit function
 */
async function auditAccessibility(): Promise<void> {
  console.log('🔍 Scanning codebase for accessibility issues...\n');

  // Find all TSX files
  const files = await glob('**/*.tsx', {
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
    ],
  });

  // Scan each file
  for (const file of files) {
    await scanFile(file);
  }

  // Generate report
  console.log(`📊 Accessibility Audit Results\n`);
  console.log(`Total files scanned: ${files.length}`);
  console.log(`Total issues found: ${issues.length}\n`);

  if (issues.length === 0) {
    console.log('✅ No accessibility issues found!\n');
    return;
  }

  // Group issues by severity
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const infos = issues.filter((i) => i.severity === 'info');

  console.log(`❌ Errors: ${errors.length}`);
  console.log(`⚠️  Warnings: ${warnings.length}`);
  console.log(`ℹ️  Info: ${infos.length}\n`);

  // Group by rule
  const byRule = issues.reduce((acc, issue) => {
    if (!acc[issue.rule]) {
      acc[issue.rule] = [];
    }
    acc[issue.rule].push(issue);
    return acc;
  }, {} as Record<string, A11yIssue[]>);

  console.log('📋 Issues by Rule:\n');
  Object.entries(byRule)
    .sort(([, a], [, b]) => b.length - a.length)
    .forEach(([rule, ruleIssues]) => {
      console.log(`  ${rule}: ${ruleIssues.length} issues`);
    });

  console.log('\n📄 Detailed Issues:\n');

  // Print first 20 issues
  issues.slice(0, 20).forEach((issue) => {
    const severity =
      issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️ ' : 'ℹ️ ';
    console.log(
      `${severity} ${issue.file}:${issue.line}:${issue.column}`
    );
    console.log(`   ${issue.message} (${issue.rule})`);
    if (issue.code) {
      console.log(`   ${issue.code}`);
    }
    console.log('');
  });

  if (issues.length > 20) {
    console.log(`... and ${issues.length - 20} more issues\n`);
  }

  // Exit with error if there are critical issues
  if (errors.length > 0) {
    console.error(
      `\n❌ Found ${errors.length} critical accessibility error${errors.length === 1 ? '' : 's'}`
    );
    process.exit(1);
  }
}

// Run audit
auditAccessibility().catch((error) => {
  console.error('Error running accessibility audit:', error);
  process.exit(1);
});
