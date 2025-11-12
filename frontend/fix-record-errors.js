const fs = require('fs');
const {execSync} = require('child_process');

// Get all files with TS4111 errors
const output = execSync('pnpm --filter @dotmac/isp-ops-app exec tsc --noEmit 2>&1 | grep "TS4111"', {encoding: 'utf8'});
const errorLines = output.trim().split('\n');

// Group errors by file
const fileErrors = {};
errorLines.forEach(line => {
  const match = line.match(/^(.*?):\d+:\d+: error TS4111: Property '(\w+)'/);
  if (match) {
    const [, file, prop] = match;
    if (!fileErrors[file]) {
      fileErrors[file] = new Set();
    }
    fileErrors[file].add(prop);
  }
});

console.log(`Found ${Object.keys(fileErrors).length} files with TS4111 errors\n`);

let fixedFiles = 0;

Object.entries(fileErrors).forEach(([file, props]) => {
  const fullPath = 'apps/isp-ops-app/' + file;

  if (!fs.existsSync(fullPath)) {
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let changed = false;

  // Check if file uses Record<string, string> for errors
  if (content.includes('Record<string, string>')) {
    // Extract property names from errors object usage
    const errorProps = Array.from(props);

    // Generate interface
    const interfaceDef = `interface FormErrors {\n${errorProps.map(p => `  ${p}?: string;`).join('\n')}\n}\n\n`;

    // Replace Record<string, string> with FormErrors
    content = content.replace(/const\s+(\w*[Ee]rrors?)\s*:\s*Record<string,\s*string>\s*=/g, (match, varName) => {
      // Insert interface before first Record usage if not already present
      if (!content.includes('interface FormErrors')) {
        const insertPos = match;
        return interfaceDef + match.replace('Record<string, string>', 'FormErrors');
      }
      return match.replace('Record<string, string>', 'FormErrors');
    });

    changed = content !== fs.readFileSync(fullPath, 'utf8');
  }

  if (changed) {
    fs.writeFileSync(fullPath, content, 'utf8');
    fixedFiles++;
    console.log(`✓ ${file}`);
  }
});

console.log(`\nFixed ${fixedFiles} files`);
console.log('\nNote: Some files may still need manual fixes for complex patterns.');
