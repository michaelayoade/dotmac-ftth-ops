#!/usr/bin/env node

/**
 * Automated TypeScript Index Signature Error Fixer
 *
 * This script fixes TS4111 errors by converting dot notation to bracket notation
 * for properties that come from index signatures.
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

console.log('🔍 Finding TS4111 index signature errors...\n');

// Run type-check and capture errors
let typeCheckOutput;
try {
  execSync('pnpm --filter @dotmac/platform-admin-app type-check 2>&1', {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024 // 10MB buffer
  });
} catch (error) {
  typeCheckOutput = error.stdout || error.message;
}

// Parse TS4111 errors
const errorRegex = /^(.+?)\((\d+),(\d+)\):\s+error TS4111: Property '([^']+)' comes from an index signature/gm;
const errors = [];
let match;

while ((match = errorRegex.exec(typeCheckOutput)) !== null) {
  const [, filePath, line, column, propertyName] = match;
  errors.push({
    filePath: filePath.trim(),
    line: parseInt(line, 10),
    column: parseInt(column, 10),
    propertyName,
  });
}

console.log(`Found ${errors.length} TS4111 errors to fix\n`);

if (errors.length === 0) {
  console.log('✅ No TS4111 errors found!');
  process.exit(0);
}

// Group errors by file
const errorsByFile = errors.reduce((acc, error) => {
  if (!acc[error.filePath]) {
    acc[error.filePath] = [];
  }
  acc[error.filePath].push(error);
  return acc;
}, {});

// Fix each file
let totalFixed = 0;
const failedFiles = [];

for (const [filePath, fileErrors] of Object.entries(errorsByFile)) {
  console.log(`📝 Fixing ${filePath} (${fileErrors.length} errors)`);

  try {
    // Resolve full path
    const fullPath = filePath.startsWith('/')
      ? filePath
      : `/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/apps/platform-admin-app/${filePath}`;

    // Read file content
    let content = readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    // Sort errors by line number (descending) to avoid offset issues
    const sortedErrors = fileErrors.sort((a, b) => b.line - a.line);

    // Fix each error
    for (const error of sortedErrors) {
      const lineIndex = error.line - 1;

      if (lineIndex < 0 || lineIndex >= lines.length) {
        console.log(`  ⚠️  Line ${error.line} out of bounds, skipping`);
        continue;
      }

      const line = lines[lineIndex];
      const propertyName = error.propertyName;

      // Try to fix the property access
      // Pattern: object.property -> object['property']
      // Be careful with nested properties and method calls

      // More specific regex to avoid false positives
      const patterns = [
        // Simple property access: obj.property
        new RegExp(`\\b([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*\\.\\s*${propertyName}\\b(?!\\s*['"\\[])`, 'g'),
        // Method result property access: func().property
        new RegExp(`\\)\\s*\\.\\s*${propertyName}\\b(?!\\s*['"\\[])`, 'g'),
      ];

      let fixedLine = line;
      let wasFixed = false;

      for (const pattern of patterns) {
        const newLine = fixedLine.replace(pattern, (match) => {
          wasFixed = true;
          if (match.includes('()')) {
            // Method call case: func().property -> func()['property']
            return match.replace(`.${propertyName}`, `['${propertyName}']`);
          } else {
            // Simple case: obj.property -> obj['property']
            return match.replace(`.${propertyName}`, `['${propertyName}']`);
          }
        });

        if (newLine !== fixedLine) {
          fixedLine = newLine;
        }
      }

      if (wasFixed) {
        lines[lineIndex] = fixedLine;
        totalFixed++;
      } else {
        console.log(`  ⚠️  Could not auto-fix line ${error.line}: ${propertyName}`);
      }
    }

    // Write back the fixed content
    const fixedContent = lines.join('\n');
    if (fixedContent !== content) {
      writeFileSync(fullPath, fixedContent, 'utf-8');
      console.log(`  ✅ Fixed ${fileErrors.length} errors`);
    }

  } catch (err) {
    console.error(`  ❌ Error fixing ${filePath}:`, err.message);
    failedFiles.push(filePath);
  }
}

console.log(`\n✨ Fixed ${totalFixed} index signature errors`);

if (failedFiles.length > 0) {
  console.log(`\n⚠️  Failed to fix ${failedFiles.length} files:`);
  failedFiles.forEach(f => console.log(`  - ${f}`));
}

console.log('\n🔄 Running type-check again to verify...\n');

try {
  execSync('pnpm --filter @dotmac/platform-admin-app type-check 2>&1 | grep -E "(error TS|Done)" | head -20', {
    encoding: 'utf-8',
    stdio: 'inherit'
  });
} catch (error) {
  // Type check will fail if there are still errors, that's okay
}

console.log('\n✅ Script complete!');
