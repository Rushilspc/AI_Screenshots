import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const tsMain = JSON.parse(fs.readFileSync('tsconfig.main.json', 'utf8'));

const expectedMain = 'dist/main/main.js';
const outDir = tsMain.compilerOptions?.outDir;

if (pkg.main !== expectedMain) {
  throw new Error(`package.json main must be ${expectedMain}, found ${pkg.main}`);
}

if (outDir !== 'dist') {
  throw new Error(`tsconfig.main.json outDir must be dist, found ${outDir}`);
}

if (!fs.existsSync('electron-builder.yml')) {
  throw new Error('electron-builder.yml missing');
}

const builder = fs.readFileSync('electron-builder.yml', 'utf8');
if (!builder.includes('main: dist/main/main.js')) {
  throw new Error('electron-builder.yml extraMetadata.main is not dist/main/main.js');
}

console.log('packaging path verification passed');
