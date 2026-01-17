const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath, content, { force = false } = {}) {
  const dir = path.dirname(filePath);
  ensureDir(dir);

  if (!force && fs.existsSync(filePath)) {
    return { written: false };
  }

  fs.writeFileSync(filePath, content, 'utf8');
  return { written: true };
}

module.exports = {
  ensureDir,
  readText,
  writeText,
};