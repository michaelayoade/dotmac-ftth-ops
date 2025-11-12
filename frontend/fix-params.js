const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all dynamic route pages
const output = execSync('find apps/isp-ops-app/app/dashboard -name "page.tsx" -path \'*\\[*\\]*\'', { encoding: 'utf8' });
const files = output.trim().split('\n').filter(f => f);

console.log(`Found ${files.length} dynamic route files\n`);

let fixedCount = 0;
let checkedCount = 0;

files.forEach(file => {
  // Extract all param names from the path (e.g., [id], [jobId], [subscriberId])
  const matches = file.match(/\[(\w+)\]/g);
  if (!matches) {
    return;
  }

  const params = matches.map(m => m.replace(/[\[\]]/g, ''));

  if (!fs.existsSync(file)) {
    return;
  }

  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  checkedCount++;

  params.forEach(param => {
    // Check for params.param or params?.param
    const dotPattern = 'params.' + param;
    const optionalDotPattern = 'params?.' + param;

    if (content.includes(dotPattern) || content.includes(optionalDotPattern)) {
      // Replace with bracket notation - use word boundaries
      const regex1 = new RegExp('params\\.' + param + '\\b', 'g');
      const regex2 = new RegExp('params\\?\\.' + param + '\\b', 'g');

      content = content.replace(regex1, "params['" + param + "']");
      content = content.replace(regex2, "params?.['" + param + "']");
      changed = true;
    }
  });

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    fixedCount++;
    console.log('✓ Fixed: ' + file);
  }
});

console.log('\nChecked: ' + checkedCount + ' files');
console.log('Fixed: ' + fixedCount + ' files');
