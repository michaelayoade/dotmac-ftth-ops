const fs = require('node:fs');
const path = require('node:path');

function resolveInterceptorsSubpath(subpath) {
  const mswPkgDir = path.dirname(require.resolve('msw/package.json'));
  const pnpmModulesDir = path.resolve(mswPkgDir, '..', '..', '..');
  const folders = fs
    .readdirSync(pnpmModulesDir)
    .filter((name) => name.startsWith('@mswjs+interceptors@'));

  if (folders.length === 0) {
    throw new Error('Unable to locate @mswjs/interceptors in the pnpm store');
  }

  const targetFolder = folders.sort((a, b) => compareVersionStrings(versionOf(b), versionOf(a)))[0];
  const baseDir = path.join(pnpmModulesDir, targetFolder, 'node_modules', '@mswjs', 'interceptors');
  return subpath ? path.join(baseDir, subpath) : baseDir;
}

function versionOf(folderName) {
  const match = folderName.match(/@(\d+\.\d+\.\d+)/);
  return match ? match[1] : '0.0.0';
}

function compareVersionStrings(a, b) {
  const partsA = a.split('.').map((part) => parseInt(part, 10));
  const partsB = b.split('.').map((part) => parseInt(part, 10));
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

module.exports = { resolveInterceptorsSubpath };
