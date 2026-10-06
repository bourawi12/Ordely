const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src', 'voice', 'runtime');
const distDir = path.join(projectRoot, 'dist', 'voice', 'runtime');

fs.mkdirSync(distDir, { recursive: true });
let copied = 0;
for (const entry of fs.readdirSync(srcDir)) {
  const srcFile = path.join(srcDir, entry);
  const destFile = path.join(distDir, entry);
  if (fs.statSync(srcFile).isFile()) {
    fs.copyFileSync(srcFile, destFile);
    copied += 1;
  }
}

console.log(`Copied ${copied} voice runtime files to ${distDir}`);
