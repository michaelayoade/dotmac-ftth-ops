#!/usr/bin/env node

/**
 * Script to fix TypeScript strict mode errors:
 * 1. TS4111: Index signature access errors (obj.property -> obj['property'])
 * 2. TS2375/TS2379: exactOptionalPropertyTypes errors
 */

const fs = require('fs');
const path = require('path');

// List of properties that commonly come from Record types (index signatures)
// These need to be accessed with bracket notation
const INDEX_SIGNATURE_PROPERTIES = [
  'id', 'type', 'description', 'customer_name', 'amount', 'created_at',
  'status', 'to', 'cc', 'bcc', 'reply_to', 'subject', 'template_id',
  'body_text', 'variables', 'name', 'email', 'phone'
];

function fixIndexSignatureAccess(content, filePath) {
  let modified = content;
  let changeCount = 0;

  // Pattern: params.property or formData.property where property is from index signature
  INDEX_SIGNATURE_PROPERTIES.forEach(prop => {
    // Match patterns like: params.id, formData.template_id, etc.
    // But avoid: object.property when it's clearly a typed object
    const patterns = [
      // params.property -> params['property']
      new RegExp(`(params)\\.${prop}(?![a-zA-Z_])`, 'g'),
      // formData.property -> formData['property']
      new RegExp(`(formData)\\.${prop}(?![a-zA-Z_])`, 'g'),
      // data.property -> data['property'] (be careful with this)
      new RegExp(`\\b(data)\\.${prop}(?![a-zA-Z_])`, 'g'),
    ];

    patterns.forEach(pattern => {
      const newModified = modified.replace(pattern, (match, objectName) => {
        changeCount++;
        return `${objectName}['${prop}']`;
      });
      modified = newModified;
    });
  });

  if (changeCount > 0) {
    console.log(`  Fixed ${changeCount} index signature access(es) in ${path.basename(filePath)}`);
  }

  return modified;
}

function fixExactOptionalProps(content, filePath) {
  let modified = content;
  let changeCount = 0;

  // Pattern 1: undefined assignments to optional properties
  // This is complex and needs manual review, but we can fix some common patterns

  // Pattern: property: value | undefined -> property: value !== undefined ? value : null
  // Only in specific contexts where we're creating objects

  // Common pattern in forms:
  // { property: formData.property || undefined } -> { property: formData.property || null }
  const undefinedToNull = modified.replace(
    /(\w+):\s*([^,}\n]+)\s*\|\|\s*undefined/g,
    (match, prop, value) => {
      changeCount++;
      return `${prop}: ${value} || null`;
    }
  );

  if (undefinedToNull !== modified) {
    modified = undefinedToNull;
  }

  // Pattern: Explicit undefined values
  // { bank_account_id: undefined } -> { ...(bank_account_id !== undefined && { bank_account_id }) }
  // This is too complex for regex, needs manual fix

  if (changeCount > 0) {
    console.log(`  Fixed ${changeCount} exactOptionalPropertyTypes error(s) in ${path.basename(filePath)}`);
  }

  return modified;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  let modified = content;

  modified = fixIndexSignatureAccess(modified, filePath);
  modified = fixExactOptionalProps(modified, filePath);

  if (modified !== content) {
    fs.writeFileSync(filePath, modified, 'utf-8');
    return true;
  }

  return false;
}

function findTsxFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Skip node_modules, .next, etc.
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...findTsxFiles(fullPath));
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

// Main execution
const appsDir = path.join(__dirname, 'apps');
const apps = ['isp-ops-app', 'platform-admin-app'];

console.log('Fixing TypeScript strict mode errors...\n');

let totalFilesModified = 0;

apps.forEach(app => {
  const appPath = path.join(appsDir, app, 'app');
  if (!fs.existsSync(appPath)) {
    console.log(`Skipping ${app} (not found)`);
    return;
  }

  console.log(`Processing ${app}...`);
  const files = findTsxFiles(appPath);

  files.forEach(file => {
    if (processFile(file)) {
      totalFilesModified++;
    }
  });
});

console.log(`\n✓ Modified ${totalFilesModified} files`);
console.log('\nNote: Some errors require manual fixes. Run pnpm type-check to see remaining errors.');
