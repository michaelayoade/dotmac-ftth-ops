#!/usr/bin/env node

/**
 * Codemod to migrate from sonner toast to useToast hook
 *
 * Transforms:
 * - import { toast } from 'sonner' -> import { useToast } from '@/components/ui/use-toast'
 * - toast.success('msg') -> toast({ title: 'Success', description: 'msg' })
 * - toast.error('msg') -> toast({ title: 'Error', description: 'msg', variant: 'destructive' })
 * - toast.info('msg') -> toast({ title: 'Info', description: 'msg' })
 * - toast.warning('msg') -> toast({ title: 'Warning', description: 'msg' })
 * - toast('msg') -> toast({ description: 'msg' })
 *
 * Also adds const { toast } = useToast() hook at the beginning of function components
 */

const fs = require("fs");
const path = require("path");

// Files to process
const filesToProcess = [
  "app/test-plugins/page.tsx",
  "app/dashboard/settings/integrations/page.tsx",
  "app/dashboard/settings/organization/page.tsx",
  "app/dashboard/settings/profile/page.tsx",
  "app/dashboard/settings/notifications/page.tsx",
  "contexts/RBACContext.tsx",
  "hooks/useObservability.ts",
  "hooks/useLogs.ts",
  "hooks/useCustomersQuery.ts",
  "components/communications/CommunicationsDashboard.tsx",
];

function migrateFile(filePath) {
  console.log(`\n📝 Processing ${filePath}...`);

  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  File not found, skipping`);
    return;
  }

  let content = fs.readFileSync(filePath, "utf8");
  let modified = false;

  // Check if file has toast calls that need migration
  const hasToastCalls = /toast\.(success|error|warning|info)\s*\(/.test(content);
  const hasUseToastImport = content.includes("from '@/components/ui/use-toast'");

  if (!hasToastCalls && hasUseToastImport) {
    console.log(`  ✓ Already migrated, skipping`);
    return;
  }

  if (!hasToastCalls && !hasUseToastImport) {
    console.log(`  ✓ No toast calls found, skipping`);
    return;
  }

  // Step 1: Replace import statement (already done, but double-check)
  if (content.includes("from 'sonner'") || content.includes('from "sonner"')) {
    content = content.replace(
      /import\s*{\s*toast\s*}\s*from\s*['"]sonner['"]\s*;?/g,
      "import { useToast } from '@/components/ui/use-toast';",
    );
    modified = true;
    console.log("  ✓ Replaced import statement");
  }

  // Step 2: Find the main function/component and add useToast hook
  // Look for export default function or export function patterns
  const functionPatterns = [
    /export\s+default\s+function\s+(\w+)\s*\([^)]*\)\s*{/,
    /export\s+function\s+(\w+)\s*\([^)]*\)\s*{/,
    /const\s+(\w+)\s*[:=]\s*\([^)]*\)\s*=>\s*{/,
    /function\s+(\w+)\s*\([^)]*\)\s*{/,
  ];

  for (const pattern of functionPatterns) {
    const match = content.match(pattern);
    if (match) {
      const fullMatch = match[0];
      const functionName = match[1];

      // Check if useToast hook already exists
      if (!content.includes("const { toast } = useToast()")) {
        // Add the hook right after the function declaration
        const hookLine = `\n  const { toast } = useToast();\n`;
        content = content.replace(fullMatch, fullMatch + hookLine);
        modified = true;
        console.log(`  ✓ Added useToast hook to ${functionName}`);
      }
      break;
    }
  }

  // Step 3: Replace toast calls
  // Match toast.success/error/warning/info with any content (including template literals, expressions)
  const replacements = [
    // toast.success(...) - matches any content between parentheses
    {
      pattern: /toast\.success\(([^)]+)\)/g,
      replacement: (match, content) => {
        return `toast({ title: 'Success', description: ${content} })`;
      },
      name: "toast.success",
    },
    // toast.error(...)
    {
      pattern: /toast\.error\(([^)]+)\)/g,
      replacement: (match, content) => {
        return `toast({ title: 'Error', description: ${content}, variant: 'destructive' })`;
      },
      name: "toast.error",
    },
    // toast.warning(...)
    {
      pattern: /toast\.warning\(([^)]+)\)/g,
      replacement: (match, content) => {
        return `toast({ title: 'Warning', description: ${content} })`;
      },
      name: "toast.warning",
    },
    // toast.info(...)
    {
      pattern: /toast\.info\(([^)]+)\)/g,
      replacement: (match, content) => {
        return `toast({ title: 'Info', description: ${content} })`;
      },
      name: "toast.info",
    },
  ];

  replacements.forEach(({ pattern, replacement, name }) => {
    const beforeCount = (content.match(pattern) || []).length;
    if (beforeCount > 0) {
      content = content.replace(pattern, replacement);
      modified = true;
      console.log(`  ✓ Replaced ${beforeCount} ${name} call(s)`);
    }
  });

  // Step 4: Add explanatory comment at the top if modified
  if (modified && !content.includes("// Migrated from sonner to useToast")) {
    const commentBlock = `// Migrated from sonner to useToast hook
// Note: toast options have changed:
// - sonner: toast.success('msg') -> useToast: toast({ title: 'Success', description: 'msg' })
// - sonner: toast.error('msg') -> useToast: toast({ title: 'Error', description: 'msg', variant: 'destructive' })
// - For complex options, refer to useToast documentation

`;
    // Insert after the first import or at the beginning
    const firstImportIndex = content.indexOf("import");
    if (firstImportIndex !== -1) {
      const endOfImports = content.indexOf("\n\n", firstImportIndex);
      if (endOfImports !== -1) {
        content =
          content.slice(0, endOfImports + 2) + commentBlock + content.slice(endOfImports + 2);
      }
    }
  }

  // Step 5: Write back to file
  if (modified) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`  ✅ File updated successfully`);
  } else {
    console.log(`  ℹ️  No changes needed`);
  }
}

// Main execution
console.log("🚀 Starting sonner to useToast migration...\n");
console.log(`Processing ${filesToProcess.length} files:\n`);

let processedCount = 0;
let errorCount = 0;

filesToProcess.forEach((file) => {
  try {
    migrateFile(file);
    processedCount++;
  } catch (error) {
    console.error(`  ❌ Error processing ${file}:`, error.message);
    errorCount++;
  }
});

console.log(`\n${"=".repeat(50)}`);
console.log(`✨ Migration complete!`);
console.log(`   Processed: ${processedCount} files`);
console.log(`   Errors: ${errorCount} files`);
console.log(`${"=".repeat(50)}\n`);

if (errorCount === 0) {
  console.log("✅ All files migrated successfully!");
  console.log("\n💡 Next steps:");
  console.log("   1. Run: pnpm run build");
  console.log("   2. Review changes and test manually");
  console.log("   3. Check for any toast calls with complex options that need manual migration\n");
} else {
  console.log("⚠️  Some files had errors. Please review and fix manually.\n");
}
