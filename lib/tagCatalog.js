const path = require('path');

const { assetPath } = require('./paths');
const { readText } = require('./fs');

function loadTagCatalog() {
  const manifestPath = assetPath('tags.json');
  const raw = readText(manifestPath);
  const manifest = JSON.parse(raw);

  if (!manifest || !Array.isArray(manifest.tags)) {
    throw new Error('Invalid tags manifest: assets/tags.json');
  }

  const tags = manifest.tags.map((t) => {
    if (!t.tag_name || !t.file) {
      throw new Error('Invalid tags manifest entry.');
    }
    const tagPath = assetPath(t.file);
    const content = readText(tagPath);
    return {
      tag_name: t.tag_name,
      content,
      source: path.normalize(t.file),
    };
  });

  return { version: manifest.version || 1, tags };
}

module.exports = {
  loadTagCatalog,
};