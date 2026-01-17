const path = require('path');

function packageRoot() {
  return path.resolve(__dirname, '..');
}

function assetPath(...parts) {
  return path.join(packageRoot(), 'assets', ...parts);
}

module.exports = {
  assetPath,
  packageRoot,
};