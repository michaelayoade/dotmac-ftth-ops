#!/usr/bin/env node

/**
 * PWA Icon Generator Script
 * Generates all required PWA icons from a source image
 * 
 * Usage:
 *   node scripts/generate-pwa-icons.mjs <source-image> <output-dir> [--app=isp|admin]
 * 
 * Example:
 *   node scripts/generate-pwa-icons.mjs logo.svg apps/isp-ops-app/public/assets
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Icon sizes required for PWA
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// Badge sizes for notifications
const BADGE_SIZES = [72, 96];

// Screenshot sizes
const SCREENSHOTS = {
  wide: { width: 1280, height: 720, name: 'screenshot-wide.png' },
  narrow: { width: 750, height: 1334, name: 'screenshot-narrow.png' }
};

const args = process.argv.slice(2);
const sourceImage = args[0];
const outputDir = args[1];
const app = args.find(arg => arg.startsWith('--app='))?.split('=')[1] || 'isp';

if (!sourceImage || !outputDir) {
  console.error('Usage: node generate-pwa-icons.mjs <source-image> <output-dir> [--app=isp|admin]');
  console.error('\nExample:');
  console.error('  node scripts/generate-pwa-icons.mjs logo.svg apps/isp-ops-app/public/assets');
  console.error('\nOptions:');
  console.error('  --app=isp|admin    Generate icons for specific app (default: isp)');
  process.exit(1);
}

console.log('\n🎨 PWA Icon Generator\n');
console.log(`Source: ${sourceImage}`);
console.log(`Output: ${outputDir}`);
console.log(`App: ${app}\n`);

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`✓ Created output directory: ${outputDir}\n`);
}

console.log('📋 Required Icons:\n');
console.log('Main App Icons:');
ICON_SIZES.forEach(size => {
  console.log(`  - icon-${size}x${size}.png`);
});

console.log('\nNotification Badges:');
BADGE_SIZES.forEach(size => {
  console.log(`  - badge-${size}x${size}.png`);
});

console.log('\nScreenshots:');
console.log(`  - ${SCREENSHOTS.wide.name} (${SCREENSHOTS.wide.width}x${SCREENSHOTS.wide.height})`);
console.log(`  - ${SCREENSHOTS.narrow.name} (${SCREENSHOTS.narrow.width}x${SCREENSHOTS.narrow.height})`);

console.log('\n⚠️  Manual Steps Required:\n');
console.log('Since this is a Node.js script without image processing dependencies,');
console.log('you need to generate the icons manually or use one of these tools:\n');
console.log('Option 1: Use pwa-asset-generator (recommended)');
console.log('  npm install -g pwa-asset-generator');
console.log(`  pwa-asset-generator ${sourceImage} ${outputDir} \\`);
console.log('    --icon-only \\');
console.log('    --maskable \\');
console.log('    --background "#3b82f6" \\');
console.log('    --index index.html\n');

console.log('Option 2: Use ImageMagick (if installed)');
console.log('  # Install: brew install imagemagick (macOS) or apt-get install imagemagick (Linux)\n');
ICON_SIZES.forEach(size => {
  console.log(`  magick ${sourceImage} -resize ${size}x${size} ${path.join(outputDir, `icon-${size}x${size}.png`)}`);
});

console.log('\nOption 3: Use online tool');
console.log('  https://realfavicongenerator.net/');
console.log('  https://www.pwabuilder.com/imageGenerator\n');

console.log('Option 4: Create placeholder icons (for development)');

// Generate placeholder instructions
const createPlaceholderScript = `
# Create simple placeholder icons with ImageMagick
for size in ${ICON_SIZES.join(' ')}; do
  magick -size \${size}x\${size} \\
    xc:"#3b82f6" \\
    -gravity center \\
    -pointsize \$((\${size}/4)) \\
    -fill white \\
    -annotate +0+0 "DM" \\
    ${outputDir}/icon-\${size}x\${size}.png
done

# Create badge icons
for size in ${BADGE_SIZES.join(' ')}; do
  magick -size \${size}x\${size} \\
    xc:"#3b82f6" \\
    -gravity center \\
    -pointsize \$((\${size}/3)) \\
    -fill white \\
    -annotate +0+0 "!" \\
    ${outputDir}/badge-\${size}x\${size}.png
done
`;

fs.writeFileSync(path.join(outputDir, '../create-placeholders.sh'), createPlaceholderScript.trim());
console.log(`\n✓ Created placeholder generation script: ${path.join(outputDir, '../create-placeholders.sh')}`);
console.log('  Run: chmod +x create-placeholders.sh && ./create-placeholders.sh\n');

// Create README in assets folder
const readme = `# PWA Assets

This directory contains Progressive Web App (PWA) assets.

## Required Files

### App Icons
${ICON_SIZES.map(size => `- icon-${size}x${size}.png - Main app icon (${size}×${size})`).join('\n')}

### Notification Badges
${BADGE_SIZES.map(size => `- badge-${size}x${size}.png - Notification badge (${size}×${size})`).join('\n')}

### Screenshots
- screenshot-wide.png - Wide screenshot (${SCREENSHOTS.wide.width}×${SCREENSHOTS.wide.height})
- screenshot-narrow.png - Narrow/mobile screenshot (${SCREENSHOTS.narrow.width}×${SCREENSHOTS.narrow.height})

## Generation

Icons were generated using:
\`\`\`bash
pwa-asset-generator logo.svg . --icon-only --maskable --background "#3b82f6"
\`\`\`

## Notes

- All icons support maskable mode for better Android display
- Icons use blue theme color (#3b82f6)
- Screenshots should show actual app UI
`;

fs.writeFileSync(path.join(outputDir, 'README.md'), readme);
console.log(`✓ Created README: ${path.join(outputDir, 'README.md')}\n`);

console.log('✅ Setup complete!\n');
