#!/usr/bin/env node

/**
 * Script to convert Select components to native HTML select elements
 */

const fs = require("fs");

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: node convert-select.js <file-path>");
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

let content = fs.readFileSync(filePath, "utf8");

// Remove Select-related imports if they exist
content = content.replace(
  /import\s*{\s*([^}]*\bSelect\b[^}]*)\s*}\s*from\s*['"]@\/components\/ui\/select['"]\s*;?\s*\n?/g,
  "",
);

// Pattern to match Select components with their content
// This is a simplified pattern - may need refinement for complex cases
const selectPattern =
  /<Select\s+([^>]*)>\s*<SelectTrigger[^>]*>\s*<SelectValue[^/]*\/>\s*<\/SelectTrigger>\s*<SelectContent[^>]*>([\s\S]*?)<\/SelectContent>\s*<\/Select>/g;

let count = 0;
content = content.replace(selectPattern, (match, props, items) => {
  count++;

  // Extract props
  const valueMatch = props.match(/value=\{([^}]+)\}/);
  const onChangeMatch = props.match(/onValueChange=\{([^}]+)\}/);
  const disabledMatch = props.match(/disabled=\{([^}]+)\}/);

  if (!valueMatch || !onChangeMatch) {
    console.log(`⚠️  Skipping complex Select pattern #${count}`);
    return match; // Keep original if we can't parse it
  }

  const value = valueMatch[1];
  const onValueChange = onChangeMatch[1];
  const disabled = disabledMatch ? disabledMatch[1] : null;

  // Convert SelectItems to options
  const optionsHtml = items.replace(
    /<SelectItem\s+value="([^"]*)">([^<]*)<\/SelectItem>/g,
    '<option value="$1">$2</option>',
  );

  // Build onChange handler
  const onChange = onValueChange
    .replace(/\(value\)\s*=>/, "(e) =>")
    .replace(/value/g, "e.target.value");

  // Build select element
  let selectHtml = `<select\n`;
  selectHtml += `  value={${value}}\n`;
  selectHtml += `  onChange={${onChange}}\n`;
  if (disabled) {
    selectHtml += `  disabled={${disabled}}\n`;
  }
  selectHtml += `  className="h-10 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-white"\n`;
  selectHtml += `>${optionsHtml}</select>`;

  console.log(`✓ Converted Select #${count}`);
  return selectHtml;
});

if (count > 0) {
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`\n✅ Converted ${count} Select components`);
} else {
  console.log("\n⚠️  No Select components found to convert");
}
